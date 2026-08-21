'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  COUPON_CONTEXT_LIMITS,
  COUPON_TEXT_LIMITS,
  type CouponAiField,
  type CouponDraftContent,
  type CouponFactContext,
} from '@/lib/couponRules';
import {
  ASSET_RIGHTS_LIMITS,
  ASSET_RIGHTS_STATEMENT,
  CREATIVE_BRIEF_LIMITS,
  EMPTY_CREATIVE_BRIEF,
  type AssetRightsBasis,
  type CreativeAssetKind,
  type CreativeBriefContent,
} from '@/lib/creativeBrief';

interface Proof {
  id: string;
  version: number;
  status: string;
  originalName: string;
  ownerNotes: string;
  revisionRequests: Array<{ text?: string }>;
  approvedAt: string | null;
  approvedBy: string | null;
  fileUrl: string;
}

interface Material {
  id: string;
  version: number;
  assetKind: CreativeAssetKind | null;
  originalName: string;
  status: string;
  rightsAttestation: {
    assetKind: CreativeAssetKind;
    rightsBasis: AssetRightsBasis;
    attestorName: string;
    sourceOrLicenseNote: string;
    rightsAttested: true;
  } | null;
  rightsAttestedAt: string | null;
}

interface CreativeBriefRecord {
  id: string;
  version: number;
  status: string;
  content: CreativeBriefContent;
  currentDeliveryErrors: string[];
  createdAt: string | null;
}

interface CreativeBriefWorkspace {
  creativeBrief: CreativeBriefRecord | null;
  initialContent: CreativeBriefContent | null;
  deliveryWindow: {
    startDate: string | null;
    endDate: string | null;
    timeZone: string;
    validationStatus: string;
  };
}

function isCreativeBriefDeliveryWindow(
  value: unknown,
): value is CreativeBriefWorkspace['deliveryWindow'] {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    (record.startDate === null || typeof record.startDate === 'string')
    && (record.endDate === null || typeof record.endDate === 'string')
    && typeof record.timeZone === 'string'
    && typeof record.validationStatus === 'string'
  );
}

interface TrackingReport {
  active: boolean;
  publicPath: string | null;
  couponCode: string | null;
  phoneExtension: string | null;
  directlyMeasured: {
    nonBotHttpRequests: number;
    suspectedBotHttpRequests: number;
    unknownClassificationHttpRequests: number;
    label: string;
    limitation: string;
  };
  advertiserReported: {
    totals: Record<string, number>;
    entries: Array<{
      id: string;
      metricType: string;
      quantity: number;
      amountCents: number | null;
      note: string;
      recordedAt: string | null;
      source: string;
    }>;
  };
  delivery: {
    status: string;
    deliveredAt: string | null;
    evidenceReference: string;
    ownerNote: string;
    recordedAt: string | null;
    limitation: string;
  } | null;
}

interface CouponWorkspace {
  coupon: {
    reservationId: string;
    trackingId: string;
    couponCode: string;
    businessName: string;
    reviewStatus: string;
    publicationStatus: string;
    draftVersion: number;
    draft: CouponDraftContent;
    context: CouponFactContext;
    ownerNote: string;
    submittedAt: string | null;
    publishedAt: string | null;
    publishedPath: string | null;
  };
  ai: {
    enabled: boolean;
    model: string;
    reason: string | null;
    dailyQuota: number;
    usedToday: number;
    remainingToday: number;
    utcDay: string;
  };
}

type PortalLoadResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

async function loadPortalResource<T>(
  url: string,
  parse: (payload: Record<string, unknown>) => T,
  fallbackError: string,
): Promise<PortalLoadResult<T>> {
  try {
    const response = await fetch(url);
    const payload = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      return {
        ok: false,
        error: typeof payload?.error === 'string' ? payload.error : fallbackError,
      };
    }
    if (!payload) return { ok: false, error: fallbackError };
    try {
      return { ok: true, value: parse(payload) };
    } catch {
      return { ok: false, error: fallbackError };
    }
  } catch {
    return { ok: false, error: fallbackError };
  }
}

export function ReservationProductionPanel({
  reservationId,
  status,
}: {
  reservationId: string;
  status: string;
}) {
  const [proofs, setProofs] = useState<Proof[] | undefined>(undefined);
  const [proofsError, setProofsError] = useState('');
  const [materials, setMaterials] = useState<Material[] | undefined>(undefined);
  const [materialsError, setMaterialsError] = useState('');
  const [creativeWorkspace, setCreativeWorkspace] = useState<CreativeBriefWorkspace | undefined>(undefined);
  const [creativeError, setCreativeError] = useState('');
  const [tracking, setTracking] = useState<TrackingReport | null | undefined>(undefined);
  const [trackingError, setTrackingError] = useState('');
  const [couponWorkspace, setCouponWorkspace] = useState<CouponWorkspace | null | undefined>(undefined);
  const [couponUnavailableReason, setCouponUnavailableReason] = useState('');
  const [name, setName] = useState('');
  const [revision, setRevision] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageIsError, setMessageIsError] = useState(false);

  const load = useCallback(async () => {
    if (status !== 'paid') return;
    setProofs(undefined);
    setProofsError('');
    setMaterials(undefined);
    setMaterialsError('');
    setCreativeWorkspace(undefined);
    setCreativeError('');
    setTracking(undefined);
    setTrackingError('');
    setCouponWorkspace(undefined);
    setCouponUnavailableReason('');

    const [proofResult, materialResult, creativeResult, trackingResult, couponResult] = await Promise.all([
      loadPortalResource(
        `/api/reservations/${reservationId}/proofs`,
        (payload) => {
          if (!Array.isArray(payload.proofs)) throw new Error('Invalid proofs response.');
          return payload.proofs as Proof[];
        },
        'Proof history could not be loaded. Try again before making a proof decision.',
      ),
      loadPortalResource(
        `/api/reservations/${reservationId}/materials`,
        (payload) => {
          if (!Array.isArray(payload.materials)) throw new Error('Invalid materials response.');
          return payload.materials as Material[];
        },
        'Private materials could not be loaded. Try again before assuming no files were received.',
      ),
      loadPortalResource(
        `/api/reservations/${reservationId}/creative-brief`,
        (payload) => {
          if (
            !Object.hasOwn(payload, 'creativeBrief')
            || !Object.hasOwn(payload, 'initialContent')
            || !isCreativeBriefDeliveryWindow(payload.deliveryWindow)
          ) throw new Error('Invalid creative brief response.');
          return payload as unknown as CreativeBriefWorkspace;
        },
        'The structured creative brief could not be loaded. No empty brief is inferred.',
      ),
      loadPortalResource(
        `/api/reservations/${reservationId}/tracking`,
        (payload) => {
          if (!Object.hasOwn(payload, 'tracking')) throw new Error('Invalid tracking response.');
          if (payload.tracking !== null && typeof payload.tracking !== 'object') {
            throw new Error('Invalid tracking response.');
          }
          return payload.tracking as TrackingReport | null;
        },
        'The private tracking report could not be loaded. No absence of tracking is inferred.',
      ),
      loadPortalResource(
        `/api/reservations/${reservationId}/coupon`,
        (payload) => {
          if (
            !payload.coupon
            || typeof payload.coupon !== 'object'
            || !payload.ai
            || typeof payload.ai !== 'object'
          ) throw new Error('Invalid coupon response.');
          return payload as unknown as CouponWorkspace;
        },
        'The private coupon workspace is unavailable.',
      ),
    ]);

    if (proofResult.ok) {
      setProofs(proofResult.value);
    } else {
      setProofs(undefined);
      setProofsError(proofResult.error);
    }
    if (materialResult.ok) {
      setMaterials(materialResult.value);
    } else {
      setMaterials(undefined);
      setMaterialsError(materialResult.error);
    }
    if (creativeResult.ok) {
      setCreativeWorkspace(creativeResult.value);
    } else {
      setCreativeWorkspace(undefined);
      setCreativeError(creativeResult.error);
    }
    if (trackingResult.ok) {
      setTracking(trackingResult.value);
    } else {
      setTracking(undefined);
      setTrackingError(trackingResult.error);
    }
    if (couponResult.ok) {
      setCouponWorkspace(couponResult.value);
    } else {
      setCouponWorkspace(null);
      setCouponUnavailableReason(couponResult.error);
    }
  }, [reservationId, status]);

  useEffect(() => {
    if (status !== 'paid') return;
    void load();
  }, [load, status]);

  if (status !== 'paid') {
    return (
      <div className="mt-6 rounded-2xl bg-slate-50 p-5 text-sm text-slate-600">
        Materials intake and proof decisions open only after provider-verified cleared payment.
        Pending or returned checkout does not qualify.
      </div>
    );
  }

  async function upload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/materials`, {
        method: 'POST',
        body: new FormData(form),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      setMessage(response.ok
        ? 'Creative asset and its rights attestation were saved as a new private version for owner review.'
        : result.error || 'Upload failed.');
      setMessageIsError(!response.ok);
      if (response.ok) {
        form.reset();
        await load();
      }
    } catch {
      setMessage('Upload failed because the private materials service could not be reached.');
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  function recordCreativeBriefSave(
    creativeBrief: CreativeBriefRecord,
    deliveryWindow: CreativeBriefWorkspace['deliveryWindow'],
    notice: string,
  ) {
    setCreativeWorkspace((current) => current ? {
      ...current,
      creativeBrief,
      initialContent: null,
      deliveryWindow,
    } : current);
    setMessage(notice);
    setMessageIsError(false);
  }

  async function decide(proofId: string, action: 'approve' | 'request_revision') {
    setBusy(true);
    setMessage('');
    setMessageIsError(false);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/proofs`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          proofId,
          action,
          approverName: name,
          revisionRequest: revision,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      setMessage(response.ok
        ? 'Decision recorded for the exact proof version.'
        : result.error || 'Decision failed.');
      setMessageIsError(!response.ok);
      if (response.ok) {
        setRevision('');
        await load();
      }
    } catch {
      setMessage('The proof decision could not be recorded because the private service could not be reached.');
      setMessageIsError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 space-y-6">
      <CreativeBriefPanel
        key={creativeWorkspace?.creativeBrief?.id || 'creative-brief-intake'}
        reservationId={reservationId}
        workspace={creativeWorkspace}
        error={creativeError}
        onSaved={recordCreativeBriefSave}
      />

      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Private materials intake</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Upload a genuine PNG or JPEG asset up to 5 MB. Every file version requires its own
          rights or license attestation. The randomized private object remains quarantined until
          owner review; this action never publishes it or makes it print-ready.
        </p>
        <form onSubmit={upload} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-bold text-slate-700">
            Asset type
            <select
              required
              name="assetKind"
              defaultValue="logo"
              className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal"
            >
              <option value="logo">Business logo</option>
              <option value="brand_image">Brand image or photo</option>
              <option value="prior_ad_reference">Prior ad reference</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Rights basis
            <select
              required
              name="rightsBasis"
              defaultValue="business_owned"
              className="mt-1 block w-full rounded-lg border bg-white px-3 py-2 font-normal"
            >
              <option value="business_owned">The business owns it</option>
              <option value="licensed_for_this_use">Licensed for this use</option>
              <option value="public_domain">Verified public domain</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Private creative file
            <input
              required
              name="file"
              type="file"
              accept="image/png,image/jpeg"
              className="mt-1 block text-sm font-normal"
            />
          </label>
          <label className="text-sm font-bold text-slate-700">
            Attestor’s full name
            <input
              required
              name="attestorName"
              maxLength={ASSET_RIGHTS_LIMITS.attestorName}
              className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"
            />
          </label>
          <label className="text-sm font-bold text-slate-700 sm:col-span-2">
            Source or license note
            <textarea
              name="sourceOrLicenseNote"
              rows={3}
              maxLength={ASSET_RIGHTS_LIMITS.sourceOrLicenseNote}
              placeholder="Required for licensed or public-domain assets: identify the source and permission or license."
              className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-950 sm:col-span-2">
            <input
              required
              name="rightsAttested"
              value="true"
              type="checkbox"
              className="mt-1"
            />
            <span>{ASSET_RIGHTS_STATEMENT} This attestation is stored on this exact file version.</span>
          </label>
          <div className="sm:col-span-2">
            <button
              disabled={busy}
              className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-50"
            >
              Upload private asset with attestation
            </button>
          </div>
        </form>
        {materialsError ? (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {materialsError}
          </p>
        ) : materials === undefined ? (
          <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-500">
            Checking private materials…
          </p>
        ) : materials.length > 0 ? (
          <ul className="mt-4 space-y-2 text-sm">
            {materials.map((item) => (
              <li key={item.id} className="rounded-xl bg-slate-50 p-4">
                <div>
                  <strong>Version {item.version || 'unknown'} · {item.originalName}</strong>
                  {' · '}{item.status.replaceAll('_', ' ')}
                </div>
                {item.rightsAttestation ? (
                  <div className="mt-2 text-xs leading-5 text-slate-600">
                    Rights recorded for {item.rightsAttestation.assetKind.replaceAll('_', ' ')} by{' '}
                    <strong>{item.rightsAttestation.attestorName}</strong> under{' '}
                    {item.rightsAttestation.rightsBasis.replaceAll('_', ' ')}.
                    {item.rightsAttestation.sourceOrLicenseNote
                      ? ` Source/license note: ${item.rightsAttestation.sourceOrLicenseNote}`
                      : ''}
                  </div>
                ) : (
                  <div className="mt-2 text-xs font-bold text-rose-800">
                    Missing a valid stored rights attestation. The owner must not use this asset.
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            No private materials have been received.
          </p>
        )}
      </div>

      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Versioned proof decision</h2>
        {proofsError ? (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">
            {proofsError}
          </p>
        ) : proofs === undefined ? (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-500">
            Checking numbered proof history…
          </p>
        ) : proofs.length ? (
          <>
            <label className="mt-4 block text-sm font-bold">
              Approver’s full name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <label className="mt-4 block text-sm font-bold">
              Revision request (required only when requesting changes)
              <textarea
                rows={3}
                value={revision}
                onChange={(event) => setRevision(event.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
            <ul className="mt-5 space-y-4">
              {proofs.map((proof, index) => (
                <li key={proof.id} className="rounded-xl bg-slate-50 p-4">
                  <div className="flex flex-wrap justify-between gap-2">
                    <strong>Version {proof.version} · {proof.originalName}</strong>
                    <span className="text-sm font-bold">{proof.status.replaceAll('_', ' ')}</span>
                  </div>
                  {proof.ownerNotes && <p className="mt-2 text-sm">Owner note: {proof.ownerNotes}</p>}
                  <a
                    href={proof.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block font-bold text-blue-700 underline"
                  >
                    Open private proof file
                  </a>
                  {index === 0 && !['approved', 'locked_for_print'].includes(proof.status) && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        disabled={busy || name.trim().length < 2}
                        onClick={() => void decide(proof.id, 'approve')}
                        className="rounded-lg bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-40"
                      >
                        Approve this exact version
                      </button>
                      <button
                        disabled={busy || name.trim().length < 2 || revision.trim().length < 3}
                        onClick={() => void decide(proof.id, 'request_revision')}
                        className="rounded-lg border border-amber-400 px-4 py-2 font-bold text-amber-900 disabled:opacity-40"
                      >
                        Request revision
                      </button>
                    </div>
                  )}
                  {proof.approvedAt && (
                    <p className="mt-2 text-xs text-slate-500">
                      Approved by {proof.approvedBy} at {new Date(proof.approvedAt).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No numbered proof has been issued. No approval is inferred.
          </p>
        )}
      </div>

      <PrivateTrackingReport report={tracking} error={trackingError} />

      <CouponWorkspacePanel
        key={couponWorkspace?.coupon
          ? couponWorkspace.coupon.trackingId
          : 'coupon-workspace'}
        reservationId={reservationId}
        workspace={couponWorkspace}
        unavailableReason={couponUnavailableReason}
        reload={load}
      />

      {message && (
        <p
          role={messageIsError ? 'alert' : 'status'}
          aria-live={messageIsError ? 'assertive' : 'polite'}
          className={`rounded-lg p-3 text-sm font-bold ${messageIsError ? 'bg-rose-50 text-rose-900' : 'bg-blue-50 text-blue-900'}`}
        >
          {message}
        </p>
      )}
    </section>
  );
}

function CreativeBriefPanel({
  reservationId,
  workspace,
  error,
  onSaved,
}: {
  reservationId: string;
  workspace: CreativeBriefWorkspace | undefined;
  error: string;
  onSaved: (
    creativeBrief: CreativeBriefRecord,
    deliveryWindow: CreativeBriefWorkspace['deliveryWindow'],
    notice: string,
  ) => void;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Structured creative brief</h2>
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </p>
      </div>
    );
  }
  if (workspace === undefined) {
    return (
      <div role="status" aria-live="polite" className="rounded-2xl border p-6 text-sm text-slate-500">
        Checking the private structured creative brief…
      </div>
    );
  }
  return (
    <CreativeBriefEditor
      reservationId={reservationId}
      workspace={workspace}
      onSaved={onSaved}
    />
  );
}

function CreativeBriefEditor({
  reservationId,
  workspace,
  onSaved,
}: {
  reservationId: string;
  workspace: CreativeBriefWorkspace;
  onSaved: (
    creativeBrief: CreativeBriefRecord,
    deliveryWindow: CreativeBriefWorkspace['deliveryWindow'],
    notice: string,
  ) => void;
}) {
  const [draft, setDraft] = useState<CreativeBriefContent>(() => ({
    ...EMPTY_CREATIVE_BRIEF,
    ...(workspace.creativeBrief?.content || workspace.initialContent || {}),
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function setText(
    field: Exclude<keyof CreativeBriefContent, 'displayPhone' | 'displayWebsite' | 'displayAddress'>,
    value: string,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function setDisplay(
    field: 'displayPhone' | 'displayWebsite' | 'displayAddress',
    value: boolean,
  ) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/reservations/${reservationId}/creative-brief`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      const result = await response.json().catch(() => null) as {
        creativeBrief?: CreativeBriefRecord;
        deliveryWindow?: unknown;
        notice?: string;
        error?: string;
      } | null;
      if (
        !response.ok
        || !result?.creativeBrief
        || !isCreativeBriefDeliveryWindow(result.deliveryWindow)
      ) {
        setError(result?.error || 'The private creative brief could not be saved.');
        return;
      }
      onSaved(
        result.creativeBrief,
        result.deliveryWindow,
        result.notice || `Private creative brief version ${result.creativeBrief.version} was saved.`,
      );
    } catch {
      setError('The private creative brief service could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  const delivery = workspace.deliveryWindow;
  const currentErrors = workspace.creativeBrief?.currentDeliveryErrors || [];
  return (
    <div className="rounded-2xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black">Structured creative brief</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Facts entered here guide original design work. Saving always creates a new immutable
            private version for owner review and revokes any earlier print readiness.
          </p>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">
          {workspace.creativeBrief
            ? `Saved version ${workspace.creativeBrief.version}`
            : 'No saved brief yet'}
        </span>
      </div>

      <div className="mt-4 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">
        <strong>Planned delivery validation:</strong>{' '}
        {delivery.startDate || 'start not set'} through {delivery.endDate || 'end not set'} in{' '}
        {delivery.timeZone}. When a boundary is planned, the offer must cover that boundary.
        {delivery.validationStatus === 'campaign_schedule_not_set'
          ? ' The owner has not set a delivery window, so date coverage cannot yet be confirmed.'
          : ''}
      </div>

      {currentErrors.length > 0 && (
        <div role="alert" className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-950">
          <strong>The saved version no longer covers the current campaign schedule:</strong>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {currentErrors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      )}

      <form onSubmit={save} className="mt-5">
        <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 disabled:opacity-60">
          <BriefInput
            label="Business display name"
            required
            value={draft.businessDisplayName}
            maxLength={CREATIVE_BRIEF_LIMITS.businessDisplayName}
            onChange={(value) => setText('businessDisplayName', value)}
          />
          <BriefInput
            label="Phone"
            value={draft.phone}
            maxLength={CREATIVE_BRIEF_LIMITS.phone}
            onChange={(value) => setText('phone', value)}
          />
          <BriefCheckbox
            label="Show the phone in the design"
            checked={draft.displayPhone}
            onChange={(value) => setDisplay('displayPhone', value)}
          />
          <BriefInput
            label="Website"
            value={draft.website}
            maxLength={CREATIVE_BRIEF_LIMITS.website}
            onChange={(value) => setText('website', value)}
          />
          <BriefCheckbox
            label="Show the website in the design"
            checked={draft.displayWebsite}
            onChange={(value) => setDisplay('displayWebsite', value)}
          />
          <BriefTextarea
            label="Business address"
            value={draft.address}
            maxLength={CREATIVE_BRIEF_LIMITS.address}
            onChange={(value) => setText('address', value)}
          />
          <BriefCheckbox
            label="Show the address in the design"
            checked={draft.displayAddress}
            onChange={(value) => setDisplay('displayAddress', value)}
          />
          <BriefInput
            label="Brand colors"
            value={draft.brandColors}
            maxLength={CREATIVE_BRIEF_LIMITS.brandColors}
            onChange={(value) => setText('brandColors', value)}
          />
          <BriefTextarea
            label="Brand guidelines"
            value={draft.brandGuidelines}
            maxLength={CREATIVE_BRIEF_LIMITS.brandGuidelines}
            onChange={(value) => setText('brandGuidelines', value)}
          />
          <BriefTextarea
            label="Exact factual offer"
            required
            value={draft.factualOffer}
            maxLength={CREATIVE_BRIEF_LIMITS.factualOffer}
            onChange={(value) => setText('factualOffer', value)}
          />
          <BriefInput
            label="Call to action"
            required
            value={draft.callToAction}
            maxLength={CREATIVE_BRIEF_LIMITS.callToAction}
            onChange={(value) => setText('callToAction', value)}
          />
          <BriefInput
            label="Offer effective date"
            type="date"
            required={Boolean(delivery.startDate)}
            value={draft.effectiveOn}
            maxLength={10}
            onChange={(value) => setText('effectiveOn', value)}
          />
          <BriefInput
            label="Offer expiration date"
            type="date"
            required={Boolean(delivery.endDate)}
            value={draft.expiresOn}
            maxLength={10}
            onChange={(value) => setText('expiresOn', value)}
          />
          <BriefInput
            label="HTTPS QR destination"
            type="url"
            value={draft.qrDestination}
            maxLength={CREATIVE_BRIEF_LIMITS.qrDestination}
            placeholder="https://business.example/offer"
            onChange={(value) => setText('qrDestination', value)}
          />
          <BriefTextarea
            label="Unique selling proposition"
            value={draft.uniqueSellingProposition}
            maxLength={CREATIVE_BRIEF_LIMITS.uniqueSellingProposition}
            onChange={(value) => setText('uniqueSellingProposition', value)}
          />
          <BriefTextarea
            label="Disclaimers and redemption conditions"
            value={draft.disclaimers}
            maxLength={CREATIVE_BRIEF_LIMITS.disclaimers}
            onChange={(value) => setText('disclaimers', value)}
          />
          <BriefTextarea
            label="Evidence notes for claims"
            value={draft.evidenceNotes}
            maxLength={CREATIVE_BRIEF_LIMITS.evidenceNotes}
            onChange={(value) => setText('evidenceNotes', value)}
          />
          <div className="sm:col-span-2">
            <button className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40">
              {busy ? 'Saving new private version…' : 'Save new brief version for owner review'}
            </button>
          </div>
        </fieldset>
      </form>
      {error && (
        <p role="alert" aria-live="assertive" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </p>
      )}
    </div>
  );
}

function BriefInput({
  label,
  value,
  maxLength,
  onChange,
  required = false,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  required?: boolean;
  type?: 'text' | 'date' | 'url';
  placeholder?: string;
}) {
  return (
    <label className="text-sm font-bold text-slate-700">
      {label}
      <input
        required={required}
        type={type}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"
      />
    </label>
  );
}

function BriefTextarea({
  label,
  value,
  maxLength,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  return (
    <label className="text-sm font-bold text-slate-700">
      {label}
      <textarea
        required={required}
        rows={3}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 block w-full rounded-lg border px-3 py-2 font-normal"
      />
    </label>
  );
}

function BriefCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 self-end rounded-lg bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  );
}

const COUPON_FIELD_META: Array<{
  field: CouponAiField;
  label: string;
  help: string;
  multiline: boolean;
}> = [
  { field: 'headline', label: 'Front headline', help: 'Lead with the real customer value.', multiline: false },
  { field: 'body', label: 'Front body copy', help: 'Optional factual support copy.', multiline: true },
  { field: 'offer', label: 'Offer', help: 'Use the exact discount or benefit the business will honor.', multiline: false },
  { field: 'callToAction', label: 'Call to action', help: 'Tell the reader how to use the offer.', multiline: false },
  { field: 'backHeadline', label: 'Back headline', help: 'Optional address-side message.', multiline: false },
  { field: 'servicesList', label: 'Services list', help: 'Only services the business actually provides.', multiline: true },
  { field: 'backCoupon', label: 'Back coupon copy', help: 'A compact restatement of the same factual offer.', multiline: true },
  { field: 'terms', label: 'Redemption terms', help: 'State real eligibility, exclusions, and redemption instructions.', multiline: true },
];

function CouponWorkspacePanel({
  reservationId,
  workspace,
  unavailableReason,
  reload,
}: {
  reservationId: string;
  workspace: CouponWorkspace | null | undefined;
  unavailableReason: string;
  reload: () => Promise<void>;
}) {
  if (workspace === undefined) {
    return (
      <div className="rounded-2xl border p-6 text-sm text-slate-500">
        Checking private coupon workspace…
      </div>
    );
  }
  if (workspace === null) {
    return (
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Coupon draft and preview</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {unavailableReason || 'The owner must create the unique tracking and coupon code before drafting begins.'}
        </p>
      </div>
    );
  }
  return (
    <CouponDraftEditor
      reservationId={reservationId}
      workspace={workspace}
      reload={reload}
    />
  );
}

function CouponDraftEditor({
  reservationId,
  workspace,
  reload,
}: {
  reservationId: string;
  workspace: CouponWorkspace;
  reload: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<CouponDraftContent>(workspace.coupon.draft);
  const [context, setContext] = useState<CouponFactContext>(workspace.coupon.context);
  const [remainingAi, setRemainingAi] = useState(workspace.ai.remainingToday);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(workspace.coupon.draft);
    setContext(workspace.coupon.context);
    setRemainingAi(workspace.ai.remainingToday);
  }, [workspace.ai.remainingToday, workspace.coupon.context, workspace.coupon.draft, workspace.coupon.draftVersion]);

  function updateDraft(field: keyof CouponDraftContent, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function updateContext(field: keyof CouponFactContext, value: string) {
    setContext((current) => ({ ...current, [field]: value }));
  }

  async function post(body: object) {
    const response = await fetch(`/api/reservations/${reservationId}/coupon`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Coupon request failed.');
    return data;
  }

  async function save(action: 'save_draft' | 'submit_for_owner_review') {
    setBusyAction(action);
    setNotice('');
    setError('');
    try {
      const data = await post({ action, draft, context });
      setNotice(data.notice || 'Private coupon draft updated.');
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Coupon draft could not be saved.');
    } finally {
      setBusyAction(null);
    }
  }

  async function generate(field: CouponAiField) {
    setBusyAction(`generate-${field}`);
    setNotice('');
    setError('');
    try {
      const data = await post({ action: 'generate', field, currentDraft: draft, context });
      updateDraft(field, String(data.suggestion?.text || ''));
      setRemainingAi(Number(data.remainingToday || 0));
      setNotice(
        data.suggestion?.groundingNote
          ? `AI draft inserted for editing: ${data.suggestion.groundingNote}`
          : 'AI draft inserted for editing. Review every word before saving.',
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'AI draft could not be generated.');
    } finally {
      setBusyAction(null);
    }
  }

  const aiReady = workspace.ai.enabled && remainingAi > 0;
  return (
    <section className="rounded-2xl border p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[.18em] text-blue-700">
            Private, editable draft
          </p>
          <h2 className="mt-1 text-xl font-black">Coupon copy and live HTML preview</h2>
        </div>
        <div className="rounded-full bg-slate-100 px-4 py-2 text-xs font-black text-slate-700">
          {workspace.coupon.reviewStatus.replaceAll('_', ' ')} · version {workspace.coupon.draftVersion}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Manual drafting always works. Optional AI writes one field at a time from facts entered
        here; it does not visit your website. AI text remains editable and cannot publish itself.
        Only the CaliforniaMailer owner can exact-confirm a submitted version for publication.
      </p>
      {workspace.coupon.publicationStatus === 'published' && workspace.coupon.publishedPath && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
          An owner-approved version is public at{' '}
          <a
            href={workspace.coupon.publishedPath}
            target="_blank"
            rel="noreferrer"
            className="font-black underline"
          >
            {workspace.coupon.publishedPath}
          </a>. New edits do not replace that published snapshot without another owner approval.
        </p>
      )}
      {workspace.coupon.ownerNote && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Owner review note:</strong> {workspace.coupon.ownerNote}
        </div>
      )}

      <div className="mt-6 grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
        <div className="space-y-7">
          <fieldset className="rounded-2xl bg-slate-50 p-5">
            <legend className="px-1 font-black">Facts AI may use</legend>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Enter only facts the business can substantiate. Ratings, licenses, guarantees,
              scarcity, urgency, discounts, and performance claims are never inferred.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <CouponInput
                label="Industry"
                value={context.industry}
                maxLength={COUPON_CONTEXT_LIMITS.industry}
                onChange={(value) => updateContext('industry', value)}
              />
              <CouponInput
                label="Desired tone"
                value={context.tone}
                maxLength={COUPON_CONTEXT_LIMITS.tone}
                onChange={(value) => updateContext('tone', value)}
              />
            </div>
            <CouponTextarea
              label="Factual services"
              value={context.serviceFacts}
              maxLength={COUPON_CONTEXT_LIMITS.serviceFacts}
              onChange={(value) => updateContext('serviceFacts', value)}
            />
            <CouponTextarea
              label="Exact factual offer"
              value={context.factualOffer}
              maxLength={COUPON_CONTEXT_LIMITS.factualOffer}
              onChange={(value) => updateContext('factualOffer', value)}
            />
            <CouponTextarea
              label="How customers redeem"
              value={context.redemptionInstructions}
              maxLength={COUPON_CONTEXT_LIMITS.redemptionInstructions}
              onChange={(value) => updateContext('redemptionInstructions', value)}
            />
            <CouponInput
              label="Intended audience"
              value={context.audience}
              maxLength={COUPON_CONTEXT_LIMITS.audience}
              onChange={(value) => updateContext('audience', value)}
            />
            <CouponTextarea
              label="Other verified facts AI may repeat"
              value={context.verifiedFacts}
              maxLength={COUPON_CONTEXT_LIMITS.verifiedFacts}
              onChange={(value) => updateContext('verifiedFacts', value)}
            />
          </fieldset>

          <fieldset className="rounded-2xl border p-5">
            <legend className="px-1 font-black">Editable coupon fields</legend>
            {COUPON_FIELD_META.map((item) => (
              <div key={item.field} className="mt-5 first:mt-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <label htmlFor={`coupon-${item.field}`} className="text-sm font-black">
                      {item.label}
                    </label>
                    <p className="text-xs text-slate-500">{item.help}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!aiReady || busyAction !== null}
                    onClick={() => void generate(item.field)}
                    className="rounded-full border border-blue-300 px-3 py-1.5 text-xs font-black text-blue-800 disabled:opacity-40"
                  >
                    {busyAction === `generate-${item.field}` ? 'Drafting…' : 'Draft this field with AI'}
                  </button>
                </div>
                {item.multiline ? (
                  <textarea
                    id={`coupon-${item.field}`}
                    rows={item.field === 'terms' ? 4 : 3}
                    value={draft[item.field]}
                    maxLength={COUPON_TEXT_LIMITS[item.field]}
                    onChange={(event) => updateDraft(item.field, event.target.value)}
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                ) : (
                  <input
                    id={`coupon-${item.field}`}
                    value={draft[item.field]}
                    maxLength={COUPON_TEXT_LIMITS[item.field]}
                    onChange={(event) => updateDraft(item.field, event.target.value)}
                    className="mt-2 w-full rounded-lg border px-3 py-2 text-sm"
                  />
                )}
                <p className="mt-1 text-right text-xs text-slate-400">
                  {draft[item.field].length}/{COUPON_TEXT_LIMITS[item.field]}
                </p>
              </div>
            ))}
            <label className="mt-5 block text-sm font-black">
              Expiration date (optional)
              <input
                type="date"
                value={draft.expiresOn}
                onChange={(event) => updateDraft('expiresOn', event.target.value)}
                className="mt-2 w-full rounded-lg border px-3 py-2 font-normal"
              />
            </label>
          </fieldset>

          <div className="rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-950">
            <strong>AI status:</strong>{' '}
            {workspace.ai.enabled
              ? `${remainingAi} of ${workspace.ai.dailyQuota} drafts remain for UTC day ${workspace.ai.utcDay}. Model: ${workspace.ai.model}.`
              : workspace.ai.reason || 'Disabled. Manual drafting remains available.'}
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void save('save_draft')}
              className="rounded-full border border-slate-300 px-5 py-3 font-black disabled:opacity-40"
            >
              {busyAction === 'save_draft' ? 'Saving…' : 'Save private draft'}
            </button>
            <button
              type="button"
              disabled={busyAction !== null}
              onClick={() => void save('submit_for_owner_review')}
              className="rounded-full bg-slate-950 px-5 py-3 font-black text-white disabled:opacity-40"
            >
              {busyAction === 'submit_for_owner_review' ? 'Submitting…' : 'Submit this version to owner'}
            </button>
          </div>
          {notice && <p role="status" aria-live="polite" className="rounded-lg bg-emerald-50 p-3 text-sm font-bold text-emerald-950">{notice}</p>}
          {error && <p role="alert" aria-live="assertive" className="rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">{error}</p>}
        </div>

        <div className="xl:sticky xl:top-6 xl:self-start">
          <CouponHtmlPreview
            businessName={workspace.coupon.businessName}
            couponCode={workspace.coupon.couponCode}
            draft={draft}
          />
        </div>
      </div>
    </section>
  );
}

function CouponInput({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      <input
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"
      />
    </label>
  );
}

function CouponTextarea({
  label,
  value,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="mt-4 block text-sm font-bold">
      {label}
      <textarea
        rows={3}
        value={value}
        maxLength={maxLength}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border bg-white px-3 py-2 font-normal"
      />
    </label>
  );
}

function CouponHtmlPreview({
  businessName,
  couponCode,
  draft,
}: {
  businessName: string;
  couponCode: string;
  draft: CouponDraftContent;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-lg">
      <div className="bg-slate-950 px-5 py-3 text-center text-xs font-black uppercase tracking-[.18em] text-white">
        Live HTML preview · never auto-published
      </div>
      <div className="p-6">
        <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">{businessName}</p>
        <h3 className="mt-3 text-3xl font-black leading-tight text-slate-950">
          {draft.headline || 'Your factual headline'}
        </h3>
        {draft.body && <p className="mt-3 whitespace-pre-wrap leading-6 text-slate-600">{draft.body}</p>}
        <div className="mt-6 rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-5">
          <p className="text-xs font-black uppercase tracking-[.16em] text-blue-700">Offer</p>
          <p className="mt-2 text-2xl font-black text-slate-950">{draft.offer || 'Exact offer appears here'}</p>
          <div className="mt-3 text-xs font-bold text-slate-600">Code: {couponCode}</div>
          <div className="mt-1 text-xs text-slate-500">
            {draft.expiresOn ? `Expires ${draft.expiresOn}` : 'No expiration date stated'}
          </div>
        </div>
        {draft.backHeadline && <h4 className="mt-5 text-xl font-black">{draft.backHeadline}</h4>}
        {draft.servicesList && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{draft.servicesList}</p>}
        {draft.backCoupon && <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm font-bold text-amber-950">{draft.backCoupon}</p>}
        <div className="mt-5 inline-flex rounded-full bg-blue-700 px-4 py-2 text-sm font-black text-white">
          {draft.callToAction || 'Call to action'}
        </div>
        <p className="mt-5 whitespace-pre-wrap text-xs leading-5 text-slate-500">
          {draft.terms || 'Complete redemption terms are required before owner review.'}
        </p>
      </div>
    </div>
  );
}

function PrivateTrackingReport({
  report,
  error,
}: {
  report: TrackingReport | null | undefined;
  error: string;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Tracking and delivery report</h2>
        <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm font-bold text-rose-950">
          {error}
        </p>
      </div>
    );
  }
  if (report === undefined) {
    return <div role="status" aria-live="polite" className="rounded-2xl border p-6 text-sm text-slate-500">Checking private tracking report…</div>;
  }
  if (report === null) {
    return (
      <div className="rounded-2xl border p-6">
        <h2 className="text-xl font-black">Tracking and delivery report</h2>
        <p className="mt-3 text-sm text-slate-500">
          No tracking asset or delivery evidence has been recorded for this reservation.
        </p>
      </div>
    );
  }

  const reportedTotals = Object.entries(report.advertiserReported.totals)
    .filter(([, quantity]) => quantity > 0);

  return (
    <div className="rounded-2xl border p-6">
      <h2 className="text-xl font-black">Tracking and delivery report</h2>
      <div className={`mt-4 rounded-xl p-4 text-sm ${report.active ? 'bg-emerald-50 text-emerald-950' : 'bg-amber-50 text-amber-950'}`}>
        <strong>{report.active ? 'Tracking asset active' : 'Tracking asset not active'}</strong>
        {report.active && report.publicPath && (
          <div className="mt-2 space-y-1">
            <div>
              Public offer URL:{' '}
              <a href={report.publicPath} target="_blank" rel="noreferrer" className="font-bold underline">
                {report.publicPath}
              </a>
            </div>
            <div>Coupon code: <strong>{report.couponCode}</strong></div>
            {report.phoneExtension && <div>Phone extension: {report.phoneExtension}</div>}
          </div>
        )}
      </div>

      <h3 className="mt-6 font-black">Directly measured HTTP requests</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <ReportStat label="Non-bot requests" value={report.directlyMeasured.nonBotHttpRequests} />
        <ReportStat label="Suspected bots" value={report.directlyMeasured.suspectedBotHttpRequests} />
        <ReportStat label="Unknown classification" value={report.directlyMeasured.unknownClassificationHttpRequests} />
      </div>
      <p className="mt-3 text-xs leading-5 text-slate-500">
        {report.directlyMeasured.limitation}
      </p>

      <h3 className="mt-6 font-black">Owner-recorded advertiser reports</h3>
      {reportedTotals.length ? (
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          {reportedTotals.map(([metric, quantity]) => (
            <li key={metric} className="rounded-lg bg-slate-50 p-3">
              <strong>{metric.replaceAll('_', ' ')}</strong>: {quantity}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No advertiser-reported outcomes are recorded.</p>
      )}
      <p className="mt-3 text-xs leading-5 text-slate-500">
        Coupon uses, calls, leads, appointments, sales, and notes in this section are reported to
        the owner; CaliforniaMailer did not directly measure them.
      </p>

      <h3 className="mt-6 font-black">Delivery evidence</h3>
      {report.delivery ? (
        <div className="mt-3 rounded-xl bg-blue-50 p-4 text-sm text-blue-950">
          <div><strong>Recorded delivery:</strong> {formatDate(report.delivery.deliveredAt)}</div>
          <div className="mt-1"><strong>Evidence reference:</strong> {report.delivery.evidenceReference}</div>
          {report.delivery.ownerNote && <div className="mt-1"><strong>Owner note:</strong> {report.delivery.ownerNote}</div>}
          <p className="mt-3 text-xs leading-5">{report.delivery.limitation}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No delivery evidence has been recorded.</p>
      )}
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xl font-black">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleString();
}
