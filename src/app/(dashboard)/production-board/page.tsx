'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import {
  productionBoardCsv,
  type ProductionBoardRow,
  type ProductionBoardSummary,
} from '@/lib/productionBoard';

interface ProductionBoardSnapshot {
  generatedAt: string;
  rows: ProductionBoardRow[];
  summary: ProductionBoardSummary;
  limits: {
    possiblyTruncated: boolean;
    hitCollections: string[];
  };
}

type ReadinessFilter = 'all' | 'ready' | 'blocked' | 'unknown' | 'error' | 'open';

export default function ProductionBoardPage() {
  const { user, loading: authLoading, logout } = useAuth();
  const [snapshot, setSnapshot] = useState<ProductionBoardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [campaignId, setCampaignId] = useState('all');
  const [readiness, setReadiness] = useState<ReadinessFilter>('all');

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/production-board', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The production board could not be read.');
      setSnapshot(body as ProductionBoardSnapshot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The production board could not be read.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const campaigns = useMemo(() => {
    const values = new Map<string, string>();
    for (const row of snapshot?.rows || []) {
      if (row.campaign) values.set(row.campaign.id, row.campaign.title);
    }
    return [...values].sort((left, right) => left[1].localeCompare(right[1]));
  }, [snapshot]);

  const rows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return (snapshot?.rows || []).filter((row) => {
      if (campaignId !== 'all' && row.campaign?.id !== campaignId) return false;
      if (readiness === 'ready' && !row.productionReady) return false;
      if (readiness === 'blocked' && row.blockers.length === 0) return false;
      if (readiness === 'unknown' && row.unknowns.length === 0) return false;
      if (readiness === 'error' && row.errors.length === 0) return false;
      if (readiness === 'open' && row.reservation) return false;
      if (!normalizedQuery) return true;
      return [
        row.campaign?.title,
        row.campaign?.territory,
        row.slot?.id,
        row.slot?.position,
        row.reservation?.businessName,
        row.reservation?.publicReference,
        row.reservation?.categorySlug,
      ].join(' ').toLowerCase().includes(normalizedQuery);
    });
  }, [campaignId, query, readiness, snapshot]);

  function downloadCsv() {
    if (!rows.length) return;
    const blob = new Blob([productionBoardCsv(rows)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `californiamailer-production-board-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  if (authLoading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account to view private production state.</Centered>;

  return <div className="min-h-screen bg-slate-50 md:flex">
    <Sidebar />
    <main className="min-w-0 flex-1 p-4 md:p-8" aria-busy={loading}>
      <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Read-only owner command center</p>
          <h1 className="text-3xl font-black text-slate-950">Production board</h1>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">One bounded view of real campaign slots, canonical provider payments, exact intake and artwork pointers, and optional advertiser add-ons. “Ready” fails closed when any blocker, unknown, or record error remains. This page cannot place an order, send a message, or change a record.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="rounded-lg border bg-white px-4 py-2 text-sm font-black disabled:opacity-50">{loading ? 'Refreshing…' : 'Refresh records'}</button>
          <button type="button" onClick={logout} className="rounded-lg border bg-white px-4 py-2 text-sm">Sign out</button>
        </div>
      </header>

      {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{error} {snapshot && 'The last successful read remains visible below.'}</div>}
      {snapshot?.limits.possiblyTruncated && <div role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">The bounded read reached its cap for: {snapshot.limits.hitCollections.join(', ')}. Counts and missing-record findings may be incomplete; no readiness result is promoted from truncated data.</div>}

      {snapshot && <>
        <section aria-label="Production board summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
          <SummaryCard label="Rows" value={snapshot.summary.rows} />
          <SummaryCard label="Slots" value={snapshot.summary.slots} />
          <SummaryCard label="Occupied" value={snapshot.summary.occupiedSlots} />
          <SummaryCard label="Verified paid" value={snapshot.summary.verifiedPaid} />
          <SummaryCard label="Ready" value={snapshot.summary.productionReady} tone="emerald" />
          <SummaryCard label="Unknowns" value={snapshot.summary.withUnknowns} tone="amber" />
          <SummaryCard label="Record errors" value={snapshot.summary.withErrors} tone="rose" />
        </section>

        <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[minmax(220px,1fr)_minmax(200px,.6fr)_minmax(180px,.5fr)_auto] lg:items-end">
            <label className="text-sm font-bold text-slate-800">Search board<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Business, reference, category, territory, slot…" className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal" /></label>
            <label className="text-sm font-bold text-slate-800">Campaign<select value={campaignId} onChange={(event) => setCampaignId(event.target.value)} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"><option value="all">All campaigns</option>{campaigns.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</select></label>
            <label className="text-sm font-bold text-slate-800">Readiness<select value={readiness} onChange={(event) => setReadiness(event.target.value as ReadinessFilter)} className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"><option value="all">All rows</option><option value="ready">Production ready</option><option value="blocked">Has blockers</option><option value="unknown">Has unknowns</option><option value="error">Has record errors</option><option value="open">Open inventory</option></select></label>
            <button type="button" onClick={downloadCsv} disabled={!rows.length} className="rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">Export {rows.length} safe CSV row{rows.length === 1 ? '' : 's'}</button>
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">CSV export contains no contact name, email, phone, raw portal token, storage path, or coupon content. Spreadsheet-leading formulas are neutralized.</p>
        </section>

        <section className="mt-6 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-4"><div><h2 className="text-xl font-black">Campaign and slot ledger</h2><p className="mt-1 text-xs text-slate-500">Generated {new Date(snapshot.generatedAt).toLocaleString()} · showing {rows.length} of {snapshot.rows.length}</p></div><nav aria-label="Related production workspaces" className="flex flex-wrap gap-3 text-xs font-black text-blue-700"><Link href="/proof-workflow">Materials &amp; proofs</Link><Link href="/coupons">Coupons</Link><Link href="/tracking">Tracking</Link><Link href="/business-portals">Portals</Link></nav></div>
          {!rows.length ? <p className="p-10 text-center text-sm text-slate-500">No real records match these filters. No sample slots or businesses were created.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[1180px] border-collapse text-left text-sm"><caption className="sr-only">Read-only production readiness by campaign placement slot</caption><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600"><tr><th scope="col" className="px-4 py-3">Campaign / slot</th><th scope="col" className="px-4 py-3">Reservation</th><th scope="col" className="px-4 py-3">Payment</th><th scope="col" className="px-4 py-3">Creative intake</th><th scope="col" className="px-4 py-3">Artwork / proof</th><th scope="col" className="px-4 py-3">Add-ons</th><th scope="col" className="px-4 py-3">Readiness</th></tr></thead><tbody className="divide-y">{rows.map((row) => <ProductionRow key={row.key} row={row} />)}</tbody></table></div>}
        </section>
      </>}

      {!snapshot && !loading && !error && <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">No production-board snapshot has been loaded.</div>}
      {!snapshot && loading && <div role="status" className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Reading bounded owner production records…</div>}
    </main>
  </div>;
}

function ProductionRow({ row }: { row: ProductionBoardRow }) {
  const issueCount = row.blockers.length + row.unknowns.length + row.errors.length;
  return <tr className="align-top">
    <td className="px-4 py-4"><p className="font-black text-slate-950">{row.campaign?.title || 'Missing campaign'}</p><p className="mt-1 text-xs text-slate-500">{row.campaign?.territory || 'Territory unavailable'}</p><p className="mt-2 text-xs font-bold">{row.slot ? `Slot ${row.slot.position ?? '—'} · ${humanize(row.slot.size)} · ${humanize(row.slot.status)}` : 'Unassigned reservation'}</p></td>
    <td className="px-4 py-4">{row.reservation ? <><p className="font-black text-slate-950">{row.reservation.businessName || 'Unnamed business'}</p><p className="mt-1 text-xs text-slate-500">{row.reservation.publicReference || 'No public reference'} · {humanize(row.reservation.categorySlug)}</p><StatusPill value={humanize(row.reservation.status)} tone={row.reservation.status === 'paid' ? 'emerald' : 'slate'} /></> : <StatusPill value="No reservation" tone="slate" />}</td>
    <td className="px-4 py-4">{row.payment ? <><StatusPill value={humanize(row.payment.status)} tone={row.payment.verifiedCleared ? 'emerald' : 'amber'} /><p className="mt-2 text-xs text-slate-500">{row.payment.verifiedCleared ? 'Canonical provider record verified' : 'Not verified as cleared'}</p></> : <StatusPill value="No canonical payment" tone="amber" />}</td>
    <td className="px-4 py-4">{row.creativeBrief ? <><p className="font-bold">Brief v{row.creativeBrief.version ?? '?'}</p><p className="mt-1 text-xs text-slate-500">{humanize(row.creativeBrief.status)}</p><StatusPill value={row.creativeBrief.exactPointer && row.creativeBrief.deliveryValidated ? 'Exact and date-validated' : 'Needs review'} tone={row.creativeBrief.exactPointer && row.creativeBrief.deliveryValidated ? 'emerald' : 'amber'} /></> : <StatusPill value="No current brief" tone="amber" />}</td>
    <td className="px-4 py-4"><p className="font-bold">Material {row.material ? `v${row.material.version ?? '?'}` : 'missing'}</p><p className="mt-1 text-xs text-slate-500">{row.material ? `${humanize(row.material.status)} · rights ${row.material.rightsAttested ? 'attested' : 'missing'}` : 'No exact pointer'}</p><p className="mt-3 font-bold">Proof {row.proof ? `v${row.proof.version ?? '?'}` : 'missing'}</p><p className="mt-1 text-xs text-slate-500">{row.proof ? `${humanize(row.proof.status)} · ${row.proof.boundToCurrentInputs === true ? 'current inputs bound' : row.proof.boundToCurrentInputs === false ? 'stale inputs' : 'input binding unknown'}` : 'No exact pointer'}</p></td>
    <td className="px-4 py-4 text-xs leading-6"><div>Tracking: <strong>{row.tracking.active ? 'active' : row.tracking.exists ? 'inactive' : 'not configured'}</strong></div><div>Coupon: <strong>{row.coupon.publicAvailable ? 'publicly available' : row.coupon.exists ? humanize(row.coupon.publicationStatus) : 'not started'}</strong></div><div>Portal: <strong>{row.portal.reservationScopedAccessAvailable ? 'available' : 'not available'}</strong></div></td>
    <td className="px-4 py-4"><StatusPill value={row.productionReady ? 'Production ready' : 'Not ready'} tone={row.productionReady ? 'emerald' : row.errors.length ? 'rose' : 'amber'} />{issueCount > 0 && <details className="mt-3 max-w-sm"><summary className="cursor-pointer text-xs font-black text-blue-700">Review {issueCount} finding{issueCount === 1 ? '' : 's'}</summary><IssueList label="Blockers" tone="amber" issues={row.blockers.map((item) => item.message)} /><IssueList label="Unknowns" tone="slate" issues={row.unknowns.map((item) => item.message)} /><IssueList label="Record errors" tone="rose" issues={row.errors.map((item) => item.message)} /></details>}</td>
  </tr>;
}

function IssueList({ label, issues, tone }: { label: string; issues: string[]; tone: 'amber' | 'slate' | 'rose' }) {
  if (!issues.length) return null;
  const classes = tone === 'rose' ? 'text-rose-800' : tone === 'amber' ? 'text-amber-900' : 'text-slate-600';
  return <div className={`mt-3 text-xs ${classes}`}><p className="font-black">{label}</p><ul className="mt-1 list-disc space-y-1 pl-4">{issues.map((message) => <li key={message}>{message}</li>)}</ul></div>;
}

function StatusPill({ value, tone }: { value: string; tone: 'emerald' | 'amber' | 'rose' | 'slate' }) {
  const classes = tone === 'emerald'
    ? 'bg-emerald-100 text-emerald-900'
    : tone === 'amber'
      ? 'bg-amber-100 text-amber-950'
      : tone === 'rose'
        ? 'bg-rose-100 text-rose-900'
        : 'bg-slate-100 text-slate-700';
  return <span className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-xs font-black ${classes}`}>{value}</span>;
}

function SummaryCard({ label, value, tone = 'slate' }: { label: string; value: number; tone?: 'slate' | 'emerald' | 'amber' | 'rose' }) {
  const classes = tone === 'emerald' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'rose' ? 'border-rose-200 bg-rose-50' : 'bg-white';
  return <div className={`rounded-xl border p-4 shadow-sm ${classes}`}><div className="text-2xl font-black text-slate-950">{value}</div><div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div></div>;
}

function humanize(value: string) {
  return value ? value.replaceAll('_', ' ') : 'Not recorded';
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>;
}
