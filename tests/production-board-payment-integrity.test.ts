import assert from 'node:assert/strict';
import test from 'node:test';
import {
  productionPaymentIntegrityState,
  type ProductionPaymentIntegrityRecord,
} from '../src/lib/productionBoardPaymentIntegrity';

function record(id: string, data: Record<string, unknown>): ProductionPaymentIntegrityRecord {
  return { id, data };
}

const campaign = record('campaign-1', {
  planId: 'plan-1',
  offerModelVersion: 'model-1',
});
const reservation = record('reservation-1', {
  status: 'paid',
  campaignId: campaign.id,
  planId: 'plan-1',
  offerModelVersion: 'model-1',
});
const payment = record(reservation.id, {
  reservationId: reservation.id,
  campaignId: campaign.id,
  planId: 'plan-1',
  offerModelVersion: 'model-1',
});

test('one exact canonical payment relationship has no Board-wide integrity issue', () => {
  const result = productionPaymentIntegrityState([payment], [reservation], [campaign]);
  assert.deepEqual(result.globalIssues, []);
  assert.deepEqual(result.issuesByCampaignId.get(campaign.id), undefined);
});

test('extra and mismatched payment documents are attached to the affected campaign', () => {
  const extra = record('extra-payment', {
    ...payment.data,
    reservationId: reservation.id,
    campaignId: 'other-campaign',
  });
  const result = productionPaymentIntegrityState(
    [payment, extra],
    [reservation],
    [campaign],
  );
  const codes = result.issuesByCampaignId.get(campaign.id)?.map((issue) => issue.code) || [];
  assert.ok(codes.includes('payment_document_or_reservation_id_mismatch'));
  assert.ok(codes.includes('payment_campaign_or_offer_model_mismatch'));
  assert.ok(codes.includes('paid_payment_duplicate'));
});

test('an unbound payment-only orphan becomes a global Board error', () => {
  const orphan = record('orphan-payment', {
    reservationId: 'missing-reservation',
    campaignId: 'missing-campaign',
    planId: 'old-plan',
    offerModelVersion: 'old-model',
  });
  const result = productionPaymentIntegrityState(
    [payment, orphan],
    [reservation],
    [campaign],
  );
  assert.ok(result.globalIssues.some((issue) => issue.code === 'payment_orphan'));
});

test('noncanonical reservation identity cannot be normalized into a valid payment binding', () => {
  const noncanonical = record(reservation.id, {
    ...payment.data,
    reservationId: ` ${reservation.id} `,
  });
  const result = productionPaymentIntegrityState(
    [noncanonical],
    [reservation],
    [campaign],
  );
  assert.ok(
    result.issuesByCampaignId.get(campaign.id)?.some((issue) => (
      issue.code === 'payment_document_or_reservation_id_mismatch'
    )),
  );
});
