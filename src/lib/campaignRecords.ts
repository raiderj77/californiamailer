import { Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import type { PlacementSize, PublicCampaign } from '@/lib/campaignTypes';
import { routeEvidenceFreshness, routeEvidenceValidThrough } from '@/lib/routePlans';

export function createFoundingCampaignRecord(ownerUid: string) {
  return {
    id: FOUNDING_CAMPAIGN.id,
    planId: FOUNDING_CAMPAIGN.planId,
    offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
    slug: FOUNDING_CAMPAIGN.slug,
    title: FOUNDING_CAMPAIGN.title,
    territory: FOUNDING_CAMPAIGN.territory,
    status: FOUNDING_CAMPAIGN.status,
    ownerUid,
    targetHouseholds: FOUNDING_CAMPAIGN.targetHouseholds,
    verifiedHouseholds: null,
    householdCountBasis: null,
    candidateAreas: [...FOUNDING_CAMPAIGN.candidateAreas],
    selectedAreas: [],
    routePlanId: null,
    routePlanVersion: null,
    routePlanSource: null,
    routePlanSourceCheckedAt: null,
    routePlanAttachedBy: null,
    routePlanAttachedAt: null,
    plannedDeliveryStart: null,
    plannedDeliveryEnd: null,
    reservationDeadline: null,
    placements: {
      standard: {
        total: FOUNDING_CAMPAIGN.placements.standard.count,
        available: FOUNDING_CAMPAIGN.placements.standard.count,
        held: 0,
        sold: 0,
        priceCents: FOUNDING_CAMPAIGN.placements.standard.priceCents,
      },
    },
    categories: FOUNDING_CAMPAIGN.categories.map((category) => ({
      slug: category.slug,
      name: category.name,
      parentCategory: category.parentCategory,
      conflictsWith: [...category.conflictsWith],
      sensitive: category.sensitive,
      maximumAdvertisers: 1,
      status: 'paused',
    })),
    categoryExceptions: [],
    fundingGoalCents: FOUNDING_CAMPAIGN.fundingGoalCents,
    clearedFundingCents: 0,
    reservedFundingCents: 0,
    minimumAdvertisers: FOUNDING_CAMPAIGN.minimumAdvertisers,
    minimumPaidPlacements: FOUNDING_CAMPAIGN.minimumPaidPlacements,
    currentAdvertiserCount: 0,
    currentPaidPlacementCount: 0,
    holdMinutes: FOUNDING_CAMPAIGN.holdMinutes,
    minimumMarginBps: FOUNDING_CAMPAIGN.minimumMarginBps,
    paymentActivation: false,
    paymentsEnabled: false,
    economicsVerified: false,
    routesConfirmed: false,
    artworkPreflightApproved: false,
    ownerPrintApproved: false,
    termsVersion: FOUNDING_CAMPAIGN.termsVersion,
    fundingPolicyVersion: FOUNDING_CAMPAIGN.fundingPolicyVersion,
    refundSummary: FOUNDING_CAMPAIGN.refundSummary,
    inclusions: [...FOUNDING_CAMPAIGN.inclusions],
    campaignNotes: [...FOUNDING_CAMPAIGN.prelaunchNotes],
    costs: {
      supplierId: PRINTING4SUPERCHEAP.id,
      mailPieceCount: null,
      printingCostCents: null,
      postageCostCents: null,
      shippingCostCents: null,
      taxCostCents: null,
      designCostCents: null,
      ownerLaborCostCents: null,
      processingFeeCents: null,
      refundReserveCents: null,
      reprintReserveCents: null,
      softwareAllocationCents: null,
      otherExpensesCents: null,
      targetOwnerSurplusCents: null,
      printerQuoteReference: null,
      quoteVerifiedAt: null,
      version: 1,
    },
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  };
}

export function toPublicCampaign(record: DocumentData, published: boolean): PublicCampaign {
  const effectiveRouteCheckedAt = typeof record.routePlanSourceRecheckedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.routePlanSourceRecheckedAt)
    ? record.routePlanSourceRecheckedAt
    : record.routePlanSourceCheckedAt;
  const structuredRoutesConfirmed = record.routesConfirmed === true
    && typeof record.routePlanId === 'string'
    && record.routePlanId.length > 0
    && Number.isSafeInteger(record.routePlanVersion)
    && Number(record.routePlanVersion) > 0
    && typeof record.routePlanSourceCheckedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.routePlanSourceCheckedAt)
    && routeEvidenceFreshness(effectiveRouteCheckedAt) === 'fresh'
    && Number.isSafeInteger(record.verifiedHouseholds)
    && Number(record.verifiedHouseholds) > 0;
  const standardPlacement = record.placements?.standard;
  return {
    id: String(record.id),
    planId: String(record.planId || ''),
    offerModelVersion: String(record.offerModelVersion || ''),
    slug: String(record.slug),
    title: String(record.title),
    territory: String(record.territory),
    status: record.status,
    targetHouseholds: Number(record.targetHouseholds),
    verifiedHouseholds: structuredRoutesConfirmed ? Number(record.verifiedHouseholds) : null,
    householdCountBasis: structuredRoutesConfirmed && typeof record.householdCountBasis === 'string'
      ? record.householdCountBasis
      : null,
    selectedAreas: structuredRoutesConfirmed && Array.isArray(record.selectedAreas)
      ? record.selectedAreas.map(String)
      : [],
    routesConfirmed: structuredRoutesConfirmed,
    routePlanVersion: structuredRoutesConfirmed ? Number(record.routePlanVersion) : null,
    routePlanSourceCheckedAt: structuredRoutesConfirmed ? effectiveRouteCheckedAt : null,
    routePlanEvidenceValidThrough: structuredRoutesConfirmed
      ? routeEvidenceValidThrough(effectiveRouteCheckedAt)
      : null,
    plannedDeliveryStart: record.plannedDeliveryStart || null,
    plannedDeliveryEnd: record.plannedDeliveryEnd || null,
    reservationDeadline: record.reservationDeadline || null,
    placements: standardPlacement && typeof standardPlacement === 'object'
      ? {
          standard: {
            total: Number(standardPlacement.total || 0),
            available: Number(standardPlacement.available || 0),
            held: Number(standardPlacement.held || 0),
            sold: Number(standardPlacement.sold || 0),
          },
        }
      : {},
    categories: Array.isArray(record.categories)
      ? record.categories.map((category: DocumentData) => ({
          slug: String(category.slug),
          name: String(category.name),
          status: category.status,
          sensitive: Boolean(category.sensitive),
        }))
      : [],
    // Customer prices and their derived funding goal are evaluated per request
    // from current dated evidence. Never persist those values in the
    // browser-readable Firestore projection, where they could outlive the
    // supplier verification window.
    fundingGoalCents: null,
    clearedFundingCents: Number(record.clearedFundingCents || 0),
    reservedFundingCents: Number(record.reservedFundingCents || 0),
    minimumAdvertisers: Number(record.minimumAdvertisers),
    minimumPaidPlacements: Number(record.minimumPaidPlacements || record.minimumAdvertisers),
    currentAdvertiserCount: Number(record.currentAdvertiserCount || 0),
    currentPaidPlacementCount: Number(record.currentPaidPlacementCount || 0),
    refundSummary: String(record.refundSummary),
    inclusions: Array.isArray(record.inclusions) ? record.inclusions.map(String) : [],
    campaignNotes: Array.isArray(record.campaignNotes) ? record.campaignNotes.map(String) : [],
    published,
    updatedAt: Timestamp.now(),
  };
}

export function placementSlotId(campaignId: string, size: PlacementSize, position: number) {
  return `${campaignId}__${size}__${String(position).padStart(2, '0')}`;
}
