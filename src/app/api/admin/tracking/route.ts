import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import {
  FieldValue,
  Timestamp,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore';
import { z } from 'zod';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import {
  normalizeCouponCode,
  safeTrackingDestination,
  selfReportedMetricTypes,
  summarizeRedirectRequests,
  summarizeSelfReportedMetrics,
} from '@/lib/trackingRules';

const createSchema = z.object({
  reservationId: z.string().min(10).max(40),
  destinationUrl: z.string().trim().max(500),
  couponCode: z.string().trim().max(40).optional().default(''),
  phoneExtension: z.string().regex(/^\d{0,10}$/).optional().default(''),
}).strict();

const updateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['activate', 'deactivate']),
    trackingId: z.string().min(10).max(40),
  }).strict(),
  z.object({
    action: z.literal('record_report'),
    trackingId: z.string().min(10).max(40),
    metricType: z.enum(selfReportedMetricTypes),
    quantity: z.number().int().min(1).max(10_000),
    amountCents: z.number().int().min(0).max(100_000_000).nullable(),
    note: z.string().trim().min(3).max(1000),
  }).strict(),
  z.object({
    action: z.literal('record_delivery'),
    trackingId: z.string().min(10).max(40),
    deliveredAt: z.string().datetime({ offset: true }),
    evidenceReference: z.string().trim().min(3).max(500),
    ownerNote: z.string().trim().max(1000),
  }).strict(),
]);

class TrackingRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

function failure(error: unknown) {
  if (error instanceof RequestAuthError || error instanceof TrackingRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Tracking operation failed.' }, { status: 500 });
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

function couponClaimReference(db: Firestore, couponCode: string) {
  const id = createHash('sha256').update(couponCode).digest('hex');
  return db.collection('trackingcouponclaims').doc(id);
}

async function readCurrentPaidTracking(
  transaction: Transaction,
  db: Firestore,
  trackingId: string,
) {
  const linkRef = db.collection('trackinglinks').doc(trackingId);
  const linkSnapshot = await transaction.get(linkRef);
  if (!linkSnapshot.exists) throw new TrackingRequestError('Tracking record not found.', 404);
  const link = linkSnapshot.data()!;
  const reservationRef = db.collection('reservations').doc(String(link.reservationId || ''));
  const reservationSnapshot = await transaction.get(reservationRef);
  const reservation = reservationSnapshot.data();
  if (
    !reservationSnapshot.exists
    || reservation?.status !== 'paid'
    || reservation?.campaignId !== link.campaignId
    || reservation?.trackingId !== linkRef.id
  ) {
    throw new TrackingRequestError(
      'The linked reservation is no longer the current paid reservation for this tracking record.',
      409,
    );
  }
  return { linkRef, link, reservationRef, reservation };
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const [links, events, reports, deliveries, reservations] = await Promise.all([
      db.collection('trackinglinks').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('trackingevents').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('trackingreports').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('deliveryreports').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    ]);
    const eventData = events.docs.map((doc) => doc.data());
    const reportData = reports.docs.map((doc) => doc.data());
    const deliveryByTrackingId = new Map(
      deliveries.docs.map((doc) => [String(doc.data().trackingId), doc.data()]),
    );
    const reservationById = new Map(
      reservations.docs.map((doc) => [doc.id, doc.data()]),
    );

    return NextResponse.json({
      paidReservations: reservations.docs
        .filter((doc) => doc.data().status === 'paid')
        .map((doc) => ({
          id: doc.id,
          businessName: doc.data().businessName,
          website: doc.data().website || '',
        })),
      links: links.docs.map((doc) => {
        const data = doc.data();
        const matchingEvents = eventData.filter((event) => event.trackingId === doc.id);
        const matchingReports = reportData.filter((report) => report.trackingId === doc.id);
        const delivery = deliveryByTrackingId.get(doc.id);
        const reservation = reservationById.get(String(data.reservationId));
        return {
          id: doc.id,
          reservationId: data.reservationId,
          businessName: data.businessName,
          active: Boolean(data.active),
          destinationUrl: data.destinationUrl,
          couponCode: data.couponCode,
          phoneExtension: data.phoneExtension || '',
          currentPaid: reservation?.status === 'paid' && reservation?.trackingId === doc.id,
          measured: summarizeRedirectRequests(matchingEvents),
          selfReported: summarizeSelfReportedMetrics(matchingReports),
          delivery: delivery ? {
            deliveredAt: timestampToIso(delivery.deliveredAt),
            evidenceReference: String(delivery.evidenceReference || ''),
            ownerNote: String(delivery.ownerNote || ''),
            recordedAt: timestampToIso(delivery.createdAt),
          } : null,
        };
      }),
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Review the tracking fields.' }, { status: 400 });
    }
    const destinationUrl = safeTrackingDestination(parsed.data.destinationUrl);
    if (!destinationUrl) {
      return NextResponse.json(
        { error: 'Use a public HTTPS destination without credentials.' },
        { status: 400 },
      );
    }

    const requestedCoupon = normalizeCouponCode(parsed.data.couponCode);
    if (parsed.data.couponCode && requestedCoupon.length < 3) {
      throw new TrackingRequestError('Use at least three letters, numbers, or hyphens for a custom coupon code.', 400);
    }
    const couponCode = requestedCoupon || `CM-${randomBytes(4).toString('hex').toUpperCase()}`;
    const db = getAdminFirestore();
    const reservationRef = db.collection('reservations').doc(parsed.data.reservationId);
    const [existingTracking, existingCoupon] = await Promise.all([
      db.collection('trackinglinks').where('reservationId', '==', reservationRef.id).limit(1).get(),
      db.collection('trackinglinks').where('couponCode', '==', couponCode).limit(1).get(),
    ]);
    if (!existingTracking.empty) {
      throw new TrackingRequestError('This reservation already has a tracking record.', 409);
    }
    if (!existingCoupon.empty) {
      throw new TrackingRequestError('That coupon code is already assigned. Choose a unique code.', 409);
    }

    const trackingId = randomBytes(18).toString('base64url');
    const trackingRef = db.collection('trackinglinks').doc(trackingId);
    const couponClaimRef = couponClaimReference(db, couponCode);
    const auditRef = db.collection('auditlog').doc();
    await db.runTransaction(async (transaction) => {
      const [reservationSnapshot, couponClaimSnapshot] = await Promise.all([
        transaction.get(reservationRef),
        transaction.get(couponClaimRef),
      ]);
      const reservation = reservationSnapshot.data();
      if (
        !reservationSnapshot.exists
        || reservation?.status !== 'paid'
        || reservation?.campaignId !== FOUNDING_CAMPAIGN.id
      ) {
        throw new TrackingRequestError('Tracking can be created only for a current paid reservation.', 409);
      }
      if (reservation.trackingId) {
        throw new TrackingRequestError('This reservation already has a tracking record.', 409);
      }
      if (couponClaimSnapshot.exists) {
        throw new TrackingRequestError('That coupon code is already assigned. Choose a unique code.', 409);
      }

      transaction.create(trackingRef, {
        campaignId: reservation.campaignId,
        reservationId: reservationRef.id,
        businessName: reservation.businessName,
        destinationUrl,
        couponCode,
        phoneExtension: parsed.data.phoneExtension || null,
        active: false,
        paymentLifecycleSuspended: false,
        activeBeforePaymentInterruption: false,
        createdBy: owner.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(couponClaimRef, {
        couponCode,
        campaignId: reservation.campaignId,
        reservationId: reservationRef.id,
        trackingId,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        trackingId,
        couponCode,
        trackingStatus: 'draft',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: 'tracking.create',
        entityId: trackingId,
        summary: 'Created an inactive unique tracking URL and coupon code for a current paid reservation.',
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({
      success: true,
      trackingId,
      path: `/go/${trackingId}`,
      couponCode,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid tracking update.' }, { status: 400 });
    }
    const db = getAdminFirestore();

    if (parsed.data.action === 'record_report') {
      const reportInput = parsed.data;
      const reportRef = db.collection('trackingreports').doc();
      const auditRef = db.collection('auditlog').doc();
      await db.runTransaction(async (transaction) => {
        const current = await readCurrentPaidTracking(transaction, db, reportInput.trackingId);
        transaction.create(reportRef, {
          campaignId: current.link.campaignId,
          trackingId: current.linkRef.id,
          reservationId: current.reservationRef.id,
          metricType: reportInput.metricType,
          quantity: reportInput.quantity,
          amountCents: reportInput.amountCents,
          note: reportInput.note,
          source: 'owner_recorded_advertiser_report',
          recordedBy: owner.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'tracking.report',
          entityId: reportRef.id,
          summary: `Recorded advertiser-reported ${reportInput.metricType}; not a directly measured result.`,
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === 'record_delivery') {
      const deliveryInput = parsed.data;
      const deliveredAt = new Date(deliveryInput.deliveredAt);
      if (deliveredAt.getTime() > Date.now() + 5 * 60_000) {
        throw new TrackingRequestError('Delivery time cannot be in the future.', 400);
      }
      const deliveryRef = db.collection('deliveryreports').doc(deliveryInput.trackingId);
      const auditRef = db.collection('auditlog').doc();
      await db.runTransaction(async (transaction) => {
        const current = await readCurrentPaidTracking(transaction, db, deliveryInput.trackingId);
        const existingDelivery = await transaction.get(deliveryRef);
        if (existingDelivery.exists) {
          throw new TrackingRequestError('Delivery evidence is already recorded for this advertiser.', 409);
        }
        transaction.create(deliveryRef, {
          campaignId: current.link.campaignId,
          trackingId: current.linkRef.id,
          reservationId: current.reservationRef.id,
          businessName: current.reservation.businessName,
          status: 'owner_recorded_delivery_evidence',
          deliveredAt: Timestamp.fromDate(deliveredAt),
          evidenceReference: deliveryInput.evidenceReference,
          ownerNote: deliveryInput.ownerNote || null,
          recordedBy: owner.uid,
          createdAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'delivery.record',
          entityId: deliveryRef.id,
          summary: 'Recorded advertiser-visible delivery evidence; no response or outcome inferred.',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true });
    }

    if (parsed.data.action === 'activate') {
      const preliminary = await db.collection('trackinglinks').doc(parsed.data.trackingId).get();
      if (!preliminary.exists) throw new TrackingRequestError('Tracking record not found.', 404);
      const couponCode = normalizeCouponCode(String(preliminary.data()?.couponCode || ''));
      if (couponCode.length < 3) {
        throw new TrackingRequestError('Tracking cannot activate without a valid unique coupon code.', 409);
      }
      const duplicateCoupons = await db.collection('trackinglinks')
        .where('couponCode', '==', couponCode)
        .get();
      if (duplicateCoupons.docs.some((doc) => doc.id !== parsed.data.trackingId)) {
        throw new TrackingRequestError('Tracking cannot activate because its coupon code is not unique.', 409);
      }
      const couponClaimRef = couponClaimReference(db, couponCode);
      const auditRef = db.collection('auditlog').doc();
      await db.runTransaction(async (transaction) => {
        const current = await readCurrentPaidTracking(transaction, db, parsed.data.trackingId);
        if (!safeTrackingDestination(String(current.link.destinationUrl || ''))) {
          throw new TrackingRequestError('Tracking destination is no longer a valid public HTTPS URL.', 409);
        }
        if (normalizeCouponCode(String(current.link.couponCode || '')) !== couponCode) {
          throw new TrackingRequestError('Tracking coupon changed during activation. Review it again.', 409);
        }
        const couponClaim = await transaction.get(couponClaimRef);
        if (couponClaim.exists && couponClaim.data()?.trackingId !== current.linkRef.id) {
          throw new TrackingRequestError('Tracking cannot activate because its coupon code is not unique.', 409);
        }
        if (!couponClaim.exists) {
          transaction.create(couponClaimRef, {
            couponCode,
            campaignId: current.link.campaignId,
            reservationId: current.reservationRef.id,
            trackingId: current.linkRef.id,
            createdAt: FieldValue.serverTimestamp(),
          });
        }
        transaction.update(current.linkRef, {
          active: true,
          paymentLifecycleSuspended: false,
          activeBeforePaymentInterruption: false,
          deactivatedReason: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(current.reservationRef, {
          trackingStatus: 'active',
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'tracking.activate',
          entityId: current.linkRef.id,
          summary: 'Activated public redirect for a current paid reservation; no response inferred.',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true, active: true });
    }

    const linkRef = db.collection('trackinglinks').doc(parsed.data.trackingId);
    const auditRef = db.collection('auditlog').doc();
    await db.runTransaction(async (transaction) => {
      const linkSnapshot = await transaction.get(linkRef);
      if (!linkSnapshot.exists) throw new TrackingRequestError('Tracking record not found.', 404);
      const link = linkSnapshot.data()!;
      const reservationRef = db.collection('reservations').doc(String(link.reservationId || ''));
      const reservationSnapshot = await transaction.get(reservationRef);
      transaction.update(linkRef, {
        active: false,
        paymentLifecycleSuspended: false,
        activeBeforePaymentInterruption: false,
        deactivatedReason: 'owner_deactivated',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (reservationSnapshot.exists && reservationSnapshot.data()?.trackingId === linkRef.id) {
        transaction.update(reservationRef, {
          trackingStatus: 'inactive',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: 'tracking.deactivate',
        entityId: linkRef.id,
        summary: 'Deactivated public redirect; no result inferred.',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true, active: false });
  } catch (error) {
    return failure(error);
  }
}
