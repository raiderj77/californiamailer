'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PublicShell } from '@/components/public/PublicShell';
import {
  FOUNDING_CAMPAIGN,
  type ApprovedCampaignContractVersions,
} from '@/config/foundingCampaign';
import type { PublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

interface FormState {
  categorySlug: string;
  placementSize: 'standard';
  businessName: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  advertisedOffer: string;
  brandColors: string;
  adCopy: string;
  advertiserDisclaimer: string;
  invitationCode: string;
  termsAccepted: boolean;
  refundPolicyAccepted: boolean;
  proofAcknowledged: boolean;
  acceptedTermsVersion: string;
  acceptedFundingPolicyVersion: string;
  companySite: string;
}

const initialForm: FormState = {
  categorySlug: '',
  placementSize: 'standard',
  businessName: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  advertisedOffer: '',
  brandColors: '',
  adCopy: '',
  advertiserDisclaimer: '',
  invitationCode: '',
  termsAccepted: false,
  refundPolicyAccepted: false,
  proofAcknowledged: false,
  acceptedTermsVersion: '',
  acceptedFundingPolicyVersion: '',
  companySite: '',
};

export function ReserveInterestForm({
  priceVisibility,
  approvedContractVersions,
}: {
  priceVisibility: PublicPlanningPriceVisibility;
  approvedContractVersions: ApprovedCampaignContractVersions | null;
}) {
  const [form, setForm] = useState<FormState>(() => ({
    ...initialForm,
    acceptedTermsVersion: approvedContractVersions?.termsVersion ?? '',
    acceptedFundingPolicyVersion: approvedContractVersions?.fundingPolicyVersion ?? '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ reference: string; message: string } | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: FOUNDING_CAMPAIGN.id, ...form }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The request could not be recorded.');
      if (body.checkoutUrl) {
        window.location.assign(body.checkoutUrl);
        return;
      }
      if (body.reservationId) {
        window.location.assign(`/reservation/${body.reservationId}`);
        return;
      }
      setResult({ reference: body.reference, message: body.message });
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : 'The request could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <PublicShell>
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">Interest recorded</div>
          <h1 className="mt-4 text-4xl font-black">Reference {result.reference}</h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">{result.message}</p>
          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-950">This is not a category hold, payment, sold placement, or contribution to campaign funding.</div>
          <Link href="/founding-mailer" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white">Return to campaign</Link>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <section className="bg-blue-50 px-5 py-14"><div className="mx-auto max-w-4xl"><div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Category review request</div><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Review a founding placement</h1><p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">Without a valid owner-issued invitation this records interest only. A real hold and hosted checkout require an approved invitation plus every campaign, contract, route, economics, deadline, and provider gate.</p></div></section>
      <section className="mx-auto max-w-4xl px-5 py-12">
        <form onSubmit={submit} className="space-y-8">
          <fieldset className="rounded-3xl border border-slate-200 p-6 md:p-8">
            <legend className="px-2 text-xl font-black">Placement and category</legend>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-300 px-4 py-3"><div className="text-sm font-bold text-slate-500">Founding slot unit</div><div className="mt-1 font-black">One equal unit — {priceVisibility.active.supported ? `proposed ${priceVisibility.active.customerUnitPriceLabel}` : priceVisibility.active.customerUnitPriceLabel}</div></div>
              <label className="font-bold">Business category<select required value={form.categorySlug} onChange={(event) => update('categorySlug', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal"><option value="">Select for owner review</option>{FOUNDING_CAMPAIGN.categories.map((category) => <option key={category.slug} value={category.slug}>{category.name}{category.sensitive ? ' — manual review' : ''}</option>)}</select></label>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">Displayed planning price: {priceVisibility.active.customerUnitPriceLabel}. The requested 24-unit 9 × 12 layout is experimental and must pass physical preflight. This form records interest only while checkout is disabled; the versioned stored campaign—not the browser—would control any future amount.</p>
            <div className="mt-5"><Field label="Owner invitation code (optional for interest; required for a hold)" value={form.invitationCode} onChange={(value) => update('invitationCode', value.toUpperCase())} /></div>
          </fieldset>

          <fieldset className="rounded-3xl border border-slate-200 p-6 md:p-8">
            <legend className="px-2 text-xl font-black">Business details</legend>
            <div className="mt-3 grid gap-5 md:grid-cols-2">
              <Field label="Business name" required value={form.businessName} onChange={(value) => update('businessName', value)} />
              <Field label="Contact name" required value={form.contactName} onChange={(value) => update('contactName', value)} />
              <Field label="Email" type="email" required value={form.email} onChange={(value) => update('email', value)} />
              <Field label="Phone (optional)" type="tel" value={form.phone} onChange={(value) => update('phone', value)} />
              <div className="md:col-span-2"><Field label="Business website (optional)" type="url" value={form.website} onChange={(value) => update('website', value)} /></div>
            </div>
          </fieldset>

          <fieldset className="rounded-3xl border border-slate-200 p-6 md:p-8">
            <legend className="px-2 text-xl font-black">Proposed ad</legend>
            <label className="block font-bold">Offer households would see<textarea required minLength={5} maxLength={1000} rows={4} value={form.advertisedOffer} onChange={(event) => update('advertisedOffer', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder="Use an accurate current offer; do not promise unsupported outcomes." /></label>
            <div className="mt-5 grid gap-5 md:grid-cols-2"><Field label="Brand colors (optional)" value={form.brandColors} onChange={(value) => update('brandColors', value)} /><label className="block font-bold">Draft copy (optional)<textarea maxLength={2000} rows={3} value={form.adCopy} onChange={(event) => update('adCopy', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label></div>
            <label className="mt-5 block font-bold">Required disclaimer or “None”<textarea required minLength={2} maxLength={1000} rows={3} value={form.advertiserDisclaimer} onChange={(event) => update('advertiserDisclaimer', event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" placeholder="Enter the exact required disclaimer, or None if no disclaimer applies." /></label>
          </fieldset>

          <fieldset className="rounded-3xl border border-slate-200 p-6 md:p-8">
            <legend className="px-2 text-xl font-black">Required acknowledgments</legend>
            <div className="mt-3 space-y-4">
              <Check checked={form.termsAccepted} onChange={(value) => update('termsAccepted', value)}>{approvedContractVersions ? <>I accept the <Link href="/terms" className="font-bold text-blue-700 underline" target="_blank">campaign terms version {approvedContractVersions.termsVersion}</Link> for this request.</> : <>I reviewed the <Link href="/terms" className="font-bold text-blue-700 underline" target="_blank">draft campaign terms</Link> and understand a pre-launch interest record is not a reservation.</>}</Check>
              <Check checked={form.refundPolicyAccepted} onChange={(value) => update('refundPolicyAccepted', value)}>{approvedContractVersions ? <>I accept the <Link href="/funding-policy" className="font-bold text-blue-700 underline" target="_blank">funding and refund policy version {approvedContractVersions.fundingPolicyVersion}</Link> for this request.</> : <>I reviewed the <Link href="/funding-policy" className="font-bold text-blue-700 underline" target="_blank">draft funding and refund policy</Link> and understand it is not an active payment term.</>}</Check>
              <Check checked={form.proofAcknowledged} onChange={(value) => update('proofAcknowledged', value)}>I reviewed the proposed proof requirement and understand it is not an approved campaign contract or a guarantee of advertising results.</Check>
            </div>
            <div className="hidden" aria-hidden="true"><label>Company site<input tabIndex={-1} autoComplete="off" value={form.companySite} onChange={(event) => update('companySite', event.target.value)} /></label></div>
          </fieldset>

          {error && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 font-bold text-red-900">{error}</div>}
          <button disabled={busy} className="w-full rounded-full bg-blue-700 px-6 py-4 text-lg font-black text-white hover:bg-blue-800 disabled:opacity-50">{busy ? 'Checking the database…' : 'Check category and record request'}</button>
          <p className="text-center text-sm leading-6 text-slate-500">Submitting this form does not enroll you in consumer marketing. No card information is collected here.</p>
        </form>
      </section>
    </PublicShell>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) { return <label className="block font-bold">{label}<input type={type} required={required} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 font-normal" /></label>; }
function Check({ checked, onChange, children }: { checked: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <label className="flex gap-3 leading-7 text-slate-700"><input type="checkbox" required checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-5 w-5" /><span>{children}</span></label>; }
