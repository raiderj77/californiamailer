export const COUPON_REVIEW_STATUSES = [
  'draft',
  'submitted_for_owner_review',
  'changes_requested',
  'approved',
] as const;

export const COUPON_PUBLICATION_STATUSES = ['unpublished', 'published'] as const;

export type CouponReviewStatus = (typeof COUPON_REVIEW_STATUSES)[number];
export type CouponPublicationStatus = (typeof COUPON_PUBLICATION_STATUSES)[number];

export const COUPON_AI_FIELDS = [
  'headline',
  'body',
  'offer',
  'callToAction',
  'backHeadline',
  'servicesList',
  'backCoupon',
  'terms',
] as const;

export type CouponAiField = (typeof COUPON_AI_FIELDS)[number];

export interface CouponDraftContent {
  headline: string;
  body: string;
  offer: string;
  callToAction: string;
  backHeadline: string;
  servicesList: string;
  backCoupon: string;
  expiresOn: string;
  terms: string;
}

export interface CouponFactContext {
  industry: string;
  serviceFacts: string;
  factualOffer: string;
  redemptionInstructions: string;
  audience: string;
  tone: string;
  verifiedFacts: string;
}

export const COUPON_TEXT_LIMITS = {
  headline: 80,
  body: 320,
  offer: 140,
  callToAction: 48,
  backHeadline: 80,
  servicesList: 240,
  backCoupon: 200,
  terms: 600,
} as const satisfies Record<CouponAiField, number>;

export const COUPON_CONTEXT_LIMITS = {
  industry: 100,
  serviceFacts: 600,
  factualOffer: 300,
  redemptionInstructions: 300,
  audience: 160,
  tone: 100,
  verifiedFacts: 800,
} as const satisfies Record<keyof CouponFactContext, number>;

export const EMPTY_COUPON_DRAFT: CouponDraftContent = {
  headline: '',
  body: '',
  offer: '',
  callToAction: '',
  backHeadline: '',
  servicesList: '',
  backCoupon: '',
  expiresOn: '',
  terms: '',
};

export const EMPTY_COUPON_CONTEXT: CouponFactContext = {
  industry: '',
  serviceFacts: '',
  factualOffer: '',
  redemptionInstructions: '',
  audience: '',
  tone: '',
  verifiedFacts: '',
};

export const COUPON_AI_DEFAULT_DAILY_QUOTA = 5;
export const COUPON_AI_MAX_DAILY_QUOTA = 10;
export const COUPON_AI_MAX_PROMPT_CHARS = 4_000;
export const COUPON_AI_MAX_PROVIDER_RESPONSE_CHARS = 100_000;

function normalizeText(value: unknown, limit: number, multiline = false) {
  const raw = typeof value === 'string' ? value.normalize('NFKC') : '';
  const withoutControls = raw.replace(multiline
    ? /[\u0000-\u0009\u000B-\u001F\u007F]/g
    : /[\u0000-\u001F\u007F]/g, ' ');
  const normalized = multiline
    ? withoutControls
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
    : withoutControls.replace(/\s+/g, ' ').trim();
  return normalized.slice(0, limit);
}

export function normalizeCouponDraft(value: Partial<CouponDraftContent>): CouponDraftContent {
  return {
    headline: normalizeText(value.headline, COUPON_TEXT_LIMITS.headline),
    body: normalizeText(value.body, COUPON_TEXT_LIMITS.body, true),
    offer: normalizeText(value.offer, COUPON_TEXT_LIMITS.offer),
    callToAction: normalizeText(value.callToAction, COUPON_TEXT_LIMITS.callToAction),
    backHeadline: normalizeText(value.backHeadline, COUPON_TEXT_LIMITS.backHeadline),
    servicesList: normalizeText(value.servicesList, COUPON_TEXT_LIMITS.servicesList, true),
    backCoupon: normalizeText(value.backCoupon, COUPON_TEXT_LIMITS.backCoupon, true),
    expiresOn: normalizeText(value.expiresOn, 10),
    terms: normalizeText(value.terms, COUPON_TEXT_LIMITS.terms, true),
  };
}

export function normalizeCouponContext(value: Partial<CouponFactContext>): CouponFactContext {
  return {
    industry: normalizeText(value.industry, COUPON_CONTEXT_LIMITS.industry),
    serviceFacts: normalizeText(value.serviceFacts, COUPON_CONTEXT_LIMITS.serviceFacts, true),
    factualOffer: normalizeText(value.factualOffer, COUPON_CONTEXT_LIMITS.factualOffer, true),
    redemptionInstructions: normalizeText(
      value.redemptionInstructions,
      COUPON_CONTEXT_LIMITS.redemptionInstructions,
      true,
    ),
    audience: normalizeText(value.audience, COUPON_CONTEXT_LIMITS.audience),
    tone: normalizeText(value.tone, COUPON_CONTEXT_LIMITS.tone),
    verifiedFacts: normalizeText(value.verifiedFacts, COUPON_CONTEXT_LIMITS.verifiedFacts, true),
  };
}

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function couponDraftErrors(
  value: CouponDraftContent,
  requireComplete: boolean,
): string[] {
  const errors: string[] = [];
  for (const field of COUPON_AI_FIELDS) {
    if (value[field].length > COUPON_TEXT_LIMITS[field]) {
      errors.push(`${field} exceeds its ${COUPON_TEXT_LIMITS[field]} character limit.`);
    }
  }
  if (value.expiresOn && !isCalendarDate(value.expiresOn)) {
    errors.push('Expiration must be a real calendar date in YYYY-MM-DD format.');
  }
  if (requireComplete) {
    if (!value.headline) errors.push('A headline is required before owner review.');
    if (!value.offer) errors.push('The factual offer is required before owner review.');
    if (!value.callToAction) errors.push('A call to action is required before owner review.');
    if (!value.terms) errors.push('Redemption terms are required before owner review.');
  }
  return errors;
}

export function couponDraftIsComplete(value: CouponDraftContent): boolean {
  return couponDraftErrors(value, true).length === 0;
}

export function couponAiDailyQuota(env: NodeJS.ProcessEnv = process.env) {
  const parsed = Number.parseInt(env.AI_COUPON_DAILY_QUOTA || '', 10);
  if (!Number.isInteger(parsed) || parsed < 1) return COUPON_AI_DEFAULT_DAILY_QUOTA;
  return Math.min(parsed, COUPON_AI_MAX_DAILY_QUOTA);
}

export function couponUtcDayKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function couponAiQuotaDocumentId(reservationId: string, now = new Date()) {
  return `${reservationId}__${couponUtcDayKey(now).replaceAll('-', '')}`;
}

export function couponPublishConfirmation(couponCode: string) {
  return `PUBLISH ${couponCode}`;
}

export function couponUnpublishConfirmation(couponCode: string) {
  return `UNPUBLISH ${couponCode}`;
}

function normalizedFactCorpus(
  businessName: string,
  context: CouponFactContext,
  expiresOn: string,
) {
  return [
    businessName,
    context.industry,
    context.serviceFacts,
    context.factualOffer,
    context.redemptionInstructions,
    context.verifiedFacts,
    expiresOn,
  ].join('\n').toLocaleLowerCase('en-US');
}

function numericTokens(value: string) {
  return [...value.matchAll(/\d+(?:[.,]\d+)*(?:\s*%)?/g)]
    .map((match) => match[0].replace(/[\s,]/g, '').toLowerCase());
}

const GROUNDED_CLAIM_RULES = [
  {
    pattern: /\b(?:free|complimentary)\b/gi,
    evidence: (context: CouponFactContext) => context.factualOffer,
  },
  {
    pattern: /(?:\$\s*\d[\d,]*(?:\.\d{1,2})?\s*off\b|\b\d+(?:\.\d+)?\s*%\s*off\b|\b(?:save|half off|buy one|get one|bogo|discount(?:ed)?|savings?|percent off|dollars? off)\b)/gi,
    evidence: (context: CouponFactContext) => context.factualOffer,
  },
  {
    pattern: /\b(?:guarantee(?:d)?|warranty)\b/gi,
    evidence: (context: CouponFactContext) => context.verifiedFacts,
  },
  {
    pattern: /\b(?:licensed|insured|bonded|certified)\b/gi,
    evidence: (context: CouponFactContext) => context.verifiedFacts,
  },
  {
    pattern: /\b(?:best|number one|top[- ]rated|award[- ]winning)\b/gi,
    evidence: (context: CouponFactContext) => context.verifiedFacts,
  },
  {
    pattern: /(?:\b\d(?:\.\d)?[- ]?stars?\b|\b(?:five|four)[- ]star\b|★)/gi,
    evidence: (context: CouponFactContext) => context.verifiedFacts,
  },
  {
    pattern: /\b(?:response rate|return on investment|roi|more leads?|more sales|double|triple|proven results?)\b/gi,
    evidence: (context: CouponFactContext) => context.verifiedFacts,
  },
  {
    pattern: /\b(?:limited time|today only|act now|hurry|while supplies last|spots? left|don['’]t miss)\b/gi,
    evidence: (context: CouponFactContext) => `${context.factualOffer}\n${context.verifiedFacts}`,
  },
] as const;

const NEGATED_CLAIM_PREFIX = /\b(?:no|not|never|without|cannot|can't|isn't|aren't|wasn't|weren't|doesn't|don't|didn't|won't)\b[^.!?;:\n]{0,48}$/i;

function hasAffirmativeClaimEvidence(claim: string, evidence: string): boolean {
  const normalizedClaim = claim.normalize('NFKC').toLocaleLowerCase('en-US');
  const normalizedEvidence = evidence.normalize('NFKC').toLocaleLowerCase('en-US');
  let searchFrom = 0;
  while (searchFrom < normalizedEvidence.length) {
    const index = normalizedEvidence.indexOf(normalizedClaim, searchFrom);
    if (index < 0) return false;
    const before = normalizedEvidence[index - 1] || '';
    const after = normalizedEvidence[index + normalizedClaim.length] || '';
    const exactToken = !/[\p{L}\p{N}]/u.test(before) && !/[\p{L}\p{N}]/u.test(after);
    const hyphenatedFree = normalizedClaim === 'free' && before === '-';
    const prefix = normalizedEvidence.slice(Math.max(0, index - 64), index);
    if (exactToken && !hyphenatedFree && !NEGATED_CLAIM_PREFIX.test(prefix)) return true;
    searchFrom = index + Math.max(1, normalizedClaim.length);
  }
  return false;
}

export interface AiSuggestionAssessment {
  accepted: boolean;
  text: string;
  reason: string | null;
}

export function assessCouponAiSuggestion(input: {
  field: CouponAiField;
  text: string;
  businessName: string;
  context: CouponFactContext;
  expiresOn: string;
}): AiSuggestionAssessment {
  const text = normalizeText(
    input.text,
    COUPON_TEXT_LIMITS[input.field],
    ['body', 'servicesList', 'backCoupon', 'terms'].includes(input.field),
  );
  if (!text) return { accepted: false, text: '', reason: 'The AI returned no usable draft.' };
  if (input.text.normalize('NFKC').trim().length > COUPON_TEXT_LIMITS[input.field]) {
    return { accepted: false, text: '', reason: 'The AI draft exceeded the field limit.' };
  }
  if (['offer', 'backCoupon'].includes(input.field) && !input.context.factualOffer) {
    return {
      accepted: false,
      text: '',
      reason: 'Enter the exact factual offer before asking AI to draft offer copy.',
    };
  }

  const facts = normalizedFactCorpus(input.businessName, input.context, input.expiresOn);
  const factNumbers = new Set(numericTokens(facts));
  const ungroundedNumber = numericTokens(text).find((token) => !factNumbers.has(token));
  if (ungroundedNumber) {
    return {
      accepted: false,
      text: '',
      reason: 'The AI draft introduced a number that was not supplied as a fact.',
    };
  }

  for (const rule of GROUNDED_CLAIM_RULES) {
    rule.pattern.lastIndex = 0;
    const matches = [...text.matchAll(rule.pattern)].map((match) => match[0].toLocaleLowerCase('en-US'));
    const evidence = rule.evidence(input.context);
    if (matches.some((claim) => !hasAffirmativeClaimEvidence(claim, evidence))) {
      return {
        accepted: false,
        text: '',
        reason: 'The AI draft introduced a promotional, credential, scarcity, or performance claim that was not supplied as a fact.',
      };
    }
  }

  if (/https?:\/\/|www\.|\b\d{3}[-.)\s]+\d{3}[-.\s]+\d{4}\b/i.test(text)) {
    return {
      accepted: false,
      text: '',
      reason: 'AI drafts cannot invent or repeat website and phone contact details.',
    };
  }

  return { accepted: true, text, reason: null };
}

export function publicCouponUnavailableReason(input: {
  publicationStatus: unknown;
  hasPublishedContent: boolean;
  trackingActive: boolean;
  reservationPaid: boolean;
  trackingOwnsReservation: boolean;
  couponCodeMatches: boolean;
}) {
  if (input.publicationStatus !== 'published' || !input.hasPublishedContent) {
    return 'coupon_not_published';
  }
  if (!input.trackingActive) return 'tracking_not_active';
  if (!input.reservationPaid) return 'reservation_not_paid';
  if (!input.trackingOwnsReservation || !input.couponCodeMatches) return 'ownership_mismatch';
  return null;
}
