import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeCouponCode,
  safeTrackingDestination,
  summarizeRedirectRequests,
  summarizeSelfReportedMetrics,
} from '../src/lib/trackingRules';

test('tracking redirects accept only public HTTPS destinations without credentials', () => {
  assert.equal(safeTrackingDestination('https://example.com/offer?source=mailer'), 'https://example.com/offer?source=mailer');
  assert.equal(safeTrackingDestination('http://example.com'), null);
  assert.equal(safeTrackingDestination('https://user:password@example.com'), null);
  assert.equal(safeTrackingDestination('https://localhost/secret'), null);
  assert.equal(safeTrackingDestination('https://192.168.1.10/internal'), null);
});

test('coupon codes are normalized before uniqueness is enforced', () => {
  assert.equal(normalizeCouponCode(' summer deal!  '), 'SUMMERDEAL');
  assert.equal(normalizeCouponCode('CM-2026'), 'CM-2026');
});

test('unknown redirect classification is never counted as a non-bot request', () => {
  assert.deepEqual(summarizeRedirectRequests([
    { eventType: 'redirect_visit', suspectedBot: false },
    { eventType: 'redirect_visit', suspectedBot: true },
    { eventType: 'redirect_visit' },
    { eventType: 'unrelated', suspectedBot: false },
  ]), {
    nonBotHttpRequests: 1,
    suspectedBotHttpRequests: 1,
    unknownClassificationHttpRequests: 1,
  });
});

test('advertiser-reported metrics remain a separate validated total', () => {
  const totals = summarizeSelfReportedMetrics([
    { metricType: 'lead', quantity: 2 },
    { metricType: 'lead', quantity: 3 },
    { metricType: 'coupon_redemption', quantity: 1 },
    { metricType: 'invented', quantity: 100 },
    { metricType: 'sale', quantity: -1 },
  ]);
  assert.equal(totals.lead, 5);
  assert.equal(totals.coupon_redemption, 1);
  assert.equal(totals.sale, 0);
  assert.equal('invented' in totals, false);
});
