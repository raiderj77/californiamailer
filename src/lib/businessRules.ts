import type {
  CampaignCosts,
  CampaignPayment,
  CampaignReservation,
  PaymentStatus,
  PlacementSize,
  ProofStatus,
} from '@/lib/campaignTypes';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  MINIMUM_ECONOMIC_MARGIN_BPS,
  MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
} from '@/config/economicSafeguards';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  CREATIVE_BRIEF_STATUS,
  CREATIVE_BRIEF_TIME_ZONE,
  creativeBriefErrors,
  isCalendarDate,
  parseAssetRightsAttestation,
  parseCreativeBriefContent,
  type CreativeBriefDeliveryWindow,
} from '@/lib/creativeBrief';

const FUNDING_ELIGIBLE_STATUSES = new Set<PaymentStatus>(['cleared', 'partially_refunded']);

export function isActiveHold(
  reservation: Pick<CampaignReservation, 'status' | 'holdExpiresAt'>,
  now = new Date(),
): boolean {
  if (!['hold', 'awaiting_payment'].includes(reservation.status)) return false;
  if (!reservation.holdExpiresAt) return false;
  return new Date(reservation.holdExpiresAt).getTime() > now.getTime();
}

export function clearedNetFundingCents(payments: CampaignPayment[]): number {
  return payments.reduce((total, payment) => {
    if (!FUNDING_ELIGIBLE_STATUSES.has(payment.status)) return total;
    return total + Math.max(0, payment.amountCents - payment.refundedCents);
  }, 0);
}

type PaymentEvidenceRecord = Record<string, unknown> & { id: string };

export interface CanonicalPaidPaymentEvidence {
  clearedFundingCents: number;
  paidReservationCount: number;
  verifiedPaidReservationCount: number;
  issues: string[];
}

export function canonicalPaidPaymentEvidence(
  reservations: PaymentEvidenceRecord[],
  payments: PaymentEvidenceRecord[],
  expected: { campaignId: string; planId: string; offerModelVersion: string },
  now = new Date(),
): CanonicalPaidPaymentEvidence {
  const issues = new Set<string>();
  const reservationsById = new Map<string, PaymentEvidenceRecord>();
  for (const reservation of reservations) {
    if (!reservation.id || reservationsById.has(reservation.id)) {
      issues.add('reservation_document_id_duplicate_or_missing');
      continue;
    }
    reservationsById.set(reservation.id, reservation);
  }

  for (const payment of payments) {
    const reservationId = typeof payment.reservationId === 'string' ? payment.reservationId : '';
    const reservationByDocumentId = reservationsById.get(payment.id);
    const reservationByRecordedId = reservationsById.get(reservationId);
    const reservation = reservationByDocumentId ?? reservationByRecordedId;
    if (!reservation) {
      issues.add('payment_orphan');
      continue;
    }
    if (payment.id !== reservation.id || reservationId !== reservation.id) {
      issues.add('payment_document_or_reservation_id_mismatch');
    }
    if (
      payment.campaignId !== expected.campaignId
      || payment.planId !== expected.planId
      || payment.offerModelVersion !== expected.offerModelVersion
      || payment.campaignId !== reservation.campaignId
      || payment.planId !== reservation.planId
      || payment.offerModelVersion !== reservation.offerModelVersion
    ) {
      issues.add('payment_campaign_or_offer_model_mismatch');
    }
  }

  const paidReservations = reservations.filter((reservation) => reservation.status === 'paid');
  let clearedFundingCents = 0;
  let verifiedPaidReservationCount = 0;
  for (const reservation of paidReservations) {
    if (
      reservation.campaignId !== expected.campaignId
      || reservation.planId !== expected.planId
      || reservation.offerModelVersion !== expected.offerModelVersion
    ) {
      issues.add('paid_reservation_campaign_or_offer_model_mismatch');
    }
    const relatedPayments = payments.filter((payment) => (
      payment.id === reservation.id || payment.reservationId === reservation.id
    ));
    if (relatedPayments.length === 0) {
      issues.add('paid_payment_missing');
      continue;
    }
    if (relatedPayments.length !== 1) {
      issues.add('paid_payment_duplicate');
      continue;
    }

    const [payment] = relatedPayments;
    const quoteCents = reservation.quotedPriceCents;
    const amountCents = payment.amountCents;
    const refundedCents = payment.refundedCents;
    const clearedAt = recordedTimestampMillis(payment.clearedAt);
    const exactBinding = payment.id === reservation.id
      && payment.reservationId === reservation.id
      && payment.campaignId === expected.campaignId
      && payment.campaignId === reservation.campaignId
      && payment.planId === expected.planId
      && payment.planId === reservation.planId
      && payment.offerModelVersion === expected.offerModelVersion
      && payment.offerModelVersion === reservation.offerModelVersion;
    const exactQuote = Number.isSafeInteger(quoteCents)
      && Number(quoteCents) > 0
      && Number.isSafeInteger(amountCents)
      && Number(amountCents) === Number(quoteCents);
    const zeroRefund = Number.isSafeInteger(refundedCents) && Number(refundedCents) === 0;
    const clearedEvidence = payment.status === 'cleared'
      && payment.provider === 'stripe'
      && payment.currency === 'usd'
      && typeof payment.externalPaymentId === 'string'
      && Boolean(payment.externalPaymentId.trim())
      && clearedAt > 0
      && clearedAt <= now.getTime();

    if (!exactBinding) issues.add('paid_payment_binding_mismatch');
    if (!exactQuote) issues.add('paid_payment_quote_mismatch');
    if (!zeroRefund) issues.add('paid_payment_refund_present_or_invalid');
    if (!clearedEvidence) issues.add('paid_payment_not_fully_cleared');
    if (!exactBinding || !exactQuote || !zeroRefund || !clearedEvidence) continue;
    if (!Number.isSafeInteger(clearedFundingCents + Number(amountCents))) {
      issues.add('paid_payment_funding_overflow');
      continue;
    }
    clearedFundingCents += Number(amountCents);
    verifiedPaidReservationCount += 1;
  }

  return {
    clearedFundingCents,
    paidReservationCount: paidReservations.length,
    verifiedPaidReservationCount,
    issues: [...issues],
  };
}

export function reservedFundingCents(
  reservations: CampaignReservation[],
  now = new Date(),
): number {
  return reservations.reduce(
    (total, reservation) => total + (isActiveHold(reservation, now) ? reservation.quotedPriceCents : 0),
    0,
  );
}

export function categoryConflict(
  requestedCategory: string,
  activeCategories: string[],
  conflictsByCategory: Record<string, string[]>,
): string | null {
  const conflicts = new Set([
    requestedCategory,
    ...(conflictsByCategory[requestedCategory] ?? []),
  ]);

  for (const activeCategory of activeCategories) {
    const reverseConflicts = conflictsByCategory[activeCategory] ?? [];
    if (conflicts.has(activeCategory) || reverseConflicts.includes(requestedCategory)) {
      return activeCategory;
    }
  }
  return null;
}

export function hasApprovedLatestMaterial(
  reservation: { id: string; latestMaterialId?: unknown },
  materials: Array<{ id: string; reservationId?: unknown; status?: unknown }>,
): boolean {
  if (typeof reservation.latestMaterialId !== 'string' || !reservation.latestMaterialId) return false;
  return materials.some((material) => material.id === reservation.latestMaterialId
    && material.reservationId === reservation.id
    && material.status === 'owner_approved_private');
}

type PrivateCreativeRecord = Record<string, unknown> & { id: string };

export function completeCampaignDeliveryWindow(
  campaign: Record<string, unknown>,
): CreativeBriefDeliveryWindow | null {
  const startDate = campaign.plannedDeliveryStart;
  const endDate = campaign.plannedDeliveryEnd;
  if (
    typeof startDate !== 'string'
    || typeof endDate !== 'string'
    || !isCalendarDate(startDate)
    || !isCalendarDate(endDate)
    || startDate > endDate
  ) {
    return null;
  }
  return { startDate, endDate };
}

export function hasCurrentCreativeBrief(
  reservation: PrivateCreativeRecord,
  creativeBrief: PrivateCreativeRecord | undefined,
  campaign: Record<string, unknown>,
): boolean {
  const sequence = reservation.creativeBriefSequence;
  const deliveryWindow = completeCampaignDeliveryWindow(campaign);
  if (
    !deliveryWindow
    || typeof reservation.latestCreativeBriefId !== 'string'
    || !reservation.latestCreativeBriefId
    || !Number.isSafeInteger(sequence)
    || Number(sequence) < 1
    || !creativeBrief
    || creativeBrief.id !== reservation.latestCreativeBriefId
    || creativeBrief.reservationId !== reservation.id
    || creativeBrief.campaignId !== reservation.campaignId
    || creativeBrief.placementSlotId !== reservation.placementSlotId
    || creativeBrief.version !== sequence
    || creativeBrief.status !== CREATIVE_BRIEF_STATUS
  ) {
    return false;
  }
  const content = parseCreativeBriefContent(creativeBrief.content);
  const savedWindow = creativeBrief.deliveryWindow;
  const savedWindowMatches = typeof savedWindow === 'object'
    && savedWindow !== null
    && !Array.isArray(savedWindow)
    && (savedWindow as Record<string, unknown>).startDate === deliveryWindow.startDate
    && (savedWindow as Record<string, unknown>).endDate === deliveryWindow.endDate
    && (savedWindow as Record<string, unknown>).timeZone === CREATIVE_BRIEF_TIME_ZONE
    && (savedWindow as Record<string, unknown>).validationStatus === 'validated_for_planned_window';
  return Boolean(
    content
    && savedWindowMatches
    && creativeBriefErrors(content, deliveryWindow).length === 0,
  );
}

export function hasCurrentApprovedMaterialWithRights(
  reservation: PrivateCreativeRecord,
  material: PrivateCreativeRecord | undefined,
  now = new Date(),
): boolean {
  const sequence = reservation.materialSequence;
  if (
    typeof reservation.latestMaterialId !== 'string'
    || !reservation.latestMaterialId
    || !Number.isSafeInteger(sequence)
    || Number(sequence) < 1
    || !material
    || material.id !== reservation.latestMaterialId
    || material.reservationId !== reservation.id
    || material.campaignId !== reservation.campaignId
    || material.placementSlotId !== reservation.placementSlotId
    || material.version !== sequence
    || material.status !== 'owner_approved_private'
    || typeof material.reviewedBy !== 'string'
    || !material.reviewedBy.trim()
    || recordedTimestampMillis(material.reviewedAt) <= 0
    || recordedTimestampMillis(material.reviewedAt) > now.getTime()
    || recordedTimestampMillis(material.rightsAttestedAt) <= 0
    || recordedTimestampMillis(material.rightsAttestedAt) > now.getTime()
  ) {
    return false;
  }
  const rights = material.rightsAttestation;
  if (typeof rights !== 'object' || rights === null || Array.isArray(rights)) return false;
  const record = rights as Record<string, unknown>;
  if (
    record.statementVersion !== ASSET_RIGHTS_STATEMENT_VERSION
    || record.assetKind !== material.assetKind
  ) {
    return false;
  }
  return Boolean(parseAssetRightsAttestation({
    assetKind: record.assetKind,
    rightsBasis: record.rightsBasis,
    attestorName: record.attestorName,
    sourceOrLicenseNote: record.sourceOrLicenseNote,
    rightsAttested: record.rightsAttested,
  }));
}

export function latestBoundProofStatus(
  reservation: PrivateCreativeRecord,
  proof: PrivateCreativeRecord | undefined,
  now = new Date(),
): ProofStatus {
  const sequence = reservation.proofSequence;
  if (
    typeof reservation.latestProofId !== 'string'
    || !reservation.latestProofId
    || !Number.isSafeInteger(sequence)
    || Number(sequence) < 1
    || !proof
    || proof.id !== reservation.latestProofId
    || proof.reservationId !== reservation.id
    || proof.campaignId !== reservation.campaignId
    || proof.placementSlotId !== reservation.placementSlotId
    || proof.version !== sequence
    || proof.creativeBriefId !== reservation.latestCreativeBriefId
    || proof.creativeBriefVersion !== reservation.creativeBriefSequence
    || proof.materialId !== reservation.latestMaterialId
    || proof.materialVersion !== reservation.materialSequence
  ) {
    return 'waiting_for_materials';
  }
  const status = typeof proof.status === 'string' ? proof.status : 'waiting_for_materials';
  if (['approved', 'locked_for_print'].includes(status)) {
    const approvedAt = recordedTimestampMillis(proof.approvedAt);
    if (
      typeof proof.approvedBy !== 'string'
      || !proof.approvedBy.trim()
      || approvedAt <= 0
      || approvedAt > now.getTime()
    ) {
      return 'waiting_for_materials';
    }
  }
  return status as ProofStatus;
}

function recordedTimestampMillis(value: unknown): number {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === 'string') {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object') {
    const candidate = value as { toMillis?: () => unknown; toDate?: () => unknown };
    if (typeof candidate.toMillis === 'function') {
      const milliseconds = Number(candidate.toMillis());
      return Number.isFinite(milliseconds) ? milliseconds : 0;
    }
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
    }
  }
  return 0;
}

export function latestProofStatus(
  reservation: { id: string; latestProofId?: unknown },
  proofs: Array<{ id: string; reservationId?: unknown; status?: unknown }>,
): ProofStatus {
  if (typeof reservation.latestProofId !== 'string' || !reservation.latestProofId) return 'waiting_for_materials';
  const proof = proofs.find((candidate) => candidate.id === reservation.latestProofId
    && candidate.reservationId === reservation.id);
  return (typeof proof?.status === 'string' ? proof.status : 'waiting_for_materials') as ProofStatus;
}

export interface CostSummary {
  cashCostCents: number | null;
  totalCostCents: number | null;
  cashContributionBeforeOwnerLaborCents: number | null;
  economicSurplusBeforeIncomeTaxCents: number | null;
  grossContributionCents: number | null;
  contributionMarginBps: number | null;
  breakEvenPaidPlacementCount: number | null;
  targetOwnerSurplusCents: number | null;
  targetGapCents: number | null;
  quoteCurrent: boolean;
  quoteValidThrough: string | null;
  missingInputs: string[];
}

const CASH_COST_FIELDS = [
  'printingCostCents',
  'postageCostCents',
  'shippingCostCents',
  'taxCostCents',
  'designCostCents',
  'processingFeeCents',
  'refundReserveCents',
  'reprintReserveCents',
  'softwareAllocationCents',
  'otherExpensesCents',
] as const satisfies readonly (keyof CampaignCosts)[];

export interface QuoteVerificationStatus {
  current: boolean;
  validThrough: string | null;
  blocker: string | null;
}

export function quoteVerificationStatus(
  quoteVerifiedAt: string | null,
  now = new Date(),
): QuoteVerificationStatus {
  if (!quoteVerifiedAt) return { current: false, validThrough: null, blocker: 'quoteVerifiedAt' };

  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(quoteVerifiedAt);
  const verifiedAt = dateOnly
    ? Date.parse(`${quoteVerifiedAt}T00:00:00.000Z`)
    : Date.parse(quoteVerifiedAt);
  if (!Number.isFinite(verifiedAt)) {
    return { current: false, validThrough: null, blocker: 'quoteVerifiedAt is invalid' };
  }
  if (dateOnly && new Date(verifiedAt).toISOString().slice(0, 10) !== quoteVerifiedAt) {
    return { current: false, validThrough: null, blocker: 'quoteVerifiedAt is invalid' };
  }
  if (verifiedAt > now.getTime()) {
    return { current: false, validThrough: null, blocker: 'quoteVerifiedAt cannot be in the future' };
  }

  const validThroughMs = verifiedAt
    + PRINTING4SUPERCHEAP.recheckAfterDays * 24 * 60 * 60 * 1_000;
  const validThrough = new Date(validThroughMs).toISOString();
  if (now.getTime() > validThroughMs) {
    return { current: false, validThrough, blocker: 'quoteVerifiedAt is stale' };
  }
  return { current: true, validThrough, blocker: null };
}

export function calculateCostSummary(
  costs: CampaignCosts,
  revenueCents: number,
  pricePerPaidPlacementCents: number,
  now = new Date(),
): CostSummary {
  const missingInputs = CASH_COST_FIELDS.filter((field) => costs[field] === null).map(String);
  if (costs.ownerLaborCostCents === null) missingInputs.push('ownerLaborCostCents');
  if (costs.targetOwnerSurplusCents === null) missingInputs.push('targetOwnerSurplusCents');
  if (
    costs.targetOwnerSurplusCents !== null
    && costs.targetOwnerSurplusCents < MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS
  ) {
    missingInputs.push(
      `targetOwnerSurplusCents must be at least ${MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS}`,
    );
  }
  if (costs.supplierId !== PRINTING4SUPERCHEAP.id) missingInputs.unshift('supplierId');
  if (costs.mailPieceCount === null) missingInputs.unshift('mailPieceCount');
  if (costs.mailPieceCount !== null && (!Number.isSafeInteger(costs.mailPieceCount) || costs.mailPieceCount <= 0)) {
    missingInputs.push('mailPieceCount must be a positive whole number');
  }
  if (!costs.printerQuoteReference) missingInputs.push('printerQuoteReference');
  const quoteStatus = quoteVerificationStatus(costs.quoteVerifiedAt, now);
  if (quoteStatus.blocker) missingInputs.push(quoteStatus.blocker);
  if (costs.printingCostCents !== null && costs.printingCostCents <= 0) missingInputs.push('printingCostCents must be greater than zero');
  if (costs.postageCostCents !== null && costs.postageCostCents <= 0) missingInputs.push('postageCostCents must be greater than zero');
  if (costs.processingFeeCents !== null && costs.processingFeeCents <= 0) missingInputs.push('processingFeeCents must be greater than zero');
  for (const field of [...CASH_COST_FIELDS, 'ownerLaborCostCents', 'targetOwnerSurplusCents'] as const) {
    const value = costs[field];
    if (value !== null && (!Number.isSafeInteger(value) || value < 0)) {
      missingInputs.push(`${field} must be a nonnegative whole-cent amount`);
    }
  }
  if (!Number.isSafeInteger(revenueCents) || revenueCents < 0) missingInputs.push('revenueCents must be a nonnegative whole-cent amount');
  if (!Number.isSafeInteger(pricePerPaidPlacementCents) || pricePerPaidPlacementCents <= 0) {
    missingInputs.push('pricePerPaidPlacementCents must be a positive whole-cent amount');
  }

  if (missingInputs.length > 0) {
    return {
      cashCostCents: null,
      totalCostCents: null,
      cashContributionBeforeOwnerLaborCents: null,
      economicSurplusBeforeIncomeTaxCents: null,
      grossContributionCents: null,
      contributionMarginBps: null,
      breakEvenPaidPlacementCount: null,
      targetOwnerSurplusCents: costs.targetOwnerSurplusCents,
      targetGapCents: null,
      quoteCurrent: quoteStatus.current,
      quoteValidThrough: quoteStatus.validThrough,
      missingInputs,
    };
  }

  const cashCostCents = CASH_COST_FIELDS.reduce(
    (total, field) => total + Number(costs[field]),
    0,
  );
  const totalCostCents = cashCostCents + Number(costs.ownerLaborCostCents);
  const cashContributionBeforeOwnerLaborCents = revenueCents - cashCostCents;
  const economicSurplusBeforeIncomeTaxCents = revenueCents - totalCostCents;
  const contributionMarginBps =
    revenueCents > 0 ? Math.floor((economicSurplusBeforeIncomeTaxCents / revenueCents) * 10_000) : null;
  const breakEvenPaidPlacementCount =
    pricePerPaidPlacementCents > 0
      ? Math.ceil(totalCostCents / pricePerPaidPlacementCents)
      : null;
  const targetOwnerSurplusCents = Number(costs.targetOwnerSurplusCents);
  const targetGapCents = economicSurplusBeforeIncomeTaxCents - targetOwnerSurplusCents;

  return {
    cashCostCents,
    totalCostCents,
    cashContributionBeforeOwnerLaborCents,
    economicSurplusBeforeIncomeTaxCents,
    grossContributionCents: economicSurplusBeforeIncomeTaxCents,
    contributionMarginBps,
    breakEvenPaidPlacementCount,
    targetOwnerSurplusCents,
    targetGapCents,
    quoteCurrent: quoteStatus.current,
    quoteValidThrough: quoteStatus.validThrough,
    missingInputs,
  };
}

export interface PrintReadinessInput {
  clearedFundingCents: number;
  fundingGoalCents: number;
  paidReservationCount: number;
  minimumPaidPlacements: number;
  paidProofStatuses: ProofStatus[];
  approvedMaterialCount: number;
  paidDisclaimerCount: number;
  refundObligationCents: number;
  unresolvedPaymentReviewCount: number;
  verifiedHouseholds: number | null;
  artworkPreflightApproved: boolean;
  routesConfirmed: boolean;
  costs: CampaignCosts;
  minimumMarginBps: number;
  ownerPrintApproved: boolean;
  pricePerPaidPlacementCents: number;
  now?: Date;
}

export interface ReadinessCheck {
  key: string;
  label: string;
  passed: boolean;
  detail: string;
}

export function evaluatePrintReadiness(input: PrintReadinessInput): {
  ready: boolean;
  checks: ReadinessCheck[];
  costSummary: CostSummary;
} {
  const costSummary = calculateCostSummary(
    input.costs,
    input.clearedFundingCents,
    input.pricePerPaidPlacementCents,
    input.now,
  );
  const everyPaidProofApproved =
    input.paidProofStatuses.length === input.paidReservationCount &&
    input.paidProofStatuses.every((status) => ['approved', 'locked_for_print'].includes(status));
  const marginFloorConfigured = Number.isSafeInteger(input.minimumMarginBps)
    && input.minimumMarginBps >= MINIMUM_ECONOMIC_MARGIN_BPS
    && input.minimumMarginBps <= 10_000;

  const checks: ReadinessCheck[] = [
    {
      key: 'funding',
      label: 'Cleared funding goal',
      passed: input.clearedFundingCents >= input.fundingGoalCents,
      detail: `${input.clearedFundingCents} of ${input.fundingGoalCents} cents cleared`,
    },
    {
      key: 'paid_placements',
      label: 'Minimum paid placements',
      passed: input.paidReservationCount >= input.minimumPaidPlacements,
      detail: `${input.paidReservationCount} of ${input.minimumPaidPlacements}`,
    },
    {
      key: 'proofs',
      label: 'Every paid proof approved',
      passed: everyPaidProofApproved,
      detail: `${input.paidProofStatuses.filter((status) => ['approved', 'locked_for_print'].includes(status)).length} approved for ${input.paidReservationCount} paid placements`,
    },
    {
      key: 'materials',
      label: 'Every paid advertiser material approved',
      passed: input.approvedMaterialCount === input.paidReservationCount,
      detail: `${input.approvedMaterialCount} approved for ${input.paidReservationCount} paid placements`,
    },
    {
      key: 'disclaimers',
      label: 'Every paid advertiser disclaimer recorded',
      passed: input.paidDisclaimerCount === input.paidReservationCount,
      detail: `${input.paidDisclaimerCount} recorded for ${input.paidReservationCount} paid placements`,
    },
    {
      key: 'preflight',
      label: 'Artwork preflight',
      passed: input.artworkPreflightApproved,
      detail: input.artworkPreflightApproved ? 'Approved' : 'Owner approval missing',
    },
    {
      key: 'routes',
      label: 'Delivery routes confirmed',
      passed: input.routesConfirmed,
      detail: input.routesConfirmed ? 'Confirmed' : 'Carrier routes are not confirmed',
    },
    {
      key: 'costs',
      label: 'Current cost inputs',
      passed: costSummary.missingInputs.length === 0,
      detail:
        costSummary.missingInputs.length === 0
          ? 'All required inputs present'
          : `Missing: ${costSummary.missingInputs.join(', ')}`,
    },
    {
      key: 'mail_quantity',
      label: 'Mail-piece quantity covers verified households',
      passed: input.verifiedHouseholds !== null
        && input.costs.mailPieceCount !== null
        && input.costs.mailPieceCount >= input.verifiedHouseholds,
      detail: input.verifiedHouseholds === null || input.costs.mailPieceCount === null
        ? 'Verified household and mail-piece counts are required'
        : `${input.costs.mailPieceCount} pieces for ${input.verifiedHouseholds} verified households`,
    },
    {
      key: 'refunds',
      label: 'No pending refund obligation',
      passed: input.refundObligationCents === 0,
      detail: `${input.refundObligationCents} cents awaiting resolution`,
    },
    {
      key: 'payment_reviews',
      label: 'No unresolved payment review',
      passed: input.unresolvedPaymentReviewCount === 0,
      detail: `${input.unresolvedPaymentReviewCount} payment records awaiting resolution`,
    },
    {
      key: 'margin',
      label: 'Minimum contribution margin',
      passed:
        marginFloorConfigured &&
        costSummary.contributionMarginBps !== null &&
        costSummary.contributionMarginBps >= input.minimumMarginBps,
      detail:
        !marginFloorConfigured
          ? `Campaign minimum must be ${MINIMUM_ECONOMIC_MARGIN_BPS} bps or higher`
          : costSummary.contributionMarginBps === null
          ? 'Unavailable until costs are complete'
          : `${costSummary.contributionMarginBps} bps; minimum ${input.minimumMarginBps} bps`,
    },
    {
      key: 'economic_surplus_target',
      label: 'Pre-income-tax owner-surplus target',
      passed:
        costSummary.targetGapCents !== null
        && costSummary.targetGapCents >= 0,
      detail:
        costSummary.economicSurplusBeforeIncomeTaxCents === null
          || costSummary.targetOwnerSurplusCents === null
          ? 'Unavailable until every cost and the explicit target are entered'
          : `${costSummary.economicSurplusBeforeIncomeTaxCents} cents economic surplus; target ${costSummary.targetOwnerSurplusCents} cents`,
    },
    {
      key: 'owner',
      label: 'Manual owner print approval',
      passed: input.ownerPrintApproved,
      detail: input.ownerPrintApproved ? 'Approved' : 'Not approved',
    },
  ];

  return {
    ready: checks.every((check) => check.passed),
    checks,
    costSummary,
  };
}

export function availablePlacementCount(
  total: number,
  activeReservations: Array<Pick<CampaignReservation, 'status' | 'holdExpiresAt' | 'placementSize'>>,
  placementSize: PlacementSize,
  now = new Date(),
): number {
  const occupied = activeReservations.filter(
    (reservation) =>
      reservation.placementSize === placementSize &&
      (reservation.status === 'paid' ||
        reservation.status === 'disputed' ||
        isActiveHold(reservation as CampaignReservation, now)),
  ).length;
  return Math.max(0, total - occupied);
}
