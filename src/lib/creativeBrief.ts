export const CREATIVE_BRIEF_PENDING_STATUS = 'received_pending_owner_review' as const;
export const CREATIVE_BRIEF_REVIEWED_STATUS = 'owner_reviewed' as const;
export const CREATIVE_BRIEF_STATUS = CREATIVE_BRIEF_PENDING_STATUS;
export const PROOF_BRIEF_REVIEW_CONFIRMATION = 'I reviewed this exact creative brief' as const;
export const CREATIVE_BRIEF_TIME_ZONE = 'America/Los_Angeles' as const;
export const ASSET_RIGHTS_STATEMENT_VERSION = 'asset-rights-v1' as const;
export const ASSET_RIGHTS_STATEMENT =
  'I confirm that this business owns this asset, has permission to use it, or has verified it as public domain for this direct-mail campaign.' as const;

export const CREATIVE_BRIEF_LIMITS = {
  businessDisplayName: 160,
  phone: 40,
  website: 500,
  address: 320,
  brandColors: 240,
  brandGuidelines: 1_200,
  factualOffer: 600,
  callToAction: 160,
  qrDestination: 500,
  uniqueSellingProposition: 600,
  disclaimers: 1_200,
  evidenceNotes: 1_600,
} as const;

export const CREATIVE_ASSET_KINDS = ['logo', 'brand_image', 'prior_ad_reference'] as const;
export const ASSET_RIGHTS_BASES = [
  'business_owned',
  'licensed_for_this_use',
  'public_domain',
] as const;

export const ASSET_RIGHTS_LIMITS = {
  attestorName: 160,
  sourceOrLicenseNote: 1_000,
} as const;

export type CreativeAssetKind = (typeof CREATIVE_ASSET_KINDS)[number];
export type AssetRightsBasis = (typeof ASSET_RIGHTS_BASES)[number];
export type CreativeBriefStatus =
  | typeof CREATIVE_BRIEF_PENDING_STATUS
  | typeof CREATIVE_BRIEF_REVIEWED_STATUS;

export interface MaterialManifestPointer {
  materialId: string;
  version: number;
}

export type MaterialManifest = Partial<Record<CreativeAssetKind, MaterialManifestPointer>>;

export interface CreativeBriefContent {
  businessDisplayName: string;
  phone: string;
  displayPhone: boolean;
  website: string;
  displayWebsite: boolean;
  address: string;
  displayAddress: boolean;
  brandColors: string;
  brandGuidelines: string;
  factualOffer: string;
  callToAction: string;
  effectiveOn: string;
  expiresOn: string;
  qrDestination: string;
  uniqueSellingProposition: string;
  disclaimers: string;
  evidenceNotes: string;
}

export interface CreativeBriefDeliveryWindow {
  startDate: string | null;
  endDate: string | null;
}

export type CreativeBriefDeliveryValidationStatus =
  | 'campaign_schedule_not_set'
  | 'validated_for_partial_planned_window'
  | 'validated_for_planned_window';

export interface AssetRightsAttestationInput {
  assetKind: CreativeAssetKind;
  rightsBasis: AssetRightsBasis;
  attestorName: string;
  sourceOrLicenseNote: string;
  rightsAttested: true;
}

export const EMPTY_CREATIVE_BRIEF: CreativeBriefContent = {
  businessDisplayName: '',
  phone: '',
  displayPhone: false,
  website: '',
  displayWebsite: false,
  address: '',
  displayAddress: false,
  brandColors: '',
  brandGuidelines: '',
  factualOffer: '',
  callToAction: '',
  effectiveOn: '',
  expiresOn: '',
  qrDestination: '',
  uniqueSellingProposition: '',
  disclaimers: '',
  evidenceNotes: '',
};

const CONTENT_KEYS = Object.keys(EMPTY_CREATIVE_BRIEF) as Array<keyof CreativeBriefContent>;
const BOOLEAN_KEYS = new Set<keyof CreativeBriefContent>([
  'displayPhone',
  'displayWebsite',
  'displayAddress',
]);
const MULTILINE_KEYS = new Set<keyof CreativeBriefContent>([
  'address',
  'brandGuidelines',
  'factualOffer',
  'uniqueSellingProposition',
  'disclaimers',
  'evidenceNotes',
]);

function normalizeText(value: string, multiline = false) {
  const normalized = value.normalize('NFKC').replace(
    multiline ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g,
    ' ',
  );
  return multiline
    ? normalized.replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : normalized.replace(/\s+/g, ' ').trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isCreativeBriefStatus(value: unknown): value is CreativeBriefStatus {
  return value === CREATIVE_BRIEF_PENDING_STATUS || value === CREATIVE_BRIEF_REVIEWED_STATUS;
}

export function parseMaterialManifest(value: unknown): MaterialManifest | null {
  if (!isPlainRecord(value)) return null;
  const keys = Object.keys(value);
  if (
    keys.length === 0
    || keys.some((key) => !CREATIVE_ASSET_KINDS.includes(key as CreativeAssetKind))
  ) {
    return null;
  }
  const manifest: MaterialManifest = {};
  for (const key of keys as CreativeAssetKind[]) {
    const pointer = value[key];
    if (!isPlainRecord(pointer)) return null;
    if (
      Object.keys(pointer).length !== 2
      || typeof pointer.materialId !== 'string'
      || !/^[A-Za-z0-9_-]{1,150}$/.test(pointer.materialId)
      || !Number.isSafeInteger(pointer.version)
      || Number(pointer.version) < 1
    ) {
      return null;
    }
    manifest[key] = {
      materialId: pointer.materialId,
      version: Number(pointer.version),
    };
  }
  return manifest;
}

export function sortedMaterialManifestEntries(manifest: MaterialManifest) {
  return Object.entries(manifest)
    .map(([assetKind, pointer]) => ({
      assetKind: assetKind as CreativeAssetKind,
      materialId: pointer!.materialId,
      version: pointer!.version,
    }))
    .sort((left, right) => left.assetKind.localeCompare(right.assetKind));
}

export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function isSafeHttpsUrl(value: string) {
  try {
    const parsed = new URL(value);
    const hostname = parsed.hostname.toLowerCase();
    const looksLikeIpv4 = /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname);
    const looksLikeIpv6 = hostname.includes(':');
    const privateName = hostname === 'localhost'
      || hostname.endsWith('.localhost')
      || hostname.endsWith('.local')
      || hostname.endsWith('.internal');
    return parsed.protocol === 'https:'
      && Boolean(parsed.hostname)
      && hostname.includes('.')
      && !looksLikeIpv4
      && !looksLikeIpv6
      && !privateName
      && !parsed.username
      && !parsed.password;
  } catch {
    return false;
  }
}

export function parseCreativeBriefContent(value: unknown): CreativeBriefContent | null {
  if (!isPlainRecord(value)) return null;
  if (Object.keys(value).length !== CONTENT_KEYS.length) return null;
  if (Object.keys(value).some((key) => !CONTENT_KEYS.includes(key as keyof CreativeBriefContent))) {
    return null;
  }

  const parsed = { ...EMPTY_CREATIVE_BRIEF };
  for (const key of CONTENT_KEYS) {
    const candidate = value[key];
    if (BOOLEAN_KEYS.has(key)) {
      if (typeof candidate !== 'boolean') return null;
      (parsed[key] as boolean) = candidate;
      continue;
    }
    if (typeof candidate !== 'string') return null;
    const limit = key === 'effectiveOn' || key === 'expiresOn'
      ? 10
      : CREATIVE_BRIEF_LIMITS[key as keyof typeof CREATIVE_BRIEF_LIMITS];
    if (!limit || candidate.length > limit) return null;
    const normalized = normalizeText(candidate, MULTILINE_KEYS.has(key));
    if (normalized.length > limit) return null;
    (parsed[key] as string) = normalized;
  }
  return parsed;
}

export function creativeBriefErrors(
  brief: CreativeBriefContent,
  deliveryWindow: CreativeBriefDeliveryWindow,
) {
  const errors: string[] = [];
  if (!brief.businessDisplayName) errors.push('Business display name is required.');
  if (!brief.factualOffer) errors.push('A factual offer is required.');
  if (!brief.callToAction) errors.push('A call to action is required.');
  if (brief.displayPhone && !brief.phone) errors.push('Enter a phone number or turn off phone display.');
  if (brief.displayWebsite && !brief.website) errors.push('Enter a website or turn off website display.');
  if (brief.displayAddress && !brief.address) errors.push('Enter an address or turn off address display.');
  if (brief.effectiveOn && !isCalendarDate(brief.effectiveOn)) {
    errors.push('The offer effective date must be a real YYYY-MM-DD calendar date.');
  }
  if (brief.expiresOn && !isCalendarDate(brief.expiresOn)) {
    errors.push('The offer expiration date must be a real YYYY-MM-DD calendar date.');
  }
  if (brief.effectiveOn && brief.expiresOn && brief.effectiveOn > brief.expiresOn) {
    errors.push('The offer effective date cannot be after its expiration date.');
  }
  if (brief.qrDestination && !isSafeHttpsUrl(brief.qrDestination)) {
    errors.push('The QR destination must be a credential-free HTTPS URL.');
  }
  if (deliveryWindow.startDate) {
    if (!brief.effectiveOn) {
      errors.push('An offer effective date is required for the planned delivery window.');
    } else if (brief.effectiveOn > deliveryWindow.startDate) {
      errors.push('The offer must be effective on or before planned delivery begins.');
    }
  }
  if (deliveryWindow.endDate) {
    if (!brief.expiresOn) {
      errors.push('An offer expiration date is required for the planned delivery window.');
    } else if (brief.expiresOn < deliveryWindow.endDate) {
      errors.push('The offer must remain valid through planned delivery.');
    }
  }
  return errors;
}

export function creativeBriefDeliveryValidationStatus(
  deliveryWindow: CreativeBriefDeliveryWindow,
): CreativeBriefDeliveryValidationStatus {
  if (deliveryWindow.startDate && deliveryWindow.endDate) return 'validated_for_planned_window';
  if (deliveryWindow.startDate || deliveryWindow.endDate) return 'validated_for_partial_planned_window';
  return 'campaign_schedule_not_set';
}

export function parseAssetRightsAttestation(value: unknown): AssetRightsAttestationInput | null {
  if (!isPlainRecord(value)) return null;
  const allowed = ['assetKind', 'rightsBasis', 'attestorName', 'sourceOrLicenseNote', 'rightsAttested'];
  if (Object.keys(value).length !== allowed.length || Object.keys(value).some((key) => !allowed.includes(key))) {
    return null;
  }
  if (!CREATIVE_ASSET_KINDS.includes(value.assetKind as CreativeAssetKind)) return null;
  if (!ASSET_RIGHTS_BASES.includes(value.rightsBasis as AssetRightsBasis)) return null;
  if (
    typeof value.attestorName !== 'string'
    || value.attestorName.length > ASSET_RIGHTS_LIMITS.attestorName
  ) return null;
  if (
    typeof value.sourceOrLicenseNote !== 'string'
    || value.sourceOrLicenseNote.length > ASSET_RIGHTS_LIMITS.sourceOrLicenseNote
  ) return null;
  if (value.rightsAttested !== true) return null;
  const attestorName = normalizeText(value.attestorName);
  const sourceOrLicenseNote = normalizeText(value.sourceOrLicenseNote, true);
  if (
    attestorName.length > ASSET_RIGHTS_LIMITS.attestorName
    || sourceOrLicenseNote.length > ASSET_RIGHTS_LIMITS.sourceOrLicenseNote
  ) return null;
  if (attestorName.length < 2) return null;
  if (value.rightsBasis !== 'business_owned' && sourceOrLicenseNote.length < 3) return null;
  return {
    assetKind: value.assetKind as CreativeAssetKind,
    rightsBasis: value.rightsBasis as AssetRightsBasis,
    attestorName,
    sourceOrLicenseNote,
    rightsAttested: true,
  };
}
