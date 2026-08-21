import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  EDDM_QUANTITY_TIERS,
  SERVICE_OPTIONS,
  mailPieceForQuote,
  type QuoteServiceType,
} from '@/config/eddmOfferings';
import { FOUNDING_CATEGORIES } from '@/config/foundingCampaign';
import { getSharedMailerModel } from '@/config/sharedMailerModels';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import {
  advanceRateLimitBucket,
  requestFingerprint,
  type RateLimitBucket,
} from '@/lib/rateLimit';

const services = new Set<QuoteServiceType>(SERVICE_OPTIONS.map((option) => option.id));
const quantities = new Set<number>(EDDM_QUANTITY_TIERS);
const targetedAudiences = new Set(['radius', 'new_movers', 'real_estate_farm', 'customer_list', 'other']);
const fulfillmentOptions = new Set(['print_only', 'turnkey']);
const contactPreferences = new Set(['email_only', 'email_or_phone']);
const categories = new Set([...FOUNDING_CATEGORIES.map((category) => category.name), 'other']);
const browserPriceFields = ['amount', 'amountCents', 'priceCents', 'quotedPrice', 'customerPriceCents', 'supplierCostCents'];
const MAX_BODY_BYTES = 16_384;
const QUOTE_IP_LIMIT = 5;
const QUOTE_IP_WINDOW_MS = 15 * 60_000;
const QUOTE_EMAIL_LIMIT = 3;
const QUOTE_EMAIL_WINDOW_MS = 60 * 60_000;
const QUOTE_CONTENT_DEDUPE_WINDOW_MS = 24 * 60 * 60_000;
const COOP_QUANTITY_LABEL = 'one placement inquiry';
const singleLineControls = /[\u0000-\u001f\u007f]/;
const messageControls = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

const singleLine = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum).refine((value) => !singleLineControls.test(value), 'Control characters are not allowed.');

const quoteRequestSchema = z.object({
  kind: z.literal('quote'),
  submissionId: z.string().uuid(),
  name: singleLine(1, 100),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().max(40).regex(/^[0-9+().\-\s]*$/, 'Enter a valid phone number.'),
  contactPreference: z.enum(['email_only', 'email_or_phone']),
  business: singleLine(1, 120),
  category: singleLine(1, 100),
  serviceType: z.string().trim().max(20),
  sharedModelId: z.string().trim().max(80),
  mailerSpecId: z.string().trim().max(80),
  quantity: z.string().trim().max(40),
  city: singleLine(1, 80),
  targeting: z.string().trim().max(40),
  fulfillment: z.string().trim().max(20),
  message: z.string().trim().min(10).max(2_000).refine((value) => !messageControls.test(value), 'Control characters are not allowed.'),
  website: z.string().max(200).optional().default(''),
}).strict();

class QuoteRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Quote rate limit exceeded.');
  }
}

class QuoteIdempotencyConflictError extends Error {
  constructor() {
    super('The submission identifier was already used for different quote details.');
  }
}

type QuoteIntakeOutcome = {
  kind: 'created' | 'idempotent' | 'duplicate';
  reference: string;
};

function requestOriginAllowed(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  const allowed = new Set([
    new URL(request.url).origin,
    'https://californiamailer.com',
    'https://www.californiamailer.com',
  ]);
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      allowed.add(new URL(configured).origin);
    } catch {
      // An invalid optional URL must not broaden the accepted origins.
    }
  }
  try {
    return allowed.has(new URL(origin).origin);
  } catch {
    return false;
  }
}

function bucketFrom(data: FirebaseFirestore.DocumentData | undefined): RateLimitBucket | null {
  const count = Number(data?.count);
  const resetAt = Number(data?.resetAt);
  return Number.isInteger(count) && count >= 0 && Number.isFinite(resetAt)
    ? { count, resetAt }
    : null;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export async function POST(request: NextRequest) {
  if (!requestOriginAllowed(request)) {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
  }
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
  }
  const rawBody = await request.text().catch(() => '');
  if (!rawBody || Buffer.byteLength(rawBody, 'utf8') > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request is too large or invalid.' }, { status: 413 });
  }
  let unknownBody: unknown;
  try {
    unknownBody = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  if (typeof unknownBody === 'object' && unknownBody !== null && browserPriceFields.some((field) => Object.prototype.hasOwnProperty.call(unknownBody, field))) {
    return NextResponse.json({ error: 'Browser-submitted prices are not accepted.' }, { status: 400 });
  }

  if (typeof unknownBody === 'object' && unknownBody !== null && typeof Reflect.get(unknownBody, 'website') === 'string' && Reflect.get(unknownBody, 'website')) {
    return NextResponse.json({ success: true });
  }

  const parsed = quoteRequestSchema.safeParse(unknownBody);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter the required quote details.' }, { status: 400 });
  }

  const body = parsed.data;
  const { name, email, phone, contactPreference, business, city, quantity, message, category, mailerSpecId, sharedModelId, targeting, fulfillment } = body;
  const serviceValue = body.serviceType;
  if (!contactPreferences.has(contactPreference) || !services.has(serviceValue as QuoteServiceType) || !categories.has(category)) {
    return NextResponse.json({ error: 'Choose supported quote details.' }, { status: 400 });
  }

  const serviceType = serviceValue as QuoteServiceType;
  const sharedModel = serviceType === 'shared_model' ? getSharedMailerModel(sharedModelId) : null;
  const catalogPieceRequired = !['coop', 'shared_model'].includes(serviceType);
  const mailPiece = catalogPieceRequired ? mailPieceForQuote(serviceType, mailerSpecId) : null;
  const numericQuantity = catalogPieceRequired ? Number(quantity) : null;

  if (catalogPieceRequired && (!mailPiece || !Number.isInteger(numericQuantity) || !quantities.has(Number(numericQuantity)))) {
    return NextResponse.json({ error: 'Choose a supported mail piece and print tier.' }, { status: 400 });
  }
  if (serviceType === 'shared_model' && !sharedModel) {
    return NextResponse.json({ error: 'Choose a supported shared-mailer model.' }, { status: 400 });
  }
  if (serviceType === 'coop' && quantity !== COOP_QUANTITY_LABEL) {
    return NextResponse.json({ error: 'Choose the founding shared placement.' }, { status: 400 });
  }
  if (serviceType === 'solo' && !targetedAudiences.has(targeting)) {
    return NextResponse.json({ error: 'Choose a targeted audience.' }, { status: 400 });
  }
  if (serviceType === 'eddm' && !fulfillmentOptions.has(fulfillment)) {
    return NextResponse.json({ error: 'Choose an EDDM fulfillment path.' }, { status: 400 });
  }

  let db: ReturnType<typeof getAdminFirestore>;
  try {
    db = getAdminFirestore();
  } catch {
    return NextResponse.json({ error: 'Quote inquiry could not be recorded.' }, { status: 503 });
  }

  const submissionHash = sha256(`quote-submission:${body.submissionId}`);
  const quoteDetails = {
    name,
    email,
    phone: phone || null,
    contactPreference,
    business,
    category,
    serviceType,
    city,
    quantity: sharedModel?.quantity || numericQuantity || (serviceType === 'coop' ? COOP_QUANTITY_LABEL : null),
    sharedModelId: sharedModel?.id || null,
    mailerSpecId: mailPiece?.id || null,
    mailerLabel: sharedModel?.name || mailPiece?.label || 'Founding shared placement',
    targeting: serviceType === 'solo' ? targeting : null,
    fulfillment: serviceType === 'eddm' ? fulfillment : null,
    message,
  };
  const requestHash = sha256(JSON.stringify({ ...quoteDetails, email: email.toLowerCase() }));
  const inquiryRef = db.collection('quoteinquiries').doc(submissionHash);
  const publicReference = `CMQ-${submissionHash.slice(0, 8).toUpperCase()}`;
  const ipGuardRef = db.collection('publicrequestguards').doc(`quote-ip-${requestFingerprint(request, 'quote')}`);
  const emailGuardRef = db.collection('publicrequestguards').doc(`quote-email-${sha256(email.toLowerCase())}`);
  const contentGuardRef = db.collection('publicrequestguards').doc(`quote-content-${requestHash}`);
  const now = Date.now();

  let outcome: QuoteIntakeOutcome;
  try {
    outcome = await db.runTransaction(async (transaction): Promise<QuoteIntakeOutcome> => {
      const [existing, contentGuard, ipGuard, emailGuard] = await Promise.all([
        transaction.get(inquiryRef),
        transaction.get(contentGuardRef),
        transaction.get(ipGuardRef),
        transaction.get(emailGuardRef),
      ]);
      if (existing.exists) {
        if (existing.data()?.requestHash !== requestHash) throw new QuoteIdempotencyConflictError();
        return {
          kind: 'idempotent',
          reference: typeof existing.data()?.publicReference === 'string' ? existing.data()!.publicReference : publicReference,
        };
      }

      const contentGuardData = contentGuard.data();
      if (contentGuard.exists && Number(contentGuardData?.expiresAt) > now) {
        const guardedInquiryId = typeof contentGuardData?.inquiryId === 'string' ? contentGuardData.inquiryId : '';
        const guardedInquiry = guardedInquiryId
          ? await transaction.get(db.collection('quoteinquiries').doc(guardedInquiryId))
          : null;
        if (guardedInquiry?.exists && guardedInquiry.data()?.requestHash === requestHash) {
          return {
            kind: 'duplicate',
            reference: typeof guardedInquiry.data()?.publicReference === 'string'
              ? guardedInquiry.data()!.publicReference
              : publicReference,
          };
        }
      }

      const ipRate = advanceRateLimitBucket(bucketFrom(ipGuard.data()), QUOTE_IP_LIMIT, QUOTE_IP_WINDOW_MS, now);
      const emailRate = advanceRateLimitBucket(bucketFrom(emailGuard.data()), QUOTE_EMAIL_LIMIT, QUOTE_EMAIL_WINDOW_MS, now);
      if (!ipRate.allowed || !emailRate.allowed) {
        throw new QuoteRateLimitError(Math.max(ipRate.retryAfterSeconds, emailRate.retryAfterSeconds));
      }

      transaction.set(ipGuardRef, { ...ipRate.bucket, scope: 'quote_ip', updatedAt: FieldValue.serverTimestamp() });
      transaction.set(emailGuardRef, { ...emailRate.bucket, scope: 'quote_email', updatedAt: FieldValue.serverTimestamp() });
      transaction.create(inquiryRef, {
        ...quoteDetails,
        emailNormalized: email.toLowerCase(),
        status: 'new',
        publicReference,
        source: 'public_quote_form',
        replyPermission: 'requested_quote_response_only',
        requestHash,
        intakeStatus: 'accepted',
        reviewQueueStatus: 'queued',
        notificationStatus: 'not_queued_disabled',
        outboundMessageStatus: 'not_sent',
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.set(contentGuardRef, {
        scope: 'quote_content',
        inquiryId: submissionHash,
        publicReference,
        requestHash,
        expiresAt: now + QUOTE_CONTENT_DEDUPE_WINDOW_MS,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { kind: 'created', reference: publicReference };
    });
  } catch (error) {
    if (error instanceof QuoteRateLimitError) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
      );
    }
    if (error instanceof QuoteIdempotencyConflictError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Quote inquiry could not be recorded.' }, { status: 503 });
  }

  return NextResponse.json({
    success: true,
    reference: outcome.reference,
    intakeStatus: 'accepted',
    reviewQueueStatus: 'queued',
    notificationStatus: 'not_queued_disabled',
    outboundMessageStatus: 'not_sent',
    duplicate: outcome.kind !== 'created',
  }, { status: outcome.kind === 'created' ? 201 : 200 });
}
