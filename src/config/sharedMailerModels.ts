import {
  PRINTING4SUPERCHEAP,
  type MailingMethod,
} from '@/config/eddmOfferings';
import { calculateEddmEstimate } from '@/lib/eddmPricing';

export const ACTIVE_SHARED_PLAN_ID = 'shared-9x12-5000' as const;
export const ACTIVE_SHARED_MODEL_VERSION = 'shared-mailers-v2' as const;

export type SharedMailerFamily =
  | 'shared_9x12'
  | 'shared_12x15'
  | 'm6'
  | 'm3'
  | 'community_card'
  | 'new_mover_sparker'
  | 'directory_card';

export type SharedMailerLayoutStatus =
  | 'experimental_preflight_required'
  | 'documented_capacity_preflight_required'
  | 'adjustable_family_preflight_required'
  | 'targeted_panel_preflight_required'
  | 'custom_layout_required';

export type SharedMailerCostStatus =
  | 'supplier_turnkey_snapshot_incomplete'
  | 'external_mailing_cost_required'
  | 'custom_cost_required';

export type SharedMailerProductionReadiness =
  | 'never_from_catalog_preflight_required'
  | 'owner_preflight_and_current_costs_required';

export interface SharedMailerUnitRange {
  min: number;
  max: number;
}

export interface SharedMailerSlotPlan {
  unitLabel: 'slot' | 'panel' | 'listing';
  totalUnitsDefault: number | null;
  totalUnitsRange: SharedMailerUnitRange | null;
  paidUnitsDefault: number | null;
  paidUnitsRange: SharedMailerUnitRange | null;
  houseUnitsDefault: number | null;
  pricingMode: 'equal_unit_price' | 'custom_price_mix';
}

export interface SharedMailerLayoutEvidence {
  status: SharedMailerLayoutStatus;
  sourceKind: 'first_party_hrm_guidance' | 'owner_requested_experiment';
  sourceObservedAt: string;
  documentedComfortableUnits: SharedMailerUnitRange | null;
  documentedMaximumUnits: number | null;
  note: string;
  sourceUrls: readonly string[];
}

export interface SharedMailerCostBasis {
  status: SharedMailerCostStatus;
  supplierId: typeof PRINTING4SUPERCHEAP.id | null;
  supplierSpecificationId: string | null;
  supplierQuantity: number | null;
  supplierSubtotalCents: number | null;
  supplierPriceObservedAt: string | null;
  supplierPriceValidThrough: string | null;
  sourceUrl: string | null;
  missingCostInputs: readonly string[];
  note: string;
}

export interface SharedMailerPlanningPriceSafeguards {
  paidUnits: number;
  paymentCount: number;
  taxContingencyCents: number;
  designCostCents: number;
  ownerLaborCents: number;
  softwareAndOtherCents: number;
  targetOwnerSurplusCents: number;
}

export interface SharedMailerModel {
  id: string;
  version: typeof ACTIVE_SHARED_MODEL_VERSION;
  family: SharedMailerFamily;
  name: string;
  summary: string;
  widthInches: number | null;
  heightInches: number | null;
  quantity: number | null;
  mailingMethod: MailingMethod | 'custom';
  slots: SharedMailerSlotPlan;
  suggestedPricePerPaidUnitCents: number | null;
  suggestedPriceStatus: 'dated_fixed_surplus_planning_price' | 'custom_quote_required';
  planningPriceSafeguards?: SharedMailerPlanningPriceSafeguards;
  layoutEvidence: SharedMailerLayoutEvidence;
  costBasis: SharedMailerCostBasis;
  productionReadiness: SharedMailerProductionReadiness;
}

const HRM_LAYOUT_CAPACITY_URL = 'https://highresponsemarketing.com/part-iv-cheaper-design/';
const HRM_COMMUNITY_URL = 'https://highresponsemarketing.com/community/';
const HRM_NEW_MOVER_URL = 'https://highresponsemarketing.com/new-mover-marketer/';
const HRM_M6_URL = 'https://highresponsemarketing.com/samples/m6/';
const HRM_FORMATS_URL = 'https://highresponsemarketing.com/newbie-guide/what-i-sell/';
const HRM_M3_PRODUCT_URL = 'https://highresponsemarketing.com/products/';
const HRM_SHARED_POSTCARD_URL = 'https://highresponsemarketing.com/ep-61-the-magical-2-part-combo-for-winning-eddm-mailings/';
const HRM_DIRECTORY_URL = 'https://highresponsemarketing.com/grant/';
const HRM_SOURCE_OBSERVED_AT = '2026-08-23';

function turnkeyCostBasis(specificationId: string, quantity: number): SharedMailerCostBasis {
  const estimate = calculateEddmEstimate({
    specificationId,
    quantity,
    fulfillment: 'turnkey',
    taxCents: null,
    designCents: null,
    otherCostsCents: null,
  });

  return {
    status: 'supplier_turnkey_snapshot_incomplete',
    supplierId: PRINTING4SUPERCHEAP.id,
    supplierSpecificationId: specificationId,
    supplierQuantity: quantity,
    supplierSubtotalCents: estimate.knownSubtotalCents,
    supplierPriceObservedAt: PRINTING4SUPERCHEAP.priceObservedAt,
    supplierPriceValidThrough: PRINTING4SUPERCHEAP.priceValidThrough,
    sourceUrl: PRINTING4SUPERCHEAP.discountSheetUrl,
    missingCostInputs: estimate.missingInputs,
    note: 'Planning subtotal includes the dated print snapshot, turnkey EDDM amount, and banding. Tax, design, other expenses, final routes, and a current signed-in supplier total remain unverified.',
  };
}

function externalCostBasis(note: string): SharedMailerCostBasis {
  return {
    status: 'external_mailing_cost_required',
    supplierId: PRINTING4SUPERCHEAP.id,
    supplierSpecificationId: null,
    supplierQuantity: null,
    supplierSubtotalCents: null,
    supplierPriceObservedAt: null,
    supplierPriceValidThrough: null,
    sourceUrl: PRINTING4SUPERCHEAP.productUrl,
    missingCostInputs: ['supplierSubtotalCents', 'listCostCents', 'postageCents', 'fulfillmentCents'],
    note: `${PRINTING4SUPERCHEAP.name} is the fixed production printer; ${note}`,
  };
}

function customCostBasis(note: string): SharedMailerCostBasis {
  return {
    status: 'custom_cost_required',
    supplierId: PRINTING4SUPERCHEAP.id,
    supplierSpecificationId: null,
    supplierQuantity: null,
    supplierSubtotalCents: null,
    supplierPriceObservedAt: null,
    supplierPriceValidThrough: null,
    sourceUrl: PRINTING4SUPERCHEAP.productUrl,
    missingCostInputs: ['supplierSubtotalCents', 'layoutCostCents', 'mailingCostCents'],
    note: `${PRINTING4SUPERCHEAP.name} is the fixed production printer; ${note}`,
  };
}

const NINE_BY_TWELVE_EXPERIMENT_EVIDENCE: SharedMailerLayoutEvidence = {
  status: 'experimental_preflight_required',
  sourceKind: 'owner_requested_experiment',
  sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
  documentedComfortableUnits: { min: 16, max: 18 },
  documentedMaximumUnits: 18,
  note: 'HRM guidance describes roughly 16–18 ads as comfortable on a 9 × 12. The requested 24-unit layout exceeds that guidance and is experimental; postal indicia, address area, branding, disclosures, legibility, and the combined artwork must pass manual preflight. The catalog can never make it production-ready.',
  sourceUrls: [HRM_LAYOUT_CAPACITY_URL],
};

const TWELVE_BY_FIFTEEN_EVIDENCE: SharedMailerLayoutEvidence = {
  status: 'documented_capacity_preflight_required',
  sourceKind: 'first_party_hrm_guidance',
  sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
  documentedComfortableUnits: null,
  documentedMaximumUnits: 25,
  note: 'HRM material describes the larger 12 × 15 family as supporting up to 25 ads. A 24-unit plan is within that stated ceiling but still requires an actual template, postal clear zones, legibility review, and combined-artwork preflight.',
  sourceUrls: [HRM_LAYOUT_CAPACITY_URL],
};

const M6_EVIDENCE: SharedMailerLayoutEvidence = {
  status: 'adjustable_family_preflight_required',
  sourceKind: 'first_party_hrm_guidance',
  sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
  documentedComfortableUnits: { min: 6, max: 6 },
  documentedMaximumUnits: 9,
  note: 'M6 is modeled as six equal paid units. HRM also shows M7–M9 split-layout variants, but those are not evidence that 7–9 placements have equal size, value, or price; each variant requires a custom layout and price mix.',
  sourceUrls: [HRM_FORMATS_URL, HRM_M6_URL],
};

const M3_EVIDENCE: SharedMailerLayoutEvidence = {
  status: 'targeted_panel_preflight_required',
  sourceKind: 'owner_requested_experiment',
  sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
  documentedComfortableUnits: null,
  documentedMaximumUnits: null,
  note: 'HRM first-party material identifies M3 as a shared-postcard family, but it does not publicly verify the configured two-paid-plus-one-house panel mix. That mix is an owner planning assumption; audience, list, postage, panel boundaries, economics, and final artwork remain project-specific.',
  sourceUrls: [HRM_M3_PRODUCT_URL, HRM_SHARED_POSTCARD_URL],
};

const EQUAL_24_SLOT_PLAN: SharedMailerSlotPlan = {
  unitLabel: 'slot',
  totalUnitsDefault: 24,
  totalUnitsRange: { min: 24, max: 24 },
  paidUnitsDefault: 24,
  paidUnitsRange: { min: 16, max: 24 },
  houseUnitsDefault: 0,
  pricingMode: 'equal_unit_price',
};

export const SHARED_MAILER_MODELS = [
  {
    id: ACTIVE_SHARED_PLAN_ID,
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'shared_9x12',
    name: '9 × 12 shared mailer · 5,000 pieces · experimental 24 units',
    summary: 'Requested 24-unit EDDM planning layout. Pricing assumes all 24 paid units; production remains blocked on template preflight and complete current costs.',
    widthInches: 9,
    heightInches: 12,
    quantity: 5_000,
    mailingMethod: 'eddm_saturation',
    slots: EQUAL_24_SLOT_PLAN,
    suggestedPricePerPaidUnitCents: 34_900,
    suggestedPriceStatus: 'dated_fixed_surplus_planning_price',
    planningPriceSafeguards: {
      paidUnits: 24,
      paymentCount: 24,
      taxContingencyCents: 12_090,
      designCostCents: 30_000,
      ownerLaborCents: 150_000,
      softwareAndOtherCents: 10_000,
      targetOwnerSurplusCents: 250_000,
    },
    layoutEvidence: NINE_BY_TWELVE_EXPERIMENT_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-9x12-14pt', 5_000),
    productionReadiness: 'never_from_catalog_preflight_required',
  },
  {
    id: 'shared-9x12-10000',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'shared_9x12',
    name: '9 × 12 shared mailer · 10,000 pieces · experimental 24 units',
    summary: 'Requested 24-unit EDDM planning layout at 10,000 pieces. The additional reach does not waive route, deposit, or layout validation.',
    widthInches: 9,
    heightInches: 12,
    quantity: 10_000,
    mailingMethod: 'eddm_saturation',
    slots: EQUAL_24_SLOT_PLAN,
    suggestedPricePerPaidUnitCents: 47_900,
    suggestedPriceStatus: 'dated_fixed_surplus_planning_price',
    planningPriceSafeguards: {
      paidUnits: 24,
      paymentCount: 24,
      taxContingencyCents: 22_990,
      designCostCents: 30_000,
      ownerLaborCents: 150_000,
      softwareAndOtherCents: 15_000,
      targetOwnerSurplusCents: 250_000,
    },
    layoutEvidence: NINE_BY_TWELVE_EXPERIMENT_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-9x12-14pt', 10_000),
    productionReadiness: 'never_from_catalog_preflight_required',
  },
  {
    id: 'shared-12x15-5000',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'shared_12x15',
    name: '12 × 15 shared mailer · 5,000 pieces · 24 units',
    summary: 'Larger shared EDDM format with 24 planning units, subject to actual template and postal preflight.',
    widthInches: 12,
    heightInches: 15,
    quantity: 5_000,
    mailingMethod: 'eddm_saturation',
    slots: EQUAL_24_SLOT_PLAN,
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: TWELVE_BY_FIFTEEN_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-12x15-14pt', 5_000),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'shared-12x15-10000',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'shared_12x15',
    name: '12 × 15 shared mailer · 10,000 pieces · 24 units',
    summary: 'Larger shared EDDM format with 24 planning units at 10,000 pieces, subject to current route and supplier verification.',
    widthInches: 12,
    heightInches: 15,
    quantity: 10_000,
    mailingMethod: 'eddm_saturation',
    slots: EQUAL_24_SLOT_PLAN,
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: TWELVE_BY_FIFTEEN_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-12x15-14pt', 10_000),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'm6-6x11-2500',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'm6',
    name: 'M6 · 6 × 11 · 2,500 pieces',
    summary: 'Six-unit small shared EDDM model. M7–M9 split-layout variants require a separate custom layout and price mix.',
    widthInches: 6,
    heightInches: 11,
    quantity: 2_500,
    mailingMethod: 'eddm_saturation',
    slots: {
      unitLabel: 'slot',
      totalUnitsDefault: 6,
      totalUnitsRange: { min: 6, max: 6 },
      paidUnitsDefault: 6,
      paidUnitsRange: { min: 6, max: 6 },
      houseUnitsDefault: 0,
      pricingMode: 'equal_unit_price',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: M6_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-6x11-14pt', 2_500),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'm6-6-5x12-2500',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'm6',
    name: 'M6 · 6.5 × 12 · 2,500 pieces',
    summary: 'Six-unit small shared EDDM model. M7–M9 split-layout variants require a separate custom layout and price mix.',
    widthInches: 6.5,
    heightInches: 12,
    quantity: 2_500,
    mailingMethod: 'eddm_saturation',
    slots: {
      unitLabel: 'slot',
      totalUnitsDefault: 6,
      totalUnitsRange: { min: 6, max: 6 },
      paidUnitsDefault: 6,
      paidUnitsRange: { min: 6, max: 6 },
      houseUnitsDefault: 0,
      pricingMode: 'equal_unit_price',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: M6_EVIDENCE,
    costBasis: turnkeyCostBasis('eddm-6-5x12-14pt', 2_500),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'm3-6x11-targeted',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'm3',
    name: 'M3 targeted · 6 × 11',
    summary: 'Owner-configured three-panel addressed planning format with two paid partners and one house panel. Public first-party material does not verify that exact mix, and it is not costed as EDDM.',
    widthInches: 6,
    heightInches: 11,
    quantity: null,
    mailingMethod: 'addressed_targeted',
    slots: {
      unitLabel: 'panel',
      totalUnitsDefault: 3,
      totalUnitsRange: { min: 3, max: 3 },
      paidUnitsDefault: 2,
      paidUnitsRange: { min: 2, max: 2 },
      houseUnitsDefault: 1,
      pricingMode: 'equal_unit_price',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: M3_EVIDENCE,
    costBasis: externalCostBasis('A current addressed-print, list, postage, preparation, and delivery total is required. An EDDM subtotal must not be substituted.'),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'm3-6-5x12-targeted',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'm3',
    name: 'M3 targeted · 6.5 × 12',
    summary: 'Owner-configured three-panel addressed planning format with two paid partners and one house panel. Public first-party material does not verify that exact mix, and it is not costed as EDDM.',
    widthInches: 6.5,
    heightInches: 12,
    quantity: null,
    mailingMethod: 'addressed_targeted',
    slots: {
      unitLabel: 'panel',
      totalUnitsDefault: 3,
      totalUnitsRange: { min: 3, max: 3 },
      paidUnitsDefault: 2,
      paidUnitsRange: { min: 2, max: 2 },
      houseUnitsDefault: 1,
      pricingMode: 'equal_unit_price',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: M3_EVIDENCE,
    costBasis: externalCostBasis('A current addressed-print, list, postage, preparation, and delivery total is required. An EDDM subtotal must not be substituted.'),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'community-card-custom',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'community_card',
    name: 'Community Card · custom project',
    summary: 'Community-led shared card whose dimensions, audience, inventory, partner mix, and fulfillment are set for the specific project.',
    widthInches: null,
    heightInches: null,
    quantity: null,
    mailingMethod: 'custom',
    slots: {
      unitLabel: 'slot',
      totalUnitsDefault: null,
      totalUnitsRange: null,
      paidUnitsDefault: null,
      paidUnitsRange: null,
      houseUnitsDefault: null,
      pricingMode: 'custom_price_mix',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: {
      status: 'custom_layout_required',
      sourceKind: 'first_party_hrm_guidance',
      sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
      documentedComfortableUnits: null,
      documentedMaximumUnits: null,
      note: 'The community-card concept does not establish one production size or inventory. Define and preflight the actual project rather than borrowing another model’s slots.',
      sourceUrls: [HRM_COMMUNITY_URL],
    },
    costBasis: customCostBasis('Layout, print quantity, audience, postage, preparation, and delivery must be quoted for the specific community project.'),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'new-mover-sparker-shared',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'new_mover_sparker',
    name: 'New Mover / Sparker shared targeted card',
    summary: 'Shared addressed card for a verified new-mover or similar event-triggered audience; it is not an every-address EDDM route.',
    widthInches: null,
    heightInches: null,
    quantity: null,
    mailingMethod: 'addressed_targeted',
    slots: {
      unitLabel: 'slot',
      totalUnitsDefault: null,
      totalUnitsRange: null,
      paidUnitsDefault: null,
      paidUnitsRange: null,
      houseUnitsDefault: null,
      pricingMode: 'custom_price_mix',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: {
      status: 'custom_layout_required',
      sourceKind: 'first_party_hrm_guidance',
      sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
      documentedComfortableUnits: null,
      documentedMaximumUnits: null,
      note: 'Audience freshness, lawful list use, layout, advertiser mix, and mailing method must be verified for every run.',
      sourceUrls: [HRM_NEW_MOVER_URL],
    },
    costBasis: externalCostBasis('A current list count and price, addressed printing, postage, preparation, and fulfillment quote are required.'),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
  {
    id: 'directory-card-9x12',
    version: ACTIVE_SHARED_MODEL_VERSION,
    family: 'directory_card',
    name: '9 × 12 Directory Card · up to 72 listings',
    summary: 'High-count directory-style listing format with a custom mix of listing sizes and prices, not 72 equal full ad slots.',
    widthInches: 9,
    heightInches: 12,
    quantity: null,
    mailingMethod: 'custom',
    slots: {
      unitLabel: 'listing',
      totalUnitsDefault: null,
      totalUnitsRange: { min: 1, max: 72 },
      paidUnitsDefault: null,
      paidUnitsRange: { min: 1, max: 72 },
      houseUnitsDefault: null,
      pricingMode: 'custom_price_mix',
    },
    suggestedPricePerPaidUnitCents: null,
    suggestedPriceStatus: 'custom_quote_required',
    layoutEvidence: {
      status: 'custom_layout_required',
      sourceKind: 'first_party_hrm_guidance',
      sourceObservedAt: HRM_SOURCE_OBSERVED_AT,
      documentedComfortableUnits: null,
      documentedMaximumUnits: 72,
      note: 'The cited ceiling refers to directory listings with a custom size and price mix. It must not be represented as 72 equal display-ad slots, and an actual directory template must pass preflight.',
      sourceUrls: [HRM_DIRECTORY_URL],
    },
    costBasis: customCostBasis('Select the print quantity, mailing method, listing mix, design workload, and fulfillment before calculating prices.'),
    productionReadiness: 'owner_preflight_and_current_costs_required',
  },
] as const satisfies readonly SharedMailerModel[];

export type SharedMailerModelId = (typeof SHARED_MAILER_MODELS)[number]['id'];

export function getSharedMailerModel(id: string): SharedMailerModel | null {
  return SHARED_MAILER_MODELS.find((model) => model.id === id) ?? null;
}

export function sharedMailerFillSensitivityUnits(model: SharedMailerModel): number[] {
  const range = model.slots.paidUnitsRange;
  if (!range) return [];

  const candidates = model.slots.totalUnitsDefault === 24
    ? [16, 18, 24]
    : [range.min, model.slots.paidUnitsDefault, range.max];
  return [...new Set(candidates.filter((value): value is number => Number.isSafeInteger(value)))]
    .filter((value) => value >= range.min && value <= range.max)
    .sort((left, right) => left - right);
}
