'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CATEGORIES } from '@/config/foundingCampaign';
import {
  EDDM_MAIL_PIECES,
  EDDM_QUANTITY_TIERS,
  MINI_COOP_MAIL_PIECES,
  SERVICE_OPTIONS,
  TARGETED_MAIL_PIECES,
  type QuoteServiceType,
} from '@/config/eddmOfferings';
import { SHARED_MAILER_MODELS } from '@/config/sharedMailerModels';

interface QuoteFormState {
  name: string;
  email: string;
  phone: string;
  contactPreference: 'email_only' | 'email_or_phone';
  business: string;
  category: string;
  serviceType: QuoteServiceType;
  sharedModelId: string;
  mailerSpecId: string;
  quantity: string;
  city: string;
  targeting: string;
  fulfillment: 'print_only' | 'turnkey';
  message: string;
  website: string;
}

interface QuoteIntakeResponse {
  success?: boolean;
  reference?: string;
  intakeStatus?: string;
  reviewQueueStatus?: string;
  notificationStatus?: string;
  outboundMessageStatus?: string;
}

const INITIAL_FORM: QuoteFormState = {
  name: '',
  email: '',
  phone: '',
  contactPreference: 'email_only',
  business: '',
  category: '',
  serviceType: 'coop',
  sharedModelId: '',
  mailerSpecId: '',
  quantity: '',
  city: 'Monterey Peninsula',
  targeting: '',
  fulfillment: 'turnkey',
  message: '',
  website: '',
};

function mailPiecesFor(serviceType: QuoteServiceType) {
  if (serviceType === 'eddm') return EDDM_MAIL_PIECES;
  if (serviceType === 'solo') return TARGETED_MAIL_PIECES;
  if (serviceType === 'mini_coop') return MINI_COOP_MAIL_PIECES;
  return [];
}

export default function QuotePage() {
  const [form, setForm] = useState<QuoteFormState>(INITIAL_FORM);
  const [state, setState] = useState<'idle' | 'submitting' | 'accepted' | 'error'>('idle');
  const [reference, setReference] = useState('');
  const submissionAttempt = useRef<{ id: string; payload: string } | null>(null);
  const mailPieces = mailPiecesFor(form.serviceType);
  const selectedService = SERVICE_OPTIONS.find((option) => option.id === form.serviceType);
  const needsSharedModel = form.serviceType === 'shared_model';
  const needsMailerSpec = !['coop', 'shared_model', 'pizza_box'].includes(form.serviceType);
  const needsQuantity = !['coop', 'shared_model', 'pizza_box'].includes(form.serviceType);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setState('submitting');
    try {
      const quotePayload = {
        kind: 'quote' as const,
        ...form,
        quantity: needsQuantity
          ? form.quantity
          : form.serviceType === 'pizza_box'
            ? 'partner distribution volume to verify'
            : 'one placement inquiry',
        mailerSpecId: needsMailerSpec ? form.mailerSpecId : '',
        sharedModelId: needsSharedModel ? form.sharedModelId : '',
        targeting: form.serviceType === 'solo' ? form.targeting : '',
        fulfillment: form.serviceType === 'eddm' ? form.fulfillment : '',
      };
      const serializedPayload = JSON.stringify(quotePayload);
      if (!submissionAttempt.current || submissionAttempt.current.payload !== serializedPayload) {
        submissionAttempt.current = { id: crypto.randomUUID(), payload: serializedPayload };
      }
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...quotePayload,
          submissionId: submissionAttempt.current.id,
        }),
      });
      const result = await response.json().catch(() => ({})) as QuoteIntakeResponse;
      const accepted = response.ok
        && result.success === true
        && result.intakeStatus === 'accepted'
        && result.reviewQueueStatus === 'queued'
        && result.notificationStatus === 'not_queued_disabled'
        && result.outboundMessageStatus === 'not_sent'
        && typeof result.reference === 'string'
        && result.reference.length > 0;
      if (!accepted) throw new Error('Quote intake was not confirmed.');
      setReference(result.reference || '');
      setState('accepted');
    } catch {
      setState('error');
    }
  }

  const set = <Key extends keyof QuoteFormState>(key: Key, value: QuoteFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const changeService = (serviceType: QuoteServiceType) => {
    setForm((current) => ({
      ...current,
      serviceType,
      sharedModelId: '',
      mailerSpecId: '',
      quantity: '',
      targeting: '',
      fulfillment: 'turnkey',
    }));
  };

  if (state === 'accepted') {
    return (
      <PublicShell>
        <section role="status" aria-live="polite" aria-atomic="true" className="mx-auto max-w-2xl px-5 py-24 text-center">
          <h1 className="text-4xl font-black">Fit-preview request accepted for manual review</h1>
          <p className="mt-5 leading-8 text-slate-600">Your request is stored in the owner-only CRM review queue. If the project is a fit, the owner can prepare a free private planning preview before issuing any written quote. No email, text, call, or notification was queued or sent by this submission. Nothing was reserved, sold, ordered, or charged.</p>
          <p className="mt-4 text-sm font-bold text-slate-700">Reference: {reference}</p>
          <Link href="/pricing" className="mt-8 inline-block rounded-full bg-blue-700 px-6 py-3 font-black text-white">Review mailer options</Link>
        </section>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
          <section>
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Free private campaign-fit preview</p>
            <h1 className="mt-2 text-4xl font-black md:text-6xl">Explore a local-mail offer without booking a sales call.</h1>
            <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">Submit the facts once. If the request is a fit, the owner can manually prepare a private planning preview covering the likely mailer family, audience or route evidence to verify, real category conflicts, and the unknown costs that must be resolved before a written quote. It is a diagnostic—not finished artwork, reserved inventory, or a response guarantee.</p>
            <p className="mt-4 max-w-3xl leading-7 text-slate-600">CaliforniaMailer can plan the founding card, larger and smaller shared formats, M6/M3 variants, community, new-mover, directory, and partner-distributed concepts, single-business EDDM, or an addressed solo postcard. Printing4SuperCheap is the required printer; USPS or a documented restaurant partner performs the selected distribution. Every option stays quote-only until its actual layout, audience, quantity, current supplier price, postage or distribution method, and fulfillment are verified. You can <Link href="/mailing-areas" className="font-bold text-blue-700 underline underline-offset-4">review public mailing-area status</Link> first, then describe your geography in your own words.</p>

            <form onSubmit={submit} className="mt-8 grid gap-5 rounded-2xl border bg-white p-6 shadow-sm md:grid-cols-2">
              <label className="block text-sm font-bold md:col-span-2">Mailer model *
                <select required value={form.serviceType} onChange={(event) => changeService(event.target.value as QuoteServiceType)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  {SERVICE_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                </select>
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">{selectedService?.description}</span>
              </label>

              {needsSharedModel && <label className="block text-sm font-bold md:col-span-2">Shared-mailer concept *
                <select required value={form.sharedModelId} onChange={(event) => set('sharedModelId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="">Select a model…</option>
                  {SHARED_MAILER_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
                </select>
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">The model controls layout and mailing-method assumptions only. It does not submit a customer or supplier price.</span>
              </label>}

              {needsMailerSpec && <label className="block text-sm font-bold md:col-span-2">Mail-piece size *
                <select required value={form.mailerSpecId} onChange={(event) => set('mailerSpecId', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="">Select a supplier-verified or quote-only size…</option>
                  {mailPieces.map((piece) => <option key={piece.id} value={piece.id}>{piece.label}</option>)}
                </select>
              </label>}

              {needsQuantity && <label className="block text-sm font-bold">Planned quantity *
                <select required value={form.quantity} onChange={(event) => set('quantity', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="">Select a print tier…</option>
                  {EDDM_QUANTITY_TIERS.map((quantity) => <option key={quantity} value={String(quantity)}>{quantity.toLocaleString()} pieces</option>)}
                </select>
              </label>}

              {form.serviceType === 'eddm' && <label className="block text-sm font-bold">Fulfillment preference *
                <select required value={form.fulfillment} onChange={(event) => set('fulfillment', event.target.value as QuoteFormState['fulfillment'])} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="turnkey">Turnkey supplier preparation and postal delivery</option>
                  <option value="print_only">Print only; owner handles postal preparation</option>
                </select>
              </label>}

              {form.serviceType === 'solo' && <label className="block text-sm font-bold">Target audience *
                <select required value={form.targeting} onChange={(event) => set('targeting', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="">Select the addressed audience…</option>
                  <option value="radius">Radius around a location or recent job</option>
                  <option value="new_movers">New movers or new homeowners</option>
                  <option value="real_estate_farm">Real-estate farm or recently sold area</option>
                  <option value="customer_list">Customer or prospect list</option>
                  <option value="other">Another owner-verified list</option>
                </select>
              </label>}

              {form.serviceType === 'pizza_box' && <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-slate-700 md:col-span-2">
                <p className="font-black text-violet-950">Partner-distributed—not mailed</p>
                <p className="mt-1">Describe the California market, desired business categories, and any restaurant relationship in the details field. A quote requires a signed distribution agreement, verified box volume, a current Printing4SuperCheap print quote, artwork rights, and an evidence plan for handoff and distribution.</p>
              </div>}

              <label className="block text-sm font-bold">Target city, ZIP, or mailing area *
                <input value={form.city} onChange={(event) => set('city', event.target.value)} required className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" />
                <span className="mt-2 block text-xs font-normal leading-5 text-slate-500">Keep this free-form. Candidate areas do not reserve a route or category. <Link href="/mailing-areas" className="font-bold text-blue-700 underline">Open the mailing-area explorer</Link>.</span>
              </label>
              <Input label="Your name *" value={form.name} onChange={(event) => set('name', event.target.value)} required />
              <Input label="Business name *" value={form.business} onChange={(event) => set('business', event.target.value)} required />
              <Input label="Email *" type="email" value={form.email} onChange={(event) => set('email', event.target.value)} required />
              <Input label="Phone (optional)" value={form.phone} onChange={(event) => set('phone', event.target.value)} />
              <label className="block text-sm font-bold">Contact preference *
                <select required value={form.contactPreference} onChange={(event) => set('contactPreference', event.target.value as QuoteFormState['contactPreference'])} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="email_only">Email only — no sales call</option>
                  <option value="email_or_phone">Email or phone</option>
                </select>
              </label>
              <label className="block text-sm font-bold">Business category *
                <select required value={form.category} onChange={(event) => set('category', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal">
                  <option value="">Select for owner review…</option>
                  {FOUNDING_CATEGORIES.map((item) => <option key={item.slug} value={item.name}>{item.name}</option>)}
                  <option value="other">Another category</option>
                </select>
              </label>
              <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={form.website} onChange={(event) => set('website', event.target.value)} /></label></div>
              <label className="block text-sm font-bold md:col-span-2">Campaign details or question *
                <textarea required minLength={10} maxLength={2_000} rows={5} value={form.message} onChange={(event) => set('message', event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" />
              </label>
              <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{state === 'submitting' ? 'Saving the planning request for manual owner review.' : ''}</p>
              <button disabled={state === 'submitting'} className="rounded-lg bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50 md:col-span-2">{state === 'submitting' ? 'Saving request…' : 'Request my free private fit preview'}</button>
              {state === 'error' && <p role="alert" aria-live="assertive" aria-atomic="true" className="text-sm font-bold text-rose-800 md:col-span-2">The request could not be confirmed as recorded. Nothing was queued or sent. Please review the fields and try again.</p>}
              <p className="text-xs leading-5 text-slate-500 md:col-span-2">The preview request is free, but submission does not guarantee that a preview or quote will be produced. Submitting stores this request for manual owner review and permits CaliforniaMailer to respond to this inquiry only. It does not send an automated message, enroll you in marketing, reserve inventory, approve a route, place a print order, or authorize a charge. See the <Link href="/privacy" className="underline">privacy policy</Link>.</p>
            </form>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
              <h2 className="font-black">What the free preview can contain</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
                <li>• A likely mailer family and audience path</li>
                <li>• Route, category, rights, and offer facts to verify</li>
                <li>• A private concept outline using original—not copied—artwork</li>
                <li>• The cost unknowns and written next step</li>
              </ul>
              <p className="mt-3 text-xs leading-5 text-slate-600">No predicted leads, sales, response rate, or ROI is included.</p>
            </div>
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <h2 className="font-black">Start with the mailing area</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">Search candidate places and ZIP Codes, then check whether a current verified route snapshot is public. Exact counts are still rechecked before a written quote or order.</p>
              <Link href="/mailing-areas" className="mt-4 inline-block font-black text-blue-800 underline underline-offset-4">Explore mailing areas</Link>
            </div>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
              <h2 className="font-black">No instant price or checkout</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">Supplier prices are dated snapshots. Tax, design, list data, postal method, route counts, bundling, and delivery can change the total. The owner must issue a written quote before payment.</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-6">
              <h2 className="font-black">EDDM is not every postcard</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">EDDM saturates selected carrier routes and uses USPS flat-mail rules. Smaller targeted postcards use an addressed list and a separate postage quote.</p>
            </div>
            <div className="rounded-2xl border bg-slate-50 p-6">
              <h2 className="font-black">Founding category interest</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">The protected-category shared campaign still has its own acknowledgments and interest workflow.</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">The current workflow accepts one paid slot-unit per advertiser. Multi-unit advertiser purchasing is future work and is not implemented.</p>
              <Link href="/reserve" className="mt-4 inline-block font-black text-blue-700 underline">Review reservation interest</Link>
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return <label className="block text-sm font-bold">{label}<input {...props} className="mt-1 w-full rounded-lg border px-3 py-3 font-normal" /></label>;
}
