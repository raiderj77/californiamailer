import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  MINIMUM_ECONOMIC_MARGIN_BPS,
  MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
} from '@/config/economicSafeguards';
import type { SharedMailerModel } from '@/config/sharedMailerModels';

export type SharedMailerRevenueMode = 'equal_unit_price' | 'custom_price_mix';

export interface SharedMailerEconomicsInput {
  supplierSubtotalCents: number | null;
  paidSlotUnits: number | null;
  minimumPaidSlotUnits: number | null;
  maximumPaidSlotUnits: number | null;
  revenueMode: SharedMailerRevenueMode;
  revenuePerPaidUnitCents: number | null;
  paymentCount: number | null;
  processingRateBps: number | null;
  processingFixedCentsPerPayment: number | null;
  refundReserveBps: number | null;
  productionReserveBps: number | null;
  taxContingencyCents: number | null;
  designCostCents: number | null;
  ownerLaborCents: number | null;
  softwareAndOtherCents: number | null;
  incomeTaxReserveBps: number | null;
  targetOwnerSurplusCents: number | null;
  targetEconomicMarginBps: number | null;
}

export type SharedMailerEconomicsAssumptions = Pick<
  SharedMailerEconomicsInput,
  | 'processingRateBps'
  | 'processingFixedCentsPerPayment'
  | 'refundReserveBps'
  | 'productionReserveBps'
  | 'taxContingencyCents'
  | 'designCostCents'
  | 'ownerLaborCents'
  | 'softwareAndOtherCents'
  | 'incomeTaxReserveBps'
  | 'targetOwnerSurplusCents'
  | 'targetEconomicMarginBps'
>;

export const DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS: SharedMailerEconomicsAssumptions & {
  readonly assumptionStatus: 'editable_planning_assumptions';
  readonly observedAt: '2026-08-18';
  readonly labels: Readonly<Record<keyof SharedMailerEconomicsAssumptions, string>>;
} = {
  processingRateBps: 290,
  processingFixedCentsPerPayment: 30,
  refundReserveBps: 300,
  productionReserveBps: 500,
  taxContingencyCents: null,
  designCostCents: 30_000,
  ownerLaborCents: 150_000,
  softwareAndOtherCents: null,
  incomeTaxReserveBps: null,
  targetOwnerSurplusCents: MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
  targetEconomicMarginBps: null,
  assumptionStatus: 'editable_planning_assumptions',
  observedAt: '2026-08-18',
  labels: {
    processingRateBps: 'Editable 2.9% domestic online-card planning assumption; verify the actual payment account and method.',
    processingFixedCentsPerPayment: 'Editable $0.30-per-payment planning assumption; payment count is separate from paid slot units.',
    refundReserveBps: 'Editable 3% of gross held for refunds or chargebacks; a reserve is not earned take-home.',
    productionReserveBps: 'Editable 5% of the supplier subtotal held for reprint or production variance.',
    taxContingencyCents: 'Unknown until the exact supplier transaction and tax treatment are verified; never defaults to zero.',
    designCostCents: 'Editable $300 planning allowance; replace with the actual design arrangement and revision scope.',
    ownerLaborCents: 'Editable $1,500 economic allowance for owner time; it is not automatically a cash vendor payment.',
    softwareAndOtherCents: 'Unknown until software, route, delivery, stock-image, and other allocations are entered.',
    incomeTaxReserveBps: 'Unknown personal/business tax planning rate; obtain appropriate tax advice rather than assuming zero.',
    targetOwnerSurplusCents: 'Editable $2,500 economic-surplus target before personal income or self-employment tax.',
    targetEconomicMarginBps: 'Optional minimum pre-income-tax economic margin; leave blank when the goal is a fixed dollar surplus only.',
  },
};

export interface SharedMailerFeesAndReserves {
  processingVariableFeeCents: number | null;
  processingFixedFeesCents: number | null;
  processingFeesCents: number | null;
  refundReserveCents: number | null;
  productionReserveCents: number | null;
  incomeTaxReserveCents: number | null;
}

export interface MinimumPlanningSafeguards {
  processingFeeCents: number;
  refundReserveCents: number;
  productionReserveCents: number;
}

export function calculateMinimumPlanningSafeguards(
  grossRevenueCents: number,
  paymentCount: number,
  supplierSubtotalCents: number,
): MinimumPlanningSafeguards {
  assertNullableInteger('grossRevenueCents', grossRevenueCents, 0);
  assertNullableInteger('paymentCount', paymentCount, 0);
  assertNullableInteger('supplierSubtotalCents', supplierSubtotalCents, 0);
  return {
    processingFeeCents: percentageCents(grossRevenueCents, Number(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingRateBps))
      + safeMultiply(paymentCount, Number(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingFixedCentsPerPayment), 'Fixed processing fees'),
    refundReserveCents: percentageCents(grossRevenueCents, Number(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.refundReserveBps)),
    productionReserveCents: percentageCents(supplierSubtotalCents, Number(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.productionReserveBps)),
  };
}

export interface SharedMailerEconomicsResult {
  revenueMode: SharedMailerRevenueMode;
  grossRevenueCents: number | null;
  feesAndReserves: SharedMailerFeesAndReserves;
  cashBeforeOwnerLaborAndIncomeTaxCents: number | null;
  economicSurplusBeforeIncomeTaxCents: number | null;
  afterTaxPlanningSurplusCents: number | null;
  economicMarginBps: number | null;
  fixedSurplusTargetGapCents: number | null;
  marginTargetGapBps: number | null;
  exactRequiredGrossRevenueCents: number | null;
  exactRequiredRevenuePerPaidUnitCents: number | null;
  recommendedRequiredRevenuePerPaidUnitCents: number | null;
  recommendedRequiredGrossRevenueCents: number | null;
  recommendationRoundingStepCents: number;
  missingInputs: string[];
  requiredPriceMissingInputs: string[];
  blockingReasons: string[];
  targetBasis: 'fixed_pre_income_tax_surplus_with_optional_economic_margin';
}

const RECOMMENDATION_ROUNDING_STEP_CENTS = 500;
const MAX_SEARCH_GROSS_REVENUE_CENTS = 100_000_000_000;

export interface DatedPlanningPriceEvaluation {
  supported: boolean;
  asOfDate: string;
  recheckBy: string | null;
  reasons: string[];
  economics: SharedMailerEconomicsResult | null;
}

function assertNullableInteger(
  name: string,
  value: number | null,
  minimum: number,
  maximum = Number.MAX_SAFE_INTEGER,
): void {
  if (value === null) return;
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be null or a whole number from ${minimum} through ${maximum}.`);
  }
}

function safeMultiply(left: number, right: number, label: string): number {
  const result = left * right;
  if (!Number.isSafeInteger(result)) {
    throw new Error(`${label} exceeds the safe whole-cent calculation range.`);
  }
  return result;
}

function percentageCents(baseCents: number, basisPoints: number): number {
  const numerator = safeMultiply(baseCents, basisPoints, 'Percentage amount');
  return Math.ceil(numerator / 10_000);
}

function sumIfKnown(values: Array<number | null>): number | null {
  if (values.some((value) => value === null)) return null;
  const total = values.reduce<number>((sum, value) => sum + Number(value), 0);
  if (!Number.isSafeInteger(total)) {
    throw new Error('Planning cost total exceeds the safe whole-cent calculation range.');
  }
  return total;
}

function scenarioEconomicSurplus(
  input: SharedMailerEconomicsInput,
  grossRevenueCents: number,
): number {
  const paymentCount = input.paymentCount as number;
  const processingRateBps = input.processingRateBps as number;
  const processingFixedCentsPerPayment = input.processingFixedCentsPerPayment as number;
  const refundReserveBps = input.refundReserveBps as number;
  const productionReserveBps = input.productionReserveBps as number;
  const supplierSubtotalCents = input.supplierSubtotalCents as number;
  const variableProcessing = percentageCents(grossRevenueCents, processingRateBps);
  const fixedProcessing = safeMultiply(paymentCount, processingFixedCentsPerPayment, 'Fixed processing fees');
  const refundReserve = percentageCents(grossRevenueCents, refundReserveBps);
  const productionReserve = percentageCents(supplierSubtotalCents, productionReserveBps);
  const costs = sumIfKnown([
    supplierSubtotalCents,
    variableProcessing,
    fixedProcessing,
    refundReserve,
    productionReserve,
    input.taxContingencyCents,
    input.designCostCents,
    input.ownerLaborCents,
    input.softwareAndOtherCents,
  ]);

  if (costs === null) {
    throw new Error('Required-price scenario was evaluated with an unknown required input.');
  }
  return grossRevenueCents - costs;
}

function exactRequiredGrossRevenue(
  input: SharedMailerEconomicsInput,
  requiredPriceMissingInputs: string[],
  blockingReasons: string[],
): number | null {
  if (requiredPriceMissingInputs.length > 0 || blockingReasons.length > 0) return null;

  const target = input.targetOwnerSurplusCents as number;
  const meetsTargets = (grossRevenueCents: number) => {
    const surplus = scenarioEconomicSurplus(input, grossRevenueCents);
    if (surplus < target) return false;
    if (input.targetEconomicMarginBps === null) return true;
    return grossRevenueCents > 0
      && Math.floor((surplus * 10_000) / grossRevenueCents) >= input.targetEconomicMarginBps;
  };
  if (meetsTargets(0)) return 0;

  let low = 0;
  let high = 10_000;
  while (
    high < MAX_SEARCH_GROSS_REVENUE_CENTS
    && !meetsTargets(high)
  ) {
    high = Math.min(high * 2, MAX_SEARCH_GROSS_REVENUE_CENTS);
  }

  if (!meetsTargets(high)) return null;

  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (meetsTargets(middle)) high = middle;
    else low = middle;
  }

  return high;
}

export function calculateSharedMailerEconomics(
  input: SharedMailerEconomicsInput,
): SharedMailerEconomicsResult {
  assertNullableInteger('supplierSubtotalCents', input.supplierSubtotalCents, 0);
  assertNullableInteger('paidSlotUnits', input.paidSlotUnits, 1);
  assertNullableInteger('minimumPaidSlotUnits', input.minimumPaidSlotUnits, 1);
  assertNullableInteger('maximumPaidSlotUnits', input.maximumPaidSlotUnits, 1);
  if (input.minimumPaidSlotUnits !== null
    && input.maximumPaidSlotUnits !== null
    && input.minimumPaidSlotUnits > input.maximumPaidSlotUnits) {
    throw new Error('minimumPaidSlotUnits cannot exceed maximumPaidSlotUnits.');
  }
  if (!['equal_unit_price', 'custom_price_mix'].includes(input.revenueMode)) {
    throw new Error('revenueMode must be equal_unit_price or custom_price_mix.');
  }
  assertNullableInteger('revenuePerPaidUnitCents', input.revenuePerPaidUnitCents, 0);
  assertNullableInteger('paymentCount', input.paymentCount, 0);
  assertNullableInteger('processingRateBps', input.processingRateBps, 0, 10_000);
  assertNullableInteger('processingFixedCentsPerPayment', input.processingFixedCentsPerPayment, 0);
  assertNullableInteger('refundReserveBps', input.refundReserveBps, 0, 10_000);
  assertNullableInteger('productionReserveBps', input.productionReserveBps, 0, 10_000);
  assertNullableInteger('taxContingencyCents', input.taxContingencyCents, 0);
  assertNullableInteger('designCostCents', input.designCostCents, 0);
  assertNullableInteger('ownerLaborCents', input.ownerLaborCents, 0);
  assertNullableInteger('softwareAndOtherCents', input.softwareAndOtherCents, 0);
  assertNullableInteger('incomeTaxReserveBps', input.incomeTaxReserveBps, 0, 10_000);
  assertNullableInteger('targetOwnerSurplusCents', input.targetOwnerSurplusCents, 0);
  assertNullableInteger('targetEconomicMarginBps', input.targetEconomicMarginBps, 0, 10_000);

  const nullableNumericFields: Array<keyof SharedMailerEconomicsInput> = [
    'supplierSubtotalCents',
    'paidSlotUnits',
    'minimumPaidSlotUnits',
    'maximumPaidSlotUnits',
    'revenuePerPaidUnitCents',
    'paymentCount',
    'processingRateBps',
    'processingFixedCentsPerPayment',
    'refundReserveBps',
    'productionReserveBps',
    'taxContingencyCents',
    'designCostCents',
    'ownerLaborCents',
    'softwareAndOtherCents',
    'incomeTaxReserveBps',
    'targetOwnerSurplusCents',
    'targetEconomicMarginBps',
  ];
  const missingInputs = nullableNumericFields.filter((field) => input[field] === null);

  const modelBoundsMissing = input.minimumPaidSlotUnits === null || input.maximumPaidSlotUnits === null;
  const paidUnitsOutsideModelRange = input.paidSlotUnits !== null && (
    (input.minimumPaidSlotUnits !== null && input.paidSlotUnits < input.minimumPaidSlotUnits)
    || (input.maximumPaidSlotUnits !== null && input.paidSlotUnits > input.maximumPaidSlotUnits)
  );
  const grossRevenueCents = input.paidSlotUnits !== null
    && input.revenuePerPaidUnitCents !== null
    && !modelBoundsMissing
    && !paidUnitsOutsideModelRange
    ? safeMultiply(input.paidSlotUnits, input.revenuePerPaidUnitCents, 'Gross revenue')
    : null;
  const processingVariableFeeCents = grossRevenueCents !== null && input.processingRateBps !== null
    ? percentageCents(grossRevenueCents, input.processingRateBps)
    : null;
  const processingFixedFeesCents = input.paymentCount !== null && input.processingFixedCentsPerPayment !== null
    ? safeMultiply(input.paymentCount, input.processingFixedCentsPerPayment, 'Fixed processing fees')
    : null;
  const processingFeesCents = sumIfKnown([
    processingVariableFeeCents,
    processingFixedFeesCents,
  ]);
  const refundReserveCents = grossRevenueCents !== null && input.refundReserveBps !== null
    ? percentageCents(grossRevenueCents, input.refundReserveBps)
    : null;
  const productionReserveCents = input.supplierSubtotalCents !== null && input.productionReserveBps !== null
    ? percentageCents(input.supplierSubtotalCents, input.productionReserveBps)
    : null;

  const costsBeforeOwnerLaborAndIncomeTaxCents = sumIfKnown([
    input.supplierSubtotalCents,
    processingFeesCents,
    refundReserveCents,
    productionReserveCents,
    input.taxContingencyCents,
    input.designCostCents,
    input.softwareAndOtherCents,
  ]);
  const cashBeforeOwnerLaborAndIncomeTaxCents = grossRevenueCents !== null
    && costsBeforeOwnerLaborAndIncomeTaxCents !== null
    ? grossRevenueCents - costsBeforeOwnerLaborAndIncomeTaxCents
    : null;
  const economicSurplusBeforeIncomeTaxCents = cashBeforeOwnerLaborAndIncomeTaxCents !== null
    && input.ownerLaborCents !== null
    ? cashBeforeOwnerLaborAndIncomeTaxCents - input.ownerLaborCents
    : null;
  const incomeTaxReserveCents = economicSurplusBeforeIncomeTaxCents !== null
    && input.incomeTaxReserveBps !== null
    ? percentageCents(Math.max(0, economicSurplusBeforeIncomeTaxCents), input.incomeTaxReserveBps)
    : null;
  const afterTaxPlanningSurplusCents = economicSurplusBeforeIncomeTaxCents !== null
    && incomeTaxReserveCents !== null
    ? economicSurplusBeforeIncomeTaxCents - incomeTaxReserveCents
    : null;
  const economicMarginBps = economicSurplusBeforeIncomeTaxCents !== null
    && grossRevenueCents !== null
    && grossRevenueCents > 0
    ? Math.floor((economicSurplusBeforeIncomeTaxCents * 10_000) / grossRevenueCents)
    : null;
  const fixedSurplusTargetGapCents = economicSurplusBeforeIncomeTaxCents !== null
    && input.targetOwnerSurplusCents !== null
    ? economicSurplusBeforeIncomeTaxCents - input.targetOwnerSurplusCents
    : null;
  const marginTargetGapBps = economicMarginBps !== null && input.targetEconomicMarginBps !== null
    ? economicMarginBps - input.targetEconomicMarginBps
    : null;

  const requiredPriceFields: Array<keyof SharedMailerEconomicsInput> = [
    'supplierSubtotalCents',
    'paidSlotUnits',
    'minimumPaidSlotUnits',
    'maximumPaidSlotUnits',
    'paymentCount',
    'processingRateBps',
    'processingFixedCentsPerPayment',
    'refundReserveBps',
    'productionReserveBps',
    'taxContingencyCents',
    'designCostCents',
    'ownerLaborCents',
    'softwareAndOtherCents',
    'targetOwnerSurplusCents',
  ];
  const requiredPriceMissingInputs = requiredPriceFields
    .filter((field) => input[field] === null)
    .map(String);
  const blockingReasons: string[] = [];
  if (modelBoundsMissing) {
    blockingReasons.push('A bounded minimum and maximum paid-unit inventory is required before economics can be calculated.');
  }
  if (paidUnitsOutsideModelRange) {
    blockingReasons.push(`paidSlotUnits must stay within this model's ${input.minimumPaidSlotUnits}–${input.maximumPaidSlotUnits} unit inventory.`);
  }
  if (
    input.processingRateBps !== null
    && input.refundReserveBps !== null
    && input.processingRateBps + input.refundReserveBps >= 10_000
  ) {
    blockingReasons.push('processingRateBps plus refundReserveBps must be less than 10000 to solve a positive-revenue target.');
  }
  if (
    input.processingRateBps !== null
    && input.refundReserveBps !== null
    && input.targetEconomicMarginBps !== null
    && input.processingRateBps + input.refundReserveBps + input.targetEconomicMarginBps >= 10_000
  ) {
    blockingReasons.push('The requested economic margin is not reachable after percentage-based processing and refund reserves.');
  }

  const exactRequiredGrossRevenueCents = exactRequiredGrossRevenue(
    input,
    requiredPriceMissingInputs,
    blockingReasons,
  );
  const exactRequiredRevenuePerPaidUnitCents = exactRequiredGrossRevenueCents === null
    || input.paidSlotUnits === null
    ? null
    : Math.ceil(exactRequiredGrossRevenueCents / input.paidSlotUnits);
  const recommendedRequiredRevenuePerPaidUnitCents = exactRequiredRevenuePerPaidUnitCents === null
    ? null
    : Math.ceil(exactRequiredRevenuePerPaidUnitCents / RECOMMENDATION_ROUNDING_STEP_CENTS)
      * RECOMMENDATION_ROUNDING_STEP_CENTS;
  const recommendedRequiredGrossRevenueCents = recommendedRequiredRevenuePerPaidUnitCents === null
    || input.paidSlotUnits === null
    ? null
    : safeMultiply(recommendedRequiredRevenuePerPaidUnitCents, input.paidSlotUnits, 'Recommended gross revenue');

  return {
    revenueMode: input.revenueMode,
    grossRevenueCents,
    feesAndReserves: {
      processingVariableFeeCents,
      processingFixedFeesCents,
      processingFeesCents,
      refundReserveCents,
      productionReserveCents,
      incomeTaxReserveCents,
    },
    cashBeforeOwnerLaborAndIncomeTaxCents,
    economicSurplusBeforeIncomeTaxCents,
    afterTaxPlanningSurplusCents,
    economicMarginBps,
    fixedSurplusTargetGapCents,
    marginTargetGapBps,
    exactRequiredGrossRevenueCents,
    exactRequiredRevenuePerPaidUnitCents,
    recommendedRequiredRevenuePerPaidUnitCents,
    recommendedRequiredGrossRevenueCents,
    recommendationRoundingStepCents: RECOMMENDATION_ROUNDING_STEP_CENTS,
    missingInputs,
    requiredPriceMissingInputs,
    blockingReasons,
    targetBasis: 'fixed_pre_income_tax_surplus_with_optional_economic_margin',
  };
}

const PUBLIC_PRICE_ALLOWED_MISSING_COST_INPUTS = new Set([
  'taxCents',
  'designCents',
  'otherCostsCents',
]);

function parseDateOnly(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function dateOnlyAfterDays(value: string, days: number): string | null {
  const timestamp = parseDateOnly(value);
  if (timestamp === null) return null;
  return new Date(timestamp + days * 86_400_000).toISOString().slice(0, 10);
}

export function evaluateDatedPlanningPrice(
  model: SharedMailerModel,
  asOfDate: string,
): DatedPlanningPriceEvaluation {
  const reasons: string[] = [];
  const asOfTimestamp = parseDateOnly(asOfDate);
  const observedAt = model.costBasis.supplierPriceObservedAt;
  const observedTimestamp = observedAt ? parseDateOnly(observedAt) : null;
  const recheckBy = observedAt
    ? dateOnlyAfterDays(observedAt, PRINTING4SUPERCHEAP.recheckAfterDays)
    : null;

  if (asOfTimestamp === null) reasons.push('The pricing evaluation date is invalid.');
  if (model.suggestedPriceStatus !== 'dated_fixed_surplus_planning_price') {
    reasons.push('This model has no dated public planning price.');
  }
  if (model.suggestedPricePerPaidUnitCents === null) reasons.push('No planning price is configured.');
  if (!model.planningPriceSafeguards) reasons.push('Complete public-price safeguards are not configured.');
  if (model.slots.pricingMode !== 'equal_unit_price') {
    reasons.push('A custom price mix cannot be published as one uniform unit price.');
  }
  if (model.costBasis.status !== 'supplier_turnkey_snapshot_incomplete') {
    reasons.push('The model does not have a dated turnkey supplier snapshot.');
  }
  if (model.costBasis.supplierId !== PRINTING4SUPERCHEAP.id) {
    reasons.push(`${PRINTING4SUPERCHEAP.name} is not the recorded supplier.`);
  }
  if (model.costBasis.supplierSubtotalCents === null) reasons.push('The dated supplier subtotal is missing.');
  if (model.costBasis.sourceUrl !== PRINTING4SUPERCHEAP.discountSheetUrl) {
    reasons.push('The supplier snapshot is not tied to the configured dated supplier sheet.');
  }
  if (observedTimestamp === null) {
    reasons.push('The supplier observation date is missing or invalid.');
  } else if (asOfTimestamp !== null) {
    const ageDays = Math.floor((asOfTimestamp - observedTimestamp) / 86_400_000);
    if (ageDays < 0) reasons.push('The supplier observation date is in the future.');
    if (ageDays > PRINTING4SUPERCHEAP.recheckAfterDays) {
      reasons.push(`The supplier snapshot is older than the ${PRINTING4SUPERCHEAP.recheckAfterDays}-day planning window.`);
    }
  }
  if (
    model.costBasis.supplierPriceValidThrough
    && asOfTimestamp !== null
    && parseDateOnly(model.costBasis.supplierPriceValidThrough) !== null
    && asOfTimestamp > Number(parseDateOnly(model.costBasis.supplierPriceValidThrough))
  ) {
    reasons.push('The supplier-stated validity date has passed.');
  }
  const unexpectedMissingCosts = model.costBasis.missingCostInputs
    .filter((field) => !PUBLIC_PRICE_ALLOWED_MISSING_COST_INPUTS.has(field));
  if (unexpectedMissingCosts.length > 0) {
    reasons.push(`The supplier basis still lacks: ${unexpectedMissingCosts.join(', ')}.`);
  }

  const range = model.slots.paidUnitsRange;
  const safeguards = model.planningPriceSafeguards;
  if (!range) reasons.push('The model has no bounded paid-unit inventory.');
  if (safeguards && range && (safeguards.paidUnits < range.min || safeguards.paidUnits > range.max)) {
    reasons.push('The safeguarded paid-unit count is outside the model inventory.');
  }
  if (
    !safeguards
    || safeguards.targetOwnerSurplusCents < MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS
  ) {
    reasons.push('The planning price does not use the configured $2,500 pre-income-tax surplus floor.');
  }

  let economics: SharedMailerEconomicsResult | null = null;
  if (
    reasons.length === 0
    && safeguards
    && range
    && model.costBasis.supplierSubtotalCents !== null
    && model.suggestedPricePerPaidUnitCents !== null
  ) {
    try {
      economics = calculateSharedMailerEconomics({
        supplierSubtotalCents: model.costBasis.supplierSubtotalCents,
        paidSlotUnits: safeguards.paidUnits,
        minimumPaidSlotUnits: range.min,
        maximumPaidSlotUnits: range.max,
        revenueMode: model.slots.pricingMode,
        revenuePerPaidUnitCents: model.suggestedPricePerPaidUnitCents,
        paymentCount: safeguards.paymentCount,
        processingRateBps: DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingRateBps,
        processingFixedCentsPerPayment: DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingFixedCentsPerPayment,
        refundReserveBps: DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.refundReserveBps,
        productionReserveBps: DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.productionReserveBps,
        taxContingencyCents: safeguards.taxContingencyCents,
        designCostCents: safeguards.designCostCents,
        ownerLaborCents: safeguards.ownerLaborCents,
        softwareAndOtherCents: safeguards.softwareAndOtherCents,
        incomeTaxReserveBps: null,
        targetOwnerSurplusCents: safeguards.targetOwnerSurplusCents,
        targetEconomicMarginBps: MINIMUM_ECONOMIC_MARGIN_BPS,
      });
      if (
        economics.fixedSurplusTargetGapCents === null
        || economics.fixedSurplusTargetGapCents < 0
        || economics.marginTargetGapBps === null
        || economics.marginTargetGapBps < 0
        || economics.requiredPriceMissingInputs.length > 0
        || economics.blockingReasons.length > 0
      ) {
        reasons.push('The stored planning price does not clear both the $2,500 pre-income-tax surplus floor and 20% economic-margin floor.');
      }
    } catch {
      reasons.push('The stored planning price inputs failed safe whole-cent validation.');
      economics = null;
    }
  }

  return {
    supported: reasons.length === 0 && economics !== null,
    asOfDate,
    recheckBy,
    reasons,
    economics,
  };
}
