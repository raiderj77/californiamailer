# Mailing-area and route-system research

Snapshot date: 2026-08-19

## What can be verified publicly

Public websites do not provide enough independently audited conversion or revenue data to rank a single "best-performing" territory experience. The useful evidence is the workflow that can be observed on each site; reach, response, income, and performance statements remain vendor claims unless CaliforniaMailer later obtains independent evidence.

| Source | Observable geographic workflow | CaliforniaMailer takeaway |
| --- | --- | --- |
| [USPS EDDM Online Tool](https://eddm.usps.com/eddm/select-routes.htm) | Address, city/state, or ZIP search; radius and route-type filters; residential/business selection; route counts, demographics, estimated postage, and route selection. | USPS or documented supplier evidence remains the source of route facts. CaliforniaMailer must not fabricate, scrape, or silently refresh those facts. |
| [Printing4SuperCheap EDDM](https://www.printing4supercheap.com/store/product-view.html/48-Every-Door-Direct-Mail) | Its full-service sequence describes an in-mailbox estimate followed by a route selector with route-level household/demographic data, then print, preparation, and USPS delivery. | Keep Printing4SuperCheap as the fixed production supplier and allow a documented supplier route quote as evidence. Recheck the signed-in total before every written quote or order. |
| [Money Mailer mailing areas](https://moneymailerfrv.com/where-and-when-we-mail/) | Named mailing areas, downloadable maps, approximate home counts, and a mailing calendar. | A public zone page and campaign calendar are useful; exact counts need an observed date. |
| [Our Town America local advertising](https://www.ourtownamerica.com/advertise-local/) | Address/ZIP lookup routes an advertiser to a local operator. Some materials discuss category availability by ZIP. | ZIP lookup and category availability are separate from carrier-route facts and from operator franchise rights. |
| [Valpak local advertising](https://www.valpak.com/advertise/about-us) | State and local-market footprint rather than a public carrier-route inventory. | A market/territory directory can be public even when exact route selection stays private. |
| [Mspark FAQ](https://mspark.com/faq/) | Describes full-ZIP, split-ZIP, carrier-route, neighborhood, and household targeting. | Keep targeting method explicit; do not call every geographic campaign EDDM. |
| [Share Local Media shared mail](https://www.sharelocalmedia.com/shared) | Preset campaign calendar with metro or modeled geographic audiences. | Pair mailing areas with dated campaign status and capacity, without implying route availability. |
| [Welcome Wagon availability](https://sms.welcomewagon.com/digital/step1.php) | ZIP-first area availability intake. | A ZIP-first inquiry is useful, but lead capture is not evidence that inventory or exclusivity is available. |
| [Community Spotlight Postcards](https://www.spotlightpostcard.com/) | Zone cards, ZIPs, deadlines, delivery dates, waitlist states, category positioning, and slot availability. | The structure is useful inspiration, but its contradictory circulation figures, blank dates, and placeholder testimonials must not be copied. |

## Terms that must remain separate

1. **Mailing area or campaign zone:** the ZIPs and carrier routes selected for one mailing.
2. **Category exclusivity:** a campaign-specific rule for competing advertisers, governed by the written reservation terms.
3. **Operator territory:** a contractual franchise or licensing right to sell in a geographic area.

CaliforniaMailer currently offers the first concept and may enforce the second only through its recorded campaign/category rules. It does not sell or promise a protected operator territory.

## Implemented v1 boundary

- Owner-only territory and immutable route-plan records use trusted server APIs and private Firestore collections.
- Individual route totals are derived by the server from manually entered rows. The browser cannot submit an authoritative aggregate.
- Accepted evidence is a documented USPS EDDM lookup or Printing4SuperCheap route/turnkey quote, with source, reference, and observed date.
- CaliforniaMailer uses a seven-day internal recheck policy for verification and attachment. That is a CaliforniaMailer safety rule, not a USPS guarantee or validity period.
- A verified plan can be attached to the founding campaign only through an exact-confirmation transaction. Attachment revokes economics, checkout, artwork, and print-readiness approvals because route changes can change cost and production assumptions.
- Public mailing-area responses expose only sanitized, current verified summaries. Internal references, owner identifiers, content hashes, and individual route rows remain private.
- A complete EDDM carrier route must be selected; a 5,000-piece planning target may therefore differ from the exact current delivery count. Written pricing must use the current selected-route total and supplier quote.
- The active 5,000-piece campaign accepts only 90%–100% residential coverage when a plan is attached. That CaliforniaMailer compatibility rule prevents a tiny route set from authorizing a much larger print quantity; it is not a USPS standard.
- No v1 action scrapes USPS, purchases a map, sends a supplier request, reserves a category, activates checkout, buys postage, or places a print order.

## Later authorized integration

USPS documents an [EDDM v3 API](https://devs.usps.com/eddmv3) for authorized integrations, including geographic and route information. Access requires the USPS developer/OAuth onboarding described in its [getting-started guide](https://devs.usps.com/getting-started). Until that access is deliberately obtained and its data-use terms are reviewed, CaliforniaMailer links to the official planner and records owner-verified evidence instead of reproducing the USPS map.
