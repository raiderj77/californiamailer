import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData, QuerySnapshot } from 'firebase-admin/firestore';
import {
  ADVERTISER_PORTAL_INVITE_COLLECTION,
  ADVERTISER_PORTAL_SESSION_COLLECTION,
} from '@/lib/advertiserPortal';
import { campaignOperationalEvidenceBlockReason } from '@/lib/campaignOperationalGates';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  buildProductionBoard,
  type ProductionBoardRecord,
} from '@/lib/productionBoard';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

export const runtime = 'nodejs';

const LIMITS = {
  campaigns: 100,
  routeplans: 250,
  placementslots: 500,
  reservations: 500,
  payments: 500,
  refunds: 500,
  creativebriefs: 500,
  materials: 500,
  proofs: 500,
  trackinglinks: 500,
  trackingcouponclaims: 500,
  coupons: 500,
  advertiserportalinvites: 500,
  advertiserportalsessions: 500,
} as const;

const PRIVATE_HEADERS = { 'Cache-Control': 'private, no-store' } as const;

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const now = new Date();
    const [
      campaigns,
      routePlans,
      slots,
      reservations,
      payments,
      refunds,
      creativeBriefs,
      materials,
      proofs,
      trackingLinks,
      trackingCouponClaims,
      coupons,
      portalInvites,
      portalSessions,
    ] = await Promise.all([
      db.collection('campaigns').limit(LIMITS.campaigns).get(),
      db.collection('routeplans').limit(LIMITS.routeplans).get(),
      db.collection('placementslots').limit(LIMITS.placementslots).get(),
      db.collection('reservations').limit(LIMITS.reservations).get(),
      db.collection('payments').limit(LIMITS.payments).get(),
      db.collection('refunds').limit(LIMITS.refunds).get(),
      db.collection('creativebriefs').limit(LIMITS.creativebriefs).get(),
      db.collection('materials').limit(LIMITS.materials).get(),
      db.collection('proofs').limit(LIMITS.proofs).get(),
      db.collection('trackinglinks').limit(LIMITS.trackinglinks).get(),
      db.collection('trackingcouponclaims').limit(LIMITS.trackingcouponclaims).get(),
      db.collection('coupons').limit(LIMITS.coupons).get(),
      db.collection(ADVERTISER_PORTAL_INVITE_COLLECTION)
        .limit(LIMITS.advertiserportalinvites).get(),
      db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION)
        .limit(LIMITS.advertiserportalsessions).get(),
    ]);

    const snapshots = {
      campaigns,
      routeplans: routePlans,
      placementslots: slots,
      reservations,
      payments,
      refunds,
      creativebriefs: creativeBriefs,
      materials,
      proofs,
      trackinglinks: trackingLinks,
      trackingcouponclaims: trackingCouponClaims,
      coupons,
      advertiserportalinvites: portalInvites,
      advertiserportalsessions: portalSessions,
    };
    const hitCollections = (Object.keys(snapshots) as Array<keyof typeof snapshots>)
      .filter((name) => snapshots[name].size >= LIMITS[name]);

    const routePlanById = new Map(routePlans.docs.map((document) => [document.id, document.data()]));
    const operationalEvidenceByCampaign = Object.fromEntries(campaigns.docs.map((document) => {
      const campaign = document.data();
      const routePlanId = typeof campaign.routePlanId === 'string' && campaign.routePlanId
        ? campaign.routePlanId
        : null;
      const reason = campaignOperationalEvidenceBlockReason(
        document.id,
        campaign,
        routePlanId,
        routePlanId ? routePlanById.get(routePlanId) : undefined,
        now.getTime(),
      );
      return [document.id, reason];
    }));

    const board = buildProductionBoard({
      campaigns: toRecords(campaigns),
      slots: toRecords(slots),
      reservations: toRecords(reservations),
      payments: toRecords(payments),
      refunds: toRecords(refunds),
      creativeBriefs: toRecords(creativeBriefs),
      materials: toRecords(materials),
      proofs: toRecords(proofs),
      trackingLinks: toRecords(trackingLinks),
      trackingCouponClaims: toRecords(trackingCouponClaims),
      coupons: toRecords(coupons),
      portalInvites: toRecords(portalInvites),
      portalSessions: toRecords(portalSessions),
      operationalEvidenceByCampaign,
      boundedReadPossiblyTruncated: hitCollections.length > 0,
      refundReadPossiblyTruncated: refunds.size >= LIMITS.refunds,
      now,
    });

    return NextResponse.json({
      generatedAt: now.toISOString(),
      ...board,
      limits: {
        perCollection: LIMITS,
        hitCollections,
        possiblyTruncated: hitCollections.length > 0,
      },
      policy: {
        readOnly: true,
        contactPiiIncluded: false,
        rawTokensIncluded: false,
        readiness: 'fail_closed_on_every_blocker_unknown_or_error',
        payment: 'reservation_id_canonical_provider_verified_only',
        versions: 'reservation_pointer_and_sequence_must_match_exact_documents',
        sideEffects: 'none',
      },
    }, { headers: PRIVATE_HEADERS });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: PRIVATE_HEADERS },
      );
    }
    const unavailable = error instanceof Error && error.message.includes('not configured');
    return NextResponse.json(
      { error: unavailable
        ? 'Owner production data is not configured on the server.'
        : 'The production board could not be read.' },
      { status: unavailable ? 503 : 500, headers: PRIVATE_HEADERS },
    );
  }
}

function toRecords(snapshot: QuerySnapshot<DocumentData>): ProductionBoardRecord[] {
  return snapshot.docs.map((document) => ({ id: document.id, data: document.data() }));
}
