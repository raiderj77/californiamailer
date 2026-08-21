import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('advertiser coupon API requires token access, current payment, and tracking ownership', () => {
  const route = read('src/app/api/reservations/[id]/coupon/route.ts');
  const originCheck = route.indexOf("origin !== request.nextUrl.origin");
  const bodyRead = route.indexOf('request.text()');
  assert.ok(originCheck >= 0 && bodyRead > originCheck);
  assert.match(route, /!origin \|\| origin !== request\.nextUrl\.origin/);
  assert.match(route, /verifyReservationAccess/);
  assert.match(route, /access\.data\.status !== 'paid'/);
  assert.match(route, /tracking\?\.reservationId !== reservationId/);
  assert.match(route, /reservation\.trackingId !== current\.trackingRef\.id/);
  assert.match(route, /trackingcouponclaims/);
  assert.match(route, /couponClaim\?\.trackingId !== current\.trackingRef\.id/);
  assert.match(route, /private, no-store/);
  assert.match(route, /couponaiusage/);
  assert.match(route, /runTransaction/);
  assert.ok((route.match(/assertReservationAccessInTransaction\(/g) || []).length >= 2);
  assert.doesNotMatch(route, /transactionAccessStillActive|legacyAccessHashMatches/);
});

test('AI stays server-only, disabled by default, stateless, structured, and bounded', () => {
  const ai = read('src/lib/couponAi.ts');
  const env = read('.env.example');
  const panel = read('src/components/reservation/ReservationProductionPanel.tsx');
  assert.match(ai, /AI_COUPON_GENERATION_ENABLED !== 'true'/);
  assert.match(ai, /OPENAI_API_KEY/);
  assert.match(ai, /DEFAULT_COUPON_AI_MODEL = 'gpt-5\.6-luna'/);
  assert.match(ai, /store: false/);
  assert.match(ai, /type: 'json_schema'/);
  assert.match(ai, /COUPON_AI_MAX_PROMPT_CHARS/);
  assert.match(env, /AI_COUPON_GENERATION_ENABLED=false/);
  assert.doesNotMatch(env, /NEXT_PUBLIC_OPENAI/);
  assert.doesNotMatch(panel, /OPENAI_API_KEY|api\.openai\.com/);
});

test('only owner exact-confirm can copy a submitted version to public content', () => {
  const route = read('src/app/api/admin/coupons/route.ts');
  assert.match(route, /requireOwner\(request\)/);
  assert.match(route, /couponPublishConfirmation\(couponCode\)/);
  assert.match(route, /coupon\.reviewStatus !== 'submitted_for_owner_review'/);
  assert.match(route, /currentVersion !== input\.draftVersion/);
  assert.match(route, /publishedContent: draft/);
  assert.match(route, /tracking\?\.active !== true/);
  assert.match(route, /reservation\?\.status !== 'paid'/);
});

test('public coupon is noindex, read-only, and states the redemption limitation', () => {
  const page = read('src/app/(public)/coupon/[code]/page.tsx');
  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /publicCouponUnavailableReason/);
  assert.match(page, /does not directly verify that a redemption was accepted or/);
  assert.match(page, /does not record a redemption,/);
  assert.match(page, /safeTrackingDestination/);
  assert.match(page, /businessPath: `\/go\/\$\{encodeURIComponent\(trackingSnapshot\.id\)\}`/);
  assert.doesNotMatch(page, /businessUrl/);
  assert.doesNotMatch(page, /<(?:form|input)\b|consumerEmail|consumerPhone/i);
});
