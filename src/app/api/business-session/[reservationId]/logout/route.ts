import { NextRequest, NextResponse } from 'next/server';
import { revokeAdvertiserPortalSession, validReservationId } from '@/lib/advertiserPortal';
import { reservationCookieName } from '@/lib/reservationAuth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const { reservationId } = await params;
  if (!validReservationId(reservationId)) {
    return NextResponse.json({ error: 'Private reservation access is invalid.' }, { status: 400 });
  }
  const cookieName = reservationCookieName(reservationId);
  const token = request.cookies.get(cookieName)?.value;
  let revocationConfirmed = true;
  let sessionRevoked = false;
  try {
    sessionRevoked = await revokeAdvertiserPortalSession(reservationId, token);
  } catch {
    revocationConfirmed = false;
  }
  const response = NextResponse.json(revocationConfirmed
    ? { success: true, sessionRevoked }
    : {
      success: false,
      cookieCleared: true,
      error: 'The browser cookie was cleared, but database session revocation could not be confirmed.',
    }, {
    status: revocationConfirmed ? 200 : 503,
    headers: { 'Cache-Control': 'private, no-store' },
  });
  response.cookies.set(cookieName, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    priority: 'high',
  });
  return response;
}
