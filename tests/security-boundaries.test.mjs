import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('every owner dashboard route is wrapped by a verified server session', () => {
  const layout = read('src/app/(dashboard)/layout.tsx');
  assert.match(layout, /verifySessionCookie\(session, true\)/);
  assert.match(layout, /ownerTokenAllowed\(token\)/);
  assert.match(layout, /redirect\('\/owner-login'\)/);
});

test('subscriber, prospect, payment, proof, and tracking data are not publicly readable', () => {
  const rules = read('firestore.rules');
  for (const collection of ['subscribers', 'suppressions', 'reservations', 'payments', 'proofs', 'materials', 'trackinglinks', 'trackingevents', 'trackingreports', 'trackingcouponclaims', 'deliveryreports']) {
    assert.match(rules, new RegExp(`match \\/${collection}\\/\\{docId\\} \\{[\\s\\S]*?allow read: if isAdmin\\(\\)`));
  }
  assert.match(rules, /match \/publiccampaigns\/\{campaignId\}[\s\S]*allow read: if resource\.data\.published == true/);
  for (const collection of ['quoteinquiries', 'crmsettings', 'publicrequestguards']) {
    assert.match(rules, new RegExp(`match \/${collection}\/\\{docId\\} \\{[\\s\\S]*?allow read, write: if false`));
  }
});

test('Stripe webhook verifies signatures, idempotency, paid status, refunds, and disputes', () => {
  const webhook = read('src/app/api/webhook/route.ts');
  assert.match(webhook, /webhooks\.constructEvent/);
  assert.match(webhook, /session\.payment_status === 'paid'/);
  assert.match(webhook, /beginEvent/);
  assert.match(webhook, /charge\.refunded/);
  assert.match(webhook, /charge\.dispute\.created/);
  assert.doesNotMatch(webhook, /from ['"]firebase\/firestore['"]/);
});

test('browser reservation submissions cannot control price or bypass the category transaction', () => {
  const route = read('src/app/api/reservations/route.ts');
  const publicSchema = route.slice(route.indexOf('const reservationSchema'), route.indexOf('function sha256'));
  assert.doesNotMatch(publicSchema, /quotedPrice|priceCents|amountCents/);
  assert.match(publicSchema, /placementSize: z\.literal\('standard'\)/);
  assert.doesNotMatch(publicSchema, /double/);
  assert.match(route, /campaign\.placements\?\.\[parsed\.data\.placementSize\]/);
  assert.match(route, /campaignMatchesActiveSharedModel\(campaign\)/);
  assert.match(route, /invitation\.planId !== FOUNDING_CAMPAIGN\.planId/);
  assert.match(route, /invite\.offerModelVersion !== FOUNDING_CAMPAIGN\.offerModelVersion/);
  assert.match(route, /payment_intent_data:[\s\S]*planId: FOUNDING_CAMPAIGN\.planId/);
  assert.match(route, /campaign\.artworkPreflightApproved === true/);
  assert.match(route, /currentCampaign\.artworkPreflightApproved !== true/);
  assert.match(route, /currentCampaign\.economicsVerified !== true/);
  assert.match(route, /currentCampaign\.routesConfirmed !== true/);
  assert.match(route, /getApprovedCampaignContractVersions\(campaign\)/);
  assert.match(route, /getApprovedCampaignContractVersions\(currentCampaign\)/);
  assert.match(route, /termsVersion: currentContractVersions\.termsVersion/);
  assert.match(route, /fundingPolicyVersion: currentContractVersions\.fundingPolicyVersion/);
  assert.doesNotMatch(route, /includes\(['"]draft['"]\)/);
  assert.match(route, /currentDeadlineMs <= Date\.now\(\)/);
  assert.match(route, /const freeSlotIndex = slotSnapshots\.findIndex\(\(snapshot\) => snapshot\.id === freeSlot\.id\)/);
  assert.match(route, /position: freeSlot\.data\(\)\?\.position \?\? freeSlotIndex \+ 1/);
  assert.doesNotMatch(route, /slotRefs\.indexOf\(freeSlot\.ref\)/);
  assert.match(route, /runTransaction/);
  assert.match(route, /categoryclaims/);
});

test('hosted checkout URLs are disclosed only after a durable current-state binding', () => {
  const route = read('src/app/api/reservations/route.ts');
  const checkout = route.slice(route.indexOf('let checkoutUrl'), route.indexOf('let projectionStatus'));
  const bindingIndex = checkout.indexOf('await db.runTransaction');
  const sessionBindingIndex = checkout.indexOf('stripeCheckoutSessionId: session.id');
  const urlDisclosureIndex = checkout.indexOf('checkoutUrl = session.url');
  assert.ok(bindingIndex >= 0 && sessionBindingIndex > bindingIndex && urlDisclosureIndex > sessionBindingIndex);
  assert.match(checkout, /campaignMatchesActiveSharedModel\(currentCampaign\)/);
  assert.match(checkout, /RESERVATION_OPEN_STATUSES\.has\(String\(currentCampaign\.status\)\)/);
  assert.match(checkout, /currentCampaign\.paymentActivation !== true/);
  assert.match(checkout, /currentReservation\.status !== 'hold'/);
  assert.match(checkout, /currentClaimSnapshots\.every[\s\S]*currentSlotSnapshot\.data\(\)\?\.reservationId !== reservationRef\.id/);
  assert.match(checkout, /checkoutUrl = null/);
  assert.match(checkout, /stripe\.checkout\.sessions\.expire\(createdSession\.id\)/);
});

test('founding initialization is versioned and creates only the active equal-slot inventory', () => {
  const route = read('src/app/api/admin/campaigns/founding/route.ts');
  assert.match(route, /campaignMatchesActiveSharedModel\(record\)/);
  assert.match(route, /record\.artworkPreflightApproved !== true/);
  assert.match(route, /Physical and postal artwork preflight for the experimental 24-unit layout/);
  assert.match(route, /for \(const size of \['standard'\] as const\)/);
  assert.doesNotMatch(route, /\['standard', 'double'\]/);
  assert.match(route, /planId: FOUNDING_CAMPAIGN\.planId/);
  assert.match(route, /offerModelVersion: FOUNDING_CAMPAIGN\.offerModelVersion/);
  assert.match(route, /minimumPaidPlacements/);
});

test('publishing and checkout activation reject mismatched or terminal campaign state', () => {
  const route = read('src/app/api/admin/campaigns/founding/route.ts');
  const publishHandler = route.slice(
    route.indexOf("if (parsed.data.action === 'publish')"),
    route.indexOf("if (parsed.data.action === 'activate_reservations')"),
  );
  const activationHandler = route.slice(
    route.indexOf("if (parsed.data.action === 'activate_reservations')"),
    route.indexOf("if (parsed.data.action === 'deactivate_reservations')"),
  );
  assert.match(publishHandler, /const currentSnapshot = await transaction\.get\(campaignRef\)/);
  assert.match(publishHandler, /!campaignMatchesActiveSharedModel\(current\)/);
  assert.match(publishHandler, /!PUBLISHABLE_STATUSES\.has\(String\(current\.status\)\)/);
  assert.match(route, /RESERVATION_ACTIVATABLE_STATUSES/);
  assert.match(route, /'pre_launch'/);
  assert.match(route, /'accepting_reservations'/);
  assert.match(route, /'partially_funded'/);
  assert.doesNotMatch(
    route.slice(route.indexOf('const RESERVATION_ACTIVATABLE_STATUSES'), route.indexOf('const PUBLISHABLE_STATUSES')),
    /'proofing'|'printed'|'delivered'|'completed'|'cancelled'|'refunding'/,
  );
  assert.match(activationHandler, /transaction\.get\(campaignRef\)/);
  assert.match(activationHandler, /campaignOperationalEvidenceBlockReason/);
  assert.match(activationHandler, /activationBlockers\(current, evidenceReason\)/);
  assert.match(route, /getApprovedCampaignContractVersions\(record\)/);
  assert.doesNotMatch(route, /includes\(['"]draft['"]\)/);
});

test('the public campaign board requires the complete active model shape', () => {
  const board = read('src/components/public/CampaignBoard.tsx');
  assert.match(board, /campaignMatchesActiveSharedModel\(campaign\)/);
  assert.match(board, /function hasCurrentRouteEvidence/);
  assert.match(board, /campaign\.routePlanEvidenceValidThrough/);
  assert.match(board, /America\/Los_Angeles/);
  assert.match(board, /const selectedAreas = routeEvidenceCurrent/);
  assert.doesNotMatch(
    board.slice(board.indexOf('function isCurrentOfferCampaign'), board.indexOf('function formatPublishedCount')),
    /campaign\.planId ===|campaign\.offerModelVersion ===/,
  );
});

test('browser quote submissions select catalog options but cannot submit a price', () => {
  const route = read('src/app/api/send-email/route.ts');
  const quote = read('src/app/(public)/quote/page.tsx');
  assert.match(route, /browserPriceFields/);
  assert.match(route, /Browser-submitted prices are not accepted/);
  assert.match(route, /mailPieceForQuote/);
  assert.match(route, /quantities\.has/);
  assert.doesNotMatch(quote, /priceCents|amountCents|customerPriceCents|supplierCostCents/);
  assert.match(quote, /Nothing was reserved, sold, ordered, or charged/);
});

test('print approval requires the exact phrase and all computed gates', () => {
  const route = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const economics = read('src/app/(dashboard)/economics/page.tsx');
  const updateSchema = route.slice(route.indexOf('const updateSchema'), route.indexOf('const approvalSchema'));
  const getHandler = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function PUT'));
  const putHandler = route.slice(route.indexOf('export async function PUT'), route.indexOf('export async function POST'));
  const postHandler = route.slice(route.indexOf('export async function POST'));
  assert.match(route, /APPROVE PRINT READINESS/);
  assert.match(route, /supplierId: z\.literal\(PRINTING4SUPERCHEAP\.id\)/);
  assert.match(route, /campaignMatchesActiveSharedModel/);
  assert.match(getHandler, /assertActiveSharedModel\(data\)/);
  assert.match(putHandler, /const currentSnapshot = await transaction\.get\(ref\)/);
  assert.match(putHandler, /assertActiveSharedModel\(before\)/);
  assert.match(postHandler, /assertActiveSharedModel\(current\)/);
  assert.match(route, /minimumPaidPlacements/);
  assert.match(route, /paidReservationCount: paid\.length/);
  assert.doesNotMatch(route, /minimumAdvertisers/);
  assert.doesNotMatch(route, /placements\.double|\/ 12/);
  assert.match(route, /taxCostCents/);
  assert.match(route, /ownerLaborCostCents/);
  assert.match(route, /targetOwnerSurplusCents/);
  assert.match(updateSchema, /ownerSurplusNullableCents/);
  assert.match(route, /MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS/);
  assert.match(route, /MINIMUM_ECONOMIC_MARGIN_BPS/);
  assert.match(putHandler, /minimumMarginBps: enforcedMinimumMarginBps/);
  assert.match(route, /PRINTING4SUPERCHEAP\.recheckAfterDays|quoteVerificationStatus/);
  assert.match(route, /summary\.targetGapCents >= 0/);
  assert.match(putHandler, /economicsVerifiedAt: economicsVerified \? FieldValue\.serverTimestamp\(\) : null/);
  assert.match(putHandler, /paymentActivation: false/);
  assert.match(putHandler, /paymentsEnabled: false/);
  assert.match(route, /if \(!operations\.readiness\.ready\)/);
  assert.match(route, /No print order was placed/);
  for (const browserOwnedRouteField of ['verifiedHouseholds', 'householdCountBasis', 'selectedAreas', 'routesConfirmed']) {
    assert.doesNotMatch(updateSchema, new RegExp(browserOwnedRouteField));
  }
  assert.match(economics, /Open Territories &amp; routes/);
  assert.match(economics, /They cannot be confirmed on this financial form/);
  assert.match(economics, /server-enforced minimum before income tax/);
  assert.match(economics, /min=\{minimum\}/);
  assert.doesNotMatch(economics, /set\('routesConfirmed'/);
});

test('economics scheduling is server validated and owner messages are announced', () => {
  const route = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const economics = read('src/app/(dashboard)/economics/page.tsx');
  const quote = read('src/app/(public)/quote/page.tsx');
  assert.match(route, /input\.plannedDeliveryStart > input\.plannedDeliveryEnd/);
  assert.match(route, /Date\.parse\(input\.reservationDeadline\) <= Date\.now\(\)/);
  assert.match(route, /campaignDateKey\(input\.reservationDeadline\) >= input\.plannedDeliveryStart/);
  assert.match(route, /Pacific calendar date before planned delivery start/);
  assert.match(economics, /function toDateTimeLocal/);
  assert.match(economics, /date\.getFullYear\(\)/);
  assert.doesNotMatch(economics, /reservationDeadline\?\.slice\(0, 16\)/);
  assert.match(economics, /role=\{error \? 'alert' : 'status'\}/);
  assert.match(quote, /role="status" aria-live="polite"/);
  assert.match(quote, /role="alert" aria-live="assertive"/);
});

test('proof decisions are private, latest-version-only, and audited', () => {
  const route = read('src/app/api/reservations/[id]/proofs/route.ts');
  assert.match(route, /verifyReservationAccess/);
  assert.match(route, /latestProofId !== proof\.id/);
  assert.match(route, /proofapprovals/);
  assert.match(route, /FieldValue\.serverTimestamp/);
  assert.match(route, /transaction\.update\(db\.collection\('campaigns'\)\.doc\(reservation\.campaignId\), \{ ownerPrintApproved: false, printReadyAt: null, artworkPreflightApproved: false/);
});

test('proof, material, and refund mutations atomically revoke cached print readiness', () => {
  const adminProof = read('src/app/api/admin/proofs/route.ts');
  const material = read('src/app/api/admin/materials/[id]/route.ts');
  const materialUpload = read('src/app/api/reservations/[id]/materials/route.ts');
  const refunds = read('src/app/api/admin/refunds/route.ts');

  assert.match(adminProof, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false,[\s\S]*printReadyAt: null,[\s\S]*artworkPreflightApproved: false/);
  assert.match(adminProof, /printReadinessRevokedReason: 'proof_created'/);
  assert.match(material, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false,[\s\S]*printReadyAt: null,[\s\S]*artworkPreflightApproved: false/);
  assert.match(material, /printReadinessRevokedReason: `material_\$\{parsed\.data\.action\}`/);
  assert.match(materialUpload, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false,[\s\S]*printReadyAt: null,[\s\S]*artworkPreflightApproved: false/);
  assert.match(materialUpload, /printReadinessRevokedReason: 'material_uploaded'/);
  assert.ok((refunds.match(/transaction\.update\(campaignRef, \{ ownerPrintApproved: false, printReadyAt: null/g) || []).length >= 2);
  assert.match(refunds, /printReadinessRevokedReason: 'refund_requested'/);
  assert.match(refunds, /printReadinessRevokedReason: `refund_\$\{reviewAction\.action\}`/);
});

test('print scheduling consumes only current transactionally revalidated readiness', () => {
  const route = read('src/app/api/admin/campaigns/founding/route.ts');
  const economics = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const readiness = read('src/lib/campaignPrintReadiness.ts');
  assert.match(route, /const lifecycle = await db\.runTransaction/);
  assert.match(route, /const latestSnapshot = await transaction\.get\(campaignRef\)/);
  assert.match(route, /campaignMatchesActiveSharedModel\(latest\)/);
  assert.match(route, /campaignPrintReadinessState\(/);
  assert.match(route, /if \(!operations\.readiness\.ready\)/);
  assert.match(readiness, /recordedTimestampMillis\(data\.printReadyAt\)/);
  assert.match(route, /\['schedule_for_print', 'record_printed'\]\.includes\(action\)/);
  assert.match(route, /transaction\.update\(campaignRef, transactionUpdate\)/);
  assert.match(route, /printReadinessRevokedReason: 'campaign_cancelled'/);
  assert.match(economics, /const approval = await db\.runTransaction/);
  assert.match(economics, /const currentSnapshot = await transaction\.get\(ref\)/);
  assert.match(economics, /transaction\.get\(db\.collection\('proofs'\)\.where\('campaignId', '==', FOUNDING_CAMPAIGN\.id\)\)/);
  assert.match(economics, /refundDocumentsWithLinkedEvidence\(\s*transaction,/);
  assert.match(economics, /transaction\.get\(db\.collection\('payments'\)\.where\('campaignId', '==', FOUNDING_CAMPAIGN\.id\)\)/);
  assert.match(economics, /const currentClearedFundingCents = clearedNetFundingCents\(payments\)/);
  assert.match(economics, /\['proofing', 'scheduled_for_print'\]\.includes/);
  assert.match(economics, /transaction\.update\(ref, \{ ownerPrintApproved: true/);
});

test('every consequential campaign lifecycle transition re-reads current state transactionally', () => {
  const route = read('src/app/api/admin/campaigns/founding/route.ts');
  assert.match(route, /const publishResult = await db\.runTransaction/);
  assert.match(route, /const deactivated = await db\.runTransaction/);
  assert.match(route, /const proofing = await db\.runTransaction/);
  assert.match(route, /const lifecycle = await db\.runTransaction/);
  assert.match(route, /const completed = await db\.runTransaction/);
  assert.match(route, /const cancellation = await db\.runTransaction/);
  assert.match(route, /const closing = await db\.runTransaction/);
  assert.match(route, /const unpublished = await db\.runTransaction/);
  assert.match(route, /transaction\.get\(db\.collection\('payments'\)\.where\('campaignId', '==', FOUNDING_CAMPAIGN\.id\)\)/);
  assert.match(route, /refundDocumentsWithLinkedEvidence\(\s*transaction,/);
});

test('campaign synchronization derives funding and lifecycle from one transaction snapshot', () => {
  const sync = read('src/lib/campaignSync.ts');
  assert.match(sync, /await db\.runTransaction\(async \(transaction\) =>/);
  assert.match(sync, /const campaignSnapshot = await transaction\.get\(campaignRef\)/);
  assert.match(sync, /transaction\.get\(db\.collection\('payments'\)\.where\('campaignId', '==', campaignId\)\)/);
  assert.match(sync, /transaction\.update\(campaignRef, \{/);
  assert.match(sync, /const status = synchronizedCampaignStatus\(/);
  assert.match(sync, /available: inventoryOpen \? Math\.max\(0, total - sold - held\) : 0/);
  assert.match(sync, /paymentActivation: inventoryOpen/);
  assert.match(sync, /paymentsEnabled: inventoryOpen/);
  assert.doesNotMatch(sync, /const batch = db\.batch\(\)/);
});

test('consumer email uses affirmative verified consent and a private suppression record', () => {
  const route = read('src/app/api/subscribers/route.ts');
  const form = read('src/components/public/DealsConsentForm.tsx');
  assert.match(route, /consent: z\.literal\(true\)/);
  assert.match(route, /pending_verification/);
  assert.match(route, /affirmative_signup_verified/);
  assert.match(route, /suppressions/);
  assert.match(route, /CONSUMER_EMAIL_ENABLED/);
  assert.doesNotMatch(form, /defaultChecked/);
});
