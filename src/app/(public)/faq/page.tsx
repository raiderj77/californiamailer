import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions | CaliforniaMailer',
  description: 'Funding, reach, category, payment, proof, delivery, and tracking answers for advertisers.',
  alternates: { canonical: 'https://californiamailer.com/faq' },
};

const faqs = [
  ['Is the founding campaign accepting payment now?', 'No. The default campaign is pre-launch and checkout is disabled until routes, costs, margin, policies, business identity, and payment configuration are reviewed. The public campaign board will show when that changes.'],
  ['Does approximately 5,000 mean 5,000 guaranteed deliveries?', 'No. It is a planning target. The published delivery estimate must come from selected carrier routes, and the final delivery report may differ for operational reasons documented by the mailing provider.'],
  ['What counts toward the funding goal?', 'Only cleared payment, net of recorded refunds. Interest, unpaid holds, pending payment, failed payment, cancelled payment, and disputed funds do not count.'],
  ['When is a category sold?', 'After cleared payment. A temporary unpaid hold blocks the category only until its stated expiration. Conflicting categories require an owner decision before checkout.'],
  ['What if a future campaign misses its approved funding goal?', 'No cancellation or refund rule is active today. Any future approved contract must define eligibility, timing, exceptions, and remedies before payment; this draft does not promise an automatic or full refund.'],
  ['Is ad design included?', 'Ad layout is included in the proposed offer. CaliforniaMailer does not currently represent that a staff designer or outside design agency is under contract.'],
  ['Can I complete everything without a meeting?', 'Yes. The intended workflow supports email, a private screen-recorded concept, online terms, hosted checkout, materials intake, and written proof approval. You can ask to speak directly with the owner if preferred.'],
  ['Do you guarantee calls, leads, appointments, sales, or ROI?', 'No. CaliforniaMailer provides an advertising placement and documented mailing workflow. Results depend on the offer, creative, audience, season, competition, and other factors.'],
  ['What does tracking measure?', 'The unique redirect can record an HTTP request and label likely bots; it cannot prove who scanned or why. Coupon use, calls, leads, appointments, and sales are advertiser-reported unless a separately verified source measures them.'],
  ['When can the mailer print?', 'Only after the cleared funding goal, minimum advertiser count, all paid proofs, route confirmation, cost inputs, margin threshold, artwork preflight, and explicit owner print authorization pass.'],
];

export default function FaqPage() {
  return (
    <PublicShell>
      <section className="bg-blue-50 px-5 py-16"><div className="mx-auto max-w-4xl"><h1 className="text-4xl font-black tracking-tight md:text-6xl">Frequently asked questions</h1><p className="mt-4 text-lg leading-8 text-slate-700">Plain answers for a campaign that has not yet earned the right to print.</p></div></section>
      <section className="mx-auto max-w-4xl space-y-4 px-5 py-16">
        {faqs.map(([question, answer]) => <details key={question} className="group rounded-2xl border border-slate-200 p-6"><summary className="cursor-pointer list-none pr-8 text-lg font-black">{question}</summary><p className="mt-4 leading-7 text-slate-600">{answer}</p></details>)}
      </section>
    </PublicShell>
  );
}
