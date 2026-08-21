# CaliforniaMailer

CaliforniaMailer is a one-owner operating system for an evidence-gated California direct-mail business. The current local tree combines one pre-funded Monterey Peninsula co-op experiment with quote-only statewide single-business postcard and pizza-box-placement intake, a private prospect desk, reservation/payment guardrails, cost and print-readiness checks, proof approvals, and measured-vs-reported tracking.

**Release state:** implemented and tested in the current local integration tree on branch `codex/faceless-sales`. The working copy is `C:\Users\jason\Documents\ChatGPT\California Mailer\californiamailer`; its local origin is the maintained repository at `C:\Users\jason\Documents\portfolio-sites\californiamailer`. The integrated follow-up remains local and unpushed, and nothing was deployed. Production still points to baseline `main` commit `4da58ef`, and the local CI workflow has not run on GitHub. No outreach was sent, no real advertiser/subscriber/payment records were created, no checkout was enabled, no provider was activated, and no print, postage, or restaurant-distribution order was made.

The active planning model is versioned in [`src/config/sharedMailerModels.ts`](src/config/sharedMailerModels.ts) and mirrored into the founding-campaign workflow:

- experimental 9 × 12, 14 pt shared mailer;
- 5,000 pieces as the planning quantity;
- 24 equal slot-units at a proposed $349 per paid unit;
- $8,376 at 24 paid units as the full funding goal;
- approximately $2,500 of target pre-income-tax owner economic surplus after editable campaign costs, reserves, and owner-labor valuation;
- the current reservation workflow represents one advertiser/category and one paid slot-unit per paid reservation; multi-unit advertiser purchasing is future work and is not implemented.

These are editable planning assumptions, not verified economics or a promise of delivery or results. High Response Marketing guidance describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15, so the requested 24-unit 9 × 12 layout is experimental rather than production-proven. Checkout and print authorization remain disabled until the exact 24-unit artwork passes physical/postal preflight and every current quote and economics input is complete.

## What changed

The maintained starting application was a broad Firebase CRM with inconsistent pricing/reach claims, an unreadable public co-op collection, browser-side admin assumptions, fake/random EDDM route output, manual “paid” states presented as revenue, and a webhook that could not safely maintain cleared funding. Several legacy screens existed but did not form a secure cooperative-mailer workflow.

The local implementation now provides:

- truthful owner-managed public positioning and one honest pre-launch campaign;
- a free, private campaign-fit-preview request that promises only manual review of route/audience fit, format, and next-step evidence—never results, instant availability, or silent marketing consent;
- original statewide service pages for `/california-postcard-mailing` and `/pizza-box-advertising`, with descriptive metadata, visible FAQs, safe FAQ structured data, and quote-only boundaries rather than a search-ranking claim;
- a request-time price-visibility gate across all eight rendered public price surfaces that withholds numeric planning prices and derived funding goals as soon as the dated supplier snapshot or either shared economic floor stops passing, without waiting for a redeploy;
- a sanitized database-backed public campaign projection with distinct loading, error, empty, and published states;
- a typed campaign, inventory, category, reservation, payment, cost, proof, tracking, consent, and audit model;
- a one-owner prospect desk with qualification evidence, DNC, follow-ups, history, search/filter/sort/pagination, bulk updates, safe CSV import/export, and duplicate/conflict warnings;
- an owner-only native CRM that unifies quote inquiries, qualified prospects, reservation interests, stages, internal tasks, notes, source context, and eight first-party workspace add-ons without an extra CRM subscription;
- 13 copy-only outreach templates based on a no-call-required, permission-first workflow;
- transaction-based category and placement holds with server-owned prices;
- an owner-reviewed interest inbox and transactionally single-current invitation gate before any paid hold; replacement/status changes revoke the prior code, and reservation intake rechecks and consumes the exact active interest binding;
- one-time, manually copied, reservation-scoped business-portal links backed by hashed revocable sessions;
- paid-reservation coupon drafting with an owner publication gate and optional disabled-by-default AI field assistance;
- hosted Stripe Checkout code behind independent activation gates, including a bounded transactional review that blocks unresolved active-model payment/reservation ledgers and fails closed on review-query overflow;
- verified, idempotent Stripe webhook handling for paid, failed, expired, refunded, and disputed states;
- editable route/cost evidence and a server-enforced print-readiness gate with a configured $2,500 pre-income-tax economic-surplus floor and 20% minimum margin;
- a bounded planning-only whole-route optimizer that operates only on owner-imported evidence and never fetches, orders, or changes a verified plan automatically;
- an audited funding-to-proofing-to-print-to-delivery lifecycle that records evidence but never orders a vendor service;
- structured immutable creative briefs, immutable private material versions with explicit asset-rights attestations, proofs bound to the exact current brief/material/placement versions, exact-version approval evidence, and owner review;
- a bounded, owner-only, read-only Production Board that fails closed on blockers, unknowns, record errors, truncated reads, partial refunds, or contradictory pointers and exports a formula-safe no-contact-PII CSV;
- unique QR/landing/coupon tracking that separates measured HTTP visits from owner-recorded advertiser reports;
- a private written delivery record and advertiser-facing measured-versus-reported report;
- a transactional refund-obligation ledger that never initiates a provider refund and reconciles only signed provider events;
- an optional verified-consent consumer list that is disabled until the owner supplies a valid address and activation flag;
- server-side owner sessions, private Admin SDK access, restrictive Firestore rules, validation, rate limits, audit events, safer uploads, security headers, and retired unsafe legacy routes;
- a local least-privilege GitHub Actions workflow for tests, typecheck, lint, and build on Node 24;
- rewritten metadata, structured data, robots, sitemaps, public policies, and mobile layouts.

See [`docs/IMPLEMENTATION_PLAN.md`](docs/IMPLEMENTATION_PLAN.md), [`docs/FACELESS_SALES_RESEARCH.md`](docs/FACELESS_SALES_RESEARCH.md), [`docs/LEGACY_RETIREMENTS.md`](docs/LEGACY_RETIREMENTS.md), and [`docs/FINAL_DELIVERY.md`](docs/FINAL_DELIVERY.md).

## Architecture

| Layer | Purpose | Trust boundary |
|---|---|---|
| Next.js App Router | Public pages, owner UI, private reservation pages, route handlers | Public content defaults to no privileged data |
| Firebase browser SDK | Owner sign-in and sanitized `publiccampaigns` read | Firestore rules restrict all other new operational collections |
| Firebase Admin SDK | CRM, quote intake, reservations, payments, proofs, tracking, consent, audit, owner APIs | Server-only credential; never expose it with `NEXT_PUBLIC_` |
| Stripe Checkout/webhooks | Hosted card collection and provider-verified payment state | Browser cannot choose price or mark a payment cleared |
| Firebase Storage | Private materials and proof binaries | Randomized private paths; owner/reservation APIs proxy exact files |
| Mailgun | Separately enabled reservation/consumer transactional messages | Public quote intake does not send email; no automated prospecting or bulk-send route exists |

Money is stored as integer cents and event times as server timestamps/UTC strings. Public campaign data lives in a separate sanitized `publiccampaigns` collection rather than exposing private campaign, reservation, payment, or advertiser documents.

## Safety state machine

```text
verified prospect
  -> manually approved message
  -> reviewed interest and single-use invitation
  -> category/slot hold
  -> 24-unit template preflight + current quote/full economics + activation gates
  -> hosted checkout
  -> provider-verified cleared payment
  -> structured creative brief + rights-attested material
  -> proof bound to the exact brief/material/placement versions
  -> written exact-version approval evidence
  -> funding + advertiser + route + cost + margin + final-artwork gates
  -> exact owner readiness confirmation
  -> vendor ordering remains a separate, manual action
```

An inquiry, interest record, hold, invoice, returned checkout URL, pending transfer, failed payment, cancellation, refund, or dispute never counts as cleared funding. Reaching the funding goal alone never authorizes printing.

## Local setup

### Requirements

- Node.js 20 or newer
- npm
- A Firebase project only when testing authenticated/database flows
- Java 21 or a currently supported Java runtime when running the Firebase Emulator Suite

Install and start:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Public pages build without credentials and show an honest unconfigured/pre-launch state. Authenticated and database-backed flows require the server settings below.

### Environment variables

| Variable | Required for | Notes |
|---|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Browser auth/public board | Firebase web-app value; not a server credential |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Browser auth | Firebase web-app value |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Browser auth/public board | Must match the Admin project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Browser config/fallback bucket | Prefer the server-only bucket value for Admin uploads |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase web app | Firebase web-app value |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase web app | Firebase web-app value |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Server database/auth/storage | Full service-account JSON or its base64 encoding |
| `FIREBASE_PROJECT_ID` | Split Admin credential | Alternative to the JSON variable |
| `FIREBASE_CLIENT_EMAIL` | Split Admin credential | Alternative to the JSON variable |
| `FIREBASE_PRIVATE_KEY` | Split Admin credential | Preserve escaped newlines; server normalizes them |
| `FIREBASE_STORAGE_BUCKET` | Private uploads/proofs | Exact Admin bucket name |
| `OWNER_EMAIL` | Server owner authorization | Token email must be verified; legacy browser CRM access additionally requires `admin=true` on the same Firebase UID |
| `PAYMENTS_ENABLED` | Final server payment switch | Keep `false` until the activation checklist is complete |
| `STRIPE_SECRET_KEY` | Hosted Checkout | Server-only; test mode first |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification | From the exact deployed/test endpoint |
| `MAILGUN_API_KEY` | Transactional delivery | No prospect bulk send is implemented |
| `MAILGUN_DOMAIN` | Transactional delivery | Verify the domain and sender before use |
| `BUSINESS_POSTAL_ADDRESS` | Compliant commercial/consumer email | Real deliverable address; required before consumer list activation |
| `NEXT_PUBLIC_SITE_URL` | Canonical checkout/links | `http://localhost:3000` locally; exact HTTPS origin in production |
| `TRACKING_HASH_SECRET` | Privacy-reduced network hashes | Long random server-only secret |
| `CONSUMER_EMAIL_ENABLED` | Consumer signup | Keep `false` until address, sender, suppression, and delivery are verified |
| `AI_COUPON_GENERATION_ENABLED` | Optional coupon drafting | Keep `false`; manual coupon drafting remains available |
| `OPENAI_API_KEY` | Optional coupon drafting | Server-only billed provider credential; never use `NEXT_PUBLIC_` |
| `OPENAI_COUPON_MODEL` | Optional coupon drafting | Optional model override; verify support and price before activation |
| `AI_COUPON_DAILY_QUOTA` | Optional coupon drafting | Per paid reservation and UTC day; invalid values fall back to 5 and code caps at 10 |

Never commit `.env.local`, service-account JSON, Stripe keys, Mailgun keys, subscriber data, or private upload URLs.

These are all 25 application-specific variables in `.env.example`. The Admin SDK also supports Application Default Credentials when `GOOGLE_APPLICATION_CREDENTIALS` is deliberately configured outside the repository; `NODE_ENV` and Vercel's `VERCEL` signal are platform-provided runtime values, not additional CaliforniaMailer secrets.

## Database and migration

### New operational collections

The 33 new server-owned collections are:

- `campaigns`, `publiccampaigns`, `placementslots`, `categoryclaims`
- `reservationinterests`, `reservationinvites`, `reservations`, `reservationdedupe`
- `payments`, `paymentevents`, `refunds`
- `creativebriefs`, `materials`, `proofs`, `proofapprovals`
- `trackinglinks`, `trackingcouponclaims`, `trackingevents`, `trackingreports`, `deliveryreports`
- `subscribers`, `suppressions`, `consentrecords`
- `quoteinquiries`, `crmsettings`, `publicrequestguards`
- `mailterritories`, `routeplans`
- `advertiserportalinvites`, `advertiserportalsessions`
- `coupons`, `couponaiusage`
- `auditlog`
- expanded existing `prospects` and append-only `activities`

The implementation does not delete legacy Firestore documents. Old generic screens are redirected because their manual revenue, raw-link, or multi-user behavior was unsafe. Their collections remain for explicit owner-reviewed migration.

### Required migration sequence

1. Export/backup the existing Firestore database.
2. Inspect any existing `publiccampaigns` documents while they remain private. Before enabling the new public read rule, delete legacy projections or republish them through the reviewed current server publish flow so old raw `placements.priceCents` and `fundingGoalCents` fields cannot linger. Do not hand-edit or trust an old projection.
3. Install Java and authenticate the Firebase CLI.
4. Run the Firestore emulator and validate `firestore.rules` plus `firestore.indexes.json`; this was not possible in the current session.
5. Review the Firebase project, storage bucket IAM/rules, authorized domains, OAuth consent, and the exact owner identity. Assign `admin=true` to the same Firebase UID that owns legacy CRM documents, keep `OWNER_EMAIL` aligned, then sign out and back in so the refreshed ID token carries the claim.
6. Deploy rules and indexes only after that review:

   ```powershell
   firebase use <approved-project-id>
   firebase deploy --only firestore:rules,firestore:indexes,storage
   ```

7. Sign in at `/owner-login`, open `/launch`, and choose **Initialize real pre-launch record**. This writes one zero-funded campaign with the versioned 24-unit experimental plan and categories paused.
8. Review and publish the sanitized pre-launch projection from `/launch`.
9. Review real legacy prospects individually. Export/sanitize them, map them to the new CSV template, and import only records with a verifiable public business source. Do not automatically migrate old `coopspots`, invoices, manual payments, proofs, offers, access codes, or “paid” states.

Initialization and publication do not enable checkout, send email, or authorize print.

## Owner workflows

### Native CRM and first-party add-ons

- `/crm` joins prospects, reservation interests, and persisted public quote inquiries in one owner-only pipeline. It supports search, stage filters, internal next actions, factual notes, quote review, and safe promotion to an unqualified prospect.
- Quote promotion preserves an immutable snapshot of the requested service, area, quantity, mailer, message, contact preference, reply permission, and notification state. It does not send a response or infer qualification.
- The add-on registry controls visibility of the CRM, pipeline, tasks, templates, economics, proofs, refunds, and tracking modules. A toggle cannot activate Mailgun, SMS, calling, Stripe, printing, postage, storage, or any other provider.
- The CRM action API cannot manufacture a reservation, payment, proof approval, or delivery event, and only the server payment ledger contributes campaign funding. Retained legacy prospect paid/reserved/cleared/sold values are displayed and exported only as unverified notes, map to the manual **Interested** stage rather than locked **Paid**/**Reservation**, and cannot be newly authored under the client rules. Only server-owned reservation-interest state can create the locked **Reservation** stage.
- The public quote endpoint uses strict same-origin JSON intake, deterministic retry idempotency, and Firestore-backed atomic IP/email throttling. It stores one private CRM inquiry marked `accepted`/`queued`; notification remains `not_queued_disabled` and no email or other outbound message is attempted.

### Faceless sales

“Faceless” means asynchronous and no-call-required, not anonymous. The owner and accurate sender identity remain visible.

1. Use `/prospects` or `/import` to record only manually reviewed businesses.
2. Keep missing evidence in **Researching**. Only a qualified, non-DNC record with official source, territory fit, category, and real advertising/offer evidence can become **Ready to contact**.
3. Use `/sales-desk` to copy a template. The app does not send it or mark it delivered.
4. Add a real personalization signal, commercial-solicitation disclosure, valid postal address, and one-step opt-out.
5. Send manually from the owner-approved mailbox, then log the factual activity in `/activities`.
6. A reply pauses follow-ups; an opt-out sets DNC. Use at most the initial message and two restrained follow-ups unless the prospect engages.
7. Never describe a private concept as approved/published, invent an offer, imply another reservation, promise response, or front an unpaid placement.

The research basis and source cautions are in [`docs/FACELESS_SALES_RESEARCH.md`](docs/FACELESS_SALES_RESEARCH.md).

### Free fit preview and statewide service intake

- `/quote` offers a free private campaign-fit preview for manual review. It collects the requested California market, service type, quantity, format, contact preference, reply permission, and project details, but it does not create a quote, reserve inventory, grant ongoing marketing consent, send a message, or start checkout.
- `/california-postcard-mailing` covers one-business EDDM and addressed postcards throughout California. Printing4SuperCheap is the required printer and USPS is the documented mail-delivery channel. Exact routes or addressed-audience evidence, postal method, list responsibilities, and a current project quote remain mandatory.
- `/pizza-box-advertising` covers partner-distributed coupon sheets or flyers throughout California. Printing4SuperCheap is the required printer, but the restaurant—not USPS—distributes the approved piece. Each market needs a named restaurant location, signed distribution agreement, verified box volume, defined quantity/period, exact handoff, and completion-evidence plan.
- Both statewide pages are original, crawlable service explanations with canonical metadata, FAQs, and internal links. They create no guarantee of ranking, reach, response, restaurant availability, category exclusivity, or statewide fulfillment.
- Both services remain quote/intake-only. A customer price or future payment path must use a current signed-in Printing4SuperCheap total and complete costs that clear both the configured $2,500 pre-income-tax economic-surplus floor and 2,000 bps (20%) minimum margin. Neither service currently has an independent production/order state machine.

### Campaign economics and print gate

1. Open `/eddm`, create the mailing territory, and record route rows from a dated USPS EDDM lookup or documented Printing4SuperCheap route quote. The server derives every aggregate; the browser cannot submit a trusted total.
2. Verify the immutable plan while its evidence is current, then attach it to the founding campaign with `APPLY ROUTES TO FOUNDING CAMPAIGN`. Attaching or replacing routes revokes economics, checkout, artwork-preflight, and print-readiness approval.
   If the same attached immutable plan is later rechecked against its external source, the owner must use the exact recheck confirmation and provide an evidence reference. The transaction revalidates its identity, content hash, rows, totals, territory pointer, and campaign pointer, records separate recheck evidence, and does not rewrite the original plan.
3. Obtain a written, dated quote from the configured production supplier, Printing4SuperCheap. Its public discount sheet is a planning reference only and must be rechecked immediately before quoting or ordering.
4. Enter every schedule and cost/reserve input in `/economics`; route evidence is read-only there, zero is a deliberate entered value, and blank is unknown.
5. Confirm mail-piece count, planned dates, and artwork preflight. The owner form renders the stored reservation instant in the browser's local time; the API stores an offset ISO instant and rejects an end before the start, a nonfuture deadline, or a deadline whose Pacific calendar date is not before delivery start.
6. The server recalculates complete cost, payment fees, reserves, owner-labor value, the shared `MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS` floor ($2,500), the shared `MINIMUM_ECONOMIC_MARGIN_BPS` floor (2,000 bps / 20%), required cleared revenue, and bounded fill sensitivity. A custom SKU mix receives a total-revenue requirement and average benchmark—not a false uniform price. The API rejects a non-null target below $2,500; cost summary, readiness, and operational gates independently fail low legacy targets/margins, and stored margin evidence is normalized to at least 2,000 bps on economics update.
7. Any economics update revokes prior owner readiness approval.
8. `APPROVE PRINT READINESS` is accepted only when every other gate passes. It records readiness; it does not contact a printer, order anything, or spend money.

### Mailing areas and carrier routes

- `/mailing-areas` is the public, searchable campaign-zone directory. It shows exact counts only from a fresh verified plan and otherwise shows an honest planning state.
- `/eddm` is the owner-only territory and route workspace. Route plans are immutable versions backed by a dated source record; an edit creates a new version.
- The v1 workflow is manual evidence capture. It links to the official USPS planner and accepts a documented Printing4SuperCheap route quote, but it does not scrape USPS, reproduce the USPS map, or place an order.
- The optional optimizer finds the closest nonempty whole-route subset to an owner-entered target from at most 50 imported rows. Ties prefer at-or-under, then fewer routes, then canonical ZIP/route order. Applying a suggestion changes only the editable draft rows; the owner must still create, verify, and attach a dated immutable plan explicitly.
- Mailing area, campaign category exclusivity, and protected operator/franchise territory are different concepts. CaliforniaMailer does not promise a protected operator territory.
- A complete EDDM route set may not total exactly 5,000 or 10,000 deliveries. Quotes and economics must use the current selected-route total rather than silently replacing it with the marketing target.
- The founding 5,000-piece model accepts attachment only when current residential route coverage is 90%–100% of that quantity. This is an internal waste/compatibility guard, not a USPS rule; a materially different count requires a different versioned campaign model.
- Competitor observations, source links, and the authorized-API boundary are documented in [`docs/MAILING_AREA_RESEARCH.md`](docs/MAILING_AREA_RESEARCH.md).

### Cross-format, single-business, and small shared mailers

- `/quote` keeps the founding co-op, a small partner mailer, single-business EDDM, and addressed targeted solo mail as separate quote models.
- The free fit preview is a manual qualification step, not free finished creative, a guaranteed quote, a route reservation, or authorization to contact the requester beyond the submitted inquiry.
- `/shared-mailer-calculator` compares the versioned shared-mailer catalog without treating formats as interchangeable: experimental 9 × 12, larger 12 × 15, six-unit M6, custom split-layout M7–M9 concepts, M3, community cards, new-mover cards, and directory cards.
- The catalog stores $349 and $479 equal-unit planning prices for the experimental 5,000- and 10,000-piece 9 × 12 scenarios. The public page shows either only while its dated Printing4SuperCheap snapshot remains inside the 30-day planning window and the configured complete safeguards still clear both the $2,500 pre-income-tax surplus floor and the 2,000 bps (20%) minimum margin. Every other shared format is quote-only.
- EDDM choices come from the current Printing4SuperCheap catalog and discount sheet. Smaller targeted pieces are not mislabeled as EDDM.
- The owner-only `/eddm` page combines dated route evidence with supplier-cost references and the current USPS EDDM Retail rate. Unknown tax, design, list, bundling, delivery, or other costs remain unknown rather than becoming zero.
- Public inquiries choose a model, piece, quantity, target area, and fulfillment preference. They cannot submit a price, reserve inventory, start checkout, or place a print order.

### Reservation-scoped business portals and coupons

- `/business-portals` creates a one-time invite for one reservation/business placement only. Invite lifetimes are 1, 24, 72, or 168 hours; the database-backed session lasts 30 days unless expired, logged out, superseded, or revoked.
- Raw invite/session tokens are never stored. The invite token travels in a URL fragment, is removed before submission, and produces an `HttpOnly`, `SameSite=Lax`, secure-in-production `cm_reservation_{reservationId}` cookie. The owner copies the link manually; the app sends nothing.
- `NEXT_PUBLIC_SITE_URL` must be the canonical HTTPS origin in production. Revoke-all increments the reservation access version, clears legacy access, and invalidates every earlier invite/session binding.
- A paid reservation with its exact active tracking record may save and submit coupon drafts. Owner publication requires the exact submitted version and confirmation phrase; public content is a separate snapshot and remains unavailable unless payment, tracking, reservation ownership, and publication are all current.
- Manual coupon drafting needs no AI. Optional AI uses server-only `OPENAI_API_KEY`, `store: false`, structured two-field output, a hashed reservation-scoped safety identifier, grounded fact checks, and a durable daily quota. Automated tests make no live provider call.

### Proofs and tracking

- Each paid reservation saves immutable structured creative-brief versions covering business facts, offer, call to action, disclaimer, owner-controlled QR destination, and the exact campaign delivery window.
- Paid advertisers upload one immutable material version at a time into private quarantine with an explicit asset type, rights basis, named attestor, and source/license note where required. Only the exact latest owner-approved, rights-attested version can feed a proof.
- Each draft is a private, numbered proof bound transactionally to the exact reservation, campaign, placement slot, creative-brief ID/version, material ID/version, and previous-proof pointer. Only the exact latest version can be approved or sent back for revision; approval requires a recorded approver and timestamp.
- `/production-board` is an owner-only, bounded, read-only view. It combines exact reservation, canonical payment, creative, material, proof, tracking, coupon, and portal pointers; truncated or contradictory evidence stays unknown/error and can never be promoted to ready. Its CSV excludes contact PII, raw tokens, storage paths, and coupon content.
- Production readiness requires exactly one canonical provider-verified payment for each paid reservation, bound to the current campaign/plan/offer/currency and original quote, with the full amount cleared and zero refund. A partial refund, duplicate/orphan/mismatched payment, or unresolved ledger fails closed even if aggregate net funding appears sufficient.
- Tracking records start inactive. The owner verifies the public HTTPS destination and then activates the unique redirect/QR/coupon. A full provider refund deactivates tracking; a partial refund reduces cleared net funding but does not by itself deactivate an otherwise valid link. An open or non-won dispute suspends tracking. A won dispute restores a previously active link only when payment and exact inventory ownership reconcile; otherwise the record remains inactive/manual-review.
- Redirect requests are measured HTTP events, with likely bots labeled separately. Calls, leads, appointments, sales, and advertiser notes are explicitly owner-recorded advertiser reports.

### Refunds

Refunds are intentionally not automated. `/refunds` records an obligation against the remaining cleared net payment, supports transactional approve/reject decisions, and lets the owner record an external provider reference. It never calls Stripe. The obligation continues to block print readiness until a signed `charge.refunded` webhook confirms a compatible amount. Partial provider refunds that do not match complete recorded obligations stay unresolved for manual review rather than being guessed.

## Test and verification commands

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm audit --audit-level=high
```

`npm run check` runs tests, type checking, and the production build. Lint and the dependency audit should also remain separate release gates.

The final local verification pass on August 20, 2026 recorded:

- 239 of 239 automated business/security tests passing;
- clean TypeScript and repository-wide ESLint;
- a supported webpack production build (`npx next build --webpack`) whose generation phase completed 69/69 static pages; the source tree contains 56 `page.tsx` files and 36 `route.ts` handlers;
- 21 indexed sitemap URLs with zero generated `lastmod` values, including both statewide service pages and all eight request-time public price surfaces, with private, tokenized, coupon, owner, and redirect-only routes excluded;
- the default Turbopack `npm run build` was environment-blocked in this writable clone because its temporary `node_modules` junction points outside Turbopack's filesystem root; a normal local `npm ci` directory is still required to verify the exact default CI command;
- `npm audit --offline --audit-level=high` reporting zero vulnerabilities for the installed lockfile/cache snapshot; an online registry refresh remains a release-time check;
- a `.github/workflows/ci.yml` in the local tree using Node 24, least permissions, concurrency cancellation, and full-SHA action pins. It is unpushed and has never run on GitHub;

- category conflicts and exclusive purchase rules;
- unpaid hold expiry;
- reserved/pending/cancelled/disputed/refunded funding behavior;
- proof and print-readiness blocking;
- prospect normalization, duplicate detection, qualification, DNC, and CSV formula safety;
- tracking destination safety;
- owner/private-data security boundaries;
- static coverage for public price freshness, private-route boundaries, mobile navigation, honest loading/error/empty states, canonicals/noindex, and route redirects;
- browser QA at 390 × 844 and 1440 × 900 for `/home`, `/quote`, `/california-postcard-mailing`, `/pizza-box-advertising`, and `/sample-card`, with no horizontal overflow; `/production-board` redirected unauthenticated access to owner login. A React development warning on `/quote` was traced to browser-extension-injected `fdprocessedid` attributes rather than source markup divergence.

No live Stripe, Mailgun, Firebase, USPS, printer, subscriber, or production end-to-end transaction was performed.

## Deployment instructions

Deployment requires explicit owner approval. Do not run these steps as an implicit continuation of local work.

1. Complete the manual account, legal, economics, storage, and emulator checks below.
2. Create a deployment-specific environment set in Vercel. Keep `PAYMENTS_ENABLED=false` and `CONSUMER_EMAIL_ENABLED=false`.
3. Deploy Firestore rules, indexes, and Storage rules from the reviewed commit.
4. Run all local release gates.
5. Deploy a preview and test public pages, owner sign-in, database error states, private files, and security headers.
6. Configure a Stripe **test-mode** webhook for:
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.expired`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
7. Exercise test-mode holds, duplicate checkout events, failures, expiry, partial/full refunds, and disputes; reconcile Firestore to Stripe.
8. Verify Mailgun sender/domain, valid postal address, reply path, opt-out process, and suppression handling with self-addressed transactional tests only.
9. Re-run production browser checks and inspect logs without exposing request bodies or personal data.
10. Only after a separate owner decision may the production deployment occur. Payment activation and consumer-email activation remain separate later decisions.

## External accounts and owner approvals still needed

- Firebase provider reauthentication, project/app ownership, a reviewed service account, the exact `admin=true` owner claim, Auth authorized domains, deployed rules/indexes, and private Storage/IAM review
- Vercel release approval and a complete reviewed environment set; provider identity is verified, but server Firebase Admin credentials and the canonical site URL were absent by name at audit time
- Stripe business/identity completion, test/live keys, webhook endpoint, refund/dispute procedure, and payment activation approval
- Mailgun verified sender/domain and transactional-delivery test
- a real business postal address and final sender identity
- official USPS route selection or documented provider route data
- current printer, shipping, and postage quotes
- California legal review of final terms, privacy, advertiser agreement, funding/refund policy, content review, and outreach practice
- a storage malware-scanning/quarantine decision before accepting production files at scale

## Known limitations and open security work

- The current integrated tree is local and unpushed. A read-only August 20 audit verified Vercel project `californiamailer` and a ready apex production alias at baseline GitHub `main` SHA `4da58ef`; `/business-login`, `/crm`, the statewide service pages, Production Board, and the new territory/portal APIs were absent there. `www.californiamailer.com` did not resolve.
- Vercel contained only the six public Firebase names plus Mailgun and Stripe names across Production/Preview/Development. Values were never accessed. No Firebase Admin credential name, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`, activation flag, tracking secret, or AI variable was present, so the local server features are not production-configured.
- Local Firebase configuration names project `californiamailer-1998`, database `(default)` in `nam5`, and four composite indexes. Provider reads returned HTTP 401 from an expired/invalid CLI credential; Firebase app identity, IAM, data, billing, and deployed rules/indexes remain unknown. Rules were not emulator-tested because Java is unavailable.
- GitHub `main` was unprotected with no Actions workflows/checks, no remote `codex/faceless-sales` branch, and no open PR at audit time. The new CI workflow remains local and cannot be treated as a passed provider check.
- Quote intake uses durable Firestore transaction limits. Some other disabled or lower-risk public flows still use memory-local per-instance limits and need a shared limiter before those features are activated at meaningful traffic.
- Honeypots and strict validation are present, but no CAPTCHA or managed bot service is configured.
- Uploads use type/size/magic-byte checks, private randomized paths, and quarantine/manual review. There is no antivirus/malware scanner.
- Storage bucket IAM, retention, access logging, and CORS were not verified against a live project.
- Stripe code passed unit/static/build checks but not provider test-mode end-to-end tests.
- Mailgun and subscriber flows were not exercised with a real sender.
- The native CRM MVP reads the newest 500 records per source and 1,000 activities and warns when that cap may truncate results; cursor pagination, retention/redaction tools, and a global cross-source suppression workflow remain future work.
- Existing legacy prospect operational values remain stored as explicitly unverified notes until the owner clears them. The form, bulk actions, import, CRM mapping, and Firestore rules prevent those client-authored notes from becoming new paid/reserved claims or locked pipeline stages; they still require owner review during migration.
- CRM add-ons are first-party workspace modules, not free external delivery: printing, postage, email, SMS, calling, payments, storage, data, and analytics can still carry provider usage costs if separately approved and activated.
- Reservation access relies on an HTTP-only browser cookie; an owner-assisted recovery/reissue workflow is still needed for a customer who loses that browser session.
- Tracking visits are evidence of an HTTP request, not a household, lead, customer, or sale.
- Full-refund and dispute webhooks now deactivate or suspend matching tracking state transactionally. A partial refund updates cleared net funding without automatically deactivating an otherwise valid link. A won dispute restores only a previously active link with exact current ownership; full refund, non-won dispute, or ownership mismatch remains inactive.
- A closed non-won/lost dispute intentionally keeps its slot/claims occupied and its payment/reservation disputed rather than guessing an inventory release. That inventory-release policy remains an owner/legal/provider decision. Checkout activation now transactionally reviews the founding campaign's active-model reservations and payments, blocks `payment_review`/`disputed` reservations and `pending`/`manual_review`/`disputed` payments, and fails closed for manual review above 100 records in either query. This guard still requires Firebase emulator and Stripe provider testing before payment activation.
- The founding campaign safely enforces one advertiser per category plus configured bidirectional conflicts. Parent-category labels and `maximumAdvertisers` are stored, but the UI intentionally exposes no multi-advertiser or conflict-override mechanism yet; an audited exception workflow remains future work.
- Delivery evidence is an owner-entered reference and date, not an independently verified carrier API event. One immutable advertiser-visible delivery record is supported per tracking record.
- Exact routes, household count, delivery dates, costs, campaign contract, and profitability remain unknown.
- Payment and consumer-email switches remain off. There is no permission to enable them.

## Founding planning economics

Active planning version: `shared-mailers-v2`, model `shared-9x12-5000`.

| Item | Calculation | Planning value |
|---|---:|---:|
| Format | 9 × 12, 14 pt | Experimental 24-unit layout |
| Mail quantity | Planning input | 5,000 pieces |
| Paid slot-units | Full plan | 24 |
| Proposed unit price | Editable assumption | $349 |
| Full funding goal | 24 × $349 | $8,376 |
| Owner economic-surplus target | Pre-income-tax planning target | Approximately $2,500 |
| Minimum economic margin | Configured production floor | 20% (2,000 bps) |

The $2,500 target is calculated only after the model's editable complete campaign costs, reserves, processing fees, and owner-labor valuation. The authoritative founding-campaign gate requires both that fixed floor and the configured 20% minimum margin; clearing one does not waive the other. Neither is guaranteed profit, personal after-tax take-home, or a substitute for cash-flow planning. The 24-unit models enforce a 16–24 paid-fill range and show 16/18/24 sensitivity. A separate calculator mode keeps the $2,500 floor while also matching the active model's dated economic margin across formats. Missing costs stay unknown rather than becoming zero.

The owner calculator's 10% tax-contingency reset values are exactly $120.90 for the dated $1,209 print component at 5,000 pieces and $229.90 for the dated $2,299 print component at 10,000 pieces. They are editable safeguards that must be replaced with the current signed-in supplier total. At 24 paid units, the stored $349 scenario models a 33.73% pre-income-tax economic margin and the $479 scenario models 23.47%; both clear the fixed $2,500 floor, but $479 does not match the 5,000-piece margin. These are planning assumptions, not instant customer quotes or authorization to accept payment.

The 24-unit 9 × 12 layout also remains a release gate. Current HRM guidance supports roughly 16–18 comfortable ads on 9 × 12 and about 25 on 12 × 15. Until an exact 24-unit 9 × 12 template passes postal clear-zone, indicia, branding, disclosure, bleed, safe-area, and legibility review, the catalog and calculator cannot make it production-ready. A current signed-in Printing4SuperCheap total, exact routes, and complete economics are also required before checkout or print can activate.

Do not describe the campaign as profitable from these planning figures.

## Exact first advertiser-list sequence

1. Configure the real owner identity, postal address, owner account, and public reply method.
2. Initialize and publish the zero-funded pre-launch record; leave all category/payment activation controls off.
3. Select and document real routes and obtain the printer/postage/shipping/processing inputs.
4. Enter economics. If the proposed price, goal, or inventory fails the margin gate, change the central assumptions before outreach—not after accepting money.
5. Obtain legal review of the advertiser agreement, terms, refund/funding policy, privacy language, and content standards.
6. Define enough non-sensitive, non-overlapping categories and backup prospects for the proposed paid-unit plan. Start with categories whose businesses visibly advertise and serve the selected territory. The current implementation supports one paid slot-unit per advertiser reservation; multi-unit advertiser purchasing remains future work.
7. Build the first validation list as **40 individually reviewed businesses** across the highest-priority categories. Use official business sites and public business contact channels; do not buy a list or scrape personal emails from restricted sources.
8. Download the CSV template from `/import`. For every row record business/category, official source, website, territory fit, one observable advertising/offer signal, public contact source, priority, and notes. Leave uncertain evidence as `researching`.
9. Import in preview mode, resolve duplicates and category warnings, then commit only the clean qualified rows.
10. Review each prospect in `/prospects`. Mark **Ready to contact** only after the qualification gate passes and DNC is clear.
11. Create one private 45–60 second concept for the strongest prospect in each category. Label it `CONCEPT — NOT APPROVED OR PUBLISHED`; use only verified public facts.
12. In `/sales-desk`, copy the first-touch template, add one real personalization signal plus the required address/disclosure/opt-out, and manually approve it. No call is required.
13. Send only through the owner-approved mailbox after separate outreach authorization. Log the actual send in `/activities`; the app never infers delivery.
14. Follow up at most twice on the documented cadence. Stop immediately on opt-out, negative reply, complaint, poor fit, category conflict, or stale evidence.
15. Record positive replies as interest only. Do not imply a hold or sold category until the transactional reservation succeeds; do not enable checkout until economics, policies, provider testing, and owner approval are complete.
16. Review the scoreboard after the first 40 qualified contacts: delivered/bounced, replies, positive replies, opt-outs/complaints, reservation interest, cleared payments, refunds/fees, and owner hours. Change one variable at a time; never manufacture urgency or add features to hide weak evidence.

## Dependency changes

`qrcode` and `@types/qrcode` were added to generate unique owner-controlled QR assets. Core production packages were updated to currently patched Next.js, React, Firebase Admin, Stripe, Zod, Sharp, and related transitive versions. No paid software dependency was added.
