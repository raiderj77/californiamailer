import assert from 'node:assert/strict';
import test from 'node:test';
import { FOUNDING_CAMPAIGN } from '../src/config/foundingCampaign';
import { MINIMUM_ECONOMIC_MARGIN_BPS } from '../src/config/economicSafeguards';
import { SHARED_MAILER_MODELS } from '../src/config/sharedMailerModels';
import {
  PUBLIC_PRICE_WITHHELD_LABEL,
  evaluatePublicPlanningPriceVisibility,
} from '../src/lib/publicPlanningPriceVisibility';

test('current dated safeguards expose only supported customer prices and derived goals', () => {
  const visibility = evaluatePublicPlanningPriceVisibility('2026-08-20');
  assert.equal(visibility.active.modelId, FOUNDING_CAMPAIGN.planId);
  assert.equal(visibility.active.supported, true);
  assert.equal(visibility.active.customerUnitPriceCents, 34_900);
  assert.equal(visibility.active.customerUnitPriceLabel, '$349');
  assert.equal(visibility.active.derivedFundingGoalCents, 837_600);
  assert.equal(visibility.active.derivedFundingGoalLabel, '$8,376');
  assert.ok((visibility.active.economicMarginBps ?? -1) >= MINIMUM_ECONOMIC_MARGIN_BPS);

  const tenThousandModel = SHARED_MAILER_MODELS.find((model) => model.quantity === 10_000);
  assert.ok(tenThousandModel);
  const tenThousandVisibility = visibility.models.find(
    (model) => model.modelId === tenThousandModel.id,
  );
  assert.equal(tenThousandVisibility?.supported, true);
  assert.equal(tenThousandVisibility?.customerUnitPriceLabel, '$479');
  assert.equal(tenThousandVisibility?.derivedFundingGoalLabel, '$11,496');
  assert.ok((tenThousandVisibility?.economicMarginBps ?? -1) >= MINIMUM_ECONOMIC_MARGIN_BPS);
});

test('stale supplier evidence withholds every configured customer price and derived goal', () => {
  const visibility = evaluatePublicPlanningPriceVisibility('2026-10-01');
  const configuredPrices = visibility.models.filter((model) => (
    SHARED_MAILER_MODELS.find((candidate) => candidate.id === model.modelId)
      ?.suggestedPricePerPaidUnitCents !== null
  ));
  assert.ok(configuredPrices.length > 0);
  for (const model of configuredPrices) {
    assert.equal(model.supported, false);
    assert.equal(model.customerUnitPriceCents, null);
    assert.equal(model.customerUnitPriceLabel, PUBLIC_PRICE_WITHHELD_LABEL);
    assert.equal(model.derivedFundingGoalCents, null);
    assert.equal(model.derivedFundingGoalLabel, PUBLIC_PRICE_WITHHELD_LABEL);
  }
});
