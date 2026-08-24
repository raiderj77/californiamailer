import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AdvertiserPortalError,
  revokeAllAdvertiserPortalAccess,
} from '@/lib/advertiserPortal';
import { RequestAuthError, requireOwner } from '@/lib/serverAuth';

const revokeSchema = z.object({
  action: z.literal('revoke_all'),
  confirmation: z.literal('REVOKE ALL PORTAL ACCESS'),
}).strict();

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ reservationId: string }> },
) {
  try {
    const owner = await requireOwner(request);
    const parsed = revokeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Exact revoke-all confirmation is required.' }, { status: 400 });
    }
    const { reservationId } = await params;
    const result = await revokeAllAdvertiserPortalAccess(owner.uid, reservationId);
    return NextResponse.json({
      success: true,
      reservationId,
      revokedRecords: result.revokedRecords,
      accessVersion: result.accessVersion,
      inviteVersion: result.inviteVersion,
      legacyAccessRevoked: true,
      cleanupStatus: result.cleanupStatus,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof RequestAuthError || error instanceof AdvertiserPortalError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: 'Portal access could not be revoked.' }, { status: 500 });
  }
}
