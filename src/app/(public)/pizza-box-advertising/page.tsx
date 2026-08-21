import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';

export const metadata: Metadata = {
  title: 'Pizza Box Advertising in California | Quote-Only Placements',
  description: 'Request a California pizza box coupon or flyer placement built around a documented restaurant partner, verified box volume, and evidence-gated pricing.',
  alternates: { canonical: 'https://californiamailer.com/pizza-box-advertising' },
  openGraph: {
    title: 'Pizza Box Advertising in California',
    description: 'Quote-only pizza box coupon and flyer placement planning with documented California restaurant partners.',
    url: 'https://californiamailer.com/pizza-box-advertising',
    type: 'website',
  },
};

const pizzaBoxFaqs = [
  {
    question: 'Is pizza box advertising a USPS mailing?',
    answer: 'No. Printing4SuperCheap prints the approved coupon or flyer, and a restaurant partner distributes it with pizza orders under a written agreement. USPS and EDDM are not used for this placement.',
  },
  {
    question: 'Are pizza box placements available everywhere in California?',
    answer: 'Not instantly. Businesses and restaurants throughout California may request a plan, but each market requires a documented restaurant partner, a signed distribution agreement, verified box volume, and a workable delivery period before availability can be stated.',
  },
  {
    question: 'Can advertisers receive category exclusivity?',
    answer: 'Only when the written placement agreement names the category, restaurant partner, quantity, and distribution period. An inquiry does not reserve a category or create a permanent territory.',
  },
  {
    question: 'How is a pizza box advertising price calculated?',
    answer: 'A written price requires a current signed-in Printing4SuperCheap quote plus complete project costs, verified partner volume, and a distribution evidence plan. The economics must clear both the configured surplus and minimum-margin gates before payment or production can be offered.',
  },
] as const;

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: pizzaBoxFaqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function PizzaBoxAdvertisingPage() {
  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData).replace(/</g, '\\u003c'),
        }}
      />

      <section className="bg-red-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-300">California pizza box advertising · quote only</div>
          <h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">Pizza box coupon and flyer placements across California</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-red-100">Place an original local coupon sheet or community flyer with the orders of a documented California restaurant partner. Every project starts with partner evidence and a written distribution plan—not assumed reach.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/quote" className="inline-flex min-h-12 items-center rounded-full bg-amber-400 px-6 py-3 font-black text-red-950 hover:bg-amber-300">Request a placement plan</Link>
            <Link href="/sample-card" className="inline-flex min-h-12 items-center rounded-full border border-red-400 px-6 py-3 font-black text-white hover:border-amber-300 hover:text-amber-200">Review original layout studies</Link>
          </div>
          <p className="mt-5 max-w-3xl text-sm font-bold leading-6 text-red-200">This is partner-distributed advertising, not USPS mail or EDDM. California-wide intake does not claim that a restaurant partner or placement is already available in every market.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="pizza-box-placement-model">
        <div className="grid gap-10 lg:grid-cols-[1fr_0.85fr] lg:items-start">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-800">A documented local distribution channel</div>
            <h2 id="pizza-box-placement-model" className="mt-2 text-3xl font-black text-slate-950">How a California pizza box placement works</h2>
            <p className="mt-4 leading-7 text-slate-600">A participating restaurant agrees to place the approved printed piece with a defined number of pizza orders during a defined period. CaliforniaMailer coordinates the project record; it does not turn a restaurant estimate into guaranteed distribution.</p>
            <ol className="mt-7 space-y-4">
              <PlacementStep number="01" title="Qualify the restaurant partner" text="Verify the restaurant identity, participating location, weekly box volume, expected distribution period, and the person authorized to sign." />
              <PlacementStep number="02" title="Define the placement" text="Document the flyer or coupon format, quantity, advertiser categories, placement method, handoff, completion evidence, and any written category protection." />
              <PlacementStep number="03" title="Approve the exact piece" text="Use original creative or materials with documented usage rights. Every advertiser approves its exact content before the combined file can pass production preflight." />
              <PlacementStep number="04" title="Record handoff and delivery" text="Keep exact evidence of the quantity transferred to the named restaurant and the agreed method for documenting distribution completion." />
            </ol>
          </div>
          <aside className="rounded-3xl border border-red-200 bg-red-50 p-7">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-800">Required before availability</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">The partner evidence file</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              {[
                'Signed distribution agreement for the named restaurant location',
                'Verified box volume and a defined placement quantity and period',
                'Rights-attested logos, offers, images, and other advertiser materials',
                'Exact handoff and delivery-evidence responsibilities',
                'Current printer quote and complete campaign cost record',
              ].map((item) => <li key={item} className="flex gap-3"><span aria-hidden="true" className="font-black text-red-700">✓</span><span>{item}</span></li>)}
            </ul>
          </aside>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-16" aria-labelledby="pizza-box-pricing-boundary">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-800">No borrowed mailer price</div>
            <h2 id="pizza-box-pricing-boundary" className="mt-2 text-3xl font-black text-slate-950">A pizza box placement gets its own complete economics</h2>
            <p className="mt-4 leading-7 text-slate-600">A shared-mailer unit price or postcard print price cannot stand in for this service. Restaurant coordination, creative, printing, shipping, handoff, reserves, owner labor, and distribution evidence all belong in the project cost record.</p>
          </div>
          <div className="mt-8 grid gap-5 md:grid-cols-3">
            <PricingFact title="Required printer" text={`${PRINTING4SUPERCHEAP.name} produces the approved piece under a current signed-in, project-specific quote.`} />
            <PricingFact title="Required safeguards" text="Complete economics must clear the configured $2,500 pre-income-tax economic-surplus floor and 2,000 bps (20%) minimum margin." />
            <PricingFact title="Required sequence" text="No written customer price, payment path, or production authorization appears until the current quote, costs, partner evidence, and both safeguards pass." />
          </div>
          <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <h3 className="text-xl font-black text-amber-950">Who does what?</h3>
            <p className="mt-3 leading-7 text-slate-700"><strong>{PRINTING4SUPERCHEAP.name}</strong> prints the approved coupon or flyer. <strong>The documented restaurant partner</strong> distributes the agreed quantity with its pizza orders. <strong>CaliforniaMailer</strong> coordinates the evidence, approvals, and gated project record. USPS does not distribute pizza box placements.</p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="california-pizza-box-markets">
        <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-800">California-wide requests</div>
            <h2 id="california-pizza-box-markets" className="mt-2 text-3xl font-black text-slate-950">Start with the restaurant relationship and local market</h2>
            <p className="mt-4 leading-7 text-slate-600">A California business may request a pizza box advertising plan, and a California restaurant may propose its location as a distribution partner. Statewide service means the inquiry is open across California; it does not create an undisclosed restaurant network or promise immediate inventory.</p>
            <p className="mt-4 leading-7 text-slate-600">In the request, name the city, restaurant relationship if one exists, advertiser categories, expected quantity, offer type, and desired period. Category exclusivity exists only when a later written agreement defines it for that placement.</p>
          </div>
          <div className="flex flex-col gap-3">
            <Link href="/quote" className="inline-flex min-h-12 items-center justify-center rounded-full bg-red-800 px-6 py-3 font-black text-white hover:bg-red-900">Describe the California market</Link>
            <Link href="/mailing-areas" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-6 py-3 font-black text-slate-800 hover:border-slate-500">Compare postal market planning</Link>
            <Link href="/california-postcard-mailing" className="inline-flex min-h-12 items-center justify-center rounded-full border border-slate-300 px-6 py-3 font-black text-slate-800 hover:border-slate-500">See mailed postcard options</Link>
          </div>
        </div>
      </section>

      <section className="bg-red-950 px-5 py-16 text-white" aria-labelledby="pizza-box-faq-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="pizza-box-faq-heading" className="text-3xl font-black text-white">California pizza box advertising questions</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {pizzaBoxFaqs.map((item) => (
              <article key={item.question} className="rounded-3xl border border-red-800 bg-red-900/40 p-7">
                <h3 className="text-xl font-black text-white">{item.question}</h3>
                <p className="mt-3 leading-7 text-red-100">{item.answer}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/quote" className="inline-flex min-h-12 items-center rounded-full bg-amber-400 px-6 py-3 font-black text-red-950 hover:bg-amber-300">Request a private written plan</Link>
            <Link href="/pricing" className="text-sm font-bold text-amber-200 underline decoration-amber-400 underline-offset-4 hover:text-white">Review pricing safeguards</Link>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function PlacementStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-4 rounded-2xl border border-slate-200 p-5">
      <div className="text-sm font-black text-red-700">{number}</div>
      <div><h3 className="font-black text-slate-950">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{text}</p></div>
    </li>
  );
}

function PricingFact({ title, text }: { title: string; text: string }) {
  return <article className="rounded-3xl border border-slate-200 bg-white p-7"><h3 className="text-xl font-black text-slate-950">{title}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{text}</p></article>;
}
