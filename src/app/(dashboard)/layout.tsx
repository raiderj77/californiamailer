import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { AuthProvider } from '@/lib/AuthContext';
import { getAdminAuth } from '@/lib/firebaseAdmin';
import { ownerTokenAllowed } from '@/lib/serverAuth';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = (await cookies()).get('cm_owner_session')?.value;
  if (!session) redirect('/owner-login');
  try {
    const token = await getAdminAuth().verifySessionCookie(session, true);
    if (!ownerTokenAllowed(token)) redirect('/owner-login');
  } catch {
    redirect('/owner-login');
  }
  return <AuthProvider>{children}</AuthProvider>;
}
