# Advertiser page refresh — review handoff

Prepared 2026-10-07 from production/main `a45ccd5f5afbf1aef5b9efe7f1d224a39c307535`.

## Scope

- Homepage: original advertiser copy, shared vs dedicated EDDM, indicative $399 / approximately 5,000 homes and $599 / approximately 10,000 homes per advertiser per shared mailing, simple process, audience/route explanation, conditional holiday target, FAQs.
- Original server-rendered sample: 16 equal ad slots total, illustrated as eight per side. Fictional example categories/offers; no claimed sales or availability. Final side allocation, dimensions and postal clear areas require printer approval.
- Co-op inquiry page and services: aligned descriptions; global primary CTA and new page CTAs use `https://californiamailer-campaign-planner.jlr77.chatgpt.site`.
- Nonbinding interest only: no category hold, purchase, contract, or payment collection. Costs and refund terms need approval before purchasing. Later purchases require full payment upfront, no deposits.
- Proposed service help is explicitly subject to written scope. No automatic QR analytics or planner-submission claim.
- Existing quote form, backend, production settings, SEO routes/canonicals/sitemap configuration, and disabled checkout preserved. No customer data, tracking, legal-entity assertions, private address, or vendor economics added.

## Research reviewed

- https://torreymediagroup.com/ — concise explanation, visible card layout, industry exclusivity.
- https://thepinellascard.com/campaign-palm-harbor.html — concrete campaign/route explanation and clear commitment boundaries.
- https://localspotlightmail.com/ — sample prominence and short advertiser process.
- Current live CaliforniaMailer fetched directly: HTTP 200, Vercel response, current main-page headline verified. Search-index copies were stale, so implementation uses current GitHub main.

Copy and sample are original; no competitor assets, testimonials, statistics, or pricing copied.

## Validation

- `npm test`: 8/8 pass.
- Targeted ESLint across all changed TS/TSX files and the new browser test: pass.
- Repository-wide `npm run lint`: 63 errors in unchanged files, mostly dashboard hook/typing issues; initial run also reported 32 warnings, including one temporary changed-file unused import subsequently fixed. No unrelated lint cleanup performed.
- `npm run build`: pass, including TypeScript and 45 generated pages. Existing Google Fonts require network. Local build used inert Firebase/Stripe environment placeholders because the existing server modules initialize at build time. These values exist only in the local process/build output, not source, production settings, or committed files. Do not deploy this local build or use `--prebuilt`.
- `node tests/advertiser-planning.browser.mjs`: 24 route/viewport checks passed (390, 768, 1440 pixels; eight routes). Correct canonicals, one h1/main, no overflow, all planner CTA hrefs correct, 16 equal rendered slots, FAQ toggle and /home redirect verified. No serious/critical axe findings. API calls blocked; no form submission.
- Public planner independently returned HTTP 200 with Campaign Planner title. Automatic capture not tested or claimed.
- Screenshots retained locally under `qa/`: home-390.png, home-768.png, home-1440.png (full pages), hero-390.png, hero-768.png, hero-1440.png. Desktop/mobile hero images visually reviewed.

## Verified deployment target — NOT deployed

Vercel project `californiamailer`, ID `prj_bbhlTAu983P1djJWrQ2U94HIxdPf`, team `team_UJgX6d1ueSUoJV6ajfanKJJJ` (jasons-projects-534f08bb), Node 24, Next.js. Existing CLI authentication successfully inspected the project; connector access returned a scope error, so the read-only CLI fallback was used.

Production deployment `dpl_BKpqVTa4pnTSmPuPtYmyAHPwqEkC` is READY at commit `a45ccd5f5afbf1aef5b9efe7f1d224a39c307535`. Project Git link and gitSource are null. There is no verified Git-triggered deployment pipeline. A draft PR does not deploy production.

After parent review, a fresh source deployment can target the existing project with this PowerShell command from this checkout (do not run the local fixture-build script first, and do not use --prebuilt):

```powershell
$env:VERCEL_ORG_ID='team_UJgX6d1ueSUoJV6ajfanKJJJ'
$env:VERCEL_PROJECT_ID='prj_bbhlTAu983P1djJWrQ2U94HIxdPf'
node 'C:\Users\jason\AppData\Local\npm-cache\_npx\09c35f05f7dedb59\node_modules\vercel\dist\index.js' deploy --prod --scope team_UJgX6d1ueSUoJV6ajfanKJJJ
```

This command has NOT been executed. Production Firebase/Stripe settings must remain on Vercel and must not be replaced by local placeholders. No new tool, domain, spend, DNS, email, checkout, or provider permission is needed for this source-only change; production action is held for the parent's QA review. Verify deploy result and public routes before reporting a release.

Remaining limits: global lint debt; external quote delivery remains untested at the owner's request; actual print layout and commercial/refund scope remain unapproved; custom planner domain remains unverified and unused.
