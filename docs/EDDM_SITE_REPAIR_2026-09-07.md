# CaliforniaMailer EDDM site repair
Scope: restore a coherent local EDDM inquiry site from production commit 4da58ef. Keep unrelated faceless-sales branches and dirty files separate. No checkout, print order, mailing, payment, or outreach is activated.

## Research
- https://www.taradel.com/ — audience selection, artwork, campaign planning, quote/cost clarity.
- https://www.postcardmania.com/ — differentiated print, design, and mailing services.
- https://www.everydoordirectmail.com/blog/how-to-mail-your-eddm-retail-postcards-a-step-by-step-video/ — route and mail-preparation sequence.
- https://www.usps.com/business/every-door-direct-mail.htm — primary postal requirements, checked 2026-09-07. EDDM Retail 200–5,000 pieces per day per ZIP Code. Link to current USPS rules instead of inventing prices or delivery guarantees.
Competitor claims, testimonials, prices, logos, and success metrics were not copied.

## Result
Public navigation, homepage, services, area pages, quote form, co-op inquiry, and terms describe the actual inquiry flow. Removed unsupported population/income statistics, fixed-price offers, and implied live co-op inventory. Canonicals, main landmarks, mobile layout, contrast, form labels, and safe submission responses are verified by browser tests. Email input is sent as plain text, never unescaped HTML.

## Operational limits
Production DNS has no root receiving MX, SPF, or DMARC records. Authoritative DNS is GoDaddy. Existing Mailgun credentials are present; read-only domain lookup returned 401. Do not equate that lookup result with tested sending failure or successful sending. Mailbox/provider repair and an explicitly authorized end-to-end delivery test are required before claiming live quote delivery. Never send a test to a customer.

## Validation
Run npm test, npm run build, start the production build, then npm run test:browser -- http://127.0.0.1:3127. Browser tests mock only quote delivery and separately test invalid API input and checkout rejection. A mocked success is not email delivery evidence.


## Co-op direction and artwork
The owner selected 9 x 12 shared advertising as the lead offer. Homepage, navigation, service selection, and quote defaults follow that direction. The final concept uses the landscape coupon arrangement in the owner's Bob Ross blueprint page 26 as a structural reference. Source course pages remain private in ignored tmp/references and are not published. public/coop-postcard-9x12-reference-v2.png is original generated sample artwork, not live inventory, participating advertisers, or print-ready artwork. Built-in image generation was used. Prompt: create a landscape 12 by 9 co-op concept with eight compact sample coupon ads around a small CaliforniaMailer center panel, following the reference layout structure without copying advertiser content; use explicit sample labels and placeholder offers/contact details.

Local validation passed: six safety tests, production build, targeted ESLint, and eight public routes at mobile and desktop widths with no serious/critical axe violations, no horizontal overflow, correct canonicals, one main landmark, mocked quote failure/success, invalid API rejection, and disabled checkout. External email delivery remains unverified.
