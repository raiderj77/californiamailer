import type { Metadata } from 'next';
import { PublicShell } from '@/components/public/PublicShell';

export const metadata: Metadata = { title: 'About | CaliforniaMailer', description: 'CaliforniaMailer is an owner-managed direct-mail project preparing its first local campaign.', alternates: { canonical: 'https://californiamailer.com/about' } };

export default function AboutPage() {
  return <PublicShell><section className="mx-auto max-w-4xl px-5 py-20"><div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">About CaliforniaMailer</div><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">Owner-managed from first contact through delivery records.</h1><div className="mt-8 space-y-5 text-lg leading-8 text-slate-700"><p>CaliforniaMailer is preparing its first pre-funded cooperative mailer for the Monterey Peninsula. The service is intentionally built for one owner: direct communication, a visible campaign state, written approvals, and no implied staff or operating history.</p><p>The founding campaign is a validation project. CaliforniaMailer does not claim prior campaign results, advertiser counts, awards, partnerships, reviews, or response statistics.</p><p>Advertisers can complete the process asynchronously. “Faceless” means no meeting or on-camera pitch is required; it does not hide who is responsible for the service.</p></div></section></PublicShell>;
}
