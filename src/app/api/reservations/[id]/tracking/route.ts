import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { reservationCookieName, verifyReservationAccess } from '@/lib/reservationAuth';
import {
  selfReportedMetricTypes,
  summarizeRedirectRequests,
  summarizeSelfReportedMetrics,
} from '@/lib/trackingRules';

function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = { 'Cache-Control': 'private, no-store' };
  try {
    const access = await verifyReservationAccess(
      id,
      request.cookies.get(reservationCookieName(id))?.value,
    );
    if (!access) {
      return NextResponse.json(
        { error: 'Private reservation access required.' },
        { status: 401, headers },
      );
    }

    const trackingId = String(access.data.trackingId || '');
    if (!/^[A-Za-z0-9_-]{20,40}$/.test(trackingId)) {
      return NextResponse.json({ tracking: null }, { headers });
    }

    const db = getAdminFirestore();
    const trackingSnapshot = await db.collection('trackinglinks').doc(trackingId).get();
    const tracking = trackingSnapshot.data();
    if (!trackingSnapshot.exists || tracking?.reservationId !== id) {
      return NextResponse.json({ tracking: null }, { headers });
    }

    const [eventSnapshot, reportSnapshot, deliverySnapshot] = await Promise.all([
      db.collection('trackingevents').where('trackingId', '==', trackingId).get(),
      db.collection('trackingreports').where('trackingId', '==', trackingId).get(),
      db.collection('deliveryreports').doc(trackingId).get(),
    ]);
    const events = eventSnapshot.docs.map((doc) => doc.data());
    const reports = reportSnapshot.docs.map((doc) => doc.data());
    const delivery = deliverySnapshot.data();
    const active = tracking.active === true;

    return NextResponse.json({
      tracking: {
        active,
        publicPath: active ? `/go/${trackingId}` : null,
        couponCode: active ? String(tracking.couponCode || '') : null,
        phoneExtension: active && tracking.phoneExtension
          ? String(tracking.phoneExtension)
          : null,
        directlyMeasured: {
          ...summarizeRedirectRequests(events),
          label: 'HTTP redirect requests recorded by CaliforniaMailer',
          limitation: 'A redirect request is not proof of a QR scan, person, lead, customer, or sale.',
        },
        advertiserReported: {
          totals: summarizeSelfReportedMetrics(reports),
          entries: reportSnapshot.docs
            .filter((doc) => selfReportedMetricTypes.includes(doc.data().metricType))
            .map((doc) => {
              const report = doc.data();
              return {
                id: doc.id,
                metricType: report.metricType,
                quantity: Number(report.quantity || 0),
                amountCents: report.amountCents === null || report.amountCents === undefined
                  ? null
                  : Number(report.amountCents),
                note: String(report.note || ''),
                recordedAt: timestampToIso(report.createdAt),
                source: 'Owner-recorded advertiser report; not directly measured by CaliforniaMailer',
              };
            }),
        },
        delivery: deliverySnapshot.exists && delivery ? {
          status: 'Owner-recorded delivery evidence',
          deliveredAt: timestampToIso(delivery.deliveredAt),
          evidenceReference: String(delivery.evidenceReference || ''),
          ownerNote: String(delivery.ownerNote || ''),
          recordedAt: timestampToIso(delivery.createdAt),
          limitation: 'Delivery evidence documents the mailing event; it does not prove an advertiser response or outcome.',
        } : null,
      },
    }, { headers });
  } catch {
    return NextResponse.json(
      { error: 'Private tracking report is unavailable.' },
      { status: 503, headers },
    );
  }
}
