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
  assert.match(post, /briefReviewConfirmation !== PROOF_BRIEF_REVIEW_CONFIRMATION/);
  assert.match(post, /parseExpectedMaterialBindings/);
  for (const field of [
    'expectedCreativeBriefId',
    'expectedCreativeBriefVersion',
    'expectedMaterialBindings',
  ]) assert.match(post, new RegExp(field));
  assert.match(transaction, /const currentReservationSnapshot = await transaction\.get\(reservationRef\)/);
  assert.match(transaction, /currentReservation\.status !== 'paid'/);
  assert.match(transaction, /proofSequence\(currentReservation\.proofSequence\)/);
  assert.match(transaction, /transaction\.get\(db\.collection\('proofs'\)\.doc\(latestProofId\)\)/);
  assert.doesNotMatch(transaction, /collection\('proofs'\)\.where\('reservationId'/);
  assert.match(transaction, /transaction\.get\(db\.collection\('creativebriefs'\)\.doc\(creativeBriefId\)\)/);
  assert.match(transaction, /parseMaterialManifest\(currentReservation\.materialManifest\)/);
  assert.match(transaction, /sortedMaterialManifestEntries\(manifest\)/);
  assert.match(transaction, /materialPointers\.map\(\(pointer\) => transaction\.get/);
  assert.match(transaction, /hasReviewableCurrentCreativeBrief/);
  assert.match(transaction, /hasCurrentApprovedMaterialWithRights/);
  assert.match(transaction, /currentMaterialBindings\(reservationRecord, materialRecords\)/);
  assert.match(transaction, /creativeBriefId === expectedCreativeBriefId/);
  assert.match(transaction, /currentReservation\.creativeBriefSequence\) === expectedCreativeBriefVersion/);
  assert.match(transaction, /binding\.assetKind === expectedMaterialBindings\[index\]\.assetKind/);
  assert.ok(transaction.indexOf('if (!inputsStillMatch)') < transaction.indexOf('transaction.update(creativeBriefSnapshot.ref'));
  assert.match(transaction, /transaction\.update\(creativeBriefSnapshot\.ref,[\s\S]*status: CREATIVE_BRIEF_REVIEWED_STATUS/);
  assert.match(transaction, /reviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION/);
  assert.match(transaction, /creativeBriefReviewConfirmation: PROOF_BRIEF_REVIEW_CONFIRMATION/);
  for (const field of [
    'placementSlotId: currentReservation.placementSlotId',
    'creativeBriefId,',
    'creativeBriefVersion,',
    'materialBindings,',
    'creativeBriefStatus: CREATIVE_BRIEF_REVIEWED_STATUS',
  ]) assert.ok(transaction.includes(field), field);
});

test('owner GET exposes only exact current parsed briefs to the private proof UI', () => {
  const route = read('src/app/api/admin/proofs/route.ts');
  const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function POST'));
  assert.match(get, /await requireOwner\(request\)/);
  assert.match(get, /collection\('creativebriefs'\)/);
  assert.match(get, /reservation\.latestCreativeBriefId !== doc\.id/);
  assert.match(get, /parseCreativeBriefContent\(data\.content\)/);
  assert.match(get, /creativeBriefs: currentBriefs/);
  assert.doesNotMatch(get, /storagePath|accessTokenHash|email|phone/);
  const proofsMap = get.slice(get.indexOf('proofs: proofs.docs.map'), get.indexOf('materials: materials.docs.map'));
  const materialsMap = get.slice(get.indexOf('materials: materials.docs.map'), get.indexOf('creativeBriefs: currentBriefs'));
  assert.doesNotMatch(proofsMap, /rightsAttestation|rightsAttestedAt/);
  assert.match(materialsMap, /rightsAttestation/);
  assert.match(materialsMap, /rightsAttestedAt/);
});

test('owner UI sends the exact viewed inputs and renders the complete brief and rights evidence', () => {
  const page = read('src/app/(dashboard)/proof-workflow/page.tsx');
  for (const field of [
    'expectedCreativeBriefId',
    'expectedCreativeBriefVersion',
    'expectedMaterialBindings',
    'businessDisplayName',
    'displayPhone',
    'displayWebsite',
    'displayAddress',
    'brandColors',
    'brandGuidelines',
    'evidenceNotes',
    'deliveryWindow',
    'rightsBasis',
    'attestorName',
    'sourceOrLicenseNote',
    'statementVersion',
    'rightsAttestedAt',
  ]) assert.match(page, new RegExp(field));
  assert.match(page, /disabled=\{!selectedBrief \|\| !selectedBindings\}/);
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
  assert.match(route, /hasCurrentCreativeBrief\(reservation, creativeBrief, data, now\)/);
  assert.match(route, /hasCurrentApprovedMaterialWithRights\([\s\S]*reservation,[\s\S]*materials,[\s\S]*now/);
  assert.match(route, /latestBoundProofStatus\(reservation, proof, now\)/);
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
