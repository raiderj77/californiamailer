import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('economics edits and print approval consume one current transaction snapshot', () => {
  const route = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const put = route.slice(route.indexOf('export async function PUT'), route.indexOf('export async function POST'));
  const post = route.slice(route.indexOf('export async function POST'));

  const transactionIndex = put.indexOf('await db.runTransaction');
  const currentReadIndex = put.indexOf('const currentSnapshot = await transaction.get(ref)');
  const updateIndex = put.indexOf('transaction.update(ref, update)');
  const publicProjectionIndex = put.search(/transaction\.set\(\r?\n\s+db\.collection\('publiccampaigns'\)/);
  assert.ok(transactionIndex >= 0 && currentReadIndex > transactionIndex && updateIndex > currentReadIndex);
  assert.ok(publicProjectionIndex > currentReadIndex && publicProjectionIndex < updateIndex + 2_000);
  assert.match(put, /ECONOMICS_EDITABLE_STATUSES\.has\(String\(before\.status\)\)/);
  assert.match(route, /'scheduled_for_print'/);
  assert.match(post, /const currentSnapshot = await transaction\.get\(ref\)/);
  assert.match(post, /transaction\.get\(db\.collection\('reservations'\)\.where/);
  assert.match(post, /transaction\.get\(db\.collection\('proofs'\)\.where/);
  assert.match(post, /transaction\.get\(db\.collection\('materials'\)\.where/);
  assert.match(post, /transaction\.get\(db\.collection\('payments'\)\.where/);
  assert.match(post, /refundDocumentsWithLinkedEvidence\(\s*transaction,/);
});

test('readiness blocks every campaign payment-review relationship, including off-model ledgers', () => {
  const route = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const helper = route.slice(
    route.indexOf('function unresolvedPaymentReviewKeys'),
    route.indexOf('function readinessState'),
  );
  assert.match(helper, /for \(const document of paymentDocuments\)/);
  assert.match(helper, /\['pending', 'manual_review', 'disputed'\]/);
  assert.match(helper, /\['payment_review', 'disputed'\]/);
  assert.doesNotMatch(helper, /FOUNDING_CAMPAIGN\.planId|offerModelVersion/);
  assert.match(route, /unresolvedPaymentReviewKeys\([\s\S]*reservations,[\s\S]*paymentDocuments/);
});

test('proof and per-kind material pointers serialize on the reservation document', () => {
  const proof = read('src/app/api/admin/proofs/route.ts');
  const materialUpload = read('src/app/api/reservations/[id]/materials/route.ts');
  const materialReview = read('src/app/api/admin/materials/[id]/route.ts');

  for (const [source, sequence, pointer] of [
    [proof, 'proofSequence', 'latestProofId'],
    [materialUpload, 'materialSequence', 'latestMaterialId'],
  ]) {
    assert.match(source, /db\.runTransaction\(async \(transaction\) =>/);
    assert.match(source, /const (?:currentReservationSnapshot|currentAccess) = await (?:transaction\.get|assertReservationAccessInTransaction)/);
    assert.match(source, new RegExp(`${sequence}: nextVersion`));
    assert.match(source, new RegExp(`${pointer}: (?:proofRef|materialRef)\\.id`));
    assert.doesNotMatch(source, /const version = existing\.docs\.reduce/);
  }

  assert.match(proof, /transaction\.get\(db\.collection\('proofs'\)\.doc\(latestProofId\)\)/);
  assert.doesNotMatch(
    proof.slice(proof.indexOf('export async function POST')),
    /collection\('proofs'\)\.where\('reservationId'/,
  );
  assert.match(materialUpload, /currentMaterialState\([\s\S]*currentReservation/);
  assert.match(materialUpload, /previousPointer = state\.manifest\[rights\.assetKind\]/);
  assert.match(materialUpload, /materialManifest: nextManifest/);
  assert.doesNotMatch(materialUpload, /collection\('materials'\)\.where\('reservationId'/);

  assert.match(materialReview, /db\.runTransaction\(async \(transaction\) =>/);
  assert.match(materialReview, /parseMaterialManifest\(reservation\.materialManifest\)/);
  assert.match(materialReview, /targetPointer\.materialId !== ref\.id/);
  assert.match(materialReview, /currentMaterialBindings/);
  assert.match(materialReview, /material\.status !== 'quarantine_pending_owner_review'/);
  assert.match(materialReview, /aggregateStatus/);
});

test('authoritative print gates transactionally load bounded provider-global payment collisions', () => {
  const economics = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const providerEvidence = read('src/lib/paymentProviderEvidence.ts');
  for (const route of [economics, lifecycle]) {
    assert.match(route, /paymentDocumentsWithProviderCollisions\(\s*transaction,\s*db,\s*payments\.docs/);
  }
  assert.match(providerEvidence, /PROVIDER_ID_QUERY_CHUNK_SIZE = 10/);
  assert.match(providerEvidence, /PROVIDER_EVIDENCE_SOURCE_LIMIT = 50/);
  assert.match(providerEvidence, /PROVIDER_EVIDENCE_RESULT_LIMIT = 100/);
  assert.match(providerEvidence, /\.where\(field, 'in', values\)/);
  assert.match(providerEvidence, /externalPaymentId/);
  assert.match(providerEvidence, /externalSessionId/);
  assert.match(providerEvidence, /externalCheckoutSessionId/);
  assert.match(providerEvidence, /field: 'reservationId'/);
  assert.match(providerEvidence, /paymentProviderIdentifierEvidence/);
  assert.match(providerEvidence, /payment-provider-evidence-noncanonical-id/);
  assert.match(providerEvidence, /payment-provider-evidence-session-alias-mismatch/);
  assert.match(providerEvidence, /db\.collection\('payments'\)\.limit\(PROVIDER_EVIDENCE_RESULT_LIMIT \+ 1\)/);
  assert.match(providerEvidence, /globalPaymentRelevance/);
  assert.match(providerEvidence, /payment-provider-evidence-noncanonical-global-collision/);
  assert.match(providerEvidence, /payment-provider-evidence-global-limit/);
  assert.doesNotMatch(providerEvidence, /data\[field\]\.trim\(\)/);
});

test('post-schedule readiness revocation has an explicit safe reapproval path before print evidence', () => {
  const economics = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const readiness = read('src/lib/campaignPrintReadiness.ts');
  const editable = economics.slice(
    economics.indexOf('const ECONOMICS_EDITABLE_STATUSES'),
    economics.indexOf('function assertActiveSharedModel'),
  );
  assert.match(editable, /'scheduled_for_print'/);
  assert.match(economics, /\['proofing', 'scheduled_for_print'\]\.includes\(String\(current\.status\)\)/);
  assert.match(economics, /authoritativeActiveRefundObligationSummary\(/);
  assert.match(economics, /refundObligationCount: refundObligation\.activeCount/);
  assert.match(economics, /refundObligationIntegrityIssueCount: refundObligation\.integrityIssueCount/);
  assert.match(economics, /ownerPrintApprovalEvidence\(data, atMs, approvalCandidateAtMs\)/);
  assert.match(economics, /const approvalCandidateAtMs = Date\.now\(\)/);
  assert.match(
    economics,
    /providerEvidencePayments,\s*approvalCandidateAtMs,\s*placementSlots\.docs,\s*placementSlots\.size > PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT,\s*\);/,
  );
  assert.match(lifecycle, /\['schedule_for_print', 'record_printed'\]\.includes\(action\)/);
  assert.match(lifecycle, /campaignPrintReadinessState\(/);
  assert.match(lifecycle, /if \(!operations\.readiness\.ready\)/);
  assert.match(readiness, /recordedTimestampMillis\(data\.printReadyAt\)/);
  assert.match(readiness, /ownerPrintApprovalRecorded/);
  for (const collection of [
    'reservations',
    'proofs',
    'materials',
    'creativebriefs',
    'payments',
  ]) {
    assert.match(lifecycle, new RegExp(`transaction\\.get\\(db\\.collection\\('${collection}'\\)`));
  }
  assert.match(lifecycle, /transaction\.get\(\s*db\.collection\('placementslots'\)/);
  for (const route of [economics, lifecycle]) {
    assert.match(route, /PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT \+ 1/);
    assert.match(route, /placementSlots\.size > PRINT_PLACEMENT_EVIDENCE_RECORD_LIMIT/);
  }
});

test('authoritative refund evidence is bounded, global, linked, and consumed before lifecycle writes', () => {
  const economics = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const refundAdmin = read('src/app/api/admin/refunds/route.ts');
  const evidence = read('src/lib/refundEvidence.ts');

  assert.match(evidence, /REFUND_QUERY_CHUNK_SIZE = 10/);
  assert.match(evidence, /REFUND_EVIDENCE_SOURCE_LIMIT = 50/);
  assert.match(evidence, /REFUND_EVIDENCE_RESULT_LIMIT = 100/);
  assert.match(evidence, /field: 'status',[\s\S]*operator: 'in'/);
  assert.match(evidence, /field: 'campaignId',[\s\S]*operator: '=='/);
  assert.match(evidence, /field: 'paymentId',[\s\S]*operator: 'in'/);
  assert.match(evidence, /field: 'reservationId',[\s\S]*operator: 'in'/);
  assert.match(
    evidence,
    /db\.collection\('refunds'\)\.limit\(REFUND_EVIDENCE_RESULT_LIMIT \+ 1\)/,
  );
  assert.match(evidence, /\.limit\(REFUND_EVIDENCE_RESULT_LIMIT \+ 1\)/);
  assert.match(evidence, /snapshot\.size > REFUND_EVIDENCE_RESULT_LIMIT/);
  assert.match(evidence, /documentsById\.size > REFUND_EVIDENCE_RESULT_LIMIT/);
  assert.match(evidence, /authoritativeActiveRefundObligationSummary/);
  assert.match(evidence, /paymentReservationById\.get\(paymentId\) !== reservationId/);

  for (const route of [economics, lifecycle, refundAdmin]) {
    assert.match(route, /refundDocumentsWithLinkedEvidence\(/);
  }
  const cancellation = lifecycle.slice(
    lifecycle.indexOf("if (parsed.data.action === 'cancel_campaign')"),
    lifecycle.indexOf("if (parsed.data.action === 'close_cancelled')"),
  );
  const closeCancellation = lifecycle.slice(
    lifecycle.indexOf("if (parsed.data.action === 'close_cancelled')"),
    lifecycle.indexOf('const unpublished = await db.runTransaction'),
  );
  assert.ok(
    cancellation.indexOf('refundDocumentsWithLinkedEvidence(')
      < cancellation.indexOf('transaction.create(db.collection(\'refunds\')'),
  );
  assert.ok(
    closeCancellation.indexOf('refundDocumentsWithLinkedEvidence(')
      < closeCancellation.indexOf('transaction.update(campaignRef'),
  );
});

test('printing snapshots exact creative bindings and every post-print mutation path is locked', () => {
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const creativeBrief = read('src/app/api/reservations/[id]/creative-brief/route.ts');
  const materialUpload = read('src/app/api/reservations/[id]/materials/route.ts');
  const materialReview = read('src/app/api/admin/materials/[id]/route.ts');
  const proofCreate = read('src/app/api/admin/proofs/route.ts');
  const proofDecision = read('src/app/api/reservations/[id]/proofs/route.ts');

  assert.match(lifecycle, /buildPrintedInputSnapshot\(/);
  assert.match(lifecycle, /printedInputSnapshotRecordedAt\s*=\s*FieldValue\.serverTimestamp\(\)/);
  assert.match(lifecycle, /action === 'record_delivered'/);
  assert.match(lifecycle, /printedInputSnapshotMatches\(/);
  for (const route of [
    creativeBrief,
    materialUpload,
    materialReview,
    proofCreate,
    proofDecision,
  ]) {
    assert.match(route, /campaignCreativeInputsLocked\(/);
  }
});

test('publish, deactivate, and unpublish lifecycle writes re-read the campaign in their transactions', () => {
  const route = read('src/app/api/admin/campaigns/founding/route.ts');
  for (const marker of ['const publishResult', 'const deactivated', 'const unpublished']) {
    const start = route.indexOf(marker);
    assert.ok(start >= 0, `${marker} must exist`);
    const source = route.slice(start, start + 2_500);
    assert.match(source, /db\.runTransaction/);
    assert.match(source, /transaction\.get\(campaignRef\)/);
  }
  assert.match(route, /const PUBLISHABLE_STATUSES/);
  const publishable = route.slice(
    route.indexOf('const PUBLISHABLE_STATUSES'),
    route.indexOf('function activationBlockers'),
  );
  assert.doesNotMatch(publishable, /'draft'|'completed'|'cancelled'|'refunding'/);
  assert.match(route, /\}\)\.strict\(\);/);
});

test('checkout URL and late-payment decisions remain bound to durable and signed-time evidence', () => {
  const reservation = read('src/app/api/reservations/route.ts');
  const webhook = read('src/app/api/webhook/route.ts');
  const checkout = reservation.slice(
    reservation.indexOf('let checkoutUrl'),
    reservation.indexOf('let projectionStatus'),
  );
  assert.ok(checkout.indexOf('checkoutUrl = session.url') > checkout.indexOf('stripeCheckoutSessionId: session.id'));
  assert.match(reservation, /const reservationSchema = z\.object\([\s\S]*\)\.strict\(\);/);
  assert.match(webhook, /providerEventOccurredAtMs/);
  assert.match(webhook, /event\.created \* 1_000/);
  assert.match(webhook, /reservation_hold_expired_at_provider_event/);
  assert.match(webhook, /status: releasedSlotStatus\(campaignSnapshot\.data\(\)\)/);
});

test('activation, reservation, payment, and production transactions recheck exact current route evidence', () => {
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const economics = read('src/app/api/admin/campaigns/founding/economics/route.ts');
  const reservation = read('src/app/api/reservations/route.ts');
  const webhook = read('src/app/api/webhook/route.ts');
  const gates = read('src/lib/campaignOperationalGates.ts');

  for (const marker of [
    "if (parsed.data.action === 'activate_reservations')",
    "if (parsed.data.action === 'begin_proofing')",
    "if (['schedule_for_print', 'record_printed'].includes(action))",
  ]) {
    const section = lifecycle.slice(lifecycle.indexOf(marker), lifecycle.indexOf(marker) + 6_500);
    assert.match(section, /transaction\.get\(db\.collection\('routeplans'\)\.doc\(routePlanId\)\)/);
    assert.match(section, /campaignOperationalEvidenceBlockReason/);
  }
  assert.match(economics, /transaction\.get\(db\.collection\('routeplans'\)\.doc\(routePlanId\)\)/);
  assert.match(economics, /campaignOperationalEvidenceBlockReason/);

  assert.ok(reservation.match(/transaction\.get\(db\.collection\('routeplans'\)\.doc\(currentRoutePlanId\)\)/g)?.length >= 2);
  assert.ok(reservation.match(/campaignOperationalEvidenceBlockReason\(/g)?.length >= 3);
  assert.match(webhook, /campaignOperationalEvidenceBlockReason\([\s\S]*providerEventOccurredAtMs/);
  assert.match(gates, /assertStoredRoutePlanIntegrity\(routePlan\)/);
  assert.match(gates, /planRecheckedMs > atMs/);
  assert.match(gates, /economicsVerifiedMs > atMs/);
});

test('checkout activation transaction blocks unresolved active-model records with bounded fail-closed reads', () => {
  const lifecycle = read('src/app/api/admin/campaigns/founding/route.ts');
  const activation = lifecycle.slice(
    lifecycle.indexOf("if (parsed.data.action === 'activate_reservations')"),
    lifecycle.indexOf("if (parsed.data.action === 'deactivate_reservations')"),
  );
  const transactionIndex = activation.indexOf('await db.runTransaction');
  const reservationReadIndex = activation.indexOf("db.collection('reservations')");
  const paymentReadIndex = activation.indexOf("db.collection('payments')");
  const blockerIndex = activation.indexOf('if (blockers.length)');
  const activationWriteIndex = activation.indexOf('transaction.update(campaignRef');

  assert.match(lifecycle, /const ACTIVATION_REVIEW_RECORD_LIMIT = 100/);
  assert.ok(transactionIndex >= 0);
  assert.ok(reservationReadIndex > transactionIndex && paymentReadIndex > transactionIndex);
  assert.ok(blockerIndex > reservationReadIndex && blockerIndex > paymentReadIndex);
  assert.ok(activationWriteIndex > blockerIndex);
  assert.ok(activation.match(/\.limit\(ACTIVATION_REVIEW_RECORD_LIMIT \+ 1\)/g)?.length === 2);
  assert.match(activation, /reservationReviewSnapshot\.size > ACTIVATION_REVIEW_RECORD_LIMIT/);
  assert.match(activation, /paymentReviewSnapshot\.size > ACTIVATION_REVIEW_RECORD_LIMIT/);
  assert.match(activation, /reservation\.planId === FOUNDING_CAMPAIGN\.planId/);
  assert.match(activation, /reservation\.offerModelVersion === FOUNDING_CAMPAIGN\.offerModelVersion/);
  assert.match(activation, /payment\.planId === FOUNDING_CAMPAIGN\.planId/);
  assert.match(activation, /payment\.offerModelVersion === FOUNDING_CAMPAIGN\.offerModelVersion/);
  assert.match(lifecycle, /const ACTIVATION_BLOCKING_PAYMENT_STATUSES = new Set\(\[\s*'pending',\s*'manual_review',\s*'disputed'/);
  assert.match(lifecycle, /const ACTIVATION_BLOCKING_RESERVATION_STATUSES = new Set\(\[\s*'payment_review',\s*'disputed'/);
  assert.match(activation, /hasUnresolvedActiveModelReservation \|\| hasUnresolvedActiveModelPayment/);
  assert.doesNotMatch(activation, /transaction\.(?:update|set|delete)\((?:reservation|payment)/);
});
