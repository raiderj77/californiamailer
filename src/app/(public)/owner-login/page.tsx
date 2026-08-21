'use client';

import { getFirebaseAuth, getGoogleProvider } from '@/lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function OwnerLoginPage() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signIn() {
    setBusy(true); setError('');
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, getGoogleProvider());
      const response = await fetch('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: await result.user.getIdToken(true) }) });
      if (!response.ok) { await signOut(auth); throw new Error('This verified Google account is not authorized as the CaliforniaMailer owner.'); }
      router.replace('/dashboard'); router.refresh();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Owner sign-in failed.'); }
    finally { setBusy(false); }
  }
  return <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5"><section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl"><p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Private workspace</p><h1 className="mt-2 text-3xl font-black">CaliforniaMailer owner sign-in</h1><p className="mt-4 leading-7 text-slate-600">Access requires the single verified owner email configured on the server or an explicit Firebase admin claim. Other Google accounts are denied.</p>{error && <p className="mt-5 rounded-lg bg-rose-100 p-3 text-sm text-rose-900">{error}</p>}<button disabled={busy} onClick={() => void signIn()} className="mt-6 w-full rounded-lg bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? 'Verifying…' : 'Continue with authorized Google account'}</button><Link href="/home" className="mt-5 block text-center text-sm font-bold text-slate-500 underline">Return to public site</Link></section></main>;
}
