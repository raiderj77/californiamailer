import { connection } from 'next/server';
import { FOUNDING_CAMPAIGN, formatCurrency } from '@/config/foundingCampaign';
import { SHARED_MAILER_MODELS } from '@/config/sharedMailerModels';
import { evaluateDatedPlanningPrice } from '@/lib/sharedMailerEconomics';

export const PUBLIC_PRICE_WITHHELD_LABEL = 'Withheld — written quote required';

export interface PublicModelPriceVisibility {
  modelId: string;
  supported: boolean;
  customerUnitPriceCents: number | null;
  customerUnitPriceLabel: string;
  derivedFundingGoalCents: number | null;
  derivedFundingGoalLabel: string;
  economicMarginBps: number | null;
  recheckBy: string | null;
  reasons: string[];
}

export interface PublicPlanningPriceVisibility {
  asOf: string;
  supportedCount: number;
  active: PublicModelPriceVisibility;
  models: PublicModelPriceVisibility[];
}

export function evaluatePublicPlanningPriceVisibility(
  asOf: string,
): PublicPlanningPriceVisibility {
  const models = SHARED_MAILER_MODELS.map((model): PublicModelPriceVisibility => {
    const evaluation = evaluateDatedPlanningPrice(model, asOf);
    const supported = Boolean(
      evaluation.supported
      && model.suggestedPricePerPaidUnitCents !== null
      && model.slots.totalUnitsDefault !== null,
    );
    const customerUnitPriceCents = supported ? model.suggestedPricePerPaidUnitCents : null;
    const derivedFundingGoalCents = supported
      && customerUnitPriceCents !== null
      && model.slots.totalUnitsDefault !== null
      ? customerUnitPriceCents * model.slots.totalUnitsDefault
      : null;
    return {
      modelId: model.id,
      supported,
      customerUnitPriceCents,
      customerUnitPriceLabel: customerUnitPriceCents === null
        ? PUBLIC_PRICE_WITHHELD_LABEL
        : formatCurrency(customerUnitPriceCents),
      derivedFundingGoalCents,
      derivedFundingGoalLabel: derivedFundingGoalCents === null
        ? PUBLIC_PRICE_WITHHELD_LABEL
        : formatCurrency(derivedFundingGoalCents),
      economicMarginBps: evaluation.economics?.economicMarginBps ?? null,
      recheckBy: evaluation.recheckBy,
      reasons: [...evaluation.reasons],
    };
  });
  const active = models.find((model) => model.modelId === FOUNDING_CAMPAIGN.planId);
  if (!active) throw new Error('The active public planning-price model is unavailable.');
  return {
    asOf,
    supportedCount: models.filter((model) => model.supported).length,
    active,
    models,
  };
}

export async function getPublicPlanningPriceVisibility(): Promise<PublicPlanningPriceVisibility> {
  // `connection()` opts every caller into request-time rendering. This prevents
  // an old supplier snapshot from remaining visible until the next deployment.
  await connection();
  return evaluatePublicPlanningPriceVisibility(new Date().toISOString().slice(0, 10));
}
