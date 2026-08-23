import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function block(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.ok(startIndex >= 0, `${start} must exist`);
  const endIndex = source.indexOf(end, startIndex);
  assert.ok(endIndex > startIndex, `${start} must end before ${end}`);
  return source.slice(startIndex, endIndex);
}

test('owner prospect suppression is transactional, identity-wide, bounded, and audited', () => {
  const route = read('src/app/api/admin/prospects/suppress/route.ts');

  assert.match(route, /const suppressionSchema = z\.object\([\s\S]*identity: identitySchema\.optional\(\)[\s\S]*\)\.strict\(\)/);
  assert.match(route, /const DNC_PROPAGATION_WRITE_LIMIT = 450/);
  assert.match(route, /const owner = await requireOwner\(request\)/);
  assert.match(route, /await db\.runTransaction\(async \(transaction\)/);
  assert.match(route, /const \[targetSnapshot, barrierSnapshot\] = await Promise\.all\(\[[\s\S]*transaction\.get\(targetRef\)[\s\S]*transaction\.get\(barrierRef\)/);
  assert.match(route, /target\.userId !== owner\.uid/);
  assert.match(route, /identityCandidates = parsed\.data\.identity \? \[target, proposedTarget\] : \[target\]/);
  assert.match(route, /queryProspectIdentityCollisionsForCandidates\([\s\S]*identityCandidates/);
  assert.ok((route.match(/querySourceIdentityCollisionsForCandidates\(/g) || []).length >= 2);
  assert.match(route, /db\.collection\('reservationinterests'\)/);
  assert.match(route, /db\.collection\('quoteinquiries'\)/);
  assert.match(route, /discovered\.set\(targetKey/);
  assert.match(route, /for \(const \{ document \} of identityLookup\.collisions\)/);
  assert.match(route, /\.slice\(0, DNC_PROPAGATION_WRITE_LIMIT\)/);
  assert.match(route, /unresolved_identity_lookup_/);
  assert.match(route, /status: 'do_not_contact'[\s\S]*doNotContact: true[\s\S]*suppressed: true/);
  assert.match(route, /action: 'prospect\.suppress_identity'/);
});

test('direct prospect DNC suppresses complete same-identity unlinked interest and quote sources', () => {
  const route = read('src/app/api/admin/prospects/suppress/route.ts');
  const helper = read('src/lib/prospectIdentityServer.ts');

  assert.match(helper, /querySourceIdentityCollisionsForCandidates/);
  assert.match(helper, /sourceQuery\.limit\(SUPPRESSION_SOURCE_SCAN_LIMIT \+ 1\)/);
  assert.match(helper, /snapshot\.docs\.slice\(0, SUPPRESSION_SOURCE_SCAN_LIMIT\)\.filter/);
  assert.match(helper, /usableCandidates\.some\(\(candidate\) =>[\s\S]*highConfidenceProspectIdentityMatches/);
  assert.match(route, /for \(const document of interestLookup\.collisions\)[\s\S]*kind: 'interest'/);
  assert.match(route, /for \(const document of quoteLookup\.collisions\)[\s\S]*kind: 'quote'/);
  assert.match(route, /matching_prospect_identity_interest/);
  assert.match(route, /matching_prospect_identity_quote/);
  assert.match(route, /prospect\.kind !== 'prospect'[\s\S]*identitySuppressionPropagationStatus/);
  assert.match(route, /\[identityLookup, interestLookup, quoteLookup\]\.find\(\(lookup\) => !lookup\.complete\)/);
});

test('identity correction and DNC are applied in one transaction against old and proposed identities', () => {
  const route = read('src/app/api/admin/prospects/suppress/route.ts');
  const page = read('src/app/(dashboard)/prospects/page.tsx');
  const helper = read('src/lib/prospectIdentityServer.ts');

  assert.match(route, /const proposedTarget = parsed\.data\.identity[\s\S]*\{ \.\.\.target, \.\.\.parsed\.data\.identity \}/);
  assert.match(route, /parsed\.data\.identity \? \[target, proposedTarget\] : \[target\]/);
  assert.match(route, /prospect\.id === targetSnapshot\.id && parsed\.data\.identity[\s\S]*normalizedProspectIdentityFields\(proposedTarget\)/);
  assert.match(helper, /queryProspectIdentityCollisionsForCandidates/);
  assert.match(helper, /const usableCandidates = candidates\.filter\(hasHighConfidenceProspectIdentity\)/);
  assert.match(helper, /const normalizedCandidates = usableCandidates\.map\(normalizeProspectIdentity\)/);
  assert.match(helper, /normalizedCandidates\.flatMap/);

  const singleSave = block(page, 'async function save(', 'async function applyBulkStatus()');
  assert.match(singleSave, /needsServerSuppression = Boolean\(editing && \(requestsNewSuppression \|\| isProspectSuppressed\(editing\)\)\)/);
  assert.match(singleSave, /const idToken = await user\.getIdToken\(\)/);
  assert.match(singleSave, /suppressProspectIdentity\(editing\.id, idToken, suppressionIdentity\)/);
  assert.ok(
    singleSave.indexOf('suppressProspectIdentity(editing.id') < singleSave.indexOf('updateProspect(editing.id, savedDraft, idToken)'),
    'server identity suppression must complete before the factual owner API update',
  );
  assert.doesNotMatch(singleSave, /Save identity-field corrections first/);
});

test('single, bulk, and CSV DNC paths use the owner server transaction', () => {
  const page = read('src/app/(dashboard)/prospects/page.tsx');
  const importer = read('src/app/(dashboard)/import/page.tsx');
  const client = read('src/lib/prospectSuppressionClient.ts');

  const bulk = block(page, 'async function applyBulkStatus()', 'function exportRows()');
  const bulkDnc = block(bulk, "if (bulkStatus === 'do_not_contact')", '} else {');
  assert.match(bulkDnc, /suppressProspectIdentity\(item\.id, idToken\)/);
  assert.doesNotMatch(bulkDnc, /updateProspect\(/);

  assert.match(importer, /status: 'poor_fit'[\s\S]*doNotContact: false[\s\S]*suppressed: false/);
  assert.ok((importer.match(/addProspect\([\s\S]*?, idToken\)/g) || []).length >= 1);
  assert.match(importer, /await suppressProspectIdentity\(prospectId, idToken\)/);
  assert.match(client, /fetch\('\/api\/admin\/prospects\/suppress'/);
  assert.match(client, /body: JSON\.stringify\(\{ prospectId, \.\.\.\(identity \? \{ identity \} : \{\}\) \}\)/);
});

test('browser rules deny prospect creates and every identity change while preserving bounded factual edits', () => {
  const rules = read('firestore.rules');
  const helpers = block(rules, 'function isManualProspectStatus(data)', 'match /territories/{docId}');
  const prospects = block(rules, 'match /prospects/{docId}', 'match /campaigns/{docId}');
  const browserData = read('src/lib/firestore.ts');

  assert.match(helpers, /function preventsClientProspectSuppressionTransition\(\)[\s\S]*isSuppressedProspect\(resource\.data\)[\s\S]*!isSuppressedProspect\(request\.resource\.data\)/);
  assert.match(helpers, /function preservesProspectIdentity\(\)/);
  assert.match(helpers, /function onlyUpdatesSafeProspectFacts\(\)[\s\S]*affectedKeys\(\)\.hasOnly/);
  for (const field of ['businessName', 'email', 'phone', 'website', 'normalizedBusinessName', 'normalizedEmail', 'normalizedPhone', 'normalizedWebsite']) {
    assert.match(helpers, new RegExp(`request\\.resource\\.data\\.get\\('${field}'`));
  }
  assert.match(prospects, /allow create: if false/);
  assert.match(prospects, /&& preventsClientProspectSuppressionTransition\(\)/);
  assert.match(prospects, /&& preservesProspectIdentity\(\)/);
  assert.match(prospects, /&& onlyUpdatesSafeProspectFacts\(\)/);
  assert.match(browserData, /fetch\('\/api\/admin\/prospects'/);
  assert.doesNotMatch(browserData, /addDoc\(collection\(db, 'prospects'\)/);
});

test('incomplete identity propagation activates a durable owner-wide contact barrier', () => {
  const route = read('src/app/api/admin/prospects/suppress/route.ts');
  const interests = read('src/app/api/admin/interests/route.ts');
  const crm = read('src/app/api/admin/crm/route.ts');
  const reservations = read('src/app/api/reservations/route.ts');
  const rules = read('firestore.rules');

  assert.match(route, /transaction\.set\(barrierRef,[\s\S]*propagationStatus\.startsWith\('unresolved_'\)/);
  assert.match(route, /contactBlocked: true[\s\S]*resolutionStatus: 'owner_reconciliation_required'/);
  assert.match(route, /export async function GET\(request: NextRequest\)[\s\S]*isProspectContactBarrierActive/);
  assert.match(interests, /if \(suppressing\) \{[\s\S]*transaction\.set\(barrierRef,[\s\S]*propagationStatus\?\.startsWith\('unresolved_'\)/);
  assert.ok((interests.match(/isProspectContactBarrierActive\(barrierSnapshot\.data\(\)\)/g) || []).length >= 3);
  assert.ok((crm.match(/isProspectContactBarrierActive\(barrierSnapshot\.data\(\)\)/g) || []).length >= 3);
  assert.match(reservations, /transaction\.get\([\s\S]*PROSPECT_SUPPRESSION_STATE_COLLECTION[\s\S]*isProspectContactBarrierActive\(contactBarrier\.data\(\)\)/);
  assert.match(rules, /function ownerContactBarrierActive\(ownerUid\)/);
  assert.match(rules, /function contactStateAllowed\(ownerUid, data\)/);
  assert.match(rules, /allow create: if createsOwned\(\) && createsSafeActivity\(\)/);
  assert.match(rules, /match \/prospectsuppressionstate\/\{docId\}[\s\S]*allow read, write: if false/);
});

test('browser contact surfaces fetch the barrier fail closed and keep DNC available', () => {
  const prospects = read('src/app/(dashboard)/prospects/page.tsx');
  const salesDesk = read('src/app/(dashboard)/sales-desk/page.tsx');
  const activities = read('src/app/(dashboard)/activities/page.tsx');
  const inbox = read('src/app/(dashboard)/interest-inbox/page.tsx');
  const crm = read('src/app/(dashboard)/crm/page.tsx');

  for (const source of [prospects, salesDesk, activities]) {
    assert.match(source, /getProspectContactBarrier/);
    assert.match(source, /setContactGloballyBlocked\(true\)/);
  }
  assert.match(prospects, /contactQueueStatuses\.has\(draft\.status\) && contactGloballyBlocked/);
  assert.match(prospects, /contactQueueStatuses\.has\(bulkStatus\)[\s\S]*contactGloballyBlocked/);
  assert.match(salesDesk, /contactGloballyBlocked \? \[\] : prospects\.filter/);
  assert.match(salesDesk, /disabled=\{contactGloballyBlocked\}[\s\S]*Copy for manual review/);
  assert.match(activities, /contactGloballyBlocked && \['email', 'call', 'proposal', 'meeting'\]\.includes\(type\)/);
  assert.match(inbox, /contactBlocked = suppressed \|\| item\.linkedProspectSafetyBlocked \|\| contactGloballyBlocked/);
  assert.match(inbox, /disabled=\{busyId === item\.id \|\| suppressed\}[\s\S]*Do not contact/);
  assert.match(crm, /contactGloballyBlocked = snapshot\?\.contactGloballyBlocked !== false/);
});
