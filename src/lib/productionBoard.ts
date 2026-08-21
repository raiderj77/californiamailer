import {
  ASSET_RIGHTS_BASES,
  ASSET_RIGHTS_STATEMENT_VERSION,
  CREATIVE_BRIEF_STATUS,
  creativeBriefErrors,
  parseCreativeBriefContent,
} from '@/lib/creativeBrief';
import {
  EMPTY_COUPON_DRAFT,
  couponDraftIsComplete,
  normalizeCouponDraft,
} from '@/lib/couponRules';
import { normalizeCouponCode } from '@/lib/trackingRules';

export interface ProductionBoardRecord {
  id: string;
  data: Record<string, unknown>;
}

export interface ProductionBoardIssue {
  code: string;
  message: string;
}

export interface ProductionBoardRow {
  key: string;
  campaign: {
    id: string;
    title: string;
    territory: string;
    status: string;
    plannedDeliveryStart: string | null;
    plannedDeliveryEnd: string | null;
  } | null;
  slot: {
    id: string;
    position: number | null;
    size: string;
    status: string;
  } | null;
  reservation: {
    id: string;
    publicReference: string;
    businessName: string;
    categorySlug: string;
    status: string;
  } | null;
  payment: {
    id: string;
    status: string;
    verifiedCleared: boolean;
    amountCents: number | null;
    refundedCents: number | null;
    netCents: number | null;
  } | null;
  creativeBrief: {
    id: string;
    version: number | null;
    status: string;
    exactPointer: boolean;
    deliveryValidated: boolean;
  } | null;
  material: {
    id: string;
    version: number | null;
    status: string;
    exactPointer: boolean;
    rightsAttested: boolean;
  } | null;
  proof: {
    id: string;
    version: number | null;
    status: string;
    exactPointer: boolean;
    approved: boolean;
    boundToCurrentInputs: boolean | null;
  } | null;
  tracking: {
    exists: boolean;
    exactReservationBinding: boolean;
    active: boolean;
  };
  coupon: {
    exists: boolean;
    exactTrackingBinding: boolean;
    reviewStatus: string;
    publicationStatus: string;
    publicAvailable: boolean;
  };
  portal: {
    reservationScopedAccessAvailable: boolean;
    activeInviteCount: number;
    activeSessionCount: number;
  };
  productionReady: boolean;
  blockers: ProductionBoardIssue[];
  unknowns: ProductionBoardIssue[];
  errors: ProductionBoardIssue[];
}

export interface ProductionBoardInput {
  campaigns: ProductionBoardRecord[];
  slots: ProductionBoardRecord[];
  reservations: ProductionBoardRecord[];
  payments: ProductionBoardRecord[];
  creativeBriefs: ProductionBoardRecord[];
  materials: ProductionBoardRecord[];
  proofs: ProductionBoardRecord[];
  trackingLinks: ProductionBoardRecord[];
  trackingCouponClaims: ProductionBoardRecord[];
  coupons: ProductionBoardRecord[];
  portalInvites: ProductionBoardRecord[];
  portalSessions: ProductionBoardRecord[];
  operationalEvidenceByCampaign: Record<string, string | null>;
  boundedReadPossiblyTruncated?: boolean;
  now?: Date;
}

export interface ProductionBoardSummary {
  rows: number;
  slots: number;
  occupiedSlots: number;
  verifiedPaid: number;
  productionReady: number;
  withBlockers: number;
  withUnknowns: number;
  withErrors: number;
}

export interface ProductionBoardResult {
  rows: ProductionBoardRow[];
  summary: ProductionBoardSummary;
}

const PAYMENT_CLEARED_STATUSES = new Set(['cleared', 'partially_refunded']);
const PROOF_APPROVED_STATUSES = new Set(['approved', 'locked_for_print']);
const PRODUCTION_CAMPAIGN_STATUSES = new Set(['proofing', 'scheduled_for_print']);

export function buildProductionBoard(input: ProductionBoardInput): ProductionBoardResult {
  const now = input.now && Number.isFinite(input.now.getTime()) ? input.now : new Date();
  const campaigns = recordIndex(input.campaigns);
  const slots = recordIndex(input.slots);
  const reservations = recordIndex(input.reservations);
  const payments = recordIndex(input.payments);
  const creativeBriefs = recordIndex(input.creativeBriefs);
  const materials = recordIndex(input.materials);
  const proofs = recordIndex(input.proofs);
  const trackingLinks = recordIndex(input.trackingLinks);
  const trackingCouponClaims = recordIndex(input.trackingCouponClaims);
  const coupons = recordIndex(input.coupons);
  const slotReservationCounts = countStringValues(input.slots, 'reservationId');
  const attachedReservationIds = new Set<string>();

  const rows = input.slots.map((slotDocument) => {
    const slot = slotDocument.data;
    const reservationId = cleanString(slot.reservationId);
    const reservationDocument = reservationId ? reservations.byId.get(reservationId) || null : null;
    if (reservationId) attachedReservationIds.add(reservationId);
    return buildRow({
      campaignDocument: campaigns.byId.get(cleanString(slot.campaignId)) || null,
      slotDocument,
      reservationDocument,
      indexes: {
        campaigns,
        slots,
        reservations,
        payments,
        creativeBriefs,
        materials,
        proofs,
        trackingLinks,
        trackingCouponClaims,
        coupons,
      },
      portalInvites: input.portalInvites,
      portalSessions: input.portalSessions,
      operationalEvidenceByCampaign: input.operationalEvidenceByCampaign,
      boundedReadPossiblyTruncated: input.boundedReadPossiblyTruncated === true,
      duplicateSlotReservation: reservationId
        ? (slotReservationCounts.get(reservationId) || 0) > 1
        : false,
      now,
    });
  });

  for (const reservationDocument of input.reservations) {
    if (attachedReservationIds.has(reservationDocument.id)) continue;
    const reservation = reservationDocument.data;
    const slotId = cleanString(reservation.placementSlotId);
    const pointedSlot = slotId ? slots.byId.get(slotId) || null : null;
    rows.push(buildRow({
      campaignDocument: campaigns.byId.get(cleanString(reservation.campaignId)) || null,
      slotDocument: null,
      reservationDocument,
      indexes: {
        campaigns,
        slots,
        reservations,
        payments,
        creativeBriefs,
        materials,
        proofs,
        trackingLinks,
        trackingCouponClaims,
        coupons,
      },
      portalInvites: input.portalInvites,
      portalSessions: input.portalSessions,
      operationalEvidenceByCampaign: input.operationalEvidenceByCampaign,
      boundedReadPossiblyTruncated: input.boundedReadPossiblyTruncated === true,
      duplicateSlotReservation: Boolean(pointedSlot),
      now,
    }));
  }

  rows.sort(compareRows);
  return {
    rows,
    summary: summarizeRows(rows),
  };
}

type RecordIndex = ReturnType<typeof recordIndex>;

interface RowBuildInput {
  campaignDocument: ProductionBoardRecord | null;
  slotDocument: ProductionBoardRecord | null;
  reservationDocument: ProductionBoardRecord | null;
  indexes: {
    campaigns: RecordIndex;
    slots: RecordIndex;
    reservations: RecordIndex;
    payments: RecordIndex;
    creativeBriefs: RecordIndex;
    materials: RecordIndex;
    proofs: RecordIndex;
    trackingLinks: RecordIndex;
    trackingCouponClaims: RecordIndex;
    coupons: RecordIndex;
  };
  portalInvites: ProductionBoardRecord[];
  portalSessions: ProductionBoardRecord[];
  operationalEvidenceByCampaign: Record<string, string | null>;
  boundedReadPossiblyTruncated: boolean;
  duplicateSlotReservation: boolean;
  now: Date;
}

function buildRow(input: RowBuildInput): ProductionBoardRow {
  const blockers: ProductionBoardIssue[] = [];
  const unknowns: ProductionBoardIssue[] = [];
  const errors: ProductionBoardIssue[] = [];
  const campaignDocument = input.campaignDocument;
  const slotDocument = input.slotDocument;
  const reservationDocument = input.reservationDocument;
  const campaign = campaignDocument?.data || null;
  const slot = slotDocument?.data || null;
  const reservation = reservationDocument?.data || null;
  const campaignId = campaignDocument?.id
    || cleanString(slot?.campaignId)
    || cleanString(reservation?.campaignId);

  if (input.boundedReadPossiblyTruncated) {
    unknowns.push(issue('bounded_read_truncated', 'At least one bounded collection read reached its cap, so readiness cannot be confirmed.'));
  }

  if (!campaignDocument) {
    errors.push(issue('campaign_record_missing', 'The row points to a campaign record that is not present in this bounded read.'));
  } else if (input.indexes.campaigns.duplicateIds.has(campaignDocument.id)) {
    errors.push(issue('duplicate_campaign_id', 'More than one campaign record used the same identifier.'));
  }

  if (campaign) {
    const status = cleanString(campaign.status);
    if (!PRODUCTION_CAMPAIGN_STATUSES.has(status)) {
      blockers.push(issue('campaign_not_in_production_stage', 'Campaign is not in proofing or scheduled-for-print state.'));
    }
    if (campaign.artworkPreflightApproved !== true) {
      blockers.push(issue('campaign_preflight_not_approved', 'Combined-artwork preflight is not explicitly approved.'));
    }
    if (campaign.ownerPrintApproved !== true || !isRecordedBy(campaign.printReadyAt, input.now)) {
      blockers.push(issue('campaign_print_not_approved', 'The current print-readiness version lacks explicit owner approval.'));
    }
    if (!Object.hasOwn(input.operationalEvidenceByCampaign, campaignDocument!.id)) {
      unknowns.push(issue('campaign_operational_evidence_unread', 'Current route and supplier evidence was not evaluated.'));
    } else {
      const evidenceReason = input.operationalEvidenceByCampaign[campaignDocument!.id];
      if (evidenceReason) {
        blockers.push(issue('campaign_operational_evidence_blocked', `Current route or supplier evidence is blocked: ${evidenceReason}.`));
      }
    }
  }

  if (!slotDocument) {
    errors.push(issue('reservation_slot_pointer_unresolved', 'Reservation is not attached by an exact placement-slot record.'));
  } else {
    if (input.indexes.slots.duplicateIds.has(slotDocument.id)) {
      errors.push(issue('duplicate_slot_id', 'More than one placement slot used the same identifier.'));
    }
    if (cleanString(slot?.status) !== 'sold') {
      blockers.push(issue('slot_not_sold', 'Placement slot is not explicitly marked sold.'));
    }
    if (!reservationDocument && cleanString(slot?.reservationId)) {
      errors.push(issue('slot_reservation_missing', 'Placement slot points to a reservation record that is not present.'));
    }
  }

  if (input.duplicateSlotReservation) {
    errors.push(issue('reservation_slot_binding_not_unique', 'Reservation-to-slot ownership is duplicated or contradictory.'));
  }

  if (!reservationDocument) {
    blockers.push(issue('reservation_missing', 'No reservation is attached to this placement slot.'));
    return finishRow({
      campaignDocument,
      slotDocument,
      reservationDocument: null,
      payment: null,
      creativeBrief: null,
      material: null,
      proof: null,
      tracking: emptyTracking(),
      coupon: emptyCoupon(),
      portal: emptyPortal(),
      blockers,
      unknowns,
      errors,
    });
  }

  if (input.indexes.reservations.duplicateIds.has(reservationDocument.id)) {
    errors.push(issue('duplicate_reservation_id', 'More than one reservation record used the same identifier.'));
  }
  if (cleanString(reservation?.status) !== 'paid') {
    blockers.push(issue('reservation_not_paid', 'Reservation is not explicitly in provider-verified paid state.'));
  }
  if (!cleanString(reservation?.advertiserDisclaimer)) {
    blockers.push(issue('advertiser_disclaimer_missing', 'Advertiser disclaimer is not explicitly recorded.'));
  }
  if (
    campaignId !== cleanString(reservation?.campaignId)
    || (slotDocument && campaignId !== cleanString(slot?.campaignId))
  ) {
    errors.push(issue('campaign_binding_mismatch', 'Campaign identifiers do not agree across campaign, slot, and reservation.'));
  }
  if (slotDocument && (
    cleanString(slot?.reservationId) !== reservationDocument.id
    || cleanString(reservation?.placementSlotId) !== slotDocument.id
  )) {
    errors.push(issue('slot_reservation_binding_mismatch', 'Slot and reservation do not point to each other exactly.'));
  }
  if (campaign && !modelBindingsMatch(campaign, slot, reservation!)) {
    errors.push(issue('offer_model_binding_mismatch', 'Plan or offer-model versions do not agree across current records.'));
  }

  const payment = paymentView(
    reservationDocument,
    campaignId,
    input.indexes.payments,
    input.now,
    blockers,
    unknowns,
    errors,
  );
  const creativeBrief = creativeBriefView(
    reservationDocument,
    slotDocument,
    campaignDocument,
    input.indexes.creativeBriefs,
    blockers,
    unknowns,
    errors,
  );
  const material = materialView(
    reservationDocument,
    campaignId,
    input.indexes.materials,
    input.now,
    blockers,
    unknowns,
    errors,
  );
  const proof = proofView(
    reservationDocument,
    campaignId,
    creativeBrief,
    material,
    input.indexes.proofs,
    input.now,
    blockers,
    unknowns,
    errors,
  );
  const tracking = trackingView(reservationDocument, campaignId, input.indexes.trackingLinks, errors);
  const coupon = couponView(
    reservationDocument,
    campaignId,
    tracking,
    input.indexes.trackingLinks,
    input.indexes.trackingCouponClaims,
    input.indexes.coupons,
    errors,
  );
  const portal = portalView(reservationDocument, input.portalInvites, input.portalSessions, input.now);

  return finishRow({
    campaignDocument,
    slotDocument,
    reservationDocument,
    payment,
    creativeBrief,
    material,
    proof,
    tracking,
    coupon,
    portal,
    blockers,
    unknowns,
    errors,
  });
}

function paymentView(
  reservationDocument: ProductionBoardRecord,
  campaignId: string,
  payments: RecordIndex,
  now: Date,
  blockers: ProductionBoardIssue[],
  unknowns: ProductionBoardIssue[],
  errors: ProductionBoardIssue[],
): ProductionBoardRow['payment'] {
  const document = payments.byId.get(reservationDocument.id);
  if (!document) {
    unknowns.push(issue('canonical_payment_missing', 'The reservation-ID canonical payment record is missing.'));
    return null;
  }
  if (payments.duplicateIds.has(document.id)) {
    errors.push(issue('duplicate_canonical_payment', 'More than one canonical payment record used the reservation identifier.'));
  }
  const payment = document.data;
  const reservation = reservationDocument.data;
  const status = cleanString(payment.status);
  const amountCents = safeWholeCents(payment.amountCents);
  const refundedCents = safeWholeCents(payment.refundedCents);
  const netCents = amountCents !== null && refundedCents !== null && refundedCents <= amountCents
    ? amountCents - refundedCents
    : null;
  const exactBinding = document.id === reservationDocument.id
    && cleanString(payment.reservationId) === reservationDocument.id
    && cleanString(payment.campaignId) === campaignId
    && cleanString(payment.planId) === cleanString(reservation.planId)
    && cleanString(payment.offerModelVersion) === cleanString(reservation.offerModelVersion);
  if (!exactBinding) {
    errors.push(issue('canonical_payment_binding_mismatch', 'Canonical payment does not exactly match the reservation, campaign, plan, and offer model.'));
  }
  if (amountCents === null || refundedCents === null || netCents === null) {
    errors.push(issue('canonical_payment_amount_invalid', 'Canonical payment amount or refund ledger is invalid.'));
  } else if (amountCents !== safeWholeCents(reservation.quotedPriceCents)) {
    errors.push(issue('canonical_payment_quote_mismatch', 'Canonical payment amount does not equal the reservation quote.'));
  }
  const quotedPriceCents = safeWholeCents(reservation.quotedPriceCents);
  const amountMatchesQuote = amountCents !== null
    && quotedPriceCents !== null
    && amountCents === quotedPriceCents;
  const explicitProviderEvidence = cleanString(payment.provider) === 'stripe'
    && Boolean(cleanString(payment.externalPaymentId))
    && cleanString(payment.currency).toLowerCase() === 'usd'
    && isRecordedBy(payment.clearedAt, now);
  const verifiedCleared = exactBinding
    && status === 'cleared'
    && cleanString(reservation.status) === 'paid'
    && explicitProviderEvidence
    && netCents !== null
    && amountCents !== null
    && refundedCents === 0
    && netCents === amountCents
    && amountMatchesQuote;
  if (!PAYMENT_CLEARED_STATUSES.has(status)) {
    blockers.push(issue('canonical_payment_not_cleared', 'Canonical payment is not in a cleared or partially-refunded state.'));
  } else if (!explicitProviderEvidence) {
    unknowns.push(issue('canonical_payment_provider_evidence_missing', 'Cleared payment lacks an external provider identifier or cleared timestamp.'));
  } else if (netCents === 0) {
    blockers.push(issue('canonical_payment_no_net_funding', 'Canonical payment has no remaining cleared funding.'));
  }
  if (status === 'partially_refunded' || (refundedCents !== null && refundedCents > 0)) {
    blockers.push(issue('canonical_payment_refund_present', 'A partial refund is recorded; this placement is not treated as fully paid for production.'));
  }
  return { id: document.id, status, verifiedCleared, amountCents, refundedCents, netCents };
}

function creativeBriefView(
  reservationDocument: ProductionBoardRecord,
  slotDocument: ProductionBoardRecord | null,
  campaignDocument: ProductionBoardRecord | null,
  briefs: RecordIndex,
  blockers: ProductionBoardIssue[],
  unknowns: ProductionBoardIssue[],
  errors: ProductionBoardIssue[],
): ProductionBoardRow['creativeBrief'] {
  const reservation = reservationDocument.data;
  const pointer = cleanString(reservation.latestCreativeBriefId);
  const sequence = safePositiveInteger(reservation.creativeBriefSequence);
  if (!pointer) {
    unknowns.push(issue('creative_brief_pointer_missing', 'Latest creative-brief pointer is not recorded.'));
    return null;
  }
  const document = briefs.byId.get(pointer);
  if (!document) {
    errors.push(issue('creative_brief_pointer_unresolved', 'Latest creative-brief pointer does not resolve in the bounded read.'));
    return null;
  }
  if (briefs.duplicateIds.has(pointer)) {
    errors.push(issue('duplicate_creative_brief_id', 'More than one creative-brief version used the latest identifier.'));
  }
  const brief = document.data;
  const version = safePositiveInteger(brief.version);
  const status = cleanString(brief.status);
  const exactPointer = Boolean(
    sequence !== null
    && version === sequence
    && cleanString(reservation.creativeBriefStatus) === status
    && status === CREATIVE_BRIEF_STATUS
    && cleanString(brief.reservationId) === reservationDocument.id
    && cleanString(brief.campaignId) === campaignDocument?.id
    && cleanString(brief.placementSlotId) === slotDocument?.id,
  );
  if (!exactPointer) {
    errors.push(issue('creative_brief_binding_mismatch', 'Latest creative brief is not exactly bound to the current reservation, slot, campaign, status, and sequence.'));
  }
  const content = parseCreativeBriefContent(brief.content);
  let deliveryValidated = false;
  if (!content) {
    errors.push(issue('creative_brief_content_invalid', 'Latest creative brief has invalid structured content.'));
  } else if (!campaignDocument) {
    unknowns.push(issue('creative_brief_schedule_unavailable', 'Campaign schedule is unavailable for offer-date validation.'));
  } else {
    const campaignWindow = {
      startDate: calendarDateOrNull(campaignDocument.data.plannedDeliveryStart),
      endDate: calendarDateOrNull(campaignDocument.data.plannedDeliveryEnd),
    };
    const savedWindow = isPlainRecord(brief.deliveryWindow) ? brief.deliveryWindow : {};
    const savedWindowMatches = nullableString(savedWindow.startDate) === campaignWindow.startDate
      && nullableString(savedWindow.endDate) === campaignWindow.endDate
      && cleanString(savedWindow.timeZone) === 'America/Los_Angeles'
      && cleanString(savedWindow.validationStatus) === 'validated_for_planned_window';
    const fullScheduleAvailable = Boolean(campaignWindow.startDate && campaignWindow.endDate);
    deliveryValidated = fullScheduleAvailable
      && savedWindowMatches
      && creativeBriefErrors(content, campaignWindow).length === 0;
    if (!fullScheduleAvailable) {
      unknowns.push(issue('campaign_delivery_window_incomplete', 'Both planned delivery dates are required before offer timing can be confirmed.'));
    } else if (!savedWindowMatches) {
      blockers.push(issue('creative_brief_schedule_stale', 'Creative brief was not validated against the current campaign delivery window.'));
    } else if (!deliveryValidated) {
      blockers.push(issue('creative_brief_offer_dates_invalid', 'Creative-brief offer dates do not cover the current delivery window.'));
    }
  }
  return { id: document.id, version, status, exactPointer, deliveryValidated };
}

function materialView(
  reservationDocument: ProductionBoardRecord,
  campaignId: string,
  materials: RecordIndex,
  now: Date,
  blockers: ProductionBoardIssue[],
  unknowns: ProductionBoardIssue[],
  errors: ProductionBoardIssue[],
): ProductionBoardRow['material'] {
  const reservation = reservationDocument.data;
  const pointer = cleanString(reservation.latestMaterialId);
  const sequence = safePositiveInteger(reservation.materialSequence);
  if (!pointer) {
    unknowns.push(issue('material_pointer_missing', 'Latest material pointer is not recorded.'));
    return null;
  }
  const document = materials.byId.get(pointer);
  if (!document) {
    errors.push(issue('material_pointer_unresolved', 'Latest material pointer does not resolve in the bounded read.'));
    return null;
  }
  if (materials.duplicateIds.has(pointer)) {
    errors.push(issue('duplicate_material_id', 'More than one material version used the latest identifier.'));
  }
  const material = document.data;
  const version = safePositiveInteger(material.version);
  const status = cleanString(material.status);
  const exactPointer = Boolean(
    sequence !== null
    && sequence === version
    && cleanString(material.reservationId) === reservationDocument.id
    && cleanString(material.campaignId) === campaignId
    && cleanString(material.placementSlotId) === cleanString(reservation.placementSlotId),
  );
  if (!exactPointer) {
    errors.push(issue('material_binding_mismatch', 'Latest material is not exactly bound to the current reservation, campaign, and sequence.'));
  }
  if (status !== 'owner_approved_private' || !isRecordedBy(material.reviewedAt, now) || !cleanString(material.reviewedBy)) {
    blockers.push(issue('material_not_owner_approved', 'Latest private material lacks an explicit owner approval decision.'));
  }
  const rightsAttested = validRightsAttestation(material, now);
  if (!rightsAttested) {
    blockers.push(issue('material_rights_not_attested', 'Latest material lacks a complete versioned rights attestation for this use.'));
  }
  return { id: document.id, version, status, exactPointer, rightsAttested };
}

function proofView(
  reservationDocument: ProductionBoardRecord,
  campaignId: string,
  creativeBrief: ProductionBoardRow['creativeBrief'],
  material: ProductionBoardRow['material'],
  proofs: RecordIndex,
  now: Date,
  blockers: ProductionBoardIssue[],
  unknowns: ProductionBoardIssue[],
  errors: ProductionBoardIssue[],
): ProductionBoardRow['proof'] {
  const reservation = reservationDocument.data;
  const pointer = cleanString(reservation.latestProofId);
  const sequence = safePositiveInteger(reservation.proofSequence);
  if (!pointer) {
    unknowns.push(issue('proof_pointer_missing', 'Latest proof pointer is not recorded.'));
    return null;
  }
  const document = proofs.byId.get(pointer);
  if (!document) {
    errors.push(issue('proof_pointer_unresolved', 'Latest proof pointer does not resolve in the bounded read.'));
    return null;
  }
  if (proofs.duplicateIds.has(pointer)) {
    errors.push(issue('duplicate_proof_id', 'More than one proof version used the latest identifier.'));
  }
  const proof = document.data;
  const version = safePositiveInteger(proof.version);
  const status = cleanString(proof.status);
  const exactPointer = Boolean(
    sequence !== null
    && sequence === version
    && cleanString(proof.reservationId) === reservationDocument.id
    && cleanString(proof.campaignId) === campaignId
    && cleanString(proof.placementSlotId) === cleanString(reservation.placementSlotId),
  );
  if (!exactPointer) {
    errors.push(issue('proof_binding_mismatch', 'Latest proof is not exactly bound to the current reservation, campaign, and sequence.'));
  }
  const approved = PROOF_APPROVED_STATUSES.has(status)
    && isRecordedBy(proof.approvedAt, now)
    && Boolean(cleanString(proof.approvedBy));
  if (!approved) {
    blockers.push(issue('proof_not_explicitly_approved', 'Latest exact proof lacks a recorded written approval.'));
  }
  const recordedBriefId = cleanString(proof.creativeBriefId);
  const recordedMaterialId = cleanString(proof.materialId);
  const recordedBriefVersion = safePositiveInteger(proof.creativeBriefVersion);
  const recordedMaterialVersion = safePositiveInteger(proof.materialVersion);
  const bindingRecorded = Boolean(
    recordedBriefId
    || recordedMaterialId
    || proof.creativeBriefVersion !== undefined
    || proof.materialVersion !== undefined,
  );
  const boundToCurrentInputs = bindingRecorded
    ? Boolean(
        creativeBrief
        && material
        && recordedBriefId === creativeBrief.id
        && recordedBriefVersion === creativeBrief.version
        && recordedMaterialId === material.id
        && recordedMaterialVersion === material.version,
      )
    : null;
  if (boundToCurrentInputs === null) {
    unknowns.push(issue('proof_source_binding_not_recorded', 'Proof does not record which creative brief and material versions it represents.'));
  } else if (!boundToCurrentInputs) {
    blockers.push(issue('proof_source_binding_stale', 'Latest proof is not bound to the current creative brief and material versions.'));
  }
  return { id: document.id, version, status, exactPointer, approved, boundToCurrentInputs };
}

function trackingView(
  reservationDocument: ProductionBoardRecord,
  campaignId: string,
  links: RecordIndex,
  errors: ProductionBoardIssue[],
): ProductionBoardRow['tracking'] {
  const pointer = cleanString(reservationDocument.data.trackingId);
  if (!pointer) return emptyTracking();
  const document = links.byId.get(pointer);
  if (!document) {
    errors.push(issue('tracking_pointer_unresolved', 'Tracking pointer does not resolve in the bounded read.'));
    return { exists: false, exactReservationBinding: false, active: false };
  }
  if (links.duplicateIds.has(pointer)) {
    errors.push(issue('duplicate_tracking_id', 'More than one tracking record used the reservation pointer.'));
  }
  const exactReservationBinding = cleanString(document.data.reservationId) === reservationDocument.id
    && cleanString(document.data.campaignId) === campaignId;
  if (!exactReservationBinding) {
    errors.push(issue('tracking_binding_mismatch', 'Tracking record is not exactly owned by this reservation and campaign.'));
  }
  return {
    exists: true,
    exactReservationBinding,
    active: exactReservationBinding && document.data.active === true,
  };
}

function couponView(
  reservationDocument: ProductionBoardRecord,
  campaignId: string,
  tracking: ProductionBoardRow['tracking'],
  links: RecordIndex,
  claims: RecordIndex,
  coupons: RecordIndex,
  errors: ProductionBoardIssue[],
): ProductionBoardRow['coupon'] {
  const trackingId = cleanString(reservationDocument.data.trackingId);
  if (!trackingId || !tracking.exists) return emptyCoupon();
  const document = coupons.byId.get(trackingId);
  if (!document) return emptyCoupon();
  if (coupons.duplicateIds.has(trackingId)) {
    errors.push(issue('duplicate_coupon_id', 'More than one coupon record used the canonical tracking identifier.'));
  }
  const coupon = document.data;
  const trackingDocument = links.byId.get(trackingId);
  const code = normalizeCouponCode(cleanString(coupon.couponCode));
  const trackingCode = normalizeCouponCode(cleanString(trackingDocument?.data.couponCode));
  const claim = [...claims.byId.values()].find((candidate) => {
    const data = candidate.data;
    return cleanString(data.reservationId) === reservationDocument.id
      && cleanString(data.trackingId) === trackingId
      && normalizeCouponCode(cleanString(data.couponCode)) === code;
  });
  const exactTrackingBinding = Boolean(
    document.id === trackingId
    && cleanString(coupon.reservationId) === reservationDocument.id
    && cleanString(coupon.trackingId) === trackingId
    && cleanString(trackingDocument?.data.reservationId) === reservationDocument.id
    && cleanString(trackingDocument?.data.campaignId) === campaignId
    && code.length >= 3
    && trackingCode === code
    && claim
    && cleanString(claim.data.campaignId) === campaignId,
  );
  if (!exactTrackingBinding) {
    errors.push(issue('coupon_binding_mismatch', 'Coupon, unique-code claim, tracking, reservation, or campaign ownership does not match.'));
  }
  let publishedContentComplete = false;
  if (isPlainRecord(coupon.publishedContent)) {
    try {
      publishedContentComplete = couponDraftIsComplete(normalizeCouponDraft({
        ...EMPTY_COUPON_DRAFT,
        ...coupon.publishedContent,
      }));
    } catch {
      publishedContentComplete = false;
    }
  }
  const reviewStatus = cleanString(coupon.reviewStatus) || 'draft';
  const publicationStatus = cleanString(coupon.publicationStatus) || 'unpublished';
  return {
    exists: true,
    exactTrackingBinding,
    reviewStatus,
    publicationStatus,
    publicAvailable: exactTrackingBinding
      && tracking.active
      && cleanString(reservationDocument.data.status) === 'paid'
      && publicationStatus === 'published'
      && publishedContentComplete,
  };
}

function portalView(
  reservationDocument: ProductionBoardRecord,
  invites: ProductionBoardRecord[],
  sessions: ProductionBoardRecord[],
  now: Date,
): ProductionBoardRow['portal'] {
  const reservation = reservationDocument.data;
  const reservationId = reservationDocument.id;
  const accessVersion = nonnegativeInteger(reservation.portalAccessVersion);
  const inviteVersion = nonnegativeInteger(reservation.portalInviteVersion);
  const nowMs = now.getTime();
  const activeInviteCount = invites.filter(({ data }) => data.status === 'active'
    && cleanString(data.reservationId) === reservationId
    && nonnegativeInteger(data.accessVersion) === accessVersion
    && nonnegativeInteger(data.inviteVersion) === inviteVersion
    && timestampMillis(data.expiresAt) > nowMs).length;
  const activeSessionCount = sessions.filter(({ data }) => data.status === 'active'
    && cleanString(data.reservationId) === reservationId
    && nonnegativeInteger(data.accessVersion) === accessVersion
    && timestampMillis(data.expiresAt) > nowMs).length;
  const legacyAccessActive = Boolean(cleanString(reservation.accessTokenHash));
  return {
    reservationScopedAccessAvailable: legacyAccessActive || activeInviteCount > 0 || activeSessionCount > 0,
    activeInviteCount,
    activeSessionCount,
  };
}

interface FinishRowInput {
  campaignDocument: ProductionBoardRecord | null;
  slotDocument: ProductionBoardRecord | null;
  reservationDocument: ProductionBoardRecord | null;
  payment: ProductionBoardRow['payment'];
  creativeBrief: ProductionBoardRow['creativeBrief'];
  material: ProductionBoardRow['material'];
  proof: ProductionBoardRow['proof'];
  tracking: ProductionBoardRow['tracking'];
  coupon: ProductionBoardRow['coupon'];
  portal: ProductionBoardRow['portal'];
  blockers: ProductionBoardIssue[];
  unknowns: ProductionBoardIssue[];
  errors: ProductionBoardIssue[];
}

function finishRow(input: FinishRowInput): ProductionBoardRow {
  const campaign = input.campaignDocument?.data;
  const slot = input.slotDocument?.data;
  const reservation = input.reservationDocument?.data;
  return {
    key: input.slotDocument
      ? `slot:${input.slotDocument.id}`
      : `reservation:${input.reservationDocument?.id || 'missing'}`,
    campaign: input.campaignDocument ? {
      id: input.campaignDocument.id,
      title: cleanString(campaign?.title) || input.campaignDocument.id,
      territory: cleanString(campaign?.territory),
      status: cleanString(campaign?.status),
      plannedDeliveryStart: calendarDateOrNull(campaign?.plannedDeliveryStart),
      plannedDeliveryEnd: calendarDateOrNull(campaign?.plannedDeliveryEnd),
    } : null,
    slot: input.slotDocument ? {
      id: input.slotDocument.id,
      position: safePositiveInteger(slot?.position),
      size: cleanString(slot?.size),
      status: cleanString(slot?.status),
    } : null,
    reservation: input.reservationDocument ? {
      id: input.reservationDocument.id,
      publicReference: cleanString(reservation?.publicReference),
      businessName: cleanString(reservation?.businessName),
      categorySlug: cleanString(reservation?.categorySlug),
      status: cleanString(reservation?.status),
    } : null,
    payment: input.payment,
    creativeBrief: input.creativeBrief,
    material: input.material,
    proof: input.proof,
    tracking: input.tracking,
    coupon: input.coupon,
    portal: input.portal,
    productionReady: input.blockers.length === 0
      && input.unknowns.length === 0
      && input.errors.length === 0,
    blockers: dedupeIssues(input.blockers),
    unknowns: dedupeIssues(input.unknowns),
    errors: dedupeIssues(input.errors),
  };
}

function validRightsAttestation(material: Record<string, unknown>, now: Date) {
  if (!isPlainRecord(material.rightsAttestation)) return false;
  const rights = material.rightsAttestation;
  const assetKind = cleanString(material.assetKind);
  const rightsBasis = cleanString(rights.rightsBasis);
  const sourceOrLicenseNote = cleanString(rights.sourceOrLicenseNote);
  return rights.rightsAttested === true
    && cleanString(rights.statementVersion) === ASSET_RIGHTS_STATEMENT_VERSION
    && Boolean(assetKind)
    && cleanString(rights.assetKind) === assetKind
    && ASSET_RIGHTS_BASES.includes(rightsBasis as (typeof ASSET_RIGHTS_BASES)[number])
    && cleanString(rights.attestorName).length >= 2
    && (rightsBasis === 'business_owned' || sourceOrLicenseNote.length >= 3)
    && isRecordedBy(material.rightsAttestedAt, now);
}

function modelBindingsMatch(
  campaign: Record<string, unknown>,
  slot: Record<string, unknown> | null,
  reservation: Record<string, unknown>,
) {
  const planId = cleanString(campaign.planId);
  const model = cleanString(campaign.offerModelVersion);
  return Boolean(planId && model)
    && cleanString(reservation.planId) === planId
    && cleanString(reservation.offerModelVersion) === model
    && (!slot || (cleanString(slot.planId) === planId && cleanString(slot.offerModelVersion) === model));
}

function recordIndex(records: ProductionBoardRecord[]) {
  const byId = new Map<string, ProductionBoardRecord>();
  const duplicateIds = new Set<string>();
  for (const record of records) {
    if (byId.has(record.id)) duplicateIds.add(record.id);
    else byId.set(record.id, record);
  }
  return { byId, duplicateIds };
}

function countStringValues(records: ProductionBoardRecord[], key: string) {
  const counts = new Map<string, number>();
  for (const record of records) {
    const value = cleanString(record.data[key]);
    if (value) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function summarizeRows(rows: ProductionBoardRow[]): ProductionBoardSummary {
  return {
    rows: rows.length,
    slots: rows.filter((row) => row.slot).length,
    occupiedSlots: rows.filter((row) => row.slot && row.reservation).length,
    verifiedPaid: rows.filter((row) => row.payment?.verifiedCleared).length,
    productionReady: rows.filter((row) => row.productionReady).length,
    withBlockers: rows.filter((row) => row.blockers.length > 0).length,
    withUnknowns: rows.filter((row) => row.unknowns.length > 0).length,
    withErrors: rows.filter((row) => row.errors.length > 0).length,
  };
}

function compareRows(left: ProductionBoardRow, right: ProductionBoardRow) {
  const campaign = (left.campaign?.title || left.campaign?.id || '')
    .localeCompare(right.campaign?.title || right.campaign?.id || '');
  if (campaign !== 0) return campaign;
  const leftPosition = left.slot?.position ?? Number.MAX_SAFE_INTEGER;
  const rightPosition = right.slot?.position ?? Number.MAX_SAFE_INTEGER;
  if (leftPosition !== rightPosition) return leftPosition - rightPosition;
  return left.key.localeCompare(right.key);
}

function issue(code: string, message: string): ProductionBoardIssue {
  return { code, message };
}

function dedupeIssues(issues: ProductionBoardIssue[]) {
  return [...new Map(issues.map((item) => [item.code, item])).values()];
}

function cleanString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function nullableString(value: unknown): string | null {
  return value === null || value === undefined || value === '' ? null : cleanString(value);
}

function safeWholeCents(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

function safePositiveInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function nonnegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
}

function isRecordedBy(value: unknown, now: Date) {
  const milliseconds = timestampMillis(value);
  return milliseconds > 0 && milliseconds <= now.getTime();
}

function timestampMillis(value: unknown): number {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.getTime() : 0;
  if (typeof value === 'string') {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : 0;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value && typeof value === 'object') {
    const candidate = value as { toMillis?: () => unknown; toDate?: () => unknown };
    if (typeof candidate.toMillis === 'function') {
      const milliseconds = Number(candidate.toMillis());
      return Number.isFinite(milliseconds) ? milliseconds : 0;
    }
    if (typeof candidate.toDate === 'function') {
      const date = candidate.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.getTime() : 0;
    }
  }
  return 0;
}

function calendarDateOrNull(value: unknown): string | null {
  const candidate = nullableString(value);
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === candidate
    ? candidate
    : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function emptyTracking(): ProductionBoardRow['tracking'] {
  return { exists: false, exactReservationBinding: false, active: false };
}

function emptyCoupon(): ProductionBoardRow['coupon'] {
  return {
    exists: false,
    exactTrackingBinding: false,
    reviewStatus: 'not_started',
    publicationStatus: 'unpublished',
    publicAvailable: false,
  };
}

function emptyPortal(): ProductionBoardRow['portal'] {
  return {
    reservationScopedAccessAvailable: false,
    activeInviteCount: 0,
    activeSessionCount: 0,
  };
}

export function escapeSpreadsheetCell(value: unknown): string {
  const singleLine = String(value ?? '').replace(/[\r\n]+/g, ' ').trim();
  return /^[\t ]*[=+\-@]/.test(singleLine) ? `'${singleLine}` : singleLine;
}

function csvCell(value: unknown): string {
  return `"${escapeSpreadsheetCell(value).replaceAll('"', '""')}"`;
}

export function productionBoardCsv(rows: ProductionBoardRow[]): string {
  const headers = [
    'Campaign',
    'Territory',
    'Slot',
    'Size',
    'Slot status',
    'Business',
    'Public reference',
    'Category',
    'Reservation status',
    'Payment status',
    'Payment verified',
    'Creative brief',
    'Material and rights',
    'Proof',
    'Tracking',
    'Coupon',
    'Portal',
    'Production ready',
    'Blockers',
    'Unknowns',
    'Errors',
  ];
  const lines = rows.map((row) => [
    row.campaign?.title || row.campaign?.id || 'Missing campaign',
    row.campaign?.territory || '',
    row.slot?.position ?? row.slot?.id ?? 'Unassigned',
    row.slot?.size || '',
    row.slot?.status || 'missing',
    row.reservation?.businessName || '',
    row.reservation?.publicReference || '',
    row.reservation?.categorySlug || '',
    row.reservation?.status || 'missing',
    row.payment?.status || 'missing',
    row.payment?.verifiedCleared ? 'yes' : 'no',
    row.creativeBrief ? `v${row.creativeBrief.version ?? '?'} ${row.creativeBrief.status}` : 'missing',
    row.material ? `v${row.material.version ?? '?'} ${row.material.status}; rights ${row.material.rightsAttested ? 'attested' : 'missing'}` : 'missing',
    row.proof ? `v${row.proof.version ?? '?'} ${row.proof.status}` : 'missing',
    row.tracking.active ? 'active' : row.tracking.exists ? 'inactive' : 'not configured',
    row.coupon.publicAvailable ? 'publicly available' : row.coupon.exists ? row.coupon.publicationStatus : 'not started',
    row.portal.reservationScopedAccessAvailable ? 'reservation access available' : 'not available',
    row.productionReady ? 'yes' : 'no',
    row.blockers.map((item) => item.message).join(' | '),
    row.unknowns.map((item) => item.message).join(' | '),
    row.errors.map((item) => item.message).join(' | '),
  ].map(csvCell).join(','));
  return `\uFEFF${[headers.map(csvCell).join(','), ...lines].join('\r\n')}\r\n`;
}
