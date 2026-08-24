import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const postcard = read('src/app/(public)/california-postcard-mailing/page.tsx');
const pizzaBox = read('src/app/(public)/pizza-box-advertising/page.tsx');
const offerings = read('src/config/eddmOfferings.ts');

test('statewide postcard page distinguishes EDDM and addressed USPS mail', () => {
  assert.match(postcard, /Request a California single-business postcard plan/);
  assert.match(postcard, /Every Door Direct Mail \(EDDM\)/);
  assert.match(postcard, /Addressed business postcards/);
  assert.match(postcard, /USPS delivers/);
  assert.match(postcard, /Printing4SuperCheap/);
  assert.match(postcard, /does not establish statewide fulfillment capacity, route availability/);
  assert.doesNotMatch(postcard, /Single-business postcard mailing across California|California-wide requests/);
});

test('statewide postcard pricing stays behind current evidence and both economic gates', () => {
  assert.match(postcard, /current signed-in/);
  assert.match(postcard, /complete economics/);
  assert.match(postcard, /\$2,500 pre-income-tax economic-surplus floor/);
  assert.match(postcard, /2,000 bps \(20%\) minimum margin/);
  assert.match(postcard, /Only after those checks can the owner provide a customer price or payment path/);
  assert.match(postcard, /payment and production stay unavailable/);
});

test('pizza box page identifies a quote-only partner placement rather than USPS mail', () => {
  assert.match(pizzaBox, /Request a pizza-box coupon or flyer plan for a California market/);
  assert.match(pizzaBox, /This would be partner-distributed advertising, not USPS mail or EDDM/);
  assert.match(pizzaBox, /signed distribution agreement/);
  assert.match(pizzaBox, /verified box volume/);
  assert.match(pizzaBox, /Rights-attested/);
  assert.match(pizzaBox, /Exact handoff and delivery-evidence responsibilities/);
  assert.match(pizzaBox, /Printing4SuperCheap/);
  assert.match(pizzaBox, /does not establish statewide service, a restaurant network, or inventory/);
  assert.doesNotMatch(pizzaBox, /placements across California|California-wide requests|Statewide service means/);
});

test('pizza box price, payment, and production remain behind complete economics', () => {
  assert.match(pizzaBox, /current signed-in/);
  assert.match(pizzaBox, /\$2,500 pre-income-tax economic-surplus floor/);
  assert.match(pizzaBox, /2,000 bps \(20%\) minimum margin/);
  assert.match(pizzaBox, /No written customer price, payment path, or production authorization/);
  assert.match(pizzaBox, /does not establish a restaurant network, partner, placement, quantity, inventory, or availability/);
});

test('homepage and intake options keep unverified partner placement conditional', () => {
  const home = read('src/app/(public)/home/page.tsx');
  assert.match(home, /No partner, placement, or box volume is represented as available at inquiry/);
  assert.match(offerings, /verified California restaurant partner/);
  assert.match(offerings, /before it can be offered/);
  assert.match(offerings, /no inquiry creates a hold or exclusivity/);
});

test('both statewide pages provide canonical metadata, visible FAQs, safe JSON-LD, and useful internal links', () => {
  for (const [source, path] of [
    [postcard, 'california-postcard-mailing'],
    [pizzaBox, 'pizza-box-advertising'],
  ]) {
    assert.match(source, new RegExp(`https://californiamailer\\.com/${path}`));
    assert.match(source, /'@type': 'FAQPage'/);
    assert.match(source, /type="application\/ld\+json"/);
    assert.match(source, /JSON\.stringify\(faqStructuredData\)\.replace\(\/<\/g, '\\\\u003c'\)/);
    for (const href of ['/quote', '/sample-card', '/mailing-areas', '/pricing']) {
      assert.match(source, new RegExp(`href="${href}"`));
    }
  }
});

test('statewide service pages are crawlable and linked without crowding the main header', () => {
  const sitemap = read('next-sitemap.config.js');
  const footer = read('src/components/public/SiteFooter.tsx');
  const header = read('src/components/public/SiteHeader.tsx');
  const home = read('src/app/(public)/home/page.tsx');
  const breadcrumbs = read('src/components/public/Breadcrumbs.tsx');

  for (const path of ['/california-postcard-mailing', '/pizza-box-advertising']) {
    assert.match(sitemap, new RegExp(`'${path}'`));
    assert.match(footer, new RegExp(`href="${path}"`));
    assert.match(home, new RegExp(`href: '${path}'`));
    assert.doesNotMatch(header, new RegExp(`href: '${path}'`));
  }
  assert.match(breadcrumbs, /'california-postcard-mailing': 'California postcard mailing'/);
  assert.match(breadcrumbs, /'pizza-box-advertising': 'Pizza box advertising'/);
});
