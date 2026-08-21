import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const webhook = readFileSync(
  new URL('../src/app/api/webhook/route.ts', import.meta.url),
  'utf8',
);

function loadRefundSelector() {
  const start = webhook.indexOf('interface RefundObligationCandidate');
  const end = webhook.indexOf('async function applyRefund');
  assert.ok(start >= 0 && end > start, 'refund selector source must remain discoverable');
  const source = webhook.slice(start, end);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return Function(`${compiled}\nreturn selectRefundObligationIds;`)();
}

function loadCampaignPaymentBlockReason() {
  const start = webhook.indexOf('function campaignPaymentBlockReason');
  const end = webhook.indexOf('interface EventLease');
  assert.ok(start >= 0 && end > start, 'campaign payment guard source must remain discoverable');
  const source = webhook.slice(start, end);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return Function(
    'campaignMatchesActiveSharedModel',
    'RESERVATION_OPEN_STATUSES',
    'getApprovedCampaignContractVersions',
    `${compiled}\nreturn campaignPaymentBlockReason;`,
  )(
    (campaign) => campaign.activeModel === true,
    new Set(['accepting_reservations', 'partially_funded', 'fully_funded']),
    (campaign) => campaign.contractApproved === true
      ? { termsVersion: 'approved-terms', fundingPolicyVersion: 'approved-funding' }
      : null,
  );
}

test('webhook uses one canonical payment document per reservation', () => {
  assert.ok(
    webhook.match(/collection\('payments'\)\.doc\(reservationId\)/g)?.length >= 2,
    'checkout success and payment failure must address the same reservation-keyed ledger document',
  );
  assert.doesNotMatch(webhook, /collection\('payments'\)\.doc\((?:session|intent)\.id\)/);
  assert.match(webhook, /if \(snapshot\.size > 1\) throw new Error\('duplicate-payment-ledger'\)/);
  assert.match(webhook, /payment\.id !== String\(payment\.data\(\)\.reservationId\)/);
  assert.match(webhook, /reservation\.stripeCheckoutSessionId !== session\.id/);
  assert.match(webhook, /currentPayment\.externalPaymentId !== paymentIntentId/);
});

test('webhook binds checkout and payment ledger mutations to the active offer model', () => {
  assert.match(webhook, /import \{[\s\S]*FOUNDING_CAMPAIGN,[\s\S]*campaignMatchesActiveSharedModel,[\s\S]*getApprovedCampaignContractVersions,[\s\S]*\} from '@\/config\/foundingCampaign'/);
  assert.match(webhook, /const planId = session\.metadata\?\.planId/);
  assert.match(webhook, /const offerModelVersion = session\.metadata\?\.offerModelVersion/);
  assert.match(webhook, /planId !== FOUNDING_CAMPAIGN\.planId/);
  assert.match(webhook, /offerModelVersion !== FOUNDING_CAMPAIGN\.offerModelVersion/);
  assert.match(webhook, /reservation\.planId !== planId/);
  assert.match(webhook, /reservation\.offerModelVersion !== offerModelVersion/);
  assert.match(webhook, /transaction\.set\(paymentRef, \{[\s\S]*?planId,[\s\S]*?offerModelVersion,/);
  assert.match(webhook, /const planId = intent\.metadata\?\.planId/);
});

test('paid checkout completion revalidates campaign acceptance and quarantines late payments', () => {
  const campaignPaymentBlockReason = loadCampaignPaymentBlockReason();
  const accepting = {
    activeModel: true,
    status: 'accepting_reservations',
    paymentActivation: true,
    paymentsEnabled: true,
    artworkPreflightApproved: true,
    economicsVerified: true,
    routesConfirmed: true,
    contractApproved: true,
    reservationDeadline: new Date(Date.now() + 60_000).toISOString(),
  };
  assert.equal(campaignPaymentBlockReason(accepting), null);
  assert.equal(campaignPaymentBlockReason(undefined), 'campaign_not_found');
  assert.equal(campaignPaymentBlockReason({ ...accepting, activeModel: false }), 'campaign_model_mismatch');
  assert.equal(campaignPaymentBlockReason({ ...accepting, status: 'proofing' }), 'campaign_not_accepting_payments');
  assert.equal(campaignPaymentBlockReason({ ...accepting, paymentsEnabled: false }), 'campaign_payments_deactivated');
  assert.equal(campaignPaymentBlockReason({ ...accepting, artworkPreflightApproved: false }), 'campaign_artwork_preflight_not_approved');
  assert.equal(campaignPaymentBlockReason({ ...accepting, economicsVerified: false }), 'campaign_economics_not_verified');
  assert.equal(campaignPaymentBlockReason({ ...accepting, routesConfirmed: false }), 'campaign_routes_not_confirmed');
  assert.equal(campaignPaymentBlockReason({ ...accepting, contractApproved: false }), 'campaign_contract_not_approved');
  assert.equal(
    campaignPaymentBlockReason({ ...accepting, reservationDeadline: new Date(Date.now() - 60_000).toISOString() }),
    'campaign_reservation_deadline_passed',
  );
  assert.equal(campaignPaymentBlockReason({ ...accepting, reservationDeadline: 'not-a-date' }), 'campaign_reservation_deadline_invalid');
  const providerEventAt = Date.parse('2026-08-19T12:00:00.000Z');
  assert.equal(campaignPaymentBlockReason({ ...accepting, reservationDeadline: '2026-08-19T12:00:01.000Z' }, providerEventAt), null);
  assert.equal(
    campaignPaymentBlockReason({ ...accepting, reservationDeadline: '2026-08-19T12:00:00.000Z' }, providerEventAt),
    'campaign_reservation_deadline_passed',
  );
  assert.equal(campaignPaymentBlockReason(accepting, Number.NaN), 'provider_event_time_invalid');

  const checkoutHandler = webhook.slice(
    webhook.indexOf('async function applyCheckoutSession'),
    webhook.indexOf('async function expireCheckoutSession'),
  );
  assert.match(webhook, /RESERVATION_OPEN_STATUSES,[\s\S]*syncCampaignState/);
  assert.match(webhook, /campaignMatchesActiveSharedModel\(campaign\)/);
  assert.match(webhook, /campaign\.paymentActivation !== true \|\| campaign\.paymentsEnabled !== true/);
  assert.match(webhook, /reservationDeadlineMs <= providerEventOccurredAtMs/);
  assert.match(checkoutHandler, /transaction\.get\(campaignRef\)/);
  assert.match(checkoutHandler, /transaction\.get\(db\.collection\('routeplans'\)\.doc\(routePlanId\)\)/);
  assert.match(checkoutHandler, /campaignOperationalEvidenceBlockReason\([\s\S]*providerEventOccurredAtMs/);
  assert.match(checkoutHandler, /currentContractVersions\.termsVersion !== reservation\.termsVersion/);
  assert.match(checkoutHandler, /reservation\.status === 'awaiting_payment'/);
  assert.match(checkoutHandler, /reservation\.holdExpiresAt instanceof Timestamp/);
  assert.match(checkoutHandler, /holdExpiresAtMs <= providerEventOccurredAtMs/);
  assert.match(checkoutHandler, /reservation_hold_expired_at_provider_event/);
  assert.match(checkoutHandler, /if \(cleared && paymentBlockReason\)/);
  assert.match(checkoutHandler, /status: 'manual_review'/);
  assert.match(checkoutHandler, /reviewReason: 'late_payment_not_acceptable_current_state'/);
  assert.match(checkoutHandler, /transaction\.create\(lateRefundRef, \{/);
  assert.match(checkoutHandler, /status: 'requested'/);
  assert.match(checkoutHandler, /source: 'late_payment_webhook'/);
  assert.match(checkoutHandler, /no provider refund was initiated/);
  assert.match(checkoutHandler, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false[\s\S]*printReadyAt: null/);
  assert.match(checkoutHandler, /printReadinessRevokedReason: 'late_payment_manual_review'/);
  assert.doesNotMatch(checkoutHandler, /(?:stripe\.)?refunds\.create\(/);
  assert.match(webhook, /event\.created \* 1_000/);
});

test('every webhook-created manual-review state revokes cached print readiness atomically', () => {
  const checkoutHandler = webhook.slice(
    webhook.indexOf('async function applyCheckoutSession'),
    webhook.indexOf('async function expireCheckoutSession'),
  );
  const failedPaymentHandler = webhook.slice(
    webhook.indexOf('async function applyFailedPayment'),
    webhook.indexOf('async function findPaymentByIntent'),
  );
  assert.match(checkoutHandler, /printReadinessRevokedReason: 'late_payment_manual_review'/);
  assert.match(checkoutHandler, /printReadinessRevokedReason: 'inventory_ownership_manual_review'/);
  assert.match(failedPaymentHandler, /status: manualReview \? 'manual_review' : 'failed'/);
  assert.match(failedPaymentHandler, /status: 'payment_review'/);
  assert.match(failedPaymentHandler, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false[\s\S]*printReadyAt: null/);
  assert.match(failedPaymentHandler, /printReadinessRevokedReason: 'failed_payment_ledger_manual_review'/);
});

test('webhook never releases or restores inventory without current ownership', () => {
  assert.match(webhook, /snapshot\.data\(\)\?\.reservationId === reservationId\) transaction\.delete/);
  assert.match(webhook, /slotSnapshot\.data\(\)\?\.reservationId === reservationId/);
  assert.match(webhook, /snapshot\.data\(\)\?\.reservationId === reservationRef\.id\) transaction\.delete/);
  assert.match(webhook, /const inventoryOwned = claimSnapshots\.every[\s\S]*slotSnapshot\.data\(\)\?\.reservationId === reservationRef\.id/);
  assert.match(webhook, /dispute_won_inventory_ownership_mismatch/);
  assert.match(webhook, /function reservationDedupeId\(campaignId: string, emailNormalized: string\)/);
  const helper = webhook.slice(
    webhook.indexOf('function reservationDedupeId'),
    webhook.indexOf('interface EventLease'),
  );
  assert.match(helper, /update\(`\$\{campaignId\}:\$\{emailNormalized\}`\)/);
  assert.doesNotMatch(helper, /category/);
});

test('webhook idempotency uses a payload-bound lease and retries busy deliveries', () => {
  assert.match(webhook, /event-payload-mismatch/);
  assert.match(webhook, /leaseId,/);
  assert.match(webhook, /current\.data\(\)\?\.leaseId !== leaseId/);
  assert.match(webhook, /status: 409, headers: \{ 'Retry-After': '60' \}/);
  assert.match(webhook, /finishEvent\(db, event\.id, leaseId, 'processed'/);
  assert.match(webhook, /finishEvent\(db, event\.id, leaseId, 'failed'/);
});

test('refund reconciliation confirms only whole active obligations within provider-confirmed cents', () => {
  const selectRefundObligationIds = loadRefundSelector();
  const candidates = [
    { id: 'requested', status: 'requested', amountCents: 59_900, providerReference: null, createdAtMillis: 1 },
    { id: 'submitted-match', status: 'submitted', amountCents: 59_900, providerReference: 're_confirmed', createdAtMillis: 2 },
    { id: 'already-confirmed', status: 'confirmed', amountCents: 20_000, providerReference: null, createdAtMillis: 3 },
  ];
  assert.deepEqual(
    selectRefundObligationIds(candidates, 59_900, new Set(['re_confirmed'])),
    ['submitted-match'],
  );
  assert.deepEqual(
    selectRefundObligationIds([
      { id: 'approved', status: 'approved', amountCents: 30_000, providerReference: null, createdAtMillis: 1 },
      { id: 'requested', status: 'requested', amountCents: 20_000, providerReference: null, createdAtMillis: 2 },
      { id: 'too-large', status: 'submitted', amountCents: 80_000, providerReference: null, createdAtMillis: 0 },
    ], 50_000, new Set()),
    ['approved', 'requested'],
  );
  assert.deepEqual(
    selectRefundObligationIds([
      { id: 'partial', status: 'submitted', amountCents: 60_000, providerReference: null, createdAtMillis: 1 },
    ], 30_000, new Set()),
    [],
  );
});

test('charge.refunded reconciles local obligations without initiating a provider refund', () => {
  assert.match(webhook, /case 'charge\.refunded'/);
  assert.match(webhook, /applyRefund\(db, event\.data\.object as Stripe\.Charge, event\.id\)/);
  assert.match(webhook, /transaction\.get\(refundQuery\)/);
  assert.match(webhook, /status: 'confirmed'/);
  assert.match(webhook, /providerEventId: eventId/);
  assert.match(webhook, /the webhook did not initiate a provider refund/);
  assert.doesNotMatch(webhook, /(?:stripe\.)?refunds\.create\(/);
});

test('provider refunds and disputes revoke cached print readiness inside their ledger transactions', () => {
  const refundHandler = webhook.slice(
    webhook.indexOf('async function applyRefund'),
    webhook.indexOf('async function applyDispute'),
  );
  const disputeHandler = webhook.slice(
    webhook.indexOf('async function applyDispute'),
    webhook.indexOf('export async function POST'),
  );
  for (const handler of [refundHandler, disputeHandler]) {
    assert.match(handler, /transaction\.get\(campaignRef\)/);
    assert.match(handler, /transaction\.update\(campaignRef, \{/);
    assert.match(handler, /ownerPrintApproved: false/);
    assert.match(handler, /printReadyAt: null/);
    assert.match(handler, /printReadinessRevokedAt: FieldValue\.serverTimestamp\(\)/);
  }
  assert.match(refundHandler, /printReadinessRevokedReason: 'provider_refund'/);
  assert.match(refundHandler, /status: releasedSlotStatus\(campaignSnapshot\.data\(\)\)/);
  assert.match(disputeHandler, /printReadinessRevokedReason: closed \? `dispute_closed_\$\{dispute\.status\}` : 'dispute_created'/);
  assert.match(refundHandler, /transaction\.get\(trackingRef\)/);
  assert.match(refundHandler, /deactivatedReason: 'reservation_refunded'/);
  assert.match(refundHandler, /trackingStatus: 'inactive'/);
  assert.match(disputeHandler, /transaction\.get\(trackingRef\)/);
  assert.match(disputeHandler, /paymentLifecycleSuspended: true/);
  assert.match(disputeHandler, /activeBeforePaymentInterruption/);
  assert.match(disputeHandler, /deactivatedReason: closed \? `dispute_closed_\$\{dispute\.status\}` : 'dispute_created'/);
});

test('closed disputes reconcile won outcomes and keep ownership mismatches out of funding', () => {
  assert.match(webhook, /case 'charge\.dispute\.closed'/);
  assert.match(webhook, /applyDispute\(db, event\.data\.object as Stripe\.Dispute, true\)/);
  assert.match(webhook, /closed && dispute\.status === 'won'/);
  assert.match(webhook, /status: restoredStatus/);
  assert.match(webhook, /status: 'manual_review'/);
  assert.match(webhook, /status: 'disputed'/);
  assert.match(webhook, /disputeClosedAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(webhook, /objectId\(dispute\.payment_intent\)/);
  assert.match(webhook, /currentTracking\.paymentLifecycleSuspended === true/);
  assert.match(webhook, /currentTracking\.activeBeforePaymentInterruption === true/);
});

test('closed non-won disputes remain fail-closed pending an explicit owner inventory policy', () => {
  const disputeHandler = webhook.slice(
    webhook.indexOf('async function applyDispute'),
    webhook.indexOf('export async function POST'),
  ).replace(/\r\n/g, '\n');
  const nonWonMarker = /transaction\.update\(currentPaymentSnapshot\.ref,\s*\{\s*status: 'disputed'/;
  const nonWonStart = disputeHandler.search(nonWonMarker);
  assert.ok(nonWonStart >= 0, 'non-won dispute payment update must remain present');
  const nonWon = disputeHandler.slice(nonWonStart);
  assert.match(nonWon, /status: 'disputed'/);
  assert.match(nonWon, /transaction\.update\(reservationRef, \{ status: 'disputed'/);
  assert.match(nonWon, /paymentLifecycleSuspended: true/);
  assert.match(nonWon, /status: 'disputed', expiresAt: null/);
  assert.match(nonWon, /status: 'sold', expiresAt: null/);
  assert.doesNotMatch(nonWon, /transaction\.delete\(snapshot\.ref\)/);
  assert.doesNotMatch(nonWon, /reservationId: null/);
});
