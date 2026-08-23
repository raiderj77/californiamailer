import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import {
  ACTIVE_REFUND_OBLIGATION_STATUSES,
  activeRefundObligationSummary,
  isActiveRefundObligationStatus,
  isKnownRefundRecordStatus,
} from '@/lib/businessRules';
import { strictPaymentRefundLedger } from '@/lib/paymentLedgerIntegrity';

const REFUND_QUERY_CHUNK_SIZE = 10;
const REFUND_EVIDENCE_SOURCE_LIMIT = 50;
const REFUND_EVIDENCE_RESULT_LIMIT = 100;

export type RefundEvidenceDocument = QueryDocumentSnapshot<DocumentData>;
export type RefundEvidenceSourceDocument = {
  id: string;
  data(): DocumentData;
};

function chunks(values: string[]): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < values.length; index += REFUND_QUERY_CHUNK_SIZE) {
    result.push(values.slice(index, index + REFUND_QUERY_CHUNK_SIZE));
  }
  return result;
}

function sourceIds(documents: RefundEvidenceSourceDocument[]): string[] {
  if (documents.length > REFUND_EVIDENCE_SOURCE_LIMIT) {
    throw new Error('refund-evidence-source-limit');
  }
  const ids = new Set<string>();
  for (const document of documents) {
    if (!document.id || document.id !== document.id.trim() || ids.has(document.id)) {
      throw new Error('refund-evidence-source-invalid');
    }
    ids.add(document.id);
  }
  return [...ids].sort();
}

export async function refundDocumentsWithLinkedEvidence(
  transaction: Transaction,
  db: Firestore,
  campaignId: string,
  paymentDocuments: RefundEvidenceSourceDocument[],
  reservationDocuments: RefundEvidenceSourceDocument[],
): Promise<RefundEvidenceDocument[]> {
  if (!campaignId || campaignId !== campaignId.trim()) {
    throw new Error('refund-evidence-campaign-invalid');
  }
  const paymentIds = sourceIds(paymentDocuments);
  const reservationIds = sourceIds(reservationDocuments);
  const querySpecs = [
    {
      field: 'status',
      operator: 'in' as const,
      values: [...ACTIVE_REFUND_OBLIGATION_STATUSES],
    },
    { field: 'campaignId', operator: '==' as const, values: campaignId },
    ...chunks(paymentIds).map((values) => ({
      field: 'paymentId',
      operator: 'in' as const,
      values,
    })),
    ...chunks(reservationIds).map((values) => ({
      field: 'reservationId',
      operator: 'in' as const,
      values,
    })),
  ];
  const snapshots = await Promise.all([
    transaction.get(
      db.collection('refunds').limit(REFUND_EVIDENCE_RESULT_LIMIT + 1),
    ),
    ...querySpecs.map(({ field, operator, values }) => (
      transaction.get(
        db.collection('refunds')
          .where(field, operator, values)
          .limit(REFUND_EVIDENCE_RESULT_LIMIT + 1),
      )
    )),
  ]);
  if (snapshots.some((snapshot) => snapshot.size > REFUND_EVIDENCE_RESULT_LIMIT)) {
    throw new Error('refund-evidence-result-limit');
  }
  const documentsById = new Map<string, RefundEvidenceDocument>();
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) documentsById.set(document.id, document);
  }
  if (documentsById.size > REFUND_EVIDENCE_RESULT_LIMIT) {
    throw new Error('refund-evidence-result-limit');
  }
  return [...documentsById.values()];
}

export function authoritativeActiveRefundObligationSummary(
  refundDocuments: RefundEvidenceSourceDocument[],
  paymentDocuments: RefundEvidenceSourceDocument[],
  reservationDocuments: RefundEvidenceSourceDocument[],
  expectedCampaignId: string,
) {
  const refunds: Array<DocumentData & { id: string }> = refundDocuments
    .map((document) => ({ id: document.id, ...document.data() }));
  const base = activeRefundObligationSummary(refunds, expectedCampaignId);
  const reservationIds = new Set(reservationDocuments.map((document) => document.id));
  const paymentReservationById = new Map(paymentDocuments.map((document) => {
    const reservationId = document.data().reservationId;
    return [
      document.id,
      typeof reservationId === 'string' && reservationId === reservationId.trim()
        ? reservationId
        : null,
    ];
  }));
  let linkedIntegrityIssueCount = 0;
  let statusIntegrityIssueCount = 0;
  for (const refund of refunds) {
    const status = refund.status;
    if (!isKnownRefundRecordStatus(status)) {
      statusIntegrityIssueCount += 1;
      continue;
    }
    if (!isActiveRefundObligationStatus(status)) continue;
    const paymentId = typeof refund.paymentId === 'string' ? refund.paymentId : '';
    const reservationId = typeof refund.reservationId === 'string' ? refund.reservationId : '';
    const baseBindingValid = refund.campaignId === expectedCampaignId
      && typeof refund.paymentId === 'string'
      && Boolean(paymentId.trim())
      && typeof refund.reservationId === 'string'
      && Boolean(reservationId.trim());
    if (!baseBindingValid) continue;
    if (paymentId !== paymentId.trim() || reservationId !== reservationId.trim()) {
      linkedIntegrityIssueCount += 1;
      continue;
    }
    if (
      !reservationIds.has(reservationId)
      || !paymentReservationById.has(paymentId)
      || paymentReservationById.get(paymentId) !== reservationId
    ) linkedIntegrityIssueCount += 1;
  }
  let ledgerIntegrityIssueCount = 0;
  try {
    strictPaymentRefundLedger(
      paymentDocuments,
      refundDocuments,
      expectedCampaignId,
    );
  } catch (error) {
    if (!(error instanceof Error) || error.message !== 'payment-refund-ledger-invalid') {
      throw error;
    }
    ledgerIntegrityIssueCount = 1;
  }
  return {
    ...base,
    integrityIssueCount: base.integrityIssueCount
      + linkedIntegrityIssueCount
      + statusIntegrityIssueCount
      + (base.integrityIssueCount + linkedIntegrityIssueCount + statusIntegrityIssueCount === 0
        ? ledgerIntegrityIssueCount
        : 0),
  };
}
