import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
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

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const access = await verifyReservationAccess(id, request.cookies.get(reservationCookieName(id))?.value);
    if (!access) return NextResponse.json({ error: 'Private reservation access required.' }, { status: 401 });
    const snapshot = await getAdminFirestore().collection('materials').where('reservationId', '==', id).get();
    return NextResponse.json({ materials: snapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, kind: data.kind, originalName: data.originalName, status: data.status, createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null }; }) });
  } catch { return NextResponse.json({ error: 'Materials are unavailable.' }, { status: 503 }); }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const rate = consumeRateLimit(requestFingerprint(request, `material:${id}`), 5, 60 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Upload limit reached.' }, { status: 429 });
  let uploadedStoragePath: string | null = null;
  try {
    const accessToken = request.cookies.get(reservationCookieName(id))?.value;
    const access = await verifyReservationAccess(id, accessToken);
    if (!access) return NextResponse.json({ error: 'Private reservation access required.' }, { status: 401 });
    if (access.data.status !== 'paid' || typeof access.data.campaignId !== 'string') return NextResponse.json({ error: 'Materials open only after provider-verified cleared payment.' }, { status: 409 });
    const form = await request.formData(); const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'Choose a logo file.' }, { status: 400 });
    const validated = await validatePrivateUpload(file, 'advertiser_logo');
    const db = getAdminFirestore();
    const materialRef = db.collection('materials').doc();
    const storagePath = `private/reservations/${id}/materials/${validated.randomName}`;
    await getAdminStorage().file(storagePath).save(validated.bytes, {
      resumable: false,
      contentType: validated.contentType,
      metadata: {
        cacheControl: 'private,no-store',
        metadata: { reservationId: id, kind: 'advertiser_logo', materialId: materialRef.id },
      },
    });
    uploadedStoragePath = storagePath;
    const version = await db.runTransaction(async (transaction) => {
      const currentAccess = await assertReservationAccessInTransaction(transaction, id, accessToken);
      const currentReservation = currentAccess.data;
      if (
        currentReservation.status !== 'paid'
        || typeof currentReservation.campaignId !== 'string'
      ) {
        throw new Error('material-reservation-unavailable');
      }
      const existing = await transaction.get(
        db.collection('materials').where('reservationId', '==', id),
      );
      const highestStoredVersion = existing.docs.reduce((highest, document) => {
        const candidate = Number(document.data().version);
        return Number.isSafeInteger(candidate) && candidate >= 0
          ? Math.max(highest, candidate)
          : highest;
      }, 0);
      const storedSequence = Number.isSafeInteger(currentReservation.materialSequence)
        && Number(currentReservation.materialSequence) >= 0
        ? Number(currentReservation.materialSequence)
        : 0;
      const nextVersion = Math.max(storedSequence, highestStoredVersion) + 1;
      transaction.create(materialRef, {
        reservationId: id,
        campaignId: currentReservation.campaignId,
        version: nextVersion,
        kind: 'advertiser_logo',
        originalName: validated.originalName,
        contentType: validated.contentType,
        sizeBytes: validated.bytes.length,
        storagePath,
        status: 'quarantine_pending_owner_review',
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
        action: 'material.upload',
        entityId: materialRef.id,
        summary: `Advertiser logo version ${nextVersion} received in private quarantine pending owner review; prior print readiness was revoked.`,
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
        originalName: validated.originalName,
        status: 'quarantine_pending_owner_review',
      },
    });
  } catch (error) {
    if (uploadedStoragePath) {
      try {
        await getAdminStorage().file(uploadedStoragePath).delete({ ignoreNotFound: true });
      } catch {
        // Database authorization remains authoritative; cleanup is best effort.
      }
    }
    if (error instanceof ReservationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === 'material-reservation-unavailable') {
      return NextResponse.json({ error: 'Materials are accepted only for a currently paid reservation.' }, { status: 409 });
    }
    const message = error instanceof Error && ['unsupported-file-type', 'invalid-file-size', 'file-signature-mismatch'].includes(error.message) ? 'File must be a genuine PNG or JPEG no larger than 5 MB.' : 'The private upload could not be stored.';
    return NextResponse.json({ error: message }, { status: message.startsWith('File') ? 400 : 503 });
  }
}
