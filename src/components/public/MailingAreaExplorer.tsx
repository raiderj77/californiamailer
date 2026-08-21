'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { PRINTING4SUPERCHEAP } from '@/config/eddmOfferings';

type MailingAreaStatus = 'planning' | 'available' | 'paused';

interface PublicRoutePlan {
  sourceLabel: string;
  sourceCheckedAt: string;
  routeCount: number;
  zipCodes: string[];
  residentialCount: number;
  businessCount: number;
  poBoxCount: number;
  totalCount: number;
  plannedDeliveryCount: number;
  audienceMode: string;
  mailingMethod: string;
}

export interface PublicMailingArea {
  slug: string;
  name: string;
  state: string;
  county: string;
  candidateZipCodes: string[];
  candidateAreas: string[];
  status: MailingAreaStatus;
  routePlan: PublicRoutePlan | null;
}

export interface MailingAreaFallback extends PublicMailingArea {
  planningTarget?: number;
}

interface MailingAreaExplorerProps {
  filterSlug?: string;
  fallbackArea?: MailingAreaFallback;
  showSearch?: boolean;
}

interface MailingAreasResponse {
  territories: PublicMailingArea[];
  freshnessPolicyDays: number | null;
}

type RequestState =
  | { kind: 'loading' }
  | { kind: 'ready'; territories: PublicMailingArea[]; freshnessPolicyDays: number | null }
  | { kind: 'error' };

const USPS_EDDM_ROUTE_TOOL = 'https://eddm.usps.com/eddm/select-routes.htm?m=1';

export function MailingAreaExplorer({
  filterSlug,
  fallbackArea,
  showSearch = !filterSlug,
}: MailingAreaExplorerProps) {
  const [requestState, setRequestState] = useState<RequestState>({ kind: 'loading' });
  const [query, setQuery] = useState('');
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadMailingAreas() {
      setRequestState({ kind: 'loading' });
      try {
        const response = await fetch('/api/mailing-areas', {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('mailing-area-request-failed');

        const parsed = parseMailingAreasResponse(await response.json());
        if (!parsed) throw new Error('mailing-area-response-invalid');
        setRequestState({ kind: 'ready', ...parsed });
      } catch (error) {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === 'AbortError')) return;
        setRequestState({ kind: 'error' });
      }
    }

    void loadMailingAreas();
    return () => controller.abort();
  }, [requestVersion]);

  const resolved = useMemo(() => {
    if (requestState.kind === 'loading') {
      return { territories: [], usingFallback: false };
    }
    if (requestState.kind === 'error') {
      return fallbackArea ? { territories: [fallbackArea], usingFallback: true } : { territories: [], usingFallback: false };
    }

    const matchingSlug = filterSlug
      ? requestState.territories.filter((territory) => territory.slug === filterSlug)
      : requestState.territories;
    if (matchingSlug.length === 0 && fallbackArea) {
      return { territories: [fallbackArea], usingFallback: true };
    }
    return { territories: matchingSlug, usingFallback: false };
  }, [fallbackArea, filterSlug, requestState]);

  const visibleTerritories = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-US');
    if (!normalizedQuery) return resolved.territories;
    return resolved.territories.filter((territory) => searchText(territory).includes(normalizedQuery));
  }, [query, resolved.territories]);

  const exactCount = visibleTerritories.filter((territory) => territory.routePlan !== null).length;

  return (
    <div>
      {showSearch && (
        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <label htmlFor="mailing-area-search" className="block text-sm font-black text-slate-950">
            Search by mailing area or ZIP Code
          </label>
          <div className="mt-3 flex items-center rounded-xl border border-slate-300 bg-white px-4 focus-within:border-blue-700 focus-within:ring-2 focus-within:ring-blue-100">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-4-4" />
            </svg>
            <input
              id="mailing-area-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Example: Monterey or 93940"
              className="min-h-12 w-full border-0 bg-transparent px-3 outline-none"
            />
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Candidate ZIP Codes help describe an area. They are not selected carrier routes, reserved categories, or a promise that a mailing is scheduled.
          </p>
        </div>
      )}

      {requestState.kind === 'loading' && (
        <div role="status" aria-live="polite" className="mt-6 rounded-3xl border border-blue-200 bg-blue-50 p-6 text-blue-950">
          <div className="flex items-center gap-3 font-black">
            <span aria-hidden="true" className="h-3 w-3 animate-pulse rounded-full bg-blue-700" />
            Checking published mailing-area records…
          </div>
          <p className="mt-2 text-sm leading-6">Exact route totals will appear only if the public API returns a current verified route-plan snapshot.</p>
        </div>
      )}

      {requestState.kind === 'error' && (
        <div role="alert" className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <h2 className="text-lg font-black">Published mailing-area records could not be loaded</h2>
          <p className="mt-2 text-sm leading-6">
            No exact route count, ZIP selection, or delivery-address total is being shown from the unavailable service.
            {fallbackArea ? ' The configured founding-area preview below remains planning-only.' : ''}
          </p>
          <button
            type="button"
            onClick={() => setRequestVersion((current) => current + 1)}
            className="mt-4 min-h-11 rounded-xl border border-rose-300 bg-white px-4 py-2 font-black text-rose-950 hover:bg-rose-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-700 focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      )}

      {requestState.kind === 'ready' && resolved.usingFallback && (
        <div role="status" className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
          <h2 className="text-lg font-black">No published record for this mailing area</h2>
          <p className="mt-2 text-sm leading-6">The configured founding-area preview below contains candidate geography only. It has no public verified route plan or exact delivery-address count.</p>
        </div>
      )}

      {requestState.kind === 'ready' && resolved.territories.length === 0 && (
        <div role="status" className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-7 text-center">
          <h2 className="text-xl font-black text-slate-950">No public mailing areas are listed yet</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-600">CaliforniaMailer has not published a planning area through the public route system. You can still describe a city or ZIP Code in a written planning request.</p>
          <Link href="/quote" className="mt-5 inline-flex rounded-xl bg-blue-700 px-5 py-3 font-black text-white hover:bg-blue-800">Describe your area</Link>
        </div>
      )}

      {resolved.territories.length > 0 && visibleTerritories.length === 0 && (
        <div role="status" className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-7 text-center">
          <h2 className="text-xl font-black text-slate-950">No mailing areas match “{query.trim()}”</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Try a city, county, area name, or five-digit ZIP Code.</p>
          <button type="button" onClick={() => setQuery('')} className="mt-4 min-h-11 rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-900 hover:bg-slate-100">Clear search</button>
        </div>
      )}

      {visibleTerritories.length > 0 && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <p role="status" aria-live="polite" aria-atomic="true" className="text-sm font-bold text-slate-700">
              {resolved.usingFallback
                ? 'Showing the configured planning preview'
                : `Showing ${visibleTerritories.length.toLocaleString('en-US')} ${visibleTerritories.length === 1 ? 'mailing area' : 'mailing areas'}`}
            </p>
            <p className="text-xs leading-5 text-slate-500">
              {exactCount > 0 ? `${exactCount} with a current published route snapshot` : 'No current published route snapshots in these results'}
            </p>
          </div>
          <div className="mt-4 grid gap-6 lg:grid-cols-2">
            {visibleTerritories.map((territory) => (
              <MailingAreaCard
                key={territory.slug}
                territory={territory}
                planningTarget={territory.slug === fallbackArea?.slug ? fallbackArea.planningTarget : undefined}
                freshnessPolicyDays={requestState.kind === 'ready' ? requestState.freshnessPolicyDays : null}
              />
            ))}
          </div>
        </>
      )}

      <div className="mt-8 grid gap-4 rounded-3xl border border-slate-200 bg-slate-50 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div>
          <h2 className="text-lg font-black text-slate-950">Check routes at the source</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Use the official USPS EDDM route tool to explore carrier-route options. CaliforniaMailer rechecks route counts and the current supplier scope before issuing a written quote or authorizing any print or postage order.</p>
        </div>
        <div className="flex flex-wrap gap-3 md:justify-end">
          <a href={USPS_EDDM_ROUTE_TOOL} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-blue-300 bg-white px-4 py-2 font-black text-blue-900 hover:border-blue-500">Open USPS route tool<span className="sr-only"> (opens in a new tab)</span></a>
          <a href={PRINTING4SUPERCHEAP.productUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 py-2 font-black text-slate-900 hover:border-slate-500">View {PRINTING4SUPERCHEAP.name}<span className="sr-only"> (opens in a new tab)</span></a>
        </div>
      </div>
    </div>
  );
}

function MailingAreaCard({
  territory,
  planningTarget,
  freshnessPolicyDays,
}: {
  territory: PublicMailingArea;
  planningTarget?: number;
  freshnessPolicyDays: number | null;
}) {
  const routePlan = territory.routePlan;
  const hasExactSnapshot = routePlan !== null;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.15em] text-blue-700">{territory.county}, {territory.state}</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">{territory.name}</h2>
          </div>
          <StatusBadge status={territory.status} />
        </div>
        <StatusExplanation status={territory.status} />
      </div>

      <div className="flex flex-1 flex-col p-6 sm:p-7">
        {hasExactSnapshot ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
              <div className="text-xs font-black uppercase tracking-[0.14em]">Current published route snapshot</div>
              <dl className={`mt-3 grid gap-3 ${planningTarget !== undefined ? 'sm:grid-cols-2' : ''}`}>
                {planningTarget !== undefined && (
                  <div className="rounded-xl bg-white/70 p-4">
                    <dt className="text-xs font-black uppercase tracking-wide">Configured target</dt>
                    <dd className="mt-1 text-3xl font-black">{planningTarget.toLocaleString('en-US')}</dd>
                    <dd className="mt-1 text-xs font-bold">planning intent</dd>
                  </div>
                )}
                <div className="rounded-xl bg-white/70 p-4">
                  <dt className="text-xs font-black uppercase tracking-wide">Verified address count</dt>
                  <dd className="mt-1 text-3xl font-black">{routePlan.plannedDeliveryCount.toLocaleString('en-US')}</dd>
                  <dd className="mt-1 text-xs font-bold">selected-route addresses for planning</dd>
                </div>
              </dl>
              <p className="mt-3 text-xs leading-5">This is a dated address count for planning, not proof that mail was delivered. It will be rechecked before a quote, print order, or postage order.</p>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Fact label="Carrier routes" value={routePlan.routeCount.toLocaleString('en-US')} />
              <Fact label="ZIP Codes" value={routePlan.zipCodes.join(', ')} />
              <Fact label="Residential" value={routePlan.residentialCount.toLocaleString('en-US')} />
              <Fact label="Business" value={routePlan.businessCount.toLocaleString('en-US')} />
              <Fact label="PO Box" value={routePlan.poBoxCount.toLocaleString('en-US')} />
              <Fact label="Route-source total" value={routePlan.totalCount.toLocaleString('en-US')} />
            </dl>
            <dl className="mt-5 space-y-3 rounded-2xl bg-slate-50 p-5 text-sm">
              <InlineFact label="Audience" value={formatCodeLabel(routePlan.audienceMode)} />
              <InlineFact label="Mailing method" value={formatCodeLabel(routePlan.mailingMethod)} />
              <InlineFact label="Source" value={routePlan.sourceLabel} />
              <InlineFact label="Source checked" value={formatSourceDate(routePlan.sourceCheckedAt)} />
            </dl>
            {freshnessPolicyDays !== null && (
              <p className="mt-3 text-xs leading-5 text-slate-500">CaliforniaMailer’s public API withholds exact route data after its {freshnessPolicyDays}-day freshness window. The owner still rechecks the source before any consequential action.</p>
            )}
          </>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950">
            <div className="text-xs font-black uppercase tracking-[0.14em]">Planning only · no exact count</div>
            {planningTarget !== undefined && (
              <div className="mt-3">
                <div className="text-3xl font-black">{planningTarget.toLocaleString('en-US')}</div>
                <p className="mt-1 text-sm font-bold">configured planning target, not a verified route total</p>
              </div>
            )}
            <p className="mt-3 text-sm leading-6">No current verified route plan is public for this area. Candidate geography does not identify selected routes or establish an exact number of reachable addresses.</p>
          </div>
        )}

        {(territory.candidateAreas.length > 0 || territory.candidateZipCodes.length > 0) && (
          <div className="mt-5">
            <h3 className="text-sm font-black text-slate-950">Candidate geography</h3>
            {territory.candidateAreas.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Candidate areas">
                {territory.candidateAreas.map((area) => <li key={area} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm font-bold text-slate-700">{area}</li>)}
              </ul>
            )}
            {territory.candidateZipCodes.length > 0 && (
              <p className="mt-3 text-sm leading-6 text-slate-600"><strong>Candidate ZIP Codes:</strong> {territory.candidateZipCodes.join(', ')}</p>
            )}
            <p className="mt-3 text-xs leading-5 text-slate-500">Candidate areas and ZIP Codes are descriptive only. They do not indicate category availability, a selected route, a mailing date, or completed delivery.</p>
          </div>
        )}

        <div className="mt-auto border-t border-slate-100 pt-5">
          <p className="text-sm leading-6 text-slate-600">
            {territory.status === 'paused'
              ? 'Planning inquiries for this area are paused. A general question does not create availability or reserve a future campaign.'
              : 'Planning a 5,000- or 10,000-piece scenario? The final quantity must follow the verified route selection and written production scope.'}
          </p>
          <Link href="/quote" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-blue-700 px-5 py-2 font-black text-white hover:bg-blue-800">
            {territory.status === 'paused' ? 'Ask a general question' : 'Request written planning'}
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: MailingAreaStatus }) {
  const styles = status === 'available'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : status === 'paused'
      ? 'border-slate-300 bg-slate-100 text-slate-800'
      : 'border-amber-200 bg-amber-50 text-amber-900';
  const label = status === 'available' ? 'Available for review' : status === 'paused' ? 'Planning paused' : 'In planning';
  return <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase tracking-wide ${styles}`}>{label}</span>;
}

function StatusExplanation({ status }: { status: MailingAreaStatus }) {
  if (status === 'available') {
    return <p className="mt-3 text-sm leading-6 text-slate-600">The owner can review an inquiry for this area. This does not confirm a category, route, quantity, schedule, price, or acceptance.</p>;
  }
  if (status === 'paused') {
    return <p className="mt-3 text-sm leading-6 text-slate-600">New planning is paused. This does not describe an existing mailing date or completed delivery.</p>;
  }
  return <p className="mt-3 text-sm leading-6 text-slate-600">Candidate geography is being evaluated. No live availability, exclusivity, route selection, or mailing date is implied.</p>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 p-4"><dt className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 break-words font-black text-slate-950">{value}</dd></div>;
}

function InlineFact({ label, value }: { label: string; value: string }) {
  return <div className="grid gap-1 sm:grid-cols-[130px_1fr]"><dt className="font-black text-slate-700">{label}</dt><dd className="break-words text-slate-600">{value}</dd></div>;
}

function searchText(territory: PublicMailingArea): string {
  return [
    territory.slug,
    territory.name,
    territory.state,
    territory.county,
    ...territory.candidateZipCodes,
    ...territory.candidateAreas,
    ...(territory.routePlan?.zipCodes ?? []),
  ].join(' ').toLocaleLowerCase('en-US');
}

function formatCodeLabel(value: string): string {
  return value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1))
    .join(' ');
}

function formatSourceDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(date);
}

function parseMailingAreasResponse(value: unknown): MailingAreasResponse | null {
  if (!isRecord(value) || !Array.isArray(value.territories)) return null;

  const territories: PublicMailingArea[] = [];
  const seenSlugs = new Set<string>();
  for (const candidate of value.territories) {
    const territory = parseMailingArea(candidate);
    if (!territory || seenSlugs.has(territory.slug)) continue;
    seenSlugs.add(territory.slug);
    territories.push(territory);
  }

  const freshnessPolicyDays = isPositiveInteger(value.freshnessPolicyDays)
    ? value.freshnessPolicyDays
    : null;
  return { territories, freshnessPolicyDays };
}

function parseMailingArea(value: unknown): PublicMailingArea | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.slug) || !isNonEmptyString(value.name) || !isNonEmptyString(value.state) || !isNonEmptyString(value.county)) return null;
  if (!isStringArray(value.candidateZipCodes) || !isStringArray(value.candidateAreas)) return null;
  if (!['planning', 'available', 'paused'].includes(String(value.status))) return null;

  return {
    slug: value.slug,
    name: value.name,
    state: value.state,
    county: value.county,
    candidateZipCodes: value.candidateZipCodes,
    candidateAreas: value.candidateAreas,
    status: value.status as MailingAreaStatus,
    routePlan: parseRoutePlan(value.routePlan),
  };
}

function parseRoutePlan(value: unknown): PublicRoutePlan | null {
  if (!isRecord(value)) return null;
  if (!isNonEmptyString(value.sourceLabel) || !isNonEmptyString(value.sourceCheckedAt)) return null;
  if (!isPositiveInteger(value.routeCount) || !isStringArray(value.zipCodes) || value.zipCodes.length === 0 || value.zipCodes.some((zip) => !/^\d{5}$/.test(zip))) return null;
  if (!isNonNegativeInteger(value.residentialCount) || !isNonNegativeInteger(value.businessCount) || !isNonNegativeInteger(value.poBoxCount)) return null;
  if (!isPositiveInteger(value.totalCount) || !isPositiveInteger(value.plannedDeliveryCount)) return null;
  if (!isNonEmptyString(value.audienceMode) || !isNonEmptyString(value.mailingMethod)) return null;
  if (Number.isNaN(new Date(value.sourceCheckedAt).getTime())) return null;

  return {
    sourceLabel: value.sourceLabel,
    sourceCheckedAt: value.sourceCheckedAt,
    routeCount: value.routeCount,
    zipCodes: value.zipCodes,
    residentialCount: value.residentialCount,
    businessCount: value.businessCount,
    poBoxCount: value.poBoxCount,
    totalCount: value.totalCount,
    plannedDeliveryCount: value.plannedDeliveryCount,
    audienceMode: value.audienceMode,
    mailingMethod: value.mailingMethod,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return isNonNegativeInteger(value) && value > 0;
}
