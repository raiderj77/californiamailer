import assert from 'node:assert/strict';
import test from 'node:test';
import {
  campaignCreativeInputsLocked,
  canTransitionCampaign,
} from '../src/lib/campaignLifecycle';
import {
  buildPrintedInputSnapshot,
  printedInputSnapshotMatches,
} from '../src/lib/printedInputSnapshot';

test('campaign lifecycle allows the evidence-gated production sequence', () => {
  assert.equal(canTransitionCampaign('fully_funded', 'proofing'), true);
  assert.equal(canTransitionCampaign('proofing', 'scheduled_for_print'), true);
  assert.equal(canTransitionCampaign('scheduled_for_print', 'printed'), true);
  assert.equal(canTransitionCampaign('printed', 'delivered'), true);
  assert.equal(canTransitionCampaign('delivered', 'completed'), true);
});

test('campaign lifecycle rejects skipped and reversed production states', () => {
  assert.equal(canTransitionCampaign('partially_funded', 'scheduled_for_print'), false);
  assert.equal(canTransitionCampaign('proofing', 'delivered'), false);
  assert.equal(canTransitionCampaign('delivered', 'printed'), false);
  assert.equal(canTransitionCampaign('completed', 'accepting_reservations'), false);
});

test('a refunding cancellation closes only after refund reconciliation', () => {
  assert.equal(canTransitionCampaign('partially_funded', 'refunding'), true);
  assert.equal(canTransitionCampaign('refunding', 'cancelled'), true);
  assert.equal(canTransitionCampaign('refunding', 'completed'), false);
});

test('creative inputs become immutable once physical printing is recorded', () => {
  assert.equal(campaignCreativeInputsLocked('scheduled_for_print'), false);
  assert.equal(campaignCreativeInputsLocked('printed'), true);
  assert.equal(campaignCreativeInputsLocked('delivered'), true);
  assert.equal(campaignCreativeInputsLocked('completed'), true);
});

test('printed input snapshots bind delivery to the exact reservation creative versions', () => {
  const campaignId = 'campaign_1';
  const reservation = {
    status: 'paid',
    campaignId,
    placementSlotId: 'slot_1',
    latestProofId: 'proof_1',
    proofSequence: 3,
    latestCreativeBriefId: 'brief_1',
    creativeBriefSequence: 2,
    latestMaterialId: 'material_2',
    materialSequence: 2,
    materialManifest: {
      logo: { materialId: 'material_1', version: 1 },
      brand_image: { materialId: 'material_2', version: 2 },
    },
  };
  const documents = [{ id: 'reservation_1', data: () => reservation }];
  const snapshot = buildPrintedInputSnapshot(campaignId, documents);
  assert.ok(snapshot);
  assert.equal(printedInputSnapshotMatches(snapshot, campaignId, documents), true);

  const changed = [{
    id: 'reservation_1',
    data: () => ({ ...reservation, latestProofId: 'proof_2', proofSequence: 4 }),
  }];
  assert.equal(printedInputSnapshotMatches(snapshot, campaignId, changed), false);
  const fullyRefunded = [{
    id: 'reservation_1',
    data: () => ({ ...reservation, status: 'refunded' }),
  }];
  assert.equal(printedInputSnapshotMatches(snapshot, campaignId, fullyRefunded), true);
  const newPaidReservation = [{
    id: 'reservation_2',
    data: () => ({ ...reservation, placementSlotId: 'slot_2' }),
  }];
  assert.equal(printedInputSnapshotMatches(
    snapshot,
    campaignId,
    [...documents, ...newPaidReservation],
  ), false);
  assert.equal(printedInputSnapshotMatches(
    { ...snapshot, paidReservationCount: 2 },
    campaignId,
    documents,
  ), false);
});
