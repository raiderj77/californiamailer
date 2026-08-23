import assert from 'node:assert/strict';
import test from 'node:test';
import { PRINTING4SUPERCHEAP } from '../src/config/eddmOfferings';
import {
  MINIMUM_ECONOMIC_MARGIN_BPS,
  MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
} from '../src/config/economicSafeguards';
import {
  campaignOperationalEvidenceBlockReason,
  campaignRouteEvidenceBlockReason,
  campaignSupplierEvidenceBlockReason,
} from '../src/lib/campaignOperationalGates';
import {
  deriveRoutePlan,
  routePlanContentHash,
  type RoutePlanHashInput,
} from '../src/lib/routePlans';

const CAMPAIGN_ID = 'campaign-1';
const PLAN_ID = 'plan-1';
const AT_MS = Date.parse('2026-08-19T19:00:00.000Z');
const recheckedTimestamp = { toMillis: () => Date.parse('2026-08-19T18:00:00.000Z') };

function routePlan(sourceCheckedAt = '2026-08-19') {
  const input: RoutePlanHashInput = {
    territoryId: 'monterey-peninsula',
    territorySlug: 'monterey-peninsula',
    territoryName: 'Monterey Peninsula',
    campaignId: null,
    version: 1,
    mailingMethod: 'eddm_retail',
    audienceMode: 'residential_only',
    source: 'usps_eddm_tool',
    sourceUrl: 'https://eddm.usps.com/eddm/select-routes.htm',
    sourceReference: 'Owner evidence reference',
    sourceCheckedAt,
    routes: [{
      zipCode: '93940',
      carrierRouteCode: 'C001',
      city: 'Monterey',
      routeType: 'city',
      residentialCount: 800,
      businessCount: 25,
      poBoxCount: 0,
    }],
  };
  const derived = deriveRoutePlan(input.routes, input.audienceMode);
  return {
    ...input,
    ...derived,
    contentHash: routePlanContentHash(input),
    status: 'attached',
    attachedCampaignId: CAMPAIGN_ID,
  };
}

function campaign(sourceCheckedAt = '2026-08-19') {
  return {
    routesConfirmed: true,
    routePlanId: PLAN_ID,
    routePlanVersion: 1,
    routePlanSource: 'usps_eddm_tool',
    routePlanSourceCheckedAt: sourceCheckedAt,
    territory: 'Monterey Peninsula',
    verifiedHouseholds: 800,
    targetHouseholds: 800,
    economicsVerified: true,
    economicsVerifiedAt: { toMillis: () => AT_MS - 60_000 },
    minimumMarginBps: MINIMUM_ECONOMIC_MARGIN_BPS,
    costs: {
      supplierId: PRINTING4SUPERCHEAP.id,
      printerQuoteReference: 'P4SC quote 2026-08-19',
      quoteVerifiedAt: '2026-08-19',
      targetOwnerSurplusCents: MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
    },
  };
}

test('current intact supplier and route evidence clears the operational boundary', () => {
  const currentCampaign = campaign();
  const currentPlan = routePlan();
  assert.equal(campaignSupplierEvidenceBlockReason(currentCampaign, AT_MS), null);
  assert.equal(
    campaignRouteEvidenceBlockReason(CAMPAIGN_ID, currentCampaign, PLAN_ID, currentPlan, AT_MS),
    null,
  );
  assert.equal(
    campaignOperationalEvidenceBlockReason(CAMPAIGN_ID, currentCampaign, PLAN_ID, currentPlan, AT_MS),
    null,
  );
});

test('stale original route evidence is blocked until matching separate recheck metadata exists', () => {
  const staleCampaign = campaign('2026-08-01');
  const stalePlan = routePlan('2026-08-01');
  assert.equal(
    campaignRouteEvidenceBlockReason(CAMPAIGN_ID, staleCampaign, PLAN_ID, stalePlan, AT_MS),
    'campaign-route-plan-not-current',
  );

  const recheckedPlan = {
    ...stalePlan,
    sourceRecheckedAt: '2026-08-19',
    sourceRecheckedTimestamp: recheckedTimestamp,
    sourceRecheckEvidenceReference: 'USPS source screenshot 2026-08-19',
    sourceRecheckedBy: 'owner-1',
  };
  const recheckedCampaign = {
    ...staleCampaign,
    routePlanSourceRecheckedAt: '2026-08-19',
    routePlanSourceRecheckedTimestamp: recheckedTimestamp,
    routePlanSourceRecheckEvidenceReference: 'USPS source screenshot 2026-08-19',
    routePlanSourceRecheckedBy: 'owner-1',
  };
  assert.equal(
    campaignRouteEvidenceBlockReason(CAMPAIGN_ID, recheckedCampaign, PLAN_ID, recheckedPlan, AT_MS),
    null,
  );
  assert.equal(
    campaignRouteEvidenceBlockReason(
      CAMPAIGN_ID,
      { ...recheckedCampaign, routePlanSourceRecheckedAt: '2026-08-18' },
      PLAN_ID,
      recheckedPlan,
      AT_MS,
    ),
    'campaign-route-plan-recheck-mismatch',
  );
  assert.equal(
    campaignRouteEvidenceBlockReason(
      CAMPAIGN_ID,
      {
        ...recheckedCampaign,
        routePlanSourceRecheckedTimestamp: { toMillis: () => AT_MS + 1 },
      },
      PLAN_ID,
      { ...recheckedPlan, sourceRecheckedTimestamp: { toMillis: () => AT_MS + 1 } },
      AT_MS,
    ),
    'campaign-route-plan-recheck-mismatch',
  );
});

test('the route boundary rejects tampering, stale quotes, and campaign-plan mismatches', () => {
  const currentCampaign = campaign();
  const currentPlan = routePlan();
  assert.equal(
    campaignRouteEvidenceBlockReason(
      CAMPAIGN_ID,
      currentCampaign,
      PLAN_ID,
      { ...currentPlan, plannedDeliveryCount: 799 },
      AT_MS,
    ),
    'campaign-route-plan-integrity-failed',
  );
  assert.equal(
    campaignRouteEvidenceBlockReason(
      CAMPAIGN_ID,
      { ...currentCampaign, routePlanId: 'different-plan' },
      PLAN_ID,
      currentPlan,
      AT_MS,
    ),
    'campaign-route-plan-pointer-mismatch',
  );
  assert.equal(
    campaignRouteEvidenceBlockReason(
      CAMPAIGN_ID,
      { ...currentCampaign, verifiedHouseholds: 799 },
      PLAN_ID,
      currentPlan,
      AT_MS,
    ),
    'campaign-route-plan-count-mismatch',
  );
  assert.equal(
    campaignSupplierEvidenceBlockReason({
      ...currentCampaign,
      costs: { ...currentCampaign.costs, quoteVerifiedAt: '2026-06-01' },
    }, AT_MS),
    'campaign-supplier-quote-not-current',
  );
  assert.equal(
    campaignSupplierEvidenceBlockReason({
      ...currentCampaign,
      economicsVerifiedAt: { toMillis: () => AT_MS + 1 },
    }, AT_MS),
    'campaign-economics-evidence-timestamp-invalid',
  );
});

test('legacy verified economics cannot bypass either server economic floor', () => {
  const currentCampaign = campaign();
  assert.equal(
    campaignSupplierEvidenceBlockReason({
      ...currentCampaign,
      minimumMarginBps: MINIMUM_ECONOMIC_MARGIN_BPS - 1,
    }, AT_MS),
    'campaign-margin-floor-not-met',
  );
  assert.equal(
    campaignSupplierEvidenceBlockReason({
      ...currentCampaign,
      costs: {
        ...currentCampaign.costs,
        targetOwnerSurplusCents: MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS - 1,
      },
    }, AT_MS),
    'campaign-owner-surplus-floor-not-met',
  );
});
