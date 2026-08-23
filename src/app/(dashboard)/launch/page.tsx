'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { FOUNDING_CAMPAIGN, FOUNDING_INVENTORY_GROSS_CENTS, formatCurrency } from '@/config/foundingCampaign';

interface CampaignState {
  id: string;
  status: string;
  published: boolean;
  paymentActivation: boolean;
  economicsVerified: boolean;
  routesConfirmed: boolean;
  clearedFundingCents: number;
  printReadyAt: string | null;
  printScheduleReference: string | null;
  printedEvidenceReference: string | null;
  deliveredEvidenceReference: string | null;
  activationBlockers: string[];
}

type CampaignAction = 'initialize' | 'publish' | 'unpublish' | 'activate_reservations' | 'deactivate_reservations'
  | 'begin_proofing' | 'schedule_for_print' | 'record_printed' | 'record_delivered'
  | 'complete_campaign' | 'cancel_campaign' | 'close_cancelled';

export default function LaunchPage() {
  const { user, loading, signInWithGoogle, logout } = useAuth();
  const [campaign, setCampaign] = useState<CampaignState | null | undefined>(undefined);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [activationConfirmation, setActivationConfirmation] = useState('');
  const [lifecycleConfirmation, setLifecycleConfirmation] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [occurredOn, setOccurredOn] = useState('');

  const callApi = useCallback(async (action?: CampaignAction, confirmation = '', extra: Record<string, string> = {}) => {
    if (!user) return;
    const token = await user.getIdToken();
    const response = await fetch('/api/admin/campaigns/founding', {
      method: action ? 'POST' : 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(action ? { 'Content-Type': 'application/json' } : {}),
      },
      body: action ? JSON.stringify({ action, confirmation, ...extra }) : undefined,
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Campaign request failed.');
    return result;
  }, [user]);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const result = await callApi();
      setCampaign(result.campaign);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Campaign request failed.');
      setCampaign(null);
    }
  }, [callApi, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: CampaignAction) {
    const prompt = action === 'initialize'
      ? 'Create the real pre-launch campaign with zero funding and paused categories?'
      : action === 'publish'
        ? 'Publish the sanitized current campaign state?'
        : action === 'unpublish'
          ? 'Remove the public campaign record?'
          : action === 'activate_reservations'
            ? 'Enable owner-invited hosted checkout? This can accept real money if production Stripe credentials are configured.'
            : action === 'deactivate_reservations'
              ? 'Disable new holds and checkout? Existing provider records will remain.'
              : action === 'cancel_campaign'
                ? 'Cancel this campaign and record any uncovered refund obligations? This does not submit refunds to the provider.'
                : `Record the ${action.replaceAll('_', ' ')} lifecycle change? No vendor order, message, or provider action will occur.`;
    if (!window.confirm(prompt)) return;
    setBusy(true);
    setMessage('');
    try {
      const typedConfirmation = action === 'activate_reservations' ? activationConfirmation
        : ['initialize', 'publish', 'unpublish', 'deactivate_reservations'].includes(action) ? '' : lifecycleConfirmation;
      await callApi(action, typedConfirmation, { evidenceReference, occurredOn });
      setMessage(action === 'initialize' ? 'Campaign initialized.' : action === 'publish' ? 'Campaign published.' : action === 'unpublish' ? 'Campaign unpublished.' : action === 'activate_reservations' ? 'Owner-invited checkout activated.' : action === 'deactivate_reservations' ? 'New checkout disabled.' : 'Campaign lifecycle record updated. No external action occurred.');
      if (action === 'activate_reservations') setActivationConfirmation('');
      if (!['initialize', 'publish', 'unpublish', 'activate_reservations', 'deactivate_reservations'].includes(action)) {
        setLifecycleConfirmation(''); setEvidenceReference(''); setOccurredOn('');
      }
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Campaign action failed.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="min-h-screen p-8">Loading…</div>;
  if (!user) return <div className="flex min-h-screen items-center justify-center bg-slate-50"><div className="text-center"><h1 className="text-3xl font-black">Owner sign-in</h1><button onClick={signInWithGoogle} className="mt-6 rounded-full bg-blue-700 px-6 py-3 font-bold text-white">Sign in with Google</button></div></div>;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-6 md:p-10">
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Founding launch control</div><h1 className="mt-2 text-3xl font-black">Monterey Peninsula campaign</h1></div><button onClick={logout} className="text-sm font-bold text-slate-600">Sign out</button></header>

          {message && <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-bold" role="status">{message}</div>}

          <div className="mt-8 grid gap-5 md:grid-cols-4">
            <Stat label="Database state" value={campaign === undefined ? 'Checking' : campaign ? campaign.status : 'Not initialized'} />
            <Stat label="Public record" value={campaign?.published ? 'Published' : 'Not published'} />
            <Stat label="Cleared funding" value={campaign ? formatCurrency(campaign.clearedFundingCents) : 'Unknown'} />
            <Stat label="Payment activation" value={campaign?.paymentActivation ? 'Active' : 'Off'} />
          </div>

          <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-black">Safe actions</h2>
            <p className="mt-3 max-w-3xl leading-7 text-slate-600">Initialization writes one versioned real pre-launch campaign, 24 equal slot units, zero funding, and paused categories. The requested 9 × 12 layout is experimental and remains blocked on a physical template and combined-artwork preflight. Publishing exposes only the sanitized campaign projection. Neither action enables payment, sends email, or authorizes print.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              {!campaign && <button disabled={busy} onClick={() => void act('initialize')} className="rounded-full bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">Initialize real pre-launch record</button>}
              {campaign && !campaign.published && <button disabled={busy} onClick={() => void act('publish')} className="rounded-full bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">Publish sanitized pre-launch state</button>}
              {campaign?.published && <button disabled={busy} onClick={() => void act('unpublish')} className="rounded-full border border-red-300 px-5 py-3 font-bold text-red-800 disabled:opacity-50">Unpublish</button>}
            </div>
          </section>

          {campaign && <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-black">Reservation and checkout activation</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">Public submissions remain interest-only until the server finds every prerequisite and the owner types the exact confirmation. Even after activation, a reviewed single-use invitation is required to consume inventory.</p>
            {campaign.activationBlockers.length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><strong>Blocked by:</strong><ul className="mt-2 list-disc pl-5 text-sm">{campaign.activationBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}
            {campaign.paymentActivation ? <button disabled={busy} onClick={() => void act('deactivate_reservations')} className="mt-5 rounded-lg border border-rose-300 px-5 py-3 font-bold text-rose-800">Disable new checkout</button> : <><label className="mt-5 block max-w-xl text-sm font-bold">Type ACTIVATE CAMPAIGN CHECKOUT<input value={activationConfirmation} onChange={(event) => setActivationConfirmation(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label><button disabled={busy || campaign.activationBlockers.length > 0 || activationConfirmation !== 'ACTIVATE CAMPAIGN CHECKOUT'} onClick={() => void act('activate_reservations')} className="mt-3 rounded-lg bg-rose-700 px-5 py-3 font-bold text-white disabled:opacity-30">Activate owner-invited checkout</button></>}
          </section>}

          {campaign && <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-7">
            <h2 className="text-2xl font-black">Audited campaign lifecycle</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">These controls record owner-supplied evidence after work happens elsewhere. They do not order printing, buy postage, contact a vendor, or infer delivery. Scheduling remains blocked until the complete print-readiness gate is approved.</p>
            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              <label className="text-sm font-bold">Exact confirmation<input value={lifecycleConfirmation} onChange={(event) => setLifecycleConfirmation(event.target.value)} placeholder={lifecyclePhrase(campaign.status)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
              <label className="text-sm font-bold">External evidence/reference<input value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} placeholder="Required for schedule, print, and delivery" className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
              <label className="text-sm font-bold">Actual occurrence date<input type="date" max={new Date().toISOString().slice(0, 10)} value={occurredOn} onChange={(event) => setOccurredOn(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" /></label>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              {campaign.status === 'fully_funded' && <button disabled={busy || lifecycleConfirmation !== 'BEGIN PROOFING'} onClick={() => void act('begin_proofing')} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-30">Close checkout and begin proofing</button>}
              {campaign.status === 'proofing' && <button disabled={busy || !campaign.printReadyAt || lifecycleConfirmation !== 'RECORD PRINT SCHEDULE' || evidenceReference.trim().length < 5} onClick={() => void act('schedule_for_print')} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-30">Record external print schedule</button>}
              {campaign.status === 'scheduled_for_print' && <button disabled={busy || lifecycleConfirmation !== 'RECORD PRINTED' || evidenceReference.trim().length < 5 || !occurredOn} onClick={() => void act('record_printed')} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-30">Record printed evidence</button>}
              {campaign.status === 'printed' && <button disabled={busy || lifecycleConfirmation !== 'RECORD DELIVERED' || evidenceReference.trim().length < 5 || !occurredOn} onClick={() => void act('record_delivered')} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-30">Record delivery evidence</button>}
              {campaign.status === 'delivered' && <button disabled={busy || lifecycleConfirmation !== 'COMPLETE CAMPAIGN'} onClick={() => void act('complete_campaign')} className="rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-30">Complete campaign</button>}
              {campaign.status === 'refunding' && <button disabled={busy || lifecycleConfirmation !== 'CLOSE CANCELLED CAMPAIGN'} onClick={() => void act('close_cancelled')} className="rounded-lg bg-slate-950 px-5 py-3 font-bold text-white disabled:opacity-30">Close after confirmed refunds</button>}
            </div>
            {campaign.status === 'proofing' && !campaign.printReadyAt && <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">Print scheduling is blocked: approve every readiness check in Costs &amp; Print Gate first.</p>}
            <dl className="mt-5 grid gap-3 text-sm md:grid-cols-3"><Evidence label="Print schedule" value={campaign.printScheduleReference} /><Evidence label="Printed" value={campaign.printedEvidenceReference} /><Evidence label="Delivered" value={campaign.deliveredEvidenceReference} /></dl>
          </section>}

          {campaign && ['pre_launch', 'accepting_reservations', 'partially_funded', 'fully_funded', 'proofing'].includes(campaign.status) && <section className="mt-8 rounded-3xl border border-rose-200 bg-rose-50 p-7">
            <h2 className="text-2xl font-black text-rose-950">Cancellation and refund obligations</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-rose-950">Type <strong>CANCEL AND RECORD REFUNDS</strong> above to close new checkout and create ledger obligations for uncovered cleared payments. The app will not submit provider refunds. Disputed or manual-review payments block cancellation until resolved.</p>
            <button disabled={busy || lifecycleConfirmation !== 'CANCEL AND RECORD REFUNDS'} onClick={() => void act('cancel_campaign')} className="mt-4 rounded-lg bg-rose-800 px-5 py-3 font-bold text-white disabled:opacity-30">Cancel and record obligations</button>
          </section>}

          <section className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7">
            <h2 className="text-2xl font-black">Economics warning</h2>
            <p className="mt-3 leading-7 text-slate-700">Maximum proposed inventory is {formatCurrency(FOUNDING_INVENTORY_GROSS_CENTS)} against a {formatCurrency(FOUNDING_CAMPAIGN.fundingGoalCents)} funding gate. Economics verified: <strong>{campaign?.economicsVerified ? 'yes' : 'no'}</strong>. Routes confirmed: <strong>{campaign?.routesConfirmed ? 'yes' : 'no'}</strong>. Activation stays blocked until current non-draft policies, provider credentials, address, deadline, routes, economics, and the exact owner confirmation all pass.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-5"><div className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</div><div className="mt-2 text-xl font-black">{value}</div></div>; }
function Evidence({ label, value }: { label: string; value: string | null }) { return <div className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words">{value || 'Not recorded'}</dd></div>; }
function lifecyclePhrase(status: string) {
  if (status === 'fully_funded') return 'BEGIN PROOFING';
  if (status === 'proofing') return 'RECORD PRINT SCHEDULE';
  if (status === 'scheduled_for_print') return 'RECORD PRINTED';
  if (status === 'printed') return 'RECORD DELIVERED';
  if (status === 'delivered') return 'COMPLETE CAMPAIGN';
  if (status === 'refunding') return 'CLOSE CANCELLED CAMPAIGN';
  return 'CANCEL AND RECORD REFUNDS';
}
