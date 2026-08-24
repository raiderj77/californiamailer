# AI-assisted coupon drafting research and controls

Checked: 2026-08-20

This feature uses original CaliforniaMailer code, copy, interaction design, and styling. It does
not copy competitor assets, source code, testimonials, claims, or branded layouts.

## Observable workflow patterns

- [My Postcard Planner](https://mypostcardplanner.com/) publicly presents a staged direct-mail
  workflow and a design form with business facts first, then separate front headline, body, offer,
  CTA, back headline, services, and back-coupon fields. Its public interface offers AI help at the
  field level and keeps review/approval separate from drafting.
- [Media Street](https://mediastreet.ai/) publicly frames the value path as a business-to-offer
  cross-promotion workflow. CaliforniaMailer uses the general idea that an advertiser should first
  state the real business and offer, then turn those facts into editable coupon copy.

CaliforniaMailer combines only those general workflow observations: fact intake, field-by-field
drafting, a live preview, and a distinct approval gate. The implementation remains specific to the
existing paid-reservation and unique tracking-code model.

## OpenAI implementation sources

- The [Responses API reference](https://developers.openai.com/api/reference/typescript/resources/beta/subresources/responses/methods/create)
  documents JSON Schema Structured Outputs and the `store` request option.
- The current [GPT-5.6 Luna model page](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
  documents Responses API and Structured Outputs support and identifies Luna as a billed,
  cost-sensitive model rather than a free bundled add-on.

The integration therefore uses a server-side `fetch` to `POST /v1/responses`, sends `store: false`,
and constrains each response to a strict two-field JSON schema. The API key is read only from
`OPENAI_API_KEY`; no `NEXT_PUBLIC_` AI secret exists.

## Original CaliforniaMailer workflow

1. The advertiser opens the existing token-protected reservation page.
2. Coupon access requires `verifyReservationAccess`, a currently `paid` reservation, and the exact
   tracking record already owned by that reservation.
3. Manual coupon drafting works with no AI configuration.
4. Optional AI drafts one selected field from typed advertiser facts. The server does not fetch or
   analyze the advertiser website.
5. AI output is inserted into editable fields. Saving does not submit or publish it.
6. The advertiser explicitly submits an exact numbered draft version for owner review.
7. The owner sees the submitted copy beside its grounding facts. Publication requires the same
   draft version, current paid reservation, active matching tracking record, and the exact phrase
   `PUBLISH <COUPON_CODE>`.
8. Publication copies the approved draft into an immutable-at-publication `publishedContent`
   snapshot. Later advertiser edits do not silently change that public snapshot.
9. The public page remains unavailable unless the coupon is published, tracking is active, the
   reservation is still paid, and every claim/reservation/tracking identifier still matches.

## Claim and cost controls

- AI receives only the business name and facts typed into the private coupon workspace.
- Prompts forbid invented discounts, guarantees, ratings, licenses, certifications, scarcity,
  urgency, dates, eligibility, response claims, performance claims, testimonials, phone numbers,
  and websites.
- Post-generation checks reject numbers and sensitive claim phrases not present in the supplied
  factual corpus. Structured output is still labeled a draft and requires human review.
- Inputs and outputs have field-specific limits; the total AI prompt is capped at 4,000 characters.
- Each paid reservation has a durable UTC-day usage document. The default is five AI field drafts
  per day and the server caps any environment override at ten.
- Provider failures still consume the reserved attempt. This prevents repeated failing calls from
  bypassing the cost boundary.
- No live API call is made by automated tests.

## Data, routes, and privacy

- `coupons/{trackingId}` stores private draft/context state and the separately approved public
  snapshot. The document ID reuses the existing unique tracking ID.
- `couponaiusage/{reservationId}__{UTC day}` stores only bounded quota metadata, not the prompt or
  generated copy.
- Existing `trackingcouponclaims`, `trackinglinks`, `reservations`, and `auditlog` records remain the
  authoritative uniqueness, ownership, paid-state, and decision evidence.
- Private advertiser API: `/api/reservations/[id]/coupon`.
- Owner API and page: `/api/admin/coupons` and `/coupons`.
- Public page: `/coupon/[code]`; `/redeem/[code]` redirects to it.
- The public page is `noindex, nofollow`, contains no consumer form, collects no consumer PII, and
  explicitly says CaliforniaMailer does not directly verify whether redemption was accepted or
  completed. Its business CTA is a server-validated direct HTTPS link rather than a tracking-event
  endpoint, so opening the business website does not create a CaliforniaMailer redemption, lead,
  sale, or consumer-profile record. The existing tracking ID still anchors coupon ownership and
  uniqueness.

## Deployment boundary

- Firestore explicitly denies browser access to `coupons` and `couponaiusage`.
- `/coupons` is in the authenticated owner navigation, while owner and public coupon routes are
  excluded from sitemap generation. Public coupon pages also emit `noindex, nofollow`.
- Keep AI disabled until the owner intentionally sets `AI_COUPON_GENERATION_ENABLED=true`, provides
  a server-side project API key, and accepts the resulting API spend. No deployment, outreach,
  payment, printing, or order action is part of this implementation.
