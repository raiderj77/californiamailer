import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import {
  isActiveRefundObligationStatus,
  isKnownRefundRecordStatus,
} from '@/lib/businessRules';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  isMandatoryRefundRecord,
  strictPaymentRefundLedger,
} from '@/lib/paymentLedgerIntegrity';
import {
  authoritativeActiveRefundObligationSummary,
  refundDocumentsWithLinkedEvidence,
} from '@/lib/refundEvidence';
import {
  isExactOwnerRefundRequestReplay,
  OWNER_REFUND_REQUEST_ID_MAX_LENGTH,
  OWNER_REFUND_REQUEST_ID_MIN_LENGTH,
  OWNER_REFUND_REQUEST_ID_PATTERN,
  ownerRefundRequestDocumentId,
} from '@/lib/refundRequestIdempotency';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const actionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('request'),
    paymentId: z.string().min(5).max(150).regex(/^[A-Za-z0-9_-]+$/),
    requestId: z.string()
      .min(OWNER_REFUND_REQUEST_ID_MIN_LENGTH)
      .max(OWNER_REFUND_REQUEST_ID_MAX_LENGTH)
      .regex(OWNER_REFUND_REQUEST_ID_PATTERN),
    amountCents: z.number().int().min(1).max(100_000_000),
    reason: z.string().trim().min(5).max(500),
  }).strict(),
  z.object({ action: z.literal('approve'), refundId: z.string().min(5).max(150).regex(/^[A-Za-z0-9_-]+$/) }).strict(),
  z.object({ action: z.literal('reject'), refundId: z.string().min(5).max(150).regex(/^[A-Za-z0-9_-]+$/), note: z.string().trim().min(3).max(500) }).strict(),
  z.object({ action: z.literal('mark_submitted'), refundId: z.string().min(5).max(150).regex(/^[A-Za-z0-9_-]+$/), providerReference: z.string().trim().min(5).max(200) }).strict(),
]);

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: 'Refund operation failed.' }, { status: 500 });
}

function isRequiredFullRefund(data: Record<string, unknown>): boolean {
  return isMandatoryRefundRecord(data);
}

function requiredLinkedDocumentId(value: unknown): string {
  if (
    typeof value !== 'string'
    || !value
    || value !== value.trim()
    || value.length > 150
    || !/^[A-Za-z0-9_-]+$/.test(value)
  ) throw new Error('refund-binding-invalid');
  return value;
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const { payments, reservations, refunds, campaign } = await db.runTransaction(
      async (transaction) => {
        const [payments, reservations, campaign] = await Promise.all([
          transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id)),
        ]);
        const refunds = await refundDocumentsWithLinkedEvidence(
          transaction,
          db,
          FOUNDING_CAMPAIGN.id,
          payments.docs,
          reservations.docs,
        );
        return { payments, reservations, refunds, campaign };
      },
    );
    const cancellationRefundLock = ['refunding', 'cancelled'].includes(String(campaign.data()?.status));
    const reservationMap = new Map(reservations.docs.map((doc) => [doc.id, doc.data()]));
    const paymentReservationMap = new Map(payments.docs.map((doc) => [
      doc.id,
      typeof doc.data().reservationId === 'string' ? doc.data().reservationId : null,
    ]));
    const refundIntegrity = authoritativeActiveRefundObligationSummary(
      refunds,
      payments.docs,
      reservations.docs,
      FOUNDING_CAMPAIGN.id,
    );
    let strictLedger: ReturnType<typeof strictPaymentRefundLedger> | null = null;
    try {
      strictLedger = strictPaymentRefundLedger(payments.docs, refunds, FOUNDING_CAMPAIGN.id);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== 'payment-refund-ledger-invalid') throw error;
    }
    const refundRows = refunds.map((doc) => {
      const data = doc.data();
      const requiredFullRefund = isRequiredFullRefund(data);
      const status = String(data.status);
      const active = isActiveRefundObligationStatus(data.status);
      const knownStatus = isKnownRefundRecordStatus(data.status);
      const paymentId = typeof data.paymentId === 'string' ? data.paymentId : '';
      const reservationId = typeof data.reservationId === 'string' ? data.reservationId : '';
      const amountCents = Number.isSafeInteger(data.amountCents) && Number(data.amountCents) >= 0
        ? Number(data.amountCents)
        : null;
      const integrityIssue = data.campaignId !== FOUNDING_CAMPAIGN.id
        || strictLedger === null
        || !knownStatus
        || !paymentId
        || paymentId !== paymentId.trim()
        || !reservationId
        || reservationId !== reservationId.trim()
        || paymentReservationMap.get(paymentId) !== reservationId
        || !reservationMap.has(reservationId)
        || amountCents === null
        || (active && amountCents <= 0)
        || (status === 'covered' && amountCents !== 0);
      return {
        id: doc.id,
        paymentId,
        reservationId,
        businessName: data.businessName,
        amountCents,
        reason: data.reason,
        status,
        source: data.source || null,
        requiredFullRefund,
        integrityIssue,
        ownerRejectable: !requiredFullRefund
          && data.ownerRejectable !== false
          && !cancellationRefundLock
          && !integrityIssue,
        reviewNote: data.reviewNote || null,
        providerReference: data.providerReference || null,
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
        updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
      };
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const paymentRows = (strictLedger?.payments || [])
      .filter((payment) => ['cleared', 'partially_refunded'].includes(payment.status))
      .map((payment) => {
        const reservation = reservationMap.get(payment.reservationId);
        return {
          id: payment.id,
          reservationId: payment.reservationId,
          businessName: reservation?.businessName || 'Unknown reservation',
          publicReference: reservation?.publicReference || null,
          status: payment.status,
          amountCents: payment.amountCents,
          refundedCents: payment.refundedCents,
          netPaidCents: payment.netCents,
          availableToRequestCents: payment.netCents
            - (strictLedger?.activeRefundCentsByPayment.get(payment.id) || 0),
        };
      });
    return NextResponse.json({
      payments: paymentRows,
      refunds: refundRows,
      ledgerIntegrity: {
        valid: strictLedger !== null && refundIntegrity.integrityIssueCount === 0,
        activeIssueCount: refundIntegrity.integrityIssueCount,
      },
    });
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
      const refundId = ownerRefundRequestDocumentId({
        ownerUid: owner.uid,
        paymentId: paymentRef.id,
        requestId: refundRequest.requestId,
      });
      const refundRef = db.collection('refunds').doc(refundId);
      const result = await db.runTransaction(async (transaction) => {
        const payment = await transaction.get(paymentRef);
        const data = payment.data();
        if (!data || data.campaignId !== FOUNDING_CAMPAIGN.id) {
          throw new Error('payment-not-eligible');
        }
        const paymentReservationId = requiredLinkedDocumentId(data.reservationId);
        const reservationRef = db.collection('reservations').doc(paymentReservationId);
        const [existingRefund, reservation, campaignPayments, campaignReservations] = await Promise.all([
          transaction.get(refundRef),
          transaction.get(reservationRef),
          transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        ]);
        const refundEvidence = await refundDocumentsWithLinkedEvidence(
          transaction,
          db,
          FOUNDING_CAMPAIGN.id,
          campaignPayments.docs,
          campaignReservations.docs,
        );
        const ledger = strictPaymentRefundLedger(
          campaignPayments.docs,
          refundEvidence,
          FOUNDING_CAMPAIGN.id,
        );
        const strictPayment = ledger.paymentsById.get(paymentRef.id);
        const reservationData = reservation.data();
        if (
          !strictPayment
          || strictPayment.reservationId !== paymentReservationId
          || strictPayment.data.campaignId !== FOUNDING_CAMPAIGN.id
          || strictPayment.data.reservationId !== paymentReservationId
          || !reservationData
          || reservationData.campaignId !== FOUNDING_CAMPAIGN.id
          || !campaignReservations.docs.some((document) => document.id === reservationRef.id)
        ) throw new Error('refund-binding-invalid');
        const expectedReplay = {
          campaignId: FOUNDING_CAMPAIGN.id,
          ownerUid: owner.uid,
          paymentId: paymentRef.id,
          reservationId: reservationRef.id,
          requestId: refundRequest.requestId,
          amountCents: refundRequest.amountCents,
          reason: refundRequest.reason,
        };
        if (existingRefund.exists) {
          if (!isExactOwnerRefundRequestReplay(existingRefund.data(), expectedReplay)) {
            throw new Error('refund-request-id-conflict');
          }
          return { refundId: refundRef.id, reservationId: reservationRef.id };
        }
        if (!['cleared', 'partially_refunded'].includes(strictPayment.status)) {
          throw new Error('payment-not-eligible');
        }
        const outstanding = ledger.activeRefundCentsByPayment.get(paymentRef.id) || 0;
        const available = strictPayment.netCents - outstanding;
        if (refundRequest.amountCents > available) throw new Error('amount-exceeds-net');
        const auditRef = db.collection('auditlog').doc();
        transaction.create(refundRef, {
          campaignId: FOUNDING_CAMPAIGN.id,
          paymentId: paymentRef.id,
          reservationId: reservationRef.id,
          businessName: reservationData.businessName || 'Unknown reservation',
          amountCents: refundRequest.amountCents,
          reason: refundRequest.reason,
          status: 'requested',
          source: 'owner_request',
          requiredFullRefund: false,
          ownerRejectable: true,
          requestedBy: owner.uid,
          requestId: refundRequest.requestId,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(campaignRef, { ownerPrintApproved: false, printReadyAt: null, printReadinessRevokedAt: FieldValue.serverTimestamp(), printReadinessRevokedReason: 'refund_requested', updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.request', entityId: refundRef.id, summary: 'Recorded a refund obligation and revoked prior print readiness; no provider action occurred.', createdAt: FieldValue.serverTimestamp() });
        return { refundId: refundRef.id, reservationId: reservationRef.id };
      });
      return NextResponse.json({ success: true, ...result, status: 'requested' });
    }

    const reviewAction = parsed.data;
    const refundRef = db.collection('refunds').doc(reviewAction.refundId);
    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(refundRef);
      const refund = snapshot.data();
      if (!refund) throw new Error('refund-not-found');
      if (refund.campaignId !== FOUNDING_CAMPAIGN.id) throw new Error('refund-binding-invalid');
      const linkedPaymentId = requiredLinkedDocumentId(refund.paymentId);
      const linkedReservationId = requiredLinkedDocumentId(refund.reservationId);
      const linkedPaymentRef = db.collection('payments').doc(linkedPaymentId);
      const linkedReservationRef = db.collection('reservations').doc(linkedReservationId);
      const [
        linkedPaymentSnapshot,
        linkedReservationSnapshot,
        campaignPayments,
        campaignReservations,
      ] = await Promise.all([
        transaction.get(linkedPaymentRef),
        transaction.get(linkedReservationRef),
        transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
      ]);
      const refundEvidence = await refundDocumentsWithLinkedEvidence(
        transaction,
        db,
        FOUNDING_CAMPAIGN.id,
        campaignPayments.docs,
        campaignReservations.docs,
      );
      const ledger = strictPaymentRefundLedger(
        campaignPayments.docs,
        refundEvidence,
        FOUNDING_CAMPAIGN.id,
      );
      const linkedPayment = ledger.paymentsById.get(linkedPaymentId);
      const linkedPaymentData = linkedPaymentSnapshot.data();
      const linkedReservationData = linkedReservationSnapshot.data();
      if (
        !linkedPayment
        || linkedPayment.reservationId !== linkedReservationId
        || !linkedPaymentData
        || linkedPaymentData.campaignId !== FOUNDING_CAMPAIGN.id
        || linkedPaymentData.reservationId !== linkedReservationId
        || !linkedReservationData
        || linkedReservationData.campaignId !== FOUNDING_CAMPAIGN.id
        || !campaignReservations.docs.some((document) => document.id === linkedReservationId)
      ) throw new Error('refund-binding-invalid');
      const auditRef = db.collection('auditlog').doc();
      if (reviewAction.action === 'approve') {
        if (refund.status !== 'requested') throw new Error('refund-not-requested');
        transaction.update(refundRef, { status: 'approved', approvedBy: owner.uid, approvedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'refund.approve', entityId: refundRef.id, summary: 'Approved the recorded refund obligation and revoked prior print readiness; no provider API was called.', createdAt: FieldValue.serverTimestamp() });
      } else if (reviewAction.action === 'reject') {
        if (!['requested', 'approved'].includes(String(refund.status))) throw new Error('refund-not-rejectable');
        if (isRequiredFullRefund(refund)) throw new Error('required-refund-not-rejectable');
        const mandatoryRefundId = `${FOUNDING_CAMPAIGN.id}__late_payment__${String(refund.reservationId)}`;
        const mandatoryRefundRef = db.collection('refunds').doc(mandatoryRefundId);
        const [paymentRefundsSnapshot, mandatoryRefundSnapshot, campaignSnapshot] = await Promise.all([
          transaction.get(db.collection('refunds').where('paymentId', '==', linkedPaymentId)),
          transaction.get(mandatoryRefundRef),
          transaction.get(campaignRef),
        ]);
        if (['refunding', 'cancelled'].includes(String(campaignSnapshot.data()?.status))) {
          throw new Error('cancellation-refund-not-rejectable');
        }
        const payment = linkedPaymentSnapshot.data();
        const mandatoryRefund = mandatoryRefundSnapshot.data();
        if (mandatoryRefund && isRequiredFullRefund(mandatoryRefund)) {
          if (
            !payment
            || mandatoryRefund.paymentId !== linkedPaymentSnapshot.id
            || mandatoryRefund.reservationId !== refund.reservationId
          ) throw new Error('required-refund-coverage-mismatch');
          const originalAmountCents = Number(payment.amountCents);
          const providerRefundedCents = Number(payment.refundedCents || 0);
          const netRefundableCents = originalAmountCents - providerRefundedCents;
          let coveredByOtherObligationsCents = 0;
          for (const document of paymentRefundsSnapshot.docs) {
            if (
              document.id === mandatoryRefundId
              || document.id === refundRef.id
              || !['requested', 'approved', 'submitted'].includes(String(document.data().status))
            ) continue;
            const amountCents = Number(document.data().amountCents);
            if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
              throw new Error('required-refund-coverage-mismatch');
            }
            coveredByOtherObligationsCents += amountCents;
            if (!Number.isSafeInteger(coveredByOtherObligationsCents)) {
              throw new Error('required-refund-coverage-mismatch');
            }
          }
          if (
            !Number.isSafeInteger(originalAmountCents)
            || originalAmountCents <= 0
            || !Number.isSafeInteger(providerRefundedCents)
            || providerRefundedCents < 0
            || providerRefundedCents > originalAmountCents
            || !Number.isSafeInteger(coveredByOtherObligationsCents)
            || coveredByOtherObligationsCents < 0
            || coveredByOtherObligationsCents > netRefundableCents
          ) throw new Error('required-refund-coverage-mismatch');
          const mandatoryAmountCents = netRefundableCents - coveredByOtherObligationsCents;
          transaction.update(mandatoryRefundRef, {
            status: netRefundableCents === 0
              ? 'confirmed'
              : mandatoryAmountCents === 0
                ? 'covered'
                : 'requested',
            amountCents: mandatoryAmountCents,
            originalAmountCents,
            providerRefundedCents,
            coveredByOtherObligationsCents,
            coverageReopenedAt: mandatoryAmountCents > Number(mandatoryRefund.amountCents || 0)
              ? FieldValue.serverTimestamp()
              : mandatoryRefund.coverageReopenedAt || null,
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.create(db.collection('auditlog').doc(), {
            actorUid: owner.uid,
            action: 'refund.required_coverage_reconcile',
            entityId: mandatoryRefundId,
            summary: 'Recomputed the mandatory captured-payment refund balance after rejecting a separate owner obligation; no provider action occurred.',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
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
      'payment-refund-ledger-invalid': 'Payment or refund ledger records are inconsistent; no refund obligation was created.',
      'amount-exceeds-net': 'Requested amount exceeds cleared net funds after open obligations.',
      'refund-binding-invalid': 'The refund, payment, or exact reservation binding is missing or inconsistent; no local obligation was changed.',
      'refund-request-id-conflict': 'This refund request ID was already used with different request details.',
      'refund-request-id-invalid': 'The refund request ID is invalid.',
      'refund-not-requested': 'Only a requested refund can be approved.',
      'refund-not-rejectable': 'This refund can no longer be rejected in the app.',
      'required-refund-not-rejectable': 'A mandatory refund obligation cannot be rejected locally and remains open until a signed provider webhook confirms the refund.',
      'required-refund-coverage-mismatch': 'Refund coverage records are inconsistent; no local obligation was changed.',
      'cancellation-refund-not-rejectable': 'Refund coverage accepted during campaign cancellation cannot be rejected locally.',
      'refund-not-approved': 'Approve the refund before recording provider submission.',
    };
    return conflicts[code]
      ? NextResponse.json({ error: conflicts[code] }, { status: 409 })
      : errorResponse(error);
  }
}
