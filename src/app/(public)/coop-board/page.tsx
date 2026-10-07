import PublicSiteShell from "@/components/PublicSiteShell";
import CoopCardSample from "@/components/CoopCardSample";
import { CAMPAIGN_PLANNER_URL } from "@/lib/campaignPlanner";
export const metadata = {
  title: "Co-op Mailing Inquiries | CaliforniaMailer",
  description: "Explore a 16-slot shared 9 x 12 postcard and start a nonbinding mailing plan for your neighborhood.",
  alternates: { canonical: "/coop-board" },
};
export default function Coop() {
  return <PublicSiteShell><section className="cm-section cm-split">
    <div><p className="cm-eyebrow">SHARED POSTCARD · GATHERING INTEREST</p><h1>Your offer. One equal space.</h1>
      <p>A shared 9 × 12 postcard with 16 equal ad slots total, eight per side. One advertiser per industry per card, subject to category review.</p>
      <p>Indicative planning prices per advertiser for one mailing: $399 for approximately 5,000 homes or $599 for approximately 10,000 homes. Final routes, inclusions, fees, and total price require a written quote.</p>
      <p>This is a sample, not live inventory. Planning is nonbinding and does not reserve a slot. No checkout, payment collection, or contract is available until costs and refund terms are approved. A later purchase requires full payment upfront, with no deposits.</p>
      <a className="cm-button" href={CAMPAIGN_PLANNER_URL}>Plan my mailing</a>
    </div><CoopCardSample />
  </section></PublicSiteShell>;
}
