import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('CRM API is owner-only, server-written, strict, and has no outreach action', () => {
  const route = read('src/app/api/admin/crm/route.ts');
  assert.ok((route.match(/requireOwner\(request\)/g) || []).length >= 2);
  assert.match(route, /getAdminFirestore\(\)/);
  assert.match(route, /z\.discriminatedUnion\('action'/);
  assert.match(route, /\.strict\(\)/);
  assert.doesNotMatch(route, /from ['"]firebase\/firestore['"]/);
  assert.doesNotMatch(route, /sendEmail|mailgun|twilio|messages\.create|checkout\.sessions/);
  assert.doesNotMatch(route, /action: z\.literal\(['"](?:send|email|sms|call|dial)['"]\)/);
});

test('CRM reuses source collections and protects payment-backed stages', () => {
  const route = read('src/app/api/admin/crm/route.ts');
  const domain = read('src/lib/crmDomain.ts');
  assert.match(route, /collection\('prospects'\)/);
  assert.match(route, /collection\('activities'\)/);
  assert.match(route, /collection\('reservationinterests'\)/);
  assert.match(route, /collection\('quoteinquiries'\)/);
  assert.match(route, /collection\('crmsettings'\)/);
  assert.match(domain, /isLegacyOperationalProspectStatus\(status\)\) return 'interested'/);
  assert.doesNotMatch(domain, /paymentStatus === 'cleared'.*return 'paid'/);
  assert.doesNotMatch(domain, /status === 'paid'.*return 'paid'/);
  assert.match(domain, /operationalStateSource: hasLegacyOperationalNote \? 'legacy_prospect_note' : 'not_applicable'/);
  assert.match(domain, /mapping\[stage\] \?\? null/);
  assert.match(route, /currentStage === 'reservation' \|\| currentStage === 'paid'/);
  assert.match(route, /where\('normalizedEmail', '==', normalizedEmail\)/);
  assert.match(route, /contactPreference: clean\(inquiry\.contactPreference\)/);
  assert.match(route, /replyPermission: clean\(inquiry\.replyPermission\)/);
  assert.match(route, /sourceQuoteInquiryId: inquiryId/);
  assert.match(route, /sourceQuoteMessage: clean\(inquiry\.message\)/);
  assert.match(route, /sourceQuoteSharedModelId: clean\(inquiry\.sharedModelId\)/);
  assert.match(route, /sourceQuoteMailerSpecId: clean\(inquiry\.mailerSpecId\)/);
  assert.match(route, /sourceQuoteIntakeStatus: clean\(inquiry\.intakeStatus\)/);
  assert.match(route, /sourceQuoteReviewQueueStatus: 'reviewed'/);
  assert.match(route, /sourceQuoteOutboundMessageStatus: clean\(inquiry\.outboundMessageStatus\)/);
  assert.match(route, /sourceQuoteSubmittedAt: inquiry\.createdAt \?\? null/);
  assert.match(route, /sourceQuoteSnapshotVersion: 2/);
  const quoteProspect = route.slice(route.indexOf('function quoteProspectRecord'), route.indexOf('function activityRecord'));
  for (const field of ['sourceQuotePublicReference', 'sourceQuoteMessage', 'sourceQuoteServiceType', 'sourceQuoteCity', 'sourceQuoteQuantity', 'sourceQuoteSharedModelId', 'sourceQuoteMailerSpecId', 'sourceQuoteMailerLabel', 'sourceQuoteTargeting', 'sourceQuoteFulfillment', 'sourceQuoteIntakeStatus', 'sourceQuoteReviewQueueStatus', 'sourceQuoteNotificationStatus', 'sourceQuoteOutboundMessageStatus', 'sourceQuoteSubmittedAt']) {
    assert.match(quoteProspect, new RegExp(`${field}:`));
  }
  assert.match(route, /quoteinquiries'\)\.orderBy\('createdAt', 'desc'\)/);
  const prospectView = route.slice(route.indexOf('function prospectView'), route.indexOf('function interestView'));
  assert.match(prospectView, /contactPreference: clean\(data\.contactPreference\)/);
  assert.match(prospectView, /replyPermission: clean\(data\.replyPermission\)/);
  for (const field of ['sourceQuoteSharedModelId', 'sourceQuoteMailerSpecId', 'sourceQuoteIntakeStatus', 'sourceQuoteReviewQueueStatus', 'sourceQuoteNotificationStatus', 'sourceQuoteOutboundMessageStatus', 'sourceQuoteSubmittedAt']) {
    assert.match(prospectView, new RegExp(`${field}:`));
  }
  const quoteView = route.slice(route.indexOf('function quoteView'), route.indexOf('function quoteProspectRecord'));
  for (const field of ['intakeStatus', 'reviewQueueStatus', 'notificationStatus', 'outboundMessageStatus', 'quantity', 'sharedModelId', 'mailerSpecId', 'mailerLabel', 'targeting', 'fulfillment']) {
    assert.match(quoteView, new RegExp(`${field}:`));
  }
  const quoteStatusStart = route.indexOf("if (input.action === 'set_quote_status')");
  const quoteStatus = route.slice(quoteStatusStart, route.indexOf('const prospectRef =', quoteStatusStart));
  assert.match(quoteStatus, /runTransaction/);
  assert.match(quoteStatus, /transaction\.get\(inquiryRef\)/);
  assert.match(quoteStatus, /inquiry\.status === 'do_not_contact'/);
  assert.match(quoteStatus, /reviewQueueStatus: input\.status === 'dismissed' \? 'dismissed' : 'reviewed'/);
  assert.doesNotMatch(domain.slice(domain.indexOf('const mapping'), domain.indexOf('return mapping')), /reservation:/);
  assert.doesNotMatch(domain.slice(domain.indexOf('const mapping'), domain.indexOf('return mapping')), /paid:/);
});

test('legacy prospect operational notes cannot manufacture sold or paid workflow state', () => {
  const prospectsPage = read('src/app/(dashboard)/prospects/page.tsx');
  const crmPage = read('src/app/(dashboard)/crm/page.tsx');
  const rules = read('firestore.rules');

  assert.doesNotMatch(prospectsPage, /<Select label="Category reservation"/);
  assert.doesNotMatch(prospectsPage, /<Select label="Payment"/);
  assert.match(prospectsPage, /Legacy operational notes — unverified/);
  assert.match(prospectsPage, /Cleared and sold controls were removed/);
  assert.match(crmPage, /Legacy payment note \(unverified\)/);
  assert.match(crmPage, /operationalStateSource === 'legacy_prospect_note'/);
  assert.match(rules, /function createsSafeProspectState\(\)/);
  assert.match(rules, /function preservesOrClearsLegacyProspectState\(\)/);
  assert.match(rules, /allow create: if createsOwned\(\) && createsSafeProspectState\(\)/);
  assert.match(rules, /&& preservesOrClearsLegacyProspectState\(\)/);
});

test('CRM browser page talks only to the owner API and links guarded operations', () => {
  const page = read('src/app/(dashboard)/crm/page.tsx');
  const sidebar = read('src/components/Sidebar.tsx');
  assert.match(page, /fetch\('\/api\/admin\/crm'/);
  assert.match(page, /Authorization: `Bearer \$\{await user\.getIdToken\(\)\}`/);
  assert.doesNotMatch(page, /firebase\/firestore|addDoc\(|updateDoc\(|deleteDoc\(/);
  for (const href of ['/interest-inbox', '/sales-desk', '/proof-workflow', '/refunds', '/tracking']) {
    assert.match(page, new RegExp(href.replace('/', '\\/')));
  }
  assert.match(sidebar, /\{ name: 'CRM', href: '\/crm' \}/);
});

test('quote intake is Firestore-first, durably idempotent, and does not activate outbound providers', () => {
  const quoteRoute = read('src/app/api/send-email/route.ts');
  const quotePage = read('src/app/(public)/quote/page.tsx');
  const crmPage = read('src/app/(dashboard)/crm/page.tsx');
  assert.match(quoteRoute, /transaction\.create\(inquiryRef/);
  assert.match(quoteRoute, /collection\('quoteinquiries'\)/);
  assert.match(quoteRoute, /requestHash = sha256\(JSON\.stringify/);
  assert.match(quoteRoute, /quote-content-\$\{requestHash\}/);
  assert.match(quoteRoute, /QUOTE_CONTENT_DEDUPE_WINDOW_MS/);
  assert.match(quoteRoute, /existing\.data\(\)\?\.requestHash !== requestHash/);
  assert.match(quoteRoute, /guardedInquiry\?\.exists && guardedInquiry\.data\(\)\?\.requestHash === requestHash/);
  assert.match(quoteRoute, /QuoteIdempotencyConflictError/);
  assert.match(quoteRoute, /intakeStatus: 'accepted'/);
  assert.match(quoteRoute, /reviewQueueStatus: 'queued'/);
  assert.match(quoteRoute, /notificationStatus: 'not_queued_disabled'/);
  assert.match(quoteRoute, /outboundMessageStatus: 'not_sent'/);
  assert.match(quoteRoute, /submissionHash/);
  assert.doesNotMatch(quoteRoute, /sendEmail|mailgun|provider_accepted|notificationAccepted|notificationProviderId/);
  assert.doesNotMatch(quoteRoute, /html\s*:/);
  assert.doesNotMatch(quotePage, /dangerouslySetInnerHTML|Delivering|notification email is delayed/);
  assert.doesNotMatch(crmPage, /dangerouslySetInnerHTML/);
  assert.match(quotePage, /result\.intakeStatus === 'accepted'/);
  assert.match(quotePage, /result\.outboundMessageStatus === 'not_sent'/);
  assert.match(quotePage, /No email, text, call, or notification was queued or sent/);
});
