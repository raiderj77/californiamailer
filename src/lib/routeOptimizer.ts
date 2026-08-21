export const ROUTE_OPTIMIZER_MAX_ROWS = 50;
export const ROUTE_OPTIMIZER_MAX_TARGET = 1_000_000;

export type RouteOptimizerAudienceMode = 'residential_only' | 'residential_and_business';
export type RouteOptimizerDirection = 'exact' | 'under' | 'over';

export interface CarrierRouteOptimizerRow {
  zipCode: string;
  carrierRouteCode: string;
  city: string;
  routeType: 'city' | 'rural_highway' | 'po_box' | 'other';
  residentialCount: number;
  businessCount: number;
  poBoxCount: number;
}

export interface OptimizedCarrierRoute extends CarrierRouteOptimizerRow {
  identity: string;
  audienceCount: number;
}

export interface CarrierRouteOptimization {
  audienceMode: RouteOptimizerAudienceMode;
  targetCount: number;
  selectedCount: number;
  signedDelta: number;
  absoluteDelta: number;
  direction: RouteOptimizerDirection;
  selectedRouteCount: number;
  excludedCount: number;
  inputRouteCount: number;
  importedAudienceCount: number;
  selectedRoutes: OptimizedCarrierRoute[];
}

export class RouteOptimizerValidationError extends Error {}

interface NormalizedCandidate extends OptimizedCarrierRoute {
  duplicateKey: string;
}

const ROUTE_TYPES = new Set(['city', 'rural_highway', 'po_box', 'other']);
const UNREACHABLE_ROUTE_COUNT = 255;
const ONE = BigInt(1);
const ZERO = BigInt(0);

function assertCount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > ROUTE_OPTIMIZER_MAX_TARGET) {
    throw new RouteOptimizerValidationError(`${label} must be a nonnegative whole number.`);
  }
}

function safeAdd(total: number, value: number, label: string): number {
  const next = total + value;
  if (!Number.isSafeInteger(next) || next > ROUTE_OPTIMIZER_MAX_TARGET) {
    throw new RouteOptimizerValidationError(
      `${label} exceeds ${ROUTE_OPTIMIZER_MAX_TARGET.toLocaleString('en-US')}.`,
    );
  }
  return next;
}

function normalizeCandidate(
  row: CarrierRouteOptimizerRow,
  audienceMode: RouteOptimizerAudienceMode,
): NormalizedCandidate {
  const zipCode = row.zipCode.trim();
  const carrierRouteCode = row.carrierRouteCode.trim().toUpperCase();
  const city = row.city.trim().replace(/\s+/g, ' ');
  if (!/^\d{5}$/.test(zipCode)) {
    throw new RouteOptimizerValidationError('Every optimizer row requires a five-digit ZIP Code.');
  }
  if (!/^[A-Z0-9][A-Z0-9-]{1,11}$/.test(carrierRouteCode)) {
    throw new RouteOptimizerValidationError(
      'Every optimizer carrier-route code must use 2-12 letters, numbers, or hyphens.',
    );
  }
  if (!city || city.length > 80) {
    throw new RouteOptimizerValidationError('Every optimizer row requires a city of 80 characters or fewer.');
  }
  if (!ROUTE_TYPES.has(row.routeType)) {
    throw new RouteOptimizerValidationError('Every optimizer row requires a supported route type.');
  }
  assertCount(row.residentialCount, 'Residential count');
  assertCount(row.businessCount, 'Business count');
  assertCount(row.poBoxCount, 'PO Box count');
  const totalCount = row.residentialCount + row.businessCount + row.poBoxCount;
  if (!Number.isSafeInteger(totalCount) || totalCount < 1 || totalCount > ROUTE_OPTIMIZER_MAX_TARGET) {
    throw new RouteOptimizerValidationError(
      'Every optimizer route must contain 1-1,000,000 delivery points.',
    );
  }
  const audienceCount = audienceMode === 'residential_only'
    ? row.residentialCount
    : totalCount;
  const duplicateKey = `${zipCode}:${carrierRouteCode}`;
  return {
    zipCode,
    carrierRouteCode,
    city,
    routeType: row.routeType,
    residentialCount: row.residentialCount,
    businessCount: row.businessCount,
    poBoxCount: row.poBoxCount,
    identity: `${zipCode} ${carrierRouteCode}`,
    duplicateKey,
    audienceCount,
  };
}

function candidateIsBetter(
  sum: number,
  routeCount: number,
  mask: bigint,
  bestSum: number,
  bestRouteCount: number,
  bestMask: bigint,
  targetCount: number,
): boolean {
  if (bestSum < 0) return true;
  const difference = Math.abs(sum - targetCount);
  const bestDifference = Math.abs(bestSum - targetCount);
  if (difference !== bestDifference) return difference < bestDifference;
  const overTarget = sum > targetCount;
  const bestOverTarget = bestSum > targetCount;
  if (overTarget !== bestOverTarget) return !overTarget;
  if (routeCount !== bestRouteCount) return routeCount < bestRouteCount;
  return mask > bestMask;
}

/**
 * Finds the closest whole-route subset from owner-imported count evidence.
 * Ties prefer an at-or-under result, then fewer routes, then the earliest
 * canonical ZIP/route identities. It performs no lookup, ordering, or mutation.
 */
export function optimizeCarrierRoutes(
  rows: readonly CarrierRouteOptimizerRow[],
  audienceMode: RouteOptimizerAudienceMode,
  targetCount: number,
): CarrierRouteOptimization {
  if (!['residential_only', 'residential_and_business'].includes(audienceMode)) {
    throw new RouteOptimizerValidationError('Unsupported optimizer audience mode.');
  }
  if (!Number.isSafeInteger(targetCount) || targetCount < 1 || targetCount > ROUTE_OPTIMIZER_MAX_TARGET) {
    throw new RouteOptimizerValidationError(
      `Target count must be a whole number from 1-${ROUTE_OPTIMIZER_MAX_TARGET.toLocaleString('en-US')}.`,
    );
  }
  if (rows.length < 1 || rows.length > ROUTE_OPTIMIZER_MAX_ROWS) {
    throw new RouteOptimizerValidationError(
      `The optimizer requires 1-${ROUTE_OPTIMIZER_MAX_ROWS} imported carrier routes.`,
    );
  }

  const candidates = rows
    .map((row) => normalizeCandidate(row, audienceMode))
    .sort((left, right) => left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0);
  const duplicateKeys = new Set<string>();
  let importedDeliveryCount = 0;
  let importedAudienceCount = 0;
  for (const candidate of candidates) {
    if (duplicateKeys.has(candidate.duplicateKey)) {
      throw new RouteOptimizerValidationError(`Duplicate imported route ${candidate.identity}.`);
    }
    duplicateKeys.add(candidate.duplicateKey);
    importedDeliveryCount = safeAdd(
      importedDeliveryCount,
      candidate.residentialCount + candidate.businessCount + candidate.poBoxCount,
      'Imported delivery-point total',
    );
    importedAudienceCount = safeAdd(
      importedAudienceCount,
      candidate.audienceCount,
      'Imported audience total',
    );
  }

  const selectable = candidates.filter((candidate) => candidate.audienceCount > 0);
  if (!selectable.length) {
    throw new RouteOptimizerValidationError(
      'The imported rows contain no delivery points for the selected audience mode.',
    );
  }

  const routeCounts = new Uint8Array(importedAudienceCount + 1);
  routeCounts.fill(UNREACHABLE_ROUTE_COUNT);
  routeCounts[0] = 0;
  const selectionMasks = new BigUint64Array(importedAudienceCount + 1);
  let currentMaximum = 0;

  for (let routeIndex = 0; routeIndex < selectable.length; routeIndex += 1) {
    const candidate = selectable[routeIndex];
    const bit = ONE << BigInt(selectable.length - 1 - routeIndex);
    for (let sum = currentMaximum; sum >= 0; sum -= 1) {
      const currentRouteCount = routeCounts[sum];
      if (currentRouteCount === UNREACHABLE_ROUTE_COUNT) continue;
      const nextSum = sum + candidate.audienceCount;
      const nextRouteCount = currentRouteCount + 1;
      const nextMask = selectionMasks[sum] | bit;
      const storedRouteCount = routeCounts[nextSum];
      if (
        storedRouteCount === UNREACHABLE_ROUTE_COUNT
        || nextRouteCount < storedRouteCount
        || (nextRouteCount === storedRouteCount && nextMask > selectionMasks[nextSum])
      ) {
        routeCounts[nextSum] = nextRouteCount;
        selectionMasks[nextSum] = nextMask;
      }
    }
    currentMaximum += candidate.audienceCount;
  }

  let bestSum = -1;
  let bestRouteCount = UNREACHABLE_ROUTE_COUNT;
  let bestMask = ZERO;
  for (let sum = 1; sum <= currentMaximum; sum += 1) {
    const routeCount = routeCounts[sum];
    if (routeCount === UNREACHABLE_ROUTE_COUNT) continue;
    const mask = selectionMasks[sum];
    if (candidateIsBetter(
      sum,
      routeCount,
      mask,
      bestSum,
      bestRouteCount,
      bestMask,
      targetCount,
    )) {
      bestSum = sum;
      bestRouteCount = routeCount;
      bestMask = mask;
    }
  }
  if (bestSum < 1) {
    throw new RouteOptimizerValidationError('No nonempty whole-route suggestion could be calculated.');
  }

  const selectedRoutes = selectable.filter((_, routeIndex) => {
    const bit = ONE << BigInt(selectable.length - 1 - routeIndex);
    return (bestMask & bit) !== ZERO;
  }).map((route) => ({
    zipCode: route.zipCode,
    carrierRouteCode: route.carrierRouteCode,
    city: route.city,
    routeType: route.routeType,
    residentialCount: route.residentialCount,
    businessCount: route.businessCount,
    poBoxCount: route.poBoxCount,
    identity: route.identity,
    audienceCount: route.audienceCount,
  }));
  const signedDelta = bestSum - targetCount;
  return {
    audienceMode,
    targetCount,
    selectedCount: bestSum,
    signedDelta,
    absoluteDelta: Math.abs(signedDelta),
    direction: signedDelta === 0 ? 'exact' : signedDelta < 0 ? 'under' : 'over',
    selectedRouteCount: selectedRoutes.length,
    excludedCount: rows.length - selectedRoutes.length,
    inputRouteCount: rows.length,
    importedAudienceCount,
    selectedRoutes,
  };
}
