import {
  parseMaterialManifest,
  sortedMaterialManifestEntries,
} from '@/lib/creativeBrief';

export const PRINTED_INPUT_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface PrintedInputDocument {
  id: string;
  data: () => Record<string, unknown>;
}

export interface PrintedMaterialBinding {
  assetKind: string | null;
  materialId: string;
  materialVersion: number;
}

export interface PrintedReservationBinding {
  reservationId: string;
  placementSlotId: string;
  proofId: string;
  proofVersion: number;
  creativeBriefId: string;
  creativeBriefVersion: number;
  materialBindings: PrintedMaterialBinding[];
}

export interface PrintedInputSnapshot {
  schemaVersion: typeof PRINTED_INPUT_SNAPSHOT_SCHEMA_VERSION;
  campaignId: string;
  paidReservationCount: number;
  bindings: PrintedReservationBinding[];
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(record: Record<string, unknown>, keys: string[]) {
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === expected[index]);
}

function isSafeId(value: unknown): value is string {
  return typeof value === 'string'
    && /^[A-Za-z0-9_-]{1,150}$/.test(value);
}

function positiveSafeInteger(value: unknown): number | null {
  return Number.isSafeInteger(value) && Number(value) > 0 ? Number(value) : null;
}

function currentMaterialBindings(
  reservation: Record<string, unknown>,
): PrintedMaterialBinding[] | null {
  const manifestPresent = reservation.materialManifest !== undefined
    && reservation.materialManifest !== null;
  if (manifestPresent) {
    const manifest = parseMaterialManifest(reservation.materialManifest);
    if (!manifest) return null;
    return sortedMaterialManifestEntries(manifest).map((pointer) => ({
      assetKind: pointer.assetKind,
      materialId: pointer.materialId,
      materialVersion: pointer.version,
    }));
  }

  const materialId = reservation.latestMaterialId;
  const materialVersion = positiveSafeInteger(reservation.materialSequence);
  if (!isSafeId(materialId) || materialVersion === null) return null;
  return [{ assetKind: null, materialId, materialVersion }];
}

function bindingFromReservation(
  campaignId: string,
  document: PrintedInputDocument,
): PrintedReservationBinding | null {
  const reservation = document.data();
  const proofVersion = positiveSafeInteger(reservation.proofSequence);
  const creativeBriefVersion = positiveSafeInteger(reservation.creativeBriefSequence);
  const materialBindings = currentMaterialBindings(reservation);
  if (
    reservation.campaignId !== campaignId
    || !isSafeId(document.id)
    || !isSafeId(reservation.placementSlotId)
    || !isSafeId(reservation.latestProofId)
    || proofVersion === null
    || !isSafeId(reservation.latestCreativeBriefId)
    || creativeBriefVersion === null
    || !materialBindings
    || materialBindings.length === 0
  ) {
    return null;
  }
  return {
    reservationId: document.id,
    placementSlotId: reservation.placementSlotId,
    proofId: reservation.latestProofId,
    proofVersion,
    creativeBriefId: reservation.latestCreativeBriefId,
    creativeBriefVersion,
    materialBindings,
  };
}

export function buildPrintedInputSnapshot(
  campaignId: string,
  reservationDocuments: PrintedInputDocument[],
): PrintedInputSnapshot | null {
  if (!isSafeId(campaignId)) return null;
  const paidDocuments = reservationDocuments
    .filter((document) => document.data().status === 'paid');
  const bindings = paidDocuments
    .map((document) => bindingFromReservation(campaignId, document));
  if (bindings.length === 0 || bindings.some((binding) => binding === null)) return null;
  const canonicalBindings = (bindings as PrintedReservationBinding[])
    .sort((left, right) => left.reservationId.localeCompare(right.reservationId));
  if (new Set(canonicalBindings.map((binding) => binding.reservationId)).size !== canonicalBindings.length) {
    return null;
  }
  return {
    schemaVersion: PRINTED_INPUT_SNAPSHOT_SCHEMA_VERSION,
    campaignId,
    paidReservationCount: canonicalBindings.length,
    bindings: canonicalBindings,
  };
}

export function parsePrintedInputSnapshot(value: unknown): PrintedInputSnapshot | null {
  if (
    !isPlainRecord(value)
    || !hasExactKeys(value, ['schemaVersion', 'campaignId', 'paidReservationCount', 'bindings'])
    || value.schemaVersion !== PRINTED_INPUT_SNAPSHOT_SCHEMA_VERSION
    || !isSafeId(value.campaignId)
    || !Number.isSafeInteger(value.paidReservationCount)
    || Number(value.paidReservationCount) < 1
    || !Array.isArray(value.bindings)
    || value.bindings.length !== value.paidReservationCount
  ) {
    return null;
  }

  const bindings: PrintedReservationBinding[] = [];
  for (const candidate of value.bindings) {
    if (
      !isPlainRecord(candidate)
      || !hasExactKeys(candidate, [
        'reservationId',
        'placementSlotId',
        'proofId',
        'proofVersion',
        'creativeBriefId',
        'creativeBriefVersion',
        'materialBindings',
      ])
      || !isSafeId(candidate.reservationId)
      || !isSafeId(candidate.placementSlotId)
      || !isSafeId(candidate.proofId)
      || positiveSafeInteger(candidate.proofVersion) === null
      || !isSafeId(candidate.creativeBriefId)
      || positiveSafeInteger(candidate.creativeBriefVersion) === null
      || !Array.isArray(candidate.materialBindings)
      || candidate.materialBindings.length === 0
    ) {
      return null;
    }
    const materialBindings: PrintedMaterialBinding[] = [];
    for (const material of candidate.materialBindings) {
      if (
        !isPlainRecord(material)
        || !hasExactKeys(material, ['assetKind', 'materialId', 'materialVersion'])
        || (material.assetKind !== null && !isSafeId(material.assetKind))
        || !isSafeId(material.materialId)
        || positiveSafeInteger(material.materialVersion) === null
      ) {
        return null;
      }
      materialBindings.push({
        assetKind: material.assetKind,
        materialId: material.materialId,
        materialVersion: Number(material.materialVersion),
      });
    }
    const sortedMaterials = [...materialBindings].sort((left, right) => (
      String(left.assetKind).localeCompare(String(right.assetKind))
    ));
    if (JSON.stringify(sortedMaterials) !== JSON.stringify(materialBindings)) return null;
    bindings.push({
      reservationId: candidate.reservationId,
      placementSlotId: candidate.placementSlotId,
      proofId: candidate.proofId,
      proofVersion: Number(candidate.proofVersion),
      creativeBriefId: candidate.creativeBriefId,
      creativeBriefVersion: Number(candidate.creativeBriefVersion),
      materialBindings,
    });
  }
  const sortedBindings = [...bindings].sort((left, right) => (
    left.reservationId.localeCompare(right.reservationId)
  ));
  if (
    JSON.stringify(sortedBindings) !== JSON.stringify(bindings)
    || new Set(bindings.map((binding) => binding.reservationId)).size !== bindings.length
  ) {
    return null;
  }
  return {
    schemaVersion: PRINTED_INPUT_SNAPSHOT_SCHEMA_VERSION,
    campaignId: value.campaignId,
    paidReservationCount: Number(value.paidReservationCount),
    bindings,
  };
}

export function printedInputSnapshotMatches(
  value: unknown,
  campaignId: string,
  reservationDocuments: PrintedInputDocument[],
): boolean {
  const stored = parsePrintedInputSnapshot(value);
  if (!stored || stored.campaignId !== campaignId) return false;

  const currentById = new Map<string, PrintedInputDocument>();
  for (const document of reservationDocuments) {
    if (currentById.has(document.id)) return false;
    currentById.set(document.id, document);
  }
  const storedIds = new Set(stored.bindings.map((binding) => binding.reservationId));
  for (const document of reservationDocuments) {
    if (document.data().status === 'paid' && !storedIds.has(document.id)) return false;
  }
  for (const storedBinding of stored.bindings) {
    const currentDocument = currentById.get(storedBinding.reservationId);
    if (!currentDocument) return false;
    const currentBinding = bindingFromReservation(campaignId, currentDocument);
    if (!currentBinding || JSON.stringify(currentBinding) !== JSON.stringify(storedBinding)) {
      return false;
    }
  }
  return true;
}
