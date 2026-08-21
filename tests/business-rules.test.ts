import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateCostSummary,
  categoryConflict,
  clearedNetFundingCents,
  evaluatePrintReadiness,
  hasApprovedLatestMaterial,
  isActiveHold,
  latestProofStatus,
  quoteVerificationStatus,
  reservedFundingCents,
} from '../src/lib/businessRules';
import type {
  CampaignCosts,
  CampaignPayment,
  CampaignReservation,
  ProofStatus,
} from '../src/lib/campaignTypes';

const now = new Date('2026-08-18T00:00:00.000Z');

function reservation(
  overrides: Partial<CampaignReservation> = {},
): CampaignReservation {
  return {
    publicReference: 'CM-TEST',
    accessTokenHash: 'hash',
    campaignId: 'campaign',
    planId: 'shared-9x12-5000',
    offerModelVersion: 'shared-mailers-v2',
    categorySlug: 'plumbing',
    placementSize: 'standard',
    businessName: 'Test Business',
    contactName: 'Owner',
    email: 'owner@example.com',
    advertisedOffer: 'A factual offer',
    quotedPriceCents: 59_900,
    status: 'hold',
    holdExpiresAt: '2026-08-18T01:00:00.000Z',
    termsVersion: 'v1',
    fundingPolicyVersion: 'v1',
    termsAcceptedAt: now.toISOString(),
    refundPolicyAcceptedAt: now.toISOString(),
    proofAcknowledgedAt: now.toISOString(),
    createdAt: now.toISOString(),
    ...overrides,
  };
}

function payment(overrides: Partial<CampaignPayment> = {}): CampaignPayment {
  return {
    campaignId: 'campaign',
    reservationId: 'reservation',
    provider: 'stripe',
    amountCents: 59_900,
    refundedCents: 0,
    status: 'cleared',
    ...overrides,
  };
}

const completeCosts: CampaignCosts = {
  supplierId: 'printing4supercheap',
  mailPieceCount: 5_000,
  printingCostCents: 100_000,
  postageCostCents: 125_000,
  shippingCostCents: 10_000,
  taxCostCents: 0,
  designCostCents: 20_000,
  ownerLaborCostCents: 0,
  processingFeeCents: 20_000,
  refundReserveCents: 25_000,
  reprintReserveCents: 25_000,
  softwareAllocationCents: 5_000,
  otherExpensesCents: 5_000,
  targetOwnerSurplusCents: 250_000,
  printerQuoteReference: 'TEST QUOTE — NOT A REAL VENDOR QUOTE',
  quoteVerifiedAt: '2026-08-18T00:00:00.000Z',
  version: 1,
};

test('two advertisers cannot claim the same exclusive or conflicting category', () => {
  const conflicts = { plumbing: ['hvac'], hvac: ['plumbing'] };
  assert.equal(categoryConflict('plumbing', ['plumbing'], conflicts), 'plumbing');
  assert.equal(categoryConflict('plumbing', ['hvac'], conflicts), 'hvac');
  assert.equal(categoryConflict('plumbing', ['roofing'], conflicts), null);
});

test('unpaid holds expire and no longer count as reserved funding', () => {
  const active = reservation();
  const expired = reservation({ holdExpiresAt: '2026-08-17T23:59:59.000Z' });
  assert.equal(isActiveHold(active, now), true);
  assert.equal(isActiveHold(expired, now), false);
  assert.equal(reservedFundingCents([active, expired], now), 59_900);
});

test('reserved amounts never count as cleared funding', () => {
  assert.equal(reservedFundingCents([reservation()], now), 59_900);
  assert.equal(clearedNetFundingCents([]), 0);
});

test('failed and cancelled payments do not count toward funding', () => {
  assert.equal(
    clearedNetFundingCents([
      payment({ status: 'failed' }),
      payment({ status: 'cancelled' }),
      payment({ status: 'pending' }),
    ]),
    0,
  );
});

test('refunds reduce funding and disputes are excluded', () => {
  assert.equal(
    clearedNetFundingCents([
      payment({ status: 'partially_refunded', refundedCents: 10_000 }),
      payment({ status: 'refunded', refundedCents: 59_900 }),
      payment({ status: 'disputed' }),
    ]),
    49_900,
  );
});

test('only the reservation latest material can satisfy approval', () => {
  const materials = [
    { id: 'old-approved', reservationId: 'reservation-1', status: 'owner_approved_private' },
    { id: 'new-pending', reservationId: 'reservation-1', status: 'quarantine_pending_owner_review' },
  ];
  assert.equal(hasApprovedLatestMaterial({ id: 'reservation-1', latestMaterialId: 'new-pending' }, materials), false);
  assert.equal(hasApprovedLatestMaterial({ id: 'reservation-1', latestMaterialId: 'old-approved' }, materials), true);
  assert.equal(hasApprovedLatestMaterial({ id: 'reservation-1' }, materials), false);
});

test('proof readiness follows the exact latest proof id even when versions tie', () => {
  const proofs = [
    { id: 'approved-v2', reservationId: 'reservation-1', version: 2, status: 'approved' },
    { id: 'pending-v2', reservationId: 'reservation-1', version: 2, status: 'proof_sent' },
  ];
  assert.equal(latestProofStatus({ id: 'reservation-1', latestProofId: 'pending-v2' }, proofs), 'proof_sent');
  assert.equal(latestProofStatus({ id: 'reservation-1', latestProofId: 'approved-v2' }, proofs), 'approved');
  assert.equal(latestProofStatus({ id: 'reservation-1' }, proofs), 'waiting_for_materials');
});

test('campaign cannot become print-ready below the funding goal', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 649_999,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: Array<ProofStatus>(10).fill('approved'),
    approvedMaterialCount: 10,
    paidDisclaimerCount: 10,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: completeCosts,
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 65_000,
    now,
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.key === 'funding')?.passed, false);
});

test('campaign cannot become print-ready with an unapproved proof', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 700_000,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: [
      ...Array<ProofStatus>(9).fill('approved'),
      'revision_requested',
    ],
    approvedMaterialCount: 10,
    paidDisclaimerCount: 10,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: completeCosts,
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 65_000,
    now,
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.key === 'proofs')?.passed, false);
});

test('print readiness requires complete costs and explicit owner approval', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 700_000,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: Array<ProofStatus>(10).fill('locked_for_print'),
    approvedMaterialCount: 10,
    paidDisclaimerCount: 10,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: { ...completeCosts, postageCostCents: null },
    minimumMarginBps: 2_000,
    ownerPrintApproved: false,
    pricePerPaidPlacementCents: 65_000,
    now,
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.key === 'costs')?.passed, false);
  assert.equal(result.checks.find((check) => check.key === 'owner')?.passed, false);
});

test('cost verification requires the configured Printing4SuperCheap supplier', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 700_000,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: Array<ProofStatus>(10).fill('approved'),
    approvedMaterialCount: 10,
    paidDisclaimerCount: 10,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: { ...completeCosts, supplierId: null },
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 65_000,
    now,
  });
  assert.equal(result.ready, false);
  assert.match(result.costSummary.missingInputs.join(','), /supplierId/);
});

test('print readiness blocks missing materials, quantity shortfalls, and open refunds', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 700_000,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: Array<ProofStatus>(10).fill('approved'),
    approvedMaterialCount: 9,
    paidDisclaimerCount: 10,
    refundObligationCents: 59_900,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_001,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: completeCosts,
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 65_000,
    now,
  });
  assert.equal(result.ready, false);
  assert.equal(result.checks.find((check) => check.key === 'materials')?.passed, false);
  assert.equal(result.checks.find((check) => check.key === 'mail_quantity')?.passed, false);
  assert.equal(result.checks.find((check) => check.key === 'refunds')?.passed, false);
});

test('cash contribution and economic surplus separate owner labor and tax transparently', () => {
  const costs: CampaignCosts = {
    ...completeCosts,
    taxCostCents: 12_100,
    ownerLaborCostCents: 150_000,
  };
  const result = calculateCostSummary(costs, 700_000, 65_000, now);
  assert.equal(result.cashCostCents, 347_100);
  assert.equal(result.totalCostCents, 497_100);
  assert.equal(result.cashContributionBeforeOwnerLaborCents, 352_900);
  assert.equal(result.economicSurplusBeforeIncomeTaxCents, 202_900);
  assert.equal(result.grossContributionCents, 202_900);
  assert.equal(result.targetOwnerSurplusCents, 250_000);
  assert.equal(result.targetGapCents, -47_100);
  assert.equal(result.breakEvenPaidPlacementCount, 8);
});

test('blank cost and target fields stay unknown while deliberate zero is complete', () => {
  const deliberateZero = calculateCostSummary(completeCosts, 700_000, 65_000, now);
  assert.equal(deliberateZero.missingInputs.includes('taxCostCents'), false);
  assert.equal(deliberateZero.missingInputs.includes('ownerLaborCostCents'), false);
  assert.equal(deliberateZero.totalCostCents, 335_000);

  for (const field of ['taxCostCents', 'ownerLaborCostCents', 'targetOwnerSurplusCents'] as const) {
    const unknown = calculateCostSummary({ ...completeCosts, [field]: null }, 700_000, 65_000, now);
    assert.equal(unknown.totalCostCents, null);
    assert.ok(unknown.missingInputs.includes(field));
  }
});

test('quote verification is current only inside the supplier recheck window and never in the future', () => {
  assert.equal(quoteVerificationStatus('2026-07-19', now).current, true);
  assert.equal(quoteVerificationStatus('2026-07-18', now).blocker, 'quoteVerifiedAt is stale');
  assert.equal(quoteVerificationStatus('2026-08-19', now).blocker, 'quoteVerifiedAt cannot be in the future');
  assert.equal(quoteVerificationStatus('not-a-date', now).blocker, 'quoteVerifiedAt is invalid');

  const stale = calculateCostSummary({ ...completeCosts, quoteVerifiedAt: '2026-07-18' }, 700_000, 65_000, now);
  assert.equal(stale.quoteCurrent, false);
  assert.equal(stale.totalCostCents, null);
  assert.match(stale.missingInputs.join(','), /stale/);
});

test('readiness counts paid placements and blocks a shortfall even when other gates pass', () => {
  const result = evaluatePrintReadiness({
    clearedFundingCents: 837_600,
    fundingGoalCents: 837_600,
    paidReservationCount: 23,
    minimumPaidPlacements: 24,
    paidProofStatuses: Array<ProofStatus>(23).fill('approved'),
    approvedMaterialCount: 23,
    paidDisclaimerCount: 23,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: completeCosts,
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 34_900,
    now,
  });
  assert.equal(result.checks.find((check) => check.key === 'paid_placements')?.passed, false);
  assert.match(result.checks.find((check) => check.key === 'paid_placements')?.detail ?? '', /23 of 24/);
});

test('print readiness requires the explicit pre-income-tax surplus target', () => {
  const input = {
    clearedFundingCents: 700_000,
    fundingGoalCents: 650_000,
    paidReservationCount: 10,
    minimumPaidPlacements: 10,
    paidProofStatuses: Array<ProofStatus>(10).fill('approved'),
    approvedMaterialCount: 10,
    paidDisclaimerCount: 10,
    refundObligationCents: 0,
    unresolvedPaymentReviewCount: 0,
    verifiedHouseholds: 5_000,
    artworkPreflightApproved: true,
    routesConfirmed: true,
    costs: { ...completeCosts, taxCostCents: 12_100, ownerLaborCostCents: 150_000 },
    minimumMarginBps: 2_000,
    ownerPrintApproved: true,
    pricePerPaidPlacementCents: 65_000,
    now,
  };
  const belowTarget = evaluatePrintReadiness(input);
  assert.equal(belowTarget.checks.find((check) => check.key === 'margin')?.passed, true);
  assert.equal(belowTarget.checks.find((check) => check.key === 'economic_surplus_target')?.passed, false);
  assert.equal(belowTarget.ready, false);

  const atLowerExplicitTarget = evaluatePrintReadiness({
    ...input,
    costs: { ...input.costs, targetOwnerSurplusCents: 200_000 },
  });
  assert.equal(atLowerExplicitTarget.checks.find((check) => check.key === 'economic_surplus_target')?.passed, true);

  const underPaymentReview = evaluatePrintReadiness({
    ...input,
    costs: { ...input.costs, targetOwnerSurplusCents: 200_000 },
    unresolvedPaymentReviewCount: 1,
  });
  assert.equal(underPaymentReview.checks.find((check) => check.key === 'payment_reviews')?.passed, false);
  assert.equal(underPaymentReview.ready, false);
});
