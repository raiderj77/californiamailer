import type { Prospect } from './firestore';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import {
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
} from '@/lib/prospectIdentity';
import { enforceStickySuppression, isRecordSuppressed } from '@/lib/suppression';

export { normalizeBusinessName, normalizeEmail, normalizePhone, normalizeWebsite } from '@/lib/prospectIdentity';

export const prospectStatuses = [
  'new',
  'researching',
  'ready_to_contact',
  'contacted',
  'follow_up_needed',
  'interested',
  'not_interested',
  'no_response',
  'poor_fit',
  'do_not_contact',
  'renewal_opportunity',
] as const;

// These values can exist on pre-canonical prospect records, but they were
// entered by an owner in a browser and are not reservation or payment proof.
// Keep them readable for migration/review without offering them as workflow
// controls.
export const legacyOperationalProspectStatuses = [
  'reservation_sent',
  'reserved',
  'awaiting_payment',
  'paid',
] as const;

export const prospectFilterStatuses = [
  ...prospectStatuses,
  ...legacyOperationalProspectStatuses,
] as const;

export type CurrentProspectStatus = (typeof prospectStatuses)[number];

export const contactQueueStatuses = new Set<Prospect['status']>([
  'ready_to_contact',
  'follow_up_needed',
  'renewal_opportunity',
]);

const inactiveStatuses = new Set<Prospect['status']>([
  'not_interested',
  'poor_fit',
  'do_not_contact',
  'lost',
]);

export function duplicateReasons(existing: Prospect[], candidate: Partial<Prospect>, ignoredId?: string) {
  const name = normalizeBusinessName(candidate.businessName);
  const email = normalizeEmail(candidate.email);
  const website = normalizeWebsite(candidate.website);
  const phone = normalizePhone(candidate.phone);
  const reasons = new Set<string>();

  for (const item of existing) {
    if (item.id === ignoredId) continue;
    if (name && normalizeBusinessName(item.businessName) === name) reasons.add('business name');
    if (email && normalizeEmail(item.email) === email) reasons.add('email');
    if (website && normalizeWebsite(item.website) === website) reasons.add('website');
    if (phone && normalizePhone(item.phone) === phone) reasons.add('phone');
  }
  return [...reasons];
}

export function contactGate(prospect: Partial<Prospect>) {
  const missing: string[] = [];
  if (isProspectSuppressed(prospect)) missing.push('do-not-contact suppression');
  if (prospect.qualificationStatus !== 'qualified') missing.push('qualified decision');
  if (!prospect.activeAdvertisingEvidence?.trim()) missing.push('observable-need evidence');
  if (!prospect.officialSource?.trim()) missing.push('official source');
  if (!prospect.officialSourceCheckedAt?.trim()) missing.push('source check date');
  if (!prospect.website?.trim()) missing.push('official website');
  if (!prospect.contactName?.trim()) missing.push('decision maker');
  if (!prospect.contactRole?.trim()) missing.push('contact role');
  if (!prospect.email?.trim()) missing.push('public business email');
  if (!prospect.businessCategory?.trim()) missing.push('campaign category');
  if (!prospect.serviceArea?.trim()) missing.push('service area');
  if (!prospect.mailingTerritoryFit?.trim()) missing.push('territory fit');
  if (!prospect.campaignId?.trim()) missing.push('campaign');
  return { allowed: missing.length === 0, missing };
}

export function categoryConflict(existing: Prospect[], candidate: Partial<Prospect>, ignoredId?: string) {
  const category = resolveCategorySlug(candidate.businessCategory);
  const campaignId = candidate.campaignId?.trim().toLowerCase();
  if (!category || !campaignId) return [];
  const configured = FOUNDING_CAMPAIGN.categories.find((item) => item.slug === category);
  const conflictingSlugs = new Set([
    category,
    ...(configured?.conflictsWith || []),
    ...FOUNDING_CAMPAIGN.categories
      .filter((item) => (item.conflictsWith as readonly string[]).includes(category))
      .map((item) => item.slug),
  ]);
  return existing.filter((item) =>
    item.id !== ignoredId
    && !inactiveStatuses.has(item.status)
    && conflictingSlugs.has(resolveCategorySlug(item.businessCategory) || '')
    && item.campaignId?.trim().toLowerCase() === campaignId,
  );
}

function resolveCategorySlug(value?: string) {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || '';
  return FOUNDING_CAMPAIGN.categories.find((item) =>
    item.slug === normalized || item.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') === normalized,
  )?.slug || normalized || null;
}

export function isCurrentProspectStatus(value: string): value is CurrentProspectStatus {
  return prospectStatuses.includes(value as CurrentProspectStatus);
}

export function isProspectSuppressed(prospect: Partial<Prospect>) {
  return isRecordSuppressed(prospect);
}

export function canonicalizeProspectSuppression<T extends Partial<Prospect>>(prospect: T): T {
  return enforceStickySuppression(prospect);
}

export function isLegacyOperationalProspectStatus(value: string | undefined) {
  return legacyOperationalProspectStatuses.includes(
    value as (typeof legacyOperationalProspectStatuses)[number],
  );
}
