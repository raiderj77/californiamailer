import { NextRequest, NextResponse } from 'next/server';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  normalizeTerritorySlug,
  RoutePlanValidationError,
  territoryAdminView,
} from '@/lib/routePlans';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const stateSchema = z.string().trim().transform((value) => value.toUpperCase()).pipe(z.string().regex(/^[A-Z]{2}$/));
const createTerritorySchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: z.string().trim().min(1).max(100).optional(),
  state: stateSchema,
  county: z.string().trim().min(2).max(100),
  candidateZipCodes: z.array(z.string().trim().regex(/^\d{5}$/)).max(50),
  candidateAreas: z.array(z.string().trim().min(1).max(100)).max(50),
  status: z.enum(['planning', 'paused']).optional().default('planning'),
}).strict();

class TerritoryConflictError extends Error {}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function errorResponse(error: unknown) {
  if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof TerritoryConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
  if (error instanceof RoutePlanValidationError) return NextResponse.json({ error: error.message }, { status: 400 });
  const unavailable = error instanceof Error && error.message.includes('not configured');
  return NextResponse.json(
    { error: unavailable ? 'Firebase Admin is not configured.' : 'Territory operation failed.' },
    { status: unavailable ? 503 : 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const snapshot = await getAdminFirestore().collection('mailterritories').get();
    const territories = snapshot.docs
      .map((document) => territoryAdminView(document.id, document.data()))
      .sort((left, right) => left.name.localeCompare(right.name));
    return NextResponse.json({ territories });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = createTerritorySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid territory data.' }, { status: 400 });

    const slug = normalizeTerritorySlug(parsed.data.slug || parsed.data.name);
    const now = Timestamp.now();
    const record = {
      id: slug,
      name: parsed.data.name,
      slug,
      state: parsed.data.state,
      county: parsed.data.county,
      candidateZipCodes: uniqueSorted(parsed.data.candidateZipCodes),
      candidateAreas: uniqueSorted(parsed.data.candidateAreas),
      status: parsed.data.status,
      currentRoutePlanId: null,
      routePlanSequence: 0,
      version: 1,
      ownerUid: owner.uid,
      createdAt: now,
      updatedAt: now,
    };
    const db = getAdminFirestore();
    const territoryRef = db.collection('mailterritories').doc(slug);
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(territoryRef);
      if (existing.exists) throw new TerritoryConflictError('A territory with this slug already exists.');
      transaction.create(territoryRef, record);
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: 'territory.create',
        entityId: slug,
        summary: `Created the ${parsed.data.name} mailing territory as ${parsed.data.status}; no carrier route, print, postage, payment, or outreach action occurred.`,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    return NextResponse.json({ success: true, territory: territoryAdminView(slug, record) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
