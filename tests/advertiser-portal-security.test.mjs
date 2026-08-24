import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('reservation access revalidates expiring versioned legacy credentials and database sessions', () => {
  const auth = read('src/lib/reservationAuth.ts');
  const reservations = read('src/app/api/reservations/route.ts');
  assert.match(auth, /mode: 'legacy_reservation_token'/);
  assert.match(auth, /isActiveLegacyReservationAccess\(data\)/);
  assert.match(auth, /ADVERTISER_PORTAL_SESSION_COLLECTION/);
  assert.match(auth, /sessionRef\.get\(\)/);
  assert.match(auth, /isActiveAdvertiserPortalSession\(session, data, lookup\.id\)/);
  assert.match(auth, /timingSafeEqual/);
  assert.match(reservations, /legacyAccessVersion,/);
  assert.match(reservations, /legacyAccessStatus: 'active'/);
  assert.match(reservations, /legacyAccessExpiresAt,/);
  assert.match(reservations, /expires: legacyAccessExpiresAt\.toDate\(\)/);
  assert.doesNotMatch(reservations, /maxAge: 90 \* 24 \* 60 \* 60/);
  assert.doesNotMatch(auth, /firebase\/firestore/);
});

test('material and proof commits reassert reservation access inside their transactions', () => {
  const auth = read('src/lib/reservationAuth.ts');
  const materials = read('src/app/api/reservations/[id]/materials/route.ts');
  const proofs = read('src/app/api/reservations/[id]/proofs/route.ts');
  const helper = auth.slice(auth.indexOf('export async function assertReservationAccessInTransaction'));

  assert.match(helper, /transaction\.get\(lookup\.ref\)/);
  assert.match(helper, /transaction\.get\(lookup\.sessionRef\)/);
  assert.match(helper, /hashesMatch\(lookup\.tokenHash, data\.accessTokenHash\)/);
  assert.match(helper, /isActiveLegacyReservationAccess\(data\)/);
  assert.match(helper, /isActiveAdvertiserPortalSession\(session, data, lookup\.id\)/);
  assert.match(helper, /throw new ReservationAccessError\(\)/);

  for (const source of [materials, proofs]) {
    const mutation = source.slice(source.indexOf('await db.runTransaction'));
    const assertion = mutation.indexOf('assertReservationAccessInTransaction(transaction, id, accessToken)');
    const firstWrite = Math.min(
      ...['transaction.create(', 'transaction.update(', 'transaction.set(']
        .map((needle) => mutation.indexOf(needle))
        .filter((index) => index >= 0),
    );
    assert.ok(assertion > 0 && assertion < firstWrite);
    assert.match(source, /error instanceof ReservationAccessError/);
    const originCheck = source.indexOf("if (!origin || origin !== request.nextUrl.origin)");
    const bodyRead = Math.max(source.indexOf('request.formData()'), source.indexOf('request.json()'));
    assert.ok(originCheck > 0 && bodyRead > originCheck);
  }
  assert.match(materials, /getAdminStorage\(\)\.file\(uploadedStoragePath\)\.delete\(\{ ignoreNotFound: true \}\)/);
  assert.ok(materials.indexOf('uploadedStoragePath = storagePath') < materials.indexOf('await db.runTransaction'));
  assert.ok(materials.indexOf('uploadedStoragePath = null') > materials.indexOf('await db.runTransaction'));
  assert.match(proofs, /if \(reservation\.status !== 'paid'\) throw new Error\('proof-reservation-unavailable'\)/);
});

test('owner portal APIs are owner-only, strict, manual-delivery, and version-revocable', () => {
  const route = read('src/app/api/admin/advertiser-portals/route.ts');
  const revoke = read('src/app/api/admin/advertiser-portals/[reservationId]/route.ts');
  const portal = read('src/lib/advertiserPortal.ts');
  assert.ok((route.match(/requireOwner\(request\)/g) || []).length >= 2);
  assert.match(route, /z\.literal\('CREATE ONE-TIME PORTAL LINK'\)/);
  assert.match(route, /deliveryStatus: 'not_sent_copy_manually'/);
  assert.ok(route.indexOf('const origin = canonicalOrigin(request)') < route.indexOf('createAdvertiserPortalInvite('));
  assert.match(route, /NODE_ENV === 'production'/);
  assert.match(revoke, /requireOwner\(request\)/);
  assert.match(revoke, /z\.literal\('REVOKE ALL PORTAL ACCESS'\)/);
  assert.match(portal, /portalAccessVersion: accessVersion/);
  assert.match(portal, /portalInviteVersion: inviteVersion/);
  assert.match(portal, /accessTokenHash: null/);
  assert.match(portal, /legacyAccessStatus: 'revoked'/);
  assert.match(portal, /legacyAccessRevokedAt: FieldValue\.serverTimestamp\(\)/);
  assert.doesNotMatch(`${route}\n${revoke}\n${portal}`, /sendEmail|mailgun|twilio|messages\.create/);
});

test('one-time consume stores only hashes and transactionally binds one expiring session', () => {
  const portal = read('src/lib/advertiserPortal.ts');
  const consumeStart = portal.indexOf('export async function consumeAdvertiserPortalInvite');
  const consumeEnd = portal.indexOf('export async function revokeAdvertiserPortalSession');
  const consume = portal.slice(consumeStart, consumeEnd);
  const inviteRead = consume.indexOf('transaction.get(inviteRef)');
  const reservationRead = consume.indexOf('transaction.get(reservationRef)');
  const sessionCreate = consume.indexOf('transaction.create(sessionRef');
  const inviteConsume = consume.indexOf("status: 'consumed'");
  assert.ok(inviteRead >= 0 && reservationRead > inviteRead && sessionCreate > reservationRead && inviteConsume > sessionCreate);
  assert.match(consume, /isActiveAdvertiserPortalInvite\(invite, reservation, candidateReservationId, now\)/);
  assert.match(consume, /expiresAt: sessionExpiresAt/);
  assert.match(consume, /accessVersion: reservationPortalAccessVersion\(reservation\)/);
  const inviteRecord = portal.slice(portal.indexOf('transaction.create(inviteRef'), portal.indexOf("action: 'advertiser_portal.invite_create'"));
  const sessionRecord = consume.slice(sessionCreate, consume.indexOf('transaction.update(inviteRef'));
  assert.doesNotMatch(inviteRecord, /\btoken\s*:/);
  assert.doesNotMatch(sessionRecord, /\bsessionToken\s*:/);
  assert.match(portal, /hashAdvertiserPortalToken\(token\)/);
  assert.match(portal, /hashAdvertiserPortalToken\(sessionToken\)/);
});

test('consume and logout routes use hardened cookies and remove bearer tokens from the URL', () => {
  const consume = read('src/app/api/business-access/route.ts');
  const accessPage = read('src/app/(public)/business-login/access/page.tsx');
  const ownerRoute = read('src/app/api/admin/advertiser-portals/route.ts');
  const logout = read('src/app/api/business-session/[reservationId]/logout/route.ts');
  assert.match(ownerRoute, /url\.hash = `token=\$\{encodeURIComponent\(invite\.token\)\}`/);
  assert.match(consume, /export async function POST/);
  assert.match(consume, /consumeAdvertiserPortalInvite\(parsed\.data\.token\)/);
  assert.match(consume, /origin !== request\.nextUrl\.origin/);
  assert.match(consume, /consumeRateLimit\(requestFingerprint\(request, 'business-access'\)/);
  assert.match(consume, /MAX_BODY_BYTES/);
  assert.match(consume, /error instanceof AdvertiserPortalError/);
  assert.match(consume, /status: knownAccessFailure \? error\.status : 503/);
  assert.match(consume, /httpOnly: true/);
  assert.match(consume, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(consume, /sameSite: 'lax'/);
  assert.match(consume, /expires: session\.expiresAt/);
  assert.match(consume, /Referrer-Policy', 'no-referrer'/);
  assert.doesNotMatch(consume, /searchParams\.get\('token'\)|request\.url.*token/);
  assert.match(accessPage, /window\.location\.hash/);
  assert.match(accessPage, /window\.history\.replaceState\(null, '', window\.location\.pathname\)/);
  assert.match(accessPage, /window\.location\.replace\(body\.destination\)/);
  assert.match(logout, /revokeAdvertiserPortalSession\(reservationId, token\)/);
  assert.match(logout, /maxAge: 0/);
  assert.match(logout, /origin !== request\.nextUrl\.origin/);
});

test('portal browser UI has no direct database access and labels reservation-only scope', () => {
  const ownerPage = read('src/app/(dashboard)/business-portals/page.tsx');
  const accessPage = read('src/app/(public)/business-login/[reservationId]/page.tsx');
  const loginPage = read('src/app/(public)/business-login/page.tsx');
  const sidebar = read('src/components/Sidebar.tsx');
  assert.match(ownerPage, /Authorization: `Bearer \$\{await user\.getIdToken\(\)\}`/);
  assert.match(ownerPage, /Create link without sending/);
  assert.match(ownerPage, /navigator\.clipboard\.writeText/);
  assert.match(accessPage, /verifyReservationAccess\(reservationId, token\)/);
  assert.match(accessPage, /not a shared business-wide account/);
  assert.match(loginPage, /no shared business-wide account/i);
  assert.match(sidebar, /\{ name: 'Business portals', href: '\/business-portals' \}/);
  assert.doesNotMatch(`${ownerPage}\n${accessPage}\n${loginPage}`, /firebase\/firestore|addDoc\(|updateDoc\(/);
});

test('new invite and session collections explicitly deny every browser read and write', () => {
  const rules = read('firestore.rules');
  for (const collection of ['advertiserportalinvites', 'advertiserportalsessions']) {
    assert.match(rules, new RegExp(`match \/${collection}\/\\{docId\\} \\{[\\s\\S]*?allow read, write: if false`));
  }
});
