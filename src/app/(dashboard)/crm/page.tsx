'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  CRM_NEXT_ACTION_TYPES,
  CRM_PIPELINE_STAGES,
  type CrmAddonId,
  type CrmNextActionType,
  type CrmStageId,
} from '@/config/crm';
import type { CrmOpportunity, CrmOpportunitySource } from '@/lib/crmDomain';
import { useAuth } from '@/lib/AuthContext';

interface CrmActivity {
  id: string;
  prospectId: string;
  prospectName: string;
  type: string;
  description: string;
  outcome: string;
  followUpDate: string;
  createdAt: string | null;
}

interface CrmAddon {
  id: CrmAddonId;
  name: string;
  description: string;
  href: string;
  externalCostNote: string;
  enabled: boolean;
  licenseCost: string;
}

interface CrmSnapshot {
  opportunities: CrmOpportunity[];
  activities: CrmActivity[];
  addons: CrmAddon[];
  safeguards: {
    outboundEmail: string;
    sms: string;
    calls: string;
    voicemail: string;
    socialMessages: string;
    openRelay: boolean;
    clientDirectWrites: boolean;
    mode: string;
  };
  sourceCounts: { prospects: number; reservationInterests: number; quoteInquiries: number };
  contactGloballyBlocked: boolean;
  limits: { recordsPerSource: number; activities: number; possiblyTruncated: boolean };
}

const editableStages = CRM_PIPELINE_STAGES.filter((stage) =>
  ['qualification', 'ready', 'follow_up', 'interested', 'renewal', 'closed'].includes(stage.id),
);

const sourceLabels: Record<CrmOpportunitySource, string> = {
  prospect: 'Prospect',
  reservation_interest: 'Reservation interest',
  quote_inquiry: 'Quote inquiry',
};

export default function CrmPage() {
  const { user, loading, logout } = useAuth();
  const [snapshot, setSnapshot] = useState<CrmSnapshot | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState<'all' | CrmStageId>('all');
  const [sourceFilter, setSourceFilter] = useState<'all' | CrmOpportunitySource>('all');
  const [stageDraft, setStageDraft] = useState<CrmStageId>('qualification');
  const [taskType, setTaskType] = useState<CrmNextActionType>('research');
  const [taskDate, setTaskDate] = useState('');
  const [taskNote, setTaskNote] = useState('');
  const [activityNote, setActivityNote] = useState('');
  const [taskOutcome, setTaskOutcome] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    try {
      const response = await fetch('/api/admin/crm', {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        cache: 'no-store',
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'CRM workspace could not be read.');
      const next = body as CrmSnapshot;
      setSnapshot(next);
      setSelectedId((current) => next.opportunities.some((item) => item.id === current)
        ? current
        : next.opportunities[0]?.id || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CRM workspace could not be read.');
    }
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  const selected = snapshot?.opportunities.find((item) => item.id === selectedId) || null;
  useEffect(() => {
    if (!selected) return;
    const mutableStage = editableStages.some((stage) => stage.id === selected.stage) ? selected.stage : 'qualification';
    setStageDraft(mutableStage);
    setTaskType(selected.nextActionType || 'research');
    setTaskDate(selected.nextActionDate);
    setTaskNote(selected.nextActionNote);
    setTaskOutcome('');
    setActivityNote('');
  }, [selected]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (snapshot?.opportunities || []).filter((item) =>
      (!query || item.searchText.includes(query))
      && (stageFilter === 'all' || item.stage === stageFilter)
      && (sourceFilter === 'all' || item.source === sourceFilter),
    );
  }, [search, snapshot, sourceFilter, stageFilter]);

  const stageCounts = useMemo(() => Object.fromEntries(CRM_PIPELINE_STAGES.map((stage) => [
    stage.id,
    snapshot?.opportunities.filter((item) => item.stage === stage.id).length || 0,
  ])) as Record<CrmStageId, number>, [snapshot]);

  const selectedActivities = useMemo(() => selected?.source === 'prospect'
    ? (snapshot?.activities || []).filter((activity) => activity.prospectId === selected.recordId).slice(0, 12)
    : [], [selected, snapshot]);
  const dueTasks = snapshot?.opportunities.filter((item) => ['overdue', 'today'].includes(item.taskState)).length || 0;
  const openOpportunities = snapshot?.opportunities.filter((item) => !['closed', 'paid'].includes(item.stage)).length || 0;
  const enabled = (id: CrmAddonId) => snapshot?.addons.find((addon) => addon.id === id)?.enabled !== false;
  const contactGloballyBlocked = snapshot?.contactGloballyBlocked !== false;

  async function mutate(payload: Record<string, unknown>, successMessage: string) {
    if (!user) return false;
    if (contactGloballyBlocked && !['set_addon', 'set_quote_status', 'add_note'].includes(String(payload.action))) {
      setError('Prospect contact is globally blocked until unresolved suppression propagation is reconciled.');
      return false;
    }
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/crm', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'CRM action failed.');
      setNotice(successMessage);
      await load();
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'CRM action failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Centered>Loading owner CRM…</Centered>;
  if (!user) return <Centered>Sign in with the authorized owner account.</Centered>;

  return <div className="min-h-screen bg-slate-50 md:flex">
    <Sidebar />
    <main className="min-w-0 flex-1 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Owner-only first-party workspace</p>
          <h1 className="mt-1 text-3xl font-black text-slate-950">CaliforniaMailer CRM</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">One view over existing prospects, quote inquiries, reservation interests, and activities. Prospect labels are sales notes only; they cannot create a reservation, payment, proof approval, or delivery event.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} disabled={busy} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh source records</button>
          <button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button>
        </div>
      </header>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
        <strong>Manual mode is enforced.</strong> Automated email, SMS, calls, voicemail, and social messages are disabled. This CRM has no sending endpoint, no open relay, and no client-direct write path. Add-on switches change owner workspace visibility only.
      </div>
      {snapshot?.limits.possiblyTruncated && <div role="status" className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">At least one source reached its safe read limit. This screen may be incomplete; source records were not deleted or changed.</div>}
      {contactGloballyBlocked && <div role="alert" className="mt-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-950">Prospect promotion, pipeline contact stages, and next-contact tasks are globally blocked until unresolved suppression propagation is reconciled. Internal notes and non-contact review remain available.</div>}
      {error && <div role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-950">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-950">{notice}</div>}

      <section aria-label="CRM summary" className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Open opportunities" value={openOpportunities} />
        <Metric label="Tasks due" value={dueTasks} alert={dueTasks > 0} />
        <Metric label="Prospect records" value={snapshot?.sourceCounts.prospects ?? '—'} />
        <Metric label="Inbound interests" value={snapshot?.sourceCounts.reservationInterests ?? '—'} />
        <Metric label="Quote inquiries" value={snapshot?.sourceCounts.quoteInquiries ?? '—'} />
      </section>

      <section className="mt-7 rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><h2 className="text-xl font-black">Connected operations</h2><p className="mt-1 text-sm text-slate-600">Open the existing source-of-truth tools; the CRM does not replace their approval gates.</p></div>
          <div className="flex flex-wrap gap-2">
            <OperationLink href="/interest-inbox" label="Interest inbox" />
            <OperationLink href="/sales-desk" label="Manual sales desk" />
            {enabled('proofs') && <OperationLink href="/proof-workflow" label="Proofs" />}
            {enabled('refunds') && <OperationLink href="/refunds" label="Refunds" />}
            {enabled('tracking') && <OperationLink href="/tracking" label="Tracking" />}
          </div>
        </div>
      </section>

      {enabled('pipeline') ? <section id="pipeline" className="mt-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><h2 className="text-2xl font-black">Opportunity pipeline</h2><p className="mt-1 text-sm text-slate-600">Only server-owned operational workflows can produce locked reservation or paid stages. Legacy prospect flags are unverified notes.</p></div>
          <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-auto xl:grid-cols-[280px_190px]">
            <label className="grid gap-1 text-xs font-bold text-slate-600">Search
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Business, contact, category, status" className="rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-950" />
            </label>
            <label className="grid gap-1 text-xs font-bold text-slate-600">Source
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value as 'all' | CrmOpportunitySource)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal text-slate-950">
                <option value="all">All sources</option>
                <option value="prospect">Prospects</option>
                <option value="reservation_interest">Reservation interests</option>
                <option value="quote_inquiry">Quote inquiries</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="Filter by pipeline stage">
          <StageButton active={stageFilter === 'all'} label="All" count={snapshot?.opportunities.length || 0} onClick={() => setStageFilter('all')} />
          {CRM_PIPELINE_STAGES.map((stage) => <StageButton key={stage.id} active={stageFilter === stage.id} label={stage.label} count={stageCounts[stage.id]} onClick={() => setStageFilter(stage.id)} />)}
        </div>

        <div className="mt-4 grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
            <div className="border-b bg-slate-50 px-5 py-3 text-sm font-bold text-slate-700">{filtered.length} matching real record{filtered.length === 1 ? '' : 's'}</div>
            {filtered.length ? <ul className="divide-y">{filtered.map((item) => <li key={item.id}>
              <button type="button" onClick={() => setSelectedId(item.id)} className={`w-full p-5 text-left transition ${selectedId === item.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><div className="font-black text-slate-950">{item.businessName}</div><div className="mt-1 text-sm text-slate-600">{item.category || 'Category unverified'} · {sourceLabels[item.source]}</div></div>
                  <div className="flex flex-wrap items-center gap-2"><StagePill stage={item.stage} />{item.doNotContact && <span className="rounded-full bg-rose-100 px-2 py-1 text-xs font-black text-rose-800">DNC</span>}</div>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3"><span>Status: {humanize(item.sourceStatus)}</span><span>Contact: {item.contactName || 'unverified'}</span><span className={item.taskState === 'overdue' ? 'font-bold text-rose-700' : ''}>Next: {item.nextActionDate || 'unscheduled'}</span></div>
              </button>
            </li>)}</ul> : <p className="p-10 text-center text-sm text-slate-500">No real records match these filters. No sample opportunities are inserted.</p>}
          </div>

          <aside className="self-start rounded-2xl border bg-white p-5 shadow-sm xl:sticky xl:top-4">
            {selected ? <OpportunityDetail
              item={selected}
              activities={selectedActivities}
              stageDraft={stageDraft}
              setStageDraft={setStageDraft}
              taskType={taskType}
              setTaskType={setTaskType}
              taskDate={taskDate}
              setTaskDate={setTaskDate}
              taskNote={taskNote}
              setTaskNote={setTaskNote}
              taskOutcome={taskOutcome}
              setTaskOutcome={setTaskOutcome}
              activityNote={activityNote}
              setActivityNote={setActivityNote}
              busy={busy}
              contactGloballyBlocked={contactGloballyBlocked}
              tasksEnabled={enabled('tasks')}
              mutate={mutate}
            /> : <p className="py-10 text-center text-sm text-slate-500">Select a record to inspect its source-backed detail.</p>}
          </aside>
        </div>
      </section> : <DisabledModule name="Opportunity pipeline" />}

      <section className="mt-8" aria-labelledby="addons-heading">
        <h2 id="addons-heading" className="text-2xl font-black">First-party add-ons</h2>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">These modules are part of this CaliforniaMailer codebase, so there is no separate CaliforniaMailer SaaS license. External providers still charge their own usage, processing, printing, postage, storage, or delivery fees. A toggle only changes this owner workspace.</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(snapshot?.addons || []).map((addon) => <article key={addon.id} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><h3 className="font-black">{addon.name}</h3><button type="button" role="switch" aria-checked={addon.enabled} disabled={busy} onClick={() => void mutate({ action: 'set_addon', addonId: addon.id, enabled: !addon.enabled }, `${addon.name} is now ${addon.enabled ? 'hidden' : 'visible'} in this owner workspace. No outside service changed.`)} className={`relative h-7 w-12 rounded-full transition disabled:opacity-50 ${addon.enabled ? 'bg-blue-700' : 'bg-slate-300'}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${addon.enabled ? 'left-6' : 'left-1'}`} /></button></div>
            <p className="mt-2 text-sm leading-6 text-slate-600">{addon.description}</p>
            <p className="mt-3 text-xs font-bold text-emerald-800">{addon.licenseCost}</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">{addon.externalCostNote}</p>
            {addon.enabled && <Link href={addon.href} className="mt-4 inline-block text-sm font-bold text-blue-700 underline">Open module</Link>}
          </article>)}
        </div>
      </section>
    </main>
  </div>;
}

function OpportunityDetail({ item, activities, stageDraft, setStageDraft, taskType, setTaskType, taskDate, setTaskDate, taskNote, setTaskNote, taskOutcome, setTaskOutcome, activityNote, setActivityNote, busy, contactGloballyBlocked, tasksEnabled, mutate }: {
  item: CrmOpportunity;
  activities: CrmActivity[];
  stageDraft: CrmStageId;
  setStageDraft: (value: CrmStageId) => void;
  taskType: CrmNextActionType;
  setTaskType: (value: CrmNextActionType) => void;
  taskDate: string;
  setTaskDate: (value: string) => void;
  taskNote: string;
  setTaskNote: (value: string) => void;
  taskOutcome: string;
  setTaskOutcome: (value: string) => void;
  activityNote: string;
  setActivityNote: (value: string) => void;
  busy: boolean;
  contactGloballyBlocked: boolean;
  tasksEnabled: boolean;
  mutate: (payload: Record<string, unknown>, successMessage: string) => Promise<boolean>;
}) {
  const hasQuoteContext = item.source === 'quote_inquiry' || (item.source === 'prospect' && Boolean(item.publicReference));
  return <>
    <div className="flex items-start justify-between gap-3"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">{sourceLabels[item.source]}{item.publicReference ? ` · ${item.publicReference}` : ''}</div><h3 className="mt-1 text-xl font-black">{item.businessName}</h3></div><StagePill stage={item.stage} /></div>
    <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
      <Detail label="Contact" value={item.contactName || 'Unverified'} />
      <Detail label="Category" value={item.category || 'Unverified'} />
      <Detail label="Email" value={item.email || 'Not recorded'} />
      <Detail label="Phone" value={item.phone || 'Not recorded'} />
      <Detail label="Source status" value={humanize(item.sourceStatus)} />
      <Detail label="Qualification" value={humanize(item.qualificationStatus)} />
      {item.source === 'prospect' && <><Detail label="Legacy category note (unverified)" value={humanize(item.categoryReservationStatus)} /><Detail label="Legacy payment note (unverified)" value={humanize(item.paymentStatus)} /><Detail label="Proof note" value={humanize(item.proofStatus)} /></>}
      {item.source === 'prospect' && (item.contactPreference || item.replyPermission) && <><Detail label="Contact preference" value={humanize(item.contactPreference)} /><Detail label="Reply permission" value={humanize(item.replyPermission)} /></>}
      {item.source === 'quote_inquiry' && <><Detail label="Contact preference" value={humanize(item.contactPreference)} /><Detail label="Reply permission" value={humanize(item.replyPermission)} /></>}
      {hasQuoteContext && <>
        <Detail label="Requested service" value={humanize(item.serviceType)} />
        <Detail label="Area" value={item.location || 'Not recorded'} />
        <Detail label="Quantity" value={formatQuantity(item.quantity)} />
        <Detail label="Mailer" value={item.mailerLabel || 'Not recorded'} />
        {item.sharedModelId && <Detail label="Shared model ID" value={item.sharedModelId} />}
        {item.mailerSpecId && <Detail label="Mailer spec ID" value={item.mailerSpecId} />}
        <Detail label="Targeting" value={humanize(item.targeting)} />
        <Detail label="Fulfillment" value={humanize(item.fulfillment)} />
        <Detail label="Intake" value={humanize(item.intakeStatus)} />
        <Detail label="Manual review queue" value={humanize(item.reviewQueueStatus)} />
        <Detail label="Outbound message" value={humanize(item.outboundMessageStatus)} />
        <Detail label="Notification queue" value={humanize(item.notificationStatus)} />
        {item.submittedAt && <Detail label="Request received" value={new Date(item.submittedAt).toLocaleString()} />}
      </>}
    </dl>
    {item.summary && <div className="mt-4 rounded-lg bg-slate-50 p-3 text-sm leading-6"><strong>Request summary</strong><p className="mt-1 whitespace-pre-wrap text-slate-700">{item.summary}</p></div>}
    {item.operationalStateSource === 'legacy_prospect_note' && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><strong>Unverified legacy note.</strong> A prospect status, category note, or payment note is not reservation inventory or payment evidence. This record stays in the manual sales pipeline; verify operational state in the server-owned campaign workflow.</div>}
    {item.doNotContact && <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-900">Suppressed. CRM mutations are blocked and no outreach is available.</div>}

    {item.source === 'reservation_interest' && <div className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm"><p>Review and promotion stay in the reservation-interest workflow so its invitation safeguards remain authoritative.</p><Link href="/interest-inbox" className="mt-3 inline-block font-bold text-blue-700 underline">Open interest inbox</Link></div>}

    {item.source === 'quote_inquiry' && <div className="mt-5 rounded-lg border bg-slate-50 p-4 text-sm"><p>A quote request permits a response to that request only. Promotion creates an unqualified prospect and does not send a reply.</p><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy || contactGloballyBlocked || item.doNotContact || item.sourceStatus === 'dismissed'} onClick={() => void mutate({ action: 'promote_quote', inquiryId: item.recordId }, 'Quote inquiry promoted to a researching prospect. Verify the business before any manual response.')} className="rounded-lg bg-blue-700 px-3 py-2 font-bold text-white disabled:opacity-40">Promote to prospect</button><button disabled={busy || item.doNotContact || item.sourceStatus === 'dismissed'} onClick={() => void mutate({ action: 'set_quote_status', inquiryId: item.recordId, status: 'reviewed' }, 'Quote inquiry marked reviewed. No response was sent.')} className="rounded-lg border px-3 py-2 font-bold disabled:opacity-40">Mark reviewed</button><button disabled={busy || item.doNotContact || item.sourceStatus === 'dismissed'} onClick={() => void mutate({ action: 'set_quote_status', inquiryId: item.recordId, status: 'dismissed' }, 'Quote inquiry dismissed. No response was sent.')} className="rounded-lg border border-rose-300 px-3 py-2 font-bold text-rose-800 disabled:opacity-40">Dismiss</button></div></div>}

    {item.source === 'prospect' && !item.doNotContact && <>
      <section className="mt-5 border-t pt-5"><h4 className="font-black">Pipeline stage</h4><p className="mt-1 text-xs leading-5 text-slate-500">Manual prospect stages never establish a reservation or payment. Operational stages come only from server-owned workflows.</p>{['reservation', 'paid'].includes(item.stage) ? <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm font-bold text-blue-950">This stage is locked to the verified operational record.</div> : <div className="mt-3 flex gap-2"><select aria-label="New pipeline stage" value={stageDraft} disabled={contactGloballyBlocked} onChange={(event) => setStageDraft(event.target.value as CrmStageId)} className="min-w-0 flex-1 rounded-lg border px-3 py-2 text-sm disabled:bg-slate-100">{editableStages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}</select><button disabled={busy || contactGloballyBlocked || stageDraft === item.stage} onClick={() => void mutate({ action: 'set_stage', prospectId: item.recordId, stage: stageDraft }, 'Prospect stage updated. No external action was taken.')} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Save</button></div>}</section>

      {tasksEnabled ? <section id="tasks" className="mt-5 border-t pt-5"><h4 className="font-black">Next owner action</h4><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2"><label className="grid gap-1 text-xs font-bold text-slate-600">Action<select value={taskType} disabled={contactGloballyBlocked} onChange={(event) => setTaskType(event.target.value as CrmNextActionType)} className="rounded-lg border px-3 py-2 text-sm font-normal disabled:bg-slate-100">{CRM_NEXT_ACTION_TYPES.map((action) => <option key={action.id} value={action.id}>{action.label}</option>)}</select></label><label className="grid gap-1 text-xs font-bold text-slate-600">Due date<input type="date" required value={taskDate} disabled={contactGloballyBlocked} onChange={(event) => setTaskDate(event.target.value)} className="rounded-lg border px-3 py-2 text-sm font-normal disabled:bg-slate-100" /></label></div><label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">Task note<textarea rows={2} maxLength={300} value={taskNote} disabled={contactGloballyBlocked} onChange={(event) => setTaskNote(event.target.value)} className="rounded-lg border px-3 py-2 text-sm font-normal disabled:bg-slate-100" /></label>{taskType === 'prepare_sample' && <p className="mt-2 text-xs leading-5 text-slate-500">Record the verified need/source, requested California market, likely mail or partner-distribution format, route or partner-volume evidence, category fit, asset-rights basis, owner-controlled QR destination, cost unknowns, and reply permission. Scheduling this task does not send, order, publish, quote, or create a provider account.</p>}<button disabled={busy || contactGloballyBlocked || !taskDate} onClick={() => void mutate({ action: 'schedule_next_action', prospectId: item.recordId, actionType: taskType, dueDate: taskDate, note: taskNote }, 'Internal next action scheduled. Nothing was sent.')} className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Schedule internal task</button>{item.nextActionDate && <div className="mt-4 rounded-lg bg-blue-50 p-3 text-sm"><strong>Scheduled:</strong> {item.nextActionType ? humanize(item.nextActionType) : 'Owner task'} on {item.nextActionDate}{item.nextActionNote ? ` — ${item.nextActionNote}` : ''}<label className="mt-3 grid gap-1 text-xs font-bold text-slate-600">Factual completion note<textarea rows={2} maxLength={500} value={taskOutcome} disabled={contactGloballyBlocked} onChange={(event) => setTaskOutcome(event.target.value)} className="rounded-lg border bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-100" /></label><button disabled={busy || contactGloballyBlocked} onClick={() => void mutate({ action: 'complete_next_action', prospectId: item.recordId, outcome: taskOutcome }, 'Next action marked complete and added to the activity ledger.')} className="mt-2 rounded-lg border bg-white px-3 py-2 text-sm font-bold disabled:opacity-40">Mark complete</button></div>}</section> : <div className="mt-5 rounded-lg border bg-slate-50 p-3 text-sm">Next-action tasks are hidden by the owner add-on setting.</div>}

      <section className="mt-5 border-t pt-5"><h4 className="font-black">Internal note</h4><textarea aria-label="Internal CRM note" rows={3} maxLength={2000} value={activityNote} onChange={(event) => setActivityNote(event.target.value)} placeholder="Record only what is known or what actually happened." className="mt-3 w-full rounded-lg border px-3 py-2 text-sm" /><button disabled={busy || activityNote.trim().length < 2} onClick={async () => { if (await mutate({ action: 'add_note', prospectId: item.recordId, note: activityNote }, 'Internal note added to the existing activity ledger.')) setActivityNote(''); }} className="mt-2 w-full rounded-lg border px-4 py-2 text-sm font-bold disabled:opacity-40">Add factual note</button></section>

      <section className="mt-5 border-t pt-5"><div className="flex items-center justify-between"><h4 className="font-black">Recent activity</h4><Link href="/activities" className="text-xs font-bold text-blue-700 underline">Full ledger</Link></div>{activities.length ? <ul className="mt-3 divide-y">{activities.map((activity) => <li key={activity.id} className="py-3 text-sm"><div className="font-bold">{activity.description}</div><div className="mt-1 text-slate-600">{activity.outcome}</div><div className="mt-1 text-xs text-slate-400">{activity.createdAt ? new Date(activity.createdAt).toLocaleString() : 'Time unavailable'}</div></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">No activity records for this prospect.</p>}</section>
    </>}
  </>;
}

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) { return <div className={`rounded-xl border p-4 shadow-sm ${alert ? 'border-amber-200 bg-amber-50' : 'bg-white'}`}><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="mt-1 text-2xl font-black text-slate-950">{value}</div></div>; }
function OperationLink({ href, label }: { href: string; label: string }) { return <Link href={href} className="rounded-lg border bg-white px-3 py-2 text-sm font-bold text-blue-700">{label}</Link>; }
function StageButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) { return <button type="button" aria-pressed={active} onClick={onClick} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${active ? 'border-blue-700 bg-blue-700 text-white' : 'bg-white text-slate-700'}`}>{label} <span className="ml-1 opacity-75">{count}</span></button>; }
function StagePill({ stage }: { stage: CrmStageId }) { const definition = CRM_PIPELINE_STAGES.find((item) => item.id === stage); return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{definition?.label || humanize(stage)}</span>; }
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-800">{value}</dd></div>; }
function DisabledModule({ name }: { name: string }) { return <section className="mt-7 rounded-xl border border-dashed bg-white p-8 text-center text-sm text-slate-600"><strong>{name} is hidden.</strong> Re-enable it in First-party add-ons below.</section>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
function humanize(value: string) { return value ? value.replaceAll('_', ' ') : 'unknown'; }
function formatQuantity(value: string) {
  if (!value) return 'Not recorded';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toLocaleString('en-US') : value;
}
