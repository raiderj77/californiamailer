import Link from "next/link";
import PublicSiteShell from "@/components/PublicSiteShell";
export const metadata = {
  title: "EDDM, Design & Mailing Services | CaliforniaMailer",
  description:
    "Choose EDDM campaign planning, design and print support, or a custom direct-mail quote.",
  alternates: { canonical: "/services" },
};
export default function Services() {
  return (
    <PublicSiteShell>
      <section className="cm-section">
        <p className="cm-eyebrow">LOCAL MAILING, CLEAR SCOPE</p>
        <h1>
          Make the next mailing
          <br />a well-planned one.
        </h1>
        <p className="cm-lead">
          Tell us what you have and where you want to reach. Your written quote
          confirms the services available for your campaign.
        </p>
        <div className="cm-grid">
          {[
            [
              "coop",
              "9 × 12 co-op postcard",
              "Share a postcard and its printing and mailing costs with other local businesses.",
              "Your business category, target community, offer, preferred placement size, and design needs. Campaign details and availability are confirmed in writing.",
            ],
            [
              "design",
              "Design & print support",
              "For businesses starting with an idea or existing artwork.",
              "Artwork requirements; design or file-preparation needs; stock, size, quantity, and proof review.",
            ],
            [
              "solo",
              "Custom direct mail",
              "For a mailing that needs a different audience or format.",
              "Audience requirements; mailing method; production needs; a separately reviewed scope and estimate.",
            ],
          ].map(([id, title, body, scope]) => (
            <article id={id} className="cm-panel" key={id}>
              <h2>{title}</h2>
              <p>{body}</p>
              <h3>Include in your request</h3>
              <p>{scope}</p>
              <Link className="cm-button" href={"/quote?service=" + id}>
                Request this service ↗
              </Link>
            </article>
          ))}
        </div>
      </section>
      <section className="cm-section cm-tinted">
        <h2>What your quote should make clear.</h2>
        <div className="cm-grid">
          <article>
            <h3>What is included</h3>
            <p>
              Design, printing, preparation, delivery to the postal entry point,
              and any work you will handle yourself.
            </p>
          </article>
          <article>
            <h3>What it costs</h3>
            <p>
              Quantity, print specifications, postage assumptions, service
              charges, and applicable taxes or shipping.
            </p>
          </article>
          <article>
            <h3>What happens next</h3>
            <p>
              Proof review, written approval, payment terms, and the planned
              production and postal-entry schedule.
            </p>
          </article>
        </div>
        <p>
          Quote requests are free. Checkout remains disabled; no order is placed
          until a separate agreement is reviewed and accepted.
        </p>
      </section>
    </PublicSiteShell>
  );
}
