import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { toPublicCampaign } from '@/lib/campaignRecords';
import { campaignRouteEvidenceBlockReason } from '@/lib/campaignOperationalGates';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  assertFreshRouteEvidence,
  assertStoredRoutePlanIntegrity,
  californiaDateKey,
  routePlanAdminView,
  RoutePlanValidationError,
} from '@/lib/routePlans';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const planActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('verify'), confirmation: z.literal('VERIFY ROUTE PLAN') }).strict(),
  z.object({
    action: z.literal('recheck'),
    confirmation: z.literal('RECHECKED SOURCE - EXACT PLAN UNCHANGED'),
    evidenceReference: z.string().trim().min(3).max(500),
  }).strict(),
  z.object({ action: z.literal('retire'), confirmation: z.literal('RETIRE ROUTE PLAN') }).strict(),
]);

class RoutePlanNotFoundError extends Error {}
class RoutePlanStateError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof RoutePlanNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof RoutePlanStateError || error instanceof RoutePlanValidationError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json(
    { error: unavailable ? 'Firebase Admin is not configured.' : 'Route-plan operation failed.' },
    { status: unavailable ? 503 : 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    await requireOwner(request);
    const { id, planId } = await params;
    const snapshot = await getAdminFirestore().collection('routeplans').doc(planId).get();
    if (!snapshot.exists || snapshot.data()?.territoryId !== id) {
      return NextResponse.json({ error: 'Route plan not found.' }, { status: 404 });
    }
    return NextResponse.json({ routePlan: routePlanAdminView(snapshot.id, snapshot.data()!) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; planId: string }> },
) {
  try {
    const owner = await requireOwner(request);
    const { id, planId } = await params;
    const parsed = planActionSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Exact route-plan action confirmation is required.' }, { status: 400 });

    const db = getAdminFirestore();
    const territoryRef = db.collection('mailterritories').doc(id);
    const planRef = db.collection('routeplans').doc(planId);
    const now = Timestamp.now();
    const result = await db.runTransaction(async (transaction) => {
      const [territorySnapshot, planSnapshot] = await Promise.all([
        transaction.get(territoryRef),
        transaction.get(planRef),
      ]);
      if (!territorySnapshot.exists) throw new RoutePlanNotFoundError('Territory not found.');
      if (!planSnapshot.exists || planSnapshot.data()?.territoryId !== id) {
        throw new RoutePlanNotFoundError('Route plan not found.');
      }
      const territory = territorySnapshot.data()!;
      const plan = planSnapshot.data()!;

      if (parsed.data.action === 'verify') {
        if (plan.status !== 'draft') throw new RoutePlanStateError('Only an immutable draft route plan can be verified.');
        assertStoredRoutePlanIntegrity(plan);
        assertFreshRouteEvidence(String(plan.sourceCheckedAt || ''));
        const update = {
          status: 'verified' as const,
          verifiedBy: owner.uid,
          verifiedAt: now,
          updatedAt: now,
        };
        transaction.update(planRef, update);
        if (!territory.currentRoutePlanId) {
          transaction.update(territoryRef, {
            currentRoutePlanId: planId,
            version: Number.isSafeInteger(territory.version) ? Number(territory.version) + 1 : 2,
            updatedAt: now,
          });
        }
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'routeplan.verify',
          entityId: planId,
          summary: `Verified immutable route-plan version ${Number(plan.version)} under CaliforniaMailer's 7-day evidence freshness policy; this is not a USPS validity period and no external lookup, order, print, postage, payment, or outreach action occurred.`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return routePlanAdminView(planId, { ...plan, ...update });
      }

      if (parsed.data.action === 'recheck') {
        if (plan.status !== 'attached' || territory.currentRoutePlanId !== planId) {
          throw new RoutePlanStateError('Only the exact attached current route plan can be rechecked.');
        }
        assertStoredRoutePlanIntegrity(plan);
        const attachedCampaignId = typeof plan.attachedCampaignId === 'string'
          ? plan.attachedCampaignId
          : '';
        if (!attachedCampaignId) {
          throw new RoutePlanStateError('The attached campaign pointer is missing.');
        }
        const campaignRef = db.collection('campaigns').doc(attachedCampaignId);
        const campaignSnapshot = await transaction.get(campaignRef);
        const campaign = campaignSnapshot.data();
        if (!campaignSnapshot.exists || !campaign) {
          throw new RoutePlanStateError('The attached campaign record is missing.');
        }
        if (![
          'pre_launch',
          'accepting_reservations',
          'partially_funded',
          'fully_funded',
          'proofing',
          'scheduled_for_print',
        ].includes(String(campaign.status))) {
          throw new RoutePlanStateError('Route evidence can be rechecked only before printing or a terminal/refund state.');
        }

        const sourceRecheckedAt = californiaDateKey(now.toDate());
        const routeUpdate = {
          sourceRecheckedAt,
          sourceRecheckedTimestamp: now,
          sourceRecheckEvidenceReference: parsed.data.evidenceReference,
          sourceRecheckedBy: owner.uid,
          updatedAt: now,
        };
        const campaignUpdate = {
          routePlanSourceRecheckedAt: sourceRecheckedAt,
          routePlanSourceRecheckedTimestamp: now,
          routePlanSourceRecheckEvidenceReference: parsed.data.evidenceReference,
          routePlanSourceRecheckedBy: owner.uid,
          updatedAt: now,
        };
        const blocker = campaignRouteEvidenceBlockReason(
          attachedCampaignId,
          { ...campaign, ...campaignUpdate },
          planId,
          { ...plan, ...routeUpdate },
          now.toMillis(),
        );
        if (blocker) {
          throw new RoutePlanStateError(`The attached immutable route plan failed recheck validation (${blocker}).`);
        }

        transaction.update(planRef, routeUpdate);
        transaction.update(campaignRef, campaignUpdate);
        if (campaign.published === true) {
          transaction.set(
            db.collection('publiccampaigns').doc(attachedCampaignId),
            toPublicCampaign({ ...campaign, ...campaignUpdate, id: campaignSnapshot.id }, true),
          );
        }
        transaction.create(db.collection('auditlog').doc(), {
          actorUid: owner.uid,
          action: 'routeplan.recheck_unchanged',
          entityId: planId,
          evidenceReference: parsed.data.evidenceReference,
          summary: `Owner attested that the external source was rechecked and immutable route-plan version ${Number(plan.version)} and its server-derived totals remain exact and unchanged. No route content/hash, order, print, postage, payment, or outreach action changed.`,
          createdAt: FieldValue.serverTimestamp(),
        });
        return routePlanAdminView(planId, { ...plan, ...routeUpdate });
      }

      if (plan.status === 'attached') {
        throw new RoutePlanStateError('An attached route plan cannot be retired until a safe pre-payment replacement is attached.');
      }
      if (plan.status === 'retired') return routePlanAdminView(planId, plan);
      const update = {
        status: 'retired' as const,
        retiredBy: owner.uid,
        retiredAt: now,
        updatedAt: now,
      };
      transaction.update(planRef, update);
      if (territory.currentRoutePlanId === planId) {
        transaction.update(territoryRef, {
          currentRoutePlanId: null,
          status: territory.status === 'active' ? 'paused' : territory.status,
          version: Number.isSafeInteger(territory.version) ? Number(territory.version) + 1 : 2,
          updatedAt: now,
        });
      }
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'routeplan.retire',
        entityId: planId,
        summary: `Retired immutable route-plan version ${Number(plan.version)}; no external lookup, order, print, postage, payment, or outreach action occurred.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return routePlanAdminView(planId, { ...plan, ...update });
    });
    return NextResponse.json({ success: true, routePlan: result });
  } catch (error) {
    return errorResponse(error);
  }
}
