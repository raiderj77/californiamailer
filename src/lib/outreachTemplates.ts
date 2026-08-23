import { FOUNDING_CAMPAIGN, formatCurrency } from '@/config/foundingCampaign';
import type { Prospect } from './firestore';

export type OutreachTemplateKey =
  | 'first_introduction' | 'follow_up_one' | 'follow_up_two' | 'category_reservation_notice' | 'payment_reminder'
  | 'funding_update' | 'proof_request' | 'proof_approval' | 'campaign_funded' | 'campaign_cancelled'
  | 'refund_update' | 'delivery_confirmation' | 'renewal_offer';

export const outreachTemplateNames: Record<OutreachTemplateKey, string> = {
  first_introduction: 'First introduction', follow_up_one: 'Follow-up one', follow_up_two: 'Follow-up two',
  category_reservation_notice: 'Category reservation notice', payment_reminder: 'Payment reminder', funding_update: 'Funding update',
  proof_request: 'Proof request', proof_approval: 'Proof approval receipt', campaign_funded: 'Campaign funded',
  campaign_cancelled: 'Campaign cancelled', refund_update: 'Refund update', delivery_confirmation: 'Delivery confirmation', renewal_offer: 'Renewal offer',
};

const owner = '[owner-approved sender name]';
const site = 'https://californiamailer.com';

export function createOutreachDraft(key: OutreachTemplateKey, prospect?: Prospect | null) {
  const contact = prospect?.contactName?.trim() || 'there';
  const business = prospect?.businessName?.trim() || '[business name]';
  const category = prospect?.businessCategory?.trim() || '[category]';
  const price = formatCurrency(FOUNDING_CAMPAIGN.placements.standard.priceCents);
  const common = `\n\n— ${owner}\nCaliforniaMailer\n${site}\n\nIf you do not want another note from me, reply “no” and I will close the record.`;
  const drafts: Record<OutreachTemplateKey, { subject: string; body: string }> = {
    first_introduction: {
      subject: `${category} category — Monterey Peninsula founding mailer`,
      body: `Hi ${contact},\n\nI’m assembling one owner-managed cooperative mailer for a compact Monterey Peninsula territory. The working target is approximately 5,000 residences; the exact USPS routes and delivery count will be published only after route selection.\n\nI noticed ${business} because [insert one verified, specific reason]. I’m checking whether one ${category} advertiser would be a fit. The campaign is still pre-launch, the 24-unit layout requires physical preflight, and no category is reserved by this message.\n\nShould I send the written placement details and concept page?${common}`,
    },
    follow_up_one: { subject: `Re: ${category} category — Monterey Peninsula`, body: `Hi ${contact},\n\nQuick follow-up on the Monterey Peninsula cooperative mailer. I’m still checking fit before offering the ${category} category. The campaign remains pre-launch, so there is no claim that a spot is reserved or that funding has cleared.\n\nWould the written placement details be useful?${common}` },
    follow_up_two: { subject: `Closing the loop — Monterey Peninsula mailer`, body: `Hi ${contact},\n\nI’m closing the loop on my note about the Monterey Peninsula founding mailer. If this is not relevant for ${business}, no reply is needed and I will not continue this sequence.\n\nIf it is relevant, reply “details” and I’ll send the current written terms.${common}` },
    category_reservation_notice: { subject: `${category} category hold details`, body: `Hi ${contact},\n\nThis confirms the written details for a temporary ${category} category hold. The proposed equal-unit price is ${price}. A hold is not a sale, does not count toward cleared funding, and expires at the timestamp shown in the private reservation page. Only a verified cleared payment can change the category to sold, and physical layout preflight remains a separate production gate.\n\nPrivate reservation link: [paste the owner-reviewed private link]\nTerms: ${site}/terms\nFunding and refund policy: ${site}/funding-policy${common}` },
    payment_reminder: { subject: `Optional reminder: ${category} hold`, body: `Hi ${contact},\n\nThe temporary ${category} hold for ${business} is scheduled to expire on [date/time]. No payment is due unless you choose to proceed under the written campaign terms. Please use only the hosted checkout link on the private reservation page; do not send card details by email.${common}` },
    funding_update: { subject: `Monterey Peninsula campaign funding update`, body: `Hi ${contact},\n\nCurrent verified campaign status: [paste cleared amount and status from the owner dashboard]. Reserved or pending amounts are not included in cleared funding. Printing remains blocked until every funding, proof, route, cost, preflight, margin, and owner-approval gate passes.\n\nPublic status: ${site}/founding-mailer${common}` },
    proof_request: { subject: `Materials needed for ${business} proof`, body: `Hi ${contact},\n\nTo prepare the first ${business} proof, please provide the approved logo file, exact offer, contact details, destination URL, any required disclaimer, and brand guidance through [approved secure intake method]. Do not email account passwords or sensitive customer data.\n\nI will return a numbered proof for written review.${common}` },
    proof_approval: { subject: `Written approval needed — ${business} proof [version]`, body: `Hi ${contact},\n\nPlease review proof [version] at [private proof link]. Reply with either specific revisions or the exact approval statement shown on that page. Approval applies only to that numbered version. A scan, visit, or code redemption is not a promise of a lead or sale.${common}` },
    campaign_funded: { subject: `Funding gate reached — production checks continue`, body: `Hi ${contact},\n\nThe campaign has reached its cleared-payment funding goal as of [verified timestamp]. This does not by itself authorize printing. Final proofs, routes, costs, artwork preflight, projected margin, and owner print approval must still pass before a print order can be placed.${common}` },
    campaign_cancelled: { subject: `Monterey Peninsula campaign cancelled`, body: `Hi ${contact},\n\nThe campaign was cancelled on [date] because [factual reason]. No print order was placed. Eligible payment and refund status will be reviewed under the written policy; this message does not claim a refund has completed.\n\nPolicy: ${site}/funding-policy${common}` },
    refund_update: { subject: `Refund review update — ${business}`, body: `Hi ${contact},\n\nRefund status: [requested / under review / submitted to Stripe / confirmed by Stripe].\nAmount: [amount]\nReference: [non-sensitive reference]\n\nBank posting times are controlled by the payment provider and financial institution. This note should be sent only after the owner verifies the stated status.${common}` },
    delivery_confirmation: { subject: `Mailer delivery documentation — ${business}`, body: `Hi ${contact},\n\nAttached/linked is the written delivery record for [campaign ID], including the selected USPS route documentation and the dates/status supplied by the mailing provider. Directly measured QR visits or code redemptions are reported separately from leads, calls, appointments, or sales that you report.${common}` },
    renewal_offer: { subject: `Written renewal option for ${business}`, body: `Hi ${contact},\n\nI’m reviewing whether to open another local campaign. No date, route count, inventory, or price is reserved yet. If you want the written assumptions when they are verified, reply “renewal details.” There is no meeting requirement.${common}` },
  };
  return drafts[key];
}
