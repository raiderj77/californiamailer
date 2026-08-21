import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import {
  hasCurrentApprovedMaterialWithRights,
  hasCurrentCreativeBrief,
} from '@/lib/businessRules';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { validatePrivateUpload } from '@/lib/privateUploads';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const MAX_MULTIPART_BYTES = 10 * 1024 * 1024 + 32_000;

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

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const [reservations, proofs, materials] = await Promise.all([
      db.collection('reservations').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('proofs').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('materials').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
    ]);
    return NextResponse.json({
      reservations: reservations.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          businessName: data.businessName,
          categorySlug: data.categorySlug,
          status: data.status,
          materialsStatus: data.materialsStatus || 'not_received',
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
        };
      }),
      materials: materials.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          reservationId: data.reservationId,
          originalName: data.originalName,
          kind: data.kind,
          status: data.status,
        };
      }),
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
    const reservationId = String(form.get('reservationId') || '');
    const notes = String(form.get('notes') || '').trim().slice(0, 1000);
    const file = form.get('file');
    if (!/^[A-Za-z0-9]{10,40}$/.test(reservationId) || !(file instanceof File)) {
      throw new ProofRequestError('Select a paid reservation and proof file.', 400);
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
      const materialId = currentReservation.latestMaterialId;
      if (
        typeof creativeBriefId !== 'string'
        || !creativeBriefId
        || typeof materialId !== 'string'
        || !materialId
      ) {
        throw new ProofRequestError(
          'A current creative brief and approved rights-attested material are required.',
          409,
        );
      }

      const campaignRef = db.collection('campaigns').doc(currentReservation.campaignId);
      const [campaignSnapshot, creativeBriefSnapshot, materialSnapshot, previousProofSnapshot] = await Promise.all([
        transaction.get(campaignRef),
        transaction.get(db.collection('creativebriefs').doc(creativeBriefId)),
        transaction.get(db.collection('materials').doc(materialId)),
        storedSequence > 0 && typeof latestProofId === 'string'
          ? transaction.get(db.collection('proofs').doc(latestProofId))
          : Promise.resolve(null),
      ]);
      const campaign = campaignSnapshot.data();
      const creativeBrief = creativeBriefSnapshot.data();
      const material = materialSnapshot.data();
      const reservationRecord = { id: reservationId, ...currentReservation };
      if (
        !campaignSnapshot.exists
        || !campaign
        || !creativeBriefSnapshot.exists
        || !creativeBrief
        || !hasCurrentCreativeBrief(
          reservationRecord,
          { id: creativeBriefSnapshot.id, ...creativeBrief },
          campaign,
        )
      ) {
        throw new ProofRequestError(
          'The current creative brief must cover the complete planned delivery window.',
          409,
        );
      }
      if (
        !materialSnapshot.exists
        || !material
        || !hasCurrentApprovedMaterialWithRights(
          reservationRecord,
          { id: materialSnapshot.id, ...material },
        )
      ) {
        throw new ProofRequestError(
          'The exact latest material must be owner approved with a complete rights attestation.',
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
      const materialVersion = Number(currentReservation.materialSequence);
      const nextVersion = storedSequence + 1;
      transaction.create(proofRef, {
        campaignId: currentReservation.campaignId,
        reservationId,
        placementSlotId: currentReservation.placementSlotId,
        businessName: currentReservation.businessName,
        version: nextVersion,
        previousProofId: storedSequence > 0 ? latestProofId : null,
        creativeBriefId,
        creativeBriefVersion,
        materialId,
        materialVersion,
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
        summary: `Created private proof version ${nextVersion} bound to creative brief ${creativeBriefVersion} and material ${materialVersion}; no approval inferred and prior print readiness was revoked.`,
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
