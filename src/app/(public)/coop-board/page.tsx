import PublicSiteShell from "@/components/PublicSiteShell";
import CoopCardSample from "@/components/CoopCardSample";
import { CAMPAIGN_PLANNER_URL } from "@/lib/campaignPlanner";
export const metadata = {
  title: "Co-op Mailing Inquiries | CaliforniaMailer",
  description: "Explore a 16-slot shared 9 x 12 postcard and start a nonbinding local mailing plan for Salinas, Castroville, and nearby Monterey County neighborhoods.",
  alternates: { canonical: "/coop-board" },
};
export default function Coop() {
  return <PublicSiteShell><section className="cm-section cm-split">
    <div><p className="cm-eyebrow">SHARED POSTCARD · GATHERING INTEREST</p><h1>Your offer. One equal space.</h1>
      <p>A shared 9 × 12 postcard with 16 equal ad slots total, eight per side. One advertiser per industry per card, subject to category review.</p>
      <p>Initial co-op interest is for Salinas, Castroville, and nearby Monterey County neighborhoods. Exact routes are unconfirmed; each card serves selected local routes.</p>
      <p>Indicative planning prices per advertiser for one mailing: $499 for approximately 5,000 homes or $799 for approximately 10,000 homes. Final routes, inclusions, fees, and total price require a written quote.</p>
      <p>Both shared packages include basic ad design and offer help, one revision, written proof approval, one advertiser per defined industry subject to overlap review, a static QR link or offer code, a reusable approved digital ad, a route summary, and actual mailing-acceptance evidence after mailing. The written agreement confirms the scope before purchase; automatic scan analytics are not included.</p>
      <p>This is a sample, not live inventory. Planning is nonbinding and does not reserve a slot. No checkout, payment collection, or contract is available until costs and refund terms are approved. A later purchase requires full payment upfront, with no deposits.</p>
      <a className="cm-button" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a>
    </div><CoopCardSample />
  </section></PublicSiteShell>;
}
