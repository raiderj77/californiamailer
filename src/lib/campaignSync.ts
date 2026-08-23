import { FieldValue, Timestamp, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { clearedNetFundingCents } from '@/lib/businessRules';
import { toPublicCampaign } from '@/lib/campaignRecords';
import type { CampaignPayment } from '@/lib/campaignTypes';

export const RESERVATION_OPEN_STATUSES = new Set([
  'accepting_reservations',
  'partially_funded',
  'fully_funded',
]);

export function synchronizedCampaignStatus(
  currentStatus: unknown,
  clearedFundingCents: number,
  fundingGoalCents: number,
): string {
  const status = String(currentStatus);
  if (!RESERVATION_OPEN_STATUSES.has(status)) return status;
  if (clearedFundingCents >= fundingGoalCents) return 'fully_funded';
  if (clearedFundingCents > 0) return 'partially_funded';
  return 'accepting_reservations';
}

export function campaignInventoryIsOpen(
  status: unknown,
  paymentActivation: unknown,
  paymentsEnabled: unknown,
): boolean {
  return RESERVATION_OPEN_STATUSES.has(String(status))
    && paymentActivation === true
    && paymentsEnabled === true;
}

export function isLiveInventoryState(data: DocumentData | undefined, nowMs = Date.now()): boolean {
  if (!data) return false;
  if (['paid', 'sold', 'disputed'].includes(String(data.status))) return true;
  return ['hold', 'awaiting_payment'].includes(String(data.status))
    && data.expiresAt instanceof Timestamp
    && data.expiresAt.toMillis() > nowMs;
}

export function recordMatchesCampaignModel(
  data: DocumentData | undefined,
  campaign: DocumentData,
): boolean {
  if (!data) return false;
  return (data.planId ?? null) === (campaign.planId ?? null)
    && (data.offerModelVersion ?? null) === (campaign.offerModelVersion ?? null);
}

export async function syncCampaignState(db: Firestore, campaignId: string) {
  const campaignRef = db.collection('campaigns').doc(campaignId);
  await db.runTransaction(async (transaction) => {
    const campaignSnapshot = await transaction.get(campaignRef);
    if (!campaignSnapshot.exists) return;
    const campaign = campaignSnapshot.data()!;
    const [paymentsSnapshot, reservationsSnapshot, slotsSnapshot, claimsSnapshot] = await Promise.all([
      transaction.get(db.collection('payments').where('campaignId', '==', campaignId)),
      transaction.get(db.collection('reservations').where('campaignId', '==', campaignId)),
      transaction.get(db.collection('placementslots').where('campaignId', '==', campaignId)),
      transaction.get(db.collection('categoryclaims').where('campaignId', '==', campaignId)),
    ]);

    const modelPayments = paymentsSnapshot.docs.filter((document) =>
      recordMatchesCampaignModel(document.data(), campaign),
    );
    const modelReservations = reservationsSnapshot.docs.filter((document) =>
      recordMatchesCampaignModel(document.data(), campaign),
    );
    const modelSlots = slotsSnapshot.docs.filter((document) =>
      recordMatchesCampaignModel(document.data(), campaign),
    );
    const modelClaims = claimsSnapshot.docs.filter((document) =>
      recordMatchesCampaignModel(document.data(), campaign),
    );
    const payments = modelPayments.map((document) => ({
      id: document.id,
      ...document.data(),
    })) as CampaignPayment[];
    const clearedFundingCents = clearedNetFundingCents(payments);
    const status = synchronizedCampaignStatus(
      campaign.status,
      clearedFundingCents,
      Number(campaign.fundingGoalCents || 0),
    );
    const inventoryOpen = campaignInventoryIsOpen(
      status,
      campaign.paymentActivation,
      campaign.paymentsEnabled,
    );
    const nowMs = Date.now();
    const activeReservations = inventoryOpen ? modelReservations
      .map((document) => document.data())
      .filter((reservation) =>
        ['hold', 'awaiting_payment'].includes(String(reservation.status))
        && reservation.holdExpiresAt instanceof Timestamp
        && reservation.holdExpiresAt.toMillis() > nowMs,
      ) : [];
    const reservedFundingCents = activeReservations.reduce(
      (total, reservation) => total + Number(reservation.quotedPriceCents || 0),
      0,
    );

    const paidBusinessKeys = new Set(
      modelReservations
        .filter((document) => document.data().status === 'paid')
        .map((document) => String(document.data().emailNormalized || document.id)),
    );
    const currentAdvertiserCount = paidBusinessKeys.size;
    const currentPaidPlacementCount = modelReservations.filter(
      (document) => document.data().status === 'paid',
    ).length;

    const placements = structuredClone(campaign.placements);
    for (const size of Object.keys(placements)) {
      const related = modelSlots.filter((document) => document.data().size === size);
      const sold = related.filter((document) => ['sold', 'disputed'].includes(String(document.data().status))).length;
      const held = inventoryOpen ? related.filter((document) =>
        ['hold', 'awaiting_payment'].includes(String(document.data().status))
        && isLiveInventoryState(document.data(), nowMs),
      ).length : 0;
      const total = related.length || Number(placements[size].total);
      placements[size] = {
        ...placements[size],
        total,
        sold,
        held,
        available: inventoryOpen ? Math.max(0, total - sold - held) : 0,
      };
    }

    const claims = modelClaims.map((document) => document.data());
    const categories = (campaign.categories as DocumentData[]).map((category) => {
      const claim = claims.find((candidate) =>
        candidate.categorySlug === category.slug && isLiveInventoryState(candidate, nowMs),
      );
      const status = claim
        ? ['paid', 'sold', 'disputed'].includes(String(claim.status)) ? 'sold' : 'held'
        : inventoryOpen
          && category.enabled !== false
          ? 'available'
          : 'paused';
      return { ...category, status };
    });

    const updated = {
      ...campaign,
      id: campaignSnapshot.id,
      status,
      paymentActivation: inventoryOpen,
      paymentsEnabled: inventoryOpen,
      placements,
      categories,
      clearedFundingCents,
      reservedFundingCents,
      currentAdvertiserCount,
      currentPaidPlacementCount,
    };
    transaction.update(campaignRef, {
      status,
      paymentActivation: inventoryOpen,
      paymentsEnabled: inventoryOpen,
      placements,
      categories,
      clearedFundingCents,
      reservedFundingCents,
      currentAdvertiserCount,
      currentPaidPlacementCount,
      updatedAt: FieldValue.serverTimestamp(),
    });
    if (campaign.published === true) {
      transaction.set(db.collection('publiccampaigns').doc(campaignId), toPublicCampaign(updated, true));
    }
  });
}
