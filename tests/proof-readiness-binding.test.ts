import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalPaidPaymentEvidence,
  completeCampaignDeliveryWindow,
  hasCurrentApprovedMaterialWithRights,
  hasCurrentCreativeBrief,
  latestBoundProofStatus,
} from '../src/lib/businessRules';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  CREATIVE_BRIEF_STATUS,
  EMPTY_CREATIVE_BRIEF,
} from '../src/lib/creativeBrief';

const campaign = {
  plannedDeliveryStart: '2026-09-10',
  plannedDeliveryEnd: '2026-09-20',
};
const reservation = {
  id: 'reservation-1',
  status: 'paid',
  campaignId: 'campaign-1',
  planId: 'plan-1',
  offerModelVersion: 'model-1',
  quotedPriceCents: 50_000,
  placementSlotId: 'slot-1',
  latestCreativeBriefId: 'brief-2',
  creativeBriefSequence: 2,
  latestMaterialId: 'material-3',
  materialSequence: 3,
  latestProofId: 'proof-4',
  proofSequence: 4,
};
const creativeBrief = {
  id: 'brief-2',
  reservationId: 'reservation-1',
  campaignId: 'campaign-1',
  placementSlotId: 'slot-1',
  version: 2,
  status: CREATIVE_BRIEF_STATUS,
  deliveryWindow: {
    startDate: '2026-09-10',
    endDate: '2026-09-20',
    timeZone: 'America/Los_Angeles',
    validationStatus: 'validated_for_planned_window',
  },
  content: {
    ...EMPTY_CREATIVE_BRIEF,
    businessDisplayName: 'Exact Business',
    factualOffer: '$20 off a qualifying service',
    callToAction: 'Book now',
    effectiveOn: '2026-09-01',
    expiresOn: '2026-09-30',
  },
};
const material = {
  id: 'material-3',
  reservationId: 'reservation-1',
  campaignId: 'campaign-1',
  placementSlotId: 'slot-1',
  version: 3,
  status: 'owner_approved_private',
  assetKind: 'logo',
  rightsAttestedAt: '2026-08-20T12:00:00.000Z',
  reviewedAt: '2026-08-20T12:30:00.000Z',
  reviewedBy: 'owner-uid',
  rightsAttestation: {
    assetKind: 'logo',
    rightsBasis: 'business_owned',
    attestorName: 'Jane Owner',
    sourceOrLicenseNote: '',
    rightsAttested: true,
    statementVersion: ASSET_RIGHTS_STATEMENT_VERSION,
  },
};
const proof = {
  id: 'proof-4',
  reservationId: 'reservation-1',
  campaignId: 'campaign-1',
  placementSlotId: 'slot-1',
  version: 4,
  creativeBriefId: 'brief-2',
  creativeBriefVersion: 2,
  materialId: 'material-3',
  materialVersion: 3,
  status: 'approved',
  approvedAt: '2026-08-20T13:00:00.000Z',
  approvedBy: 'Jane Owner',
};
const now = new Date('2026-08-20T14:00:00.000Z');
const expectedPaymentModel = {
  campaignId: 'campaign-1',
  planId: 'plan-1',
  offerModelVersion: 'model-1',
};
const payment = {
  id: 'reservation-1',
  reservationId: 'reservation-1',
  campaignId: 'campaign-1',
  planId: 'plan-1',
  offerModelVersion: 'model-1',
  provider: 'stripe',
  externalPaymentId: 'pi_verified',
  currency: 'usd',
  amountCents: 50_000,
  refundedCents: 0,
  status: 'cleared',
  clearedAt: '2026-08-20T13:00:00.000Z',
};

test('complete delivery windows fail closed for missing, impossible, or reversed dates', () => {
  assert.deepEqual(completeCampaignDeliveryWindow(campaign), {
    startDate: '2026-09-10',
    endDate: '2026-09-20',
  });
  assert.equal(completeCampaignDeliveryWindow({ ...campaign, plannedDeliveryEnd: null }), null);
  assert.equal(completeCampaignDeliveryWindow({ ...campaign, plannedDeliveryEnd: '2026-02-29' }), null);
  assert.equal(completeCampaignDeliveryWindow({ ...campaign, plannedDeliveryStart: '2026-10-01' }), null);
});

test('current creative evidence requires exact version and placement plus offer coverage', () => {
  assert.equal(hasCurrentCreativeBrief(reservation, creativeBrief, campaign), true);
  assert.equal(hasCurrentCreativeBrief(reservation, { ...creativeBrief, version: 1 }, campaign), false);
  assert.equal(hasCurrentCreativeBrief(reservation, { ...creativeBrief, placementSlotId: 'slot-2' }, campaign), false);
  assert.equal(hasCurrentCreativeBrief(reservation, creativeBrief, { ...campaign, plannedDeliveryEnd: null }), false);
  assert.equal(hasCurrentCreativeBrief(reservation, {
    ...creativeBrief,
    deliveryWindow: { ...creativeBrief.deliveryWindow, endDate: '2026-09-21' },
  }, campaign), false);
  assert.equal(hasCurrentCreativeBrief(reservation, {
    ...creativeBrief,
    content: { ...creativeBrief.content, expiresOn: '2026-09-15' },
  }, campaign), false);
});

test('current material evidence requires exact owner approval and complete matching rights', () => {
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, material), true);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, { ...material, version: 2 }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, { ...material, placementSlotId: 'slot-2' }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, { ...material, rightsAttestedAt: null }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, { ...material, reviewedBy: '' }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, { ...material, reviewedAt: null }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, {
    ...material,
    rightsAttestation: { ...material.rightsAttestation, statementVersion: 'old' },
  }), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, {
    ...material,
    assetKind: 'brand_image',
  }), false);
});

test('approved proof status requires exact current bindings and recorded written approval', () => {
  assert.equal(latestBoundProofStatus(reservation, proof, now), 'approved');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, materialVersion: 2 }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, creativeBriefId: 'brief-1' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, placementSlotId: 'slot-2' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, approvedBy: '' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, approvedAt: null }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, {
    ...proof,
    approvedAt: '2026-08-21T00:00:00.000Z',
  }, now), 'waiting_for_materials');
});

test('canonical paid payment evidence requires one exact fully-cleared payment at the quote', () => {
  assert.deepEqual(
    canonicalPaidPaymentEvidence([reservation], [payment], expectedPaymentModel, now),
    {
      clearedFundingCents: 50_000,
      paidReservationCount: 1,
      verifiedPaidReservationCount: 1,
      issues: [],
    },
  );

  const partiallyRefunded = canonicalPaidPaymentEvidence(
    [reservation],
    [{ ...payment, status: 'partially_refunded', refundedCents: 100 }],
    expectedPaymentModel,
    now,
  );
  assert.equal(partiallyRefunded.clearedFundingCents, 0);
  assert.equal(partiallyRefunded.verifiedPaidReservationCount, 0);
  assert.ok(partiallyRefunded.issues.includes('paid_payment_refund_present_or_invalid'));

  const wrongQuote = canonicalPaidPaymentEvidence(
    [reservation],
    [{ ...payment, amountCents: 49_999 }],
    expectedPaymentModel,
    now,
  );
  assert.equal(wrongQuote.clearedFundingCents, 0);
  assert.ok(wrongQuote.issues.includes('paid_payment_quote_mismatch'));

  const missingProviderEvidence = canonicalPaidPaymentEvidence(
    [reservation],
    [{ ...payment, externalPaymentId: '', clearedAt: null }],
    expectedPaymentModel,
    now,
  );
  assert.equal(missingProviderEvidence.clearedFundingCents, 0);
  assert.ok(missingProviderEvidence.issues.includes('paid_payment_not_fully_cleared'));
});

test('canonical paid payment evidence fails closed on duplicates, orphans, and model mismatches', () => {
  const duplicate = canonicalPaidPaymentEvidence(
    [reservation],
    [payment, { ...payment, id: 'duplicate-payment' }],
    expectedPaymentModel,
    now,
  );
  assert.equal(duplicate.clearedFundingCents, 0);
  assert.equal(duplicate.verifiedPaidReservationCount, 0);
  assert.ok(duplicate.issues.includes('paid_payment_duplicate'));

  const orphan = canonicalPaidPaymentEvidence(
    [reservation],
    [payment, { ...payment, id: 'orphan-payment', reservationId: 'missing-reservation' }],
    expectedPaymentModel,
    now,
  );
  assert.ok(orphan.issues.includes('payment_orphan'));

  const mismatchedModel = canonicalPaidPaymentEvidence(
    [reservation],
    [{ ...payment, planId: 'old-plan' }],
    expectedPaymentModel,
    now,
  );
  assert.equal(mismatchedModel.clearedFundingCents, 0);
  assert.ok(mismatchedModel.issues.includes('payment_campaign_or_offer_model_mismatch'));
  assert.ok(mismatchedModel.issues.includes('paid_payment_binding_mismatch'));
});
