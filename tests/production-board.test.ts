import assert from 'node:assert/strict';
import test from 'node:test';
import { EMPTY_CREATIVE_BRIEF } from '../src/lib/creativeBrief';
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
  const materialId = 'Material123';
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
      creativeBriefStatus: 'received_pending_owner_review',
      latestMaterialId: materialId,
      materialSequence: 1,
      latestProofId: proofId,
      proofSequence: 1,
      accessTokenHash: 'never-return-this-token-hash',
    })],
    payments: [record(reservationId, {
      reservationId,
      campaignId,
      planId: 'plan-v1',
      offerModelVersion: 'model-v1',
      provider: 'stripe',
      externalPaymentId: 'pi_verified',
      currency: 'usd',
      amountCents: 50_000,
      refundedCents: 0,
      status: 'cleared',
      clearedAt: timestamp(),
    })],
    creativeBriefs: [record(briefId, {
      reservationId,
      campaignId,
      placementSlotId: slotId,
      version: 1,
      status: 'received_pending_owner_review',
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
      materialId,
      materialVersion: 1,
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
  delete input.proofs[0].data.materialId;
  delete input.proofs[0].data.materialVersion;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.proof?.boundToCurrentInputs, null);
  assert.equal(row.productionReady, false);
  assert.ok(row.unknowns.some((item) => item.code === 'proof_source_binding_not_recorded'));
});

test('proof source identifiers and version numbers must both match current inputs', () => {
  const input = completeInput();
  input.proofs[0].data.materialVersion = 2;
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
  assert.ok(row.errors.some((item) => item.code === 'material_pointer_unresolved'));
});

test('a collection cap makes every row unknown and fail closed', () => {
  const input = completeInput();
  input.boundedReadPossiblyTruncated = true;
  const row = buildProductionBoard(input).rows[0];
  assert.equal(row.productionReady, false);
  assert.ok(row.unknowns.some((item) => item.code === 'bounded_read_truncated'));
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
