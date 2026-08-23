import type { DocumentData } from 'firebase-admin/firestore';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  FOUNDING_CAMPAIGN,
} from '@/config/foundingCampaign';
import {
  canonicalPaidPaymentEvidence,
  clearedNetFundingCents,
  completeCampaignDeliveryWindow,
  evaluatePrintReadiness,
  hasCurrentApprovedMaterialWithRights,
  hasCurrentCreativeBrief,
  latestBoundProofStatus,
} from '@/lib/businessRules';
import { campaignOperationalEvidenceBlockReason } from '@/lib/campaignOperationalGates';
import { campaignPaidPlacementEvidence } from '@/lib/campaignPlacementEvidence';
import type { CampaignCosts, CampaignPayment } from '@/lib/campaignTypes';
import { providerAwarePaymentEvidence } from '@/lib/paymentProviderEvidence';
import { authoritativeActiveRefundObligationSummary } from '@/lib/refundEvidence';

export type CampaignReadinessDocument = {
  id: string;
  data: () => DocumentData;
};

function recordedTimestampMillis(value: unknown): number {
  if (typeof value === 'string') {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object') {
    const timestamp = value as { toMillis?: () => unknown; toDate?: () => unknown };
    if (typeof timestamp.toMillis === 'function') {
      const milliseconds = Number(timestamp.toMillis());
      return Number.isFinite(milliseconds) ? milliseconds : 0;
    }
    if (typeof timestamp.toDate === 'function') {
      const date = timestamp.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
    }
  }
  return 0;
}

export function ownerPrintApprovalEvidence(
  data: DocumentData,
  atMs = Date.now(),
  approvalCandidateAtMs: number | null = null,
): boolean {
  if (data.ownerPrintApproved !== true || !Number.isSafeInteger(atMs) || atMs <= 0) return false;
  if (approvalCandidateAtMs !== null) {
    return Number.isSafeInteger(approvalCandidateAtMs)
      && approvalCandidateAtMs > 0
      && approvalCandidateAtMs <= atMs;
  }
  const printReadyAtMs = recordedTimestampMillis(data.printReadyAt);
  return printReadyAtMs > 0 && printReadyAtMs <= atMs;
}

export function campaignCostsFromRecord(data: DocumentData): CampaignCosts {
  const costs = data.costs || {};
  const value = (key: keyof CampaignCosts) => {
    const raw = costs[key];
    return typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : null;
  };
  return {
    supplierId: costs.supplierId === PRINTING4SUPERCHEAP.id ? PRINTING4SUPERCHEAP.id : null,
    mailPieceCount: value('mailPieceCount'),
    printingCostCents: value('printingCostCents'),
    postageCostCents: value('postageCostCents'),
    shippingCostCents: value('shippingCostCents'),
    taxCostCents: value('taxCostCents'),
    designCostCents: value('designCostCents'),
    ownerLaborCostCents: value('ownerLaborCostCents'),
    processingFeeCents: value('processingFeeCents'),
    refundReserveCents: value('refundReserveCents'),
    reprintReserveCents: value('reprintReserveCents'),
    softwareAllocationCents: value('softwareAllocationCents'),
    otherExpensesCents: value('otherExpensesCents'),
    targetOwnerSurplusCents: value('targetOwnerSurplusCents'),
    printerQuoteReference: typeof costs.printerQuoteReference === 'string' && costs.printerQuoteReference.trim()
      ? costs.printerQuoteReference
      : null,
    quoteVerifiedAt: typeof costs.quoteVerifiedAt === 'string' && costs.quoteVerifiedAt.trim()
      ? costs.quoteVerifiedAt
      : null,
    version: typeof costs.version === 'number' && Number.isSafeInteger(costs.version)
      ? costs.version
      : 1,
  };
}

function unresolvedPaymentReviewKeys(
  reservations: Array<DocumentData & { id: string }>,
  paymentDocuments: CampaignReadinessDocument[],
): Set<string> {
  const unresolved = new Set<string>();
  for (const document of paymentDocuments) {
    const payment = document.data();
    if (!['pending', 'manual_review', 'disputed'].includes(String(payment.status))) continue;
    const reservationId = typeof payment.reservationId === 'string' && payment.reservationId
      ? payment.reservationId
      : null;
    unresolved.add(reservationId ? `reservation:${reservationId}` : `payment:${document.id}`);
  }
  for (const reservation of reservations) {
    if (!['payment_review', 'disputed'].includes(String(reservation.status))) continue;
    unresolved.add(`reservation:${reservation.id}`);
  }
  return unresolved;
}

export function campaignPrintReadinessState(
  data: DocumentData,
  reservationDocuments: CampaignReadinessDocument[],
  proofDocuments: CampaignReadinessDocument[],
  refundDocuments: CampaignReadinessDocument[],
  materialDocuments: CampaignReadinessDocument[],
  creativeBriefDocuments: CampaignReadinessDocument[],
  paymentDocuments: CampaignReadinessDocument[],
  routePlan: DocumentData | undefined,
  atMs = Date.now(),
  providerEvidenceDocuments: CampaignReadinessDocument[] = paymentDocuments,
  placementSlotDocuments: CampaignReadinessDocument[] = [],
  placementSlotReadPossiblyTruncated = false,
) {
  const reservations: Array<DocumentData & { id: string }> = reservationDocuments
    .map((document) => ({ id: document.id, ...document.data() }));
  const paid = reservations.filter((reservation) => reservation.status === 'paid');
  const paidAdvertiserCount = new Set(
    paid.map((reservation) => String(reservation.emailNormalized || reservation.id)),
  ).size;
  const proofs: Array<DocumentData & { id: string }> = proofDocuments
    .map((document) => ({ id: document.id, ...document.data() }));
  const materials: Array<DocumentData & { id: string }> = materialDocuments
    .map((document) => ({ id: document.id, ...document.data() }));
  const creativeBriefs: Array<DocumentData & { id: string }> = creativeBriefDocuments
    .map((document) => ({ id: document.id, ...document.data() }));
  const now = new Date(atMs);
  const creativePackages = paid.map((reservation) => {
    const creativeBrief = creativeBriefs.find(
      (candidate) => candidate.id === reservation.latestCreativeBriefId,
    );
    const proof = proofs.find((candidate) => candidate.id === reservation.latestProofId);
    const creativeBriefCurrent = hasCurrentCreativeBrief(reservation, creativeBrief, data, now);
    const materialCurrent = hasCurrentApprovedMaterialWithRights(reservation, materials, now);
    return {
      creativeBriefCurrent,
      materialCurrent,
      proofStatus: creativeBriefCurrent && materialCurrent
        ? latestBoundProofStatus(reservation, proof, now)
        : 'waiting_for_materials' as const,
    };
  });
  const paidProofStatuses = creativePackages.map((creativePackage) => creativePackage.proofStatus);
  const currentCreativeBriefCount = creativePackages
    .filter((creativePackage) => creativePackage.creativeBriefCurrent).length;
  const approvedMaterialCount = creativePackages
    .filter((creativePackage) => creativePackage.materialCurrent).length;
  const paidDisclaimerCount = paid.filter((reservation) => (
    typeof reservation.advertiserDisclaimer === 'string'
    && reservation.advertiserDisclaimer.trim().length >= 2
  )).length;
  const refundObligation = authoritativeActiveRefundObligationSummary(
    refundDocuments,
    paymentDocuments,
    reservationDocuments,
    FOUNDING_CAMPAIGN.id,
  );
  const refundObligationCents = refundObligation.totalCents;
  const allPayments = providerAwarePaymentEvidence(providerEvidenceDocuments);
  const payments = paymentDocuments
    .filter((document) => (
      document.data().planId === FOUNDING_CAMPAIGN.planId
      && document.data().offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion
    ))
    .map((document) => ({ id: document.id, ...document.data() })) as CampaignPayment[];
  const canonicalPaymentEvidence = canonicalPaidPaymentEvidence(
    reservations,
    allPayments,
    {
      campaignId: FOUNDING_CAMPAIGN.id,
      planId: FOUNDING_CAMPAIGN.planId,
      offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
    },
    now,
  );
  const unresolvedPaymentReviewCount = unresolvedPaymentReviewKeys(
    reservations,
    paymentDocuments,
  ).size;
  const routePlanId = typeof data.routePlanId === 'string' ? data.routePlanId : null;
  const operationalEvidenceCurrent = campaignOperationalEvidenceBlockReason(
    FOUNDING_CAMPAIGN.id,
    data,
    routePlanId,
    routePlan,
    atMs,
  ) === null;
  const ownerPrintApprovalRecorded = ownerPrintApprovalEvidence(data, atMs);
  const placementEvidence = campaignPaidPlacementEvidence(
    FOUNDING_CAMPAIGN.id,
    FOUNDING_CAMPAIGN.planId,
    FOUNDING_CAMPAIGN.offerModelVersion,
    reservationDocuments,
    placementSlotDocuments,
    placementSlotReadPossiblyTruncated,
  );
  const baseReadiness = evaluatePrintReadiness({
    clearedFundingCents: canonicalPaymentEvidence.clearedFundingCents,
    fundingGoalCents: Number(data.fundingGoalCents),
    paidReservationCount: paid.length,
    minimumPaidPlacements: Number(data.minimumPaidPlacements),
    paidProofStatuses,
    approvedMaterialCount,
    paidDisclaimerCount,
    refundObligationCents,
    refundObligationCount: refundObligation.activeCount,
    refundObligationIntegrityIssueCount: refundObligation.integrityIssueCount,
    unresolvedPaymentReviewCount,
    verifiedHouseholds: data.verifiedHouseholds === null || data.verifiedHouseholds === undefined
      ? null
      : Number(data.verifiedHouseholds),
    artworkPreflightApproved: Boolean(data.artworkPreflightApproved),
    routesConfirmed: operationalEvidenceCurrent,
    costs: campaignCostsFromRecord(data),
    minimumMarginBps: Number(data.minimumMarginBps),
    ownerPrintApproved: ownerPrintApprovalRecorded,
    pricePerPaidPlacementCents: FOUNDING_CAMPAIGN.placements.standard.priceCents,
    now,
  });
  const deliveryWindowComplete = completeCampaignDeliveryWindow(data) !== null;
  const creativeEvidenceChecks = [
    {
      key: 'delivery_schedule',
      label: 'Complete planned delivery window',
      passed: deliveryWindowComplete,
      detail: deliveryWindowComplete
        ? `${String(data.plannedDeliveryStart)} through ${String(data.plannedDeliveryEnd)}`
        : 'Both valid planned delivery dates are required',
    },
    {
      key: 'creative_briefs',
      label: 'Every paid creative brief covers the current schedule',
      passed: currentCreativeBriefCount === paid.length,
      detail: `${currentCreativeBriefCount} current for ${paid.length} paid placements`,
    },
    {
      key: 'canonical_payments',
      label: 'Every paid reservation has one fully cleared canonical payment',
      passed: canonicalPaymentEvidence.issues.length === 0
        && canonicalPaymentEvidence.verifiedPaidReservationCount === paid.length,
      detail: `${canonicalPaymentEvidence.verifiedPaidReservationCount} verified for ${paid.length} paid placements; ${canonicalPaymentEvidence.issues.length} integrity issue(s)`,
    },
    {
      key: 'placement_slots',
      label: 'Every paid reservation owns one exact sold placement slot',
      passed: placementEvidence.passed,
      detail: placementEvidence.passed
        ? `${placementEvidence.exactSoldSlotCount} exact sold slots for ${paid.length} paid placements`
        : `${placementEvidence.exactSoldSlotCount} exact sold slots for ${paid.length} paid placements; ${placementEvidence.issueCodes.join(', ') || 'placement evidence missing'}`,
    },
  ];
  const readiness = {
    ...baseReadiness,
    ready: baseReadiness.ready && creativeEvidenceChecks.every((check) => check.passed),
    checks: [...baseReadiness.checks, ...creativeEvidenceChecks],
  };
  const proofStatusCounts = proofs.reduce<Record<string, number>>((counts, proof) => {
    const status = String(proof.status || 'unknown');
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});

  return {
    readiness,
    paidAdvertiserCount,
    paidReservationCount: paid.length,
    paidProofStatuses,
    proofStatusCounts,
    outstandingPaymentCount: reservations.filter((reservation) => (
      ['hold', 'awaiting_payment'].includes(String(reservation.status))
    )).length,
    refundObligationCents,
    refundObligationCount: refundObligation.activeCount,
    refundObligationIntegrityIssueCount: refundObligation.integrityIssueCount,
    currentClearedFundingCents: clearedNetFundingCents(payments),
    canonicalClearedFundingCents: canonicalPaymentEvidence.clearedFundingCents,
    canonicalPaymentIntegrityIssueCount: canonicalPaymentEvidence.issues.length,
    unresolvedPaymentReviewCount,
  };
}
