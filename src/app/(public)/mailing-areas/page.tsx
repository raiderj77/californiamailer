import type { Metadata } from 'next';
import Link from 'next/link';
import { MailingAreaExplorer } from '@/components/public/MailingAreaExplorer';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'Mailing Areas & Campaign Zones | CaliforniaMailer',
  description: 'Explore public CaliforniaMailer planning areas and see whether a current verified carrier-route snapshot is available.',
  alternates: { canonical: 'https://californiamailer.com/mailing-areas' },
};

export default function MailingAreasPage() {
  return (
    <PublicShell>
      <section className="bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">Mailing areas · evidence before estimates</div>
          <h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">Plan by a real mailing area, not a vague “territory.”</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Search public planning areas by place or ZIP Code. Exact carrier-route counts appear only when CaliforniaMailer has a current, verified route-plan snapshot; otherwise the page stays at candidate geography and planning intent.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="explore-mailing-areas">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Public area explorer</div>
          <h2 id="explore-mailing-areas" className="mt-2 text-3xl font-black text-slate-950">Candidate geography and current route evidence</h2>
          <p className="mt-4 leading-7 text-slate-600">
            A 5,000- or 10,000-piece goal is a planning scenario, not a substitute for carrier-route selection. The selected routes determine the address count that can support a final written quote.
          </p>
        </div>
        <div className="mt-8">
          <MailingAreaExplorer />
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-16" aria-labelledby="area-terms">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Three different concepts</div>
            <h2 id="area-terms" className="mt-2 text-3xl font-black text-slate-950">What “territory” can mean in direct mail</h2>
            <p className="mt-4 leading-7 text-slate-600">CaliforniaMailer uses more precise public terms so a planning area is not mistaken for a permanent exclusive market.</p>
          </div>
          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            <ConceptCard
              number="01"
              title="Mailing area / campaign zone"
              text="A city, ZIP Code group, or other candidate geography used to start route planning. It becomes exact only after carrier routes and their dated address counts are verified."
              note="This is what the explorer shows."
            />
            <ConceptCard
              number="02"
              title="Campaign category exclusivity"
              text="A campaign may be designed to avoid competing advertiser categories within that specific mailed piece. Interest alone does not secure a category, and any protection must be confirmed in writing for the named campaign."
              note="It is campaign-specific, not permanent geographic ownership."
            />
            <ConceptCard
              number="03"
              title="Operator territory"
              text="Some businesses assign franchise, license, or sales regions to local operators. CaliforniaMailer does not currently sell or promise operator territories through this website."
              note="No franchise or protected sales region is offered here."
            />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-8 rounded-3xl bg-blue-50 p-8 lg:grid-cols-[1fr_auto] lg:items-center lg:p-10">
          <div>
            <h2 className="text-3xl font-black text-slate-950">Describe the area you want to reach.</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-700">Keep the geography free-form in your request. The owner can compare a 5,000- or 10,000-piece scenario, verify the current routes and supplier scope, and respond with a written plan. A request does not reserve a category or authorize printing, postage, or payment.</p>
          </div>
          <Link href="/quote" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-700 px-6 py-3 font-black text-white hover:bg-blue-800">Request a written plan</Link>
        </div>
      </section>
    </PublicShell>
  );
}

function ConceptCard({ number, title, text, note }: { number: string; title: string; text: string; note: string }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-sm font-black text-blue-700">{number}</div>
      <h3 className="mt-3 text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-4 leading-7 text-slate-600">{text}</p>
      <p className="mt-5 border-t border-slate-100 pt-4 text-sm font-bold leading-6 text-slate-800">{note}</p>
    </article>
  );
}
