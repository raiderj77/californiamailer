import type { Metadata } from 'next';
import { CampaignBoard } from '@/components/public/CampaignBoard';
import { PublicShell } from '@/components/public/PublicShell';
import { getPublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'Monterey Peninsula Founding Mailer | CaliforniaMailer',
  description: 'Campaign status, proposed placement inventory, funding rule, category state, and delivery assumptions.',
  alternates: { canonical: 'https://californiamailer.com/founding-mailer' },
};

export default async function FoundingMailerPage() {
  const priceVisibility = await getPublicPlanningPriceVisibility();
  return (
    <PublicShell>
      <section className="bg-blue-50 px-5 py-16">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">First validation campaign</div>
          <h1 className="mt-3 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">Monterey Peninsula founding mailer</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-700">
            One compact territory, approximately 5,000 target residences, and no print spending before the campaign clears every funding and production gate.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-5 py-12">
        <CampaignBoard priceVisibility={priceVisibility} />
      </section>
    </PublicShell>
  );
}
