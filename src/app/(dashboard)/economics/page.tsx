'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';
import {
  MINIMUM_ECONOMIC_MARGIN_BPS,
  MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS,
} from '@/config/economicSafeguards';
import { FOUNDING_INVENTORY_GROSS_CENTS, formatCurrency } from '@/config/foundingCampaign';
import { useAuth } from '@/lib/AuthContext';
import { DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS } from '@/lib/sharedMailerEconomics';

interface Summary {
  cashCostCents: number | null;
  totalCostCents: number | null;
  cashContributionBeforeOwnerLaborCents: number | null;
  economicSurplusBeforeIncomeTaxCents: number | null;
  contributionMarginBps: number | null;
  breakEvenPaidPlacementCount: number | null;
  targetOwnerSurplusCents: number | null;
  targetGapCents: number | null;
  quoteCurrent: boolean;
  quoteValidThrough: string | null;
  missingInputs: string[];
}

interface CostState {
  supplierId: 'printing4supercheap' | null;
  mailPieceCount: number | null;
  printingCostCents: number | null;
  postageCostCents: number | null;
  shippingCostCents: number | null;
  taxCostCents: number | null;
  designCostCents: number | null;
  ownerLaborCostCents: number | null;
  processingFeeCents: number | null;
  refundReserveCents: number | null;
  reprintReserveCents: number | null;
  softwareAllocationCents: number | null;
  otherExpensesCents: number | null;
  targetOwnerSurplusCents: number | null;
  printerQuoteReference: string | null;
  quoteVerifiedAt: string | null;
  version?: number;
}

interface EconomicsState {
  campaign: {
    verifiedHouseholds: number | null;
    householdCountBasis: string | null;
    selectedAreas: string[];
    routesConfirmed: boolean;
    plannedDeliveryStart: string | null;
    plannedDeliveryEnd: string | null;
    reservationDeadline: string | null;
    artworkPreflightApproved: boolean;
    ownerPrintApproved: boolean;
    economicsVerified: boolean;
    paymentActivation: boolean;
    clearedFundingCents: number;
    fundingGoalCents: number;
    minimumPaidPlacements: number;
    pricePerPaidPlacementCents: number;
    minimumMarginBps: number;
    costs: CostState;
  };
  thresholdSummary: Summary;
  fullInventorySummary: Summary;
  minimumSafeFundingCents: number | null;
  readiness: {
    ready: boolean;
    checks: Array<{ key: string; label: string; passed: boolean; detail: string }>;
  };
  paidAdvertiserCount: number;
  paidReservationCount: number;
  outstandingPaymentCount: number;
  refundObligationCents: number;
}

interface FormState {
  plannedDeliveryStart: string;
  plannedDeliveryEnd: string;
  reservationDeadline: string;
  artworkPreflightApproved: boolean;
  mailPieceCount: string;
  printing: string;
  postage: string;
  shipping: string;
  tax: string;
  design: string;
  ownerLabor: string;
  processing: string;
  refundReserve: string;
  reprintReserve: string;
  software: string;
  other: string;
  targetOwnerSurplus: string;
  printerQuoteReference: string;
  quoteVerifiedAt: string;
}

const blank: FormState = {
  plannedDeliveryStart: '', plannedDeliveryEnd: '', reservationDeadline: '', artworkPreflightApproved: false,
  mailPieceCount: '', printing: '', postage: '', shipping: '', tax: '', design: '', ownerLabor: '',
  processing: '', refundReserve: '', reprintReserve: '', software: '', other: '', targetOwnerSurplus: '',
  printerQuoteReference: '', quoteVerifiedAt: '',
};
const dollars = (value: number | null) => value === null ? '' : String(value / 100);
const cents = (value: string) => value.trim() === '' ? null : Math.round(Number(value) * 100);
const padDateTimePart = (value: number) => String(value).padStart(2, '0');
function toDateTimeLocal(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${padDateTimePart(date.getMonth() + 1)}-${padDateTimePart(date.getDate())}T${padDateTimePart(date.getHours())}:${padDateTimePart(date.getMinutes())}`;
}

export default function EconomicsPage() {
  const { user, loading, logout } = useAuth();
  const [state, setState] = useState<EconomicsState | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmation, setConfirmation] = useState('');

  const applyState = useCallback((next: EconomicsState) => {
    setState(next);
    const costs = next.campaign.costs;
    setForm({
      plannedDeliveryStart: next.campaign.plannedDeliveryStart || '',
      plannedDeliveryEnd: next.campaign.plannedDeliveryEnd || '',
      reservationDeadline: toDateTimeLocal(next.campaign.reservationDeadline),
      artworkPreflightApproved: next.campaign.artworkPreflightApproved,
      mailPieceCount: costs.mailPieceCount?.toString() || '',
      printing: dollars(costs.printingCostCents),
      postage: dollars(costs.postageCostCents),
      shipping: dollars(costs.shippingCostCents),
      tax: dollars(costs.taxCostCents),
      design: dollars(costs.designCostCents),
      ownerLabor: dollars(costs.ownerLaborCostCents),
      processing: dollars(costs.processingFeeCents),
      refundReserve: dollars(costs.refundReserveCents),
      reprintReserve: dollars(costs.reprintReserveCents),
      software: dollars(costs.softwareAllocationCents),
      other: dollars(costs.otherExpensesCents),
      targetOwnerSurplus: dollars(costs.targetOwnerSurplusCents ?? DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.targetOwnerSurplusCents),
      printerQuoteReference: costs.printerQuoteReference || '',
      quoteVerifiedAt: costs.quoteVerifiedAt || '',
    });
  }, []);

  const request = useCallback(async (method = 'GET', body?: unknown) => {
    if (!user) throw new Error('Owner authentication required.');
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/campaigns/founding/economics', {
      method,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Economics request failed.');
    return data as EconomicsState;
  }, [user]);

  useEffect(() => {
    if (!user) return;
    void request().then(applyState).catch((caught) => {
      setError(caught instanceof Error ? caught.message : 'Economics could not be loaded.');
    });
  }, [applyState, request, user]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  async function save() {
    setBusy(true); setError(''); setNotice('');
    try {
      const targetOwnerSurplusCents = cents(form.targetOwnerSurplus);
      if (
        targetOwnerSurplusCents !== null
        && targetOwnerSurplusCents < MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS
      ) {
        throw new Error(
          `Target owner surplus cannot be lower than ${formatCurrency(MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS)} before income tax.`,
        );
      }
      const payload = {
        plannedDeliveryStart: form.plannedDeliveryStart || null,
        plannedDeliveryEnd: form.plannedDeliveryEnd || null,
        reservationDeadline: form.reservationDeadline ? new Date(form.reservationDeadline).toISOString() : null,
        artworkPreflightApproved: form.artworkPreflightApproved,
        costs: {
          supplierId: PRINTING4SUPERCHEAP.id,
          mailPieceCount: form.mailPieceCount ? Number(form.mailPieceCount) : null,
          printingCostCents: cents(form.printing), postageCostCents: cents(form.postage), shippingCostCents: cents(form.shipping),
          taxCostCents: cents(form.tax), designCostCents: cents(form.design), ownerLaborCostCents: cents(form.ownerLabor),
          processingFeeCents: cents(form.processing), refundReserveCents: cents(form.refundReserve),
          reprintReserveCents: cents(form.reprintReserve), softwareAllocationCents: cents(form.software),
          otherExpensesCents: cents(form.other), targetOwnerSurplusCents,
          printerQuoteReference: form.printerQuoteReference.trim() || null,
          quoteVerifiedAt: form.quoteVerifiedAt || null,
        },
      };
      const next = await request('PUT', payload);
      applyState(next);
      setNotice('Schedule, cost, owner-labor, and target inputs saved. Route evidence was not changed. Any prior print-readiness approval was revoked. No payment or print action occurred.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Inputs could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  async function readinessAction(action: 'approve_print_readiness' | 'revoke_print_readiness') {
    setBusy(true); setError(''); setNotice('');
    try {
      const next = await request('POST', { action, confirmation });
      applyState(next);
      setNotice(action === 'approve_print_readiness'
        ? 'Readiness gates approved and audited. No print order was placed.'
        : 'Print-readiness approval revoked.');
      setConfirmation('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Readiness action failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;

  const summary = state?.fullInventorySummary;
  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Financial safety gate</p><h1 className="text-3xl font-black">Campaign economics and print readiness</h1></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Every figure remains an owner-confirmed input.</strong> Blank means unknown; entering 0 deliberately records zero except where the server-enforced planning floors require more. Customer-price, payment, and print paths require at least {formatCurrency(MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS)} of pre-income-tax owner economic surplus and {(MINIMUM_ECONOMIC_MARGIN_BPS / 100).toFixed(0)}% economic contribution margin; either target may be higher but not lower. For the active full-inventory model, processing must be at least $250.11 and the refund reserve at least $251.28; the reprint floor is 5% of printing, postage/turnkey, and shipping. Higher verified costs replace these floors. Cash before owner labor is not economic profit, and the surplus target is before personal income or self-employment tax. Saving evidence does not activate checkout, purchase printing or postage, or place an order. Full 24-unit inventory is {formatCurrency(FOUNDING_INVENTORY_GROSS_CENTS)}. <Link href="/shared-mailer-calculator" className="font-black underline">Open the planning calculator</Link>.</div>
    {error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
      <Stat label="Cleared funding" value={state ? formatCurrency(state.campaign.clearedFundingCents) : 'Unknown'} />
      <Stat label="24-unit funding gate" value={state ? formatCurrency(state.campaign.fundingGoalCents) : 'Unknown'} />
      <Stat label="Cash costs (excludes owner labor)" value={money(summary?.cashCostCents)} />
      <Stat label="Economic costs (includes owner labor)" value={money(summary?.totalCostCents)} />
      <Stat label="Cash before owner labor and income tax" value={money(summary?.cashContributionBeforeOwnerLaborCents)} />
      <Stat label="Economic surplus before income tax" value={money(summary?.economicSurplusBeforeIncomeTaxCents)} />
      <Stat label="Owner-surplus target before income tax" value={money(summary?.targetOwnerSurplusCents)} />
      <Stat label="Surplus target gap" value={money(summary?.targetGapCents)} />
      <Stat label="Minimum safe funding" value={money(state?.minimumSafeFundingCents)} />
      <Stat label="Break-even paid placements" value={summary?.breakEvenPaidPlacementCount?.toString() || 'Unknown'} />
      <Stat label="Economic contribution margin" value={margin(summary?.contributionMarginBps)} />
      <Stat label="Supplier quote status" value={summary?.quoteCurrent ? 'Current' : 'Missing / stale'} />
    </div>

    <section className="mt-7 grid gap-6 xl:grid-cols-2">
      <div className="rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black">Verified routes and schedule</h2>
        <div className={`mt-4 rounded-xl border p-4 text-sm leading-6 ${state?.campaign.routesConfirmed ? 'border-emerald-200 bg-emerald-50 text-emerald-950' : 'border-amber-200 bg-amber-50 text-amber-950'}`}>
          <strong>{state?.campaign.routesConfirmed ? 'Attached route plan' : 'No verified route plan attached'}</strong>
          {state?.campaign.routesConfirmed ? (
            <dl className="mt-3 grid gap-2">
              <div><dt className="inline font-bold">Residential deliveries: </dt><dd className="inline">{state.campaign.verifiedHouseholds?.toLocaleString() ?? 'Unknown'}</dd></div>
              <div><dt className="inline font-bold">Evidence basis: </dt><dd className="inline">{state.campaign.householdCountBasis || 'Unknown'}</dd></div>
              <div><dt className="inline font-bold">Selected routes: </dt><dd className="inline">{state.campaign.selectedAreas.length ? state.campaign.selectedAreas.join(', ') : 'Unknown'}</dd></div>
            </dl>
          ) : <p className="mt-2">Route counts must be derived from a current, versioned plan. They cannot be confirmed on this financial form.</p>}
          <Link href="/eddm" className="mt-3 inline-block font-black underline">Open Territories &amp; routes</Link>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Input label="Planned delivery start" type="date" value={form.plannedDeliveryStart} onChange={(event) => set('plannedDeliveryStart', event.target.value)} />
          <Input label="Planned delivery end" type="date" value={form.plannedDeliveryEnd} onChange={(event) => set('plannedDeliveryEnd', event.target.value)} />
          <div>
            <Input label="Reservation deadline (your local time)" type="datetime-local" value={form.reservationDeadline} onChange={(event) => set('reservationDeadline', event.target.value)} />
            <p className="mt-1 text-xs font-normal leading-5 text-slate-500">Must be in the future and fall on a Pacific calendar date before the planned delivery start date.</p>
          </div>
        </div>
      </div>
      <div className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Current economic inputs (USD)</h2><div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-slate-700"><strong>Fixed production supplier: {PRINTING4SUPERCHEAP.name}.</strong> The quote date must be no more than {PRINTING4SUPERCHEAP.recheckAfterDays} days old and cannot be in the future. <a href={PRINTING4SUPERCHEAP.discountSheetUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline">Open the planning sheet</a> or <a href={PRINTING4SUPERCHEAP.productUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline">supplier product page</a>, then record the actual reference and date.{state?.campaign.costs.supplierId !== PRINTING4SUPERCHEAP.id && <span className="mt-2 block font-bold text-amber-900">The saved cost record lacks the required supplier marker.</span>}</div><div className="mt-5 grid gap-4 md:grid-cols-2"><Input label="Mail pieces" type="number" min="1" value={form.mailPieceCount} onChange={(event) => set('mailPieceCount', event.target.value)} />{([
        ['Printing', 'printing', '0'], ['Postage / turnkey fulfillment', 'postage', '0'], ['Shipping', 'shipping', '0'], ['Tax', 'tax', '0'], ['Design', 'design', '0'], ['Owner labor allowance', 'ownerLabor', '0'], ['Payment processing', 'processing', '0'], ['Refund reserve', 'refundReserve', '0'], ['Reprint reserve', 'reprintReserve', '0'], ['Software allocation', 'software', '0'], ['Other expenses', 'other', '0'], ['Target owner surplus (pre-income-tax)', 'targetOwnerSurplus', String(MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS / 100)],
      ] as const).map(([label, key, minimum]) => <Input key={key} label={label} type="number" min={minimum} step="0.01" value={form[key]} onChange={(event) => set(key, event.target.value)} />)}<p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-950 md:col-span-2">The {formatCurrency(MINIMUM_PRE_INCOME_TAX_OWNER_ECONOMIC_SURPLUS_CENTS)} value shown for an unsaved active record is the server-enforced minimum before income tax, not a lowerable default. You may enter a higher target. Owner labor is separate and remains unknown until entered.</p><Input label={`${PRINTING4SUPERCHEAP.name} quote reference`} value={form.printerQuoteReference} onChange={(event) => set('printerQuoteReference', event.target.value)} /><Input label="Quote verified date" type="date" value={form.quoteVerifiedAt} onChange={(event) => set('quoteVerifiedAt', event.target.value)} /><label className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm font-bold md:col-span-2"><input type="checkbox" checked={form.artworkPreflightApproved} onChange={(event) => set('artworkPreflightApproved', event.target.checked)} />Final combined artwork—including the experimental 24-unit 9 × 12 layout—passed manual preflight</label></div></div>
    </section>
    <button disabled={busy || !state} onClick={() => void save()} className="mt-6 rounded-lg bg-blue-700 px-6 py-3 font-black text-white disabled:opacity-40">{busy ? 'Working…' : 'Save evidence and recalculate'}</button>

    <section className="mt-8 grid gap-6 lg:grid-cols-2"><div className="rounded-xl border bg-white p-6"><h2 className="text-xl font-black">Readiness checks</h2><ul className="mt-4 space-y-3">{state?.readiness.checks.map((check) => <li key={check.key} className={`rounded-lg p-3 text-sm ${check.passed ? 'bg-emerald-50 text-emerald-900' : 'bg-rose-50 text-rose-900'}`}><strong>{check.passed ? 'Pass' : 'Blocked'} · {check.label}</strong><div>{check.detail}</div></li>) || <li className="text-slate-500">Initialize and load the active campaign to see checks.</li>}</ul></div><div className="rounded-xl border bg-white p-6"><h2 className="text-xl font-black">Manual readiness approval</h2><p className="mt-3 text-sm leading-6 text-slate-600">Approval is rejected server-side unless the saved campaign exactly matches the active 24-unit model and every funding, paid-placement, proof, material, disclaimer, route, quantity, current-quote, margin, owner-surplus, refund, and preflight gate passes. Approval records readiness only; it creates no purchase, print order, postage transaction, or vendor message.</p><p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm leading-6 text-amber-950"><strong>Current workflow boundary:</strong> one paid reservation represents one advertiser and one paid slot-unit. Multi-unit advertiser purchasing is future work and is not implemented.</p><p className="mt-4 text-sm"><strong>Paid placements:</strong> {state?.paidReservationCount ?? '—'} / {state?.campaign.minimumPaidPlacements ?? '—'}<br /><strong>Unique paid advertisers:</strong> {state?.paidAdvertiserCount ?? '—'} (expected to match paid placements in the current workflow)<br /><strong>Outstanding holds/payments:</strong> {state?.outstandingPaymentCount ?? '—'}<br /><strong>Recorded refund obligation:</strong> {money(state?.refundObligationCents ?? null)}<br /><strong>Checkout activation:</strong> {state?.campaign.paymentActivation ? 'active' : 'off'}</p>{state?.campaign.ownerPrintApproved ? <button disabled={busy} onClick={() => void readinessAction('revoke_print_readiness')} className="mt-5 rounded-lg border border-rose-300 px-5 py-3 text-sm font-bold text-rose-800">Revoke readiness approval</button> : <><label className="mt-5 block text-sm font-bold">Type APPROVE PRINT READINESS<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><button disabled={busy || confirmation !== 'APPROVE PRINT READINESS'} onClick={() => void readinessAction('approve_print_readiness')} className="mt-3 rounded-lg bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-30">Approve gates only</button></>}</div></section>
  </main></div>;
}

const money = (value: number | null | undefined) => value === null || value === undefined ? 'Unknown' : formatCurrency(value);
const margin = (bps: number | null | undefined) => bps === null || bps === undefined ? 'Unknown' : `${(bps / 100).toFixed(1)}%`;
function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-bold">{label}<input {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xl font-black">{value}</div><div className="text-xs text-slate-500">{label}</div></div>; }
function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div role={error ? 'alert' : 'status'} aria-live={error ? 'assertive' : 'polite'} aria-atomic="true" className={`mb-4 rounded-lg p-3 text-sm ${error ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>{children}</div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div role="status" aria-live="polite" className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
