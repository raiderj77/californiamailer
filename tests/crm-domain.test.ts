import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CRM_ADDONS,
  CRM_AUTOMATION_POLICY,
  CRM_NEXT_ACTION_TYPES,
  DEFAULT_CRM_ADDON_STATE,
} from '../src/config/crm';
import {
  buildCrmOpportunities,
  crmTaskState,
  interestStatusToCrmStage,
  prospectStatusToCrmStage,
  safeProspectStatusForStage,
} from '../src/lib/crmDomain';

test('CRM stages preserve verified reservation and payment boundaries', () => {
  assert.equal(prospectStatusToCrmStage('researching'), 'qualification');
  assert.equal(prospectStatusToCrmStage('reservation_sent'), 'interested');
  assert.equal(prospectStatusToCrmStage('reserved'), 'interested');
  assert.equal(prospectStatusToCrmStage('awaiting_payment'), 'interested');
  assert.equal(prospectStatusToCrmStage('paid'), 'interested');
  assert.equal(interestStatusToCrmStage('invited'), 'reservation');
  assert.equal(interestStatusToCrmStage('reserved'), 'inbound');
  assert.equal(safeProspectStatusForStage('paid'), null);
  assert.equal(safeProspectStatusForStage('reservation'), null);
  assert.equal(safeProspectStatusForStage('ready'), 'ready_to_contact');
});

test('legacy prospect operational flags remain unverified notes and never create locked CRM stages', () => {
  const [opportunity] = buildCrmOpportunities(
    [{
      id: 'legacy-paid-note',
      businessName: 'Legacy Advertiser',
      status: 'paid',
      categoryReservationStatus: 'sold',
      paymentStatus: 'cleared',
    }],
    [],
    [],
    '2026-08-19',
  );

  assert.equal(opportunity.stage, 'interested');
  assert.equal(opportunity.categoryReservationStatus, 'sold');
  assert.equal(opportunity.paymentStatus, 'cleared');
  assert.equal(opportunity.operationalStateSource, 'legacy_prospect_note');
});

test('task state is deterministic from explicit California calendar dates', () => {
  assert.equal(crmTaskState(undefined, '2026-08-19'), 'unscheduled');
  assert.equal(crmTaskState('2026-08-18', '2026-08-19'), 'overdue');
  assert.equal(crmTaskState('2026-08-19', '2026-08-19'), 'today');
  assert.equal(crmTaskState('2026-08-20', '2026-08-19'), 'upcoming');
});

test('private samples are an owner task, not an automated outreach or provider add-on', () => {
  assert.ok(CRM_NEXT_ACTION_TYPES.some((action) => (
    action.id === 'prepare_sample' && action.label === 'Prepare private fit preview'
  )));
  assert.equal(CRM_ADDONS.some((addon) => String(addon.id) === 'samples'), false);
  assert.equal(CRM_AUTOMATION_POLICY.outboundEmail, 'disabled');
  assert.equal(CRM_AUTOMATION_POLICY.socialMessages, 'disabled');
});

test('unified CRM uses linked source records without duplicating promoted inquiries', () => {
  const opportunities = buildCrmOpportunities(
    [{ id: 'p1', businessName: 'Real Plumber', status: 'researching', nextFollowUpDate: '2026-08-18', contactPreference: 'email_only', replyPermission: 'requested_quote_response_only', sourceQuotePublicReference: 'CMQ-LINKED', sourceQuoteMessage: 'Quote the shared mailer.', sourceQuoteServiceType: 'shared_model', sourceQuoteCity: 'Monterey', sourceQuoteQuantity: 5000, sourceQuoteSharedModelId: 'founding-9x12', sourceQuoteMailerLabel: '9x12 shared mailer', sourceQuoteTargeting: 'carrier routes', sourceQuoteFulfillment: 'turnkey', sourceQuoteIntakeStatus: 'accepted', sourceQuoteReviewQueueStatus: 'reviewed', sourceQuoteNotificationStatus: 'not_queued_disabled', sourceQuoteOutboundMessageStatus: 'not_sent', sourceQuoteSubmittedAt: '2026-08-18T18:00:00.000Z' }],
    [
      { id: 'i-linked', businessName: 'Real Plumber', status: 'promoted', prospectId: 'p1' },
      { id: 'i-new', businessName: 'Real Dentist', status: 'received' },
    ],
    [
      { id: 'q-linked', business: 'Real Plumber', status: 'promoted', prospectId: 'p1' },
      { id: 'q-new', publicReference: 'CMQ-1234ABCD', business: 'Real Bakery', name: 'Owner', status: 'new', message: 'Please quote a solo postcard.', contactPreference: 'email_only', replyPermission: 'requested_quote_response_only', serviceType: 'solo', city: 'Monterey', quantity: 5000, mailerSpecId: 'solo-6.5x9', mailerLabel: '6.5x9 postcard', targeting: 'radius', intakeStatus: 'accepted', reviewQueueStatus: 'queued', notificationStatus: 'not_queued_disabled', outboundMessageStatus: 'not_sent', createdAt: '2026-08-19T16:00:00.000Z' },
    ],
    '2026-08-19',
  );

  assert.deepEqual(opportunities.map((item) => item.id), ['prospect:p1', 'quote:q-new', 'interest:i-new']);
  assert.equal(opportunities[0].taskState, 'overdue');
  assert.equal(opportunities[0].contactPreference, 'email_only');
  assert.equal(opportunities[0].publicReference, 'CMQ-LINKED');
  assert.equal(opportunities[0].summary, 'Quote the shared mailer.');
  assert.equal(opportunities[0].serviceType, 'shared_model');
  assert.equal(opportunities[0].sharedModelId, 'founding-9x12');
  assert.equal(opportunities[0].mailerLabel, '9x12 shared mailer');
  assert.equal(opportunities[0].intakeStatus, 'accepted');
  assert.equal(opportunities[0].reviewQueueStatus, 'reviewed');
  assert.equal(opportunities[0].notificationStatus, 'not_queued_disabled');
  assert.equal(opportunities[0].outboundMessageStatus, 'not_sent');
  assert.equal(opportunities[0].submittedAt, '2026-08-18T18:00:00.000Z');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.summary, 'Please quote a solo postcard.');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.contactPreference, 'email_only');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.replyPermission, 'requested_quote_response_only');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.publicReference, 'CMQ-1234ABCD');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.quantity, '5000');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.mailerSpecId, 'solo-6.5x9');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.reviewQueueStatus, 'queued');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.notificationStatus, 'not_queued_disabled');
  assert.equal(opportunities.find((item) => item.id === 'quote:q-new')?.outboundMessageStatus, 'not_sent');
});

test('first-party add-ons disclose outside costs and never enable automation', () => {
  assert.deepEqual(CRM_ADDONS.map((addon) => addon.id), [
    'crm', 'pipeline', 'tasks', 'templates', 'economics', 'proofs', 'refunds', 'tracking',
  ]);
  assert.ok(CRM_ADDONS.every((addon) => addon.externalCostNote.length > 20));
  assert.ok(CRM_ADDONS.every((addon) => DEFAULT_CRM_ADDON_STATE[addon.id]));
  assert.equal(CRM_AUTOMATION_POLICY.outboundEmail, 'disabled');
  assert.equal(CRM_AUTOMATION_POLICY.sms, 'disabled');
  assert.equal(CRM_AUTOMATION_POLICY.calls, 'disabled');
  assert.equal(CRM_AUTOMATION_POLICY.openRelay, false);
  assert.equal(CRM_AUTOMATION_POLICY.clientDirectWrites, false);
});
