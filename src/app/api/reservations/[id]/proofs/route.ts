import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { campaignCreativeInputsLocked } from '@/lib/campaignLifecycle';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';
import {
  ReservationAccessError,
  assertReservationAccessInTransaction,
  reservationCookieName,
  verifyReservationAccess,
} from '@/lib/reservationAuth';

const decisionSchema = z.object({ proofId: z.string().min(10).max(40), action: z.enum(['approve', 'request_revision']), approverName: z.string().trim().min(2).max(100), revisionRequest: z.string().trim().max(1000).default('') }).strict();

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const access = await verifyReservationAccess(id, request.cookies.get(reservationCookieName(id))?.value);
    if (!access) return NextResponse.json({ error: 'Private reservation access required.' }, { status: 401 });
    const snapshot = await getAdminFirestore().collection('proofs').where('reservationId', '==', id).get();
    const proofs = snapshot.docs.map((doc) => { const data = doc.data(); return { id: doc.id, version: Number(data.version), status: String(data.status), originalName: String(data.originalName), ownerNotes: String(data.ownerNotes || ''), revisionRequests: data.revisionRequests || [], approvedAt: data.approvedAt?.toDate?.()?.toISOString?.() || null, approvedBy: data.approvedBy || null, fileUrl: `/api/reservations/${id}/proofs/${doc.id}/file` }; }).sort((a, b) => b.version - a.version);
    return NextResponse.json({ proofs });
  } catch { return NextResponse.json({ error: 'Proofs are unavailable.' }, { status: 503 }); }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  const rate = consumeRateLimit(requestFingerprint(request, `proof-decision:${id}`), 10, 60 * 60_000);
  if (!rate.allowed) return NextResponse.json({ error: 'Decision limit reached.' }, { status: 429 });
  try {
    const accessToken = request.cookies.get(reservationCookieName(id))?.value;
    const access = await verifyReservationAccess(id, accessToken);
    if (!access) return NextResponse.json({ error: 'Private reservation access required.' }, { status: 401 });
    if (access.data.status !== 'paid') return NextResponse.json({ error: 'Proof decisions open only for a currently paid reservation.' }, { status: 409 });
    const parsed = decisionSchema.safeParse(await request.json().catch(() => null)); if (!parsed.success) return NextResponse.json({ error: 'Review the proof decision.' }, { status: 400 });
    if (parsed.data.action === 'request_revision' && parsed.data.revisionRequest.length < 3) return NextResponse.json({ error: 'Describe the requested revision.' }, { status: 400 });
    const db = getAdminFirestore(); const proofRef = db.collection('proofs').doc(parsed.data.proofId); const approvalRef = db.collection('proofapprovals').doc(parsed.data.proofId); const auditRef = db.collection('auditlog').doc(); const status = parsed.data.action === 'approve' ? 'approved' : 'revision_requested';
    await db.runTransaction(async (transaction) => {
      const [currentAccess, proof, existingDecision] = await Promise.all([
        assertReservationAccessInTransaction(transaction, id, accessToken),
        transaction.get(proofRef),
        transaction.get(approvalRef),
      ]);
      const reservation = currentAccess.data; const data = proof.data();
      if (reservation.status !== 'paid') throw new Error('proof-reservation-unavailable');
      if (!reservation || typeof reservation.campaignId !== 'string' || !proof.exists || data?.reservationId !== id || reservation.latestProofId !== proof.id) throw new Error('stale-proof');
      const campaignSnapshot = await transaction.get(
        db.collection('campaigns').doc(reservation.campaignId),
      );
      if (!campaignSnapshot.exists || campaignCreativeInputsLocked(campaignSnapshot.data()?.status)) {
        throw new Error('proof-creative-locked');
      }
      if (existingDecision.exists || ['approved', 'revision_requested', 'locked_for_print'].includes(String(data.status))) throw new Error('already-decided');
      transaction.update(proofRef, { status, ...(status === 'approved' ? { approvedAt: FieldValue.serverTimestamp(), approvedBy: parsed.data.approverName } : { revisionRequests: FieldValue.arrayUnion({ text: parsed.data.revisionRequest, requestedBy: parsed.data.approverName, requestedAt: new Date().toISOString() }) }), updatedAt: FieldValue.serverTimestamp() });
      transaction.update(currentAccess.ref, { proofStatus: status, updatedAt: FieldValue.serverTimestamp() });
      transaction.update(db.collection('campaigns').doc(reservation.campaignId), { ownerPrintApproved: false, printReadyAt: null, artworkPreflightApproved: false, printReadinessRevokedAt: FieldValue.serverTimestamp(), printReadinessRevokedReason: `proof_${parsed.data.action}`, updatedAt: FieldValue.serverTimestamp() });
      transaction.create(approvalRef, { campaignId: reservation.campaignId, reservationId: id, proofId: proof.id, version: data.version, decision: parsed.data.action, approverName: parsed.data.approverName, revisionRequest: parsed.data.revisionRequest || null, createdAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { action: `proof.${parsed.data.action}`, entityId: proof.id, summary: `Advertiser recorded ${parsed.data.action} for exact proof version ${data.version}; prior print readiness was revoked.`, createdAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true, status });
  } catch (error) {
    if (error instanceof ReservationAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof Error && error.message === 'proof-reservation-unavailable') {
      return NextResponse.json({ error: 'Proof decisions are accepted only for a currently paid reservation.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'proof-creative-locked') {
      return NextResponse.json({
        error: 'Creative inputs are locked because this campaign has already been recorded as printed.',
      }, { status: 409 });
    }
    const conflict = error instanceof Error && ['stale-proof', 'already-decided'].includes(error.message);
    return NextResponse.json({ error: conflict ? 'Only the undecided latest proof can be decided.' : 'Proof decision could not be recorded.' }, { status: conflict ? 409 : 503 });
  }
}
