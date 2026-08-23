import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = {
  title: 'Private business portal access | CaliforniaMailer',
  robots: { index: false, follow: false },
};

export default async function BusinessLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  return <PublicShell><section className="mx-auto max-w-2xl px-5 py-24 text-center">
    <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Passwordless private access</p>
    <h1 className="mt-3 text-4xl font-black">Business placement portal</h1>
    {reason === 'invalid' && <p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">That one-time access link is invalid, expired, already used, or revoked. Ask CaliforniaMailer for a new private link.</p>}
    {reason === 'logged-out' && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-900">This browser session has been signed out.</p>}
    <p className="mt-6 text-lg leading-8 text-slate-700">There is no shared business-wide account or reusable password. The owner manually supplies a one-time link for one specific reservation and business placement.</p>
    <div className="mt-8 rounded-2xl border bg-slate-50 p-5 text-left text-sm leading-6 text-slate-700">
      <strong>Security notes</strong>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>The access link expires and works once.</li>
        <li>The resulting browser session is private, expiring, and revocable.</li>
        <li>CaliforniaMailer does not email portal links automatically.</li>
      </ul>
    </div>
    <Link href="/founding-mailer" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white">View public campaign information</Link>
  </section></PublicShell>;
}
