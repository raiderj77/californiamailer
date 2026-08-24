import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import {
  EDDM_MAIL_PIECES,
  MINI_COOP_MAIL_PIECES,
  PRINTING4SUPERCHEAP,
  TARGETED_MAIL_PIECES,
  USPS_EDDM_RETAIL,
} from '@/config/eddmOfferings';
import { FOUNDING_CAMPAIGN } from '@/config/foundingCampaign';
import {
  SHARED_MAILER_MODELS,
  type SharedMailerModel,
} from '@/config/sharedMailerModels';
import {
  getPublicPlanningPriceVisibility,
  type PublicModelPriceVisibility,
} from '@/lib/publicPlanningPriceVisibility';

export const metadata: Metadata = {
  title: 'Direct Mail Planning Prices & Quote Options | CaliforniaMailer',
  description: 'An experimental shared-mailer planning price plus model-specific, quote-only shared, EDDM, and addressed-mail options.',
  alternates: { canonical: 'https://californiamailer.com/pricing' },
};

// Supplier-age safeguards are time-dependent. Rendering this page dynamically
// prevents a build-time "as of" date from keeping an expired planning price
// visible until the next deployment.
export const dynamic = 'force-dynamic';

const activeModel = SHARED_MAILER_MODELS.find((model) => model.id === FOUNDING_CAMPAIGN.planId)
  ?? SHARED_MAILER_MODELS[0];

export default async function PricingPage() {
  const publicPrices = await getPublicPlanningPriceVisibility();
  const planningPriceVisibility = new Map(publicPrices.models.map((model) => [
    model.modelId,
    model,
  ]));
  const activePriceVisibility = planningPriceVisibility.get(activeModel.id) ?? publicPrices.active;
  const activePriceSupported = activePriceVisibility.supported;
  const activeUnitPrice = activePriceVisibility.customerUnitPriceLabel;
  const activeFundingGoal = activePriceVisibility.derivedFundingGoalLabel;

  return (
    <PublicShell>
      <section className="bg-slate-950 px-5 py-16 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-300">Planning prices · checkout disabled</div>
          <h1 className="mt-3 max-w-5xl text-4xl font-black text-white md:text-6xl">Dated 9 × 12 planning scenarios. Every other format is quote-only.</h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-300">
            {publicPrices.supportedCount.toLocaleString('en-US')} stored planning {publicPrices.supportedCount === 1 ? 'price currently clears' : 'prices currently clear'} the configured supplier-age, $2,500 pre-income-tax surplus, and 20% economic-margin safeguards. These are not active checkout prices or claims about results. Every other format keeps its own layout, audience, mailing method, and cost boundary.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <nav aria-label="Pricing page sections" className="mb-10 flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold">
          <a href="#active-plan" className="rounded-full bg-white px-4 py-2 text-blue-800 shadow-sm hover:bg-blue-50">Active plan</a>
          <a href="#shared-model-catalog" className="rounded-full bg-white px-4 py-2 text-blue-800 shadow-sm hover:bg-blue-50">Shared formats</a>
          <a href="#quote-only-options" className="rounded-full bg-white px-4 py-2 text-blue-800 shadow-sm hover:bg-blue-50">Single and partner mailers</a>
          <a href="#quote-basis" className="rounded-full bg-white px-4 py-2 text-blue-800 shadow-sm hover:bg-blue-50">Supplier and USPS basis</a>
          <Link href="/quote" className="rounded-full bg-blue-700 px-4 py-2 text-white shadow-sm hover:bg-blue-800">Request a quote</Link>
        </nav>
        <div id="active-plan" className="scroll-mt-6">
          <div className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Active configuration preview</div>
          <h2 className="mt-2 text-3xl font-black text-slate-950">Experimental 9 × 12 founding mailer</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-600">
            Plan <code>{FOUNDING_CAMPAIGN.planId}</code> on model version <code>{FOUNDING_CAMPAIGN.offerModelVersion}</code>. All values remain inactive until the physical layout, current quote, routes, policies, and complete campaign economics are approved.
          </p>
        </div>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <PlanStat label="Format" value="9 × 12 · 14 pt" />
          <PlanStat label="Planning quantity" value={`${FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} pieces`} />
          <PlanStat label="Equal slot-units" value={FOUNDING_CAMPAIGN.placements.standard.count.toLocaleString()} />
          <PlanStat label="Proposed per paid unit" value={activeUnitPrice} />
          <PlanStat label="Full funding goal" value={activeFundingGoal} />
        </dl>
        <div className="mt-8 rounded-3xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-2xl font-black text-amber-950">The 24-unit layout is not production-proven</h2>
          <p className="mt-4 leading-7 text-slate-700">
            High Response Marketing guidance describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15. The requested 24 equal units on a 9 × 12 therefore require a real physical template with postal indicia and address space, branding, disclosures, bleed, safe areas, and readable advertiser content. Catalog data and favorable economics cannot authorize payment or print.
          </p>
          <p className="mt-4 text-sm leading-6 text-amber-950">
            {activePriceSupported
              ? <>Checkout is disabled. The proposed {activeUnitPrice} unit price and {activeFundingGoal} full funding goal are planning-only and must be rechecked by {activePriceVisibility.recheckBy ?? 'the next quote'}.</>
              : <>Checkout is disabled. The stored unit price and funding goal are withheld because the dated supplier and safeguard check is no longer current. A new signed-in supplier total and written quote are required.</>}
          </p>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-blue-200 bg-blue-50 p-7">
            <h2 className="text-xl font-black text-slate-950">Fixed-surplus planning</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">The dated 5,000- and 10,000-piece 9 × 12 prices are evaluated against a $2,500 pre-income-tax economic-surplus floor after the configured supplier subtotal, processing, reserves, tax contingency, design allowance, owner-labor value, and other planning costs.</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-7">
            <h2 className="text-xl font-black text-slate-950">Same-margin planning</h2>
            <p className="mt-3 text-sm leading-6 text-slate-700">A larger mailing can clear the same $2,500 floor at a lower economic margin. Matching the active 5,000-piece model’s economic margin is a separate, stricter calculator goal and usually requires a different unit price. Neither method authorizes a quote or order.</p>
          </div>
        </div>

        <section className="mt-16" aria-labelledby="shared-model-catalog">
          <div className="max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Cross-format catalog</div>
            <h2 id="shared-model-catalog" className="mt-2 text-3xl font-black text-slate-950">Shared-mailer families keep separate rules</h2>
            <p className="mt-4 leading-7 text-slate-600">
              These examples reflect distinct course and supplier formats. A slot, panel, and directory listing are not equivalent products, and an EDDM route cannot stand in for an addressed list.
            </p>
          </div>
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            {SHARED_MAILER_MODELS.map((model) => (
              <SharedModelCard key={model.id} model={model} active={model.id === activeModel.id} priceVisibility={planningPriceVisibility.get(model.id) ?? null} />
            ))}
          </div>
        </section>

        <section className="mt-16" aria-labelledby="quote-only-options">
          <div className="max-w-3xl">
            <div className="text-sm font-black uppercase tracking-[0.16em] text-blue-700">Standalone and small-partner work</div>
            <h2 id="quote-only-options" className="mt-2 text-3xl font-black text-slate-950">Single-business and targeted options remain quote-only</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Size, quantity, delivery area or addressed audience, artwork, timing, and fulfillment must be confirmed before CaliforniaMailer provides a written quote.
            </p>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <QuoteOnlyCard
              title="Single-business EDDM"
              description="One business owns the full saturation mail piece. Route count, final USPS eligibility, size, and fulfillment are confirmed in writing."
              options={EDDM_MAIL_PIECES.map((option) => option.label)}
              footer="Supplier-listed formats are planning choices, not a postal-eligibility or final-price guarantee."
            />
            <QuoteOnlyCard
              title="Targeted addressed solo"
              description="One business mails to a defined addressed audience instead of every address on a carrier route. List source, addressing, postage class, and audience criteria are quote inputs."
              options={TARGETED_MAIL_PIECES.map((option) => option.label)}
              footer="These are addressed-mail formats and are not represented as EDDM Retail pieces."
            />
            <QuoteOnlyCard
              title="Small partner mailer"
              description="A few complementary, noncompeting businesses share a smaller piece. Category fit, partner count, layout, audience, and cost allocation are confirmed before any commitment."
              options={MINI_COOP_MAIL_PIECES.map((option) => option.label)}
              footer="This custom project does not inherit the founding mailer's unit price."
            />
            <QuoteOnlyCard
              title="Pizza-box coupon flyer"
              description="Noncompeting businesses share a coupon or community flyer printed by Printing4SuperCheap and distributed by a contracted California restaurant partner—not USPS."
              options={['Restaurant and box-volume verification', 'Written distribution agreement', 'Rights-attested offers and artwork', 'Documented handoff and distribution evidence']}
              footer="Historical flyer prices and response claims are not customer quotes or performance evidence."
            />
          </div>
        </section>

        <section className="mt-16 rounded-3xl border border-blue-200 bg-blue-50 p-7 md:p-9" aria-labelledby="quote-basis">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <h2 id="quote-basis" className="text-3xl font-black text-slate-950">Supplier and postage basis</h2>
              <p className="mt-4 leading-7 text-slate-700">
                CaliforniaMailer uses <strong>{PRINTING4SUPERCHEAP.name}</strong> as the fixed print supplier. The supplier snapshot was observed on <time dateTime={PRINTING4SUPERCHEAP.priceObservedAt}>{PRINTING4SUPERCHEAP.priceObservedAt}</time>, has no stated validity-through date, and must be rechecked before each quote.
              </p>
              <p className="mt-4 leading-7 text-slate-700">
                A project-specific customer price is withheld until complete costs clear the configured pre-income-tax owner-surplus target and minimum margin gate. USPS or a documented restaurant partner performs distribution; the printer name never substitutes for mailing or partner-delivery evidence.
              </p>
              <p className="mt-4 leading-7 text-slate-700">
                USPS EDDM Retail postage is <strong>${(USPS_EDDM_RETAIL.rateMillsPerPiece / 1000).toFixed(3)} per piece</strong>, effective <time dateTime={USPS_EDDM_RETAIL.effectiveDate}>{USPS_EDDM_RETAIL.effectiveDate}</time>. EDDM Retail requires at least {USPS_EDDM_RETAIL.minimumPieces.toLocaleString('en-US')} pieces and permits no more than {USPS_EDDM_RETAIL.maximumPiecesPerDayPerZip.toLocaleString('en-US')} pieces per day per five-digit ZIP Code. Postage alone is not a complete customer price.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-bold">
                <a className="text-blue-800 underline underline-offset-4" href={PRINTING4SUPERCHEAP.productUrl} target="_blank" rel="noreferrer">Supplier EDDM product page</a>
                <a className="text-blue-800 underline underline-offset-4" href={PRINTING4SUPERCHEAP.discountSheetUrl} target="_blank" rel="noreferrer">Dated supplier sheet</a>
                <a className="text-blue-800 underline underline-offset-4" href={USPS_EDDM_RETAIL.sourceUrl} target="_blank" rel="noreferrer">USPS July 2026 source</a>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-slate-950">What a written quote resolves</h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Printing, postage, shipping, tax, design, proofing, stock and finish, mailing-list or route inputs, addressing, preparation and banding, postal paperwork or drop service, turnaround, tracking, reserves, and applicable fees are confirmed for the selected project. Nothing is ordered from this page.
              </p>
              <Link className="mt-6 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-black text-white transition hover:bg-blue-800" href="/quote">Request a written quote</Link>
              <p className="mt-3 text-xs leading-5 text-slate-500">A request is not a purchase, reservation, or authorization to print or mail.</p>
            </div>
          </div>
        </section>
      </section>
    </PublicShell>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-white p-5"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-3 text-2xl font-black text-slate-950">{value}</dd></div>;
}

function formatUnits(model: SharedMailerModel): string {
  const unit = model.slots.unitLabel;
  const plural = `${unit}s`;
  if (model.slots.totalUnitsDefault !== null) {
    const parts = [`${model.slots.totalUnitsDefault} ${model.slots.totalUnitsDefault === 1 ? unit : plural} total`];
    if (model.slots.paidUnitsDefault !== null) parts.push(`${model.slots.paidUnitsDefault} paid`);
    if (model.slots.houseUnitsDefault) parts.push(`${model.slots.houseUnitsDefault} house`);
    const paidRange = model.slots.paidUnitsRange;
    if (paidRange && paidRange.min !== paidRange.max) parts.push(`paid-fill range ${paidRange.min}–${paidRange.max}`);
    const range = model.slots.totalUnitsRange;
    if (range && range.min !== range.max) parts.push(`adjustable ${range.min}–${range.max}`);
    return parts.join(' · ');
  }
  const range = model.slots.totalUnitsRange;
  if (range) return `${range.min}–${range.max} ${plural} · custom paid mix`;
  return `Custom ${unit} inventory`;
}

function formatMailingMethod(method: SharedMailerModel['mailingMethod']): string {
  if (method === 'eddm_saturation') return 'EDDM saturation';
  if (method === 'addressed_targeted') return 'Addressed targeted';
  return 'Custom / project-specific';
}

function formatCostStatus(status: SharedMailerModel['costBasis']['status']): string {
  if (status === 'supplier_turnkey_snapshot_incomplete') return 'Dated supplier subtotal; current total incomplete';
  if (status === 'external_mailing_cost_required') return 'Current list and addressed-mail quote required';
  return 'Custom layout and mailing quote required';
}

function SharedModelCard({ model, active, priceVisibility }: { model: SharedMailerModel; active: boolean; priceVisibility: PublicModelPriceVisibility | null }) {
  const supportedPlanningPrice = Boolean(priceVisibility?.supported);
  const modeledMargin = priceVisibility?.economicMarginBps ?? null;
  const priceBoundary = supportedPlanningPrice && priceVisibility
    ? `${priceVisibility.customerUnitPriceLabel} equal-unit planning price · $2,500 pre-income-tax surplus floor · ${modeledMargin === null ? 'margin unavailable' : `${(modeledMargin / 100).toFixed(2)}% modeled economic margin`} · recheck by ${priceVisibility.recheckBy ?? 'the next quote'}`
    : model.suggestedPricePerPaidUnitCents !== null
      ? `Stored planning price withheld · ${priceVisibility?.reasons.join(' ') || 'current safeguards are incomplete'} · written quote required`
      : 'Written quote required · no public customer price';
  return (
    <article className={`flex h-full flex-col rounded-3xl border p-7 shadow-sm ${active ? 'border-blue-300 bg-blue-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${active ? 'bg-blue-700 text-white' : supportedPlanningPrice ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-100 text-slate-700'}`}>{active ? 'Active experiment' : supportedPlanningPrice ? 'Dated planning scenario' : 'Quote-only example'}</span>
        <code className="text-xs text-slate-500">{model.id}</code>
      </div>
      <h3 className="mt-4 text-2xl font-black text-slate-950">{model.name}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{model.summary}</p>
      <dl className="mt-6 grid gap-3 text-sm">
        <ModelFact label="Inventory" value={formatUnits(model)} />
        <ModelFact label="Mailing method" value={formatMailingMethod(model.mailingMethod)} />
        <ModelFact label="Cost status" value={formatCostStatus(model.costBasis.status)} />
        <ModelFact label="Price boundary" value={priceBoundary} />
      </dl>
      <div className="mt-6 border-t border-slate-200 pt-4 text-xs leading-5 text-slate-600">
        <strong className="text-slate-900">Layout status:</strong> {model.layoutEvidence.note}
        <span className="mt-2 block"><strong className="text-slate-900">Layout-source observation:</strong> {model.layoutEvidence.sourceObservedAt}. First-party guidance is not a postal, engineering, or production approval.</span>
      </div>
    </article>
  );
}

function ModelFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/80 px-4 py-3"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 font-bold text-slate-800">{value}</dd></div>;
}

function QuoteOnlyCard({
  title,
  description,
  options,
  footer,
}: {
  title: string;
  description: string;
  options: readonly string[];
  footer: string;
}) {
  return (
    <article className="flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
      <div className="text-xs font-black uppercase tracking-[0.14em] text-blue-700">Written quote required</div>
      <h3 className="mt-3 text-2xl font-black text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <ul className="mt-6 space-y-2 text-sm text-slate-700">
        {options.map((option) => <li key={option} className="rounded-lg bg-slate-50 px-3 py-2">{option}</li>)}
      </ul>
      <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-5 text-slate-500">{footer}</p>
    </article>
  );
}
