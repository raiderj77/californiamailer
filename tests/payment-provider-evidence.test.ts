import assert from 'node:assert/strict';
import test from 'node:test';
import { paymentDocumentsWithProviderCollisions } from '../src/lib/paymentProviderEvidence';

type CollisionLoader = typeof paymentDocumentsWithProviderCollisions;
type CollisionTransaction = Parameters<CollisionLoader>[0];
type CollisionFirestore = Parameters<CollisionLoader>[1];
type PaymentDocuments = Parameters<CollisionLoader>[2];

function paymentDocument(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

test('provider collision loading fails before querying when a source ID is noncanonical', async () => {
  const invalidSources = [
    { externalPaymentId: '' },
    { externalPaymentId: ' pi_1' },
    { externalPaymentId: 'pi_1 ' },
    { externalPaymentId: 'pi bad' },
    { externalPaymentId: 'pi_1\u0000' },
    { externalPaymentId: 'pi_1', externalSessionId: ' cs_1' },
    { externalPaymentId: 'pi_1', externalCheckoutSessionId: 'cs_1\n' },
  ];

  for (const source of invalidSources) {
    let queryCount = 0;
    const transaction = {
      get: async () => {
        queryCount += 1;
        throw new Error('query-should-not-run');
      },
    } as unknown as CollisionTransaction;
    const db = {
      collection: () => {
        queryCount += 1;
        throw new Error('query-should-not-be-built');
      },
    } as unknown as CollisionFirestore;
    const documents = [
      paymentDocument('current-a', { externalPaymentId: 'pi_canonical' }),
      paymentDocument('current-b', source),
    ] as unknown as PaymentDocuments;

    await assert.rejects(
      paymentDocumentsWithProviderCollisions(transaction, db, documents),
      /payment-provider-evidence-noncanonical-id/,
      JSON.stringify(source),
    );
    assert.equal(queryCount, 0, JSON.stringify(source));
  }
});

test('provider collision loading rejects contradictory exact session aliases before querying', async () => {
  let queryCount = 0;
  const transaction = {
    get: async () => {
      queryCount += 1;
      throw new Error('query-should-not-run');
    },
  } as unknown as CollisionTransaction;
  const db = {
    collection: () => {
      queryCount += 1;
      throw new Error('query-should-not-be-built');
    },
  } as unknown as CollisionFirestore;
  const documents = [paymentDocument('current-a', {
    externalPaymentId: 'pi_1',
    externalSessionId: 'cs_one',
    externalCheckoutSessionId: 'cs_two',
  })] as unknown as PaymentDocuments;

  await assert.rejects(
    paymentDocumentsWithProviderCollisions(transaction, db, documents),
    /payment-provider-evidence-session-alias-mismatch/,
  );
  assert.equal(queryCount, 0);
});

test('provider collision loading queries exact canonical values across both session aliases', async () => {
  const queries: Array<{ field: string; values: string[] }> = [];
  const db = {
    collection: () => ({
      where: (field: string, _operator: string, values: string[]) => {
        queries.push({ field, values });
        return { limit: () => ({ field, values }) };
      },
      limit: (limit: number) => ({ global: true, limit }),
    }),
  } as unknown as CollisionFirestore;
  const transaction = {
    get: async () => ({ size: 0, docs: [] }),
  } as unknown as CollisionTransaction;
  const current = paymentDocument('current-a', {
    externalPaymentId: 'pi_exact',
    externalSessionId: 'cs_exact',
    externalCheckoutSessionId: 'cs_exact',
  });

  const result = await paymentDocumentsWithProviderCollisions(
    transaction,
    db,
    [current] as unknown as PaymentDocuments,
  );

  assert.deepEqual(queries, [
    { field: 'externalPaymentId', values: ['pi_exact'] },
    { field: 'externalSessionId', values: ['cs_exact'] },
    { field: 'externalCheckoutSessionId', values: ['cs_exact'] },
    { field: 'reservationId', values: ['current-a'] },
  ]);
  assert.deepEqual(result, [current]);
});

test('provider collision loading includes reservation-linked ledgers with unrelated provider evidence', async () => {
  const current = paymentDocument('reservation-1', {
    reservationId: 'reservation-1',
    campaignId: 'current-campaign',
    externalPaymentId: 'pi_current',
  });
  const hiddenLinkedLedger = paymentDocument('noncanonical-document-id', {
    reservationId: 'reservation-1',
    externalPaymentId: 'pi_unrelated',
  });
  const db = {
    collection: () => ({
      where: (field: string, _operator: string, values: string[]) => ({
        limit: () => ({ field, values }),
      }),
      limit: (limit: number) => ({ global: true, limit }),
    }),
  } as unknown as CollisionFirestore;
  const transaction = {
    get: async (query: { field: string; values: string[] }) => (
      query.field === 'reservationId' && query.values.includes('reservation-1')
        ? { size: 1, docs: [hiddenLinkedLedger] }
        : { size: 0, docs: [] }
    ),
  } as unknown as CollisionTransaction;

  const result = await paymentDocumentsWithProviderCollisions(
    transaction,
    db,
    [current] as unknown as PaymentDocuments,
  );

  assert.deepEqual(result, [current, hiddenLinkedLedger]);
});

test('reservation-linked provider evidence saturation fails closed', async () => {
  const current = paymentDocument('reservation-1', {
    reservationId: 'reservation-1',
    campaignId: 'current-campaign',
    externalPaymentId: 'pi_current',
  });
  const db = {
    collection: () => ({
      where: (field: string, _operator: string, values: string[]) => ({
        limit: () => ({ field, values }),
      }),
      limit: (limit: number) => ({ global: true, limit }),
    }),
  } as unknown as CollisionFirestore;
  const transaction = {
    get: async (query: { field: string }) => (
      query.field === 'reservationId'
        ? { size: 101, docs: [] }
        : { size: 0, docs: [] }
    ),
  } as unknown as CollisionTransaction;

  await assert.rejects(
    paymentDocumentsWithProviderCollisions(
      transaction,
      db,
      [current] as unknown as PaymentDocuments,
    ),
    /payment-provider-evidence-result-limit/,
  );
});

test('noncanonical source reservation IDs fail before evidence queries', async () => {
  let queryCount = 0;
  const current = paymentDocument('reservation-1', {
    reservationId: ' reservation-1 ',
    campaignId: 'current-campaign',
    externalPaymentId: 'pi_current',
  });
  const transaction = {
    get: async () => {
      queryCount += 1;
      return { size: 0, docs: [] };
    },
  } as unknown as CollisionTransaction;
  const db = {
    collection: () => {
      queryCount += 1;
      throw new Error('query-should-not-be-built');
    },
  } as unknown as CollisionFirestore;

  await assert.rejects(
    paymentDocumentsWithProviderCollisions(
      transaction,
      db,
      [current] as unknown as PaymentDocuments,
    ),
    /payment-provider-evidence-noncanonical-reservation-id/,
  );
  assert.equal(queryCount, 0);
});

test('bounded global scan rejects unrelated-reservation whitespace and control provider twins', async () => {
  const collisionMutations = [
    {
      externalPaymentId: ' pi_current ',
      externalSessionId: 'cs_other',
    },
    {
      externalPaymentId: 'pi_other',
      externalCheckoutSessionId: ' cs_current ',
    },
    {
      externalPaymentId: 'pi_\u0000current',
      externalSessionId: 'cs_other',
    },
  ];

  for (const collision of collisionMutations) {
    let globalLimit = 0;
    const current = paymentDocument('reservation-current', {
      reservationId: 'reservation-current',
      campaignId: 'current-campaign',
      externalPaymentId: 'pi_current',
      externalSessionId: 'cs_current',
    });
    const crossCampaignCollision = paymentDocument('reservation-foreign', {
      reservationId: 'reservation-foreign',
      campaignId: 'foreign-campaign',
      ...collision,
    });
    const db = {
      collection: () => ({
        where: (field: string, _operator: string, values: string[]) => ({
          limit: () => ({ field, values }),
        }),
        limit: (limit: number) => {
          globalLimit = limit;
          return { global: true, limit };
        },
      }),
    } as unknown as CollisionFirestore;
    const transaction = {
      get: async (query: { global?: boolean }) => (
        query.global
          ? { size: 2, docs: [current, crossCampaignCollision] }
          : { size: 0, docs: [] }
      ),
    } as unknown as CollisionTransaction;

    await assert.rejects(
      paymentDocumentsWithProviderCollisions(
        transaction,
        db,
        [current] as unknown as PaymentDocuments,
      ),
      /payment-provider-evidence-noncanonical-global-collision/,
      JSON.stringify(collision),
    );
    assert.equal(globalLimit, 101, JSON.stringify(collision));
  }
});

test('bounded global scan ignores valid provider evidence unrelated to the current campaign', async () => {
  const current = paymentDocument('reservation-current', {
    reservationId: 'reservation-current',
    campaignId: 'current-campaign',
    externalPaymentId: 'pi_current',
    externalSessionId: 'cs_current',
  });
  const unrelated = paymentDocument('reservation-foreign', {
    reservationId: 'reservation-foreign',
    campaignId: 'foreign-campaign',
    externalPaymentId: 'pi_foreign',
    externalSessionId: 'cs_foreign',
  });
  const db = {
    collection: () => ({
      where: (field: string, _operator: string, values: string[]) => ({
        limit: () => ({ field, values }),
      }),
      limit: (limit: number) => ({ global: true, limit }),
    }),
  } as unknown as CollisionFirestore;
  const transaction = {
    get: async (query: { global?: boolean }) => (
      query.global
        ? { size: 2, docs: [current, unrelated] }
        : { size: 0, docs: [] }
    ),
  } as unknown as CollisionTransaction;

  const result = await paymentDocumentsWithProviderCollisions(
    transaction,
    db,
    [current] as unknown as PaymentDocuments,
  );
  assert.deepEqual(result, [current]);
});

test('bounded global provider scan saturation fails closed', async () => {
  const current = paymentDocument('reservation-current', {
    reservationId: 'reservation-current',
    campaignId: 'current-campaign',
    externalPaymentId: 'pi_current',
    externalSessionId: 'cs_current',
  });
  const db = {
    collection: () => ({
      where: (field: string, _operator: string, values: string[]) => ({
        limit: () => ({ field, values }),
      }),
      limit: (limit: number) => ({ global: true, limit }),
    }),
  } as unknown as CollisionFirestore;
  const transaction = {
    get: async (query: { global?: boolean }) => (
      query.global
        ? { size: 101, docs: [] }
        : { size: 0, docs: [] }
    ),
  } as unknown as CollisionTransaction;

  await assert.rejects(
    paymentDocumentsWithProviderCollisions(
      transaction,
      db,
      [current] as unknown as PaymentDocuments,
    ),
    /payment-provider-evidence-global-limit/,
  );
});
