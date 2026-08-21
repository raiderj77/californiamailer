export type QuoteServiceType = 'coop' | 'shared_model' | 'mini_coop' | 'eddm' | 'solo' | 'pizza_box';
export type MailingMethod = 'shared_coop' | 'eddm_saturation' | 'addressed_targeted';
export type EddmFulfillment = 'print_only' | 'turnkey';

export const PRINTING4SUPERCHEAP = {
  id: 'printing4supercheap',
  name: 'Printing4SuperCheap',
  productUrl: 'https://www.printing4supercheap.com/store/product-view.html/48-Every-Door-Direct-Mail',
  discountSheetUrl: 'https://docs.google.com/spreadsheets/d/1y9xPkUy1xs6yOVj-bkOjM1apvZNMxm8CEnG6j1Y1Ynk/edit?gid=0#gid=0',
  priceObservedAt: '2026-08-18',
  priceValidThrough: null,
  recheckAfterDays: 30,
} as const;

export const USPS_EDDM_RETAIL = {
  rateMillsPerPiece: 260,
  effectiveDate: '2026-07-12',
  observedAt: '2026-08-18',
  maximumWeightOunces: 3.3,
  minimumPieces: 200,
  maximumPiecesPerDayPerZip: 5_000,
  sourceUrl: 'https://pe.usps.com/resources/PriceChange/July%202026%20Price%20Change%20-%20Notice123%20PDF%20-%207.2.26.pdf',
} as const;

export const USPS_EDDM_BMEU = {
  effectiveDate: USPS_EDDM_RETAIL.effectiveDate,
  observedAt: USPS_EDDM_RETAIL.observedAt,
  sourceUrl: USPS_EDDM_RETAIL.sourceUrl,
  rates: [
    { id: 'origin', label: 'BMEU origin entry', rateMillsPerPiece: 309 },
    { id: 'dscf_lpc', label: 'BMEU destination SCF / LPC entry', rateMillsPerPiece: 268 },
    { id: 'ddu_sdc', label: 'BMEU destination delivery unit / S&DC entry', rateMillsPerPiece: 259 },
  ],
  permitImprintApplicationFeeCents: 39_000,
  annualMailingFeeCents: 39_000,
  feeApplicabilityRequiresVerification: true,
} as const;

export const TURNKEY_EDDM = {
  rateMillsPerPiece: 330,
  bandingCentsPerThousand: 500,
  postageIncluded: true,
  preparationIncluded: true,
  directPostOfficeShippingIncluded: true,
  trackingIncluded: true,
  printPhotosIncluded: true,
  sourceUrl: PRINTING4SUPERCHEAP.discountSheetUrl,
  observedAt: PRINTING4SUPERCHEAP.priceObservedAt,
} as const;

export interface MailPieceOption {
  id: string;
  label: string;
  widthInches: number;
  heightInches: number;
  mailingMethod: MailingMethod;
  stock: string | null;
  finish: string | null;
  supplierPriceSnapshot: boolean;
  source: 'discount_sheet' | 'supplier_catalog' | 'course_common_size';
}

export const EDDM_MAIL_PIECES: readonly MailPieceOption[] = [
  { id: 'eddm-6-25x9-14pt', label: '6.25 × 9 in · 14 pt', widthInches: 6.25, heightInches: 9, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-6-5x9-14pt', label: '6.5 × 9 in · 14 pt', widthInches: 6.5, heightInches: 9, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-6x11-14pt', label: '6 × 11 in · 14 pt', widthInches: 6, heightInches: 11, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-6-5x12-14pt', label: '6.5 × 12 in · 14 pt', widthInches: 6.5, heightInches: 12, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-8-5x11-14pt', label: '8.5 × 11 in · 14 pt', widthInches: 8.5, heightInches: 11, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-9x12-14pt', label: '9 × 12 in · 14 pt', widthInches: 9, heightInches: 12, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-12x15-14pt', label: '12 × 15 in · 14 pt', widthInches: 12, heightInches: 15, mailingMethod: 'eddm_saturation', stock: '14 pt cardstock', finish: 'Full color both sides, UV gloss', supplierPriceSnapshot: true, source: 'discount_sheet' },
  { id: 'eddm-8-5x11-10pt', label: '8.5 × 11 in · 100 lb cover · supplier quote', widthInches: 8.5, heightInches: 11, mailingMethod: 'eddm_saturation', stock: '100 lb gloss cover', finish: 'Supplier-selected coating', supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-9x12-10pt', label: '9 × 12 in · 100 lb cover · supplier quote', widthInches: 9, heightInches: 12, mailingMethod: 'eddm_saturation', stock: '100 lb gloss cover', finish: 'Supplier-selected coating', supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-4-5x12-catalog', label: '4.5 × 12 in · supplier quote', widthInches: 4.5, heightInches: 12, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-6x12-catalog', label: '6 × 12 in · supplier quote', widthInches: 6, heightInches: 12, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-6-5x8-catalog', label: '6.5 × 8 in · supplier quote', widthInches: 6.5, heightInches: 8, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-7x8-5-catalog', label: '7 × 8.5 in · supplier quote', widthInches: 7, heightInches: 8.5, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-8x10-catalog', label: '8 × 10 in · supplier quote', widthInches: 8, heightInches: 10, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-8-5x14-catalog', label: '8.5 × 14 in · supplier quote', widthInches: 8.5, heightInches: 14, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
  { id: 'eddm-9x11-catalog', label: '9 × 11 in · supplier quote', widthInches: 9, heightInches: 11, mailingMethod: 'eddm_saturation', stock: null, finish: null, supplierPriceSnapshot: false, source: 'supplier_catalog' },
] as const;

export const TARGETED_MAIL_PIECES: readonly MailPieceOption[] = [
  { id: 'solo-4x6', label: '4 × 6 in addressed postcard', widthInches: 4, heightInches: 6, mailingMethod: 'addressed_targeted', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
  { id: 'solo-5x7', label: '5 × 7 in addressed postcard', widthInches: 5, heightInches: 7, mailingMethod: 'addressed_targeted', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
  { id: 'solo-5-5x8-5', label: '5.5 × 8.5 in addressed postcard', widthInches: 5.5, heightInches: 8.5, mailingMethod: 'addressed_targeted', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
  { id: 'solo-6x9', label: '6 × 9 in addressed postcard', widthInches: 6, heightInches: 9, mailingMethod: 'addressed_targeted', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
  { id: 'solo-6x11', label: '6 × 11 in addressed postcard', widthInches: 6, heightInches: 11, mailingMethod: 'addressed_targeted', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
] as const;

export const MINI_COOP_MAIL_PIECES: readonly MailPieceOption[] = [
  { id: 'mini-coop-6x11', label: '6 × 11 in small shared mailer', widthInches: 6, heightInches: 11, mailingMethod: 'shared_coop', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
  { id: 'mini-coop-6-5x12', label: '6.5 × 12 in small shared mailer', widthInches: 6.5, heightInches: 12, mailingMethod: 'shared_coop', stock: null, finish: null, supplierPriceSnapshot: false, source: 'course_common_size' },
] as const;

export const EDDM_QUANTITY_TIERS = [250, 500, 750, 1_000, 1_500, 2_000, 2_500, 3_000, 4_000, 5_000, 7_500, 10_000, 15_000, 20_000] as const;

export const SERVICE_OPTIONS: ReadonlyArray<{ id: QuoteServiceType; label: string; description: string }> = [
  { id: 'coop', label: 'Founding 9 × 12 shared mailer', description: 'One protected category unit in the active experimental 24-unit, 5,000-piece planning model.' },
  { id: 'shared_model', label: 'Another shared-mailer model', description: 'Compare 9 × 12, 12 × 15, M6/M7–M9, M3, community, new-mover, and directory concepts without borrowing prices across formats.' },
  { id: 'mini_coop', label: 'Small partner mailer', description: 'A smaller shared piece for a few complementary, noncompeting businesses; quoted as a separate project.' },
  { id: 'eddm', label: 'Single-business EDDM mailer', description: 'One business owns the whole saturation mail piece; route, size, and fulfillment are quoted.' },
  { id: 'solo', label: 'Targeted solo postcard', description: 'One business mails to a defined addressed audience rather than every address on a route.' },
  { id: 'pizza_box', label: 'Pizza-box coupon or community flyer', description: 'Printing4SuperCheap prints the piece; a documented California restaurant partner distributes it. This is not USPS mail.' },
];

export const DISCOUNT_PRINT_PRICES_CENTS: Readonly<Record<string, Readonly<Record<number, number>>>> = {
  'eddm-6-25x9-14pt': { 250: 16_000, 500: 18_900, 1_000: 20_200, 2_500: 38_700, 5_000: 58_700, 7_500: 82_300, 10_000: 110_900, 15_000: 165_300, 20_000: 220_400 },
  'eddm-6-5x9-14pt': { 250: 17_000, 500: 20_600, 750: 21_500, 1_000: 24_900, 1_500: 32_300, 2_000: 35_500, 2_500: 42_600, 3_000: 51_600, 4_000: 53_100, 5_000: 63_400, 7_500: 103_800, 10_000: 109_100, 15_000: 145_900, 20_000: 211_800 },
  'eddm-6x11-14pt': { 250: 18_500, 500: 22_900, 750: 23_800, 1_000: 26_100, 1_500: 39_400, 2_000: 45_400, 2_500: 53_300, 3_000: 61_900, 4_000: 68_000, 5_000: 73_600, 7_500: 116_400, 10_000: 149_100, 15_000: 209_300, 20_000: 279_000 },
  'eddm-6-5x12-14pt': { 250: 21_500, 500: 24_900, 750: 26_100, 1_000: 28_100, 1_500: 44_000, 2_000: 51_100, 2_500: 55_900, 3_000: 62_800, 4_000: 69_500, 5_000: 83_000, 7_500: 130_200, 10_000: 158_300, 15_000: 227_500, 20_000: 303_300 },
  'eddm-8-5x11-14pt': { 250: 23_400, 500: 28_500, 750: 37_500, 1_000: 42_100, 1_500: 56_600, 2_000: 58_300, 2_500: 61_000, 3_000: 76_000, 4_000: 82_400, 5_000: 99_600, 7_500: 158_000, 10_000: 203_100, 15_000: 307_900, 20_000: 410_500 },
  'eddm-9x12-14pt': { 250: 26_700, 500: 31_400, 750: 38_400, 1_000: 40_800, 1_500: 62_300, 2_000: 71_500, 2_500: 75_900, 3_000: 87_500, 4_000: 92_100, 5_000: 120_900, 7_500: 181_300, 10_000: 229_900, 15_000: 338_400, 20_000: 451_200 },
  'eddm-12x15-14pt': { 500: 69_100, 1_000: 84_000, 2_000: 116_700, 2_500: 128_100, 3_000: 157_300, 4_000: 195_400, 5_000: 217_000, 10_000: 404_200, 15_000: 472_600, 20_000: 619_100 },
};

export function mailPieceForQuote(serviceType: QuoteServiceType, specificationId: string): MailPieceOption | null {
  const options = serviceType === 'eddm'
    ? EDDM_MAIL_PIECES
    : serviceType === 'solo'
      ? TARGETED_MAIL_PIECES
      : serviceType === 'mini_coop'
        ? MINI_COOP_MAIL_PIECES
        : [];
  return options.find((option) => option.id === specificationId) ?? null;
}
