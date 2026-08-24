import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  COUPON_PUBLICATION_STATUSES,
  COUPON_REVIEW_STATUSES,
  EMPTY_COUPON_CONTEXT,
  EMPTY_COUPON_DRAFT,
  couponDraftErrors,
  couponDraftIsComplete,
  couponPublishConfirmation,
  couponUnpublishConfirmation,
  normalizeCouponContext,
  normalizeCouponDraft,
  publicCouponUnavailableReason,
  type CouponDraftContent,
  type CouponFactContext,
  type CouponPublicationStatus,
  type CouponReviewStatus,
} from '@/lib/couponRules';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import { normalizeCouponCode, safeTrackingDestination } from '@/lib/trackingRules';

const updateSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('publish'),
    couponId: z.string().regex(/^[A-Za-z0-9_-]{20,40}$/),
    draftVersion: z.number().int().min(1),
    confirmation: z.string().max(100),
  }).strict(),
  z.object({
    action: z.literal('request_changes'),
    couponId: z.string().regex(/^[A-Za-z0-9_-]{20,40}$/),
    draftVersion: z.number().int().min(1),
    ownerNote: z.string().trim().min(3).max(1_000),
  }).strict(),
  z.object({
    action: z.literal('unpublish'),
    couponId: z.string().regex(/^[A-Za-z0-9_-]{20,40}$/),
    confirmation: z.string().max(100),
  }).strict(),
]);

class AdminCouponError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

function failure(error: unknown) {
  if (error instanceof RequestAuthError || error instanceof AdminCouponError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Coupon review operation failed.' }, { status: 500 });
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

function reviewStatus(value: unknown): CouponReviewStatus {
  return COUPON_REVIEW_STATUSES.includes(value as CouponReviewStatus)
    ? value as CouponReviewStatus
    : 'draft';
}

function publicationStatus(value: unknown): CouponPublicationStatus {
  return COUPON_PUBLICATION_STATUSES.includes(value as CouponPublicationStatus)
    ? value as CouponPublicationStatus
    : 'unpublished';
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const couponSnapshot = await db.collection('coupons').limit(100).get();
    const records = await Promise.all(couponSnapshot.docs.map(async (document) => {
      const data = document.data();
      const reservationId = String(data.reservationId || '');
      const trackingId = String(data.trackingId || '');
      const [reservationSnapshot, trackingSnapshot] = await Promise.all([
        db.collection('reservations').doc(reservationId).get(),
        db.collection('trackinglinks').doc(trackingId).get(),
      ]);
      const reservation = reservationSnapshot.data();
      const tracking = trackingSnapshot.data();
      const code = normalizeCouponCode(String(data.couponCode || tracking?.couponCode || ''));
      const couponClaimSnapshot = code
        ? await db.collection('trackingcouponclaims')
          .doc(createHash('sha256').update(code).digest('hex'))
          .get()
        : null;
      const couponClaim = couponClaimSnapshot?.data();
      const draft = normalizeCouponDraft(
        (data.draft || EMPTY_COUPON_DRAFT) as Partial<CouponDraftContent>,
      );
      const publishedContent = data.publishedContent
        ? normalizeCouponDraft(data.publishedContent as Partial<CouponDraftContent>)
        : null;
      const trackingOwnsReservation = Boolean(
        reservationSnapshot.exists
        && trackingSnapshot.exists
        && tracking?.reservationId === reservationSnapshot.id
        && reservation?.trackingId === trackingSnapshot.id
        && tracking?.campaignId === reservation?.campaignId
        && couponClaimSnapshot?.exists === true
        && couponClaim?.couponCode === code
        && couponClaim?.reservationId === reservationSnapshot.id
        && couponClaim?.trackingId === trackingSnapshot.id
        && couponClaim?.campaignId === reservation?.campaignId,
      );
      const unavailableReason = publicCouponUnavailableReason({
        publicationStatus: data.publicationStatus,
        hasPublishedContent: publishedContent !== null && couponDraftIsComplete(publishedContent),
        trackingActive: tracking?.active === true,
        reservationPaid: reservation?.status === 'paid',
        trackingOwnsReservation,
        couponCodeMatches: normalizeCouponCode(String(tracking?.couponCode || '')) === code,
      });
      return {
        id: document.id,
        reservationId,
        trackingId,
        businessName: String(data.businessName || tracking?.businessName || reservation?.businessName || ''),
        couponCode: code,
        reviewStatus: reviewStatus(data.reviewStatus),
        publicationStatus: publicationStatus(data.publicationStatus),
        draftVersion: Math.max(0, Number(data.draftVersion || 0)),
        approvedDraftVersion: data.approvedDraftVersion === undefined
          ? null
          : Math.max(0, Number(data.approvedDraftVersion || 0)),
        draft,
        publishedContent,
        context: normalizeCouponContext(
          (data.context || EMPTY_COUPON_CONTEXT) as Partial<CouponFactContext>,
        ),
        ownerNote: typeof data.ownerNote === 'string' ? data.ownerNote.slice(0, 1_000) : '',
        submittedAt: timestampToIso(data.submittedAt),
        publishedAt: timestampToIso(data.publishedAt),
        updatedAt: timestampToIso(data.updatedAt),
        currentPaid: reservation?.status === 'paid',
        trackingActive: tracking?.active === true,
        publicAvailable: unavailableReason === null,
        unavailableReason,
        publicPath: unavailableReason === null ? `/coupon/${encodeURIComponent(code)}` : null,
        expectedPublishConfirmation: couponPublishConfirmation(code),
        expectedUnpublishConfirmation: couponUnpublishConfirmation(code),
      };
    }));
    records.sort((left, right) => (right.updatedAt || '').localeCompare(left.updatedAt || ''));
    return NextResponse.json(
      { coupons: records },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new AdminCouponError('Review the coupon decision fields.', 400);
    const input = parsed.data;
    const db = getAdminFirestore();
    const couponRef = db.collection('coupons').doc(input.couponId);
    const auditRef = db.collection('auditlog').doc();

    await db.runTransaction(async (transaction) => {
      const couponSnapshot = await transaction.get(couponRef);
      if (!couponSnapshot.exists) throw new AdminCouponError('Coupon draft not found.', 404);
      const coupon = couponSnapshot.data()!;
      const reservationRef = db.collection('reservations').doc(String(coupon.reservationId || ''));
      const trackingRef = db.collection('trackinglinks').doc(String(coupon.trackingId || ''));
      const couponCode = normalizeCouponCode(String(coupon.couponCode || ''));
      const couponClaimRef = db.collection('trackingcouponclaims')
        .doc(createHash('sha256').update(couponCode).digest('hex'));
      const [reservationSnapshot, trackingSnapshot, couponClaimSnapshot] = await Promise.all([
        transaction.get(reservationRef),
        transaction.get(trackingRef),
        transaction.get(couponClaimRef),
      ]);
      const reservation = reservationSnapshot.data();
      const tracking = trackingSnapshot.data();
      const couponClaim = couponClaimSnapshot.data();

      if (input.action === 'unpublish') {
        if (input.confirmation !== couponUnpublishConfirmation(couponCode)) {
          throw new AdminCouponError('Type the exact unpublish confirmation shown.', 400);
        }
        transaction.update(couponRef, {
          publicationStatus: 'unpublished',
          unpublishedAt: FieldValue.serverTimestamp(),
          unpublishedBy: owner.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'coupon.unpublish',
          entityId: couponRef.id,
          summary: 'Owner explicitly unpublished the public coupon page.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      const currentVersion = Math.max(0, Number(coupon.draftVersion || 0));
      if (currentVersion !== input.draftVersion) {
        throw new AdminCouponError(
          'This draft changed after it was loaded. Reload and review the exact current version.',
          409,
        );
      }

      if (input.action === 'request_changes') {
        transaction.update(couponRef, {
          reviewStatus: 'changes_requested',
          ownerNote: input.ownerNote,
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedBy: owner.uid,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'coupon.request_changes',
          entityId: couponRef.id,
          summary: `Owner requested changes to coupon draft version ${currentVersion}; no publication occurred.`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return;
      }

      if (input.confirmation !== couponPublishConfirmation(couponCode)) {
        throw new AdminCouponError('Type the exact publish confirmation shown.', 400);
      }
      if (coupon.reviewStatus !== 'submitted_for_owner_review') {
        throw new AdminCouponError(
          'Only a draft explicitly submitted for owner review can be published.',
          409,
        );
      }
      if (
        !reservationSnapshot.exists
        || reservation?.status !== 'paid'
        || reservation?.trackingId !== trackingRef.id
        || !trackingSnapshot.exists
        || tracking?.active !== true
        || tracking?.reservationId !== reservationRef.id
        || tracking?.campaignId !== reservation?.campaignId
        || coupon.trackingId !== trackingRef.id
        || coupon.reservationId !== reservationRef.id
        || normalizeCouponCode(String(tracking?.couponCode || '')) !== couponCode
        || !couponClaimSnapshot.exists
        || couponClaim?.couponCode !== couponCode
        || couponClaim?.reservationId !== reservationRef.id
        || couponClaim?.trackingId !== trackingRef.id
        || couponClaim?.campaignId !== reservation?.campaignId
        || !safeTrackingDestination(String(tracking?.destinationUrl || ''))
      ) {
        throw new AdminCouponError(
          'Publishing requires the same current paid reservation and active unique tracking record.',
          409,
        );
      }
      const draft = normalizeCouponDraft(
        (coupon.draft || EMPTY_COUPON_DRAFT) as Partial<CouponDraftContent>,
      );
      const errors = couponDraftErrors(draft, true);
      if (errors.length) throw new AdminCouponError(errors[0], 409);

      transaction.update(couponRef, {
        reviewStatus: 'approved',
        publicationStatus: 'published',
        publishedContent: draft,
        approvedDraftVersion: currentVersion,
        ownerNote: '',
        reviewedAt: FieldValue.serverTimestamp(),
        reviewedBy: owner.uid,
        publishedAt: FieldValue.serverTimestamp(),
        publishedBy: owner.uid,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: 'coupon.publish',
        entityId: couponRef.id,
        summary: `Owner exact-confirmed and published coupon draft version ${currentVersion}.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return failure(error);
  }
}
