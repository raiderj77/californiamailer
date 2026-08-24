import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('legacy and server-owned route collections deny every browser read and write', () => {
  const rules = read('firestore.rules');
  for (const collection of ['territories', 'mailterritories', 'routeplans']) {
    assert.match(
      rules,
      new RegExp(`match \\/${collection}\\/\\{docId\\} \\{[\\s\\S]*?allow read, write: if false;[\\s\\S]*?\\}`),
      `${collection} must not be browser-authoritative`,
    );
  }
});

test('all territory administration is owner-authenticated, Admin SDK-backed, strict, and fetch-free', () => {
  const files = [
    'src/app/api/admin/territories/route.ts',
    'src/app/api/admin/territories/[id]/route.ts',
    'src/app/api/admin/territories/[id]/route-plans/route.ts',
    'src/app/api/admin/territories/[id]/route-plans/[planId]/route.ts',
    'src/app/api/admin/campaigns/founding/routes/route.ts',
  ];
  for (const file of files) {
    const source = read(file);
    assert.match(source, /requireOwner\(request\)/, `${file} must require the owner token`);
    assert.match(source, /getAdminFirestore\(\)/, `${file} must use the Admin SDK`);
    assert.doesNotMatch(source, /\bfetch\s*\(/, `${file} must not scrape, order, or call an external provider`);
  }
  assert.match(read(files[0]), /createTerritorySchema[\s\S]*?\.strict\(\)/);
  assert.match(read(files[1]), /updateTerritorySchema[\s\S]*?\.strict\(\)/);
  assert.match(read(files[2]), /createRoutePlanSchema[\s\S]*?\.strict\(\)/);
  assert.match(read(files[3]), /z\.object\([\s\S]*?VERIFY ROUTE PLAN[\s\S]*?\.strict\(\)/);
  assert.match(read(files[4]), /attachRoutePlanSchema[\s\S]*?\.strict\(\)/);
});

test('route plans use bounded rows, server totals, source-bound HTTPS evidence, hashes, and atomic versions', () => {
  const domain = read('src/lib/routePlans.ts');
  const create = read('src/app/api/admin/territories/[id]/route-plans/route.ts');
  assert.match(domain, /ROUTE_PLAN_MAX_ROWS = 50/);
  assert.match(domain, /ROUTE_PLAN_MAX_TOTAL_COUNT = 1_000_000/);
  assert.match(domain, /Duplicate carrier route/);
  assert.match(domain, /createHash\('sha256'\)/);
  assert.match(domain, /hostname\.endsWith\('\.usps\.com'\)/);
  assert.match(domain, /hostname\.endsWith\('\.printing4supercheap\.com'\)/);
  assert.match(create, /deriveRoutePlan\(parsed\.data\.routes, parsed\.data\.audienceMode\)/);
  assert.doesNotMatch(create.slice(create.indexOf('const createRoutePlanSchema'), create.indexOf('class TerritoryNotFoundError')), /totalCount|plannedDeliveryCount|totals/);
  assert.match(create, /territory\.routePlanSequence/);
  assert.match(create, /transaction\.update\(territoryRef, \{[\s\S]*routePlanSequence: version/);
  assert.doesNotMatch(create.slice(create.indexOf('export async function POST')), /where\('territoryId'/);
  assert.match(create, /status: 'draft'/);
  assert.match(create, /contentHash: routePlanContentHash\(hashInput\)/);
});

test('verification is exact-confirmed, fresh, integrity-checked, and content-immutable', () => {
  const action = read('src/app/api/admin/territories/[id]/route-plans/[planId]/route.ts');
  assert.match(action, /z\.literal\('VERIFY ROUTE PLAN'\)/);
  assert.match(action, /z\.literal\('RETIRE ROUTE PLAN'\)/);
  assert.match(action, /plan\.status !== 'draft'/);
  assert.match(action, /assertStoredRoutePlanIntegrity\(plan\)/);
  assert.match(action, /assertFreshRouteEvidence\(String\(plan\.sourceCheckedAt/);
  const verificationUpdate = action.slice(action.indexOf("if (parsed.data.action === 'verify')"), action.indexOf("if (plan.status === 'attached')"));
  assert.doesNotMatch(verificationUpdate, /routes:|totals:|sourceReference:|sourceUrl:|sourceCheckedAt:/);
  assert.match(action, /An attached route plan cannot be retired/);
});

test('attached plans have an exact owner-only unchanged-source recheck with separate audit evidence', () => {
  const action = read('src/app/api/admin/territories/[id]/route-plans/[planId]/route.ts');
  const recheck = action.slice(
    action.indexOf("if (parsed.data.action === 'recheck')"),
    action.indexOf("if (plan.status === 'attached')"),
  );
  assert.match(action, /z\.literal\('RECHECKED SOURCE - EXACT PLAN UNCHANGED'\)/);
  assert.match(action, /evidenceReference: z\.string\(\)\.trim\(\)\.min\(3\)\.max\(500\)/);
  assert.match(recheck, /plan\.status !== 'attached' \|\| territory\.currentRoutePlanId !== planId/);
  assert.match(recheck, /assertStoredRoutePlanIntegrity\(plan\)/);
  assert.match(recheck, /transaction\.get\(campaignRef\)/);
  assert.match(recheck, /campaignRouteEvidenceBlockReason/);
  assert.match(recheck, /sourceRecheckedAt/);
  assert.match(recheck, /sourceRecheckEvidenceReference/);
  assert.match(recheck, /routePlanSourceRecheckedAt/);
  assert.match(recheck, /routeplan\.recheck_unchanged/);
  assert.match(recheck, /toPublicCampaign/);
  assert.doesNotMatch(recheck, /routes:|totals:|contentHash:|sourceReference:|sourceUrl:|sourceCheckedAt:/);
  assert.doesNotMatch(recheck, /\bfetch\s*\(/);
});

test('founding attachment transaction blocks post-contract replacement and revokes every downstream gate', () => {
  const route = read('src/app/api/admin/campaigns/founding/routes/route.ts');
  assert.match(route, /z\.literal\('APPLY ROUTES TO FOUNDING CAMPAIGN'\)/);
  assert.match(route, /db\.runTransaction/);
  assert.match(route, /transaction\.get\(db\.collection\('reservations'\)\.where\('campaignId'/);
  assert.match(route, /transaction\.get\(db\.collection\('payments'\)\.where\('campaignId'/);
  assert.match(route, /campaignHasContractualState/);
  assert.match(route, /getApprovedCampaignContractVersions\(campaign\)/);
  assert.match(route, /campaignMatchesActiveSharedModel\(campaign\)/);
  assert.match(route, /\['draft', 'pre_launch'\]/);
  assert.match(route, /plan\.status !== 'verified'/);
  assert.match(route, /String\(campaign\.territory\) !== planInput\.territoryName/);
  assert.match(route, /Campaign and territory route-plan pointers disagree/);
  assert.match(route, /planInput\.audienceMode !== 'residential_only'/);
  assert.match(route, /derived\.plannedDeliveryCount > activeMailPieceQuantity/);
  assert.match(route, /ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS/);
  assert.match(route, /derived\.plannedDeliveryCount < minimumCompatibleDeliveryCount/);
  assert.match(route, /internal planning compatibility policy; this is not a USPS rule/);
  for (const revocation of [
    'economicsVerified: false',
    'paymentActivation: false',
    'paymentsEnabled: false',
    'artworkPreflightApproved: false',
    'ownerPrintApproved: false',
    'printReadyAt: null',
  ]) assert.match(route, new RegExp(revocation));
  assert.match(route, /routePlanSourceRecheckedAt: null/);
  assert.match(route, /routePlanSourceRecheckEvidenceReference: null/);
  assert.match(route, /if \(campaign\.published === true\)[\s\S]*toPublicCampaign/);
  assert.match(route, /transaction\.create\(db\.collection\('auditlog'\)\.doc\(\)/);
  assert.match(route, /no external lookup, order, print, postage, payment, or outreach action occurred/);
  assert.doesNotMatch(route, /\bfetch\s*\(/);
});

test('public mailing areas are bounded, current-plan-only, fresh, aggregated, and internally sanitized', () => {
  const route = read('src/app/api/mailing-areas/route.ts');
  assert.match(route, /export const dynamic = 'force-dynamic'/);
  assert.match(route, /PUBLIC_TERRITORY_LIMIT = 100/);
  assert.match(route, /collection\('mailterritories'\)\.limit\(PUBLIC_TERRITORY_LIMIT\)/);
  assert.match(route, /db\.getAll\(/);
  assert.doesNotMatch(route, /collection\('routeplans'\)\.get\(\)/);
  assert.match(route, /territory\.currentRoutePlanId/);
  assert.match(route, /storedRouteEvidenceFreshness\(currentPlan\) === 'fresh'/);
  assert.match(route, /sourceCheckedAt: effectiveRouteEvidenceCheckedAt\(currentPlan\)/);
  assert.match(route, /assertStoredRoutePlanIntegrity\(currentPlan\)/);
  for (const publicField of [
    'sourceLabel', 'sourceCheckedAt', 'routeCount', 'zipCodes', 'residentialCount',
    'businessCount', 'poBoxCount', 'totalCount', 'plannedDeliveryCount', 'audienceMode', 'mailingMethod',
  ]) assert.match(route, new RegExp(`${publicField}:`));
  for (const privateField of ['sourceReference', 'ownerUid', 'contentHash', 'territoryId:', 'routePlanId:']) {
    assert.doesNotMatch(route, new RegExp(privateField));
  }
  assert.doesNotMatch(route, /routePlan\s*=\s*\{[\s\S]*?routes:/);
  assert.match(route, /s-maxage=300, stale-while-revalidate=60/);
});

test('public campaign projection hides unstructured or unconfirmed route claims', () => {
  const records = read('src/lib/campaignRecords.ts');
  const types = read('src/lib/campaignTypes.ts');
  assert.match(records, /structuredRoutesConfirmed = record\.routesConfirmed === true/);
  assert.match(records, /typeof record\.routePlanId === 'string'/);
  assert.match(records, /Number\.isSafeInteger\(record\.routePlanVersion\)/);
  assert.match(records, /routeEvidenceFreshness\(effectiveRouteCheckedAt\) === 'fresh'/);
  assert.match(records, /routePlanEvidenceValidThrough: structuredRoutesConfirmed/);
  assert.match(records, /routeEvidenceValidThrough\(effectiveRouteCheckedAt\)/);
  assert.match(records, /verifiedHouseholds: structuredRoutesConfirmed \? Number\(record\.verifiedHouseholds\) : null/);
  assert.match(records, /selectedAreas: structuredRoutesConfirmed/);
  assert.doesNotMatch(types, /routePlanId:/);
  assert.match(types, /routesConfirmed: boolean/);
  assert.match(records, /routePlanId: null/);
});
