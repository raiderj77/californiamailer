import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { currentMaterialBindings } from '@/lib/businessRules';
import { campaignCreativeInputsLocked } from '@/lib/campaignLifecycle';
import {
  ASSET_RIGHTS_STATEMENT_VERSION,
  parseAssetRightsAttestation,
  parseMaterialManifest,
  sortedMaterialManifestEntries,
} from '@/lib/creativeBrief';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const schema = z.object({ action: z.enum(['approve', 'reject']) }).strict();

function recordedAt(value: unknown) {
  const milliseconds = Number((value as { toMillis?: () => unknown } | null)?.toMillis?.());
  return Number.isFinite(milliseconds) ? milliseconds : 0;
}

function hasValidStoredRights(material: Record<string, unknown>) {
  const rights = material.rightsAttestation;
  if (typeof rights !== 'object' || rights === null || Array.isArray(rights)) return false;
  const record = rights as Record<string, unknown>;
  return record.statementVersion === ASSET_RIGHTS_STATEMENT_VERSION
    && record.assetKind === material.assetKind
    && recordedAt(material.rightsAttestedAt) > 0
    && Boolean(parseAssetRightsAttestation({
      assetKind: record.assetKind,
      rightsBasis: record.rightsBasis,
      attestorName: record.attestorName,
      sourceOrLicenseNote: record.sourceOrLicenseNote,
      rightsAttested: record.rightsAttested,
    }));
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner(request);
    const { id } = await params;
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: 'Invalid material review.' }, { status: 400 });
    const db = getAdminFirestore();
    const ref = db.collection('materials').doc(id);
    const status = parsed.data.action === 'approve' ? 'owner_approved_private' : 'rejected';
    const result = await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return { success: false as const, reason: 'missing' as const };
      const material = snapshot.data()!;
      if (typeof material.campaignId !== 'string' || typeof material.reservationId !== 'string') {
        return { success: false as const, reason: 'invalid' as const };
      }
      const reservationRef = db.collection('reservations').doc(material.reservationId);
      const campaignRef = db.collection('campaigns').doc(material.campaignId);
      const [reservationSnapshot, campaignSnapshot] = await Promise.all([
        transaction.get(reservationRef),
        transaction.get(campaignRef),
      ]);
      const reservation = reservationSnapshot.data();
      if (
        !reservation
        || reservation.campaignId !== material.campaignId
        || !campaignSnapshot.exists
      ) {
        return { success: false as const, reason: 'stale' as const };
      }
      if (campaignCreativeInputsLocked(campaignSnapshot.data()?.status)) {
        return { success: false as const, reason: 'locked' as const };
      }
      const manifestPresent = reservation.materialManifest !== undefined
        && reservation.materialManifest !== null;
      const manifest = manifestPresent ? parseMaterialManifest(reservation.materialManifest) : null;
      if (manifestPresent && !manifest) {
        return { success: false as const, reason: 'stale' as const };
      }
      const pointers = manifest
        ? sortedMaterialManifestEntries(manifest)
        : [{
            assetKind: material.assetKind,
            materialId: reservation.latestMaterialId,
            version: reservation.materialSequence,
          }];
      const targetPointer = pointers.find((pointer) => pointer.assetKind === material.assetKind);
      if (
        !targetPointer
        || targetPointer.materialId !== ref.id
        || targetPointer.version !== material.version
      ) {
        return { success: false as const, reason: 'stale' as const };
      }
      const currentMaterials: Array<Record<string, unknown> & { id: string }> = [
        { id: snapshot.id, ...material },
      ];
      for (const pointer of pointers) {
        if (pointer.materialId === ref.id) continue;
        const currentSnapshot = await transaction.get(
          db.collection('materials').doc(String(pointer.materialId)),
        );
        if (!currentSnapshot.exists) {
          return { success: false as const, reason: 'stale' as const };
        }
        currentMaterials.push({ id: currentSnapshot.id, ...currentSnapshot.data()! });
      }
      if (!currentMaterialBindings({ id: reservationSnapshot.id, ...reservation }, currentMaterials)) {
        return { success: false as const, reason: 'stale' as const };
      }
      if (material.status !== 'quarantine_pending_owner_review') {
        return { success: false as const, reason: 'decided' as const };
      }
      if (parsed.data.action === 'approve' && !hasValidStoredRights(material)) {
        return { success: false as const, reason: 'rights' as const };
      }
      const resultingStatuses = currentMaterials.map((candidate) => (
        candidate.id === ref.id ? status : candidate.status
      ));
      const aggregateStatus = resultingStatuses.every((candidate) => candidate === 'owner_approved_private')
        ? 'approved'
        : resultingStatuses.some((candidate) => candidate === 'rejected')
          ? 'rejected'
          : 'received_pending_review';
      transaction.update(ref, {
        status,
        reviewedBy: owner.uid,
        reviewedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(reservationRef, {
        materialsStatus: aggregateStatus,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.update(campaignRef, {
        ownerPrintApproved: false,
        printReadyAt: null,
        artworkPreflightApproved: false,
        printReadinessRevokedAt: FieldValue.serverTimestamp(),
        printReadinessRevokedReason: `material_${parsed.data.action}`,
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        actorUid: owner.uid,
        action: `material.${parsed.data.action}`,
        entityId: id,
        summary: `Exact current ${String(material.assetKind)} material version ${Number(material.version || 0)} marked ${status}; not made public. Prior print readiness was revoked.`,
        createdAt: FieldValue.serverTimestamp(),
      });
      return { success: true as const };
    });
    if (!result.success) {
      if (result.reason === 'missing') return NextResponse.json({ error: 'Material not found.' }, { status: 404 });
      const message = result.reason === 'stale'
        ? 'Only the exact latest material can be reviewed.'
        : result.reason === 'locked'
          ? 'Creative inputs are locked because this campaign has already been recorded as printed.'
        : result.reason === 'rights'
          ? 'This current material lacks a valid stored rights attestation and cannot be approved.'
        : result.reason === 'decided'
          ? 'This material review has already been recorded.'
          : 'Material campaign is unavailable.';
      return NextResponse.json({ error: message }, { status: 409 });
    }
    return NextResponse.json({ success: true, status });
  } catch (error) {
    const status = error instanceof RequestAuthError ? error.status : 500;
    return NextResponse.json({ error: status === 500 ? 'Material review failed.' : (error as Error).message }, { status });
  }
}
