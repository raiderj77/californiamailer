'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { PublicShell } from '@/components/public/PublicShell';

export default function ConsumeBusinessAccessPage() {
  const token = useRef('');
  const initialized = useRef(false);
  const [state, setState] = useState<'loading' | 'ready' | 'consuming' | 'invalid'>('loading');
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const candidate = fragment.get('token') || '';
    window.history.replaceState(null, '', window.location.pathname);
    if (!/^[A-Za-z0-9_-]{40,100}$/.test(candidate)) {
      setState('invalid');
      return;
    }
    token.current = candidate;
    setState('ready');
  }, []);

  async function consume() {
    if (!token.current) return;
    setState('consuming');
    setError('');
    const oneTimeToken = token.current;
    token.current = '';
    try {
      const response = await fetch('/api/business-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: oneTimeToken }),
      });
      const body = await response.json();
      if (!response.ok || body.success !== true || typeof body.destination !== 'string') {
        throw new Error(body.error || 'Private access could not be created.');
      }
      window.location.replace(body.destination);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Private access could not be created.');
      setState('invalid');
    }
  }

  return <PublicShell><section className="mx-auto max-w-2xl px-5 py-24 text-center">
    <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">One-time private access</p>
    <h1 className="mt-3 text-4xl font-black">Open your placement portal</h1>
    {state === 'loading' && <p role="status" className="mt-6 text-slate-600">Removing the one-time token from the address bar…</p>}
    {state === 'ready' && <><p className="mt-6 text-lg leading-8 text-slate-700">The link is ready. Continue to create an expiring browser session for this reservation only.</p><button type="button" onClick={() => void consume()} className="mt-8 rounded-full bg-blue-700 px-6 py-3 font-black text-white">Continue securely</button></>}
    {state === 'consuming' && <p role="status" aria-live="polite" className="mt-6 text-slate-600">Creating the reservation-scoped session…</p>}
    {state === 'invalid' && <><p role="alert" className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-900">{error || 'That one-time link is missing, invalid, expired, already used, or revoked.'}</p><Link href="/business-login" className="mt-8 inline-block rounded-full bg-slate-950 px-6 py-3 font-black text-white">Business portal access help</Link></>}
    <p className="mt-8 text-sm leading-6 text-slate-500">CaliforniaMailer does not send a message, create a business-wide account, reserve inventory, or charge a payment when this session opens.</p>
  </section></PublicShell>;
}
