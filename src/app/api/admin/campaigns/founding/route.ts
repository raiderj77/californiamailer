import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  FOUNDING_CAMPAIGN,
  campaignMatchesActiveSharedModel,
  compatibleNonSensitiveCategorySlugs,
  getApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import { canTransitionCampaign } from '@/lib/campaignLifecycle';
import { PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT } from '@/lib/campaignPlacementEvidence';
import {
  campaignOperationalEvidenceBlockerLabel,
  campaignOperationalEvidenceBlockReason,
} from '@/lib/campaignOperationalGates';
import { campaignPrintReadinessState } from '@/lib/campaignPrintReadiness';
import { clearedNetFundingCents } from '@/lib/businessRules';
import { createFoundingCampaignRecord, placementSlotId, toPublicCampaign } from '@/lib/campaignRecords';
import type { CampaignPayment } from '@/lib/campaignTypes';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { strictPaymentRefundLedger } from '@/lib/paymentLedgerIntegrity';
import { paymentDocumentsWithProviderCollisions } from '@/lib/paymentProviderEvidence';
import { refundDocumentsWithLinkedEvidence } from '@/lib/refundEvidence';
import {
  buildPrintedInputSnapshot,
  printedInputSnapshotMatches,
} from '@/lib/printedInputSnapshot';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import { isLiveInventoryState, syncCampaignState } from '@/lib/campaignSync';

const actionSchema = z.object({
  action: z.enum([
    'initialize',
    'publish',
    'unpublish',
    'activate_reservations',
    'deactivate_reservations',
    'begin_proofing',
    'schedule_for_print',
    'record_printed',
    'record_delivered',
    'complete_campaign',
    'cancel_campaign',
    'close_cancelled',
  ]),
  confirmation: z.string().max(100).optional().default(''),
  evidenceReference: z.string().trim().max(300).optional().default(''),
  occurredOn: z.string().trim().max(30).optional().default(''),
}).strict();

const RESERVATION_ACTIVATABLE_STATUSES = new Set([
  'pre_launch',
  'accepting_reservations',
  'partially_funded',
]);

const PUBLISHABLE_STATUSES = new Set([
  'pre_launch',
  'accepting_reservations',
  'partially_funded',
  'fully_funded',
  'proofing',
  'scheduled_for_print',
  'printed',
  'delivered',
]);

const ACTIVATION_REVIEW_RECORD_LIMIT = 100;
const ACTIVATION_BLOCKING_PAYMENT_STATUSES = new Set([
  'pending',
  'manual_review',
  'disputed',
]);
const ACTIVATION_BLOCKING_RESERVATION_STATUSES = new Set([
  'payment_review',
  'disputed',
]);

function activationBlockers(
  record: DocumentData,
  evidenceReason: ReturnType<typeof campaignOperationalEvidenceBlockReason> = null,
) {
  const blockers: string[] = [];
  if (!RESERVATION_ACTIVATABLE_STATUSES.has(String(record.status))) {
    blockers.push('Campaign lifecycle state that can accept reservations');
  }
  if (!campaignMatchesActiveSharedModel(record)) blockers.push('Active 24-slot campaign model and version');
  if (record.artworkPreflightApproved !== true) blockers.push('Physical and postal artwork preflight for the experimental 24-unit layout');
  if (record.economicsVerified !== true) blockers.push('Verified economics and minimum margin');
  if (record.routesConfirmed !== true) blockers.push('Confirmed routes and household basis');
  const evidenceBlocker = campaignOperationalEvidenceBlockerLabel(evidenceReason);
  if (evidenceBlocker && !blockers.includes(evidenceBlocker)) blockers.push(evidenceBlocker);
  if (!record.plannedDeliveryStart || !record.plannedDeliveryEnd) blockers.push('Planned delivery period');
  const deadline = record.reservationDeadline ? Date.parse(String(record.reservationDeadline)) : Number.NaN;
  if (!Number.isFinite(deadline) || deadline <= Date.now()) blockers.push('Future reservation deadline');
  if (!getApprovedCampaignContractVersions(record)) {
    blockers.push('Explicitly approved campaign terms and funding-policy versions');
  }
  if (process.env.PAYMENTS_ENABLED !== 'true') blockers.push('PAYMENTS_ENABLED=true server approval');
  if (!process.env.STRIPE_SECRET_KEY) blockers.push('Stripe secret key');
  if (!process.env.STRIPE_WEBHOOK_SECRET) blockers.push('Stripe webhook secret');
  if (!process.env.BUSINESS_POSTAL_ADDRESS) blockers.push('Valid business postal address');
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';
  if (!/^https:\/\//i.test(siteUrl)) blockers.push('Canonical HTTPS site URL');
  const enabledCategories = Array.isArray(record.categories)
    ? record.categories.filter((category: DocumentData) => category.enabled !== false)
    : [];
  const minimumPaidPlacements = Number(record.minimumPaidPlacements || 0);
  if (compatibleNonSensitiveCategorySlugs(enabledCategories).length < minimumPaidPlacements) {
    blockers.push('Enough compatible non-sensitive exclusive categories');
  }
  const totalSlots = Number(record.placements?.standard?.total || 0);
  if (totalSlots < minimumPaidPlacements) blockers.push('Enough placement inventory');
  return blockers;
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error && error.message.includes('not configured')
    ? 'Firebase Admin is not configured.'
    : 'Campaign operation failed.';
  return NextResponse.json({ error: message }, { status: message.includes('configured') ? 503 : 500 });
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const snapshot = await db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id).get();
    if (!snapshot.exists) return NextResponse.json({ campaign: null });
    const data = snapshot.data()!;
    const routePlanId = typeof data.routePlanId === 'string' ? data.routePlanId : null;
    const routePlanSnapshot = routePlanId
      ? await db.collection('routeplans').doc(routePlanId).get()
      : null;
    const evidenceReason = campaignOperationalEvidenceBlockReason(
      FOUNDING_CAMPAIGN.id,
      data,
      routePlanId,
      routePlanSnapshot?.data(),
    );
    return NextResponse.json({
      campaign: {
        id: snapshot.id,
        planId: data.planId || null,
        offerModelVersion: data.offerModelVersion || null,
        status: data.status,
        published: Boolean(data.published),
        paymentActivation: Boolean(data.paymentActivation),
        economicsVerified: Boolean(data.economicsVerified),
        routesConfirmed: Boolean(data.routesConfirmed),
        clearedFundingCents: Number(data.clearedFundingCents || 0),
        currentPaidPlacementCount: Number(data.currentPaidPlacementCount || 0),
        minimumPaidPlacements: Number(data.minimumPaidPlacements || 0),
        printReadyAt: data.printReadyAt?.toDate?.()?.toISOString?.() || data.printReadyAt || null,
        printScheduleReference: data.printScheduleReference || null,
        printedEvidenceReference: data.printedEvidenceReference || null,
        deliveredEvidenceReference: data.deliveredEvidenceReference || null,
        activationBlockers: activationBlockers(data, evidenceReason),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = actionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Unsupported campaign action.' }, { status: 400 });

    const db = getAdminFirestore();
    const campaignRef = db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id);
    const publicRef = db.collection('publiccampaigns').doc(FOUNDING_CAMPAIGN.id);

    if (parsed.data.action === 'initialize') {
      const existing = await campaignRef.get();
      if (existing.exists) {
        return NextResponse.json({ error: 'The founding campaign already exists.' }, { status: 409 });
      }

      const record = createFoundingCampaignRecord(owner.uid);
      const batch = db.batch();
      batch.create(campaignRef, { ...record, published: false });
      for (const size of ['standard'] as const) {
        const total = record.placements[size].total;
        for (let position = 1; position <= total; position += 1) {
          const id = placementSlotId(FOUNDING_CAMPAIGN.id, size, position);
          batch.create(db.collection('placementslots').doc(id), {
            campaignId: FOUNDING_CAMPAIGN.id,
            planId: FOUNDING_CAMPAIGN.planId,
            offerModelVersion: FOUNDING_CAMPAIGN.offerModelVersion,
            size,
            position,
            status: 'available',
            reservationId: null,
            expiresAt: null,
            updatedAt: FieldValue.serverTimestamp(),
          });
        }
      }
      batch.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'campaign.initialize',
        entityId: FOUNDING_CAMPAIGN.id,
        summary: `Initialized the ${FOUNDING_CAMPAIGN.offerModelVersion} founding campaign with ${FOUNDING_CAMPAIGN.placements.standard.count} equal slots, zero funding, and paused categories.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return NextResponse.json({ success: true, status: 'pre_launch', published: false });
    }

    if (parsed.data.action === 'publish') {
      const publishResult = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const };
        if (!campaignMatchesActiveSharedModel(current)) {
          return { success: false as const, reason: 'model' as const };
        }
        if (!PUBLISHABLE_STATUSES.has(String(current.status))) {
          return { success: false as const, reason: 'status' as const };
        }
        transaction.set(publicRef, toPublicCampaign({ ...current, id: currentSnapshot.id }, true));
        transaction.update(campaignRef, {
          published: true,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'campaign.publish',
          entityId: FOUNDING_CAMPAIGN.id,
          summary: 'Published the sanitized current campaign projection.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true as const };
      });
      if (!publishResult.success) {
        const error = publishResult.reason === 'missing'
          ? 'Initialize the campaign first.'
          : publishResult.reason === 'model'
            ? 'Only the exact active shared-mailer model can be published.'
            : 'A draft or terminal/refund campaign cannot be newly published.';
        return NextResponse.json({ error }, { status: publishResult.reason === 'missing' ? 404 : 409 });
      }
      return NextResponse.json({ success: true, published: true });
    }

    if (parsed.data.action === 'activate_reservations') {
      if (parsed.data.confirmation !== 'ACTIVATE CAMPAIGN CHECKOUT') {
        return NextResponse.json({ error: 'Exact activation confirmation is required.' }, { status: 400 });
      }
      const auditRef = db.collection('auditlog').doc();
      const activation = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const, blockers: [] };
        const routePlanId = typeof current.routePlanId === 'string' ? current.routePlanId : null;
        const routePlanSnapshot = routePlanId
          ? await transaction.get(db.collection('routeplans').doc(routePlanId))
          : null;
        const [reservationReviewSnapshot, paymentReviewSnapshot] = await Promise.all([
          transaction.get(
            db.collection('reservations')
              .where('campaignId', '==', FOUNDING_CAMPAIGN.id)
              .limit(ACTIVATION_REVIEW_RECORD_LIMIT + 1),
          ),
          transaction.get(
            db.collection('payments')
              .where('campaignId', '==', FOUNDING_CAMPAIGN.id)
              .limit(ACTIVATION_REVIEW_RECORD_LIMIT + 1),
          ),
        ]);
        const evidenceReason = campaignOperationalEvidenceBlockReason(
          FOUNDING_CAMPAIGN.id,
          current,
          routePlanId,
          routePlanSnapshot?.data(),
        );
        const blockers = activationBlockers(current, evidenceReason);
        const reviewQueryOverflow = reservationReviewSnapshot.size > ACTIVATION_REVIEW_RECORD_LIMIT
          || paymentReviewSnapshot.size > ACTIVATION_REVIEW_RECORD_LIMIT;
        const hasUnresolvedActiveModelReservation = reservationReviewSnapshot.docs.some((document) => {
          const reservation = document.data();
          return reservation.planId === FOUNDING_CAMPAIGN.planId
            && reservation.offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion
            && ACTIVATION_BLOCKING_RESERVATION_STATUSES.has(String(reservation.status));
        });
        const hasUnresolvedActiveModelPayment = paymentReviewSnapshot.docs.some((document) => {
          const payment = document.data();
          return payment.planId === FOUNDING_CAMPAIGN.planId
            && payment.offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion
            && ACTIVATION_BLOCKING_PAYMENT_STATUSES.has(String(payment.status));
        });
        if (reviewQueryOverflow) {
          blockers.push('Manual review of founding-campaign payment and reservation record volume');
        } else if (hasUnresolvedActiveModelReservation || hasUnresolvedActiveModelPayment) {
          blockers.push('No unresolved active-model payments or reservations');
        }
        if (blockers.length) {
          return { success: false as const, reason: 'blocked' as const, blockers };
        }
        const cleared = Number(current.clearedFundingCents || 0);
        const status = cleared >= Number(current.fundingGoalCents)
          ? 'fully_funded'
          : cleared > 0 ? 'partially_funded' : 'accepting_reservations';
        transaction.update(campaignRef, {
          status,
          paymentActivation: true,
          paymentsEnabled: true,
          activatedBy: owner.uid,
          activatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'campaign.reservations.activate',
          entityId: FOUNDING_CAMPAIGN.id,
          summary: 'Activated owner-invited hosted checkout after every server prerequisite passed.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true as const, status };
      });
      if (!activation.success) {
        if (activation.reason === 'missing') {
          return NextResponse.json({ error: 'Initialize the campaign first.' }, { status: 404 });
        }
        return NextResponse.json(
          { error: 'Reservation activation is blocked.', blockers: activation.blockers },
          { status: 409 },
        );
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: activation.status, paymentActivation: true });
    }

    if (parsed.data.action === 'deactivate_reservations') {
      const deactivated = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        if (!currentSnapshot.exists) return false;
        transaction.update(campaignRef, {
          paymentActivation: false,
          paymentsEnabled: false,
          deactivatedBy: owner.uid,
          deactivatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'campaign.reservations.deactivate',
          entityId: FOUNDING_CAMPAIGN.id,
          summary: 'Disabled new category holds and checkout; existing provider records were not altered.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!deactivated) return NextResponse.json({ error: 'Initialize the campaign first.' }, { status: 404 });
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, paymentActivation: false });
    }

    if (parsed.data.action === 'begin_proofing') {
      if (parsed.data.confirmation !== 'BEGIN PROOFING') {
        return NextResponse.json({ error: 'Exact proofing confirmation is required.' }, { status: 400 });
      }
      const auditRef = db.collection('auditlog').doc();
      const proofing = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const };
        if (!canTransitionCampaign(String(current.status), 'proofing')) {
          return { success: false as const, reason: 'status' as const };
        }
        if (!campaignMatchesActiveSharedModel(current)) {
          return { success: false as const, reason: 'model' as const };
        }
        const routePlanId = typeof current.routePlanId === 'string' ? current.routePlanId : null;
        const routePlanSnapshot = routePlanId
          ? await transaction.get(db.collection('routeplans').doc(routePlanId))
          : null;
        if (campaignOperationalEvidenceBlockReason(
          FOUNDING_CAMPAIGN.id,
          current,
          routePlanId,
          routePlanSnapshot?.data(),
        )) {
          return { success: false as const, reason: 'evidence' as const };
        }
        const [reservations, payments] = await Promise.all([
          transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        ]);
        const activeModelReservations = reservations.docs.filter((document) =>
          document.data().planId === FOUNDING_CAMPAIGN.planId
          && document.data().offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion,
        );
        const activeHolds = activeModelReservations.filter((document) => isLiveInventoryState({
          status: document.data().status,
          expiresAt: document.data().holdExpiresAt,
        })).filter((document) => ['hold', 'awaiting_payment'].includes(String(document.data().status)));
        if (activeHolds.length) return { success: false as const, reason: 'holds' as const };
        const paidPlacements = activeModelReservations.filter((document) => document.data().status === 'paid');
        const currentPayments = payments.docs
          .filter((document) => document.data().planId === FOUNDING_CAMPAIGN.planId
            && document.data().offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion)
          .map((document) => ({ id: document.id, ...document.data() })) as CampaignPayment[];
        if (clearedNetFundingCents(currentPayments) < Number(current.fundingGoalCents || 0)
          || paidPlacements.length < Number(current.minimumPaidPlacements || 0)) {
          return { success: false as const, reason: 'funding' as const };
        }
        transaction.update(campaignRef, {
          status: 'proofing',
          paymentActivation: false,
          paymentsEnabled: false,
          proofingStartedBy: owner.uid,
          proofingStartedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: 'campaign.proofing.begin',
          entityId: FOUNDING_CAMPAIGN.id,
          summary: 'Closed new checkout and began proofing after current funding and advertiser gates passed.',
          createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true as const };
      });
      if (!proofing.success) {
        const error = proofing.reason === 'missing'
          ? 'Initialize the campaign first.'
          : proofing.reason === 'model'
            ? 'The legacy campaign model cannot enter proofing.'
            : proofing.reason === 'holds'
              ? 'Resolve or expire every open hold before proofing.'
              : proofing.reason === 'funding'
                ? 'Cleared funding and the minimum paid-placement count are required.'
                : proofing.reason === 'evidence'
                  ? 'Recheck the exact attached routes and current Printing4SuperCheap quote before proofing.'
                : 'Proofing can begin only after the campaign is fully funded.';
        return NextResponse.json({ error }, { status: proofing.reason === 'missing' ? 404 : 409 });
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: 'proofing' });
    }

    const evidenceActions = {
      schedule_for_print: { from: 'proofing', to: 'scheduled_for_print', confirmation: 'RECORD PRINT SCHEDULE', field: 'printScheduleReference', dateField: 'printScheduledRecordedAt' },
      record_printed: { from: 'scheduled_for_print', to: 'printed', confirmation: 'RECORD PRINTED', field: 'printedEvidenceReference', dateField: 'printedOn' },
      record_delivered: { from: 'printed', to: 'delivered', confirmation: 'RECORD DELIVERED', field: 'deliveredEvidenceReference', dateField: 'deliveredOn' },
    } as const;
    if (parsed.data.action in evidenceActions) {
      const action = parsed.data.action as keyof typeof evidenceActions;
      const transition = evidenceActions[action];
      if (parsed.data.confirmation !== transition.confirmation) {
        return NextResponse.json({ error: 'Exact lifecycle confirmation is required.' }, { status: 400 });
      }
      if (parsed.data.evidenceReference.length < 5) {
        return NextResponse.json({ error: 'A real external evidence or document reference is required.' }, { status: 400 });
      }
      let occurredOn: string | null = null;
      if (action !== 'schedule_for_print') {
        const timestamp = Date.parse(parsed.data.occurredOn);
        if (!Number.isFinite(timestamp) || timestamp > Date.now()) {
          return NextResponse.json({ error: 'A real non-future occurrence date is required.' }, { status: 400 });
        }
        occurredOn = new Date(timestamp).toISOString().slice(0, 10);
      }
      const update: DocumentData = {
        status: transition.to,
        [transition.field]: parsed.data.evidenceReference,
        [`${transition.field}RecordedBy`]: owner.uid,
        [`${transition.field}RecordedAt`]: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };
      if (occurredOn) update[transition.dateField] = occurredOn;

      const auditRef = db.collection('auditlog').doc();
      const lifecycle = await db.runTransaction(async (transaction) => {
        const transactionUpdate: DocumentData = { ...update };
        const latestSnapshot = await transaction.get(campaignRef);
        const latest = latestSnapshot.data();
        if (!latest) return { success: false as const, reason: 'missing' as const };
        if (latest.status !== transition.from || !canTransitionCampaign(String(latest.status), transition.to)) {
          return { success: false as const, reason: 'status' as const };
        }
        if (!campaignMatchesActiveSharedModel(latest)) {
          return { success: false as const, reason: 'model' as const };
        }
        if (['schedule_for_print', 'record_printed'].includes(action)) {
          const routePlanId = typeof latest.routePlanId === 'string' ? latest.routePlanId : null;
          const [
            routePlanSnapshot,
            reservations,
            proofs,
            materials,
            creativeBriefs,
            payments,
            placementSlots,
          ] = await Promise.all([
            routePlanId
              ? transaction.get(db.collection('routeplans').doc(routePlanId))
              : Promise.resolve(null),
            transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
            transaction.get(db.collection('proofs').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
            transaction.get(db.collection('materials').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
            transaction.get(db.collection('creativebriefs').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
            transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
            transaction.get(
              db.collection('placementslots')
                .limit(PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT + 1),
            ),
          ]);
          const [providerEvidencePayments, refundEvidence] = await Promise.all([
            paymentDocumentsWithProviderCollisions(transaction, db, payments.docs),
            refundDocumentsWithLinkedEvidence(
              transaction,
              db,
              FOUNDING_CAMPAIGN.id,
              payments.docs,
              reservations.docs,
            ),
          ]);
          if (campaignOperationalEvidenceBlockReason(
            FOUNDING_CAMPAIGN.id,
            latest,
            routePlanId,
            routePlanSnapshot?.data(),
          )) {
            return { success: false as const, reason: 'evidence' as const };
          }
          const operations = campaignPrintReadinessState(
            latest,
            reservations.docs,
            proofs.docs,
            refundEvidence,
            materials.docs,
            creativeBriefs.docs,
            payments.docs,
            routePlanSnapshot?.data(),
            Date.now(),
            providerEvidencePayments,
            placementSlots.docs,
            placementSlots.size > PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT,
          );
          if (!operations.readiness.ready) {
            return { success: false as const, reason: 'readiness' as const };
          }
          if (action === 'record_printed') {
            const printedInputSnapshot = buildPrintedInputSnapshot(
              FOUNDING_CAMPAIGN.id,
              reservations.docs,
            );
            if (!printedInputSnapshot) {
              return { success: false as const, reason: 'printed_inputs' as const };
            }
            transactionUpdate.printedInputSnapshot = printedInputSnapshot;
            transactionUpdate.printedInputSnapshotRecordedAt = FieldValue.serverTimestamp();
          }
        }
        if (action === 'record_delivered') {
          const reservations = await transaction.get(
            db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id),
          );
          if (!printedInputSnapshotMatches(
            latest.printedInputSnapshot,
            FOUNDING_CAMPAIGN.id,
            reservations.docs,
          )) {
            return { success: false as const, reason: 'printed_inputs' as const };
          }
        }
        transaction.update(campaignRef, transactionUpdate);
        transaction.create(auditRef, {
          actorUid: owner.uid,
          action: `campaign.lifecycle.${action}`,
          entityId: FOUNDING_CAMPAIGN.id,
          summary: `Recorded ${transition.to.replaceAll('_', ' ')} with an owner-supplied external evidence reference; the app placed no order and sent no message.`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { success: true as const };
      });
      if (!lifecycle.success) {
        const error = lifecycle.reason === 'readiness'
          ? 'The current complete print-readiness gate and explicit owner approval are required.'
          : lifecycle.reason === 'printed_inputs'
            ? 'Delivery requires the exact immutable creative-input snapshot recorded at print time.'
          : lifecycle.reason === 'evidence'
            ? 'Recheck the exact attached routes and current Printing4SuperCheap quote before production.'
          : lifecycle.reason === 'model'
            ? 'Only the exact active shared-mailer model can advance through production.'
            : lifecycle.reason === 'missing'
              ? 'Initialize the campaign first.'
              : `Campaign must be ${transition.from.replaceAll('_', ' ')} first.`;
        return NextResponse.json({ error }, { status: lifecycle.reason === 'missing' ? 404 : 409 });
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: transition.to });
    }

    if (parsed.data.action === 'complete_campaign') {
      if (parsed.data.confirmation !== 'COMPLETE CAMPAIGN') return NextResponse.json({ error: 'Exact completion confirmation is required.' }, { status: 400 });
      const auditRef = db.collection('auditlog').doc();
      const completed = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const };
        if (!campaignMatchesActiveSharedModel(current)) {
          return { success: false as const, reason: 'model' as const };
        }
        if (!canTransitionCampaign(String(current.status), 'completed')) {
          return { success: false as const, reason: 'status' as const };
        }
        transaction.update(campaignRef, { status: 'completed', completedBy: owner.uid, completedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'campaign.complete', entityId: FOUNDING_CAMPAIGN.id, summary: 'Marked the campaign complete after current recorded delivery evidence.', createdAt: FieldValue.serverTimestamp() });
        return { success: true as const };
      });
      if (!completed.success) {
        const error = completed.reason === 'missing'
          ? 'Initialize the campaign first.'
          : completed.reason === 'model'
            ? 'Only the exact active shared-mailer model can be completed.'
            : 'Record delivery evidence first.';
        return NextResponse.json({ error }, { status: completed.reason === 'missing' ? 404 : 409 });
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: 'completed' });
    }

    if (parsed.data.action === 'cancel_campaign') {
      if (parsed.data.confirmation !== 'CANCEL AND RECORD REFUNDS') {
        return NextResponse.json({ error: 'Exact cancellation confirmation is required.' }, { status: 400 });
      }
      const auditRef = db.collection('auditlog').doc();
      const cancellation = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const };
        if (!campaignMatchesActiveSharedModel(current)) {
          return { success: false as const, reason: 'model' as const };
        }
        if (!['pre_launch', 'accepting_reservations', 'partially_funded', 'fully_funded', 'proofing'].includes(String(current.status))) {
          return { success: false as const, reason: 'status' as const };
        }
        const [payments, reservations] = await Promise.all([
          transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        ]);
        const refundEvidence = await refundDocumentsWithLinkedEvidence(
          transaction,
          db,
          FOUNDING_CAMPAIGN.id,
          payments.docs,
          reservations.docs,
        );
        let ledger: ReturnType<typeof strictPaymentRefundLedger>;
        try {
          ledger = strictPaymentRefundLedger(payments.docs, refundEvidence, FOUNDING_CAMPAIGN.id);
        } catch (error) {
          if (error instanceof Error && error.message === 'payment-refund-ledger-invalid') {
            return { success: false as const, reason: 'ledger' as const };
          }
          throw error;
        }
        if (ledger.payments.some((payment) => ['disputed', 'manual_review'].includes(payment.status))) {
          return { success: false as const, reason: 'payment_review' as const };
        }
        const remainingClearedCents = ledger.clearedNetCents;
        const obligations: Array<{ id: string; data: DocumentData }> = [];
        for (const payment of ledger.payments) {
          if (!['cleared', 'partially_refunded'].includes(payment.status)) continue;
          const uncovered = payment.netCents
            - (ledger.activeRefundCentsByPayment.get(payment.id) || 0);
          if (uncovered < 1) continue;
          obligations.push({
            id: `${FOUNDING_CAMPAIGN.id}__cancel__${payment.id}__${payment.refundedCents}`,
            data: {
              campaignId: FOUNDING_CAMPAIGN.id,
              paymentId: payment.id,
              reservationId: payment.reservationId,
              businessName: 'Campaign advertiser',
              amountCents: uncovered,
              reason: 'Campaign cancellation under the accepted funding policy.',
              status: 'requested',
              requestedBy: owner.uid,
              source: 'campaign_cancellation',
              requiredFullRefund: true,
              ownerRejectable: false,
              createdAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp(),
            },
          });
        }
        for (const obligation of obligations) {
          transaction.create(db.collection('refunds').doc(obligation.id), obligation.data);
        }
        const nextStatus = remainingClearedCents > 0 ? 'refunding' : 'cancelled';
        transaction.update(campaignRef, {
          status: nextStatus,
          paymentActivation: false,
          paymentsEnabled: false,
          ownerPrintApproved: false,
          printReadyAt: null,
          printReadinessRevokedAt: FieldValue.serverTimestamp(),
          printReadinessRevokedReason: 'campaign_cancelled',
          cancelledBy: owner.uid,
          cancellationRecordedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'campaign.cancel', entityId: FOUNDING_CAMPAIGN.id, summary: remainingClearedCents > 0 ? 'Cancelled new activity and recorded refund obligations; no provider refund was submitted.' : 'Cancelled the unfunded campaign; no provider action occurred.', createdAt: FieldValue.serverTimestamp() });
        return { success: true as const, status: nextStatus };
      });
      if (!cancellation.success) {
        const error = cancellation.reason === 'missing'
          ? 'Initialize the campaign first.'
          : cancellation.reason === 'model'
            ? 'Only the exact active shared-mailer model can use cancellation.'
          : cancellation.reason === 'ledger'
            ? 'Payment or refund ledger records are inconsistent; cancellation was not recorded.'
          : cancellation.reason === 'payment_review'
            ? 'Resolve disputed or manual-review payments before cancelling.'
            : 'This campaign state cannot use the cancellation workflow.';
        return NextResponse.json({ error }, { status: cancellation.reason === 'missing' ? 404 : 409 });
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: cancellation.status });
    }

    if (parsed.data.action === 'close_cancelled') {
      if (parsed.data.confirmation !== 'CLOSE CANCELLED CAMPAIGN') return NextResponse.json({ error: 'Exact close confirmation is required.' }, { status: 400 });
      const auditRef = db.collection('auditlog').doc();
      const closing = await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(campaignRef);
        const current = currentSnapshot.data();
        if (!current) return { success: false as const, reason: 'missing' as const };
        if (!campaignMatchesActiveSharedModel(current)) {
          return { success: false as const, reason: 'model' as const };
        }
        if (!canTransitionCampaign(String(current.status), 'cancelled')) {
          return { success: false as const, reason: 'status' as const };
        }
        const [payments, reservations] = await Promise.all([
          transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
          transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        ]);
        const refundEvidence = await refundDocumentsWithLinkedEvidence(
          transaction,
          db,
          FOUNDING_CAMPAIGN.id,
          payments.docs,
          reservations.docs,
        );
        let ledger: ReturnType<typeof strictPaymentRefundLedger>;
        try {
          ledger = strictPaymentRefundLedger(payments.docs, refundEvidence, FOUNDING_CAMPAIGN.id);
        } catch (error) {
          if (error instanceof Error && error.message === 'payment-refund-ledger-invalid') {
            return { success: false as const, reason: 'ledger' as const };
          }
          throw error;
        }
        const unresolved = ledger.activeRefundCount > 0;
        const unsafePayment = ledger.payments.some((payment) => (
          ['disputed', 'manual_review', 'pending'].includes(payment.status)
        ));
        const netCleared = ledger.clearedNetCents;
        if (unresolved || unsafePayment || netCleared > 0) {
          return { success: false as const, reason: 'obligations' as const };
        }
        transaction.update(campaignRef, { status: 'cancelled', cancelledClosedBy: owner.uid, cancelledClosedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        transaction.create(auditRef, { actorUid: owner.uid, action: 'campaign.cancel.close', entityId: FOUNDING_CAMPAIGN.id, summary: 'Closed the cancelled campaign after current refund obligations resolved and cleared net funding reached zero.', createdAt: FieldValue.serverTimestamp() });
        return { success: true as const };
      });
      if (!closing.success) {
        const error = closing.reason === 'missing'
          ? 'Initialize the campaign first.'
          : closing.reason === 'model'
            ? 'Only the exact active shared-mailer model can close cancellation.'
          : closing.reason === 'ledger'
            ? 'Payment or refund ledger records are inconsistent; cancellation cannot be closed.'
          : closing.reason === 'obligations'
          ? 'All refund obligations must be provider-confirmed, no payment may need review, and cleared net funding must be zero.'
          : 'The campaign is not in refunding state.';
        return NextResponse.json({ error }, { status: closing.reason === 'missing' ? 404 : 409 });
      }
      await syncCampaignState(db, FOUNDING_CAMPAIGN.id);
      return NextResponse.json({ success: true, status: 'cancelled' });
    }

    const unpublished = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(campaignRef);
      if (!currentSnapshot.exists) return false;
      transaction.delete(publicRef);
      transaction.update(campaignRef, {
        published: false,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'campaign.unpublish',
        entityId: FOUNDING_CAMPAIGN.id,
        summary: 'Removed the public campaign projection.',
        createdAt: FieldValue.serverTimestamp(),
      });
      return true;
    });
    if (!unpublished) return NextResponse.json({ error: 'Initialize the campaign first.' }, { status: 404 });
    return NextResponse.json({ success: true, published: false });
  } catch (error) {
    return errorResponse(error);
  }
}
