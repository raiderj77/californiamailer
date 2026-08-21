import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const updateSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('create_invite'), interestId: z.string().min(10).max(100), expiresHours: z.number().int().min(1).max(168).default(72), sensitiveCategoryApproved: z.boolean().default(false) }).strict(),
  z.object({ action: z.literal('set_status'), interestId: z.string().min(10).max(100), status: z.enum(['reviewed', 'dismissed', 'do_not_contact']) }).strict(),
  z.object({ action: z.literal('promote_to_prospect'), interestId: z.string().min(10).max(100) }).strict(),
]);
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

class InterestOperationError extends Error {
  constructor(message: string, readonly status = 409) {
    super(message);
  }
}

function invitationIsBlockedByInterest(data: Record<string, unknown>) {
  return ['dismissed', 'do_not_contact', 'suppressed'].includes(String(data.status))
    || data.doNotContact === true
    || data.suppressed === true;
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: 'Interest operation failed.' }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const snapshot = await getAdminFirestore().collection('reservationinterests')
      .where('campaignId', '==', FOUNDING_CAMPAIGN.id)
      .get();
    const interests = snapshot.docs.map((doc) => {
      const data = doc.data();
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
        createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
      };
    }).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    return NextResponse.json({ interests });
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

    if (parsed.data.action === 'set_status') {
      const statusUpdate = parsed.data;
      const auditRef = db.collection('auditlog').doc();
      await db.runTransaction(async (transaction) => {
        const currentInterest = await transaction.get(interestRef);
        const currentData = currentInterest.data();
        if (!currentData || currentData.campaignId !== FOUNDING_CAMPAIGN.id) {
          throw new InterestOperationError('Interest record not found.', 404);
        }

        const currentInviteId = typeof currentData.inviteId === 'string' ? currentData.inviteId : '';
        const currentInviteRef = currentInviteId
          ? db.collection('reservationinvites').doc(currentInviteId)
          : null;
        const currentInvite = currentInviteRef
          ? await transaction.get(currentInviteRef)
          : null;

        transaction.update(interestRef, {
          status: statusUpdate.status,
          inviteStatus: currentInviteId ? 'revoked' : 'not_issued',
          inviteId: null,
          inviteExpiresAt: null,
          inviteRevokedAt: currentInviteId ? FieldValue.serverTimestamp() : null,
          inviteRevokedBy: currentInviteId ? owner.uid : null,
          reviewedBy: owner.uid,
          reviewedAt: FieldValue.serverTimestamp(),
        });
        if (currentInviteRef && currentInvite?.exists && currentInvite.data()?.status === 'active') {
          transaction.update(currentInviteRef, {
            status: 'revoked',
            revokedReason: `interest_${statusUpdate.status}`,
            revokedBy: owner.uid,
            revokedAt: FieldValue.serverTimestamp(),
          });
        }
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: `interest.${statusUpdate.status}`,
          entityId: currentInterest.id,
          summary: 'Owner reviewed a real reservation-interest record and revoked its current invitation.',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      return NextResponse.json({ success: true, status: statusUpdate.status });
    }

    if (parsed.data.action === 'promote_to_prospect') {
      const interest = await interestRef.get();
      const data = interest.data();
      if (!data || data.campaignId !== FOUNDING_CAMPAIGN.id) return NextResponse.json({ error: 'Interest record not found.' }, { status: 404 });
      if (data.status === 'do_not_contact') return NextResponse.json({ error: 'This interest is suppressed.' }, { status: 409 });
      const prospectRef = db.collection('prospects').doc(`interest__${interest.id}`);
      const batch = db.batch();
      batch.create(prospectRef, {
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
        notes: `Inbound reference ${data.publicReference}; no qualification or reservation inferred.`,
        normalizedBusinessName: String(data.businessName || '').trim().toLowerCase(),
        normalizedEmail: String(data.email || '').trim().toLowerCase(),
        normalizedWebsite: String(data.website || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''),
        normalizedPhone: String(data.phone || '').replace(/\D/g, '').slice(-10),
        userId: owner.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      batch.update(interestRef, { status: 'promoted', prospectId: prospectRef.id, reviewedBy: owner.uid, reviewedAt: FieldValue.serverTimestamp() });
      batch.create(db.collection('auditlog').doc(), { actorUid: owner.uid, action: 'interest.promote', entityId: interest.id, summary: 'Promoted real inbound interest to an unqualified researching prospect.', createdAt: FieldValue.serverTimestamp() });
      await batch.commit();
      return NextResponse.json({ success: true, prospectId: prospectRef.id });
    }

    const createInvite = parsed.data;
    const code = `CM-${randomBytes(6).toString('hex').toUpperCase()}`;
    const inviteRef = db.collection('reservationinvites').doc(sha256(code));
    const expiresAt = Timestamp.fromMillis(Date.now() + createInvite.expiresHours * 60 * 60_000);
    const auditRef = db.collection('auditlog').doc();
    await db.runTransaction(async (transaction) => {
      const currentInterest = await transaction.get(interestRef);
      const currentData = currentInterest.data();
      if (!currentData || currentData.campaignId !== FOUNDING_CAMPAIGN.id) {
        throw new InterestOperationError('Interest record not found.', 404);
      }
      if (invitationIsBlockedByInterest(currentData)) {
        throw new InterestOperationError('A dismissed or suppressed interest cannot receive an invitation.');
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
        emailNormalized: String(currentData.email).toLowerCase(),
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
        summary: 'Issued a single-use, time-limited reservation code for a reviewed interest.',
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
