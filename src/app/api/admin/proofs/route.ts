import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  currentMaterialBindings,
  hasCurrentApprovedMaterialWithRights,
  hasReviewableCurrentCreativeBrief,
} from '@/lib/businessRules';
import { campaignCreativeInputsLocked } from '@/lib/campaignLifecycle';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  CREATIVE_ASSET_KINDS,
  CREATIVE_BRIEF_REVIEWED_STATUS,
  PROOF_BRIEF_REVIEW_CONFIRMATION,
  isCreativeBriefStatus,
  parseAssetRightsAttestation,
  parseCreativeBriefContent,
  parseMaterialManifest,
  sortedMaterialManifestEntries,
} from '@/lib/creativeBrief';
import type { CreativeAssetKind } from '@/lib/creativeBrief';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { validatePrivateUpload } from '@/lib/privateUploads';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_MULTIPART_BYTES = 10 * 1024 * 1024 + 32_000;
const PROOF_FORM_FIELDS = [
  'file',
  'reservationId',
  'notes',
  'briefReviewConfirmation',
  'expectedCreativeBriefId',
  'expectedCreativeBriefVersion',
  'expectedMaterialBindings',
] as const;

interface ExpectedMaterialBinding {
  assetKind: CreativeAssetKind;
  materialId: string;
  materialVersion: number;
}

class ProofRequestError extends Error {
  constructor(message: string, readonly status: 400 | 409 | 411 | 413) {
    super(message);
  }
}

function responseHeaders() {
  return { 'Cache-Control': 'private, no-store' };
}

function failure(error: unknown) {
  if (error instanceof RequestAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  if (error instanceof ProofRequestError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: responseHeaders() },
    );
  }
  return NextResponse.json(
    { error: 'Proof operation failed.' },
    { status: 500, headers: responseHeaders() },
  );
}

function proofSequence(value: unknown) {
  if (value === undefined || value === null) return 0;
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    throw new ProofRequestError('The proof version sequence is invalid.', 409);
  }
  return Number(value);
}

function parseExpectedMaterialBindings(value: unknown): ExpectedMaterialBinding[] | null {
  if (typeof value !== 'string' || value.length > 2_000) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > CREATIVE_ASSET_KINDS.length) {
    return null;
  }
  const bindings: ExpectedMaterialBinding[] = [];
  for (const candidate of parsed) {
    if (
      typeof candidate !== 'object'
      || candidate === null
      || Array.isArray(candidate)
      || Object.keys(candidate).length !== 3
    ) return null;
    const record = candidate as Record<string, unknown>;
    if (
      !CREATIVE_ASSET_KINDS.includes(record.assetKind as CreativeAssetKind)
      || typeof record.materialId !== 'string'
      || !/^[A-Za-z0-9_-]{1,150}$/.test(record.materialId)
      || !Number.isSafeInteger(record.materialVersion)
      || Number(record.materialVersion) < 1
    ) return null;
    bindings.push({
      assetKind: record.assetKind as CreativeAssetKind,
      materialId: record.materialId,
      materialVersion: Number(record.materialVersion),
    });
  }
  if (new Set(bindings.map(({ assetKind }) => assetKind)).size !== bindings.length) return null;
  const sortedKinds = [...bindings].sort((left, right) => left.assetKind.localeCompare(right.assetKind));
  return sortedKinds.every((binding, index) => binding.assetKind === bindings[index].assetKind)
    ? bindings
    : null;
}

function timestampToIso(value: unknown) {
  const date = (value as { toDate?: () => unknown } | null)?.toDate?.();
  return date instanceof Date ? date.toISOString() : null;
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const [reservations, proofs, materials, creativeBriefs] = await Promise.all([
      db.collection('reservations').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('proofs').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('materials').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('creativebriefs').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
    ]);
    const reservationData = new Map(reservations.docs.map((doc) => [doc.id, doc.data()]));
    const materialRecords = materials.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const currentBriefs = creativeBriefs.docs.flatMap((doc) => {
      const data = doc.data();
      const reservation = typeof data.reservationId === 'string'
        ? reservationData.get(data.reservationId)
        : undefined;
      const content = parseCreativeBriefContent(data.content);
      if (
        !reservation
        || reservation.latestCreativeBriefId !== doc.id
        || reservation.creativeBriefSequence !== data.version
        || reservation.creativeBriefStatus !== data.status
        || reservation.campaignId !== data.campaignId
        || reservation.placementSlotId !== data.placementSlotId
        || !content
        || !isCreativeBriefStatus(data.status)
      ) return [];
      return [{
        id: doc.id,
        reservationId: data.reservationId,
        version: data.version,
        status: data.status,
        content,
        deliveryWindow: data.deliveryWindow || null,
        reviewedAt: timestampToIso(data.reviewedAt),
        reviewedBy: typeof data.reviewedBy === 'string' ? data.reviewedBy : null,
      }];
    });
    return NextResponse.json({
      reservations: reservations.docs.map((doc) => {
        const data = doc.data();
        const bindings = currentMaterialBindings({ id: doc.id, ...data }, materialRecords);
        return {
          id: doc.id,
          businessName: data.businessName,
          categorySlug: data.categorySlug,
          status: data.status,
          materialsStatus: data.materialsStatus || 'not_received',
          creativeBriefStatus: data.creativeBriefStatus || 'not_received',
          materialBindings: bindings?.map((binding) => ({
            assetKind: binding.assetKind,
            materialId: binding.materialId,
            materialVersion: binding.materialVersion,
          })) ?? null,
        };
      }),
      proofs: proofs.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          reservationId: data.reservationId,
          businessName: data.businessName,
          version: data.version,
          status: data.status,
          originalName: data.originalName,
          revisionRequests: data.revisionRequests || [],
          approvedAt: data.approvedAt?.toDate?.()?.toISOString?.() || null,
          approvedBy: data.approvedBy || null,
          creativeBriefId: data.creativeBriefId || null,
          creativeBriefVersion: data.creativeBriefVersion || null,
          materialBindings: Array.isArray(data.materialBindings) ? data.materialBindings : null,
        };
      }),
      materials: materials.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          reservationId: data.reservationId,
          originalName: data.originalName,
          kind: data.kind,
          assetKind: data.assetKind,
          version: data.version,
          status: data.status,
          rightsAttestation: (() => {
            const rights = data.rightsAttestation;
            if (typeof rights !== 'object' || rights === null || Array.isArray(rights)) return null;
            const record = rights as Record<string, unknown>;
            if (record.statementVersion !== ASSET_RIGHTS_STATEMENT_VERSION) return null;
            const parsed = parseAssetRightsAttestation({
              assetKind: record.assetKind,
              rightsBasis: record.rightsBasis,
              attestorName: record.attestorName,
              sourceOrLicenseNote: record.sourceOrLicenseNote,
              rightsAttested: record.rightsAttested,
            });
            return parsed ? { ...parsed, statementVersion: ASSET_RIGHTS_STATEMENT_VERSION } : null;
          })(),
          rightsAttestedAt: timestampToIso(data.rightsAttestedAt),
        };
      }),
      creativeBriefs: currentBriefs,
    }, { headers: responseHeaders() });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  let uploadedStoragePath: string | null = null;
  try {
    const owner = await requireOwner(request);
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.startsWith('multipart/form-data;')) {
      throw new ProofRequestError('The private proof request must be multipart form data.', 400);
    }
    const declaredLengthHeader = request.headers.get('content-length');
    if (!declaredLengthHeader || !/^\d+$/.test(declaredLengthHeader)) {
      throw new ProofRequestError('A valid proof request size is required.', 411);
    }
    const declaredLength = Number(declaredLengthHeader);
    if (!Number.isSafeInteger(declaredLength) || declaredLength <= 0) {
      throw new ProofRequestError('A valid proof request size is required.', 411);
    }
    if (declaredLength > MAX_MULTIPART_BYTES) {
      throw new ProofRequestError('The private proof request is too large.', 413);
    }

    const form = await request.formData();
    const formKeys = [...form.keys()];
    if (
      formKeys.some((key) => !PROOF_FORM_FIELDS.includes(key as typeof PROOF_FORM_FIELDS[number]))
      || PROOF_FORM_FIELDS.some((key) => form.getAll(key).length !== 1)
    ) {
      throw new ProofRequestError('Complete the exact private proof review fields once.', 400);
    }
    const reservationId = String(form.get('reservationId') || '');
    const notes = String(form.get('notes') || '').trim().slice(0, 1000);
    const briefReviewConfirmation = String(form.get('briefReviewConfirmation') || '');
    const expectedCreativeBriefId = String(form.get('expectedCreativeBriefId') || '');
    const expectedCreativeBriefVersionText = String(form.get('expectedCreativeBriefVersion') || '');
    const expectedCreativeBriefVersion = /^[1-9][0-9]{0,15}$/.test(expectedCreativeBriefVersionText)
      ? Number(expectedCreativeBriefVersionText)
      : 0;
    const expectedMaterialBindings = parseExpectedMaterialBindings(
      form.get('expectedMaterialBindings'),
    );
    const file = form.get('file');
    if (
      !/^[A-Za-z0-9]{10,40}$/.test(reservationId)
      || !(file instanceof File)
    ) {
      throw new ProofRequestError('Select a paid reservation and proof file.', 400);
    }
    if (
      briefReviewConfirmation !== PROOF_BRIEF_REVIEW_CONFIRMATION
      || !/^[A-Za-z0-9_-]{1,150}$/.test(expectedCreativeBriefId)
      || !Number.isSafeInteger(expectedCreativeBriefVersion)
      || expectedCreativeBriefVersion < 1
      || !expectedMaterialBindings
    ) {
      throw new ProofRequestError('Confirm the exact displayed creative brief and material versions.', 400);
    }
    const db = getAdminFirestore();
    const reservationRef = db.collection('reservations').doc(reservationId);
    const reservation = await reservationRef.get();
    const reservationData = reservation.data();
    if (
      !reservation.exists
      || reservationData?.status !== 'paid'
      || typeof reservationData.campaignId !== 'string'
    ) {
      throw new ProofRequestError('Proofs can be issued only for a paid reservation.', 409);
    }

    const validated = await validatePrivateUpload(file, 'proof');
    const proofRef = db.collection('proofs').doc();
    const storagePath = `private/reservations/${reservationId}/proofs/${validated.randomName}`;
    uploadedStoragePath = storagePath;
    await getAdminStorage().file(storagePath).save(validated.bytes, {
      resumable: false,
      contentType: validated.contentType,
      metadata: {
        cacheControl: 'private,no-store',
        metadata: { reservationId, kind: 'proof', proofId: proofRef.id },
      },
    });

    const version = await db.runTransaction(async (transaction) => {
      const currentReservationSnapshot = await transaction.get(reservationRef);
      const currentReservation = currentReservationSnapshot.data();
      if (
        !currentReservationSnapshot.exists
        || !currentReservation
        || currentReservation.status !== 'paid'
        || typeof currentReservation.campaignId !== 'string'
        || !currentReservation.campaignId
        || typeof currentReservation.placementSlotId !== 'string'
        || !currentReservation.placementSlotId
      ) {
        throw new ProofRequestError(
          'Proofs can be issued only for a currently paid reservation and placement.',
          409,
        );
      }

      const storedSequence = proofSequence(currentReservation.proofSequence);
      const latestProofId = currentReservation.latestProofId;
      if (
        (storedSequence === 0 && latestProofId !== undefined && latestProofId !== null)
        || (storedSequence > 0 && (typeof latestProofId !== 'string' || !latestProofId))
      ) {
        throw new ProofRequestError('The proof version pointer is inconsistent.', 409);
      }
      const creativeBriefId = currentReservation.latestCreativeBriefId;
      if (
        typeof creativeBriefId !== 'string'
        || !creativeBriefId
      ) {
        throw new ProofRequestError(
          'A current creative brief and approved rights-attested material are required.',
          409,
        );
      }

      const campaignRef = db.collection('campaigns').doc(currentReservation.campaignId);
      const manifestPresent = currentReservation.materialManifest !== undefined
        && currentReservation.materialManifest !== null;
      const manifest = manifestPresent
        ? parseMaterialManifest(currentReservation.materialManifest)
        : null;
      if (manifestPresent && !manifest) {
        throw new ProofRequestError('The current material manifest is invalid.', 409);
      }
      const materialPointers = manifest
        ? sortedMaterialManifestEntries(manifest)
        : [{
            assetKind: null,
            materialId: currentReservation.latestMaterialId,
            version: currentReservation.materialSequence,
          }];
      if (materialPointers.some((pointer) => (
        typeof pointer.materialId !== 'string'
        || !pointer.materialId
        || !Number.isSafeInteger(pointer.version)
        || Number(pointer.version) < 1
      ))) {
        throw new ProofRequestError(
          'A current creative brief and approved rights-attested material are required.',
          409,
        );
      }
      const [campaignSnapshot, creativeBriefSnapshot, previousProofSnapshot, ...materialSnapshots] = await Promise.all([
        transaction.get(campaignRef),
        transaction.get(db.collection('creativebriefs').doc(creativeBriefId)),
        storedSequence > 0 && typeof latestProofId === 'string'
          ? transaction.get(db.collection('proofs').doc(latestProofId))
          : Promise.resolve(null),
        ...materialPointers.map((pointer) => transaction.get(
          db.collection('materials').doc(String(pointer.materialId)),
        )),
      ]);
      const campaign = campaignSnapshot.data();
      const creativeBrief = creativeBriefSnapshot.data();
      const reservationRecord = { id: reservationId, ...currentReservation };
      if (
        !campaignSnapshot.exists
        || !campaign
        || !creativeBriefSnapshot.exists
        || !creativeBrief
        || !hasReviewableCurrentCreativeBrief(
          reservationRecord,
          { id: creativeBriefSnapshot.id, ...creativeBrief },
          campaign,
        )
      ) {
        throw new ProofRequestError(
          'The exact current creative brief must cover the complete planned delivery window.',
          409,
        );
      }
      if (campaignCreativeInputsLocked(campaign.status)) {
        throw new ProofRequestError(
          'Creative inputs are locked because this campaign has already been recorded as printed.',
          409,
        );
      }
      const materialRecords = materialSnapshots.flatMap((snapshot) => (
        snapshot.exists && snapshot.data() ? [{ id: snapshot.id, ...snapshot.data()! }] : []
      ));
      const currentBindings = currentMaterialBindings(reservationRecord, materialRecords);
      if (
        !currentBindings
        || !hasCurrentApprovedMaterialWithRights(
          reservationRecord,
          materialRecords,
        )
      ) {
        throw new ProofRequestError(
          'Every exact current material must be owner approved with a complete rights attestation.',
          409,
        );
      }
      if (storedSequence > 0) {
        const previousProof = previousProofSnapshot?.data();
        if (
          !previousProofSnapshot?.exists
          || !previousProof
          || previousProofSnapshot.id !== latestProofId
          || previousProof.reservationId !== reservationId
          || previousProof.campaignId !== currentReservation.campaignId
          || previousProof.placementSlotId !== currentReservation.placementSlotId
          || previousProof.version !== storedSequence
        ) {
          throw new ProofRequestError('The latest proof version binding is invalid.', 409);
        }
      }

      const creativeBriefVersion = Number(currentReservation.creativeBriefSequence);
      const materialBindings = currentBindings.map((binding) => ({
        assetKind: binding.assetKind,
        materialId: binding.materialId,
        materialVersion: binding.materialVersion,
      }));
      const inputsStillMatch = creativeBriefId === expectedCreativeBriefId
        && Number(currentReservation.creativeBriefSequence) === expectedCreativeBriefVersion
        && materialBindings.length === expectedMaterialBindings.length
        && materialBindings.every((binding, index) => (
          binding.assetKind === expectedMaterialBindings[index].assetKind
          && binding.materialId === expectedMaterialBindings[index].materialId
          && binding.materialVersion === expectedMaterialBindings[index].materialVersion
        ));
      if (!inputsStillMatch) {
        throw new ProofRequestError(
          'The creative brief or materials changed after review. Reload and review the exact current inputs.',
          409,
        );
      }
      const firstMaterial = materialBindings[0];
      const nextVersion = storedSequence + 1;
      transaction.update(creativeBriefSnapshot.ref, {
        status: CREATIVE_BRIEF_REVIEWED_STATUS,
        reviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION,
        reviewedBy: owner.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(proofRef, {
        campaignId: currentReservation.campaignId,
        reservationId,
        placementSlotId: currentReservation.placementSlotId,
        businessName: currentReservation.businessName,
        version: nextVersion,
        previousProofId: storedSequence > 0 ? latestProofId : null,
        creativeBriefId,
        creativeBriefVersion,
        creativeBriefReviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION,
        materialBindings,
        materialId: firstMaterial.materialId,
        materialVersion: firstMaterial.materialVersion,
        status: 'proof_sent',
        originalName: validated.originalName,
        contentType: validated.contentType,
        sizeBytes: validated.bytes.length,
        storagePath,
        ownerNotes: notes,
        revisionRequests: [],
        createdBy: owner.uid,
        sentAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        proofSequence: nextVersion,
        proofStatus: 'proof_sent',
        latestProofId: proofRef.id,
        creativeBriefStatus: CREATIVE_BRIEF_REVIEWED_STATUS,
        creativeBriefReviewedBy: owner.uid,
        creativeBriefReviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(campaignRef, {
        ownerPrintApproved: false,
        printReadyAt: null,
        artworkPreflightApproved: false,
        printReadinessRevokedAt: FieldValue.serverTimestamp(),
        printReadinessRevokedReason: 'proof_created',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'proof.create',
        entityId: proofRef.id,
        summary: `Confirmed exact creative brief ${creativeBriefVersion} reviewed and created private proof version ${nextVersion} bound to ${materialBindings.length} current material asset(s); no proof approval inferred and prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return nextVersion;
    });
    uploadedStoragePath = null;
    return NextResponse.json(
      { success: true, proofId: proofRef.id, version },
      { headers: responseHeaders() },
    );
  } catch (error) {
    if (uploadedStoragePath) {
      try {
        await getAdminStorage().file(uploadedStoragePath).delete({ ignoreNotFound: true });
      } catch {
        // Firestore remains authoritative; private object cleanup is best effort.
      }
    }
    if (
      error instanceof Error
      && ['unsupported-file-type', 'invalid-file-size', 'file-signature-mismatch'].includes(error.message)
    ) {
      return failure(new ProofRequestError(
        'Proof must be a genuine PNG, JPEG, or PDF no larger than 10 MB.',
        400,
      ));
    }
    return failure(error);
  }
}
