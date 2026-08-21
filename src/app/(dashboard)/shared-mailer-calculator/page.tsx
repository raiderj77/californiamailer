'use client';

import { useMemo, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  DISCOUNT_PRINT_PRICES_CENTS,
  PRINTING4SUPERCHEAP,
} from '@/config/eddmOfferings';
import {
  ACTIVE_SHARED_PLAN_ID,
  SHARED_MAILER_MODELS,
  getSharedMailerModel,
  sharedMailerFillSensitivityUnits,
  type SharedMailerModel,
} from '@/config/sharedMailerModels';
import {
  DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS,
  calculateSharedMailerEconomics,
  evaluateDatedPlanningPrice,
  type SharedMailerEconomicsInput,
} from '@/lib/sharedMailerEconomics';

type PlanningGoalMode = 'fixed_surplus' | 'fixed_surplus_and_active_margin';

interface CalculatorForm {
  paidSlotUnits: string;
  revenuePerPaidUnit: string;
  paymentCount: string;
  supplierSubtotal: string;
  processingRatePercent: string;
  processingFixedPerPayment: string;
  refundReservePercent: string;
  productionReservePercent: string;
  taxContingency: string;
  designCost: string;
  ownerLabor: string;
  softwareAndOther: string;
  incomeTaxReservePercent: string;
  targetOwnerSurplus: string;
  targetEconomicMarginPercent: string;
}

const ACTIVE_MARGIN_SOURCE_MODEL = getSharedMailerModel(ACTIVE_SHARED_PLAN_ID);
const ACTIVE_MARGIN_EVALUATION = ACTIVE_MARGIN_SOURCE_MODEL?.costBasis.supplierPriceObservedAt
  ? evaluateDatedPlanningPrice(
    ACTIVE_MARGIN_SOURCE_MODEL,
    ACTIVE_MARGIN_SOURCE_MODEL.costBasis.supplierPriceObservedAt,
  )
  : null;
const ACTIVE_ECONOMIC_MARGIN_BPS = ACTIVE_MARGIN_EVALUATION?.supported
  ? ACTIVE_MARGIN_EVALUATION.economics?.economicMarginBps ?? null
  : null;

const dollars = (cents: number | null): string => cents === null ? '' : String(cents / 100);
const percent = (basisPoints: number | null): string => basisPoints === null ? '' : String(basisPoints / 100);
function parseDollars(value: string): number | null {
  if (value.trim() === '') return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

function parsePercent(value: string): number | null {
  if (value.trim() === '') return null;
  const basisPoints = Math.round(Number(value) * 100);
  return Number.isSafeInteger(basisPoints) && basisPoints >= 0 && basisPoints <= 10_000 ? basisPoints : null;
}

function parseWhole(value: string, minimum: number): number | null {
  if (value.trim() === '') return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : null;
}

function illustrativeTaxCents(model: SharedMailerModel): number | null {
  const specificationId = model.costBasis.supplierSpecificationId;
  const quantity = model.costBasis.supplierQuantity;
  if (!specificationId || !quantity) return null;
  const printPriceCents = DISCOUNT_PRINT_PRICES_CENTS[specificationId]?.[quantity] ?? null;
  return printPriceCents === null ? null : Math.round(printPriceCents * 0.1);
}

function initialForm(model: SharedMailerModel): CalculatorForm {
  const paidUnits = model.slots.paidUnitsDefault;
  const quantity = model.quantity;
  return {
    paidSlotUnits: paidUnits === null ? '' : String(paidUnits),
    revenuePerPaidUnit: dollars(model.suggestedPricePerPaidUnitCents),
    paymentCount: paidUnits === null ? '' : String(paidUnits),
    supplierSubtotal: dollars(model.costBasis.supplierSubtotalCents),
    processingRatePercent: percent(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingRateBps),
    processingFixedPerPayment: dollars(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.processingFixedCentsPerPayment),
    refundReservePercent: percent(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.refundReserveBps),
    productionReservePercent: percent(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.productionReserveBps),
    taxContingency: dollars(illustrativeTaxCents(model)),
    designCost: dollars(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.designCostCents),
    ownerLabor: dollars(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.ownerLaborCents),
    softwareAndOther: model.costBasis.supplierSubtotalCents === null
      ? ''
      : quantity !== null && quantity > 5_000 ? '150' : '100',
    incomeTaxReservePercent: percent(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.incomeTaxReserveBps),
    targetOwnerSurplus: dollars(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.targetOwnerSurplusCents),
    targetEconomicMarginPercent: percent(DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.targetEconomicMarginBps),
  };
}

function calculatorInput(
  form: CalculatorForm,
  model: SharedMailerModel,
  paidSlotUnitsOverride?: number,
  paymentCountOverride?: number,
): SharedMailerEconomicsInput {
  const paidUnitRange = model.slots.paidUnitsRange;
  return {
    supplierSubtotalCents: parseDollars(form.supplierSubtotal),
    paidSlotUnits: paidSlotUnitsOverride ?? parseWhole(form.paidSlotUnits, 1),
    minimumPaidSlotUnits: paidUnitRange?.min ?? null,
    maximumPaidSlotUnits: paidUnitRange?.max ?? null,
    revenueMode: model.slots.pricingMode,
    revenuePerPaidUnitCents: parseDollars(form.revenuePerPaidUnit),
    paymentCount: paymentCountOverride ?? parseWhole(form.paymentCount, 0),
    processingRateBps: parsePercent(form.processingRatePercent),
    processingFixedCentsPerPayment: parseDollars(form.processingFixedPerPayment),
    refundReserveBps: parsePercent(form.refundReservePercent),
    productionReserveBps: parsePercent(form.productionReservePercent),
    taxContingencyCents: parseDollars(form.taxContingency),
    designCostCents: parseDollars(form.designCost),
    ownerLaborCents: parseDollars(form.ownerLabor),
    softwareAndOtherCents: parseDollars(form.softwareAndOther),
    incomeTaxReserveBps: parsePercent(form.incomeTaxReservePercent),
    targetOwnerSurplusCents: parseDollars(form.targetOwnerSurplus),
    targetEconomicMarginBps: parsePercent(form.targetEconomicMarginPercent),
  };
}

function money(value: number | null): string {
  return value === null
    ? 'Unknown'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value / 100);
}

function margin(value: number | null): string {
  return value === null ? 'Unknown' : `${(value / 100).toFixed(1)}%`;
}

export default function SharedMailerCalculatorPage() {
  const [modelId, setModelId] = useState(ACTIVE_SHARED_PLAN_ID as string);
  const selectedModel = getSharedMailerModel(modelId) ?? SHARED_MAILER_MODELS[0];
  const [form, setForm] = useState<CalculatorForm>(() => initialForm(selectedModel));
  const [goalMode, setGoalMode] = useState<PlanningGoalMode>('fixed_surplus');
  const set = <K extends keyof CalculatorForm>(key: K, value: CalculatorForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const economics = useMemo(
    () => calculateSharedMailerEconomics(calculatorInput(form, selectedModel)),
    [form, selectedModel],
  );
  const customPriceMix = selectedModel.slots.pricingMode === 'custom_price_mix';
  const boundedInventory = selectedModel.slots.paidUnitsRange !== null;
  const sensitivity = useMemo(() => {
    return sharedMailerFillSensitivityUnits(selectedModel).map((paidUnits) => ({
      paidUnits,
      result: calculateSharedMailerEconomics(calculatorInput(form, selectedModel, paidUnits, paidUnits)),
    }));
  }, [form, selectedModel]);

  function chooseModel(nextId: string) {
    const next = getSharedMailerModel(nextId);
    if (!next) return;
    setModelId(nextId);
    setGoalMode('fixed_surplus');
    setForm(initialForm(next));
  }

  function chooseGoalMode(nextMode: PlanningGoalMode) {
    setGoalMode(nextMode);
    set('targetEconomicMarginPercent', nextMode === 'fixed_surplus_and_active_margin'
      ? percent(ACTIVE_ECONOMIC_MARGIN_BPS)
      : '');
  }

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="max-w-5xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-700">Owner planning tool</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950 md:text-4xl">Shared-mailer economics calculator</h1>
          <p className="mt-4 max-w-4xl leading-7 text-slate-600">
            Compare the co-op formats found in the course materials without borrowing costs or slot counts from a different model. This calculator plans only: it cannot enable checkout, reserve inventory, approve artwork, or place a print or postage order.
          </p>
        </header>

        <section className="mt-7 max-w-5xl rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          <strong>The target is economic surplus before personal income or self-employment tax—not guaranteed take-home.</strong>{' '}
          Cash before owner labor is also shown because owner time is a noncash allowance when you perform the work yourself. Blank fields remain unknown and block a required-price answer.
        </section>

        <section className="mt-7 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <label className="block text-sm font-bold text-slate-900">
              Mailer model
              <select
                value={modelId}
                onChange={(event) => chooseModel(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-3 font-normal"
              >
                {SHARED_MAILER_MODELS.map((model) => <option key={model.id} value={model.id}>{model.name}</option>)}
              </select>
            </label>
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700">
              <strong className="block text-slate-950">{selectedModel.summary}</strong>
              <span className="mt-2 block">{selectedModel.layoutEvidence.note}</span>
              <span className="mt-2 block"><strong>Cost status:</strong> {selectedModel.costBasis.note}</span>
            </div>
            {selectedModel.costBasis.supplierId === PRINTING4SUPERCHEAP.id && (
              <p className="mt-4 text-xs leading-5 text-slate-500">
                The supplier subtotal is a snapshot observed {selectedModel.costBasis.supplierPriceObservedAt}; the sheet has no validity-through date. Recheck the signed-in {PRINTING4SUPERCHEAP.name} total before quoting or printing.
              </p>
            )}
            {!boundedInventory && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950" role="alert">
                <strong>Economics blocked:</strong> this custom concept has no verified minimum or maximum paid-unit inventory. Define a bounded project layout before calculating revenue; the catalog will not invent one.
              </div>
            )}
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Revenue and fill</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label={`Paid ${selectedModel.slots.unitLabel} units`}
                value={form.paidSlotUnits}
                min={String(selectedModel.slots.paidUnitsRange?.min ?? 1)}
                max={selectedModel.slots.paidUnitsRange ? String(selectedModel.slots.paidUnitsRange.max) : undefined}
                step="1"
                disabled={!boundedInventory}
                onChange={(value) => set('paidSlotUnits', value)}
                help={selectedModel.slots.paidUnitsRange ? `This model allows ${selectedModel.slots.paidUnitsRange.min}–${selectedModel.slots.paidUnitsRange.max} paid units.` : 'A project-specific bounded inventory is required before calculation.'}
              />
              <Input label={customPriceMix ? 'Average revenue per filled unit ($)' : 'Equal price per paid unit ($)'} value={form.revenuePerPaidUnit} min="0" step="0.01" disabled={!boundedInventory} onChange={(value) => set('revenuePerPaidUnit', value)} help={customPriceMix ? 'Benchmark only—not a uniform customer price. The actual bounded SKU mix must clear the required total revenue.' : undefined} />
              <Input label="Separate payments" value={form.paymentCount} min="0" step="1" disabled={!boundedInventory} onChange={(value) => set('paymentCount', value)} />
              <Input label="Target owner economic surplus ($)" value={form.targetOwnerSurplus} min="0" step="0.01" onChange={(value) => set('targetOwnerSurplus', value)} />
              <label className="block text-sm font-bold text-slate-900 sm:col-span-2">
                Cross-format planning goal
                <select value={goalMode} onChange={(event) => chooseGoalMode(event.target.value as PlanningGoalMode)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal">
                  <option value="fixed_surplus">Fixed pre-income-tax surplus floor only</option>
                  <option value="fixed_surplus_and_active_margin" disabled={ACTIVE_ECONOMIC_MARGIN_BPS === null}>Fixed surplus floor + match active 5,000-piece economic margin</option>
                </select>
                <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">The fixed mode solves for the entered surplus target (default $2,500). The matched-margin mode also requires the active dated 5,000-piece model’s {ACTIVE_ECONOMIC_MARGIN_BPS === null ? 'unavailable' : `${(ACTIVE_ECONOMIC_MARGIN_BPS / 100).toFixed(2)}%`} economic margin. Matching margin never means copying its unit price.</span>
              </label>
              {goalMode === 'fixed_surplus_and_active_margin' && (
                <Input label="Minimum economic margin (%)" value={form.targetEconomicMarginPercent} min="0" max="100" step="0.01" onChange={(value) => set('targetEconomicMarginPercent', value)} help="Defaults to the active 5,000-piece dated benchmark and remains editable for scenario planning." />
              )}
            </div>
          </div>
        </section>

        <section className="mt-6 max-w-5xl rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-black text-slate-950">Costs, fees, reserves, and labor</h2><p className="mt-2 text-sm leading-6 text-slate-600">Every zero is a deliberate input. Leave a field blank when it has not been verified.</p></div>
            <button type="button" onClick={() => { setGoalMode('fixed_surplus'); setForm(initialForm(selectedModel)); }} className="rounded-lg border px-4 py-2 text-sm font-bold hover:bg-slate-50">Reset this model</button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Input label="Supplier / mailing subtotal ($)" value={form.supplierSubtotal} min="0" step="0.01" onChange={(value) => set('supplierSubtotal', value)} help="For turnkey EDDM examples this includes the dated print snapshot, turnkey amount, and banding—not tax, design, or other costs." />
            <Input label="Card processing rate (%)" value={form.processingRatePercent} min="0" max="100" step="0.01" onChange={(value) => set('processingRatePercent', value)} help={DEFAULT_SHARED_ECONOMICS_ASSUMPTIONS.labels.processingRateBps} />
            <Input label="Fixed processing per payment ($)" value={form.processingFixedPerPayment} min="0" step="0.01" onChange={(value) => set('processingFixedPerPayment', value)} />
            <Input label="Refund / chargeback reserve (%)" value={form.refundReservePercent} min="0" max="100" step="0.01" onChange={(value) => set('refundReservePercent', value)} />
            <Input label="Production / reprint reserve (%)" value={form.productionReservePercent} min="0" max="100" step="0.01" onChange={(value) => set('productionReservePercent', value)} help="Applied to the supplier or mailing subtotal." />
            <Input label="Tax contingency ($)" value={form.taxContingency} min="0" step="0.01" onChange={(value) => set('taxContingency', value)} help="The supplier examples start with an editable 10% of print-price placeholder; replace it with the actual signed-in quote total." />
            <Input label="Design and revisions ($)" value={form.designCost} min="0" step="0.01" onChange={(value) => set('designCost', value)} />
            <Input label="Owner labor value ($)" value={form.ownerLabor} min="0" step="0.01" onChange={(value) => set('ownerLabor', value)} help="Economic allowance, not necessarily a cash payment." />
            <Input label="Software and other costs ($)" value={form.softwareAndOther} min="0" step="0.01" onChange={(value) => set('softwareAndOther', value)} />
            <Input label="Optional income-tax reserve (%)" value={form.incomeTaxReservePercent} min="0" max="100" step="0.01" onChange={(value) => set('incomeTaxReservePercent', value)} help="Blank by default. This is not tax advice." />
          </div>
        </section>

        <section className="mt-6 max-w-5xl" aria-live="polite">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Gross revenue" value={money(economics.grossRevenueCents)} />
            <Stat label="Processing fees" value={money(economics.feesAndReserves.processingFeesCents)} />
            <Stat label="Refund reserve" value={money(economics.feesAndReserves.refundReserveCents)} />
            <Stat label="Production reserve" value={money(economics.feesAndReserves.productionReserveCents)} />
            <Stat label="Cash before owner labor & income tax" value={money(economics.cashBeforeOwnerLaborAndIncomeTaxCents)} />
            <Stat label="Economic surplus before income tax" value={money(economics.economicSurplusBeforeIncomeTaxCents)} emphasis />
            <Stat label="Optional after-tax planning surplus" value={money(economics.afterTaxPlanningSurplusCents)} />
            <Stat label="Pre-income-tax economic margin" value={margin(economics.economicMarginBps)} />
            <Stat label="Optional margin target gap" value={economics.marginTargetGapBps === null ? 'Not set' : `${(economics.marginTargetGapBps / 100).toFixed(1)} points`} />
          </div>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-800">{customPriceMix ? 'Minimum total revenue for the bounded SKU mix' : 'Equal price needed for the selected fill'}</p>
              <p className="mt-3 text-4xl font-black text-slate-950">{money(customPriceMix ? economics.recommendedRequiredGrossRevenueCents : economics.recommendedRequiredRevenuePerPaidUnitCents)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                {customPriceMix
                  ? <>The SKU mix must total at least {money(economics.exactRequiredGrossRevenueCents)}. The rounded average benchmark is {money(economics.recommendedRequiredRevenuePerPaidUnitCents)} per filled unit; it is not one customer price.</>
                  : <>Rounded up to the next $5 per paid unit. Exact required total revenue is {money(economics.exactRequiredGrossRevenueCents)}, or {money(economics.exactRequiredRevenuePerPaidUnitCents)} per unit before rounding.</>}
                {' '}The result must clear the fixed surplus floor and any selected margin floor.
              </p>
            </div>
            <div className={`rounded-2xl border p-6 ${economics.fixedSurplusTargetGapCents !== null && economics.fixedSurplusTargetGapCents >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <p className="text-xs font-black uppercase tracking-[0.16em]">Fixed surplus target gap</p>
              <p className="mt-3 text-4xl font-black text-slate-950">{money(economics.fixedSurplusTargetGapCents)}</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">Positive means the modeled pre-income-tax economic surplus is above the target; negative means it is short.</p>
            </div>
          </div>
          {(economics.requiredPriceMissingInputs.length > 0 || economics.blockingReasons.length > 0) && (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-950" role="alert">
              <strong>Required-price result is blocked.</strong>{' '}
              {economics.requiredPriceMissingInputs.length > 0 && <>Enter: {economics.requiredPriceMissingInputs.join(', ')}. </>}
              {economics.blockingReasons.join(' ')}
            </div>
          )}
        </section>

        {sensitivity.length > 1 && (
          <section className="mt-6 max-w-5xl rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black text-slate-950">Fill sensitivity</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">One payment per filled unit; all other editable inputs stay exactly as entered. The 24-unit models show 16, 18, and 24 fills. Other models use their bounded inventory range.</p>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead className="border-b text-xs uppercase tracking-wide text-slate-500">
                  <tr><th className="py-3 pr-4">Paid units</th><th className="py-3 pr-4">Exact required total</th><th className="py-3 pr-4">Exact unit benchmark</th><th className="py-3 pr-4">Rounded unit benchmark</th><th className="py-3">Surplus at entered revenue</th></tr>
                </thead>
                <tbody>
                  {sensitivity.map(({ paidUnits, result }) => (
                    <tr key={paidUnits} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-bold text-slate-950">{paidUnits}</td>
                      <td className="py-3 pr-4">{money(result.exactRequiredGrossRevenueCents)}</td>
                      <td className="py-3 pr-4">{money(result.exactRequiredRevenuePerPaidUnitCents)}</td>
                      <td className="py-3 pr-4">{money(result.recommendedRequiredRevenuePerPaidUnitCents)}</td>
                      <td className="py-3">{money(result.economicSurplusBeforeIncomeTaxCents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section className="mt-7 max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 text-sm leading-6 text-slate-600">
          <h2 className="text-lg font-black text-slate-950">Production boundary</h2>
          <p className="mt-2">A completed calculator is still not print readiness. Current supplier evidence, final routes or addressed audience, postal eligibility, live inventory, settled payments, approved advertiser materials, proof approvals, refund obligations, and combined-artwork preflight remain separate gates.</p>
        </section>
      </main>
    </div>
  );
}

function Input({ label, value, onChange, help, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { label: string; value: string; onChange: (value: string) => void; help?: string }) {
  return (
    <label className="block text-sm font-bold text-slate-900">
      {label}
      <input {...props} type="number" value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-normal" />
      {help && <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{help}</span>}
    </label>
  );
}

function Stat({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  return <div className={`rounded-2xl border p-5 shadow-sm ${emphasis ? 'border-blue-300 bg-blue-50' : 'bg-white'}`}><div className="text-2xl font-black text-slate-950">{value}</div><div className="mt-2 text-xs leading-5 text-slate-500">{label}</div></div>;
}
