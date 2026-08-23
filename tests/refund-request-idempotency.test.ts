import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  isExactOwnerRefundRequestReplay,
  ownerRefundRequestDocumentId,
} from '../src/lib/refundRequestIdempotency';

const identity = {
  ownerUid: 'owner-uid-1',
  paymentId: 'payment-record-1',
  requestId: '205f9dc8-6c19-4ca0-81cd-e288579b88e4',
};

const expectedReplay = {
  ...identity,
  campaignId: 'campaign-1',
  reservationId: 'reservation-1',
  amountCents: 2_500,
  reason: 'Customer requested cancellation.',
};

function refundData(overrides: Record<string, unknown> = {}) {
  return {
    campaignId: expectedReplay.campaignId,
    paymentId: expectedReplay.paymentId,
    reservationId: expectedReplay.reservationId,
    amountCents: expectedReplay.amountCents,
    reason: expectedReplay.reason,
    status: 'requested',
    source: 'owner_request',
    requiredFullRefund: false,
    ownerRejectable: true,
    requestedBy: expectedReplay.ownerUid,
    requestId: expectedReplay.requestId,
    ...overrides,
  };
}

test('owner refund request IDs are deterministic and scoped to owner, payment, and request', () => {
  const first = ownerRefundRequestDocumentId(identity);
  assert.equal(first, ownerRefundRequestDocumentId(identity));
  assert.match(first, /^owner_request__[a-f0-9]{64}$/);
  assert.notEqual(first, ownerRefundRequestDocumentId({ ...identity, ownerUid: 'owner-uid-2' }));
  assert.notEqual(first, ownerRefundRequestDocumentId({ ...identity, paymentId: 'payment-record-2' }));
  assert.notEqual(first, ownerRefundRequestDocumentId({
    ...identity,
    requestId: 'c85d0f57-b2d4-4894-ab47-8228809f09e8',
  }));
});

test('owner refund request IDs reject missing, noncanonical, and out-of-bounds values', () => {
  for (const requestId of ['', 'short', ' 205f9dc8-6c19-4ca0-81cd-e288579b88e4', 'x'.repeat(101), 'invalid.request.id']) {
    assert.throws(
      () => ownerRefundRequestDocumentId({ ...identity, requestId }),
      /refund-request-id-invalid/,
    );
  }
});

test('only an exact immutable owner refund request payload is an idempotent replay', () => {
  assert.equal(isExactOwnerRefundRequestReplay(refundData(), expectedReplay), true);
  assert.equal(
    isExactOwnerRefundRequestReplay(refundData({ status: 'approved' }), expectedReplay),
    true,
    'a later workflow status does not change the immutable creation result',
  );
  for (const changed of [
    { campaignId: 'campaign-2' },
    { paymentId: 'payment-record-2' },
    { reservationId: 'reservation-2' },
    { amountCents: 2_501 },
    { reason: 'Changed reason.' },
    { source: 'campaign_cancellation' },
    { requiredFullRefund: true },
    { ownerRejectable: false },
    { requestedBy: 'owner-uid-2' },
    { requestId: 'c85d0f57-b2d4-4894-ab47-8228809f09e8' },
  ]) {
    assert.equal(isExactOwnerRefundRequestReplay(refundData(changed), expectedReplay), false);
  }
  assert.equal(isExactOwnerRefundRequestReplay(undefined, expectedReplay), false);
});

test('refund route validates exact reservation bindings and replays before creating once', () => {
  const route = readFileSync(
    new URL('../src/app/api/admin/refunds/route.ts', import.meta.url),
    'utf8',
  );
  const requestBlock = route.slice(
    route.indexOf("if (parsed.data.action === 'request')"),
    route.indexOf('const reviewAction = parsed.data'),
  );
  const reviewBlock = route.slice(route.indexOf('const reviewAction = parsed.data'));

  assert.match(requestBlock, /ownerRefundRequestDocumentId\(\{/);
  assert.match(requestBlock, /db\.collection\('refunds'\)\.doc\(refundId\)/);
  assert.match(requestBlock, /transaction\.get\(refundRef\)/);
  assert.match(requestBlock, /transaction\.get\(reservationRef\)/);
  assert.match(requestBlock, /reservationData\.campaignId !== FOUNDING_CAMPAIGN\.id/);
  assert.match(requestBlock, /isExactOwnerRefundRequestReplay\(existingRefund\.data\(\), expectedReplay\)/);
  assert.ok(
    requestBlock.indexOf('if (existingRefund.exists)')
      < requestBlock.indexOf('transaction.create(refundRef'),
  );
  assert.match(requestBlock, /requestId: refundRequest\.requestId/);

  assert.match(reviewBlock, /transaction\.get\(linkedPaymentRef\)/);
  assert.match(reviewBlock, /transaction\.get\(linkedReservationRef\)/);
  assert.match(reviewBlock, /linkedPaymentData\.reservationId !== linkedReservationId/);
  assert.match(reviewBlock, /linkedReservationData\.campaignId !== FOUNDING_CAMPAIGN\.id/);
  const bindingValidation = reviewBlock.indexOf("throw new Error('refund-binding-invalid')");
  assert.ok(bindingValidation >= 0);
  for (const mutation of [
    "if (reviewAction.action === 'approve')",
    "} else if (reviewAction.action === 'reject')",
    'transaction.update(refundRef, { status: \'submitted\'',
  ]) {
    assert.ok(bindingValidation < reviewBlock.indexOf(mutation));
  }
});

test('refund review UI persists one request ID across response-loss retries', () => {
  const page = readFileSync(
    new URL('../src/app/(dashboard)/refunds/page.tsx', import.meta.url),
    'utf8',
  );
  assert.match(page, /window\.localStorage\.getItem\(storageKey\)/);
  assert.match(page, /crypto\.randomUUID\(\)/);
  assert.match(page, /window\.localStorage\.setItem\(storageKey, requestId\)/);
  assert.match(page, /requestId: pendingRefundRequestId\(payment\.id\)/);
  assert.match(page, /window\.localStorage\.removeItem\(/);
  const action = page.slice(page.indexOf('async function act('), page.indexOf('if (loading)'));
  assert.ok(
    action.indexOf("if (!response.ok) throw")
      < action.indexOf("if (payload.action === 'request')"),
    'the pending key is cleared only after a successful response',
  );
});
