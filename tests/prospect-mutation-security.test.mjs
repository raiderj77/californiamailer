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

test('owner prospect mutation API validates a strict payload and scans every suppression source before writing', () => {
  const route = read('src/app/api/admin/prospects/route.ts');

  assert.match(route, /const prospectChangesSchema = z\.object\([\s\S]*\)\.strict\(\)/);
  assert.match(route, /const mutationSchema = z\.discriminatedUnion\('action'/);
  assert.match(route, /const owner = await requireOwner\(request\)/);
  assert.match(route, /const result = await db\.runTransaction\(async \(transaction\)/);
  assert.match(route, /transaction\.get\(barrierRef\)/);
  assert.match(route, /current\.userId !== owner\.uid/);
  assert.match(route, /queryProspectIdentityCollisionsForCandidates\(/);
  assert.equal((route.match(/querySourceIdentityCollisionsForCandidates\(/g) || []).length, 2);
  assert.match(route, /db\.collection\('reservationinterests'\)/);
  assert.match(route, /db\.collection\('quoteinquiries'\)/);
  assert.match(route, /!prospectLookup\.complete \|\| !interestLookup\.complete \|\| !quoteLookup\.complete/);
  assert.match(route, /prospectLookup\.collisions\.find/);
  assert.match(route, /isRecordSuppressed\(document\.data\(\)\)/);
  assert.match(route, /if \(prospectCollision \|\| suppressedSourceCollision\)/);
  assert.match(route, /if \(barrierActive\)[\s\S]*Prospect creation is blocked/);

  const createBranch = block(route, "if (parsed.data.action === 'create')", 'const current = currentSnapshot?.data()');
  assert.ok(
    createBranch.indexOf('await assertIdentityMutationSafe(') < createBranch.indexOf('transaction.create(prospectRef'),
    'create must complete every bounded identity read before its first prospect write',
  );
  assert.match(createBranch, /normalizedProspectIdentityFields\(proposed\)/);

  const updateBranch = route.slice(route.indexOf('const current = currentSnapshot?.data()'));
  assert.ok(
    updateBranch.indexOf('await assertIdentityMutationSafe(') < updateBranch.indexOf('transaction.update(prospectRef'),
    'identity update must complete every bounded identity read before its prospect write',
  );
  assert.match(updateBranch, /isRecordSuppressed\(current\) && changesIdentity/);
  assert.match(updateBranch, /barrierActive && \(changesIdentity \|\| CONTACT_STATUSES\.has/);
  assert.match(updateBranch, /changesIdentity \? normalizedProspectIdentityFields\(proposed\) : \{\}/);
});

test('every prospect create and DNC transaction shares the fixed owner mutex to close empty-query races', () => {
  const mutation = read('src/app/api/admin/prospects/route.ts');
  const suppression = read('src/app/api/admin/prospects/suppress/route.ts');
  const interests = read('src/app/api/admin/interests/route.ts');
  const crm = read('src/app/api/admin/crm/route.ts');
  const mutex = read('src/lib/prospectSuppressionBarrier.ts');

  assert.match(mutex, /function nextProspectIdentityMutationSerial\(value: unknown\)/);
  for (const route of [mutation, suppression, interests, crm]) {
    assert.match(route, /nextProspectIdentityMutationSerial/);
    assert.match(route, /identityMutationSerial:/);
    assert.match(route, /identityMutationCheckedAt: FieldValue\.serverTimestamp\(\)/);
  }

  assert.match(suppression, /const \[targetSnapshot, barrierSnapshot\] = await Promise\.all\(\[[\s\S]*transaction\.get\(barrierRef\)/);
  assert.match(interests, /const identityMutexSnapshot = suppressing[\s\S]*transaction\.get\(barrierRef\)/);

  const interestPromotion = block(
    interests,
    "if (parsed.data.action === 'promote_to_prospect')",
    'const createInvite = parsed.data;',
  );
  const quotePromotion = block(
    crm,
    "if (input.action === 'promote_quote')",
    "if (input.action === 'set_quote_status')",
  );
  for (const promotion of [interestPromotion, quotePromotion]) {
    assert.match(promotion, /transaction\.get\(barrierRef\)/);
    assert.ok(
      promotion.indexOf('queryProspectIdentityCollisions(') < promotion.indexOf('transaction.set(barrierRef'),
      'promotion must finish its collision reads before touching the owner mutex',
    );
    assert.ok(
      promotion.indexOf('transaction.set(barrierRef') < promotion.indexOf('transaction.create(prospectRef'),
      'promotion must touch the owner mutex before creating a prospect',
    );
  }
});

test('browser entry points use one authenticated prospect API and Firestore rules deny bypasses', () => {
  const client = read('src/lib/firestore.ts');
  const page = read('src/app/(dashboard)/prospects/page.tsx');
  const importer = read('src/app/(dashboard)/import/page.tsx');
  const activities = read('src/app/(dashboard)/activities/page.tsx');
  const rules = read('firestore.rules');
  const prospectsRule = block(rules, 'match /prospects/{docId}', 'match /campaigns/{docId}');
  const prospectClient = block(client, '// Prospects', '// Campaign Types');
  const mutableFields = block(client, 'const PROSPECT_MUTABLE_FIELDS', 'function prospectMutationPayload');

  assert.match(prospectClient, /fetch\('\/api\/admin\/prospects'/);
  assert.match(prospectClient, /Authorization: `Bearer \$\{idToken\}`/);
  assert.match(prospectClient, /action: 'create'/);
  assert.match(prospectClient, /action: 'update'/);
  assert.doesNotMatch(prospectClient, /addDoc\(collection\(db, 'prospects'\)/);
  assert.doesNotMatch(prospectClient, /updateDoc\(doc\(db, 'prospects'/);
  for (const serverOwned of ['userId', 'createdAt', 'updatedAt', 'normalizedEmail', 'suppressedAt', 'suppressedBy']) {
    assert.doesNotMatch(mutableFields, new RegExp(`'${serverOwned}'`));
  }

  assert.match(page, /const idToken = await user\.getIdToken\(\)/);
  assert.match(page, /updateProspect\(editing\.id, savedDraft, idToken\)/);
  assert.match(page, /addProspect\(\{ \.\.\.savedDraft, userId: user\.uid \}, idToken\)/);
  assert.match(importer, /const idToken = await user\.getIdToken\(\)/);
  assert.ok((importer.match(/, idToken\)/g) || []).length >= 3);
  assert.match(activities, /updateProspect\(prospect\.id,[\s\S]*, idToken\)/);

  assert.match(prospectsRule, /allow create: if false/);
  assert.match(prospectsRule, /&& preservesProspectIdentity\(\)/);
  assert.match(prospectsRule, /&& onlyUpdatesSafeProspectFacts\(\)/);
  assert.doesNotMatch(prospectsRule, /allow create: if createsOwned/);
});
