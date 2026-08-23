import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {
  isActiveRefundObligationStatus,
  isKnownRefundRecordStatus,
} from '../src/lib/businessRules.ts';
import { isMandatoryRefundRecord } from '../src/lib/paymentLedgerIntegrity.ts';

const webhook = readFileSync(
  new URL('../src/app/api/webhook/route.ts', import.meta.url),
  'utf8',
);
const refundAdmin = readFileSync(
  new URL('../src/app/api/admin/refunds/route.ts', import.meta.url),
  'utf8',
);
const refundPage = readFileSync(
  new URL('../src/app/(dashboard)/refunds/page.tsx', import.meta.url),
  'utf8',
);
const foundingCampaignAdmin = readFileSync(
  new URL('../src/app/api/admin/campaigns/founding/route.ts', import.meta.url),
  'utf8',
);

function loadRefundReconciliation() {
  const start = webhook.indexOf('interface RefundObligationCandidate');
  const end = webhook.indexOf('async function applyRefund');
  assert.ok(start >= 0 && end > start, 'refund reconciliation source must remain discoverable');
  const source = webhook.slice(start, end);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return Function(
    'capturedManualReviewRefundAmounts',
    'isActiveRefundObligationStatus',
    'isKnownRefundRecordStatus',
    `${compiled}\nreturn reconcileProviderRefundObligations;`,
  )(
    loadCapturedCheckoutDisposition().capturedManualReviewRefundAmounts,
    isActiveRefundObligationStatus,
    isKnownRefundRecordStatus,
  );
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

function loadCapturedCheckoutDisposition() {
  const start = webhook.indexOf('function capturedCheckoutDisposition');
  const end = webhook.indexOf('interface EventLease');
  assert.ok(start >= 0 && end > start, 'captured checkout disposition source must remain discoverable');
  const source = webhook.slice(start, end);
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return Function(
    'isActiveRefundObligationStatus',
    'isKnownRefundRecordStatus',
    `${compiled}\nreturn {
    capturedCheckoutDisposition,
    requiredCapturedRefundStatus,
    capturedManualReviewRefundAmounts,
    assertCapturedManualReviewRefundIdentity,
    activeOtherRefundObligationCents,
    isTerminalCheckoutPaymentStatus,
    isCaptureBackedManualReview,
    isTerminalClosedDisputeReplay,
  };`,
  )(isActiveRefundObligationStatus, isKnownRefundRecordStatus);
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
  assert.match(checkoutHandler, /capturedCheckoutDisposition\(paymentBlockReason, inventoryOwned, currentPayment\?\.status\)/);
  assert.match(checkoutHandler, /if \(capturedDisposition\?\.refundRequired\)/);
  assert.match(checkoutHandler, /status: capturedDisposition\.paymentStatus/);
  assert.match(webhook, /reviewReason: 'late_payment_not_acceptable_current_state'/);
  assert.match(checkoutHandler, /transaction\.set\(capturedRefundRef, \{/);
  assert.match(checkoutHandler, /status: obligationStatus/);
  assert.match(checkoutHandler, /source: 'captured_manual_review_webhook'/);
  assert.match(checkoutHandler, /requiredFullRefund: true/);
  assert.match(checkoutHandler, /ownerRejectable: false/);
  assert.match(checkoutHandler, /no provider refund was initiated/);
  assert.match(checkoutHandler, /transaction\.update\(campaignRef, \{[\s\S]*ownerPrintApproved: false[\s\S]*printReadyAt: null/);
  assert.match(checkoutHandler, /printReadinessRevokedReason: paymentBlockReason/);
  assert.doesNotMatch(checkoutHandler, /(?:stripe\.)?refunds\.create\(/);
  assert.match(webhook, /event\.created \* 1_000/);
});

test('delayed Stripe success after slot reallocation is quarantined with a mandatory full refund', () => {
  const {
    capturedCheckoutDisposition,
    requiredCapturedRefundStatus,
    isTerminalCheckoutPaymentStatus,
  } = loadCapturedCheckoutDisposition();
  assert.deepEqual(
    capturedCheckoutDisposition(null, false, 'pending'),
    {
      paymentStatus: 'manual_review',
      reviewReason: 'inventory_ownership_mismatch',
      refundRequired: true,
    },
  );
  assert.equal(requiredCapturedRefundStatus('approved'), 'approved');
  assert.equal(requiredCapturedRefundStatus('submitted'), 'submitted');
  assert.equal(requiredCapturedRefundStatus('rejected'), 'requested');
  assert.equal(requiredCapturedRefundStatus(undefined), 'requested');
  assert.deepEqual(
    capturedCheckoutDisposition('reservation_not_awaiting_payment', false, 'pending'),
    {
      paymentStatus: 'manual_review',
      reviewReason: 'late_payment_not_acceptable_current_state',
      refundRequired: true,
    },
  );
  assert.deepEqual(
    capturedCheckoutDisposition(null, true, 'pending'),
    { paymentStatus: 'cleared', reviewReason: null, refundRequired: false },
  );
  assert.deepEqual(
    capturedCheckoutDisposition(null, true, 'manual_review'),
    {
      paymentStatus: 'manual_review',
      reviewReason: 'existing_payment_manual_review',
      refundRequired: true,
    },
  );
  assert.equal(isTerminalCheckoutPaymentStatus('refunded'), true);
  assert.equal(isTerminalCheckoutPaymentStatus('partially_refunded'), true);
  assert.equal(isTerminalCheckoutPaymentStatus('disputed'), true);
  assert.equal(isTerminalCheckoutPaymentStatus('cleared'), false);
  assert.equal(isTerminalCheckoutPaymentStatus('failed'), false);

  const checkoutHandler = webhook.slice(
    webhook.indexOf('async function applyCheckoutSession'),
    webhook.indexOf('async function expireCheckoutSession'),
  );
  assert.match(checkoutHandler, /providerCaptureReportedAt:/);
  assert.match(checkoutHandler, /clearedAt: null/);
  assert.match(checkoutHandler, /no longer owned its category or placement/);
  assert.match(checkoutHandler, /already quarantined payment record/);
  assert.match(checkoutHandler, /if \(isTerminalCheckoutPaymentStatus\(currentPayment\?\.status\)\) return/);
  assert.match(checkoutHandler, /createdAt: capturedRefund\?\.createdAt \|\| FieldValue\.serverTimestamp\(\)/);
  assert.match(checkoutHandler, /requiredCapturedRefundStatus\(capturedRefund\?\.status\)/);
  assert.match(checkoutHandler, /transaction\.get\(refundObligationsQuery\)/);
  assert.match(checkoutHandler, /coveredByOtherObligationsCents/);
  assert.doesNotMatch(checkoutHandler, /(?:stripe\.)?refunds\.create\(/);
});

test('exact failed intent settles only an uncaptured inventory-mismatch review', () => {
  const { isCaptureBackedManualReview } = loadCapturedCheckoutDisposition();
  assert.equal(isCaptureBackedManualReview(
    { status: 'manual_review', providerCaptureReportedAt: { seconds: 1 } },
    undefined,
  ), true);
  assert.equal(isCaptureBackedManualReview(
    { status: 'manual_review' },
    { requiredFullRefund: true, status: 'requested' },
  ), true);
  assert.equal(isCaptureBackedManualReview(
    { status: 'manual_review' },
    { source: 'captured_manual_review_webhook', status: 'confirmed' },
  ), true);
  assert.equal(isCaptureBackedManualReview(
    { status: 'manual_review', reviewReason: 'inventory_ownership_mismatch' },
    undefined,
  ), false);

  const failedPaymentHandler = webhook.slice(
    webhook.indexOf('async function applyFailedPayment'),
    webhook.indexOf('async function findPaymentByIntent'),
  );
  assert.match(failedPaymentHandler, /currentPayment\.reviewReason === 'inventory_ownership_mismatch'/);
  assert.match(failedPaymentHandler, /currentPayment\.externalPaymentId === intent\.id/);
  assert.match(failedPaymentHandler, /Number\(currentPayment\.amountCents\) === Number\(intent\.amount\)/);
  assert.match(failedPaymentHandler, /currentPayment\.currency === intent\.currency/);
  assert.match(failedPaymentHandler, /!isCaptureBackedManualReview\(currentPayment, capturedRefundSnapshot\.data\(\)\)/);
  assert.match(failedPaymentHandler, /status: manualReview \? 'manual_review' : 'failed'/);
  assert.match(failedPaymentHandler, /status: 'expired'/);
  assert.match(failedPaymentHandler, /transaction\.delete\(snapshot\.ref\)/);
  assert.match(failedPaymentHandler, /active: false/);
});

test('mandatory captured-payment refunds are visible, actionable, and cannot be rejected locally', () => {
  assert.match(refundAdmin, /requiredFullRefund,/);
  assert.match(refundAdmin, /ownerRejectable: !requiredFullRefund/);
  assert.match(refundAdmin, /if \(isRequiredFullRefund\(refund\)\) throw new Error\('required-refund-not-rejectable'\)/);
  assert.match(refundAdmin, /refund\.status !== 'approved'/);
  assert.match(refundAdmin, /status: 'submitted'/);
  assert.match(refundAdmin, /action: 'refund\.required_coverage_reconcile'/);
  assert.match(refundAdmin, /coveredByOtherObligationsCents/);
  assert.match(refundPage, /required full refund/);
  assert.match(refundPage, /Provider-confirmed capture: this obligation cannot be rejected locally/);
  assert.match(refundPage, /Awaiting a signed provider webhook/);
});

test('accepted campaign-cancellation refunds remain mandatory until provider confirmation', () => {
  const cancellation = foundingCampaignAdmin.slice(
    foundingCampaignAdmin.indexOf("if (parsed.data.action === 'cancel_campaign')"),
    foundingCampaignAdmin.indexOf("if (parsed.data.action === 'close_cancelled')"),
  );
  assert.match(cancellation, /source: 'campaign_cancellation'/);
  assert.match(cancellation, /requiredFullRefund: true/);
  assert.match(cancellation, /ownerRejectable: false/);
  assert.equal(isMandatoryRefundRecord({ source: 'campaign_cancellation' }), true);
  assert.match(refundAdmin, /if \(isRequiredFullRefund\(refund\)\) throw new Error\('required-refund-not-rejectable'\)/);
  assert.match(refundAdmin, /const cancellationRefundLock = \['refunding', 'cancelled'\]/);
  assert.match(refundAdmin, /transaction\.get\(campaignRef\)/);
  assert.match(refundAdmin, /throw new Error\('cancellation-refund-not-rejectable'\)/);
  assert.match(refundPage, /Accepted cancellation policy: this obligation cannot be rejected locally/);
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
  assert.match(checkoutHandler, /\? 'late_payment_manual_review'/);
  assert.match(checkoutHandler, /: 'inventory_ownership_manual_review'/);
  assert.match(checkoutHandler, /: 'captured_payment_manual_review'/);
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

test('refund reconciliation shrinks the mandatory balance and ignores out-of-order cumulative events', () => {
  const reconcile = loadRefundReconciliation();
  const binding = {
    campaignId: 'campaign',
    paymentId: 'reservation',
    reservationId: 'reservation',
  };
  const mandatory = {
    id: 'campaign__late_payment__reservation',
    ...binding,
    status: 'requested',
    amountCents: 100_000,
    providerReference: null,
    createdAtMillis: 1,
    requiredCapturedRefund: true,
    originalAmountCents: null,
    providerRefundedCents: null,
  };
  const partial = reconcile(
    100_000,
    0,
    25_000,
    mandatory.id,
    binding,
    [mandatory],
    new Map([['re_partial', 25_000]]),
  );
  assert.equal(partial.stale, false);
  assert.deepEqual(partial.updates, []);
  assert.deepEqual(partial.mandatoryUpdate, {
    id: mandatory.id,
    status: 'requested',
    amountCents: 75_000,
    originalAmountCents: 100_000,
    providerRefundedCents: 25_000,
    coveredByOtherObligationsCents: 0,
  });

  const outOfOrder = reconcile(
    100_000,
    25_000,
    10_000,
    mandatory.id,
    binding,
    [{
      ...mandatory,
      amountCents: 75_000,
      originalAmountCents: 100_000,
      providerRefundedCents: 25_000,
    }],
    new Map([['re_old', 10_000]]),
  );
  assert.equal(outOfOrder.stale, true);
  assert.equal(outOfOrder.mandatoryUpdate, null);
  assert.deepEqual(outOfOrder.updates, []);

  const completed = reconcile(
    100_000,
    25_000,
    100_000,
    mandatory.id,
    binding,
    [{
      ...mandatory,
      amountCents: 75_000,
      originalAmountCents: 100_000,
      providerRefundedCents: 25_000,
    }],
    new Map([['re_final', 75_000]]),
  );
  assert.deepEqual(completed.mandatoryUpdate, {
    id: mandatory.id,
    status: 'confirmed',
    amountCents: 0,
    originalAmountCents: 100_000,
    providerRefundedCents: 100_000,
    coveredByOtherObligationsCents: 0,
  });
});

test('mandatory and pre-existing owner obligations are reconciled to no more than current net', () => {
  const reconcile = loadRefundReconciliation();
  const mandatoryId = 'campaign__late_payment__reservation';
  const binding = {
    campaignId: 'campaign',
    paymentId: 'reservation',
    reservationId: 'reservation',
  };
  const result = reconcile(
    100_000,
    0,
    25_000,
    mandatoryId,
    binding,
    [
      {
        id: mandatoryId,
        ...binding,
        status: 'requested',
        amountCents: 100_000,
        providerReference: null,
        createdAtMillis: 2,
        requiredCapturedRefund: true,
        originalAmountCents: null,
        providerRefundedCents: null,
      },
      {
        id: 'owner-open',
        ...binding,
        status: 'approved',
        amountCents: 20_000,
        providerReference: null,
        createdAtMillis: 1,
        requiredCapturedRefund: false,
        originalAmountCents: null,
        providerRefundedCents: null,
      },
    ],
    new Map(),
  );
  assert.equal(result.otherActiveCents, 20_000);
  assert.equal(result.mandatoryUpdate.amountCents, 55_000);
  assert.equal(result.mandatoryUpdate.coveredByOtherObligationsCents, 20_000);
  assert.equal(result.otherActiveCents + result.mandatoryUpdate.amountCents, 75_000);

  const oversizedOwner = reconcile(
    100_000,
    0,
    25_000,
    mandatoryId,
    binding,
    [
      {
        id: mandatoryId,
        ...binding,
        status: 'requested',
        amountCents: 100_000,
        providerReference: null,
        createdAtMillis: 2,
        requiredCapturedRefund: true,
        originalAmountCents: null,
        providerRefundedCents: null,
      },
      {
        id: 'owner-open',
        ...binding,
        status: 'submitted',
        amountCents: 100_000,
        providerReference: null,
        createdAtMillis: 1,
        requiredCapturedRefund: false,
        originalAmountCents: null,
        providerRefundedCents: null,
      },
    ],
    new Map(),
  );
  assert.deepEqual(oversizedOwner.updates, [{
    id: 'owner-open',
    status: 'submitted',
    amountCents: 75_000,
    originalAmountCents: 100_000,
    providerRefundedCents: 25_000,
    newlyProviderRefundedCents: 25_000,
  }]);
  assert.equal(oversizedOwner.mandatoryUpdate.status, 'covered');
  assert.equal(oversizedOwner.mandatoryUpdate.amountCents, 0);
});

test('provider refund reconciliation rejects corrupt obligation bindings and statuses', () => {
  const reconcile = loadRefundReconciliation();
  const binding = {
    campaignId: 'campaign',
    paymentId: 'reservation',
    reservationId: 'reservation',
  };
  const candidate = {
    id: 'owner-open',
    ...binding,
    status: 'requested',
    amountCents: 10_000,
    providerReference: null,
    createdAtMillis: 1,
    requiredCapturedRefund: false,
    originalAmountCents: null,
    providerRefundedCents: null,
  };

  assert.throws(
    () => reconcile(
      100_000,
      0,
      25_000,
      'mandatory-refund',
      binding,
      [{ ...candidate, reservationId: 'other-reservation' }],
      new Map(),
    ),
    /refund-obligation-binding-mismatch/,
  );
  assert.throws(
    () => reconcile(
      100_000,
      0,
      25_000,
      'mandatory-refund',
      binding,
      [{ ...candidate, status: 'requested ' }],
      new Map(),
    ),
    /refund-obligation-status-invalid/,
  );
});

test('charge.refunded reconciles local obligations without initiating a provider refund', () => {
  assert.match(webhook, /case 'charge\.refunded'/);
  assert.match(webhook, /applyRefund\(db, event\.data\.object as Stripe\.Charge, event\.id\)/);
  assert.match(webhook, /transaction\.get\(refundQuery\)/);
  assert.match(webhook, /reconcileProviderRefundObligations\(/);
  assert.match(webhook, /coveredByOtherObligationsCents/);
  assert.match(webhook, /confirmed \? 'refund\.confirm' : 'refund\.partial_reconcile'/);
  assert.match(webhook, /refund\.required_balance_reconcile/);
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
  const disputeHandler = webhook.slice(
    webhook.indexOf('async function applyDispute'),
    webhook.indexOf('export async function POST'),
  );
  assert.match(disputeHandler, /transaction\.set\(capturedRefundRef, \{/);
  assert.match(disputeHandler, /requiredFullRefund: true/);
  assert.match(disputeHandler, /ownerRejectable: false/);
  assert.match(disputeHandler, /status: refundAmounts\.amountCents === 0[\s\S]*?requiredCapturedRefundStatus\(capturedRefund\?\.status\)/);
  assert.match(disputeHandler, /providerCaptureReportedAt:/);
  assert.match(disputeHandler, /clearedAt: null/);
  assert.match(disputeHandler, /without initiating a provider refund/);
  assert.doesNotMatch(disputeHandler, /(?:stripe\.)?refunds\.create\(/);
});

test('won dispute after a partial refund records only the balance still needed for a full refund', () => {
  const {
    capturedManualReviewRefundAmounts,
    assertCapturedManualReviewRefundIdentity,
    activeOtherRefundObligationCents,
  } = loadCapturedCheckoutDisposition();
  assert.deepEqual(
    capturedManualReviewRefundAmounts(100_000, 25_000),
    {
      amountCents: 75_000,
      originalAmountCents: 100_000,
      providerRefundedCents: 25_000,
      coveredByOtherObligationsCents: 0,
    },
  );
  assert.deepEqual(
    capturedManualReviewRefundAmounts(100_000, 100_000),
    {
      amountCents: 0,
      originalAmountCents: 100_000,
      providerRefundedCents: 100_000,
      coveredByOtherObligationsCents: 0,
    },
  );
  assert.doesNotThrow(() => assertCapturedManualReviewRefundIdentity(
    {
      campaignId: 'campaign-1',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
      amountCents: 80_000,
      originalAmountCents: 100_000,
      providerRefundedCents: 20_000,
      externalPaymentId: 'pi_1',
    },
    {
      campaignId: 'campaign-1',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
      originalAmountCents: 100_000,
      providerRefundedCents: 25_000,
      externalSessionId: null,
      externalPaymentId: 'pi_1',
    },
  ));
  assert.throws(
    () => capturedManualReviewRefundAmounts(100_000, 25_000, 75_001),
    /captured-manual-review-refund-amount-invalid/,
  );
  assert.throws(
    () => activeOtherRefundObligationCents([
      {
        id: 'bad-owner-refund',
        data: () => ({
          campaignId: 'campaign-1',
          paymentId: 'reservation-1',
          reservationId: 'reservation-1',
          status: 'requested',
          amountCents: -1,
        }),
      },
    ], 'mandatory-refund', {
      campaignId: 'campaign-1',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
    }),
    /refund-obligation-amount-invalid/,
  );
  assert.throws(
    () => activeOtherRefundObligationCents([
      {
        id: 'wrong-reservation-owner-refund',
        data: () => ({
          campaignId: 'campaign-1',
          paymentId: 'reservation-1',
          reservationId: 'reservation-2',
          status: 'requested',
          amountCents: 10_000,
        }),
      },
    ], 'mandatory-refund', {
      campaignId: 'campaign-1',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
    }),
    /refund-obligation-binding-mismatch/,
  );
  assert.throws(
    () => activeOtherRefundObligationCents([
      {
        id: 'bad-status-owner-refund',
        data: () => ({
          campaignId: 'campaign-1',
          paymentId: 'reservation-1',
          reservationId: 'reservation-1',
          status: 'requested ',
          amountCents: 10_000,
        }),
      },
    ], 'mandatory-refund', {
      campaignId: 'campaign-1',
      paymentId: 'reservation-1',
      reservationId: 'reservation-1',
    }),
    /refund-obligation-status-invalid/,
  );

  const disputeHandler = webhook.slice(
    webhook.indexOf('async function applyDispute'),
    webhook.indexOf('export async function POST'),
  );
  assert.match(disputeHandler, /transaction\.get\(refundObligationsQuery\)/);
  assert.match(disputeHandler, /paymentId: currentPaymentSnapshot\.ref\.id/);
  assert.match(disputeHandler, /capturedManualReviewRefundAmounts\(\s*originalAmountCents,\s*refundedCents,\s*coveredByOtherObligationsCents,\s*\)/);
  assert.match(disputeHandler, /transaction\.set\(capturedRefundRef, \{[\s\S]*?\.\.\.refundAmounts,/);
  assert.match(disputeHandler, /lost ownership of its category or placement/);
});

test('terminal closed-dispute replay is a no-op inside the transaction but still resyncs the campaign', () => {
  const { isTerminalClosedDisputeReplay } = loadCapturedCheckoutDisposition();
  const closedWon = {
    disputeId: 'dp_123',
    disputeStatus: 'won',
    disputeOutcome: 'won',
    disputeClosedAt: { seconds: 1 },
  };
  assert.equal(isTerminalClosedDisputeReplay(closedWon, { id: 'dp_123', status: 'won' }, true), true);
  assert.equal(isTerminalClosedDisputeReplay(closedWon, { id: 'dp_other', status: 'won' }, true), false);
  assert.equal(isTerminalClosedDisputeReplay(closedWon, { id: 'dp_123', status: 'lost' }, true), false);
  assert.equal(isTerminalClosedDisputeReplay(closedWon, { id: 'dp_123', status: 'won' }, false), false);
  assert.equal(isTerminalClosedDisputeReplay(
    { ...closedWon, disputeClosedAt: null },
    { id: 'dp_123', status: 'won' },
    true,
  ), false);

  const disputeHandler = webhook.slice(
    webhook.indexOf('async function applyDispute'),
    webhook.indexOf('export async function POST'),
  );
  const replayGuardIndex = disputeHandler.indexOf('if (isTerminalClosedDisputeReplay(currentPayment, dispute, closed)) return;');
  const inventoryReadIndex = disputeHandler.indexOf('const claimRefs = reservationClaimSlugs(reservation)');
  assert.ok(replayGuardIndex >= 0, 'closed-dispute terminal replay guard must remain present');
  assert.ok(
    replayGuardIndex < inventoryReadIndex,
    'closed-dispute replay must return before inventory or tracking mutations are prepared',
  );
  assert.match(disputeHandler, /return String\(payment\.campaignId\)/);
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
