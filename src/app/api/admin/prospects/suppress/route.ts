import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { normalizedProspectIdentityFields } from '@/lib/prospectIdentity';
import {
  queryProspectIdentityCollisionsForCandidates,
  querySourceIdentityCollisionsForCandidates,
} from '@/lib/prospectIdentityServer';
import {
  isProspectContactBarrierActive,
  nextProspectIdentityMutationSerial,
  PROSPECT_SUPPRESSION_STATE_COLLECTION,
} from '@/lib/prospectSuppressionBarrier';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const documentId = z.string().trim().min(1).max(200).regex(/^[^/]+$/);
const identitySchema = z.object({
  businessName: z.string().trim().min(1).max(300),
  email: z.string().trim().max(320),
  phone: z.string().trim().max(80),
  website: z.string().trim().max(2_048),
}).strict();
const suppressionSchema = z.object({
  prospectId: documentId,
  identity: identitySchema.optional(),
}).strict();
const DNC_PROPAGATION_WRITE_LIMIT = 450;

class ProspectSuppressionError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const snapshot = await getAdminFirestore()
      .collection(PROSPECT_SUPPRESSION_STATE_COLLECTION)
      .doc(owner.uid)
      .get();
    const data = snapshot.data();
    return NextResponse.json({
      contactBlocked: isProspectContactBarrierActive(data),
      reason: typeof data?.reason === 'string' ? data.reason : null,
      sourceProspectId: typeof data?.sourceProspectId === 'string' ? data.sourceProspectId : null,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Prospect suppression state could not be read.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = suppressionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid prospect suppression request.' }, { status: 400 });

    const db = getAdminFirestore();
    const prospects = db.collection('prospects');
    const targetRef = prospects.doc(parsed.data.prospectId);
    const auditRef = db.collection('auditlog').doc();
    const barrierRef = db.collection(PROSPECT_SUPPRESSION_STATE_COLLECTION).doc(owner.uid);
    const result = await db.runTransaction(async (transaction) => {
      const [targetSnapshot, barrierSnapshot] = await Promise.all([
        transaction.get(targetRef),
        transaction.get(barrierRef),
      ]);
      const target = targetSnapshot.data();
      if (!target || target.userId !== owner.uid) {
        throw new ProspectSuppressionError('Prospect record not found.', 404);
      }

      const proposedTarget = parsed.data.identity
        ? { ...target, ...parsed.data.identity }
        : target;
      const identityCandidates = parsed.data.identity ? [target, proposedTarget] : [target];
      const identityLookup = await queryProspectIdentityCollisionsForCandidates(
        transaction,
        prospects,
        identityCandidates,
        owner.uid,
      );
      const interestLookup = await querySourceIdentityCollisionsForCandidates(
        transaction,
        db.collection('reservationinterests'),
        identityCandidates,
      );
      const quoteLookup = await querySourceIdentityCollisionsForCandidates(
        transaction,
        db.collection('quoteinquiries'),
        identityCandidates,
      );
      const discovered = new Map<string, {
        kind: 'prospect' | 'interest' | 'quote';
        id: string;
        ref: FirebaseFirestore.DocumentReference;
        data: FirebaseFirestore.DocumentData;
      }>();
      const targetKey = `prospect:${targetSnapshot.id}`;
      discovered.set(targetKey, { kind: 'prospect', id: targetSnapshot.id, ref: targetSnapshot.ref, data: target });
      for (const { document } of identityLookup.collisions) {
        discovered.set(`prospect:${document.id}`, { kind: 'prospect', id: document.id, ref: document.ref, data: document.data() });
      }
      for (const document of interestLookup.collisions) {
        discovered.set(`interest:${document.id}`, { kind: 'interest', id: document.id, ref: document.ref, data: document.data() });
      }
      for (const document of quoteLookup.collisions) {
        discovered.set(`quote:${document.id}`, { kind: 'quote', id: document.id, ref: document.ref, data: document.data() });
      }

      const selected = [...discovered.entries()]
        .sort(([leftKey], [rightKey]) => leftKey === targetKey ? -1 : rightKey === targetKey ? 1 : leftKey.localeCompare(rightKey))
        .map(([, value]) => value)
        .slice(0, DNC_PROPAGATION_WRITE_LIMIT);
      const incompleteLookup = [identityLookup, interestLookup, quoteLookup].find((lookup) => !lookup.complete);
      const propagationStatus = incompleteLookup && !incompleteLookup.complete
        ? `unresolved_identity_lookup_${incompleteLookup.failure}`
        : discovered.size > DNC_PROPAGATION_WRITE_LIMIT
          ? 'unresolved_identity_lookup_write_limit'
          : 'applied_to_identity_matches';

      // Every DNC and every create/identity edit updates this owner document.
      // That shared read/write point forces a concurrent transaction to retry
      // its identity scans, including when the initial queries returned empty.
      transaction.set(barrierRef, {
        ownerUid: owner.uid,
        identityMutationSerial: nextProspectIdentityMutationSerial(barrierSnapshot.data()),
        identityMutationCheckedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        ...(propagationStatus.startsWith('unresolved_') ? {
          contactBlocked: true,
          reason: propagationStatus,
          sourceProspectId: targetSnapshot.id,
          resolutionStatus: 'owner_reconciliation_required',
          createdAt: FieldValue.serverTimestamp(),
        } : {}),
      }, { merge: true });

      for (const prospect of selected) {
        transaction.update(prospect.ref, {
          ...(prospect.kind === 'prospect' && prospect.id === targetSnapshot.id && parsed.data.identity ? {
            ...parsed.data.identity,
            ...normalizedProspectIdentityFields(proposedTarget),
          } : {}),
          status: 'do_not_contact',
          doNotContact: true,
          suppressed: true,
          suppressedAt: prospect.data.suppressedAt || FieldValue.serverTimestamp(),
          suppressedBy: owner.uid,
          suppressionSource: prospect.kind === 'prospect'
            ? prospect.id === targetSnapshot.id
              ? 'owner_prospect_identity_review'
              : 'matching_prospect_identity'
            : prospect.kind === 'interest'
              ? 'matching_prospect_identity_interest'
              : 'matching_prospect_identity_quote',
          identitySuppressionSourceProspectId: targetSnapshot.id,
          ...(prospect.kind === 'prospect' && prospect.id === targetSnapshot.id ? {
            suppressionPropagationStatus: propagationStatus,
            suppressionPropagationMatchedCount: selected.length,
            suppressionPropagationDiscoveredCount: discovered.size,
            suppressionPropagationCheckedAt: FieldValue.serverTimestamp(),
          } : {}),
          ...(prospect.kind !== 'prospect' ? {
            identitySuppressionPropagationStatus: propagationStatus,
            identitySuppressionCheckedAt: FieldValue.serverTimestamp(),
          } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: 'prospect.suppress_identity',
        entityId: targetSnapshot.id,
        identityUpdated: Boolean(parsed.data.identity),
        summary: propagationStatus === 'applied_to_identity_matches'
          ? `Owner applied sticky do-not-contact suppression to every bounded identity match (${selected.length} prospect, interest, or quote record(s)).`
          : `Owner applied sticky do-not-contact suppression to the target and ${Math.max(0, selected.length - 1)} discovered identity match(es). Propagation remains unresolved (${propagationStatus}); contact stays blocked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        propagationStatus,
        suppressedCount: selected.length,
        discoveredCount: discovered.size,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RequestAuthError || error instanceof ProspectSuppressionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Prospect suppression failed.' }, { status: 500 });
  }
}
