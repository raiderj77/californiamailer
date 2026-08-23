'use client';

import { useCallback, useEffect, useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { useAuth } from '@/lib/AuthContext';
import type { CouponDraftContent, CouponFactContext } from '@/lib/couponRules';

interface CouponReviewRecord {
  id: string;
  reservationId: string;
  trackingId: string;
  businessName: string;
  couponCode: string;
  reviewStatus: string;
  publicationStatus: string;
  draftVersion: number;
  approvedDraftVersion: number | null;
  draft: CouponDraftContent;
  publishedContent: CouponDraftContent | null;
  context: CouponFactContext;
  ownerNote: string;
  submittedAt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  currentPaid: boolean;
  trackingActive: boolean;
  publicAvailable: boolean;
  unavailableReason: string | null;
  publicPath: string | null;
  expectedPublishConfirmation: string;
  expectedUnpublishConfirmation: string;
}

export default function CouponsPage() {
  const { user, loading, logout } = useAuth();
  const [records, setRecords] = useState<CouponReviewRecord[]>([]);
  const [confirmations, setConfirmations] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const authFetch = useCallback(async (init: RequestInit = {}) => {
    if (!user) throw new Error('Owner access required.');
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${await user.getIdToken()}`);
    if (init.body) headers.set('Content-Type', 'application/json');
    const response = await fetch('/api/admin/coupons', { ...init, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Coupon review request failed.');
    return data;
  }, [user]);

  const load = useCallback(async () => {
    const data = await authFetch();
    setRecords(Array.isArray(data.coupons) ? data.coupons : []);
  }, [authFetch]);

  useEffect(() => {
    if (!user) return;
    void load().catch((caught) => {
      setMessageIsError(true);
      setMessage(caught instanceof Error ? caught.message : 'Coupon drafts are unavailable.');
    });
  }, [load, user]);

  async function decide(
    record: CouponReviewRecord,
    action: 'publish' | 'request_changes' | 'unpublish',
  ) {
    setBusyId(record.id);
    setMessage('');
    setMessageIsError(false);
    try {
      const body = action === 'request_changes'
        ? {
          action,
          couponId: record.id,
          draftVersion: record.draftVersion,
          ownerNote: notes[record.id] || '',
        }
        : action === 'publish'
          ? {
            action,
            couponId: record.id,
            draftVersion: record.draftVersion,
            confirmation: confirmations[record.id] || '',
          }
          : {
            action,
            couponId: record.id,
            confirmation: confirmations[record.id] || '',
          };
      await authFetch({ method: 'PATCH', body: JSON.stringify(body) });
      setMessage(action === 'publish'
        ? `Published exact draft version ${record.draftVersion} for ${record.businessName}.`
        : action === 'unpublish'
          ? `Unpublished ${record.businessName}’s coupon page.`
          : `Returned draft version ${record.draftVersion} with an owner note.`);
      setConfirmations((current) => ({ ...current, [record.id]: '' }));
      await load();
    } catch (caught) {
      setMessageIsError(true);
      setMessage(caught instanceof Error ? caught.message : 'Coupon decision failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Sign in with the owner account.</Centered>;

  const pending = records.filter((record) => record.reviewStatus === 'submitted_for_owner_review');
  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <header className="mb-7 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">
              Human publication gate
            </p>
            <h1 className="text-3xl font-black">Coupon review</h1>
          </div>
          <button onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button>
        </header>

        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <strong>AI and advertisers can draft, but neither can publish.</strong>{' '}
          Compare the exact submitted version with the advertiser-supplied facts. Publishing
          requires the current paid reservation, active tracking record, matching unique coupon
          code, and the exact confirmation phrase shown on the card.
        </div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <Stat label="Draft records" value={records.length} />
          <Stat label="Waiting for review" value={pending.length} />
          <Stat label="Public and currently eligible" value={records.filter((item) => item.publicAvailable).length} />
        </div>
        {message && (
          <p
            role={messageIsError ? 'alert' : 'status'}
            aria-live={messageIsError ? 'assertive' : 'polite'}
            className={`mb-6 rounded-lg p-3 text-sm font-bold ${messageIsError ? 'bg-rose-50 text-rose-950' : 'bg-emerald-50 text-emerald-950'}`}
          >
            {message}
          </p>
        )}

        {records.length ? (
          <div className="space-y-7">
            {records.map((record) => {
              const publishReady = record.reviewStatus === 'submitted_for_owner_review'
                && record.currentPaid
                && record.trackingActive;
              const publishing = busyId === record.id;
              const hasSubmittedRevision = record.reviewStatus === 'submitted_for_owner_review';
              const expectedConfirmation = hasSubmittedRevision
                ? record.expectedPublishConfirmation
                : record.publicationStatus === 'published'
                  ? record.expectedUnpublishConfirmation
                  : record.expectedPublishConfirmation;
              return (
                <article key={record.id} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b p-5">
                    <div>
                      <h2 className="text-xl font-black">{record.businessName}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Code {record.couponCode} · draft version {record.draftVersion}
                      </p>
                    </div>
                    <div className="text-right text-xs font-bold">
                      <div>{record.reviewStatus.replaceAll('_', ' ')}</div>
                      <div className={record.publicAvailable ? 'text-emerald-700' : 'text-amber-700'}>
                        {record.publicAvailable ? 'public and eligible' : record.publicationStatus.replaceAll('_', ' ')}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-7 p-5 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
                    <OwnerCouponPreview record={record} />
                    <div>
                      <h3 className="font-black">Advertiser-supplied grounding facts</h3>
                      <dl className="mt-3 space-y-3 text-sm">
                        <Fact label="Industry" value={record.context.industry} />
                        <Fact label="Factual services" value={record.context.serviceFacts} />
                        <Fact label="Exact offer" value={record.context.factualOffer} />
                        <Fact label="Redemption instructions" value={record.context.redemptionInstructions} />
                        <Fact label="Audience" value={record.context.audience} />
                        <Fact label="Verified facts" value={record.context.verifiedFacts} />
                      </dl>

                      <h3 className="mt-6 font-black">Publication gates</h3>
                      <ul className="mt-3 space-y-2 text-sm">
                        <Gate passed={record.currentPaid} label="Reservation is currently provider-verified paid" />
                        <Gate passed={record.trackingActive} label="Unique tracking record is active" />
                        <Gate passed={record.reviewStatus === 'submitted_for_owner_review'} label="Advertiser submitted this exact version" />
                      </ul>

                      <label className="mt-6 block text-sm font-bold">
                        Owner note for requested changes
                        <textarea
                          rows={3}
                          value={notes[record.id] || ''}
                          maxLength={1_000}
                          onChange={(event) => setNotes((current) => ({ ...current, [record.id]: event.target.value }))}
                          className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={publishing || (notes[record.id] || '').trim().length < 3}
                        onClick={() => void decide(record, 'request_changes')}
                        className="mt-3 rounded-full border border-amber-400 px-4 py-2 text-sm font-black text-amber-900 disabled:opacity-40"
                      >
                        Request changes to this version
                      </button>

                      <label className="mt-6 block text-sm font-bold">
                        Type exactly: <code>{expectedConfirmation}</code>
                        <input
                          value={confirmations[record.id] || ''}
                          autoComplete="off"
                          onChange={(event) => setConfirmations((current) => ({ ...current, [record.id]: event.target.value }))}
                          className="mt-1 w-full rounded-lg border px-3 py-2 font-mono font-normal"
                        />
                      </label>
                      {hasSubmittedRevision ? (
                        <button
                          type="button"
                          disabled={publishing || !publishReady || confirmations[record.id] !== record.expectedPublishConfirmation}
                          onClick={() => void decide(record, 'publish')}
                          className="mt-3 rounded-full bg-emerald-700 px-5 py-3 font-black text-white disabled:opacity-40"
                        >
                          Exact-confirm and publish version {record.draftVersion}
                        </button>
                      ) : record.publicationStatus === 'published' ? (
                        <button
                          type="button"
                          disabled={publishing || confirmations[record.id] !== record.expectedUnpublishConfirmation}
                          onClick={() => void decide(record, 'unpublish')}
                          className="mt-3 rounded-full bg-rose-700 px-5 py-3 font-black text-white disabled:opacity-40"
                        >
                          Exact-confirm unpublish
                        </button>
                      ) : null}
                      {record.publicPath && (
                        <a
                          href={record.publicPath}
                          target="_blank"
                          rel="noreferrer"
                          className="ml-3 mt-3 inline-flex font-black text-blue-700 underline"
                        >
                          Open public page
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border bg-white p-10 text-center text-slate-500">
            No real advertiser coupon drafts exist. No sample claims were created.
          </div>
        )}
      </main>
    </div>
  );
}

function OwnerCouponPreview({ record }: { record: CouponReviewRecord }) {
  const draft = record.draft;
  return (
    <div>
      <div className="overflow-hidden rounded-3xl border border-slate-300">
        <div className="bg-slate-950 px-4 py-3 text-center text-xs font-black uppercase tracking-[.16em] text-white">
          Exact draft version {record.draftVersion}
        </div>
        <div className="p-6">
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">{record.businessName}</p>
          <h3 className="mt-3 text-3xl font-black leading-tight">{draft.headline || 'No headline'}</h3>
          {draft.body && <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-600">{draft.body}</p>}
          <div className="mt-5 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5">
            <p className="text-2xl font-black">{draft.offer || 'No offer'}</p>
            <p className="mt-2 text-xs font-bold">Code {record.couponCode}</p>
            <p className="mt-1 text-xs text-slate-500">{draft.expiresOn || 'No expiration stated'}</p>
          </div>
          {draft.backHeadline && <h4 className="mt-5 text-xl font-black">{draft.backHeadline}</h4>}
          {draft.servicesList && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{draft.servicesList}</p>}
          {draft.backCoupon && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-950">{draft.backCoupon}</p>}
          <p className="mt-5 whitespace-pre-wrap text-xs leading-5 text-slate-500">{draft.terms || 'No terms'}</p>
          <div className="mt-5 inline-flex rounded-full bg-blue-700 px-4 py-2 text-sm font-black text-white">
            {draft.callToAction || 'No call to action'}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Submitted {formatDate(record.submittedAt)} · updated {formatDate(record.updatedAt)}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap leading-6">{value || 'Not supplied'}</dd>
    </div>
  );
}

function Gate({ passed, label }: { passed: boolean; label: string }) {
  return (
    <li className={passed ? 'text-emerald-800' : 'text-rose-800'}>
      <strong>{passed ? 'Pass' : 'Blocked'}:</strong> {label}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-white p-4"><div className="text-2xl font-black">{value}</div><div className="text-sm text-slate-500">{label}</div></div>;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>;
}

function formatDate(value: string | null) {
  if (!value) return 'not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'not recorded' : date.toLocaleString();
}
