'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';

interface PortalReservation {
  id: string;
  publicReference: string;
  businessName: string;
  contactName: string;
  email: string;
  categorySlug: string;
  placementSize: string;
  status: string;
  accessVersion: number;
  inviteVersion: number;
  legacyAccessActive: boolean;
  legacyAccessExpiresAt: string | null;
  activeInviteCount: number;
  activeInviteExpiresAt: string | null;
  activeSessionCount: number;
  activeSessionExpiresAt: string | null;
  createdAt: string | null;
  portalAccessRevokedAt: string | null;
}

interface PortalSnapshot {
  reservations: PortalReservation[];
  limits: { recordsPerCollection: number; possiblyTruncated: boolean };
}

interface CreatedLink {
  accessUrl: string;
  expiresAt: string;
  publicReference: string;
  businessName: string;
}

const CREATE_CONFIRMATION = 'CREATE ONE-TIME PORTAL LINK';
const REVOKE_CONFIRMATION = 'REVOKE ALL PORTAL ACCESS';

export default function BusinessPortalsPage() {
  const { user, loading, logout } = useAuth();
  const [snapshot, setSnapshot] = useState<PortalSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [expiresInHours, setExpiresInHours] = useState('72');
  const [createConfirmation, setCreateConfirmation] = useState('');
  const [revokeConfirmation, setRevokeConfirmation] = useState('');
  const [createdLink, setCreatedLink] = useState<CreatedLink | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const response = await fetch('/api/admin/advertiser-portals', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Business portals could not be read.');
      const next = body as PortalSnapshot;
      setSnapshot(next);
      setSelectedId((current) => next.reservations.some((item) => item.id === current)
        ? current
        : next.reservations[0]?.id || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Business portals could not be read.');
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (snapshot?.reservations || []).filter((item) => !query || [
      item.businessName,
      item.publicReference,
      item.contactName,
      item.email,
      item.categorySlug,
      item.status,
    ].join(' ').toLowerCase().includes(query));
  }, [search, snapshot]);
  const selected = snapshot?.reservations.find((item) => item.id === selectedId) || null;

  async function createLink() {
    if (!user || !selected) return;
    setBusy(true); setError(''); setNotice(''); setCreatedLink(null);
    try {
      const response = await fetch('/api/admin/advertiser-portals', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reservationId: selected.id,
          expiresInHours,
          confirmation: createConfirmation,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'The one-time link could not be created.');
      setCreatedLink(body as CreatedLink);
      setCreateConfirmation('');
      setNotice('One-time link created. Copy it manually now; CaliforniaMailer did not send it and cannot show the raw token again after this response is gone.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The one-time link could not be created.');
    } finally {
      setBusy(false);
    }
  }

  async function revokeAll() {
    if (!user || !selected) return;
    setBusy(true); setError(''); setNotice(''); setCreatedLink(null);
    try {
      const response = await fetch(`/api/admin/advertiser-portals/${selected.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'revoke_all', confirmation: revokeConfirmation }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Portal access could not be revoked.');
      setRevokeConfirmation('');
      setNotice('All legacy links, outstanding one-time links, and database sessions for this reservation are now invalid.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Portal access could not be revoked.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    if (!createdLink) return;
    try {
      await navigator.clipboard.writeText(createdLink.accessUrl);
      setNotice('Private link copied. Share it manually only with the contact for this reservation.');
    } catch {
      setError('Clipboard access was unavailable. Select and copy the link manually.');
    }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;

  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-7 flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Owner-issued private access</p><h1 className="text-3xl font-black">Business portals</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Create a one-time link for one reservation and business placement. This is not a shared business-wide account. Links are copied manually; no email, SMS, or automated outreach is sent.</p></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{error}</div>}
    {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">{notice}</div>}
    {snapshot?.limits.possiblyTruncated && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">The bounded owner read reached {snapshot.limits.recordsPerCollection} records in at least one collection. Counts may be incomplete.</div>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block text-sm font-bold">Search real reservations<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Business, reference, email, category…" className="mt-2 w-full rounded-lg border px-3 py-2 font-normal" /></label>
        {!filtered.length ? <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">No matching reservation records. No sample businesses were created.</p> : <ul className="mt-5 divide-y">{filtered.map((item) => <li key={item.id} className="py-3"><button type="button" onClick={() => { setSelectedId(item.id); setCreatedLink(null); setError(''); setNotice(''); }} className={`w-full rounded-xl p-3 text-left ${selectedId === item.id ? 'bg-blue-50 ring-2 ring-blue-700' : 'hover:bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">{item.publicReference || item.id}</div><div className="mt-1 font-black">{item.businessName || 'Unnamed reservation'}</div><div className="text-sm text-slate-600">{item.email || 'Email not recorded'} · {humanize(item.categorySlug)}</div></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{humanize(item.status)}</span></div><div className="mt-2 text-xs text-slate-500">{item.activeSessionCount} active session{item.activeSessionCount === 1 ? '' : 's'} · {item.activeInviteCount} active invite{item.activeInviteCount === 1 ? '' : 's'}</div></button></li>)}</ul>}
      </section>

      <aside className="rounded-2xl border bg-white p-5 shadow-sm">
        {!selected ? <p className="text-sm text-slate-500">Select a reservation to manage its private portal.</p> : <>
          <p className="text-xs font-black uppercase tracking-wide text-blue-700">{selected.publicReference || selected.id}</p>
          <h2 className="mt-1 text-xl font-black">{selected.businessName || 'Unnamed reservation'}</h2>
          <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1">
            <Detail label="Contact" value={selected.contactName || 'Not recorded'} />
            <Detail label="Email" value={selected.email || 'Not recorded'} />
            <Detail label="Placement" value={humanize(selected.placementSize)} />
            <Detail label="Reservation status" value={humanize(selected.status)} />
            <Detail label="Active one-time link" value={selected.activeInviteExpiresAt ? `Expires ${new Date(selected.activeInviteExpiresAt).toLocaleString()}` : 'None'} />
            <Detail label="Active sessions" value={selected.activeSessionCount ? `${selected.activeSessionCount}; latest expiry ${new Date(selected.activeSessionExpiresAt!).toLocaleString()}` : 'None'} />
            <Detail label="Legacy cookie access" value={selected.legacyAccessActive && selected.legacyAccessExpiresAt ? `Active until ${new Date(selected.legacyAccessExpiresAt).toLocaleString()}` : 'Inactive or expired'} />
          </dl>

          <section className="mt-6 border-t pt-5"><h3 className="font-black">Create one-time link</h3><p className="mt-1 text-xs leading-5 text-slate-500">Creating a new link invalidates every older unconsumed portal link for this reservation. Existing sessions remain active until expiry, logout, or revoke-all.</p><label className="mt-3 block text-sm font-bold">Link expiry<select value={expiresInHours} onChange={(event) => setExpiresInHours(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="1">1 hour</option><option value="24">24 hours</option><option value="72">72 hours</option><option value="168">7 days</option></select></label><label className="mt-3 block text-sm font-bold">Type {CREATE_CONFIRMATION}<input value={createConfirmation} onChange={(event) => setCreateConfirmation(event.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><button type="button" disabled={busy || createConfirmation !== CREATE_CONFIRMATION} onClick={() => void createLink()} className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-40">Create link without sending</button></section>

          {createdLink && <section className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 className="font-black text-emerald-950">Copy this link now</h3><p className="mt-1 text-xs leading-5 text-emerald-900">Expires {new Date(createdLink.expiresAt).toLocaleString()}. The raw token is not stored and will not appear in later owner reads.</p><label className="mt-3 block text-xs font-bold">One-time private URL<input readOnly value={createdLink.accessUrl} onFocus={(event) => event.currentTarget.select()} className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-mono text-xs" /></label><button type="button" onClick={() => void copyLink()} className="mt-3 rounded-lg border bg-white px-4 py-2 text-sm font-black">Copy private link</button></section>}

          <section className="mt-6 border-t pt-5"><h3 className="font-black text-rose-900">Revoke all reservation access</h3><p className="mt-1 text-xs leading-5 text-slate-500">Immediately invalidates legacy cookie access, unconsumed links, and every database session for only this reservation.</p><label className="mt-3 block text-sm font-bold">Type {REVOKE_CONFIRMATION}<input value={revokeConfirmation} onChange={(event) => setRevokeConfirmation(event.target.value)} autoComplete="off" className="mt-1 w-full rounded-lg border border-rose-300 px-3 py-2 font-normal" /></label><button type="button" disabled={busy || revokeConfirmation !== REVOKE_CONFIRMATION} onClick={() => void revokeAll()} className="mt-3 w-full rounded-lg border border-rose-400 px-4 py-3 font-black text-rose-900 disabled:opacity-40">Revoke all access</button></section>
        </>}
      </aside>
    </div>
  </main></div>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-800">{value}</dd></div>; }
function humanize(value: string) { return value ? value.replaceAll('_', ' ') : 'Not recorded'; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
