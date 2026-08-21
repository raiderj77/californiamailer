import Link from 'next/link';
import { PublicShell } from './PublicShell';

export function RetiredPrivateLink({ title, message }: { title: string; message: string }) {
  return (
    <PublicShell>
      <section className="mx-auto max-w-3xl px-5 py-24 text-center">
        <div className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">Link not active</div>
        <h1 className="mt-4 text-4xl font-black tracking-tight">{title}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-700">{message}</p>
        <Link href="/founding-mailer" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white hover:bg-slate-800">View current campaign state</Link>
      </section>
    </PublicShell>
  );
}
