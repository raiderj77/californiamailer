import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { NextRequest } from 'next/server';

export interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitMaintenance {
  expiredRemoved: number;
  evicted: number;
}

export const RATE_LIMIT_MAX_BUCKETS = 4_096;

const UNTRUSTED_RUNTIME_CLIENT = 'shared-untrusted-runtime-client';
const UNKNOWN_VERCEL_CLIENT = 'shared-unknown-vercel-client';

const globalBuckets = globalThis as typeof globalThis & {
  californiaMailerRateLimits?: Map<string, RateLimitBucket>;
};

const buckets = globalBuckets.californiaMailerRateLimits ?? new Map<string, RateLimitBucket>();
globalBuckets.californiaMailerRateLimits = buckets;

/**
 * This map is defense-in-depth for one warm application process only. It is
 * intentionally bounded, but it is neither durable nor shared across runtime
 * instances. Production-wide abuse controls still belong at the hosting edge
 * or in a durable distributed limiter.
 */

export function advanceRateLimitBucket(
  current: RateLimitBucket | null,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number; bucket: RateLimitBucket } {
  if (!current || current.resetAt <= now) {
    return {
      allowed: true,
      retryAfterSeconds: 0,
      bucket: { count: 1, resetAt: now + windowMs },
    };
  }
  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      bucket: current,
    };
  }
  return {
    allowed: true,
    retryAfterSeconds: 0,
    bucket: { count: current.count + 1, resetAt: current.resetAt },
  };
}

export function rateLimitClientIdentity(
  headers: Pick<Headers, 'get'>,
  trustedVercelRuntime = process.env.VERCEL === '1',
): string {
  if (!trustedVercelRuntime) return UNTRUSTED_RUNTIME_CLIENT;

  // Vercel documents this as the stable client-IP value when another proxy
  // can overwrite the ordinary x-forwarded-for header. Never trust client-IP
  // request headers outside the explicit Vercel runtime boundary.
  const candidate = headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ?? '';
  return isIP(candidate) ? candidate : UNKNOWN_VERCEL_CLIENT;
}

export function requestFingerprint(request: NextRequest, scope: string): string {
  const clientIdentity = rateLimitClientIdentity(request.headers);
  return createHash('sha256').update(`${scope}:${clientIdentity}`).digest('hex');
}

export function pruneAndLimitRateLimitBuckets(
  store: Map<string, RateLimitBucket>,
  now: number,
  maxBuckets: number,
): RateLimitMaintenance {
  if (!Number.isSafeInteger(maxBuckets) || maxBuckets < 0) {
    throw new RangeError('Rate-limit bucket capacity must be a nonnegative safe integer.');
  }

  let expiredRemoved = 0;
  for (const [key, bucket] of store) {
    if (bucket.resetAt <= now) {
      store.delete(key);
      expiredRemoved += 1;
    }
  }

  const overflow = Math.max(0, store.size - maxBuckets);
  if (overflow > 0) {
    const evictionOrder = [...store.entries()].sort(
      ([leftKey, left], [rightKey, right]) => left.resetAt - right.resetAt
        || (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0),
    );
    for (const [key] of evictionOrder.slice(0, overflow)) store.delete(key);
  }

  return { expiredRemoved, evicted: overflow };
}

export function consumeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  return consumeRateLimitFromStore(buckets, key, limit, windowMs, now);
}

export function consumeRateLimitFromStore(
  store: Map<string, RateLimitBucket>,
  key: string,
  limit: number,
  windowMs: number,
  now: number,
  maxBuckets = RATE_LIMIT_MAX_BUCKETS,
): { allowed: boolean; retryAfterSeconds: number } {
  if (!Number.isSafeInteger(maxBuckets) || maxBuckets < 1) {
    throw new RangeError('Rate-limit bucket capacity must be a positive safe integer.');
  }
  const capacityBeforeInsert = store.has(key) ? maxBuckets : maxBuckets - 1;
  pruneAndLimitRateLimitBuckets(store, now, capacityBeforeInsert);
  const current = store.get(key);
  const next = advanceRateLimitBucket(current ?? null, limit, windowMs, now);
  if (next.allowed) store.set(key, next.bucket);
  return { allowed: next.allowed, retryAfterSeconds: next.retryAfterSeconds };
}
