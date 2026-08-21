'use client';

import { useState } from 'react';

export default function LogoutButton({ reservationId }: { reservationId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function logout() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/business-session/${reservationId}/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Sign out failed.');
      window.location.assign('/business-login?reason=logged-out');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'This browser could not confirm sign out.');
      setBusy(false);
    }
  }

  return <div>
    <button type="button" disabled={busy} onClick={() => void logout()} className="rounded-lg border px-5 py-3 font-bold disabled:opacity-50">{busy ? 'Signing out…' : 'Sign out this browser'}</button>
    {error && <p role="alert" className="mt-2 text-sm font-bold text-rose-800">{error}</p>}
  </div>;
}
