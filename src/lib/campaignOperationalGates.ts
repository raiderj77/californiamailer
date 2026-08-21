import type { DocumentData } from 'firebase-admin/firestore';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  MINIMUM_ECONOMIC_MARGIN_BPS,
  MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
} from '@/config/economicSafeguards';
import { quoteVerificationStatus } from '@/lib/businessRules';
import {
  assertStoredRoutePlanIntegrity,
  californiaDateKey,
  effectiveRouteEvidenceCheckedAt,
  ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS,
  routeEvidenceFreshness,
  routePlanHashInputFromRecord,
} from '@/lib/routePlans';

function timestampMillis(value: unknown): number | null {
  if (!value || typeof value !== 'object' || !('toMillis' in value)) return null;
  const toMillis = (value as { toMillis?: unknown }).toMillis;
  if (typeof toMillis !== 'function') return null;
  const milliseconds = Number(toMillis.call(value));
  return Number.isFinite(milliseconds) && milliseconds > 0 ? milliseconds : null;
}

export type CampaignOperationalEvidenceBlockReason =
  | 'campaign-evidence-time-invalid'
  | 'campaign-economics-not-verified'
  | 'campaign-economics-evidence-timestamp-invalid'
  | 'campaign-owner-surplus-floor-not-met'
  | 'campaign-margin-floor-not-met'
  | 'campaign-supplier-mismatch'
  | 'campaign-supplier-reference-missing'
  | 'campaign-supplier-quote-not-current'
  | 'campaign-routes-not-confirmed'
  | 'campaign-route-plan-missing'
  | 'campaign-route-plan-state-mismatch'
  | 'campaign-route-plan-integrity-failed'
  | 'campaign-route-plan-pointer-mismatch'
  | 'campaign-route-plan-source-mismatch'
  | 'campaign-route-plan-recheck-mismatch'
  | 'campaign-route-plan-audience-mismatch'
  | 'campaign-route-plan-count-mismatch'
  | 'campaign-route-plan-not-current';

export function campaignSupplierEvidenceBlockReason(
  campaign: DocumentData | undefined,
  atMs = Date.now(),
): CampaignOperationalEvidenceBlockReason | null {
  if (!Number.isFinite(atMs) || atMs <= 0) return 'campaign-evidence-time-invalid';
  if (!campaign || campaign.economicsVerified !== true) return 'campaign-economics-not-verified';
  const economicsVerifiedMs = timestampMillis(campaign.economicsVerifiedAt);
  if (economicsVerifiedMs === null || economicsVerifiedMs > atMs) {
    return 'campaign-economics-evidence-timestamp-invalid';
  }
  const minimumMarginBps = Number(campaign.minimumMarginBps);
  if (
    !Number.isSafeInteger(minimumMarginBps)
    || minimumMarginBps < MINIMUM_ECONOMIC_MARGIN_BPS
    || minimumMarginBps > 10_000
  ) {
    return 'campaign-margin-floor-not-met';
  }
  const costs = campaign.costs && typeof campaign.costs === 'object'
    ? campaign.costs as DocumentData
    : {};
  const targetOwnerSurplusCents = Number(costs.targetOwnerSurplusCents);
  if (
    !Number.isSafeInteger(targetOwnerSurplusCents)
    || targetOwnerSurplusCents < MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS
  ) {
    return 'campaign-owner-surplus-floor-not-met';
  }
  if (costs.supplierId !== PRINTING4SUPERCHEAP.id) return 'campaign-supplier-mismatch';
  if (typeof costs.printerQuoteReference !== 'string' || !costs.printerQuoteReference.trim()) {
    return 'campaign-supplier-reference-missing';
  }
  if (!quoteVerificationStatus(
    typeof costs.quoteVerifiedAt === 'string' ? costs.quoteVerifiedAt : null,
    new Date(atMs),
  ).current) {
    return 'campaign-supplier-quote-not-current';
  }
  return null;
}

export function campaignRouteEvidenceBlockReason(
  campaignId: string,
  campaign: DocumentData | undefined,
  routePlanId: string | null,
  routePlan: DocumentData | undefined,
  atMs = Date.now(),
): CampaignOperationalEvidenceBlockReason | null {
  if (!Number.isFinite(atMs) || atMs <= 0) return 'campaign-evidence-time-invalid';
  if (!campaign || campaign.routesConfirmed !== true) return 'campaign-routes-not-confirmed';
  if (!routePlanId || !routePlan) return 'campaign-route-plan-missing';
  if (routePlan.status !== 'attached' || routePlan.attachedCampaignId !== campaignId) {
    return 'campaign-route-plan-state-mismatch';
  }

  let input;
  let derived;
  try {
    input = routePlanHashInputFromRecord(routePlan);
    derived = assertStoredRoutePlanIntegrity(routePlan);
  } catch {
    return 'campaign-route-plan-integrity-failed';
  }

  if (
    campaign.routePlanId !== routePlanId
    || Number(campaign.routePlanVersion) !== input.version
    || (input.campaignId !== null && input.campaignId !== campaignId)
    || String(campaign.territory || '') !== input.territoryName
  ) {
    return 'campaign-route-plan-pointer-mismatch';
  }
  if (
    campaign.routePlanSource !== input.source
    || campaign.routePlanSourceCheckedAt !== input.sourceCheckedAt
  ) {
    return 'campaign-route-plan-source-mismatch';
  }
  const planRecheckedAt = typeof routePlan.sourceRecheckedAt === 'string'
    ? routePlan.sourceRecheckedAt
    : null;
  const campaignRecheckedAt = typeof campaign.routePlanSourceRecheckedAt === 'string'
    ? campaign.routePlanSourceRecheckedAt
    : null;
  if (planRecheckedAt !== campaignRecheckedAt) {
    return 'campaign-route-plan-recheck-mismatch';
  }
  if (planRecheckedAt) {
    const planRecheckedMs = timestampMillis(routePlan.sourceRecheckedTimestamp);
    const campaignRecheckedMs = timestampMillis(campaign.routePlanSourceRecheckedTimestamp);
    const planEvidenceReference = typeof routePlan.sourceRecheckEvidenceReference === 'string'
      ? routePlan.sourceRecheckEvidenceReference.trim()
      : '';
    const campaignEvidenceReference = typeof campaign.routePlanSourceRecheckEvidenceReference === 'string'
      ? campaign.routePlanSourceRecheckEvidenceReference.trim()
      : '';
    const planRecheckedBy = typeof routePlan.sourceRecheckedBy === 'string'
      ? routePlan.sourceRecheckedBy.trim()
      : '';
    const campaignRecheckedBy = typeof campaign.routePlanSourceRecheckedBy === 'string'
      ? campaign.routePlanSourceRecheckedBy.trim()
      : '';
    if (
      planRecheckedMs === null
      || campaignRecheckedMs === null
      || planRecheckedMs !== campaignRecheckedMs
      || planRecheckedMs > atMs
      || californiaDateKey(new Date(planRecheckedMs)) !== planRecheckedAt
      || !planEvidenceReference
      || planEvidenceReference !== campaignEvidenceReference
      || !planRecheckedBy
      || planRecheckedBy !== campaignRecheckedBy
    ) {
      return 'campaign-route-plan-recheck-mismatch';
    }
  }
  if (input.audienceMode !== 'residential_only') return 'campaign-route-plan-audience-mismatch';

  const targetHouseholds = Number(campaign.targetHouseholds);
  const minimumCompatibleDeliveryCount = Math.ceil(
    targetHouseholds * ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS / 10_000,
  );
  if (
    !Number.isSafeInteger(targetHouseholds)
    || targetHouseholds < 1
    || Number(campaign.verifiedHouseholds) !== derived.plannedDeliveryCount
    || derived.plannedDeliveryCount < minimumCompatibleDeliveryCount
    || derived.plannedDeliveryCount > targetHouseholds
  ) {
    return 'campaign-route-plan-count-mismatch';
  }
  if (routeEvidenceFreshness(effectiveRouteEvidenceCheckedAt(routePlan), new Date(atMs)) !== 'fresh') {
    return 'campaign-route-plan-not-current';
  }
  return null;
}

export function campaignOperationalEvidenceBlockReason(
  campaignId: string,
  campaign: DocumentData | undefined,
  routePlanId: string | null,
  routePlan: DocumentData | undefined,
  atMs = Date.now(),
): CampaignOperationalEvidenceBlockReason | null {
  return campaignSupplierEvidenceBlockReason(campaign, atMs)
    ?? campaignRouteEvidenceBlockReason(campaignId, campaign, routePlanId, routePlan, atMs);
}

export function campaignOperationalEvidenceBlockerLabel(
  reason: CampaignOperationalEvidenceBlockReason | null,
): string | null {
  if (!reason) return null;
  if (reason.startsWith('campaign-supplier-') || reason.startsWith('campaign-economics-')) {
    return 'Current verified Printing4SuperCheap quote and economics evidence';
  }
  if (reason === 'campaign-owner-surplus-floor-not-met') {
    return 'Server minimum $2,500 pre-income-tax owner economic surplus';
  }
  if (reason === 'campaign-margin-floor-not-met') {
    return 'Server minimum 20% economic contribution margin';
  }
  if (reason === 'campaign-evidence-time-invalid') return 'Valid evidence-check time';
  return 'Current intact attached carrier-route evidence';
}
