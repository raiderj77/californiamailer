import type { Metadata } from 'next';
import { CampaignBoard } from '@/components/public/CampaignBoard';
import { PublicShell } from '@/components/public/PublicShell';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'Current Mailer Board | CaliforniaMailer',
  description: 'Published campaign, inventory, category, and cleared-funding state for CaliforniaMailer.',
  alternates: { canonical: 'https://californiamailer.com/coop-board' },
};

export default async function CoopBoardPage() {
  const priceVisibility = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <section className="bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">Database-backed campaign board</div>
          <h1 className="mt-3 text-4xl font-black text-white md:text-5xl">Current mailers</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            Published records show real campaign state. If no record is published, the board says so and shows only a clearly labeled configuration preview.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <CampaignBoard priceVisibility={priceVisibility} />
      </section>
    </PublicShell>
  );
}
