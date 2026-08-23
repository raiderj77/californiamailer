import assert from 'node:assert/strict';
import test from 'node:test';
import {
  campaignPaidPlacementEvidence,
  type CampaignPlacementEvidenceDocument,
} from '../src/lib/campaignPlacementEvidence';

const CAMPAIGN_ID = 'campaign-1';
const PLAN_ID = 'plan-1';
const MODEL_ID = 'model-1';

function document(id: string, value: Record<string, unknown>): CampaignPlacementEvidenceDocument {
  return { id, data: () => value };
}

function fixture() {
  const reservations = [
    document('reservation-1', {
      status: 'paid',
      campaignId: CAMPAIGN_ID,
      planId: PLAN_ID,
      offerModelVersion: MODEL_ID,
      placementSlotId: 'slot-1',
    }),
    document('reservation-2', {
      status: 'paid',
      campaignId: CAMPAIGN_ID,
      planId: PLAN_ID,
      offerModelVersion: MODEL_ID,
      placementSlotId: 'slot-2',
    }),
  ];
  const slots = [
    document('slot-1', {
      status: 'sold',
      reservationId: 'reservation-1',
      campaignId: CAMPAIGN_ID,
      planId: PLAN_ID,
      offerModelVersion: MODEL_ID,
    }),
    document('slot-2', {
      status: 'sold',
      reservationId: 'reservation-2',
      campaignId: CAMPAIGN_ID,
      planId: PLAN_ID,
      offerModelVersion: MODEL_ID,
    }),
  ];
  return { reservations, slots };
}

function evaluate(
  reservations: CampaignPlacementEvidenceDocument[],
  slots: CampaignPlacementEvidenceDocument[],
  truncated = false,
) {
  return campaignPaidPlacementEvidence(
    CAMPAIGN_ID,
    PLAN_ID,
    MODEL_ID,
    reservations,
    slots,
    truncated,
  );
}

test('paid placement evidence requires one exact sold reciprocal slot per reservation', () => {
  const { reservations, slots } = fixture();
  assert.deepEqual(evaluate(reservations, slots), {
    passed: true,
    paidReservationCount: 2,
    exactSoldSlotCount: 2,
    issueCodes: [],
  });
});

test('missing, open, duplicate, and nonreciprocal paid slot evidence fails closed', () => {
  const scenarios = [
    (() => {
      const { reservations, slots } = fixture();
      return { label: 'missing', reservations, slots: slots.slice(1), issue: 'paid_reservation_slot_missing' };
    })(),
    (() => {
      const { reservations, slots } = fixture();
      slots[0] = document('slot-1', { ...slots[0].data(), status: 'open' });
      return { label: 'open', reservations, slots, issue: 'paid_reservation_slot_not_sold' };
    })(),
    (() => {
      const { reservations, slots } = fixture();
      reservations[1] = document('reservation-2', {
        ...reservations[1].data(),
        placementSlotId: 'slot-1',
      });
      return { label: 'duplicate', reservations, slots, issue: 'paid_reservation_slot_pointer_duplicate' };
    })(),
    (() => {
      const { reservations, slots } = fixture();
      slots.push(document('other-campaign-slot', {
        status: 'sold',
        reservationId: 'reservation-1',
        campaignId: 'other-campaign',
        planId: PLAN_ID,
        offerModelVersion: MODEL_ID,
      }));
      return { label: 'nonreciprocal', reservations, slots, issue: 'paid_reservation_slot_not_reciprocal' };
    })(),
  ];

  for (const scenario of scenarios) {
    const result = evaluate(scenario.reservations, scenario.slots);
    assert.equal(result.passed, false, scenario.label);
    assert.ok(result.issueCodes.includes(scenario.issue), scenario.label);
  }
});

test('a saturated bounded placement-slot read fails closed', () => {
  const { reservations, slots } = fixture();
  const result = evaluate(reservations, slots, true);
  assert.equal(result.passed, false);
  assert.ok(result.issueCodes.includes('placement_slot_read_truncated'));
});
