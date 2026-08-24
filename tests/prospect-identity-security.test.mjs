import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const helper = read('src/lib/prospectIdentityServer.ts');
const interests = read('src/app/api/admin/interests/route.ts');
const crm = read('src/app/api/admin/crm/route.ts');
const reservations = read('src/app/api/reservations/route.ts');
const inbox = read('src/app/(dashboard)/interest-inbox/page.tsx');

test('identity lookup covers raw-only legacy owner records and fails closed on bounded scans', () => {
  assert.match(helper, /PROSPECT_IDENTITY_OWNER_SCAN_LIMIT = 500/);
  assert.match(helper, /where\('userId', '==', ownerUid\)\.limit\(PROSPECT_IDENTITY_OWNER_SCAN_LIMIT \+ 1\)/);
  assert.match(helper, /ownerSnapshot\.size > PROSPECT_IDENTITY_OWNER_SCAN_LIMIT/);
  assert.match(helper, /normalizedCandidates\.flatMap\(\(candidate\) =>[\s\S]*highConfidenceProspectIdentityMatches\(candidate, document\.data\(\)\)/);
  assert.match(helper, /where\(spec\.field, '==', spec\.value\)\.limit\(PROSPECT_IDENTITY_QUERY_RESULT_LIMIT \+ 1\)/);
  assert.match(helper, /failure = 'bounded_query_result'/);
  assert.match(helper, /sameOwnerCollisions/);
});

test('interest DNC suppresses every bounded same-owner identity match without requiring a direct link', () => {
  const statusChange = interests.slice(
    interests.indexOf("if (parsed.data.action === 'set_status')"),
    interests.indexOf("if (parsed.data.action === 'promote_to_prospect')"),
  );
  assert.match(statusChange, /queryProspectIdentityCollisions\(/);
  assert.match(statusChange, /const discoveredIdentityMatches = identityLookup\?\.collisions \|\| \[\]/);
  assert.match(statusChange, /for \(const \{ document \} of identityMatches\)/);
  assert.match(statusChange, /transaction\.update\(document\.ref/);
  assert.match(statusChange, /status: 'do_not_contact'/);
  assert.match(statusChange, /doNotContact: true/);
  assert.match(statusChange, /suppressed: true/);
  assert.match(statusChange, /matching_reservation_interest_identity/);
  assert.match(statusChange, /unresolved_identity_lookup_/);
});

test('interest and quote promotion enforce cross-campaign, cross-source identity suppression transactionally', () => {
  const interestPromotion = interests.slice(
    interests.indexOf("if (parsed.data.action === 'promote_to_prospect')"),
    interests.indexOf('const createInvite = parsed.data;'),
  );
  const quotePromotion = crm.slice(
    crm.indexOf("if (input.action === 'promote_quote')"),
    crm.indexOf("if (input.action === 'set_quote_status')"),
  );
  for (const promotion of [interestPromotion, quotePromotion]) {
    assert.match(promotion, /queryProspectIdentityCollisions\(/);
    assert.match(promotion, /querySuppressedIdentityCollisions\(/);
    assert.match(promotion, /db\.collection\('reservationinterests'\)/);
    assert.match(promotion, /db\.collection\('quoteinquiries'\)/);
    assert.doesNotMatch(promotion, /reservationinterests'\)\.where\('campaignId'/);
    assert.match(promotion, /\.complete/);
    assert.match(promotion, /collisions\.length/);
  }
});

test('invite issuance and consumption re-read linked prospect and identity-wide suppression', () => {
  const issuance = interests.slice(interests.indexOf('const createInvite = parsed.data;'));
  assert.match(issuance, /await transaction\.get\(linkedProspectRef\)/);
  assert.match(issuance, /linkedProspectData\.userId !== owner\.uid/);
  assert.match(issuance, /isRecordSuppressed\(linkedProspectData\)/);
  assert.match(issuance, /queryProspectIdentityCollisions\(/);
  assert.ok((issuance.match(/querySuppressedIdentityCollisions\(/g) || []).length >= 2);
  assert.match(issuance, /prospectId: linkedProspect\.id/);

  assert.match(reservations, /invite\.prospectId !== linkedProspectId/);
  assert.match(reservations, /linkedProspectData\.userId !== invite\.createdBy/);
  assert.match(reservations, /isRecordSuppressed\(linkedProspectData\)/);
  assert.match(reservations, /queryProspectIdentityCollisions\(/);
  assert.ok((reservations.match(/querySuppressedIdentityCollisions\(/g) || []).length >= 2);
});

test('interest inbox derives linked-prospect safety and makes blocked contact data non-actionable', () => {
  assert.match(interests, /await db\.getAll\(\.\.\.linkedProspectRefs\)/);
  assert.match(interests, /linkedProspectSafetyStatus/);
  assert.match(interests, /wrong_owner_linked_prospect/);
  assert.match(interests, /suppressed_linked_prospect/);
  assert.match(interests, /linkedProspectSafetyBlocked/);
  assert.match(inbox, /const contactBlocked = suppressed \|\| item\.linkedProspectSafetyBlocked/);
  assert.match(inbox, /contactBlocked \? <span>\{item\.email\}<\/span> : <a/);
  assert.match(inbox, /Submitted business site \(link disabled\)/);
});

test('corrupt invite pointers cannot prevent sticky DNC persistence', () => {
  const statusChange = interests.slice(
    interests.indexOf("if (parsed.data.action === 'set_status')"),
    interests.indexOf("if (parsed.data.action === 'promote_to_prospect')"),
  );
  assert.match(interests, /function validInviteId/);
  assert.match(statusChange, /unresolved_invalid_invite_pointer/);
  assert.match(statusChange, /inviteRevocationStatus/);
  assert.match(statusChange, /inviteId: null/);
  assert.match(statusChange, /doNotContact: true/);
  assert.match(statusChange, /Invitation revocation remains unresolved/);
});

test('fail-closed identity conflicts return their actionable status instead of a generic 500', () => {
  const errorHandler = interests.slice(
    interests.indexOf('function errorResponse'),
    interests.indexOf('export async function GET'),
  );
  assert.match(errorHandler, /error instanceof InterestOperationError/);
  assert.match(errorHandler, /error: error\.message/);
  assert.match(errorHandler, /status: error\.status/);
});
