import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';

export const metadata: Metadata = {
  title: 'California Postcard Mailing | EDDM & Addressed Mail',
  description: 'Request California single-business postcard mailing using EDDM carrier routes or an addressed audience, with current supplier and cost verification before pricing.',
  alternates: { canonical: 'https://californiamailer.com/california-postcard-mailing' },
  openGraph: {
    title: 'California Postcard Mailing | EDDM & Addressed Mail',
    description: 'Quote-only postcard planning for a proposed California market. Production and USPS delivery remain conditional on a verified project plan.',
    url: 'https://californiamailer.com/california-postcard-mailing',
    type: 'website',
  },
};

const postcardFaqs = [
  {
    question: 'Can one business use the whole postcard?',
    answer: 'Yes. A single-business postcard gives one advertiser the full marketing side or full piece, subject to postal layout, content, artwork-rights, and production review.',
  },
  {
    question: 'May a California business submit an EDDM or addressed-postcard inquiry?',
    answer: 'Yes. The named market remains candidate geography until verified. EDDM would use current USPS carrier-route evidence; addressed mail would use a defined, rights-reviewed recipient list or audience. Exact geography, quantity, eligibility, and availability must be verified for each project.',
  },
  {
    question: 'Who prints and delivers the postcards?',
    answer: 'Printing4SuperCheap is the required printer for this service. USPS delivers mailed postcards. The written plan identifies the selected postal method and any required list, preparation, postage, or entry work.',
  },
  {
    question: 'Can I see an instant California postcard price?',
    answer: 'No. A written customer price requires a current signed-in Printing4SuperCheap quote, verified routes or audience, and a complete cost review that clears the configured economic-surplus and minimum-margin gates.',
  },
] as const;

const faqStructuredData = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: postcardFaqs.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
};

export default function CaliforniaPostcardMailingPage() {
  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqStructuredData).replace(/</g, '\\u003c'),
        }}
      />

      <section className="bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">California postcard mailing · quote only</div>
          <h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight text-white md:text-6xl">Request a California single-business postcard plan</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Put one California business on the whole postcard. Choose saturation planning with USPS Every Door Direct Mail (EDDM) or an addressed audience, then verify the exact market, format, quantity, and complete economics before a written price exists.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/quote" className="inline-flex min-h-12 items-center rounded-full bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500">Request a postcard plan</Link>
            <Link href="/sample-card" className="inline-flex min-h-12 items-center rounded-full border border-slate-600 px-6 py-3 font-black text-white hover:border-blue-300 hover:text-blue-200">Review format studies</Link>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-6 text-slate-400">This intake accepts a proposed California market; it does not establish statewide fulfillment capacity, route availability, payment, printing, postage, or mailing authorization.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="choose-postcard-method">
        <div className="max-w-3xl">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Two postal approaches</div>
          <h2 id="choose-postcard-method" className="mt-2 text-3xl font-black text-slate-950">Choose the audience before choosing the postcard</h2>
          <p className="mt-4 leading-7 text-slate-600">EDDM and addressed mail solve different targeting problems. CaliforniaMailer documents the selected method instead of presenting them as interchangeable.</p>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <ServiceCard
            eyebrow="USPS carrier-route coverage"
            title="Single-business EDDM postcards"
            text="Reach every eligible residential address, or the selected residential and business addresses, on verified USPS carrier routes. Route counts and postage are dated evidence—not permanent territory totals."
            points={[
              'Candidate cities and ZIP Codes are converted into exact carrier-route plans.',
              'The selected size must meet current EDDM and printer requirements.',
              'USPS delivers the mailed pieces after the documented preparation and entry process.',
            ]}
          />
          <ServiceCard
            eyebrow="Defined recipient audience"
            title="Addressed business postcards"
            text="Mail to a supplied or separately sourced list when the campaign needs named households, customers, prospects, or another defined audience instead of saturation coverage."
            points={[
              'List source, permission, hygiene, quantity, and postage class require review.',
              'A 4 × 6, 5 × 7, 5.5 × 8.5, 6 × 9, or 6 × 11 concept remains quote-only.',
              'USPS delivers the addressed pieces; the written plan identifies preparation responsibilities.',
            ]}
          />
        </div>
        <div className="mt-8 flex flex-wrap gap-3 text-sm font-bold">
          <Link href="/mailing-areas" className="rounded-full border border-blue-200 bg-blue-50 px-5 py-3 text-blue-900 hover:border-blue-400">Explore mailing-area evidence</Link>
          <Link href="/pricing" className="rounded-full border border-slate-200 px-5 py-3 text-slate-800 hover:border-slate-400">See quote boundaries and formats</Link>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-slate-50 px-5 py-16" aria-labelledby="statewide-postcard-workflow">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Evidence-gated workflow</div>
            <h2 id="statewide-postcard-workflow" className="mt-2 text-3xl font-black text-slate-950">From California market request to USPS delivery</h2>
            <p className="mt-4 leading-7 text-slate-600">No meeting is required, but the project still needs current evidence and explicit approvals.</p>
          </div>
          <ol className="mt-9 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            <WorkflowStep number="01" title="Define the campaign" text="Describe the California market, audience, offer, desired timing, and whether the request is EDDM or addressed mail." />
            <WorkflowStep number="02" title="Verify the reach" text="Check current USPS routes and address counts for EDDM, or document the addressed list source, scope, and usable quantity." />
            <WorkflowStep number="03" title="Verify production cost" text={`Obtain a current signed-in ${PRINTING4SUPERCHEAP.name} quote for the exact size, stock, finish, quantity, shipping, and included services.`} />
            <WorkflowStep number="04" title="Clear both safeguards" text="Include postage, preparation, shipping, design, owner labor, processing, reserves, contingencies, and other project costs. The plan must clear both the configured $2,500 pre-income-tax economic-surplus floor and 2,000 bps (20%) minimum margin." />
            <WorkflowStep number="05" title="Issue a written plan" text="Only after those checks can the owner provide a customer price or payment path. If either safeguard fails, payment and production stay unavailable." />
            <WorkflowStep number="06" title="Approve and document" text="Rights-attested materials, postal preflight, exact proof approval, provider-verified payment, and final production authorization precede printing and USPS delivery." />
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16" aria-labelledby="california-postcard-markets">
        <div className="grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:items-start">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Candidate California market</div>
            <h2 id="california-postcard-markets" className="mt-2 text-3xl font-black text-slate-950">Plan around a real local market</h2>
            <p className="mt-4 leading-7 text-slate-600">An inquiry may name a California community. CaliforniaMailer does not represent any market as serviceable until dated route or audience evidence and a project-specific production plan establish it.</p>
            <p className="mt-4 leading-7 text-slate-600">Use the inquiry to name the city, ZIP Codes, customer geography, quantity range, and desired format. The owner can then compare the available methods without treating a request as a reservation.</p>
          </div>
          <aside className="rounded-3xl border border-blue-200 bg-blue-50 p-7">
            <h2 className="text-2xl font-black text-slate-950">Printer and delivery roles</h2>
            <dl className="mt-5 space-y-5">
              <RoleFact label="Production" value={`${PRINTING4SUPERCHEAP.name} prints the postcard under a current project-specific quote.`} />
              <RoleFact label="Mail delivery" value="USPS delivers EDDM and addressed postcards using the documented postal method." />
              <RoleFact label="CaliforniaMailer" value="Plans the campaign, verifies evidence, coordinates approvals, and keeps price and production gated." />
            </dl>
          </aside>
        </div>
      </section>

      <section className="bg-slate-950 px-5 py-16 text-white" aria-labelledby="postcard-faq-heading">
        <div className="mx-auto max-w-6xl">
          <h2 id="postcard-faq-heading" className="text-3xl font-black text-white">California postcard mailing questions</h2>
          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            {postcardFaqs.map((item) => (
              <article key={item.question} className="rounded-3xl border border-slate-700 bg-slate-900 p-7">
                <h3 className="text-xl font-black text-white">{item.question}</h3>
                <p className="mt-3 leading-7 text-slate-300">{item.answer}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link href="/quote" className="inline-flex min-h-12 items-center rounded-full bg-blue-600 px-6 py-3 font-black text-white hover:bg-blue-500">Request a private written plan</Link>
            <span className="text-sm text-slate-400">Inquiry only · no instant price or availability</span>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}

function ServiceCard({ eyebrow, title, text, points }: { eyebrow: string; title: string; text: string; points: readonly string[] }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">{eyebrow}</div>
      <h3 className="mt-3 text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-4 leading-7 text-slate-600">{text}</p>
      <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
        {points.map((point) => <li key={point} className="flex gap-3"><span aria-hidden="true" className="font-black text-blue-700">✓</span><span>{point}</span></li>)}
      </ul>
    </article>
  );
}

function WorkflowStep({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <li className="rounded-3xl border border-slate-200 bg-white p-6">
      <div className="text-sm font-black text-blue-700">{number}</div>
      <h3 className="mt-3 text-xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
    </li>
  );
}

function RoleFact({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-black uppercase tracking-[0.14em] text-blue-800">{label}</dt><dd className="mt-2 text-sm leading-6 text-slate-700">{value}</dd></div>;
}
