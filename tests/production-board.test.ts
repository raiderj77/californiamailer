import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_CREATIVE_BRIEF, PROOF_BRIEF_REVIEW_CONFIRMATION } from '../src/lib/creativeBrief';
import {
  buildProductionBoard,
  escapeSpreadsheetCell,
  productionBoardCsv,
  type ProductionBoardInput,
  type ProductionBoardRecord,
} from '../src/lib/productionBoard';

const NOW = new Date('2026-08-20T18:00:00.000Z');
const timestamp = (iso = '2026-08-20T17:00:00.000Z') => ({
  toMillis: () => Date.parse(iso),
});

function record(id: string, data: Record<string, unknown>): ProductionBoardRecord {
  return { id, data };
}

function completeInput(): ProductionBoardInput {
  const campaignId = 'campaign-001';
  const slotId = 'campaign-001__standard__01';
  const reservationId = 'Reservation123';
  const briefId = 'CreativeBrief123';
  const materialId = 'MaterialLogo123';
  const brandMaterialId = 'MaterialBrand123';
  const proofId = 'Proof123';
  return {
    campaigns: [record(campaignId, {
      title: '+Co-op Campaign',
      territory: 'Monterey Peninsula',
      status: 'proofing',
      planId: 'plan-v1',
      offerModelVersion: 'model-v1',
      plannedDeliveryStart: '2026-09-10',
      plannedDeliveryEnd: '2026-09-17',
      artworkPreflightApproved: true,
      ownerPrintApproved: true,
      printReadyAt: timestamp(),
    })],
    slots: [record(slotId, {
      campaignId,
      planId: 'plan-v1',
      offerModelVersion: 'model-v1',
      size: 'standard',
      position: 1,
      status: 'sold',
      reservationId,
    })],
    reservations: [record(reservationId, {
      campaignId,
      planId: 'plan-v1',
      offerModelVersion: 'model-v1',
      placementSlotId: slotId,
      publicReference: 'CM-1001',
      businessName: '=Dangerous Formula LLC',
      contactName: 'Private Contact',
      email: 'private@example.com',
      phone: '555-555-0101',
      categorySlug: 'plumber',
      status: 'paid',
      quotedPriceCents: 50_000,
      advertiserDisclaimer: 'Advertiser is responsible for its offer.',
      latestCreativeBriefId: briefId,
      creativeBriefSequence: 1,
      creativeBriefStatus: 'owner_reviewed',
      latestMaterialId: brandMaterialId,
      materialSequence: 2,
      materialManifest: {
        logo: { materialId, version: 1 },
        brand_image: { materialId: brandMaterialId, version: 2 },
      },
      latestProofId: proofId,
      proofSequence: 1,
      accessTokenHash: 'a'.repeat(64),
      legacyAccessStatus: 'active',
      portalAccessVersion: 1,
      legacyAccessVersion: 1,
      legacyAccessExpiresAt: timestamp('2026-08-20T20:00:00.000Z'),
    })],
    payments: [record(reservationId, {
      reservationId,
      campaignId,
      planId: 'plan-v1',
      offerModelVersion: 'model-v1',
      provider: 'stripe',
      externalPaymentId: 'pi_verified',
      externalSessionId: 'cs_verified',
      currency: 'usd',
      amountCents: 50_000,
      refundedCents: 0,
      status: 'cleared',
      clearedAt: timestamp(),
    })],
    refunds: [],
    creativeBriefs: [record(briefId, {
      reservationId,
      campaignId,
      placementSlotId: slotId,
      version: 1,
      status: 'owner_reviewed',
      reviewedAt: timestamp(),
      reviewedBy: 'owner-uid',
      reviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION,
      content: {
        ...EMPTY_CREATIVE_BRIEF,
        businessDisplayName: 'Dangerous Formula LLC',
        factualOffer: 'Save on a qualifying service.',
        callToAction: 'Call for details',
        effectiveOn: '2026-09-01',
        expiresOn: '2026-09-30',
      },
      deliveryWindow: {
        startDate: '2026-09-10',
        endDate: '2026-09-17',
        timeZone: 'America/Los_Angeles',
        validationStatus: 'validated_for_planned_window',
      },
    })],
    materials: [record(materialId, {
      reservationId,
      campaignId,
      placementSlotId: slotId,
      version: 1,
      kind: 'advertiser_logo',
      assetKind: 'logo',
      status: 'owner_approved_private',
      reviewedAt: timestamp(),
      reviewedBy: 'owner-uid',
      rightsAttestation: {
        assetKind: 'logo',
        rightsBasis: 'business_owned',
        attestorName: 'Business Owner',
        sourceOrLicenseNote: '',
        rightsAttested: true,
        statementVersion: 'asset-rights-v1',
      },
      rightsAttestedAt: timestamp(),
      storagePath: 'private/never-return-this-path',
    }), record(brandMaterialId, {
      reservationId,
      campaignId,
      placementSlotId: slotId,
      version: 2,
      kind: 'advertiser_brand_image',
      assetKind: 'brand_image',
      status: 'owner_approved_private',
      reviewedAt: timestamp(),
      reviewedBy: 'owner-uid',
      rightsAttestation: {
        assetKind: 'brand_image',
        rightsBasis: 'business_owned',
        attestorName: 'Business Owner',
        sourceOrLicenseNote: '',
        rightsAttested: true,
        statementVersion: 'asset-rights-v1',
      },
      rightsAttestedAt: timestamp(),
      storagePath: 'private/never-return-this-brand-path',
    })],
    proofs: [record(proofId, {
      reservationId,
      campaignId,
      placementSlotId: slotId,
      version: 1,
      status: 'approved',
      approvedAt: timestamp(),
      approvedBy: 'Advertiser Approver',
      creativeBriefId: briefId,
      creativeBriefVersion: 1,
      materialBindings: [
        { assetKind: 'brand_image', materialId: brandMaterialId, materialVersion: 2 },
        { assetKind: 'logo', materialId, materialVersion: 1 },
      ],
      storagePath: 'private/never-return-this-proof-path',
    })],
    trackingLinks: [],
    trackingCouponClaims: [],
    coupons: [],
    portalInvites: [],
    portalSessions: [],
    operationalEvidenceByCampaign: { [campaignId]: null },
    now: NOW,
  };
}

test('production board is ready only from exact explicit current records', () => {
  const result = buildProductionBoard(completeInput());
  assert.equal(result.rows.length, 1);
  const [row] = result.rows;
  assert.equal(row.productionReady, true);
  assert.equal(row.payment?.verifiedCleared, true);
  assert.equal(row.creativeBrief?.exactPointer, true);
  assert.equal(row.creativeBrief?.deliveryValidated, true);
  assert.equal(row.material?.rightsAttested, true);
  assert.equal(row.proof?.boundToCurrentInputs, true);
  assert.deepEqual(row.blockers, []);
  assert.deepEqual(row.unknowns, []);
  assert.deepEqual(row.errors, []);
  const serialized = JSON.stringify(result);
  for (const secret of [
    'Private Contact',
    'private@example.com',
    '555-555-0101',
    'never-return-this-token-hash',
    'never-return-this-path',
    'never-return-this-brand-path',
    'never-return-this-proof-path',
  ]) assert.doesNotMatch(serialized, new RegExp(secret.replaceAll('.', '\\.')));
});

test('a partial refund cannot be promoted to production-ready paid state', () => {
  const input = completeInput();
  input.payments[0].data.status = 'partially_refunded';
  input.payments[0].data.refundedCents = 100;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.payment?.verifiedCleared, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.blockers.some((item) => item.code === 'canonical_payment_refund_present'));
});

test('active refund obligations and corrupt refund evidence fail every affected production row closed', () => {
  const active = completeInput();
  active.refunds.push(record('Refund123', {
    campaignId: 'campaign-001',
    paymentId: 'Reservation123',
    reservationId: 'Reservation123',
    status: 'requested',
    amountCents: 1_000,
  }));
  const activeRow = buildProductionBoard(active).rows[0];
  assert.equal(activeRow.productionReady, false);
  assert.ok(activeRow.blockers.some((item) => item.code === 'active_refund_obligation_open'));
  assert.deepEqual(activeRow.errors, []);

  const corrupt = completeInput();
  corrupt.refunds.push(
    record('RefundValid', {
      campaignId: 'campaign-001',
      paymentId: 'Reservation123',
      reservationId: 'Reservation123',
      status: 'approved',
      amountCents: 1_000,
    }),
    record('RefundCorrupt', {
      campaignId: 'campaign-001',
      paymentId: 'Reservation123',
      reservationId: 'Reservation123',
      status: 'submitted',
      amountCents: -1_000,
    }),
  );
  const corruptRow = buildProductionBoard(corrupt).rows[0];
  assert.equal(corruptRow.productionReady, false);
  assert.ok(corruptRow.blockers.some((item) => item.code === 'active_refund_obligation_open'));
  assert.ok(corruptRow.errors.some((item) => item.code === 'active_refund_integrity_invalid'));
});

test('unbound or truncated active refund evidence makes the board fail closed', () => {
  const unbound = completeInput();
  unbound.refunds.push(record('RefundUnbound', {
    paymentId: 'Reservation123',
    reservationId: 'Reservation123',
    status: 'requested',
    amountCents: 500,
  }));
  const unboundRow = buildProductionBoard(unbound).rows[0];
  assert.equal(unboundRow.productionReady, false);
  assert.ok(unboundRow.errors.some((item) => item.code === 'active_refund_campaign_binding_invalid'));

  const truncated = completeInput();
  truncated.refundReadPossiblyTruncated = true;
  const truncatedRow = buildProductionBoard(truncated).rows[0];
  assert.equal(truncatedRow.productionReady, false);
  assert.ok(truncatedRow.unknowns.some((item) => item.code === 'refund_read_truncated'));
});

test('a valid rejected owner refund does not block an otherwise-ready row', () => {
  const input = completeInput();
  input.refunds.push(record('Refund-rejected', {
    campaignId: 'campaign-001',
    paymentId: 'Reservation123',
    reservationId: 'Reservation123',
    status: 'rejected',
    amountCents: 500,
    source: 'owner_request',
  }));
  assert.equal(buildProductionBoard(input).rows[0].productionReady, true);
});

test('zero-confirmed or unbound terminal refunds fail the board closed', () => {
  const zeroConfirmed = completeInput();
  zeroConfirmed.refunds.push(record('Refund-zero-confirmed', {
    campaignId: 'campaign-001',
    paymentId: 'Reservation123',
    reservationId: 'Reservation123',
    status: 'confirmed',
    amountCents: 0,
  }));
  const zeroConfirmedRow = buildProductionBoard(zeroConfirmed).rows[0];
  assert.equal(zeroConfirmedRow.productionReady, false);
  assert.ok(zeroConfirmedRow.errors.some(
    (item) => item.code === 'refund_terminal_coherence_invalid',
  ));

  const unbound = completeInput();
  unbound.refunds.push(record('Refund-terminal-unbound', {
    status: 'confirmed',
    amountCents: 0,
  }));
  const unboundRow = buildProductionBoard(unbound).rows[0];
  assert.equal(unboundRow.productionReady, false);
  assert.ok(unboundRow.errors.some(
    (item) => item.code === 'active_refund_campaign_binding_invalid',
  ));
});

test('unknown or noncanonical refund statuses fail affected production rows closed', () => {
  for (const status of ['requestd', 'requested ', '', null]) {
    const input = completeInput();
    input.refunds.push(record(`Refund-${String(status)}`, {
      campaignId: 'campaign-001',
      paymentId: 'Reservation123',
      reservationId: 'Reservation123',
      status,
      amountCents: 500,
    }));
    const row = buildProductionBoard(input).rows[0];
    assert.equal(row.productionReady, false);
    assert.ok(row.errors.some((item) => item.code === 'refund_status_invalid'));
  }

  const unbound = completeInput();
  unbound.refunds.push(record('Refund-unknown-unbound', {
    status: 'requestd',
    amountCents: 500,
  }));
  const unboundRow = buildProductionBoard(unbound).rows[0];
  assert.equal(unboundRow.productionReady, false);
  assert.ok(unboundRow.errors.some((item) => item.code === 'refund_status_invalid'));
});

test('wrong or unknown active refund bindings fail the actual or entire board closed', () => {
  const wrongCampaign = completeInput();
  wrongCampaign.refunds.push(record('RefundWrongCampaign', {
    campaignId: 'campaign-002',
    paymentId: 'Reservation123',
    reservationId: 'Reservation123',
    status: 'requested',
    amountCents: 500,
  }));
  const wrongCampaignRow = buildProductionBoard(wrongCampaign).rows[0];
  assert.equal(wrongCampaignRow.productionReady, false);
  assert.ok(wrongCampaignRow.errors.some((item) => (
    item.code === 'active_refund_campaign_binding_invalid'
  )));

  const unknownBinding = completeInput();
  unknownBinding.refunds.push(record('RefundUnknownBinding', {
    campaignId: 'campaign-missing',
    paymentId: 'PaymentMissing',
    reservationId: 'ReservationMissing',
    status: 'approved',
    amountCents: 500,
  }));
  const unknownBindingRow = buildProductionBoard(unknownBinding).rows[0];
  assert.equal(unknownBindingRow.productionReady, false);
  assert.ok(unknownBindingRow.errors.some((item) => (
    item.code === 'active_refund_campaign_binding_invalid'
  )));
});

test('an exactly bound active refund blocks only its affected campaign', () => {
  const input = completeInput();
  input.campaigns.push(record('campaign-002', {
    title: 'Second campaign',
    territory: 'Another territory',
    status: 'proofing',
    planId: 'plan-v2',
    offerModelVersion: 'model-v2',
  }));
  input.reservations.push(record('Reservation999', {
    campaignId: 'campaign-002',
    planId: 'plan-v2',
    offerModelVersion: 'model-v2',
    placementSlotId: 'campaign-002__standard__01',
    status: 'paid',
  }));
  input.payments.push(record('Reservation999', {
    reservationId: 'Reservation999',
    campaignId: 'campaign-002',
    planId: 'plan-v2',
    offerModelVersion: 'model-v2',
    status: 'cleared',
  }));
  input.refunds.push(record('RefundOtherCampaign', {
    campaignId: 'campaign-002',
    paymentId: 'Reservation999',
    reservationId: 'Reservation999',
    status: 'requested',
    amountCents: 500,
  }));
  const rows = buildProductionBoard(input).rows;
  const foundingRow = rows.find((row) => row.campaign?.id === 'campaign-001');
  const affectedRows = rows.filter((row) => row.campaign?.id === 'campaign-002');
  assert.equal(foundingRow?.productionReady, true);
  assert.ok(affectedRows.length > 0);
  assert.ok(affectedRows.every((row) => row.productionReady === false));
  assert.ok(affectedRows.every((row) => row.blockers.some((item) => (
    item.code === 'active_refund_obligation_open'
  ))));
});

test('a complete campaign delivery window is required for offer-date validation', () => {
  const input = completeInput();
  input.campaigns[0].data.plannedDeliveryStart = null;
  input.campaigns[0].data.plannedDeliveryEnd = null;
  input.creativeBriefs[0].data.deliveryWindow = { startDate: null, endDate: null };
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.creativeBrief?.deliveryValidated, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.unknowns.some((item) => item.code === 'campaign_delivery_window_incomplete'));
});

test('proof readiness fails closed without explicit bindings to current source versions', () => {
  const input = completeInput();
  delete input.proofs[0].data.creativeBriefId;
  delete input.proofs[0].data.creativeBriefVersion;
  delete input.proofs[0].data.materialBindings;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.proof?.boundToCurrentInputs, null);
  assert.equal(row.productionReady, false);
  assert.ok(row.unknowns.some((item) => item.code === 'proof_source_binding_not_recorded'));
});

test('proof source identifiers and version numbers must both match current inputs', () => {
  const input = completeInput();
  (input.proofs[0].data.materialBindings as Array<Record<string, unknown>>)[0].materialVersion = 1;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.proof?.boundToCurrentInputs, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.blockers.some((item) => item.code === 'proof_source_binding_stale'));
});

test('creative, material, and proof evidence must bind to the exact saved schedule and placement', () => {
  const staleWindow = completeInput();
  delete (staleWindow.creativeBriefs[0].data.deliveryWindow as Record<string, unknown>).timeZone;
  assert.equal(buildProductionBoard(staleWindow).rows[0].productionReady, false);
  assert.ok(buildProductionBoard(staleWindow).rows[0].blockers.some((item) => (
    item.code === 'creative_brief_schedule_stale'
  )));

  const wrongMaterialPlacement = completeInput();
  wrongMaterialPlacement.materials[0].data.placementSlotId = 'another-slot';
  const materialRow = buildProductionBoard(wrongMaterialPlacement).rows[0];
  assert.equal(materialRow.productionReady, false);
  assert.equal(materialRow.material?.exactPointer, false);
  assert.ok(materialRow.errors.some((item) => item.code === 'material_binding_mismatch'));

  const wrongProofPlacement = completeInput();
  wrongProofPlacement.proofs[0].data.placementSlotId = 'another-slot';
  const proofRow = buildProductionBoard(wrongProofPlacement).rows[0];
  assert.equal(proofRow.productionReady, false);
  assert.equal(proofRow.proof?.exactPointer, false);
  assert.ok(proofRow.errors.some((item) => item.code === 'proof_binding_mismatch'));
});

test('proof approval status alone is not production approval evidence', () => {
  const input = completeInput();
  delete input.proofs[0].data.approvedBy;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.proof?.approved, false);
  assert.equal(row.productionReady, false);
  assert.ok(row.blockers.some((item) => item.code === 'proof_not_explicitly_approved'));
});

test('pointer contradictions are record errors and never select a merely matching version', () => {
  const input = completeInput();
  input.reservations[0].data.latestMaterialId = 'MaterialMissing';
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.material, null);
  assert.equal(row.productionReady, false);
  assert.ok(row.errors.some((item) => item.code === 'material_latest_pointer_outside_manifest'));
});

test('an older manifest member cannot masquerade as the global latest material', () => {
  const input = completeInput();
  input.reservations[0].data.latestMaterialId = 'MaterialLogo123';
  input.reservations[0].data.materialSequence = 1;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.material, null);
  assert.equal(row.productionReady, false);
  assert.ok(row.errors.some((item) => item.code === 'material_latest_pointer_outside_manifest'));
});

test('pending owner review and any incomplete manifest asset block production', () => {
  const pendingBrief = completeInput();
  pendingBrief.reservations[0].data.creativeBriefStatus = 'received_pending_owner_review';
  pendingBrief.creativeBriefs[0].data.status = 'received_pending_owner_review';
  delete pendingBrief.creativeBriefs[0].data.reviewedAt;
  delete pendingBrief.creativeBriefs[0].data.reviewedBy;
  const briefRow = buildProductionBoard(pendingBrief).rows[0];
  assert.equal(briefRow.productionReady, false);
  assert.equal(briefRow.creativeBrief?.ownerReviewed, false);
  assert.ok(briefRow.blockers.some((item) => item.code === 'creative_brief_not_owner_reviewed'));

  const pendingAsset = completeInput();
  pendingAsset.materials[1].data.status = 'quarantine_pending_owner_review';
  const materialRow = buildProductionBoard(pendingAsset).rows[0];
  assert.equal(materialRow.productionReady, false);
  assert.equal(materialRow.material?.bindings.length, 2);
  assert.ok(materialRow.blockers.some((item) => item.code === 'material_not_owner_approved'));
});

test('expired legacy tokens do not count as reservation-scoped portal access', () => {
  const input = completeInput();
  input.reservations[0].data.legacyAccessExpiresAt = timestamp('2026-08-20T17:59:59.000Z');
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.portal.reservationScopedAccessAvailable, false);
});

test('campaigns with no slot documents produce an explicit fail-closed campaign row', () => {
  const input = completeInput();
  input.slots = [];
  input.reservations = [];
  input.payments = [];
  input.creativeBriefs = [];
  input.materials = [];
  input.proofs = [];
  const result = buildProductionBoard(input);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].key, 'campaign:campaign-001');
  assert.equal(result.rows[0].productionReady, false);
  assert.ok(result.rows[0].errors.some((item) => item.code === 'campaign_slots_missing'));
  assert.equal(result.summary.slots, 0);
});

test('a collection cap makes every row unknown and fail closed', () => {
  const input = completeInput();
  input.boundedReadPossiblyTruncated = true;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.productionReady, false);
  assert.ok(row.unknowns.some((item) => item.code === 'bounded_read_truncated'));
});

test('provider-global payment and checkout-session collisions block the board row', () => {
  const paymentCollision = completeInput();
  paymentCollision.payments.push(record('another-campaign-payment', {
    reservationId: 'another-reservation',
    campaignId: 'another-campaign',
    provider: 'stripe',
    externalPaymentId: 'pi_verified',
    status: 'cleared',
  }));
  const paymentRow = buildProductionBoard(paymentCollision).rows[0];
  assert.equal(paymentRow.productionReady, false);
  assert.equal(paymentRow.payment?.verifiedCleared, false);
  assert.ok(paymentRow.errors.some((item) => item.code === 'provider_payment_id_duplicate'));

  const sessionCollision = completeInput();
  sessionCollision.payments[0].data.externalSessionId = 'cs_shared';
  sessionCollision.payments.push(record('another-session-payment', {
    reservationId: 'another-reservation',
    campaignId: 'another-campaign',
    provider: 'stripe',
    externalPaymentId: 'pi_other',
    externalCheckoutSessionId: 'cs_other_alias',
    externalSessionId: 'cs_shared',
    status: 'cleared',
  }));
  const sessionRow = buildProductionBoard(sessionCollision).rows[0];
  assert.equal(sessionRow.productionReady, false);
  assert.equal(sessionRow.payment?.verifiedCleared, false);
  assert.ok(sessionRow.errors.some((item) => item.code === 'provider_session_id_duplicate'));

  const conflictingAliases = completeInput();
  conflictingAliases.payments[0].data.externalSessionId = 'cs_one';
  conflictingAliases.payments[0].data.externalCheckoutSessionId = 'cs_two';
  const aliasRow = buildProductionBoard(conflictingAliases).rows[0];
  assert.equal(aliasRow.productionReady, false);
  assert.equal(aliasRow.payment?.verifiedCleared, false);
  assert.ok(aliasRow.errors.some((item) => item.code === 'provider_session_id_inconsistent'));
});

test('noncanonical provider IDs and cross-campaign whitespace twins block the board row', () => {
  const noncanonicalPaymentId = completeInput();
  noncanonicalPaymentId.payments[0].data.externalPaymentId = ' pi_verified ';
  const noncanonicalPaymentRow = buildProductionBoard(noncanonicalPaymentId).rows[0];
  assert.equal(noncanonicalPaymentRow.productionReady, false);
  assert.equal(noncanonicalPaymentRow.payment?.verifiedCleared, false);
  assert.ok(noncanonicalPaymentRow.errors.some((item) => (
    item.code === 'provider_payment_id_noncanonical'
  )));

  const crossCampaignPaymentTwin = completeInput();
  crossCampaignPaymentTwin.payments.push(record('other-campaign-payment', {
    reservationId: 'other-reservation',
    campaignId: 'other-campaign',
    provider: 'stripe',
    externalPaymentId: ' pi_verified ',
    status: 'cleared',
  }));
  const paymentTwinRow = buildProductionBoard(crossCampaignPaymentTwin).rows[0];
  assert.equal(paymentTwinRow.productionReady, false);
  assert.equal(paymentTwinRow.payment?.verifiedCleared, false);
  assert.ok(paymentTwinRow.errors.some((item) => item.code === 'provider_payment_id_duplicate'));

  const crossCampaignSessionTwin = completeInput();
  crossCampaignSessionTwin.payments[0].data.externalSessionId = 'cs_shared';
  crossCampaignSessionTwin.payments.push(record('other-campaign-session', {
    reservationId: 'other-reservation',
    campaignId: 'other-campaign',
    provider: 'stripe',
    externalPaymentId: 'pi_other',
    externalCheckoutSessionId: ' cs_shared ',
    status: 'cleared',
  }));
  const sessionTwinRow = buildProductionBoard(crossCampaignSessionTwin).rows[0];
  assert.equal(sessionTwinRow.productionReady, false);
  assert.equal(sessionTwinRow.payment?.verifiedCleared, false);
  assert.ok(sessionTwinRow.errors.some((item) => item.code === 'provider_session_id_duplicate'));

  const noncanonicalAlias = completeInput();
  noncanonicalAlias.payments[0].data.externalSessionId = 'cs_exact';
  noncanonicalAlias.payments[0].data.externalCheckoutSessionId = ' cs_exact ';
  const aliasRow = buildProductionBoard(noncanonicalAlias).rows[0];
  assert.equal(aliasRow.productionReady, false);
  assert.equal(aliasRow.payment?.verifiedCleared, false);
  assert.ok(aliasRow.errors.some((item) => item.code === 'provider_session_id_noncanonical'));
  assert.ok(aliasRow.errors.some((item) => item.code === 'provider_session_id_inconsistent'));
});

test('payment and reservation provider state must match authoritative raw values exactly', () => {
  const cases: Array<{
    name: string;
    mutate: (input: ProductionBoardInput) => void;
    issueCode: string;
  }> = [
    {
      name: 'payment status whitespace',
      mutate: (input) => { input.payments[0].data.status = 'cleared '; },
      issueCode: 'canonical_payment_status_noncanonical',
    },
    {
      name: 'provider whitespace',
      mutate: (input) => { input.payments[0].data.provider = 'stripe '; },
      issueCode: 'canonical_payment_provider_or_currency_invalid',
    },
    {
      name: 'currency case',
      mutate: (input) => { input.payments[0].data.currency = 'USD'; },
      issueCode: 'canonical_payment_provider_or_currency_invalid',
    },
    {
      name: 'reservation status whitespace',
      mutate: (input) => { input.reservations[0].data.status = 'paid '; },
      issueCode: 'canonical_reservation_status_noncanonical',
    },
  ];

  for (const item of cases) {
    const input = completeInput();
    item.mutate(input);
    const row = buildProductionBoard(input).rows[0];
    assert.equal(row.productionReady, false, item.name);
    assert.equal(row.payment?.verifiedCleared, false, item.name);
    assert.ok(row.errors.some((issue) => issue.code === item.issueCode), item.name);
  }

  const missingCheckoutSession = completeInput();
  delete missingCheckoutSession.payments[0].data.externalSessionId;
  const missingSessionRow = buildProductionBoard(missingCheckoutSession).rows[0];
  assert.equal(missingSessionRow.productionReady, false);
  assert.equal(missingSessionRow.payment?.verifiedCleared, false);
  assert.ok(missingSessionRow.errors.some((issue) => issue.code === 'provider_session_id_missing'));
});

test('payment-only orphan and duplicate relationships cannot disappear from Board rows', () => {
  const duplicate = completeInput();
  duplicate.payments.push(record('extra-payment', {
    ...duplicate.payments[0].data,
    reservationId: duplicate.reservations[0].id,
    campaignId: 'other-campaign',
    externalPaymentId: 'pi_extra',
    externalSessionId: 'cs_extra',
  }));
  const duplicateRow = buildProductionBoard(duplicate).rows[0];
  assert.equal(duplicateRow.productionReady, false);
  for (const code of [
    'payment_document_or_reservation_id_mismatch',
    'payment_campaign_or_offer_model_mismatch',
    'paid_payment_duplicate',
  ]) {
    assert.ok(duplicateRow.errors.some((item) => item.code === code), code);
  }

  const orphan = completeInput();
  orphan.payments.push(record('orphan-payment', {
    reservationId: 'missing-reservation',
    campaignId: 'missing-campaign',
    planId: 'old-plan',
    offerModelVersion: 'old-model',
    provider: 'stripe',
    externalPaymentId: 'pi_orphan',
    externalSessionId: 'cs_orphan',
    currency: 'usd',
    amountCents: 50_000,
    refundedCents: 0,
    status: 'cleared',
    clearedAt: timestamp(),
  }));
  const orphanRow = buildProductionBoard(orphan).rows[0];
  assert.equal(orphanRow.productionReady, false);
  assert.ok(orphanRow.errors.some((item) => item.code === 'payment_orphan'));
});

test('Board readiness rejects noncanonical raw production states and bindings', () => {
  const cases: Array<{
    name: string;
    mutate: (input: ProductionBoardInput) => void;
    issueCode: string;
  }> = [
    {
      name: 'campaign status whitespace',
      mutate: (input) => { input.campaigns[0].data.status = 'proofing '; },
      issueCode: 'campaign_status_noncanonical',
    },
    {
      name: 'slot status whitespace',
      mutate: (input) => { input.slots[0].data.status = 'sold '; },
      issueCode: 'slot_status_noncanonical',
    },
    {
      name: 'payment reservation binding whitespace',
      mutate: (input) => { input.payments[0].data.reservationId = ` ${input.reservations[0].id} `; },
      issueCode: 'canonical_payment_binding_mismatch',
    },
    {
      name: 'creative brief status whitespace',
      mutate: (input) => {
        input.creativeBriefs[0].data.status = 'owner_reviewed ';
        input.reservations[0].data.creativeBriefStatus = 'owner_reviewed ';
      },
      issueCode: 'creative_brief_status_noncanonical',
    },
    {
      name: 'material status whitespace',
      mutate: (input) => { input.materials[0].data.status = 'owner_approved_private '; },
      issueCode: 'material_state_noncanonical',
    },
    {
      name: 'proof status whitespace',
      mutate: (input) => { input.proofs[0].data.status = 'approved '; },
      issueCode: 'proof_status_noncanonical',
    },
  ];

  for (const item of cases) {
    const input = completeInput();
    item.mutate(input);
    const row = buildProductionBoard(input).rows[0];
    assert.equal(row.productionReady, false, item.name);
    assert.ok(row.errors.some((issue) => issue.code === item.issueCode), item.name);
  }
});

test('CSV output neutralizes spreadsheet formulas and excludes private fields', () => {
  const row = buildProductionBoard(completeInput()).rows[0];
  assert.equal(escapeSpreadsheetCell(' =2+2'), "'=2+2");
  assert.equal(escapeSpreadsheetCell('@SUM(A1:A2)'), "'@SUM(A1:A2)");
  const csv = productionBoardCsv([row]);
  assert.match(csv, /"'=Dangerous Formula LLC"/);
  assert.match(csv, /"'\+Co-op Campaign"/);
  assert.doesNotMatch(csv, /private@example\.com|Private Contact|never-return-this/);
});
