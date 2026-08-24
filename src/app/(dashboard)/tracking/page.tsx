'use client';

import QRCode from 'qrcode';
import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';

interface PaidReservation {
  id: string;
  businessName: string;
  website: string;
}

interface TrackingLink {
  id: string;
  reservationId: string;
  businessName: string;
  active: boolean;
  currentPaid: boolean;
  destinationUrl: string;
  couponCode: string;
  phoneExtension: string;
  measured: {
    nonBotHttpRequests: number;
    suspectedBotHttpRequests: number;
    unknownClassificationHttpRequests: number;
  };
  selfReported: Record<string, number>;
  delivery: {
    deliveredAt: string | null;
    evidenceReference: string;
    ownerNote: string;
    recordedAt: string | null;
  } | null;
}

export default function TrackingPage() {
  const { user, loading, logout } = useAuth();
  const [reservations, setReservations] = useState<PaidReservation[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [reservationId, setReservationId] = useState('');
  const [destinationUrl, setDestinationUrl] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [phoneExtension, setPhoneExtension] = useState('');
  const [reportLink, setReportLink] = useState('');
  const [metricType, setMetricType] = useState('lead');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [deliveryLink, setDeliveryLink] = useState('');
  const [deliveredAt, setDeliveredAt] = useState('');
  const [evidenceReference, setEvidenceReference] = useState('');
  const [deliveryNote, setDeliveryNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const authFetch = useCallback(async (init: RequestInit = {}) => {
    if (!user) throw new Error('Owner access required.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
    const response = await fetch('/api/admin/tracking', { ...init, headers });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Tracking request failed.');
    return data;
  }, [user]);

  const load = useCallback(async () => {
    const data = await authFetch();
    setReservations(data.paidReservations);
    setLinks(data.links);
  }, [authFetch]);

  useEffect(() => {
    if (user) void load().catch((caught) => {
      setMessage(caught instanceof Error ? caught.message : 'Tracking data unavailable.');
    });
  }, [load, user]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const result = await authFetch({
        method: 'POST',
        body: JSON.stringify({ reservationId, destinationUrl, couponCode, phoneExtension }),
      });
      setMessage(`Inactive tracking record created: ${result.path}. Review it before activation.`);
      setCouponCode('');
      setPhoneExtension('');
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Tracking record failed.');
    } finally {
      setBusy(false);
    }
  }

  async function toggle(link: TrackingLink) {
    setBusy(true);
    setMessage('');
    try {
      await authFetch({
        method: 'PATCH',
        body: JSON.stringify({
          action: link.active ? 'deactivate' : 'activate',
          trackingId: link.id,
        }),
      });
      setMessage(link.active
        ? 'Public redirect deactivated.'
        : 'Public redirect activated for the current paid reservation. No response is inferred.');
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Tracking update failed.');
    } finally {
      setBusy(false);
    }
  }

  async function report(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await authFetch({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'record_report',
          trackingId: reportLink,
          metricType,
          quantity: Number(quantity),
          amountCents: amount ? Math.round(Number(amount) * 100) : null,
          note,
        }),
      });
      setMessage('Advertiser-reported metric recorded separately from measured HTTP requests.');
      setNote('');
      setAmount('');
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Report could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  async function recordDelivery(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      await authFetch({
        method: 'PATCH',
        body: JSON.stringify({
          action: 'record_delivery',
          trackingId: deliveryLink,
          deliveredAt: new Date(deliveredAt).toISOString(),
          evidenceReference,
          ownerNote: deliveryNote,
        }),
      });
      setMessage('Advertiser-visible delivery evidence recorded. No response or outcome was inferred.');
      setDeliveryLink('');
      setDeliveredAt('');
      setEvidenceReference('');
      setDeliveryNote('');
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Delivery evidence could not be recorded.');
    } finally {
      setBusy(false);
    }
  }

  function chooseReservation(id: string) {
    setReservationId(id);
    setDestinationUrl(reservations.find((item) => item.id === id)?.website || '');
  }

  async function downloadQr(link: TrackingLink) {
    const dataUrl = await QRCode.toDataURL(`${window.location.origin}/go/${link.id}`, {
      width: 1024,
      margin: 4,
      errorCorrectionLevel: 'H',
    });
    const anchor = document.createElement('a');
    anchor.href = dataUrl;
    anchor.download = `${link.businessName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-tracking-qr.png`;
    anchor.click();
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;

  const currentLinks = links.filter((link) => link.currentPaid);

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Evidence, not attribution theater</p>
            <h1 className="text-3xl font-black">Tracking and advertiser reports</h1>
          </div>
          <button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button>
        </header>
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>A measured redirect request is not a QR scan, person, lead, customer, or sale.</strong>{' '}
          Likely bots and unknown classifications are separated. Coupon uses, calls, leads,
          appointments, and sales entered here are owner-recorded advertiser reports. Delivery
          evidence documents mailing only.
        </div>
        {message && (
          <p className="mb-5 rounded-lg bg-blue-50 p-3 text-sm font-bold text-blue-900">{message}</p>
        )}

        <section className="grid gap-6 xl:grid-cols-3">
          <form onSubmit={create} className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Create inactive tracking assets</h2>
            <Select label="Paid reservation" value={reservationId} onChange={(event) => chooseReservation(event.target.value)}>
              <option value="">Select…</option>
              {reservations
                .filter((item) => !links.some((link) => link.reservationId === item.id))
                .map((item) => <option key={item.id} value={item.id}>{item.businessName}</option>)}
            </Select>
            <Input label="Public HTTPS destination" type="url" required value={destinationUrl} onChange={(event) => setDestinationUrl(event.target.value)} />
            <Input label="Unique coupon code (blank = random)" value={couponCode} onChange={(event) => setCouponCode(event.target.value)} />
            <Input label="Phone extension (optional digits)" inputMode="numeric" value={phoneExtension} onChange={(event) => setPhoneExtension(event.target.value.replace(/\D/g, '').slice(0, 10))} />
            <button disabled={busy || !reservationId} className="mt-5 rounded-lg bg-blue-700 px-5 py-3 font-black text-white disabled:opacity-40">
              Create inactive record
            </button>
          </form>

          <form onSubmit={report} className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Record advertiser-reported outcome</h2>
            <Select label="Current paid tracking record" required value={reportLink} onChange={(event) => setReportLink(event.target.value)}>
              <option value="">Select…</option>
              {currentLinks.map((link) => <option key={link.id} value={link.id}>{link.businessName}</option>)}
            </Select>
            <Select label="Reported metric" value={metricType} onChange={(event) => setMetricType(event.target.value)}>
              {['coupon_redemption', 'lead', 'call', 'appointment', 'sale', 'note'].map((item) => (
                <option key={item} value={item}>{item.replaceAll('_', ' ')}</option>
              ))}
            </Select>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input label="Quantity" type="number" min="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              <Input label="Reported sales amount (optional USD)" type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </div>
            <label className="mt-4 block text-sm font-bold">
              Source note
              <textarea required minLength={3} rows={3} value={note} onChange={(event) => setNote(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
            </label>
            <button disabled={busy || !reportLink} className="mt-5 rounded-lg bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">
              Record as advertiser-reported
            </button>
          </form>

          <form onSubmit={recordDelivery} className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-xl font-black">Record delivery evidence</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              This private record is visible to the advertiser. Use a real USPS, printer, or
              delivery confirmation reference; do not infer household receipt or response.
            </p>
            <Select label="Current paid tracking record" required value={deliveryLink} onChange={(event) => setDeliveryLink(event.target.value)}>
              <option value="">Select…</option>
              {currentLinks
                .filter((link) => !link.delivery)
                .map((link) => <option key={link.id} value={link.id}>{link.businessName}</option>)}
            </Select>
            <Input label="Documented delivery time" type="datetime-local" required value={deliveredAt} onChange={(event) => setDeliveredAt(event.target.value)} />
            <Input label="Evidence / confirmation reference" required minLength={3} value={evidenceReference} onChange={(event) => setEvidenceReference(event.target.value)} />
            <label className="mt-4 block text-sm font-bold">
              Advertiser-visible owner note (optional)
              <textarea rows={3} value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
            </label>
            <button disabled={busy || !deliveryLink} className="mt-5 rounded-lg bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-40">
              Record delivery evidence
            </button>
          </form>
        </section>

        <section className="mt-7 overflow-hidden rounded-xl border bg-white shadow-sm">
          <h2 className="border-b p-5 text-xl font-black">Per-advertiser reporting</h2>
          {links.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px] text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="p-3">Advertiser</th>
                    <th className="p-3">Public asset</th>
                    <th className="p-3">Measured requests</th>
                    <th className="p-3">Advertiser-reported</th>
                    <th className="p-3">Delivery evidence</th>
                    <th className="p-3">State</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {links.map((link) => (
                    <tr key={link.id}>
                      <td className="p-3 font-bold">{link.businessName}</td>
                      <td className="p-3">
                        <code>/go/{link.id}</code>
                        <div>Coupon: {link.couponCode}</div>
                        {link.phoneExtension && <div>Phone ext.: {link.phoneExtension}</div>}
                        <div className="mt-1 flex gap-2">
                          <button onClick={() => void navigator.clipboard.writeText(`${window.location.origin}/go/${link.id}`)} className="text-xs font-bold text-blue-700 underline">Copy URL</button>
                          <button onClick={() => void downloadQr(link)} className="text-xs font-bold text-blue-700 underline">Download QR encoding URL</button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div><strong>{link.measured.nonBotHttpRequests}</strong> non-bot</div>
                        <div>{link.measured.suspectedBotHttpRequests} suspected bot</div>
                        <div>{link.measured.unknownClassificationHttpRequests} unknown</div>
                      </td>
                      <td className="p-3">
                        {Object.entries(link.selfReported).some(([, value]) => value > 0)
                          ? Object.entries(link.selfReported)
                            .filter(([, value]) => value > 0)
                            .map(([key, value]) => <div key={key}>{key.replaceAll('_', ' ')}: {value}</div>)
                          : 'None'}
                      </td>
                      <td className="p-3">
                        {link.delivery ? (
                          <>
                            <div className="font-bold">{formatDate(link.delivery.deliveredAt)}</div>
                            <div>{link.delivery.evidenceReference}</div>
                          </>
                        ) : 'Not recorded'}
                      </td>
                      <td className="p-3">
                        <div className={link.active ? 'font-bold text-emerald-700' : 'font-bold text-amber-700'}>
                          {link.active ? 'Active' : 'Inactive'}
                        </div>
                        <div className={`text-xs ${link.currentPaid ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {link.currentPaid ? 'Current paid reservation' : 'Not current/paid'}
                        </div>
                        <button
                          disabled={busy || (!link.active && !link.currentPaid)}
                          onClick={() => void toggle(link)}
                          className="mt-2 rounded border px-3 py-1 text-xs font-bold disabled:opacity-40"
                        >
                          {link.active ? 'Deactivate' : 'Activate after review'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-8 text-center text-sm text-slate-500">No real tracking records. No sample events are created.</p>
          )}
        </section>
      </main>
    </div>
  );
}

function Input({ label, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      <input {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal" />
    </label>
  );
}

function Select({
  label,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      <select {...props} className="mt-1 w-full rounded-lg border px-3 py-2 font-normal">
        {children}
      </select>
    </label>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>;
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}
