import type { DocumentData } from 'firebase-admin/firestore';

export const PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT = 100;

export interface CampaignPlacementEvidenceDocument {
  id: string;
  data: () => DocumentData;
}

export interface CampaignPaidPlacementEvidence {
  passed: boolean;
  paidReservationCount: number;
  exactSoldSlotCount: number;
  issueCodes: string[];
}

function exactNonemptyString(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim();
}

export function campaignPaidPlacementEvidence(
  campaignId: string,
  planId: string,
  offerModelVersion: string,
  reservationDocuments: CampaignPlacementEvidenceDocument[],
  placementSlotDocuments: CampaignPlacementEvidenceDocument[],
  placementSlotReadPossiblyTruncated = false,
): CampaignPaidPlacementEvidence {
  const issues = new Set<string>();
  if (
    !exactNonemptyString(campaignId)
    || !exactNonemptyString(planId)
    || !exactNonemptyString(offerModelVersion)
  ) {
    issues.add('placement_expected_model_invalid');
  }
  if (placementSlotReadPossiblyTruncated) {
    issues.add('placement_slot_read_truncated');
  }

  const reservationsById = new Map<string, CampaignPlacementEvidenceDocument>();
  for (const document of reservationDocuments) {
    if (!exactNonemptyString(document.id) || reservationsById.has(document.id)) {
      issues.add('placement_reservation_id_duplicate_or_invalid');
      continue;
    }
    reservationsById.set(document.id, document);
  }
  const paidReservations = reservationDocuments.filter((document) => (
    document.data().status === 'paid'
  ));

  const slotsById = new Map<string, CampaignPlacementEvidenceDocument>();
  for (const document of placementSlotDocuments) {
    if (!exactNonemptyString(document.id) || slotsById.has(document.id)) {
      issues.add('placement_slot_id_duplicate_or_invalid');
      continue;
    }
    slotsById.set(document.id, document);
  }

  const paidReservationIds = new Set(paidReservations.map((document) => document.id));
  const paidPointerCounts = new Map<string, number>();
  for (const document of paidReservations) {
    const placementSlotId = document.data().placementSlotId;
    if (!exactNonemptyString(placementSlotId)) {
      issues.add('paid_reservation_slot_pointer_invalid');
      continue;
    }
    paidPointerCounts.set(placementSlotId, (paidPointerCounts.get(placementSlotId) || 0) + 1);
  }
  if ([...paidPointerCounts.values()].some((count) => count !== 1)) {
    issues.add('paid_reservation_slot_pointer_duplicate');
  }

  const slotsByPaidReservationId = new Map<string, CampaignPlacementEvidenceDocument[]>();
  for (const document of placementSlotDocuments) {
    const reservationId = document.data().reservationId;
    if (typeof reservationId !== 'string' || !paidReservationIds.has(reservationId)) continue;
    const current = slotsByPaidReservationId.get(reservationId) || [];
    current.push(document);
    slotsByPaidReservationId.set(reservationId, current);
  }

  let exactSoldSlotCount = 0;
  for (const document of paidReservations) {
    const reservation = document.data();
    const placementSlotId = reservation.placementSlotId;
    if (
      reservation.campaignId !== campaignId
      || reservation.planId !== planId
      || reservation.offerModelVersion !== offerModelVersion
    ) {
      issues.add('paid_reservation_placement_model_mismatch');
    }
    if (!exactNonemptyString(placementSlotId)) continue;

    const slotDocument = slotsById.get(placementSlotId);
    if (!slotDocument) {
      issues.add('paid_reservation_slot_missing');
      continue;
    }
    const slot = slotDocument.data();
    const reciprocalSlots = slotsByPaidReservationId.get(document.id) || [];
    const exact = paidPointerCounts.get(placementSlotId) === 1
      && reciprocalSlots.length === 1
      && reciprocalSlots[0].id === placementSlotId
      && slot.status === 'sold'
      && slot.reservationId === document.id
      && slot.campaignId === campaignId
      && slot.planId === planId
      && slot.offerModelVersion === offerModelVersion;
    if (!exact) {
      if (slot.status !== 'sold') issues.add('paid_reservation_slot_not_sold');
      if (slot.reservationId !== document.id || reciprocalSlots.length !== 1) {
        issues.add('paid_reservation_slot_not_reciprocal');
      }
      if (
        slot.campaignId !== campaignId
        || slot.planId !== planId
        || slot.offerModelVersion !== offerModelVersion
      ) {
        issues.add('paid_reservation_slot_model_mismatch');
      }
      continue;
    }
    exactSoldSlotCount += 1;
  }

  return {
    passed: issues.size === 0 && exactSoldSlotCount === paidReservations.length,
    paidReservationCount: paidReservations.length,
    exactSoldSlotCount,
    issueCodes: [...issues].sort(),
  };
}
