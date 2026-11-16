# SITE-UPGRADE.md — Universal Site Upgrade Prompt for CaliforniaMailer
Stamp: 2026-11-15 (v1.1 — includes ui-ux-pro-max design-token update checked the same day)
Origin: Jason's original ask (2026-11-15): "search GitHub for updating our sites with SEO, UI, UX, and all other matters for all of our websites. rewrite the prompt and give the original to both them as well and make one superior prompt we can add for all of our sties that can assist with moving forward"
Master pack: SUPERIOR-SITE-UPGRADE-PROMPT-2026-11-15.md (coordinator copy)

---

UNIVERSAL SITE UPGRADE — CaliforniaMailer — TRUTHMODE

Site: CaliforniaMailer
Live URL: https://californiamailer.com
Repo: raiderj77/californiamailer
Top competitor to beat: Valpak / Money Mailer and local EDDM providers (beat them on one flat local price, real Salinas routes, and showing real EDDM card samples)
Primary money action: Sell advertiser spots at $199 per spot. Phase 1 card is 6x11 to about 2,443 North Salinas homes. Phase 2 flagship 9x12 is a later, higher-price offer.
Primary keyword / money page: co-op postcard / EDDM advertising in Salinas, CA — homepage / spot purchase page

You are upgrading this site to get more traffic and more revenue, in that order.
Do not start coding until Phase 0 is proven. Label every claim PROVEN or ASSERTED.
No fabricated proof, numbers, reviews, authors, or results — ever.
If a competitor is genuinely better at something, say so and fix the gap.

SITE-SPECIFIC RULES FOR CaliforniaMailer (override generic sections below where they conflict):
- PHASE 0 FINDING (proven live 2026-11-15): the live homepage <title> reads "9 x 12 Co-op Postcard Advertising" but Phase 1 sells a 6x11 card at $199. This is the same spec error Jason corrected on 2026-11-11. Flag it as a Wave 1 item and confirm the correct title wording with Jason before changing copy — do not silently swap it.
- No print commitment until verified vendor costs + enough prepaid advertisers = positive contribution margin.
- Outreach sends go from hello@californiamailer.com through Gmail send-as. Check bounces after every batch.

OUR STANDING RULES (override any generic advice you find):
- Article Checklist (2026-10-29) applies to every article, guide, comparison, and tool page: keyword congruence, real author + dates, answer-first, clear definition, methodology, best-for / not-for framing, quantitative HTML comparison table, original evidence, how-to-choose, objection handling, true proof only, 2-3 sentence FAQs, at least 3 intent-matched CTAs. Add the checklist sign-off line to every PR.
- Cash register rule: done means verified LIVE where the customer or money touches it — production page serving the change, checkout / form / affiliate link rendering and clicking through. A build, a merge, or a preview is not done.
- Free tools stay free: never gate, paywall, or degrade a free calculator/tool to sell an add-on.
- Gates you must NOT cross without Jason's explicit word: spending, price changes, account creation, sends/publishes beyond the approved lane, TaxBreakTools CPA Gate 1, MindCheckTools attorney review before paid launch.
- One consolidated list of Jason's remaining steps at the end. Nothing scattered.

UPSTREAM WATCH — CHECK FOR UPDATES AS WE GO (owner instruction, 2026-11-15):
Before each upgrade run on this site, check these source repos for new commits / releases since the date stamped at the top of this file. If a change is relevant (new audit check, new design-token or schema practice, changed Core Web Vitals guidance), fold it into this run, note what you adopted and what you skipped and why, and update the stamp date in this file in your PR.
- https://github.com/AgriciDaniel/claude-seo (SEO structure)
- https://github.com/nextlevelbuilder/ui-ux-pro-max-skill (UI/UX — note 2026-11-15 update: design system can now be exported as design tokens, PR #577 — use token export for this site's DESIGN.md)
- https://github.com/VoltAgent/awesome-design-md (DESIGN.md patterns)
- https://github.com/coreyhaines31/marketingskills (CRO / copy / growth)
- https://github.com/addyosmani/web-quality-skills + https://github.com/GoogleChrome/lighthouse + https://github.com/GoogleChrome/lighthouse-ci (performance / Core Web Vitals)
- https://github.com/zubair-trabzada/geo-seo-claude (GEO / AEO)
- https://github.com/every-app/open-seo (keyword / competitor data)
Also check THIS repo before starting: latest commits on main, open PRs, open issues, and whether this file has been updated by a later run. Never work from a stale copy.

PHASE 0 — RECON (prove current state, change nothing)
- Crawl the live site. Record: pages indexed / in sitemap, broken links, 404s, redirects, duplicate titles/meta, missing canonicals.
- Run Lighthouse (mobile first) on homepage + money page + top article. Record Performance, Accessibility, Best Practices, SEO scores and LCP / INP / CLS.
- Check repo state: branch, last deploy, build passing, env vars present (names only, never values).
- Name the top competitor and list, with evidence, where they beat us and where we beat them.
Output: baseline table. Stop if you cannot verify the live site.

PHASE 1 — TECHNICAL SEO
- Titles, meta descriptions, heading order, canonicals, robots.txt, sitemap.xml, OG/Twitter cards — unique per page, keyword-congruent, no stuffing.
- Internal linking: every money page gets at least 3 contextual internal links; no orphan pages; fix dead internal links.
- Schema.org: add/correct only schema that matches visible content. Validate it.
- Indexing: noindex only where intentional. Check Search Console coverage if access exists.

PHASE 2 — CONTENT SEO + E-E-A-T
- Every key page: answer-first opening, who this is for / not for, methodology, real author and dates, sources for claims.
- Thin pages: expand with original evidence or merge them — no doorway stubs.
- Keyword intent match: informational pages inform, transactional pages convert.

PHASE 3 — GEO / AEO (AI SEARCH)
- Citable pages: clear definitions, direct answers in the first 100 words, structured lists/tables, named entities, dated facts with sources.
- AI crawlers not blocked in robots.txt unless intentional. Add llms.txt if the stack supports it cleanly.
- FAQs answer real questions in 2-3 sentences each.

PHASE 4 — UI
- One DESIGN.md for this site: brand colors, type scale, spacing, component styles, real logo (not initials). Export the design system as design tokens where the tooling supports it (upstream ui-ux-pro-max update, 2026-11-15). Every page follows it.
- Consistent header, footer, navigation. One primary action per screen.

PHASE 5 — UX
- Mobile first at 360px. Tap targets at least 44px, no horizontal scroll.
- Seeker test: first-time visitor reaches the primary money action in at most 3 clicks from the homepage.
- Forms: fewest fields, clear labels, inline errors, success state proven live. A form stuck in "not sending yet" state is a blocker — flag it at the top.
- 5-second test: what is this, who is it for, what do I do next — obvious.

PHASE 6 — CRO / CONVERSION (cash register)
- Primary CTA above the fold on homepage and money pages, repeated after value sections.
- Trust without fabrication: real disclosures, real contact/domain email, no fake testimonials, counts, or badges.
- Checkout / lead path clicked end to end in production (test mode only for payments). A broken checkout outranks every other fix.
- Email capture: one clear offer, one list, form proven sending.

PHASE 7 — PERFORMANCE / CORE WEB VITALS
- Targets: LCP under 2.5s, INP under 200ms, CLS under 0.1 on mobile, homepage + money page.
- Fix order: largest images, unused JS, render-blocking assets, font loading, third-party scripts.
- Re-run Lighthouse after fixes, show before/after numbers.

PHASE 8 — ACCESSIBILITY (WCAG 2.2 AA)
- Contrast, focus states, keyboard navigation, descriptive alt text, labels on every input, heading order, skip link. No information by color alone.

PHASE 9 — SECURITY, ANALYTICS, HOUSEKEEPING
- HTTPS everywhere, no secrets in code, critical/high dependency vulns fixed.
- Analytics + Search Console verified firing on production (subject to this site's privacy rules below).
- Helpful 404 page, redirects for moved URLs, no redirect chains over 2 hops.

OUTPUT — deliver exactly this:
1. Baseline table (Phase 0, PROVEN numbers)
2. Ranked fix list: Impact x Effort, each with file/page, fix, and how it will be verified live
3. Wave plan: Wave 1 = cash register + technical blockers, Wave 2 = UI/UX + performance, Wave 3 = content/GEO depth
4. PR(s) with article-checklist sign-off line where content changed
5. Live verification log for every Wave 1 item
6. ONE consolidated list of Jason's remaining steps (gates only)

STOP CONDITIONS: build fails out of scope, a gate is required, live verification contradicts the code, or a fix requires fabricating proof. Report the blocker plainly — never work around a gate.

