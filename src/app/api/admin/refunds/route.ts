import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), paymentId: z.string().min(5).max(150), amountCents: z.number().int().min(1).max(100_000_000), reason: z.string().trim().min(5).max(500) }).strict(),
  z.object({ action: z.literal('approve'), refundId: z.string().min(5).max(150) }).strict(),
  z.object({ action: z.literal('reject'), refundId: z.string().min(5).max(150), note: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal('mark_submitted'), refundId: z.string().min(5).max(150), providerReference: z.string().trim().min(5).max(200) }).strict(),
]);

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: 'Refund operation failed.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const [payments, reservations, refunds] = await Promise.all([
      db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
      db.collection('refunds').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    ]);
    const reservationMap = new Map(reservations.docs.map((doc) => [doc.id, doc.data()]));
    const refundRows = refunds.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        paymentId: data.paymentId,
        reservationId: data.reservationId,
        businessName: data.businessName,
        amountCents: Number(data.amountCents || 0),
        reason: data.reason,
        status: data.status,
        reviewNote: data.reviewNote || null,
        providerReference: data.providerReference || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const outstandingByPayment = refundRows.filter((row) => ['requested', 'approved', 'submitted'].includes(row.status))
      .reduce<Record<string, number>>((totals, row) => ({ ...totals, [row.paymentId]: (totals[row.paymentId] || 0) + row.amountCents }), {});
    const paymentRows = payments.docs.filter((doc) => ['cleared', 'partially_refunded'].includes(String(doc.data().status))).map((doc) => {
      const data = doc.data(); const reservation = reservationMap.get(String(data.reservationId));
      const netPaidCents = Math.max(0, Number(data.amountCents || 0) - Number(data.refundedCents || 0));
      return {
        id: doc.id,
        reservationId: data.reservationId,
        businessName: reservation?.businessName || 'Unknown reservation',
        publicReference: reservation?.publicReference || null,
        status: data.status,
        amountCents: Number(data.amountCents || 0),
        refundedCents: Number(data.refundedCents || 0),
        netPaidCents,
        availableToRequestCents: Math.max(0, netPaidCents - Number(outstandingByPayment[doc.id] || 0)),
      };
    });
    return NextResponse.json({ payments: paymentRows, refunds: refundRows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid refund action.' }, { status: 400 });
    const db = getAdminFirestore();
    const campaignRef = db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id);

    if (parsed.data.action === 'request') {
      const refundRequest = parsed.data;
      const paymentRef = db.collection('payments').doc(refundRequest.paymentId);
      const reservationId = await db.runTransaction(async (transaction) => {
        const payment = await transaction.get(paymentRef); const data = payment.data();
        if (!data || data.campaignId !== FOUNDING_CAMPAIGN.id || !['cleared', 'partially_refunded'].includes(String(data.status))) throw new Error('payment-not-eligible');
        const existing = await transaction.get(db.collection('refunds').where('paymentId', '==', paymentRef.id));
        const outstanding = existing.docs.filter((doc) => ['requested', 'approved', 'submitted'].includes(String(doc.data().status)))
          .reduce((total, doc) => total + Number(doc.data().amountCents || 0), 0);
        const available = Math.max(0, Number(data.amountCents || 0) - Number(data.refundedCents || 0) - outstanding);
        if (refundRequest.amountCents > available) throw new Error('amount-exceeds-net');
        const reservationRef = db.collection('reservations').doc(String(data.reservationId));
        const reservation = await transaction.get(reservationRef);
        const refundRef = db.collection('refunds').doc(); const auditRef = db.collection('auditlog').doc();
        transaction.create(refundRef, {
          campaignId: FOUNDING_CAMPAIGN.id,
          paymentId: paymentRef.id,
          reservationId: data.reservationId,
          businessName: reservation.data()?.businessName || 'Unknown reservation',
          amountCents: refundRequest.amountCents,
          reason: refundRequest.reason,
          status: 'requested',
          requestedBy: owner.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(campaignRef, { ownerPrintApproved: false, printReadyAt: null, printReadinessRevokedAt: FieldValue.serverTimestamp(), printReadinessRevokedReason: 'refund_requested', updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.request', entityId: refundRef.id, summary: 'Recorded a refund obligation and revoked prior print readiness; no provider action occurred.', createdAt: FieldValue.serverTimestamp() });
        return String(data.reservationId);
      });
      return NextResponse.json({ success: true, reservationId, status: 'requested' });
    }

    const reviewAction = parsed.data;
    const refundRef = db.collection('refunds').doc(reviewAction.refundId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(refundRef);
      const refund = snapshot.data();
      if (!refund || refund.campaignId !== FOUNDING_CAMPAIGN.id) throw new Error('refund-not-found');
      const auditRef = db.collection('auditlog').doc();
      if (reviewAction.action === 'approve') {
        if (refund.status !== 'requested') throw new Error('refund-not-requested');
        transaction.update(refundRef, { status: 'approved', approvedBy: owner.uid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.approve', entityId: refundRef.id, summary: 'Approved the recorded refund obligation and revoked prior print readiness; no provider API was called.', createdAt: FieldValue.serverTimestamp() });
      } else if (reviewAction.action === 'reject') {
        if (!['requested', 'approved'].includes(String(refund.status))) throw new Error('refund-not-rejectable');
        transaction.update(refundRef, { status: 'rejected', reviewNote: reviewAction.note, rejectedBy: owner.uid, rejectedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.reject', entityId: refundRef.id, summary: 'Rejected a refund request, recorded the owner note, and revoked prior print readiness; no provider API was called.', createdAt: FieldValue.serverTimestamp() });
      } else {
        if (refund.status !== 'approved') throw new Error('refund-not-approved');
        transaction.update(refundRef, { status: 'submitted', providerReference: reviewAction.providerReference, submittedBy: owner.uid, submittedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.mark_submitted', entityId: refundRef.id, summary: 'Owner recorded an external provider refund reference and revoked prior print readiness; the app did not call the provider.', createdAt: FieldValue.serverTimestamp() });
      }
      transaction.update(campaignRef, { ownerPrintApproved: false, printReadyAt: null, printReadinessRevokedAt: FieldValue.serverTimestamp(), printReadinessRevokedReason: `refund_${reviewAction.action}`, updatedAt: FieldValue.serverTimestamp() });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : '';
    if (code === 'refund-not-found') return NextResponse.json({ error: 'Refund record not found.' }, { status: 404 });
    const conflicts: Record<string, string> = {
      'payment-not-eligible': 'Payment is not eligible for a refund request.',
      'amount-exceeds-net': 'Requested amount exceeds cleared net funds after open obligations.',
      'refund-not-requested': 'Only a requested refund can be approved.',
      'refund-not-rejectable': 'This refund can no longer be rejected in the app.',
      'refund-not-approved': 'Approve the refund before recording provider submission.',
    };
    return conflicts[code]
      ? NextResponse.json({ error: conflicts[code] }, { status: 409 })
      : errorResponse(error);
  }
}
