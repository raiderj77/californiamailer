import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';
import { DealsConsentForm } from '@/components/public/DealsConsentForm';

export const metadata: Metadata = { title: 'Unsubscribe | CaliforniaMailer', robots: { index: false, follow: false } };
export default function UnsubscribePage() { const active = process.env.CONSUMER_EMAIL_ENABLED === 'true' && Boolean(process.env.BUSINESS_POSTAL_ADDRESS); return <PublicShell><div className="mx-auto max-w-xl px-5 py-20"><h1 className="text-4xl font-black">Unsubscribe from local deals</h1><p className="mt-4 leading-7 text-slate-600">For privacy, enter the subscribed address and confirm the six-digit code sent to it.</p><div className="mt-7 rounded-2xl border bg-white p-6">{active ? <DealsConsentForm mode="unsubscribe" /> : <p className="rounded-lg bg-amber-50 p-4 text-amber-900">The list is not active. Email hello@californiamailer.com for a suppression request.</p>}</div></div></PublicShell>; }
