import assert from 'node:assert/strict';
import test from 'node:test';
import { PRINTING4SUPERCHEAP } from '../src/config/eddmOfferings';
import { FOUNDING_CAMPAIGN } from '../src/config/foundingCampaign';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  EMPTY_CREATIVE_BRIEF,
  PROOF_BRIEF_REVIEW_CONFIRMATION,
} from '../src/lib/creativeBrief';
import {
  campaignPrintReadinessState,
  ownerPrintApprovalEvidence,
  type CampaignReadinessDocument,
} from '../src/lib/campaignPrintReadiness';
import { deriveRoutePlan, routePlanContentHash, type RoutePlanHashInput } from '../src/lib/routePlans';

const AT_MS = Date.parse('2026-08-21T19:00:00.000Z');
const RECORDED_AT = '2026-08-21T18:00:00.000Z';
const ROUTE_PLAN_ID = 'route-plan-1';

function document(id: string, value: Record<string, unknown>): CampaignReadinessDocument {
  return { id, data: () => value };
}

function routePlan() {
  const input: RoutePlanHashInput = {
    territoryId: 'monterey-peninsula',
    territorySlug: 'monterey-peninsula',
    territoryName: FOUNDING_CAMPAIGN.territory,
    campaignId: null,
    version: 1,
    mailingMethod: 'eddm_retail',
    audienceMode: 'residential_only',
    source: 'usps_eddm_tool',
    sourceUrl: 'https://eddm.usps.com/eddm/select-routes.htm',
    sourceReference: 'Owner-verified USPS route export',
    sourceCheckedAt: '2026-08-21',
    routes: [{
      zipCode: '93940',
      carrierRouteCode: 'C001',
      city: 'Monterey',
      routeType: 'city',
      residentialCount: FOUNDING_CAMPAIGN.targetHouseholds,
      businessCount: 0,
      poBoxCount: 0,
    }],
  };
  return {
    ...input,
    ...deriveRoutePlan(input.routes, input.audienceMode),
    contentHash: routePlanContentHash(input),
    status: 'attached',
    attachedCampaignId: FOUNDING_CAMPAIGN.id,
  };
}

function completeReadinessFixture() {
  const reservations: CampaignReadinessDocument[] = [];
  const creativeBriefs: CampaignReadinessDocument[] = [];
  const materials: CampaignReadinessDocument[] = [];
  const proofs: CampaignReadinessDocument[] = [];
  const payments: CampaignReadinessDocument[] = [];
  const refunds: CampaignReadinessDocument[] = [];
  const slots: CampaignReadinessDocument[] = [];

  for (let index = 1; index <= FOUNDING_CAMPAIGN.minimumPaidPlacements; index += 1) {
    const reservationId = `reservation-${index}`;
    const placementSlotId = `slot-${index}`;
    const creativeBriefId = `creative-brief-${index}`;
    const materialId = `material-${index}`;
    const proofId = `proof-${index}`;
    reservations.push(document(reservationId, {
      status: 'paid',
      campaignId: FOUNDING_CAMPAIGN.id,
      planId: FOUNDING_CAMPAIGN.planId,
      offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
      placementSlotId,
      emailNormalized: `advertiser-${index}@example.com`,
      advertiserDisclaimer: 'Advertiser is responsible for the accuracy of this offer.',
      quotedPriceCents: FOUNDING_CAMPAIGN.placements.standard.priceCents,
      latestCreativeBriefId: creativeBriefId,
      creativeBriefSequence: 1,
      latestMaterialId: materialId,
      materialSequence: 1,
      materialManifest: { logo: { materialId, version: 1 } },
      latestProofId: proofId,
      proofSequence: 1,
    }));
    slots.push(document(placementSlotId, {
      campaignId: FOUNDING_CAMPAIGN.id,
      planId: FOUNDING_CAMPAIGN.planId,
      offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
      status: 'sold',
      reservationId,
    }));
    creativeBriefs.push(document(creativeBriefId, {
      reservationId,
      campaignId: FOUNDING_CAMPAIGN.id,
      placementSlotId,
      version: 1,
      status: 'owner_reviewed',
      reviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION,
      reviewedBy: 'owner-uid',
      reviewedAt: RECORDED_AT,
      deliveryWindow: {
        startDate: '2026-09-01',
        endDate: '2026-09-15',
        timeZone: 'America/Los_Angeles',
        validationStatus: 'validated_for_planned_window',
      },
      content: {
        ...EMPTY_CREATIVE_BRIEF,
        businessDisplayName: `Advertiser ${index}`,
        factualOffer: 'A factual campaign offer.',
        callToAction: 'Contact the advertiser.',
        effectiveOn: '2026-09-01',
        expiresOn: '2026-09-30',
      },
    }));
    materials.push(document(materialId, {
      reservationId,
      campaignId: FOUNDING_CAMPAIGN.id,
      placementSlotId,
      version: 1,
      assetKind: 'logo',
      status: 'owner_approved_private',
      reviewedBy: 'owner-uid',
      reviewedAt: RECORDED_AT,
      rightsAttestedAt: RECORDED_AT,
      rightsAttestation: {
        assetKind: 'logo',
        rightsBasis: 'business_owned',
        attestorName: 'Business Owner',
        sourceOrLicenseNote: '',
        rightsAttested: true,
        statementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
      },
    }));
    proofs.push(document(proofId, {
      reservationId,
      campaignId: FOUNDING_CAMPAIGN.id,
      placementSlotId,
      version: 1,
      creativeBriefId,
      creativeBriefVersion: 1,
      materialBindings: [{ assetKind: 'logo', materialId, materialVersion: 1 }],
      status: 'approved',
      approvedBy: 'Advertiser Approver',
      approvedAt: RECORDED_AT,
    }));
    payments.push(document(reservationId, {
      reservationId,
      campaignId: FOUNDING_CAMPAIGN.id,
      planId: FOUNDING_CAMPAIGN.planId,
      offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
      provider: 'stripe',
      externalPaymentId: `pi_${index}`,
      externalSessionId: `cs_${index}`,
      currency: 'usd',
      amountCents: FOUNDING_CAMPAIGN.placements.standard.priceCents,
      refundedCents: 0,
      status: 'cleared',
      clearedAt: RECORDED_AT,
    }));
  }

  const plan = routePlan();
  const campaign = {
    fundingGoalCents: FOUNDING_CAMPAIGN.fundingGoalCents,
    minimumPaidPlacements: FOUNDING_CAMPAIGN.minimumPaidPlacements,
    minimumMarginBps: FOUNDING_CAMPAIGN.minimumMarginBps,
    targetHouseholds: FOUNDING_CAMPAIGN.targetHouseholds,
    verifiedHouseholds: FOUNDING_CAMPAIGN.targetHouseholds,
    territory: FOUNDING_CAMPAIGN.territory,
    plannedDeliveryStart: '2026-09-01',
    plannedDeliveryEnd: '2026-09-15',
    artworkPreflightApproved: true,
    ownerPrintApproved: true,
    printReadyAt: RECORDED_AT,
    economicsVerified: true,
    economicsVerifiedAt: { toMillis: () => AT_MS - 60_000 },
    routesConfirmed: true,
    routePlanId: ROUTE_PLAN_ID,
    routePlanVersion: plan.version,
    routePlanSource: plan.source,
    routePlanSourceCheckedAt: plan.sourceCheckedAt,
    costs: {
      supplierId: PRINTING4SUPERCHEAP.id,
      mailPieceCount: FOUNDING_CAMPAIGN.targetHouseholds,
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
      printerQuoteReference: 'Owner-verified Printing4SuperCheap quote',
      quoteVerifiedAt: '2026-08-21',
      version: 1,
    },
  };
  return { campaign, plan, reservations, creativeBriefs, materials, proofs, payments, refunds, slots };
}

function readiness(fixture: ReturnType<typeof completeReadinessFixture>) {
  return campaignPrintReadinessState(
    fixture.campaign,
    fixture.reservations,
    fixture.proofs,
    fixture.refunds,
    fixture.materials,
    fixture.creativeBriefs,
    fixture.payments,
    fixture.plan,
    AT_MS,
    fixture.payments,
    fixture.slots,
  );
}

test('the lifecycle print gate accepts only a complete transaction snapshot', () => {
  const fixture = completeReadinessFixture();
  const result = readiness(fixture);
  assert.equal(result.readiness.ready, true);
  assert.equal(result.canonicalPaymentIntegrityIssueCount, 0);
  assert.equal(result.unresolvedPaymentReviewCount, 0);
});

test('the lifecycle print gate fails closed without exact reciprocal sold placement slots', () => {
  const fixture = completeReadinessFixture();
  fixture.slots = fixture.slots.slice(1);
  const missing = readiness(fixture);
  assert.equal(missing.readiness.ready, false);
  assert.equal(
    missing.readiness.checks.find((check) => check.key === 'placement_slots')?.passed,
    false,
  );

  const saturatedFixture = completeReadinessFixture();
  const saturated = campaignPrintReadinessState(
    saturatedFixture.campaign,
    saturatedFixture.reservations,
    saturatedFixture.proofs,
    saturatedFixture.refunds,
    saturatedFixture.materials,
    saturatedFixture.creativeBriefs,
    saturatedFixture.payments,
    saturatedFixture.plan,
    AT_MS,
    saturatedFixture.payments,
    saturatedFixture.slots,
    true,
  );
  assert.equal(saturated.readiness.ready, false);
  assert.equal(
    saturated.readiness.checks.find((check) => check.key === 'placement_slots')?.passed,
    false,
  );
});

test('owner print approval requires persisted nonfuture evidence unless approval is explicitly in progress', () => {
  assert.equal(ownerPrintApprovalEvidence({ ownerPrintApproved: true }, AT_MS), false);
  assert.equal(ownerPrintApprovalEvidence({
    ownerPrintApproved: true,
    printReadyAt: { toMillis: () => AT_MS + 1 },
  }, AT_MS), false);
  assert.equal(ownerPrintApprovalEvidence({
    ownerPrintApproved: true,
    printReadyAt: RECORDED_AT,
  }, AT_MS), true);
  assert.equal(ownerPrintApprovalEvidence(
    { ownerPrintApproved: true, printReadyAt: null },
    AT_MS,
    AT_MS,
  ), true);
  assert.equal(ownerPrintApprovalEvidence(
    { ownerPrintApproved: true, printReadyAt: null },
    AT_MS,
    AT_MS + 1,
  ), false);
  assert.equal(ownerPrintApprovalEvidence(
    { ownerPrintApproved: false, printReadyAt: RECORDED_AT },
    AT_MS,
    AT_MS,
  ), false);
});

test('linked and globally orphaned active refunds fail closed despite corrupt campaign bindings', () => {
  for (const [id, corruptRefund] of [
    ['wrong-campaign', {
      campaignId: 'wrong-campaign',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
    }],
    ['missing-campaign', {
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
    }],
    ['founding-orphan', {
      campaignId: FOUNDING_CAMPAIGN.id,
      paymentId: 'missing-payment',
      reservationId: 'missing-reservation',
    }],
    ['global-orphan', {
      campaignId: 'wrong-campaign',
      paymentId: 'missing-payment',
      reservationId: 'missing-reservation',
    }],
    ['unknown-status', {
      campaignId: FOUNDING_CAMPAIGN.id,
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
      status: 'requestd',
    }],
    ['whitespace-status', {
      campaignId: FOUNDING_CAMPAIGN.id,
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
      status: 'requested ',
    }],
    ['global-unknown-status', {
      campaignId: 'wrong-campaign',
      paymentId: 'missing-payment',
      reservationId: 'missing-reservation',
      status: 'requestd',
    }],
  ] as const) {
    const fixture = completeReadinessFixture();
    fixture.refunds.push(document(id, {
      status: 'requested',
      amountCents: 100,
      ...corruptRefund,
    }));
    const result = readiness(fixture);
    assert.equal(result.readiness.ready, false, id);
    if (!['unknown-status', 'whitespace-status', 'global-unknown-status'].includes(id)) {
      assert.equal(result.refundObligationCount, 1, id);
    }
    assert.ok(result.refundObligationIntegrityIssueCount > 0, id);
  }
});

test('the lifecycle print gate fails closed when a current source pointer changes', () => {
  const fixture = completeReadinessFixture();
  const first = fixture.reservations[0];
  const current = first.data();
  fixture.reservations[0] = document(first.id, {
    ...current,
    latestMaterialId: 'material-from-an-older-state',
  });
  const result = readiness(fixture);
  assert.equal(result.readiness.ready, false);
  assert.equal(result.readiness.checks.find((check) => check.key === 'materials')?.passed, false);
  assert.equal(result.readiness.checks.find((check) => check.key === 'proofs')?.passed, false);
});

test('the lifecycle print gate cannot count one Stripe payment for two reservations', () => {
  const fixture = completeReadinessFixture();
  const firstExternalPaymentId = fixture.payments[0].data().externalPaymentId;
  const second = fixture.payments[1];
  fixture.payments[1] = document(second.id, {
    ...second.data(),
    externalPaymentId: firstExternalPaymentId,
  });
  const result = readiness(fixture);
  assert.equal(result.readiness.ready, false);
  assert.ok(result.canonicalPaymentIntegrityIssueCount > 0);
  assert.equal(
    result.canonicalClearedFundingCents,
    FOUNDING_CAMPAIGN.fundingGoalCents
      - 2 * FOUNDING_CAMPAIGN.placements.standard.priceCents,
  );
});

test('the lifecycle print gate sees a provider identity collision from another campaign', () => {
  const fixture = completeReadinessFixture();
  const firstPayment = fixture.payments[0].data();
  const crossCampaignCollision = document('other-campaign-reservation', {
    reservationId: 'other-campaign-reservation',
    campaignId: 'other-campaign',
    planId: 'other-plan',
    offerModelVersion: 'other-version',
    provider: 'stripe',
    externalPaymentId: firstPayment.externalPaymentId,
    externalSessionId: firstPayment.externalSessionId,
    currency: 'usd',
    amountCents: firstPayment.amountCents,
    refundedCents: 0,
    status: 'cleared',
    clearedAt: RECORDED_AT,
  });
  const result = campaignPrintReadinessState(
    fixture.campaign,
    fixture.reservations,
    fixture.proofs,
    fixture.refunds,
    fixture.materials,
    fixture.creativeBriefs,
    fixture.payments,
    fixture.plan,
    AT_MS,
    [...fixture.payments, crossCampaignCollision],
    fixture.slots,
  );
  assert.equal(result.readiness.ready, false);
  assert.ok(result.canonicalPaymentIntegrityIssueCount > 0);
  assert.equal(
    result.canonicalClearedFundingCents,
    FOUNDING_CAMPAIGN.fundingGoalCents - FOUNDING_CAMPAIGN.placements.standard.priceCents,
  );
});

test('the lifecycle print gate rejects cross-campaign whitespace provider twins', () => {
  const fixture = completeReadinessFixture();
  const firstPayment = fixture.payments[0].data();
  const crossCampaignWhitespaceTwin = document('other-campaign-reservation', {
    reservationId: 'other-campaign-reservation',
    campaignId: 'other-campaign',
    planId: 'other-plan',
    offerModelVersion: 'other-version',
    provider: 'stripe',
    externalPaymentId: ` ${String(firstPayment.externalPaymentId)} `,
    externalCheckoutSessionId: ` ${String(firstPayment.externalSessionId)} `,
    currency: 'usd',
    amountCents: firstPayment.amountCents,
    refundedCents: 0,
    status: 'cleared',
    clearedAt: RECORDED_AT,
  });
  const result = campaignPrintReadinessState(
    fixture.campaign,
    fixture.reservations,
    fixture.proofs,
    fixture.refunds,
    fixture.materials,
    fixture.creativeBriefs,
    fixture.payments,
    fixture.plan,
    AT_MS,
    [...fixture.payments, crossCampaignWhitespaceTwin],
    fixture.slots,
  );
  assert.equal(result.readiness.ready, false);
  assert.ok(result.canonicalPaymentIntegrityIssueCount > 0);
  assert.equal(
    result.canonicalClearedFundingCents,
    FOUNDING_CAMPAIGN.fundingGoalCents - FOUNDING_CAMPAIGN.placements.standard.priceCents,
  );
});

test('active zero or offsetting corrupted refund records cannot disappear from readiness', () => {
  const zeroFixture = completeReadinessFixture();
  zeroFixture.refunds.push(document('refund-zero', {
    campaignId: FOUNDING_CAMPAIGN.id,
    paymentId: zeroFixture.payments[0].id,
    reservationId: zeroFixture.reservations[0].id,
    status: 'requested',
    amountCents: 0,
  }));
  const zeroResult = readiness(zeroFixture);
  assert.equal(zeroResult.readiness.ready, false);
  assert.equal(zeroResult.refundObligationCount, 1);
  assert.equal(zeroResult.refundObligationIntegrityIssueCount, 1);

  const offsetFixture = completeReadinessFixture();
  offsetFixture.refunds.push(
    document('refund-positive', {
      campaignId: FOUNDING_CAMPAIGN.id,
      paymentId: offsetFixture.payments[0].id,
      reservationId: offsetFixture.reservations[0].id,
      status: 'approved',
      amountCents: 10_000,
    }),
    document('refund-negative', {
      campaignId: FOUNDING_CAMPAIGN.id,
      paymentId: offsetFixture.payments[1].id,
      reservationId: offsetFixture.reservations[1].id,
      status: 'submitted',
      amountCents: -10_000,
    }),
  );
  const offsetResult = readiness(offsetFixture);
  assert.equal(offsetResult.readiness.ready, false);
  assert.equal(offsetResult.refundObligationCents, 10_000);
  assert.equal(offsetResult.refundObligationCount, 2);
  assert.equal(offsetResult.refundObligationIntegrityIssueCount, 1);
});

test('terminal zero-confirmed refund evidence fails authoritative readiness closed', () => {
  const fixture = completeReadinessFixture();
  fixture.refunds.push(document('refund-zero-confirmed', {
    campaignId: FOUNDING_CAMPAIGN.id,
    paymentId: fixture.payments[0].id,
    reservationId: fixture.reservations[0].id,
    status: 'confirmed',
    amountCents: 0,
  }));
  const result = readiness(fixture);
  assert.equal(result.canonicalPaymentIntegrityIssueCount, 0);
  assert.equal(result.refundObligationCount, 0);
  assert.equal(result.refundObligationIntegrityIssueCount, 1);
  assert.equal(result.readiness.ready, false);
  assert.equal(
    result.readiness.checks.find((check) => check.key === 'refunds')?.passed,
    false,
  );

  const unboundFixture = completeReadinessFixture();
  unboundFixture.refunds.push(document('refund-unbound-confirmed', {
    status: 'confirmed',
    amountCents: 0,
    originalAmountCents: 100,
    providerRefundedCents: 100,
  }));
  const unboundResult = readiness(unboundFixture);
  assert.equal(unboundResult.readiness.ready, false);
  assert.equal(unboundResult.refundObligationIntegrityIssueCount, 1);
});
