import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, type DocumentData, type DocumentReference, type Firestore } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import {
  FOUNDING_CAMPAIGN,
  campaignMatchesActiveSharedModel,
  getApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import {
  RESERVATION_OPEN_STATUSES,
  syncCampaignState,
} from '@/lib/campaignSync';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  campaignOperationalEvidenceBlockReason,
  type CampaignOperationalEvidenceBlockReason,
} from '@/lib/campaignOperationalGates';
import {
  isActiveRefundObligationStatus,
  isKnownRefundRecordStatus,
} from '@/lib/businessRules';

function objectId(value: string | { id: string } | null): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

function reservationClaimSlugs(reservation: Record<string, unknown>): string[] {
  const stored = Array.isArray(reservation.claimSlugs) ? reservation.claimSlugs.map(String) : [];
  return [...new Set(stored.length ? stored : [String(reservation.categorySlug)])];
}

function reservationDedupeId(campaignId: string, emailNormalized: string): string {
  return createHash('sha256').update(`${campaignId}:${emailNormalized}`).digest('hex');
}

function reservationTrackingRef(
  db: Firestore,
  reservation: DocumentData,
): DocumentReference | null {
  const trackingId = typeof reservation.trackingId === 'string' ? reservation.trackingId : '';
  return /^[A-Za-z0-9_-]{20,40}$/.test(trackingId)
    ? db.collection('trackinglinks').doc(trackingId)
    : null;
}

function trackingBelongsToReservation(
  tracking: DocumentData | undefined,
  trackingId: string,
  reservationId: string,
  campaignId: string,
): boolean {
  return Boolean(
    tracking
    && tracking.reservationId === reservationId
    && tracking.campaignId === campaignId
    && trackingId,
  );
}

function campaignPaymentBlockReason(
  campaign: DocumentData | undefined,
  providerEventOccurredAtMs = Date.now(),
  evidenceBlockReason: CampaignOperationalEvidenceBlockReason | null = null,
): string | null {
  if (!Number.isFinite(providerEventOccurredAtMs) || providerEventOccurredAtMs <= 0) {
    return 'provider_event_time_invalid';
  }
  if (!campaign) return 'campaign_not_found';
  if (!campaignMatchesActiveSharedModel(campaign)) return 'campaign_model_mismatch';
  if (!RESERVATION_OPEN_STATUSES.has(String(campaign.status))) return 'campaign_not_accepting_payments';
  if (campaign.paymentActivation !== true || campaign.paymentsEnabled !== true) {
    return 'campaign_payments_deactivated';
  }
  if (campaign.artworkPreflightApproved !== true) return 'campaign_artwork_preflight_not_approved';
  if (campaign.economicsVerified !== true) return 'campaign_economics_not_verified';
  if (campaign.routesConfirmed !== true) return 'campaign_routes_not_confirmed';
  if (evidenceBlockReason) return evidenceBlockReason.replaceAll('-', '_');
  if (!getApprovedCampaignContractVersions(campaign)) return 'campaign_contract_not_approved';
  const reservationDeadlineMs = campaign.reservationDeadline
    ? Date.parse(String(campaign.reservationDeadline))
    : Number.NaN;
  if (!Number.isFinite(reservationDeadlineMs)) return 'campaign_reservation_deadline_invalid';
  if (reservationDeadlineMs <= providerEventOccurredAtMs) return 'campaign_reservation_deadline_passed';
  return null;
}

function capturedCheckoutDisposition(
  paymentBlockReason: string | null,
  inventoryOwned: boolean,
  existingPaymentStatus: unknown,
) {
  if (paymentBlockReason) {
    return {
      paymentStatus: 'manual_review' as const,
      reviewReason: 'late_payment_not_acceptable_current_state',
      refundRequired: true,
    };
  }
  if (!inventoryOwned) {
    return {
      paymentStatus: 'manual_review' as const,
      reviewReason: 'inventory_ownership_mismatch',
      refundRequired: true,
    };
  }
  if (existingPaymentStatus === 'manual_review') {
    return {
      paymentStatus: 'manual_review' as const,
      reviewReason: 'existing_payment_manual_review',
      refundRequired: true,
    };
  }
  return {
    paymentStatus: 'cleared' as const,
    reviewReason: null,
    refundRequired: false,
  };
}

function requiredCapturedRefundStatus(existingStatus: unknown) {
  return ['requested', 'approved', 'submitted'].includes(String(existingStatus))
    ? String(existingStatus) as 'requested' | 'approved' | 'submitted'
    : 'requested';
}

function capturedManualReviewRefundId(campaignId: string, reservationId: string) {
  // Preserve the original deterministic identifier so deployed records remain idempotent.
  return `${campaignId}__late_payment__${reservationId}`;
}

function activeOtherRefundObligationCents(
  documents: Array<{ id: string; data(): DocumentData }>,
  excludedRefundId: string,
  expected: {
    campaignId: string;
    paymentId: string;
    reservationId: string;
  },
) {
  let total = 0;
  for (const document of documents) {
    const data = document.data();
    if (!isKnownRefundRecordStatus(data.status)) {
      throw new Error('refund-obligation-status-invalid');
    }
    if (
      data.campaignId !== expected.campaignId
      || data.paymentId !== expected.paymentId
      || data.reservationId !== expected.reservationId
    ) {
      throw new Error('refund-obligation-binding-mismatch');
    }
    const amountCents = data.amountCents;
    if (
      !Number.isSafeInteger(amountCents)
      || amountCents < 0
      || (data.status === 'covered' && amountCents !== 0)
      || (!['covered', 'confirmed'].includes(data.status) && amountCents === 0)
    ) {
      throw new Error('refund-obligation-amount-invalid');
    }
    if (document.id === excludedRefundId || !isActiveRefundObligationStatus(data.status)) continue;
    total += amountCents;
    if (!Number.isSafeInteger(total)) throw new Error('refund-obligation-amount-invalid');
  }
  return total;
}

function capturedManualReviewRefundAmounts(
  originalAmountCents: number,
  providerRefundedCents: number,
  coveredByOtherObligationsCents = 0,
) {
  if (
    !Number.isSafeInteger(originalAmountCents)
    || originalAmountCents <= 0
    || !Number.isSafeInteger(providerRefundedCents)
    || providerRefundedCents < 0
    || providerRefundedCents > originalAmountCents
    || !Number.isSafeInteger(coveredByOtherObligationsCents)
    || coveredByOtherObligationsCents < 0
    || coveredByOtherObligationsCents > originalAmountCents - providerRefundedCents
  ) {
    throw new Error('captured-manual-review-refund-amount-invalid');
  }
  return {
    amountCents: originalAmountCents - providerRefundedCents - coveredByOtherObligationsCents,
    originalAmountCents,
    providerRefundedCents,
    coveredByOtherObligationsCents,
  };
}

function assertCapturedManualReviewRefundIdentity(
  refund: DocumentData | undefined,
  expected: {
    campaignId: string;
    paymentId: string;
    reservationId: string;
    originalAmountCents: number;
    providerRefundedCents: number;
    externalSessionId: string | null;
    externalPaymentId: string;
  },
) {
  if (!refund) return;
  const expectedAmountCents = expected.originalAmountCents - expected.providerRefundedCents;
  const hasStoredBalance = refund.originalAmountCents !== undefined
    || refund.providerRefundedCents !== undefined
    || refund.coveredByOtherObligationsCents !== undefined;
  const storedOriginalAmountCents = Number(refund.originalAmountCents);
  const storedProviderRefundedCents = Number(refund.providerRefundedCents || 0);
  const storedCoveredByOtherObligationsCents = Number(refund.coveredByOtherObligationsCents || 0);
  const storedAmountCents = Number(refund.amountCents);
  const storedBalanceMismatch = hasStoredBalance
    ? storedOriginalAmountCents !== expected.originalAmountCents
      || !Number.isSafeInteger(storedProviderRefundedCents)
      || storedProviderRefundedCents < 0
      || storedProviderRefundedCents > expected.providerRefundedCents
      || !Number.isSafeInteger(storedCoveredByOtherObligationsCents)
      || storedCoveredByOtherObligationsCents < 0
      || storedAmountCents !== storedOriginalAmountCents
        - storedProviderRefundedCents
        - storedCoveredByOtherObligationsCents
    : storedAmountCents !== expected.originalAmountCents
      && storedAmountCents !== expectedAmountCents;
  if (
    refund.campaignId !== expected.campaignId
    || refund.paymentId !== expected.paymentId
    || refund.reservationId !== expected.reservationId
    || storedBalanceMismatch
    || (refund.externalSessionId && expected.externalSessionId && refund.externalSessionId !== expected.externalSessionId)
    || (refund.externalPaymentId && refund.externalPaymentId !== expected.externalPaymentId)
  ) {
    throw new Error('captured-manual-review-refund-obligation-mismatch');
  }
}

function isTerminalCheckoutPaymentStatus(status: unknown) {
  return ['partially_refunded', 'refunded', 'disputed'].includes(String(status));
}

function isCaptureBackedManualReview(
  payment: DocumentData | undefined,
  refund: DocumentData | undefined,
) {
  const requiredRefund = refund?.requiredFullRefund === true
    || ['captured_manual_review_webhook', 'late_payment_webhook'].includes(String(refund?.source));
  const requiredRefundEvidence = requiredRefund
    && ['requested', 'approved', 'submitted', 'confirmed'].includes(String(refund?.status));
  return Boolean(payment?.providerCaptureReportedAt) || requiredRefundEvidence;
}

function isTerminalClosedDisputeReplay(
  currentPayment: DocumentData | undefined,
  dispute: Pick<Stripe.Dispute, 'id' | 'status'>,
  closed: boolean,
) {
  return Boolean(
    closed
    && currentPayment?.disputeId === dispute.id
    && currentPayment.disputeStatus === dispute.status
    && currentPayment.disputeOutcome === dispute.status
    && currentPayment.disputeClosedAt,
  );
}

function releasedSlotStatus(campaign: DocumentData | undefined): 'available' | 'paused' {
  return RESERVATION_OPEN_STATUSES.has(String(campaign?.status)) ? 'available' : 'paused';
}

interface EventLease {
  shouldProcess: boolean;
  leaseId: string | null;
}

async function beginEvent(db: Firestore, event: Stripe.Event, body: string): Promise<EventLease> {
  const ref = db.collection('paymentevents').doc(event.id);
  const payloadSha256 = createHash('sha256').update(body).digest('hex');
  const leaseId = randomBytes(18).toString('base64url');
  return db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (current.data()?.payloadSha256 && current.data()?.payloadSha256 !== payloadSha256) {
      throw new Error('event-payload-mismatch');
    }
    if (current.data()?.status === 'processed') return { shouldProcess: false, leaseId: null };
    const updatedAt = current.data()?.updatedAt;
    if (
      current.data()?.status === 'processing' &&
      updatedAt instanceof Timestamp &&
      updatedAt.toMillis() > Date.now() - 5 * 60_000
    ) {
      throw new Error('event-processing');
    }
    transaction.set(ref, {
      provider: 'stripe',
      eventType: event.type,
      status: 'processing',
      payloadSha256,
      leaseId,
      attempts: Number(current.data()?.attempts || 0) + 1,
      createdAt: current.data()?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { shouldProcess: true, leaseId };
  });
}

async function finishEvent(db: Firestore, eventId: string, leaseId: string, status: 'processed' | 'failed', detail: string) {
  const ref = db.collection('paymentevents').doc(eventId);
  await db.runTransaction(async (transaction) => {
    const current = await transaction.get(ref);
    if (current.data()?.leaseId !== leaseId) return;
    transaction.set(ref, {
      status,
      detail,
      leaseId: null,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function applyCheckoutSession(
  db: Firestore,
  session: Stripe.Checkout.Session,
  providerEventOccurredAtMs: number,
) {
  const reservationId = session.metadata?.reservationId;
  const campaignId = session.metadata?.campaignId;
  const planId = session.metadata?.planId;
  const offerModelVersion = session.metadata?.offerModelVersion;
  if (!reservationId || !campaignId || !planId || !offerModelVersion) throw new Error('missing-reservation-metadata');
  if (
    campaignId !== FOUNDING_CAMPAIGN.id
    || planId !== FOUNDING_CAMPAIGN.planId
    || offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
  ) throw new Error('inactive-offer-model');
  const paymentIntentId = objectId(session.payment_intent);
  if (!paymentIntentId) throw new Error('missing-payment-intent');

  const reservationRef = db.collection('reservations').doc(reservationId);
  const paymentRef = db.collection('payments').doc(reservationId);
  const campaignRef = db.collection('campaigns').doc(campaignId);
  const capturedRefundId = capturedManualReviewRefundId(campaignId, reservationId);
  const capturedRefundRef = db.collection('refunds').doc(capturedRefundId);
  const capturedRefundAuditRef = db.collection('auditlog').doc(capturedRefundId);
  const refundObligationsQuery = db.collection('refunds').where('paymentId', '==', paymentRef.id);

  await db.runTransaction(async (transaction) => {
    const [reservationSnapshot, campaignSnapshot] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(campaignRef),
    ]);
    if (!reservationSnapshot.exists) throw new Error('reservation-not-found');
    const reservation = reservationSnapshot.data()!;
    const campaign = campaignSnapshot.data();
    if (reservation.campaignId !== campaignId) throw new Error('campaign-mismatch');
    if (reservation.planId !== planId || reservation.offerModelVersion !== offerModelVersion) {
      throw new Error('reservation-offer-model-mismatch');
    }
    if (reservation.stripeCheckoutSessionId !== session.id) throw new Error('checkout-session-mismatch');
    if (Number(session.amount_total || 0) !== Number(reservation.quotedPriceCents)) {
      throw new Error('amount-mismatch');
    }

    const claimRefs = reservationClaimSlugs(reservation).map((slug) =>
      db.collection('categoryclaims').doc(`${campaignId}__${slug}`),
    );
    const slotRef = db.collection('placementslots').doc(String(reservation.placementSlotId));
    const routePlanId = typeof campaign?.routePlanId === 'string' ? campaign.routePlanId : null;
    const [
      claimSnapshots,
      slotSnapshot,
      paymentSnapshot,
      capturedRefundSnapshot,
      refundObligationsSnapshot,
      routePlanSnapshot,
    ] = await Promise.all([
      Promise.all(claimRefs.map((ref) => transaction.get(ref))),
      transaction.get(slotRef),
      transaction.get(paymentRef),
      transaction.get(capturedRefundRef),
      transaction.get(refundObligationsQuery),
      routePlanId ? transaction.get(db.collection('routeplans').doc(routePlanId)) : Promise.resolve(null),
    ]);
    const currentPayment = paymentSnapshot.data();
    if (currentPayment?.reservationId && currentPayment.reservationId !== reservationId) {
      throw new Error('payment-reservation-mismatch');
    }
    if (currentPayment?.externalSessionId && currentPayment.externalSessionId !== session.id) {
      throw new Error('payment-session-mismatch');
    }
    if (currentPayment?.externalPaymentId && currentPayment.externalPaymentId !== paymentIntentId) {
      throw new Error('payment-intent-mismatch');
    }
    if (currentPayment?.currency && currentPayment.currency !== (session.currency || 'usd')) {
      throw new Error('payment-currency-mismatch');
    }
    if (currentPayment?.amountCents && Number(currentPayment.amountCents) !== Number(session.amount_total || 0)) {
      throw new Error('payment-amount-mismatch');
    }
    const cleared = session.payment_status === 'paid';
    if (isTerminalCheckoutPaymentStatus(currentPayment?.status)) return;
    if (currentPayment?.status === 'cleared' && !cleared) return;
    if (currentPayment?.status === 'cleared' && cleared) return;

    const inventoryOwned = claimSnapshots.every((snapshot) => snapshot.data()?.reservationId === reservationId)
      && slotSnapshot.data()?.reservationId === reservationId;
    const currentContractVersions = campaign ? getApprovedCampaignContractVersions(campaign) : null;
    const holdExpiresAtMs = reservation.holdExpiresAt instanceof Timestamp
      ? reservation.holdExpiresAt.toMillis()
      : Number.NaN;
    const evidenceBlockReason = campaignOperationalEvidenceBlockReason(
      campaignId,
      campaign,
      routePlanId,
      routePlanSnapshot?.data(),
      providerEventOccurredAtMs,
    );
    const paymentBlockReason = campaignPaymentBlockReason(
      campaign,
      providerEventOccurredAtMs,
      evidenceBlockReason,
    )
      ?? (
        !currentContractVersions
        || currentContractVersions.termsVersion !== reservation.termsVersion
        || currentContractVersions.fundingPolicyVersion !== reservation.fundingPolicyVersion
        || session.metadata?.termsVersion !== reservation.termsVersion
        || session.metadata?.fundingPolicyVersion !== reservation.fundingPolicyVersion
          ? 'checkout_contract_version_mismatch'
          : null
      )
      ?? (reservation.status === 'awaiting_payment' ? null : 'reservation_not_awaiting_payment')
      ?? (!Number.isFinite(holdExpiresAtMs)
        ? 'reservation_hold_expiry_invalid'
        : holdExpiresAtMs <= providerEventOccurredAtMs
          ? 'reservation_hold_expired_at_provider_event'
          : null);

    const capturedDisposition = cleared
      ? capturedCheckoutDisposition(paymentBlockReason, inventoryOwned, currentPayment?.status)
      : null;

    if (capturedDisposition?.refundRequired) {
      const originalAmountCents = Number(session.amount_total || 0);
      const providerRefundedCents = Number(currentPayment?.refundedCents || 0);
      const coveredByOtherObligationsCents = activeOtherRefundObligationCents(
        refundObligationsSnapshot.docs,
        capturedRefundId,
        { campaignId, paymentId: paymentRef.id, reservationId },
      );
      const refundAmounts = capturedManualReviewRefundAmounts(
        originalAmountCents,
        providerRefundedCents,
        coveredByOtherObligationsCents,
      );
      const capturedRefund = capturedRefundSnapshot.data();
      assertCapturedManualReviewRefundIdentity(capturedRefund, {
        campaignId,
        paymentId: paymentRef.id,
        reservationId,
        originalAmountCents,
        providerRefundedCents,
        externalSessionId: session.id,
        externalPaymentId: paymentIntentId,
      });
      if (capturedRefund?.status === 'confirmed') {
        throw new Error('captured-manual-review-refund-payment-state-mismatch');
      }
      const obligationStatus = refundAmounts.amountCents === 0
        ? 'covered'
        : requiredCapturedRefundStatus(capturedRefund?.status);

      transaction.set(paymentRef, {
        campaignId,
        reservationId,
        planId,
        offerModelVersion,
        provider: 'stripe',
        externalSessionId: session.id,
        externalPaymentId: paymentIntentId,
        amountCents: originalAmountCents,
        refundedCents: providerRefundedCents,
        currency: session.currency || 'usd',
        status: capturedDisposition.paymentStatus,
        reviewReason: capturedDisposition.reviewReason,
        paymentBlockReason: paymentBlockReason || null,
        providerCaptureReportedAt: currentPayment?.providerCaptureReportedAt
          || Timestamp.fromMillis(providerEventOccurredAtMs),
        clearedAt: null,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: currentPayment?.createdAt || FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.update(reservationRef, {
        status: 'payment_review',
        paymentReviewReason: capturedDisposition.reviewReason,
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (inventoryOwned) {
        for (const claimRef of claimRefs) {
          transaction.set(claimRef, {
            status: 'sold',
            expiresAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        transaction.set(slotRef, {
          status: 'sold',
          expiresAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      transaction.set(capturedRefundRef, {
        campaignId,
        paymentId: paymentRef.id,
        reservationId,
        businessName: reservation.businessName || 'Unknown reservation',
        ...refundAmounts,
        reason: paymentBlockReason
          ? 'Payment completed after the campaign or reservation stopped accepting payment; owner review and a provider refund are required.'
          : !inventoryOwned
            ? 'Stripe reported a captured payment after this reservation no longer owned its category or placement; owner review and a full provider refund are required.'
            : 'Stripe reported a captured payment for an already quarantined payment record; owner review and a full provider refund are required.',
        status: obligationStatus,
        source: 'captured_manual_review_webhook',
        requiredFullRefund: true,
        ownerRejectable: false,
        requestedBy: 'stripe-webhook',
        externalSessionId: session.id,
        externalPaymentId: paymentIntentId,
        createdAt: capturedRefund?.createdAt || FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      if (!capturedRefundSnapshot.exists) {
        transaction.create(capturedRefundAuditRef, {
          actorUid: 'stripe-webhook',
          action: 'payment.captured.manual_review',
          entityId: paymentRef.id,
          summary: 'Quarantined a captured payment and recorded a mandatory full-refund obligation; no provider refund was initiated.',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
      if (campaignSnapshot.exists) {
        transaction.update(campaignRef, {
          ownerPrintApproved: false,
          printReadyAt: null,
          printReadinessRevokedAt: FieldValue.serverTimestamp(),
          printReadinessRevokedReason: paymentBlockReason
            ? 'late_payment_manual_review'
            : !inventoryOwned
              ? 'inventory_ownership_manual_review'
              : 'captured_payment_manual_review',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      return;
    }

    if (currentPayment?.status === 'manual_review') return;

    const paymentStatus = inventoryOwned ? cleared ? 'cleared' : 'pending' : 'manual_review';
    transaction.set(paymentRef, {
      campaignId,
      reservationId,
      planId,
      offerModelVersion,
      provider: 'stripe',
      externalSessionId: session.id,
      externalPaymentId: paymentIntentId,
      amountCents: Number(session.amount_total || 0),
      refundedCents: Number(currentPayment?.refundedCents || 0),
      currency: session.currency || 'usd',
      status: paymentStatus,
      reviewReason: inventoryOwned ? null : 'inventory_ownership_mismatch',
      clearedAt: inventoryOwned && cleared
        ? currentPayment?.clearedAt || FieldValue.serverTimestamp()
        : null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: currentPayment?.createdAt || FieldValue.serverTimestamp(),
    }, { merge: true });

    if (!inventoryOwned) {
      transaction.update(reservationRef, {
        status: 'payment_review',
        paymentReviewReason: 'inventory_ownership_mismatch',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (campaignSnapshot.exists) {
        transaction.update(campaignRef, {
          ownerPrintApproved: false,
          printReadyAt: null,
          printReadinessRevokedAt: FieldValue.serverTimestamp(),
          printReadinessRevokedReason: 'inventory_ownership_manual_review',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else if (cleared) {
      transaction.update(reservationRef, {
        status: 'paid',
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      for (const claimRef of claimRefs) {
        transaction.set(claimRef, {
          status: 'paid',
          expiresAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      transaction.set(slotRef, {
        status: 'sold',
        expiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      transaction.update(reservationRef, {
        status: 'awaiting_payment',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });

  return campaignId;
}

async function expireCheckoutSession(db: Firestore, session: Stripe.Checkout.Session) {
  const reservationId = session.metadata?.reservationId;
  const campaignId = session.metadata?.campaignId;
  const planId = session.metadata?.planId;
  const offerModelVersion = session.metadata?.offerModelVersion;
  if (!reservationId || !campaignId || !planId || !offerModelVersion) return campaignId || null;
  if (
    campaignId !== FOUNDING_CAMPAIGN.id
    || planId !== FOUNDING_CAMPAIGN.planId
    || offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
  ) return null;
  const reservationRef = db.collection('reservations').doc(reservationId);
  const campaignRef = db.collection('campaigns').doc(campaignId);
  await db.runTransaction(async (transaction) => {
    const [reservationSnapshot, campaignSnapshot] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(campaignRef),
    ]);
    if (!reservationSnapshot.exists) return;
    const reservation = reservationSnapshot.data()!;
    if (
      reservation.campaignId !== campaignId
      || reservation.planId !== planId
      || reservation.offerModelVersion !== offerModelVersion
      || reservation.stripeCheckoutSessionId !== session.id
    ) return;
    if (['paid', 'refunded', 'disputed', 'payment_review'].includes(reservation.status)) return;
    const claimRefs = reservationClaimSlugs(reservation).map((slug) =>
      db.collection('categoryclaims').doc(`${campaignId}__${slug}`),
    );
    const slotRef = db.collection('placementslots').doc(String(reservation.placementSlotId));
    const dedupeRef = db.collection('reservationdedupe').doc(
      reservationDedupeId(campaignId, String(reservation.emailNormalized)),
    );
    const [claimSnapshots, slotSnapshot, dedupeSnapshot] = await Promise.all([
      Promise.all(claimRefs.map((ref) => transaction.get(ref))),
      transaction.get(slotRef),
      transaction.get(dedupeRef),
    ]);
    transaction.update(reservationRef, { status: 'expired', updatedAt: FieldValue.serverTimestamp() });
    claimSnapshots.forEach((snapshot) => {
      if (snapshot.data()?.reservationId === reservationId) transaction.delete(snapshot.ref);
    });
    if (slotSnapshot.data()?.reservationId === reservationId) {
      transaction.set(slotRef, {
        status: releasedSlotStatus(campaignSnapshot.data()),
        reservationId: null,
        expiresAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    if (dedupeSnapshot.data()?.reservationId === reservationId) {
      transaction.set(dedupeRef, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  return campaignId;
}

async function applyFailedPayment(db: Firestore, intent: Stripe.PaymentIntent) {
  const reservationId = intent.metadata?.reservationId;
  const campaignId = intent.metadata?.campaignId;
  const planId = intent.metadata?.planId;
  const offerModelVersion = intent.metadata?.offerModelVersion;
  if (!reservationId || !campaignId || !planId || !offerModelVersion) return campaignId || null;
  if (
    campaignId !== FOUNDING_CAMPAIGN.id
    || planId !== FOUNDING_CAMPAIGN.planId
    || offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion
  ) return null;
  const paymentRef = db.collection('payments').doc(reservationId);
  const reservationRef = db.collection('reservations').doc(reservationId);
  const campaignRef = db.collection('campaigns').doc(campaignId);
  const capturedRefundRef = db.collection('refunds').doc(
    capturedManualReviewRefundId(campaignId, reservationId),
  );
  await db.runTransaction(async (transaction) => {
    const [current, reservationSnapshot, campaignSnapshot, capturedRefundSnapshot] = await Promise.all([
      transaction.get(paymentRef),
      transaction.get(reservationRef),
      transaction.get(campaignRef),
      transaction.get(capturedRefundRef),
    ]);
    const currentPayment = current.data();
    const reservation = reservationSnapshot.data();
    if (
      !reservation
      || reservation.campaignId !== campaignId
      || reservation.planId !== planId
      || reservation.offerModelVersion !== offerModelVersion
    ) throw new Error('reservation-payment-mismatch');
    if (['cleared', 'partially_refunded', 'refunded', 'disputed'].includes(String(currentPayment?.status))) return;
    const settleUncapturedInventoryReview = Boolean(
      currentPayment?.status === 'manual_review'
      && currentPayment.reviewReason === 'inventory_ownership_mismatch'
      && currentPayment.externalPaymentId === intent.id
      && Number(currentPayment.amountCents) === Number(intent.amount)
      && Number(reservation.quotedPriceCents) === Number(intent.amount)
      && currentPayment.currency === intent.currency
      && !isCaptureBackedManualReview(currentPayment, capturedRefundSnapshot.data()),
    );
    if (currentPayment?.status === 'manual_review' && !settleUncapturedInventoryReview) return;
    const mismatchedIntent = Boolean(currentPayment?.externalPaymentId && currentPayment.externalPaymentId !== intent.id);
    const mismatchedAmount = Number(intent.amount) !== Number(reservation.quotedPriceCents);
    const mismatchedCurrency = Boolean(currentPayment?.currency && currentPayment.currency !== intent.currency);
    const manualReview = mismatchedIntent || mismatchedAmount || mismatchedCurrency;
    const cleanup = settleUncapturedInventoryReview
      ? {
          claimRefs: reservationClaimSlugs(reservation).map((slug) =>
            db.collection('categoryclaims').doc(`${campaignId}__${slug}`),
          ),
          slotRef: db.collection('placementslots').doc(String(reservation.placementSlotId)),
          dedupeRef: db.collection('reservationdedupe').doc(
            reservationDedupeId(campaignId, String(reservation.emailNormalized)),
          ),
        }
      : null;
    const cleanupSnapshots = cleanup
      ? await Promise.all([
          Promise.all(cleanup.claimRefs.map((ref) => transaction.get(ref))),
          transaction.get(cleanup.slotRef),
          transaction.get(cleanup.dedupeRef),
        ])
      : null;
    transaction.set(paymentRef, {
      campaignId,
      reservationId,
      planId,
      offerModelVersion,
      provider: 'stripe',
      externalPaymentId: mismatchedIntent ? currentPayment?.externalPaymentId : intent.id,
      reviewExternalPaymentId: mismatchedIntent ? intent.id : null,
      amountCents: mismatchedAmount && currentPayment?.amountCents
        ? currentPayment.amountCents
        : intent.amount,
      reviewAmountCents: mismatchedAmount ? intent.amount : null,
      refundedCents: Number(currentPayment?.refundedCents || 0),
      currency: mismatchedCurrency ? currentPayment?.currency : intent.currency,
      reviewCurrency: mismatchedCurrency ? intent.currency : null,
      status: manualReview ? 'manual_review' : 'failed',
      reviewReason: mismatchedIntent
        ? 'payment_intent_mismatch'
        : mismatchedAmount
          ? 'payment_amount_mismatch'
          : mismatchedCurrency
            ? 'payment_currency_mismatch'
            : null,
      updatedAt: FieldValue.serverTimestamp(),
      createdAt: currentPayment?.createdAt || FieldValue.serverTimestamp(),
    }, { merge: true });
    if (manualReview) {
      transaction.update(reservationRef, {
        status: 'payment_review',
        paymentReviewReason: 'failed_payment_ledger_mismatch',
        updatedAt: FieldValue.serverTimestamp(),
      });
      if (campaignSnapshot.exists) {
        transaction.update(campaignRef, {
          ownerPrintApproved: false,
          printReadyAt: null,
          printReadinessRevokedAt: FieldValue.serverTimestamp(),
          printReadinessRevokedReason: 'failed_payment_ledger_manual_review',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
    } else if (cleanup && cleanupSnapshots) {
      const [claimSnapshots, slotSnapshot, dedupeSnapshot] = cleanupSnapshots;
      transaction.update(reservationRef, {
        status: 'expired',
        paymentReviewReason: null,
        updatedAt: FieldValue.serverTimestamp(),
      });
      claimSnapshots.forEach((snapshot) => {
        if (snapshot.data()?.reservationId === reservationId) transaction.delete(snapshot.ref);
      });
      if (slotSnapshot.data()?.reservationId === reservationId) {
        transaction.set(cleanup.slotRef, {
          status: releasedSlotStatus(campaignSnapshot.data()),
          reservationId: null,
          expiresAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (dedupeSnapshot.data()?.reservationId === reservationId) {
        transaction.set(cleanup.dedupeRef, {
          active: false,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
    }
  });
  return campaignId;
}

async function findPaymentByIntent(db: Firestore, paymentIntentId: string) {
  const snapshot = await db.collection('payments')
    .where('externalPaymentId', '==', paymentIntentId)
    .limit(2)
    .get();
  if (snapshot.size > 1) throw new Error('duplicate-payment-ledger');
  if (snapshot.empty) return null;
  const payment = snapshot.docs[0];
  if (payment.id !== String(payment.data().reservationId)) throw new Error('noncanonical-payment-ledger');
  return payment;
}

interface RefundObligationCandidate {
  id: string;
  campaignId: string;
  paymentId: string;
  reservationId: string;
  status: string;
  amountCents: number;
  providerReference: string | null;
  createdAtMillis: number;
  requiredCapturedRefund: boolean;
  originalAmountCents: number | null;
  providerRefundedCents: number | null;
}

interface RefundObligationUpdate {
  id: string;
  status: string;
  amountCents: number;
  originalAmountCents: number;
  providerRefundedCents: number;
  newlyProviderRefundedCents: number;
}

function reconcileProviderRefundObligations(
  originalPaymentAmountCents: number,
  previousProviderRefundedCents: number,
  nextProviderRefundedCents: number,
  mandatoryRefundId: string,
  expectedBinding: {
    campaignId: string;
    paymentId: string;
    reservationId: string;
  },
  candidates: RefundObligationCandidate[],
  providerRefundAmounts: Map<string, number>,
) {
  if (
    !Number.isSafeInteger(originalPaymentAmountCents)
    || originalPaymentAmountCents <= 0
    || !Number.isSafeInteger(previousProviderRefundedCents)
    || previousProviderRefundedCents < 0
    || previousProviderRefundedCents > originalPaymentAmountCents
    || !Number.isSafeInteger(nextProviderRefundedCents)
    || nextProviderRefundedCents < 0
    || nextProviderRefundedCents > originalPaymentAmountCents
  ) throw new Error('refund-amount-mismatch');

  for (const candidate of candidates) {
    if (!isKnownRefundRecordStatus(candidate.status)) {
      throw new Error('refund-obligation-status-invalid');
    }
    if (
      candidate.campaignId !== expectedBinding.campaignId
      || candidate.paymentId !== expectedBinding.paymentId
      || candidate.reservationId !== expectedBinding.reservationId
    ) {
      throw new Error('refund-obligation-binding-mismatch');
    }
    if (
      !Number.isSafeInteger(candidate.amountCents)
      || candidate.amountCents < 0
      || (candidate.status === 'covered' && candidate.amountCents !== 0)
      || (!['covered', 'confirmed'].includes(candidate.status) && candidate.amountCents === 0)
    ) {
      throw new Error('refund-obligation-amount-invalid');
    }
  }

  if (nextProviderRefundedCents < previousProviderRefundedCents) {
    return {
      stale: true,
      netRefundableCents: originalPaymentAmountCents - previousProviderRefundedCents,
      otherActiveCents: 0,
      updates: [] as RefundObligationUpdate[],
      mandatoryUpdate: null,
    };
  }

  const statusPriority: Record<string, number> = { submitted: 0, approved: 1, requested: 2 };
  const mandatory = candidates.find((candidate) => candidate.id === mandatoryRefundId) || null;
  if (mandatory && !mandatory.requiredCapturedRefund) {
    throw new Error('captured-manual-review-refund-obligation-mismatch');
  }
  if (mandatory?.status === 'confirmed' && nextProviderRefundedCents < originalPaymentAmountCents) {
    throw new Error('captured-manual-review-refund-payment-state-mismatch');
  }

  const activeOthers = candidates
    .filter((candidate) => candidate.id !== mandatoryRefundId && isActiveRefundObligationStatus(candidate.status))
    .map((candidate) => {
      if (!Number.isSafeInteger(candidate.amountCents) || candidate.amountCents <= 0) {
        throw new Error('refund-obligation-amount-invalid');
      }
      const hasStoredBalance = candidate.originalAmountCents !== null
        || candidate.providerRefundedCents !== null;
      let originalAmountCents = candidate.amountCents;
      let providerRefundedCents = 0;
      if (hasStoredBalance) {
        if (
          !Number.isSafeInteger(candidate.originalAmountCents)
          || Number(candidate.originalAmountCents) <= 0
          || !Number.isSafeInteger(candidate.providerRefundedCents)
          || Number(candidate.providerRefundedCents) < 0
        ) throw new Error('refund-obligation-balance-mismatch');
        originalAmountCents = candidate.originalAmountCents as number;
        providerRefundedCents = candidate.providerRefundedCents as number;
      }
      if (originalAmountCents - providerRefundedCents !== candidate.amountCents) {
        throw new Error('refund-obligation-balance-mismatch');
      }
      return {
        ...candidate,
        originalAmountCents,
        providerRefundedCents,
        nextAmountCents: candidate.amountCents,
        nextProviderRefundedCents: providerRefundedCents,
        newlyProviderRefundedCents: 0,
      };
    });
  const previousNetRefundableCents = originalPaymentAmountCents - previousProviderRefundedCents;
  const nextNetRefundableCents = originalPaymentAmountCents - nextProviderRefundedCents;
  let otherActiveCents = activeOthers.reduce((total, candidate) => total + candidate.amountCents, 0);
  if (!Number.isSafeInteger(otherActiveCents) || otherActiveCents > previousNetRefundableCents) {
    throw new Error('refund-obligations-exceed-net');
  }
  let unappliedProviderIncrement = nextProviderRefundedCents - previousProviderRefundedCents;

  const ordered = [...activeOthers].sort((left, right) => {
    const leftReferenceMatch = left.providerReference && providerRefundAmounts.has(left.providerReference) ? 0 : 1;
    const rightReferenceMatch = right.providerReference && providerRefundAmounts.has(right.providerReference) ? 0 : 1;
    if (leftReferenceMatch !== rightReferenceMatch) return leftReferenceMatch - rightReferenceMatch;
    const statusDifference = (statusPriority[left.status] ?? 9) - (statusPriority[right.status] ?? 9);
    if (statusDifference !== 0) return statusDifference;
    if (left.createdAtMillis !== right.createdAtMillis) return left.createdAtMillis - right.createdAtMillis;
    return left.id.localeCompare(right.id);
  });

  const applyProviderCents = (
    candidate: (typeof ordered)[number],
    requestedCents: number,
  ) => {
    const appliedCents = Math.min(
      candidate.nextAmountCents,
      unappliedProviderIncrement,
      Math.max(0, requestedCents),
    );
    if (appliedCents <= 0) return;
    candidate.nextAmountCents -= appliedCents;
    candidate.nextProviderRefundedCents += appliedCents;
    candidate.newlyProviderRefundedCents += appliedCents;
    otherActiveCents -= appliedCents;
    unappliedProviderIncrement -= appliedCents;
  };

  for (const candidate of ordered) {
    if (!candidate.providerReference) continue;
    const providerReferenceAmount = providerRefundAmounts.get(candidate.providerReference);
    if (!Number.isSafeInteger(providerReferenceAmount) || Number(providerReferenceAmount) <= 0) continue;
    applyProviderCents(
      candidate,
      Number(providerReferenceAmount) - candidate.nextProviderRefundedCents,
    );
  }

  let requiredOtherReductionCents = Math.max(0, otherActiveCents - nextNetRefundableCents);
  for (const candidate of ordered) {
    if (requiredOtherReductionCents <= 0) break;
    const before = candidate.nextAmountCents;
    applyProviderCents(candidate, requiredOtherReductionCents);
    requiredOtherReductionCents -= before - candidate.nextAmountCents;
  }
  if (otherActiveCents > nextNetRefundableCents || requiredOtherReductionCents > 0) {
    throw new Error('refund-obligations-exceed-net');
  }

  const updates = ordered
    .filter((candidate) => candidate.newlyProviderRefundedCents > 0)
    .map((candidate) => ({
      id: candidate.id,
      status: candidate.nextAmountCents === 0 ? 'confirmed' : candidate.status,
      amountCents: candidate.nextAmountCents,
      originalAmountCents: candidate.originalAmountCents,
      providerRefundedCents: candidate.nextProviderRefundedCents,
      newlyProviderRefundedCents: candidate.newlyProviderRefundedCents,
    } satisfies RefundObligationUpdate));

  const mandatoryAmounts = mandatory
    ? capturedManualReviewRefundAmounts(
        originalPaymentAmountCents,
        nextProviderRefundedCents,
        otherActiveCents,
      )
    : null;
  const mandatoryStatus = !mandatoryAmounts
    ? null
    : nextNetRefundableCents === 0
      ? 'confirmed'
      : mandatoryAmounts.amountCents === 0
        ? 'covered'
        : isActiveRefundObligationStatus(mandatory?.status)
          ? String(mandatory?.status)
          : 'requested';

  return {
    stale: false,
    netRefundableCents: nextNetRefundableCents,
    otherActiveCents,
    updates,
    mandatoryUpdate: mandatory && mandatoryAmounts && mandatoryStatus
      ? {
          id: mandatory.id,
          status: mandatoryStatus,
          ...mandatoryAmounts,
        }
      : null,
  };
}

async function applyRefund(db: Firestore, charge: Stripe.Charge, eventId: string) {
  const paymentIntentId = objectId(charge.payment_intent);
  if (!paymentIntentId) return null;
  const paymentSnapshot = await findPaymentByIntent(db, paymentIntentId);
  if (!paymentSnapshot) throw new Error('refunded-payment-not-found');
  const payment = paymentSnapshot.data();
  if (charge.currency !== payment.currency) throw new Error('refund-currency-mismatch');
  if (charge.amount_refunded > Number(payment.amountCents)) throw new Error('refund-amount-mismatch');
  const reservationRef = db.collection('reservations').doc(String(payment.reservationId));
  const campaignRef = db.collection('campaigns').doc(String(payment.campaignId));
  const mandatoryRefundId = capturedManualReviewRefundId(
    String(payment.campaignId),
    String(payment.reservationId),
  );
  const mandatoryRefundRef = db.collection('refunds').doc(mandatoryRefundId);
  await db.runTransaction(async (transaction) => {
    const [reservationSnapshot, currentPaymentSnapshot, campaignSnapshot, mandatoryRefundSnapshot] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(paymentSnapshot.ref),
      transaction.get(campaignRef),
      transaction.get(mandatoryRefundRef),
    ]);
    const reservation = reservationSnapshot.data();
    const currentPayment = currentPaymentSnapshot.data();
    if (!reservation || !currentPayment || typeof currentPayment.campaignId !== 'string' || reservation.campaignId !== currentPayment.campaignId) {
      throw new Error('reservation-not-found');
    }
    if (currentPayment.externalPaymentId !== paymentIntentId) throw new Error('payment-intent-mismatch');
    if (currentPayment.currency !== charge.currency) throw new Error('refund-currency-mismatch');
    if (charge.amount_refunded > Number(currentPayment.amountCents)) throw new Error('refund-amount-mismatch');
    const storedMandatoryRefund = mandatoryRefundSnapshot.data();
    if (storedMandatoryRefund && (
      storedMandatoryRefund.paymentId !== currentPaymentSnapshot.id
      || storedMandatoryRefund.reservationId !== reservationRef.id
      || storedMandatoryRefund.campaignId !== currentPayment.campaignId
      || (storedMandatoryRefund.externalPaymentId
        && storedMandatoryRefund.externalPaymentId !== paymentIntentId)
    )) throw new Error('captured-manual-review-refund-obligation-mismatch');
    const fullRefund = charge.amount_refunded >= Number(currentPayment.amountCents);
    const paymentStatusAfterRefund = fullRefund
      ? 'refunded'
      : ['cleared', 'partially_refunded'].includes(String(currentPayment.status))
        ? 'partially_refunded'
        : currentPayment.status === 'disputed'
          ? 'disputed'
          : 'manual_review';
    const claimRefs = reservationClaimSlugs(reservation).map((slug) =>
      db.collection('categoryclaims').doc(`${currentPayment.campaignId}__${slug}`),
    );
    const slotRef = db.collection('placementslots').doc(String(reservation.placementSlotId));
    const dedupeRef = db.collection('reservationdedupe').doc(
      reservationDedupeId(String(currentPayment.campaignId), String(reservation.emailNormalized)),
    );
    const trackingRef = reservationTrackingRef(db, reservation);
    const refundQuery = db.collection('refunds').where('paymentId', '==', paymentSnapshot.id);
    const [claimSnapshots, slotSnapshot, dedupeSnapshot, refundSnapshot, trackingSnapshot] = await Promise.all([
      Promise.all(claimRefs.map((ref) => transaction.get(ref))),
      transaction.get(slotRef),
      transaction.get(dedupeRef),
      transaction.get(refundQuery),
      trackingRef ? transaction.get(trackingRef) : Promise.resolve(null),
    ]);
    const providerRefundIds = (charge.refunds?.data || []).map((refund) => refund.id);
    const providerRefundAmounts = new Map<string, number>([
      [charge.id, charge.amount_refunded],
      ...(charge.refunds?.data || []).map((refund) => [refund.id, refund.amount] as [string, number]),
    ]);
    const candidates = refundSnapshot.docs.map((snapshot) => {
      const data = snapshot.data();
      return {
        id: snapshot.id,
        campaignId: data.campaignId,
        paymentId: data.paymentId,
        reservationId: data.reservationId,
        status: data.status,
        amountCents: data.amountCents,
        providerReference: data.providerReference ? String(data.providerReference) : null,
        createdAtMillis: Number(data.createdAt?.toMillis?.() || 0),
        requiredCapturedRefund: data.requiredFullRefund === true
          || ['captured_manual_review_webhook', 'late_payment_webhook'].includes(String(data.source)),
        originalAmountCents: data.originalAmountCents === undefined
          ? null
          : data.originalAmountCents,
        providerRefundedCents: data.providerRefundedCents === undefined
          ? null
          : data.providerRefundedCents,
      } satisfies RefundObligationCandidate;
    });
    if (storedMandatoryRefund && !candidates.some((candidate) => candidate.id === mandatoryRefundId)) {
      throw new Error('captured-manual-review-refund-obligation-mismatch');
    }
    const reconciliation = reconcileProviderRefundObligations(
      Number(currentPayment.amountCents),
      Number(currentPayment.refundedCents || 0),
      charge.amount_refunded,
      mandatoryRefundId,
      {
        campaignId: String(currentPayment.campaignId),
        paymentId: currentPaymentSnapshot.id,
        reservationId: reservationRef.id,
      },
      candidates,
      providerRefundAmounts,
    );
    if (reconciliation.stale) return;
    transaction.update(campaignRef, {
      ownerPrintApproved: false,
      printReadyAt: null,
      printReadinessRevokedAt: FieldValue.serverTimestamp(),
      printReadinessRevokedReason: 'provider_refund',
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(currentPaymentSnapshot.ref, {
      refundedCents: charge.amount_refunded,
      status: paymentStatusAfterRefund,
      reviewReason: paymentStatusAfterRefund === 'manual_review'
        ? 'refund_received_for_noncleared_payment'
        : currentPayment.reviewReason || null,
      lastRefundChargeId: charge.id,
      lastRefundEventId: eventId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const refundSnapshotsById = new Map(refundSnapshot.docs.map((snapshot) => [snapshot.id, snapshot]));
    for (const update of reconciliation.updates) {
      const refundSnapshotDoc = refundSnapshotsById.get(update.id);
      if (!refundSnapshotDoc) throw new Error('refund-obligation-not-found');
      const confirmed = update.status === 'confirmed';
      transaction.update(refundSnapshotDoc.ref, {
        status: update.status,
        amountCents: update.amountCents,
        originalAmountCents: update.originalAmountCents,
        providerRefundedCents: update.providerRefundedCents,
        providerChargeId: charge.id,
        providerRefundIds,
        providerEventId: eventId,
        ...(confirmed ? { confirmedAt: FieldValue.serverTimestamp() } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: 'stripe-webhook',
        action: confirmed ? 'refund.confirm' : 'refund.partial_reconcile',
        entityId: refundSnapshotDoc.id,
        summary: confirmed
          ? 'Stripe fully satisfied the recorded refund obligation; the webhook did not initiate a provider refund.'
          : `Stripe reduced this recorded refund obligation by ${update.newlyProviderRefundedCents} cents; the webhook did not initiate a provider refund.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    if (reconciliation.mandatoryUpdate) {
      const mandatory = mandatoryRefundSnapshot.data();
      if (!mandatory) throw new Error('captured-manual-review-refund-obligation-mismatch');
      const update = reconciliation.mandatoryUpdate;
      const changed = mandatory.status !== update.status
        || Number(mandatory.amountCents) !== update.amountCents
        || Number(mandatory.originalAmountCents) !== update.originalAmountCents
        || Number(mandatory.providerRefundedCents || 0) !== update.providerRefundedCents
        || Number(mandatory.coveredByOtherObligationsCents || 0) !== update.coveredByOtherObligationsCents;
      if (changed) {
        const confirmed = update.status === 'confirmed';
        transaction.update(mandatoryRefundRef, {
          status: update.status,
          amountCents: update.amountCents,
          originalAmountCents: update.originalAmountCents,
          providerRefundedCents: update.providerRefundedCents,
          coveredByOtherObligationsCents: update.coveredByOtherObligationsCents,
          providerChargeId: charge.id,
          providerRefundIds,
          providerEventId: eventId,
          ...(confirmed ? { confirmedAt: FieldValue.serverTimestamp() } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: 'stripe-webhook',
          action: confirmed ? 'refund.confirm' : 'refund.required_balance_reconcile',
          entityId: mandatoryRefundId,
          summary: confirmed
            ? 'Stripe confirmed the captured payment is fully refunded; the mandatory obligation is closed.'
            : 'Recomputed the mandatory captured-payment refund balance from cumulative Stripe refund truth and other active obligations; no provider refund was initiated.',
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }
    if (fullRefund) {
      transaction.update(reservationRef, { status: 'refunded', updatedAt: FieldValue.serverTimestamp() });
      if (trackingRef && trackingSnapshot?.exists && trackingBelongsToReservation(
        trackingSnapshot.data(),
        trackingRef.id,
        reservationRef.id,
        String(currentPayment.campaignId),
      )) {
        transaction.update(trackingRef, {
          active: false,
          paymentLifecycleSuspended: false,
          activeBeforePaymentInterruption: false,
          deactivatedReason: 'reservation_refunded',
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
          trackingStatus: 'inactive',
          updatedAt: FieldValue.serverTimestamp(),
        });
      }
      claimSnapshots.forEach((snapshot) => {
        if (snapshot.data()?.reservationId === reservationRef.id) transaction.delete(snapshot.ref);
      });
      if (slotSnapshot.data()?.reservationId === reservationRef.id) {
        transaction.set(slotRef, {
          status: releasedSlotStatus(campaignSnapshot.data()),
          reservationId: null,
          expiresAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      if (dedupeSnapshot.data()?.reservationId === reservationRef.id) {
        transaction.set(dedupeRef, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    } else if (paymentStatusAfterRefund === 'manual_review') {
      transaction.update(reservationRef, {
        status: 'payment_review',
        paymentReviewReason: 'refund_received_for_noncleared_payment',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
  });
  return String(payment.campaignId);
}

async function applyDispute(db: Firestore, dispute: Stripe.Dispute, closed: boolean) {
  const paymentIntentId = objectId(dispute.payment_intent);
  if (!paymentIntentId) return null;
  const paymentSnapshot = await findPaymentByIntent(db, paymentIntentId);
  if (!paymentSnapshot) throw new Error('disputed-payment-not-found');
  const payment = paymentSnapshot.data();
  if (dispute.currency !== payment.currency) throw new Error('dispute-currency-mismatch');
  const reservationRef = db.collection('reservations').doc(String(payment.reservationId));
  const campaignRef = db.collection('campaigns').doc(String(payment.campaignId));
  const capturedRefundId = capturedManualReviewRefundId(
    String(payment.campaignId),
    String(payment.reservationId),
  );
  const capturedRefundRef = db.collection('refunds').doc(capturedRefundId);
  const capturedRefundAuditRef = db.collection('auditlog').doc(capturedRefundId);
  const refundObligationsQuery = db.collection('refunds').where('paymentId', '==', paymentSnapshot.id);
  await db.runTransaction(async (transaction) => {
    const [reservationSnapshot, currentPaymentSnapshot, campaignSnapshot] = await Promise.all([
      transaction.get(reservationRef),
      transaction.get(paymentSnapshot.ref),
      transaction.get(campaignRef),
    ]);
    const reservation = reservationSnapshot.data();
    const currentPayment = currentPaymentSnapshot.data();
    if (!reservation || !currentPayment || typeof currentPayment.campaignId !== 'string' || reservation.campaignId !== currentPayment.campaignId) throw new Error('reservation-not-found');
    if (currentPayment.externalPaymentId !== paymentIntentId) throw new Error('payment-intent-mismatch');
    if (currentPayment.currency !== dispute.currency) throw new Error('dispute-currency-mismatch');
    if (isTerminalClosedDisputeReplay(currentPayment, dispute, closed)) return;
    if (!closed && currentPayment.disputeId === dispute.id && currentPayment.disputeClosedAt) return;
    const claimRefs = reservationClaimSlugs(reservation).map((slug) =>
      db.collection('categoryclaims').doc(`${currentPayment.campaignId}__${slug}`),
    );
    const slotRef = db.collection('placementslots').doc(String(reservation.placementSlotId));
    const dedupeRef = db.collection('reservationdedupe').doc(
      reservationDedupeId(String(currentPayment.campaignId), String(reservation.emailNormalized)),
    );
    const trackingRef = reservationTrackingRef(db, reservation);
    const [
      claimSnapshots,
      slotSnapshot,
      dedupeSnapshot,
      trackingSnapshot,
      capturedRefundSnapshot,
      refundObligationsSnapshot,
    ] = await Promise.all([
      Promise.all(claimRefs.map((ref) => transaction.get(ref))),
      transaction.get(slotRef),
      transaction.get(dedupeRef),
      trackingRef ? transaction.get(trackingRef) : Promise.resolve(null),
      transaction.get(capturedRefundRef),
      transaction.get(refundObligationsQuery),
    ]);
    const inventoryOwned = claimSnapshots.every((snapshot) => snapshot.data()?.reservationId === reservationRef.id)
      && slotSnapshot.data()?.reservationId === reservationRef.id;
    const currentTracking = trackingRef && trackingSnapshot?.exists
      && trackingBelongsToReservation(
        trackingSnapshot.data(),
        trackingRef.id,
        reservationRef.id,
        String(currentPayment.campaignId),
      )
      ? trackingSnapshot.data()!
      : null;

    transaction.update(campaignRef, {
      ownerPrintApproved: false,
      printReadyAt: null,
      printReadinessRevokedAt: FieldValue.serverTimestamp(),
      printReadinessRevokedReason: closed ? `dispute_closed_${dispute.status}` : 'dispute_created',
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (closed && dispute.status === 'won') {
      const refundedCents = Number(currentPayment.refundedCents || 0);
      const originalAmountCents = Number(currentPayment.amountCents || 0);
      if (
        !Number.isSafeInteger(originalAmountCents)
        || originalAmountCents <= 0
        || !Number.isSafeInteger(refundedCents)
        || refundedCents < 0
        || refundedCents > originalAmountCents
      ) throw new Error('payment-amount-mismatch');
      const restoredStatus = refundedCents >= originalAmountCents
        ? 'refunded'
        : refundedCents > 0
          ? 'partially_refunded'
          : 'cleared';

      if (restoredStatus === 'refunded') {
        transaction.update(currentPaymentSnapshot.ref, {
          status: 'refunded',
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeOutcome: 'won',
          disputeClosedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, { status: 'refunded', updatedAt: FieldValue.serverTimestamp() });
        if (trackingRef && currentTracking) {
          transaction.update(trackingRef, {
            active: false,
            paymentLifecycleSuspended: false,
            activeBeforePaymentInterruption: false,
            deactivatedReason: 'reservation_refunded',
            updatedAt: FieldValue.serverTimestamp(),
          });
          transaction.update(reservationRef, {
            trackingStatus: 'inactive',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        claimSnapshots.forEach((snapshot) => {
          if (snapshot.data()?.reservationId === reservationRef.id) transaction.delete(snapshot.ref);
        });
        if (slotSnapshot.data()?.reservationId === reservationRef.id) {
          transaction.set(slotRef, {
            status: releasedSlotStatus(campaignSnapshot.data()),
            reservationId: null,
            expiresAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        if (dedupeSnapshot.data()?.reservationId === reservationRef.id) {
          transaction.set(dedupeRef, { active: false, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        }
      } else if (inventoryOwned && !currentPayment.reviewReason) {
        const restoreTracking = Boolean(
          trackingRef
          && currentTracking
          && currentTracking.paymentLifecycleSuspended === true
          && currentTracking.activeBeforePaymentInterruption === true,
        );
        transaction.update(currentPaymentSnapshot.ref, {
          status: restoredStatus,
          reviewReason: null,
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeOutcome: 'won',
          disputeClosedAt: FieldValue.serverTimestamp(),
          clearedAt: currentPayment.clearedAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
          status: 'paid',
          paymentReviewReason: null,
          ...(trackingRef && currentTracking
            ? { trackingStatus: restoreTracking ? 'active' : 'inactive' }
            : {}),
          updatedAt: FieldValue.serverTimestamp(),
        });
        if (trackingRef && currentTracking?.paymentLifecycleSuspended === true) {
          transaction.update(trackingRef, {
            active: restoreTracking,
            paymentLifecycleSuspended: false,
            activeBeforePaymentInterruption: false,
            deactivatedReason: restoreTracking ? null : 'owner_or_prior_inactive',
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
        claimSnapshots.forEach((snapshot) => {
          transaction.set(snapshot.ref, { status: 'paid', expiresAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        });
        transaction.set(slotRef, { status: 'sold', expiresAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      } else {
        const coveredByOtherObligationsCents = activeOtherRefundObligationCents(
          refundObligationsSnapshot.docs,
          capturedRefundId,
          {
            campaignId: String(currentPayment.campaignId),
            paymentId: currentPaymentSnapshot.ref.id,
            reservationId: reservationRef.id,
          },
        );
        const refundAmounts = capturedManualReviewRefundAmounts(
          originalAmountCents,
          refundedCents,
          coveredByOtherObligationsCents,
        );
        const externalSessionId = typeof currentPayment.externalSessionId === 'string'
          ? currentPayment.externalSessionId
          : null;
        const capturedRefund = capturedRefundSnapshot.data();
        assertCapturedManualReviewRefundIdentity(capturedRefund, {
          campaignId: String(currentPayment.campaignId),
          paymentId: currentPaymentSnapshot.ref.id,
          reservationId: reservationRef.id,
          originalAmountCents,
          providerRefundedCents: refundedCents,
          externalSessionId,
          externalPaymentId: paymentIntentId,
        });
        if (capturedRefund?.status === 'confirmed') {
          throw new Error('captured-manual-review-refund-payment-state-mismatch');
        }
        const reviewReason = inventoryOwned
          ? 'dispute_won_existing_payment_review'
          : 'dispute_won_inventory_ownership_mismatch';
        transaction.update(currentPaymentSnapshot.ref, {
          status: 'manual_review',
          reviewReason,
          disputeId: dispute.id,
          disputeStatus: dispute.status,
          disputeOutcome: 'won',
          disputeClosedAt: FieldValue.serverTimestamp(),
          providerCaptureReportedAt: currentPayment.providerCaptureReportedAt
            || currentPayment.clearedAt
            || FieldValue.serverTimestamp(),
          clearedAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.update(reservationRef, {
          status: 'payment_review',
          paymentReviewReason: reviewReason,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.set(capturedRefundRef, {
          campaignId: String(currentPayment.campaignId),
          paymentId: currentPaymentSnapshot.ref.id,
          reservationId: reservationRef.id,
          businessName: reservation.businessName || 'Unknown reservation',
          ...refundAmounts,
          reason: inventoryOwned
            ? 'Stripe closed the dispute as won, but an existing payment review still prevents these captured funds from being restored to cleared funding; owner review and a full provider refund are required.'
            : 'Stripe closed the dispute as won after this reservation lost ownership of its category or placement; the captured funds cannot be restored to cleared funding, so owner review and a full provider refund are required.',
          status: refundAmounts.amountCents === 0
            ? 'covered'
            : requiredCapturedRefundStatus(capturedRefund?.status),
          source: 'captured_manual_review_webhook',
          requiredFullRefund: true,
          ownerRejectable: false,
          requestedBy: 'stripe-webhook',
          externalSessionId,
          externalPaymentId: paymentIntentId,
          createdAt: capturedRefund?.createdAt || FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (!capturedRefundSnapshot.exists) {
          transaction.create(capturedRefundAuditRef, {
            actorUid: 'stripe-webhook',
            action: 'payment.captured.manual_review',
            entityId: currentPaymentSnapshot.ref.id,
            summary: 'A won dispute could not restore cleared funding; recorded a mandatory full-refund obligation without initiating a provider refund.',
            createdAt: FieldValue.serverTimestamp(),
          });
        }
      }
      return;
    }

    transaction.update(currentPaymentSnapshot.ref, {
      status: 'disputed',
      disputeId: dispute.id,
      disputeStatus: dispute.status,
      disputeOutcome: closed ? dispute.status : null,
      disputeClosedAt: closed ? FieldValue.serverTimestamp() : null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, { status: 'disputed', updatedAt: FieldValue.serverTimestamp() });
    if (trackingRef && currentTracking) {
      const alreadySuspended = currentTracking.paymentLifecycleSuspended === true;
      transaction.update(trackingRef, {
        active: false,
        paymentLifecycleSuspended: true,
        activeBeforePaymentInterruption: alreadySuspended
          ? currentTracking.activeBeforePaymentInterruption === true
          : currentTracking.active === true,
        deactivatedReason: closed ? `dispute_closed_${dispute.status}` : 'dispute_created',
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        trackingStatus: 'inactive',
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    claimSnapshots.forEach((snapshot) => {
      if (snapshot.data()?.reservationId === reservationRef.id) {
        transaction.set(snapshot.ref, { status: 'disputed', expiresAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      }
    });
    if (slotSnapshot.data()?.reservationId === reservationRef.id) {
      transaction.set(slotRef, { status: 'sold', expiresAt: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    }
  });
  return String(payment.campaignId);
}

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!secret || !stripeKey) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 503 });
  }
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing Stripe signature.' }, { status: 400 });
  const body = await request.text();
  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 });
  }

  let db: Firestore;
  try {
    db = getAdminFirestore();
  } catch {
    return NextResponse.json({ error: 'Payment ledger is not configured.' }, { status: 503 });
  }

  let leaseId: string | null = null;
  try {
    let lease: EventLease;
    try {
      lease = await beginEvent(db, event, body);
    } catch (error) {
      if (error instanceof Error && error.message === 'event-processing') {
        return NextResponse.json(
          { received: false, processing: true },
          { status: 409, headers: { 'Retry-After': '60' } },
        );
      }
      throw error;
    }
    if (!lease.shouldProcess) return NextResponse.json({ received: true, duplicate: true });
    if (!lease.leaseId) throw new Error('event-lease-missing');
    leaseId = lease.leaseId;
    let campaignId: string | null = null;
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        campaignId = await applyCheckoutSession(
          db,
          event.data.object as Stripe.Checkout.Session,
          event.created * 1_000,
        );
        break;
      case 'checkout.session.expired':
        campaignId = await expireCheckoutSession(db, event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        campaignId = await applyFailedPayment(db, event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        campaignId = await applyRefund(db, event.data.object as Stripe.Charge, event.id);
        break;
      case 'charge.dispute.created':
        campaignId = await applyDispute(db, event.data.object as Stripe.Dispute, false);
        break;
      case 'charge.dispute.closed':
        campaignId = await applyDispute(db, event.data.object as Stripe.Dispute, true);
        break;
      default:
        break;
    }
    if (campaignId) await syncCampaignState(db, campaignId);
    await finishEvent(db, event.id, leaseId, 'processed', campaignId ? 'Campaign ledger updated.' : 'Event acknowledged; no campaign mutation required.');
    return NextResponse.json({ received: true });
  } catch (error) {
    if (leaseId) {
      await finishEvent(db, event.id, leaseId, 'failed', error instanceof Error ? error.message.slice(0, 160) : 'Unknown processing error.').catch(() => undefined);
    }
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 });
  }
}
