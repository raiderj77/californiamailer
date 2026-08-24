import { NextRequest, NextResponse } from 'next/server';
import type { DocumentData } from 'firebase-admin/firestore';
import { z } from 'zod';
import {
  ADVERTISER_PORTAL_INVITE_COLLECTION,
  ADVERTISER_PORTAL_INVITE_HOURS,
  ADVERTISER_PORTAL_SESSION_COLLECTION,
  AdvertiserPortalError,
  createAdvertiserPortalInvite,
  isActiveAdvertiserPortalInvite,
  isActiveAdvertiserPortalSession,
  isActiveLegacyReservationAccess,
  reservationPortalAccessVersion,
  reservationPortalInviteVersion,
  timestampMillis,
} from '@/lib/advertiserPortal';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const RECORD_LIMIT = 500;
const createSchema = z.object({
  reservationId: z.string().trim().min(10).max(40).regex(/^[A-Za-z0-9]+$/),
  expiresInHours: z.enum(ADVERTISER_PORTAL_INVITE_HOURS.map(String) as [string, ...string[]])
    .transform(Number),
  confirmation: z.literal('CREATE ONE-TIME PORTAL LINK'),
}).strict();

export async function GET(request: NextRequest) {
  try {
    await requireOwner(request);
    const db = getAdminFirestore();
    const [reservationSnapshot, inviteSnapshot, sessionSnapshot] = await Promise.all([
      db.collection('reservations').orderBy('createdAt', 'desc').limit(RECORD_LIMIT).get(),
      db.collection(ADVERTISER_PORTAL_INVITE_COLLECTION).limit(RECORD_LIMIT).get(),
      db.collection(ADVERTISER_PORTAL_SESSION_COLLECTION).limit(RECORD_LIMIT).get(),
    ]);
    const now = Date.now();
    const reservations = reservationSnapshot.docs.map((document) => {
      const data = document.data();
      const activeInvites = inviteSnapshot.docs
        .filter((invite) => isActiveAdvertiserPortalInvite(invite.data(), data, document.id, now));
      const activeSessions = sessionSnapshot.docs
        .filter((session) => isActiveAdvertiserPortalSession(session.data(), data, document.id, now));
      return reservationView(
        document.id,
        data,
        activeInvites.map((invite) => timestampMillis(invite.data().expiresAt)),
        activeSessions.map((session) => timestampMillis(session.data().expiresAt)),
        now,
      );
    });
    return NextResponse.json({
      reservations,
      policy: {
        scope: 'one_private_portal_per_reservation_business_placement',
        delivery: 'owner_copies_link_manually',
        automatedEmail: 'disabled',
        sessionDays: 30,
        inviteHours: ADVERTISER_PORTAL_INVITE_HOURS,
      },
      limits: {
        recordsPerCollection: RECORD_LIMIT,
        possiblyTruncated: [reservationSnapshot, inviteSnapshot, sessionSnapshot]
          .some((snapshot) => snapshot.size === RECORD_LIMIT),
      },
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'Business portal records could not be read.');
  }
}

export async function POST(request: NextRequest) {
  try {
    const owner = await requireOwner(request);
    const parsed = createSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter the exact confirmation and a supported expiration.' }, { status: 400 });
    }
    const origin = canonicalOrigin(request);
    const invite = await createAdvertiserPortalInvite(
      owner.uid,
      parsed.data.reservationId,
      parsed.data.expiresInHours as 1 | 24 | 72 | 168,
    );
    const url = new URL('/business-login/access', origin);
    url.hash = `token=${encodeURIComponent(invite.token)}`;
    return NextResponse.json({
      success: true,
      accessUrl: url.toString(),
      expiresAt: invite.expiresAt,
      reservationId: invite.reservationId,
      publicReference: invite.publicReference,
      businessName: invite.businessName,
      deliveryStatus: 'not_sent_copy_manually',
    }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return errorResponse(error, 'The one-time portal link could not be created.');
  }
}

function reservationView(
  id: string,
  data: DocumentData,
  inviteExpirations: Array<number | null>,
  sessionExpirations: Array<number | null>,
  now: number,
) {
  return {
    id,
    publicReference: clean(data.publicReference),
    businessName: clean(data.businessName),
    contactName: clean(data.contactName),
    email: clean(data.email),
    categorySlug: clean(data.categorySlug),
    placementSize: clean(data.placementSize),
    status: clean(data.status),
    accessVersion: reservationPortalAccessVersion(data),
    inviteVersion: reservationPortalInviteVersion(data),
    legacyAccessActive: isActiveLegacyReservationAccess(data, now),
    legacyAccessExpiresAt: toIso(data.legacyAccessExpiresAt),
    activeInviteCount: inviteExpirations.length,
    activeInviteExpiresAt: latestIso(inviteExpirations),
    activeSessionCount: sessionExpirations.length,
    activeSessionExpiresAt: latestIso(sessionExpirations),
    createdAt: toIso(data.createdAt),
    portalAccessRevokedAt: toIso(data.portalAccessRevokedAt),
  };
}

function canonicalOrigin(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) {
        return url.origin;
      }
    } catch {
      // Fall back to the authenticated request origin.
    }
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('A secure canonical site URL is required before portal links can be created.');
  }
  const requestOrigin = new URL(request.nextUrl.origin);
  if (requestOrigin.protocol !== 'http:' || !['localhost', '127.0.0.1'].includes(requestOrigin.hostname)) {
    throw new Error('Portal links require HTTPS or a local development origin.');
  }
  return requestOrigin.origin;
}

function latestIso(values: Array<number | null>) {
  const milliseconds = values.filter((value): value is number => value !== null);
  return milliseconds.length ? new Date(Math.max(...milliseconds)).toISOString() : null;
}

function toIso(value: unknown) {
  const milliseconds = timestampMillis(value);
  return milliseconds === null ? null : new Date(milliseconds).toISOString();
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestAuthError || error instanceof AdvertiserPortalError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return NextResponse.json({ error: fallback }, { status: 500 });
}
