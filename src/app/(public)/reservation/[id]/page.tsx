import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { ReservationProductionPanel } from '@/components/reservation/ReservationProductionPanel';
import { formatCurrency, humanizeStatus } from '@/config/foundingCampaign';
import { reservationCookieName, verifyReservationAccess } from '@/lib/reservationAuth';

export const metadata: Metadata = { title: 'Private reservation | CaliforniaMailer', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(reservationCookieName(id))?.value;
  let reservation: Record<string, unknown> | null = null;
  try { reservation = (await verifyReservationAccess(id, token))?.data as Record<string, unknown> || null; } catch { reservation = null; }

  if (!reservation) {
    return <PublicShell><section className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Private reservation unavailable</h1><p className="mt-5 text-lg leading-8 text-slate-700">The secure browser session is missing, expired, or the campaign database is unavailable. No payment or category state is inferred.</p><Link href="/founding-mailer" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white">View public campaign</Link></section></PublicShell>;
  }

  const status = String(reservation.status || 'unknown');
  return <PublicShell><section className="mx-auto max-w-3xl px-5 py-20"><div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Private reservation</div><h1 className="mt-3 text-4xl font-black">{String(reservation.publicReference)}</h1><div className="mt-8 rounded-3xl border border-slate-200 p-7"><dl className="space-y-4"><Row label="Business" value={String(reservation.businessName)} /><Row label="Category" value={String(reservation.categorySlug)} /><Row label="Placement" value={String(reservation.placementSize)} /><Row label="Stored price" value={formatCurrency(Number(reservation.quotedPriceCents || 0))} /><Row label="Status" value={humanizeStatus(status)} /><Row label="Hold expires" value={reservation.holdExpiresAt && typeof reservation.holdExpiresAt === 'object' && 'toDate' in reservation.holdExpiresAt ? (reservation.holdExpiresAt as { toDate: () => Date }).toDate().toLocaleString() : 'Not available'} /></dl><div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-950">A hold or returned checkout is not proof of cleared payment. Only the provider-verified payment ledger can change this status to paid and move public funding.</div></div><ReservationProductionPanel reservationId={id} status={status} /></section></PublicShell>;
}

function Row({ label, value }: { label: string; value: string }) { return <div className="flex flex-wrap justify-between gap-3 border-b border-slate-100 pb-3"><dt className="text-slate-500">{label}</dt><dd className="font-black">{value}</dd></div>; }
