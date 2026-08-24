import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EMPTY_CREATIVE_BRIEF,
  creativeBriefDeliveryValidationStatus,
  creativeBriefErrors,
  isCalendarDate,
  isSafeHttpsUrl,
  parseAssetRightsAttestation,
  parseCreativeBriefContent,
} from '../src/lib/creativeBrief';

function validBrief() {
  return {
    ...EMPTY_CREATIVE_BRIEF,
    businessDisplayName: 'Acme Dental',
    factualOffer: '$50 off a qualifying new-patient service',
    callToAction: 'Call to schedule',
    effectiveOn: '2026-09-01',
    expiresOn: '2026-09-30',
    qrDestination: 'https://www.example.com/campaign-offer',
  };
}

test('creative brief parser is exact, bounded, and normalizes display text', () => {
  const parsed = parseCreativeBriefContent({
    ...validBrief(),
    businessDisplayName: '  Acme\u0000   Dental  ',
  });
  assert.equal(parsed?.businessDisplayName, 'Acme Dental');
  assert.equal(parseCreativeBriefContent({ ...validBrief(), extra: 'not allowed' }), null);
  const missingField = { ...validBrief() };
  Reflect.deleteProperty(missingField, 'phone');
  assert.equal(parseCreativeBriefContent(missingField), null);
  assert.equal(parseCreativeBriefContent({
    ...validBrief(),
    businessDisplayName: '\uFB03'.repeat(60),
  }), null, 'normalization expansion must remain inside the stored field limit');
});

test('calendar and delivery validation fail closed around the planned campaign window', () => {
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2028-02-29'), true);
  assert.deepEqual(creativeBriefErrors(validBrief(), {
    startDate: '2026-09-05',
    endDate: '2026-09-25',
  }), []);
  assert.match(
    creativeBriefErrors({ ...validBrief(), effectiveOn: '2026-09-10' }, {
      startDate: '2026-09-05',
      endDate: '2026-09-25',
    }).join(' '),
    /effective on or before planned delivery begins/,
  );
  assert.match(
    creativeBriefErrors({ ...validBrief(), expiresOn: '2026-09-20' }, {
      startDate: '2026-09-05',
      endDate: '2026-09-25',
    }).join(' '),
    /remain valid through planned delivery/,
  );
  assert.equal(
    creativeBriefDeliveryValidationStatus({ startDate: null, endDate: null }),
    'campaign_schedule_not_set',
  );
  assert.equal(
    creativeBriefDeliveryValidationStatus({ startDate: '2026-09-05', endDate: null }),
    'validated_for_partial_planned_window',
  );
});

test('QR destinations require credential-free public HTTPS hosts', () => {
  assert.equal(isSafeHttpsUrl('https://offers.example.com/redeem?campaign=fall'), true);
  for (const unsafe of [
    'http://offers.example.com',
    'https://user:password@offers.example.com',
    'https://localhost/offer',
    'https://127.0.0.1/offer',
    'javascript:alert(1)',
  ]) {
    assert.equal(isSafeHttpsUrl(unsafe), false, unsafe);
    assert.match(
      creativeBriefErrors({ ...validBrief(), qrDestination: unsafe }, {
        startDate: null,
        endDate: null,
      }).join(' '),
      /credential-free HTTPS URL/,
    );
  }
});

test('asset rights attestation is explicit, exact, and source-aware', () => {
  const owned = parseAssetRightsAttestation({
    assetKind: 'logo',
    rightsBasis: 'business_owned',
    attestorName: 'Jane Owner',
    sourceOrLicenseNote: '',
    rightsAttested: true,
  });
  assert.equal(owned?.rightsAttested, true);
  assert.equal(parseAssetRightsAttestation({ ...owned, extra: 'not allowed' }), null);
  assert.equal(parseAssetRightsAttestation({
    assetKind: 'brand_image',
    rightsBasis: 'licensed_for_this_use',
    attestorName: 'Jane Owner',
    sourceOrLicenseNote: '',
    rightsAttested: true,
  }), null);
  assert.equal(parseAssetRightsAttestation({
    assetKind: 'brand_image',
    rightsBasis: 'licensed_for_this_use',
    attestorName: 'Jane Owner',
    sourceOrLicenseNote: 'Stock license 123',
    rightsAttested: false,
  }), null);
});
