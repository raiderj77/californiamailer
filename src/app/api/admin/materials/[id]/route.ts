import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const schema = z.object({ action: z.enum(['approve', 'reject']) }).strict();
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    const { id } = await params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid material review.' }, { status: 400 });
    const db = getAdminFirestore();
    const ref = db.collection('materials').doc(id);
    const status = parsed.data.action === 'approve' ? 'owner_approved_private' : 'rejected';
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { success: false as const, reason: 'missing' as const };
      const material = snapshot.data()!;
      if (typeof material.campaignId !== 'string' || typeof material.reservationId !== 'string') {
        return { success: false as const, reason: 'invalid' as const };
      }
      const reservationRef = db.collection('reservations').doc(material.reservationId);
      const reservationSnapshot = await transaction.get(reservationRef);
      const reservation = reservationSnapshot.data();
      const sequenceMismatch = Number.isSafeInteger(reservation?.materialSequence)
        && Number(reservation?.materialSequence) !== Number(material.version);
      if (
        !reservation
        || reservation.campaignId !== material.campaignId
        || reservation.latestMaterialId !== ref.id
        || sequenceMismatch
      ) {
        return { success: false as const, reason: 'stale' as const };
      }
      if (material.status !== 'quarantine_pending_owner_review') {
        return { success: false as const, reason: 'decided' as const };
      }
      transaction.update(ref, {
        status,
        reviewedBy: owner.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        materialsStatus: status === 'owner_approved_private' ? 'approved' : 'rejected',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(db.collection('campaigns').doc(material.campaignId), {
        ownerPrintApproved: false,
        printReadyAt: null,
        artworkPreflightApproved: false,
        printReadinessRevokedAt: FieldValue.serverTimestamp(),
        printReadinessRevokedReason: `material_${parsed.data.action}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: `material.${parsed.data.action}`,
        entityId: id,
        summary: `Exact latest private material version ${Number(material.version || 0)} marked ${status}; not made public. Prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true as const };
    });
    if (!result.success) {
      if (result.reason === 'missing') return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
      const message = result.reason === 'stale'
        ? 'Only the exact latest material can be reviewed.'
        : result.reason === 'decided'
          ? 'This material review has already been recorded.'
          : 'Material campaign is unavailable.';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? 'Material review failed.' : (error as Error).message }, { status });
  }
}
