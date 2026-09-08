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

test('public email endpoint accepts only structured quotes to the site inbox', () => {
  const route = read('src/app/api/send-email/route.ts');
  assert.match(route, /body\.kind !== 'quote'/);
  assert.match(route, /to: 'hello@californiamailer\.com'/);
  assert.doesNotMatch(route, /const \{ to, subject, text, html \}/);
  assert.match(route, /body\.website/);
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

test('privacy policy documents the live quote and analytics behavior', () => {
  const privacy = read('src/app/(public)/privacy/page.tsx');
  assert.match(privacy, /Quote requests/);
  assert.match(privacy, /Google Analytics is currently disabled/);
  assert.match(privacy, /Public online checkout is currently disabled/);
});

test('unverified comparison article redirects to the current service page', () => {
  const config = read('next.config.js');
  const sitemap = read('next-sitemap.config.js');
  assert.match(config, /source: '\/blog\/best-direct-mail-monterey-county'/);
  assert.match(config, /destination: '\/services'/);
  assert.match(sitemap, /'\/blog\/\*'/);
});
