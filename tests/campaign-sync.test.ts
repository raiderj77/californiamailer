import assert from 'node:assert/strict';
import test from 'node:test';
import { clearedNetFundingCents } from '../src/lib/businessRules';
import {
  campaignInventoryIsOpen,
  synchronizedCampaignStatus,
} from '../src/lib/campaignSync';
import type { CampaignPayment } from '../src/lib/campaignTypes';

function payment(status: CampaignPayment['status'], refundedCents: number): CampaignPayment {
  return {
    id: 'reservation-1',
    reservationId: 'reservation-1',
    campaignId: 'campaign-1',
    planId: 'plan-1',
    offerModelVersion: 'version-1',
    provider: 'stripe',
    externalSessionId: 'cs_1',
    externalPaymentId: 'pi_1',
    amountCents: 59_900,
    refundedCents,
    status,
  };
}

test('sync derives funding status only inside the open reservation lifecycle', () => {
  assert.equal(synchronizedCampaignStatus('accepting_reservations', 59_900, 100_000), 'partially_funded');
  assert.equal(synchronizedCampaignStatus('partially_funded', 100_000, 100_000), 'fully_funded');
  assert.equal(synchronizedCampaignStatus('fully_funded', 0, 100_000), 'accepting_reservations');
});

test('late sync preserves terminal status while refund progression keeps exact net ledger truth', () => {
  const beforeRefund = clearedNetFundingCents([payment('cleared', 0)]);
  const partialRefund = clearedNetFundingCents([payment('partially_refunded', 20_000)]);
  const fullyRefunded = clearedNetFundingCents([payment('refunded', 59_900)]);

  assert.equal(beforeRefund, 59_900);
  assert.equal(partialRefund, 39_900);
  assert.equal(fullyRefunded, 0);
  for (const netFundingCents of [beforeRefund, partialRefund, fullyRefunded]) {
    assert.equal(synchronizedCampaignStatus('refunding', netFundingCents, 100_000), 'refunding');
    assert.equal(synchronizedCampaignStatus('cancelled', netFundingCents, 100_000), 'cancelled');
  }
});

test('terminal and production states can never expose reservation inventory or restore payment flags', () => {
  for (const status of [
    'proofing',
    'scheduled_for_print',
    'printed',
    'delivered',
    'completed',
    'refunding',
    'cancelled',
  ]) {
    assert.equal(campaignInventoryIsOpen(status, true, true), false);
  }
  assert.equal(campaignInventoryIsOpen('accepting_reservations', true, true), true);
  assert.equal(campaignInventoryIsOpen('accepting_reservations', false, true), false);
  assert.equal(campaignInventoryIsOpen('accepting_reservations', true, false), false);
});
