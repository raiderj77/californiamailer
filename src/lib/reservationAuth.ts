import { createHash, timingSafeEqual } from 'node:crypto';
import type {
  DocumentData,
  DocumentReference,
  Transaction,
} from 'firebase-admin/firestore';
import {
  ADVERTISER_PORTAL_SESSION_COLLECTION,
  hashAdvertiserPortalToken,
  isActiveAdvertiserPortalSession,
  isActiveLegacyReservationAccess,
  validAdvertiserPortalToken,
  validReservationId,
} from './advertiserPortal';
import { getAdminFirestore } from './firebaseAdmin';

export interface ReservationAccess {
  ref: DocumentReference;
  data: DocumentData;
  mode: 'legacy_reservation_token' | 'advertiser_portal_session';
  sessionRef?: DocumentReference;
}

export class ReservationAccessError extends Error {
  readonly status = 401;

  constructor() {
    super('Private reservation access required.');
    this.name = 'ReservationAccessError';
  }
}

export function reservationCookieName(id: string) {
  return `cm_reservation_${id}`;
}

export async function verifyReservationAccess(id: string, token?: string): Promise<ReservationAccess | null> {
  const lookup = reservationAccessLookup(id, token);
  if (!lookup) return null;
  const { ref, sessionRef } = lookup;
  const [snapshot, sessionSnapshot] = await Promise.all([ref.get(), sessionRef.get()]);
  return reservationAccessFromRead(
    lookup,
    snapshot.exists,
    snapshot.data(),
    sessionSnapshot.exists,
    sessionSnapshot.data(),
  );
}

export async function assertReservationAccessInTransaction(
  transaction: Transaction,
  id: string,
  token?: string,
): Promise<ReservationAccess> {
  const lookup = reservationAccessLookup(id, token);
  if (!lookup) throw new ReservationAccessError();
  const [snapshot, sessionSnapshot] = await Promise.all([
    transaction.get(lookup.ref),
    transaction.get(lookup.sessionRef),
  ]);
  const access = reservationAccessFromRead(
    lookup,
    snapshot.exists,
    snapshot.data(),
    sessionSnapshot.exists,
    sessionSnapshot.data(),
  );
  if (!access) throw new ReservationAccessError();
  return access;
}

function reservationAccessLookup(id: string, token?: string) {
  if (!validReservationId(id) || !token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return null;
  const db = getAdminFirestore();
  return {
    id,
    token,
    tokenHash: createHash('sha256').update(token).digest('hex'),
    ref: db.collection('reservations').doc(id),
    sessionRef: db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION)
      .doc(hashAdvertiserPortalToken(token)),
  };
}

function reservationAccessFromRead(
  lookup: NonNullable<ReturnType<typeof reservationAccessLookup>>,
  reservationExists: boolean,
  data: DocumentData | undefined,
  sessionExists: boolean,
  session: DocumentData | undefined,
): ReservationAccess | null {
  if (!reservationExists || !data) return null;
  if (
    hashesMatch(lookup.tokenHash, data.accessTokenHash)
    && isActiveLegacyReservationAccess(data)
  ) {
    return { ref: lookup.ref, data, mode: 'legacy_reservation_token' };
  }

  if (
    validAdvertiserPortalToken(lookup.token)
    && sessionExists
    && session
    && isActiveAdvertiserPortalSession(session, data, lookup.id)
  ) {
    return {
      ref: lookup.ref,
      data,
      mode: 'advertiser_portal_session',
      sessionRef: lookup.sessionRef,
    };
  }
  return null;
}

function hashesMatch(suppliedHash: string, storedValue: unknown): boolean {
  const storedHash = typeof storedValue === 'string' ? storedValue.trim().toLowerCase() : '';
  if (!/^[a-f0-9]{64}$/.test(storedHash)) return false;
  const supplied = Buffer.from(suppliedHash, 'hex');
  const stored = Buffer.from(storedHash, 'hex');
  return supplied.length === stored.length && timingSafeEqual(supplied, stored);
}
