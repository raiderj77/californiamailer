import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { CouponAiError, couponAiAvailability, generateCouponFieldDraft } from '@/lib/couponAi';
import {
  COUPON_AI_FIELDS,
  COUPON_CONTEXT_LIMITS,
  COUPON_PUBLICATION_STATUSES,
  COUPON_REVIEW_STATUSES,
  COUPON_TEXT_LIMITS,
  EMPTY_COUPON_CONTEXT,
  EMPTY_COUPON_DRAFT,
  couponAiDailyQuota,
  couponAiQuotaDocumentId,
  couponDraftErrors,
  couponUtcDayKey,
  normalizeCouponContext,
  normalizeCouponDraft,
  type CouponDraftContent,
  type CouponFactContext,
  type CouponPublicationStatus,
  type CouponReviewStatus,
} from '@/lib/couponRules';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  ReservationAccessError,
  assertReservationAccessInTransaction,
  reservationCookieName,
  verifyReservationAccess,
} from '@/lib/reservationAuth';
import { normalizeCouponCode } from '@/lib/trackingRules';

const MAX_REQUEST_BYTES = 16_000;

const draftSchema = z.object({
  headline: z.string().max(COUPON_TEXT_LIMITS.headline),
  body: z.string().max(COUPON_TEXT_LIMITS.body),
  offer: z.string().max(COUPON_TEXT_LIMITS.offer),
  callToAction: z.string().max(COUPON_TEXT_LIMITS.callToAction),
  backHeadline: z.string().max(COUPON_TEXT_LIMITS.backHeadline),
  servicesList: z.string().max(COUPON_TEXT_LIMITS.servicesList),
  backCoupon: z.string().max(COUPON_TEXT_LIMITS.backCoupon),
  expiresOn: z.string().max(10),
  terms: z.string().max(COUPON_TEXT_LIMITS.terms),
}).strict();

const contextSchema = z.object({
  industry: z.string().max(COUPON_CONTEXT_LIMITS.industry),
  serviceFacts: z.string().max(COUPON_CONTEXT_LIMITS.serviceFacts),
  factualOffer: z.string().max(COUPON_CONTEXT_LIMITS.factualOffer),
  redemptionInstructions: z.string().max(COUPON_CONTEXT_LIMITS.redemptionInstructions),
  audience: z.string().max(COUPON_CONTEXT_LIMITS.audience),
  tone: z.string().max(COUPON_CONTEXT_LIMITS.tone),
  verifiedFacts: z.string().max(COUPON_CONTEXT_LIMITS.verifiedFacts),
}).strict();

const mutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.enum(['save_draft', 'submit_for_owner_review']),
    draft: draftSchema,
    context: contextSchema,
  }).strict(),
  z.object({
    action: z.literal('generate'),
    field: z.enum(COUPON_AI_FIELDS),
    currentDraft: draftSchema,
    context: contextSchema,
  }).strict(),
]);

class CouponRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 409 | 422 | 429 | 503,
  ) {
    super(message);
  }
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

function responseHeaders() {
  return { 'Cache-Control': 'private, no-store' };
}

function quotaUsed(value: unknown) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

function failure(error: unknown) {
  if (error instanceof ReservationAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  if (error instanceof CouponRequestError || error instanceof CouponAiError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  return NextResponse.json(
    { error: 'The private coupon workspace is unavailable.' },
    { status: 503, headers: responseHeaders() },
  );
}

async function readPaidTracking(request: NextRequest, reservationId: string) {
  const accessToken = request.cookies.get(reservationCookieName(reservationId))?.value;
  const access = await verifyReservationAccess(
    reservationId,
    accessToken,
  );
  if (!access) throw new CouponRequestError('Private reservation access required.', 401);
  if (access.data.status !== 'paid') {
    throw new CouponRequestError(
      'Coupon drafting opens only after provider-verified cleared payment.',
      409,
    );
  }

  const trackingId = String(access.data.trackingId || '');
  if (!/^[A-Za-z0-9_-]{20,40}$/.test(trackingId)) {
    throw new CouponRequestError(
      'The owner must create this reservation’s unique tracking and coupon record first.',
      409,
    );
  }
  const trackingRef = getAdminFirestore().collection('trackinglinks').doc(trackingId);
  const trackingSnapshot = await trackingRef.get();
  const tracking = trackingSnapshot.data();
  if (
    !trackingSnapshot.exists
    || tracking?.reservationId !== reservationId
    || tracking?.campaignId !== access.data.campaignId
    || access.data.trackingId !== trackingRef.id
  ) {
    throw new CouponRequestError(
      'The unique tracking record does not belong to this paid reservation.',
      409,
    );
  }
  const couponCode = normalizeCouponCode(String(tracking.couponCode || ''));
  if (couponCode.length < 3) {
    throw new CouponRequestError('The unique coupon code is not ready for drafting.', 409);
  }
  const couponClaimRef = getAdminFirestore().collection('trackingcouponclaims')
    .doc(createHash('sha256').update(couponCode).digest('hex'));
  const couponClaimSnapshot = await couponClaimRef.get();
  const couponClaim = couponClaimSnapshot.data();
  if (
    !couponClaimSnapshot.exists
    || couponClaim?.couponCode !== couponCode
    || couponClaim?.reservationId !== access.ref.id
    || couponClaim?.trackingId !== trackingRef.id
    || couponClaim?.campaignId !== access.data.campaignId
  ) {
    throw new CouponRequestError(
      'The unique coupon claim does not belong to this paid reservation and tracking record.',
      409,
    );
  }
  return {
    access,
    trackingRef,
    tracking,
    couponClaimRef,
    couponCode,
    accessToken: accessToken!,
  };
}

function serializeCoupon(
  data: FirebaseFirestore.DocumentData | undefined,
  fallback: { reservationId: string; trackingId: string; couponCode: string; businessName: string },
) {
  return {
    reservationId: fallback.reservationId,
    trackingId: fallback.trackingId,
    couponCode: fallback.couponCode,
    businessName: fallback.businessName,
    reviewStatus: reviewStatus(data?.reviewStatus),
    publicationStatus: publicationStatus(data?.publicationStatus),
    draftVersion: Number.isInteger(data?.draftVersion) ? Number(data?.draftVersion) : 0,
    draft: normalizeCouponDraft((data?.draft || EMPTY_COUPON_DRAFT) as Partial<CouponDraftContent>),
    context: normalizeCouponContext((data?.context || EMPTY_COUPON_CONTEXT) as Partial<CouponFactContext>),
    ownerNote: typeof data?.ownerNote === 'string' ? data.ownerNote.slice(0, 1_000) : '',
    submittedAt: timestampToIso(data?.submittedAt),
    publishedAt: timestampToIso(data?.publishedAt),
    publishedPath: data?.publicationStatus === 'published'
      ? `/coupon/${encodeURIComponent(fallback.couponCode)}`
      : null,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const current = await readPaidTracking(request, id);
    const db = getAdminFirestore();
    const quotaLimit = couponAiDailyQuota();
    const quotaRef = db.collection('couponaiusage').doc(couponAiQuotaDocumentId(id));
    const [couponSnapshot, quotaSnapshot] = await Promise.all([
      db.collection('coupons').doc(current.trackingRef.id).get(),
      quotaRef.get(),
    ]);
    const used = quotaUsed(quotaSnapshot.data()?.used);
    return NextResponse.json({
      coupon: serializeCoupon(couponSnapshot.data(), {
        reservationId: id,
        trackingId: current.trackingRef.id,
        couponCode: current.couponCode,
        businessName: String(current.tracking.businessName || current.access.data.businessName || ''),
      }),
      ai: {
        ...couponAiAvailability(),
        dailyQuota: quotaLimit,
        usedToday: Math.min(used, quotaLimit),
        remainingToday: Math.max(0, quotaLimit - used),
        utcDay: couponUtcDayKey(),
      },
    }, { headers: responseHeaders() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return failure(new CouponRequestError('A same-origin coupon request is required.', 403));
  }
  const declaredLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return failure(new CouponRequestError('The coupon request is too large.', 400));
  }

  try {
    const { id } = await params;
    const current = await readPaidTracking(request, id);
    const rawBody = await request.text();
    if (rawBody.length > MAX_REQUEST_BYTES) {
      throw new CouponRequestError('The coupon request is too large.', 400);
    }
    let json: unknown = null;
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = null;
    }
    const parsed = mutationSchema.safeParse(json);
    if (!parsed.success) {
      throw new CouponRequestError('Review the bounded coupon fields and try again.', 400);
    }
    const db = getAdminFirestore();

    if (parsed.data.action === 'generate') {
      const generationInput = parsed.data;
      const availability = couponAiAvailability();
      if (!availability.enabled) {
        throw new CouponRequestError(
          availability.reason || 'AI drafting is disabled. Continue manually.',
          503,
        );
      }
      const quotaLimit = couponAiDailyQuota();
      const now = new Date();
      const quotaRef = db.collection('couponaiusage').doc(couponAiQuotaDocumentId(id, now));
      let remaining = 0;
      await db.runTransaction(async (transaction) => {
        const [transactionAccess, trackingSnapshot, couponClaimSnapshot, quotaSnapshot] = await Promise.all([
          assertReservationAccessInTransaction(
            transaction,
            current.access.ref.id,
            current.accessToken,
          ),
          transaction.get(current.trackingRef),
          transaction.get(current.couponClaimRef),
          transaction.get(quotaRef),
        ]);
        const reservation = transactionAccess.data;
        const tracking = trackingSnapshot.data();
        const couponClaim = couponClaimSnapshot.data();
        if (
          reservation.status !== 'paid'
          || reservation.trackingId !== current.trackingRef.id
          || !trackingSnapshot.exists
          || tracking?.reservationId !== current.access.ref.id
          || tracking?.campaignId !== reservation.campaignId
          || !couponClaimSnapshot.exists
          || couponClaim?.couponCode !== current.couponCode
          || couponClaim?.reservationId !== current.access.ref.id
          || couponClaim?.trackingId !== current.trackingRef.id
          || couponClaim?.campaignId !== reservation.campaignId
        ) {
          throw new CouponRequestError(
            'AI drafting requires this same current paid reservation and tracking record.',
            409,
          );
        }
        const used = quotaUsed(quotaSnapshot.data()?.used);
        if (used >= quotaLimit) {
          throw new CouponRequestError(
            `The ${quotaLimit}-draft daily AI limit is reached. Manual drafting remains available.`,
            429,
          );
        }
        const nextUsed = used + 1;
        remaining = Math.max(0, quotaLimit - nextUsed);
        transaction.set(quotaRef, {
          reservationId: current.access.ref.id,
          trackingId: current.trackingRef.id,
          utcDay: couponUtcDayKey(now),
          used: nextUsed,
          limit: quotaLimit,
          lastField: generationInput.field,
          model: availability.model,
          updatedAt: FieldValue.serverTimestamp(),
          ...(quotaSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true });
      });

      const result = await generateCouponFieldDraft({
        field: generationInput.field,
        businessName: String(current.tracking.businessName || current.access.data.businessName || ''),
        reservationScopedId: current.access.ref.id,
        context: generationInput.context,
        currentDraft: generationInput.currentDraft,
      });
      return NextResponse.json({
        suggestion: result,
        remainingToday: remaining,
        notice: 'AI copy is an editable draft, not an approved or published claim.',
      }, { headers: responseHeaders() });
    }

    const draft = normalizeCouponDraft(parsed.data.draft);
    const context = normalizeCouponContext(parsed.data.context);
    const submitting = parsed.data.action === 'submit_for_owner_review';
    const errors = couponDraftErrors(draft, submitting);
    if (errors.length) throw new CouponRequestError(errors[0], 422);

    const couponRef = db.collection('coupons').doc(current.trackingRef.id);
    const auditRef = db.collection('auditlog').doc();
    let nextVersion = 0;
    await db.runTransaction(async (transaction) => {
      const [transactionAccess, trackingSnapshot, couponClaimSnapshot, couponSnapshot] = await Promise.all([
        assertReservationAccessInTransaction(
          transaction,
          current.access.ref.id,
          current.accessToken,
        ),
        transaction.get(current.trackingRef),
        transaction.get(current.couponClaimRef),
        transaction.get(couponRef),
      ]);
      const reservation = transactionAccess.data;
      const tracking = trackingSnapshot.data();
      const couponClaim = couponClaimSnapshot.data();
      if (
        reservation.status !== 'paid'
        || reservation.trackingId !== current.trackingRef.id
        || !trackingSnapshot.exists
        || tracking?.reservationId !== current.access.ref.id
        || tracking?.campaignId !== reservation.campaignId
        || normalizeCouponCode(String(tracking?.couponCode || '')) !== current.couponCode
        || !couponClaimSnapshot.exists
        || couponClaim?.couponCode !== current.couponCode
        || couponClaim?.reservationId !== current.access.ref.id
        || couponClaim?.trackingId !== current.trackingRef.id
        || couponClaim?.campaignId !== reservation.campaignId
      ) {
        throw new CouponRequestError(
          'Coupon changes require this same current paid reservation and unique tracking record.',
          409,
        );
      }
      nextVersion = Math.max(0, Number(couponSnapshot.data()?.draftVersion || 0)) + 1;
      transaction.set(couponRef, {
        campaignId: reservation.campaignId,
        reservationId: current.access.ref.id,
        trackingId: current.trackingRef.id,
        couponCode: current.couponCode,
        businessName: String(tracking.businessName || reservation.businessName || ''),
        reviewStatus: submitting ? 'submitted_for_owner_review' : 'draft',
        publicationStatus: publicationStatus(couponSnapshot.data()?.publicationStatus),
        draftVersion: nextVersion,
        draft,
        context,
        submittedAt: submitting ? FieldValue.serverTimestamp() : null,
        updatedAt: FieldValue.serverTimestamp(),
        ...(couponSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
      }, { merge: true });
      transaction.create(auditRef, {
        actor: 'reservation_access_token',
        action: submitting ? 'coupon.submit_for_owner_review' : 'coupon.save_draft',
        entityId: couponRef.id,
        reservationId: current.access.ref.id,
        summary: submitting
          ? `Submitted coupon draft version ${nextVersion} for owner review; not published.`
          : `Saved coupon draft version ${nextVersion}; not owner-approved or published.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const saved = await couponRef.get();
    return NextResponse.json({
      coupon: serializeCoupon(saved.data(), {
        reservationId: id,
        trackingId: current.trackingRef.id,
        couponCode: current.couponCode,
        businessName: String(current.tracking.businessName || current.access.data.businessName || ''),
      }),
      notice: submitting
        ? `Draft version ${nextVersion} was submitted for owner review. It is not published.`
        : `Draft version ${nextVersion} was saved privately. It is not published.`,
    }, { headers: responseHeaders() });
  } catch (error) {
    return failure(error);
  }
}
