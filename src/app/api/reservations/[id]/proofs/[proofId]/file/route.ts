import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { privateFileHeaders } from '@/lib/privateUploads';
import { reservationCookieName, verifyReservationAccess } from '@/lib/reservationAuth';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; proofId: string }> }) {
  const { id, proofId } = await params;
  try {
    const access = await verifyReservationAccess(id, request.cookies.get(reservationCookieName(id))?.value);
    if (!access) return NextResponse.json({ error: 'Private reservation access required.' }, { status: 401 });
    const proof = await getAdminFirestore().collection('proofs').doc(proofId).get(); const data = proof.data();
    if (!proof.exists || data?.reservationId !== id || !data.storagePath) return NextResponse.json({ error: 'Proof not found.' }, { status: 404 });
    const [buffer] = await getAdminStorage().file(String(data.storagePath)).download();
    return new NextResponse(new Uint8Array(buffer), { headers: privateFileHeaders(String(data.contentType), String(data.originalName), true) });
  } catch { return NextResponse.json({ error: 'Proof file unavailable.' }, { status: 503 }); }
}
