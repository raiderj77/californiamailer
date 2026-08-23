import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { privateFileHeaders } from '@/lib/privateUploads';
import { RequestAuthError, requireOwnerSession } from '@/lib/serverAuth';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerSession(request); const { id } = await params; const proof = await getAdminFirestore().collection('proofs').doc(id).get(); const data = proof.data();
    if (!proof.exists || !data?.storagePath) return NextResponse.json({ error: 'Proof not found.' }, { status: 404 });
    const [buffer] = await getAdminStorage().file(String(data.storagePath)).download();
    return new NextResponse(new Uint8Array(buffer), { headers: privateFileHeaders(String(data.contentType), String(data.originalName), true) });
  } catch (error) { const status = error instanceof RequestAuthError ? error.status : 503; return NextResponse.json({ error: status === 503 ? 'Proof file unavailable.' : 'Owner access required.' }, { status }); }
}
