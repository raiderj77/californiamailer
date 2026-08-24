# CaliforniaMailer final local delivery

Date: 2026-08-21<br>
Branch: `codex/faceless-sales`<br>
Baseline: `main` at `4da58ef`<br>
Working location: repository root<br>
Maintained source: configured local origin

This is an integrated-tree implementation handoff. Draft PR #3 is open; the exact current PR head and its live GitHub Actions checks are the review authority. Nothing was deployed, and production remains on baseline `main` commit `4da58ef`. No real outreach, subscriber campaign, payment, refund, printing, postage, restaurant distribution, vendor order, advertiser record, provider activation, or production migration was performed.

## 1. Original project condition

The maintained project was an existing Next.js 16 / React 19 application with Firebase, Stripe, Mailgun, Vercel configuration, owner CRUD screens, and scattered direct-mail concepts. The task-directory repository was empty; the maintained sibling repository above was verified as the clean canonical project before changes.

The baseline did not safely operate the proposed business. Public pricing, reach, timing, team, EDDM, and performance claims conflicted or lacked evidence. The public co-op board silently converted a Firestore permission failure into apparently empty inventory. Campaign records did not distinguish interest, holds, pending payment, cleared payment, refund, dispute, proof, economics, or print readiness. The webhook used a browser Firebase client from a server route and could not safely maintain funding. Fake/random EDDM routes, manual paid/revenue states, raw legacy access links, broad team screens, and unsupported city pages were not suitable for a one-owner launch.

## 2. Summary of changes

- Repositioned the public site as a truthful owner-managed California direct-mail service with one pre-funded Monterey Peninsula validation campaign plus quote-only statewide service intake.
- Added a free private campaign-fit-preview offer that stores a request for manual review without promising finished creative, results, availability, a reservation, automatic outreach, or ongoing marketing consent.
- Added original `/california-postcard-mailing` and `/pizza-box-advertising` service pages with canonical metadata, visible FAQs, safe FAQ JSON-LD, internal links, and explicit fulfillment boundaries. Their copy is relevance-focused but makes no ranking guarantee.
- Added the versioned `shared-mailers-v2` planning catalog and active `shared-9x12-5000` experiment: 9 × 12, 14 pt, 5,000 pieces, 24 equal slot-units proposed at $349 each, and an $8,376 full funding goal. The approximately $2,500 owner target is pre-income-tax economic surplus after editable labor, reserves, and complete campaign costs—not guaranteed or personal after-tax take-home.
- Added cross-format planning for 12 × 15, six-unit M6, custom split-layout M7–M9 concepts, M3, community, new-mover, and directory cards. Non-active formats remain quote-only until their exact layout, audience, quantity, fulfillment, and complete costs are supplied.
- Rebuilt the public campaign board around a sanitized `publiccampaigns` projection with explicit loading, error, empty, preview, and real-published states.
- Added one request-time public planning-price gate across the homepage, advertiser, pricing, campaign, sample, funding, reserve, and board experiences. It withholds numeric unit prices and derived goals when the dated supplier observation or complete safeguards no longer pass, without waiting for a new build.
- Expanded the prospect desk with source evidence, qualification, full status sets, DNC, follow-ups, search/filter/sort/pagination, bulk status, import/export, duplicate checks, conflict warnings, and history.
- Added a copy-only faceless sales desk with 13 written templates. It has no send button and requires manual owner review.
- Added real interest intake, an owner inbox, and a transactionally single-current reviewed invitation before category/slot holds and hosted Stripe Checkout. Replacement or status changes revoke the prior current code; reservation intake rechecks the exact active, invited, non-suppressed interest binding and consumes it atomically. Checkout activation independently blocks unresolved active-model payment/reservation ledgers and fails closed when either bounded review query exceeds 100 records.
- Added manually delivered one-time business-portal links for one reservation/business placement, with hashed database sessions, expiry, logout, and revoke-all.
- Added paid-reservation coupon drafts, exact-version owner publication, a read-only public snapshot, and disabled-by-default server-side AI field assistance with grounding and quota controls.
- Replaced the payment ledger/webhook with signed, payload-bound, idempotent, ownership-checked handling for cleared, failed, expired, refunded, disputed, and dispute-closed states.
- Added editable route/cost evidence, margin calculations, refund obligations, material/disclaimer/proof counts, and shared server constants for a $2,500 pre-income-tax economic-surplus floor and 2,000 bps (20%) minimum margin. Economics writes, cost calculation, operational gates, public price visibility, and print readiness enforce both floors independently.
- Added a bounded planning-only optimizer that selects the closest whole-route subset from owner-imported rows without fetching provider data or mutating a verified plan.
- Added immutable structured creative-brief versions, immutable private quarantined material versions with explicit asset-rights attestations, proofs transactionally bound to the exact current brief/material/placement versions, exact-version decisions, immutable approval evidence, and audited owner review.
- Added a bounded owner-only read-only Production Board with fail-closed readiness, canonical payment and exact creative-pointer validation, private/no-store responses, safe client-side filters, and formula-safe CSV output that excludes contact PII and private tokens/paths.
- Added unique redirect/QR/coupon tracking, measured bot/non-bot/unknown HTTP-request counts, separate advertiser-reported outcomes, and a private written delivery record. A full provider refund deactivates the matched link; a partial refund updates cleared net funding without automatically deactivating an otherwise valid link; disputes suspend it; and only a won dispute with exact payment/inventory reconciliation can restore a previously active link.
- Added a non-automated refund ledger. Owner decisions and provider references are recorded locally; only signed provider events confirm money movement.
- Added an audited campaign lifecycle from fully funded through proofing, scheduled, printed, delivered, completed, or cancellation/refunding. The app records evidence but cannot order printing or postage.
- Added optional double-opt-in consumer email with consent records, unsubscribe, and suppression; it remains disabled without a real postal address and activation flag.
- Added server owner sessions/allowlisting, Admin SDK boundaries, restrictive Firestore/Storage rules, rate limits, honeypots, upload validation/quarantine, security headers, and safer error states.
- Rewrote metadata, canonicals, robots, sitemap, internal links, visual breadcrumbs, Organization/WebSite structured data, accessible mobile navigation, and public layouts.
- Retired misleading or unsafe legacy screens and documented each reason.
- Added a least-privilege GitHub Actions workflow using Node 24, full-SHA action pins, and concurrency cancellation. The live checks on draft PR #3 are authoritative for its exact current head.

## 3. Files changed

The exact added, modified, and retired file list is in [`CHANGE_MANIFEST.md`](CHANGE_MANIFEST.md). Retirement reasoning is in [`LEGACY_RETIREMENTS.md`](LEGACY_RETIREMENTS.md).

## 4. Database changes

All 33 new server-owned operational collections:

```text
campaigns
publiccampaigns
placementslots
categoryclaims
reservationinterests
reservationinvites
reservations
reservationdedupe
payments
paymentevents
refunds
creativebriefs
materials
proofs
proofapprovals
trackinglinks
trackingcouponclaims
trackingevents
trackingreports
deliveryreports
subscribers
suppressions
consentrecords
quoteinquiries
crmsettings
publicrequestguards
mailterritories
routeplans
advertiserportalinvites
advertiserportalsessions
coupons
couponaiusage
auditlog
```

Existing `prospects` and `activities` records gained the one-owner sales fields and append-only contact-history behavior. Money uses integer cents. Operational writes use server timestamps. Private data stays outside `publiccampaigns`; the public projection contains only sanitized campaign totals, dates, areas, category status, inclusions, and notes.

`firestore.rules` permits public reads only for published projections, denies browser access to the new operational collections, and requires both `admin=true` and the matching legacy record UID/owner ID for every remaining browser-written owner collection. `storage.rules` denies all browser access because private files are served only through authorized Admin SDK routes.

## 5. Required environment variables

Copy `.env.example` to `.env.local` and fill only the capabilities being tested:

```text
NEXT_PUBLIC_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID
FIREBASE_SERVICE_ACCOUNT_JSON
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
FIREBASE_STORAGE_BUCKET
OWNER_EMAIL
PAYMENTS_ENABLED
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
MAILGUN_API_KEY
MAILGUN_DOMAIN
BUSINESS_POSTAL_ADDRESS
NEXT_PUBLIC_SITE_URL
TRACKING_HASH_SECRET
CONSUMER_EMAIL_ENABLED
AI_COUPON_GENERATION_ENABLED
OPENAI_API_KEY
OPENAI_COUPON_MODEL
AI_COUPON_DAILY_QUOTA
```

Use either `FIREBASE_SERVICE_ACCOUNT_JSON`, the three split Firebase credential fields, or deliberate Application Default Credentials. Keep `PAYMENTS_ENABLED=false`, `CONSUMER_EMAIL_ENABLED=false`, and `AI_COUPON_GENERATION_ENABLED=false` until their separate checklists, provider-cost review, and owner approvals are complete. Manual coupon drafting works while AI is disabled.

The block above is the complete set of 25 application-specific variables in `.env.example`. `GOOGLE_APPLICATION_CREDENTIALS` is an optional external Application Default Credentials pointer; `NODE_ENV` and Vercel's `VERCEL` flag are platform-provided runtime signals rather than additional CaliforniaMailer configuration secrets.

## 6. Setup instructions

```powershell
Set-Location '<path-to-californiamailer>'
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Node `v24.11.1`, npm `11.6.2`, and Firebase CLI `15.1.0` were available in this session. Java was not installed, so install a currently Firebase-supported Java runtime before emulator testing. Public pages can render an honest unconfigured state without credentials; authenticated/database workflows cannot.

## 7. Local testing instructions and result

Run:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
npm audit --offline --audit-level=moderate
git diff --check
```

The normal release target remains `npm run build` after `npm ci` creates a real in-tree `node_modules` directory. In this sandbox clone only, the dependency directory is a junction to the read-only maintained repository, so Turbopack rejects it as outside the project root; `npx next build --webpack` followed by `npx next-sitemap` is the supported local verification fallback. GitHub Actions performs the normal in-tree install and default build for the exact pushed commit.

Final local results:

| Gate | Result |
|---|---|
| Automated tests | 342/342 passed on the exact candidate tree |
| TypeScript | Passed on the exact candidate tree |
| ESLint | Passed on the exact candidate tree |
| Production build | Supported webpack fallback passed static generation for 71/71 pages. Default Turbopack was environment-blocked only because this clone uses a temporary `node_modules` junction outside its filesystem root. |
| Dependency audit | `npm audit --offline --audit-level=moderate` reported 0 vulnerabilities for the installed lockfile/cache snapshot; refresh online at release time |
| Sitemap | 21 indexed public URLs; both statewide service pages and all eight request-time public price surfaces included; private, tokenized, owner, coupon, and redirect-only URLs excluded; zero generated `lastmod` values |
| Browser QA | At 390 × 844 and 1440 × 900, `/home`, `/quote`, `/california-postcard-mailing`, `/pizza-box-advertising`, and `/sample-card` had no horizontal overflow; unauthenticated `/production-board` redirected to owner login. The `/quote` React dev warning was traced to browser-extension-injected `fdprocessedid`, not source divergence. |
| CI workflow | Draft PR #3 is open; live checks are authoritative for its exact current head |
| Diff/manifest | Reconciled in `docs/CHANGE_MANIFEST.md` against baseline `main` |

No Firebase emulator, live Firebase, Stripe test/live, Mailgun, USPS, printer, carrier, subscriber, or production end-to-end transaction was performed.

## 8. Deployment instructions

Deployment is not authorized by this implementation. After explicit owner approval:

1. Back up Firestore and verify the exact Firebase/Vercel/Stripe/Mailgun projects and identities.
2. Install Java; run Firestore and Storage rule tests in the Emulator Suite.
3. Review final policies, owner identity, business address, routes, dates, and economics.
4. Configure preview-only environment values with both activation flags false.
5. Deploy reviewed Firebase rules only:

   ```powershell
   npx firebase-tools use <approved-project-id>
   npx firebase-tools deploy --only firestore:rules,firestore:indexes,storage
   ```

6. Deploy a Vercel preview, not production; rerun browser, auth, file, error, privacy, and header checks.
7. Configure a Stripe test-mode webhook for checkout completion/async success/expiry, failed intent, refund, dispute creation, and dispute closure.
8. Exercise duplicate/out-of-order events, expiry, partial/full refunds, won/lost disputes, ownership reuse, and Firestore reconciliation.
9. Test Mailgun only with approved self-addressed transactional messages and verify sender, reply path, postal address, opt-out, and suppression.
10. Obtain a separate production-deployment decision. Payment and consumer-email activation remain later, separate decisions.

## 9. Required migrations

1. Export/backup the existing Firestore database.
2. Inspect existing `publiccampaigns` documents while they remain private. Before enabling the new public read rule, delete legacy projections or republish them through the reviewed current server publish flow so raw legacy `placements.priceCents` and `fundingGoalCents` fields cannot linger. Do not hand-edit or trust an old projection.
3. Emulator-test `firestore.rules`, `storage.rules`, and `firestore.indexes.json`.
4. Add `admin=true` to the exact Firebase UID that owns the legacy records, keep `OWNER_EMAIL` aligned for server authorization, then sign out and in so browser and session tokens refresh the claim. `OWNER_EMAIL` alone does not authorize direct legacy CRM reads/writes.
5. Deploy reviewed rules/indexes/storage only after approval.
6. Sign in and initialize the founding record from `/launch`; this creates a zero-funded pre-launch campaign using the active versioned 24-unit experimental plan.
7. Review and publish its sanitized projection. Initialization/publication do not enable payment.
8. Review legacy prospects one by one and import only qualified, sourced rows through the new CSV preview. Do not migrate legacy invoices, manual paid flags, co-op spots, proofs, access codes, or revenue totals as trusted state.

## 10. Remaining manual tasks

- Establish the final legal business identity, valid postal address, sender identity, reply mailbox, and owner account.
- Select actual USPS/provider routes and record route-specific household evidence; do not substitute population.
- Obtain dated printing, postage, shipping, processing, design, and reserve inputs.
- For every statewide single-business postcard request, document the EDDM routes or addressed audience/list, exact postal method, and current Printing4SuperCheap project quote before pricing.
- For every pizza-box placement request, obtain a named restaurant partner, signed distribution agreement, verified box volume, defined quantity/period, exact handoff, category terms, and completion-evidence plan before stating availability or pricing.
- Complete an exact physical/postal preflight of the proposed 24-unit 9 × 12 artwork. HRM guidance supports roughly 16–18 comfortable ads on 9 × 12 and about 25 on 12 × 15, so 24 units on 9 × 12 are not production-proven.
- Finalize the advertiser agreement, terms, funding/refund policy, privacy notice, content standards, and outreach disclosures with California counsel.
- Emulator-test the rules and perform Stripe test-mode reconciliation.
- Verify Firebase Storage IAM/CORS/retention/logging and choose a malware-scanning process.
- Verify Mailgun domain/sender and the exact opt-out/DNC operating procedure.
- Decide whether the configured prices, funding goal, inventory, and territory pass the minimum margin once actual costs exist.
- Initialize/publish only the truthful pre-launch record; leave checkout and consumer email disabled.
- Build the first real advertiser list manually as described in section 15.

## 11. Verified provider snapshot and remaining unknowns

- Verified read-only on August 20: the Vercel project name, Next.js/Node 24 configuration, and a ready apex production alias on GitHub `main` SHA `4da58ef`. The provider project identifier is intentionally omitted. The new local routes are not deployed; `www.californiamailer.com` did not resolve.
- Vercel exposed only environment-variable names, never values. Six public Firebase names plus Mailgun and Stripe names existed across all three environments. Firebase Admin credentials, `NEXT_PUBLIC_SITE_URL`, `OWNER_EMAIL`, activation flags, `TRACKING_HASH_SECRET`, and AI names were absent, so server workflows are not production-configured.
- Local Firebase files name project `californiamailer-1998`, database `(default)` in `nam5`, and four composite indexes. Firebase provider reads returned HTTP 401 from an expired/invalid CLI credential; project/app ownership, service-account scope, Auth domains, billing, data, Storage, and deployed rules/indexes remain unknown.
- GitHub `main` was unprotected at the August 20 snapshot. Draft PR #3 is open; its exact current-head checks are visible on GitHub, and nothing has been merged or deployed.
- Stripe business/identity completion, test/live keys, exact webhook, refund/dispute procedure, and later payment activation approval
- Mailgun verified sending domain/address and transactional delivery test
- OpenAI API project/key authorization, model availability, spend limits, data controls, and later AI activation approval
- USPS EDDM Online Tool or a documented mail-service provider route source
- commercial printer and mailing-provider quotes
- valid business postal address
- California legal review
- optional malware scanning/quarantine provider if manual review is insufficient

## 12. Current known limitations

- Draft PR #3 remains unmerged; production still reflects another revision until a separately authorized release.
- Parent-category labels and `maximumAdvertisers` are stored, but the safe founding flow enforces one advertiser per category and exposes no multi-advertiser/conflict override UI yet.
- Delivery evidence is an owner-entered reference/date, not independent carrier API confirmation; one immutable delivery record is supported per tracking record.
- A full-refund webhook deactivates matching tracking. A partial refund updates the net payment ledger but does not by itself deactivate an otherwise valid link. Disputes suspend tracking; a won dispute restores a previously active link only when payment and exact inventory ownership reconcile. Full refund, non-won dispute, or ownership mismatch stays inactive/manual-review.
- A closed non-won/lost dispute deliberately keeps the slot/claims occupied and payment/reservation disputed. Releasing or retaining that inventory remains an unresolved owner/legal/provider policy decision. Checkout activation now transactionally reads founding-campaign reservations and payments, blocks active-model `payment_review`/`disputed` reservations and `pending`/`manual_review`/`disputed` payments, and fails closed for manual review when either bounded query exceeds 100 records. The guard does not alter dispute or inventory state and still requires emulator and Stripe provider testing.
- Quote intake uses durable Firestore transaction limits. Other disabled or lower-risk public flows still use an in-memory per-instance limiter.
- Honeypots and validation are present; CAPTCHA/managed bot protection is not.
- Uploads are private, randomized, magic-byte checked, size limited, and quarantined, but not antivirus scanned.
- Reservation recovery after a lost/cleared browser cookie needs owner assistance; no automated recovery link is implemented.
- Portal access is one private portal per reservation/business placement, not a reusable business-wide account. Inert expired/revoked invite/session records need a separately reviewed retention policy if automatic cleanup is desired.
- Existing legacy prospect paid/reserved/cleared/sold fields remain only as visibly unverified notes until the owner clears them. Form/bulk/import controls and Firestore rules prevent new client-authored operational claims, and the CRM maps preserved notes to manual **Interested**, never locked **Paid** or **Reservation**.
- Subscriber signup responses may still reveal some state differences to a determined address-enumeration attacker.
- Partial provider refunds that do not map to complete recorded obligations remain manual-review items.
- Exact routes, household count, dates, costs, profitability, and campaign contract remain unknown.
- The 24-unit 9 × 12 inventory is an owner-requested experiment. Neither the catalog nor a favorable calculator result proves the units fit legibly around postal clear zones, branding, and disclosures.
- Statewide postcard and pizza-box pages are inquiry/intake surfaces, not complete independent reservation, payment, scheduling, or ordering workflows. Their presence does not prove statewide capacity, restaurant availability, exclusivity, distribution, delivery, response, or search rankings.

## 13. Security concerns still open

- Emulator-test Firestore/Storage rules and transaction/concurrency behavior before deployment.
- Verify live Firebase IAM, service-account scope, storage controls, authorized domains, and audit logging.
- Perform Stripe test-mode duplicate, replay, delayed, partial-refund, and dispute testing against the exact webhook endpoint.
- Emulator- and provider-test the bounded unresolved-ledger activation guard, including active-model matches, irrelevant model versions, query overflow, duplicate/out-of-order provider events, and won/lost outcomes, before any payment enablement.
- Replace the remaining memory-local limits before activating their flows at meaningful public traffic.
- Add managed bot protection if abuse appears.
- Decide on malware scanning before production file acceptance.
- Create a documented incident/refund/dispute reconciliation procedure and owner recovery path.
- Obtain legal review of outreach, recorded communications, consent, privacy, advertiser claims, and refund terms.

No release-blocking secret was found in the checked files, and the offline dependency audit reported zero vulnerabilities for the installed lockfile/cache snapshot. Refresh the audit against the online registry at release time; neither result substitutes for provider and emulator verification.

## 14. Founding planning model and economics gate

These are versioned planning assumptions, not verified profitability:

| Item | Calculation | Planning value |
|---|---:|---:|
| Model | `shared-mailers-v2` / `shared-9x12-5000` | Active experiment |
| Format and stock | 9 × 12, 14 pt | Physical preflight required |
| Mail quantity | Planning input | 5,000 pieces |
| Equal slot-units | Full plan | 24 |
| Proposed price per paid unit | Editable planning assumption | $349 |
| Full funding goal | 24 × $349 | $8,376 |
| Target owner economic surplus | After editable costs, reserves, and labor | Approximately $2,500 pre-income-tax |
| Minimum economic margin | Configured production floor | 20% (2,000 bps) |

The calculator starts with complete campaign costs, solves percentage and per-payment processing fees from gross revenue, adds explicit reserves and owner-labor valuation, and then enforces `MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS = 250_000` and `MINIMUM_ECONOMIC_MARGIN_BPS = 2_000`. The authoritative production gate requires both; clearing one does not waive the other. The economics API rejects a non-null target below $2,500, normalizes stored margin evidence to at least 2,000 bps on update, and calculation/readiness/operational gates independently fail low legacy values. Public dated-price support also requires both shared floors. The 24-unit models enforce a 16–24 paid-fill range with 16/18/24 sensitivity. A custom price mix returns the required total revenue and an average filled-unit benchmark rather than one invented customer price. Blank inputs remain unknown rather than becoming zero.

The $2,500 target is not guaranteed profit, an intermediate cash balance, or personal after-tax take-home. It is a pre-income-tax planning result only. A current signed-in Printing4SuperCheap quote, exact routes, complete costs, and a model-specific layout are still required.

The active layout is also not production-proven: official HRM guidance describes approximately 16–18 comfortable ads on a 9 × 12 and about 25 on a 12 × 15. The 24-unit 9 × 12 must pass postal indicia/address-zone, branding, disclosure, bleed, safe-area, and legibility review. If it fails, reduce the inventory, change the economics, or move to the larger format before checkout can activate.

The cross-format calculator/catalog includes a six-unit M6 plus separate custom M7–M9 split-layout concepts, M3, community, new-mover, directory, and 12 × 15 plans. The dated 5,000- and 10,000-piece 9 × 12 prices are public only while their Printing4SuperCheap observation and complete fixed-surplus safeguards pass; undefined custom inventories are blocked until bounded. All other prices remain quote-only. No catalog selection, calculated surplus, or cleared-funding total authorizes printing.

Public page price visibility is evaluated at request time using the current UTC date rather than frozen at module load or build time. When evidence expires or a configured safeguard fails, numeric planning prices and their derived funding goals change to a written-quote-required state across all eight rendered public price surfaces.

## 15. Exact first advertiser-list sequence

1. Configure the real owner identity, valid postal address, reply mailbox, owner Firebase account, and public contact method.
2. Select actual routes and enter dated cost evidence. If the margin fails, change the central offer before outreach—not after accepting money.
3. Obtain legal review of the final campaign documents and faceless outreach process.
4. Define enough non-sensitive, non-overlapping founding categories and backups for the paid-unit plan. The current workflow supports exactly one advertiser, category, payment, and equal slot-unit per reservation; multi-unit or larger-placement purchasing is not implemented.
5. Create a first validation list of 40 individually reviewed businesses across the highest-priority categories. Use official business sites and public business contact channels; do not buy a list or scrape restricted/personal email sources.
6. Download `/templates/californiamailer-prospects.csv`. Record the official source, current site, decision maker/role, public business email, category, service area, territory fit, one observable offer/advertising signal, source-check date, priority, and notes.
7. Keep incomplete rows at `researching` with qualification `verify`. Missing evidence never silently becomes qualified.
8. Import through `/import` in preview mode. Resolve duplicates, unsafe spreadsheet values, invalid statuses, DNC, and category-conflict warnings before commit.
9. Review each row in `/prospects`; only a sourced, qualified, territory-fit, non-DNC record can enter `ready_to_contact`.
10. Prepare one private 45–60 second screen/voiceover concept for the strongest candidate in each category. Label it `CONCEPT — NOT APPROVED OR PUBLISHED` and use only verified facts.
11. Use `/sales-desk` to create the first manual draft. Add one real personalization signal, exact territory/target distinction, category rule, price, funding/refund rule, sample link, campaign link, valid postal address, ad disclosure, and one-step opt-out.
12. Review every bracketed field. The app cannot send; separate outreach authorization is required before using the approved mailbox.
13. After an authorized real send, log only the factual activity in `/activities`. A reply pauses the cadence; an opt-out immediately sets DNC.
14. Use at most two restrained follow-ups, then close the loop. No call or meeting is required; offer direct owner contact if requested.
15. Treat a positive reply as interest only. Review it in `/interest-inbox`; a single-use invitation may be issued only after category and sensitive-content review.
16. Keep checkout off until real routes, complete economics, a current supplier quote, the 24-unit physical preflight, final policies, provider tests, business address, and a separate exact owner activation all pass.
17. After the first 40 qualified contacts, review delivered/bounced, replies, positive replies, opt-outs/complaints, interest, cleared payments, fees/refunds, and owner hours. Change one variable at a time; never invent urgency, reservations, reach, or results.

The evidence basis and High Response Marketing caveats are documented in [`FACELESS_SALES_RESEARCH.md`](FACELESS_SALES_RESEARCH.md). Reuse the asynchronous process, not promotional earnings claims, unpaid/fronted placements, split-payment exceptions, or absolute “100% online” claims.

## 16. Native CRM and add-on boundary

The owner-only `/crm` workspace combines prospects, reservation interests, and durable quote inquiries with stages, search, internal tasks, factual notes, and reviewed quote promotion. A promoted quote keeps its source request snapshot so service, area, quantity, mailer, message, contact preference, reply permission, and notification state remain visible on the prospect. The CRM action API cannot write authoritative reservation/payment state. Preserved prospect operational fields are visibly unverified notes that map only to manual **Interested**; only server-owned reservation-interest state can create locked **Reservation**, and provider-backed payment records remain outside client-authored prospect state.

Eight first-party add-on switches control only which internal workspace modules the owner sees: CRM, pipeline, tasks, templates, economics, proofs, refunds, and tracking. They do not activate automated outreach, phone/SMS, payments, printing, postage, storage, analytics, or any external provider. Those services may still have usage costs and require separate configuration and owner authorization.

Public quote intake is same-origin JSON, strictly validated, retry-idempotent, and protected by Firestore-backed atomic IP/email limits. A valid request is stored for manual CRM review with intake `accepted`, review `queued`, notification `not_queued_disabled`, and outbound `not_sent`. It makes no Mailgun call and sends no email or other message.

## 17. Mailing areas and route evidence

The route workflow is no longer a free-text checkbox inside campaign economics. The owner workspace stores private territories and immutable route-plan versions, validates ZIP/carrier-route rows, rejects duplicate routes, derives all delivery totals on the server, and records a dated USPS or Printing4SuperCheap evidence source. A seven-day recheck threshold is a CaliforniaMailer safety policy, not a USPS guarantee.

The optional local optimizer accepts at most 50 owner-imported rows and finds the closest nonempty whole-route subset for the selected audience. Deterministic ties prefer at-or-under, then fewer routes, then canonical ZIP/route order. Applying its suggestion only edits the draft form; it performs no lookup, scrape, provider call, verification, attachment, order, or purchase.

Only a fresh verified plan can be attached to the founding campaign. Attachment occurs in an owner-authorized transaction, copies the compatible route summary, records an audit event, and revokes economics, checkout, artwork, and print-readiness gates. It does not request a provider quote, reserve inventory, purchase postage, or place a print order.

An already attached current plan has a separate exact-confirmation recheck path. It requires an evidence reference and transactionally revalidates the immutable plan identity, hash, rows, server-derived totals, territory pointer, campaign pointer, and model compatibility before storing distinct recheck evidence. It never edits the original route content or treats the recheck as a provider lookup or order.

For the active 5,000-piece model, attachment also requires current residential coverage between 90% and 100% of the configured quantity. This is a CaliforniaMailer waste/compatibility guard—not a USPS rule—and a materially different route total requires a different versioned campaign model.

The public `/mailing-areas` page follows the observable ZIP/zone pattern used by established direct-mail providers while using original copy and components. It exposes no exact count from stale or unverified evidence and does not promise franchise territory rights or category exclusivity from a lead form. The source comparison and later USPS API boundary are in [`MAILING_AREA_RESEARCH.md`](MAILING_AREA_RESEARCH.md).

## 18. Reservation-scoped portal and coupon boundaries

`/business-portals` creates a one-time, manually copied link for one reservation/business placement. Supported invite lifetimes are 1, 24, 72, and 168 hours; consumed links create a 30-day database-backed session. Raw tokens are not stored. The URL fragment is removed before consumption, and the token-free reservation page uses the existing `cm_reservation_{reservationId}` cookie with `HttpOnly`, `SameSite=Lax`, root path, explicit expiry, and `Secure` in production. `NEXT_PUBLIC_SITE_URL` must be the canonical HTTPS origin before production link creation. Logout revokes one session; revoke-all increments the access version and invalidates legacy and current access. No email, SMS, or other delivery is automated. See [`ADVERTISER_PORTAL.md`](ADVERTISER_PORTAL.md).

Coupon drafting requires the exact reservation session, current paid state, and matching tracking ownership. Manual drafts remain available without AI. Owner publication requires the submitted version and exact confirmation, copies a separate public snapshot, and never treats a draft as approved. Optional AI is server-only, disabled by default, uses `store: false`, structured two-field output, fact grounding, a hashed reservation-scoped safety identifier, and a durable per-reservation UTC-day quota. No live AI call was made. See [`AI_COUPON_RESEARCH.md`](AI_COUPON_RESEARCH.md).

## 19. Free private fit-preview boundary

`/quote` now presents a free private campaign-fit preview as the first no-meeting-required step. A valid same-origin request is saved privately for manual CRM review with the selected service, market, quantity, format, details, contact preference, and reply permission. It does not create finished creative, a customer price, availability, a reservation, payment, route plan, restaurant partner, automatic response, or ongoing marketing consent. The app sends nothing; any response still needs separate owner review and authorization.

The preview may outline route/audience fit, a format direction, evidence still needed, and next steps. It may not promise response, ROI, exclusivity, publication, delivery, or ranking. Public service copy and metadata improve topical clarity and crawlability, but no search position has been measured or guaranteed.

## 20. Statewide service and fulfillment boundaries

`/california-postcard-mailing` accepts quote-only requests for one-business EDDM or addressed postcards throughout California. Printing4SuperCheap is the required printer and USPS is the documented mail-delivery channel. A written price requires exact current routes or addressed-audience/list evidence, postal method and responsibilities, a current signed-in Printing4SuperCheap quote, and complete costs that clear both the configured $2,500 pre-income-tax economic-surplus floor and 20% minimum margin.

`/pizza-box-advertising` accepts quote-only requests for original partner-distributed coupon sheets or flyers throughout California. It is not USPS mail or EDDM: Printing4SuperCheap prints the approved piece, while a named restaurant partner distributes it under a signed agreement. Availability and pricing require verified box volume, a defined quantity and period, category terms, artwork rights, exact handoff, completion evidence, the current printer quote, and the same two economic floors.

Both lanes are intake surfaces, not independent production/order state machines. Statewide intake does not mean every route, list, restaurant, category, format, quantity, or date is available. No provider call, quote request, payment, print order, mailing, handoff, or restaurant distribution occurred.

## 21. Structured production evidence and read-only command center

Each paid reservation can create immutable structured `creativebriefs` versions tied to the exact campaign delivery window. Each new private material version records its asset type, rights basis, named attestor, required source/license note, statement version, and owner-review evidence. Proof creation is bounded before buffering and transactionally binds the exact reservation, campaign, placement slot, creative-brief ID/version, material ID/version, and previous-proof pointer. Readiness treats an approved status as insufficient without a matching current pointer plus recorded approver and timestamp.

Production payment evidence is stricter than aggregate funding: every paid reservation needs exactly one canonical provider-backed payment bound to its current campaign, plan, offer version, currency, reservation, and original quote. The full quoted amount must be cleared with zero refund. Partial refunds, duplicate/orphan/mismatched ledgers, unresolved states, or contradictory pointers fail closed.

`/production-board` is an owner-only, bounded, read-only view of the current campaign, slot, reservation, canonical payment, brief, material, proof, tracking, coupon, and portal records. It cannot write a record, send a message, activate a provider, or order production. Collection-cap hits, unknowns, blockers, and record errors never become ready. Its client-side CSV excludes contact PII, raw tokens, storage paths, and coupon content and neutralizes spreadsheet formulas.
