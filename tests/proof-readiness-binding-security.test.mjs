import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('owner proof creation bounds buffering and commits exact immutable creative bindings', () => {
  const route = read('src/app/api/admin/proofs/route.ts');
  const post = route.slice(route.indexOf('export async function POST'));
  const transaction = post.slice(post.indexOf('await db.runTransaction'));
  assert.match(post, /MAX_MULTIPART_BYTES/);
  assert.ok(post.indexOf("request.headers.get('content-length')") < post.indexOf('request.formData()'));
  assert.match(post, /!\/\^\\d\+\$\/\.test\(declaredLengthHeader\)/);
  assert.match(post, /declaredLength > MAX_MULTIPART_BYTES/);
  assert.match(transaction, /const currentReservationSnapshot = await transaction\.get\(reservationRef\)/);
  assert.match(transaction, /currentReservation\.status !== 'paid'/);
  assert.match(transaction, /proofSequence\(currentReservation\.proofSequence\)/);
  assert.match(transaction, /transaction\.get\(db\.collection\('proofs'\)\.doc\(latestProofId\)\)/);
  assert.doesNotMatch(transaction, /collection\('proofs'\)\.where\('reservationId'/);
  assert.match(transaction, /transaction\.get\(db\.collection\('creativebriefs'\)\.doc\(creativeBriefId\)\)/);
  assert.match(transaction, /transaction\.get\(db\.collection\('materials'\)\.doc\(materialId\)\)/);
  assert.match(transaction, /hasCurrentCreativeBrief/);
  assert.match(transaction, /hasCurrentApprovedMaterialWithRights/);
  for (const field of [
    'placementSlotId: currentReservation.placementSlotId',
    'creativeBriefId,',
    'creativeBriefVersion,',
    'materialId,',
    'materialVersion,',
  ]) assert.ok(transaction.includes(field), field);
});

test('failed proof database commits best-effort delete the uploaded private object', () => {
  const route = read('src/app/api/admin/proofs/route.ts');
  assert.ok(route.indexOf('uploadedStoragePath = storagePath') < route.indexOf('await db.runTransaction'));
  assert.ok(route.indexOf('uploadedStoragePath = null') > route.indexOf('await db.runTransaction'));
  assert.match(route, /getAdminStorage\(\)\.file\(uploadedStoragePath\)\.delete\(\{ ignoreNotFound: true \}\)/);
  assert.match(route, /'Cache-Control': 'private, no-store'/);
});

test('authoritative print readiness consumes current briefs, rights, proof bindings, and full schedule', () => {
  const route = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const post = route.slice(route.indexOf('export async function POST'));
  assert.match(route, /completeCampaignDeliveryWindow\(data\)/);
  assert.match(route, /hasCurrentCreativeBrief\(reservation, creativeBrief, data\)/);
  assert.match(route, /hasCurrentApprovedMaterialWithRights\([\s\S]*reservation,[\s\S]*material,[\s\S]*new Date\(atMs\)/);
  assert.match(route, /latestBoundProofStatus\(reservation, proof, new Date\(atMs\)\)/);
  assert.match(route, /key: 'delivery_schedule'/);
  assert.match(route, /key: 'creative_briefs'/);
  assert.match(route, /canonicalPaidPaymentEvidence\(/);
  assert.match(route, /clearedFundingCents: canonicalPaymentEvidence\.clearedFundingCents/);
  assert.match(route, /key: 'canonical_payments'/);
  assert.match(route, /canonicalPaymentEvidence\.issues\.length === 0/);
  assert.match(route, /baseReadiness\.ready && creativeEvidenceChecks\.every/);
  assert.match(route, /db\.collection\('creativebriefs'\)\.where\('campaignId', '==', FOUNDING_CAMPAIGN\.id\)\.get\(\)/);
  assert.match(post, /transaction\.get\(db\.collection\('creativebriefs'\)\.where\('campaignId', '==', FOUNDING_CAMPAIGN\.id\)\)/);
});
