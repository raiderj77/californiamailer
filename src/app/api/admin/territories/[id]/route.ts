import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  assertFreshRouteEvidence,
  assertStoredRoutePlanIntegrity,
  RoutePlanValidationError,
  territoryAdminView,
} from '@/lib/routePlans';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateTerritorySchema = z.object({
  action: z.literal('set_status'),
  status: z.enum(['planning', 'active', 'paused', 'retired']),
  confirmation: z.string().max(100),
}).strict();

const STATUS_CONFIRMATIONS = {
  planning: 'RETURN TERRITORY TO PLANNING',
  active: 'ACTIVATE TERRITORY',
  paused: 'PAUSE TERRITORY',
  retired: 'RETIRE TERRITORY',
} as const;

class TerritoryNotFoundError extends Error {}
class TerritoryStateError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof TerritoryNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof TerritoryStateError || error instanceof RoutePlanValidationError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json(
    { error: unavailable ? 'Firebase Admin is not configured.' : 'Territory operation failed.' },
    { status: unavailable ? 503 : 500 },
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireOwner(request);
    const { id } = await params;
    const snapshot = await getAdminFirestore().collection('mailterritories').doc(id).get();
    if (!snapshot.exists) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 });
    return NextResponse.json({ territory: territoryAdminView(snapshot.id, snapshot.data()!) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requireOwner(request);
    const { id } = await params;
    const parsed = updateTerritorySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid territory status action.' }, { status: 400 });
    if (parsed.data.confirmation !== STATUS_CONFIRMATIONS[parsed.data.status]) {
      return NextResponse.json({ error: 'Exact territory status confirmation is required.' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const territoryRef = db.collection('mailterritories').doc(id);
    const result = await db.runTransaction(async (transaction) => {
      const territorySnapshot = await transaction.get(territoryRef);
      if (!territorySnapshot.exists) throw new TerritoryNotFoundError('Territory not found.');
      const territory = territorySnapshot.data()!;
      if (territory.status === 'retired' && parsed.data.status !== 'retired') {
        throw new TerritoryStateError('Retired territories cannot be reactivated. Create a new versioned territory instead.');
      }

      let currentPlan: Record<string, unknown> | null = null;
      if (typeof territory.currentRoutePlanId === 'string') {
        const planSnapshot = await transaction.get(db.collection('routeplans').doc(territory.currentRoutePlanId));
        if (planSnapshot.exists) currentPlan = planSnapshot.data()!;
      }
      if (parsed.data.status === 'active') {
        if (!currentPlan || !['verified', 'attached'].includes(String(currentPlan.status))) {
          throw new TerritoryStateError('A current verified route plan is required before activating a territory.');
        }
        if (currentPlan.territoryId !== id) throw new TerritoryStateError('The current route plan does not belong to this territory.');
        assertStoredRoutePlanIntegrity(currentPlan);
        assertFreshRouteEvidence(String(currentPlan.sourceCheckedAt || ''));
      }
      if (parsed.data.status === 'retired' && currentPlan?.status === 'attached') {
        throw new TerritoryStateError('An attached campaign route plan must be replaced before retiring its territory.');
      }

      const version = Number.isSafeInteger(territory.version) ? Number(territory.version) + 1 : 2;
      transaction.update(territoryRef, {
        status: parsed.data.status,
        version,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: `territory.status.${parsed.data.status}`,
        entityId: id,
        summary: `Set the mailing territory to ${parsed.data.status}; no carrier route, print, postage, payment, or outreach action occurred.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return territoryAdminView(id, { ...territory, status: parsed.data.status, version });
    });
    return NextResponse.json({ success: true, territory: result });
  } catch (error) {
    return errorResponse(error);
  }
}
