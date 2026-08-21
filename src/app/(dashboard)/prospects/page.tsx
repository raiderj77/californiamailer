'use client';

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { type Activity, type Prospect, addActivity, addProspect, getActivities, getProspects, updateProspect } from '@/lib/firestore';
import { downloadCSV } from '@/lib/csv';
import { categoryConflict, contactGate, contactQueueStatuses, duplicateReasons, isCurrentProspectStatus, isLegacyOperationalProspectStatus, prospectFilterStatuses, prospectStatuses } from '@/lib/prospectRules';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';

type ProspectDraft = Omit<Prospect, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
type SortKey = 'businessName' | 'businessCategory' | 'priority' | 'status' | 'nextFollowUpDate';
const pageSize = 20;

const emptyDraft: ProspectDraft = {
  businessName: '', businessCategory: '', website: '', contactName: '', contactRole: '', email: '', phone: '',
  address: '', city: '', serviceArea: '', territoryId: '', territoryName: 'Monterey Peninsula', mailingTerritoryFit: '',
  currentAdvertisedOffer: '', estimatedCustomerValue: undefined, activeAdvertisingEvidence: '', officialSource: '',
  officialSourceCheckedAt: '', leadSource: '', priority: 'medium', qualificationStatus: 'verify', qualificationReason: '',
  status: 'researching', lastContactDate: '', nextFollowUpDate: '', contactAttempts: 0, notes: '', campaignId: FOUNDING_CAMPAIGN.id,
  offeredPlacement: 'standard', quotedPrice: FOUNDING_CAMPAIGN.placements.standard.priceCents / 100, categoryReservationStatus: 'none', paymentStatus: 'none',
  proofStatus: 'not_started', renewalStatus: 'none', renewalDate: '', doNotContact: false,
};

const statusLabel = (value: string) => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const prospectStatusLabel = (value: string) => isLegacyOperationalProspectStatus(value)
  ? `Legacy note: ${statusLabel(value)} (unverified)`
  : statusLabel(value);

export default function ProspectsPage() {
  const { user, loading, logout } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [history, setHistory] = useState<Activity[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Prospect | null>(null);
  const [draft, setDraft] = useState<ProspectDraft>(emptyDraft);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [qualificationFilter, setQualificationFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortKey, setSortKey] = useState<SortKey>('nextFollowUpDate');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('follow_up_needed');

  const reload = useCallback(async () => {
    if (!user) return;
    try { setProspects(await getProspects(user.uid)); }
    catch { setError('Prospects could not be loaded. No records were changed.'); }
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...prospects]
      .filter((item) => !query || [item.businessName, item.businessCategory, item.contactName, item.email, item.city, item.website].some((value) => value?.toLowerCase().includes(query)))
      .filter((item) => statusFilter === 'all' || item.status === statusFilter)
      .filter((item) => qualificationFilter === 'all' || item.qualificationStatus === qualificationFilter)
      .filter((item) => priorityFilter === 'all' || item.priority === priorityFilter)
      .sort((a, b) => {
        const left = String(a[sortKey] ?? (sortKey === 'nextFollowUpDate' ? '9999-12-31' : ''));
        const right = String(b[sortKey] ?? (sortKey === 'nextFollowUpDate' ? '9999-12-31' : ''));
        return left.localeCompare(right) * (sortDirection === 'asc' ? 1 : -1);
      });
  }, [priorityFilter, prospects, qualificationFilter, search, sortDirection, sortKey, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const visible = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const today = new Date().toISOString().slice(0, 10);
  const dueCount = prospects.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate <= today && !item.doNotContact).length;

  function openNew() { setEditing(null); setDraft(emptyDraft); setHistory([]); setShowForm(true); setError(''); setNotice(''); }

  async function openEdit(item: Prospect) {
    setEditing(item); setDraft({ ...emptyDraft, ...item }); setShowForm(true); setError(''); setNotice('');
    if (user && item.id) {
      try { setHistory(await getActivities(user.uid, item.id)); } catch { setHistory([]); }
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!user) return;
    setError(''); setNotice('');
    const duplicate = duplicateReasons(prospects, draft, editing?.id);
    if (duplicate.length) { setError(`Possible duplicate: matching ${duplicate.join(', ')}. Reconcile the existing record before saving.`); return; }
    const gate = contactGate(draft);
    if (contactQueueStatuses.has(draft.status) && !gate.allowed) { setError(`This record cannot enter a contact queue yet: ${gate.missing.join(', ')}.`); return; }
    if (!draft.businessName.trim()) { setError('Business name is required.'); return; }
    const savedDraft = draft.doNotContact ? { ...draft, status: 'do_not_contact' as const } : draft;
    setBusy(true);
    try {
      if (editing?.id) {
        await updateProspect(editing.id, savedDraft);
        if (editing.status !== savedDraft.status) {
          await addActivity({ prospectId: editing.id, prospectName: savedDraft.businessName, type: 'note', description: `Status changed from ${statusLabel(editing.status)} to ${statusLabel(savedDraft.status)}.`, outcome: 'recorded', followUpDate: savedDraft.nextFollowUpDate || '', userId: user.uid });
        }
      } else { await addProspect({ ...savedDraft, userId: user.uid }); }
      setShowForm(false); setEditing(null); setNotice('Prospect saved. No message was sent.'); await reload();
    } catch { setError('The prospect could not be saved. No message was sent.'); }
    finally { setBusy(false); }
  }

  async function applyBulkStatus() {
    if (!user || !isCurrentProspectStatus(bulkStatus) || selected.size === 0) return;
    const items = prospects.filter((item) => item.id && selected.has(item.id));
    if (contactQueueStatuses.has(bulkStatus)) {
      const blocked = items.filter((item) => !contactGate(item).allowed);
      if (blocked.length) { setError(`${blocked.length} selected record(s) fail the qualification gate. Nothing was changed.`); return; }
    }
    setBusy(true); setError(''); setNotice('');
    try {
      await Promise.all(items.flatMap((item) => item.id ? [
        updateProspect(item.id, { status: bulkStatus, doNotContact: bulkStatus === 'do_not_contact' || item.doNotContact }),
        addActivity({ prospectId: item.id, prospectName: item.businessName, type: 'note', description: `Bulk status update: ${statusLabel(bulkStatus)}.`, outcome: 'recorded', followUpDate: item.nextFollowUpDate || '', userId: user.uid }),
      ] : []));
      setSelected(new Set()); setNotice(`${items.length} record(s) updated. No message was sent.`); await reload();
    } catch { setError('Bulk update failed. Review the records before trying again.'); }
    finally { setBusy(false); }
  }

  function exportRows() {
    downloadCSV(filtered.map((item) => ({
      'Business Name': item.businessName, 'Business Category': item.businessCategory || '', Website: item.website || '', 'Contact Name': item.contactName,
      'Contact Role': item.contactRole || '', Email: item.email, Phone: item.phone, City: item.city, 'Service Area': item.serviceArea || '',
      'Mailing Territory Fit': item.mailingTerritoryFit || '', 'Current Advertised Offer': item.currentAdvertisedOffer || '',
      'Estimated Customer Value': item.estimatedCustomerValue || '', 'Active Advertising Evidence': item.activeAdvertisingEvidence || '',
      'Official Source': item.officialSource || '', 'Official Source Checked At': item.officialSourceCheckedAt || '', 'Lead Source': item.leadSource || '',
      Priority: item.priority || '', Qualification: item.qualificationStatus || '', 'Qualification Reason': item.qualificationReason || '', Status: item.status,
      'Last Contact Date': item.lastContactDate || '', 'Next Follow Up Date': item.nextFollowUpDate || '', 'Contact Attempts': item.contactAttempts || 0,
      Campaign: item.campaignId || '', Placement: item.offeredPlacement || '', 'Quoted Price': item.quotedPrice || '',
      'Legacy Category Note (Unverified)': item.categoryReservationStatus || '', 'Legacy Payment Note (Unverified)': item.paymentStatus || '', 'Proof Status': item.proofStatus || '',
      'Renewal Status': item.renewalStatus || '', 'Renewal Date': item.renewalDate || '', 'Do Not Contact': item.doNotContact ? 'yes' : 'no', Notes: item.notes,
    })), 'californiamailer-qualified-prospects');
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account to access prospects.</Centered>;

  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-blue-700">Owner workspace</p><h1 className="text-3xl font-black text-slate-950">Qualified advertiser prospects</h1></div><div className="flex flex-wrap gap-2"><button onClick={exportRows} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold">Export filtered CSV</button><button onClick={openNew} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Add researched business</button><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></div></header>
    <div className="mb-5 grid gap-3 md:grid-cols-3"><Stat label="Records" value={prospects.length} /><Stat label="Follow-ups due" value={dueCount} /><Stat label="Ready to contact" value={prospects.filter((item) => item.status === 'ready_to_contact' && contactGate(item).allowed).length} /></div>
    <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Faceless, not anonymous:</strong> this desk supports researched, permission-first outreach without requiring a sales call. It never sends email. Only records with evidence, an official-source recheck, and a Qualified decision may enter a contact queue. Legacy prospect payment or category values are unverified notes; only the server-owned reservation and payment workflows establish operational state.</div>
    {error && <Message tone="error">{error}</Message>}{notice && <Message tone="success">{notice}</Message>}
    <section className="mb-5 rounded-xl border bg-white p-4 shadow-sm"><div className="grid gap-3 lg:grid-cols-6">
      <label className="grid gap-1 text-xs font-bold text-slate-600 lg:col-span-2">Search prospects<input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Business, category, or person" className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-950" /></label>
      <Filter label="Contact status" value={statusFilter} setValue={setStatusFilter} options={prospectFilterStatuses.map((value) => [value, prospectStatusLabel(value)])} allLabel="All statuses" />
      <Filter label="Qualification" value={qualificationFilter} setValue={setQualificationFilter} options={['verify', 'qualified', 'disqualified'].map((value) => [value, statusLabel(value)])} allLabel="All qualification" />
      <Filter label="Priority" value={priorityFilter} setValue={setPriorityFilter} options={['urgent', 'high', 'medium', 'low'].map((value) => [value, statusLabel(value)])} allLabel="All priorities" />
      <label className="grid gap-1 text-xs font-bold text-slate-600">Sort prospects<select value={`${sortKey}:${sortDirection}`} onChange={(event) => { const [key, direction] = event.target.value.split(':'); setSortKey(key as SortKey); setSortDirection(direction as 'asc' | 'desc'); }} className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-950"><option value="nextFollowUpDate:asc">Follow-up soonest</option><option value="priority:desc">Priority high first</option><option value="businessName:asc">Business A–Z</option><option value="status:asc">Status A–Z</option></select></label>
    </div>{selected.size > 0 && <div className="mt-4 flex flex-wrap items-end gap-2 border-t pt-4"><strong className="self-center text-sm">{selected.size} selected</strong><label className="grid gap-1 text-xs font-bold text-slate-600">New contact status<select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value)} className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-950">{prospectStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><button disabled={busy} onClick={() => void applyBulkStatus()} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Apply status only</button><span className="self-center text-xs text-slate-500">Every change is logged; no outreach is sent.</span></div>}</section>
    <section className="overflow-hidden rounded-xl border bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-600"><tr><th className="p-3"><input aria-label="Select visible prospects" type="checkbox" checked={visible.length > 0 && visible.every((item) => item.id && selected.has(item.id))} onChange={(event) => setSelected((current) => { const next = new Set(current); visible.forEach((item) => { if (!item.id) return; if (event.target.checked) next.add(item.id); else next.delete(item.id); }); return next; })} /></th><th className="p-3">Business</th><th className="p-3">Qualification</th><th className="p-3">Status</th><th className="p-3">Contact</th><th className="p-3">Follow-up</th><th className="p-3">Campaign / category</th><th className="p-3">Action</th></tr></thead><tbody className="divide-y">{visible.map((item) => {
      const gate = contactGate(item); const conflicts = categoryConflict(prospects, item, item.id);
      return <tr key={item.id} className={item.doNotContact ? 'bg-rose-50' : ''}><td className="p-3"><input aria-label={`Select ${item.businessName}`} type="checkbox" checked={Boolean(item.id && selected.has(item.id))} onChange={() => item.id && setSelected((current) => { const next = new Set(current); if (next.has(item.id!)) next.delete(item.id!); else next.add(item.id!); return next; })} /></td><td className="p-3"><div className="font-bold text-slate-950">{item.businessName}</div><div className="text-slate-500">{item.businessCategory || 'Category unverified'} · {item.city || 'City unverified'}</div>{item.website && <a href={item.website.startsWith('http') ? item.website : `https://${item.website}`} target="_blank" rel="noreferrer" className="text-xs text-blue-700 underline">Official site</a>}</td><td className="p-3"><Badge tone={item.qualificationStatus === 'qualified' ? 'green' : item.qualificationStatus === 'disqualified' ? 'red' : 'yellow'}>{statusLabel(item.qualificationStatus || 'verify')}</Badge>{!gate.allowed && !item.doNotContact && <div className="mt-1 max-w-48 text-xs text-slate-500">Missing: {gate.missing.join(', ')}</div>}</td><td className="p-3"><Badge tone={item.doNotContact ? 'red' : isLegacyOperationalProspectStatus(item.status) ? 'yellow' : 'blue'}>{prospectStatusLabel(item.status)}</Badge></td><td className="p-3"><div>{item.contactName || 'Decision maker unknown'}</div><div className="text-slate-500">{item.email || 'Email not verified'}</div><div className="text-xs text-slate-400">{item.contactAttempts || 0} attempt(s)</div></td><td className="p-3">{item.nextFollowUpDate || '—'}</td><td className="p-3"><div>{item.campaignId || 'Not assigned'}</div><div className={conflicts.length ? 'font-bold text-amber-700' : 'text-slate-500'}>{item.businessCategory || 'No category'}{conflicts.length ? ` · ${conflicts.length} possible prospect-note conflict` : ''}</div></td><td className="p-3"><button onClick={() => void openEdit(item)} className="font-bold text-blue-700 underline">Review</button></td></tr>;
    })}</tbody></table></div>{visible.length === 0 && <p className="p-8 text-center text-slate-500">No prospects match these filters. No sample records are created.</p>}<div className="flex items-center justify-between border-t p-4 text-sm"><span>Showing {visible.length} of {filtered.length}</span><div className="flex items-center gap-2"><button disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button><span>Page {currentPage} of {pageCount}</span><button disabled={currentPage >= pageCount} onClick={() => setPage((value) => Math.min(pageCount, value + 1))} className="rounded border px-3 py-1 disabled:opacity-40">Next</button></div></div></section>
    {showForm && <ProspectForm draft={draft} setDraft={setDraft} editing={editing} history={history} prospects={prospects} busy={busy} close={() => setShowForm(false)} save={save} />}
  </main></div>;
}

function ProspectForm({ draft, setDraft, editing, history, prospects, busy, close, save }: { draft: ProspectDraft; setDraft: React.Dispatch<React.SetStateAction<ProspectDraft>>; editing: Prospect | null; history: Activity[]; prospects: Prospect[]; busy: boolean; close: () => void; save: (event: React.FormEvent) => void }) {
  const conflicts = categoryConflict(prospects, draft, editing?.id); const gate = contactGate(draft);
  const legacyStatus = isLegacyOperationalProspectStatus(draft.status);
  const set = <K extends keyof ProspectDraft>(key: K, value: ProspectDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 p-3 md:p-8" role="dialog" aria-modal="true" aria-labelledby="prospect-form-title"><form onSubmit={save} className="mx-auto max-w-5xl rounded-2xl bg-white p-5 shadow-2xl md:p-8"><div className="mb-6 flex items-start justify-between gap-4"><div><h2 id="prospect-form-title" className="text-2xl font-black">{editing ? 'Review prospect' : 'Add researched business'}</h2><p className="mt-1 text-sm text-slate-500">Save public-source evidence and qualification before outreach. This form never sends a message.</p></div><button type="button" onClick={close} className="rounded border px-3 py-2">Close</button></div>
    <Section title="Business and fit"><div className="grid gap-4 md:grid-cols-3"><Input label="Business name *" value={draft.businessName} onChange={(e) => set('businessName', e.target.value)} required /><Input label="Business category" value={draft.businessCategory || ''} onChange={(e) => set('businessCategory', e.target.value)} /><Input label="Official website" value={draft.website || ''} onChange={(e) => set('website', e.target.value)} /><Input label="City" value={draft.city} onChange={(e) => set('city', e.target.value)} /><Input label="Service area" value={draft.serviceArea || ''} onChange={(e) => set('serviceArea', e.target.value)} /><Input label="Territory fit" value={draft.mailingTerritoryFit || ''} onChange={(e) => set('mailingTerritoryFit', e.target.value)} /><Input label="Current advertised offer" value={draft.currentAdvertisedOffer || ''} onChange={(e) => set('currentAdvertisedOffer', e.target.value)} /><Input label="Estimated customer value (owner estimate)" type="number" min="0" value={draft.estimatedCustomerValue ?? ''} onChange={(e) => set('estimatedCustomerValue', e.target.value ? Number(e.target.value) : undefined)} /><Input label="Lead source" value={draft.leadSource || ''} onChange={(e) => set('leadSource', e.target.value)} /></div></Section>
    <Section title="Verification gate"><div className="grid gap-4 md:grid-cols-2"><Textarea label="Observable evidence of active advertising or need" value={draft.activeAdvertisingEvidence || ''} onChange={(e) => set('activeAdvertisingEvidence', e.target.value)} /><Textarea label="Qualification reason / not-fit boundary" value={draft.qualificationReason || ''} onChange={(e) => set('qualificationReason', e.target.value)} /><Input label="Official source URL" value={draft.officialSource || ''} onChange={(e) => set('officialSource', e.target.value)} /><Input label="Official source checked" type="date" value={draft.officialSourceCheckedAt || ''} onChange={(e) => set('officialSourceCheckedAt', e.target.value)} /><Select label="Qualification" value={draft.qualificationStatus || 'verify'} onChange={(e) => set('qualificationStatus', e.target.value as Prospect['qualificationStatus'])} options={['verify', 'qualified', 'disqualified']} /><Select label="Priority" value={draft.priority || 'medium'} onChange={(e) => set('priority', e.target.value as Prospect['priority'])} options={['urgent', 'high', 'medium', 'low']} /></div><div className={`mt-4 rounded-lg p-3 text-sm ${gate.allowed ? 'bg-emerald-50 text-emerald-900' : 'bg-amber-50 text-amber-950'}`}>{gate.allowed ? 'Qualification gate passed. The owner may move this record to a contact queue.' : `Not contact-ready: ${gate.missing.join(', ')}.`}</div></Section>
    <Section title="Decision maker and follow-up"><div className="grid gap-4 md:grid-cols-3"><Input label="Contact name" value={draft.contactName} onChange={(e) => set('contactName', e.target.value)} /><Input label="Role" value={draft.contactRole || ''} onChange={(e) => set('contactRole', e.target.value)} /><Input label="Email" type="email" value={draft.email} onChange={(e) => set('email', e.target.value)} /><Input label="Phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} /><Input label="Last contact" type="date" value={draft.lastContactDate || ''} onChange={(e) => set('lastContactDate', e.target.value)} /><Input label="Next follow-up" type="date" value={draft.nextFollowUpDate || ''} onChange={(e) => set('nextFollowUpDate', e.target.value)} /><Input label="Contact attempts" type="number" min="0" value={draft.contactAttempts ?? 0} onChange={(e) => set('contactAttempts', Number(e.target.value))} /><label className="block text-sm font-bold text-slate-700">Lead status<select value={draft.status} onChange={(e) => isCurrentProspectStatus(e.target.value) && set('status', e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-slate-950">{legacyStatus && <option value={draft.status} disabled>{prospectStatusLabel(draft.status)}</option>}{prospectStatuses.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label><label className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900"><input type="checkbox" checked={Boolean(draft.doNotContact)} onChange={(e) => { set('doNotContact', e.target.checked); if (e.target.checked) set('status', 'do_not_contact'); }} />Do not contact / suppress</label></div></Section>
    <Section title="Offer and campaign"><div className="grid gap-4 md:grid-cols-3"><Input label="Campaign ID" value={draft.campaignId || ''} onChange={(e) => set('campaignId', e.target.value)} /><div className="rounded-lg border px-3 py-2 text-sm"><div className="font-bold text-slate-700">Offered placement</div><div className="mt-1 text-slate-950">One equal founding slot unit</div></div><Input label="Quoted price note (owner-entered)" type="number" min="0" value={draft.quotedPrice ?? ''} onChange={(e) => set('quotedPrice', e.target.value ? Number(e.target.value) : undefined)} /><Input label="Proof status note" value={draft.proofStatus || ''} onChange={(e) => set('proofStatus', e.target.value)} /><Input label="Renewal status" value={draft.renewalStatus || ''} onChange={(e) => set('renewalStatus', e.target.value)} /><Input label="Renewal date" type="date" value={draft.renewalDate || ''} onChange={(e) => set('renewalDate', e.target.value)} /></div><div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><div className="font-bold">Legacy operational notes — unverified</div><div className="mt-2 grid gap-1 sm:grid-cols-2"><span>Category note: {statusLabel(draft.categoryReservationStatus || 'none')}</span><span>Payment note: {statusLabel(draft.paymentStatus || 'none')}</span></div><p className="mt-2 text-xs leading-5">These preserved values are not category inventory, a hold, a sale, or payment evidence. Cleared and sold controls were removed; use the server-owned reservation and payment workspaces for verified state.</p></div>{conflicts.length > 0 && <div className="mt-4 rounded-lg bg-amber-100 p-3 text-sm font-bold text-amber-950">Possible prospect-note category conflict: {conflicts.map((item) => item.businessName).join(', ')} has an active sales note in this campaign. This does not reserve inventory or override the server-owned category/payment lock.</div>}</Section>
    <Section title="Owner notes"><Textarea label="Internal notes (never public)" value={draft.notes} onChange={(e) => set('notes', e.target.value)} />{editing && <div className="mt-5"><h4 className="font-bold">Contact history</h4>{history.length ? <ul className="mt-2 space-y-2 text-sm">{history.slice(0, 10).map((item) => <li key={item.id} className="rounded bg-slate-50 p-3">{item.description}<span className="ml-2 text-slate-500">{item.outcome}</span></li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No logged activity.</p>}</div>}</Section>
    <div className="mt-7 flex flex-wrap justify-end gap-3"><button type="button" onClick={close} className="rounded-lg border px-5 py-3 font-bold">Cancel</button><button disabled={busy} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Saving…' : 'Save record only'}</button></div>
  </form></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section className="mt-7 border-t pt-6"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>; }
function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) { return <label className="block text-sm font-bold text-slate-700">{label}<input {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-slate-950" /></label>; }
function Textarea({ label, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) { return <label className="block text-sm font-bold text-slate-700">{label}<textarea {...props} rows={3} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-slate-950" /></label>; }
function Select({ label, options, ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; options: string[] }) { return <label className="block text-sm font-bold text-slate-700">{label}<select {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal text-slate-950">{options.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</select></label>; }
function Filter({ label, value, setValue, options, allLabel }: { label: string; value: string; setValue: (value: string) => void; options: string[][]; allLabel: string }) { return <label className="grid gap-1 text-xs font-bold text-slate-600">{label}<select value={value} onChange={(event) => setValue(event.target.value)} className="rounded-lg border px-3 py-2 text-sm font-normal text-slate-950"><option value="all">{allLabel}</option>{options.map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></label>; }
function Badge({ children, tone }: { children: React.ReactNode; tone: 'green' | 'red' | 'yellow' | 'blue' }) { const classes = { green: 'bg-emerald-100 text-emerald-800', red: 'bg-rose-100 text-rose-800', yellow: 'bg-amber-100 text-amber-900', blue: 'bg-blue-100 text-blue-800' }; return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${classes[tone]}`}>{children}</span>; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-2xl font-black">{value}</div><div className="text-sm text-slate-500">{label}</div></div>; }
function Message({ children, tone }: { children: React.ReactNode; tone: 'error' | 'success' }) { return <div className={`mb-4 rounded-lg p-3 text-sm ${tone === 'error' ? 'bg-rose-100 text-rose-900' : 'bg-emerald-100 text-emerald-900'}`}>{children}</div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
