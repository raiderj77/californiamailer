import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = { title: 'Campaign Funding and Refund Policy | CaliforniaMailer', description: 'How cleared funding, cancellation, refunds, and print authorization work.', alternates: { canonical: 'https://californiamailer.com/funding-policy' } };

export default async function FundingPolicyPage() {
  const publicPrices = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <article className="mx-auto max-w-4xl px-5 py-20">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-950">Draft policy version {FOUNDING_CAMPAIGN.fundingPolicyVersion}. Checkout remains disabled until the owner reviews and publishes final campaign terms.</div>
        <h1 className="mt-8 text-4xl font-black tracking-tight md:text-6xl">Campaign funding and refunds</h1>
        <PolicySection title="1. Cleared-funding goal">The proposed founding goal is {publicPrices.active.derivedFundingGoalLabel}. {!publicPrices.active.supported && 'A current written quote must establish a new goal before checkout can activate. '}Only payment marked cleared by the payment provider, net of recorded refunds, contributes. Interest, reservations, holds, invoices, pending transfers, failures, cancellations, and disputes do not.</PolicySection>
        <PolicySection title="2. No print spending before authorization">Reaching the funding goal does not itself authorize print. Every paid advertiser proof, selected routes, vendor inputs, contribution margin, artwork preflight, and explicit owner approval must also pass.</PolicySection>
        <PolicySection title="3. Funding-goal cancellation">If the campaign deadline passes below the cleared-funding goal, CaliforniaMailer cancels the campaign and owes each eligible paid advertiser a full refund of the placement payment received for that campaign. The owner reviews and initiates each refund so the amount and provider reference are recorded; that manual step does not reduce the refund obligation.</PolicySection>
        <PolicySection title="4. Processing time">After CaliforniaMailer submits a refund, the payment provider and advertiser&apos;s financial institution control when the credit appears. CaliforniaMailer will provide the recorded refund status and provider reference when available.</PolicySection>
        <PolicySection title="5. Advertiser withdrawal and rejected content">Withdrawal, content rejection, missed materials deadlines, chargebacks, and campaign changes require final checkout terms before payments can activate. No public page currently represents a rule that has not been approved.</PolicySection>
        <PolicySection title="6. No automatic refund API">The application does not issue refunds automatically. It creates an owner-review obligation and requires a recorded approval before any provider refund action.</PolicySection>
        <p className="mt-12 text-sm leading-6 text-slate-500">This operational policy is not legal advice. The owner should obtain California counsel review before accepting production payments.</p>
      </article>
    </PublicShell>
  );
}

function PolicySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-10"><h2 className="text-2xl font-black">{title}</h2><p className="mt-3 leading-8 text-slate-700">{children}</p></section>;
}
