import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('tracking activation is tied to a current paid reservation and a unique coupon claim', () => {
  const route = read('src/app/api/admin/tracking/route.ts');
  assert.match(route, /reservation\?\.status !== 'paid'/);
  assert.match(route, /reservation\?\.trackingId !== linkRef\.id/);
  assert.match(route, /trackingcouponclaims/);
  assert.match(route, /runTransaction/);
  assert.match(route, /coupon code is not unique/);
  assert.match(route, /paymentLifecycleSuspended: false/);
  assert.match(route, /activeBeforePaymentInterruption: false/);
});

test('public redirects recheck current paid ownership transactionally before leaving the site', () => {
  const route = read('src/app/go/[code]/route.ts');
  assert.match(route, /db\.runTransaction/);
  assert.match(route, /transaction\.get\(linkRef\)/);
  assert.match(route, /transaction\.get\(db\.collection\('reservations'\)\.doc\(reservationId\)\)/);
  assert.match(route, /reservation\?\.status !== 'paid'/);
  assert.match(route, /reservation\.campaignId !== link\.campaignId/);
  assert.match(route, /reservation\.trackingId !== linkRef\.id/);
  assert.match(route, /safeTrackingDestination/);
  assert.match(route, /rateLimitClientIdentity/);
  assert.doesNotMatch(route, /headers\.get\('x-forwarded-for'\)|headers\.get\('x-real-ip'\)/);
  assert.match(route, /private, no-store/);
});

test('delivery evidence requires an owner action and an evidence reference', () => {
  const route = read('src/app/api/admin/tracking/route.ts');
  assert.match(route, /action: z\.literal\('record_delivery'\)/);
  assert.match(route, /evidenceReference: z\.string\(\)\.trim\(\)\.min\(3\)/);
  assert.match(route, /owner_recorded_delivery_evidence/);
  assert.match(route, /advertiser-visible delivery evidence/);
});

test('advertiser report is reservation-private and never exposes request fingerprints', () => {
  const route = read('src/app/api/reservations/[id]/tracking/route.ts');
  assert.match(route, /verifyReservationAccess/);
  assert.match(route, /private, no-store/);
  assert.match(route, /not proof of a QR scan, person, lead, customer, or sale/);
  assert.match(route, /Owner-recorded advertiser report; not directly measured/);
  assert.doesNotMatch(route, /networkHash|userAgent/);
});

test('private reservation panel loads the bounded tracking report', () => {
  const panel = read('src/components/reservation/ReservationProductionPanel.tsx');
  assert.match(panel, /\/api\/reservations\/\$\{reservationId\}\/tracking/);
  assert.match(panel, /Tracking and delivery report/);
  assert.match(panel, /Unknown classification/);
});
