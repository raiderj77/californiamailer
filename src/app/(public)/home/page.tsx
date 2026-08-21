import type { Metadata } from 'next';
import Link from 'next/link';
import {
  FOUNDING_CAMPAIGN,
} from '@/config/foundingCampaign';
import { PublicShell } from '@/components/public/PublicShell';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'California Postcard Mailing & Local Advertising | CaliforniaMailer',
  description:
    'Plan single-business postcards, shared mailers, and partner-distributed pizza-box advertising across California with current printer, route, partner, and margin evidence.',
  alternates: { canonical: 'https://californiamailer.com/home' },
  openGraph: {
    title: 'California postcard mailing and local advertising',
    description: 'Statewide quote-only postcard and partner-placement planning, plus an experimental Monterey Peninsula shared-mailer campaign.',
    url: 'https://californiamailer.com/home',
    type: 'website',
  },
};

const processSteps = [
  ['1', 'Define one versioned plan', 'The format, quantity, slot-units, proposed price, funding goal, territory, and policies are recorded together.'],
  ['2', 'Record interest', 'The owner reviews the business, offer, service area, content risk, and conflicting categories. Interest is not a paid reservation.'],
  ['3', 'Prove the physical layout', 'A real template must preserve the indicia, address area, branding, disclosures, bleed, safe areas, and readable advertiser content.'],
  ['4', 'Verify current economics', 'Exact routes, a current supplier total, fees, reserves, and all other costs must be complete before checkout can activate.'],
  ['5', 'Collect cleared funding', 'Only provider-verified cleared net payment counts. Pending promises and unpaid holds do not.'],
  ['6', 'Approve every proof', 'Each paid advertiser reviews the exact version, and the combined final artwork passes another preflight.'],
  ['7', 'Authorize and document delivery', 'The owner separately authorizes fulfillment and reports delivery evidence and measured tracking without promising results.'],
];

const mailingPaths = [
  {
    title: 'Shared local mailers',
    fit: 'For noncompeting businesses that want to share one route-based mailing.',
    examples: '9 × 12, 12 × 15, M6, M3, community, and directory concepts',
    href: '/pricing#shared-model-catalog',
  },
  {
    title: 'Single-business EDDM',
    fit: 'For one advertiser reaching every eligible residential address on selected carrier routes.',
    examples: 'Supplier catalog sizes with print-only or turnkey planning',
    href: '/california-postcard-mailing',
  },
  {
    title: 'Addressed solo mail',
    fit: 'For a defined list or audience such as a customer file, radius, farm, or verified mover segment.',
    examples: 'Audience, list rights, postage, and fulfillment quoted separately',
    href: '/california-postcard-mailing',
  },
  {
    title: 'Targeted community programs',
    fit: 'For new-mover, neighborhood, partner, or directory projects that need a custom cadence and mix.',
    examples: 'No borrowed slot count or price from a different format',
    href: '/quote',
  },
  {
    title: 'Pizza-box advertising',
    fit: 'For noncompeting local advertisers placed with the orders of a documented California restaurant partner.',
    examples: 'Printing4SuperCheap production · signed partner agreement · verified box volume',
    href: '/pizza-box-advertising',
  },
];

export default async function HomePage() {
  const publicPrices = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <section className="overflow-hidden bg-slate-950 text-white">
        <div className="mx-auto grid max-w-6xl gap-12 px-5 py-20 md:grid-cols-[1.2fr_0.8fr] md:py-28">
          <div>
            <div className="inline-flex rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-bold text-amber-100">
              California postcard and partner advertising · quote only
            </div>
            <h1 className="mt-7 max-w-4xl text-5xl font-black leading-[1.03] tracking-tight text-white md:text-7xl">
              Local postcard and partner placements, proven before they are sold or printed.
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300 md:text-xl">
              CaliforniaMailer accepts statewide requests for single-business postcards and documented pizza-box placements while validating a 9 × 12 shared mailer for approximately{' '}
              {FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} selected Monterey Peninsula residences.
              Every path stays behind current printer, route or partner, rights, cost, margin, payment, and production gates.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Link href="/founding-mailer" className="rounded-full bg-blue-500 px-6 py-3 font-black text-white hover:bg-blue-400">
                See the campaign state
              </Link>
              <Link href="/sample-card" className="rounded-full border border-slate-600 px-6 py-3 font-black text-white hover:border-slate-300">
                Review the preflight concept
              </Link>
              <Link href="/quote" className="rounded-full border border-slate-600 px-6 py-3 font-black text-white hover:border-slate-300">
                Request a free private fit preview
              </Link>
            </div>
            <p className="mt-5 text-sm text-slate-400">
              No response, lead, appointment, sale, delivery date, exact household count, or production-ready layout is promised.
            </p>
          </div>

          <aside className="rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl md:p-8">
            <div className="text-xs font-black uppercase tracking-[0.2em] text-blue-300">Active configuration preview</div>
            <p className="mt-2 break-all text-xs text-slate-300">{FOUNDING_CAMPAIGN.planId} · {FOUNDING_CAMPAIGN.offerModelVersion}</p>
            <dl className="mt-6 space-y-5">
              <OfferRow label="Format" value="9 × 12 · 14 pt" />
              <OfferRow label="Planning quantity" value={`${FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} pieces`} />
              <OfferRow label="Equal paid units" value={`${FOUNDING_CAMPAIGN.placements.standard.count} units · ${publicPrices.active.supported ? `${publicPrices.active.customerUnitPriceLabel} proposed each` : publicPrices.active.customerUnitPriceLabel}`} />
              <OfferRow label="Full funding goal" value={publicPrices.active.derivedFundingGoalLabel} />
              <OfferRow label="Checkout" value="Disabled" />
            </dl>
            <div className="mt-7 rounded-2xl border border-amber-400/30 bg-amber-300/10 p-4 text-sm leading-6 text-amber-100">
              HRM guidance describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15.
              This requested 24-unit 9 × 12 is therefore experimental. A catalog entry or revenue calculation cannot make it ready for payment or print.
            </div>
          </aside>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50">
        <div className="mx-auto grid max-w-6xl gap-px bg-slate-200 md:grid-cols-4">
          <Principle title="Owner-managed" text="Direct accountability without implying a team." />
          <Principle title="Versioned inventory" text="One active model ties its size, units, quantity, and proposed price together." />
          <Principle title="Cleared funds only" text="Unpaid holds and pending payment never inflate progress." />
          <Principle title="Separate readiness gates" text="Economics, template fit, final artwork, and delivery evidence are checked independently." />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:items-end">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Choose by audience first</div>
            <h2 className="mt-3 text-4xl font-black tracking-tight">One mailing method does not fit every business.</h2>
          </div>
          <p className="text-lg leading-8 text-slate-600">
            Established direct-mail operators separate shared, standalone, saturation, and triggered audiences. CaliforniaMailer does the same, while keeping every unverified format quote-only and every response claim out of the sales pitch.
          </p>
        </div>
        <div className="mt-10 grid gap-4 md:grid-cols-2">
          {mailingPaths.map((path) => (
            <article key={path.title} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-slate-950">{path.title}</h3>
              <p className="mt-3 leading-7 text-slate-700">{path.fit}</p>
              <p className="mt-3 text-sm leading-6 text-slate-500">{path.examples}</p>
              <Link href={path.href} className="mt-6 font-black text-blue-700 underline decoration-2 underline-offset-4">Review this path</Link>
            </article>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-slate-950 p-6 text-white">
          <div><strong className="text-lg">Prefer a faceless sales process?</strong><p className="mt-1 text-sm leading-6 text-slate-300">Choose “Email only — no sales call” on the quote form. A request enters the private owner CRM for a possible free fit preview; no notification or marketing sequence is sent automatically.</p></div>
          <Link href="/quote" className="rounded-full bg-blue-500 px-5 py-3 font-black hover:bg-blue-400">Request a private fit preview</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-20">
        <div className="max-w-3xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">How the cooperative works</div>
          <h2 className="mt-3 text-4xl font-black tracking-tight">Seven gates, not a leap of faith.</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">
            Advertisers could share one oversized mailer, but only after the proposed inventory is physically proven and the campaign passes its financial and policy checks.
          </p>
        </div>
        <ol className="mt-12 grid gap-4 md:grid-cols-2">
          {processSteps.map(([number, title, stepText]) => (
            <li key={number} className="rounded-2xl border border-slate-200 p-6">
              <div className="flex gap-4">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 font-black text-blue-800">{number}</span>
                <div><h3 className="text-lg font-black">{title}</h3><p className="mt-2 leading-7 text-slate-600">{stepText}</p></div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="bg-blue-50">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 md:grid-cols-2">
          <div>
            <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">No-call-required sales</div>
            <h2 className="mt-3 text-4xl font-black tracking-tight">Review asynchronously; payment stays gated.</h2>
            <p className="mt-5 text-lg leading-8 text-slate-700">
              A qualified business can review the factual campaign page, receive a private placement concept,
              answer by email, submit materials later, and approve a proof without an in-person meeting or on-camera pitch.
              Hosted checkout becomes relevant only after the experimental template and current economics are approved.
            </p>
          </div>
          <div className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-blue-100">
            <h3 className="text-xl font-black">What earns trust</h3>
            <ul className="mt-5 space-y-3 text-slate-700">
              {[
                'A real category state—not invented scarcity',
                'A proposed planning price clearly separated from an active checkout price',
                'Target reach separated from route-verified delivery count',
                'A written funding and refund policy',
                'Physical template preflight before payment activation',
                'Final written proof approval before print',
                'Measured events separated from advertiser-reported outcomes',
              ].map((item) => <li key={item} className="flex gap-3"><span className="font-black text-blue-700">✓</span><span>{item}</span></li>)}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-20 text-center">
        <h2 className="text-4xl font-black tracking-tight">Start with the facts.</h2>
        <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          The public campaign board distinguishes a published database record from this experimental configuration preview.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/founding-mailer" className="rounded-full bg-slate-950 px-6 py-3 font-black text-white hover:bg-slate-800">View founding mailer</Link>
          <Link href="/pricing" className="rounded-full border border-slate-300 px-6 py-3 font-black hover:border-slate-500">Review planning prices and quote-only formats</Link>
        </div>
      </section>
    </PublicShell>
  );
}

function OfferRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-end justify-between gap-5 border-b border-slate-700 pb-4"><dt className="text-sm text-slate-400">{label}</dt><dd className="text-right text-xl font-black text-white">{value}</dd></div>;
}

function Principle({ title, text }: { title: string; text: string }) {
  return <div className="bg-slate-50 px-5 py-7 text-center"><div className="font-black">{title}</div><div className="mt-1 text-sm leading-6 text-slate-600">{text}</div></div>;
}
