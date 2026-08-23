import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('public planning prices are evaluated at request time and stale customer prices are withheld', () => {
  const pricing = read('src/app/(public)/pricing/page.tsx');
  const helper = read('src/lib/publicPlanningPriceVisibility.ts');
  assert.match(pricing, /export const dynamic = 'force-dynamic'/);
  assert.match(pricing, /await getPublicPlanningPriceVisibility\(\)/);
  assert.match(helper, /await connection\(\)/);
  assert.match(helper, /new Date\(\)\.toISOString\(\)/);
  assert.match(pricing, /activePriceSupported/);
  assert.match(helper, /Withheld — written quote required/);
  assert.match(pricing, /Stored planning price withheld/);
});

test('every public founding-price surface consumes the shared runtime visibility decision', () => {
  const runtimeServerSurfaces = [
    'src/app/(public)/pricing/page.tsx',
    'src/app/(public)/home/page.tsx',
    'src/app/(public)/advertisers/page.tsx',
    'src/app/(public)/sample-card/page.tsx',
    'src/app/(public)/funding-policy/page.tsx',
    'src/app/(public)/reserve/page.tsx',
    'src/app/(public)/founding-mailer/page.tsx',
    'src/app/(public)/coop-board/page.tsx',
  ];
  for (const path of runtimeServerSurfaces) {
    assert.match(read(path), /getPublicPlanningPriceVisibility/);
  }

  const clientSurfaces = [
    read('src/components/public/CampaignBoard.tsx'),
    read('src/components/public/ReserveInterestForm.tsx'),
  ];
  for (const source of clientSurfaces) {
    assert.match(source, /PublicPlanningPriceVisibility/);
    assert.doesNotMatch(source, /evaluateDatedPlanningPrice|suggestedPricePerPaidUnitCents/);
  }

  const publicPriceSources = [
    ...runtimeServerSurfaces.map(read),
    ...clientSurfaces,
  ].join('\n');
  assert.doesNotMatch(
    publicPriceSources,
    /formatCurrency\(FOUNDING_CAMPAIGN\.(?:placements\.standard\.priceCents|fundingGoalCents)\)/,
  );
  assert.doesNotMatch(publicPriceSources, /formatPublishedCurrency\(placement\.priceCents\)/);
});

test('every request-time public price surface remains explicitly discoverable', () => {
  const sitemap = read('next-sitemap.config.js');
  for (const path of [
    '/advertisers',
    '/coop-board',
    '/founding-mailer',
    '/funding-policy',
    '/home',
    '/pricing',
    '/reserve',
    '/sample-card',
  ]) {
    assert.match(sitemap, new RegExp(`'${path}'`));
  }
  assert.match(sitemap, /additionalPaths/);
  assert.match(sitemap, /requestTimePublicPaths\.map/);
});

test('browser-readable campaign projections never persist expiring customer prices', () => {
  const projection = read('src/lib/campaignRecords.ts');
  const campaignType = read('src/lib/campaignTypes.ts');
  const board = read('src/components/public/CampaignBoard.tsx');
  assert.doesNotMatch(projection, /placements: record\.placements/);
  assert.match(projection, /fundingGoalCents: null/);
  assert.match(campaignType, /fundingGoalCents: null/);
  assert.match(campaignType, /Omit<PlacementInventory, 'priceCents'>/);
  assert.match(board, /priceVisibility\.active\.derivedFundingGoalCents/);
  assert.doesNotMatch(board, /campaign\.clearedFundingCents \/ campaign\.fundingGoalCents/);
});

test('legacy area redirects preserve the known Monterey page without inventing other geography', () => {
  const config = read('next.config.ts');
  const monterey = config.indexOf("source: '/areas/monterey-peninsula'");
  const fallback = config.indexOf("source: '/areas/:path*'");
  assert.ok(monterey >= 0 && fallback > monterey);
  assert.match(config.slice(monterey, fallback), /destination: '\/territory\/monterey-peninsula'/);
  assert.match(config.slice(fallback), /destination: '\/mailing-areas'/);
});

test('advertiser production resources distinguish loading, failure, and verified empty states', () => {
  const panel = read('src/components/reservation/ReservationProductionPanel.tsx');
  assert.match(panel, /proofsError/);
  assert.match(panel, /materialsError/);
  assert.match(panel, /trackingError/);
  assert.match(panel, /Checking numbered proof history/);
  assert.match(panel, /No numbered proof has been issued/);
  assert.match(panel, /No private materials have been received/);
  assert.match(panel, /No absence of tracking is inferred/);
  assert.doesNotMatch(panel, /proofResponse\.ok \? await proofResponse\.json\(\) : \{ proofs: \[\] \}/);
  assert.doesNotMatch(panel, /trackingResponse\.ok \? await trackingResponse\.json\(\) : \{ tracking: null \}/);
});

test('mobile owner navigation is non-overlapping and keyboard-managed', () => {
  const sidebar = read('src/components/Sidebar.tsx');
  assert.match(sidebar, /sticky top-0.*h-16/);
  assert.match(sidebar, /aria-controls="owner-navigation"/);
  assert.match(sidebar, /event\.key === 'Escape'/);
  assert.match(sidebar, /event\.key !== 'Tab'/);
  assert.match(sidebar, /closeButtonRef\.current\?\.focus/);
  assert.match(sidebar, /aria-modal=\{isOpen \? true : undefined\}/);
  assert.match(sidebar, /invisible -translate-x-full md:visible md:translate-x-0/);
});

test('admin and public coupon availability share the complete-content predicate', () => {
  const admin = read('src/app/api/admin/coupons/route.ts');
  const publicPage = read('src/app/(public)/coupon/[code]/page.tsx');
  assert.match(admin, /couponDraftIsComplete\(publishedContent\)/);
  assert.match(publicPage, /couponDraftIsComplete\(content\)/);
  assert.doesNotMatch(admin, /hasPublishedContent: Boolean\(publishedContent\)/);
});

test('sample-card studies cover distinct shared-mailer families without claiming production proof', () => {
  const sample = read('src/app/(public)/sample-card/page.tsx');
  for (const label of [
    '9 × 12 shared card',
    '9 × 12 experimental card',
    '12 × 15 shared card',
    'M6 small shared mailer',
    'M3 partner mailer',
    'Community and new-mover cards',
    'Directory-style card',
    'Partner-distributed pizza-box flyer',
  ]) {
    assert.ok(sample.includes(label));
  }
  assert.match(sample, /Original planning diagrams · not source artwork/);
  assert.match(sample, /not a 24-ad proof/);
  assert.match(sample, /fit unproven/);
  assert.match(sample, /house panel is never counted as paid funding/);
  assert.match(sample, /New-mover targeting is not EDDM/);
  assert.match(sample, /not equal display ads/);
  assert.match(sample, /Not USPS mail/);
  assert.match(sample, /Printing4SuperCheap is the required printer/);
});

test('quote page offers a bounded faceless fit preview without guarantees or silent outreach', () => {
  const quote = read('src/app/(public)/quote/page.tsx');
  const offerings = read('src/config/eddmOfferings.ts');
  const intake = read('src/app/api/send-email/route.ts');
  assert.match(quote, /Free private campaign-fit preview/);
  assert.match(quote, /without booking a sales call/);
  assert.match(quote, /does not guarantee that a preview or quote will be produced/);
  assert.match(quote, /does not send an automated message, enroll you in marketing/);
  assert.match(quote, /No predicted leads, sales, response rate, or ROI is included/);
  assert.match(quote, /Partner-distributed—not mailed/);
  assert.match(quote, /Printing4SuperCheap is the required printer/);
  assert.match(offerings, /pizza_box/);
  assert.match(offerings, /Printing4SuperCheap prints the piece/);
  assert.match(intake, /PIZZA_BOX_QUANTITY_LABEL/);
  assert.match(intake, /serviceType === 'pizza_box'/);
});
