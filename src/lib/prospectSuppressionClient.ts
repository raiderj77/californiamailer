export interface ProspectSuppressionResult {
  success: true;
  propagationStatus: string;
  suppressedCount: number;
  discoveredCount: number;
}

export interface ProspectSuppressionIdentityUpdate {
  businessName: string;
  email: string;
  phone: string;
  website: string;
}

export interface ProspectContactBarrierState {
  contactBlocked: boolean;
  reason: string | null;
  sourceProspectId: string | null;
}

export async function getProspectContactBarrier(idToken: string): Promise<ProspectContactBarrierState> {
  const response = await fetch('/api/admin/prospects/suppress', {
    headers: { Authorization: `Bearer ${idToken}` },
    cache: 'no-store',
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Prospect suppression state could not be read.');
  }
  return result as ProspectContactBarrierState;
}

export async function suppressProspectIdentity(
  prospectId: string,
  idToken: string,
  identity?: ProspectSuppressionIdentityUpdate,
): Promise<ProspectSuppressionResult> {
  const response = await fetch('/api/admin/prospects/suppress', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prospectId, ...(identity ? { identity } : {}) }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(typeof result.error === 'string' ? result.error : 'Prospect suppression failed.');
  }
  return result as ProspectSuppressionResult;
}
