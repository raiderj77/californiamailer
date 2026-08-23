'use client';

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { getProspects, type Prospect } from '@/lib/firestore';
import { contactGate, contactQueueStatuses } from '@/lib/prospectRules';
import { getProspectContactBarrier } from '@/lib/prospectSuppressionClient';
import { createOutreachDraft, outreachTemplateNames, type OutreachTemplateKey } from '@/lib/outreachTemplates';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const templateKeys = Object.keys(outreachTemplateNames) as OutreachTemplateKey[];

export default function SalesDeskPage() {
  const { user, loading, logout } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectId, setProspectId] = useState('');
  const [templateKey, setTemplateKey] = useState<OutreachTemplateKey>('first_introduction');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [contactGloballyBlocked, setContactGloballyBlocked] = useState(true);

  useEffect(() => {
    let active = true;
    if (user) Promise.all([getProspects(user.uid), user.getIdToken().then(getProspectContactBarrier)])
      .then(([records, barrier]) => { if (active) { setProspects(records); setContactGloballyBlocked(barrier.contactBlocked); } })
      .catch(() => { if (active) { setContactGloballyBlocked(true); setError('The prospect queue or suppression state could not be loaded. Draft access remains blocked.'); } });
    return () => { active = false; };
  }, [user]);

  const queue = useMemo(() => contactGloballyBlocked ? [] : prospects.filter((item) => item.id && contactQueueStatuses.has(item.status) && contactGate(item).allowed && !item.doNotContact)
    .sort((a, b) => String(a.nextFollowUpDate || '9999-12-31').localeCompare(String(b.nextFollowUpDate || '9999-12-31'))), [contactGloballyBlocked, prospects]);
  const selected = prospects.find((item) => item.id === prospectId) || null;

  function chooseProspect(id: string) {
    const prospect = prospects.find((item) => item.id === id) || null;
    const draft = createOutreachDraft(templateKey, prospect);
    setProspectId(id); setSubject(draft.subject); setBody(draft.body); setNotice('');
  }

  function chooseTemplate(key: OutreachTemplateKey) {
    const draft = createOutreachDraft(key, selected);
    setTemplateKey(key); setSubject(draft.subject); setBody(draft.body); setNotice('');
  }

  async function copyDraft() {
    setError(''); setNotice('');
    if (contactGloballyBlocked) { setError('Draft access is globally blocked until unresolved suppression propagation is reconciled.'); return; }
    if (!selected) { setError('Select a qualified prospect before copying a personalized draft.'); return; }
    if (!contactGate(selected).allowed || selected.doNotContact) { setError('The selected record no longer passes the contact gate.'); return; }
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setNotice('Draft copied. Review every bracketed statement and public fact before manually sending it. Copying does not mark the prospect contacted.');
    } catch { setError('Clipboard access failed. Select the text and copy it manually.'); }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account to use the sales desk.</Centered>;

  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">No-call-required workflow</p><h1 className="text-3xl font-black">Faceless sales desk</h1></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>
    <div className="mb-6 grid gap-4 lg:grid-cols-3"><div className="rounded-xl border bg-white p-5 shadow-sm"><div className="text-3xl font-black">{queue.length}</div><div className="text-sm text-slate-500">Qualified records in a contact queue</div></div><div className="rounded-xl border bg-white p-5 shadow-sm"><div className="text-3xl font-black">0</div><div className="text-sm text-slate-500">Messages sent by this application</div></div><div className="rounded-xl border bg-white p-5 shadow-sm"><div className="text-3xl font-black">Policy only</div><div className="text-sm text-slate-500">Any external-mailbox daily limit must be checked and enforced by the owner</div></div></div>
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>Owner action required for every message.</strong> The desk only prepares copy. Recheck the recipient, category availability, campaign status, facts, suppression state, physical mailing address, and opt-out line in the actual sending tool. Do not use purchased lists, deceptive subjects, ringless voicemail, or recorded calls without separate legal review.</div>
    {contactGloballyBlocked && <div role="alert" className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">The sales desk is globally blocked because suppression propagation is unresolved. No prospect can be selected or copied until owner reconciliation is completed.</div>}
    {error && <div className="mb-4 rounded-lg bg-rose-100 p-3 text-sm text-rose-900">{error}</div>}{notice && <div className="mb-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{notice}</div>}
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]"><aside className="rounded-xl border bg-white p-5 shadow-sm"><h2 className="text-lg font-black">Written sequence</h2><p className="mt-2 text-sm leading-6 text-slate-600">Start with permission, use at most two follow-ups, then close the sequence. Reservation and fulfillment notices are only for the matching verified state.</p><label className="mt-5 block text-sm font-bold">Qualified prospect<select value={prospectId} onChange={(event) => chooseProspect(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"><option value="">Select one…</option>{queue.map((item) => <option key={item.id} value={item.id}>{item.businessName} · {item.businessCategory}</option>)}</select></label><label className="mt-4 block text-sm font-bold">Template<select value={templateKey} onChange={(event) => chooseTemplate(event.target.value as OutreachTemplateKey)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{templateKeys.map((key) => <option key={key} value={key}>{outreachTemplateNames[key]}</option>)}</select></label>
      {selected && !contactGloballyBlocked ? <div className="mt-5 rounded-lg bg-slate-50 p-4 text-sm"><div className="font-bold">{selected.businessName}</div><div className="mt-1 text-slate-600">{selected.email || 'No verified email'} · {selected.businessCategory}</div><div className="mt-2">Attempts: {selected.contactAttempts || 0}<br />Last contact: {selected.lastContactDate || 'none'}<br />Next follow-up: {selected.nextFollowUpDate || 'not scheduled'}</div><Link href="/prospects" className="mt-3 inline-block font-bold text-blue-700 underline">Review record and log outcome</Link></div> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">No selection. If the queue is empty, complete source verification and qualification in Prospects; do not bypass the gate.</p>}
    </aside><div className="rounded-xl border bg-white p-5 shadow-sm md:p-7"><h2 className="text-lg font-black">Editable draft</h2><label className="mt-5 block text-sm font-bold">Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} disabled={contactGloballyBlocked} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal disabled:bg-slate-100" /></label><label className="mt-5 block text-sm font-bold">Body<textarea value={body} onChange={(event) => setBody(event.target.value)} rows={23} disabled={contactGloballyBlocked} className="mt-1 w-full rounded-lg border px-3 py-3 font-mono text-sm font-normal leading-6 disabled:bg-slate-100" /></label><div className="mt-5 flex flex-wrap items-center gap-3"><button disabled={contactGloballyBlocked} onClick={() => void copyDraft()} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-40">Copy for manual review</button><span className="text-xs text-slate-500">No send button. No automatic activity log.</span></div></div></section>
    <section className="mt-7 rounded-xl border bg-white p-6"><h2 className="text-xl font-black">Five-touch faceless operating sequence</h2><ol className="mt-4 grid gap-3 text-sm leading-6 md:grid-cols-5"><Step n="1" title="Verify">Official site, live offer, category, territory fit, and decision-maker channel.</Step><Step n="2" title="Ask permission">Short truthful email; offer the written details or concept sample.</Step><Step n="3" title="Show privately">Optional 45–60 second screen recording of the relevant sample—not a generic pitch.</Step><Step n="4" title="Follow up twice">One useful reminder, then a closing note. Change one tested variable at evidence gates.</Step><Step n="5" title="Pay then intake">Hosted checkout only after activation; cleared payment precedes materials, proof, and fulfillment.</Step></ol></section>
  </main></div>;
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) { return <li className="rounded-lg bg-slate-50 p-4"><span className="text-xs font-black text-blue-700">{n}</span><h3 className="font-black">{title}</h3><p className="mt-1 text-slate-600">{children}</p></li>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
