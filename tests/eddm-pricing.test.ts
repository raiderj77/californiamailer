import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DISCOUNT_PRINT_PRICES_CENTS,
  EDDM_MAIL_PIECES,
  MINI_COOP_MAIL_PIECES,
  PRINTING4SUPERCHEAP,
  TARGETED_MAIL_PIECES,
  USPS_EDDM_BMEU,
  USPS_EDDM_RETAIL,
} from '../src/config/eddmOfferings';
import { calculateEddmEstimate, supplierSnapshotIsStale } from '../src/lib/eddmPricing';

test('all public mail-piece identifiers are unique and use the fixed supplier', () => {
  const ids = [...EDDM_MAIL_PIECES, ...TARGETED_MAIL_PIECES, ...MINI_COOP_MAIL_PIECES].map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(PRINTING4SUPERCHEAP.id, 'printing4supercheap');
});

test('the dated discount snapshot matches the observed 5,000-piece supplier rows', () => {
  assert.equal(DISCOUNT_PRINT_PRICES_CENTS['eddm-6-5x9-14pt'][5_000], 63_400);
  assert.equal(DISCOUNT_PRINT_PRICES_CENTS['eddm-9x12-14pt'][5_000], 120_900);
  assert.equal(DISCOUNT_PRINT_PRICES_CENTS['eddm-12x15-14pt'][5_000], 217_000);
  assert.equal(DISCOUNT_PRINT_PRICES_CENTS['eddm-9x12-10pt'], undefined);
  assert.equal(EDDM_MAIL_PIECES.find((piece) => piece.id === 'eddm-9x12-10pt')?.supplierPriceSnapshot, false);
});

test('current EDDM Retail postage calculates exactly for 5,000 pieces', () => {
  assert.equal(USPS_EDDM_RETAIL.rateMillsPerPiece, 260);
  const estimate = calculateEddmEstimate({
    specificationId: 'eddm-6-5x9-14pt',
    quantity: 5_000,
    fulfillment: 'print_only',
    taxCents: 0,
    designCents: 0,
    otherCostsCents: 0,
    bundlingCents: 0,
    postOfficeDeliveryCents: 0,
  });
  assert.equal(estimate.postageCents, 130_000);
  assert.equal(estimate.completeDirectCostCents, 193_400);
});

test('current BMEU alternatives retain their entry-dependent mill rates', () => {
  assert.deepEqual(
    USPS_EDDM_BMEU.rates.map((rate) => [rate.id, rate.rateMillsPerPiece]),
    [['origin', 309], ['dscf_lpc', 268], ['ddu_sdc', 259]],
  );
  assert.equal(USPS_EDDM_BMEU.permitImprintApplicationFeeCents, 39_000);
  assert.equal(USPS_EDDM_BMEU.annualMailingFeeCents, 39_000);
});

test('turnkey pricing includes postage once and keeps banding separate', () => {
  const estimate = calculateEddmEstimate({
    specificationId: 'eddm-6-5x9-14pt',
    quantity: 5_000,
    fulfillment: 'turnkey',
    taxCents: 0,
    designCents: 0,
    otherCostsCents: 0,
  });
  assert.equal(estimate.printPriceCents, 63_400);
  assert.equal(estimate.postageCents, 0);
  assert.equal(estimate.turnkeyFulfillmentCents, 165_000);
  assert.equal(estimate.bandingCents, 2_500);
  assert.equal(estimate.completeDirectCostCents, 230_900);
  assert.equal(estimate.postageIncludedInTurnkey, true);
});

test('unknown tax, design, bundling, and delivery never become zero', () => {
  const estimate = calculateEddmEstimate({
    specificationId: 'eddm-6-5x9-14pt',
    quantity: 5_000,
    fulfillment: 'print_only',
    taxCents: null,
    designCents: null,
    otherCostsCents: null,
  });
  assert.equal(estimate.completeDirectCostCents, null);
  assert.deepEqual(estimate.missingInputs, [
    'taxCents',
    'designCents',
    'otherCostsCents',
    'bundlingCents',
    'postOfficeDeliveryCents',
  ]);
});

test('an unavailable supplier tier remains quote-only', () => {
  const estimate = calculateEddmEstimate({
    specificationId: 'eddm-12x15-14pt',
    quantity: 250,
    fulfillment: 'turnkey',
    taxCents: 0,
    designCents: 0,
    otherCostsCents: 0,
  });
  assert.equal(estimate.printPriceCents, null);
  assert.equal(estimate.completeDirectCostCents, null);
  assert.ok(estimate.missingInputs.includes('supplierPriceSnapshot'));
});

test('the supplier snapshot becomes stale after its recheck window', () => {
  assert.equal(supplierSnapshotIsStale(new Date('2026-08-19T00:00:00Z')), false);
  assert.equal(supplierSnapshotIsStale(new Date('2026-09-19T00:00:00Z')), true);
});
