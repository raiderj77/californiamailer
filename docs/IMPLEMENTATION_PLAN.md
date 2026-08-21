# CaliforniaMailer implementation plan

Status: implemented and locally validated; release blockers, external/provider verification, and owner approvals remain<br>
Repository baseline: `main` at `4da58ef` on 2026-08-17<br>
Working branch: `codex/faceless-sales`

## Verified starting condition

CaliforniaMailer is an existing Next.js 16 / React 19 application using Firebase Authentication, Firestore, Stripe and Mailgun route handlers, Tailwind, Vercel, and Node's test runner. The maintained source repository is `C:\Users\jason\Documents\portfolio-sites\californiamailer`. The current writable integration clone is `C:\Users\jason\Documents\ChatGPT\California Mailer\californiamailer`, on branch `codex/faceless-sales`, with the maintained repository configured as its local origin.

Working features found at the baseline included authenticated owner CRUD screens, territory/prospect/campaign records, CSV utilities, a legacy Mailgun quote-notification route, Stripe webhook signature verification, proof and tracking interfaces, the privacy page, SEO configuration, and six prior revenue-safety tests. The final local design deliberately replaced public quote-notification delivery with durable Firestore intake for manual owner review; it does not send or queue quote email.

The baseline also has material gaps:

- Public pages contain unsupported household counts, timing, design-team, service-area, price, response, and performance claims.
- The public co-op board queries a collection that the checked-in Firestore rules do not permit it to read; several other feature collections have no matching rules.
- Campaigns and co-op spots do not distinguish interest, holds, pending payment, cleared payment, refunds, disputes, proof status, costs, funding, or print readiness.
- The Stripe webhook uses the browser Firebase SDK on the server, records a completed Checkout session as successful without requiring `payment_status=paid`, and does not apply refunds or disputes to funding.
- The public checkout was correctly disabled in an earlier safety patch, but no server-owned reservation/catalog flow has replaced it.
- The owner dashboard is broad and team-oriented rather than a one-owner daily queue. The prospect model is too small for qualification, evidence, follow-up, category conflict, payment, proof, and renewal work.
- At the baseline, the production build required Firebase browser variables at build time, repository-wide lint had legacy failures, and production dependencies had high-severity advisories in the locked Next.js, Sharp, and Nano ID versions. The upgraded dependency set now passes lint, the supported webpack build, and an offline high-severity dependency audit; an online advisory refresh remains a release-time check.

## Product posture

CaliforniaMailer will be an owner-managed, brand-led service with one pre-funded Monterey Peninsula co-op experiment plus quote-only statewide intake for single-business postcards and pizza-box placements. “Faceless” means businesses can request a private fit preview and, where a complete supported workflow exists, evaluate, reserve, pay, submit materials, approve proofs, and receive reporting asynchronously. It does not mean anonymous. The real sender identity, owner accountability, commercial-email disclosures, valid postal address, and optional direct contact remain visible wherever required.

The active founding plan is versioned as `shared-mailers-v2` / `shared-9x12-5000`: an experimental 9 × 12, 14 pt, 5,000-piece layout with 24 equal slot-units proposed at $349 per paid unit, for $8,376 at full funding. Its approximately $2,500 owner target is pre-income-tax economic surplus after editable costs, reserves, and owner-labor valuation—not guaranteed or personal after-tax take-home. The configured readiness gate also requires a 2,000 bps (20%) minimum margin. Checkout and print remain disabled until the exact 24-unit artwork passes physical/postal preflight and a current supplier quote plus complete economics pass both financial floors and every other gate.

The safe operating sequence is:

`verified prospect or inbound inquiry → free private fit preview/manual review → short owner-approved response → restrained follow-ups only when separately authorized → category check → temporary hold → 24-unit template preflight and current full economics → hosted checkout → canonical fully cleared payment with no refund → structured creative brief → rights-attested material → proof bound to exact source versions → written proof approval → funding/cost/route/final-artwork checks → owner print authorization → delivery report`

Calls and meetings are optional. No automated bulk outreach, purchased lists, deceptive subject lines, fake activity, invented scarcity, predicted response, unpaid/fronted placements, ranking guarantee, implied statewide availability, or printing before the financial gate.

## Implementation sequence

### 1. Truth and dependency safety

- Centralize the founding offer in one typed configuration.
- Rewrite core public pages around one honest pre-launch campaign.
- Add original crawlable pages for `/california-postcard-mailing` and `/pizza-box-advertising` with canonical metadata, visible FAQs, safe FAQ JSON-LD, and internal links. Optimize page relevance without claiming or guaranteeing a search position.
- Remove unsupported city pages and generated claims from structured data and `llms.txt`.
- Upgrade currently vulnerable production dependencies.
- Keep online payment unavailable until a database campaign passes activation checks.

### 2. Campaign and business-rule foundation

- Add versioned campaign, placement, category, reservation, payment, cost, proof, and readiness types.
- Add a versioned shared-mailer model catalog and pure economics calculator. Keep 9 × 12, 12 × 15, six-unit M6, custom split-layout M7–M9 concepts, M3, community, new-mover, and directory formats separate rather than borrowing another model's inventory or prices.
- Keep integer cents for money and UTC timestamps for state changes.
- Add pure, tested rules for active holds, category conflicts, cleared net funding, margin, and print authorization.
- Publish only a sanitized `publicCampaigns` projection; do not expose private reservations, contact details, notes, payment IDs, or uploads.

### 3. Faceless owner sales desk

- Expand prospects with qualification state, evidence, official source, category, service-area fit, priority, full contact status set, follow-up date, attempts, campaign/placement/price, payment/proof/renewal status, and do-not-contact.
- Add search, filter, sort, pagination, bulk status change, CSV template/import/export, duplicate checks, and activity history.
- Add a today queue and manual templates for first touch, two follow-ups, category notice, payment, funding, proof, cancellation/refund, delivery, and renewal.
- Require `qualified` before a prospect can enter the ready-to-contact state. Any opt-out sets do-not-contact across the workflow.
- Use the owner-only native CRM API and Admin SDK for pipeline, tasks, activities, quote inquiries, and first-party add-ons. Do not expose an open relay or enable automated email, SMS, calls, or provider activation.
- Persist public quote requests before responding, retain their full request and contact-preference context when promoted, and report only honest intake states: accepted for manual review, email not queued because delivery is disabled, and outbound message not sent.
- Frame quote intake as a free private campaign-fit preview: manual route/audience/format/evidence review only, with no finished creative promise, availability guarantee, inventory hold, automatic message, or ongoing marketing consent.
- Preserve historical prospect operational values only as visibly unverified notes. Remove paid/reserved/cleared/sold controls from the form, bulk actions, and import; prevent new claims in Firestore rules; and map old notes only to manual **Interested**, never locked **Paid** or **Reservation**.

### 4. Database-backed founding campaign and board

- Replace spot-shaped public data with one campaign document that shows the full funding and inventory state.
- Start in `pre_launch` with zero cleared funding and no invented reservations, dates, selected routes, or household estimate.
- Display the approximately 5,000-household target separately from the route-verified delivery count.
- Publish the 24 paid-unit count, proposed $349 unit price, and $8,376 full funding goal only as the active versioned planning assumptions. The current reservation workflow implements one paid slot-unit per advertiser/category reservation. Multi-unit advertisers and larger placements are future work and must not be represented as available.
- Evaluate rendered public planning-price visibility at request time so an expired supplier observation or failed complete safeguard withholds numeric unit prices and derived goals on all eight site surfaces immediately rather than leaving a build-time value visible until redeployment. Keep raw numeric placement price and funding-goal fields out of the published projection.
- Let the authenticated owner publish a sanitized campaign snapshot after reviewing it.
- Add private mailing-territory records and immutable, versioned route plans. Derive route totals server-side from individual rows and require a current documented USPS or Printing4SuperCheap source before verification.
- Attach route evidence to a campaign transactionally. Route changes revoke economics, payment activation, artwork preflight, and print readiness; the economics form cannot manufacture route confirmation.
- Publish a separate mailing-area experience that exposes only fresh, sanitized summaries. Keep individual route rows, source references, owner identity, and content hashes private.
- Provide a planning-only route optimizer that ranks the current owner-entered draft rows. Applying a suggestion edits only the draft; persistence, verification, and campaign attachment remain separate explicit owner actions. It must not scrape USPS, silently replace an authoritative plan, or place a print/postage order.
- Add a bounded owner-only Production Board that reads current operational records in parallel, exports a formula-safe no-contact-PII CSV, makes no writes, and fails closed when collection caps, missing pointers, contradictory records, or other unknowns prevent an authoritative readiness view.

### 5. Reservation and payment

- Accept reservation submissions through a validated, rate-limited server route.
- Claim deterministic category and placement-slot documents in a Firestore transaction; expired unpaid holds become reusable.
- Make reviewed-interest invitation mutation transactional: replacement and every status transition revoke the prior current code; only the latest pointer can validate. Reservation intake must re-read the invite and interest, require the exact active/invited/non-suppressed binding, then consume the code and move the interest to reserved in the same transaction.
- Create Stripe Checkout only from the stored campaign price and only when the owner has enabled payments after economics and policy review.
- Verify webhook signatures and event idempotency. Count only cleared payment, net of refunds. Treat pending, failed, cancelled, and disputed amounts as ineligible.
- Queue refunds for owner review; do not call the refund API automatically.
- Deactivate tracking after a fully refunded payment, suspend tracking during a dispute, and restore previously active tracking after a won dispute only when payment and inventory reconcile. Preserve the slot and claim during a lost or otherwise non-won dispute so the state fails closed for manual review.
- Before production campaign activation, transactionally inspect the founding campaign's bounded reservation/payment ledger. The implemented guard blocks active-model `payment_review`/`disputed` reservations and `pending`/`manual_review`/`disputed` payments, and fails closed for manual review if either query exceeds 100 records. It changes no payment, reservation, claim, or slot state. Emulator and Stripe provider testing remain release blockers, and the lost-dispute inventory policy remains unresolved.

### 6. Cost, proof, tracking, and print gate

- Add editable cost inputs and show assumptions separately from verified quotes.
- Calculate required cleared revenue and unit price from complete campaign costs, payment fees, reserves, owner labor, and the selected pre-income-tax economic-surplus target. Missing values remain unknown, and sensitivity must show the effect of fewer paid units.
- Render the stored reservation-deadline instant back into `datetime-local` using the owner's browser timezone, then serialize it with an explicit offset. Server validation must reject delivery end before start, deadlines that are not future, and deadlines that do not fall on a Pacific calendar date before delivery start.
- Block print authorization until cleared funding, the minimum paid-placement count, current route evidence, complete schedule, Printing4SuperCheap quote/cost evidence, the shared `MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS` floor ($2,500), the shared `MINIMUM_ECONOMIC_MARGIN_BPS` floor (2,000 bps / 20%), final-artwork preflight, and manual owner approval all pass. The economics API rejects a non-null target below $2,500; calculation, readiness, and operational gates independently fail low legacy targets/margins; an economics update normalizes stored margin evidence to at least 2,000 bps. In the current one-unit-per-advertiser workflow, paid advertiser and paid-placement counts are expected to match.
- Require one canonical provider-backed payment per paid reservation, bound to the exact campaign, plan, offer version, currency, and original quoted amount. Production requires the full amount cleared with zero refund; partial refunds, duplicates, orphans, mismatches, and unresolved records fail closed regardless of aggregate funding.
- Save each reservation's creative intake as immutable structured `creativebriefs` versions tied to the current campaign delivery window. Save each private material as an immutable version with an explicit asset-rights attestation and owner-review evidence.
- Create proofs only from the exact current reservation pointers and sequences; persist reservation, campaign, placement-slot, creative-brief ID/version, material ID/version, and previous-proof bindings. Treat an approved status as insufficient without recorded approver/timestamp evidence.
- Treat the 24-unit 9 × 12 plan as experimental. HRM guidance supports roughly 16–18 comfortable ads on a 9 × 12 and about 25 on a 12 × 15, so a catalog selection or revenue calculation can never substitute for an exact postal-clear-zone and legibility preflight.
- Version proofs and store approver/timestamp. Separate measured scans/visits from advertiser-reported calls, leads, appointments, and sales.
- Give each reservation/business placement its own passwordless private portal. Store only hashed one-time invite tokens and hashed database-backed sessions, revalidate reservation binding and access version at every sensitive mutation, support logout and owner revoke-all, and never send an invite automatically.
- Add owner coupon drafting, public redemption pages, and optional AI-assisted draft generation. Keep drafts owner-controlled, enforce per-reservation quotas transactionally, and require provider keys and an explicit feature flag before any AI call.

### 7. Security and release verification

- Move privileged Firestore writes to the Admin SDK and verify Firebase ID tokens for owner APIs.
- Replace broad per-user browser access with an `admin=true` custom claim for the same Firebase UID as the owner document before deploying new rules. `OWNER_EMAIL` can allow the verified token through server owner APIs, but it does not satisfy direct Firestore browser rules. After setting the claim, sign out and back in so the browser receives a refreshed ID token.
- Validate uploads by size, type, magic bytes, and randomized private storage keys when storage is implemented.
- Run tests, TypeScript, targeted lint, production build with non-secret placeholders, dependency audit, and mobile/accessibility browser checks.
- Keep the local GitHub Actions workflow least-privileged and deterministic with Node 24, `npm ci`, the full test suite, TypeScript, lint, and production build. It remains unavailable remotely until an authorized commit/push.
- Do not deploy, send outreach, enable payments, seed fake data, purchase postage, order printing, or spend money.

### 8. Mailing-area UX and later map integration

- Use public `mailing areas` or `campaign zones`, not `protected territory`, unless a later signed operator agreement defines geographic rights and exceptions.
- Distinguish a mailing area, campaign category exclusivity, and a franchise/operator sales territory in both copy and data.
- V1 records owner-verified evidence and links to the official USPS EDDM planner. It does not scrape USPS or copy a competitor map.
- A later interactive map requires deliberate USPS EDDM v3 API/OAuth access, data-use review, provider testing, cost review, and a separate implementation decision.
- Treat 5,000 and 10,000 as planning quantities. Selected complete routes establish the exact current delivery count used for a quote.

### 9. Statewide single-business and restaurant-distribution lanes

- Accept California-wide requests without implying that every route, list, restaurant, format, quantity, category, or production date is immediately available.
- For a single-business postcard, keep EDDM and addressed mail distinct. Printing4SuperCheap is the required printer; USPS is the documented delivery channel. Exact routes or addressed-audience/list evidence, postal eligibility, preparation responsibility, and a current project quote are mandatory.
- For a pizza-box placement, state clearly that it is not USPS mail or EDDM. Printing4SuperCheap prints the approved piece; a named restaurant partner distributes it only under a signed agreement with verified box volume, quantity, period, handoff, category terms, and completion-evidence responsibilities.
- Keep both lanes quote/intake-only until a dedicated reservation/payment/production model exists. Before any future customer price or payment path, require a current signed-in Printing4SuperCheap total and complete costs that clear the same configured $2,500 pre-income-tax surplus and 20% minimum-margin standards.
- Use original copy and layout studies. Do not copy competitor/course artwork, publish unsupported response or earnings claims, guarantee search rankings, or treat statewide intake as proof of statewide fulfillment.

## Active planning economics and unresolved layout risk

The active experimental plan uses 24 equal paid slot-units at a proposed $349 each, so its full funding goal is `24 × $349 = $8,376`. The planning calculator targets approximately $2,500 of pre-income-tax owner economic surplus after editable labor and reserve assumptions. Authoritative readiness and public dated-price support also require the shared 2,000 bps (20%) minimum margin; passing either floor alone is insufficient. These are not guaranteed results and do not establish personal after-tax take-home.

Calculator resets use an editable 10% tax-contingency placeholder based on the dated print-price component: `$1,209 × 10% = $120.90` for the 5,000-piece 9 × 12 example and `$2,299 × 10% = $229.90` for the 10,000-piece example. These placeholders must be replaced by current signed-in supplier evidence and do not change either model's suggested planning price or quote-only boundary.

The financial calculation and physical inventory are separate gates. Current HRM material describes approximately 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15. The requested 24-unit 9 × 12 therefore remains experimental until the exact combined artwork proves that all paid units, postal indicia/address space, branding, disclosures, bleed, safe areas, and readable offers fit. If it does not pass, the owner must reduce units, change the price/goal, or use the larger format before accepting payment.

The cross-format catalog also covers 12 × 15, six-unit M6, separately modeled custom split-layout M7–M9 concepts, M3, community, new-mover, and directory cards. Those entries are comparison and quote-planning tools only. Their customer prices remain unknown until the exact format, audience, quantity, layout, fulfillment path, and complete current costs are supplied.

The founding campaign must remain pre-launch until the physical preflight, current Printing4SuperCheap quote, routes, fees, reserves, owner-labor treatment, and full economics establish a safe plan. No public profitability claim is allowed.

## Local completion note

The implementation sequence above is represented in the current local integration tree. On 2026-08-20, it passed 239/239 tests, TypeScript, repository-wide ESLint, and `npm audit --offline --audit-level=high` with zero vulnerabilities. The supported webpack production build completed 69/69 generated static pages; the source tree contains 56 `page.tsx` files and 36 `route.ts` handlers. The generated sitemap contains 21 public URLs, including both statewide service pages and all eight request-time public price surfaces, with zero generated `lastmod` values. The exact inventory versus baseline `4da58ef` is 167 added, 46 modified, and 22 deleted paths (235 total). The default Turbopack build was blocked only in this writable clone because its temporary `node_modules` junction points outside Turbopack's filesystem root; a normal local `npm ci` directory remains required to verify the exact default CI command, and an online advisory refresh remains a release-time check. Browser QA at 390 × 844 and 1440 × 900 found no horizontal overflow on `/home`, `/quote`, `/california-postcard-mailing`, `/pizza-box-advertising`, or `/sample-card`; unauthenticated `/production-board` redirected to owner login. A React development warning on `/quote` was traced precisely to browser-extension-injected `fdprocessedid` attributes rather than source divergence.

The provider snapshot is intentionally narrower than local validation. Vercel project identity, the production baseline deployment, and environment-variable names were verified read-only; the new branch and routes were not deployed. Firebase's local project alias, database location, and checked-in indexes were identified, but expired CLI authentication left the live app, deployed rules/indexes, IAM, billing, and data state unverified. GitHub still had no remote feature branch, pull request, workflow run, or checks at the time of review; the new CI workflow and integrated follow-up exist only in the local unpushed tree.

The campaign remains deliberately uninitialized and unactivated: no Firebase migration, production rules deployment, Stripe checkout, outbound quote email, Mailgun outreach, consumer mailing, print order, postage purchase, or public deployment was performed. The `admin=true` browser-rule owner claim, provider testing of the bounded activation guard, Firebase Emulator Suite verification, live storage/IAM review, final policies, route selection, dated vendor quotes, legal review, an explicit lost-dispute inventory policy, cleanup/republication of any legacy public projection, and owner release decisions remain required. The campaign must not be activated until those release gates are resolved.
