import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdvertiserPortalError,
  consumeAdvertiserPortalInvite,
} from '@/lib/advertiserPortal';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';
import { reservationCookieName } from '@/lib/reservationAuth';

export const runtime = 'nodejs';
const MAX_BODY_BYTES = 2_048;
const consumeSchema = z.object({ token: z.string().min(40).max(100) }).strict();

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
  }
  const rate = consumeRateLimit(requestFingerprint(request, 'business-access'), 20, 15 * 60_000);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Too many access attempts. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSeconds) } },
    );
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }
  const rawBody = await request.text().catch(() => '');
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large or invalid.' }, { status: 413 });
  }
  let unknownBody: unknown;
  try {
    unknownBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  const parsed = consumeSchema.safeParse(unknownBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'This private access link is invalid or expired.' }, { status: 400 });
  }
  try {
    const session = await consumeAdvertiserPortalInvite(parsed.data.token);
    const response = NextResponse.json({
      success: true,
      destination: `/business-login/${session.reservationId}`,
    });
    response.cookies.set(reservationCookieName(session.reservationId), session.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: session.expiresAt,
      priority: 'high',
    });
    setPrivateHeaders(response);
    return response;
  } catch (error) {
    const knownAccessFailure = error instanceof AdvertiserPortalError;
    const response = NextResponse.json(
      {
        error: knownAccessFailure
          ? 'This private access link is invalid, expired, already used, or revoked.'
          : 'Private access could not be verified right now. The one-time link was not accepted; try again later.',
      },
      { status: knownAccessFailure ? error.status : 503 },
    );
    setPrivateHeaders(response);
    return response;
  }
}

function setPrivateHeaders(response: NextResponse) {
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  response.headers.set('X-Robots-Tag', 'noindex, nofollow');
}
