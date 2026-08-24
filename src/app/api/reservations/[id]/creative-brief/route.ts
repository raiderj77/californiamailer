import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  CREATIVE_BRIEF_LIMITS,
  CREATIVE_BRIEF_STATUS,
  CREATIVE_BRIEF_TIME_ZONE,
  EMPTY_CREATIVE_BRIEF,
  creativeBriefDeliveryValidationStatus,
  creativeBriefErrors,
  isCalendarDate,
  isCreativeBriefStatus,
  parseCreativeBriefContent,
  type CreativeBriefContent,
  type CreativeBriefDeliveryWindow,
} from '@/lib/creativeBrief';
import { campaignCreativeInputsLocked } from '@/lib/campaignLifecycle';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';
import {
  ReservationAccessError,
  assertReservationAccessInTransaction,
  reservationCookieName,
  verifyReservationAccess,
} from '@/lib/reservationAuth';

export const runtime = 'nodejs';

const MAX_REQUEST_BYTES = 16_000;

class CreativeBriefRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 409 | 411 | 413 | 422 | 429 | 503,
  ) {
    super(message);
  }
}

function responseHeaders(extra: Record<string, string> = {}) {
  return { 'Cache-Control': 'private, no-store', ...extra };
}

function failure(error: unknown) {
  if (error instanceof ReservationAccessError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  if (error instanceof CreativeBriefRequestError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  return NextResponse.json(
    { error: 'The private creative brief is unavailable.' },
    { status: 503, headers: responseHeaders() },
  );
}

function timestampToIso(value: unknown): string | null {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

function campaignDate(value: unknown, label: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !isCalendarDate(value)) {
    throw new CreativeBriefRequestError(
      `The campaign ${label} is unavailable for safe offer validation.`,
      409,
    );
  }
  return value;
}

function deliveryWindowFromCampaign(campaign: FirebaseFirestore.DocumentData) {
  const deliveryWindow = {
    startDate: campaignDate(campaign.plannedDeliveryStart, 'delivery start date'),
    endDate: campaignDate(campaign.plannedDeliveryEnd, 'delivery end date'),
  } satisfies CreativeBriefDeliveryWindow;
  if (
    deliveryWindow.startDate
    && deliveryWindow.endDate
    && deliveryWindow.startDate > deliveryWindow.endDate
  ) {
    throw new CreativeBriefRequestError(
      'The campaign planned delivery window is invalid.',
      409,
    );
  }
  return deliveryWindow;
}

function serializeDeliveryWindow(deliveryWindow: CreativeBriefDeliveryWindow) {
  return {
    ...deliveryWindow,
    timeZone: CREATIVE_BRIEF_TIME_ZONE,
    validationStatus: creativeBriefDeliveryValidationStatus(deliveryWindow),
  };
}

function creativeBriefSequence(value: unknown) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new CreativeBriefRequestError('The creative brief version sequence is invalid.', 409);
  }
  return Number(value);
}

function initialContent(reservation: FirebaseFirestore.DocumentData): CreativeBriefContent {
  return parseCreativeBriefContent({
    ...EMPTY_CREATIVE_BRIEF,
    businessDisplayName: String(reservation.businessName || '')
      .slice(0, CREATIVE_BRIEF_LIMITS.businessDisplayName),
    phone: String(reservation.phone || '').slice(0, CREATIVE_BRIEF_LIMITS.phone),
    website: String(reservation.website || '').slice(0, CREATIVE_BRIEF_LIMITS.website),
    factualOffer: String(reservation.advertisedOffer || '')
      .slice(0, CREATIVE_BRIEF_LIMITS.factualOffer),
  }) || { ...EMPTY_CREATIVE_BRIEF };
}

function serializeBrief(
  id: string,
  data: FirebaseFirestore.DocumentData,
  currentDeliveryWindow: CreativeBriefDeliveryWindow,
) {
  const content = parseCreativeBriefContent(data.content);
  const version = data.version;
  if (
    !content
    || !Number.isSafeInteger(version)
    || Number(version) < 1
    || !isCreativeBriefStatus(data.status)
  ) {
    throw new CreativeBriefRequestError('The saved creative brief version is invalid.', 409);
  }
  return {
    id,
    campaignId: String(data.campaignId || ''),
    reservationId: String(data.reservationId || ''),
    placementSlotId: String(data.placementSlotId || ''),
    version: Number(version),
    status: data.status,
    content,
    deliveryWindow: data.deliveryWindow || null,
    currentDeliveryErrors: creativeBriefErrors(content, currentDeliveryWindow),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt),
    reviewedAt: timestampToIso(data.reviewedAt),
    reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : null,
  };
}

async function paidAccess(request: NextRequest, reservationId: string) {
  const accessToken = request.cookies.get(reservationCookieName(reservationId))?.value;
  const access = await verifyReservationAccess(reservationId, accessToken);
  if (!access) throw new CreativeBriefRequestError('Private reservation access required.', 401);
  if (
    access.data.status !== 'paid'
    || typeof access.data.campaignId !== 'string'
    || !access.data.campaignId
    || typeof access.data.placementSlotId !== 'string'
    || !access.data.placementSlotId
  ) {
    throw new CreativeBriefRequestError(
      'Creative brief access opens only for a current provider-verified paid reservation.',
      409,
    );
  }
  return { access, accessToken: accessToken! };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rate = consumeRateLimit(requestFingerprint(request, `creative-brief-read:${id}`), 120, 60 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Creative brief read limit reached.' },
        { status: 429, headers: responseHeaders({ 'Retry-After': String(rate.retryAfterSeconds) }) },
      );
    }
    const db = getAdminFirestore();
    const accessToken = request.cookies.get(reservationCookieName(id))?.value;
    const result = await db.runTransaction(async (transaction) => {
      const current = await assertReservationAccessInTransaction(transaction, id, accessToken);
      const reservation = current.data;
      if (
        reservation.status !== 'paid'
        || typeof reservation.campaignId !== 'string'
        || !reservation.campaignId
        || typeof reservation.placementSlotId !== 'string'
        || !reservation.placementSlotId
      ) {
        throw new CreativeBriefRequestError(
          'Creative brief access opens only for a current provider-verified paid reservation.',
          409,
        );
      }
      const campaignSnapshot = await transaction.get(
        db.collection('campaigns').doc(reservation.campaignId),
      );
      if (!campaignSnapshot.exists) {
        throw new CreativeBriefRequestError('The paid reservation campaign is unavailable.', 409);
      }
      const deliveryWindow = deliveryWindowFromCampaign(campaignSnapshot.data()!);
      const sequence = creativeBriefSequence(reservation.creativeBriefSequence);
      const latestId = reservation.latestCreativeBriefId;
      if (sequence === 0 && latestId !== undefined && latestId !== null) {
        throw new CreativeBriefRequestError('The latest creative brief pointer is invalid.', 409);
      }
      if (sequence > 0 && (typeof latestId !== 'string' || !latestId)) {
        throw new CreativeBriefRequestError('The latest creative brief pointer is missing.', 409);
      }

      let creativeBrief = null;
      if (sequence > 0 && typeof latestId === 'string') {
        const briefSnapshot = await transaction.get(db.collection('creativebriefs').doc(latestId));
        const data = briefSnapshot.data();
        if (
          !briefSnapshot.exists
          || !data
          || data.reservationId !== id
          || data.campaignId !== reservation.campaignId
          || data.placementSlotId !== reservation.placementSlotId
          || data.version !== sequence
        ) {
          throw new CreativeBriefRequestError('The latest creative brief binding is invalid.', 409);
        }
        creativeBrief = serializeBrief(latestId, data, deliveryWindow);
      }
      return { creativeBrief, deliveryWindow, reservation };
    });
    return NextResponse.json({
      creativeBrief: result.creativeBrief,
      initialContent: result.creativeBrief ? null : initialContent(result.reservation),
      deliveryWindow: serializeDeliveryWindow(result.deliveryWindow),
    }, { headers: responseHeaders() });
  } catch (error) {
    return failure(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return failure(new CreativeBriefRequestError('A same-origin creative brief request is required.', 403));
  }
  const contentLengthHeader = request.headers.get('content-length');
  if (!contentLengthHeader || !/^[1-9][0-9]*$/.test(contentLengthHeader)) {
    return failure(new CreativeBriefRequestError(
      'A valid positive Content-Length header is required for creative brief updates.',
      411,
    ));
  }
  const declaredLength = Number(contentLengthHeader);
  if (!Number.isSafeInteger(declaredLength) || declaredLength > MAX_REQUEST_BYTES) {
    return failure(new CreativeBriefRequestError('The creative brief request is too large.', 413));
  }

  try {
    const { id } = await params;
    const rate = consumeRateLimit(requestFingerprint(request, `creative-brief-write:${id}`), 20, 60 * 60_000);
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Creative brief update limit reached.' },
        { status: 429, headers: responseHeaders({ 'Retry-After': String(rate.retryAfterSeconds) }) },
      );
    }
    const current = await paidAccess(request, id);
    const contentType = request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase();
    if (contentType !== 'application/json') {
      throw new CreativeBriefRequestError('The creative brief request must be JSON.', 400);
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REQUEST_BYTES) {
      throw new CreativeBriefRequestError('The creative brief request is too large.', 413);
    }
    let json: unknown = null;
    try {
      json = JSON.parse(rawBody);
    } catch {
      json = null;
    }
    if (
      typeof json !== 'object'
      || json === null
      || Array.isArray(json)
      || Object.keys(json).length !== 1
      || !Object.hasOwn(json, 'content')
    ) {
      throw new CreativeBriefRequestError('Review the bounded creative brief fields and try again.', 400);
    }
    const content = parseCreativeBriefContent((json as { content?: unknown }).content);
    if (!content) {
      throw new CreativeBriefRequestError('Review the bounded creative brief fields and try again.', 400);
    }

    const db = getAdminFirestore();
    const briefRef = db.collection('creativebriefs').doc();
    const auditRef = db.collection('auditlog').doc();
    let nextVersion = 0;
    let savedWindow: CreativeBriefDeliveryWindow = { startDate: null, endDate: null };
    await db.runTransaction(async (transaction) => {
      const transactionAccess = await assertReservationAccessInTransaction(
        transaction,
        id,
        current.accessToken,
      );
      const reservation = transactionAccess.data;
      if (
        reservation.status !== 'paid'
        || reservation.campaignId !== current.access.data.campaignId
        || typeof reservation.placementSlotId !== 'string'
        || reservation.placementSlotId !== current.access.data.placementSlotId
      ) {
        throw new CreativeBriefRequestError(
          'Creative brief changes require this same current paid reservation and placement.',
          409,
        );
      }
      const campaignRef = db.collection('campaigns').doc(reservation.campaignId);
      const campaignSnapshot = await transaction.get(campaignRef);
      if (!campaignSnapshot.exists) {
        throw new CreativeBriefRequestError('The paid reservation campaign is unavailable.', 409);
      }
      if (campaignCreativeInputsLocked(campaignSnapshot.data()?.status)) {
        throw new CreativeBriefRequestError(
          'Creative inputs are locked because this campaign has already been recorded as printed.',
          409,
        );
      }
      savedWindow = deliveryWindowFromCampaign(campaignSnapshot.data()!);
      const validationErrors = creativeBriefErrors(content, savedWindow);
      if (validationErrors.length) {
        throw new CreativeBriefRequestError(validationErrors[0], 422);
      }

      const storedSequence = creativeBriefSequence(reservation.creativeBriefSequence);
      const latestId = reservation.latestCreativeBriefId;
      if (
        (storedSequence === 0 && latestId !== undefined && latestId !== null)
        || (storedSequence > 0 && (typeof latestId !== 'string' || !latestId))
      ) {
        throw new CreativeBriefRequestError('The creative brief version pointer is inconsistent.', 409);
      }
      if (storedSequence > 0) {
        const latestSnapshot = await transaction.get(db.collection('creativebriefs').doc(latestId));
        const latest = latestSnapshot.data();
        if (
          !latestSnapshot.exists
          || latest?.reservationId !== id
          || latest?.campaignId !== reservation.campaignId
          || latest?.placementSlotId !== reservation.placementSlotId
          || latest?.version !== storedSequence
          || !isCreativeBriefStatus(latest?.status)
          || !parseCreativeBriefContent(latest?.content)
        ) {
          throw new CreativeBriefRequestError('The latest creative brief binding is invalid.', 409);
        }
      }

      nextVersion = storedSequence + 1;
      const deliveryWindow = serializeDeliveryWindow(savedWindow);
      transaction.create(briefRef, {
        campaignId: reservation.campaignId,
        reservationId: id,
        placementSlotId: reservation.placementSlotId,
        version: nextVersion,
        status: CREATIVE_BRIEF_STATUS,
        previousCreativeBriefId: storedSequence > 0 ? latestId : null,
        content,
        deliveryWindow,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(transactionAccess.ref, {
        latestCreativeBriefId: briefRef.id,
        creativeBriefSequence: nextVersion,
        creativeBriefStatus: CREATIVE_BRIEF_STATUS,
        creativeBriefReviewedAt: null,
        creativeBriefReviewedBy: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(campaignRef, {
        ownerPrintApproved: false,
        printReadyAt: null,
        artworkPreflightApproved: false,
        printReadinessRevokedAt: FieldValue.serverTimestamp(),
        printReadinessRevokedReason: 'creative_brief_updated',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actor: 'reservation_access_token',
        action: 'creative_brief.save_version',
        entityId: briefRef.id,
        campaignId: reservation.campaignId,
        reservationId: id,
        version: nextVersion,
        summary: `Saved private creative brief version ${nextVersion} pending owner review; prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });

    const saved = await briefRef.get();
    return NextResponse.json({
      creativeBrief: serializeBrief(briefRef.id, saved.data()!, savedWindow),
      deliveryWindow: serializeDeliveryWindow(savedWindow),
      notice: `Private creative brief version ${nextVersion} was saved for owner review. Print readiness was revoked.`,
    }, { headers: responseHeaders() });
  } catch (error) {
    return failure(error);
  }
}
