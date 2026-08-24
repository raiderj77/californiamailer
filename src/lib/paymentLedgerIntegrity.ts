import {
  activeRefundObligationSummary,
  isActiveRefundObligationStatus,
  isKnownRefundRecordStatus,
} from '@/lib/businessRules';

const PAYMENT_STATUSES = new Set([
  'pending',
  'cleared',
  'failed',
  'cancelled',
  'partially_refunded',
  'refunded',
  'disputed',
  'manual_review',
]);

const ACTIVE_REFUND_PAYMENT_STATUSES = new Set([
  'cleared',
  'partially_refunded',
  'disputed',
  'manual_review',
]);

const AGGREGATE_REFUND_SOURCES = new Set([
  'captured_manual_review_webhook',
  'late_payment_webhook',
]);

const MANDATORY_REFUND_SOURCES = new Set([
  ...AGGREGATE_REFUND_SOURCES,
  'campaign_cancellation',
]);

export interface PaymentLedgerDocument {
  id: string;
  data(): Record<string, unknown> | undefined;
}

export interface StrictPaymentLedgerEntry {
  id: string;
  data: Record<string, unknown>;
  reservationId: string;
  status: string;
  amountCents: number;
  refundedCents: number;
  netCents: number;
}

export interface StrictPaymentRefundLedger {
  payments: StrictPaymentLedgerEntry[];
  paymentsById: Map<string, StrictPaymentLedgerEntry>;
  activeRefundCentsByPayment: Map<string, number>;
  activeRefundCount: number;
  activeRefundCents: number;
  clearedNetCents: number;
}

interface StrictRefundLedgerEntry {
  id: string;
  data: Record<string, unknown>;
  paymentId: string;
  reservationId: string;
  status: string;
  amountCents: number;
  aggregate: boolean;
  mandatory: boolean;
  hasBalanceEvidence: boolean;
  originalAmountCents: number | null;
  providerRefundedCents: number | null;
  coveredByOtherObligationsCents: number | null;
}

function ledgerIntegrityError(): never {
  throw new Error('payment-refund-ledger-invalid');
}

function requiredString(value: unknown): string {
  if (typeof value !== 'string') ledgerIntegrityError();
  const trimmed = value.trim();
  if (!trimmed || value !== trimmed) ledgerIntegrityError();
  return trimmed;
}

function safeAdd(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) ledgerIntegrityError();
  return total;
}

function hasOwn(data: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(data, key);
}

function optionalSafeWholeCents(
  data: Record<string, unknown>,
  key: string,
): number | null {
  if (!hasOwn(data, key)) return null;
  const value = data[key];
  if (!Number.isSafeInteger(value) || Number(value) < 0) ledgerIntegrityError();
  return Number(value);
}

function isAggregateRefundRecord(data: Record<string, unknown>): boolean {
  return typeof data.source === 'string' && AGGREGATE_REFUND_SOURCES.has(data.source);
}

export function isMandatoryRefundRecord(data: Record<string, unknown>): boolean {
  return data.requiredFullRefund === true
    || (typeof data.source === 'string' && MANDATORY_REFUND_SOURCES.has(data.source));
}

function validatePaymentStatusAmounts(
  status: string,
  amountCents: number,
  refundedCents: number,
): void {
  if (status === 'cleared' && refundedCents !== 0) ledgerIntegrityError();
  if (
    status === 'partially_refunded'
    && (refundedCents <= 0 || refundedCents >= amountCents)
  ) ledgerIntegrityError();
  if (status === 'refunded' && refundedCents !== amountCents) ledgerIntegrityError();
  if (refundedCents === amountCents && status !== 'refunded') ledgerIntegrityError();
  if (
    ['pending', 'failed', 'cancelled'].includes(status)
    && refundedCents !== 0
  ) ledgerIntegrityError();
}

function validateRefundBalanceEvidence(
  payment: StrictPaymentLedgerEntry,
  entries: StrictRefundLedgerEntry[],
): void {
  const aggregateEntries = entries.filter((entry) => entry.aggregate);
  if (aggregateEntries.length > 1) ledgerIntegrityError();

  let allocatedProviderRefundCents = 0;
  let hasConfirmedNonAggregate = false;
  for (const entry of entries) {
    if (entry.aggregate) continue;
    if (entry.hasBalanceEvidence) {
      if (
        entry.originalAmountCents === null
        || entry.originalAmountCents <= 0
        || entry.providerRefundedCents === null
        || entry.providerRefundedCents > entry.originalAmountCents
        || (entry.coveredByOtherObligationsCents !== null
          && entry.coveredByOtherObligationsCents !== 0)
        || entry.amountCents
          !== entry.originalAmountCents - entry.providerRefundedCents
      ) ledgerIntegrityError();
      allocatedProviderRefundCents = safeAdd(
        allocatedProviderRefundCents,
        entry.providerRefundedCents,
      );
    }
    if (entry.status === 'confirmed') hasConfirmedNonAggregate = true;
  }
  if (allocatedProviderRefundCents > payment.refundedCents) ledgerIntegrityError();

  const aggregate = aggregateEntries[0];
  if (aggregate) {
    if (
      !aggregate.mandatory
      || !aggregate.hasBalanceEvidence
      || aggregate.originalAmountCents !== payment.amountCents
      || aggregate.providerRefundedCents !== payment.refundedCents
      || aggregate.coveredByOtherObligationsCents === null
    ) ledgerIntegrityError();
    let activeSiblingCoverageCents = 0;
    for (const sibling of entries) {
      if (sibling.id === aggregate.id || !isActiveRefundObligationStatus(sibling.status)) {
        continue;
      }
      activeSiblingCoverageCents = safeAdd(activeSiblingCoverageCents, sibling.amountCents);
    }
    if (aggregate.coveredByOtherObligationsCents !== activeSiblingCoverageCents) {
      ledgerIntegrityError();
    }
    const expectedAmountCents = payment.amountCents
      - payment.refundedCents
      - activeSiblingCoverageCents;
    if (expectedAmountCents < 0 || aggregate.amountCents !== expectedAmountCents) {
      ledgerIntegrityError();
    }
    if (
      aggregate.status === 'covered'
      && (activeSiblingCoverageCents <= 0 || payment.refundedCents >= payment.amountCents)
    ) ledgerIntegrityError();
    if (
      aggregate.status === 'confirmed'
      && (
        payment.status !== 'refunded'
        || payment.refundedCents !== payment.amountCents
        || activeSiblingCoverageCents !== 0
      )
    ) ledgerIntegrityError();
  } else if (hasConfirmedNonAggregate && allocatedProviderRefundCents !== payment.refundedCents) {
    ledgerIntegrityError();
  }
}

export function strictPaymentRefundLedger(
  paymentDocuments: PaymentLedgerDocument[],
  refundDocuments: PaymentLedgerDocument[],
  expectedCampaignId: string,
): StrictPaymentRefundLedger {
  const campaignId = requiredString(expectedCampaignId);
  const payments: StrictPaymentLedgerEntry[] = [];
  const paymentsById = new Map<string, StrictPaymentLedgerEntry>();
  const reservationIds = new Set<string>();
  let clearedNetCents = 0;

  for (const document of paymentDocuments) {
    const id = requiredString(document.id);
    if (paymentsById.has(id)) ledgerIntegrityError();
    const data = document.data();
    if (!data || data.campaignId !== campaignId) ledgerIntegrityError();
    const reservationId = requiredString(data.reservationId);
    if (id !== reservationId || reservationIds.has(reservationId)) ledgerIntegrityError();
    reservationIds.add(reservationId);
    const status = requiredString(data.status);
    const amountCents = data.amountCents;
    const refundedCents = data.refundedCents;
    if (
      !PAYMENT_STATUSES.has(status)
      || !Number.isSafeInteger(amountCents)
      || Number(amountCents) <= 0
      || !Number.isSafeInteger(refundedCents)
      || Number(refundedCents) < 0
      || Number(refundedCents) > Number(amountCents)
    ) ledgerIntegrityError();
    validatePaymentStatusAmounts(status, Number(amountCents), Number(refundedCents));
    const entry: StrictPaymentLedgerEntry = {
      id,
      data,
      reservationId,
      status,
      amountCents: Number(amountCents),
      refundedCents: Number(refundedCents),
      netCents: Number(amountCents) - Number(refundedCents),
    };
    payments.push(entry);
    paymentsById.set(id, entry);
    if (['cleared', 'partially_refunded'].includes(status)) {
      clearedNetCents = safeAdd(clearedNetCents, entry.netCents);
    }
  }

  const activeRefundCentsByPayment = new Map<string, number>();
  const refundIds = new Set<string>();
  const refundData: Array<Record<string, unknown>> = [];
  const refundEntriesByPayment = new Map<string, StrictRefundLedgerEntry[]>();
  let activeRefundCount = 0;
  let activeRefundCents = 0;

  for (const document of refundDocuments) {
    const id = requiredString(document.id);
    if (refundIds.has(id)) ledgerIntegrityError();
    refundIds.add(id);
    const data = document.data();
    if (!data) ledgerIntegrityError();
    refundData.push(data);
    if (data.campaignId !== campaignId) ledgerIntegrityError();
    const paymentId = requiredString(data.paymentId);
    const reservationId = requiredString(data.reservationId);
    const status = requiredString(data.status);
    const amountCents = data.amountCents;
    const payment = paymentsById.get(paymentId);
    if (
      !payment
      || payment.reservationId !== reservationId
      || !isKnownRefundRecordStatus(status)
      || !Number.isSafeInteger(amountCents)
      || Number(amountCents) < 0
      || Number(amountCents) > payment.amountCents
      || (status === 'covered' && Number(amountCents) !== 0)
      || (!['covered', 'confirmed'].includes(status) && Number(amountCents) === 0)
    ) ledgerIntegrityError();
    const aggregate = isAggregateRefundRecord(data);
    const mandatory = isMandatoryRefundRecord(data);
    if ((mandatory && status === 'rejected') || (status === 'covered' && !aggregate)) {
      ledgerIntegrityError();
    }
    const hasBalanceEvidence = hasOwn(data, 'originalAmountCents')
      || hasOwn(data, 'providerRefundedCents')
      || hasOwn(data, 'coveredByOtherObligationsCents');
    const originalAmountCents = optionalSafeWholeCents(data, 'originalAmountCents');
    const providerRefundedCents = optionalSafeWholeCents(data, 'providerRefundedCents');
    const coveredByOtherObligationsCents = optionalSafeWholeCents(
      data,
      'coveredByOtherObligationsCents',
    );
    if (
      status === 'confirmed'
      && (
        !hasBalanceEvidence
        || originalAmountCents === null
        || originalAmountCents <= 0
        || providerRefundedCents !== originalAmountCents
        || coveredByOtherObligationsCents !== null && coveredByOtherObligationsCents !== 0
      )
    ) ledgerIntegrityError();
    const refundEntry: StrictRefundLedgerEntry = {
      id,
      data,
      paymentId,
      reservationId,
      status,
      amountCents: Number(amountCents),
      aggregate,
      mandatory,
      hasBalanceEvidence,
      originalAmountCents,
      providerRefundedCents,
      coveredByOtherObligationsCents,
    };
    const paymentEntries = refundEntriesByPayment.get(paymentId) || [];
    paymentEntries.push(refundEntry);
    refundEntriesByPayment.set(paymentId, paymentEntries);
    if (!isActiveRefundObligationStatus(status)) continue;
    if (!ACTIVE_REFUND_PAYMENT_STATUSES.has(payment.status)) ledgerIntegrityError();
    const nextPaymentTotal = safeAdd(
      activeRefundCentsByPayment.get(paymentId) || 0,
      Number(amountCents),
    );
    if (nextPaymentTotal > payment.netCents) ledgerIntegrityError();
    activeRefundCentsByPayment.set(paymentId, nextPaymentTotal);
    activeRefundCount += 1;
    activeRefundCents = safeAdd(activeRefundCents, Number(amountCents));
  }

  for (const [paymentId, entries] of refundEntriesByPayment) {
    const payment = paymentsById.get(paymentId);
    if (!payment) ledgerIntegrityError();
    validateRefundBalanceEvidence(payment, entries);
  }

  const activeSummary = activeRefundObligationSummary(refundData, campaignId);
  if (
    activeSummary.integrityIssueCount !== 0
    || activeSummary.activeCount !== activeRefundCount
    || activeSummary.totalCents !== activeRefundCents
  ) ledgerIntegrityError();

  return {
    payments,
    paymentsById,
    activeRefundCentsByPayment,
    activeRefundCount,
    activeRefundCents,
    clearedNetCents,
  };
}
