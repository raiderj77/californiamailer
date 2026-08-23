import 'server-only';

import type {
  CollectionReference,
  DocumentData,
  Query,
  QueryDocumentSnapshot,
  Transaction,
} from 'firebase-admin/firestore';
import {
  hasHighConfidenceProspectIdentity,
  highConfidenceProspectIdentityMatches,
  normalizeProspectIdentity,
  prospectBusinessIdentityCorroborates,
  prospectIdentityQuerySpecs,
  type ProspectIdentityLike,
} from '@/lib/prospectIdentity';
import { isRecordSuppressed } from '@/lib/suppression';

export const PROSPECT_IDENTITY_QUERY_RESULT_LIMIT = 25;
export const PROSPECT_IDENTITY_OWNER_SCAN_LIMIT = 500;
export const SUPPRESSION_SOURCE_SCAN_LIMIT = 500;

export type ProspectIdentityLookupFailure =
  | 'missing_high_confidence_identity'
  | 'bounded_query_result'
  | 'unverified_owner';

export interface ProspectIdentityCollision {
  document: QueryDocumentSnapshot<DocumentData>;
  matchedBy: Array<'email' | 'phone' | 'website'>;
  businessCorroborates: boolean;
}

export type ProspectIdentityLookup =
  | { complete: true; collisions: ProspectIdentityCollision[] }
  | { complete: false; collisions: ProspectIdentityCollision[]; failure: ProspectIdentityLookupFailure };

export type SuppressedIdentityLookup =
  | { complete: true; collisions: QueryDocumentSnapshot<DocumentData>[] }
  | { complete: false; collisions: []; failure: 'bounded_query_result' };

export type SourceIdentityLookup =
  | { complete: true; collisions: QueryDocumentSnapshot<DocumentData>[] }
  | {
    complete: false;
    collisions: QueryDocumentSnapshot<DocumentData>[];
    failure: 'bounded_query_result' | 'missing_high_confidence_identity';
  };

export async function querySourceIdentityCollisionsForCandidates(
  transaction: Transaction,
  sourceQuery: Query<DocumentData>,
  candidates: readonly ProspectIdentityLike[],
  ignoredDocumentIds: readonly string[] = [],
): Promise<SourceIdentityLookup> {
  const usableCandidates = candidates.filter(hasHighConfidenceProspectIdentity);
  if (!usableCandidates.length) {
    return { complete: false, collisions: [], failure: 'missing_high_confidence_identity' };
  }
  const snapshot = await transaction.get(sourceQuery.limit(SUPPRESSION_SOURCE_SCAN_LIMIT + 1));
  const ignored = new Set(ignoredDocumentIds);
  const collisions = snapshot.docs.slice(0, SUPPRESSION_SOURCE_SCAN_LIMIT).filter((document) =>
    !ignored.has(document.id)
    && usableCandidates.some((candidate) =>
      highConfidenceProspectIdentityMatches(candidate, document.data()).length > 0),
  );
  return snapshot.size > SUPPRESSION_SOURCE_SCAN_LIMIT
    ? { complete: false, collisions, failure: 'bounded_query_result' }
    : { complete: true, collisions };
}

export async function querySuppressedIdentityCollisions(
  transaction: Transaction,
  sourceQuery: Query<DocumentData>,
  candidate: ProspectIdentityLike,
  ignoredDocumentIds: readonly string[] = [],
): Promise<SuppressedIdentityLookup> {
  const snapshot = await transaction.get(sourceQuery.limit(SUPPRESSION_SOURCE_SCAN_LIMIT + 1));
  if (snapshot.size > SUPPRESSION_SOURCE_SCAN_LIMIT) {
    return { complete: false, collisions: [], failure: 'bounded_query_result' };
  }
  const ignored = new Set(ignoredDocumentIds);
  return {
    complete: true,
    collisions: snapshot.docs.filter((document) =>
      !ignored.has(document.id)
      && isRecordSuppressed(document.data())
      && highConfidenceProspectIdentityMatches(candidate, document.data()).length > 0,
    ),
  };
}

export async function queryProspectIdentityCollisions(
  transaction: Transaction,
  prospects: CollectionReference<DocumentData>,
  candidate: ProspectIdentityLike,
  ownerUid: string,
): Promise<ProspectIdentityLookup> {
  return queryProspectIdentityCollisionsForCandidates(transaction, prospects, [candidate], ownerUid);
}

export async function queryProspectIdentityCollisionsForCandidates(
  transaction: Transaction,
  prospects: CollectionReference<DocumentData>,
  candidates: readonly ProspectIdentityLike[],
  ownerUid: string,
): Promise<ProspectIdentityLookup> {
  const usableCandidates = candidates.filter(hasHighConfidenceProspectIdentity);
  let failure: ProspectIdentityLookupFailure | null = usableCandidates.length === candidates.length
    ? null
    : 'missing_high_confidence_identity';
  if (!usableCandidates.length) {
    return { complete: false, collisions: [], failure: 'missing_high_confidence_identity' };
  }

  const documents = new Map<string, QueryDocumentSnapshot<DocumentData>>();
  // This bounded owner scan is required until every legacy prospect has been
  // backfilled with the canonical normalized fields. Raw-only legacy records
  // are normalized in memory below; a saturated scan blocks promotion.
  const ownerSnapshot = await transaction.get(
    prospects.where('userId', '==', ownerUid).limit(PROSPECT_IDENTITY_OWNER_SCAN_LIMIT + 1),
  );
  if (ownerSnapshot.size > PROSPECT_IDENTITY_OWNER_SCAN_LIMIT) {
    failure = 'bounded_query_result';
  }
  for (const document of ownerSnapshot.docs) documents.set(document.id, document);

  const querySpecs = new Map<string, ReturnType<typeof prospectIdentityQuerySpecs>[number]>();
  for (const candidate of usableCandidates) {
    for (const spec of prospectIdentityQuerySpecs(candidate)) {
      querySpecs.set(`${spec.field}:${spec.value}`, spec);
    }
  }
  for (const spec of querySpecs.values()) {
    const snapshot = await transaction.get(
      prospects.where(spec.field, '==', spec.value).limit(PROSPECT_IDENTITY_QUERY_RESULT_LIMIT + 1),
    );
    if (snapshot.size > PROSPECT_IDENTITY_QUERY_RESULT_LIMIT) {
      failure = 'bounded_query_result';
    }
    for (const document of snapshot.docs) documents.set(document.id, document);
  }

  const normalizedCandidates = usableCandidates.map(normalizeProspectIdentity);
  const collisions = [...documents.values()].flatMap((document) => {
    const matchedBy = [...new Set(normalizedCandidates.flatMap((candidate) =>
      highConfidenceProspectIdentityMatches(candidate, document.data())))];
    return matchedBy.length
      ? [{
        document,
        matchedBy,
        businessCorroborates: normalizedCandidates.some((candidate) =>
          prospectBusinessIdentityCorroborates(candidate, document.data())),
      }]
      : [];
  });
  const sameOwnerCollisions = collisions.filter(({ document }) => document.data().userId === ownerUid);
  if (sameOwnerCollisions.length !== collisions.length) failure = 'unverified_owner';
  return failure
    ? { complete: false, collisions: sameOwnerCollisions, failure }
    : { complete: true, collisions: sameOwnerCollisions };
}
