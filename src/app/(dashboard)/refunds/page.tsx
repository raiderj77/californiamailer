'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { formatCurrency } from '@/config/foundingCampaign';
import { useAuth } from '@/lib/AuthContext';

interface PaymentRow {
  id: string;
  reservationId: string;
  businessName: string;
  publicReference: string | null;
  status: string;
  amountCents: number;
  refundedCents: number;
  netPaidCents: number;
  availableToRequestCents: number;
}

interface RefundRow {
  id: string;
  paymentId: string;
  reservationId: string;
  businessName: string;
  amountCents: number;
  reason: string;
  status: string;
  reviewNote: string | null;
  providerReference: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface LedgerState { payments: PaymentRow[]; refunds: RefundRow[] }

export default function RefundReviewPage() {
  const { user, loading, logout } = useAuth();
  const [ledger, setLedger] = useState<LedgerState | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [providerReferences, setProviderReferences] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const response = await fetch('/api/admin/refunds', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Refund ledger could not be loaded.');
      setLedger(body as LedgerState);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund ledger could not be loaded.');
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function act(id: string, payload: Record<string, unknown>) {
    if (!user) return;
    setBusyId(id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/refunds', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Refund record could not be updated.');
      setNotice(payload.action === 'mark_submitted'
        ? 'External provider submission was recorded. The obligation remains pending until a verified provider webhook confirms the refund.'
        : 'Refund ledger updated. No payment-provider action occurred.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Refund record could not be updated.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;

  const openObligations = ledger?.refunds.filter((refund) => ['requested', 'approved', 'submitted'].includes(refund.status)) || [];
  return <div className="min-h-screen bg-slate-50 md:flex">
    <Sidebar />
    <main className="min-w-0 flex-1 p-4 md:p-8">
      <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Owner-only financial control</p>
          <h1 className="text-3xl font-black">Refund obligations</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">This ledger reserves cleared funding and records review decisions. It never calls Stripe or another provider. Submit refunds in the verified provider account, then record the reference here; only a signed webhook confirms completion.</p>
        </div>
        <button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button>
      </header>
      {error && <Message error>{error}</Message>}
      {notice && <Message>{notice}</Message>}
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <Stat label="Eligible payment records" value={ledger ? String(ledger.payments.length) : 'Unknown'} />
        <Stat label="Open obligations" value={ledger ? String(openObligations.length) : 'Unknown'} />
        <Stat label="Open amount" value={ledger ? formatCurrency(openObligations.reduce((total, refund) => total + refund.amountCents, 0)) : 'Unknown'} />
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Record a refund request</h2>
        <p className="mt-2 text-sm text-slate-600">The server rejects requests above the remaining cleared net amount after existing obligations.</p>
        {!ledger ? <p className="mt-5 text-sm text-slate-500">Loading real payment records…</p> : ledger.payments.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No eligible payment records exist. No examples were inserted.</p> : <div className="mt-5 grid gap-4">
          {ledger.payments.map((payment) => <article key={payment.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-3">
              <div><h3 className="font-black">{payment.businessName}</h3><p className="text-xs text-slate-500">{payment.publicReference || payment.reservationId} · {payment.status.replaceAll('_', ' ')}</p></div>
              <dl className="grid grid-cols-2 gap-x-5 text-right text-sm"><div><dt className="text-xs text-slate-500">Cleared net</dt><dd className="font-bold">{formatCurrency(payment.netPaidCents)}</dd></div><div><dt className="text-xs text-slate-500">Available</dt><dd className="font-bold">{formatCurrency(payment.availableToRequestCents)}</dd></div></dl>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-[10rem_1fr_auto]">
              <label className="text-sm font-bold">Amount (USD)<input type="number" min="0.01" step="0.01" value={amounts[payment.id] || ''} onChange={(event) => setAmounts((current) => ({ ...current, [payment.id]: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
              <label className="text-sm font-bold">Reason<input value={reasons[payment.id] || ''} onChange={(event) => setReasons((current) => ({ ...current, [payment.id]: event.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
              <button disabled={busyId === payment.id || payment.availableToRequestCents < 1 || !amounts[payment.id] || (reasons[payment.id] || '').trim().length < 5} onClick={() => void act(payment.id, { action: 'request', paymentId: payment.id, amountCents: Math.round(Number(amounts[payment.id]) * 100), reason: reasons[payment.id] })} className="self-end rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-30">Record obligation</button>
            </div>
          </article>)}
        </div>}
      </section>

      <section className="mt-7 rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="text-xl font-black">Review ledger</h2>
        {!ledger ? <p className="mt-5 text-sm text-slate-500">Loading real refund records…</p> : ledger.refunds.length === 0 ? <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No refund obligations have been recorded.</p> : <div className="mt-5 grid gap-4">
          {ledger.refunds.map((refund) => <article key={refund.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-blue-700">{refund.status.replaceAll('_', ' ')}</p><h3 className="font-black">{refund.businessName}</h3><p className="mt-1 text-sm text-slate-600">{refund.reason}</p></div><div className="text-right"><div className="text-lg font-black">{formatCurrency(refund.amountCents)}</div><div className="text-xs text-slate-500">{refund.createdAt ? new Date(refund.createdAt).toLocaleString() : 'Date unavailable'}</div></div></div>
            {refund.reviewNote && <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm"><strong>Review note:</strong> {refund.reviewNote}</p>}
            {refund.providerReference && <p className="mt-3 text-sm"><strong>External provider reference:</strong> {refund.providerReference}</p>}
            {refund.status === 'requested' && <div className="mt-4 flex flex-wrap gap-2"><button disabled={busyId === refund.id} onClick={() => void act(refund.id, { action: 'approve', refundId: refund.id })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Approve obligation</button><label className="flex min-w-64 flex-1 items-end gap-2 text-sm font-bold"><span className="sr-only">Rejection note for {refund.businessName}</span><input aria-label={`Rejection note for ${refund.businessName}`} placeholder="Reason for rejection" value={notes[refund.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [refund.id]: event.target.value }))} className="w-full rounded-lg border px-3 py-2 font-normal" /><button disabled={busyId === refund.id || (notes[refund.id] || '').trim().length < 3} onClick={() => void act(refund.id, { action: 'reject', refundId: refund.id, note: notes[refund.id] })} className="rounded-lg border border-rose-300 px-4 py-2 font-bold text-rose-800 disabled:opacity-30">Reject</button></label></div>}
            {refund.status === 'approved' && <div className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]"><label className="text-sm font-bold">Provider refund reference<input value={providerReferences[refund.id] || ''} onChange={(event) => setProviderReferences((current) => ({ ...current, [refund.id]: event.target.value }))} placeholder="Copy from the verified provider account" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><button disabled={busyId === refund.id || (providerReferences[refund.id] || '').trim().length < 5} onClick={() => void act(refund.id, { action: 'mark_submitted', refundId: refund.id, providerReference: providerReferences[refund.id] })} className="self-end rounded-lg bg-slate-950 px-4 py-2 font-bold text-white disabled:opacity-30">Record external submission</button></div>}
            {refund.status === 'submitted' && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Awaiting a signed provider webhook. This amount still blocks print readiness.</p>}
          </article>)}
        </div>}
      </section>
    </main>
  </div>;
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xl font-black">{value}</div><div className="text-xs text-slate-500">{label}</div></div>; }
function Message({ children, error = false }: { children: React.ReactNode; error?: boolean }) { return <div role={error ? 'alert' : 'status'} className={`mb-4 rounded-lg p-3 text-sm ${error ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>{children}</div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
