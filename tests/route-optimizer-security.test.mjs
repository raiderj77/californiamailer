import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('route optimizer is bounded, deterministic, local, and planning-only', () => {
  const helper = read('src/lib/routeOptimizer.ts');
  assert.match(helper, /ROUTE_OPTIMIZER_MAX_ROWS = 50/);
  assert.match(helper, /ROUTE_OPTIMIZER_MAX_TARGET = 1_000_000/);
  assert.match(helper, /Math\.abs\(sum - targetCount\)/);
  assert.match(helper, /overTarget !== bestOverTarget/);
  assert.match(helper, /routeCount !== bestRouteCount/);
  assert.match(helper, /mask > bestMask/);
  assert.doesNotMatch(helper, /fetch\(|https?:\/\/|Math\.random|crypto|demographic/i);
  assert.doesNotMatch(helper, /ownerFetch|stripe|NextResponse|collection\(|runTransaction|checkout|payment|postage/i);
});

test('owner UI recomputes suggestions and requires explicit draft-only application', () => {
  const page = read('src/app/(dashboard)/eddm/page.tsx');
  assert.match(page, /ROUTE_OPTIMIZER_QUICK_TARGETS = \[2_500, 5_000, 10_000, 20_000\]/);
  assert.match(page, /optimization: optimizeCarrierRoutes\([\s\S]*parsedRoutes\.rows,[\s\S]*routePlanDraft\.audienceMode,[\s\S]*Number\(routeOptimizerTarget\)/);
  assert.match(page, /\[parsedRoutes, routeOptimizerTarget, routePlanDraft\.audienceMode\]/);
  const apply = page.slice(
    page.indexOf('function applyRouteOptimization'),
    page.indexOf('if (loading)'),
  );
  assert.match(apply, /setRoutePlanDraft/);
  assert.match(apply, /routeRowsToText\(optimization\.selectedRoutes\)/);
  assert.doesNotMatch(apply, /ownerFetch|createRoutePlan|changeRoutePlan|attachToFoundingCampaign/);
  assert.match(page, /type="button" disabled=\{disabled\} onClick=\{onApply\}/);
  assert.match(page, /Apply suggested subset to editable draft rows/);
  assert.match(page, /does not fetch or scrape route data, optimize demographics/);
  assert.match(page, /no route plan was created, verified, attached, ordered, or purchased/);
  assert.match(page, /Manually compare this subset with the current official source or written supplier evidence/);
});
