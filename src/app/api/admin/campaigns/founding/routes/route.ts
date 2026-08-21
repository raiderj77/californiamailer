import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp, type DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  FOUNDING_CAMPAIGN,
  campaignMatchesActiveSharedModel,
  getApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import { toPublicCampaign } from '@/lib/campaignRecords';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  assertFreshRouteEvidence,
  assertStoredRoutePlanIntegrity,
  ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS,
  ROUTE_PLAN_FRESHNESS_DAYS,
  routePlanHashInputFromRecord,
  routePlanSourceLabel,
  RoutePlanValidationError,
  selectedAreaLabels,
} from '@/lib/routePlans';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const attachRoutePlanSchema = z.object({
  routePlanId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/),
  confirmation: z.literal('APPLY ROUTES TO FOUNDING CAMPAIGN'),
}).strict();

class AttachmentNotFoundError extends Error {}
class AttachmentStateError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof AttachmentNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof AttachmentStateError || error instanceof RoutePlanValidationError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json(
    { error: unavailable ? 'Firebase Admin is not configured.' : 'Route-plan attachment failed.' },
    { status: unavailable ? 503 : 500 },
  );
}

function campaignHasContractualState(
  campaign: DocumentData,
  reservationCount: number,
  paymentCount: number,
): boolean {
  return reservationCount > 0
    || paymentCount > 0
    || campaign.contractApproved === true
    || getApprovedCampaignContractVersions(campaign) !== null
    || campaign.paymentActivation === true
    || campaign.paymentsEnabled === true
    || Number(campaign.clearedFundingCents || 0) > 0
    || Number(campaign.reservedFundingCents || 0) > 0
    || Number(campaign.currentAdvertiserCount || 0) > 0
    || Number(campaign.currentPaidPlacementCount || 0) > 0;
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = attachRoutePlanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Exact founding-campaign route confirmation is required.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const campaignRef = db.collection('campaigns').doc(FOUNDING_CAMPAIGN.id);
    const planRef = db.collection('routeplans').doc(parsed.data.routePlanId);
    const publicRef = db.collection('publiccampaigns').doc(FOUNDING_CAMPAIGN.id);
    const now = Timestamp.now();

    const attachment = await db.runTransaction(async (transaction) => {
      const [campaignSnapshot, planSnapshot] = await Promise.all([
        transaction.get(campaignRef),
        transaction.get(planRef),
      ]);
      if (!campaignSnapshot.exists) throw new AttachmentNotFoundError('Initialize the founding campaign first.');
      if (!planSnapshot.exists) throw new AttachmentNotFoundError('Verified route plan not found.');
      const campaign = campaignSnapshot.data()!;
      const plan = planSnapshot.data()!;
      const planInput = routePlanHashInputFromRecord(plan);
      const territoryRef = db.collection('mailterritories').doc(planInput.territoryId);
      const territorySnapshot = await transaction.get(territoryRef);
      if (!territorySnapshot.exists) throw new AttachmentNotFoundError('Route-plan territory not found.');
      const territory = territorySnapshot.data()!;

      let previousPlanSnapshot = null;
      if (
        typeof territory.currentRoutePlanId === 'string'
        && territory.currentRoutePlanId !== planRef.id
      ) {
        previousPlanSnapshot = await transaction.get(db.collection('routeplans').doc(territory.currentRoutePlanId));
      }
      const [reservations, payments] = await Promise.all([
        transaction.get(db.collection('reservations').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
        transaction.get(db.collection('payments').where('campaignId', '==', FOUNDING_CAMPAIGN.id)),
      ]);

      if (!campaignMatchesActiveSharedModel(campaign)) {
        throw new AttachmentStateError('The founding campaign does not match the active shared-mailer model.');
      }
      if (!['draft', 'pre_launch'].includes(String(campaign.status))) {
        throw new AttachmentStateError('Routes can be attached only while the campaign is in a pre-payment planning state.');
      }
      if (campaignHasContractualState(campaign, reservations.size, payments.size)) {
        throw new AttachmentStateError('Routes cannot be replaced after a contract, reservation, hold, or payment state exists.');
      }
      if (plan.status !== 'verified') throw new AttachmentStateError('Only a verified, unattached route plan can be applied.');
      if (planInput.campaignId && planInput.campaignId !== FOUNDING_CAMPAIGN.id) {
        throw new AttachmentStateError('This route plan is bound to a different campaign.');
      }
      if (
        territory.status === 'retired'
        || territory.slug !== planInput.territorySlug
        || territory.name !== planInput.territoryName
      ) {
        throw new AttachmentStateError('The route plan no longer matches an active version of its territory.');
      }
      if (String(campaign.territory) !== planInput.territoryName) {
        throw new AttachmentStateError('The route-plan territory does not match the founding campaign territory.');
      }
      if (
        typeof campaign.routePlanId === 'string'
        && campaign.routePlanId !== planRef.id
        && territory.currentRoutePlanId !== campaign.routePlanId
      ) {
        throw new AttachmentStateError('Campaign and territory route-plan pointers disagree and must be repaired before replacement.');
      }
      const derived = assertStoredRoutePlanIntegrity(plan);
      assertFreshRouteEvidence(planInput.sourceCheckedAt);
      if (planInput.audienceMode !== 'residential_only') {
        throw new AttachmentStateError('The founding household campaign requires a residential-only route plan.');
      }
      const activeMailPieceQuantity = Number(campaign.targetHouseholds);
      const minimumCompatibleDeliveryCount = Math.ceil(
        activeMailPieceQuantity * ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS / 10_000,
      );
      if (
        !Number.isSafeInteger(activeMailPieceQuantity)
        || activeMailPieceQuantity < 1
        || derived.plannedDeliveryCount < minimumCompatibleDeliveryCount
        || derived.plannedDeliveryCount > activeMailPieceQuantity
      ) {
        throw new AttachmentStateError(
          `Planned route deliveries must cover ${ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS / 100}% to 100% of the active campaign quantity under CaliforniaMailer's internal planning compatibility policy; this is not a USPS rule.`,
        );
      }
      if (previousPlanSnapshot) {
        const previous = previousPlanSnapshot.data();
        if (
          !previous
          || previous.territoryId !== planInput.territoryId
          || !['verified', 'attached'].includes(String(previous.status))
        ) throw new AttachmentStateError('The territory current-route pointer is invalid and must be repaired before replacement.');
        if (previous.status === 'attached' && previous.attachedCampaignId !== FOUNDING_CAMPAIGN.id) {
          throw new AttachmentStateError('The territory current route plan is attached to a different campaign.');
        }
      }

      const selectedAreas = selectedAreaLabels(derived.routes, String(territory.state));
      const householdCountBasis = `Verified route-plan evidence checked ${planInput.sourceCheckedAt} using ${routePlanSourceLabel(planInput.source)} under CaliforniaMailer's ${ROUTE_PLAN_FRESHNESS_DAYS}-day freshness policy.`;
      const campaignUpdate = {
        verifiedHouseholds: derived.plannedDeliveryCount,
        householdCountBasis,
        selectedAreas,
        routesConfirmed: true,
        routePlanId: planRef.id,
        routePlanVersion: planInput.version,
        routePlanSource: planInput.source,
        routePlanSourceCheckedAt: planInput.sourceCheckedAt,
        routePlanSourceRecheckedAt: null,
        routePlanSourceRecheckedTimestamp: null,
        routePlanSourceRecheckEvidenceReference: null,
        routePlanSourceRecheckedBy: null,
        routePlanAttachedBy: owner.uid,
        routePlanAttachedAt: now,
        economicsVerified: false,
        economicsRevokedAt: now,
        economicsRevokedReason: 'route_plan_attached',
        paymentActivation: false,
        paymentsEnabled: false,
        artworkPreflightApproved: false,
        ownerPrintApproved: false,
        printReadyAt: null,
        printReadinessRevokedAt: now,
        printReadinessRevokedReason: 'route_plan_attached',
        updatedAt: now,
      };

      transaction.update(campaignRef, campaignUpdate);
      transaction.update(planRef, {
        status: 'attached',
        attachedCampaignId: FOUNDING_CAMPAIGN.id,
        attachedBy: owner.uid,
        attachedAt: now,
        updatedAt: now,
      });
      transaction.update(territoryRef, {
        status: 'active',
        currentRoutePlanId: planRef.id,
        version: Number.isSafeInteger(territory.version) ? Number(territory.version) + 1 : 2,
        updatedAt: now,
      });
      if (previousPlanSnapshot) {
        transaction.update(previousPlanSnapshot.ref, {
          status: 'retired',
          replacedByRoutePlanId: planRef.id,
          retiredBy: owner.uid,
          retiredAt: now,
          updatedAt: now,
        });
      }
      if (campaign.published === true) {
        transaction.set(
          publicRef,
          toPublicCampaign({ ...campaign, ...campaignUpdate, id: campaignSnapshot.id }, true),
        );
      }
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'campaign.routes.attach',
        entityId: FOUNDING_CAMPAIGN.id,
        routePlanId: planRef.id,
        routePlanVersion: planInput.version,
        summary: `Attached verified route-plan version ${planInput.version}, copied ${derived.plannedDeliveryCount} residential delivery points, and revoked economics, payment, artwork, and print gates; no external lookup, order, print, postage, payment, or outreach action occurred.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return {
        routePlanId: planRef.id,
        routePlanVersion: planInput.version,
        verifiedHouseholds: derived.plannedDeliveryCount,
        selectedAreas,
      };
    });

    return NextResponse.json({ success: true, ...attachment, routesConfirmed: true });
  } catch (error) {
    return errorResponse(error);
  }
}
