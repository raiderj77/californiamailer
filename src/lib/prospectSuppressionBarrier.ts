export const PROSPECT_SUPPRESSION_STATE_COLLECTION = 'prospectsuppressionstate';

export interface ProspectContactBarrierState {
  contactBlocked: boolean;
  reason: string | null;
  sourceProspectId: string | null;
}

export function isProspectContactBarrierActive(value: unknown): boolean {
  return Boolean(value && typeof value === 'object' && Reflect.get(value, 'contactBlocked') === true);
}

export function nextProspectIdentityMutationSerial(value: unknown): number {
  const current = value && typeof value === 'object'
    ? Reflect.get(value, 'identityMutationSerial')
    : undefined;
  return typeof current === 'number' && Number.isSafeInteger(current) && current >= 0
    ? current + 1
    : 1;
}
