import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  strictPaymentRefundLedger,
  type PaymentLedgerDocument,
} from '../src/lib/paymentLedgerIntegrity';

const CAMPAIGN_ID = 'founding-shared-mailer-2026';

function ledgerDocument(
  id: string,
  data: Record<string, unknown>,
): PaymentLedgerDocument {
  return { id, data: () => data };
}

function payment(overrides: Record<string, unknown> = {}): PaymentLedgerDocument {
  return ledgerDocument('reservation-1', {
    campaignId: CAMPAIGN_ID,
    reservationId: 'reservation-1',
    status: 'cleared',
    amountCents: 1_000,
    refundedCents: 0,
    ...overrides,
  });
}

function refund(
  id: string,
  overrides: Record<string, unknown> = {},
): PaymentLedgerDocument {
  return ledgerDocument(id, {
    campaignId: CAMPAIGN_ID,
    paymentId: 'reservation-1',
    reservationId: 'reservation-1',
    status: 'requested',
    amountCents: 250,
    ...overrides,
  });
}

function assertLedgerInvalid(
  payments: PaymentLedgerDocument[],
  refunds: PaymentLedgerDocument[] = [],
): void {
  assert.throws(
    () => strictPaymentRefundLedger(payments, refunds, CAMPAIGN_ID),
    /payment-refund-ledger-invalid/,
  );
}

test('strict payment/refund ledger returns exact safe net and active coverage', () => {
  const ledger = strictPaymentRefundLedger(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [
      refund('owner-request', { amountCents: 250 }),
      refund('confirmed-provider', {
        status: 'confirmed',
        amountCents: 0,
        originalAmountCents: 100,
        providerRefundedCents: 100,
      }),
    ],
    CAMPAIGN_ID,
  );

  assert.equal(ledger.paymentsById.get('reservation-1')?.netCents, 900);
  assert.equal(ledger.clearedNetCents, 900);
  assert.equal(ledger.activeRefundCount, 1);
  assert.equal(ledger.activeRefundCents, 250);
  assert.equal(ledger.activeRefundCentsByPayment.get('reservation-1'), 250);
});

test('payment ledger rejects zero, negative, NaN, fractional, and over-refunded amounts', () => {
  for (const corrupt of [
    { amountCents: 0 },
    { amountCents: -1 },
    { amountCents: Number.NaN },
    { amountCents: 1.5 },
    { refundedCents: -1 },
    { refundedCents: Number.NaN },
    { refundedCents: 1.5 },
    { refundedCents: 1_001 },
  ]) assertLedgerInvalid([payment(corrupt)]);
});

test('payment status and refund arithmetic must agree before cancellation can close', () => {
  for (const corrupt of [
    { status: 'cleared', refundedCents: 1 },
    { status: 'partially_refunded', refundedCents: 0 },
    { status: 'partially_refunded', refundedCents: 1_000 },
    { status: 'refunded', refundedCents: 999 },
    { status: 'failed', refundedCents: 1 },
    { status: 'unknown', refundedCents: 0 },
  ]) assertLedgerInvalid([payment(corrupt)]);

  const closedLedger = strictPaymentRefundLedger(
    [payment({ status: 'refunded', refundedCents: 1_000 })],
    [refund('confirmed', {
      status: 'confirmed',
      amountCents: 0,
      originalAmountCents: 1_000,
      providerRefundedCents: 1_000,
    })],
    CAMPAIGN_ID,
  );
  assert.equal(closedLedger.clearedNetCents, 0);
  assert.equal(closedLedger.activeRefundCount, 0);
});

test('active refund coverage rejects zero, negative, NaN, overflow, and offsetting corruption', () => {
  for (const corruptAmount of [0, -1, Number.NaN, 1.5, 1_001]) {
    assertLedgerInvalid([payment()], [refund('corrupt', { amountCents: corruptAmount })]);
  }
  assertLedgerInvalid(
    [payment()],
    [
      refund('positive', { amountCents: 250 }),
      refund('negative', { amountCents: -250 }),
    ],
  );
  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 750 })],
    [
      refund('one', { amountCents: 200 }),
      refund('two', { amountCents: 100 }),
    ],
  );
});

test('refund coverage must bind to an exact campaign payment, reservation, and known status', () => {
  for (const corrupt of [
    { campaignId: 'another-campaign' },
    { paymentId: 'another-payment' },
    { reservationId: 'another-reservation' },
    { reservationId: ' reservation-1 ' },
    { status: 'unknown' },
    { status: 'covered', amountCents: 1 },
  ]) assertLedgerInvalid([payment()], [refund('corrupt', corrupt)]);

  assertLedgerInvalid(
    [payment({ status: 'failed' })],
    [refund('impossible-active-refund')],
  );
});

test('terminal provider evidence must exactly reconcile cumulative payment refunds', () => {
  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [refund('zero-evidence', { status: 'confirmed', amountCents: 0 })],
  );

  const valid = strictPaymentRefundLedger(
    [payment({ status: 'partially_refunded', refundedCents: 150 })],
    [
      refund('confirmed-first', {
        status: 'confirmed',
        amountCents: 0,
        originalAmountCents: 100,
        providerRefundedCents: 100,
      }),
      refund('partially-reconciled', {
        status: 'submitted',
        amountCents: 50,
        originalAmountCents: 100,
        providerRefundedCents: 50,
      }),
    ],
    CAMPAIGN_ID,
  );
  assert.equal(valid.activeRefundCents, 50);

  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 150 })],
    [refund('undercounted', {
      status: 'confirmed',
      amountCents: 0,
      originalAmountCents: 100,
      providerRefundedCents: 100,
    })],
  );
  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [
      refund('duplicate-one', {
        status: 'confirmed',
        amountCents: 0,
        originalAmountCents: 100,
        providerRefundedCents: 100,
      }),
      refund('duplicate-two', {
        status: 'confirmed',
        amountCents: 0,
        originalAmountCents: 100,
        providerRefundedCents: 100,
      }),
    ],
  );
});

test('covered aggregate obligations recompute exact active sibling coverage', () => {
  const ownerObligation = refund('owner-open', { amountCents: 900 });
  const coveredAggregate = refund('captured-required', {
    status: 'covered',
    amountCents: 0,
    source: 'captured_manual_review_webhook',
    requiredFullRefund: true,
    originalAmountCents: 1_000,
    providerRefundedCents: 100,
    coveredByOtherObligationsCents: 900,
  });
  assert.doesNotThrow(() => strictPaymentRefundLedger(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [ownerObligation, coveredAggregate],
    CAMPAIGN_ID,
  ));

  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [ownerObligation, refund('self-declared-coverage', {
      status: 'covered',
      amountCents: 0,
      source: 'captured_manual_review_webhook',
      requiredFullRefund: true,
      originalAmountCents: 1_000,
      providerRefundedCents: 100,
      coveredByOtherObligationsCents: 800,
    })],
  );
  assertLedgerInvalid(
    [payment({ status: 'partially_refunded', refundedCents: 100 })],
    [ownerObligation, coveredAggregate, refund('second-aggregate', {
      status: 'covered',
      amountCents: 0,
      source: 'late_payment_webhook',
      requiredFullRefund: true,
      originalAmountCents: 1_000,
      providerRefundedCents: 100,
      coveredByOtherObligationsCents: 900,
    })],
  );
});

test('mandatory refund sources cannot be locally rejected', () => {
  for (const source of [
    'captured_manual_review_webhook',
    'late_payment_webhook',
    'campaign_cancellation',
  ]) {
    assertLedgerInvalid([payment()], [refund(`rejected-${source}`, {
      status: 'rejected',
      amountCents: 100,
      source,
    })]);
  }
  assertLedgerInvalid([payment()], [refund('rejected-required', {
    status: 'rejected',
    amountCents: 100,
    requiredFullRefund: true,
  })]);
});

test('payment documents must use the canonical reservation id and cannot duplicate reservations', () => {
  assertLedgerInvalid([
    ledgerDocument('noncanonical-payment', {
      campaignId: CAMPAIGN_ID,
      reservationId: 'reservation-1',
      status: 'cleared',
      amountCents: 1_000,
      refundedCents: 0,
    }),
  ]);
  assertLedgerInvalid([
    payment(),
    ledgerDocument('payment-copy', {
      campaignId: CAMPAIGN_ID,
      reservationId: 'reservation-1',
      status: 'cleared',
      amountCents: 1_000,
      refundedCents: 0,
    }),
  ]);
});

test('refund creation, cancellation, and cancellation close validate the strict ledger before writes', () => {
  const refundsRoute = readFileSync(
    new URL('../src/app/api/admin/refunds/route.ts', import.meta.url),
    'utf8',
  );
  const campaignRoute = readFileSync(
    new URL('../src/app/api/admin/campaigns/founding/route.ts', import.meta.url),
    'utf8',
  );
  const refundRequest = refundsRoute.slice(
    refundsRoute.indexOf("if (parsed.data.action === 'request')"),
    refundsRoute.indexOf('const reviewAction = parsed.data'),
  );
  const refundReview = refundsRoute.slice(
    refundsRoute.indexOf('const reviewAction = parsed.data'),
  );
  const cancellation = campaignRoute.slice(
    campaignRoute.indexOf("if (parsed.data.action === 'cancel_campaign')"),
    campaignRoute.indexOf("if (parsed.data.action === 'close_cancelled')"),
  );
  const closeCancellation = campaignRoute.slice(
    campaignRoute.indexOf("if (parsed.data.action === 'close_cancelled')"),
    campaignRoute.indexOf('const unpublished = await db.runTransaction'),
  );

  assert.ok(
    refundRequest.indexOf('strictPaymentRefundLedger(')
      < refundRequest.indexOf('transaction.create(refundRef'),
  );
  assert.ok(
    cancellation.indexOf('strictPaymentRefundLedger(')
      < cancellation.indexOf('transaction.create(db.collection(\'refunds\')'),
  );
  assert.ok(
    closeCancellation.indexOf('strictPaymentRefundLedger(')
      < closeCancellation.indexOf('transaction.update(campaignRef'),
  );
  assert.match(refundsRoute, /authoritativeActiveRefundObligationSummary\(/);
  assert.match(refundsRoute, /ledgerIntegrity:/);
  assert.match(refundsRoute, /\|\| strictLedger === null/);
  assert.ok(
    refundReview.indexOf('strictPaymentRefundLedger(')
      < refundReview.indexOf("if (reviewAction.action === 'approve')"),
  );
  assert.doesNotMatch(refundRequest, /Number\(data\.amountCents|Number\(data\.refundedCents/);
  assert.doesNotMatch(cancellation, /Number\(document\.data\(\)\.amountCents/);
  assert.doesNotMatch(closeCancellation, /Math\.max\(0, Number\(data\.amountCents/);
});
