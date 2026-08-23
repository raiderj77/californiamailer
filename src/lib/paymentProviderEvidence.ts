import type {
  DocumentData,
  Firestore,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import {
  canonicalPaymentProviderIdentifier,
  paymentProviderIdentifierCollisionCandidate,
  paymentProviderIdentifierEvidence,
} from '@/lib/businessRules';

const PROVIDER_ID_QUERY_CHUNK_SIZE = 10;
const PROVIDER_EVIDENCE_SOURCE_LIMIT = 50;
const PROVIDER_EVIDENCE_RESULT_LIMIT = 100;

type PaymentDocument = QueryDocumentSnapshot<DocumentData>;

function chunks(values: string[]): string[][] {
  const result: string[][] = [];
  for (let index = 0; index < values.length; index += PROVIDER_ID_QUERY_CHUNK_SIZE) {
    result.push(values.slice(index, index + PROVIDER_ID_QUERY_CHUNK_SIZE));
  }
  return result;
}

function providerValues(documents: PaymentDocument[]): {
  paymentIntentIds: string[];
  checkoutSessionIds: string[];
  reservationIds: string[];
} {
  const paymentIntentIds = new Set<string>();
  const checkoutSessionIds = new Set<string>();
  const reservationIds = new Set<string>();
  for (const document of documents) {
    const data = document.data();
    const identifiers = paymentProviderIdentifierEvidence(data);
    if (
      identifiers.externalPaymentIdNoncanonical
      || identifiers.checkoutSessionIdNoncanonical
    ) {
      throw new Error('payment-provider-evidence-noncanonical-id');
    }
    if (identifiers.checkoutSessionAliasMismatch) {
      throw new Error('payment-provider-evidence-session-alias-mismatch');
    }
    if (identifiers.externalPaymentId) paymentIntentIds.add(identifiers.externalPaymentId);
    for (const value of identifiers.checkoutSessionIds) checkoutSessionIds.add(value);
    const canonicalDocumentId = canonicalPaymentProviderIdentifier(document.id);
    if (!canonicalDocumentId) {
      throw new Error('payment-provider-evidence-noncanonical-reservation-id');
    }
    reservationIds.add(canonicalDocumentId);
    if (data.reservationId !== undefined && data.reservationId !== null) {
      const canonicalReservationId = canonicalPaymentProviderIdentifier(data.reservationId);
      if (!canonicalReservationId) {
        throw new Error('payment-provider-evidence-noncanonical-reservation-id');
      }
      reservationIds.add(canonicalReservationId);
    }
  }
  return {
    paymentIntentIds: [...paymentIntentIds].sort(),
    checkoutSessionIds: [...checkoutSessionIds].sort(),
    reservationIds: [...reservationIds].sort(),
  };
}

function overlaps(left: string[], right: Set<string>): boolean {
  return left.some((value) => right.has(value));
}

function globalPaymentRelevance(
  document: PaymentDocument,
  currentDocumentIds: Set<string>,
  currentPaymentIntentIds: Set<string>,
  currentCheckoutSessionIds: Set<string>,
  currentReservationIds: Set<string>,
): { relevant: boolean; noncanonical: boolean } {
  const data = document.data();
  const identifiers = paymentProviderIdentifierEvidence(data);
  const reservationCandidate = paymentProviderIdentifierCollisionCandidate(data.reservationId);
  const relevant = currentDocumentIds.has(document.id) || Boolean(
    (identifiers.externalPaymentIdCollisionCandidate
      && currentPaymentIntentIds.has(identifiers.externalPaymentIdCollisionCandidate))
    || overlaps(
      identifiers.checkoutSessionIdCollisionCandidates,
      currentCheckoutSessionIds,
    )
    || (reservationCandidate && currentReservationIds.has(reservationCandidate)),
  );
  const reservationIdPresent = data.reservationId !== undefined && data.reservationId !== null;
  const reservationIdNoncanonical = reservationIdPresent
    && canonicalPaymentProviderIdentifier(data.reservationId) === null;
  return {
    relevant,
    noncanonical: relevant && (
      identifiers.externalPaymentIdNoncanonical
      || identifiers.checkoutSessionIdNoncanonical
      || identifiers.checkoutSessionAliasMismatch
      || reservationIdNoncanonical
    ),
  };
}

export async function paymentDocumentsWithProviderCollisions(
  transaction: Transaction,
  db: Firestore,
  currentCampaignDocuments: PaymentDocument[],
): Promise<PaymentDocument[]> {
  if (currentCampaignDocuments.length > PROVIDER_EVIDENCE_SOURCE_LIMIT) {
    throw new Error('payment-provider-evidence-source-limit');
  }
  const {
    paymentIntentIds,
    checkoutSessionIds,
    reservationIds,
  } = providerValues(currentCampaignDocuments);
  const querySpecs = [
    ...chunks(paymentIntentIds).map((values) => ({ field: 'externalPaymentId', values })),
    ...chunks(checkoutSessionIds).flatMap((values) => [
      { field: 'externalSessionId', values },
      { field: 'externalCheckoutSessionId', values },
    ]),
    ...chunks(reservationIds).map((values) => ({ field: 'reservationId', values })),
  ];
  const [snapshots, globalSnapshot] = await Promise.all([
    Promise.all(querySpecs.map(({ field, values }) => transaction.get(
      db.collection('payments')
        .where(field, 'in', values)
        .limit(PROVIDER_EVIDENCE_RESULT_LIMIT + 1),
    ))),
    transaction.get(
      db.collection('payments').limit(PROVIDER_EVIDENCE_RESULT_LIMIT + 1),
    ),
  ]);
  if (snapshots.some((snapshot) => snapshot.size > PROVIDER_EVIDENCE_RESULT_LIMIT)) {
    throw new Error('payment-provider-evidence-result-limit');
  }
  if (globalSnapshot.size > PROVIDER_EVIDENCE_RESULT_LIMIT) {
    throw new Error('payment-provider-evidence-global-limit');
  }
  const documentsById = new Map<string, PaymentDocument>(
    currentCampaignDocuments.map((document) => [document.id, document]),
  );
  for (const snapshot of snapshots) {
    for (const document of snapshot.docs) documentsById.set(document.id, document);
  }
  const currentDocumentIds = new Set(currentCampaignDocuments.map((document) => document.id));
  const currentPaymentIntentIds = new Set(paymentIntentIds);
  const currentCheckoutSessionIds = new Set(checkoutSessionIds);
  const currentReservationIds = new Set(reservationIds);
  for (const document of globalSnapshot.docs) {
    const relevance = globalPaymentRelevance(
      document,
      currentDocumentIds,
      currentPaymentIntentIds,
      currentCheckoutSessionIds,
      currentReservationIds,
    );
    if (relevance.noncanonical) {
      throw new Error('payment-provider-evidence-noncanonical-global-collision');
    }
    if (relevance.relevant) documentsById.set(document.id, document);
  }
  if (documentsById.size > PROVIDER_EVIDENCE_RESULT_LIMIT) {
    throw new Error('payment-provider-evidence-result-limit');
  }
  return [...documentsById.values()];
}

export function providerAwarePaymentEvidence(
  documents: Array<{ id: string; data(): DocumentData }>,
): Array<DocumentData & { id: string }> {
  return documents.map((document) => ({ id: document.id, ...document.data() }));
}
