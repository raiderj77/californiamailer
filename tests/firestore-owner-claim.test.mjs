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

test('legacy browser CRM ownership helpers also require the owner admin claim', () => {
  const rules = read('firestore.rules');
  const helpers = block(rules, 'function signedIn()', 'match /territories/{docId}');

  assert.match(helpers, /function isAdmin\(\) \{[\s\S]*request\.auth\.token\.admin == true/);
  assert.match(helpers, /function ownsExisting\(\) \{[\s\S]*return isAdmin\(\) && request\.auth\.uid == resource\.data\.userId/);
  assert.match(helpers, /function createsOwned\(\) \{[\s\S]*return isAdmin\(\) && request\.auth\.uid == request\.resource\.data\.userId/);
  assert.doesNotMatch(helpers, /function ownsExisting\(\) \{[\s\S]*?return signedIn\(\)/);
  assert.doesNotMatch(helpers, /function createsOwned\(\) \{[\s\S]*?return signedIn\(\)/);
});

test('every browser-writable legacy owner collection is claim-gated and ownership-preserving', () => {
  const rules = read('firestore.rules');
  const nextCollection = {
    prospects: 'campaigns',
    vatasks: 'emailtemplates',
    emailtemplates: 'activities',
    activities: 'reminders',
    reminders: 'invoices',
    invoices: 'clients',
    clients: 'teammembers',
  };

  for (const [collection, next] of Object.entries(nextCollection)) {
    const source = block(rules, `match /${collection}/{docId}`, `match /${next}/{docId}`);
    assert.doesNotMatch(source, /signedIn\(\)/, `${collection} must not allow any signed-in user`);
    if (collection === 'prospects') {
      assert.match(source, /allow read: if ownsExisting\(\)/);
      assert.match(source, /allow delete: if ownsExisting\(\) && !isSuppressedProspect\(resource\.data\)/);
      assert.match(source, /allow create: if false/);
    } else {
      assert.match(source, /allow read, delete: if ownsExisting\(\)/, `${collection} reads and deletes must use the claim-gated owner helper`);
      assert.match(source, /allow create: if createsOwned\(\)/, `${collection} creates must use the claim-gated owner helper`);
    }
    if (collection === 'activities') {
      assert.match(source, /allow update: if false/);
    } else {
      assert.match(source, /allow update: if ownsExisting\(\) && preservesOwner\(\)/);
    }
  }

  const team = block(rules, 'match /teammembers/{docId}', 'match /publiccampaigns/{campaignId}');
  assert.doesNotMatch(team, /if signedIn\(\)/);
  assert.equal((team.match(/if isAdmin\(\)/g) || []).length, 3);
  assert.match(team, /request\.auth\.uid == resource\.data\.ownerId/);
  assert.match(team, /request\.auth\.uid == request\.resource\.data\.ownerId/);
  assert.match(team, /request\.resource\.data\.ownerId == resource\.data\.ownerId/);
});

test('browser prospect rules make suppression canonical, sticky, and non-deletable', () => {
  const rules = read('firestore.rules');
  const helpers = block(rules, 'function isManualProspectStatus(data)', 'match /territories/{docId}');
  const prospects = block(rules, 'match /prospects/{docId}', 'match /campaigns/{docId}');
  const browserData = read('src/lib/firestore.ts');
  const page = read('src/app/(dashboard)/prospects/page.tsx');

  assert.match(helpers, /function isSuppressedProspect\(data\)/);
  assert.match(helpers, /data\.get\('doNotContact', false\) == true/);
  assert.match(helpers, /data\.get\('suppressed', false\) == true/);
  assert.match(helpers, /data\.get\('status', ''\) in \['do_not_contact', 'suppressed'\]/);
  assert.match(helpers, /function hasConsistentProspectSuppression\(data\)/);
  assert.match(helpers, /function preservesProspectSuppression\(\)/);
  assert.match(helpers, /function preventsClientProspectSuppressionTransition\(\)/);
  assert.match(helpers, /function preservesProspectIdentity\(\)/);
  assert.match(helpers, /function onlyUpdatesSafeProspectFacts\(\)/);
  assert.match(prospects, /allow delete: if ownsExisting\(\) && !isSuppressedProspect\(resource\.data\)/);
  assert.match(prospects, /allow create: if false/);
  assert.match(prospects, /&& preservesProspectIdentity\(\)/);
  assert.match(prospects, /&& onlyUpdatesSafeProspectFacts\(\)/);
  assert.match(prospects, /&& hasConsistentProspectSuppression\(request\.resource\.data\)/);
  assert.match(prospects, /&& preventsClientProspectSuppressionTransition\(\)/);
  assert.match(prospects, /&& preservesProspectSuppression\(\)/);
  assert.match(browserData, /fetch\('\/api\/admin\/prospects'/);
  assert.match(browserData, /Authorization: `Bearer \$\{idToken\}`/);
  assert.doesNotMatch(browserData, /addDoc\(collection\(db, 'prospects'\)/);
  assert.match(page, /Suppression cannot be reopened in this release/);
  assert.match(page, /Suppressed records cannot receive bulk status changes/);
});

test('the owner login refreshes the same admin claim accepted by server and browser guards', () => {
  const authContext = read('src/lib/AuthContext.tsx');
  const serverAuth = read('src/lib/serverAuth.ts');

  assert.match(authContext, /result\.user\.getIdToken\(true\)/);
  assert.match(serverAuth, /token\.admin === true/);
});
