export interface ProspectIdentityLike {
  businessName?: unknown;
  business?: unknown;
  email?: unknown;
  phone?: unknown;
  website?: unknown;
  normalizedBusinessName?: unknown;
  normalizedEmail?: unknown;
  normalizedPhone?: unknown;
  normalizedWebsite?: unknown;
}

export interface NormalizedProspectIdentity {
  businessName: string;
  email: string;
  phone: string;
  website: string;
}

export type ProspectIdentityQueryField =
  | 'normalizedEmail'
  | 'normalizedPhone'
  | 'normalizedWebsite'
  | 'normalizedBusinessName';

export interface ProspectIdentityQuerySpec {
  field: ProspectIdentityQueryField;
  value: string;
  highConfidence: boolean;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function normalizeBusinessName(value: unknown = ''): string {
  return text(value)
    .normalize('NFKD')
    .toLowerCase()
    .replace(/\b(incorporated|corporation|company|limited|inc|corp|co|llc|ltd)\.?\b/g, '')
    .replace(/[^a-z0-9]/g, '');
}

export function normalizeEmail(value: unknown = ''): string {
  return text(value).toLowerCase();
}

export function normalizePhone(value: unknown = ''): string {
  const digits = text(value).replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

export function normalizeWebsite(value: unknown = ''): string {
  const candidate = text(value);
  if (!candidate) return '';
  try {
    const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(candidate) ? candidate : `https://${candidate}`);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return '';
  }
}

export function normalizeProspectIdentity(input: ProspectIdentityLike): NormalizedProspectIdentity {
  return {
    businessName: normalizeBusinessName(text(input.businessName) || text(input.business)),
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    website: normalizeWebsite(input.website),
  };
}

export function normalizedProspectIdentityFields(input: ProspectIdentityLike) {
  const identity = normalizeProspectIdentity(input);
  return {
    normalizedBusinessName: identity.businessName,
    normalizedEmail: identity.email,
    normalizedWebsite: identity.website,
    normalizedPhone: identity.phone,
  };
}

function usableEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function usableWebsite(value: string): boolean {
  return value.includes('.');
}

export function hasHighConfidenceProspectIdentity(input: ProspectIdentityLike): boolean {
  const identity = normalizeProspectIdentity(input);
  return usableEmail(identity.email) || Boolean(identity.phone) || usableWebsite(identity.website);
}

function normalizedValues(
  input: ProspectIdentityLike,
  rawKey: 'businessName' | 'business' | 'email' | 'phone' | 'website',
  storedKey: 'normalizedBusinessName' | 'normalizedEmail' | 'normalizedPhone' | 'normalizedWebsite',
  normalizer: (value: unknown) => string,
): Set<string> {
  return new Set([
    normalizer(input[rawKey]),
    normalizer(input[storedKey]),
  ].filter(Boolean));
}

export function highConfidenceProspectIdentityMatches(
  candidateInput: ProspectIdentityLike,
  existing: ProspectIdentityLike,
): Array<'email' | 'phone' | 'website'> {
  const candidate = normalizeProspectIdentity(candidateInput);
  const matches: Array<'email' | 'phone' | 'website'> = [];
  if (
    usableEmail(candidate.email)
    && normalizedValues(existing, 'email', 'normalizedEmail', normalizeEmail).has(candidate.email)
  ) matches.push('email');
  if (
    candidate.phone
    && normalizedValues(existing, 'phone', 'normalizedPhone', normalizePhone).has(candidate.phone)
  ) matches.push('phone');
  if (
    usableWebsite(candidate.website)
    && normalizedValues(existing, 'website', 'normalizedWebsite', normalizeWebsite).has(candidate.website)
  ) matches.push('website');
  return matches;
}

export function prospectBusinessIdentityCorroborates(
  candidateInput: ProspectIdentityLike,
  existing: ProspectIdentityLike,
): boolean {
  const candidate = normalizeProspectIdentity(candidateInput);
  if (!candidate.businessName) return false;
  const values = new Set([
    normalizeBusinessName(existing.businessName),
    normalizeBusinessName(existing.business),
    normalizeBusinessName(existing.normalizedBusinessName),
  ].filter(Boolean));
  return values.has(candidate.businessName);
}

function legacyWebsiteValue(value: unknown): string {
  return text(value).toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function legacyBusinessValue(input: ProspectIdentityLike): string {
  return (text(input.businessName) || text(input.business)).toLowerCase();
}

export function prospectIdentityQuerySpecs(input: ProspectIdentityLike): ProspectIdentityQuerySpec[] {
  const identity = normalizeProspectIdentity(input);
  const rawPhoneDigits = text(input.phone).replace(/\D/g, '');
  const specs: ProspectIdentityQuerySpec[] = [];
  const add = (field: ProspectIdentityQueryField, value: string, highConfidence: boolean) => {
    if (value) specs.push({ field, value, highConfidence });
  };

  if (usableEmail(identity.email)) add('normalizedEmail', identity.email, true);
  if (identity.phone) {
    add('normalizedPhone', identity.phone, true);
    add('normalizedPhone', rawPhoneDigits, true);
    add('normalizedPhone', `1${identity.phone}`, true);
  }
  if (usableWebsite(identity.website)) {
    add('normalizedWebsite', identity.website, true);
    add('normalizedWebsite', `www.${identity.website}`, true);
    add('normalizedWebsite', legacyWebsiteValue(input.website), true);
  }
  if (identity.businessName) {
    add('normalizedBusinessName', identity.businessName, false);
    add('normalizedBusinessName', legacyBusinessValue(input), false);
  }

  const unique = new Map<string, ProspectIdentityQuerySpec>();
  for (const spec of specs) unique.set(`${spec.field}:${spec.value}`, spec);
  return [...unique.values()];
}
