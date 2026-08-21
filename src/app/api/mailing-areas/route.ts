import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  assertStoredRoutePlanIntegrity,
  effectiveRouteEvidenceCheckedAt,
  ROUTE_PLAN_FRESHNESS_DAYS,
  routePlanHashInputFromRecord,
  routePlanSourceLabel,
  storedRouteEvidenceFreshness,
} from '@/lib/routePlans';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PUBLIC_TERRITORY_LIMIT = 100;

function sanitizedZipCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(String)
    .map((zipCode) => zipCode.trim())
    .filter((zipCode) => /^\d{5}$/.test(zipCode)))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 50);
}

function sanitizedAreas(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map(String)
    .map((area) => area.trim().replace(/\s+/g, ' '))
    .filter((area) => area.length > 0 && area.length <= 100))]
    .sort((left, right) => left.localeCompare(right))
    .slice(0, 50);
}

function safeTerritoryStatus(status: unknown, routePlanAvailable: boolean): 'planning' | 'available' | 'paused' {
  if (status === 'paused') return 'paused';
  return status === 'active' && routePlanAvailable ? 'available' : 'planning';
}

export async function GET() {
  try {
    const db = getAdminFirestore();
    const territoriesSnapshot = await db.collection('mailterritories').limit(PUBLIC_TERRITORY_LIMIT).get();
    const currentPlanIds = [...new Set(territoriesSnapshot.docs
      .map((document) => document.data().currentRoutePlanId)
      .filter((value): value is string => typeof value === 'string' && value.length > 0))];
    const planSnapshots = currentPlanIds.length
      ? await db.getAll(...currentPlanIds.map((planId) => db.collection('routeplans').doc(planId)))
      : [];
    const plans = new Map(planSnapshots
      .filter((document) => document.exists)
      .map((document) => [document.id, document.data()!]));
    const territories = territoriesSnapshot.docs
      .filter((document) => document.data().status !== 'retired')
      .map((document) => {
        const territory = document.data();
        const name = typeof territory.name === 'string' ? territory.name.trim() : '';
        const slug = typeof territory.slug === 'string' ? territory.slug.trim() : '';
        const state = typeof territory.state === 'string' ? territory.state.trim().toUpperCase() : '';
        const county = typeof territory.county === 'string' ? territory.county.trim() : '';
        if (
          !name
          || name.length > 120
          || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
          || !/^[A-Z]{2}$/.test(state)
          || !county
          || county.length > 100
        ) return null;

        let routePlan = null;
        if (territory.status === 'active' && typeof territory.currentRoutePlanId === 'string') {
          const currentPlan = plans.get(territory.currentRoutePlanId);
          if (
            currentPlan
            && currentPlan.territoryId === document.id
            && ['verified', 'attached'].includes(String(currentPlan.status))
            && storedRouteEvidenceFreshness(currentPlan) === 'fresh'
          ) {
            try {
              const input = routePlanHashInputFromRecord(currentPlan);
              const derived = assertStoredRoutePlanIntegrity(currentPlan);
              routePlan = {
                sourceLabel: routePlanSourceLabel(input.source),
                sourceCheckedAt: effectiveRouteEvidenceCheckedAt(currentPlan),
                routeCount: derived.routes.length,
                zipCodes: [...new Set(derived.routes.map((route) => route.zipCode))]
                  .sort((left, right) => left.localeCompare(right)),
                residentialCount: derived.totals.residentialCount,
                businessCount: derived.totals.businessCount,
                poBoxCount: derived.totals.poBoxCount,
                totalCount: derived.totals.totalCount,
                plannedDeliveryCount: derived.plannedDeliveryCount,
                audienceMode: input.audienceMode,
                mailingMethod: input.mailingMethod,
              };
            } catch {
              routePlan = null;
            }
          }
        }

        return {
          slug,
          name,
          state,
          county,
          candidateZipCodes: sanitizedZipCodes(territory.candidateZipCodes),
          candidateAreas: sanitizedAreas(territory.candidateAreas),
          status: safeTerritoryStatus(territory.status, routePlan !== null),
          routePlan,
        };
      })
      .filter((territory): territory is NonNullable<typeof territory> => territory !== null)
      .sort((left, right) => left.name.localeCompare(right.name));

    return NextResponse.json(
      { territories, freshnessPolicyDays: ROUTE_PLAN_FRESHNESS_DAYS },
      { headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=60' } },
    );
  } catch {
    return NextResponse.json(
      { error: 'Mailing areas are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
