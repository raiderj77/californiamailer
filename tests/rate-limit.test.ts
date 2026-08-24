import assert from 'node:assert/strict';
import test from 'node:test';
import {
  advanceRateLimitBucket,
  consumeRateLimitFromStore,
  pruneAndLimitRateLimitBuckets,
  rateLimitClientIdentity,
} from '../src/lib/rateLimit';

test('rate-limit buckets start, increment, block, and reset deterministically', () => {
  const started = advanceRateLimitBucket(null, 2, 1_000, 10_000);
  assert.deepEqual(started, {
    allowed: true,
    retryAfterSeconds: 0,
    bucket: { count: 1, resetAt: 11_000 },
  });

  const incremented = advanceRateLimitBucket(started.bucket, 2, 1_000, 10_100);
  assert.deepEqual(incremented.bucket, { count: 2, resetAt: 11_000 });
  assert.equal(incremented.allowed, true);

  const blocked = advanceRateLimitBucket(incremented.bucket, 2, 1_000, 10_200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.deepEqual(blocked.bucket, incremented.bucket);

  const reset = advanceRateLimitBucket(blocked.bucket, 2, 1_000, 11_000);
  assert.equal(reset.allowed, true);
  assert.deepEqual(reset.bucket, { count: 1, resetAt: 12_000 });
});

test('client identity trusts only the Vercel-specific header inside the explicit Vercel boundary', () => {
  const spoofableHeaders = new Headers({
    'x-forwarded-for': '203.0.113.20',
    'x-real-ip': '203.0.113.21',
    'x-vercel-forwarded-for': '198.51.100.8, 10.0.0.1',
  });

  assert.equal(
    rateLimitClientIdentity(spoofableHeaders, false),
    'shared-untrusted-runtime-client',
  );
  assert.equal(rateLimitClientIdentity(spoofableHeaders, true), '198.51.100.8');
  assert.equal(
    rateLimitClientIdentity(new Headers({ 'x-forwarded-for': '203.0.113.20' }), true),
    'shared-unknown-vercel-client',
  );
  assert.equal(
    rateLimitClientIdentity(new Headers({ 'x-vercel-forwarded-for': 'not-an-ip' }), true),
    'shared-unknown-vercel-client',
  );
});

test('bucket maintenance removes expired records and deterministically evicts earliest reset/key ties', () => {
  const buckets = new Map([
    ['expired', { count: 1, resetAt: 10_000 }],
    ['later', { count: 1, resetAt: 40_000 }],
    ['tie-b', { count: 1, resetAt: 30_000 }],
    ['tie-a', { count: 1, resetAt: 30_000 }],
  ]);

  const result = pruneAndLimitRateLimitBuckets(buckets, 10_000, 2);

  assert.deepEqual(result, { expiredRemoved: 1, evicted: 1 });
  assert.deepEqual([...buckets.keys()].sort(), ['later', 'tie-b']);
});

test('bucket maintenance enforces zero capacity and rejects invalid bounds', () => {
  const buckets = new Map([
    ['b', { count: 1, resetAt: 20_000 }],
    ['a', { count: 1, resetAt: 20_000 }],
  ]);

  assert.deepEqual(
    pruneAndLimitRateLimitBuckets(buckets, 10_000, 0),
    { expiredRemoved: 0, evicted: 2 },
  );
  assert.equal(buckets.size, 0);
  assert.throws(
    () => pruneAndLimitRateLimitBuckets(new Map(), 10_000, -1),
    RangeError,
  );
});

test('store consumption reserves insertion space and never exceeds its configured capacity', () => {
  const buckets = new Map();
  for (const key of ['a', 'b', 'c', 'd']) {
    const result = consumeRateLimitFromStore(buckets, key, 2, 10_000, 1_000, 3);
    assert.equal(result.allowed, true);
    assert.ok(buckets.size <= 3);
  }

  assert.deepEqual([...buckets.keys()].sort(), ['b', 'c', 'd']);
  assert.throws(
    () => consumeRateLimitFromStore(new Map(), 'key', 1, 1_000, 1_000, 0),
    RangeError,
  );
});
