import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalPaymentProviderIdentifier,
  canonicalPaidPaymentEvidence,
  completeCampaignDeliveryWindow,
  hasCurrentApprovedMaterialWithRights,
  hasCurrentCreativeBrief,
  latestBoundProofStatus,
} from '../src/lib/businessRules';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  CREATIVE_BRIEF_REVIEWED_STATUS,
  CREATIVE_BRIEF_STATUS,
  EMPTY_CREATIVE_BRIEF,
  PROOF_BRIEF_REVIEW_CONFIRMATION,
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
  latestMaterialId: 'material-4',
  materialSequence: 4,
  materialManifest: {
    logo: { materialId: 'material-3', version: 3 },
    brand_image: { materialId: 'material-4', version: 4 },
  },
  latestProofId: 'proof-4',
  proofSequence: 4,
};
const creativeBrief = {
  id: 'brief-2',
  reservationId: 'reservation-1',
  campaignId: 'campaign-1',
  placementSlotId: 'slot-1',
  version: 2,
  status: CREATIVE_BRIEF_REVIEWED_STATUS,
  reviewedAt: '2026-08-20T12:45:00.000Z',
  reviewedBy: 'owner-uid',
  reviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION,
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
const brandMaterial = {
  ...material,
  id: 'material-4',
  version: 4,
  assetKind: 'brand_image',
  rightsAttestation: {
    ...material.rightsAttestation,
    assetKind: 'brand_image',
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
  materialBindings: [
    { assetKind: 'brand_image', materialId: 'material-4', materialVersion: 4 },
    { assetKind: 'logo', materialId: 'material-3', materialVersion: 3 },
  ],
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
  externalSessionId: 'cs_verified',
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
  assert.equal(hasCurrentCreativeBrief(reservation, {
    ...creativeBrief,
    status: CREATIVE_BRIEF_STATUS,
    reviewedAt: null,
    reviewedBy: null,
  }, campaign), false);
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
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, brandMaterial]), true);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, { ...brandMaterial, version: 2 }]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, { ...brandMaterial, placementSlotId: 'slot-2' }]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, { ...brandMaterial, rightsAttestedAt: null }]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, { ...brandMaterial, reviewedBy: '' }]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, { ...brandMaterial, reviewedAt: null }]), false);
  assert.equal(hasCurrentApprovedMaterialWithRights(reservation, [material, {
    ...brandMaterial,
    rightsAttestation: { ...brandMaterial.rightsAttestation, statementVersion: 'old' },
  }]), false);
});

test('authoritative material and proof readiness reject a manifest with a contradictory global latest pointer', () => {
  const olderManifestMemberClaimedLatest = {
    ...reservation,
    latestMaterialId: material.id,
    materialSequence: material.version,
  };
  assert.equal(
    hasCurrentApprovedMaterialWithRights(
      olderManifestMemberClaimedLatest,
      [material, brandMaterial],
      now,
    ),
    false,
  );
  assert.equal(
    latestBoundProofStatus(olderManifestMemberClaimedLatest, proof, now),
    'waiting_for_materials',
  );

  const sequenceDoesNotIdentifyAnyManifestEntry = {
    ...reservation,
    materialSequence: 3,
  };
  assert.equal(
    hasCurrentApprovedMaterialWithRights(
      sequenceDoesNotIdentifyAnyManifestEntry,
      [material, brandMaterial],
      now,
    ),
    false,
  );
});

test('approved proof status requires exact current bindings and recorded written approval', () => {
  assert.equal(latestBoundProofStatus(reservation, proof, now), 'approved');
  assert.equal(latestBoundProofStatus(reservation, {
    ...proof,
    materialBindings: [...proof.materialBindings].reverse(),
  }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, {
    ...proof,
    materialBindings: proof.materialBindings.slice(0, 1),
  }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, creativeBriefId: 'brief-1' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, placementSlotId: 'slot-2' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, approvedBy: '' }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, { ...proof, approvedAt: null }, now), 'waiting_for_materials');
  assert.equal(latestBoundProofStatus(reservation, {
    ...proof,
    approvedAt: '2026-08-21T00:00:00.000Z',
  }, now), 'waiting_for_materials');
});

test('legacy singleton material and proof bindings remain a fail-closed compatibility fallback', () => {
  const legacyReservation = {
    ...reservation,
    latestMaterialId: material.id,
    materialSequence: material.version,
    materialManifest: undefined,
  };
  const legacyProof = {
    ...proof,
    materialBindings: undefined,
    materialId: material.id,
    materialVersion: material.version,
  };
  assert.equal(hasCurrentApprovedMaterialWithRights(legacyReservation, material), true);
  assert.equal(latestBoundProofStatus(legacyReservation, legacyProof, now), 'approved');
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

  const missingCheckoutSessionEvidence = canonicalPaidPaymentEvidence(
    [reservation],
    [{ ...payment, externalSessionId: undefined }],
    expectedPaymentModel,
    now,
  );
  assert.equal(missingCheckoutSessionEvidence.clearedFundingCents, 0);
  assert.ok(missingCheckoutSessionEvidence.issues.includes('paid_payment_not_fully_cleared'));
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

test('canonical funding never counts one Stripe payment or checkout session twice', () => {
  const secondReservation = {
    ...reservation,
    id: 'reservation-2',
    placementSlotId: 'slot-2',
  };
  const duplicatedProviderPayment = canonicalPaidPaymentEvidence(
    [reservation, secondReservation],
    [
      { ...payment, externalCheckoutSessionId: 'cs_shared' },
      {
        ...payment,
        id: secondReservation.id,
        reservationId: secondReservation.id,
        externalCheckoutSessionId: 'cs_shared',
      },
    ],
    expectedPaymentModel,
    now,
  );
  assert.equal(duplicatedProviderPayment.clearedFundingCents, 0);
  assert.equal(duplicatedProviderPayment.verifiedPaidReservationCount, 0);
  assert.ok(duplicatedProviderPayment.issues.includes('payment_provider_id_duplicate'));
  assert.ok(duplicatedProviderPayment.issues.includes('payment_checkout_session_id_duplicate'));

  const collisionOnNonPreferredAlias = canonicalPaidPaymentEvidence(
    [reservation, secondReservation],
    [
      { ...payment, externalPaymentId: 'pi_one', externalSessionId: 'cs_hidden_collision' },
      {
        ...payment,
        id: secondReservation.id,
        reservationId: secondReservation.id,
        externalPaymentId: 'pi_two',
        externalCheckoutSessionId: 'cs_preferred_but_different',
        externalSessionId: 'cs_hidden_collision',
      },
    ],
    expectedPaymentModel,
    now,
  );
  assert.equal(collisionOnNonPreferredAlias.clearedFundingCents, 0);
  assert.ok(collisionOnNonPreferredAlias.issues.includes('payment_checkout_session_id_duplicate'));
  assert.ok(collisionOnNonPreferredAlias.issues.includes('payment_checkout_session_alias_mismatch'));
});

test('provider identifiers must be exact raw canonical strings and whitespace twins never fund', () => {
  assert.equal(canonicalPaymentProviderIdentifier('pi_exact_123'), 'pi_exact_123');
  for (const invalid of [
    '',
    ' pi_exact_123',
    'pi_exact_123 ',
    'pi_exact\n123',
    'pi_exact\u0000123',
  ]) {
    assert.equal(canonicalPaymentProviderIdentifier(invalid), null, JSON.stringify(invalid));
    const evidence = canonicalPaidPaymentEvidence(
      [reservation],
      [{ ...payment, externalPaymentId: invalid }],
      expectedPaymentModel,
      now,
    );
    assert.equal(evidence.clearedFundingCents, 0, JSON.stringify(invalid));
    assert.ok(evidence.issues.includes('payment_provider_id_noncanonical'));
  }

  const secondReservation = {
    ...reservation,
    id: 'reservation-2',
    placementSlotId: 'slot-2',
  };
  const paymentWhitespaceTwin = canonicalPaidPaymentEvidence(
    [reservation, secondReservation],
    [
      { ...payment, externalPaymentId: 'pi_shared' },
      {
        ...payment,
        id: secondReservation.id,
        reservationId: secondReservation.id,
        externalPaymentId: ' pi_shared ',
      },
    ],
    expectedPaymentModel,
    now,
  );
  assert.equal(paymentWhitespaceTwin.clearedFundingCents, 0);
  assert.ok(paymentWhitespaceTwin.issues.includes('payment_provider_id_noncanonical'));
  assert.ok(paymentWhitespaceTwin.issues.includes('payment_provider_id_duplicate'));

  const sessionWhitespaceTwin = canonicalPaidPaymentEvidence(
    [reservation, secondReservation],
    [
      { ...payment, externalPaymentId: 'pi_one', externalSessionId: 'cs_shared' },
      {
        ...payment,
        id: secondReservation.id,
        reservationId: secondReservation.id,
        externalPaymentId: 'pi_two',
        externalCheckoutSessionId: ' cs_shared ',
      },
    ],
    expectedPaymentModel,
    now,
  );
  assert.equal(sessionWhitespaceTwin.clearedFundingCents, 0);
  assert.ok(sessionWhitespaceTwin.issues.includes('payment_checkout_session_id_noncanonical'));
  assert.ok(sessionWhitespaceTwin.issues.includes('payment_checkout_session_id_duplicate'));

  const contradictoryAliases = canonicalPaidPaymentEvidence(
    [reservation],
    [{
      ...payment,
      externalCheckoutSessionId: 'cs_exact',
      externalSessionId: ' cs_exact ',
    }],
    expectedPaymentModel,
    now,
  );
  assert.equal(contradictoryAliases.clearedFundingCents, 0);
  assert.ok(contradictoryAliases.issues.includes('payment_checkout_session_id_noncanonical'));
  assert.ok(contradictoryAliases.issues.includes('payment_checkout_session_alias_mismatch'));
});
