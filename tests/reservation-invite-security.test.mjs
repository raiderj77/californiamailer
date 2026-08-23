import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const interestsRoute = readFileSync(
  new URL('../src/app/api/admin/interests/route.ts', import.meta.url),
  'utf8',
);
const reservationsRoute = readFileSync(
  new URL('../src/app/api/reservations/route.ts', import.meta.url),
  'utf8',
);

test('concurrent invite replacements serialize through the current interest pointer', () => {
  const replacementStart = interestsRoute.indexOf('const code = `CM-');
  const replacementEnd = interestsRoute.indexOf('return NextResponse.json({ success: true, invitationCode:', replacementStart);
  const replacement = interestsRoute.slice(replacementStart, replacementEnd);

  assert.match(replacement, /db\.runTransaction\(async \(transaction\) =>/);
  assert.match(replacement, /await transaction\.get\(interestRef\)/);
  assert.match(replacement, /await transaction\.get\(previousInviteRef\)/);
  assert.match(replacement, /previousInvite\.data\(\)\?\.status === 'active'/);
  assert.match(replacement, /status: 'revoked'/);
  assert.match(replacement, /replacedByInviteId: inviteRef\.id/);
  assert.match(replacement, /transaction\.create\(inviteRef/);
  assert.match(replacement, /transaction\.update\(interestRef/);
  assert.match(replacement, /inviteId: inviteRef\.id/);
  assert.ok(
    replacement.indexOf('await transaction.get(previousInviteRef)')
      < replacement.indexOf('transaction.create(inviteRef'),
    'the current invite must be read before replacement writes so Firestore can retry a racing replacement',
  );
});

test('do-not-contact is sticky, audited, and propagated while status changes revoke invites atomically', () => {
  const statusStart = interestsRoute.indexOf("if (parsed.data.action === 'set_status')");
  const statusEnd = interestsRoute.indexOf("if (parsed.data.action === 'promote_to_prospect')", statusStart);
  const statusChange = interestsRoute.slice(statusStart, statusEnd);

  assert.match(statusChange, /db\.runTransaction\(async \(transaction\) =>/);
  assert.match(statusChange, /await transaction\.get\(interestRef\)/);
  assert.match(statusChange, /await transaction\.get\(currentInviteRef\)/);
  assert.match(statusChange, /inviteId: null/);
  assert.match(statusChange, /validInviteId\(rawCurrentInviteId\)/);
  assert.match(statusChange, /unresolved_invalid_invite_pointer/);
  assert.match(statusChange, /inviteRevocationStatus/);
  assert.match(statusChange, /currentInvite\.data\(\)\?\.status === 'active'/);
  assert.match(statusChange, /transaction\.update\(currentInviteRef/);
  assert.match(statusChange, /status: 'revoked'/);
  assert.match(statusChange, /isRecordSuppressed\(currentData\) && statusUpdate\.status !== 'do_not_contact'/);
  assert.match(statusChange, /doNotContact: true/);
  assert.match(statusChange, /suppressed: true/);
  assert.match(statusChange, /await transaction\.get\(linkedProspectRef\)/);
  assert.match(statusChange, /queryProspectIdentityCollisions\(/);
  assert.match(statusChange, /for \(const \{ document \} of identityMatches\)/);
  assert.match(statusChange, /transaction\.update\(document\.ref/);
  assert.match(statusChange, /matching_reservation_interest_identity/);
  assert.match(statusChange, /sticky do-not-contact suppression/);
});

test('interest promotion is transactional and cannot bypass any suppression marker', () => {
  const promotionStart = interestsRoute.indexOf("if (parsed.data.action === 'promote_to_prospect')");
  const promotionEnd = interestsRoute.indexOf('const createInvite = parsed.data;', promotionStart);
  const promotion = interestsRoute.slice(promotionStart, promotionEnd);

  assert.match(promotion, /db\.runTransaction\(async \(transaction\) =>/);
  assert.match(promotion, /await transaction\.get\(interestRef\)/);
  assert.match(promotion, /invitationIsBlockedByInterest\(data\)/);
  assert.match(promotion, /queryProspectIdentityCollisions\(/);
  assert.ok((promotion.match(/querySuppressedIdentityCollisions\(/g) || []).length >= 2);
  assert.match(promotion, /identityLookup\.collisions\.some/);
  assert.match(promotion, /transaction\.create\(prospectRef/);
  assert.match(promotion, /transaction\.update\(interestRef/);
});

test('reservation intake rejects a stale code and a post-invite suppression inside its inventory transaction', () => {
  assert.match(reservationsRoute, /const currentInvitation = await transaction\.get\(invitationRef\)/);
  assert.match(reservationsRoute, /const currentInterest = await transaction\.get\(inviteInterestRef\)/);
  assert.match(reservationsRoute, /interest\.status !== 'invited'/);
  assert.match(reservationsRoute, /interest\.inviteStatus !== 'active'/);
  assert.match(reservationsRoute, /interest\.inviteId !== invitationRef\.id/);
  assert.match(reservationsRoute, /interest\.doNotContact === true/);
  assert.match(reservationsRoute, /interest\.suppressed === true/);
  assert.match(reservationsRoute, /\['dismissed', 'do_not_contact', 'suppressed'\]\.includes\(String\(interest\.status\)\)/);
  assert.match(reservationsRoute, /await transaction\.get\(db\.collection\('prospects'\)\.doc\(linkedProspectId\)\)/);
  assert.match(reservationsRoute, /isRecordSuppressed\(linkedProspectData\)/);
  assert.ok((reservationsRoute.match(/querySuppressedIdentityCollisions\(/g) || []).length >= 2);
  assert.match(reservationsRoute, /transaction\.update\(inviteInterestRef, \{[\s\S]*?status: 'reserved',[\s\S]*?inviteStatus: 'consumed'/);
});

test('invite hardening leaves payment activation and inventory gates fail closed', () => {
  assert.match(reservationsRoute, /process\.env\.PAYMENTS_ENABLED === 'true'/);
  assert.match(reservationsRoute, /category\.status === 'available'/);
  assert.match(reservationsRoute, /invitation\?\.status === 'active'/);
  assert.match(reservationsRoute, /throw new Error\('category-conflict'\)/);
  assert.match(reservationsRoute, /throw new Error\('placement-unavailable'\)/);
});
