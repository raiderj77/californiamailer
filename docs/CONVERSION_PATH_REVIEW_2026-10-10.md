# Branded planner and design request path

## Baseline and scope

Verified through Vercel on 2026-10-10 before editing: production deployment
`dpl_GGFx8sdy5yAEzi1zwByDZgdo1eGS`, source
`f04c8990c38ca82953e2d2fde2f8b5abd0824d8d`, branch
`codex/cm-payment-route-safety-20261010`. This isolated checkout starts at that
commit, not stale main. The older advertiser checkout and existing PRs were not
changed. Vercel project `prj_bbhlTAu983P1djJWrQ2U94HIxdPf` has `link: null`;
no GitHub workflows are tracked in this source.

## Changes

- Shared planner constant now uses `https://plan.californiamailer.com/` for the
  header, home, co-op and mailing service CTAs. The previously used chatgpt.site
  URL remains in historical review documentation and Git history as a rollback
  reference; no runtime fallback is needed for the verified branded destination.
- The Design & print support service card now links to `/quote?service=design`,
  labelled "Request design & print support".
- Inspection found that the quote form already allowlists `eddm`, `design`,
  `solo`, and `coop`, selects a valid quantity, and allows manual changes. That
  implementation is preserved and now covered by read-only browser regression
  tests, including invalid query values and the default route.
- No changes to prices ($499/$799), 16-slot claims, commercial terms, email,
  payment/provider configuration, checkout, route availability or dependencies.

## Validation

- `npm test`: 11/11 passed, including disabled-checkout, quote endpoint,
  privacy/analytics, unverified-payment and unavailable-route safety tests.
- Changed-file ESLint: passed for both source files and both browser scripts.
- `node node_modules/typescript/bin/tsc --noEmit`: passed.
- `npm run build`: passed; TypeScript and all 45 pages generated.
- `node tests/advertiser-planning.browser.mjs http://127.0.0.1:3148`: all
  assertions passed at 390, 768 and 1440 pixels. Eight public pages per viewport;
  canonical/headings, prices, 16 equal sample slots, planner links, FAQ interaction,
  no horizontal overflow and no serious/critical axe violations. Actual design
  CTA navigation, all four valid service values, four invalid/empty values,
  default service, quantity consistency and manual selection changes passed.
- `node tests/unverified-commerce.browser.mjs http://127.0.0.1:3148`: passed at
  390 and 1440 pixels. Payment stays unverified beyond the former timer; fabricated
  query strings do not confirm payment. Local route GETs return 503 with no route
  data, and malformed ZIP returns 400. Zero external/non-GET browser requests.
- Mobile and desktop services and preselected-design quote screenshots visually
  reviewed. Local screenshots are in `qa/` and `qa-safety/` (not committed).
- `git diff --check`: passed. Build-generated sitemap timestamp changes reverted.

Local dependency installation used the existing lockfile. The build used only
inert, process-scoped Firebase/Stripe placeholders because existing modules
initialize at build time; SMTP credentials were cleared. No production secrets
were loaded. The local `.next` output is QA-only: never deploy it or use it as a
prebuilt deployment.

Initial browser attempts failed because the sandboxed server was unreachable
from Chrome. Both server and browser were rerun in the same local execution
context; completed checks above used that reachable server.

## Review boundary

No deployment, form submission, supplier contact, provider activation, credential
change or spend. The legacy public-site browser script was not run because it
includes form submissions; the read-only suites cover this change. External quote
delivery and planner submission capture remain untested. Deployment is held for
review of this diff and its validation evidence.
