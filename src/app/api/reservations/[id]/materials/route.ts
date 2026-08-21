import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  parseAssetRightsAttestation,
  type AssetRightsAttestationInput,
} from '@/lib/creativeBrief';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';
import {
  ReservationAccessError,
  assertReservationAccessInTransaction,
  reservationCookieName,
  verifyReservationAccess,
} from '@/lib/reservationAuth';
import { validatePrivateUpload } from '@/lib/privateUploads';

export const runtime = 'nodejs';

const MAX_MULTIPART_BYTES = 5 * 1024 * 1024 + 24_000;
const MATERIAL_FORM_FIELDS = [
  'file',
  'assetKind',
  'rightsBasis',
  'attestorName',
  'sourceOrLicenseNote',
  'rightsAttested',
] as const;

class MaterialRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 409 | 411 | 413 | 429 | 503,
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
  if (error instanceof MaterialRequestError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  return NextResponse.json(
    { error: 'The private materials service is unavailable.' },
    { status: 503, headers: responseHeaders() },
  );
}

function timestampToIso(value: unknown) {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

function storedRightsAttestation(value: unknown): AssetRightsAttestationInput | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (record.statementVersion !== ASSET_RIGHTS_STATEMENT_VERSION) return null;
  return parseAssetRightsAttestation({
    assetKind: record.assetKind,
    rightsBasis: record.rightsBasis,
    attestorName: record.attestorName,
    sourceOrLicenseNote: record.sourceOrLicenseNote,
    rightsAttested: record.rightsAttested,
  });
}

function requirePaidReservation(
  reservation: FirebaseFirestore.DocumentData,
  expected?: { campaignId: string; placementSlotId: string },
) {
  if (
    reservation.status !== 'paid'
    || typeof reservation.campaignId !== 'string'
    || !reservation.campaignId
    || typeof reservation.placementSlotId !== 'string'
    || !reservation.placementSlotId
    || (expected && reservation.campaignId !== expected.campaignId)
    || (expected && reservation.placementSlotId !== expected.placementSlotId)
  ) {
    throw new MaterialRequestError(
      'Materials are accepted only for this same current provider-verified paid reservation and placement.',
      409,
    );
  }
  return {
    campaignId: reservation.campaignId as string,
    placementSlotId: reservation.placementSlotId as string,
  };
}

function materialSequence(value: unknown) {
  if (value === undefined || value === null) return 0;
  if (
    !Number.isSafeInteger(value)
    || Number(value) < 0
    || Number(value) >= Number.MAX_SAFE_INTEGER
  ) {
    throw new MaterialRequestError('The material version sequence is invalid.', 409);
  }
  return Number(value);
}

function assertMaterialPointer(reservation: FirebaseFirestore.DocumentData, sequence: number) {
  const latestId = reservation.latestMaterialId;
  if (
    (sequence === 0 && latestId !== undefined && latestId !== null)
    || (sequence > 0 && (typeof latestId !== 'string' || !latestId))
  ) {
    throw new MaterialRequestError('The latest material pointer is inconsistent.', 409);
  }
  return sequence > 0 ? latestId as string : null;
}

function parseRightsForm(form: FormData) {
  const keys = [...form.keys()];
  if (keys.some((key) => !MATERIAL_FORM_FIELDS.includes(key as typeof MATERIAL_FORM_FIELDS[number]))) {
    throw new MaterialRequestError('The private material form contains unsupported fields.', 400);
  }
  if (MATERIAL_FORM_FIELDS.some((key) => form.getAll(key).length !== 1)) {
    throw new MaterialRequestError('Complete each private material and rights field once.', 400);
  }
  const rights = parseAssetRightsAttestation({
    assetKind: form.get('assetKind'),
    rightsBasis: form.get('rightsBasis'),
    attestorName: form.get('attestorName'),
    sourceOrLicenseNote: form.get('sourceOrLicenseNote'),
    rightsAttested: form.get('rightsAttested') === 'true',
  });
  if (!rights) {
    throw new MaterialRequestError(
      'Confirm the asset type, rights basis, attestor, license note when needed, and explicit rights statement.',
      400,
    );
  }
  return rights;
}

function readPaidMaterials(
  db: FirebaseFirestore.Firestore,
  id: string,
  accessToken: string | undefined,
) {
  return db.runTransaction(async (transaction) => {
    const access = await assertReservationAccessInTransaction(transaction, id, accessToken);
    const binding = requirePaidReservation(access.data);
    const sequence = materialSequence(access.data.materialSequence);
    const latestId = assertMaterialPointer(access.data, sequence);
    if (!latestId) return { materials: [] };

    const snapshot = await transaction.get(db.collection('materials').doc(latestId));
    const data = snapshot.data();
    if (
      !snapshot.exists
      || !data
      || data.reservationId !== id
      || data.campaignId !== binding.campaignId
      || data.placementSlotId !== binding.placementSlotId
      || data.version !== sequence
    ) {
      throw new MaterialRequestError('The latest material binding is invalid.', 409);
    }
    const rightsAttestation = storedRightsAttestation(data.rightsAttestation);
    return {
      materials: [{
        id: snapshot.id,
        version: sequence,
        kind: String(data.kind || ''),
        assetKind: typeof data.assetKind === 'string' ? data.assetKind : null,
        originalName: String(data.originalName || ''),
        status: String(data.status || ''),
        rightsAttestation,
        rightsAttestedAt: timestampToIso(data.rightsAttestedAt),
        createdAt: timestampToIso(data.createdAt),
      }],
    };
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const rate = consumeRateLimit(
      requestFingerprint(request, `material-read:${id}`),
      120,
      60 * 60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Private material read limit reached.' },
        {
          status: 429,
          headers: responseHeaders({ 'Retry-After': String(rate.retryAfterSeconds) }),
        },
      );
    }
    const accessToken = request.cookies.get(reservationCookieName(id))?.value;
    const db = getAdminFirestore();
    const result = await readPaidMaterials(db, id, accessToken);
    return NextResponse.json(result, { headers: responseHeaders() });
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
    return failure(new MaterialRequestError('A same-origin material request is required.', 403));
  }
  const contentLengthHeader = request.headers.get('content-length');
  if (!contentLengthHeader || !/^[1-9][0-9]*$/.test(contentLengthHeader)) {
    return failure(new MaterialRequestError(
      'A valid positive Content-Length header is required for private material uploads.',
      411,
    ));
  }
  const declaredLength = Number(contentLengthHeader);
  if (!Number.isSafeInteger(declaredLength) || declaredLength > MAX_MULTIPART_BYTES) {
    return failure(new MaterialRequestError('The private material request is too large.', 413));
  }

  let uploadedStoragePath: string | null = null;
  try {
    const { id } = await params;
    const rate = consumeRateLimit(
      requestFingerprint(request, `material:${id}`),
      5,
      60 * 60_000,
    );
    if (!rate.allowed) {
      return NextResponse.json(
        { error: 'Private material upload limit reached.' },
        {
          status: 429,
          headers: responseHeaders({ 'Retry-After': String(rate.retryAfterSeconds) }),
        },
      );
    }
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.startsWith('multipart/form-data;')) {
      throw new MaterialRequestError('The private material request must be multipart form data.', 400);
    }
    const accessToken = request.cookies.get(reservationCookieName(id))?.value;
    const access = await verifyReservationAccess(id, accessToken);
    if (!access) throw new ReservationAccessError();
    const initialBinding = requirePaidReservation(access.data);

    const form = await request.formData();
    const rights = parseRightsForm(form);
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new MaterialRequestError('Choose a PNG or JPEG creative asset.', 400);
    }
    const validated = await validatePrivateUpload(file, 'advertiser_logo');
    const db = getAdminFirestore();
    const materialRef = db.collection('materials').doc();
    const storagePath = `private/reservations/${id}/materials/${validated.randomName}`;
    uploadedStoragePath = storagePath;
    await getAdminStorage().file(storagePath).save(validated.bytes, {
      resumable: false,
      contentType: validated.contentType,
      metadata: {
        cacheControl: 'private,no-store',
        metadata: {
          reservationId: id,
          assetKind: rights.assetKind,
          materialId: materialRef.id,
          rightsStatementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
        },
      },
    });

    const version = await db.runTransaction(async (transaction) => {
      const currentAccess = await assertReservationAccessInTransaction(transaction, id, accessToken);
      const currentReservation = currentAccess.data;
      const currentBinding = requirePaidReservation(currentAccess.data, initialBinding);
      const storedSequence = materialSequence(currentReservation.materialSequence);
      const latestId = assertMaterialPointer(currentReservation, storedSequence);
      if (latestId) {
        const previousSnapshot = await transaction.get(db.collection('materials').doc(latestId));
        const previous = previousSnapshot.data();
        if (
          !previousSnapshot.exists
          || !previous
          || previous.reservationId !== id
          || previous.campaignId !== currentBinding.campaignId
          || previous.placementSlotId !== currentBinding.placementSlotId
          || previous.version !== storedSequence
        ) {
          throw new MaterialRequestError('The latest material binding is invalid.', 409);
        }
      }
      const nextVersion = storedSequence + 1;
      const kind = rights.assetKind === 'logo'
        ? 'advertiser_logo'
        : `advertiser_${rights.assetKind}`;
      transaction.create(materialRef, {
        reservationId: id,
        campaignId: currentBinding.campaignId,
        placementSlotId: currentBinding.placementSlotId,
        version: nextVersion,
        previousMaterialId: latestId,
        kind,
        assetKind: rights.assetKind,
        originalName: validated.originalName,
        contentType: validated.contentType,
        sizeBytes: validated.bytes.length,
        storagePath,
        status: 'quarantine_pending_owner_review',
        rightsAttestation: {
          ...rights,
          statementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
        },
        rightsAttestedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(currentAccess.ref, {
        materialSequence: nextVersion,
        materialsStatus: 'received_pending_review',
        latestMaterialId: materialRef.id,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(db.collection('campaigns').doc(currentReservation.campaignId), {
        ownerPrintApproved: false,
        printReadyAt: null,
        artworkPreflightApproved: false,
        printReadinessRevokedAt: FieldValue.serverTimestamp(),
        printReadinessRevokedReason: 'material_uploaded',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actor: 'reservation_access_token',
        action: 'material.upload',
        entityId: materialRef.id,
        campaignId: currentBinding.campaignId,
        reservationId: id,
        version: nextVersion,
        rightsStatementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
        summary: `Creative asset version ${nextVersion} received in private quarantine with rights attestation pending owner review; prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return nextVersion;
    });
    uploadedStoragePath = null;
    return NextResponse.json({
      success: true,
      material: {
        id: materialRef.id,
        version,
        assetKind: rights.assetKind,
        originalName: validated.originalName,
        status: 'quarantine_pending_owner_review',
        rightsAttestation: {
          ...rights,
          statementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
        },
      },
    }, { headers: responseHeaders() });
  } catch (error) {
    if (uploadedStoragePath) {
      try {
        await getAdminStorage().file(uploadedStoragePath).delete({ ignoreNotFound: true });
      } catch {
        // Database authorization remains authoritative; cleanup is best effort.
      }
    }
    if (
      error instanceof Error
      && ['unsupported-file-type', 'invalid-file-size', 'file-signature-mismatch'].includes(error.message)
    ) {
      return failure(new MaterialRequestError(
        'File must be a genuine PNG or JPEG no larger than 5 MB.',
        400,
      ));
    }
    return failure(error);
  }
}
