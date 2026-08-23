import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('creative briefs are immutable versions with one transactionally checked reservation pointer', () => {
  const route = read('src/app/api/reservations/[id]/creative-brief/route.ts');
  const write = route.slice(route.indexOf('export async function PUT'));
  const transaction = write.slice(write.indexOf('await db.runTransaction'));
  const access = transaction.indexOf('assertReservationAccessInTransaction');
  const firstWrite = transaction.indexOf('transaction.create(briefRef');
  assert.ok(access >= 0 && firstWrite > access);
  assert.match(transaction, /reservation\.status !== 'paid'/);
  assert.match(transaction, /creativeBriefSequence\(reservation\.creativeBriefSequence\)/);
  assert.match(transaction, /previousCreativeBriefId: storedSequence > 0 \? latestId : null/);
  assert.match(transaction, /transaction\.create\(briefRef/);
  assert.match(transaction, /latestCreativeBriefId: briefRef\.id/);
  assert.match(transaction, /creativeBriefSequence: nextVersion/);
  assert.match(transaction, /creativeBriefStatus: CREATIVE_BRIEF_STATUS/);
  assert.match(transaction, /creativeBriefReviewedAt: null/);
  assert.match(transaction, /creativeBriefReviewedBy: null/);
  assert.match(transaction, /ownerPrintApproved: false,[\s\S]*printReadyAt: null,[\s\S]*artworkPreflightApproved: false/);
  assert.match(transaction, /printReadinessRevokedReason: 'creative_brief_updated'/);
  assert.doesNotMatch(route, /transaction\.update\(briefRef|transaction\.set\(briefRef/);
});

test('creative brief reads and writes are private, bounded, schedule-aware, and current-access checked', () => {
  const route = read('src/app/api/reservations/[id]/creative-brief/route.ts');
  const get = route.slice(route.indexOf('export async function GET'), route.indexOf('export async function PUT'));
  const put = route.slice(route.indexOf('export async function PUT'));
  assert.match(get, /db\.runTransaction/);
  assert.match(get, /assertReservationAccessInTransaction\(transaction, id, accessToken\)/);
  assert.match(get, /reservation\.status !== 'paid'/);
  assert.match(route, /Cache-Control': 'private, no-store'/);
  assert.match(put, /origin !== request\.nextUrl\.origin/);
  assert.match(put, /MAX_REQUEST_BYTES/);
  assert.match(put, /contentLengthHeader = request\.headers\.get\('content-length'\)/);
  assert.match(put, /A valid positive Content-Length header is required/);
  assert.ok(
    put.indexOf("request.headers.get('content-length')") < put.indexOf('await request.text()'),
  );
  assert.match(put, /Buffer\.byteLength\(rawBody, 'utf8'\)/);
  assert.match(put, /contentType !== 'application\/json'/);
  assert.match(route, /creativeBriefErrors\(content, savedWindow\)/);
  assert.match(put, /deliveryWindow: serializeDeliveryWindow\(savedWindow\)/);
  assert.match(route, /planned delivery window is invalid/);
  assert.doesNotMatch(route, /stripe|sendEmail|mailgun|twilio/i);
});

test('every new material version stores explicit rights and atomically revokes print readiness', () => {
  const route = read('src/app/api/reservations/[id]/materials/route.ts');
  const privateUploads = read('src/lib/privateUploads.ts');
  const readPaid = route.slice(route.indexOf('function readPaidMaterials'), route.indexOf('export async function GET'));
  const post = route.slice(route.indexOf('export async function POST'));
  const transaction = post.slice(post.indexOf('await db.runTransaction'));
  assert.match(post, /origin !== request\.nextUrl\.origin/);
  assert.match(route, /const MAX_MULTIPART_BYTES = 5 \* 1024 \* 1024 \+ 24_000/);
  assert.match(privateUploads, /advertiser_logo: \{ maximum: 5 \* 1024 \* 1024/);
  assert.match(post, /contentLengthHeader = request\.headers\.get\('content-length'\)/);
  assert.match(post, /valid positive Content-Length header is required/);
  assert.match(post, /Number\.isSafeInteger\(declaredLength\)/);
  assert.ok(
    post.indexOf("request.headers.get('content-length')") < post.indexOf('await request.formData()'),
    'the bounded Content-Length gate must run before multipart parsing',
  );
  assert.match(post, /parseRightsForm\(form\)/);
  assert.match(post, /validatePrivateUpload\(file, 'advertiser_logo'\)/);
  assert.match(route, /MATERIAL_FORM_FIELDS/);
  assert.match(route, /rightsAttested: form\.get\('rightsAttested'\) === 'true'/);
  assert.match(readPaid, /currentMaterialState\(transaction, db, access\.data, id, binding\)/);
  assert.match(readPaid, /state\.records\.map/);
  assert.doesNotMatch(readPaid, /\.where\(/);
  assert.match(transaction, /assertReservationAccessInTransaction/);
  assert.match(transaction, /requirePaidReservation\(currentAccess\.data, initialBinding\)/);
  assert.match(transaction, /materialSequence\(currentReservation\.materialSequence\)/);
  assert.match(transaction, /currentMaterialState\([\s\S]*currentReservation,[\s\S]*currentBinding/);
  assert.match(route, /Math\.max\(\.\.\.pointers\.map\(\(\{ version \}\) => version\)\) !== sequence/);
  assert.match(route, /pointers\.filter\(\(pointer\) => \([\s\S]*pointer\.materialId === latestId && pointer\.version === sequence[\s\S]*\)\.length !== 1/);
  assert.match(transaction, /previousPointer = state\.manifest\[rights\.assetKind\]/);
  assert.match(transaction, /nextManifest:[\s\S]*\.\.\.state\.manifest,[\s\S]*\[rights\.assetKind\]/);
  assert.match(transaction, /previousMaterialId: previousPointer\?\.materialId \?\? null/);
  assert.match(transaction, /materialManifest: nextManifest/);
  assert.doesNotMatch(transaction, /\.where\(/);
  assert.match(transaction, /rightsAttestation: \{[\s\S]*\.\.\.rights,[\s\S]*statementVersion: ASSET_RIGHTS_STATEMENT_VERSION/);
  assert.match(transaction, /rightsAttestedAt: FieldValue\.serverTimestamp\(\)/);
  assert.match(transaction, /ownerPrintApproved: false,[\s\S]*printReadyAt: null,[\s\S]*artworkPreflightApproved: false/);
  assert.match(transaction, /printReadinessRevokedReason: 'material_uploaded'/);
  assert.match(post, /getAdminStorage\(\)\.file\(uploadedStoragePath\)\.delete\(\{ ignoreNotFound: true \}\)/);
});

test('portal UI separates loading, error, empty, version, and rights-attestation states', () => {
  const panel = read('src/components/reservation/ReservationProductionPanel.tsx');
  for (const text of [
    'Checking the private structured creative brief',
    'No saved brief yet',
    'Saved version',
    'No private materials have been received',
    'Missing a valid stored rights attestation',
    'Save new brief version for owner review',
    'Upload private asset with attestation',
  ]) assert.match(panel, new RegExp(text));
  assert.match(panel, /creativeError/);
  assert.match(panel, /rightsBasis/);
  assert.match(panel, /rightsAttested/);
  assert.match(panel, /ASSET_RIGHTS_STATEMENT/);
  assert.match(panel, /isCreativeBriefDeliveryWindow\(result\.deliveryWindow\)/);
  assert.match(panel, /creativeBrief,[\s\S]*initialContent: null,[\s\S]*deliveryWindow/);
});

test('creative brief collection explicitly denies browser reads and writes', () => {
  const rules = read('firestore.rules');
  assert.match(
    rules,
    /match \/creativebriefs\/\{docId\} \{[\s\S]*?allow read, write: if false/,
  );
});
