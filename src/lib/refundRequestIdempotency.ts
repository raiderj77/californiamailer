import { createHash } from 'node:crypto';

export const OWNER_REFUND_REQUEST_ID_MIN_LENGTH = 16;
export const OWNER_REFUND_REQUEST_ID_MAX_LENGTH = 100;
export const OWNER_REFUND_REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

interface OwnerRefundRequestIdentity {
  ownerUid: string;
  paymentId: string;
  requestId: string;
}

export interface OwnerRefundRequestReplay extends OwnerRefundRequestIdentity {
  campaignId: string;
  reservationId: string;
  amountCents: number;
  reason: string;
}

function requiredBoundedString(value: string, maximumLength: number): string {
  if (!value || value !== value.trim() || value.length > maximumLength) {
    throw new Error('refund-request-id-invalid');
  }
  return value;
}

export function ownerRefundRequestDocumentId(
  identity: OwnerRefundRequestIdentity,
): string {
  const ownerUid = requiredBoundedString(identity.ownerUid, 256);
  const paymentId = requiredBoundedString(identity.paymentId, 150);
  const requestId = requiredBoundedString(
    identity.requestId,
    OWNER_REFUND_REQUEST_ID_MAX_LENGTH,
  );
  if (
    requestId.length < OWNER_REFUND_REQUEST_ID_MIN_LENGTH
    || !OWNER_REFUND_REQUEST_ID_PATTERN.test(requestId)
  ) throw new Error('refund-request-id-invalid');

  const digest = createHash('sha256')
    .update(JSON.stringify([ownerUid, paymentId, requestId]), 'utf8')
    .digest('hex');
  return `owner_request__${digest}`;
}

export function isExactOwnerRefundRequestReplay(
  data: Record<string, unknown> | undefined,
  expected: OwnerRefundRequestReplay,
): boolean {
  if (!data) return false;
  return data.campaignId === expected.campaignId
    && data.paymentId === expected.paymentId
    && data.reservationId === expected.reservationId
    && data.amountCents === expected.amountCents
    && data.reason === expected.reason
    && data.source === 'owner_request'
    && data.requiredFullRefund === false
    && data.ownerRejectable === true
    && data.requestedBy === expected.ownerUid
    && data.requestId === expected.requestId;
}
