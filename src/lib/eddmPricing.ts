import {
  DISCOUNT_PRINT_PRICES_CENTS,
  PRINTING4SUPERCHEAP,
  TURNKEY_EDDM,
  USPS_EDDM_RETAIL,
  type EddmFulfillment,
} from '@/config/eddmOfferings';

export interface EddmEstimateInput {
  specificationId: string;
  quantity: number;
  fulfillment: EddmFulfillment;
  taxCents: number | null;
  designCents: number | null;
  otherCostsCents: number | null;
  bundlingCents?: number | null;
  postOfficeDeliveryCents?: number | null;
  customerPriceCents?: number | null;
  now?: Date;
}

export interface EddmEstimate {
  printPriceCents: number | null;
  postageCents: number;
  turnkeyFulfillmentCents: number;
  bandingCents: number;
  knownSubtotalCents: number | null;
  completeDirectCostCents: number | null;
  contributionCents: number | null;
  contributionMarginBps: number | null;
  missingInputs: string[];
  snapshotStale: boolean;
  postageIncludedInTurnkey: boolean;
}

function centsFromMills(quantity: number, millsPerPiece: number): number {
  return Math.ceil((quantity * millsPerPiece) / 10);
}

function validOptionalCents(value: number | null | undefined): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

export function supplierSnapshotIsStale(now = new Date()): boolean {
  const observed = Date.parse(`${PRINTING4SUPERCHEAP.priceObservedAt}T23:59:59Z`);
  const staleAt = observed + PRINTING4SUPERCHEAP.recheckAfterDays * 24 * 60 * 60 * 1_000;
  return now.getTime() > staleAt;
}

export function calculateEddmEstimate(input: EddmEstimateInput): EddmEstimate {
  if (!Number.isInteger(input.quantity) || input.quantity <= 0) {
    throw new Error('Quantity must be a positive whole number.');
  }

  const printPriceCents = DISCOUNT_PRINT_PRICES_CENTS[input.specificationId]?.[input.quantity] ?? null;
  const turnkey = input.fulfillment === 'turnkey';
  const postageCents = turnkey ? 0 : centsFromMills(input.quantity, USPS_EDDM_RETAIL.rateMillsPerPiece);
  const turnkeyFulfillmentCents = turnkey ? centsFromMills(input.quantity, TURNKEY_EDDM.rateMillsPerPiece) : 0;
  const bandingCents = turnkey ? Math.ceil(input.quantity / 1_000) * TURNKEY_EDDM.bandingCentsPerThousand : 0;
  const missingInputs: string[] = [];

  if (printPriceCents === null) missingInputs.push('supplierPriceSnapshot');
  if (!validOptionalCents(input.taxCents)) missingInputs.push('taxCents');
  if (!validOptionalCents(input.designCents)) missingInputs.push('designCents');
  if (!validOptionalCents(input.otherCostsCents)) missingInputs.push('otherCostsCents');
  if (!turnkey && !validOptionalCents(input.bundlingCents)) missingInputs.push('bundlingCents');
  if (!turnkey && !validOptionalCents(input.postOfficeDeliveryCents)) missingInputs.push('postOfficeDeliveryCents');

  const knownSubtotalCents = printPriceCents === null
    ? null
    : printPriceCents + postageCents + turnkeyFulfillmentCents + bandingCents;

  const completeDirectCostCents = knownSubtotalCents === null || missingInputs.length > 0
    ? null
    : knownSubtotalCents
      + Number(input.taxCents)
      + Number(input.designCents)
      + Number(input.otherCostsCents)
      + (turnkey ? 0 : Number(input.bundlingCents) + Number(input.postOfficeDeliveryCents));

  const customerPriceCents = validOptionalCents(input.customerPriceCents) ? input.customerPriceCents : null;
  const contributionCents = completeDirectCostCents === null || customerPriceCents === null
    ? null
    : customerPriceCents - completeDirectCostCents;
  const contributionMarginBps = contributionCents === null || customerPriceCents === null || customerPriceCents <= 0
    ? null
    : Math.floor((contributionCents * 10_000) / customerPriceCents);

  return {
    printPriceCents,
    postageCents,
    turnkeyFulfillmentCents,
    bandingCents,
    knownSubtotalCents,
    completeDirectCostCents,
    contributionCents,
    contributionMarginBps,
    missingInputs,
    snapshotStale: supplierSnapshotIsStale(input.now),
    postageIncludedInTurnkey: turnkey,
  };
}
