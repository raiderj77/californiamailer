import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  hasHighConfidenceProspectIdentity,
  normalizedProspectIdentityFields,
} from '@/lib/prospectIdentity';
import {
  queryProspectIdentityCollisionsForCandidates,
  querySourceIdentityCollisionsForCandidates,
} from '@/lib/prospectIdentityServer';
import {
  isProspectContactBarrierActive,
  nextProspectIdentityMutationSerial,
  PROSPECT_SUPPRESSION_STATE_COLLECTION,
} from '@/lib/prospectSuppressionBarrier';
import { isCurrentProspectStatus } from '@/lib/prospectRules';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import { enforceStickySuppression, isRecordSuppressed } from '@/lib/suppression';

const documentId = z.string().trim().min(1).max(200).regex(/^[^/]+$/);
const text = (maximum: number) => z.string().max(maximum);
const prospectChangesSchema = z.object({
  businessName: text(300).optional(),
  businessCategory: text(200).optional(),
  website: text(2_048).optional(),
  contactName: text(300).optional(),
  contactRole: text(200).optional(),
  email: text(320).optional(),
  phone: text(80).optional(),
  address: text(1_000).optional(),
  city: text(200).optional(),
  serviceArea: text(500).optional(),
  territoryId: text(200).optional(),
  territoryName: text(300).optional(),
  mailingTerritoryFit: text(1_000).optional(),
  currentAdvertisedOffer: text(2_000).optional(),
  estimatedCustomerValue: z.number().finite().nonnegative().optional(),
  activeAdvertisingEvidence: text(2_000).optional(),
  officialSource: text(2_048).optional(),
  officialSourceCheckedAt: text(40).optional(),
  leadSource: text(500).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  qualificationStatus: z.enum(['verify', 'qualified', 'disqualified']).optional(),
  qualificationReason: text(2_000).optional(),
  status: text(80).optional(),
  lastContactDate: text(40).optional(),
  nextFollowUpDate: text(40).optional(),
  contactAttempts: z.number().int().nonnegative().max(1_000_000).optional(),
  notes: text(10_000).optional(),
  campaignId: text(200).optional(),
  offeredPlacement: z.literal('standard').optional(),
  quotedPrice: z.number().finite().nonnegative().optional(),
  categoryReservationStatus: z.enum(['none', 'interest', 'hold', 'sold', 'released']).optional(),
  paymentStatus: z.enum(['none', 'pending', 'cleared', 'failed', 'refunded', 'disputed']).optional(),
  proofStatus: text(100).optional(),
  renewalStatus: text(100).optional(),
  renewalDate: text(40).optional(),
  doNotContact: z.boolean().optional(),
  suppressed: z.boolean().optional(),
}).strict();

const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create'), prospect: prospectChangesSchema }).strict(),
  z.object({ action: z.literal('update'), prospectId: documentId, changes: prospectChangesSchema }).strict(),
]);

const IDENTITY_FIELDS = ['businessName', 'email', 'phone', 'website'] as const;
const LEGACY_PROSPECT_STATUSES = new Set([
  'reservation_sent',
  'reserved',
  'awaiting_payment',
  'paid',
  'proposal',
  'closed',
  'lost',
]);
const CONTACT_STATUSES = new Set([
  'ready_to_contact',
  'contacted',
  'follow_up_needed',
  'interested',
  'no_response',
  'renewal_opportunity',
]);

type ProspectChanges = z.infer<typeof prospectChangesSchema>;

class ProspectMutationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function identityChanged(
  current: FirebaseFirestore.DocumentData,
  proposed: FirebaseFirestore.DocumentData,
) {
  return IDENTITY_FIELDS.some((field) => String(current[field] || '') !== String(proposed[field] || ''));
}

function validateProspectState(
  current: FirebaseFirestore.DocumentData | null,
  proposed: FirebaseFirestore.DocumentData,
) {
  const status = typeof proposed.status === 'string' ? proposed.status : '';
  if (!status || (!isCurrentProspectStatus(status) && !LEGACY_PROSPECT_STATUSES.has(status))) {
    throw new ProspectMutationError('Choose a supported prospect status.', 400);
  }
  if (!current && !isCurrentProspectStatus(status)) {
    throw new ProspectMutationError('A new prospect cannot claim a legacy operational status.', 400);
  }
  if (current && LEGACY_PROSPECT_STATUSES.has(status) && status !== current.status) {
    throw new ProspectMutationError('Legacy operational prospect states can be preserved or cleared, but not newly asserted.');
  }
  if (!current && (
    proposed.categoryReservationStatus !== 'none'
    || proposed.paymentStatus !== 'none'
  )) {
    throw new ProspectMutationError('New prospect records cannot claim reservation or payment state.', 400);
  }
  if (current && (
    proposed.categoryReservationStatus !== current.categoryReservationStatus
      && proposed.categoryReservationStatus !== 'none'
    || proposed.paymentStatus !== current.paymentStatus
      && proposed.paymentStatus !== 'none'
  )) {
    throw new ProspectMutationError('Browser prospect notes cannot create reservation or payment truth.');
  }
  if (!String(proposed.businessName || '').trim()) {
    throw new ProspectMutationError('Business name is required.', 400);
  }
}

async function assertIdentityMutationSafe(
  transaction: FirebaseFirestore.Transaction,
  db: FirebaseFirestore.Firestore,
  ownerUid: string,
  candidates: FirebaseFirestore.DocumentData[],
  ignoredProspectId?: string,
) {
  const usableCandidates = candidates.filter(hasHighConfidenceProspectIdentity);
  const proposed = candidates[candidates.length - 1];
  if (!hasHighConfidenceProspectIdentity(proposed) || usableCandidates.length === 0) {
    throw new ProspectMutationError('A verified email, phone, or website is required before creating or changing a prospect identity.');
  }
  const prospectLookup = await queryProspectIdentityCollisionsForCandidates(
    transaction,
    db.collection('prospects'),
    usableCandidates,
    ownerUid,
  );
  const interestLookup = await querySourceIdentityCollisionsForCandidates(
    transaction,
    db.collection('reservationinterests'),
    usableCandidates,
  );
  const quoteLookup = await querySourceIdentityCollisionsForCandidates(
    transaction,
    db.collection('quoteinquiries'),
    usableCandidates,
  );
  if (!prospectLookup.complete || !interestLookup.complete || !quoteLookup.complete) {
    throw new ProspectMutationError('Identity-wide suppression checks could not be completed safely. No prospect identity was changed.');
  }
  const prospectCollision = prospectLookup.collisions.find(({ document }) => (
    document.id !== ignoredProspectId
  ));
  const suppressedSourceCollision = [
    ...interestLookup.collisions,
    ...quoteLookup.collisions,
  ].find((document) => isRecordSuppressed(document.data()));
  if (prospectCollision || suppressedSourceCollision) {
    throw new ProspectMutationError('A matching prospect or suppressed source record already exists. Reconcile that identity instead of creating a contactable duplicate.');
  }
}

function attemptedSuppressionTransition(current: FirebaseFirestore.DocumentData | null, proposed: FirebaseFirestore.DocumentData) {
  return !isRecordSuppressed(current || {}) && isRecordSuppressed(proposed);
}

function attemptedSuppressionClear(current: FirebaseFirestore.DocumentData, changes: ProspectChanges) {
  return isRecordSuppressed(current) && (
    changes.doNotContact === false
    || changes.suppressed === false
    || (changes.status !== undefined && changes.status !== 'do_not_contact')
  );
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = mutationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid prospect mutation.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const barrierRef = db.collection(PROSPECT_SUPPRESSION_STATE_COLLECTION).doc(owner.uid);
    const prospectRef = parsed.data.action === 'create'
      ? db.collection('prospects').doc()
      : db.collection('prospects').doc(parsed.data.prospectId);
    const auditRef = db.collection('auditlog').doc();
    const result = await db.runTransaction(async (transaction) => {
      const [barrierSnapshot, currentSnapshot] = await Promise.all([
        transaction.get(barrierRef),
        parsed.data.action === 'update'
          ? transaction.get(prospectRef)
          : Promise.resolve(null),
      ]);
      const barrierData = barrierSnapshot.data();
      const barrierActive = isProspectContactBarrierActive(barrierData);

      if (parsed.data.action === 'create') {
        if (barrierActive) {
          throw new ProspectMutationError('Prospect creation is blocked until unresolved suppression propagation is reconciled.');
        }
        const proposed = {
          ...parsed.data.prospect,
          userId: owner.uid,
          categoryReservationStatus: parsed.data.prospect.categoryReservationStatus || 'none',
          paymentStatus: parsed.data.prospect.paymentStatus || 'none',
          doNotContact: parsed.data.prospect.doNotContact === true,
          suppressed: parsed.data.prospect.suppressed === true,
        };
        validateProspectState(null, proposed);
        if (isRecordSuppressed(proposed)) {
          throw new ProspectMutationError('Create the factual prospect first, then use the audited identity-wide DNC action.', 400);
        }
        await assertIdentityMutationSafe(transaction, db, owner.uid, [proposed]);
        transaction.set(barrierRef, {
          ownerUid: owner.uid,
          identityMutationSerial: nextProspectIdentityMutationSerial(barrierData),
          identityMutationCheckedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.create(prospectRef, {
          ...proposed,
          ...normalizedProspectIdentityFields(proposed),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'prospect.create',
          entityId: prospectRef.id,
          summary: 'Created an owner prospect only after bounded identity and suppression checks. No outreach was sent.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return { id: prospectRef.id, created: true };
      }

      const current = currentSnapshot?.data();
      if (!current || current.userId !== owner.uid) {
        throw new ProspectMutationError('Prospect record not found.', 404);
      }
      const proposed = { ...current, ...parsed.data.changes, userId: owner.uid };
      validateProspectState(current, proposed);
      if (attemptedSuppressionTransition(current, proposed)) {
        throw new ProspectMutationError('Use the audited identity-wide DNC action for new suppression decisions.');
      }
      if (attemptedSuppressionClear(current, parsed.data.changes)) {
        throw new ProspectMutationError('Suppression cannot be reopened without a separate audited renewed-consent workflow.');
      }
      const changesIdentity = identityChanged(current, proposed);
      if (isRecordSuppressed(current) && changesIdentity) {
        throw new ProspectMutationError('A suppressed identity can be corrected only through the audited identity-wide DNC action.');
      }
      if (barrierActive && (changesIdentity || CONTACT_STATUSES.has(String(proposed.status)))) {
        throw new ProspectMutationError('Prospect contact and identity changes are blocked until unresolved suppression propagation is reconciled.');
      }
      if (changesIdentity) {
        await assertIdentityMutationSafe(
          transaction,
          db,
          owner.uid,
          [current, proposed],
          currentSnapshot!.id,
        );
        transaction.set(barrierRef, {
          ownerUid: owner.uid,
          identityMutationSerial: nextProspectIdentityMutationSerial(barrierData),
          identityMutationCheckedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      const safeChanges = isRecordSuppressed(current)
        ? enforceStickySuppression(parsed.data.changes)
        : parsed.data.changes;
      transaction.update(prospectRef, {
        ...safeChanges,
        ...(changesIdentity ? normalizedProspectIdentityFields(proposed) : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: changesIdentity ? 'prospect.update_identity' : 'prospect.update',
        entityId: prospectRef.id,
        summary: changesIdentity
          ? 'Updated a prospect identity only after bounded identity and suppression checks. No outreach was sent.'
          : 'Updated owner prospect facts. No outreach was sent.',
        createdAt: FieldValue.serverTimestamp(),
      });
      return { id: prospectRef.id, created: false };
    });

    return NextResponse.json(
      { success: true, ...result },
      { status: result.created ? 201 : 200, headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    if (error instanceof RequestAuthError || error instanceof ProspectMutationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Prospect mutation failed.' }, { status: 500 });
  }
}
