import { createHmac } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { consumeRateLimit, rateLimitClientIdentity, requestFingerprint } from '@/lib/rateLimit';
import { safeTrackingDestination } from '@/lib/trackingRules';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params; if (!/^[A-Za-z0-9_-]{20,40}$/.test(code)) return NextResponse.json({ error: 'Offer link not found.' }, { status: 404 });
  try {
    const db = getAdminFirestore();
    const current = await db.runTransaction(async (transaction) => {
      const linkRef = db.collection('trackinglinks').doc(code);
      const linkSnapshot = await transaction.get(linkRef);
      const link = linkSnapshot.data();
      if (!linkSnapshot.exists || !link || link.active !== true) return null;
      const reservationId = typeof link.reservationId === 'string' ? link.reservationId : '';
      if (!/^[A-Za-z0-9]{10,40}$/.test(reservationId)) return null;
      const reservationSnapshot = await transaction.get(db.collection('reservations').doc(reservationId));
      const reservation = reservationSnapshot.data();
      if (
        !reservationSnapshot.exists
        || reservation?.status !== 'paid'
        || reservation.campaignId !== link.campaignId
        || reservation.trackingId !== linkRef.id
      ) return null;
      const destination = safeTrackingDestination(String(link.destinationUrl || ''));
      return destination ? { destination, link, trackingId: linkRef.id, reservationId } : null;
    });
    if (!current) return NextResponse.json({ error: 'This offer link is not active.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const userAgent = request.headers.get('user-agent')?.slice(0, 300) || ''; const suspectedBot = /bot|crawler|spider|preview|facebookexternalhit|slackbot/i.test(userAgent) || request.headers.get('purpose') === 'prefetch'; const limit = consumeRateLimit(requestFingerprint(request, `tracking:${code}`), 30, 60 * 60_000);
    if (limit.allowed) {
      const clientIdentity = rateLimitClientIdentity(request.headers); const secret = process.env.TRACKING_HASH_SECRET; const networkHash = secret ? createHmac('sha256', secret).update(`tracking-v1:${code}:${clientIdentity}`).digest('hex') : null;
      await db.collection('trackingevents').add({ campaignId: current.link.campaignId, trackingId: current.trackingId, reservationId: current.reservationId, eventType: 'redirect_visit', source: 'directly_measured_http_request', suspectedBot, networkHash, userAgent, createdAt: FieldValue.serverTimestamp() });
    }
    return NextResponse.redirect(current.destination, { status: 302, headers: { 'Cache-Control': 'private, no-store' } });
  } catch { return NextResponse.json({ error: 'Offer link unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
}
