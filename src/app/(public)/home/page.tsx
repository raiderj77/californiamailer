import Link from "next/link";
import Image from "next/image";
import PublicSiteShell from "@/components/PublicSiteShell";
export const metadata = {
  title: "9 × 12 Co-op Postcard Advertising | CaliforniaMailer",
  description:
    "Share a 9 × 12 postcard with local businesses in Monterey County and California. Ask about ad space, campaign areas, design, and mailing costs.",
  alternates: { canonical: "/home" },
};
const steps = [
  [
    "01",
    "Choose your community",
    "Tell us your business category and the community you want to reach. We review the campaign area and available placement options.",
  ],
  [
    "02",
    "Plan your ad space",
    "Share your offer and artwork needs. Your written quote confirms the ad size, shared campaign scope, and your cost.",
  ],
  [
    "03",
    "Review before anything prints",
    "Review the final artwork, route selection, scope, and schedule. Production requires a separate written agreement and approval.",
  ],
];
export default function HomePage() {
  return (
    <PublicSiteShell>
      <section className="cm-hero">
        <div>
          <p className="cm-eyebrow">MONTEREY COUNTY & CALIFORNIA</p>
          <h1>Share the postcard.<br /><span>Reach your neighborhood.</span></h1>
          <p className="cm-lead">
            Put your business on a 9 × 12 co-op postcard alongside other local
            businesses. Share the printing and mailing costs while reaching
            households in your selected California community.
          </p>
          <div className="cm-actions">
            <Link className="cm-button" href="/quote?service=coop">
              Ask about an ad space →
            </Link>
            <a className="cm-text-link" href="#how-it-works">
              See how it works ↓
            </a>
          </div>
          <p className="cm-fine">
            No mailing list needed for EDDM. No payment to request a quote.
          </p>
        </div>
        <figure className="cm-mail-preview">
          <Image src="/coop-postcard-9x12-reference-v2.png" width={1448} height={1086} alt="Landscape 9 by 12 co-op postcard concept with eight sample coupon ads surrounding a small CaliforniaMailer panel" priority sizes="(max-width: 760px) 90vw, 600px" />
          <figcaption>9 × 12 CO-OP POSTCARD <span>Concept layout · Sample ads</span></figcaption>
        </figure>
      </section>
      <div className="cm-strip">
        <span>One oversized postcard</span>
        <span>Multiple local businesses</span>
        <span>Shared printing & mailing costs</span>
      </div>
      <section className="cm-section" id="how-it-works">
        <p className="cm-eyebrow">FROM AN IDEA TO A MAILING PLAN</p>
        <h2>From your business to their mailbox.</h2>
        <div className="cm-grid">
          {steps.map(([n, title, body]) => (
            <article className="cm-panel" key={n}>
              <span className="cm-step">{n}</span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="cm-section cm-tinted">
        <p className="cm-eyebrow">CHOOSE YOUR STARTING POINT</p>
        <h2>Start with a shared postcard.</h2>
        <div className="cm-grid">
          {[
            [
              "coop",
              "9 × 12 co-op advertising",
              "Take an ad space alongside other local businesses and share the printing and mailing costs. Ask about your area and category.",
            ],
            [
              "design",
              "Design & print support",
              "Have artwork already, or need help getting started? Include the size, quantity, and design support you need.",
            ],
            [
              "solo",
              "Custom direct mail",
              "Planning something beyond a neighborhood mailing? Describe your audience and requirements for a custom review.",
            ],
          ].map(([id, title, body]) => (
            <article className="cm-panel" key={id}>
              <h3>{title}</h3>
              <p>{body}</p>
              <Link href={"/quote?service=" + id}>Request this service →</Link>
            </article>
          ))}
        </div>
      </section>
      <section className="cm-section cm-split" id="areas">
        <div>
          <p className="cm-eyebrow">START WITH THE RIGHT AREA</p>
          <h2>
            Think in neighborhoods,
            <br />
            not guesswork.
          </h2>
          <p>
            Salinas, Monterey, Carmel, Pacific Grove, Seaside, Marina—or another
            California community. Request an area review; route counts and
            service availability are confirmed for your campaign.
          </p>
          <a
            className="cm-text-link"
            href="https://eddm.usps.com/eddm/select-routes.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore routes on USPS (opens a new tab) ↗
          </a>
        </div>
        <aside className="cm-panel">
          <h3>What should I budget?</h3>
          <p>
            A mailing budget includes printing, postage, and any design or
            preparation work. Quantity, format, selected routes, and timing
            affect the total.
          </p>
          <p>
            Your written quote breaks down the costs for your campaign.
            Requesting a quote is free and does not place an order.
          </p>
          <Link className="cm-button" href="/quote">
            Request a written quote ↗
          </Link>
        </aside>
      </section>
      <section className="cm-section cm-faq">
        <p className="cm-eyebrow">BEFORE YOU START</p>
        <h2>A few useful answers.</h2>
        {[
          [
            "How does a co-op postcard work?",
            "Several businesses share one oversized postcard and its printing and mailing costs. Your quote confirms the placement size, campaign area, quantity, funding requirements, and schedule before you commit.",
          ],
          [
            "Is the sample showing available ad spaces?",
            "The sample illustrates a layout. It does not show booked advertisers or live inventory. Ask about your business category and area for current placement options.",
          ],
          [
            "Do I need a customer mailing list?",
            "Not for EDDM. It reaches delivery points on the carrier routes you select, rather than a list of named customers.",
          ],
          [
            "How many pieces can I send?",
            "USPS describes EDDM Retail as 200–5,000 pieces per day per ZIP Code. Larger or different mailings need the appropriate mailing plan. Final route counts and eligibility are checked before a quote is accepted.",
          ],
          [
            "Can I use my own design?",
            "Yes. Say that you have artwork in your request. Final format, print specifications, and postal eligibility must be reviewed before production. Do not upload artwork or a customer list through the quote form.",
          ],
          [
            "When will my mailing arrive?",
            "The production schedule and postal-entry plan are confirmed in writing. Postal delivery dates and business results are not guaranteed.",
          ],
          [
            "Do I pay on this website?",
            "No. Checkout remains disabled. A quote request does not place an order, reserve a mailing, or authorize payment.",
          ],
        ].map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
        <p className="cm-fine">
          Postal guidance checked September 7, 2026.{" "}
          <a href="https://www.usps.com/business/every-door-direct-mail.htm">
            Check current USPS requirements
          </a>
          .
        </p>
      </section>
      <section className="cm-final">
        <p className="cm-eyebrow">LET’S START WITH YOUR NEIGHBORHOOD</p>
        <h2>
          Where do you want
          <br />
          your business to go?
        </h2>
        <Link className="cm-button" href="/quote?service=coop">
          Ask about an ad space ↗
        </Link>
      </section>
    </PublicSiteShell>
  );
}
