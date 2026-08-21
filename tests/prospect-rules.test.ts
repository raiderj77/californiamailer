import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prospect } from '../src/lib/firestore';
import { categoryConflict, contactGate, duplicateReasons, isCurrentProspectStatus, isLegacyOperationalProspectStatus } from '../src/lib/prospectRules';

const base: Prospect = {
  id: 'one', businessName: 'Acme Plumbing, LLC', contactName: '', email: 'hello@acme.test', phone: '(831) 555-0101',
  address: '', city: 'Monterey', territoryId: '', territoryName: '', status: 'researching', notes: '', userId: 'owner',
  website: 'https://www.acme.test/', businessCategory: 'Plumber', campaignId: 'founding-monterey',
};

test('duplicate detection normalizes common business suffixes and contact fields', () => {
  assert.deepEqual(
    duplicateReasons([base], { businessName: 'ACME PLUMBING INC.', email: 'HELLO@ACME.TEST' }),
    ['business name', 'email'],
  );
});

test('faceless contact queue requires evidence, source verification, qualification, and no suppression', () => {
  assert.equal(contactGate(base).allowed, false);
  const qualified = {
    ...base,
    contactName: 'Business owner',
    contactRole: 'Owner',
    serviceArea: 'Monterey Peninsula',
    mailingTerritoryFit: 'Serves the selected campaign territory',
    qualificationStatus: 'qualified' as const,
    activeAdvertisingEvidence: 'Current offer on official website',
    officialSource: 'https://acme.test',
    officialSourceCheckedAt: '2026-08-17',
  };
  assert.equal(contactGate(qualified).allowed, true);
  assert.equal(contactGate({ ...qualified, doNotContact: true }).allowed, false);
});

test('prospect list warns about live same-campaign category conflicts', () => {
  assert.equal(categoryConflict([base], { businessCategory: 'plumber', campaignId: 'FOUNDING-MONTEREY' }).length, 1);
  assert.equal(categoryConflict([{ ...base, status: 'poor_fit' }], { businessCategory: 'plumber', campaignId: 'founding-monterey' }).length, 0);
});

test('CSV status validation rejects arbitrary status text', () => {
  assert.equal(isCurrentProspectStatus('ready_to_contact'), true);
  assert.equal(isCurrentProspectStatus('paid'), false);
  assert.equal(isCurrentProspectStatus('reserved'), false);
  assert.equal(isLegacyOperationalProspectStatus('paid'), true);
  assert.equal(isLegacyOperationalProspectStatus('reserved'), true);
  assert.equal(isCurrentProspectStatus('send_everything'), false);
});
