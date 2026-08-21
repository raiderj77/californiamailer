import type { CampaignStatus } from '@/config/foundingCampaign';

export type PlacementSize = 'standard';
export type ReservationStatus =
  | 'interested'
  | 'hold'
  | 'awaiting_payment'
  | 'paid'
  | 'expired'
  | 'cancelled'
  | 'refunded'
  | 'disputed'
  | 'payment_review';

export type PaymentStatus =
  | 'pending'
  | 'cleared'
  | 'failed'
  | 'cancelled'
  | 'partially_refunded'
  | 'refunded'
  | 'disputed'
  | 'manual_review';

export type ProofStatus =
  | 'waiting_for_materials'
  | 'drafting'
  | 'proof_sent'
  | 'revision_requested'
  | 'resubmitted'
  | 'approved'
  | 'locked_for_print';

export interface CampaignCategory {
  slug: string;
  name: string;
  parentCategory: string | null;
  conflictsWith: string[];
  sensitive: boolean;
  maximumAdvertisers: number;
}

export interface PlacementInventory {
  total: number;
  available: number;
  held: number;
  sold: number;
  priceCents: number;
}

export type PublicPlacementInventory = Omit<PlacementInventory, 'priceCents'>;

export interface PublicCampaign {
  id: string;
  planId: string;
  offerModelVersion: string;
  slug: string;
  title: string;
  territory: string;
  status: CampaignStatus;
  targetHouseholds: number;
  verifiedHouseholds: number | null;
  householdCountBasis: string | null;
  selectedAreas: string[];
  routesConfirmed: boolean;
  routePlanVersion: number | null;
  routePlanSourceCheckedAt: string | null;
  routePlanEvidenceValidThrough: string | null;
  plannedDeliveryStart: string | null;
  plannedDeliveryEnd: string | null;
  reservationDeadline: string | null;
  placements: Partial<Record<PlacementSize, PublicPlacementInventory>>;
  categories: Array<{
    slug: string;
    name: string;
    status: 'available' | 'held' | 'sold' | 'paused';
    sensitive: boolean;
  }>;
  fundingGoalCents: null;
  clearedFundingCents: number;
  reservedFundingCents: number;
  minimumAdvertisers: number;
  minimumPaidPlacements: number;
  currentAdvertiserCount: number;
  currentPaidPlacementCount: number;
  refundSummary: string;
  inclusions: string[];
  campaignNotes: string[];
  published: boolean;
  updatedAt?: unknown;
}

export interface CampaignPayment {
  id?: string;
  campaignId: string;
  reservationId: string;
  planId?: string;
  offerModelVersion?: string;
  provider: 'stripe';
  externalSessionId?: string;
  externalPaymentId?: string;
  amountCents: number;
  refundedCents: number;
  status: PaymentStatus;
  clearedAt?: string | null;
}

export interface CampaignReservation {
  id?: string;
  publicReference: string;
  accessTokenHash: string;
  campaignId: string;
  planId: string;
  offerModelVersion: string;
  categorySlug: string;
  placementSize: PlacementSize;
  businessName: string;
  contactName: string;
  email: string;
  phone?: string;
  website?: string;
  advertisedOffer: string;
  quotedPriceCents: number;
  status: ReservationStatus;
  holdExpiresAt?: string | null;
  termsVersion: string;
  fundingPolicyVersion: string;
  termsAcceptedAt: string;
  refundPolicyAcceptedAt: string;
  proofAcknowledgedAt: string;
  createdAt: string;
}

export interface CampaignCosts {
  supplierId: 'printing4supercheap' | null;
  mailPieceCount: number | null;
  printingCostCents: number | null;
  postageCostCents: number | null;
  shippingCostCents: number | null;
  taxCostCents: number | null;
  designCostCents: number | null;
  ownerLaborCostCents: number | null;
  processingFeeCents: number | null;
  refundReserveCents: number | null;
  reprintReserveCents: number | null;
  softwareAllocationCents: number | null;
  otherExpensesCents: number | null;
  targetOwnerSurplusCents: number | null;
  printerQuoteReference: string | null;
  quoteVerifiedAt: string | null;
  version: number;
}
