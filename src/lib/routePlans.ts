import { createHash } from 'node:crypto';

export const ROUTE_PLAN_FRESHNESS_DAYS = 7;
export const ROUTE_PLAN_MAX_ROWS = 50;
export const ROUTE_PLAN_MAX_TOTAL_COUNT = 1_000_000;
export const ROUTE_PLAN_CAMPAIGN_COVERAGE_FLOOR_BPS = 9_000;

export const TERRITORY_STATUSES = ['planning', 'active', 'paused', 'retired'] as const;
export type TerritoryStatus = (typeof TERRITORY_STATUSES)[number];

export const ROUTE_PLAN_STATUSES = ['draft', 'verified', 'attached', 'retired'] as const;
export type RoutePlanStatus = (typeof ROUTE_PLAN_STATUSES)[number];

export const MAILING_METHODS = ['eddm_retail', 'eddm_bmeu', 'supplier_turnkey'] as const;
export type MailingMethod = (typeof MAILING_METHODS)[number];

export const AUDIENCE_MODES = ['residential_only', 'residential_and_business'] as const;
export type AudienceMode = (typeof AUDIENCE_MODES)[number];

export const ROUTE_PLAN_SOURCES = ['usps_eddm_tool', 'printing4supercheap_quote'] as const;
export type RoutePlanSource = (typeof ROUTE_PLAN_SOURCES)[number];

export const ROUTE_TYPES = ['city', 'rural_highway', 'po_box', 'other'] as const;
export type RouteType = (typeof ROUTE_TYPES)[number];

export interface RouteRowInput {
  zipCode: string;
  carrierRouteCode: string;
  city: string;
  routeType: RouteType;
  residentialCount: number;
  businessCount: number;
  poBoxCount: number;
}

export interface RouteRow extends RouteRowInput {
  totalCount: number;
}

export interface RoutePlanTotals {
  residentialCount: number;
  businessCount: number;
  poBoxCount: number;
  totalCount: number;
}

export interface DerivedRoutePlan {
  routes: RouteRow[];
  totals: RoutePlanTotals;
  plannedDeliveryCount: number;
}

export interface RoutePlanHashInput {
  territoryId: string;
  territorySlug: string;
  territoryName: string;
  campaignId: string | null;
  version: number;
  mailingMethod: MailingMethod;
  audienceMode: AudienceMode;
  source: RoutePlanSource;
  sourceUrl: string;
  sourceReference: string;
  sourceCheckedAt: string;
  routes: readonly RouteRowInput[];
}

export interface TerritoryAdminView {
  id: string;
  name: string;
  slug: string;
  state: string;
  county: string;
  candidateZipCodes: string[];
  candidateAreas: string[];
  status: TerritoryStatus;
  currentRoutePlanId: string | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoutePlanAdminView extends Omit<RoutePlanHashInput, 'routes'>, DerivedRoutePlan {
  id: string;
  status: RoutePlanStatus;
  sourceFresh: boolean;
  sourceRecheckedAt: string | null;
  effectiveSourceCheckedAt: string;
  sourceRecheckEvidenceReference: string | null;
  createdAt: string | null;
  verifiedAt: string | null;
  attachedAt: string | null;
  retiredAt: string | null;
}

export type RouteEvidenceFreshness = 'fresh' | 'stale' | 'future' | 'invalid';

export class RoutePlanValidationError extends Error {}

const CALIFORNIA_DATE_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function californiaDateKey(date: Date): string {
  const values = new Map(
    CALIFORNIA_DATE_FORMATTER
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`;
}

export function effectiveRouteEvidenceCheckedAt(record: Record<string, unknown>): string {
  const recheckedAt = typeof record.sourceRecheckedAt === 'string'
    ? record.sourceRecheckedAt.trim()
    : '';
  return recheckedAt || String(record.sourceCheckedAt || '');
}

export function storedRouteEvidenceFreshness(
  record: Record<string, unknown>,
  now: Date = new Date(),
): RouteEvidenceFreshness {
  return routeEvidenceFreshness(effectiveRouteEvidenceCheckedAt(record), now);
}

function dateKeyDayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) return null;
  return Math.floor(date.getTime() / 86_400_000);
}

function assertCount(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > ROUTE_PLAN_MAX_TOTAL_COUNT) {
    throw new RoutePlanValidationError(`${field} must be a nonnegative whole number.`);
  }
}

function safeAdd(total: number, value: number, label: string): number {
  const next = total + value;
  if (!Number.isSafeInteger(next) || next > ROUTE_PLAN_MAX_TOTAL_COUNT) {
    throw new RoutePlanValidationError(`${label} exceeds ${ROUTE_PLAN_MAX_TOTAL_COUNT.toLocaleString('en-US')}.`);
  }
  return next;
}

export function normalizeTerritorySlug(value: string): string {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  if (!slug) throw new RoutePlanValidationError('Territory slug must contain a letter or number.');
  return slug;
}

export function normalizeRouteRow(row: RouteRowInput): RouteRow {
  const zipCode = row.zipCode.trim();
  const carrierRouteCode = row.carrierRouteCode.trim().toUpperCase();
  const city = row.city.trim().replace(/\s+/g, ' ');
  if (!/^\d{5}$/.test(zipCode)) throw new RoutePlanValidationError('Every route requires a five-digit ZIP Code.');
  if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(carrierRouteCode)) {
    throw new RoutePlanValidationError('Every carrier-route code must use 2-12 letters, numbers, or hyphens.');
  }
  if (!city || city.length > 80) throw new RoutePlanValidationError('Every route requires a city of 80 characters or fewer.');
  if (!ROUTE_TYPES.includes(row.routeType)) throw new RoutePlanValidationError('Unsupported carrier-route type.');
  assertCount(row.residentialCount, 'Residential count');
  assertCount(row.businessCount, 'Business count');
  assertCount(row.poBoxCount, 'PO Box count');
  const totalCount = row.residentialCount + row.businessCount + row.poBoxCount;
  if (!Number.isSafeInteger(totalCount) || totalCount < 1 || totalCount > ROUTE_PLAN_MAX_TOTAL_COUNT) {
    throw new RoutePlanValidationError('Every carrier route must contain at least one and no more than 1,000,000 delivery points.');
  }
  return {
    zipCode,
    carrierRouteCode,
    city,
    routeType: row.routeType,
    residentialCount: row.residentialCount,
    businessCount: row.businessCount,
    poBoxCount: row.poBoxCount,
    totalCount,
  };
}

export function deriveRoutePlan(
  rows: readonly RouteRowInput[],
  audienceMode: AudienceMode,
): DerivedRoutePlan {
  if (!AUDIENCE_MODES.includes(audienceMode)) throw new RoutePlanValidationError('Unsupported audience mode.');
  if (rows.length < 1 || rows.length > ROUTE_PLAN_MAX_ROWS) {
    throw new RoutePlanValidationError(`Route plans require 1-${ROUTE_PLAN_MAX_ROWS} carrier routes.`);
  }

  const routes = rows.map(normalizeRouteRow);
  const duplicateKeys = new Set<string>();
  const totals: RoutePlanTotals = {
    residentialCount: 0,
    businessCount: 0,
    poBoxCount: 0,
    totalCount: 0,
  };
  for (const route of routes) {
    const duplicateKey = `${route.zipCode}:${route.carrierRouteCode}`;
    if (duplicateKeys.has(duplicateKey)) {
      throw new RoutePlanValidationError(`Duplicate carrier route ${route.zipCode} ${route.carrierRouteCode}.`);
    }
    duplicateKeys.add(duplicateKey);
    totals.residentialCount = safeAdd(totals.residentialCount, route.residentialCount, 'Residential total');
    totals.businessCount = safeAdd(totals.businessCount, route.businessCount, 'Business total');
    totals.poBoxCount = safeAdd(totals.poBoxCount, route.poBoxCount, 'PO Box total');
    totals.totalCount = safeAdd(totals.totalCount, route.totalCount, 'Delivery-point total');
  }

  const plannedDeliveryCount = audienceMode === 'residential_only'
    ? totals.residentialCount
    : totals.totalCount;
  if (plannedDeliveryCount < 1) {
    throw new RoutePlanValidationError('The selected routes contain no delivery points for the chosen audience mode.');
  }

  return { routes, totals, plannedDeliveryCount };
}

export function routeEvidenceFreshness(
  sourceCheckedAt: string,
  now: Date = new Date(),
): RouteEvidenceFreshness {
  if (!Number.isFinite(now.getTime())) return 'invalid';
  const sourceDay = dateKeyDayNumber(sourceCheckedAt);
  const currentDay = dateKeyDayNumber(californiaDateKey(now));
  if (sourceDay === null || currentDay === null) return 'invalid';
  const ageDays = currentDay - sourceDay;
  if (ageDays < 0) return 'future';
  return ageDays <= ROUTE_PLAN_FRESHNESS_DAYS ? 'fresh' : 'stale';
}

export function routeEvidenceValidThrough(sourceCheckedAt: string): string | null {
  const sourceDay = dateKeyDayNumber(sourceCheckedAt);
  if (sourceDay === null) return null;
  return new Date((sourceDay + ROUTE_PLAN_FRESHNESS_DAYS) * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function assertFreshRouteEvidence(sourceCheckedAt: string, now: Date = new Date()): void {
  const freshness = routeEvidenceFreshness(sourceCheckedAt, now);
  if (freshness === 'future') throw new RoutePlanValidationError('Route evidence date cannot be in the future.');
  if (freshness === 'stale') {
    throw new RoutePlanValidationError(
      `Route evidence must be rechecked under CaliforniaMailer's ${ROUTE_PLAN_FRESHNESS_DAYS}-day freshness policy.`,
    );
  }
  if (freshness === 'invalid') throw new RoutePlanValidationError('Route evidence date must use YYYY-MM-DD.');
}

export function approvedRouteSourceUrl(source: RoutePlanSource, rawUrl: string): string {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new RoutePlanValidationError('Route evidence requires a valid HTTPS source URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new RoutePlanValidationError('Route evidence requires a credential-free HTTPS source URL.');
  }
  const hostname = url.hostname.toLowerCase();
  const approved = source === 'usps_eddm_tool'
    ? hostname === 'usps.com' || hostname.endsWith('.usps.com')
    : hostname === 'printing4supercheap.com' || hostname.endsWith('.printing4supercheap.com');
  if (!approved) throw new RoutePlanValidationError('The source URL does not match the selected evidence provider.');
  return url.toString();
}

export function routePlanSourceLabel(source: RoutePlanSource): string {
  return source === 'usps_eddm_tool'
    ? 'USPS EDDM route selection'
    : 'Printing4SuperCheap quote';
}

export function routePlanContentHash(input: RoutePlanHashInput): string {
  const derived = deriveRoutePlan(input.routes, input.audienceMode);
  const canonical = {
    territoryId: input.territoryId,
    territorySlug: input.territorySlug,
    territoryName: input.territoryName,
    campaignId: input.campaignId,
    version: input.version,
    mailingMethod: input.mailingMethod,
    audienceMode: input.audienceMode,
    source: input.source,
    sourceUrl: approvedRouteSourceUrl(input.source, input.sourceUrl),
    sourceReference: input.sourceReference.trim(),
    sourceCheckedAt: input.sourceCheckedAt,
    routes: derived.routes,
    totals: derived.totals,
    plannedDeliveryCount: derived.plannedDeliveryCount,
  };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

function requiredString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== 'string' || !value) throw new RoutePlanValidationError(`Stored route plan has invalid ${key}.`);
  return value;
}

function timestampToIso(value: unknown): string | null {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  if (value && typeof value === 'object' && 'toDate' in value) {
    const toDate = (value as { toDate?: unknown }).toDate;
    if (typeof toDate === 'function') {
      const date = toDate.call(value) as Date;
      if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

export function routePlanHashInputFromRecord(record: Record<string, unknown>): RoutePlanHashInput {
  const campaignId = record.campaignId;
  if (campaignId !== null && campaignId !== undefined && typeof campaignId !== 'string') {
    throw new RoutePlanValidationError('Stored route plan has invalid campaignId.');
  }
  const version = record.version;
  if (!Number.isSafeInteger(version) || Number(version) < 1) {
    throw new RoutePlanValidationError('Stored route plan has invalid version.');
  }
  const mailingMethod = record.mailingMethod;
  const audienceMode = record.audienceMode;
  const source = record.source;
  if (!MAILING_METHODS.includes(mailingMethod as MailingMethod)) throw new RoutePlanValidationError('Stored route plan has invalid mailingMethod.');
  if (!AUDIENCE_MODES.includes(audienceMode as AudienceMode)) throw new RoutePlanValidationError('Stored route plan has invalid audienceMode.');
  if (!ROUTE_PLAN_SOURCES.includes(source as RoutePlanSource)) throw new RoutePlanValidationError('Stored route plan has invalid source.');
  if (!Array.isArray(record.routes)) throw new RoutePlanValidationError('Stored route plan has invalid routes.');
  const routes = record.routes.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new RoutePlanValidationError('Stored route plan contains an invalid route.');
    const row = raw as Record<string, unknown>;
    return {
      zipCode: requiredString(row, 'zipCode'),
      carrierRouteCode: requiredString(row, 'carrierRouteCode'),
      city: requiredString(row, 'city'),
      routeType: row.routeType as RouteType,
      residentialCount: Number(row.residentialCount),
      businessCount: Number(row.businessCount),
      poBoxCount: Number(row.poBoxCount),
    };
  });
  return {
    territoryId: requiredString(record, 'territoryId'),
    territorySlug: requiredString(record, 'territorySlug'),
    territoryName: requiredString(record, 'territoryName'),
    campaignId: typeof campaignId === 'string' ? campaignId : null,
    version: Number(version),
    mailingMethod: mailingMethod as MailingMethod,
    audienceMode: audienceMode as AudienceMode,
    source: source as RoutePlanSource,
    sourceUrl: requiredString(record, 'sourceUrl'),
    sourceReference: requiredString(record, 'sourceReference'),
    sourceCheckedAt: requiredString(record, 'sourceCheckedAt'),
    routes,
  };
}

export function assertStoredRoutePlanIntegrity(record: Record<string, unknown>): DerivedRoutePlan {
  const input = routePlanHashInputFromRecord(record);
  const derived = deriveRoutePlan(input.routes, input.audienceMode);
  const expectedHash = routePlanContentHash(input);
  if (record.contentHash !== expectedHash) throw new RoutePlanValidationError('Stored route-plan content hash does not match its immutable evidence.');
  if (Number(record.plannedDeliveryCount) !== derived.plannedDeliveryCount) {
    throw new RoutePlanValidationError('Stored route-plan delivery total does not match its route evidence.');
  }
  const storedTotals = record.totals;
  if (!storedTotals || typeof storedTotals !== 'object') throw new RoutePlanValidationError('Stored route plan has invalid totals.');
  for (const key of ['residentialCount', 'businessCount', 'poBoxCount', 'totalCount'] as const) {
    if (Number((storedTotals as Record<string, unknown>)[key]) !== derived.totals[key]) {
      throw new RoutePlanValidationError('Stored route-plan totals do not match its route evidence.');
    }
  }
  return derived;
}

export function territoryAdminView(id: string, record: Record<string, unknown>): TerritoryAdminView {
  const status = TERRITORY_STATUSES.includes(record.status as TerritoryStatus)
    ? record.status as TerritoryStatus
    : 'planning';
  return {
    id,
    name: String(record.name || ''),
    slug: String(record.slug || id),
    state: String(record.state || ''),
    county: String(record.county || ''),
    candidateZipCodes: Array.isArray(record.candidateZipCodes) ? record.candidateZipCodes.map(String) : [],
    candidateAreas: Array.isArray(record.candidateAreas) ? record.candidateAreas.map(String) : [],
    status,
    currentRoutePlanId: typeof record.currentRoutePlanId === 'string' ? record.currentRoutePlanId : null,
    version: Number.isSafeInteger(record.version) ? Number(record.version) : 1,
    createdAt: timestampToIso(record.createdAt),
    updatedAt: timestampToIso(record.updatedAt),
  };
}

export function routePlanAdminView(id: string, record: Record<string, unknown>): RoutePlanAdminView {
  const input = routePlanHashInputFromRecord(record);
  const derived = assertStoredRoutePlanIntegrity(record);
  const status = ROUTE_PLAN_STATUSES.includes(record.status as RoutePlanStatus)
    ? record.status as RoutePlanStatus
    : 'draft';
  const sourceRecheckedAt = typeof record.sourceRecheckedAt === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(record.sourceRecheckedAt)
    ? record.sourceRecheckedAt
    : null;
  const effectiveSourceCheckedAt = effectiveRouteEvidenceCheckedAt(record);
  return {
    id,
    ...input,
    ...derived,
    status,
    sourceFresh: routeEvidenceFreshness(effectiveSourceCheckedAt) === 'fresh',
    sourceRecheckedAt,
    effectiveSourceCheckedAt,
    sourceRecheckEvidenceReference: typeof record.sourceRecheckEvidenceReference === 'string'
      ? record.sourceRecheckEvidenceReference
      : null,
    createdAt: timestampToIso(record.createdAt),
    verifiedAt: timestampToIso(record.verifiedAt),
    attachedAt: timestampToIso(record.attachedAt),
    retiredAt: timestampToIso(record.retiredAt),
  };
}

export function selectedAreaLabels(
  routes: readonly Pick<RouteRow, 'city' | 'zipCode'>[],
  state: string,
): string[] {
  const labels = routes.map((route) => `${route.city}, ${state.toUpperCase()} ${route.zipCode}`);
  return [...new Set(labels)].sort((left, right) => left.localeCompare(right));
}
