import {
  ACTIVE_SHARED_MODEL_VERSION,
  ACTIVE_SHARED_PLAN_ID,
  getSharedMailerModel,
} from '@/config/sharedMailerModels';
import { MINIMUM_ECONOMIC_MARGIN_BPS } from '@/config/economicSafeguards';

export const CAMPAIGN_STATUSES = [
  'draft',
  'pre_launch',
  'accepting_reservations',
  'partially_funded',
  'fully_funded',
  'proofing',
  'scheduled_for_print',
  'printed',
  'delivered',
  'completed',
  'cancelled',
  'refunding',
] as const;

export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export interface ApprovedCampaignContractVersions {
  termsVersion: string;
  fundingPolicyVersion: string;
}

// Keep this allowlist empty until both corresponding reviewed documents are
// actually published. A label that merely omits the word "draft" is not an
// approved contract version, and terms/policy versions are approved as a pair.
export const APPROVED_CAMPAIGN_CONTRACT_VERSIONS: readonly ApprovedCampaignContractVersions[] = [];

export function isAllowedContractVersion(
  value: unknown,
  allowedVersions: readonly string[],
): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim()
    && allowedVersions.includes(value);
}

export function getApprovedCampaignContractVersions(record: {
  termsVersion?: unknown;
  fundingPolicyVersion?: unknown;
}): ApprovedCampaignContractVersions | null {
  const approved = APPROVED_CAMPAIGN_CONTRACT_VERSIONS.find((candidate) =>
    isAllowedContractVersion(record.termsVersion, [candidate.termsVersion])
    && isAllowedContractVersion(record.fundingPolicyVersion, [candidate.fundingPolicyVersion]),
  );
  return approved ? { ...approved } : null;
}

export const FOUNDING_CATEGORIES = [
  { slug: 'hvac', name: 'HVAC', parentCategory: 'Home services', conflictsWith: ['plumbing'], sensitive: false },
  { slug: 'plumbing', name: 'Plumbing', parentCategory: 'Home services', conflictsWith: ['hvac'], sensitive: false },
  { slug: 'roofing', name: 'Roofing', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'electrical', name: 'Electrical', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'landscaping', name: 'Landscaping', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'pest-control', name: 'Pest Control', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'real-estate', name: 'Real Estate', parentCategory: 'Professional services', conflictsWith: [], sensitive: true },
  { slug: 'dentistry', name: 'Dentistry', parentCategory: 'Health services', conflictsWith: [], sensitive: true },
  { slug: 'legal-services', name: 'Legal Services', parentCategory: 'Professional services', conflictsWith: [], sensitive: true },
  { slug: 'financial-services', name: 'Financial Services', parentCategory: 'Professional services', conflictsWith: [], sensitive: true },
  { slug: 'automotive', name: 'Automotive Services', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'restaurant', name: 'Restaurant', parentCategory: 'Food and hospitality', conflictsWith: [], sensitive: false },
  { slug: 'pet-services', name: 'Pet Services', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'cleaning-services', name: 'Cleaning Services', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'painting', name: 'Painting', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'flooring', name: 'Flooring', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'windows-doors', name: 'Windows and Doors', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'garage-doors', name: 'Garage Doors', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'pool-service', name: 'Pool Service', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'moving-storage', name: 'Moving and Storage', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'appliance-repair', name: 'Appliance Repair', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'handyman', name: 'Handyman Services', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'tree-service', name: 'Tree Service', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'fencing', name: 'Fencing', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'gutter-service', name: 'Gutter Service', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'junk-removal', name: 'Junk Removal', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'carpet-cleaning', name: 'Carpet Cleaning', parentCategory: 'Home services', conflictsWith: [], sensitive: false },
  { slug: 'photography', name: 'Photography', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'event-services', name: 'Event Services', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'local-retail', name: 'Local Retail', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'recreation', name: 'Recreation', parentCategory: 'Local services', conflictsWith: [], sensitive: false },
  { slug: 'other', name: 'Other — owner review', parentCategory: null, conflictsWith: [], sensitive: true },
] as const;

interface CategoryCapacityInput {
  slug: string;
  conflictsWith: readonly string[];
  sensitive: boolean;
  enabled?: boolean;
}

export function compatibleNonSensitiveCategorySlugs(
  categories: readonly CategoryCapacityInput[] = FOUNDING_CATEGORIES,
): string[] {
  const selected: CategoryCapacityInput[] = [];
  const selectedSlugs = new Set<string>();
  for (const category of categories) {
    if (category.sensitive || category.enabled === false) continue;
    if (!category.slug || selectedSlugs.has(category.slug)) continue;
    const conflicts = selected.some((candidate) =>
      category.conflictsWith.includes(candidate.slug)
      || candidate.conflictsWith.includes(category.slug),
    );
    if (!conflicts) {
      selected.push(category);
      selectedSlugs.add(category.slug);
    }
  }
  return selected.map((category) => category.slug);
}

export const FOUNDING_COMPATIBLE_NON_SENSITIVE_CATEGORY_SLUGS =
  compatibleNonSensitiveCategorySlugs();

const ACTIVE_SHARED_MODEL = getSharedMailerModel(ACTIVE_SHARED_PLAN_ID);
if (
  !ACTIVE_SHARED_MODEL
  || ACTIVE_SHARED_MODEL.quantity === null
  || ACTIVE_SHARED_MODEL.slots.totalUnitsDefault === null
  || ACTIVE_SHARED_MODEL.slots.paidUnitsDefault === null
  || ACTIVE_SHARED_MODEL.suggestedPricePerPaidUnitCents === null
) {
  throw new Error('The active shared-mailer campaign model is incomplete.');
}
if (
  FOUNDING_COMPATIBLE_NON_SENSITIVE_CATEGORY_SLUGS.length
  < ACTIVE_SHARED_MODEL.slots.paidUnitsDefault
) {
  throw new Error('The founding category graph cannot support the active paid-slot minimum.');
}

export const ACTIVE_SHARED_INVENTORY_COUNT = ACTIVE_SHARED_MODEL.slots.totalUnitsDefault;
export const ACTIVE_SHARED_SLOT_PRICE_CENTS = ACTIVE_SHARED_MODEL.suggestedPricePerPaidUnitCents;
export const ACTIVE_SHARED_FUNDING_GOAL_CENTS =
  ACTIVE_SHARED_INVENTORY_COUNT * ACTIVE_SHARED_SLOT_PRICE_CENTS;

export const FOUNDING_CAMPAIGN = {
  id: 'monterey-peninsula-founding-001',
  planId: ACTIVE_SHARED_PLAN_ID,
  offerModelVersion: ACTIVE_SHARED_MODEL_VERSION,
  slug: 'monterey-peninsula-founding-mailer',
  title: 'Monterey Peninsula Founding Mailer',
  territory: 'Monterey Peninsula',
  status: 'pre_launch' as CampaignStatus,
  targetHouseholds: ACTIVE_SHARED_MODEL.quantity,
  verifiedHouseholds: null as number | null,
  householdCountBasis: null as string | null,
  candidateAreas: ['Monterey', 'Pacific Grove', 'Seaside', 'Carmel-area carrier routes'],
  selectedAreas: [] as string[],
  plannedDeliveryStart: null as string | null,
  plannedDeliveryEnd: null as string | null,
  reservationDeadline: null as string | null,
  placements: {
    standard: { count: ACTIVE_SHARED_INVENTORY_COUNT, priceCents: ACTIVE_SHARED_SLOT_PRICE_CENTS },
  },
  fundingGoalCents: ACTIVE_SHARED_FUNDING_GOAL_CENTS,
  minimumAdvertisers: ACTIVE_SHARED_MODEL.slots.paidUnitsDefault,
  minimumPaidPlacements: ACTIVE_SHARED_MODEL.slots.paidUnitsDefault,
  holdMinutes: 60,
  minimumMarginBps: MINIMUM_ECONOMIC_MARGIN_BPS,
  clearedFundingCents: 0,
  reservedFundingCents: 0,
  currentAdvertiserCount: 0,
  currentPaidPlacementCount: 0,
  paymentActivation: false,
  paymentsEnabled: false,
  economicsVerified: false,
  routesConfirmed: false,
  artworkPreflightApproved: false,
  ownerPrintApproved: false,
  termsVersion: '2026-08-draft',
  fundingPolicyVersion: '2026-08-draft',
  refundSummary:
    'If the campaign is cancelled because the cleared funding goal is not reached, eligible campaign payments are refunded under the written funding policy. Refunds are reviewed and recorded by the owner; they are not triggered by this website automatically.',
  inclusions: [
    'Ad layout included',
    'Direct communication with the owner',
    'One category per mailing unless an owner-approved exception is disclosed',
    'Online proof and written approval record',
    'Unique QR code, landing URL, or offer code',
    'Written delivery documentation',
  ],
  prelaunchNotes: [
    'Exact USPS carrier routes and the resulting delivery count have not been selected.',
    'The planned delivery period and reservation deadline have not been set.',
    'Printer, postage, shipping, payment-fee, and reserve inputs have not been verified.',
    'Online payment remains disabled until campaign economics and policies are approved.',
  ],
  categories: FOUNDING_CATEGORIES,
} as const;

export function campaignMatchesActiveSharedModel(record: {
  planId?: unknown;
  offerModelVersion?: unknown;
  targetHouseholds?: unknown;
  placements?: unknown;
  fundingGoalCents?: unknown;
  minimumPaidPlacements?: unknown;
}): boolean {
  const placements = record.placements && typeof record.placements === 'object'
    ? record.placements as Record<string, { total?: unknown; priceCents?: unknown } | undefined>
    : {};
  const placementKeys = Object.keys(placements);
  const standard = placements.standard;
  return record.planId === FOUNDING_CAMPAIGN.planId
    && record.offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion
    && Number(record.targetHouseholds) === FOUNDING_CAMPAIGN.targetHouseholds
    && placementKeys.length === 1
    && placementKeys[0] === 'standard'
    && Number(standard?.total) === FOUNDING_CAMPAIGN.placements.standard.count
    && Number(standard?.priceCents) === FOUNDING_CAMPAIGN.placements.standard.priceCents
    && Number(record.fundingGoalCents) === FOUNDING_CAMPAIGN.fundingGoalCents
    && Number(record.minimumPaidPlacements) === FOUNDING_CAMPAIGN.minimumPaidPlacements;
}

export const FOUNDING_INVENTORY_GROSS_CENTS =
  FOUNDING_CAMPAIGN.placements.standard.count * FOUNDING_CAMPAIGN.placements.standard.priceCents;

export function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export function humanizeStatus(status: string): string {
  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
