import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('public checkout cannot create browser-priced Stripe sessions', () => {
  const checkout = read('src/app/api/checkout/route.ts');
  assert.doesNotMatch(checkout, /stripe\.checkout\.sessions\.create/);
  assert.doesNotMatch(checkout, /unit_amount|body\.amount/);
  assert.match(checkout, /Online checkout is unavailable/);
});

test('public quote intake stores only validated requests for manual owner review', () => {
  const route = read('src/app/api/send-email/route.ts');
  const quote = read('src/app/(public)/quote/page.tsx');
  assert.match(route, /kind: z\.literal\('quote'\)/);
  assert.doesNotMatch(route, /const \{ to, subject, text, html \}/);
  assert.match(route, /Reflect\.get\(unknownBody, 'website'\)/);
  assert.match(route, /db\.collection\('quoteinquiries'\)\.doc\(submissionHash\)/);
  assert.match(route, /replyPermission: 'requested_quote_response_only'/);
  assert.match(route, /requestHash = sha256\(JSON\.stringify/);
  assert.match(route, /quote-content-\$\{requestHash\}/);
  assert.match(route, /intakeStatus: 'accepted'/);
  assert.match(route, /reviewQueueStatus: 'queued'/);
  assert.match(route, /notificationStatus: 'not_queued_disabled'/);
  assert.match(route, /outboundMessageStatus: 'not_sent'/);
  assert.doesNotMatch(route, /sendEmail|mailgun|provider_accepted|notificationAccepted|notificationStatus: 'delivered'/);
  assert.match(route, /requestOriginAllowed\(request\)/);
  assert.match(route, /startsWith\('application\/json'\)/);
  assert.match(route, /MAX_BODY_BYTES/);
  assert.match(route, /collection\('publicrequestguards'\)/);
  assert.match(route, /runTransaction/);
  assert.match(quote, /crypto\.randomUUID\(\)/);
  assert.match(quote, /result\.intakeStatus === 'accepted'/);
  assert.match(quote, /result\.reviewQueueStatus === 'queued'/);
  assert.match(quote, /result\.outboundMessageStatus === 'not_sent'/);
  assert.doesNotMatch(quote, /dangerouslySetInnerHTML|Delivering|form could not be delivered/);
});

test('analytics is disabled until a documented consent implementation exists', () => {
  const layout = read('src/app/layout.tsx');
  assert.doesNotMatch(layout, /googletagmanager|google-analytics|gtag\(/i);
});

test('public claims exclude fabricated social proof and disconnected contact details', () => {
  const home = read('src/app/(public)/home/page.tsx');
  const quote = read('src/app/(public)/quote/page.tsx');
  assert.doesNotMatch(home, /500K\+|850\+|4\.4%|What Our Clients Say|555-0100/);
  assert.doesNotMatch(quote, /Recent Campaigns|555-0100/);
});

test('single-business mailers remain dated, supplier-backed, and quote-only', () => {
  const config = read('src/config/eddmOfferings.ts');
  const quote = read('src/app/(public)/quote/page.tsx');
  assert.match(config, /printing4supercheap/);
  assert.match(config, /priceObservedAt: '2026-08-18'/);
  assert.match(config, /priceValidThrough: null/);
  assert.match(config, /rateMillsPerPiece: 260/);
  assert.match(quote, /Every option stays quote-only/);
  assert.match(quote, /No instant price or checkout/);
  assert.doesNotMatch(quote, /guaranteed profit|guaranteed response|guaranteed return/i);
});

test('privacy policy documents the live quote and analytics behavior', () => {
  const privacy = read('src/app/(public)/privacy/page.tsx');
  assert.match(privacy, /does not queue or send a quote-request notification email/i);
  assert.match(privacy, /never enrolls a person in consumer marketing/i);
  assert.match(privacy, /Google Analytics.*currently disabled/);
  assert.match(privacy, /If activated, Stripe will provide hosted checkout/);
});

test('unverified comparison article redirects to the current service page', () => {
  const config = read('next.config.ts');
  const sitemap = read('next-sitemap.config.js');
  assert.match(config, /source: '\/blog\/best-direct-mail-monterey-county'/);
  assert.match(config, /destination: '\/services'/);
  assert.match(sitemap, /'\/blog\/\*'/);
});
