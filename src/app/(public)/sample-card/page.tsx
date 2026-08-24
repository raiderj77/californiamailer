import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'Shared Mailer Layout Studies | CaliforniaMailer',
  description: 'Original, non-final layout studies for shared mailers, California postcards, and partner-distributed pizza-box coupon flyers.',
  alternates: { canonical: 'https://californiamailer.com/sample-card' },
};

const preflightChecks = [
  ['Physical dimensions', 'Measure the final 9 × 12 trim, bleed, safe areas, thickness, stock, and orientation.'],
  ['Postal clear zones', 'Reserve and verify the exact indicia, address block, barcode, return-address, and required marking areas.'],
  ['Readable ad area', 'Prove that every paid unit can hold a useful offer, identity, contact path, terms, and required disclaimer at print size.'],
  ['Brand and disclosure space', 'Keep CaliforniaMailer identity, commercial context, category rules, and any shared-card disclosures visible.'],
  ['Address-side hierarchy', 'Review the postal side as a primary view while keeping its headline, offer, and response path outside every required clear zone.'],
  ['Coupon identity', 'If an offer can be clipped or separated, keep the business identity, redemption path, code, dates, and terms with that offer.'],
  ['Combined-artwork proof', 'Inspect the complete two-sided file rather than approving isolated advertiser boxes.'],
  ['Printed physical sample', 'Review at actual size before activating payment or authorizing a 5,000-piece production run.'],
];

const layoutStudies = [
  {
    id: '9x12-comfortable',
    family: '9 × 12 shared card',
    inventory: '16–18 offer-led ads',
    status: 'Documented planning range · preflight required',
    columns: 'grid-cols-4',
    cells: 16,
    note: 'A lower-density starting point that gives each advertiser more room for identity, a real offer, response paths, and terms.',
  },
  {
    id: '9x12-experiment',
    family: '9 × 12 experimental card',
    inventory: '24 equal paid units',
    status: 'Owner-requested experiment · fit unproven',
    columns: 'grid-cols-4',
    cells: 24,
    note: 'The active economics scenario. No payment or print authorization is allowed until a physical two-sided proof demonstrates useful, readable units.',
  },
  {
    id: '12x15',
    family: '12 × 15 shared card',
    inventory: 'Up to 25 planning units',
    status: 'Larger-format evidence · quote and preflight required',
    columns: 'grid-cols-5',
    cells: 25,
    note: 'A larger surface can support a denser co-op plan, but postal zones, weight, handling, cost, and actual unit dimensions still control feasibility.',
  },
  {
    id: 'm6',
    family: 'M6 small shared mailer',
    inventory: '6 equal planning panels',
    status: 'Six-panel model · quote and preflight required',
    columns: 'grid-cols-2',
    cells: 6,
    note: 'A smaller shared format for a limited set of complementary advertisers. Split M7–M9 variants need their own unequal-size price mix.',
  },
  {
    id: 'm3',
    family: 'M3 partner mailer',
    inventory: 'Owner planning mix: 2 paid partners + 1 house panel',
    status: 'Unverified panel mix · template, list, and cost evidence required',
    columns: 'grid-cols-1',
    cells: 3,
    note: 'This configured mix is a planning study, not a publicly verified HRM layout. If used, the house panel is never counted as paid funding.',
  },
] as const;

export default async function SampleCardPage() {
  const publicPrices = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-bold text-amber-950">
          Concept only — not final artwork, not a 24-ad proof, not a mailed piece, and not evidence of participating advertisers.
        </div>
        <div className="mt-8 max-w-4xl">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">{FOUNDING_CAMPAIGN.planId} · {FOUNDING_CAMPAIGN.offerModelVersion}</div>
          <h1 className="mt-3 text-4xl font-black md:text-6xl">Study every format before selling the space.</h1>
          <p className="mt-5 text-lg leading-8 text-slate-600">
            The active preview proposes a 9 × 12, 14 pt mailer, {FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} pieces, and {FOUNDING_CAMPAIGN.placements.standard.count} equal paid slot-units. The per-unit planning price is {publicPrices.active.supported ? `${publicPrices.active.customerUnitPriceLabel} each` : publicPrices.active.customerUnitPriceLabel}. This page deliberately does not draw 24 finished ads because no physical template has proved they fit.
          </p>
        </div>

        <section className="mt-10 overflow-hidden rounded-3xl border-8 border-slate-900 bg-white p-4 shadow-xl" aria-labelledby="concept-diagram-title">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 pb-4">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.2em] text-rose-700">Not to scale · unapproved concept</div>
              <h2 id="concept-diagram-title" className="mt-1 text-2xl font-black">9 × 12 physical-space study</h2>
            </div>
            <div className="rounded-full bg-rose-100 px-4 py-2 text-sm font-black text-rose-900">24-unit fit: unproven</div>
          </div>
          <div className="mt-4 grid min-h-[28rem] gap-4 bg-slate-100 p-4 md:grid-cols-[1fr_0.38fr]">
            <div className="flex flex-col justify-between rounded-2xl border-2 border-dashed border-blue-500 bg-blue-50 p-6">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-800">Potential advertiser field</div>
                <h3 className="mt-3 max-w-xl text-3xl font-black text-slate-950">No production grid is claimed here.</h3>
                <p className="mt-4 max-w-xl leading-7 text-slate-700">The usable area can be divided only after typography, offers, disclosures, borders, imagery, and the reverse-side postal requirements are tested at actual print size.</p>
              </div>
              <div className="rounded-xl border border-blue-200 bg-white p-4 text-sm leading-6 text-slate-600">A slot count in a catalog is an inventory hypothesis. It is not visual evidence that equal, commercially useful ads fit.</div>
            </div>
            <div className="grid gap-4">
              <div className="rounded-2xl border-2 border-dashed border-amber-500 bg-amber-50 p-5">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-800">Reserved postal area</div>
                <p className="mt-3 text-sm leading-6 text-slate-700">Indicia, address, barcode, return address, and required markings must be positioned from the supplier/postal specification.</p>
              </div>
              <div className="rounded-2xl border-2 border-dashed border-violet-500 bg-violet-50 p-5">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-violet-800">Brand and disclosures</div>
                <p className="mt-3 text-sm leading-6 text-slate-700">Shared-mailer identity, contact, commercial context, and required disclaimers need readable space.</p>
              </div>
              <div className="rounded-2xl border-2 border-dashed border-slate-400 bg-white p-5">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-600">Bleed and safe area</div>
                <p className="mt-3 text-sm leading-6 text-slate-700">Critical copy and codes cannot drift into trim, fold, or unsafe production zones.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-14" aria-labelledby="format-studies-title">
          <div className="max-w-4xl">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Original planning diagrams · not source artwork</div>
            <h2 id="format-studies-title" className="mt-2 text-3xl font-black text-slate-950">Co-op layout families to validate</h2>
            <p className="mt-4 leading-7 text-slate-600">
              These schematic studies translate general operating patterns into CaliforniaMailer&apos;s own planning language. They contain no advertiser artwork, copied templates, promised response, or proof that a listed capacity fits the final postal file.
            </p>
          </div>
          <div className="mt-7 grid gap-6 lg:grid-cols-2">
            {layoutStudies.map((study) => (
              <article key={study.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">{study.family}</h3>
                    <p className="mt-1 font-bold text-blue-800">{study.inventory}</p>
                  </div>
                  <span className="max-w-56 rounded-full bg-amber-100 px-3 py-1 text-right text-xs font-black leading-5 text-amber-950">
                    {study.status}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className={`mt-5 grid ${study.columns} gap-1.5 rounded-2xl border-4 border-slate-800 bg-slate-100 p-3`}
                >
                  {Array.from({ length: study.cells }, (_, index) => (
                    <div
                      key={`${study.id}-${index}`}
                      className={`min-h-8 rounded border border-dashed ${study.id === 'm3' && index === 2 ? 'border-violet-500 bg-violet-100' : 'border-blue-400 bg-blue-50'}`}
                    />
                  ))}
                  <div className="col-span-full mt-1 min-h-8 rounded border border-dashed border-amber-500 bg-amber-50" />
                </div>
                <div className="mt-2 flex gap-4 text-xs font-bold text-slate-500">
                  <span><span className="text-blue-700">■</span> content field</span>
                  <span><span className="text-amber-700">■</span> postal/brand reserve</span>
                  {study.id === 'm3' && <span><span className="text-violet-700">■</span> house panel</span>}
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{study.note}</p>
              </article>
            ))}

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Community and new-mover cards</h3>
                  <p className="mt-1 font-bold text-blue-800">Custom sponsor and offer mix</p>
                </div>
                <span className="max-w-56 rounded-full bg-amber-100 px-3 py-1 text-right text-xs font-black leading-5 text-amber-950">Audience-specific · quote only</span>
              </div>
              <div aria-hidden="true" className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border-4 border-slate-800 bg-slate-100 p-3">
                <div className="col-span-2 min-h-20 rounded border border-dashed border-violet-500 bg-violet-100" />
                <div className="min-h-20 rounded border border-dashed border-blue-400 bg-blue-50" />
                {Array.from({ length: 6 }, (_, index) => <div key={index} className="min-h-12 rounded border border-dashed border-blue-400 bg-blue-50" />)}
                <div className="col-span-3 min-h-9 rounded border border-dashed border-amber-500 bg-amber-50" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">Premium sponsor space, standard offers, organizer identity, and the audience definition must be priced as a deliberate mix. New-mover targeting is not EDDM and requires lawful, current list and mailing costs.</p>
            </article>

            <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Directory-style card</h3>
                  <p className="mt-1 font-bold text-blue-800">Many compact listings · not equal display ads</p>
                </div>
                <span className="max-w-56 rounded-full bg-amber-100 px-3 py-1 text-right text-xs font-black leading-5 text-amber-950">Custom inventory · quote only</span>
              </div>
              <div aria-hidden="true" className="mt-5 grid grid-cols-3 gap-1.5 rounded-2xl border-4 border-slate-800 bg-slate-100 p-3">
                {Array.from({ length: 18 }, (_, index) => <div key={index} className="min-h-7 rounded border border-dashed border-blue-400 bg-blue-50" />)}
                <div className="col-span-3 min-h-9 rounded border border-dashed border-amber-500 bg-amber-50" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">A listing can carry less content and value than an offer-led ad. Capacity, category grouping, legibility, upsells, and the revenue mix must be solved as a separate product—not inferred from the 9 × 12 slot price.</p>
            </article>

            <article className="rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-xl font-black text-slate-950">Partner-distributed pizza-box flyer</h3>
                  <p className="mt-1 font-bold text-violet-900">Noncompeting coupon mix · restaurant distribution</p>
                </div>
                <span className="max-w-56 rounded-full bg-amber-100 px-3 py-1 text-right text-xs font-black leading-5 text-amber-950">Not USPS mail · California quote only</span>
              </div>
              <div aria-hidden="true" className="mt-5 grid grid-cols-3 gap-2 rounded-2xl border-4 border-slate-800 bg-white p-3">
                <div className="col-span-3 min-h-14 rounded border border-dashed border-violet-500 bg-violet-100" />
                {Array.from({ length: 9 }, (_, index) => <div key={index} className="min-h-14 rounded border border-dashed border-blue-400 bg-blue-50" />)}
                <div className="col-span-3 min-h-9 rounded border border-dashed border-emerald-500 bg-emerald-50" />
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-700">Printing4SuperCheap is the required printer, but a documented restaurant partner—not USPS—distributes the piece with qualifying orders. Inventory requires a signed agreement, verified box volume, category rules, rights-attested artwork, exact handoff evidence, and a delivery-reporting plan. Historical course prices, response claims, and informal cash collection are not used.</p>
              <Link href="/quote" className="mt-4 inline-block font-black text-violet-900 underline underline-offset-4">Request a California partner-placement fit preview</Link>
            </article>
          </div>
        </section>

        <section className="mt-10 rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-2xl font-black text-amber-950">Why the concept is intentionally incomplete</h2>
          <p className="mt-4 leading-7 text-slate-700">
            HRM guidance describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15. The requested 24 equal units sit outside the cited comfortable 9 × 12 range. A real physical sample must resolve that conflict; the catalog, this diagram, and a favorable revenue calculation cannot.
          </p>
        </section>

        <section className="mt-14" aria-labelledby="preflight-checklist">
          <h2 id="preflight-checklist" className="text-3xl font-black text-slate-950">Required preflight evidence</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {preflightChecks.map(([title, detail], index) => (
              <article key={title} className="rounded-2xl border border-slate-200 p-6">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Check {index + 1}</div>
                <h3 className="mt-2 text-lg font-black text-slate-950">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="mt-12 flex flex-wrap items-center gap-3">
          <Link href="/founding-mailer" className="rounded-full bg-slate-950 px-6 py-3 font-black text-white hover:bg-slate-800">View campaign state</Link>
          <Link href="/pricing" className="rounded-full border border-slate-300 px-6 py-3 font-black hover:border-slate-500">Review planning and quote-only models</Link>
          <Link href="/quote" className="rounded-full border border-blue-300 px-6 py-3 font-black text-blue-900 hover:border-blue-500">Request a private fit preview</Link>
          <p className="w-full text-sm text-slate-500">Nothing on this page indicates category availability, a paid reservation, or print readiness.</p>
        </div>
      </div>
    </PublicShell>
  );
}
