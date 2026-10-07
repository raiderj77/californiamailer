import PublicSiteShell from "@/components/PublicSiteShell";
import CoopCardSample from "@/components/CoopCardSample";
import { CAMPAIGN_PLANNER_URL } from "@/lib/campaignPlanner";

export const metadata = {
  title: "9 x 12 Co-op Postcard Advertising | CaliforniaMailer",
  description: "Plan a shared 9 x 12 postcard for your California neighborhood. 16 equal ad slots, one advertiser per industry per card. Nonbinding planning starts here.",
  alternates: { canonical: "/" },
};

const steps = [
  ["01", "Choose the neighborhood", "Start with your service area, your business category, and a useful offer. The interactive planner helps you shape a starting plan."],
  ["02", "Make the offer easy to act on", "A clear headline, a reason to respond, and one simple next step. Proposed support includes basic design and offer help, one revision, and your proof approval."],
  ["03", "Review the details together", "Before a purchase, review the routes, household count, final price, scope, refund terms, and schedule. Nothing prints without artwork approval."],
];
const questions = [
  ["What is a co-op postcard?", "Local businesses share one oversized postcard and the printing and mailing costs. Our proposed 9 × 12 card has 16 equal ad slots total: eight on the front and eight on the back."],
  ["Will a competitor be on my card?", "The shared-card plan allows one advertiser per industry per card. Category fit and overlapping services are reviewed before any placement is confirmed. Starting a plan does not hold a category."],
  ["Are the prices final?", "$399 for approximately 5,000 homes and $599 for approximately 10,000 homes are indicative planning prices per advertiser for one shared mailing. Final routes, household counts, inclusions, fees, and total cost must be confirmed in writing. Dedicated EDDM is quoted separately."],
  ["What help can I ask for?", "The proposed scope includes basic design and offer help with one revision, proof approval, a static QR code or offer code, a reusable approved ad, a route summary, and actual postal acceptance evidence after mailing. Your written scope confirms what is included. A static QR code does not include automatic analytics."],
  ["When would the holiday mailing happen?", "Mid-November 2026 is a planning target only. It depends on sufficient funding, approved artwork, vendor capacity, and the postal schedule. Arrival dates, response, and sales are not guaranteed."],
  ["Am I reserving a spot or paying today?", "No. This is a nonbinding interest page. The planner does not reserve a slot, create a contract, or collect payment. No purchase opens until costs and refund terms are approved. If you later purchase, full payment is required upfront; there are no deposits."],
  ["What if the shared mailing cannot go ahead?", "The written cancellation and refund terms must be approved and shared before any purchase. We are gathering interest now; we are not collecting funds or promising a launch date."],
  ["Can I have a postcard just for my business?", "Yes, ask for a dedicated EDDM plan. Your business has its own postcard on selected carrier routes. Design, printing, preparation, and postage are quoted for your actual quantity and scope."],
];

export default function HomePage() {
  return <PublicSiteShell>
    <section className="cm-hero cm-advertiser-hero">
      <div>
        <p className="cm-eyebrow">MONTEREY COUNTY & CALIFORNIA</p>
        <h1>A local offer.<br /><span>A place in the mailbox.</span></h1>
        <p className="cm-lead">Put your business on a shared 9 × 12 postcard with other local businesses. Reach the neighborhoods you serve while sharing the printing and mailing costs.</p>
        <div className="cm-actions"><a className="cm-button" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a><a className="cm-text-link" href="#sample">Explore the sample</a></div>
        <p className="cm-fine">Start a nonbinding plan. No payment. No reserved slot.</p>
        <div className="cm-hero-facts"><span><strong>16</strong> equal ad slots total</span><span><strong>1</strong> advertiser per industry per card</span></div>
      </div>
      <div id="sample"><CoopCardSample /></div>
    </section>
    <div className="cm-strip"><span>One useful offer</span><span>Your chosen neighborhoods</span><span>Your proof approval before print</span></div>
    <section className="cm-section" id="mailing-options">
      <p className="cm-eyebrow">TWO WAYS TO REACH YOUR NEIGHBORS</p><h2>Share a card. Or make it all yours.</h2>
      <p className="cm-lead">Start with a planning budget. Final routes, household counts, inclusions, fees, and total price are confirmed in writing before any purchase.</p>
      <div className="cm-grid cm-price-grid">
        <article className="cm-panel"><p className="cm-eyebrow">SHARED · ONE MAILING</p><h3>About 5,000 homes</h3><p className="cm-price">$399 <span>per advertiser</span></p><p>One equal ad slot on a 16-slot co-op postcard. A focused starting point for the neighborhoods closest to your business.</p><a className="cm-text-link" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a></article>
        <article className="cm-panel cm-featured"><p className="cm-eyebrow">SHARED · ONE MAILING</p><h3>About 10,000 homes</h3><p className="cm-price">$599 <span>per advertiser</span></p><p>The same equal-slot format, with a larger proposed reach. Route availability and the mailing plan determine the final count.</p><a className="cm-text-link" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a></article>
        <article className="cm-panel"><p className="cm-eyebrow">DEDICATED EDDM</p><h3>Your business only</h3><p className="cm-price cm-price-quote">Custom quote</p><p>Your own postcard on selected carrier routes. Choose this when you need more room for your message and a campaign of your own.</p><a className="cm-text-link" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a></article>
      </div>
      <p className="cm-fine">Shared prices are indicative planning figures, not a live offer or checkout price. One advertiser per industry per card; category fit requires review.</p>
    </section>
    <section className="cm-section cm-tinted" id="how-it-works"><p className="cm-eyebrow">A SIMPLE START</p><h2>You know your business.<br />Start with the offer.</h2><div className="cm-grid">{steps.map(([number,title,body])=><article key={number}><span className="cm-step">{number}</span><h3>{title}</h3><p>{body}</p></article>)}</div></section>
    <section className="cm-section cm-split" id="areas"><div><p className="cm-eyebrow">WHO SHOULD SEE YOUR OFFER?</p><h2>Start where your customers live.</h2><p>Salinas, Monterey, Carmel, Pacific Grove, Seaside, Marina, or another California community. Tell us where you work and how far your customers are likely to travel.</p><p>EDDM uses selected carrier routes rather than a list of named customers. Exact routes and current residential counts must be reviewed before a mailing is confirmed.</p><a className="cm-text-link" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a></div><aside className="cm-panel cm-season"><p className="cm-eyebrow">HOLIDAY MAILING · GATHERING INTEREST</p><h3>A mid-November 2026 target.</h3><p>Bring a seasonal offer worth keeping: a useful service, a neighborhood visit, or an easy next step.</p><p>The target depends on sufficient funding, approved artwork, vendor capacity, and the postal schedule. Arrival, response, and sales are not guaranteed.</p><p className="cm-fine">No confirmed launch or sold-slot count is represented here.</p></aside></section>
    <section className="cm-section cm-faq"><p className="cm-eyebrow">BEFORE YOU DECIDE</p><h2>Good questions. Clear answers.</h2>{questions.map(([question,answer])=><details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</section>
    <section className="cm-final"><p className="cm-eyebrow">YOUR BUSINESS. YOUR NEIGHBORHOOD.</p><h2>Give your next mailing<br />a clear starting point.</h2><a className="cm-button" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a><p className="cm-fine cm-final-note">Explore your options in the interactive planner. Nonbinding; no payment or reservation.</p></section>
  </PublicSiteShell>;
}
