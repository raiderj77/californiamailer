import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACTIVE_SHARED_FUNDING_GOAL_CENTS,
  ACTIVE_SHARED_INVENTORY_COUNT,
  ACTIVE_SHARED_SLOT_PRICE_CENTS,
  APPROVED_CAMPAIGN_CONTRACT_VERSIONS,
  FOUNDING_CAMPAIGN,
  FOUNDING_CATEGORIES,
  FOUNDING_COMPATIBLE_NON_SENSITIVE_CATEGORY_SLUGS,
  campaignMatchesActiveSharedModel,
  compatibleNonSensitiveCategorySlugs,
  getApprovedCampaignContractVersions,
  isAllowedContractVersion,
  submittedContractAcceptanceMatches,
} from '../src/config/foundingCampaign';
import {
  ACTIVE_SHARED_MODEL_VERSION,
  ACTIVE_SHARED_PLAN_ID,
  getSharedMailerModel,
} from '../src/config/sharedMailerModels';
import { createFoundingCampaignRecord, placementSlotId } from '../src/lib/campaignRecords';
import { recordMatchesCampaignModel } from '../src/lib/campaignSync';

test('the active founding campaign is one versioned 24-slot 9x12 plan', () => {
  const model = getSharedMailerModel(ACTIVE_SHARED_PLAN_ID);
  assert.ok(model);
  assert.equal(model.version, ACTIVE_SHARED_MODEL_VERSION);
  assert.equal(model.quantity, 5_000);
  assert.equal(model.slots.totalUnitsDefault, 24);
  assert.equal(model.slots.paidUnitsDefault, 24);
  assert.equal(model.suggestedPricePerPaidUnitCents, 34_900);

  assert.equal(ACTIVE_SHARED_INVENTORY_COUNT, 24);
  assert.equal(ACTIVE_SHARED_SLOT_PRICE_CENTS, 34_900);
  assert.equal(ACTIVE_SHARED_FUNDING_GOAL_CENTS, 837_600);
  assert.equal(FOUNDING_CAMPAIGN.targetHouseholds, 5_000);
  assert.equal(FOUNDING_CAMPAIGN.minimumPaidPlacements, 24);
  assert.deepEqual(Object.keys(FOUNDING_CAMPAIGN.placements), ['standard']);
  assert.deepEqual(FOUNDING_CAMPAIGN.placements.standard, { count: 24, priceCents: 34_900 });
});

test('the non-sensitive category graph has at least 24 mutually compatible exclusive claims', () => {
  const selected = FOUNDING_COMPATIBLE_NON_SENSITIVE_CATEGORY_SLUGS;
  assert.ok(selected.length >= 24);
  const selectedCategories = selected.map((slug) => {
    const category = FOUNDING_CATEGORIES.find((candidate) => candidate.slug === slug);
    assert.ok(category);
    assert.equal(category.sensitive, false);
    return category;
  });
  for (const category of selectedCategories) {
    for (const candidate of selectedCategories) {
      if (category.slug === candidate.slug) continue;
      assert.equal((category.conflictsWith as readonly string[]).includes(candidate.slug), false);
      assert.equal((candidate.conflictsWith as readonly string[]).includes(category.slug), false);
    }
  }
});

test('category capacity counts unique slugs rather than duplicate catalog rows', () => {
  const duplicateRows = Array.from({ length: 24 }, () => ({
    slug: 'roofing',
    conflictsWith: [] as string[],
    sensitive: false,
  }));
  assert.deepEqual(compatibleNonSensitiveCategorySlugs(duplicateRows), ['roofing']);
  assert.deepEqual(compatibleNonSensitiveCategorySlugs([
    ...duplicateRows,
    { slug: 'painting', conflictsWith: [] as string[], sensitive: false },
  ]), ['roofing', 'painting']);
});

test('contract approval requires an exact nonempty allowlisted version', () => {
  const allowed = ['2026-08-reviewed-v1'];
  assert.equal(isAllowedContractVersion('2026-08-reviewed-v1', allowed), true);
  assert.equal(isAllowedContractVersion('', allowed), false);
  assert.equal(isAllowedContractVersion(' 2026-08-reviewed-v1', allowed), false);
  assert.equal(isAllowedContractVersion('2026-08-REVIEWED-v1', allowed), false);
  assert.equal(isAllowedContractVersion('2026-08-draft', allowed), false);

  for (const pair of APPROVED_CAMPAIGN_CONTRACT_VERSIONS) {
    assert.ok(pair.termsVersion.length > 0);
    assert.equal(pair.termsVersion, pair.termsVersion.trim());
    assert.ok(pair.fundingPolicyVersion.length > 0);
    assert.equal(pair.fundingPolicyVersion, pair.fundingPolicyVersion.trim());
  }
  assert.equal(getApprovedCampaignContractVersions({
    termsVersion: FOUNDING_CAMPAIGN.termsVersion,
    fundingPolicyVersion: FOUNDING_CAMPAIGN.fundingPolicyVersion,
  }), null);
});

test('approved contract acceptance binds both exact submitted versions', () => {
  const approved = {
    termsVersion: '2026-08-reviewed-v1',
    fundingPolicyVersion: '2026-08-funding-reviewed-v1',
  };
  assert.equal(submittedContractAcceptanceMatches({
    acceptedTermsVersion: approved.termsVersion,
    acceptedFundingPolicyVersion: approved.fundingPolicyVersion,
  }, approved), true);
  assert.equal(submittedContractAcceptanceMatches({
    acceptedTermsVersion: '2026-08-draft',
    acceptedFundingPolicyVersion: approved.fundingPolicyVersion,
  }, approved), false);
  assert.equal(submittedContractAcceptanceMatches({
    acceptedTermsVersion: approved.termsVersion,
    acceptedFundingPolicyVersion: '',
  }, approved), false);
  assert.equal(submittedContractAcceptanceMatches({
    acceptedTermsVersion: approved.termsVersion,
    acceptedFundingPolicyVersion: approved.fundingPolicyVersion,
  }, null), false);
});

test('initialization data carries the active plan and creates only equal standard inventory', () => {
  const record = createFoundingCampaignRecord('owner-test');
  assert.equal(record.planId, ACTIVE_SHARED_PLAN_ID);
  assert.equal(record.offerModelVersion, ACTIVE_SHARED_MODEL_VERSION);
  assert.equal(record.placements.standard.total, 24);
  assert.equal(record.placements.standard.priceCents, 34_900);
  assert.equal(record.minimumPaidPlacements, 24);
  assert.equal(record.currentPaidPlacementCount, 0);
  assert.equal(campaignMatchesActiveSharedModel(record), true);

  const slotIds = Array.from(
    { length: record.placements.standard.total },
    (_, index) => placementSlotId(record.id, 'standard', index + 1),
  );
  assert.equal(new Set(slotIds).size, 24);
  assert.equal(slotIds[0], `${record.id}__standard__01`);
  assert.equal(slotIds[23], `${record.id}__standard__24`);
});

test('legacy or mixed inventory records never match the active campaign model', () => {
  const record = createFoundingCampaignRecord('owner-test');
  assert.equal(campaignMatchesActiveSharedModel({ ...record, planId: 'shared-9x12-10000' }), false);
  assert.equal(campaignMatchesActiveSharedModel({ ...record, offerModelVersion: 'legacy' }), false);
  assert.equal(campaignMatchesActiveSharedModel({
    ...record,
    placements: { ...record.placements, double: { total: 2, priceCents: 99_900 } },
  }), false);
  assert.equal(campaignMatchesActiveSharedModel({
    ...record,
    placements: { standard: { ...record.placements.standard, total: 12 } },
  }), false);
  assert.equal(campaignMatchesActiveSharedModel({
    ...record,
    placements: { standard: { ...record.placements.standard, priceCents: 47_900 } },
  }), false);
  assert.equal(campaignMatchesActiveSharedModel({ ...record, targetHouseholds: 10_000 }), false);
  assert.equal(campaignMatchesActiveSharedModel({ ...record, fundingGoalCents: 1_149_600 }), false);
  assert.equal(campaignMatchesActiveSharedModel({ ...record, minimumPaidPlacements: 23 }), false);
});

test('funding and inventory synchronization cannot mix campaign model versions', () => {
  const record = createFoundingCampaignRecord('owner-test');
  assert.equal(recordMatchesCampaignModel({
    planId: record.planId,
    offerModelVersion: record.offerModelVersion,
  }, record), true);
  assert.equal(recordMatchesCampaignModel({
    planId: record.planId,
    offerModelVersion: 'shared-mailers-v1',
  }, record), false);
  assert.equal(recordMatchesCampaignModel({}, {}), true);
});
