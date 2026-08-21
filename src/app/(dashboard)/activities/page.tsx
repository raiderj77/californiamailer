'use client';

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { addActivity, getActivities, getProspects, type Activity, type Prospect, updateProspect } from '@/lib/firestore';
import { downloadCSV } from '@/lib/csv';
import { useEffect, useMemo, useState } from 'react';

type ActivityType = Activity['type'];

export default function ActivitiesPage() {
  const { user, loading, logout } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]); const [prospects, setProspects] = useState<Prospect[]>([]);
  const [prospectId, setProspectId] = useState(''); const [type, setType] = useState<ActivityType>('email');
  const [description, setDescription] = useState(''); const [outcome, setOutcome] = useState(''); const [followUpDate, setFollowUpDate] = useState('');
  const [filter, setFilter] = useState('all'); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    if (user) Promise.all([getActivities(user.uid), getProspects(user.uid)])
      .then(([activityRecords, prospectRecords]) => { if (active) { setActivities(activityRecords); setProspects(prospectRecords); } })
      .catch(() => { if (active) setError('Contact history could not be loaded.'); });
    return () => { active = false; };
  }, [user]);
  const visible = useMemo(() => activities.filter((item) => filter === 'all' || item.type === filter), [activities, filter]);
  async function refresh() { if (user) setActivities(await getActivities(user.uid)); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!user) return; const prospect = prospects.find((item) => item.id === prospectId);
    if (!prospect?.id) { setError('Select a prospect.'); return; }
    if ((prospect.doNotContact || prospect.status === 'do_not_contact') && ['email', 'call', 'proposal'].includes(type)) { setError('This record is suppressed. Log an internal note instead of outreach.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await addActivity({ prospectId: prospect.id, prospectName: prospect.businessName, type, description, outcome, followUpDate, userId: user.uid });
      if (['email', 'call'].includes(type)) await updateProspect(prospect.id, { lastContactDate: new Date().toISOString().slice(0, 10), nextFollowUpDate: followUpDate, contactAttempts: Number(prospect.contactAttempts || 0) + 1, status: prospect.status === 'ready_to_contact' ? 'contacted' : prospect.status });
      setDescription(''); setOutcome(''); setFollowUpDate(''); setNotice('Activity recorded. This log does not prove an email was delivered or read.'); await refresh();
    } catch { setError('Activity could not be recorded.'); }
    finally { setBusy(false); }
  }
  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;
  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8"><header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Manual audit trail</p><h1 className="text-3xl font-black">Contact history</h1></div><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></header>{error && <div className="mb-4 rounded-lg bg-rose-100 p-3 text-sm text-rose-900">{error}</div>}{notice && <div className="mb-4 rounded-lg bg-emerald-100 p-3 text-sm text-emerald-900">{notice}</div>}
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]"><form onSubmit={save} className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Record an owner action</h2><p className="mt-2 text-sm leading-6 text-slate-500">Record only what actually happened. Copying a draft is not delivery; an email send is not a read or response.</p><Select label="Prospect" value={prospectId} onChange={(e) => setProspectId(e.target.value)}><option value="">Select…</option>{prospects.map((item) => <option key={item.id} value={item.id}>{item.businessName}{item.doNotContact ? ' — SUPPRESSED' : ''}</option>)}</Select><Select label="Activity type" value={type} onChange={(e) => setType(e.target.value as ActivityType)}><option value="email">Manual email</option><option value="call">Call</option><option value="note">Internal note</option><option value="proposal">Written offer</option><option value="meeting">Meeting (only if it occurred)</option></Select><label className="mt-4 block text-sm font-bold">What happened<textarea required minLength={3} maxLength={1000} rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="mt-4 block text-sm font-bold">Outcome<textarea required minLength={2} maxLength={500} rows={3} value={outcome} onChange={(e) => setOutcome(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><label className="mt-4 block text-sm font-bold">Next follow-up<input type="date" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><button disabled={busy} className="mt-5 w-full rounded-lg bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-50">{busy ? 'Recording…' : 'Save factual log'}</button></form>
      <div className="rounded-xl border bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="text-xl font-black">Recorded history</h2><p className="text-sm text-slate-500">Append-only in this screen</p></div><div className="flex items-end gap-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Activity type<select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-950"><option value="all">All types</option>{['email', 'call', 'note', 'proposal', 'meeting'].map((item) => <option key={item} value={item}>{item}</option>)}</select></label><button onClick={() => downloadCSV(visible.map((item) => ({ Prospect: item.prospectName, Type: item.type, Description: item.description, Outcome: item.outcome, 'Follow Up': item.followUpDate })), 'californiamailer-contact-history')} className="rounded-lg border px-3 py-2 text-sm font-bold">Export</button></div></div>{visible.length ? <ul className="divide-y">{visible.map((item) => <li key={item.id} className="p-5"><div className="flex flex-wrap justify-between gap-2"><strong>{item.prospectName}</strong><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{item.type}</span></div><p className="mt-2 text-sm text-slate-700">{item.description}</p><p className="mt-1 text-sm text-slate-500">Outcome: {item.outcome}{item.followUpDate ? ` · Follow-up ${item.followUpDate}` : ''}</p></li>)}</ul> : <p className="p-8 text-center text-sm text-slate-500">No matching activity. No sample logs are created.</p>}</div></section>
  </main></div>;
}
function Select({ label, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) { return <label className="mt-4 block text-sm font-bold">{label}<select {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">{children}</select></label>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
