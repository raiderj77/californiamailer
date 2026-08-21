import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, type DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  FOUNDING_CAMPAIGN,
  FOUNDING_INVENTORY_GROSS_CENTS,
  campaignMatchesActiveSharedModel,
} from '@/config/foundingCampaign';
import {
  calculateCostSummary,
  clearedNetFundingCents,
  evaluatePrintReadiness,
  hasApprovedLatestMaterial,
  latestProofStatus,
  quoteVerificationStatus,
} from '@/lib/businessRules';
import { campaignOperationalEvidenceBlockReason } from '@/lib/campaignOperationalGates';
import type { CampaignCosts, CampaignPayment } from '@/lib/campaignTypes';
import { toPublicCampaign } from '@/lib/campaignRecords';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';
import { calculateMinimumPlanningSafeguards } from '@/lib/sharedMailerEconomics';

export const runtime = 'nodejs';
const cents = z.number().int().min(0).max(100_000_000);
const nullableCents = cents.nullable();
const positiveNullableCents = z.number().int().min(1).max(100_000_000).nullable();
const updateSchema = z.object({
  plannedDeliveryStart: z.string().date().nullable(),
  plannedDeliveryEnd: z.string().date().nullable(),
  reservationDeadline: z.string().datetime({ offset: true }).nullable(),
  artworkPreflightApproved: z.boolean(),
  costs: z.object({
    supplierId: z.literal(PRINTING4SUPERCHEAP.id),
    mailPieceCount: z.number().int().min(1).max(1_000_000).nullable(),
    printingCostCents: positiveNullableCents, postageCostCents: positiveNullableCents, shippingCostCents: nullableCents,
    taxCostCents: nullableCents, designCostCents: nullableCents, ownerLaborCostCents: nullableCents,
    processingFeeCents: positiveNullableCents, refundReserveCents: nullableCents,
    reprintReserveCents: nullableCents, softwareAllocationCents: nullableCents, otherExpensesCents: nullableCents,
    targetOwnerSurplusCents: nullableCents,
    printerQuoteReference: z.string().trim().max(300).nullable(), quoteVerifiedAt: z.string().date().nullable(),
  }).strict(),
}).strict();
const approvalSchema = z.object({ action: z.enum(['approve_print_readiness', 'revoke_print_readiness']), confirmation: z.string().max(200) }).strict();
const campaignDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function campaignDateKey(instant: string): string {
  const values = new Map(campaignDateFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]));
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

function scheduleValidationError(input: z.infer<typeof updateSchema>): string | null {
  if (input.plannedDeliveryEnd && !input.plannedDeliveryStart) {
    return 'Planned delivery start is required when a delivery end date is set.';
  }
  if (input.plannedDeliveryStart && input.plannedDeliveryEnd && input.plannedDeliveryStart > input.plannedDeliveryEnd) {
    return 'Planned delivery start cannot be after planned delivery end.';
  }
  if (!input.reservationDeadline) return null;
  if (Date.parse(input.reservationDeadline) <= Date.now()) {
    return 'Reservation deadline must be in the future.';
  }
  if (!input.plannedDeliveryStart) {
    return 'Planned delivery start is required when a reservation deadline is set.';
  }
  if (campaignDateKey(input.reservationDeadline) >= input.plannedDeliveryStart) {
    return 'Reservation deadline must fall on a Pacific calendar date before planned delivery start.';
  }
  return null;
}

class ActiveSharedModelMismatchError extends Error {}
class CampaignEconomicsRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

const ECONOMICS_EDITABLE_STATUSES = new Set([
  'pre_launch',
  'accepting_reservations',
  'partially_funded',
  'fully_funded',
  'proofing',
  'scheduled_for_print',
]);

function assertActiveSharedModel(data: DocumentData) {
  if (!campaignMatchesActiveSharedModel(data)) {
    throw new ActiveSharedModelMismatchError('The saved campaign does not match the active shared-mailer model and must be migrated explicitly.');
  }
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof ActiveSharedModelMismatchError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof CampaignEconomicsRequestError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json({ error: unavailable ? 'Firebase Admin is not configured.' : 'Economics operation failed.' }, { status: unavailable ? 503 : 500 });
}

function campaignCosts(data: DocumentData): CampaignCosts {
  const costs = data.costs || {};
  const value = (key: keyof CampaignCosts) => {
    const raw = costs[key];
    return typeof raw === 'number' && Number.isSafeInteger(raw) ? raw : null;
  };
  return {
    supplierId: costs.supplierId === PRINTING4SUPERCHEAP.id ? PRINTING4SUPERCHEAP.id : null,
    mailPieceCount: value('mailPieceCount'), printingCostCents: value('printingCostCents'), postageCostCents: value('postageCostCents'),
    shippingCostCents: value('shippingCostCents'), taxCostCents: value('taxCostCents'), designCostCents: value('designCostCents'),
    ownerLaborCostCents: value('ownerLaborCostCents'), processingFeeCents: value('processingFeeCents'),
    refundReserveCents: value('refundReserveCents'), reprintReserveCents: value('reprintReserveCents'), softwareAllocationCents: value('softwareAllocationCents'),
    otherExpensesCents: value('otherExpensesCents'), targetOwnerSurplusCents: value('targetOwnerSurplusCents'),
    printerQuoteReference: typeof costs.printerQuoteReference === 'string' && costs.printerQuoteReference.trim() ? costs.printerQuoteReference : null,
    quoteVerifiedAt: typeof costs.quoteVerifiedAt === 'string' && costs.quoteVerifiedAt.trim() ? costs.quoteVerifiedAt : null,
    version: typeof costs.version === 'number' && Number.isSafeInteger(costs.version) ? costs.version : 1,
  };
}

type SnapshotDocument = { id: string; data: () => DocumentData };

function unresolvedPaymentReviewKeys(
  reservations: Array<DocumentData & { id: string }>,
  paymentDocuments: SnapshotDocument[],
): Set<string> {
  const unresolved = new Set<string>();
  for (const document of paymentDocuments) {
    const payment = document.data();
    if (!['pending', 'manual_review', 'disputed'].includes(String(payment.status))) continue;
    const reservationId = typeof payment.reservationId === 'string' && payment.reservationId
      ? payment.reservationId
      : null;
    unresolved.add(reservationId ? `reservation:${reservationId}` : `payment:${document.id}`);
  }
  for (const reservation of reservations) {
    if (!['payment_review', 'disputed'].includes(String(reservation.status))) continue;
    unresolved.add(`reservation:${reservation.id}`);
  }
  return unresolved;
}

function readinessState(
  data: DocumentData,
  reservationDocuments: SnapshotDocument[],
  proofDocuments: SnapshotDocument[],
  refundDocuments: SnapshotDocument[],
  materialDocuments: SnapshotDocument[],
  paymentDocuments: SnapshotDocument[],
  routePlan: DocumentData | undefined,
  atMs = Date.now(),
) {
  assertActiveSharedModel(data);
  const reservations: Array<DocumentData & { id: string }> = reservationDocuments.map((doc) => ({ id: doc.id, ...doc.data() }));
  const paid = reservations.filter((item) => item.status === 'paid'
    && item.planId === FOUNDING_CAMPAIGN.planId
    && item.offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion);
  const paidAdvertiserCount = new Set(paid.map((item) => String(item.emailNormalized || item.id))).size;
  const proofs: Array<DocumentData & { id: string }> = proofDocuments.map((doc) => ({ id: doc.id, ...doc.data() }));
  const paidProofStatuses = paid.map((reservation) => latestProofStatus(reservation, proofs));
  const pricePerPaidPlacementCents = FOUNDING_CAMPAIGN.placements.standard.priceCents;
  const materials: Array<DocumentData & { id: string }> = materialDocuments.map((doc) => ({ id: doc.id, ...doc.data() }));
  const approvedMaterialCount = paid.filter((reservation) => hasApprovedLatestMaterial(reservation, materials)).length;
  const paidDisclaimerCount = paid.filter((reservation) => typeof reservation.advertiserDisclaimer === 'string' && reservation.advertiserDisclaimer.trim().length >= 2).length;
  const refundObligationCents = refundDocuments.reduce((total, doc) => {
    const refund = doc.data();
    return ['requested', 'approved', 'submitted'].includes(String(refund.status)) ? total + Number(refund.amountCents || 0) : total;
  }, 0);
  const payments = paymentDocuments
    .filter((doc) => doc.data().planId === FOUNDING_CAMPAIGN.planId
      && doc.data().offerModelVersion === FOUNDING_CAMPAIGN.offerModelVersion)
    .map((doc) => ({ id: doc.id, ...doc.data() })) as CampaignPayment[];
  const currentClearedFundingCents = clearedNetFundingCents(payments);
  const unresolvedPaymentReviewCount = unresolvedPaymentReviewKeys(
    reservations,
    paymentDocuments,
  ).size;
  const routePlanId = typeof data.routePlanId === 'string' ? data.routePlanId : null;
  const operationalEvidenceCurrent = campaignOperationalEvidenceBlockReason(
    FOUNDING_CAMPAIGN.id,
    data,
    routePlanId,
    routePlan,
    atMs,
  ) === null;
  const readiness = evaluatePrintReadiness({
    clearedFundingCents: currentClearedFundingCents, fundingGoalCents: Number(data.fundingGoalCents),
    paidReservationCount: paid.length, minimumPaidPlacements: Number(data.minimumPaidPlacements), paidProofStatuses,
    approvedMaterialCount, paidDisclaimerCount, refundObligationCents, unresolvedPaymentReviewCount, verifiedHouseholds: data.verifiedHouseholds === null || data.verifiedHouseholds === undefined ? null : Number(data.verifiedHouseholds),
    artworkPreflightApproved: Boolean(data.artworkPreflightApproved), routesConfirmed: operationalEvidenceCurrent,
    costs: campaignCosts(data), minimumMarginBps: Number(data.minimumMarginBps), ownerPrintApproved: Boolean(data.ownerPrintApproved),
    pricePerPaidPlacementCents,
  });
  const proofStatusCounts = proofs.reduce<Record<string, number>>((counts, proof) => {
    const status = String(proof.status || 'unknown'); counts[status] = (counts[status] || 0) + 1; return counts;
  }, {});
  return {
    readiness,
    paidAdvertiserCount,
    paidReservationCount: paid.length,
    paidProofStatuses,
    proofStatusCounts,
    outstandingPaymentCount: reservations.filter((item) => ['hold', 'awaiting_payment'].includes(String(item.status))).length,
    refundObligationCents,
    currentClearedFundingCents,
    unresolvedPaymentReviewCount,
  };
}

async function operationalState(data: DocumentData) {
  assertActiveSharedModel(data);
  const db = getAdminFirestore();
  const routePlanId = typeof data.routePlanId === 'string' ? data.routePlanId : null;
  const [reservationSnapshot, proofSnapshot, refundSnapshot, interestSnapshot, paymentSnapshot, materialSnapshot, routePlanSnapshot] = await Promise.all([
    db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    db.collection('proofs').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    db.collection('refunds').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    db.collection('reservationinterests').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    db.collection('materials').where('campaignId', '==', FOUNDING_CAMPAIGN.id).get(),
    routePlanId ? db.collection('routeplans').doc(routePlanId).get() : Promise.resolve(null),
  ]);
  const core = readinessState(
    data,
    reservationSnapshot.docs,
    proofSnapshot.docs,
    refundSnapshot.docs,
    materialSnapshot.docs,
    paymentSnapshot.docs,
    routePlanSnapshot?.data(),
  );
  const recentPayments = paymentSnapshot.docs.map((doc) => {
    const payment = doc.data(); const updated = payment.updatedAt?.toDate?.();
    return { id: doc.id, status: String(payment.status || 'unknown'), amountCents: Number(payment.amountCents || 0), updatedAt: updated instanceof Date ? updated.toISOString() : null };
  }).sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 5);
  return { ...core, recentFormSubmissionCount: interestSnapshot.size, recentPayments };
}

async function responseState(data: DocumentData) {
  assertActiveSharedModel(data);
  const operations = await operationalState(data);
  const costs = campaignCosts(data);
  const pricePerPaidPlacementCents = FOUNDING_CAMPAIGN.placements.standard.priceCents;
  const thresholdSummary = calculateCostSummary(costs, Number(data.fundingGoalCents), pricePerPaidPlacementCents);
  const fullInventorySummary = calculateCostSummary(costs, FOUNDING_INVENTORY_GROSS_CENTS, pricePerPaidPlacementCents);
  const minimumMarginFundingCents = thresholdSummary.totalCostCents === null
    ? null
    : Math.ceil(thresholdSummary.totalCostCents / (1 - Number(data.minimumMarginBps) / 10_000));
  const minimumTargetFundingCents = thresholdSummary.totalCostCents === null || thresholdSummary.targetOwnerSurplusCents === null
    ? null
    : thresholdSummary.totalCostCents + thresholdSummary.targetOwnerSurplusCents;
  const minimumSafeFundingCents = minimumMarginFundingCents === null || minimumTargetFundingCents === null
    ? null
    : Math.max(minimumMarginFundingCents, minimumTargetFundingCents);
  return {
    campaign: {
      id: FOUNDING_CAMPAIGN.id, status: data.status, published: Boolean(data.published), targetHouseholds: Number(data.targetHouseholds),
      placements: data.placements || {}, categories: data.categories || [],
      verifiedHouseholds: data.verifiedHouseholds ?? null, householdCountBasis: data.householdCountBasis || null, selectedAreas: data.selectedAreas || [],
      routesConfirmed: Boolean(data.routesConfirmed), plannedDeliveryStart: data.plannedDeliveryStart || null, plannedDeliveryEnd: data.plannedDeliveryEnd || null,
      reservationDeadline: data.reservationDeadline || null, artworkPreflightApproved: Boolean(data.artworkPreflightApproved), ownerPrintApproved: Boolean(data.ownerPrintApproved),
      economicsVerified: Boolean(data.economicsVerified), paymentActivation: Boolean(data.paymentActivation), clearedFundingCents: Number(data.clearedFundingCents || 0),
      fundingGoalCents: Number(data.fundingGoalCents), minimumPaidPlacements: Number(data.minimumPaidPlacements),
      pricePerPaidPlacementCents, minimumMarginBps: Number(data.minimumMarginBps), costs,
    },
    thresholdSummary, fullInventorySummary, minimumSafeFundingCents, ...operations,
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const snapshot = await getAdminFirestore().collection('campaigns').doc(FOUNDING_CAMPAIGN.id).get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Initialize the founding campaign first.' }, { status: 404 });
    const data = snapshot.data()!;
    assertActiveSharedModel(data);
    return NextResponse.json(await responseState(data));
  } catch (error) { return errorResponse(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = updateSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Review every schedule and cost field.' }, { status: 400 });
    const input = parsed.data;
    const scheduleError = scheduleValidationError(input);
    if (scheduleError) return NextResponse.json({ error: scheduleError }, { status: 400 });
    const db = getAdminFirestore();
    const ref = db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id);
    await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) {
        throw new CampaignEconomicsRequestError('Initialize the founding campaign first.', 404);
      }
      const before = currentSnapshot.data()!;
      assertActiveSharedModel(before);
      if (!ECONOMICS_EDITABLE_STATUSES.has(String(before.status))) {
        throw new CampaignEconomicsRequestError(
          'Schedule and economics inputs cannot change after printing or in a terminal/refund lifecycle state.',
          409,
        );
      }
      const currentScheduleError = scheduleValidationError(input);
      if (currentScheduleError) throw new CampaignEconomicsRequestError(currentScheduleError, 400);

      const currentVersion = Number.isSafeInteger(before.costs?.version)
        && Number(before.costs.version) >= 0
        ? Number(before.costs.version)
        : 0;
      const costs: CampaignCosts = { ...input.costs, version: currentVersion + 1 };
      const verifiedHouseholds = before.routesConfirmed === true
        && typeof before.verifiedHouseholds === 'number'
        && Number.isSafeInteger(before.verifiedHouseholds)
        ? before.verifiedHouseholds
        : null;
      if (
        verifiedHouseholds !== null
        && costs.mailPieceCount !== null
        && costs.mailPieceCount < verifiedHouseholds
      ) {
        throw new CampaignEconomicsRequestError(
          'Mail-piece count cannot be lower than the route-verified household count.',
          400,
        );
      }
      if (quoteVerificationStatus(costs.quoteVerifiedAt).blocker === 'quoteVerifiedAt cannot be in the future') {
        throw new CampaignEconomicsRequestError('Printer quote verification date cannot be in the future.', 400);
      }
      if (costs.printingCostCents !== null && costs.postageCostCents !== null && costs.shippingCostCents !== null) {
        const safeguards = calculateMinimumPlanningSafeguards(
          FOUNDING_INVENTORY_GROSS_CENTS,
          FOUNDING_CAMPAIGN.minimumPaidPlacements,
          costs.printingCostCents + costs.postageCostCents + costs.shippingCostCents,
        );
        const below: string[] = [];
        if (costs.processingFeeCents !== null && costs.processingFeeCents < safeguards.processingFeeCents) {
          below.push(`payment processing must be at least $${(safeguards.processingFeeCents / 100).toFixed(2)}`);
        }
        if (costs.refundReserveCents !== null && costs.refundReserveCents < safeguards.refundReserveCents) {
          below.push(`refund reserve must be at least $${(safeguards.refundReserveCents / 100).toFixed(2)}`);
        }
        if (costs.reprintReserveCents !== null && costs.reprintReserveCents < safeguards.productionReserveCents) {
          below.push(`reprint reserve must be at least $${(safeguards.productionReserveCents / 100).toFixed(2)}`);
        }
        if (below.length) {
          throw new CampaignEconomicsRequestError(
            `Planning safeguards are below the current model minimum: ${below.join('; ')}. Enter higher verified costs when applicable.`,
            400,
          );
        }
      }
      const summary = calculateCostSummary(
        costs,
        FOUNDING_INVENTORY_GROSS_CENTS,
        FOUNDING_CAMPAIGN.placements.standard.priceCents,
      );
      const economicsVerified = summary.missingInputs.length === 0
        && summary.contributionMarginBps !== null
        && summary.contributionMarginBps >= Number(before.minimumMarginBps)
        && summary.targetGapCents !== null
        && summary.targetGapCents >= 0;
      const update = {
        ...input,
        costs,
        economicsVerified,
        economicsVerifiedAt: economicsVerified ? FieldValue.serverTimestamp() : null,
        paymentActivation: false,
        paymentsEnabled: false,
        ownerPrintApproved: false,
        printReadyAt: null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(ref, update);
      if (before.published === true) {
        transaction.set(
          db.collection('publiccampaigns').doc(FOUNDING_CAMPAIGN.id),
          toPublicCampaign({ ...before, ...update, id: FOUNDING_CAMPAIGN.id }, true),
        );
      }
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'campaign.economics.update',
        entityId: FOUNDING_CAMPAIGN.id,
        summary: `Updated schedule/cost inputs; economics verified: ${economicsVerified}; checkout and print approval revoked pending explicit reactivation. Route evidence was not changed.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    const after = await ref.get();
    if (!after.exists) throw new CampaignEconomicsRequestError('Initialize the founding campaign first.', 404);
    return NextResponse.json(await responseState(after.data()!));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const db = getAdminFirestore();
    const ref = db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id);
    const parsed = approvalSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid readiness action.' }, { status: 400 });
    if (parsed.data.action === 'revoke_print_readiness') {
      await db.runTransaction(async (transaction) => {
        const currentSnapshot = await transaction.get(ref);
        if (!currentSnapshot.exists) {
          throw new CampaignEconomicsRequestError('Initialize the founding campaign first.', 404);
        }
        assertActiveSharedModel(currentSnapshot.data()!);
        transaction.update(ref, {
          ownerPrintApproved: false,
          printReadyAt: null,
          updatedAt: FieldValue.serverTimestamp(),
        });
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'campaign.print_readiness.revoke',
          entityId: FOUNDING_CAMPAIGN.id,
          summary: 'Revoked manual print-readiness approval.',
          createdAt: FieldValue.serverTimestamp(),
        });
      });
      const revoked = await ref.get();
      if (!revoked.exists) throw new CampaignEconomicsRequestError('Initialize the founding campaign first.', 404);
      return NextResponse.json(await responseState(revoked.data()!));
    }
    if (parsed.data.confirmation !== 'APPROVE PRINT READINESS') return NextResponse.json({ error: 'Exact confirmation text is required.' }, { status: 400 });
    const auditRef = db.collection('auditlog').doc();
    const approval = await db.runTransaction(async (transaction) => {
      const currentSnapshot = await transaction.get(ref);
      if (!currentSnapshot.exists) return { success: false as const, reason: 'missing' as const };
      const current = currentSnapshot.data()!;
      assertActiveSharedModel(current);
      if (!['proofing', 'scheduled_for_print'].includes(String(current.status))) {
        return { success: false as const, reason: 'status' as const };
      }
      const routePlanId = typeof current.routePlanId === 'string' ? current.routePlanId : null;
      const routePlanSnapshot = routePlanId
        ? await transaction.get(db.collection('routeplans').doc(routePlanId))
        : null;
      const [reservations, proofs, refunds, materials, payments] = await Promise.all([
        transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('proofs').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('refunds').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('materials').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
      ]);
      const operations = readinessState(
        { ...current, ownerPrintApproved: true },
        reservations.docs,
        proofs.docs,
        refunds.docs,
        materials.docs,
        payments.docs,
        routePlanSnapshot?.data(),
      );
      if (!operations.readiness.ready) {
        return { success: false as const, reason: 'readiness' as const, checks: operations.readiness.checks };
      }
      transaction.update(ref, { ownerPrintApproved: true, printReadyAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      transaction.create(auditRef, { actorUid: owner.uid, action: 'campaign.print_readiness.approve', entityId: FOUNDING_CAMPAIGN.id, summary: 'Approved current readiness gates only. No print order was placed.', createdAt: FieldValue.serverTimestamp() });
      return { success: true as const };
    });
    if (!approval.success) {
      if (approval.reason === 'missing') return NextResponse.json({ error: 'Initialize the founding campaign first.' }, { status: 404 });
      if (approval.reason === 'status') return NextResponse.json({ error: 'Print readiness can be approved only before printing, while proofing or scheduled for print.' }, { status: 409 });
      return NextResponse.json({ error: 'Print readiness is blocked.', checks: approval.checks }, { status: 409 });
    }
    const approved = await ref.get();
    if (!approved.exists) throw new CampaignEconomicsRequestError('Initialize the founding campaign first.', 404);
    return NextResponse.json(await responseState(approved.data()!));
  } catch (error) { return errorResponse(error); }
}
