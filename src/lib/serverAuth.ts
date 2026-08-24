import type { NextRequest } from 'next/server';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getAdminAuth } from '@/lib/firebaseAdmin';

export class RequestAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 503,
  ) {
    super(message);
  }
}

export function ownerTokenAllowed(token: DecodedIdToken): boolean {
  const configuredEmail = process.env.OWNER_EMAIL?.trim().toLowerCase();
  const emailAllowed =
    Boolean(configuredEmail) &&
    token.email_verified === true &&
    token.email?.toLowerCase() === configuredEmail;
  return token.admin === true || emailAllowed;
}

export async function requireOwner(request: NextRequest): Promise<DecodedIdToken> {
  const header = request.headers.get('authorization');
  if (!header?.startsWith('Bearer ')) {
    throw new RequestAuthError('Owner authentication required.', 401);
  }

  let token: DecodedIdToken;
  try {
    token = await getAdminAuth().verifyIdToken(header.slice('Bearer '.length), true);
  } catch (error) {
    if (error instanceof Error && error.message.includes('not configured')) {
      throw new RequestAuthError('Owner authentication is not configured on the server.', 503);
    }
    throw new RequestAuthError('Owner authentication failed.', 401);
  }

  if (!ownerTokenAllowed(token)) {
    throw new RequestAuthError('This account is not authorized as the CaliforniaMailer owner.', 403);
  }

  return token;
}

export async function requireOwnerSession(request: NextRequest): Promise<DecodedIdToken> {
  const session = request.cookies.get('cm_owner_session')?.value;
  if (!session) throw new RequestAuthError('Owner authentication required.', 401);
  try {
    const token = await getAdminAuth().verifySessionCookie(session, true);
    if (!ownerTokenAllowed(token)) throw new RequestAuthError('Owner authorization required.', 403);
    return token;
  } catch (error) {
    if (error instanceof RequestAuthError) throw error;
    if (error instanceof Error && error.message.includes('not configured')) throw new RequestAuthError('Owner authentication is not configured on the server.', 503);
    throw new RequestAuthError('Owner authentication failed.', 401);
  }
}
