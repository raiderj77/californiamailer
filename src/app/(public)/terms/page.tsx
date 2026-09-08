import PublicSiteShell from "@/components/PublicSiteShell";
export const metadata = {
  title: "Website Terms | CaliforniaMailer",
  description:
    "How quote requests, campaign approval, and use of CaliforniaMailer website information work.",
  alternates: { canonical: "/terms" },
};
export default function Terms() {
  return (
    <PublicSiteShell>
      <article className="cm-section cm-reading">
        <p className="cm-eyebrow">BEFORE REQUESTING A QUOTE</p>
        <h1>Website terms</h1>
        <p>
          This website helps you request information and a written direct-mail
          quote. It does not accept orders or payments.
        </p>
        <h2>Quote requests</h2>
        <p>
          A request is not a paid reservation, accepted order, or guarantee of
          availability. Scope, price, included services, postage assumptions,
          timing, and payment terms must be confirmed in a separate written
          agreement before work begins.
        </p>
        <h2>Artwork and production</h2>
        <p>
          Only provide materials you have permission to use. Do not submit
          sensitive personal information, payment-card details, or customer
          lists through the quote form. Final artwork and postal requirements
          must be reviewed before printing.
        </p>
        <h2>Estimates and outcomes</h2>
        <p>
          Public information is for planning. Route counts, postal requirements,
          and costs can change. CaliforniaMailer does not guarantee postal
          delivery dates, response rates, leads, sales, or profit.
        </p>
        <h2>Questions and privacy</h2>
        <p>
          Use the <a href="/quote">contact and quote form</a> to ask about
          anything unclear before committing to a campaign. Our{" "}
          <a href="/privacy">privacy policy</a> describes how submitted
          information is handled.
        </p>
      </article>
    </PublicSiteShell>
  );
}
