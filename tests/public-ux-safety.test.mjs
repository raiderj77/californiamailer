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

test('static machine-readable copy never publishes expiring customer prices or selected reach', () => {
  const llms = read('public/llms.txt');
  assert.match(llms, /withheld in this static document/i);
  assert.match(llms, /No carrier routes or residential delivery counts are selected/);
  assert.match(llms, /request-time `\/pricing` page/);
  assert.doesNotMatch(llms, /\$(?:349|479|8,376|11,496)\b/);
  assert.doesNotMatch(llms, /Current verified posture|selected Monterey Peninsula carrier routes/);
});

test('unverified public mailbox is not published as a working contact method', () => {
  const publicIdentitySurfaces = [
    'public/llms.txt',
    'src/app/layout.tsx',
    'src/lib/schemas/organization.ts',
    'src/components/public/SiteFooter.tsx',
    'src/app/(public)/contact/page.tsx',
    'src/app/(public)/privacy/page.tsx',
    'src/app/(public)/terms/page.tsx',
    'src/app/(public)/local-deals/unsubscribe/page.tsx',
  ].map(read).join('\n');
  assert.doesNotMatch(publicIdentitySurfaces, /hello@californiamailer\.com|mailto:/i);
  assert.match(read('src/app/(public)/contact/page.tsx'), /no public mailbox is represented as verified/i);
});

test('draft policies are conditional, noindex, and absent from the sitemap', () => {
  const terms = read('src/app/(public)/terms/page.tsx');
  const funding = read('src/app/(public)/funding-policy/page.tsx');
  const privacy = read('src/app/(public)/privacy/page.tsx');
  const faq = read('src/app/(public)/faq/page.tsx');
  const campaign = read('src/config/foundingCampaign.ts');
  const projection = read('src/lib/campaignRecords.ts');
  const sitemap = read('next-sitemap.config.js');
  for (const source of [terms, funding]) {
    assert.match(source, /robots: \{ index: false, follow: false \}/);
  }
  assert.match(terms, /No campaign contract is approved for checkout/);
  assert.match(terms, /FOUNDING_CAMPAIGN\.termsVersion/);
  assert.match(funding, /No customer funding goal is published here as an approved checkout term/);
  assert.match(funding, /FOUNDING_CAMPAIGN\.fundingPolicyVersion/);
  assert.match(funding, /These outcomes remain unresolved/);
  assert.match(campaign, /termsVersion: '2026-08-23-draft-2'/);
  assert.match(campaign, /fundingPolicyVersion: '2026-08-23-draft-2'/);
  assert.match(privacy, /Last updated August 23, 2026/);
  assert.match(faq, /No cancellation or refund rule is active today/);
  assert.doesNotMatch(faq, /initiates full refunds|records the obligation/);
  assert.match(campaign, /no refund rule is approved/i);
  assert.match(projection, /refundSummary: approvedContractVersions \?/);
  assert.doesNotMatch(funding, /derivedFundingGoalLabel|No public page currently represents a rule that has not been approved/);
  assert.match(sitemap, /'\/funding-policy'/);
  assert.match(sitemap, /'\/terms'/);
  assert.doesNotMatch(sitemap.slice(0, sitemap.indexOf('const statewideServicePaths')), /'\/funding-policy'|'\/terms'/);
});

test('founding campaign copy uses a piece target without implying selected residences', () => {
  const home = read('src/app/(public)/home/page.tsx');
  const founding = read('src/app/(public)/founding-mailer/page.tsx');
  assert.match(home, /no routes or residential address count are selected/i);
  assert.match(founding, /no carrier routes, residential address count, or mailing is selected/i);
  assert.doesNotMatch(`${home}\n${founding}`, /selected Monterey Peninsula residences|target residences/i);
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
  assert.match(offerings, /A concept requiring a current Printing4SuperCheap quote/);
  assert.match(intake, /PIZZA_BOX_QUANTITY_LABEL/);
  assert.match(intake, /serviceType === 'pizza_box'/);
});
