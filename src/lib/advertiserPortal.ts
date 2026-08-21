import { createHash, randomBytes } from 'node:crypto';
import {
  FieldValue,
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebaseAdmin';

export const ADVERTISER_PORTAL_INVITE_HOURS = [1, 24, 72, 168] as const;
export const ADVERTISER_PORTAL_SESSION_DAYS = 30;
export const ADVERTISER_PORTAL_INVITE_COLLECTION = 'advertiserportalinvites';
export const ADVERTISER_PORTAL_SESSION_COLLECTION = 'advertiserportalsessions';

const RESERVATION_ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;
const PORTAL_TOKEN_PATTERN = /^[A-Za-z0-9_-]{40,100}$/;
const MAX_CLEANUP_RECORDS = 500;

export type AdvertiserPortalInviteHours = typeof ADVERTISER_PORTAL_INVITE_HOURS[number];

export class AdvertiserPortalError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
  }
}

export function validReservationId(value: string): boolean {
  return RESERVATION_ID_PATTERN.test(value);
}

export function validAdvertiserPortalToken(value: string | undefined): value is string {
  return Boolean(value && PORTAL_TOKEN_PATTERN.test(value));
}

export function hashAdvertiserPortalToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateAdvertiserPortalToken(): string {
  return randomBytes(32).toString('base64url');
}

export function reservationPortalAccessVersion(data: DocumentData): number {
  return nonnegativeInteger(data.portalAccessVersion);
}

export function reservationPortalInviteVersion(data: DocumentData): number {
  return nonnegativeInteger(data.portalInviteVersion);
}

export function timestampMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value && typeof value === 'object' && 'toMillis' in value && typeof value.toMillis === 'function') {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  return null;
}

export function isActiveAdvertiserPortalInvite(
  invite: DocumentData,
  reservation: DocumentData,
  reservationId: string,
  now = Date.now(),
): boolean {
  const expiresAt = timestampMillis(invite.expiresAt);
  return invite.status === 'active'
    && invite.reservationId === reservationId
    && invite.accessVersion === reservationPortalAccessVersion(reservation)
    && invite.inviteVersion === reservationPortalInviteVersion(reservation)
    && expiresAt !== null
    && expiresAt > now;
}

export function isActiveAdvertiserPortalSession(
  session: DocumentData,
  reservation: DocumentData,
  reservationId: string,
  now = Date.now(),
): boolean {
  const expiresAt = timestampMillis(session.expiresAt);
  return session.status === 'active'
    && session.reservationId === reservationId
    && session.accessVersion === reservationPortalAccessVersion(reservation)
    && expiresAt !== null
    && expiresAt > now;
}

export async function createAdvertiserPortalInvite(
  ownerUid: string,
  reservationId: string,
  expiresInHours: AdvertiserPortalInviteHours,
  now = Date.now(),
) {
  if (!validReservationId(reservationId)) {
    throw new AdvertiserPortalError('Reservation record not found.', 404);
  }
  if (!ADVERTISER_PORTAL_INVITE_HOURS.includes(expiresInHours)) {
    throw new AdvertiserPortalError('Choose a supported expiration.', 400);
  }

  const db = getAdminFirestore();
  const reservationRef = db.collection('reservations').doc(reservationId);
  const token = generateAdvertiserPortalToken();
  const inviteId = hashAdvertiserPortalToken(token);
  const inviteRef = db.collection(ADVERTISER_PORTAL_INVITE_COLLECTION).doc(inviteId);
  const expiresAt = Timestamp.fromMillis(now + expiresInHours * 60 * 60_000);

  const reservation = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reservationRef);
    const data = snapshot.data();
    if (!snapshot.exists || !data) {
      throw new AdvertiserPortalError('Reservation record not found.', 404);
    }

    const accessVersion = reservationPortalAccessVersion(data);
    const inviteVersion = reservationPortalInviteVersion(data) + 1;
    transaction.update(reservationRef, {
      portalInviteVersion: inviteVersion,
      portalInviteCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(inviteRef, {
      reservationId,
      accessVersion,
      inviteVersion,
      status: 'active',
      expiresAt,
      createdBy: ownerUid,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(db.collection('auditlog').doc(), {
      actorUid: ownerUid,
      action: 'advertiser_portal.invite_create',
      entityId: reservationId,
      summary: `Created a one-time advertiser portal link expiring in ${expiresInHours} hours. No message was sent.`,
      createdAt: FieldValue.serverTimestamp(),
    });
    return data;
  });

  return {
    token,
    inviteId,
    reservationId,
    expiresAt: expiresAt.toDate().toISOString(),
    publicReference: clean(reservation.publicReference),
    businessName: clean(reservation.businessName),
  };
}

export async function consumeAdvertiserPortalInvite(token: string, now = Date.now()) {
  if (!validAdvertiserPortalToken(token)) {
    throw new AdvertiserPortalError('This private access link is invalid or expired.', 409);
  }

  const db = getAdminFirestore();
  const inviteId = hashAdvertiserPortalToken(token);
  const inviteRef = db.collection(ADVERTISER_PORTAL_INVITE_COLLECTION).doc(inviteId);
  const sessionToken = generateAdvertiserPortalToken();
  const sessionId = hashAdvertiserPortalToken(sessionToken);
  const sessionRef = db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION).doc(sessionId);
  const sessionExpiresAt = Timestamp.fromMillis(
    now + ADVERTISER_PORTAL_SESSION_DAYS * 24 * 60 * 60_000,
  );

  const reservationId = await db.runTransaction(async (transaction) => {
    const inviteSnapshot = await transaction.get(inviteRef);
    const invite = inviteSnapshot.data();
    const candidateReservationId = clean(invite?.reservationId);
    if (!inviteSnapshot.exists || !invite || !validReservationId(candidateReservationId)) {
      throw new AdvertiserPortalError('This private access link is invalid or expired.', 409);
    }

    const reservationRef = db.collection('reservations').doc(candidateReservationId);
    const reservationSnapshot = await transaction.get(reservationRef);
    const reservation = reservationSnapshot.data();
    if (
      !reservationSnapshot.exists
      || !reservation
      || !isActiveAdvertiserPortalInvite(invite, reservation, candidateReservationId, now)
    ) {
      throw new AdvertiserPortalError('This private access link is invalid or expired.', 409);
    }

    transaction.create(sessionRef, {
      reservationId: candidateReservationId,
      inviteId,
      accessVersion: reservationPortalAccessVersion(reservation),
      status: 'active',
      expiresAt: sessionExpiresAt,
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.update(inviteRef, {
      status: 'consumed',
      sessionId,
      consumedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(reservationRef, {
      portalLastSessionCreatedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(db.collection('auditlog').doc(), {
      action: 'advertiser_portal.invite_consume',
      entityId: candidateReservationId,
      summary: 'A one-time advertiser portal link created a reservation-scoped database session.',
      createdAt: FieldValue.serverTimestamp(),
    });
    return candidateReservationId;
  });

  return {
    reservationId,
    sessionToken,
    sessionId,
    expiresAt: sessionExpiresAt.toDate(),
  };
}

export async function revokeAdvertiserPortalSession(reservationId: string, token?: string) {
  if (!validReservationId(reservationId) || !validAdvertiserPortalToken(token)) return false;
  const db = getAdminFirestore();
  const sessionRef = db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION)
    .doc(hashAdvertiserPortalToken(token));
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sessionRef);
    const session = snapshot.data();
    if (!snapshot.exists || !session || session.reservationId !== reservationId) return false;
    if (session.status === 'active') {
      transaction.update(sessionRef, {
        status: 'revoked',
        revokedReason: 'advertiser_logout',
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      transaction.create(db.collection('auditlog').doc(), {
        action: 'advertiser_portal.logout',
        entityId: reservationId,
        summary: 'The advertiser logged out of one reservation-scoped portal session.',
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    return true;
  });
}

export async function revokeAllAdvertiserPortalAccess(ownerUid: string, reservationId: string) {
  if (!validReservationId(reservationId)) {
    throw new AdvertiserPortalError('Reservation record not found.', 404);
  }
  const db = getAdminFirestore();
  const reservationRef = db.collection('reservations').doc(reservationId);
  const [inviteSnapshot, sessionSnapshot] = await Promise.all([
    db.collection(ADVERTISER_PORTAL_INVITE_COLLECTION)
      .where('reservationId', '==', reservationId)
      .limit(MAX_CLEANUP_RECORDS)
      .get(),
    db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION)
      .where('reservationId', '==', reservationId)
      .limit(MAX_CLEANUP_RECORDS)
      .get(),
  ]);

  const versions = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reservationRef);
    const reservation = snapshot.data();
    if (!snapshot.exists || !reservation) {
      throw new AdvertiserPortalError('Reservation record not found.', 404);
    }
    const accessVersion = reservationPortalAccessVersion(reservation) + 1;
    const inviteVersion = reservationPortalInviteVersion(reservation) + 1;
    transaction.update(reservationRef, {
      portalAccessVersion: accessVersion,
      portalInviteVersion: inviteVersion,
      accessTokenHash: null,
      legacyAccessRevokedAt: FieldValue.serverTimestamp(),
      portalAccessRevokedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(db.collection('auditlog').doc(), {
      actorUid: ownerUid,
      action: 'advertiser_portal.revoke_all',
      entityId: reservationId,
      summary: 'Revoked all legacy and database-backed access for this reservation. No business-wide account was changed.',
      createdAt: FieldValue.serverTimestamp(),
    });
    return { accessVersion, inviteVersion };
  });

  const records = [...inviteSnapshot.docs, ...sessionSnapshot.docs]
    .filter((doc) => doc.data().status === 'active');
  let cleanupStatus: 'complete' | 'version_revoked_cleanup_pending' = 'complete';
  try {
    await markRecordsRevoked(records, ownerUid);
  } catch {
    // The version increment is the authoritative revocation. Status cleanup is descriptive only.
    cleanupStatus = 'version_revoked_cleanup_pending';
  }
  return { ...versions, revokedRecords: records.length, cleanupStatus };
}

async function markRecordsRevoked(
  records: QueryDocumentSnapshot<DocumentData>[],
  ownerUid: string,
) {
  const db = getAdminFirestore();
  for (let offset = 0; offset < records.length; offset += 400) {
    const batch = db.batch();
    for (const record of records.slice(offset, offset + 400)) {
      batch.update(record.ref, {
        status: 'revoked',
        revokedReason: 'owner_revoke_all',
        revokedBy: ownerUid,
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

function nonnegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isSafeInteger(numeric) && numeric >= 0 ? numeric : 0;
}

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
