import assert from 'node:assert/strict';
import test from 'node:test';
import type { Prospect } from '../src/lib/firestore';
import { canonicalizeProspectSuppression, categoryConflict, contactGate, duplicateReasons, isCurrentProspectStatus, isLegacyOperationalProspectStatus, isProspectSuppressed } from '../src/lib/prospectRules';
import {
  highConfidenceProspectIdentityMatches,
  normalizeBusinessName,
  normalizeEmail,
  normalizePhone,
  normalizeWebsite,
  prospectBusinessIdentityCorroborates,
  prospectIdentityQuerySpecs,
} from '../src/lib/prospectIdentity';
import { isRecordSuppressed } from '../src/lib/suppression';

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

test('canonical prospect identities are shared and high-confidence matches cover raw legacy records', () => {
  assert.equal(normalizeEmail('  SALES@Example.COM '), 'sales@example.com');
  assert.equal(normalizePhone('+1 (831) 555-0101'), '8315550101');
  assert.equal(normalizePhone('555-0101'), '');
  assert.equal(normalizeWebsite('https://WWW.Example.com/contact/?from=mailer'), 'example.com');
  assert.equal(normalizeBusinessName('Example Plumbing, LLC'), 'exampleplumbing');

  const candidate = {
    businessName: 'Example Plumbing LLC',
    email: 'sales@example.com',
    phone: '(831) 555-0101',
    website: 'https://example.com/quote',
  };
  const rawOnlyLegacy = {
    businessName: 'EXAMPLE PLUMBING INC.',
    email: 'SALES@EXAMPLE.COM',
    phone: '1-831-555-0101',
    website: 'https://www.example.com/',
  };
  assert.deepEqual(highConfidenceProspectIdentityMatches(candidate, rawOnlyLegacy), ['email', 'phone', 'website']);
  assert.equal(prospectBusinessIdentityCorroborates(candidate, rawOnlyLegacy), true);
  assert.ok(prospectIdentityQuerySpecs(candidate).every((spec) => spec.value.length > 0));
  assert.equal(prospectIdentityQuerySpecs({ businessName: 'Name only' }).some((spec) => spec.highConfidence), false);
});

test('all suppression markers normalize to a sticky do-not-contact state', () => {
  const markers: Partial<Prospect>[] = [
    { doNotContact: true },
    { suppressed: true },
    { status: 'do_not_contact' as const },
  ];
  for (const marker of markers) {
    assert.equal(isProspectSuppressed(marker), true);
    assert.deepEqual(
      canonicalizeProspectSuppression(marker),
      { ...marker, status: 'do_not_contact', doNotContact: true, suppressed: true },
    );
  }
  assert.equal(isRecordSuppressed({ status: 'suppressed' }), true);
  assert.equal(isProspectSuppressed({ status: 'researching', doNotContact: false }), false);
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
