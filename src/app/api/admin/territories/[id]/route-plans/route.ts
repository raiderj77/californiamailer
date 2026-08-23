import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  approvedRouteSourceUrl,
  AUDIENCE_MODES,
  deriveRoutePlan,
  MAILING_METHODS,
  ROUTE_PLAN_MAX_ROWS,
  ROUTE_PLAN_SOURCES,
  ROUTE_TYPES,
  routePlanAdminView,
  routePlanContentHash,
  RoutePlanValidationError,
  territoryAdminView,
  type AudienceMode,
  type MailingMethod,
  type RoutePlanSource,
  type RouteType,
} from '@/lib/routePlans';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const countSchema = z.number().int().min(0).max(1_000_000);
const routeRowSchema = z.object({
  zipCode: z.string().trim().regex(/^\d{5}$/),
  carrierRouteCode: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9][A-Za-z0-9-]{1,11}$/),
  city: z.string().trim().min(1).max(80),
  routeType: z.enum(ROUTE_TYPES),
  residentialCount: countSchema,
  businessCount: countSchema,
  poBoxCount: countSchema,
}).strict();
const createRoutePlanSchema = z.object({
  campaignId: z.string().trim().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/).nullable().optional().default(null),
  mailingMethod: z.enum(MAILING_METHODS),
  audienceMode: z.enum(AUDIENCE_MODES),
  source: z.enum(ROUTE_PLAN_SOURCES),
  sourceUrl: z.string().trim().url().max(500),
  sourceReference: z.string().trim().min(3).max(300),
  sourceCheckedAt: z.string().date(),
  routes: z.array(routeRowSchema).min(1).max(ROUTE_PLAN_MAX_ROWS),
}).strict();

class TerritoryNotFoundError extends Error {}
class RoutePlanStateError extends Error {}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof TerritoryNotFoundError) return NextResponse.json({ error: error.message }, { status: 404 });
  if (error instanceof RoutePlanStateError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof RoutePlanValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json(
    { error: unavailable ? 'Firebase Admin is not configured.' : 'Route-plan operation failed.' },
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
    const db = getAdminFirestore();
    const [territorySnapshot, plansSnapshot] = await Promise.all([
      db.collection('mailterritories').doc(id).get(),
      db.collection('routeplans').where('territoryId', '==', id).get(),
    ]);
    if (!territorySnapshot.exists) return NextResponse.json({ error: 'Territory not found.' }, { status: 404 });
    const territory = territoryAdminView(territorySnapshot.id, territorySnapshot.data()!);
    const routePlans = plansSnapshot.docs
      .map((document) => routePlanAdminView(document.id, document.data()))
      .sort((left, right) => {
        if (left.id === territory.currentRoutePlanId) return -1;
        if (right.id === territory.currentRoutePlanId) return 1;
        return right.version - left.version;
      });
    return NextResponse.json({ territory, routePlans });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const owner = await requireOwner(request);
    const { id } = await params;
    const parsed = createRoutePlanSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid route-plan evidence.' }, { status: 400 });

    const sourceUrl = approvedRouteSourceUrl(parsed.data.source, parsed.data.sourceUrl);
    const derived = deriveRoutePlan(parsed.data.routes, parsed.data.audienceMode);
    const db = getAdminFirestore();
    const territoryRef = db.collection('mailterritories').doc(id);
    const routePlanRef = db.collection('routeplans').doc();
    const now = Timestamp.now();
    const record = await db.runTransaction(async (transaction) => {
      const territorySnapshot = await transaction.get(territoryRef);
      if (!territorySnapshot.exists) throw new TerritoryNotFoundError('Territory not found.');
      const territory = territorySnapshot.data()!;
      if (territory.status === 'retired') throw new RoutePlanStateError('Retired territories cannot accept new route plans.');
      if (!Number.isSafeInteger(territory.routePlanSequence) || Number(territory.routePlanSequence) < 0) {
        throw new RoutePlanStateError('Territory route-plan sequence is invalid and requires an explicit migration.');
      }
      const currentSequence = Number(territory.routePlanSequence);
      const version = currentSequence + 1;
      const hashInput = {
        territoryId: id,
        territorySlug: String(territory.slug || id),
        territoryName: String(territory.name || id),
        campaignId: parsed.data.campaignId,
        version,
        mailingMethod: parsed.data.mailingMethod as MailingMethod,
        audienceMode: parsed.data.audienceMode as AudienceMode,
        source: parsed.data.source as RoutePlanSource,
        sourceUrl,
        sourceReference: parsed.data.sourceReference,
        sourceCheckedAt: parsed.data.sourceCheckedAt,
        routes: derived.routes.map((route) => ({
          zipCode: route.zipCode,
          carrierRouteCode: route.carrierRouteCode,
          city: route.city,
          routeType: route.routeType as RouteType,
          residentialCount: route.residentialCount,
          businessCount: route.businessCount,
          poBoxCount: route.poBoxCount,
        })),
      };
      const nextRecord = {
        id: routePlanRef.id,
        ...hashInput,
        routes: derived.routes,
        totals: derived.totals,
        plannedDeliveryCount: derived.plannedDeliveryCount,
        status: 'draft' as const,
        contentHash: routePlanContentHash(hashInput),
        ownerUid: owner.uid,
        createdAt: now,
        updatedAt: now,
        verifiedAt: null,
        verifiedBy: null,
        attachedAt: null,
        attachedBy: null,
        retiredAt: null,
        retiredBy: null,
      };
      transaction.update(territoryRef, {
        routePlanSequence: version,
        version: Number.isSafeInteger(territory.version) ? Number(territory.version) + 1 : 2,
        updatedAt: now,
      });
      transaction.create(routePlanRef, nextRecord);
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'routeplan.create',
        entityId: routePlanRef.id,
        summary: `Created immutable draft route-plan version ${version} for ${String(territory.name || id)} from manually recorded evidence; no external lookup, order, payment, print, postage, or outreach action occurred.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return nextRecord;
    });
    return NextResponse.json({ success: true, routePlan: routePlanAdminView(routePlanRef.id, record) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
