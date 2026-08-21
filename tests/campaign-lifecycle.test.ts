import assert from 'node:assert/strict';
import test from 'node:test';
import { canTransitionCampaign } from '../src/lib/campaignLifecycle';

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
