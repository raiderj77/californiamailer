'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import { isRecordSuppressed } from '@/lib/suppression';

interface Interest {
  id: string;
  publicReference: string;
  businessName: string;
  contactName: string;
  email: string;
  phone: string | null;
  website: string | null;
  categorySlug: string;
  placementSize: string;
  planId: string | null;
  offerModelVersion: string | null;
  advertisedOffer: string;
  advertiserDisclaimer: string;
  status: string;
  reason: string;
  ownerNotificationStatus: string;
  inviteStatus: string;
  inviteExpiresAt: string | null;
  prospectId: string | null;
  doNotContact: boolean;
  suppressed: boolean;
  suppressionPropagationStatus: string | null;
  linkedProspectSafetyStatus: string;
  linkedProspectSafetyBlocked: boolean;
  linkedProspectSuppressed: boolean;
  createdAt: string | null;
}

export default function InterestInboxPage() {
  const { user, loading, logout } = useAuth();
  const [items, setItems] = useState<Interest[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [sensitiveApprovals, setSensitiveApprovals] = useState<Record<string, boolean>>({});
  const [contactGloballyBlocked, setContactGloballyBlocked] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const response = await fetch('/api/admin/interests', { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Interest inbox could not be read.');
      setItems(body.interests);
      setContactGloballyBlocked(body.contactGloballyBlocked !== false);
    } catch (caught) {
      setContactGloballyBlocked(true);
      setError(caught instanceof Error ? caught.message : 'Interest inbox could not be read.');
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  async function act(item: Interest, payload: Record<string, unknown>) {
    if (!user) return;
    setBusyId(item.id); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/interests', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ interestId: item.id, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Interest action failed.');
      if (body.invitationCode) {
        setNotice(`Copy this single-use code now: ${body.invitationCode} — expires ${new Date(body.expiresAt).toLocaleString()}. It is not placed in a URL and will not be shown again.`);
      } else {
        setNotice(payload.action === 'promote_to_prospect' ? 'Promoted as an unqualified researching prospect; verify every source field before contact.' : 'Interest record updated.');
      }
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Interest action failed.');
    } finally {
      setBusyId('');
    }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;
  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Real inbound records</p><h1 className="text-3xl font-black">Reservation-interest inbox</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Review interest, promote it to an unqualified prospect, or issue a single-use code. An invitation is not payment, funding, or a sold category.</p></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>
    {error && <div role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">{error}</div>}
    {contactGloballyBlocked && <div role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">Prospect contact, promotion, and invitations are globally blocked until unresolved suppression propagation is reconciled. Additional do-not-contact decisions remain available.</div>}
    {notice && <div role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-950">{notice}</div>}
    {!items.length && !error ? <p className="rounded-xl border bg-white p-8 text-center text-slate-500">No real interest records exist. No samples were created.</p> : <div className="grid gap-5">
      {items.map((item) => {
        const category = FOUNDING_CAMPAIGN.categories.find((candidate) => candidate.slug === item.categorySlug);
        const inactiveModel = item.planId !== FOUNDING_CAMPAIGN.planId || item.offerModelVersion !== FOUNDING_CAMPAIGN.offerModelVersion;
        const suppressed = isRecordSuppressed(item);
        const unresolvedPropagation = Boolean(item.suppressionPropagationStatus?.startsWith('unresolved_'));
        const contactBlocked = suppressed || item.linkedProspectSafetyBlocked || contactGloballyBlocked;
        const blocked = item.status === 'dismissed' || contactBlocked || unresolvedPropagation || inactiveModel;
        return <article key={item.id} className={`rounded-2xl border p-5 shadow-sm ${suppressed ? 'border-rose-200 bg-rose-50' : 'bg-white'}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">{item.publicReference} · {item.status.replaceAll('_', ' ')}</div><h2 className="mt-1 text-xl font-black">{item.businessName}</h2><p className="text-sm text-slate-600">{item.contactName} · {contactBlocked ? <span>{item.email}</span> : <a className="underline" href={`mailto:${item.email}`}>{item.email}</a>}{item.phone ? ` · ${item.phone}` : ''}</p></div><div className="text-right text-sm"><strong>{category?.name || item.categorySlug}</strong><div>{item.placementSize} placement</div><div className="text-slate-500">{item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Date unavailable'}</div></div></div>
          <dl className="mt-4 grid gap-3 text-sm md:grid-cols-4"><Field label="Reason" value={item.reason?.replaceAll('_', ' ') || 'unknown'} /><Field label="Offer model" value={item.planId && item.offerModelVersion ? `${item.planId} · ${item.offerModelVersion}` : 'legacy / unknown'} /><Field label="Owner notification" value={item.ownerNotificationStatus.replaceAll('_', ' ')} /><Field label="Invitation" value={item.inviteStatus === 'active' && item.inviteExpiresAt ? `active until ${new Date(item.inviteExpiresAt).toLocaleString()}` : item.inviteStatus.replaceAll('_', ' ')} /></dl>
          {suppressed && <div className="mt-4 rounded-lg border border-rose-300 bg-white p-3 text-sm font-bold text-rose-900">Suppression is locked. This release has no UI or API that can reopen the record; renewed consent would require a separate audited workflow.</div>}
          {unresolvedPropagation && <div className="mt-4 rounded-lg border border-rose-300 bg-white p-3 text-sm font-bold text-rose-900">Linked-prospect suppression propagation is unresolved. Invitation and promotion remain blocked pending a separate audited repair.</div>}
          {item.linkedProspectSafetyBlocked && !unresolvedPropagation && <div className="mt-4 rounded-lg border border-rose-300 bg-white p-3 text-sm font-bold text-rose-900">Linked-prospect safety check blocked contact and downstream actions: {item.linkedProspectSafetyStatus.replaceAll('_', ' ')}.</div>}
          {inactiveModel && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900">Inactive or legacy offer model. This record can be reviewed or suppressed, but it cannot receive an invitation for the active campaign.</div>}
          <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><strong>Proposed offer</strong><p className="mt-1 whitespace-pre-wrap">{item.advertisedOffer}</p><strong className="mt-3 block">Disclaimer</strong><p className="mt-1 whitespace-pre-wrap">{item.advertiserDisclaimer || 'Not recorded'}</p>{item.website && (contactBlocked ? <span className="mt-3 inline-block text-slate-500">Submitted business site (link disabled)</span> : <a href={item.website} target="_blank" rel="noreferrer" className="mt-3 inline-block font-bold text-blue-700 underline">Submitted business site</a>)}</div>
          {category?.sensitive && <label className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm"><input type="checkbox" checked={Boolean(sensitiveApprovals[item.id])} onChange={(event) => setSensitiveApprovals((current) => ({ ...current, [item.id]: event.target.checked }))} className="mt-1" /><span><strong>Sensitive category reviewed.</strong> This acknowledges only category review; advertiser claims and proof still require evidence.</span></label>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button disabled={busyId === item.id || blocked || !item.prospectId} onClick={() => void act(item, { action: 'create_invite', expiresHours: 72, sensitiveCategoryApproved: Boolean(sensitiveApprovals[item.id]) })} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Issue 72-hour code</button>
            {!item.prospectId && <button disabled={busyId === item.id || blocked} onClick={() => void act(item, { action: 'promote_to_prospect' })} className="rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">Promote to researching prospect</button>}
            <button disabled={busyId === item.id || contactBlocked} onClick={() => void act(item, { action: 'set_status', status: 'reviewed' })} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Mark reviewed</button>
            <button disabled={busyId === item.id || contactBlocked} onClick={() => void act(item, { action: 'set_status', status: 'dismissed' })} className="rounded-lg border px-4 py-2 text-sm disabled:opacity-40">Dismiss</button>
            <button disabled={busyId === item.id || suppressed} onClick={() => void act(item, { action: 'set_status', status: 'do_not_contact' })} className="rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-800 disabled:opacity-40">Do not contact</button>
            {item.prospectId && <Link href="/prospects" className="rounded-lg border px-4 py-2 text-sm font-bold text-blue-700">Open prospect queue</Link>}
          </div>
        </article>;
      })}
    </div>}
  </main></div>;
}

function Field({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1">{value}</dd></div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
