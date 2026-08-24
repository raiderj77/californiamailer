import assert from 'node:assert/strict';
import test from 'node:test';
import { DISCOUNT_PRINT_PRICES_CENTS } from '../src/config/eddmOfferings';
import {
  ACTIVE_SHARED_MODEL_VERSION,
  ACTIVE_SHARED_PLAN_ID,
  SHARED_MAILER_MODELS,
  getSharedMailerModel,
  sharedMailerFillSensitivityUnits,
} from '../src/config/sharedMailerModels';
import {
  DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS,
  calculateMinimumPlanningSafeguards,
  calculateSharedMailerEconomics,
  evaluateDatedPlanningPrice,
  type SharedMailerEconomicsInput,
} from '../src/lib/sharedMailerEconomics';

function completeInput(overrides: Partial<SharedMailerEconomicsInput> = {}): SharedMailerEconomicsInput {
  return {
    supplierSubtotalCents: 288_400,
    paidSlotUnits: 24,
    minimumPaidSlotUnits: 16,
    maximumPaidSlotUnits: 24,
    revenueMode: 'equal_unit_price',
    revenuePerPaidUnitCents: 34_900,
    paymentCount: 24,
    processingRateBps: 290,
    processingFixedCentsPerPayment: 30,
    refundReserveBps: 300,
    productionReserveBps: 500,
    taxContingencyCents: 12_090,
    designCostCents: 30_000,
    ownerLaborCents: 150_000,
    softwareAndOtherCents: 10_000,
    incomeTaxReserveBps: 3_000,
    targetOwnerSurplusCents: 250_000,
    targetEconomicMarginBps: null,
    ...overrides,
  };
}

test('the typed catalog has stable unique IDs and the requested active version', () => {
  const ids = SHARED_MAILER_MODELS.map((model) => model.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ACTIVE_SHARED_PLAN_ID, 'shared-9x12-5000');
  assert.equal(ACTIVE_SHARED_MODEL_VERSION, 'shared-mailers-v2');
  assert.equal(getSharedMailerModel(ACTIVE_SHARED_PLAN_ID)?.version, ACTIVE_SHARED_MODEL_VERSION);
  assert.equal(getSharedMailerModel('not-a-model'), null);
});

test('24 units on 9x12 remain experimental beyond the HRM comfortable range', () => {
  for (const id of ['shared-9x12-5000', 'shared-9x12-10000']) {
    const model = getSharedMailerModel(id);
    assert.ok(model);
    assert.equal(model.slots.totalUnitsDefault, 24);
    assert.equal(model.slots.paidUnitsDefault, 24);
    assert.deepEqual(model.slots.paidUnitsRange, { min: 16, max: 24 });
    assert.deepEqual(sharedMailerFillSensitivityUnits(model), [16, 18, 24]);
    assert.deepEqual(model.layoutEvidence.documentedComfortableUnits, { min: 16, max: 18 });
    assert.equal(model.layoutEvidence.documentedMaximumUnits, 18);
    assert.equal(model.layoutEvidence.sourceObservedAt, '2026-08-23');
    assert.deepEqual(model.layoutEvidence.sourceUrls, ['https://highresponsemarketing.com/part-iv-cheaper-design/']);
    assert.equal(model.layoutEvidence.status, 'experimental_preflight_required');
    assert.equal(model.productionReadiness, 'never_from_catalog_preflight_required');
    assert.match(model.layoutEvidence.note, /catalog can never make it production-ready/i);
  }
  assert.equal(getSharedMailerModel('shared-9x12-5000')?.suggestedPricePerPaidUnitCents, 34_900);
  assert.equal(getSharedMailerModel('shared-9x12-10000')?.suggestedPricePerPaidUnitCents, 47_900);
});

test('supplier-backed turnkey catalog rows use the shared EDDM estimator snapshots', () => {
  assert.equal(getSharedMailerModel('shared-9x12-5000')?.costBasis.supplierSubtotalCents, 288_400);
  assert.equal(getSharedMailerModel('shared-9x12-10000')?.costBasis.supplierSubtotalCents, 564_900);
  assert.equal(getSharedMailerModel('shared-12x15-5000')?.costBasis.supplierSubtotalCents, 384_500);
  assert.equal(getSharedMailerModel('shared-12x15-10000')?.costBasis.supplierSubtotalCents, 739_200);
  assert.equal(getSharedMailerModel('m6-6x11-2500')?.costBasis.supplierSubtotalCents, 137_300);
  assert.equal(getSharedMailerModel('m6-6-5x12-2500')?.costBasis.supplierSubtotalCents, 139_900);
  assert.equal(getSharedMailerModel('shared-9x12-5000')?.costBasis.supplierId, 'printing4supercheap');
  assert.deepEqual(
    getSharedMailerModel('shared-9x12-5000')?.costBasis.missingCostInputs,
    ['taxCents', 'designCents', 'otherCostsCents'],
  );
});

test('calculator tax reset uses an exact editable 10% print-price placeholder', () => {
  for (const [modelId, expectedTaxCents] of [
    ['shared-9x12-5000', 12_090],
    ['shared-9x12-10000', 22_990],
  ] as const) {
    const model = getSharedMailerModel(modelId);
    assert.ok(model?.costBasis.supplierSpecificationId);
    assert.ok(model.costBasis.supplierQuantity);
    const printPriceCents = DISCOUNT_PRINT_PRICES_CENTS[model.costBasis.supplierSpecificationId]?.[model.costBasis.supplierQuantity] ?? null;
    assert.ok(printPriceCents);
    assert.equal(Math.round(printPriceCents * 0.1), expectedTaxCents);
  }
});

test('production planning floors derive fees and reserves from the active gross and supplier subtotal', () => {
  assert.deepEqual(calculateMinimumPlanningSafeguards(837_600, 24, 288_400), {
    processingFeeCents: 25_011,
    refundReserveCents: 25_128,
    productionReserveCents: 14_420,
  });
});

test('12x15, M6, M3, custom, targeted, and directory evidence stays distinct', () => {
  const twelveByFifteen = getSharedMailerModel('shared-12x15-5000');
  assert.equal(twelveByFifteen?.layoutEvidence.documentedMaximumUnits, 25);
  assert.equal(twelveByFifteen?.layoutEvidence.sourceKind, 'first_party_hrm_guidance');
  assert.deepEqual(twelveByFifteen?.layoutEvidence.sourceUrls, ['https://highresponsemarketing.com/part-iv-cheaper-design/']);
  assert.equal(twelveByFifteen?.slots.totalUnitsDefault, 24);

  const m6 = getSharedMailerModel('m6-6x11-2500');
  assert.equal(m6?.slots.paidUnitsDefault, 6);
  assert.deepEqual(m6?.slots.paidUnitsRange, { min: 6, max: 6 });
  assert.deepEqual(m6?.layoutEvidence.documentedComfortableUnits, { min: 6, max: 6 });
  assert.equal(m6?.layoutEvidence.documentedMaximumUnits, 9);
  assert.match(m6?.layoutEvidence.note ?? '', /M7–M9 split-layout variants/i);
  assert.deepEqual(m6?.layoutEvidence.sourceUrls, [
    'https://highresponsemarketing.com/newbie-guide/what-i-sell/',
    'https://highresponsemarketing.com/samples/m6/',
  ]);

  const m3 = getSharedMailerModel('m3-6x11-targeted');
  assert.equal(m3?.mailingMethod, 'addressed_targeted');
  assert.equal(m3?.slots.totalUnitsDefault, 3);
  assert.equal(m3?.slots.paidUnitsDefault, 2);
  assert.equal(m3?.slots.houseUnitsDefault, 1);
  assert.equal(m3?.layoutEvidence.sourceKind, 'owner_requested_experiment');
  assert.equal(m3?.layoutEvidence.documentedComfortableUnits, null);
  assert.equal(m3?.layoutEvidence.documentedMaximumUnits, null);
  assert.match(m3?.layoutEvidence.note ?? '', /owner planning assumption/i);
  assert.equal(m3?.costBasis.status, 'external_mailing_cost_required');
  assert.equal(m3?.costBasis.supplierSubtotalCents, null);

  assert.equal(getSharedMailerModel('community-card-custom')?.costBasis.status, 'custom_cost_required');
  assert.equal(getSharedMailerModel('new-mover-sparker-shared')?.costBasis.status, 'external_mailing_cost_required');
  const directory = getSharedMailerModel('directory-card-9x12');
  assert.deepEqual(directory?.slots.totalUnitsRange, { min: 1, max: 72 });
  assert.equal(directory?.slots.pricingMode, 'custom_price_mix');
  assert.match(directory?.layoutEvidence.note ?? '', /not be represented as 72 equal/i);
  assert.deepEqual(directory?.layoutEvidence.sourceUrls, ['https://highresponsemarketing.com/grant/']);
  assert.ok(SHARED_MAILER_MODELS.every((model) => model.layoutEvidence.sourceObservedAt === '2026-08-23'));
  assert.ok(SHARED_MAILER_MODELS.every((model) => model.costBasis.supplierId === 'printing4supercheap'));
});

test('default assumptions label editable values and preserve unknowns', () => {
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingRateBps, 290);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingFixedCentsPerPayment, 30);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.refundReserveBps, 300);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.productionReserveBps, 500);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.ownerLaborCents, 150_000);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.targetOwnerSurplusCents, 250_000);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.taxContingencyCents, null);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.incomeTaxReserveBps, null);
  assert.equal(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.targetEconomicMarginBps, null);
  assert.match(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.labels.taxContingencyCents, /never defaults to zero/i);
});

test('5,000-piece suggested pricing separates cash, labor, tax, and target', () => {
  const result = calculateSharedMailerEconomics(completeInput());
  assert.equal(result.grossRevenueCents, 837_600);
  assert.deepEqual(result.feesAndReserves, {
    processingVariableFeeCents: 24_291,
    processingFixedFeesCents: 720,
    processingFeesCents: 25_011,
    refundReserveCents: 25_128,
    productionReserveCents: 14_420,
    incomeTaxReserveCents: 84_766,
  });
  assert.equal(result.cashBeforeOwnerLaborAndIncomeTaxCents, 432_551);
  assert.equal(result.economicSurplusBeforeIncomeTaxCents, 282_551);
  assert.equal(result.afterTaxPlanningSurplusCents, 197_785);
  assert.equal(result.economicMarginBps, 3_373);
  assert.equal(result.fixedSurplusTargetGapCents, 32_551);
  assert.equal(result.marginTargetGapBps, null);
  assert.equal(result.exactRequiredRevenuePerPaidUnitCents, 33_459);
  assert.equal(result.recommendedRequiredRevenuePerPaidUnitCents, 33_500);
  assert.equal(result.targetBasis, 'fixed_pre_income_tax_surplus_with_optional_economic_margin');
});

test('10,000-piece suggested pricing clears the pre-tax target with a smaller margin', () => {
  const result = calculateSharedMailerEconomics(completeInput({
    supplierSubtotalCents: 564_900,
    revenuePerPaidUnitCents: 47_900,
    taxContingencyCents: 22_990,
    softwareAndOtherCents: 15_000,
  }));
  assert.equal(result.grossRevenueCents, 1_149_600);
  assert.equal(result.feesAndReserves.processingFeesCents, 34_059);
  assert.equal(result.feesAndReserves.refundReserveCents, 34_488);
  assert.equal(result.feesAndReserves.productionReserveCents, 28_245);
  assert.equal(result.cashBeforeOwnerLaborAndIncomeTaxCents, 419_918);
  assert.equal(result.economicSurplusBeforeIncomeTaxCents, 269_918);
  assert.equal(result.afterTaxPlanningSurplusCents, 188_942);
  assert.equal(result.economicMarginBps, 2_347);
  assert.equal(result.fixedSurplusTargetGapCents, 19_918);
  assert.equal(result.exactRequiredRevenuePerPaidUnitCents, 47_019);
  assert.equal(result.recommendedRequiredRevenuePerPaidUnitCents, 47_500);
});

test('exact price is the first whole cent that meets the economic target', () => {
  const solved = calculateSharedMailerEconomics(completeInput({ revenuePerPaidUnitCents: null }));
  assert.equal(solved.grossRevenueCents, null);
  assert.equal(solved.exactRequiredRevenuePerPaidUnitCents, 33_459);

  const below = calculateSharedMailerEconomics(completeInput({ revenuePerPaidUnitCents: 33_458 }));
  const exact = calculateSharedMailerEconomics(completeInput({ revenuePerPaidUnitCents: 33_459 }));
  assert.ok((below.fixedSurplusTargetGapCents ?? 0) < 0);
  assert.ok((exact.fixedSurplusTargetGapCents ?? -1) >= 0);
});

test('unknown costs never become zero or yield a required customer price', () => {
  const unknownSupplier = calculateSharedMailerEconomics(completeInput({ supplierSubtotalCents: null }));
  assert.equal(unknownSupplier.grossRevenueCents, 837_600);
  assert.equal(unknownSupplier.feesAndReserves.productionReserveCents, null);
  assert.equal(unknownSupplier.cashBeforeOwnerLaborAndIncomeTaxCents, null);
  assert.equal(unknownSupplier.economicSurplusBeforeIncomeTaxCents, null);
  assert.equal(unknownSupplier.exactRequiredRevenuePerPaidUnitCents, null);
  assert.ok(unknownSupplier.requiredPriceMissingInputs.includes('supplierSubtotalCents'));

  const unknownTax = calculateSharedMailerEconomics(completeInput({ taxContingencyCents: null }));
  assert.equal(unknownTax.economicSurplusBeforeIncomeTaxCents, null);
  assert.equal(unknownTax.exactRequiredRevenuePerPaidUnitCents, null);
  assert.ok(unknownTax.missingInputs.includes('taxContingencyCents'));
});

test('unknown income-tax rate blocks only after-tax planning, not the pre-tax price solve', () => {
  const result = calculateSharedMailerEconomics(completeInput({ incomeTaxReserveBps: null }));
  assert.equal(result.economicSurplusBeforeIncomeTaxCents, 282_551);
  assert.equal(result.feesAndReserves.incomeTaxReserveCents, null);
  assert.equal(result.afterTaxPlanningSurplusCents, null);
  assert.equal(result.exactRequiredRevenuePerPaidUnitCents, 33_459);
  assert.ok(!result.requiredPriceMissingInputs.includes('incomeTaxReserveBps'));
});

test('payment count is explicit and not silently replaced by paid slot units', () => {
  const result = calculateSharedMailerEconomics(completeInput({ paymentCount: 2 }));
  assert.equal(result.feesAndReserves.processingFixedFeesCents, 60);
  assert.equal(result.feesAndReserves.processingFeesCents, 24_351);
});

test('invalid inputs and unsolvable percentage assumptions fail safely', () => {
  assert.throws(
    () => calculateSharedMailerEconomics(completeInput({ paidSlotUnits: 1.5 })),
    /paidSlotUnits must be null or a whole number/i,
  );
  assert.throws(
    () => calculateSharedMailerEconomics(completeInput({ designCostCents: -1 })),
    /designCostCents must be null or a whole number/i,
  );

  const blocked = calculateSharedMailerEconomics(completeInput({
    processingRateBps: 9_700,
    refundReserveBps: 300,
  }));
  assert.equal(blocked.exactRequiredRevenuePerPaidUnitCents, null);
  assert.match(blocked.blockingReasons.join(' '), /less than 10000/i);
});

test('model inventory bounds block nonexistent paid-unit economics', () => {
  const blocked = calculateSharedMailerEconomics(completeInput({
    paidSlotUnits: 25,
    minimumPaidSlotUnits: 16,
    maximumPaidSlotUnits: 24,
  }));
  assert.equal(blocked.grossRevenueCents, null);
  assert.equal(blocked.exactRequiredRevenuePerPaidUnitCents, null);
  assert.match(blocked.blockingReasons.join(' '), /16–24 unit inventory/i);
});

test('an optional margin target raises the required price across formats', () => {
  const fixedDollarOnly = calculateSharedMailerEconomics(completeInput({
    supplierSubtotalCents: 564_900,
    revenuePerPaidUnitCents: null,
    taxContingencyCents: 22_990,
    softwareAndOtherCents: 15_000,
  }));
  const matchedMargin = calculateSharedMailerEconomics(completeInput({
    supplierSubtotalCents: 564_900,
    revenuePerPaidUnitCents: null,
    taxContingencyCents: 22_990,
    softwareAndOtherCents: 15_000,
    targetEconomicMarginBps: 3_373,
  }));
  assert.ok((matchedMargin.exactRequiredRevenuePerPaidUnitCents ?? 0) > (fixedDollarOnly.exactRequiredRevenuePerPaidUnitCents ?? 0));
  assert.equal(matchedMargin.marginTargetGapBps, null);
});

test('dated 5k and 10k planning prices clear fixed-surplus safeguards while stale prices are withheld', () => {
  const fiveThousand = getSharedMailerModel('shared-9x12-5000');
  const tenThousand = getSharedMailerModel('shared-9x12-10000');
  assert.ok(fiveThousand && tenThousand);

  const fiveEvaluation = evaluateDatedPlanningPrice(fiveThousand, '2026-08-19');
  const tenEvaluation = evaluateDatedPlanningPrice(tenThousand, '2026-08-19');
  assert.equal(fiveEvaluation.supported, true);
  assert.equal(tenEvaluation.supported, true);
  assert.equal(fiveEvaluation.economics?.economicMarginBps, 3_373);
  assert.equal(tenEvaluation.economics?.economicMarginBps, 2_347);
  assert.ok((fiveEvaluation.economics?.fixedSurplusTargetGapCents ?? -1) >= 0);
  assert.ok((tenEvaluation.economics?.fixedSurplusTargetGapCents ?? -1) >= 0);

  const stale = evaluateDatedPlanningPrice(tenThousand, '2026-09-18');
  assert.equal(stale.supported, false);
  assert.match(stale.reasons.join(' '), /older than the 30-day planning window/i);
});

test('public planning-price support requires both hard economic floors', () => {
  const base = getSharedMailerModel('shared-9x12-10000');
  assert.ok(base);
  const belowMargin = {
    ...base,
    suggestedPricePerPaidUnitCents: 60_000,
    costBasis: {
      ...base.costBasis,
      supplierSubtotalCents: 808_000,
    },
  } as typeof base;
  const marginEvaluation = evaluateDatedPlanningPrice(belowMargin, '2026-08-20');
  assert.ok((marginEvaluation.economics?.fixedSurplusTargetGapCents ?? -1) >= 0);
  assert.equal(marginEvaluation.economics?.economicMarginBps, 1_999);
  assert.equal(marginEvaluation.supported, false);
  assert.match(marginEvaluation.reasons.join(' '), /20% economic-margin floor/);

  const belowSurplusFloor = {
    ...base,
    planningPriceSafeguards: {
      ...base.planningPriceSafeguards!,
      targetOwnerSurplusCents: 249_999,
    },
  } as typeof base;
  const surplusEvaluation = evaluateDatedPlanningPrice(belowSurplusFloor, '2026-08-20');
  assert.equal(surplusEvaluation.supported, false);
  assert.match(surplusEvaluation.reasons.join(' '), /\$2,500 pre-income-tax surplus floor/);
});

test('custom price mixes solve a total-revenue floor and average benchmark, never a uniform SKU price', () => {
  const result = calculateSharedMailerEconomics(completeInput({
    paidSlotUnits: 18,
    revenueMode: 'custom_price_mix',
    revenuePerPaidUnitCents: null,
  }));
  assert.equal(result.revenueMode, 'custom_price_mix');
  assert.ok((result.exactRequiredGrossRevenueCents ?? 0) > 0);
  assert.equal(
    result.exactRequiredRevenuePerPaidUnitCents,
    Math.ceil(Number(result.exactRequiredGrossRevenueCents) / 18),
  );
  assert.equal(
    result.recommendedRequiredGrossRevenueCents,
    Number(result.recommendedRequiredRevenuePerPaidUnitCents) * 18,
  );
});

test('unbounded custom concepts cannot produce economics until project inventory is defined', () => {
  const blocked = calculateSharedMailerEconomics(completeInput({
    paidSlotUnits: 8,
    minimumPaidSlotUnits: null,
    maximumPaidSlotUnits: null,
  }));
  assert.equal(blocked.grossRevenueCents, null);
  assert.equal(blocked.exactRequiredGrossRevenueCents, null);
  assert.match(blocked.blockingReasons.join(' '), /bounded minimum and maximum/i);
});
