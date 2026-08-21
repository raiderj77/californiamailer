import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { ownerTokenAllowed } from '@/lib/serverAuth';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';

export const runtime = 'nodejs';
const maxAgeSeconds = 8 * 60 * 60;
const schema = z.object({ idToken: z.string().min(100).max(10_000) }).strict();

export async function POST(request: NextRequest) {
  const rate = consumeRateLimit(requestFingerprint(request, 'owner-session'), 10, 15 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Too many sign-in attempts.' }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid sign-in request.' }, { status: 400 });
  try {
    const auth = getAdminAuth();
    const token = await auth.verifyIdToken(parsed.data.idToken, true);
    if (!ownerTokenAllowed(token)) return NextResponse.json({ error: 'Owner authorization required.' }, { status: 403 });
    const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, { expiresIn: maxAgeSeconds * 1000 });
    const response = NextResponse.json({ success: true });
    response.cookies.set('cm_owner_session', sessionCookie, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: maxAgeSeconds,
    });
    return response;
  } catch (error) {
    const unavailable = error instanceof Error && error.message.includes('not configured');
    return NextResponse.json({ error: unavailable ? 'Owner authentication is not configured.' : 'Owner sign-in failed.' }, { status: unavailable ? 503 : 401 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set('cm_owner_session', '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', path: '/', maxAge: 0 });
  return response;
}
