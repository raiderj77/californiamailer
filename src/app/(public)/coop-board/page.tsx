import PublicSiteShell from "@/components/PublicSiteShell";
import Link from "next/link";
export const metadata = {
  title: "Co-op Mailing Inquiries | CaliforniaMailer",
  description:
    "Ask about a shared postcard campaign. Availability and pricing require a written quote.",
  alternates: { canonical: "/coop-board" },
};
export default function Coop() {
  return (
    <PublicSiteShell>
      <section className="cm-section cm-reading">
        <p className="cm-eyebrow">SHARED POSTCARD INQUIRIES</p>
        <h1>Interested in a co-op mailing?</h1>
        <p>
          A co-op mailing combines several businesses on a shared postcard. Tell
          us your business category and target area to request a review.
        </p>
        <p>
          No live inventory, confirmed campaign, or placement is offered on this
          page. Availability, participating businesses, funding, scope, and
          timing must be confirmed in writing before any commitment.
        </p>
        <Link className="cm-button" href="/quote?service=coop">
          Ask about a co-op mailing ↗
        </Link>
        <p className="cm-fine" style={{ marginTop: 24 }}>
          Checkout remains disabled. This inquiry does not reserve a spot.
        </p>
      </section>
    </PublicSiteShell>
  );
}
