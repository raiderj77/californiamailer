import assert from 'node:assert/strict';
import test from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  generateAdvertiserPortalToken,
  hashAdvertiserPortalToken,
  isActiveAdvertiserPortalInvite,
  isActiveLegacyReservationAccess,
  isActiveAdvertiserPortalSession,
  reservationPortalAccessVersion,
  reservationPortalInviteVersion,
  timestampMillis,
  validAdvertiserPortalToken,
  validReservationId,
} from '../src/lib/advertiserPortal';

test('portal tokens are strong, URL-safe, hashable, and never reservation identifiers', () => {
  const first = generateAdvertiserPortalToken();
  const second = generateAdvertiserPortalToken();
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(validAdvertiserPortalToken(first), true);
  assert.notEqual(first, second);
  assert.match(hashAdvertiserPortalToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashAdvertiserPortalToken(first), hashAdvertiserPortalToken(first));
  assert.equal(validReservationId('AbCdEf1234567890abcd'), true);
  assert.equal(validReservationId('../reservation'), false);
});

test('portal invite validity is bound to one reservation, both versions, and an expiry', () => {
  const now = Date.UTC(2026, 7, 19, 12);
  const reservation = { portalAccessVersion: 3, portalInviteVersion: 8 };
  const invite = {
    status: 'active',
    reservationId: 'AbCdEf1234567890abcd',
    accessVersion: 3,
    inviteVersion: 8,
    expiresAt: Timestamp.fromMillis(now + 60_000),
  };
  assert.equal(isActiveAdvertiserPortalInvite(invite, reservation, invite.reservationId, now), true);
  assert.equal(isActiveAdvertiserPortalInvite({ ...invite, inviteVersion: 7 }, reservation, invite.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalInvite({ ...invite, accessVersion: 2 }, reservation, invite.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalInvite({ ...invite, status: 'consumed' }, reservation, invite.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalInvite({ ...invite, expiresAt: Timestamp.fromMillis(now) }, reservation, invite.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalInvite(invite, reservation, 'Different1234567890ab', now), false);
});

test('database sessions require an active exact reservation/version binding', () => {
  const now = Date.UTC(2026, 7, 19, 12);
  const reservation = { portalAccessVersion: 4 };
  const session = {
    status: 'active',
    reservationId: 'AbCdEf1234567890abcd',
    accessVersion: 4,
    expiresAt: Timestamp.fromMillis(now + 30 * 24 * 60 * 60_000),
  };
  assert.equal(isActiveAdvertiserPortalSession(session, reservation, session.reservationId, now), true);
  assert.equal(isActiveAdvertiserPortalSession({ ...session, status: 'revoked' }, reservation, session.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalSession({ ...session, accessVersion: 3 }, reservation, session.reservationId, now), false);
  assert.equal(isActiveAdvertiserPortalSession({ ...session, expiresAt: Timestamp.fromMillis(now) }, reservation, session.reservationId, now), false);
  assert.equal(reservationPortalAccessVersion({}), 0);
  assert.equal(reservationPortalInviteVersion({ portalInviteVersion: -1 }), 0);
  assert.equal(timestampMillis(session.expiresAt), now + 30 * 24 * 60 * 60_000);
});

test('legacy reservation access fails closed without explicit active versioned expiry metadata', () => {
  const now = Date.UTC(2026, 7, 19, 12);
  const active = {
    accessTokenHash: 'a'.repeat(64),
    portalAccessVersion: 3,
    legacyAccessVersion: 3,
    legacyAccessStatus: 'active',
    legacyAccessExpiresAt: Timestamp.fromMillis(now + 60_000),
  };
  assert.equal(isActiveLegacyReservationAccess(active, now), true);
  assert.equal(isActiveLegacyReservationAccess({ accessTokenHash: active.accessTokenHash }, now), false);
  assert.equal(isActiveLegacyReservationAccess({ ...active, legacyAccessStatus: 'revoked' }, now), false);
  assert.equal(isActiveLegacyReservationAccess({ ...active, legacyAccessVersion: 2 }, now), false);
  assert.equal(isActiveLegacyReservationAccess({ ...active, legacyAccessExpiresAt: Timestamp.fromMillis(now) }, now), false);
  assert.equal(isActiveLegacyReservationAccess({ ...active, accessTokenHash: 'not-a-hash' }, now), false);
});
