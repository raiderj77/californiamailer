import assert from 'node:assert/strict';
import test from 'node:test';
import { toPublicCampaign } from '../src/lib/campaignRecords';
import {
  approvedRouteSourceUrl,
  assertFreshRouteEvidence,
  assertStoredRoutePlanIntegrity,
  deriveRoutePlan,
  effectiveRouteEvidenceCheckedAt,
  normalizeTerritorySlug,
  routeEvidenceFreshness,
  routeEvidenceValidThrough,
  routePlanContentHash,
  RoutePlanValidationError,
  selectedAreaLabels,
  storedRouteEvidenceFreshness,
  type RoutePlanHashInput,
  type RouteRowInput,
} from '../src/lib/routePlans';

const routes: RouteRowInput[] = [
  {
    zipCode: '93940',
    carrierRouteCode: 'c001',
    city: '  Monterey  ',
    routeType: 'city',
    residentialCount: 420,
    businessCount: 25,
    poBoxCount: 5,
  },
  {
    zipCode: '93950',
    carrierRouteCode: 'C002',
    city: 'Pacific   Grove',
    routeType: 'city',
    residentialCount: 380,
    businessCount: 15,
    poBoxCount: 0,
  },
];

function hashInput(overrides: Partial<RoutePlanHashInput> = {}): RoutePlanHashInput {
  return {
    territoryId: 'monterey-peninsula',
    territorySlug: 'monterey-peninsula',
    territoryName: 'Monterey Peninsula',
    campaignId: null,
    version: 1,
    mailingMethod: 'eddm_retail',
    audienceMode: 'residential_only',
    source: 'usps_eddm_tool',
    sourceUrl: 'https://eddm.usps.com/eddm/select-routes.htm?m=1',
    sourceReference: 'Owner screenshot 2026-08-19',
    sourceCheckedAt: '2026-08-19',
    routes,
    ...overrides,
  };
}

test('route-plan derivation normalizes rows and owns all delivery math', () => {
  const residential = deriveRoutePlan(routes, 'residential_only');
  assert.equal(residential.routes[0].carrierRouteCode, 'C001');
  assert.equal(residential.routes[0].city, 'Monterey');
  assert.equal(residential.routes[1].city, 'Pacific Grove');
  assert.deepEqual(residential.totals, {
    residentialCount: 800,
    businessCount: 40,
    poBoxCount: 5,
    totalCount: 845,
  });
  assert.equal(residential.plannedDeliveryCount, 800);
  assert.equal(deriveRoutePlan(routes, 'residential_and_business').plannedDeliveryCount, 845);
});

test('route-plan derivation rejects duplicate normalized ZIP and carrier-route pairs', () => {
  const duplicate = [routes[0], { ...routes[0], carrierRouteCode: 'C001' }];
  assert.throws(
    () => deriveRoutePlan(duplicate, 'residential_only'),
    /Duplicate carrier route 93940 C001/,
  );
});

test('route plans enforce row caps, nonzero selected audiences, and aggregate caps', () => {
  assert.throws(
    () => deriveRoutePlan(Array.from({ length: 51 }, (_, index) => ({
      ...routes[0],
      carrierRouteCode: `C${String(index).padStart(3, '0')}`,
    })), 'residential_only'),
    /1-50 carrier routes/,
  );
  assert.throws(
    () => deriveRoutePlan([{ ...routes[0], residentialCount: 0 }], 'residential_only'),
    /no delivery points for the chosen audience mode/,
  );
  assert.throws(
    () => deriveRoutePlan([
      { ...routes[0], residentialCount: 600_000, businessCount: 0, poBoxCount: 0 },
      { ...routes[1], residentialCount: 500_000, businessCount: 0, poBoxCount: 0 },
    ], 'residential_only'),
    /exceeds 1,000,000/,
  );
});

test('the seven-day freshness rule is a CaliforniaMailer policy and blocks future or stale evidence', () => {
  const now = new Date('2026-08-19T19:00:00.000Z');
  assert.equal(routeEvidenceFreshness('2026-08-12', now), 'fresh');
  assert.equal(routeEvidenceFreshness('2026-08-11', now), 'stale');
  assert.equal(routeEvidenceFreshness('2026-08-20', now), 'future');
  assert.equal(routeEvidenceFreshness('2026-02-30', now), 'invalid');
  assert.equal(routeEvidenceValidThrough('2026-08-12'), '2026-08-19');
  assert.equal(routeEvidenceValidThrough('2026-02-30'), null);
  assert.doesNotThrow(() => assertFreshRouteEvidence('2026-08-12', now));
  assert.throws(() => assertFreshRouteEvidence('2026-08-11', now), /CaliforniaMailer's 7-day freshness policy/);
  assert.throws(() => assertFreshRouteEvidence('2026-08-20', now), /cannot be in the future/);
});

test('a separate owner source recheck refreshes only the effective evidence date and fails closed on bad dates', () => {
  const now = new Date('2026-08-19T19:00:00.000Z');
  const original = { sourceCheckedAt: '2026-07-01' };
  assert.equal(effectiveRouteEvidenceCheckedAt(original), '2026-07-01');
  assert.equal(storedRouteEvidenceFreshness(original, now), 'stale');

  const rechecked = { ...original, sourceRecheckedAt: '2026-08-19' };
  assert.equal(effectiveRouteEvidenceCheckedAt(rechecked), '2026-08-19');
  assert.equal(storedRouteEvidenceFreshness(rechecked, now), 'fresh');
  assert.equal(storedRouteEvidenceFreshness({ ...original, sourceRecheckedAt: '2026-08-20' }, now), 'future');
  assert.equal(storedRouteEvidenceFreshness({ ...original, sourceRecheckedAt: '2026-02-30' }, now), 'invalid');
});

test('route evidence URLs are HTTPS and bound to the selected primary source', () => {
  assert.equal(
    approvedRouteSourceUrl('usps_eddm_tool', 'https://eddm.usps.com/eddm/select-routes.htm?m=1'),
    'https://eddm.usps.com/eddm/select-routes.htm?m=1',
  );
  assert.equal(
    approvedRouteSourceUrl('printing4supercheap_quote', 'https://www.printing4supercheap.com/'),
    'https://www.printing4supercheap.com/',
  );
  assert.throws(
    () => approvedRouteSourceUrl('usps_eddm_tool', 'http://eddm.usps.com/eddm/select-routes.htm'),
    /credential-free HTTPS/,
  );
  assert.throws(
    () => approvedRouteSourceUrl('printing4supercheap_quote', 'https://example.com/quote'),
    /does not match/,
  );
});

test('verified plan content hashes are deterministic and detect immutable evidence changes', () => {
  const input = hashInput();
  const derived = deriveRoutePlan(input.routes, input.audienceMode);
  const hash = routePlanContentHash(input);
  assert.equal(hash, routePlanContentHash(hashInput()));
  assert.notEqual(hash, routePlanContentHash(hashInput({ sourceReference: 'Different evidence' })));
  const stored = {
    ...input,
    routes: derived.routes,
    totals: derived.totals,
    plannedDeliveryCount: derived.plannedDeliveryCount,
    contentHash: hash,
  };
  assert.deepEqual(assertStoredRoutePlanIntegrity(stored), derived);
  assert.throws(
    () => assertStoredRoutePlanIntegrity({ ...stored, plannedDeliveryCount: 801 }),
    /delivery total does not match/,
  );
  assert.throws(
    () => assertStoredRoutePlanIntegrity({ ...stored, sourceReference: 'tampered' }),
    /content hash does not match/,
  );
});

test('territory slugs and public selected-area labels are normalized without route-row leakage', () => {
  assert.equal(normalizeTerritorySlug('  Monterey & Pacific Gróve  '), 'monterey-pacific-grove');
  const derived = deriveRoutePlan(routes, 'residential_only');
  assert.deepEqual(selectedAreaLabels(derived.routes, 'ca'), [
    'Monterey, CA 93940',
    'Pacific Grove, CA 93950',
  ]);
  assert.throws(() => normalizeTerritorySlug('---'), RoutePlanValidationError);
});

test('public campaign projection removes stale and unconfirmed exact route claims', () => {
  const base = {
    id: 'campaign-1',
    planId: 'plan',
    offerModelVersion: 'model',
    slug: 'campaign',
    title: 'Campaign',
    territory: 'Monterey Peninsula',
    status: 'pre_launch',
    targetHouseholds: 5_000,
    verifiedHouseholds: 4_800,
    householdCountBasis: 'Internal evidence',
    selectedAreas: ['Monterey, CA 93940'],
    routePlanId: 'route-plan-1',
    routePlanVersion: 1,
    routePlanSourceCheckedAt: '2000-01-01',
    routesConfirmed: true,
    placements: {
      standard: { total: 24, available: 24, held: 0, sold: 0, priceCents: 34_900 },
    },
    categories: [],
    fundingGoalCents: 1,
    minimumAdvertisers: 1,
    minimumPaidPlacements: 1,
    refundSummary: '',
    inclusions: [],
    campaignNotes: [],
  };
  const stale = toPublicCampaign(base, true);
  assert.equal(stale.fundingGoalCents, null);
  assert.deepEqual(stale.placements.standard, { total: 24, available: 24, held: 0, sold: 0 });
  assert.equal('priceCents' in (stale.placements.standard || {}), false);
  assert.equal(stale.routesConfirmed, false);
  assert.equal(stale.verifiedHouseholds, null);
  assert.equal(stale.householdCountBasis, null);
  assert.deepEqual(stale.selectedAreas, []);
  assert.equal(stale.routePlanSourceCheckedAt, null);
  assert.equal(stale.routePlanEvidenceValidThrough, null);

  const unconfirmed = toPublicCampaign({
    ...base,
    routesConfirmed: false,
    routePlanSourceCheckedAt: new Date().toISOString().slice(0, 10),
  }, true);
  assert.equal(unconfirmed.routesConfirmed, false);
  assert.equal(unconfirmed.verifiedHouseholds, null);
  assert.deepEqual(unconfirmed.selectedAreas, []);
  assert.equal(unconfirmed.routePlanEvidenceValidThrough, null);

  const recentEvidenceDate = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const fresh = toPublicCampaign({
    ...base,
    routePlanSourceCheckedAt: recentEvidenceDate,
  }, true);
  assert.equal(fresh.routesConfirmed, true);
  assert.equal(fresh.verifiedHouseholds, 4_800);
  assert.equal(fresh.routePlanEvidenceValidThrough, routeEvidenceValidThrough(recentEvidenceDate));

  const oldOriginalWithFreshRecheck = toPublicCampaign({
    ...base,
    routePlanSourceRecheckedAt: recentEvidenceDate,
  }, true);
  assert.equal(oldOriginalWithFreshRecheck.routesConfirmed, true);
  assert.equal(oldOriginalWithFreshRecheck.routePlanSourceCheckedAt, recentEvidenceDate);
  assert.equal(
    oldOriginalWithFreshRecheck.routePlanEvidenceValidThrough,
    routeEvidenceValidThrough(recentEvidenceDate),
  );
});
