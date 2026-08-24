import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';

export const metadata: Metadata = { title: 'Draft Campaign Funding and Refund Policy | CaliforniaMailer', description: 'Proposed funding, cancellation, refund, and print-authorization rules for owner and legal review.', alternates: { canonical: 'https://californiamailer.com/funding-policy' }, robots: { index: false, follow: false } };

export default function FundingPolicyPage() {
  return (
    <PublicShell>
      <article className="mx-auto max-w-4xl px-5 py-20">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-950">Draft policy version {FOUNDING_CAMPAIGN.fundingPolicyVersion}. Checkout remains disabled until the owner reviews and publishes final campaign terms.</div>
        <h1 className="mt-8 text-4xl font-black tracking-tight md:text-6xl">Draft campaign funding and refund terms</h1>
        <PolicySection title="1. No approved funding goal">No customer funding goal is published here as an approved checkout term. Any future goal must come from an owner-approved campaign contract using current inventory, price, route, supplier, fee, reserve, and complete-cost evidence. Interest, inquiries, holds, invoices, pending transfers, failures, cancellations, and disputes would not count as cleared funding.</PolicySection>
        <PolicySection title="2. Proposed print-authorization boundary">Under any future approved contract, reaching a cleared-funding goal would not itself authorize print. Every paid-advertiser proof, selected route, vendor input, economic safeguard, artwork preflight, and explicit owner authorization would also have to pass.</PolicySection>
        <PolicySection title="3. Proposed funding-goal cancellation rule">The intended rule is cancellation and a full placement-payment refund to each eligible paid advertiser if an approved campaign deadline passes below its cleared-funding goal. Eligibility, exceptions, exact timing, and remedies are not final, so this draft does not create that obligation or authorize payment.</PolicySection>
        <PolicySection title="4. Proposed processing disclosure">If a future approved refund is submitted, the payment provider and advertiser&apos;s financial institution would control when the credit appears. CaliforniaMailer would provide a recorded status and provider reference when available without claiming bank completion early.</PolicySection>
        <PolicySection title="5. Unresolved outcomes">Advertiser withdrawal, content rejection, missed materials deadlines, chargebacks, campaign changes, production errors, postal or printer delays, delivery shortfalls, and reprint responsibility require final checkout terms. These outcomes remain unresolved; this draft does not establish a payment, refund, or remedy rule for them.</PolicySection>
        <PolicySection title="6. No automatic refund API">The application does not issue refunds automatically. Any future provider refund would require an approved policy, owner review, and recorded authorization.</PolicySection>
        <p className="mt-12 text-sm leading-6 text-slate-500">This operational policy is not legal advice. The owner should obtain California counsel review before accepting production payments.</p>
      </article>
    </PublicShell>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-10"><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 leading-8 text-slate-700">{children}</p></section>;
}
