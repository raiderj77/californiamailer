import Link from "next/link";
import { notFound } from "next/navigation";
import PublicSiteShell from "@/components/PublicSiteShell";
const cities: Record<string, string> = {
  salinas: "Salinas",
  monterey: "Monterey",
  carmel: "Carmel",
  "carmel-valley": "Carmel Valley",
  "pacific-grove": "Pacific Grove",
  seaside: "Seaside",
  marina: "Marina",
};
export function generateStaticParams() {
  return Object.keys(cities).map((slug) => ({ slug }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = cities[slug];
  if (!city) notFound();
  return {
    title: "EDDM Mailing in " + city + " | CaliforniaMailer",
    description:
      "Request a written neighborhood mailing quote for " +
      city +
      ". Confirm routes, quantity, artwork, and production scope before ordering.",
    alternates: { canonical: "/areas/" + slug },
  };
}
export default async function Area({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const city = cities[slug];
  if (!city) notFound();
  return (
    <PublicSiteShell>
      <section className="cm-section cm-reading">
        <p className="cm-eyebrow">CALIFORNIA NEIGHBORHOOD MAILING</p>
        <h1>Plan a mailing in {city}.</h1>
        <p className="cm-lead">
          Start with the neighborhoods your business can serve. USPS carrier
          routes, rather than citywide population estimates, determine the
          delivery points in an EDDM plan.
        </p>
        <h2>Bring your local plan into focus.</h2>
        <p>
          Tell us your target ZIP codes or neighborhoods, the offer you want to
          promote, your approximate quantity, and whether you have artwork
          ready. Availability, route counts, format, postage, and production
          scope are confirmed in writing.
        </p>
        <div className="cm-actions">
          <Link
            className="cm-button"
            href={"/quote?service=eddm&area=" + encodeURIComponent(city)}
          >
            Request an area review ↗
          </Link>
          <a
            href="https://eddm.usps.com/eddm/select-routes.htm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Explore USPS routes (new tab)
          </a>
        </div>
        <p>
          Requesting a quote does not reserve a route, place an order, or
          authorize payment.
        </p>
      </section>
    </PublicSiteShell>
  );
}
