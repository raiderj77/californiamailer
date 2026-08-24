import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = { title: 'Contact | CaliforniaMailer', description: 'Contact the owner-managed CaliforniaMailer project.', alternates: { canonical: 'https://californiamailer.com/contact' } };

export default function ContactPage() {
  return <PublicShell><section className="mx-auto max-w-4xl px-5 py-20"><h1 className="text-4xl font-black tracking-tight md:text-6xl">Contact CaliforniaMailer</h1><p className="mt-5 max-w-2xl text-lg leading-8 text-slate-700">Submit a focused campaign-planning inquiry for manual review. No reply or response time is guaranteed, and no public mailbox is represented as verified.</p><div className="mt-10 rounded-3xl border border-slate-200 bg-slate-50 p-7"><h2 className="text-xl font-black">Before commercial outreach begins</h2><p className="mt-3 leading-7 text-slate-600">A valid business postal address, responsible sender identity, and tested public reply channel still need to be configured. CaliforniaMailer will not use the faceless outreach templates until those compliance details are present.</p></div><Link href="/quote" className="mt-8 inline-block rounded-full bg-blue-700 px-6 py-3 font-black text-white hover:bg-blue-800">Submit a planning inquiry</Link></section></PublicShell>;
}
