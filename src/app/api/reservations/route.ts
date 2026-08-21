import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { z } from 'zod';
import {
  FOUNDING_CAMPAIGN,
  campaignMatchesActiveSharedModel,
  getApprovedCampaignContractVersions,
  type ApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import { sendEmail } from '@/lib/email';
import { campaignOperationalEvidenceBlockReason } from '@/lib/campaignOperationalGates';
import { isLiveInventoryState, RESERVATION_OPEN_STATUSES, syncCampaignState } from '@/lib/campaignSync';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { consumeRateLimit, requestFingerprint } from '@/lib/rateLimit';
import { reservationCookieName } from '@/lib/reservationAuth';

const reservationSchema = z.object({
  campaignId: z.literal(FOUNDING_CAMPAIGN.id),
  categorySlug: z.string().trim().min(1).max(80),
  placementSize: z.literal('standard'),
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).optional().default(''),
  website: z.union([z.literal(''), z.string().trim().url().max(300)]).optional().default(''),
  advertisedOffer: z.string().trim().min(5).max(1_000),
  brandColors: z.string().trim().max(200).optional().default(''),
  adCopy: z.string().trim().max(2_000).optional().default(''),
  advertiserDisclaimer: z.string().trim().min(2).max(1_000),
  invitationCode: z.string().trim().max(32).optional().default(''),
  termsAccepted: z.literal(true),
  refundPolicyAccepted: z.literal(true),
  proofAcknowledged: z.literal(true),
  companySite: z.string().max(0).optional().default(''),
}).strict();

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function publicReference() {
  return `CM-${randomBytes(4).toString('hex').toUpperCase()}`;
}

function baseSubmission(
  input: z.infer<typeof reservationSchema>,
  reference: string,
  campaign: DocumentData,
) {
  const acceptedAt = new Date().toISOString();
  return {
    publicReference: reference,
    campaignId: input.campaignId,
    planId: typeof campaign.planId === 'string' ? campaign.planId : null,
    offerModelVersion: typeof campaign.offerModelVersion === 'string'
      ? campaign.offerModelVersion
      : null,
    categorySlug: input.categorySlug,
    placementSize: input.placementSize,
    businessName: input.businessName,
    contactName: input.contactName,
    email: input.email,
    emailNormalized: input.email.toLowerCase(),
    phone: input.phone || null,
    website: input.website || null,
    advertisedOffer: input.advertisedOffer,
    brandColors: input.brandColors || null,
    adCopy: input.adCopy || null,
    advertiserDisclaimer: input.advertiserDisclaimer,
    termsVersion: typeof campaign.termsVersion === 'string' ? campaign.termsVersion : null,
    fundingPolicyVersion: typeof campaign.fundingPolicyVersion === 'string'
      ? campaign.fundingPolicyVersion
      : null,
    termsAcceptedAt: acceptedAt,
    refundPolicyAcceptedAt: acceptedAt,
    proofAcknowledgedAt: acceptedAt,
  };
}

export async function POST(request: NextRequest) {
  const limit = consumeRateLimit(requestFingerprint(request, 'reservation'), 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many submissions. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds) } },
    );
  }

  const parsed = reservationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Review the required reservation details.' }, { status: 400 });
  }
  if (parsed.data.companySite) return NextResponse.json({ status: 'received' });

  let db;
  try {
    db = getAdminFirestore();
  } catch {
    return NextResponse.json(
      { error: 'The campaign database is not configured for submissions.' },
      { status: 503 },
    );
  }

  const campaignRef = db.collection('campaigns').doc(parsed.data.campaignId);
  const campaignSnapshot = await campaignRef.get();
  if (!campaignSnapshot.exists) {
    return NextResponse.json(
      { error: 'The real pre-launch campaign record has not been initialized.' },
      { status: 503 },
    );
  }
  const campaign = campaignSnapshot.data()!;
  const initialRoutePlanId = typeof campaign.routePlanId === 'string' ? campaign.routePlanId : null;
  const initialRoutePlanSnapshot = initialRoutePlanId
    ? await db.collection('routeplans').doc(initialRoutePlanId).get()
    : null;
  const initialEvidenceBlockReason = campaignOperationalEvidenceBlockReason(
    parsed.data.campaignId,
    campaign,
    initialRoutePlanId,
    initialRoutePlanSnapshot?.data(),
  );
  const category = (campaign.categories as DocumentData[] | undefined)?.find(
    (item) => item.slug === parsed.data.categorySlug,
  );
  if (!category) return NextResponse.json({ error: 'Select a listed category.' }, { status: 400 });

  const reference = publicReference();
  const submission = baseSubmission(parsed.data, reference, campaign);
  const activeCampaignModel = campaignMatchesActiveSharedModel(campaign);
  const accessToken = randomBytes(32).toString('base64url');
  const accessTokenHash = sha256(accessToken);
  const normalizedInvitationCode = parsed.data.invitationCode.trim().toUpperCase();
  const invitationRef = normalizedInvitationCode
    ? db.collection('reservationinvites').doc(sha256(normalizedInvitationCode))
    : null;
  const invitationSnapshot = invitationRef ? await invitationRef.get() : null;
  const invitation = invitationSnapshot?.data();
  if (normalizedInvitationCode && (
    !invitation
    || invitation.status !== 'active'
    || invitation.campaignId !== parsed.data.campaignId
    || invitation.planId !== FOUNDING_CAMPAIGN.planId
    || invitation.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
    || invitation.categorySlug !== parsed.data.categorySlug
    || invitation.placementSize !== parsed.data.placementSize
    || invitation.emailNormalized !== parsed.data.email.toLowerCase()
    || !(invitation.expiresAt instanceof Timestamp)
    || invitation.expiresAt.toMillis() <= Date.now()
  )) {
    return NextResponse.json({ error: 'The owner-issued invitation is invalid, expired, or does not match this request.' }, { status: 409 });
  }
  const deadlineMs = campaign.reservationDeadline ? Date.parse(String(campaign.reservationDeadline)) : Number.NaN;
  const approvedContractVersions = getApprovedCampaignContractVersions(campaign);

  const canCreatePaidHold =
    RESERVATION_OPEN_STATUSES.has(String(campaign.status)) &&
    campaign.paymentActivation === true &&
    campaign.paymentsEnabled === true &&
    process.env.PAYMENTS_ENABLED === 'true' &&
    Boolean(process.env.STRIPE_SECRET_KEY) &&
    Boolean(process.env.STRIPE_WEBHOOK_SECRET) &&
    Boolean(process.env.BUSINESS_POSTAL_ADDRESS) &&
    campaign.artworkPreflightApproved === true &&
    campaign.economicsVerified === true &&
    campaign.routesConfirmed === true &&
    initialEvidenceBlockReason === null &&
    activeCampaignModel &&
    approvedContractVersions !== null &&
    Number.isFinite(deadlineMs) &&
    deadlineMs > Date.now() &&
    category.status === 'available' &&
    (category.sensitive !== true || invitation?.sensitiveCategoryApproved === true) &&
    invitation?.status === 'active';

  if (!canCreatePaidHold) {
    const duplicateId = sha256(
      `${parsed.data.campaignId}:${parsed.data.email.toLowerCase()}:${parsed.data.categorySlug}`,
    ).slice(0, 48);
    const interestRef = db.collection('reservationinterests').doc(duplicateId);
    try {
      await interestRef.create({
        ...submission,
        accessTokenHash,
        status: category.sensitive === true ? 'manual_review' : 'interested',
        reason: !RESERVATION_OPEN_STATUSES.has(String(campaign.status))
          ? 'campaign_not_accepting_reservations'
          : !activeCampaignModel
            ? 'campaign_model_mismatch'
          : category.sensitive === true
            ? 'sensitive_category_review'
            : 'payments_not_activated',
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const code = (error as { code?: number | string }).code;
      if (code === 6 || code === 'already-exists') {
        return NextResponse.json({ error: 'This email already has an interest record for that category.' }, { status: 409 });
      }
      return NextResponse.json({ error: 'Interest could not be recorded.' }, { status: 500 });
    }

    const notification = await sendEmail({
      to: 'hello@californiamailer.com',
      subject: `Founding mailer interest: ${parsed.data.businessName}`,
      text: [
        'A database interest record was created.',
        `Reference: ${reference}`,
        `Business: ${parsed.data.businessName}`,
        `Contact: ${parsed.data.contactName}`,
        `Email: ${parsed.data.email}`,
        `Phone: ${parsed.data.phone || 'not provided'}`,
        `Category: ${category.name}`,
        `Placement: ${parsed.data.placementSize}`,
        'No hold, payment, or funding was created.',
      ].join('\n'),
    });
    await interestRef.set({
      ownerNotificationStatus: notification.success ? 'delivered_to_provider' : 'delivery_failed',
      ownerNotificationUpdatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return NextResponse.json({
      status: category.sensitive === true ? 'manual_review' : 'interested',
      reference,
      message: 'Your interest was recorded. No category hold or payment has been created.',
    });
  }

  const reservationRef = db.collection('reservations').doc();
  const duplicateRef = db
    .collection('reservationdedupe')
    .doc(sha256(`${parsed.data.campaignId}:${parsed.data.email.toLowerCase()}`));
  const categories = Array.isArray(campaign.categories) ? campaign.categories as DocumentData[] : [];
  const reverseConflicts = categories
    .filter((candidate) => Array.isArray(candidate.conflictsWith) && candidate.conflictsWith.includes(parsed.data.categorySlug))
    .map((candidate) => String(candidate.slug));
  const claimSlugs = [...new Set([
    parsed.data.categorySlug,
    ...(Array.isArray(category.conflictsWith) ? category.conflictsWith.map(String) : []),
    ...reverseConflicts,
  ])];
  const claimRefs = claimSlugs.map((slug) =>
    db.collection('categoryclaims').doc(`${parsed.data.campaignId}__${slug}`),
  );
  const placement = campaign.placements?.[parsed.data.placementSize];
  if (!placement || Number(placement.total) < 1) {
    return NextResponse.json({ error: 'That placement size is not configured.' }, { status: 409 });
  }
  const slotRefs: DocumentReference[] = Array.from({ length: Number(placement.total) }, (_, index) =>
    db.collection('placementslots').doc(
      `${parsed.data.campaignId}__${parsed.data.placementSize}__${String(index + 1).padStart(2, '0')}`,
    ),
  );
  const holdExpiresAt = Timestamp.fromMillis(Date.now() + Number(campaign.holdMinutes || 60) * 60_000);

  let reservedContractVersions: ApprovedCampaignContractVersions | null = null;
  try {
    reservedContractVersions = await db.runTransaction(async (transaction) => {
      const currentCampaignSnapshot = await transaction.get(campaignRef);
      const currentCampaign = currentCampaignSnapshot.data();
      if (!currentCampaign || !campaignMatchesActiveSharedModel(currentCampaign)) {
        throw new Error('campaign-model-mismatch');
      }
      const currentRoutePlanId = typeof currentCampaign.routePlanId === 'string'
        ? currentCampaign.routePlanId
        : null;
      const currentRoutePlanSnapshot = currentRoutePlanId
        ? await transaction.get(db.collection('routeplans').doc(currentRoutePlanId))
        : null;
      const currentDeadlineMs = currentCampaign.reservationDeadline
        ? Date.parse(String(currentCampaign.reservationDeadline))
        : Number.NaN;
      const currentContractVersions = getApprovedCampaignContractVersions(currentCampaign);
      if (
        !RESERVATION_OPEN_STATUSES.has(String(currentCampaign.status))
        || currentCampaign.paymentActivation !== true
        || currentCampaign.paymentsEnabled !== true
        || currentCampaign.artworkPreflightApproved !== true
        || currentCampaign.economicsVerified !== true
        || currentCampaign.routesConfirmed !== true
        || campaignOperationalEvidenceBlockReason(
          parsed.data.campaignId,
          currentCampaign,
          currentRoutePlanId,
          currentRoutePlanSnapshot?.data(),
        ) !== null
        || !currentContractVersions
        || !Number.isFinite(currentDeadlineMs)
        || currentDeadlineMs <= Date.now()
      ) {
        throw new Error('campaign-unavailable');
      }
      const duplicate = await transaction.get(duplicateRef);
      let previousReservation: DocumentSnapshot<DocumentData> | null = null;
      if (duplicate.exists && duplicate.data()?.active !== false) {
        const previousId = String(duplicate.data()?.reservationId || '');
        if (!previousId) throw new Error('duplicate-reservation');
        previousReservation = await transaction.get(db.collection('reservations').doc(previousId));
        const previous = previousReservation.data();
        if (previous && (
          ['paid', 'disputed', 'payment_review'].includes(String(previous.status))
          || isLiveInventoryState({ status: previous.status, expiresAt: previous.holdExpiresAt }, Date.now())
        )) throw new Error('duplicate-reservation');
      }
      const claimSnapshots = await Promise.all(claimRefs.map((ref) => transaction.get(ref)));
      const conflict = claimSnapshots.find((snapshot) => isLiveInventoryState(snapshot.data(), Date.now()));
      if (conflict) throw new Error('category-conflict');
      const slotSnapshots = await Promise.all(slotRefs.map((ref) => transaction.get(ref)));
      const freeSlot = slotSnapshots.find((snapshot) => {
        const data = snapshot.data();
        return !data
          || data.status === 'available'
          || (['hold', 'awaiting_payment'].includes(String(data.status)) && !isLiveInventoryState(data, Date.now()));
      });
      if (!freeSlot) throw new Error('placement-unavailable');
      const freeSlotIndex = slotSnapshots.findIndex((snapshot) => snapshot.id === freeSlot.id);
      if (freeSlotIndex < 0) throw new Error('placement-unavailable');
      if (!invitationRef) throw new Error('invitation-required');
      const currentInvitation = await transaction.get(invitationRef);
      const invite = currentInvitation.data();
      if (!invite || invite.status !== 'active' || invite.reservationId
        || invite.campaignId !== parsed.data.campaignId
        || invite.emailNormalized !== parsed.data.email.toLowerCase()
        || invite.planId !== FOUNDING_CAMPAIGN.planId
        || invite.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
        || invite.categorySlug !== parsed.data.categorySlug
        || invite.placementSize !== parsed.data.placementSize
        || !(invite.expiresAt instanceof Timestamp)
        || invite.expiresAt.toMillis() <= Date.now()) throw new Error('invitation-required');
      const inviteInterestId = typeof invite.interestId === 'string' ? invite.interestId : '';
      if (!/^[A-Za-z0-9_-]{10,100}$/.test(inviteInterestId)) throw new Error('invitation-required');
      const inviteInterestRef = db.collection('reservationinterests').doc(inviteInterestId);
      const currentInterest = await transaction.get(inviteInterestRef);
      const interest = currentInterest.data();
      if (
        !interest
        || interest.status !== 'invited'
        || interest.inviteStatus !== 'active'
        || interest.inviteId !== invitationRef.id
        || interest.doNotContact === true
        || interest.suppressed === true
        || ['dismissed', 'do_not_contact', 'suppressed'].includes(String(interest.status))
        || interest.campaignId !== parsed.data.campaignId
        || interest.planId !== FOUNDING_CAMPAIGN.planId
        || interest.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
        || interest.invitedPlanId !== FOUNDING_CAMPAIGN.planId
        || interest.invitedOfferModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
        || interest.emailNormalized !== parsed.data.email.toLowerCase()
        || interest.categorySlug !== parsed.data.categorySlug
        || interest.placementSize !== parsed.data.placementSize
      ) throw new Error('invitation-required');

      transaction.create(reservationRef, {
        ...submission,
        termsVersion: currentContractVersions.termsVersion,
        fundingPolicyVersion: currentContractVersions.fundingPolicyVersion,
        accessTokenHash,
        quotedPriceCents: Number(placement.priceCents),
        claimSlugs,
        status: 'hold',
        holdExpiresAt,
        placementSlotId: freeSlot.id,
        proofSequence: 0,
        materialSequence: 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(duplicateRef, {
        reservationId: reservationRef.id,
        active: true,
        expiresAt: holdExpiresAt,
        createdAt: FieldValue.serverTimestamp(),
      });
      for (const slug of claimSlugs) {
        transaction.set(db.collection('categoryclaims').doc(`${parsed.data.campaignId}__${slug}`), {
          campaignId: parsed.data.campaignId,
          planId: FOUNDING_CAMPAIGN.planId,
          offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
          categorySlug: slug,
          reservedCategorySlug: parsed.data.categorySlug,
          reservationId: reservationRef.id,
          placementSlotId: freeSlot.id,
          status: 'hold',
          expiresAt: holdExpiresAt,
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      transaction.set(freeSlot.ref, {
        campaignId: parsed.data.campaignId,
        planId: FOUNDING_CAMPAIGN.planId,
        offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
        size: parsed.data.placementSize,
        position: freeSlot.data()?.position ?? freeSlotIndex + 1,
        reservationId: reservationRef.id,
        status: 'hold',
        expiresAt: holdExpiresAt,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(invitationRef, {
        status: 'consumed',
        reservationId: reservationRef.id,
        consumedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(inviteInterestRef, {
        status: 'reserved',
        inviteStatus: 'consumed',
        reservationId: reservationRef.id,
        inviteConsumedAt: FieldValue.serverTimestamp(),
        reviewedAt: FieldValue.serverTimestamp(),
      });
      if (previousReservation?.exists && ['hold', 'awaiting_payment'].includes(String(previousReservation.data()?.status))) {
        transaction.update(previousReservation.ref, { status: 'expired', updatedAt: FieldValue.serverTimestamp() });
      }
      return currentContractVersions;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const publicMessage = message === 'category-conflict'
      ? 'That category or a conflicting category is already held or sold.'
      : message === 'placement-unavailable'
        ? 'That placement size is no longer available.'
        : message === 'campaign-model-mismatch' || message === 'campaign-unavailable'
          ? 'This campaign is not available for a paid hold.'
      : message === 'duplicate-reservation'
          ? 'This email already has an active reservation in this campaign.'
          : message === 'invitation-required'
            ? 'A valid unused owner invitation is required to create a hold.'
          : 'The reservation could not be created.';
    return NextResponse.json({ error: publicMessage }, { status: message ? 409 : 500 });
  }

  if (!reservedContractVersions) {
    return NextResponse.json({ error: 'The reservation contract versions could not be verified.' }, { status: 500 });
  }

  let checkoutUrl: string | null = null;
  if (process.env.STRIPE_SECRET_KEY) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    let createdSession: Stripe.Checkout.Session | null = null;
    try {
      const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin).replace(/\/$/, '');
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: parsed.data.email,
        line_items: [{
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Number(placement.priceCents),
            product_data: {
              name: `${campaign.title} — ${parsed.data.placementSize} placement`,
              description: `${category.name} category; campaign funding policy ${reservedContractVersions.fundingPolicyVersion}`,
            },
          },
        }],
        metadata: {
          reservationId: reservationRef.id,
          campaignId: parsed.data.campaignId,
          planId: FOUNDING_CAMPAIGN.planId,
          offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
          categorySlug: parsed.data.categorySlug,
          quotedPriceCents: String(placement.priceCents),
          termsVersion: reservedContractVersions.termsVersion,
          fundingPolicyVersion: reservedContractVersions.fundingPolicyVersion,
        },
        payment_intent_data: {
          metadata: {
            reservationId: reservationRef.id,
            campaignId: parsed.data.campaignId,
            planId: FOUNDING_CAMPAIGN.planId,
            offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
            termsVersion: reservedContractVersions.termsVersion,
            fundingPolicyVersion: reservedContractVersions.fundingPolicyVersion,
          },
        },
        success_url: `${siteUrl}/reservation/${reservationRef.id}?checkout=returned`,
        cancel_url: `${siteUrl}/reservation/${reservationRef.id}?checkout=cancelled`,
        expires_at: Math.floor(holdExpiresAt.toMillis() / 1000),
      });
      createdSession = session;
      if (!session.url) throw new Error('checkout-url-missing');

      await db.runTransaction(async (transaction) => {
        const [currentReservationSnapshot, currentCampaignSnapshot] = await Promise.all([
          transaction.get(reservationRef),
          transaction.get(campaignRef),
        ]);
        const currentReservation = currentReservationSnapshot.data();
        const currentCampaign = currentCampaignSnapshot.data();
        if (!currentReservation || !currentCampaign || !campaignMatchesActiveSharedModel(currentCampaign)) {
          throw new Error('checkout-binding-model-mismatch');
        }
        const currentRoutePlanId = typeof currentCampaign.routePlanId === 'string'
          ? currentCampaign.routePlanId
          : null;
        const currentRoutePlanSnapshot = currentRoutePlanId
          ? await transaction.get(db.collection('routeplans').doc(currentRoutePlanId))
          : null;
        const currentDeadlineMs = currentCampaign.reservationDeadline
          ? Date.parse(String(currentCampaign.reservationDeadline))
          : Number.NaN;
        const currentContractVersions = getApprovedCampaignContractVersions(currentCampaign);
        if (
          !RESERVATION_OPEN_STATUSES.has(String(currentCampaign.status))
          || currentCampaign.paymentActivation !== true
          || currentCampaign.paymentsEnabled !== true
          || currentCampaign.artworkPreflightApproved !== true
          || currentCampaign.economicsVerified !== true
          || currentCampaign.routesConfirmed !== true
          || campaignOperationalEvidenceBlockReason(
            parsed.data.campaignId,
            currentCampaign,
            currentRoutePlanId,
            currentRoutePlanSnapshot?.data(),
          ) !== null
          || !currentContractVersions
          || currentContractVersions.termsVersion !== reservedContractVersions.termsVersion
          || currentContractVersions.fundingPolicyVersion !== reservedContractVersions.fundingPolicyVersion
          || !Number.isFinite(currentDeadlineMs)
          || currentDeadlineMs <= Date.now()
        ) {
          throw new Error('checkout-binding-campaign-unavailable');
        }
        if (
          currentReservation.campaignId !== parsed.data.campaignId
          || currentReservation.planId !== FOUNDING_CAMPAIGN.planId
          || currentReservation.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
          || currentReservation.status !== 'hold'
          || currentReservation.stripeCheckoutSessionId
          || currentReservation.termsVersion !== reservedContractVersions.termsVersion
          || currentReservation.fundingPolicyVersion !== reservedContractVersions.fundingPolicyVersion
          || Number(currentReservation.quotedPriceCents) !== Number(session.amount_total)
          || !(currentReservation.holdExpiresAt instanceof Timestamp)
          || currentReservation.holdExpiresAt.toMillis() <= Date.now()
        ) {
          throw new Error('checkout-binding-reservation-unavailable');
        }
        const currentSlotRef = db.collection('placementslots').doc(String(currentReservation.placementSlotId));
        const [currentClaimSnapshots, currentSlotSnapshot] = await Promise.all([
          Promise.all(claimRefs.map((ref) => transaction.get(ref))),
          transaction.get(currentSlotRef),
        ]);
        if (
          !currentClaimSnapshots.every((snapshot) => snapshot.data()?.reservationId === reservationRef.id)
          || currentSlotSnapshot.data()?.reservationId !== reservationRef.id
        ) {
          throw new Error('checkout-binding-inventory-mismatch');
        }
        transaction.update(reservationRef, {
          status: 'awaiting_payment',
          stripeCheckoutSessionId: session.id,
          checkoutCreatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      // A live URL is disclosed only after its session ID is durably bound.
      checkoutUrl = session.url;
    } catch {
      checkoutUrl = null;
      if (createdSession) {
        try {
          await stripe.checkout.sessions.expire(createdSession.id);
        } catch {
          // The URL remains private even if Stripe cannot expire the orphan immediately.
        }
      }
    }
  }

  let projectionStatus: 'synced' | 'sync_failed' = 'synced';
  try {
    await syncCampaignState(db, parsed.data.campaignId);
  } catch {
    projectionStatus = 'sync_failed';
  }
  const holdNotification = await sendEmail({
    to: 'hello@californiamailer.com',
    subject: `Founding mailer hold: ${parsed.data.businessName}`,
    text: [
      'A real owner-invited category hold was created.',
      `Reference: ${reference}`,
      `Business: ${parsed.data.businessName}`,
      `Contact: ${parsed.data.contactName} <${parsed.data.email}>`,
      `Category: ${category.name}`,
      `Placement: ${parsed.data.placementSize}`,
      `Checkout: ${checkoutUrl ? 'hosted link created' : 'unavailable; no payment'}`,
      `Public projection: ${projectionStatus}`,
    ].join('\n'),
  });
  await reservationRef.set({
    ownerNotificationStatus: holdNotification.success ? 'delivered_to_provider' : 'delivery_failed',
    projectionStatus,
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  const response = NextResponse.json({
    status: checkoutUrl ? 'awaiting_payment' : 'hold',
    reference,
    reservationId: reservationRef.id,
    holdExpiresAt: holdExpiresAt.toDate().toISOString(),
    checkoutUrl,
    projectionStatus,
    message: checkoutUrl
      ? 'Your category hold is ready for hosted checkout.'
      : 'Your category hold was recorded, but hosted checkout is unavailable. No payment has been made.',
  });
  response.cookies.set(reservationCookieName(reservationRef.id), accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Stripe returns by a cross-site top-level navigation; Lax keeps the
    // private cookie available without permitting cross-site subrequests.
    sameSite: 'lax',
    path: '/',
    maxAge: 90 * 24 * 60 * 60,
  });
  return response;
}
