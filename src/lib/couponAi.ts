import { createHash } from 'node:crypto';
import {
  COUPON_AI_MAX_PROMPT_CHARS,
  COUPON_AI_MAX_PROVIDER_RESPONSE_CHARS,
  COUPON_TEXT_LIMITS,
  assessCouponAiSuggestion,
  normalizeCouponContext,
  type CouponAiField,
  type CouponDraftContent,
  type CouponFactContext,
} from '@/lib/couponRules';

export const DEFAULT_COUPON_AI_MODEL = 'gpt-5.6-luna';
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const COUPON_AI_TIMEOUT_MS = 20_000;

export class CouponAiError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 422 | 502 | 503,
  ) {
    super(message);
  }
}

export interface CouponAiAvailability {
  enabled: boolean;
  model: string;
  reason: string | null;
}

export function couponAiAvailability(
  env: NodeJS.ProcessEnv = process.env,
): CouponAiAvailability {
  const configuredModel = env.OPENAI_COUPON_MODEL?.trim();
  const model = configuredModel && /^[A-Za-z0-9._-]{2,80}$/.test(configuredModel)
    ? configuredModel
    : DEFAULT_COUPON_AI_MODEL;
  if (env.AI_COUPON_GENERATION_ENABLED !== 'true') {
    return {
      enabled: false,
      model,
      reason: 'AI coupon drafting is disabled. Manual drafting remains available.',
    };
  }
  if (!env.OPENAI_API_KEY?.trim()) {
    return {
      enabled: false,
      model,
      reason: 'AI coupon drafting is not configured. Manual drafting remains available.',
    };
  }
  return { enabled: true, model, reason: null };
}

interface CouponAiRequest {
  field: CouponAiField;
  businessName: string;
  reservationScopedId: string;
  context: CouponFactContext;
  currentDraft: CouponDraftContent;
}

interface OpenAiResponseBody {
  output_text?: unknown;
  output?: Array<{
    content?: Array<{
      type?: unknown;
      text?: unknown;
      refusal?: unknown;
    }>;
  }>;
}

function outputText(body: OpenAiResponseBody) {
  if (typeof body.output_text === 'string') return body.output_text;
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
      if (content.type === 'refusal' || typeof content.refusal === 'string') {
        throw new CouponAiError('AI drafting declined this request. Continue manually.', 422);
      }
    }
  }
  throw new CouponAiError('AI drafting returned no usable text. Continue manually.', 502);
}

function fieldInstruction(field: CouponAiField) {
  const instructions: Record<CouponAiField, string> = {
    headline: 'Write one clear front-side headline.',
    body: 'Write concise supporting body copy with no new claim.',
    offer: 'Restate the supplied factual offer exactly and clearly; do not improve the deal.',
    callToAction: 'Write one short action phrase grounded in the supplied redemption instructions.',
    backHeadline: 'Write one optional address-side headline.',
    servicesList: 'Condense only the supplied service facts into a readable list.',
    backCoupon: 'Write compact back-coupon copy using only the supplied offer, date, and terms.',
    terms: 'Condense the supplied factual terms without adding exclusions or eligibility.',
  };
  return instructions[field];
}

export function couponAiSafetyIdentifier(reservationScopedId: string) {
  const normalized = reservationScopedId.normalize('NFKC').trim();
  if (!/^[A-Za-z0-9_-]{10,80}$/.test(normalized)) {
    throw new CouponAiError('The reservation scope is invalid for AI drafting.', 400);
  }
  return createHash('sha256')
    .update(`californiamailer:coupon-ai:v1:${normalized}`)
    .digest('hex');
}

export async function generateCouponFieldDraft(
  input: CouponAiRequest,
  options: {
    env?: NodeJS.ProcessEnv;
    fetchImpl?: typeof fetch;
  } = {},
) {
  const env = options.env || process.env;
  const availability = couponAiAvailability(env);
  if (!availability.enabled) {
    throw new CouponAiError(
      availability.reason || 'AI coupon drafting is disabled. Continue manually.',
      503,
    );
  }

  const businessName = input.businessName.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 160);
  const safetyIdentifier = couponAiSafetyIdentifier(input.reservationScopedId);
  const context = normalizeCouponContext(input.context);
  if (businessName.length < 2) {
    throw new CouponAiError('A business name is required for AI drafting.', 400);
  }
  if (['offer', 'backCoupon'].includes(input.field) && !context.factualOffer) {
    throw new CouponAiError(
      'Enter the exact factual offer before asking AI to draft offer copy.',
      400,
    );
  }
  if (input.field === 'servicesList' && !context.serviceFacts) {
    throw new CouponAiError(
      'Enter factual services before asking AI to draft a services list.',
      400,
    );
  }

  const facts = {
    businessName,
    industry: context.industry || null,
    serviceFacts: context.serviceFacts || null,
    factualOffer: context.factualOffer || null,
    redemptionInstructions: context.redemptionInstructions || null,
    audience: context.audience || null,
    tone: context.tone || null,
    verifiedFacts: context.verifiedFacts || null,
    expiresOn: input.currentDraft.expiresOn || null,
  };
  const prompt = JSON.stringify({
    task: fieldInstruction(input.field),
    targetField: input.field,
    maximumCharacters: COUPON_TEXT_LIMITS[input.field],
    advertiserSuppliedFacts: facts,
  });
  if (prompt.length > COUPON_AI_MAX_PROMPT_CHARS) {
    throw new CouponAiError('The factual input is too long for AI drafting.', 400);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COUPON_AI_TIMEOUT_MS);
  let response: Response;
  try {
    response = await (options.fetchImpl || fetch)(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: availability.model,
        store: false,
        safety_identifier: safetyIdentifier,
        instructions: [
          'You draft one editable direct-mail coupon field from advertiser-supplied facts.',
          'Never browse or infer facts. Never invent or strengthen a discount, guarantee, rating, license, certification, scarcity, urgency, performance claim, response claim, result, date, price, or eligibility rule.',
          'If a necessary fact is missing, return an empty text value and explain the missing fact in groundingNote.',
          'Do not add phone numbers, websites, testimonials, legal conclusions, or hashtags.',
          'Return only the requested field in the required JSON schema.',
        ].join(' '),
        input: prompt,
        max_output_tokens: 300,
        text: {
          verbosity: 'low',
          format: {
            type: 'json_schema',
            name: 'coupon_field_draft',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: {
                text: { type: 'string', maxLength: COUPON_TEXT_LIMITS[input.field] },
                groundingNote: { type: 'string', maxLength: 240 },
              },
              required: ['text', 'groundingNote'],
            },
          },
        },
      }),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof CouponAiError) throw error;
    throw new CouponAiError('AI drafting is temporarily unavailable. Continue manually.', 502);
  } finally {
    clearTimeout(timeout);
  }

  const raw = await response.text();
  if (raw.length > COUPON_AI_MAX_PROVIDER_RESPONSE_CHARS) {
    throw new CouponAiError('AI drafting returned an oversized response. Continue manually.', 502);
  }
  if (!response.ok) {
    throw new CouponAiError('AI drafting is temporarily unavailable. Continue manually.', 502);
  }

  let providerBody: OpenAiResponseBody;
  try {
    providerBody = JSON.parse(raw) as OpenAiResponseBody;
  } catch {
    throw new CouponAiError('AI drafting returned an invalid response. Continue manually.', 502);
  }

  let structured: { text?: unknown; groundingNote?: unknown };
  try {
    structured = JSON.parse(outputText(providerBody)) as { text?: unknown; groundingNote?: unknown };
  } catch (error) {
    if (error instanceof CouponAiError) throw error;
    throw new CouponAiError('AI drafting returned invalid structured copy. Continue manually.', 502);
  }
  if (typeof structured.text !== 'string' || typeof structured.groundingNote !== 'string') {
    throw new CouponAiError('AI drafting returned incomplete structured copy. Continue manually.', 502);
  }

  const assessed = assessCouponAiSuggestion({
    field: input.field,
    text: structured.text,
    businessName,
    context,
    expiresOn: input.currentDraft.expiresOn,
  });
  if (!assessed.accepted) {
    throw new CouponAiError(
      assessed.reason || 'AI drafting introduced an unsupported claim. Continue manually.',
      422,
    );
  }

  return {
    field: input.field,
    text: assessed.text,
    groundingNote: structured.groundingNote.normalize('NFKC').replace(/\s+/g, ' ').trim().slice(0, 240),
    model: availability.model,
  };
}
