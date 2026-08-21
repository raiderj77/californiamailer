# U.S. direct-mail website research

Verified August 19, 2026. This is a product and information-architecture study, not permission to copy another company's code, words, artwork, photography, testimonials, layout, trademarks, or performance claims.

## Evidence boundary

No public source establishes which direct-mail website has the highest conversion rate, revenue, or traffic. The useful evidence is narrower: current product structure, public workflow, attributed case-study formats, and trust information. Vendor-published case studies are examples of how to present measured outcomes; they are not forecasts for CaliforniaMailer.

## Benchmarks reviewed

- [Valpak advertising resources](https://www.valpak.com/advertise/resources): separates shared and standalone products, offers educational tools, and provides business identity and location evidence.
- [Money Mailer overview](https://moneymailer.com/corporate/overview): local audience framing and a direct quote path.
- [Mspark mailbox solutions](https://mspark.com/services/mailbox-solutions/): explains shared versus standalone formats and what fulfillment includes.
- [Share Local Media shared mail](https://www.sharelocalmedia.com/shared): calendar, category limits, testing, codes, and attributed case-study metrics.
- [RSVP direct-mail solutions](https://www.rsvpadvertising.com/direct-mail-solutions): organizes products by audience and distinguishes call, QR, and matchback measurement.
- [Our Town America new-mover marketing](https://www.ourtownamerica.com/new-mover-marketing/): ZIP selection, category exclusivity, fulfillment steps, and redemption reporting.
- [Welcome Wagon direct mail](https://www.welcomewagon.com/new-mover-marketing/direct-mail/): mover-timed product families and advertiser-industry paths.
- [Mail Shark](https://www.themailshark.com/): industry-specific education, scheduling, and integration visibility.
- [PostcardMania](https://www.postcardmania.com/): samples, calculators, attributed case studies, and physical-business trust signals.
- [Taradel EDDM order guide](https://www.taradel.com/blog/step-by-step-guide-how-to-order-every-door-direct-mail-blogpost284): a low-friction asynchronous sequence of target, format, design, schedule, and checkout.
- [Community Spotlight Postcards](https://www.spotlightpostcard.com/): exact-format information architecture, visible inventory and category concepts. Its currently inconsistent household counts and unsupported claims must not be reused.

## EDDM Tools and The 9x12 Method review

The public [EDDM Tools YouTube channel](https://www.youtube.com/@EDDMTools) and [EDDM Tools suite](https://eddmtools.com/) organize the work around three narrow utilities:

- RouteSnip copies carrier-route rows into a spreadsheet and RouteSnip Pro selects route combinations near common piece-count targets. CaliforniaMailer should use only owner-imported, dated USPS or supplier evidence; it should not reproduce the browser-extension scraping mechanism.
- RapidSlips turns the owner-supplied USPS mailing packet into facing slips. Its own instructions require the operator to compare generated slips with the official packet. CaliforniaMailer may later add a preparation/checking tool, but it must never imply USPS acceptance or submit a mailing automatically. See the public [RapidSlips workflow](https://rapidslips.com/access-rapidslips) and [EDDM Tools walkthrough](https://www.youtube.com/watch?v=Yla-0xn0YRk).
- LinqTraq groups redirect links and QR analytics by advertiser and campaign. CaliforniaMailer already has a stronger evidence boundary: HTTP requests are measured, suspected bots and unknowns are separated, and calls, leads, coupons, and sales remain advertiser-reported.

The public [The 9x12 Method YouTube channel](https://www.youtube.com/@The9x12Method), [tool ecosystem guide](https://tips.9x12method.com/9x12-method-tools-ecosystem), and [CRM tutorials](https://www.youtube.com/playlist?list=PLPnkLAF7imbp59giqp8Bpg8NY4E1dN6HC) show a connected operating loop:

1. find and qualify businesses by industry and area;
2. track contacts, pipeline stages, tasks, card inventory, invoices, and renewals;
3. provide a credible market/campaign page and an advertiser-specific login;
4. collect factual creative inputs and generate an editable draft;
5. approve artwork, print, record delivery evidence, track QR requests, and report results;
6. create the next owner-reviewed renewal task.

The standalone [9x12 Method CRM](https://www.9x12methodcrm.com/) also exposes useful domain-specific patterns: card capacity beside the opportunity pipeline, follow-up tasks linked to the business, imports, and payment-backed invoice status. CaliforniaMailer should retain its own versioned mailer models and payment ledger rather than copying that product's fixed 16-space or variable-ad-size assumptions.

The EDDM Tools channel also links to [9x12 Leads](https://app.9x12leads.com/), which combines local-business search, qualification, Gmail sending, open tracking, and a pipeline. CaliforniaMailer can reuse the single-workspace idea, but it must not scrape/enrich contacts or connect an outbound mailbox without separate provider terms, privacy review, suppression enforcement, sender authentication, per-message owner approval, and a verified business postal address.

The [9x12 Design Wizard](https://ads.9x12method.com/) uses a short business/offer/contact/design wizard, a daily generation quota, a fixed 3:4 aspect ratio, optional logo upload, and downloadable PNG output. Its public page says missing inputs may be filled by AI and calls the result print-ready. CaliforniaMailer should take the safer boundary: factual advertiser inputs remain required, generated copy is only a draft, no material fact may be invented, and neither copy nor imagery becomes approved or print-ready until exact advertiser approval and the physical artwork preflight both pass.

The [Our Local Spotlight directory](https://www.ourlocalspotlight.com/) demonstrates market pages and a directory, but some indexed partner pages currently display zero mailboxes beside promotional conversion/testimonial content. CaliforniaMailer must publish only real territory, campaign, delivery, image, testimonial, and result records. No placeholder customer, zero-value metric, or generic success story should appear as proof.

### Build priority from this review

1. **Now:** a planning-only whole-route optimizer over current owner-imported route rows, with target, selected total, difference, source date, and an explicit manual-review boundary.
2. **Now:** one first-party CRM connecting prospect, reservation, proof, coupon, tracking, and renewal state without enabling automatic outreach.
3. **Now:** reservation-scoped passwordless advertiser access and editable coupon drafts, with exact owner approval before publication.
4. **Next:** an advertiser result report that labels server-observed redirects separately from advertiser-reported calls, leads, redemptions, and sales.
5. **Later:** a facing-slip preparation/checking workflow from an owner-uploaded official USPS packet. It must preserve the original packet, show every extracted route/count, and require an explicit comparison before export.
6. **Defer:** lead scraping, automatic email sequences, USPS submission, automatic postage purchase, a national operator marketplace, and automatic print ordering. Each requires separate provider, privacy, compliance, economics, or marketplace authorization.

All earnings, response-rate, conversion, retention, automation, audience-readership, and sellout statements on these channels or vendor pages remain promotional or self-reported. They are not CaliforniaMailer defaults, forecasts, proof, or public copy.

## Original CaliforniaMailer synthesis

1. Start with audience: shared placement, single-business EDDM, addressed solo, or triggered/community.
2. Use a short product finder: format, area and quantity, then business details.
3. Offer an explicit email-only contact preference.
4. Publish only database-backed territory, deadline, delivery-window, inventory, and category state.
5. Use original concept samples that are clearly non-production and contain no fake advertisers.
6. State what a quote may include: design, proofing, printing, postal path, and bounded measurement.
7. Separate HTTP redirects and codes from advertiser-reported calls, leads, appointments, and sales.
8. Publish future results only with campaign identity, method, numerator, denominator, time window, and source.

## Case-study examples, not benchmarks

- [Valpak home-maintenance case study](https://www.valpak.com/advertise/case-study/home-maintenance-franchise-shared-mail-case-study-4-to-1-roas) demonstrates an attributed homes, redemptions, sales, and ROAS presentation.
- [Share Local Media shared mail](https://www.sharelocalmedia.com/shared) demonstrates named response-rate and blended-CPA reporting.
- [PostcardMania roofing case study](https://www.postcardmania.com/case-studies/roofing/clearwater-florida-roofing/) demonstrates mailed quantity, response, customers, revenue, and ROI reporting.

CaliforniaMailer must not transplant those results. Its own future reporting must distinguish directly measured events from advertiser-reported outcomes and disclose the denominator and attribution method.
