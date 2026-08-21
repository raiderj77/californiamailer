import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { CouponAiError, generateCouponFieldDraft } from '../src/lib/couponAi';
import {
  EMPTY_COUPON_CONTEXT,
  EMPTY_COUPON_DRAFT,
  assessCouponAiSuggestion,
  couponAiDailyQuota,
  couponAiQuotaDocumentId,
  couponDraftErrors,
  couponDraftIsComplete,
  couponPublishConfirmation,
  publicCouponUnavailableReason,
  type CouponDraftContent,
  type CouponFactContext,
} from '../src/lib/couponRules';

const completeDraft: CouponDraftContent = {
  ...EMPTY_COUPON_DRAFT,
  headline: 'A factual local offer',
  offer: '$25 off a qualifying service',
  callToAction: 'View offer details',
  expiresOn: '2026-09-30',
  terms: 'One coupon per customer. Qualifying service only.',
};

const groundedContext: CouponFactContext = {
  ...EMPTY_COUPON_CONTEXT,
  industry: 'Home services',
  serviceFacts: 'Qualifying repair service',
  factualOffer: '$25 off a qualifying service',
  redemptionInstructions: 'Show the coupon code when requesting service',
};

test('manual drafts remain possible while submission requires the public essentials', () => {
  assert.deepEqual(couponDraftErrors(EMPTY_COUPON_DRAFT, false), []);
  assert.deepEqual(couponDraftErrors(EMPTY_COUPON_DRAFT, true), [
    'A headline is required before owner review.',
    'The factual offer is required before owner review.',
    'A call to action is required before owner review.',
    'Redemption terms are required before owner review.',
  ]);
  assert.deepEqual(couponDraftErrors(completeDraft, true), []);
  assert.equal(couponDraftIsComplete(EMPTY_COUPON_DRAFT), false);
  assert.equal(couponDraftIsComplete(completeDraft), true);
  assert.match(
    couponDraftErrors({ ...completeDraft, expiresOn: '2026-02-30' }, true)[0],
    /real calendar date/,
  );
});

test('owner publication uses an exact coupon-specific confirmation phrase', () => {
  assert.equal(couponPublishConfirmation('CM-AB12'), 'PUBLISH CM-AB12');
  assert.notEqual(couponPublishConfirmation('CM-AB12'), 'publish cm-ab12');
});

test('durable daily quota identifiers are reservation and UTC-day scoped with a hard cap', () => {
  assert.equal(
    couponAiQuotaDocumentId('Reservation123', new Date('2026-08-19T23:59:00.000Z')),
    'Reservation123__20260819',
  );
  assert.equal(couponAiDailyQuota({ NODE_ENV: 'test', AI_COUPON_DAILY_QUOTA: '7' }), 7);
  assert.equal(couponAiDailyQuota({ NODE_ENV: 'test', AI_COUPON_DAILY_QUOTA: '999' }), 10);
  assert.equal(couponAiDailyQuota({ NODE_ENV: 'test', AI_COUPON_DAILY_QUOTA: 'bad' }), 5);
});

test('public eligibility requires publication, active tracking, paid status, and exact ownership', () => {
  const valid = {
    publicationStatus: 'published',
    hasPublishedContent: true,
    trackingActive: true,
    reservationPaid: true,
    trackingOwnsReservation: true,
    couponCodeMatches: true,
  };
  assert.equal(publicCouponUnavailableReason(valid), null);
  assert.equal(publicCouponUnavailableReason({ ...valid, trackingActive: false }), 'tracking_not_active');
  assert.equal(publicCouponUnavailableReason({ ...valid, reservationPaid: false }), 'reservation_not_paid');
  assert.equal(publicCouponUnavailableReason({ ...valid, couponCodeMatches: false }), 'ownership_mismatch');
});

test('AI post-check accepts grounded offer values and rejects invented values and claims', () => {
  assert.equal(assessCouponAiSuggestion({
    field: 'offer',
    text: 'Get $25 off a qualifying service',
    businessName: 'Example Business',
    context: groundedContext,
    expiresOn: completeDraft.expiresOn,
  }).accepted, true);
  assert.match(assessCouponAiSuggestion({
    field: 'offer',
    text: 'Get $50 off a qualifying service',
    businessName: 'Example Business',
    context: groundedContext,
    expiresOn: completeDraft.expiresOn,
  }).reason || '', /number that was not supplied/);
  assert.match(assessCouponAiSuggestion({
    field: 'headline',
    text: 'Guaranteed results — act now',
    businessName: 'Example Business',
    context: groundedContext,
    expiresOn: completeDraft.expiresOn,
  }).reason || '', /promotional, credential, scarcity, or performance claim/);
});

test('AI claim grounding requires affirmative evidence in the matching fact field', () => {
  const negatedCredentials = {
    ...groundedContext,
    verifiedFacts: 'This business is not licensed and makes no guarantees.',
  };
  assert.equal(assessCouponAiSuggestion({
    field: 'headline',
    text: 'Licensed local service',
    businessName: 'Example Business',
    context: negatedCredentials,
    expiresOn: completeDraft.expiresOn,
  }).accepted, false);

  const negatedOffer = {
    ...groundedContext,
    factualOffer: 'There is no discount. Ask for current standard pricing.',
  };
  assert.equal(assessCouponAiSuggestion({
    field: 'headline',
    text: 'Discount available',
    businessName: 'Example Business',
    context: negatedOffer,
    expiresOn: completeDraft.expiresOn,
  }).accepted, false);

  assert.equal(assessCouponAiSuggestion({
    field: 'offer',
    text: 'Get $25 off a qualifying service',
    businessName: 'Example Business',
    context: groundedContext,
    expiresOn: completeDraft.expiresOn,
  }).accepted, true);

  assert.equal(assessCouponAiSuggestion({
    field: 'headline',
    text: 'Free service consultation',
    businessName: 'Example Business',
    context: { ...groundedContext, factualOffer: 'Gluten-free product consultation' },
    expiresOn: completeDraft.expiresOn,
  }).accepted, false);
});

test('Responses request is server-configured, stateless, structured, bounded, and test-faked', async () => {
  let capturedUrl = '';
  let capturedInit: RequestInit | undefined;
  const fakeFetch: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({
      output: [{
        content: [{
          type: 'output_text',
          text: JSON.stringify({
            text: 'Get $25 off a qualifying service',
            groundingNote: 'Uses only the supplied offer.',
          }),
        }],
      }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };

  const result = await generateCouponFieldDraft({
    field: 'offer',
    businessName: 'Example Business',
    reservationScopedId: 'Reservation123',
    context: groundedContext,
    currentDraft: completeDraft,
  }, {
    env: {
      NODE_ENV: 'test',
      AI_COUPON_GENERATION_ENABLED: 'true',
      OPENAI_API_KEY: 'test-key-never-sent-live',
      OPENAI_COUPON_MODEL: 'gpt-5.6-luna-test',
    },
    fetchImpl: fakeFetch,
  });
  assert.equal(capturedUrl, 'https://api.openai.com/v1/responses');
  assert.equal(result.text, 'Get $25 off a qualifying service');
  const requestBody = JSON.parse(String(capturedInit?.body));
  assert.equal(requestBody.store, false);
  assert.equal(
    requestBody.safety_identifier,
    createHash('sha256')
      .update('californiamailer:coupon-ai:v1:Reservation123')
      .digest('hex'),
  );
  assert.doesNotMatch(requestBody.safety_identifier, /Reservation123/);
  assert.equal(requestBody.model, 'gpt-5.6-luna-test');
  assert.equal(requestBody.text.format.type, 'json_schema');
  assert.equal(requestBody.text.format.strict, true);
  assert.doesNotMatch(requestBody.input, /websiteUrl|https?:\/\//i);
});

test('disabled AI makes no provider call and leaves manual drafting available', async () => {
  let called = false;
  const fakeFetch: typeof fetch = async () => {
    called = true;
    throw new Error('must not run');
  };
  await assert.rejects(
    generateCouponFieldDraft({
      field: 'headline',
      businessName: 'Example Business',
      reservationScopedId: 'Reservation123',
      context: groundedContext,
      currentDraft: completeDraft,
    }, {
      env: { NODE_ENV: 'test', AI_COUPON_GENERATION_ENABLED: 'false' },
      fetchImpl: fakeFetch,
    }),
    (error: unknown) => error instanceof CouponAiError && error.status === 503,
  );
  assert.equal(called, false);
});
