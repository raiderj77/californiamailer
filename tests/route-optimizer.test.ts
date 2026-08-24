import assert from 'node:assert/strict';
import test from 'node:test';
import {
  optimizeCarrierRoutes,
  RouteOptimizerValidationError,
  type CarrierRouteOptimizerRow,
} from '../src/lib/routeOptimizer';

function route(
  zipCode: string,
  carrierRouteCode: string,
  residentialCount: number,
  businessCount = 0,
  poBoxCount = 0,
): CarrierRouteOptimizerRow {
  return {
    zipCode,
    carrierRouteCode,
    city: 'Monterey',
    routeType: 'city',
    residentialCount,
    businessCount,
    poBoxCount,
  };
}

test('optimizer selects the exact closest whole-route subset and reports exclusions', () => {
  const result = optimizeCarrierRoutes([
    route('93940', 'C001', 2_000),
    route('93941', 'C002', 3_000),
    route('93942', 'C003', 4_100),
  ], 'residential_only', 5_000);
  assert.equal(result.selectedCount, 5_000);
  assert.equal(result.signedDelta, 0);
  assert.equal(result.direction, 'exact');
  assert.equal(result.selectedRouteCount, 2);
  assert.equal(result.excludedCount, 1);
  assert.deepEqual(result.selectedRoutes.map((item) => item.identity), [
    '93940 C001',
    '93941 C002',
  ]);
});

test('equal-distance ties prefer under target, then fewer routes', () => {
  const under = optimizeCarrierRoutes([
    route('93940', 'C001', 90),
    route('93941', 'C002', 110),
  ], 'residential_only', 100);
  assert.equal(under.selectedCount, 90);
  assert.equal(under.direction, 'under');

  const fewer = optimizeCarrierRoutes([
    route('93940', 'C001', 100),
    route('93941', 'C002', 40),
    route('93942', 'C003', 60),
  ], 'residential_only', 100);
  assert.deepEqual(fewer.selectedRoutes.map((item) => item.identity), ['93940 C001']);
});

test('canonical identity is the final deterministic tie-breaker regardless of import order', () => {
  const later = route('93941', 'C002', 100);
  const earlier = route('93940', 'C001', 100);
  const first = optimizeCarrierRoutes([later, earlier], 'residential_only', 100);
  const second = optimizeCarrierRoutes([earlier, later], 'residential_only', 100);
  assert.deepEqual(first.selectedRoutes.map((item) => item.identity), ['93940 C001']);
  assert.deepEqual(second.selectedRoutes.map((item) => item.identity), ['93940 C001']);
});

test('residential-and-business mode follows route-plan total-count semantics including PO boxes', () => {
  const rows = [
    route('93940', 'C001', 100, 20, 5),
    route('93941', 'C002', 80, 0, 0),
  ];
  const residential = optimizeCarrierRoutes(rows, 'residential_only', 120);
  const combined = optimizeCarrierRoutes(rows, 'residential_and_business', 120);
  assert.equal(residential.selectedCount, 100);
  assert.equal(combined.selectedCount, 125);
  assert.equal(combined.selectedRoutes[0].audienceCount, 125);
});

test('optimizer always returns a nonempty route subset and ignores zero-audience rows', () => {
  const result = optimizeCarrierRoutes([
    route('93940', 'C001', 0, 50),
    route('93941', 'C002', 500),
  ], 'residential_only', 1);
  assert.equal(result.selectedRouteCount, 1);
  assert.equal(result.selectedCount, 500);
  assert.equal(result.excludedCount, 1);
});

test('optimizer normalizes output without mutating imported evidence rows', () => {
  const rows = [route('93940', 'c001', 500)];
  rows[0].city = '  Pacific   Grove ';
  const before = structuredClone(rows);
  const result = optimizeCarrierRoutes(rows, 'residential_only', 500);
  assert.deepEqual(rows, before);
  assert.equal(result.selectedRoutes[0].carrierRouteCode, 'C001');
  assert.equal(result.selectedRoutes[0].city, 'Pacific Grove');
});

test('optimizer rejects unsafe targets, duplicates, row overflow, and aggregate overflow', () => {
  const base = route('93940', 'C001', 100);
  assert.throws(() => optimizeCarrierRoutes([base], 'residential_only', 0), RouteOptimizerValidationError);
  assert.throws(() => optimizeCarrierRoutes([base], 'residential_only', 1_000_001), /Target count/);
  assert.throws(() => optimizeCarrierRoutes([
    base,
    { ...base, carrierRouteCode: 'c001' },
  ], 'residential_only', 100), /Duplicate imported route/);
  assert.throws(() => optimizeCarrierRoutes(
    Array.from({ length: 51 }, (_, index) => route(
      String(93_000 + index),
      `C${String(index).padStart(3, '0')}`,
      1,
    )),
    'residential_only',
    50,
  ), /1-50 imported carrier routes/);
  assert.throws(() => optimizeCarrierRoutes([
    route('93940', 'C001', 600_000),
    route('93941', 'C002', 500_000),
  ], 'residential_only', 500_000), /exceeds 1,000,000/);
});
