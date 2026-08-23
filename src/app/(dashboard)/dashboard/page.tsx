'use client';

import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import { getProspects, type Prospect } from '@/lib/firestore';
import { contactGate } from '@/lib/prospectRules';
import { isRecordSuppressed } from '@/lib/suppression';
import { getProspectContactBarrier } from '@/lib/prospectSuppressionClient';
import { formatCurrency } from '@/config/foundingCampaign';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface OwnerCampaign {
  campaign: { status: string; published: boolean; paymentActivation: boolean; economicsVerified: boolean; routesConfirmed: boolean; artworkPreflightApproved: boolean; ownerPrintApproved: boolean; clearedFundingCents: number; fundingGoalCents: number; placements: Record<string, { available: number; held: number; sold: number }>; categories: Array<{ status: string }> };
  paidAdvertiserCount: number; paidReservationCount: number; outstandingPaymentCount: number; recentFormSubmissionCount: number; refundObligationCents: number;
  proofStatusCounts: Record<string, number>; recentPayments: Array<{ id: string; status: string; amountCents: number; updatedAt: string | null }>;
  readiness: { ready: boolean; checks: Array<{ key: string; label: string; passed: boolean; detail: string }> };
}

export default function DashboardPage() {
  const { user, loading, logout } = useAuth();
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [campaign, setCampaign] = useState<OwnerCampaign | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [contactGloballyBlocked, setContactGloballyBlocked] = useState(true);
  const load = useCallback(async () => {
    if (!user) return;
    const nextErrors: string[] = [];
    try {
      const [records, barrier] = await Promise.all([
        getProspects(user.uid),
        getProspectContactBarrier(await user.getIdToken()),
      ]);
      setProspects(records);
      setContactGloballyBlocked(barrier.contactBlocked);
    } catch {
      setContactGloballyBlocked(true);
      nextErrors.push('Prospect database or suppression state could not be read; contact queues remain blocked.');
    }
    try {
      const response = await fetch('/api/admin/campaigns/founding/economics', { headers: { Authorization: `Bearer ${await user.getIdToken()}` } });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setCampaign(data);
    } catch (caught) { nextErrors.push(caught instanceof Error ? caught.message : 'Campaign operations could not be read.'); }
    setErrors(nextErrors);
  }, [user]);
  useEffect(() => { void load(); }, [load]);
  const today = new Date().toISOString().slice(0, 10);
  const followUps = useMemo(() => contactGloballyBlocked ? [] : prospects.filter((item) => item.nextFollowUpDate && item.nextFollowUpDate <= today && !isRecordSuppressed(item))
    .sort((a, b) => String(a.nextFollowUpDate).localeCompare(String(b.nextFollowUpDate))).slice(0, 8), [contactGloballyBlocked, prospects, today]);
  const ready = contactGloballyBlocked ? 0 : prospects.filter((item) => item.status === 'ready_to_contact' && contactGate(item).allowed).length;
  const activeCategories = campaign?.campaign.categories.filter((item) => ['held', 'sold'].includes(item.status)).length;
  const availablePlacements = Object.values(campaign?.campaign.placements || {}).reduce((total, item) => total + Number(item.available || 0), 0);
  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;
  return <div className="min-h-screen bg-slate-50 md:flex"><Sidebar /><main className="min-w-0 flex-1 p-4 md:p-8"><header className="mb-7 flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Single-owner control room</p><h1 className="text-3xl font-black">Founding campaign dashboard</h1></div><div className="flex gap-2"><button onClick={() => void load()} className="rounded-lg border px-3 py-2 text-sm font-bold">Refresh verified state</button><button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button></div></header>
    {errors.length > 0 && <div className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"><strong>System attention required</strong><ul className="mt-2 list-disc pl-5">{errors.map((error) => <li key={error}>{error}</li>)}</ul><p className="mt-2">Missing data is unknown—not zero and not a pass.</p></div>}
    {contactGloballyBlocked && <div role="alert" className="mb-5 rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm font-bold text-rose-900">Sales follow-ups and ready-to-contact counts are hidden because unresolved suppression propagation globally blocks contact.</div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Campaign status" value={campaign?.campaign.status?.replaceAll('_', ' ') || 'Unknown'} /><Stat label="Cleared / goal" value={campaign ? `${formatCurrency(campaign.campaign.clearedFundingCents)} / ${formatCurrency(campaign.campaign.fundingGoalCents)}` : 'Unknown'} /><Stat label="Paid slot-units" value={String(campaign?.paidReservationCount ?? 'Unknown')} /><Stat label="Available slot-units" value={campaign ? String(availablePlacements) : 'Unknown'} /><Stat label="Refund obligations" value={campaign ? formatCurrency(campaign.refundObligationCents) : 'Unknown'} /></div>
    <section className="mt-7 grid gap-6 xl:grid-cols-[1fr_380px]"><div className="rounded-xl border bg-white p-6 shadow-sm"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Today’s faceless sales queue</h2><Link href="/sales-desk" className="text-sm font-bold text-blue-700 underline">Open copy desk</Link></div><div className="mt-5 grid gap-3 sm:grid-cols-3"><Mini label="Qualified and ready" value={ready} /><Mini label="Follow-ups due" value={followUps.length} /><Mini label="Interest submissions" value={campaign ? campaign.recentFormSubmissionCount : 'Unknown'} /></div>{followUps.length ? <ul className="mt-5 divide-y">{followUps.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><strong>{item.businessName}</strong><div className="text-sm text-slate-500">{item.status.replaceAll('_', ' ')} · {item.businessCategory || 'category unverified'}</div></div><div className="text-sm"><span className="mr-3 text-slate-500">Due {item.nextFollowUpDate}</span><Link href="/prospects" className="font-bold text-blue-700 underline">Review</Link></div></li>)}</ul> : <p className="mt-5 rounded-lg bg-slate-50 p-4 text-sm text-slate-500">{prospects.length ? 'No due follow-ups in the readable prospect records.' : 'Prospect state is empty or unavailable.'} This does not mean outreach should start; first add and qualify real businesses.</p>}</div>
      <aside className="rounded-xl border bg-white p-6 shadow-sm"><h2 className="text-xl font-black">Operational truth</h2><Truth label="Owner session" pass text="Verified server-side for this page" /><Truth label="Public campaign record" pass={Boolean(campaign?.campaign.published)} text={campaign?.campaign.published ? 'Published from sanitized database state' : 'Not published'} /><Truth label="Online checkout" pass={false} text={campaign?.campaign.paymentActivation ? 'Activation flag on—review immediately' : 'Off'} /><Truth label="Economics" pass={Boolean(campaign?.campaign.economicsVerified)} text={campaign?.campaign.economicsVerified ? 'Current costs, margin, and owner-surplus target pass' : 'Not verified'} /><Truth label="Routes" pass={Boolean(campaign?.campaign.routesConfirmed)} text={campaign?.campaign.routesConfirmed ? 'Marked confirmed with source inputs' : 'Not confirmed'} /><Truth label="Print readiness" pass={Boolean(campaign?.campaign.ownerPrintApproved && campaign?.readiness.ready)} text={campaign?.readiness.ready ? 'All gates pass' : 'Blocked'} /><Truth label="Outreach sender" pass text="Copy-only; this app sent 0 messages" /></aside></section>
    <section className="mt-7 grid gap-6 lg:grid-cols-3"><Panel title="Inventory and payment"><Row label="Active held/sold categories" value={activeCategories === undefined ? 'Unknown' : String(activeCategories)} /><Row label="Outstanding holds/payments" value={String(campaign?.outstandingPaymentCount ?? 'Unknown')} /><Row label="Recent ledger entries" value={String(campaign?.recentPayments.length ?? 'Unknown')} /><Link href="/launch" className="mt-4 inline-block font-bold text-blue-700 underline">Campaign launch controls</Link></Panel><Panel title="Proof state">{!campaign ? <p className="text-sm text-slate-500">Proof state is unknown because campaign operations could not be read.</p> : Object.keys(campaign.proofStatusCounts).length ? Object.entries(campaign.proofStatusCounts).map(([key, value]) => <Row key={key} label={key.replaceAll('_', ' ')} value={String(value)} />) : <p className="text-sm text-slate-500">No proof records exist. Every paid slot-unit requires versioned materials and approval before print readiness.</p>}<Link href="/economics" className="mt-4 inline-block font-bold text-blue-700 underline">View every print gate</Link></Panel><Panel title="Owner next actions"><ol className="list-decimal space-y-2 pl-5 text-sm leading-6"><li>Compare fill and cost scenarios in the mailer calculator.</li><li>Enter route evidence and a current signed-in vendor quote.</li><li>Build a small manually verified advertiser list.</li><li>Obtain legal review and a business postal address.</li><li>Activate payments only after a separate owner decision.</li></ol></Panel></section>
  </main></div>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border bg-white p-4 shadow-sm"><div className="text-xl font-black capitalize">{value}</div><div className="text-xs text-slate-500">{label}</div></div>; }
function Mini({ label, value }: { label: string; value: number | string }) { return <div className="rounded-lg bg-slate-50 p-4"><div className="text-2xl font-black">{value}</div><div className="text-xs text-slate-500">{label}</div></div>; }
function Truth({ label, text, pass }: { label: string; text: string; pass: boolean }) { return <div className="mt-4 flex gap-3 text-sm"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${pass ? 'bg-emerald-500' : 'bg-amber-500'}`} /><div><strong>{label}</strong><p className="text-slate-500">{text}</p></div></div>; }
function Panel({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-xl border bg-white p-6"><h2 className="text-lg font-black">{title}</h2><div className="mt-4">{children}</div></div>; }
function Row({ label, value }: { label: string; value: string }) { return <div className="flex justify-between gap-3 border-b py-2 text-sm"><span className="capitalize text-slate-500">{label}</span><strong>{value}</strong></div>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
