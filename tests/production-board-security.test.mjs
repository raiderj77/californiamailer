import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(path, 'utf8');

test('production board API is owner-only, bounded, parallel, private, and read-only', () => {
  const route = read('src/app/api/admin/production-board/route.ts');
  assert.match(route, /await requireOwner\(request\)/);
  assert.ok(route.indexOf('await requireOwner(request)') < route.indexOf('getAdminFirestore()'));
  assert.match(route, /await Promise\.all\(\[/);
  assert.match(route, /\.limit\(LIMITS\./);
  assert.match(route, /refunds: 500/);
  assert.match(route, /db\.collection\('refunds'\)\.limit\(LIMITS\.refunds\)\.get\(\)/);
  assert.match(route, /refunds: toRecords\(refunds\)/);
  assert.match(route, /refundReadPossiblyTruncated: refunds\.size >= LIMITS\.refunds/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
  assert.match(route, /boundedReadPossiblyTruncated: hitCollections\.length > 0/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(route, /\.add\(|\.create\(|\.set\(|\.update\(|\.delete\(|runTransaction|writeBatch|FieldValue/);
});

test('production board UI has distinct states, filters, safe client CSV, and owner navigation', () => {
  const page = read('src/app/(dashboard)/production-board/page.tsx');
  const sidebar = read('src/components/Sidebar.tsx');
  const helper = read('src/lib/productionBoard.ts');
  assert.match(page, /productionBoardCsv\(rows\)/);
  assert.match(page, /Reading bounded owner production records/);
  assert.match(page, /No real records match these filters/);
  assert.match(page, /role="alert"/);
  assert.match(page, /Has blockers/);
  assert.match(page, /Has unknowns/);
  assert.match(page, /Has record errors/);
  assert.match(helper, /\^\[\\t \]\*\[=\+\\-@\]/);
  assert.doesNotMatch(helper, /from '@\/lib\/advertiserPortal'|node:crypto|firebase-admin/);
  assert.match(helper, /activeLegacyReservationAccess\(reservation, now\)/);
  assert.match(helper, /activeRefundObligationSummary\(refunds, campaignId\)/);
  assert.match(helper, /isKnownRefundRecordStatus\(status\)/);
  assert.match(helper, /isActiveRefundObligationStatus\(status\)/);
  assert.match(helper, /refundStateIndex\(\s*input\.refunds,\s*campaigns,\s*reservations,\s*payments,\s*\)/);
  assert.match(helper, /payment\.data\.reservationId === reservationId/);
  assert.match(helper, /payment\.data\.campaignId === campaignId/);
  assert.match(helper, /reservation\.data\.campaignId === campaignId/);
  assert.match(helper, /active_refund_obligation_open/);
  assert.match(helper, /active_refund_integrity_invalid/);
  assert.match(helper, /refund_status_invalid/);
  assert.match(sidebar, /\{ name: 'Production Board', href: '\/production-board' \}/);
});
