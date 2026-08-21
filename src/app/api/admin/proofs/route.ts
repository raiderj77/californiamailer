import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { validatePrivateUpload } from '@/lib/privateUploads';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
function failure(error: unknown) { if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status }); return NextResponse.json({ error: 'Proof operation failed.' }, { status: 500 }); }

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request); const db = getAdminFirestore();
    const [reservations, proofs, materials] = await Promise.all([
      db.collection('reservations').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('proofs').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
      db.collection('materials').where('campaignId', '==', 'monterey-peninsula-founding-001').get(),
    ]);
    return NextResponse.json({
      reservations: reservations.docs.map((doc) => { const data = doc.data(); return { id: doc.id, businessName: data.businessName, categorySlug: data.categorySlug, status: data.status, materialsStatus: data.materialsStatus || 'not_received' }; }),
      proofs: proofs.docs.map((doc) => { const data = doc.data(); return { id: doc.id, reservationId: data.reservationId, businessName: data.businessName, version: data.version, status: data.status, originalName: data.originalName, revisionRequests: data.revisionRequests || [], approvedAt: data.approvedAt?.toDate?.()?.toISOString?.() || null, approvedBy: data.approvedBy || null }; }),
      materials: materials.docs.map((doc) => { const data = doc.data(); return { id: doc.id, reservationId: data.reservationId, originalName: data.originalName, kind: data.kind, status: data.status }; }),
    });
  } catch (error) { return failure(error); }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const form = await request.formData();
    const reservationId = String(form.get('reservationId') || '');
    const notes = String(form.get('notes') || '').trim().slice(0, 1000);
    const file = form.get('file');
    if (!/^[A-Za-z0-9]{10,40}$/.test(reservationId) || !(file instanceof File)) return NextResponse.json({ error: 'Select a paid reservation and proof file.' }, { status: 400 });
    const db = getAdminFirestore();
    const reservationRef = db.collection('reservations').doc(reservationId);
    const reservation = await reservationRef.get();
    const reservationData = reservation.data();
    if (!reservation.exists || reservationData?.status !== 'paid' || typeof reservationData.campaignId !== 'string') return NextResponse.json({ error: 'Proofs can be issued only for a paid reservation.' }, { status: 409 });
    const validated = await validatePrivateUpload(file, 'proof');
    const proofRef = db.collection('proofs').doc();
    const storagePath = `private/reservations/${reservationId}/proofs/${validated.randomName}`;
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
        || currentReservation?.status !== 'paid'
        || typeof currentReservation.campaignId !== 'string'
      ) {
        throw new Error('proof-reservation-unavailable');
      }
      const existing = await transaction.get(
        db.collection('proofs').where('reservationId', '==', reservationId),
      );
      const highestStoredVersion = existing.docs.reduce((highest, document) => {
        const candidate = Number(document.data().version);
        return Number.isSafeInteger(candidate) && candidate >= 0
          ? Math.max(highest, candidate)
          : highest;
      }, 0);
      const storedSequence = Number.isSafeInteger(currentReservation.proofSequence)
        && Number(currentReservation.proofSequence) >= 0
        ? Number(currentReservation.proofSequence)
        : 0;
      const nextVersion = Math.max(storedSequence, highestStoredVersion) + 1;
      const campaignRef = db.collection('campaigns').doc(currentReservation.campaignId);
      transaction.create(proofRef, {
        campaignId: currentReservation.campaignId,
        reservationId,
        businessName: currentReservation.businessName,
        version: nextVersion,
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
        summary: `Created private proof version ${nextVersion}; no approval inferred and prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return nextVersion;
    });
    return NextResponse.json({ success: true, proofId: proofRef.id, version });
  } catch (error) {
    if (error instanceof Error && ['unsupported-file-type', 'invalid-file-size', 'file-signature-mismatch'].includes(error.message)) return NextResponse.json({ error: 'Proof must be a genuine PNG, JPEG, or PDF no larger than 10 MB.' }, { status: 400 });
    if (error instanceof Error && error.message === 'proof-reservation-unavailable') return NextResponse.json({ error: 'Proofs can be issued only for a currently paid reservation.' }, { status: 409 });
    return failure(error);
  }
}
