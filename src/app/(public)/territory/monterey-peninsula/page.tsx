import type { Metadata } from 'next';
import Link from 'next/link';
import { MailingAreaExplorer, type MailingAreaFallback } from '@/components/public/MailingAreaExplorer';
import { PublicShell } from '@/components/public/PublicShell';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';

export const metadata: Metadata = {
  title: 'Monterey Peninsula Mailing Area | CaliforniaMailer',
  description: 'Candidate geography and current public route-verification status for the Monterey Peninsula founding mailer.',
  alternates: { canonical: 'https://californiamailer.com/territory/monterey-peninsula' },
};

const FOUNDING_AREA_FALLBACK: MailingAreaFallback = {
  slug: 'monterey-peninsula',
  name: 'Monterey Peninsula',
  state: 'CA',
  county: 'Monterey County',
  candidateZipCodes: [],
  candidateAreas: [...FOUNDING_CAMPAIGN.candidateAreas],
  status: 'planning',
  routePlan: null,
  planningTarget: FOUNDING_CAMPAIGN.targetHouseholds,
};

export default function TerritoryPage() {
  return (
    <PublicShell>
      <section className="bg-blue-50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Founding campaign area · planning only</div>
          <h1 className="mt-3 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">Monterey Peninsula mailing area</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
            The founding campaign uses {FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString('en-US')} pieces as a planning target. That is not a verified carrier-route address count, a delivery record, or proof that a mailing is scheduled.
          </p>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600">
            This page keeps its original URL for continuity. “Mailing area” means candidate campaign geography—not a franchise, protected operator territory, or permanent exclusive market.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-14" aria-labelledby="monterey-area-status">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-3xl">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-blue-700">Live public record with safe fallback</div>
            <h2 id="monterey-area-status" className="mt-2 text-3xl font-black text-slate-950">Route-planning status</h2>
            <p className="mt-4 leading-7 text-slate-600">The public API is the authority for exact route data. If no public Monterey Peninsula record exists, this page shows only the configured founding candidate areas and planning target.</p>
          </div>
          <Link href="/mailing-areas" className="inline-flex min-h-11 items-center rounded-xl border border-blue-300 bg-white px-5 py-2 font-black text-blue-900 hover:border-blue-500">Explore all mailing areas</Link>
        </div>
        <div className="mt-8">
          <MailingAreaExplorer filterSlug="monterey-peninsula" fallbackArea={FOUNDING_AREA_FALLBACK} showSearch={false} />
        </div>
      </section>
    </PublicShell>
  );
}
