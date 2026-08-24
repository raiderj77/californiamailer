import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import { DealsConsentForm } from '@/components/public/DealsConsentForm';

export const metadata: Metadata = { title: 'Monterey Peninsula Offers by Email | CaliforniaMailer', description: 'Optional, verified-consent local offers email list.', alternates: { canonical: 'https://californiamailer.com/local-deals' } };
export default function LocalDealsPage() {
  const active = process.env.CONSUMER_EMAIL_ENABLED === 'true' && Boolean(process.env.BUSINESS_POSTAL_ADDRESS);
  return <PublicShell><div className="mx-auto max-w-3xl px-5 py-20"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Optional consumer list</p><h1 className="mt-2 text-4xl font-black md:text-6xl">Get Monterey Peninsula offers by email.</h1><p className="mt-5 text-lg leading-8 text-slate-600">Expected frequency: no more than two messages per month after email verification. CaliforniaMailer does not sell subscriber contact details or give the subscriber database to advertisers. Advertisers buy placement in CaliforniaMailer communications.</p><div className="mt-8 rounded-2xl border bg-white p-6 shadow-sm">{active ? <DealsConsentForm /> : <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"><strong>The list is not active.</strong><p className="mt-2 text-sm leading-6">Signup remains closed until the owner configures a valid business postal address, sender identity, transactional delivery, suppression handling, and an explicit activation flag. No email entered here is collected.</p></div>}</div><p className="mt-6 text-sm leading-6 text-slate-500">A quote or advertiser inquiry never enrolls anyone. Read the <Link href="/privacy" className="underline">privacy policy</Link> or <Link href="/local-deals/unsubscribe" className="underline">request unsubscribe</Link>.</p></div></PublicShell>;
}
