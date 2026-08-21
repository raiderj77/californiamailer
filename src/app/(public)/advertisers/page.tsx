import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { SHARED_MAILER_MODELS } from '@/config/sharedMailerModels';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'For Advertisers | CaliforniaMailer',
  description: 'Review the experimental Monterey Peninsula shared-mailer plan and its gated advertiser workflow.',
  alternates: { canonical: 'https://californiamailer.com/advertisers' },
};

const activeModel = SHARED_MAILER_MODELS.find((model) => model.id === FOUNDING_CAMPAIGN.planId)
  ?? SHARED_MAILER_MODELS[0];

export default async function AdvertisersPage() {
  const publicPrices = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <section className="bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">For local advertisers · interest only</div>
          <h1 className="mt-3 max-w-4xl text-4xl font-black text-white md:text-6xl">A proposed equal slot-unit, not a promise of customers.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            CaliforniaMailer is validating an experimental shared-mailer layout and documented production workflow. It does not sell a guaranteed response, lead count, appointment, sale, or return on investment.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{FOUNDING_CAMPAIGN.planId} · {FOUNDING_CAMPAIGN.offerModelVersion}</div>
            <h2 className="mt-3 text-3xl font-black">Experimental founding plan</h2>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <PlanFact label="Format" value="9 × 12 · 14 pt" detail="Shared EDDM planning format" />
              <PlanFact label="Planning quantity" value={`${FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} pieces`} detail="Exact routes and mailed count are not verified" />
              <PlanFact label="Equal slot-units" value={FOUNDING_CAMPAIGN.placements.standard.count.toLocaleString()} detail={publicPrices.active.supported ? `Proposed ${publicPrices.active.customerUnitPriceLabel} per paid unit` : publicPrices.active.customerUnitPriceLabel} />
              <PlanFact label="Full funding goal" value={publicPrices.active.derivedFundingGoalLabel} detail={`${FOUNDING_CAMPAIGN.minimumPaidPlacements} paid units required by the plan`} />
            </dl>
            <p className="mt-5 text-sm leading-6 text-slate-600">
              The proposed price, inventory, and funding goal are planning assumptions. They are not live availability or active checkout terms.
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
            <h2 className="text-xl font-black">Proposed inclusions</h2>
            <ul className="mt-5 space-y-3">
              {FOUNDING_CAMPAIGN.inclusions.map((item) => <li key={item} className="flex gap-3"><span className="font-black text-blue-700">✓</span><span>{item}</span></li>)}
            </ul>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-2xl font-black text-amber-950">The 24 units have not been physically proven</h2>
          <p className="mt-4 max-w-5xl leading-7 text-slate-700">
            HRM evidence describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15. Before this 24-unit 9 × 12 can be offered for payment, an actual template must preserve the indicia and address area, branding, disclosures, bleed, safe areas, and readable advertiser content. A catalog selection or favorable calculation cannot pass that preflight.
          </p>
          <p className="mt-4 text-sm font-bold text-amber-950">Checkout and print authorization are disabled while that layout, the current supplier total, routes, policies, and complete economics remain unapproved.</p>
          <p className="mt-3 text-xs leading-5 text-slate-600">{activeModel.layoutEvidence.note}</p>
        </div>

        <div className="mt-16 grid gap-5 md:grid-cols-3">
          <InfoCard title="Asynchronous by default" text="Review the campaign, private concept, terms, future intake, and proof online. Ask for a call only if you want one. Checkout is not currently available." />
          <InfoCard title="Real category control" text="Interest is not a sold category. If reservations activate later, only provider-verified cleared payment can make a paid unit or category count as sold." />
          <InfoCard title="Evidence after delivery" text="A unique redirect can record HTTP requests and label likely bots. Coupon use, calls, leads, appointments, and sales remain advertiser-reported unless a separate verified source measures them." />
        </div>

        <div className="mt-16 grid gap-5 rounded-3xl bg-blue-50 p-8 md:grid-cols-[1fr_auto] md:items-center md:gap-8">
          <div>
            <h2 className="text-2xl font-black">Check the campaign before sharing materials.</h2>
            <p className="mt-2 text-slate-700">The current state accepts interest only. Other shared-mailer families and standalone mailings are separate quote-only projects.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/founding-mailer" className="inline-block rounded-full bg-blue-700 px-6 py-3 font-black text-white hover:bg-blue-800">View campaign state</Link>
            <Link href="/pricing" className="inline-block rounded-full border border-blue-300 bg-white px-6 py-3 font-black text-blue-900 hover:border-blue-500">Compare formats</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function PlanFact({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="rounded-3xl border border-slate-200 p-6"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-3 text-3xl font-black text-slate-950">{value}</dd><dd className="mt-2 text-sm leading-6 text-slate-600">{detail}</dd></div>;
}

function InfoCard({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-slate-200 p-6"><h3 className="text-lg font-black">{title}</h3><p className="mt-3 leading-7 text-slate-600">{text}</p></div>;
}
