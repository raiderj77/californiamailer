import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'How It Works | CaliforniaMailer',
  description: 'The reservation, funding, proof, print-approval, delivery, and reporting workflow.',
  alternates: { canonical: 'https://californiamailer.com/how-it-works' },
};

const steps = [
  ['Campaign opens', 'The owner publishes one campaign with a territory, target reach, planned inventory, prices, funding goal, deadline, and policy.'],
  ['Business is qualified', 'The service area, category, offer, public evidence, content risk, and conflicts are reviewed. Missing evidence stays in research.'],
  ['Temporary hold', 'An eligible category and placement slot receive a time-limited hold. A hold is not sold and does not count as funding.'],
  ['Hosted checkout', 'The price comes from the stored campaign record. CaliforniaMailer never handles full card details.'],
  ['Cleared payment', 'Only cleared net payment marks a category sold and moves the funding bar. Refunds reduce it; disputes are excluded.'],
  ['Materials and proof', 'The advertiser provides its logo, offer, contact details, copy, and disclaimer, then approves a versioned proof in writing.'],
  ['Print gate', 'Funding, advertiser minimum, approved proofs, routes, quotes, costs, margin, preflight, and owner authorization must all pass.'],
  ['Delivery and reporting', 'Written delivery evidence and tracking are provided. Measured interactions and advertiser-reported outcomes stay separate.'],
];

export default function HowItWorksPage() {
  return (
    <PublicShell>
      <section className="bg-blue-50 px-5 py-16"><div className="mx-auto max-w-5xl"><h1 className="text-4xl font-black tracking-tight md:text-6xl">How the founding campaign works</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">Every step is designed for one owner and for advertisers who prefer a written, no-meeting-required process.</p></div></section>
      <section className="mx-auto max-w-5xl px-5 py-16">
        <ol className="space-y-5">
          {steps.map(([title, text], index) => <li key={title} className="grid gap-4 rounded-2xl border border-slate-200 p-6 sm:grid-cols-[3rem_1fr]"><div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-950 font-black text-white">{index + 1}</div><div><h2 className="text-xl font-black">{title}</h2><p className="mt-2 leading-7 text-slate-600">{text}</p></div></li>)}
        </ol>
      </section>
    </PublicShell>
  );
}
