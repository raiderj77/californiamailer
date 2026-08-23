export interface ProductionPaymentIntegrityRecord {
  id: string;
  data: Record<string, unknown>;
}

export interface ProductionPaymentIntegrityIssue {
  code: string;
  message: string;
}

export interface ProductionPaymentIntegrityState {
  globalIssues: ProductionPaymentIntegrityIssue[];
  issuesByCampaignId: Map<string, ProductionPaymentIntegrityIssue[]>;
}

const MESSAGES: Record<string, string> = {
  payment_record_id_duplicate_or_invalid:
    'Payment document identifiers are duplicated or noncanonical in the bounded ledger.',
  payment_orphan:
    'A payment record does not resolve to an exact reservation in the bounded ledger.',
  payment_document_or_reservation_id_mismatch:
    'A payment document ID and its recorded reservation ID do not identify the same reservation.',
  payment_campaign_or_offer_model_mismatch:
    'A payment record does not exactly match its reservation campaign, plan, and offer model.',
  paid_payment_duplicate:
    'A reservation is related to more than one payment record, so canonical payment ownership is ambiguous.',
};

function exactNonemptyString(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value === value.trim();
}

function indexed(records: ProductionPaymentIntegrityRecord[]) {
  const byId = new Map<string, ProductionPaymentIntegrityRecord>();
  const duplicateOrInvalidIds = new Set<string>();
  for (const record of records) {
    if (!exactNonemptyString(record.id) || byId.has(record.id)) {
      duplicateOrInvalidIds.add(record.id);
      continue;
    }
    byId.set(record.id, record);
  }
  return { byId, duplicateOrInvalidIds };
}

export function productionPaymentIntegrityState(
  paymentRecords: ProductionPaymentIntegrityRecord[],
  reservationRecords: ProductionPaymentIntegrityRecord[],
  campaignRecords: ProductionPaymentIntegrityRecord[],
): ProductionPaymentIntegrityState {
  const campaigns = indexed(campaignRecords);
  const reservations = indexed(reservationRecords);
  const payments = indexed(paymentRecords);
  const globalCodes = new Set<string>();
  const codesByCampaignId = new Map<string, Set<string>>();

  const recordIssue = (code: string, affectedCampaignIds: Set<string>) => {
    if (affectedCampaignIds.size === 0) {
      globalCodes.add(code);
      return;
    }
    for (const campaignId of affectedCampaignIds) {
      const codes = codesByCampaignId.get(campaignId) || new Set<string>();
      codes.add(code);
      codesByCampaignId.set(campaignId, codes);
    }
  };

  if (payments.duplicateOrInvalidIds.size > 0) {
    globalCodes.add('payment_record_id_duplicate_or_invalid');
  }

  for (const paymentDocument of paymentRecords) {
    const payment = paymentDocument.data;
    const rawReservationId = payment.reservationId;
    const canonicalReservationId = exactNonemptyString(rawReservationId)
      ? rawReservationId
      : null;
    const trimmedReservationId = typeof rawReservationId === 'string'
      ? rawReservationId.trim()
      : '';
    const reservationByDocumentId = reservations.byId.get(paymentDocument.id);
    const reservationByRecordedId = canonicalReservationId
      ? reservations.byId.get(canonicalReservationId)
      : undefined;
    const reservationByTrimmedId = trimmedReservationId
      ? reservations.byId.get(trimmedReservationId)
      : undefined;
    const reservation = reservationByDocumentId
      ?? reservationByRecordedId
      ?? reservationByTrimmedId;
    const rawCampaignId = payment.campaignId;
    const trimmedCampaignId = typeof rawCampaignId === 'string' ? rawCampaignId.trim() : '';
    const reservationCampaignId = typeof reservation?.data.campaignId === 'string'
      ? reservation.data.campaignId
      : '';
    const affectedCampaignIds = new Set<string>();
    for (const candidate of [trimmedCampaignId, reservationCampaignId]) {
      if (candidate && campaigns.byId.has(candidate)) affectedCampaignIds.add(candidate);
    }

    if (!reservation) {
      recordIssue('payment_orphan', affectedCampaignIds);
      continue;
    }
    if (
      paymentDocument.id !== reservation.id
      || canonicalReservationId !== reservation.id
    ) {
      recordIssue('payment_document_or_reservation_id_mismatch', affectedCampaignIds);
    }
    const campaign = exactNonemptyString(reservation.data.campaignId)
      ? campaigns.byId.get(reservation.data.campaignId)
      : undefined;
    if (
      !campaign
      || payment.campaignId !== reservation.data.campaignId
      || payment.planId !== reservation.data.planId
      || payment.offerModelVersion !== reservation.data.offerModelVersion
      || payment.campaignId !== campaign.id
      || payment.planId !== campaign.data.planId
      || payment.offerModelVersion !== campaign.data.offerModelVersion
    ) {
      recordIssue('payment_campaign_or_offer_model_mismatch', affectedCampaignIds);
    }
  }

  for (const reservationDocument of reservationRecords) {
    const reservation = reservationDocument.data;
    const relatedPayments = paymentRecords.filter((payment) => (
      payment.id === reservationDocument.id
      || payment.data.reservationId === reservationDocument.id
    ));
    if (relatedPayments.length <= 1) continue;
    const affectedCampaignIds = new Set<string>();
    if (
      exactNonemptyString(reservation.campaignId)
      && campaigns.byId.has(reservation.campaignId)
    ) {
      affectedCampaignIds.add(reservation.campaignId);
    }
    recordIssue('paid_payment_duplicate', affectedCampaignIds);
  }

  const issuesForCodes = (codes: Set<string>) => [...codes]
    .sort()
    .map((code) => ({ code, message: MESSAGES[code] }));
  return {
    globalIssues: issuesForCodes(globalCodes),
    issuesByCampaignId: new Map(
      [...codesByCampaignId].map(([campaignId, codes]) => [campaignId, issuesForCodes(codes)]),
    ),
  };
}
