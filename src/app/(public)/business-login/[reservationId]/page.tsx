import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { reservationCookieName, verifyReservationAccess } from '@/lib/reservationAuth';
import LogoutButton from './LogoutButton';

export const metadata: Metadata = {
  title: 'Private portal ready | CaliforniaMailer',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function BusinessPortalAccessPage({
  params,
}: {
  params: Promise<{ reservationId: string }>;
}) {
  const { reservationId } = await params;
  const token = (await cookies()).get(reservationCookieName(reservationId))?.value;
  let access = null;
  try {
    access = await verifyReservationAccess(reservationId, token);
  } catch {
    access = null;
  }

  if (!access) {
    return <PublicShell><section className="mx-auto max-w-2xl px-5 py-24 text-center">
      <h1 className="text-4xl font-black">Private access unavailable</h1>
      <p className="mt-5 text-lg leading-8 text-slate-700">This reservation-scoped session is missing, expired, or revoked. No reservation or payment state is inferred.</p>
      <Link href="/business-login" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white">Business portal access help</Link>
    </section></PublicShell>;
  }

  const reservation = access.data;
  return <PublicShell><section className="mx-auto max-w-2xl px-5 py-20">
    <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Reservation-scoped access ready</p>
    <h1 className="mt-3 text-4xl font-black">{text(reservation.businessName) || 'Business placement'}</h1>
    <div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">
      <dl className="grid gap-4 text-sm sm:grid-cols-2">
        <Detail label="Private reference" value={text(reservation.publicReference) || 'Not recorded'} />
        <Detail label="Category" value={humanize(text(reservation.categorySlug))} />
        <Detail label="Placement" value={humanize(text(reservation.placementSize))} />
        <Detail label="Reservation status" value={humanize(text(reservation.status))} />
      </dl>
      <p className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">This portal belongs only to this reservation and business placement. It is not a shared business-wide account.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/reservation/${reservationId}`} className="rounded-lg bg-blue-700 px-5 py-3 font-black text-white">Open private reservation portal</Link>
        <LogoutButton reservationId={reservationId} />
      </div>
    </div>
  </section></PublicShell>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-900">{value}</dd></div>;
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function humanize(value: string) {
  return value ? value.replaceAll('_', ' ') : 'Not recorded';
}
