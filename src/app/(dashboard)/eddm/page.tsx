'use client';

import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import Sidebar from '@/components/Sidebar';
import {
  EDDM_MAIL_PIECES,
  PRINTING4SUPERCHEAP,
  USPS_EDDM_BMEU,
  USPS_EDDM_RETAIL,
} from '@/config/eddmOfferings';
import { useAuth } from '@/lib/AuthContext';
import { calculateEddmEstimate } from '@/lib/eddmPricing';
import {
  optimizeCarrierRoutes,
  ROUTE_OPTIMIZER_MAX_TARGET,
  type CarrierRouteOptimization,
} from '@/lib/routeOptimizer';

type TerritoryStatus = 'planning' | 'active' | 'paused' | 'retired';
type RoutePlanStatus = 'draft' | 'verified' | 'attached' | 'retired';
type MailingMethod = 'eddm_retail' | 'eddm_bmeu' | 'supplier_turnkey';
type AudienceMode = 'residential_only' | 'residential_and_business';
type RouteSource = 'usps_eddm_tool' | 'printing4supercheap_quote';
type RouteType = 'city' | 'rural_highway' | 'po_box' | 'other';

interface TerritoryView {
  id: string;
  name: string;
  slug: string;
  state: string;
  county: string;
  candidateZipCodes: string[];
  candidateAreas: string[];
  status: TerritoryStatus;
  currentRoutePlanId: string | null;
  version: number;
  createdAt: string | null;
  updatedAt: string | null;
}

interface RouteRow {
  zipCode: string;
  carrierRouteCode: string;
  city: string;
  routeType: RouteType;
  residentialCount: number;
  businessCount: number;
  poBoxCount: number;
  totalCount?: number;
}

interface RoutePlanView {
  id: string;
  territoryId: string;
  territorySlug: string;
  territoryName: string;
  campaignId: string | null;
  status: RoutePlanStatus;
  version: number;
  mailingMethod: MailingMethod;
  audienceMode: AudienceMode;
  source: RouteSource;
  sourceUrl: string;
  sourceReference: string;
  sourceCheckedAt: string;
  sourceRecheckedAt: string | null;
  effectiveSourceCheckedAt: string;
  sourceRecheckEvidenceReference: string | null;
  routes: RouteRow[];
  totals: {
    residentialCount: number;
    businessCount: number;
    poBoxCount: number;
    totalCount: number;
  };
  plannedDeliveryCount: number;
  sourceFresh: boolean;
  createdAt: string | null;
  verifiedAt: string | null;
  attachedAt: string | null;
  retiredAt: string | null;
}

interface TerritoryDraft {
  name: string;
  slug: string;
  state: string;
  county: string;
  candidateZipCodes: string;
  candidateAreas: string;
}

interface RoutePlanDraft {
  mailingMethod: MailingMethod;
  audienceMode: AudienceMode;
  source: RouteSource;
  sourceUrl: string;
  sourceReference: string;
  sourceCheckedAt: string;
  routeText: string;
}

const REFERENCE_QUANTITY = 5_000;
const REFERENCE_SPECIFICATIONS = [
  'eddm-6-5x9-14pt',
  'eddm-6-5x12-14pt',
  'eddm-9x12-14pt',
  'eddm-12x15-14pt',
] as const;
const ROUTE_COLUMNS = ['zipCode', 'carrierRouteCode', 'city', 'routeType', 'residentialCount', 'businessCount', 'poBoxCount'] as const;
const ROUTE_HEADER = ROUTE_COLUMNS.join(',');
const MAX_ROUTE_FILE_BYTES = 256 * 1_024;
const ROUTE_OPTIMIZER_QUICK_TARGETS = [2_500, 5_000, 10_000, 20_000] as const;
const USPS_ROUTE_TOOL_URL = 'https://eddm.usps.com/eddm/select-routes.htm';
const TERRITORY_CONFIRMATIONS: Record<TerritoryStatus, string> = {
  planning: 'RETURN TERRITORY TO PLANNING',
  active: 'ACTIVATE TERRITORY',
  paused: 'PAUSE TERRITORY',
  retired: 'RETIRE TERRITORY',
};
const routeTypes = new Set<RouteType>(['city', 'rural_highway', 'po_box', 'other']);
const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-normal text-slate-950';

const currency = (cents: number | null) => cents === null
  ? 'Live quote required'
  : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
const integer = (value: number) => new Intl.NumberFormat('en-US').format(value);

const postalReferenceRows = [
  { id: 'retail', label: 'EDDM Retail', rateMillsPerPiece: USPS_EDDM_RETAIL.rateMillsPerPiece },
  ...USPS_EDDM_BMEU.rates,
].map((rate) => ({
  ...rate,
  postageAtReferenceQuantityCents: Math.ceil((REFERENCE_QUANTITY * rate.rateMillsPerPiece) / 10),
}));

const referenceRows = REFERENCE_SPECIFICATIONS.map((specificationId) => {
  const mailPiece = EDDM_MAIL_PIECES.find((piece) => piece.id === specificationId);
  const printOnly = calculateEddmEstimate({
    specificationId,
    quantity: REFERENCE_QUANTITY,
    fulfillment: 'print_only',
    taxCents: null,
    designCents: null,
    otherCostsCents: null,
    bundlingCents: null,
    postOfficeDeliveryCents: null,
  });
  const turnkey = calculateEddmEstimate({
    specificationId,
    quantity: REFERENCE_QUANTITY,
    fulfillment: 'turnkey',
    taxCents: null,
    designCents: null,
    otherCostsCents: null,
  });
  return {
    specificationId,
    label: mailPiece?.label ?? specificationId,
    printPriceCents: printOnly.printPriceCents,
    printAndRetailPostageCents: printOnly.knownSubtotalCents,
    turnkeyKnownSubtotalCents: turnkey.knownSubtotalCents,
  };
});

const emptyTerritory: TerritoryDraft = {
  name: '',
  slug: '',
  state: 'CA',
  county: '',
  candidateZipCodes: '',
  candidateAreas: '',
};
const emptyRoutePlan: RoutePlanDraft = {
  mailingMethod: 'eddm_retail',
  audienceMode: 'residential_only',
  source: 'usps_eddm_tool',
  sourceUrl: USPS_ROUTE_TOOL_URL,
  sourceReference: '',
  sourceCheckedAt: '',
  routeText: ROUTE_HEADER,
};

export default function EddmPage() {
  const { user, loading, logout } = useAuth();
  const [territories, setTerritories] = useState<TerritoryView[]>([]);
  const [selectedTerritoryId, setSelectedTerritoryId] = useState('');
  const [routePlans, setRoutePlans] = useState<RoutePlanView[]>([]);
  const [territoryDraft, setTerritoryDraft] = useState<TerritoryDraft>(emptyTerritory);
  const [routePlanDraft, setRoutePlanDraft] = useState<RoutePlanDraft>(emptyRoutePlan);
  const [routeOptimizerTarget, setRouteOptimizerTarget] = useState('5000');
  const [territoryStatusDraft, setTerritoryStatusDraft] = useState<TerritoryStatus>('planning');
  const [territoryConfirmation, setTerritoryConfirmation] = useState('');
  const [planConfirmations, setPlanConfirmations] = useState<Record<string, string>>({});
  const [planRecheckReferences, setPlanRecheckReferences] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState('');
  const [loadingTerritories, setLoadingTerritories] = useState(false);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const ownerFetch = useCallback(async <T,>(path: string, init: RequestInit = {}): Promise<T> => {
    if (!user) throw new Error('Owner authentication required.');
    const response = await fetch(path, {
      ...init,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.error || 'Territory operation failed.');
    return body as T;
  }, [user]);

  const loadTerritories = useCallback(async () => {
    if (!user) return;
    setLoadingTerritories(true); setError('');
    try {
      const body = await ownerFetch<{ territories: TerritoryView[] }>('/api/admin/territories');
      setTerritories(body.territories);
      setSelectedTerritoryId((current) => body.territories.some((territory) => territory.id === current)
        ? current
        : body.territories[0]?.id || '');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Territories could not be read.');
    } finally {
      setLoadingTerritories(false);
    }
  }, [ownerFetch, user]);

  const loadRoutePlans = useCallback(async (territoryId: string) => {
    if (!user || !territoryId) { setRoutePlans([]); return; }
    setLoadingPlans(true); setError('');
    try {
      const body = await ownerFetch<{ territory: TerritoryView; routePlans: RoutePlanView[] }>(`/api/admin/territories/${encodeURIComponent(territoryId)}/route-plans`);
      setRoutePlans(body.routePlans);
      setTerritories((current) => current.map((territory) => territory.id === body.territory.id ? body.territory : territory));
    } catch (caught) {
      setRoutePlans([]);
      setError(caught instanceof Error ? caught.message : 'Route plans could not be read.');
    } finally {
      setLoadingPlans(false);
    }
  }, [ownerFetch, user]);

  useEffect(() => { void loadTerritories(); }, [loadTerritories]);
  useEffect(() => { void loadRoutePlans(selectedTerritoryId); }, [loadRoutePlans, selectedTerritoryId]);

  const selectedTerritory = territories.find((territory) => territory.id === selectedTerritoryId) || null;
  useEffect(() => {
    if (!selectedTerritory) return;
    setTerritoryStatusDraft(selectedTerritory.status);
    setTerritoryConfirmation('');
  }, [selectedTerritory]);

  const parsedRoutes = useMemo(() => parseRouteText(routePlanDraft.routeText), [routePlanDraft.routeText]);
  const routeOptimizationState = useMemo((): {
    optimization: CarrierRouteOptimization | null;
    error: string | null;
  } => {
    if (parsedRoutes.errors.length || !parsedRoutes.rows.length) {
      return { optimization: null, error: null };
    }
    try {
      return {
        optimization: optimizeCarrierRoutes(
          parsedRoutes.rows,
          routePlanDraft.audienceMode,
          Number(routeOptimizerTarget),
        ),
        error: null,
      };
    } catch (caught) {
      return {
        optimization: null,
        error: caught instanceof Error ? caught.message : 'The route suggestion could not be calculated.',
      };
    }
  }, [parsedRoutes, routeOptimizerTarget, routePlanDraft.audienceMode]);
  const currentPlan = selectedTerritory?.currentRoutePlanId
    ? routePlans.find((plan) => plan.id === selectedTerritory.currentRoutePlanId) || null
    : null;

  async function createTerritory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const candidateZipCodes = splitList(territoryDraft.candidateZipCodes);
    const candidateAreas = splitList(territoryDraft.candidateAreas);
    if (!candidateZipCodes.length || !candidateAreas.length) {
      setError('Enter at least one candidate ZIP code and one candidate area.');
      return;
    }
    setBusy('territory-create'); setError(''); setNotice('');
    try {
      const body = await ownerFetch<{ success: true; territory: TerritoryView }>('/api/admin/territories', {
        method: 'POST',
        body: JSON.stringify({
          name: territoryDraft.name.trim(),
          ...(territoryDraft.slug.trim() ? { slug: territoryDraft.slug.trim() } : {}),
          state: territoryDraft.state.trim().toUpperCase(),
          county: territoryDraft.county.trim(),
          candidateZipCodes,
          candidateAreas,
          status: 'planning',
        }),
      });
      setTerritoryDraft(emptyTerritory);
      setNotice('Territory created in planning state. No USPS routes were selected or purchased.');
      await loadTerritories();
      setSelectedTerritoryId(body.territory.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Territory could not be created.');
    } finally {
      setBusy('');
    }
  }

  async function updateTerritoryStatus() {
    if (!selectedTerritory) return;
    const required = TERRITORY_CONFIRMATIONS[territoryStatusDraft];
    if (territoryConfirmation !== required) return;
    setBusy('territory-status'); setError(''); setNotice('');
    try {
      await ownerFetch(`/api/admin/territories/${encodeURIComponent(selectedTerritory.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'set_status', status: territoryStatusDraft, confirmation: territoryConfirmation }),
      });
      setNotice(`Territory status changed to ${humanize(territoryStatusDraft)}. No order or spend was authorized.`);
      setTerritoryConfirmation('');
      await loadTerritories();
      await loadRoutePlans(selectedTerritory.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Territory status could not be changed.');
    } finally {
      setBusy('');
    }
  }

  async function createRoutePlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTerritory || parsedRoutes.errors.length || !parsedRoutes.rows.length) return;
    setBusy('route-create'); setError(''); setNotice('');
    try {
      await ownerFetch(`/api/admin/territories/${encodeURIComponent(selectedTerritory.id)}/route-plans`, {
        method: 'POST',
        body: JSON.stringify({
          mailingMethod: routePlanDraft.mailingMethod,
          audienceMode: routePlanDraft.audienceMode,
          source: routePlanDraft.source,
          sourceUrl: routePlanDraft.sourceUrl.trim(),
          sourceReference: routePlanDraft.sourceReference.trim(),
          sourceCheckedAt: routePlanDraft.sourceCheckedAt,
          routes: parsedRoutes.rows,
        }),
      });
      setRoutePlanDraft(emptyRoutePlan);
      setNotice('Draft route plan saved. Totals below are server-derived; the plan is not verified or attached.');
      await loadRoutePlans(selectedTerritory.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Route plan could not be created.');
    } finally {
      setBusy('');
    }
  }

  async function changeRoutePlan(plan: RoutePlanView, action: 'verify' | 'recheck' | 'retire') {
    if (!selectedTerritory) return;
    const key = `${plan.id}:${action}`;
    const confirmation = action === 'verify'
      ? 'VERIFY ROUTE PLAN'
      : action === 'recheck'
        ? 'RECHECKED SOURCE - EXACT PLAN UNCHANGED'
        : 'RETIRE ROUTE PLAN';
    if (planConfirmations[key] !== confirmation) return;
    const evidenceReference = planRecheckReferences[plan.id]?.trim() || '';
    if (action === 'recheck' && evidenceReference.length < 3) return;
    setBusy(key); setError(''); setNotice('');
    try {
      await ownerFetch(`/api/admin/territories/${encodeURIComponent(selectedTerritory.id)}/route-plans/${encodeURIComponent(plan.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          confirmation,
          ...(action === 'recheck' ? { evidenceReference } : {}),
        }),
      });
      setPlanConfirmations((current) => ({ ...current, [key]: '' }));
      if (action === 'recheck') {
        setPlanRecheckReferences((current) => ({ ...current, [plan.id]: '' }));
      }
      setNotice(action === 'verify'
        ? 'Route evidence verified. This did not attach the plan to a campaign or place an order.'
        : action === 'recheck'
          ? 'The external source recheck was recorded for the exact unchanged attached plan. No route content, order, or spend changed.'
          : 'Route plan retired. Historical evidence remains in the owner record.');
      await loadTerritories();
      await loadRoutePlans(selectedTerritory.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Route-plan status could not be changed.');
    } finally {
      setBusy('');
    }
  }

  async function attachToFoundingCampaign(plan: RoutePlanView) {
    const key = `${plan.id}:attach`;
    const confirmation = 'APPLY ROUTES TO FOUNDING CAMPAIGN';
    if (planConfirmations[key] !== confirmation) return;
    setBusy(key); setError(''); setNotice('');
    try {
      await ownerFetch('/api/admin/campaigns/founding/routes', {
        method: 'POST',
        body: JSON.stringify({ routePlanId: plan.id, confirmation }),
      });
      setPlanConfirmations((current) => ({ ...current, [key]: '' }));
      setNotice('Verified route plan attached to the founding campaign. Printing, postage, checkout, and ordering remain separate owner gates.');
      await loadTerritories();
      if (selectedTerritory) await loadRoutePlans(selectedTerritory.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Route plan could not be attached.');
    } finally {
      setBusy('');
    }
  }

  async function readRouteFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      if (file.size > MAX_ROUTE_FILE_BYTES) {
        setError('Route CSV/TSV files must be 256 KB or smaller. No file was loaded.');
        return;
      }
      const text = await file.text();
      setRoutePlanDraft((current) => ({ ...current, routeText: text }));
    } catch {
      setError('The route file could not be read in this browser.');
    } finally {
      event.target.value = '';
    }
  }

  function applyRouteOptimization() {
    const optimization = routeOptimizationState.optimization;
    if (!optimization) return;
    setRoutePlanDraft((current) => ({
      ...current,
      routeText: routeRowsToText(optimization.selectedRoutes),
    }));
    setError('');
    setNotice(
      `Applied the ${integer(optimization.selectedCount)}-delivery suggestion to the editable draft rows. Review every row and its source evidence before saving; no route plan was created, verified, attached, ordered, or purchased.`,
    );
  }

  if (loading) return <Centered>Loading owner access…</Centered>;
  if (!user) return <Centered>Owner sign-in required.</Centered>;

  return (
    <div className="min-h-screen bg-slate-50 md:flex">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 md:p-8">
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-black uppercase tracking-[0.18em] text-blue-700">Owner route planning</div>
              <h1 className="mt-2 text-3xl font-black text-slate-950">Territories &amp; routes</h1>
              <p className="mt-3 max-w-4xl leading-7 text-slate-700">Store manually verified route evidence, review server-derived delivery counts, and explicitly attach one verified plan to the founding campaign.</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void loadTerritories()} disabled={loadingTerritories || Boolean(busy)} className="rounded-lg border bg-white px-4 py-2 text-sm font-bold disabled:opacity-50">Refresh records</button>
              <button type="button" onClick={logout} className="rounded-lg border px-3 py-2 text-sm">Sign out</button>
            </div>
          </header>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
            <strong>Evidence workspace only.</strong> This page does not scrape USPS, invent route data, display a substitute map, reserve carrier routes, contact a supplier, buy postage, place a print order, or authorize spending. Verify route rows in the official USPS tool or a current written {PRINTING4SUPERCHEAP.name} quote, then enter that evidence here.
            <a href={USPS_ROUTE_TOOL_URL} target="_blank" rel="noreferrer" className="ml-1 font-bold text-blue-800 underline">Open the USPS route tool</a>
            <span aria-hidden="true"> · </span>
            <a href={PRINTING4SUPERCHEAP.productUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-800 underline">Open Printing4SuperCheap EDDM</a>
          </div>
          {error && <div role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-950">{error}</div>}
          {notice && <div role="status" className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-950">{notice}</div>}

          <section className="mt-8 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <form onSubmit={createTerritory} className="self-start rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Create a territory</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Candidate ZIP codes and areas are planning labels, not verified delivery counts.</p>
              <label className="mt-4 block text-sm font-bold" htmlFor="territory-name">Territory name<input id="territory-name" required minLength={3} maxLength={100} value={territoryDraft.name} onChange={(event) => setTerritoryDraft((current) => ({ ...current, name: event.target.value }))} className={inputClass} /></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="territory-slug">Optional stable slug<input id="territory-slug" maxLength={80} pattern="[a-z0-9-]+" value={territoryDraft.slug} onChange={(event) => setTerritoryDraft((current) => ({ ...current, slug: event.target.value.toLowerCase() }))} className={inputClass} /></label>
              <div className="mt-4 grid grid-cols-[100px_1fr] gap-3">
                <label className="block text-sm font-bold" htmlFor="territory-state">State<input id="territory-state" required minLength={2} maxLength={2} value={territoryDraft.state} onChange={(event) => setTerritoryDraft((current) => ({ ...current, state: event.target.value.toUpperCase() }))} className={inputClass} /></label>
                <label className="block text-sm font-bold" htmlFor="territory-county">County<input id="territory-county" required minLength={2} maxLength={100} value={territoryDraft.county} onChange={(event) => setTerritoryDraft((current) => ({ ...current, county: event.target.value }))} className={inputClass} /></label>
              </div>
              <label className="mt-4 block text-sm font-bold" htmlFor="territory-zips">Candidate ZIP codes<textarea id="territory-zips" required rows={3} value={territoryDraft.candidateZipCodes} onChange={(event) => setTerritoryDraft((current) => ({ ...current, candidateZipCodes: event.target.value }))} placeholder="Comma or newline separated" className={inputClass} /></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="territory-areas">Candidate cities or areas<textarea id="territory-areas" required rows={3} value={territoryDraft.candidateAreas} onChange={(event) => setTerritoryDraft((current) => ({ ...current, candidateAreas: event.target.value }))} placeholder="Comma or newline separated" className={inputClass} /></label>
              <button disabled={busy === 'territory-create'} className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-50">{busy === 'territory-create' ? 'Creating…' : 'Create planning territory'}</button>
            </form>

            <div className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Territory records</h2><p className="mt-1 text-sm text-slate-600">Select one to manage its nested route plans.</p></div><span className="text-sm text-slate-500">{loadingTerritories ? 'Loading…' : `${territories.length} record${territories.length === 1 ? '' : 's'}`}</span></div>
              {territories.length ? <div className="mt-4 grid gap-3 md:grid-cols-2">{territories.map((territory) => <button key={territory.id} type="button" aria-pressed={territory.id === selectedTerritoryId} onClick={() => setSelectedTerritoryId(territory.id)} className={`rounded-xl border p-4 text-left shadow-sm ${territory.id === selectedTerritoryId ? 'border-blue-600 bg-blue-50' : 'bg-white hover:border-slate-400'}`}>
                <div className="flex items-start justify-between gap-3"><strong className="text-slate-950">{territory.name}</strong><StatusPill status={territory.status} /></div>
                <div className="mt-2 text-sm text-slate-600">{territory.county} County, {territory.state}</div>
                <div className="mt-2 text-xs text-slate-500">Version {territory.version} · {territory.currentRoutePlanId ? 'current plan assigned' : 'no current route plan'}</div>
              </button>)}</div> : <p className="mt-4 rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No real territory records exist. No sample territory was created.</p>}

              {selectedTerritory && <section className="mt-5 rounded-2xl border bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">Selected territory</div><h3 className="mt-1 text-xl font-black">{selectedTerritory.name}</h3><p className="mt-1 text-sm text-slate-600">{selectedTerritory.county} County, {selectedTerritory.state} · {selectedTerritory.slug}</p></div><div className="text-right"><StatusPill status={selectedTerritory.status} /><div className="mt-2 text-xs text-slate-500">Version {selectedTerritory.version}</div></div></div>
                <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3"><Detail label="Candidate ZIPs" value={selectedTerritory.candidateZipCodes.join(', ') || 'None recorded'} /><Detail label="Candidate areas" value={selectedTerritory.candidateAreas.join(', ') || 'None recorded'} /><Detail label="Current route plan" value={currentPlan ? `v${currentPlan.version} · ${humanize(currentPlan.status)}` : selectedTerritory.currentRoutePlanId || 'None'} /></dl>
                {selectedTerritory.status !== 'retired' && <div className="mt-5 border-t pt-5"><h4 className="font-black">Territory lifecycle</h4><div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr_auto]"><label className="text-xs font-bold text-slate-600" htmlFor="territory-status">New status<select id="territory-status" value={territoryStatusDraft} onChange={(event) => { setTerritoryStatusDraft(event.target.value as TerritoryStatus); setTerritoryConfirmation(''); }} className={inputClass}><option value="planning">Planning</option><option value="active">Active</option><option value="paused">Paused</option><option value="retired">Retired</option></select></label><ConfirmationField id="territory-status-confirmation" phrase={TERRITORY_CONFIRMATIONS[territoryStatusDraft]} value={territoryConfirmation} onChange={setTerritoryConfirmation} /><button type="button" disabled={Boolean(busy) || territoryStatusDraft === selectedTerritory.status || territoryConfirmation !== TERRITORY_CONFIRMATIONS[territoryStatusDraft]} onClick={() => void updateTerritoryStatus()} className="self-end rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Apply status</button></div><p className="mt-3 text-xs leading-5 text-slate-500">Activation requires a current fresh verified route plan. Retirement is a terminal record state, not a hard delete.</p></div>}
              </section>}
            </div>
          </section>

          {selectedTerritory && selectedTerritory.status !== 'retired' && <section className="mt-8 grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <form onSubmit={createRoutePlan} className="self-start rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-black">Add route-plan evidence</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">Create a new immutable version from current written evidence. Counts and totals are recalculated on the server.</p>
              <label className="mt-4 block text-sm font-bold" htmlFor="mailing-method">Mailing method<select id="mailing-method" value={routePlanDraft.mailingMethod} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, mailingMethod: event.target.value as MailingMethod }))} className={inputClass}><option value="eddm_retail">EDDM Retail</option><option value="eddm_bmeu">EDDM BMEU</option><option value="supplier_turnkey">Supplier turnkey</option></select></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="audience-mode">Audience count<select id="audience-mode" value={routePlanDraft.audienceMode} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, audienceMode: event.target.value as AudienceMode }))} className={inputClass}><option value="residential_only">Residential only</option><option value="residential_and_business">Residential + business + PO Boxes</option></select></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="route-source">Evidence source<select id="route-source" value={routePlanDraft.source} onChange={(event) => { const source = event.target.value as RouteSource; setRoutePlanDraft((current) => ({ ...current, source, sourceUrl: source === 'usps_eddm_tool' ? USPS_ROUTE_TOOL_URL : PRINTING4SUPERCHEAP.productUrl })); }} className={inputClass}><option value="usps_eddm_tool">USPS EDDM tool</option><option value="printing4supercheap_quote">Printing4SuperCheap written quote</option></select></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="source-url">HTTPS evidence URL<input id="source-url" type="url" required pattern="https://.*" maxLength={500} value={routePlanDraft.sourceUrl} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, sourceUrl: event.target.value }))} className={inputClass} /></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="source-reference">Evidence reference<input id="source-reference" required minLength={3} maxLength={200} value={routePlanDraft.sourceReference} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, sourceReference: event.target.value }))} placeholder="Saved lookup, quote, or evidence identifier" className={inputClass} /></label>
              <label className="mt-4 block text-sm font-bold" htmlFor="source-checked-at">Date source was checked<input id="source-checked-at" type="date" required value={routePlanDraft.sourceCheckedAt} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, sourceCheckedAt: event.target.value }))} className={inputClass} /></label>
              <fieldset className="mt-5 rounded-xl border p-4"><legend className="px-2 text-sm font-black">Carrier-route rows</legend><p className="text-xs leading-5 text-slate-600">Upload or paste CSV/TSV with this exact header. One to 50 rows; counts must be nonnegative whole numbers. Files are limited to 256 KB.</p><code className="mt-2 block overflow-x-auto rounded bg-slate-100 p-2 text-[11px]">{ROUTE_HEADER}</code><div className="mt-3 flex flex-wrap gap-2"><label className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-bold">Choose CSV/TSV<input type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" onChange={(event) => void readRouteFile(event)} className="sr-only" /></label><button type="button" onClick={downloadRouteTemplate} className="rounded-lg border px-3 py-2 text-xs font-bold">Download empty CSV header</button></div><label className="mt-3 block text-xs font-bold" htmlFor="route-rows">Route rows<textarea id="route-rows" required rows={9} maxLength={MAX_ROUTE_FILE_BYTES} spellCheck={false} value={routePlanDraft.routeText} onChange={(event) => setRoutePlanDraft((current) => ({ ...current, routeText: event.target.value }))} className={`${inputClass} font-mono text-xs`} /></label>
                {parsedRoutes.errors.length ? <ul role="alert" className="mt-3 list-disc space-y-1 pl-5 text-xs text-rose-800">{parsedRoutes.errors.slice(0, 8).map((message) => <li key={message}>{message}</li>)}</ul> : <p role="status" className="mt-3 text-xs font-bold text-emerald-800">{parsedRoutes.rows.length} route row{parsedRoutes.rows.length === 1 ? '' : 's'} parsed. Server totals will be authoritative after save.</p>}
                <RouteOptimizerPanel
                  parsedRowCount={parsedRoutes.rows.length}
                  hasParseErrors={parsedRoutes.errors.length > 0}
                  targetText={routeOptimizerTarget}
                  setTargetText={setRouteOptimizerTarget}
                  optimization={routeOptimizationState.optimization}
                  optimizationError={routeOptimizationState.error}
                  disabled={Boolean(busy)}
                  onApply={applyRouteOptimization}
                />
              </fieldset>
              <button disabled={busy === 'route-create' || parsedRoutes.errors.length > 0 || parsedRoutes.rows.length === 0} className="mt-5 w-full rounded-lg bg-blue-700 px-4 py-3 font-black text-white disabled:opacity-40">{busy === 'route-create' ? 'Saving…' : 'Save draft route plan'}</button>
            </form>

            <div className="min-w-0">
              <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">Saved route plans</h2><p className="mt-1 text-sm text-slate-600">Current plan first, followed by newest versions.</p></div><span className="text-sm text-slate-500">{loadingPlans ? 'Loading…' : `${routePlans.length} version${routePlans.length === 1 ? '' : 's'}`}</span></div>
              {routePlans.length ? <div className="mt-4 grid gap-5">{routePlans.map((plan) => <RoutePlanCard key={plan.id} plan={plan} current={plan.id === selectedTerritory.currentRoutePlanId} busy={busy} confirmations={planConfirmations} setConfirmation={(key, value) => setPlanConfirmations((existing) => ({ ...existing, [key]: value }))} recheckReference={planRecheckReferences[plan.id] || ''} setRecheckReference={(value) => setPlanRecheckReferences((existing) => ({ ...existing, [plan.id]: value }))} changePlan={changeRoutePlan} attachPlan={attachToFoundingCampaign} />)}</div> : <p className="mt-4 rounded-xl border bg-white p-8 text-center text-sm text-slate-500">No route-plan evidence exists for this territory. No route data was invented.</p>}
            </div>
          </section>}

          <PlanningReferences />
        </div>
      </main>
    </div>
  );
}

function RouteOptimizerPanel({
  parsedRowCount,
  hasParseErrors,
  targetText,
  setTargetText,
  optimization,
  optimizationError,
  disabled,
  onApply,
}: {
  parsedRowCount: number;
  hasParseErrors: boolean;
  targetText: string;
  setTargetText: (value: string) => void;
  optimization: CarrierRouteOptimization | null;
  optimizationError: string | null;
  disabled: boolean;
  onApply: () => void;
}) {
  const deltaLabel = optimization?.direction === 'exact'
    ? 'Exact target'
    : optimization
      ? `${integer(optimization.absoluteDelta)} ${optimization.direction}`
      : 'Unavailable';
  return <section aria-labelledby="route-optimizer-heading" className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
    <h4 id="route-optimizer-heading" className="font-black text-blue-950">Closest whole-route planning suggestion</h4>
    <p className="mt-2 text-xs leading-5 text-blue-950">This calculator uses only the currently parsed, owner-imported count rows and the audience mode above. It selects whole routes; it does not fetch or scrape route data, optimize demographics, validate source evidence, reserve routes, submit a plan, place an order, or authorize spending.</p>
    <div className="mt-3 flex flex-wrap gap-2" aria-label="Quick delivery targets">
      {ROUTE_OPTIMIZER_QUICK_TARGETS.map((target) => <button
        key={target}
        type="button"
        aria-pressed={Number(targetText) === target}
        onClick={() => setTargetText(String(target))}
        className={`rounded-lg border px-3 py-2 text-xs font-bold ${Number(targetText) === target ? 'border-blue-700 bg-blue-700 text-white' : 'border-blue-300 bg-white text-blue-900'}`}
      >{integer(target)}</button>)}
    </div>
    <label className="mt-3 block text-xs font-bold text-blue-950" htmlFor="route-optimizer-target">Custom target count<input id="route-optimizer-target" type="number" min={1} max={ROUTE_OPTIMIZER_MAX_TARGET} step={1} inputMode="numeric" value={targetText} onChange={(event) => setTargetText(event.target.value)} className={inputClass} /></label>
    <p className="mt-2 text-[11px] leading-5 text-blue-900">Bounded to 1-{integer(ROUTE_OPTIMIZER_MAX_TARGET)} deliveries and the current 50-row route-plan limit. Changing the rows, target, or audience mode recalculates this suggestion.</p>

    {hasParseErrors || parsedRowCount === 0
      ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-950">Resolve the imported-row validation messages before calculating a subset.</p>
      : optimizationError
        ? <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-950">{optimizationError}</p>
        : optimization && <div className="mt-4 rounded-xl border border-blue-200 bg-white p-4">
          <dl className="grid gap-3 text-xs sm:grid-cols-2">
            <Detail label="Target" value={integer(optimization.targetCount)} />
            <Detail label="Suggested deliveries" value={integer(optimization.selectedCount)} />
            <Detail label="Difference" value={deltaLabel} />
            <Detail label="Whole routes selected" value={`${optimization.selectedRouteCount} of ${optimization.inputRouteCount}`} />
            <Detail label="Routes excluded" value={integer(optimization.excludedCount)} />
            <Detail label="Imported audience total" value={integer(optimization.importedAudienceCount)} />
          </dl>
          <div className="mt-4 max-h-56 overflow-auto rounded-lg border">
            <table className="min-w-full text-left text-xs">
              <caption className="sr-only">Suggested whole carrier routes and audience counts</caption>
              <thead className="sticky top-0 bg-slate-100"><tr><th className="px-3 py-2">Route identity</th><th className="px-3 py-2">City</th><th className="px-3 py-2 text-right">Audience count</th></tr></thead>
              <tbody className="divide-y">{optimization.selectedRoutes.map((route) => <tr key={route.identity}><td className="px-3 py-2 font-bold">{route.identity}</td><td className="px-3 py-2">{route.city}</td><td className="px-3 py-2 text-right">{integer(route.audienceCount)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="mt-3 text-xs leading-5 text-amber-900">Manually compare this subset with the current official source or written supplier evidence. Count proximity is not evidence quality, deliverability, demographic suitability, or campaign approval.</p>
          <button type="button" disabled={disabled} onClick={onApply} className="mt-3 w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-black text-white disabled:opacity-40">Apply suggested subset to editable draft rows</button>
          <p className="mt-2 text-[11px] leading-5 text-slate-500">Applying replaces only the textarea draft. You must still review it and separately save, verify, and attach any route-plan version.</p>
        </div>}
  </section>;
}

function RoutePlanCard({ plan, current, busy, confirmations, setConfirmation, recheckReference, setRecheckReference, changePlan, attachPlan }: {
  plan: RoutePlanView;
  current: boolean;
  busy: string;
  confirmations: Record<string, string>;
  setConfirmation: (key: string, value: string) => void;
  recheckReference: string;
  setRecheckReference: (value: string) => void;
  changePlan: (plan: RoutePlanView, action: 'verify' | 'recheck' | 'retire') => Promise<void>;
  attachPlan: (plan: RoutePlanView) => Promise<void>;
}) {
  const verifyKey = `${plan.id}:verify`;
  const recheckKey = `${plan.id}:recheck`;
  const retireKey = `${plan.id}:retire`;
  const attachKey = `${plan.id}:attach`;
  const foundingAudienceCompatible = plan.audienceMode === 'residential_only';
  return <article className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${current ? 'border-blue-500' : 'border-slate-200'}`}>
    <header className="flex flex-wrap items-start justify-between gap-3 border-b bg-slate-50 p-5"><div><div className="text-xs font-black uppercase tracking-wide text-blue-700">Version {plan.version}{current ? ' · current territory plan' : ''}</div><h3 className="mt-1 text-xl font-black">{humanize(plan.mailingMethod)}</h3><p className="mt-1 text-sm text-slate-600">{audienceModeLabel(plan.audienceMode)} · {plan.routes.length} route row{plan.routes.length === 1 ? '' : 's'}</p></div><div className="text-right"><StatusPill status={plan.status} /><div className={`mt-2 text-xs font-bold ${plan.sourceFresh ? 'text-emerald-700' : 'text-rose-700'}`}>{plan.sourceFresh ? 'Source within 7-day freshness window' : 'Source stale or not current'}</div></div></header>
    <div className="p-5">
      <dl className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-4"><Detail label="Planned delivery count" value={integer(plan.plannedDeliveryCount)} /><Detail label="Residential" value={integer(plan.totals.residentialCount)} /><Detail label="Business" value={integer(plan.totals.businessCount)} /><Detail label="PO Box" value={integer(plan.totals.poBoxCount)} /><Detail label="All row deliveries" value={integer(plan.totals.totalCount)} /><Detail label="Source" value={humanize(plan.source)} /><Detail label="Original source check" value={plan.sourceCheckedAt} /><Detail label="Effective source check" value={plan.effectiveSourceCheckedAt} /><Detail label="Reference" value={plan.sourceReference} />{plan.sourceRecheckEvidenceReference && <Detail label="Latest recheck evidence" value={plan.sourceRecheckEvidenceReference} />}</dl>
      <p className="mt-4 text-xs leading-5 text-slate-500">Planned delivery count follows the saved audience mode. All totals are derived by the owner-only server route; browser-submitted totals are not accepted.</p>
      <a href={plan.sourceUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block text-sm font-bold text-blue-700 underline">Open recorded evidence URL</a>
      <div className="mt-5 overflow-x-auto"><table className="min-w-[820px] text-left text-xs"><caption className="mb-2 text-left font-bold text-slate-700">Saved carrier-route evidence for version {plan.version}</caption><thead><tr className="bg-slate-100"><th className="px-3 py-2">ZIP</th><th className="px-3 py-2">Carrier route</th><th className="px-3 py-2">City</th><th className="px-3 py-2">Type</th><th className="px-3 py-2">Residential</th><th className="px-3 py-2">Business</th><th className="px-3 py-2">PO Box</th><th className="px-3 py-2">Derived total</th></tr></thead><tbody className="divide-y">{plan.routes.map((route, index) => <tr key={`${route.zipCode}-${route.carrierRouteCode}-${index}`}><td className="px-3 py-2">{route.zipCode}</td><td className="px-3 py-2 font-bold">{route.carrierRouteCode}</td><td className="px-3 py-2">{route.city}</td><td className="px-3 py-2">{humanize(route.routeType)}</td><td className="px-3 py-2">{integer(route.residentialCount)}</td><td className="px-3 py-2">{integer(route.businessCount)}</td><td className="px-3 py-2">{integer(route.poBoxCount)}</td><td className="px-3 py-2 font-bold">{integer(route.totalCount ?? route.residentialCount + route.businessCount + route.poBoxCount)}</td></tr>)}</tbody></table></div>

      {plan.status === 'draft' && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h4 className="font-black text-emerald-950">Verify this evidence version</h4><ConfirmationField id={`verify-${plan.id}`} phrase="VERIFY ROUTE PLAN" value={confirmations[verifyKey] || ''} onChange={(value) => setConfirmation(verifyKey, value)} /><button type="button" disabled={Boolean(busy) || confirmations[verifyKey] !== 'VERIFY ROUTE PLAN' || !plan.sourceFresh} onClick={() => void changePlan(plan, 'verify')} className="mt-3 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Verify route plan</button></div>}
      {plan.status === 'verified' && <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4"><h4 className="font-black text-blue-950">Attach to founding campaign</h4><p className="mt-1 text-xs leading-5 text-blue-900">This makes the exact verified version current for the founding campaign. It does not enable checkout, printing, postage, or ordering.</p>{!foundingAudienceCompatible && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs font-bold text-amber-950">The founding household campaign accepts residential-only route plans. Create a new compatible version instead of changing this immutable evidence.</p>}<ConfirmationField id={`attach-${plan.id}`} phrase="APPLY ROUTES TO FOUNDING CAMPAIGN" value={confirmations[attachKey] || ''} onChange={(value) => setConfirmation(attachKey, value)} /><button type="button" disabled={Boolean(busy) || confirmations[attachKey] !== 'APPLY ROUTES TO FOUNDING CAMPAIGN' || !plan.sourceFresh || !foundingAudienceCompatible} onClick={() => void attachPlan(plan)} className="mt-3 rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Attach exact route plan</button></div>}
      {plan.status === 'attached' && current && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><h4 className="font-black text-amber-950">Recheck the exact attached plan</h4><p className="mt-1 text-xs leading-5 text-amber-950">Open the recorded external source and compare every immutable route row and server-derived total. Use this only when they remain exact and unchanged. If anything changed, stop and resolve the campaign plan instead.</p><label className="mt-3 block text-xs font-bold text-amber-950" htmlFor={`recheck-reference-${plan.id}`}>Current recheck evidence reference<input id={`recheck-reference-${plan.id}`} value={recheckReference} maxLength={500} onChange={(event) => setRecheckReference(event.target.value)} className={inputClass} /></label><ConfirmationField id={`recheck-${plan.id}`} phrase="RECHECKED SOURCE - EXACT PLAN UNCHANGED" value={confirmations[recheckKey] || ''} onChange={(value) => setConfirmation(recheckKey, value)} /><button type="button" disabled={Boolean(busy) || recheckReference.trim().length < 3 || confirmations[recheckKey] !== 'RECHECKED SOURCE - EXACT PLAN UNCHANGED'} onClick={() => void changePlan(plan, 'recheck')} className="mt-3 rounded-lg bg-amber-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-40">Record unchanged-source recheck</button></div>}
      {plan.status !== 'retired' && <details className="mt-5 rounded-xl border border-rose-200 p-4"><summary className="cursor-pointer font-black text-rose-900">Retire this route-plan version</summary><p className="mt-2 text-xs leading-5 text-slate-600">Retirement preserves the evidence record but removes it from future use. The server blocks unsafe retirement of attached/current data.</p><ConfirmationField id={`retire-${plan.id}`} phrase="RETIRE ROUTE PLAN" value={confirmations[retireKey] || ''} onChange={(value) => setConfirmation(retireKey, value)} /><button type="button" disabled={Boolean(busy) || confirmations[retireKey] !== 'RETIRE ROUTE PLAN'} onClick={() => void changePlan(plan, 'retire')} className="mt-3 rounded-lg border border-rose-300 px-4 py-2 text-sm font-bold text-rose-800 disabled:opacity-40">Retire route plan</button></details>}
    </div>
  </article>;
}

function PlanningReferences() {
  return <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-7">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Current planning references</div><h2 className="mt-2 text-2xl font-black">Printing4SuperCheap + USPS</h2></div><div className="rounded-2xl bg-blue-50 px-5 py-3 text-right"><div className="text-xs font-bold uppercase tracking-wide text-blue-800">EDDM Retail postage</div><div className="mt-1 text-2xl font-black text-slate-950">${(USPS_EDDM_RETAIL.rateMillsPerPiece / 1_000).toFixed(3)} / piece</div><div className="text-xs text-slate-600">Effective {USPS_EDDM_RETAIL.effectiveDate}</div></div></div>
    <p className="mt-5 max-w-4xl leading-7 text-slate-700">CaliforniaMailer uses {PRINTING4SUPERCHEAP.name} as the production supplier. The print rows below are the supplier&apos;s public discounted snapshot observed {PRINTING4SUPERCHEAP.priceObservedAt}; the sheet provides no validity date, so recheck it within {PRINTING4SUPERCHEAP.recheckAfterDays} days and immediately before every written quote or order.</p>
    <div className="mt-6 overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left text-sm"><caption className="mb-3 text-left font-bold text-slate-800">USPS postage references effective {USPS_EDDM_RETAIL.effectiveDate}</caption><thead><tr className="bg-slate-100 text-slate-700"><th className="rounded-l-xl px-4 py-3">Postal method</th><th className="px-4 py-3">Per piece</th><th className="rounded-r-xl px-4 py-3">5,000 pieces</th></tr></thead><tbody>{postalReferenceRows.map((row) => <tr key={row.id} className="align-top"><td className="px-4 py-3 font-bold text-slate-900">{row.label}</td><td className="px-4 py-3">${(row.rateMillsPerPiece / 1_000).toFixed(3)}</td><td className="px-4 py-3">{currency(row.postageAtReferenceQuantityCents)}</td></tr>)}</tbody></table></div>
    <p className="mt-3 text-sm leading-6 text-slate-600">BMEU pricing depends on entry location and eligibility. A {currency(USPS_EDDM_BMEU.permitImprintApplicationFeeCents)} permit-imprint application fee and {currency(USPS_EDDM_BMEU.annualMailingFeeCents)} annual mailing fee may apply; verify whether the supplier&apos;s permit or service changes those costs before choosing BMEU. At 5,000 pieces, destination-unit BMEU postage is only {currency((USPS_EDDM_RETAIL.rateMillsPerPiece - USPS_EDDM_BMEU.rates[2].rateMillsPerPiece) * REFERENCE_QUANTITY / 10)} below Retail before permit, preparation, and transport costs.</p>
    <div className="mt-6 overflow-x-auto"><table className="min-w-full border-separate border-spacing-0 text-left text-sm"><caption className="mb-3 text-left font-bold text-slate-800">5,000-piece owner cost reference — not customer pricing</caption><thead><tr className="bg-slate-100 text-slate-700"><th className="rounded-l-xl px-4 py-3">Mail piece</th><th className="px-4 py-3">Print snapshot</th><th className="px-4 py-3">Print + Retail postage</th><th className="rounded-r-xl px-4 py-3">Print + turnkey + banding</th></tr></thead><tbody>{referenceRows.map((row) => <tr key={row.specificationId} className="border-b border-slate-100 align-top"><td className="px-4 py-4 font-bold text-slate-900">{row.label}</td><td className="px-4 py-4">{currency(row.printPriceCents)}</td><td className="px-4 py-4">{currency(row.printAndRetailPostageCents)}</td><td className="px-4 py-4">{currency(row.turnkeyKnownSubtotalCents)}</td></tr>)}</tbody></table></div>
    <div className="mt-5 grid gap-4 text-sm leading-6 text-slate-700 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-black text-slate-950">Print-only column</h3><p className="mt-2">Includes the listed print snapshot and current EDDM Retail postage. It still excludes tax, design, bundling, postal paperwork, delivery to the entry office, and other project costs.</p></div><div className="rounded-2xl bg-slate-50 p-5"><h3 className="font-black text-slate-950">Turnkey column</h3><p className="mt-2">Uses the supplier sheet&apos;s 33¢ per-piece add-on, which says postage, preparation, direct post-office shipment, tracking, and print photos are included, plus $5 banding per 1,000. Tax, design, and other costs remain unknown.</p></div></div>
    <div className="mt-6 flex flex-wrap gap-4"><a href={PRINTING4SUPERCHEAP.discountSheetUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Open discounted supplier sheet</a><a href={PRINTING4SUPERCHEAP.productUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Open supplier EDDM product</a><a href={USPS_EDDM_RETAIL.sourceUrl} target="_blank" rel="noreferrer" className="font-bold text-blue-700 underline">Open USPS July 2026 prices</a></div>
  </section>;
}

function ConfirmationField({ id, phrase, value, onChange }: { id: string; phrase: string; value: string; onChange: (value: string) => void }) {
  return <label className="mt-3 block text-xs font-bold text-slate-600" htmlFor={id}>Type <code className="rounded bg-slate-100 px-1 text-slate-900">{phrase}</code><input id={id} autoComplete="off" value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} /></label>;
}

function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-1 break-words text-slate-900">{value}</dd></div>; }
function StatusPill({ status }: { status: string }) { return <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-black text-slate-700">{humanize(status)}</span>; }
function Centered({ children }: { children: React.ReactNode }) { return <div className="flex min-h-screen items-center justify-center p-8 text-center text-slate-600">{children}</div>; }
function humanize(value: string) { return value ? value.replaceAll('_', ' ') : 'unknown'; }
function audienceModeLabel(value: AudienceMode) {
  return value === 'residential_only'
    ? 'Residential only'
    : 'Residential + business + PO Boxes';
}
function splitList(value: string) { return [...new Set(value.split(/[\r\n,]+/).map((item) => item.trim()).filter(Boolean))]; }

function parseRouteText(text: string): { rows: RouteRow[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['Add the required header and at least one route row.'] };
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const headers = parseDelimitedLine(lines[0], delimiter).map((header) => header.trim());
  const positions = new Map(headers.map((header, index) => [header.toLowerCase(), index]));
  const missing = ROUTE_COLUMNS.filter((column) => !positions.has(column.toLowerCase()));
  if (missing.length) return { rows: [], errors: [`Missing required column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`] };
  const errors: string[] = [];
  const rows: RouteRow[] = [];
  if (lines.length - 1 > 50) errors.push('A route plan can contain at most 50 rows.');
  for (let lineIndex = 1; lineIndex < lines.length && lineIndex <= 50; lineIndex += 1) {
    const values = parseDelimitedLine(lines[lineIndex], delimiter);
    const read = (column: typeof ROUTE_COLUMNS[number]) => values[positions.get(column.toLowerCase()) ?? -1]?.trim() || '';
    const zipCode = read('zipCode');
    const carrierRouteCode = read('carrierRouteCode');
    const city = read('city');
    const routeType = read('routeType') as RouteType;
    const counts = ['residentialCount', 'businessCount', 'poBoxCount'].map((column) => read(column as typeof ROUTE_COLUMNS[number]));
    const rowNumber = lineIndex + 1;
    if (!/^\d{5}$/.test(zipCode)) errors.push(`Row ${rowNumber}: zipCode must be exactly five digits.`);
    if (!carrierRouteCode) errors.push(`Row ${rowNumber}: carrierRouteCode is required.`);
    if (!city) errors.push(`Row ${rowNumber}: city is required.`);
    if (!routeTypes.has(routeType)) errors.push(`Row ${rowNumber}: routeType must be city, rural_highway, po_box, or other.`);
    if (counts.some((count) => !/^\d+$/.test(count))) errors.push(`Row ${rowNumber}: delivery counts must be nonnegative whole numbers.`);
    if (errors.some((message) => message.startsWith(`Row ${rowNumber}:`))) continue;
    rows.push({
      zipCode,
      carrierRouteCode,
      city,
      routeType,
      residentialCount: Number(counts[0]),
      businessCount: Number(counts[1]),
      poBoxCount: Number(counts[2]),
    });
  }
  if (!rows.length && !errors.length) errors.push('Add at least one route row below the header.');
  return { rows, errors };
}

function parseDelimitedLine(line: string, delimiter: string) {
  if (delimiter === '\t') return line.split('\t').map((value) => value.replace(/^"|"$/g, '').replace(/""/g, '"'));
  const values: string[] = [];
  let current = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      values.push(current); current = '';
    } else current += character;
  }
  values.push(current);
  return values;
}

function routeRowsToText(rows: readonly RouteRow[]): string {
  const lines = rows.map((row) => ROUTE_COLUMNS
    .map((column) => delimitedCell(row[column]))
    .join(','));
  return [ROUTE_HEADER, ...lines].join('\r\n');
}

function delimitedCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadRouteTemplate() {
  const blob = new Blob([`${ROUTE_HEADER}\r\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'californiamailer-route-plan-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}
