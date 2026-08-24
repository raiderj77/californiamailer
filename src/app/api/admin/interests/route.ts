import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  highConfidenceProspectIdentityMatches,
  normalizeEmail,
  normalizedProspectIdentityFields,
} from '@/lib/prospectIdentity';
import {
  queryProspectIdentityCollisions,
  querySuppressedIdentityCollisions,
} from '@/lib/prospectIdentityServer';
import {
  isProspectContactBarrierActive,
  nextProspectIdentityMutationSerial,
  PROSPECT_SUPPRESSION_STATE_COLLECTION,
} from '@/lib/prospectSuppressionBarrier';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import { isRecordSuppressed } from '@/lib/suppression';

const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_invite'), interestId: z.string().min(10).max(100), expiresHours: z.number().int().min(1).max(168).default(72), sensitiveCategoryApproved: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal('set_status'), interestId: z.string().min(10).max(100), status: z.enum(['reviewed', 'dismissed', 'do_not_contact']) }).strict(),
  z.object({ action: z.literal('promote_to_prospect'), interestId: z.string().min(10).max(100) }).strict(),
]);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const DNC_PROPAGATION_WRITE_LIMIT = 450;

class InterestOperationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function invitationIsBlockedByInterest(data: Record<string, unknown>) {
  return String(data.status) === 'dismissed'
    || isRecordSuppressed(data)
    || String(data.suppressionPropagationStatus || '').startsWith('unresolved_');
}

function validLinkedProspectId(value: unknown): value is string {
  return typeof value === 'string' && /^[^/]{1,200}$/.test(value);
}

function validInviteId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f\d]{64}$/i.test(value);
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof InterestOperationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: 'Interest operation failed.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const db = getAdminFirestore();
    const [snapshot, barrierSnapshot] = await Promise.all([
      db.collection('reservationinterests')
        .where('campaignId', '==', FOUNDING_CAMPAIGN.id)
        .get(),
      db.collection(PROSPECT_SUPPRESSION_STATE_COLLECTION).doc(owner.uid).get(),
    ]);
    const linkedProspectRefs = [...new Set(snapshot.docs
      .map((doc) => doc.data().prospectId)
      .filter(validLinkedProspectId))]
      .map((prospectId) => db.collection('prospects').doc(prospectId));
    const linkedProspectSnapshots = linkedProspectRefs.length > 0
      ? await db.getAll(...linkedProspectRefs)
      : [];
    const linkedProspects = new Map(linkedProspectSnapshots.map((document) => [document.id, document]));
    const interests = snapshot.docs.map((doc) => {
      const data = doc.data();
      const rawLinkedProspectId = data.prospectId;
      const linkedProspect = validLinkedProspectId(rawLinkedProspectId)
        ? linkedProspects.get(rawLinkedProspectId)
        : undefined;
      const linkedProspectSafetyStatus = String(data.suppressionPropagationStatus || '').startsWith('unresolved_')
        ? String(data.suppressionPropagationStatus)
        : rawLinkedProspectId && !validLinkedProspectId(rawLinkedProspectId)
          ? 'invalid_linked_prospect'
          : !rawLinkedProspectId
            ? 'not_linked'
            : !linkedProspect?.exists
              ? 'missing_linked_prospect'
              : linkedProspect.data()?.userId !== owner.uid
                ? 'wrong_owner_linked_prospect'
                : isRecordSuppressed(linkedProspect.data() || {})
                  ? 'suppressed_linked_prospect'
                  : 'verified_linked_prospect';
      const linkedProspectSafetyBlocked = !['not_linked', 'verified_linked_prospect'].includes(linkedProspectSafetyStatus);
      return {
        id: doc.id,
        publicReference: data.publicReference,
        businessName: data.businessName,
        contactName: data.contactName,
        email: data.email,
        phone: data.phone || null,
        website: data.website || null,
        categorySlug: data.categorySlug,
        placementSize: data.placementSize,
        planId: data.planId || null,
        offerModelVersion: data.offerModelVersion || null,
        advertisedOffer: data.advertisedOffer,
        advertiserDisclaimer: data.advertiserDisclaimer,
        status: data.status,
        reason: data.reason,
        ownerNotificationStatus: data.ownerNotificationStatus || 'unknown',
        inviteStatus: data.inviteStatus || 'not_issued',
        inviteExpiresAt: data.inviteExpiresAt?.toDate?.()?.toISOString?.() || null,
        prospectId: data.prospectId || null,
        doNotContact: data.doNotContact === true,
        suppressed: data.suppressed === true,
        suppressionPropagationStatus: data.suppressionPropagationStatus || null,
        linkedProspectSafetyStatus,
        linkedProspectSafetyBlocked,
        linkedProspectSuppressed: linkedProspectSafetyStatus === 'suppressed_linked_prospect',
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return NextResponse.json({
      interests,
      contactGloballyBlocked: isProspectContactBarrierActive(barrierSnapshot.data()),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid interest action.' }, { status: 400 });
    const db = getAdminFirestore();
    const interestRef = db.collection('reservationinterests').doc(parsed.data.interestId);
    const barrierRef = db.collection(PROSPECT_SUPPRESSION_STATE_COLLECTION).doc(owner.uid);

    if (parsed.data.action === 'set_status') {
      const statusUpdate = parsed.data;
      const auditRef = db.collection('auditlog').doc();
      const { suppressionPropagationStatus, inviteRevocationStatus } = await db.runTransaction(async (transaction) => {
        const currentInterest = await transaction.get(interestRef);
        const currentData = currentInterest.data();
        if (!currentData || currentData.campaignId !== FOUNDING_CAMPAIGN.id) {
          throw new InterestOperationError('Interest record not found.', 404);
        }
        if (isRecordSuppressed(currentData) && statusUpdate.status !== 'do_not_contact') {
          throw new InterestOperationError('A suppressed interest cannot be reopened. No renewed-consent workflow is available.');
        }
        const suppressing = statusUpdate.status === 'do_not_contact';
        const identityMutexSnapshot = suppressing
          ? await transaction.get(barrierRef)
          : null;

        const rawCurrentInviteId = typeof currentData.inviteId === 'string' ? currentData.inviteId : '';
        const currentInviteId = validInviteId(rawCurrentInviteId) ? rawCurrentInviteId : '';
        const invalidCurrentInviteId = Boolean(rawCurrentInviteId) && !currentInviteId;
        const currentInviteRef = currentInviteId
          ? db.collection('reservationinvites').doc(currentInviteId)
          : null;
        const currentInvite = currentInviteRef
          ? await transaction.get(currentInviteRef)
          : null;
        const inviteRevocationStatus = invalidCurrentInviteId
          ? 'unresolved_invalid_invite_pointer'
          : !currentInviteId
            ? 'not_applicable_no_invite'
            : !currentInvite?.exists
              ? 'unresolved_missing_invite'
              : currentInvite.data()?.createdBy !== owner.uid
                ? 'unresolved_wrong_owner_invite'
                : currentInvite.data()?.status === 'active'
                  ? 'revoked'
                  : 'already_inactive';
        const linkedProspectId = validLinkedProspectId(currentData.prospectId) ? currentData.prospectId : '';
        const invalidLinkedProspectId = Boolean(currentData.prospectId) && !linkedProspectId;
        const linkedProspectRef = linkedProspectId
          ? db.collection('prospects').doc(linkedProspectId)
          : null;
        const linkedProspect = linkedProspectRef
          ? await transaction.get(linkedProspectRef)
          : null;
        const identityLookup = suppressing
          ? await queryProspectIdentityCollisions(
            transaction,
            db.collection('prospects'),
            currentData,
            owner.uid,
          )
          : null;
        const linkedProspectData = linkedProspect?.data();
        const linkedProspectIdentityMatches = Boolean(
          linkedProspectData
          && highConfidenceProspectIdentityMatches(currentData, linkedProspectData).length > 0,
        );
        const directProspectCanBeSuppressed = Boolean(
          linkedProspectRef
          && linkedProspect?.exists
          && linkedProspectData?.userId === owner.uid
          && linkedProspectIdentityMatches,
        );
        const discoveredIdentityMatches = identityLookup?.collisions || [];
        const identityMatches = discoveredIdentityMatches.slice(0, DNC_PROPAGATION_WRITE_LIMIT);
        const propagationCoverageFailure = !identityLookup?.complete
          ? identityLookup?.failure || 'unavailable'
          : discoveredIdentityMatches.length > DNC_PROPAGATION_WRITE_LIMIT
            ? 'write_limit'
            : null;
        const propagationStatus = !suppressing
          ? null
          : propagationCoverageFailure
            ? `unresolved_identity_lookup_${propagationCoverageFailure}`
            : invalidLinkedProspectId
              ? 'unresolved_invalid_linked_prospect'
              : linkedProspectId && !linkedProspect?.exists
                ? 'unresolved_missing_linked_prospect'
                : linkedProspectId && linkedProspectData?.userId !== owner.uid
                  ? 'unresolved_wrong_owner_linked_prospect'
                  : linkedProspectId && !linkedProspectIdentityMatches
                    ? 'unresolved_mismatched_linked_prospect_identity'
                    : identityMatches.length > 0
                      ? 'applied_to_identity_matches'
                      : 'not_applicable_no_matching_prospect';

        if (suppressing) {
          transaction.set(barrierRef, {
            ownerUid: owner.uid,
            identityMutationSerial: nextProspectIdentityMutationSerial(identityMutexSnapshot?.data()),
            identityMutationCheckedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            ...(propagationStatus?.startsWith('unresolved_') ? {
              contactBlocked: true,
              reason: propagationStatus,
              sourceInterestId: currentInterest.id,
              resolutionStatus: 'owner_reconciliation_required',
            } : {}),
          }, { merge: true });
        }

        transaction.update(interestRef, {
          status: statusUpdate.status,
          inviteStatus: inviteRevocationStatus === 'not_applicable_no_invite'
            ? 'not_issued'
            : ['revoked', 'already_inactive'].includes(inviteRevocationStatus)
              ? 'revoked'
              : 'revocation_unresolved',
          inviteId: null,
          inviteExpiresAt: null,
          inviteRevokedAt: inviteRevocationStatus === 'revoked' ? FieldValue.serverTimestamp() : null,
          inviteRevokedBy: inviteRevocationStatus === 'revoked' ? owner.uid : null,
          inviteRevocationStatus,
          inviteRevocationCheckedAt: FieldValue.serverTimestamp(),
          reviewedBy: owner.uid,
          reviewedAt: FieldValue.serverTimestamp(),
          ...(suppressing ? {
            doNotContact: true,
            suppressed: true,
            suppressedAt: currentData.suppressedAt || FieldValue.serverTimestamp(),
            suppressedBy: owner.uid,
            suppressionSource: 'owner_interest_review',
            suppressionPropagationStatus: propagationStatus,
            suppressionPropagationProspectId: linkedProspectId || null,
            suppressionPropagationMatchedCount: identityMatches.length,
            suppressionPropagationDiscoveredCount: discoveredIdentityMatches.length,
            suppressionPropagationCheckedAt: FieldValue.serverTimestamp(),
          } : {}),
        });
        if (inviteRevocationStatus === 'revoked' && currentInviteRef && currentInvite) {
          transaction.update(currentInviteRef, {
            status: 'revoked',
            revokedReason: `interest_${statusUpdate.status}`,
            revokedBy: owner.uid,
            revokedAt: FieldValue.serverTimestamp(),
          });
        }
        for (const { document } of identityMatches) {
          transaction.update(document.ref, {
            status: 'do_not_contact',
            doNotContact: true,
            suppressed: true,
            suppressedAt: document.data().suppressedAt || FieldValue.serverTimestamp(),
            suppressedBy: owner.uid,
            suppressionSource: 'matching_reservation_interest_identity',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        if (
          suppressing
          && directProspectCanBeSuppressed
          && linkedProspectRef
          && linkedProspect
          && !identityMatches.some(({ document }) => document.id === linkedProspect.id)
        ) {
          transaction.update(linkedProspectRef, {
            status: 'do_not_contact',
            doNotContact: true,
            suppressed: true,
            suppressedAt: linkedProspectData?.suppressedAt || FieldValue.serverTimestamp(),
            suppressedBy: owner.uid,
            suppressionSource: 'linked_reservation_interest',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        const inviteAuditSummary = inviteRevocationStatus === 'revoked'
          ? 'The current invitation was revoked.'
          : inviteRevocationStatus === 'already_inactive'
            ? 'The linked invitation was already inactive.'
            : inviteRevocationStatus === 'not_applicable_no_invite'
              ? 'No invitation was linked.'
              : `Invitation revocation remains unresolved (${inviteRevocationStatus}); the source pointer was cleared and redemption remains blocked.`;
        const propagationAuditSummary = propagationStatus === 'applied_to_identity_matches'
          ? `Every bounded same-owner identity match was suppressed (${identityMatches.length} prospect record(s)).`
          : propagationStatus === 'not_applicable_no_matching_prospect'
            ? 'No same-owner prospect identity match existed, so prospect propagation was not applicable.'
            : `Prospect identity propagation remains unresolved (${propagationStatus}); ${identityMatches.length} bounded identity match(es)${directProspectCanBeSuppressed ? ' plus any verified direct link' : ''} were suppressed, and downstream invitation and promotion remain blocked.`;
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: `interest.${statusUpdate.status}`,
          entityId: currentInterest.id,
          summary: suppressing
            ? `Owner applied sticky do-not-contact suppression. ${inviteAuditSummary} ${propagationAuditSummary}`
            : `Owner changed the interest review status. ${inviteAuditSummary}`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return {
          suppressionPropagationStatus: propagationStatus,
          inviteRevocationStatus,
        };
      });
      return NextResponse.json({
        success: true,
        status: statusUpdate.status,
        suppressionPropagationStatus,
        inviteRevocationStatus,
      });
    }

    if (parsed.data.action === 'promote_to_prospect') {
      const prospectRef = db.collection('prospects').doc(`interest__${interestRef.id}`);
      const auditRef = db.collection('auditlog').doc();
      await db.runTransaction(async (transaction) => {
        const interest = await transaction.get(interestRef);
        const barrierSnapshot = await transaction.get(barrierRef);
        const data = interest.data();
        if (!data || data.campaignId !== FOUNDING_CAMPAIGN.id) {
          throw new InterestOperationError('Interest record not found.', 404);
        }
        if (invitationIsBlockedByInterest(data)) {
          throw new InterestOperationError('A dismissed or suppressed interest cannot be promoted.');
        }
        if (isProspectContactBarrierActive(barrierSnapshot.data())) {
          throw new InterestOperationError('Prospect contact is globally blocked until unresolved suppression propagation is reconciled.');
        }
        if (data.prospectId || data.status === 'promoted') {
          throw new InterestOperationError('This interest is already represented by a prospect.');
        }
        const identityLookup = await queryProspectIdentityCollisions(
          transaction,
          db.collection('prospects'),
          data,
          owner.uid,
        );
        if (!identityLookup.complete) {
          throw new InterestOperationError(
            identityLookup.failure === 'missing_high_confidence_identity'
              ? 'Promotion requires a verified email, phone, or website identity.'
              : 'Prospect identity search could not be completed safely. Review the prospect records before promotion.',
          );
        }
        const suppressedInterestLookup = await querySuppressedIdentityCollisions(
          transaction,
          db.collection('reservationinterests'),
          data,
          [interest.id],
        );
        const suppressedQuoteLookup = await querySuppressedIdentityCollisions(
          transaction,
          db.collection('quoteinquiries'),
          data,
        );
        if (!suppressedInterestLookup.complete || !suppressedQuoteLookup.complete) {
          throw new InterestOperationError('Cross-source suppression search could not be completed safely. Review the source records before promotion.');
        }
        if (suppressedInterestLookup.collisions.length > 0 || suppressedQuoteLookup.collisions.length > 0) {
          throw new InterestOperationError('A matching source record is suppressed. Promotion cannot bypass do-not-contact.');
        }
        if (identityLookup.collisions.some(({ document }) => isRecordSuppressed(document.data()))) {
          throw new InterestOperationError('A matching prospect is suppressed. Promotion cannot bypass do-not-contact.');
        }
        if (identityLookup.collisions.length > 0) {
          throw new InterestOperationError('A matching prospect already exists. Review that record instead of duplicating it.');
        }
        transaction.set(barrierRef, {
          ownerUid: owner.uid,
          identityMutationSerial: nextProspectIdentityMutationSerial(barrierSnapshot.data()),
          identityMutationCheckedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        transaction.create(prospectRef, {
          businessName: data.businessName,
          businessCategory: data.categorySlug,
          website: data.website || '',
          contactName: data.contactName,
          contactRole: '',
          email: data.email,
          phone: data.phone || '',
          address: '',
          city: '',
          serviceArea: '',
          territoryId: '',
          territoryName: FOUNDING_CAMPAIGN.territory,
          mailingTerritoryFit: '',
          currentAdvertisedOffer: data.advertisedOffer || '',
          activeAdvertisingEvidence: '',
          officialSource: '',
          officialSourceCheckedAt: '',
          leadSource: 'reservation_interest',
          priority: 'high',
          qualificationStatus: 'verify',
          qualificationReason: 'Promoted from a real inbound interest; public-source qualification still required.',
          status: 'researching',
          lastContactDate: '',
          nextFollowUpDate: '',
          contactAttempts: 0,
          campaignId: FOUNDING_CAMPAIGN.id,
          offeredPlacement: 'standard',
          quotedPrice: FOUNDING_CAMPAIGN.placements.standard.priceCents / 100,
          categoryReservationStatus: 'interest',
          paymentStatus: 'none',
          proofStatus: 'not_started',
          renewalStatus: 'none',
          renewalDate: '',
          doNotContact: false,
          suppressed: false,
          notes: `Inbound reference ${data.publicReference}; no qualification or reservation inferred.`,
          ...normalizedProspectIdentityFields(data),
          userId: owner.uid,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(interestRef, { status: 'promoted', prospectId: prospectRef.id, reviewedBy: owner.uid, reviewedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'interest.promote', entityId: interest.id, summary: 'Promoted real inbound interest to an unqualified researching prospect.', createdAt: FieldValue.serverTimestamp() });
      });
      return NextResponse.json({ success: true, prospectId: prospectRef.id });
    }

    const createInvite = parsed.data;
    const code = `CM-${randomBytes(6).toString('hex').toUpperCase()}`;
    const inviteRef = db.collection('reservationinvites').doc(sha256(code));
    const expiresAt = Timestamp.fromMillis(Date.now() + createInvite.expiresHours * 60 * 60_000);
    const auditRef = db.collection('auditlog').doc();
    await db.runTransaction(async (transaction) => {
      const currentInterest = await transaction.get(interestRef);
      const barrierSnapshot = await transaction.get(barrierRef);
      const currentData = currentInterest.data();
      if (!currentData || currentData.campaignId !== FOUNDING_CAMPAIGN.id) {
        throw new InterestOperationError('Interest record not found.', 404);
      }
      if (invitationIsBlockedByInterest(currentData)) {
        throw new InterestOperationError('A dismissed or suppressed interest cannot receive an invitation.');
      }
      if (isProspectContactBarrierActive(barrierSnapshot.data())) {
        throw new InterestOperationError('Prospect contact is globally blocked until unresolved suppression propagation is reconciled.');
      }
      if (!validLinkedProspectId(currentData.prospectId)) {
        throw new InterestOperationError('Promote and verify the linked prospect before issuing an invitation.');
      }
      const linkedProspectRef = db.collection('prospects').doc(currentData.prospectId);
      const linkedProspect = await transaction.get(linkedProspectRef);
      const linkedProspectData = linkedProspect.data();
      if (!linkedProspectData || linkedProspectData.userId !== owner.uid) {
        throw new InterestOperationError('The linked prospect is missing or its ownership cannot be verified.');
      }
      if (isRecordSuppressed(linkedProspectData)) {
        throw new InterestOperationError('The linked prospect is suppressed. An invitation cannot bypass do-not-contact.');
      }
      if (highConfidenceProspectIdentityMatches(currentData, linkedProspectData).length === 0) {
        throw new InterestOperationError('The linked prospect identity no longer matches this interest. Review both records before inviting.');
      }
      const prospectIdentityLookup = await queryProspectIdentityCollisions(
        transaction,
        db.collection('prospects'),
        currentData,
        owner.uid,
      );
      const suppressedInterestLookup = await querySuppressedIdentityCollisions(
        transaction,
        db.collection('reservationinterests'),
        currentData,
        [currentInterest.id],
      );
      const suppressedQuoteLookup = await querySuppressedIdentityCollisions(
        transaction,
        db.collection('quoteinquiries'),
        currentData,
      );
      if (!prospectIdentityLookup.complete || !suppressedInterestLookup.complete || !suppressedQuoteLookup.complete) {
        throw new InterestOperationError('Identity-wide suppression checks could not be completed safely. No invitation was issued.');
      }
      if (
        prospectIdentityLookup.collisions.some(({ document }) =>
          document.id !== linkedProspect.id || isRecordSuppressed(document.data()))
        || suppressedInterestLookup.collisions.length > 0
        || suppressedQuoteLookup.collisions.length > 0
      ) {
        throw new InterestOperationError('A matching record is suppressed or duplicated. An invitation cannot bypass identity-wide review.');
      }
      const category = FOUNDING_CAMPAIGN.categories.find((item) => item.slug === currentData.categorySlug);
      if (!category) throw new InterestOperationError('The category is no longer configured.');
      if (
        currentData.planId !== FOUNDING_CAMPAIGN.planId
        || currentData.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
        || currentData.placementSize !== 'standard'
      ) {
        throw new InterestOperationError('This interest belongs to an older offer model and cannot receive an active reservation invitation.');
      }
      if (category.sensitive && !createInvite.sensitiveCategoryApproved) {
        throw new InterestOperationError('Explicit sensitive-category review is required.');
      }

      const previousInviteId = typeof currentData.inviteId === 'string' ? currentData.inviteId : '';
      const previousInviteRef = previousInviteId
        ? db.collection('reservationinvites').doc(previousInviteId)
        : null;
      const previousInvite = previousInviteRef
        ? await transaction.get(previousInviteRef)
        : null;

      if (previousInviteRef && previousInvite?.exists && previousInvite.data()?.status === 'active') {
        transaction.update(previousInviteRef, {
          status: 'revoked',
          replacedByInviteId: inviteRef.id,
          revokedReason: 'invite_replaced',
          revokedBy: owner.uid,
          revokedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.create(inviteRef, {
        campaignId: FOUNDING_CAMPAIGN.id,
        planId: FOUNDING_CAMPAIGN.planId,
        offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
        interestId: currentInterest.id,
        prospectId: linkedProspect.id,
        emailNormalized: normalizeEmail(currentData.email),
        categorySlug: currentData.categorySlug,
        placementSize: currentData.placementSize,
        sensitiveCategoryApproved: category.sensitive ? createInvite.sensitiveCategoryApproved : false,
        status: 'active',
        expiresAt,
        createdBy: owner.uid,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.update(interestRef, {
        status: 'invited',
        inviteStatus: 'active',
        inviteId: inviteRef.id,
        inviteExpiresAt: expiresAt,
        invitedPlanId: FOUNDING_CAMPAIGN.planId,
        invitedOfferModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
        reviewedBy: owner.uid,
        reviewedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(auditRef, {
        actorUid: owner.uid,
        action: 'interest.invite',
        entityId: currentInterest.id,
        summary: 'Issued a single-use, time-limited reservation code after transactionally verifying the linked prospect.',
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true, invitationCode: code, expiresAt: expiresAt.toDate().toISOString() });
  } catch (error) {
    if (error instanceof InterestOperationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const alreadyExists = error instanceof Error && /already exists|ALREADY_EXISTS/i.test(error.message);
    return alreadyExists
      ? NextResponse.json({ error: 'This interest was already promoted or the generated invite collided. Refresh before retrying.' }, { status: 409 })
      : errorResponse(error);
  }
}
