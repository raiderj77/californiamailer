import assert from 'node:assert/strict';
import test from 'node:test';
import {
  authoritativeActiveRefundObligationSummary,
  refundDocumentsWithLinkedEvidence,
  type RefundEvidenceSourceDocument,
} from '../src/lib/refundEvidence';

const CAMPAIGN_ID = 'founding-shared-mailer-2026';

function document(
  id: string,
  data: Record<string, unknown>,
): RefundEvidenceSourceDocument {
  return { id, data: () => data };
}

class FakeQuery {
  constructor(
    readonly documents: RefundEvidenceSourceDocument[],
    readonly field: string,
    readonly operator: string,
    readonly values: string | string[],
    readonly resultLimit = Number.POSITIVE_INFINITY,
  ) {}

  limit(value: number) {
    return new FakeQuery(
      this.documents,
      this.field,
      this.operator,
      this.values,
      value,
    );
  }
}

function fakeFirestore(refunds: RefundEvidenceSourceDocument[]) {
  return {
    collection(name: string) {
      assert.equal(name, 'refunds');
      return {
        where(field: string, operator: string, values: string | string[]) {
          return new FakeQuery(refunds, field, operator, values);
        },
        limit(value: number) {
          return new FakeQuery(refunds, '', 'all', [], value);
        },
      };
    },
  };
}

const fakeTransaction = {
  async get(query: FakeQuery) {
    const matching = query.documents.filter((candidate) => {
      if (query.operator === 'all') return true;
      const value = candidate.data()[query.field];
      return query.operator === '=='
        ? value === query.values
        : Array.isArray(query.values) && query.values.includes(String(value));
    }).slice(0, query.resultLimit);
    return { docs: matching, size: matching.length };
  },
};

function sources() {
  const reservation = document('reservation-1', { campaignId: CAMPAIGN_ID });
  const payment = document('reservation-1', {
    campaignId: CAMPAIGN_ID,
    reservationId: reservation.id,
  });
  return { payment, reservation };
}

test('global and linked refund queries retain wrong, missing, and wholly orphaned active evidence', async () => {
  const { payment, reservation } = sources();
  const refunds = [
    document('valid', {
      campaignId: CAMPAIGN_ID,
      paymentId: payment.id,
      reservationId: reservation.id,
      status: 'requested',
      amountCents: 100,
    }),
    document('wrong-campaign-linked', {
      campaignId: 'wrong-campaign',
      paymentId: payment.id,
      reservationId: reservation.id,
      status: 'approved',
      amountCents: 100,
    }),
    document('missing-campaign-linked', {
      paymentId: payment.id,
      reservationId: reservation.id,
      status: 'submitted',
      amountCents: 100,
    }),
    document('global-orphan', {
      campaignId: 'wrong-campaign',
      paymentId: 'missing-payment',
      reservationId: 'missing-reservation',
      status: 'requested',
      amountCents: 100,
    }),
    document('unknown-status', {
      campaignId: CAMPAIGN_ID,
      paymentId: payment.id,
      reservationId: reservation.id,
      status: 'requestd',
      amountCents: 100,
    }),
    document('wholly-unbound-unknown-status', {
      campaignId: 'wrong-campaign',
      paymentId: 'missing-payment',
      reservationId: 'missing-reservation',
      status: 'requested ',
      amountCents: 100,
    }),
  ];

  const evidence = await refundDocumentsWithLinkedEvidence(
    fakeTransaction as never,
    fakeFirestore(refunds) as never,
    CAMPAIGN_ID,
    [payment],
    [reservation],
  );
  assert.deepEqual(evidence.map((item) => item.id).sort(), [
    'global-orphan',
    'missing-campaign-linked',
    'unknown-status',
    'valid',
    'wholly-unbound-unknown-status',
    'wrong-campaign-linked',
  ]);
  const summary = authoritativeActiveRefundObligationSummary(
    evidence,
    [payment],
    [reservation],
    CAMPAIGN_ID,
  );
  assert.equal(summary.activeCount, 4);
  assert.ok(summary.integrityIssueCount >= 5);
});

test('global all-refund query saturation fails closed', async () => {
  const { payment, reservation } = sources();
  const refunds = Array.from({ length: 101 }, (_, index) => document(`orphan-${index}`, {
    campaignId: `wrong-campaign-${index}`,
    paymentId: `missing-payment-${index}`,
    reservationId: `missing-reservation-${index}`,
    status: 'requested',
    amountCents: 100,
  }));

  await assert.rejects(
    refundDocumentsWithLinkedEvidence(
      fakeTransaction as never,
      fakeFirestore(refunds) as never,
      CAMPAIGN_ID,
      [payment],
      [reservation],
    ),
    /refund-evidence-result-limit/,
  );
});
