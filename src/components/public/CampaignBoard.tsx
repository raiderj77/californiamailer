'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  FOUNDING_CAMPAIGN,
  campaignMatchesActiveSharedModel,
  formatCurrency,
  humanizeStatus,
} from '@/config/foundingCampaign';
import type { PublicCampaign } from '@/lib/campaignTypes';
import type { PublicPlanningPriceVisibility } from '@/lib/publicPlanningPriceVisibility';
import { getPublishedCampaigns } from '@/lib/publicCampaigns';

type LoadState = 'loading' | 'published' | 'empty' | 'error';

const publicDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'America/Los_Angeles',
});

const publicDeadlineFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'America/Los_Angeles',
  timeZoneName: 'short',
});

const californiaDateKeyFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function californiaDateKey(date: Date = new Date()): string {
  const parts = new Map(californiaDateKeyFormatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`;
}

function hasCurrentRouteEvidence(campaign: PublicCampaign): boolean {
  return campaign.routesConfirmed === true
    && typeof campaign.routePlanEvidenceValidThrough === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(campaign.routePlanEvidenceValidThrough)
    && californiaDateKey() <= campaign.routePlanEvidenceValidThrough;
}

function parsePublicDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00Z` : value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDeliveryWindow(start: string | null, end: string | null): string {
  const parsedStart = parsePublicDate(start);
  const parsedEnd = parsePublicDate(end);
  if ((start && !parsedStart) || (end && !parsedEnd)) return 'Unavailable';
  if (!parsedStart && !parsedEnd) return 'Not scheduled';
  if (parsedStart && parsedEnd) {
    return `${publicDateFormatter.format(parsedStart)} – ${publicDateFormatter.format(parsedEnd)}`;
  }
  return parsedStart
    ? `Starting ${publicDateFormatter.format(parsedStart)}`
    : `By ${publicDateFormatter.format(parsedEnd as Date)}`;
}

function formatReservationDeadline(value: string | null): string {
  if (!value) return 'Not set';
  const deadline = parsePublicDate(value);
  if (!deadline) return 'Unavailable';
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? `${publicDateFormatter.format(deadline)} (time not published)`
    : publicDeadlineFormatter.format(deadline);
}

function isPublishedCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isCurrentOfferCampaign(campaign: PublicCampaign): boolean {
  return campaignMatchesActiveSharedModel(campaign);
}

function formatPublishedCount(value: unknown): string {
  return isPublishedCount(value) ? value.toLocaleString() : 'Not published';
}

function formatPublishedCurrency(value: unknown): string {
  return isPublishedCount(value) ? formatCurrency(value) : 'Not published';
}

function ConfigurationPreview({
  priceVisibility,
  dataUnavailable = false,
}: {
  priceVisibility: PublicPlanningPriceVisibility;
  dataUnavailable?: boolean;
}) {
  return (
    <section aria-label="Founding campaign configuration preview" className="rounded-3xl border border-amber-200 bg-amber-50 p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-amber-800">Configuration preview</div>
          <h2 className="mt-2 text-2xl font-black">{FOUNDING_CAMPAIGN.title}</h2>
        </div>
        <span className="rounded-full bg-amber-200 px-3 py-1 text-sm font-bold text-amber-950">Pre-launch</span>
      </div>
      <p className="mt-5 max-w-3xl leading-7 text-slate-700">
        {dataUnavailable
          ? 'The published campaign record could not be checked. The figures below are the owner’s proposed starting configuration, not live inventory, reservations, funding, or a delivery commitment.'
          : 'No campaign record is currently published from the database. The figures below are the owner’s proposed starting configuration, not live inventory, reservations, funding, or a delivery commitment.'}
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PreviewStat label="Territory" value={FOUNDING_CAMPAIGN.territory} detail="Exact carrier routes not selected" />
        <PreviewStat label="Plan" value={FOUNDING_CAMPAIGN.planId} detail={`Model version: ${FOUNDING_CAMPAIGN.offerModelVersion}`} />
        <PreviewStat label="Format" value="9 × 12 · 14 pt" detail="Experimental shared EDDM template" />
        <PreviewStat label="Mail quantity" value={`${FOUNDING_CAMPAIGN.targetHouseholds.toLocaleString()} pieces`} detail="Planning target; no mailed count recorded" />
        <PreviewStat label="Planned delivery" value="Not scheduled" detail="No delivery commitment" />
        <PreviewStat label="Reservation deadline" value="Not set" detail="Interest only while pre-launch" />
        <PreviewStat label="Equal slot-units" value={FOUNDING_CAMPAIGN.placements.standard.count.toLocaleString()} detail={priceVisibility.active.supported ? `${priceVisibility.active.customerUnitPriceLabel} proposed per paid unit` : priceVisibility.active.customerUnitPriceLabel} />
        <PreviewStat label="Minimum paid units" value={FOUNDING_CAMPAIGN.minimumPaidPlacements.toLocaleString()} detail="No paid units recorded" />
        <PreviewStat label="Full funding goal" value={priceVisibility.active.derivedFundingGoalLabel} detail={priceVisibility.active.supported ? 'No published database funding amount' : 'Current written quote required'} />
        <PreviewStat label="Checkout" value="Disabled" detail="Physical preflight and complete economics required" />
      </div>
      <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-100/70 p-5 text-sm leading-6 text-amber-950">
        <strong>Experimental inventory:</strong> HRM guidance describes roughly 16–18 ads as comfortable on a 9 × 12 and about 25 on a 12 × 15. This requested 24-unit 9 × 12 needs a real template with indicia, address space, branding, disclosures, bleed, safe areas, and readable content.
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-700">
          <h3 className="font-black text-slate-950">Candidate territory</h3>
          <p className="mt-2">{FOUNDING_CAMPAIGN.candidateAreas.join(', ')}. Final routes and household totals have not been selected or verified.</p>
        </div>
        <div className="rounded-2xl bg-white p-5 text-sm leading-6 text-slate-700">
          <h3 className="font-black text-slate-950">Proposed inclusions</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {FOUNDING_CAMPAIGN.inclusions.map((inclusion) => <li key={inclusion}>{inclusion}</li>)}
          </ul>
        </div>
      </div>
      <div className="mt-6 rounded-2xl bg-white p-5 text-sm leading-6 text-slate-700">
        Categories are not offered for payment in this state. The owner must publish a matching campaign record and activate
        reservations only after the 24-unit physical preflight, routes, current supplier total, full economics, policies, and payment configuration are reviewed.
      </div>
    </section>
  );
}

function PreviewStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-amber-100 bg-white p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{detail}</div>
    </div>
  );
}

function PublishedCampaign({
  campaign,
  priceVisibility,
}: {
  campaign: PublicCampaign;
  priceVisibility: PublicPlanningPriceVisibility;
}) {
  const publicFundingGoalCents = priceVisibility.active.derivedFundingGoalCents;
  const fundingGoalKnown = priceVisibility.active.supported
    && isPublishedCount(publicFundingGoalCents)
    && publicFundingGoalCents > 0;
  const clearedFundingKnown = isPublishedCount(campaign.clearedFundingCents);
  const fundingPercent = fundingGoalKnown && clearedFundingKnown
    ? Math.min(100, Math.max(0, Math.round((campaign.clearedFundingCents / publicFundingGoalCents) * 100)))
    : 0;
  const routeEvidenceCurrent = hasCurrentRouteEvidence(campaign);
  const verifiedHouseholdsKnown = routeEvidenceCurrent && isPublishedCount(campaign.verifiedHouseholds);
  const targetHouseholdsKnown = isPublishedCount(campaign.targetHouseholds);
  const householdValue = verifiedHouseholdsKnown
    ? formatPublishedCount(campaign.verifiedHouseholds)
    : 'Not verified';
  const householdDetail = verifiedHouseholdsKnown
    ? campaign.householdCountBasis || 'Count basis not published'
    : campaign.routesConfirmed
      ? 'The dated route evidence must be rechecked before an exact count is shown'
    : targetHouseholdsKnown
      ? `Planning target: approximately ${campaign.targetHouseholds.toLocaleString()}; no mailed count recorded`
      : 'Planning target and mailed count have not been published';
  const fundingValueText = fundingGoalKnown && clearedFundingKnown
    ? `${formatCurrency(campaign.clearedFundingCents)} cleared, ${fundingPercent}% of ${priceVisibility.active.derivedFundingGoalLabel}`
    : `${formatPublishedCurrency(campaign.clearedFundingCents)} cleared; no usable funding goal published`;
  const canRecordInterest = ['pre_launch', 'accepting_reservations', 'partially_funded'].includes(campaign.status);
  const selectedAreas = routeEvidenceCurrent && Array.isArray(campaign.selectedAreas) ? campaign.selectedAreas : [];
  const categories = Array.isArray(campaign.categories) ? campaign.categories : [];
  const inclusions = Array.isArray(campaign.inclusions) ? campaign.inclusions : [];
  const campaignNotes = Array.isArray(campaign.campaignNotes) ? campaign.campaignNotes : [];
  const placement = campaign.placements?.standard;

  return (
    <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 p-6 text-white md:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-sm font-bold uppercase tracking-[0.18em] text-blue-300">Campaign {campaign.id}</div>
            <h2 className="mt-2 text-3xl font-black text-white">{campaign.title}</h2>
            <p className="mt-2 text-slate-300">{campaign.territory}</p>
          </div>
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-sm font-bold text-blue-100">
            {humanizeStatus(campaign.status)}
          </span>
        </div>
      </div>
      <div className="p-6 md:p-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <PreviewStat label="Territory" value={campaign.territory || 'Not published'} detail={selectedAreas.length > 0 ? `${selectedAreas.length} selected area${selectedAreas.length === 1 ? '' : 's'}` : 'Selected routes not published'} />
          <PreviewStat label="Plan" value={campaign.planId || 'Not published'} detail={campaign.offerModelVersion ? `Model version: ${campaign.offerModelVersion}` : 'Model version not published'} />
          <PreviewStat label="Households" value={householdValue} detail={householdDetail} />
          <PreviewStat label="Planned delivery" value={formatDeliveryWindow(campaign.plannedDeliveryStart, campaign.plannedDeliveryEnd)} detail="Schedule remains subject to the published campaign terms" />
          <PreviewStat label="Reservation deadline" value={formatReservationDeadline(campaign.reservationDeadline)} detail={campaign.reservationDeadline ? 'Pacific time' : 'No deadline commitment'} />
          <PreviewStat
            label="Cleared funding"
            value={formatPublishedCurrency(campaign.clearedFundingCents)}
            detail={fundingGoalKnown
              ? `${fundingPercent}% of ${priceVisibility.active.derivedFundingGoalLabel}`
              : priceVisibility.active.supported
                ? 'Funding goal not published'
                : 'Funding goal withheld — written quote required'}
          />
          <PreviewStat label="Paid slot-units" value={formatPublishedCount(campaign.currentPaidPlacementCount)} detail={isPublishedCount(campaign.minimumPaidPlacements) ? `Minimum ${campaign.minimumPaidPlacements}` : 'Minimum not published'} />
          <PreviewStat label="Paid advertisers" value={formatPublishedCount(campaign.currentAdvertiserCount)} detail="Businesses and paid units are counted separately" />
        </div>

        <div className="mt-6">
          <div
            className="h-3 overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="Cleared campaign funding"
            aria-valuemin={fundingGoalKnown && clearedFundingKnown ? 0 : undefined}
            aria-valuemax={fundingGoalKnown && clearedFundingKnown ? 100 : undefined}
            aria-valuenow={fundingGoalKnown && clearedFundingKnown ? fundingPercent : undefined}
            aria-valuetext={fundingValueText}
          >
            <div className="h-full rounded-full bg-blue-700" style={{ width: `${fundingPercent}%` }} />
          </div>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
            <span>Only cleared net payment is shown as funded.</span>
            <span>Pending or reserved, not funded: {formatPublishedCurrency(campaign.reservedFundingCents)}</span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="font-black">Selected delivery areas</h3>
          {selectedAreas.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {selectedAreas.map((area) => <li key={area}>{area}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">Current selected carrier routes or delivery areas have not been published.</p>
          )}
          <Link href="/mailing-areas" className="mt-3 inline-block text-sm font-bold text-blue-700 underline">Check current mailing-area evidence</Link>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h3 className="text-lg font-black">Placement inventory</h3>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4">
                <div>
                  <dt className="font-bold">Equal slot-units</dt>
                  <dd className="text-slate-500">
                    {placement
                      ? `${formatPublishedCount(placement.total)} total · ${formatPublishedCount(placement.available)} available · ${formatPublishedCount(placement.held)} held · ${formatPublishedCount(placement.sold)} sold`
                      : 'Standard inventory not published'}
                  </dd>
                </div>
                <div className="font-black">
                  {placement
                    ? priceVisibility.active.supported
                      ? `${priceVisibility.active.customerUnitPriceLabel} each`
                      : priceVisibility.active.customerUnitPriceLabel
                    : 'Not published'}
                </div>
              </div>
            </dl>
          </div>
          <div>
            <h3 className="text-lg font-black">Category state</h3>
            {categories.length > 0 ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {categories.map((category) => (
                  <div key={category.slug} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm">
                    <span className="font-medium">{category.name}</span>
                    <span className={category.status === 'available' ? 'font-bold text-emerald-700' : 'font-bold text-slate-500'}>
                      {humanizeStatus(category.status)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 rounded-xl border border-slate-200 p-4 text-sm text-slate-600">No category inventory has been published.</p>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 p-5">
          <h3 className="font-black">Campaign inclusions</h3>
          {inclusions.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
              {inclusions.map((inclusion) => <li key={inclusion}>{inclusion}</li>)}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-600">No campaign inclusions have been published.</p>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <h3 className="font-black">Funding and delivery notes</h3>
          <p className="mt-2 text-sm leading-6 text-slate-700">{campaign.refundSummary || 'A funding and refund summary has not been published.'}</p>
          {campaignNotes.length > 0 && (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
              {campaignNotes.map((note) => <li key={note}>{note}</li>)}
            </ul>
          )}
        </div>

        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
          A published catalog or campaign record does not prove that 24 equal ads fit a 9 × 12. The exact template, postal zones, current quote, routes, complete economics, approved proofs, and combined final artwork remain separate payment and print gates.
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {canRecordInterest ? (
            <Link href={`/reserve?campaign=${campaign.id}`} className="rounded-full bg-blue-700 px-5 py-3 font-bold text-white hover:bg-blue-800">
              {campaign.status === 'pre_launch' ? 'Record an interest request' : 'Check category and terms'}
            </Link>
          ) : (
            <p className="text-sm font-bold text-slate-600">Interest and reservation requests are not open in this campaign state.</p>
          )}
          <Link href="/funding-policy" className="rounded-full border border-slate-300 px-5 py-3 font-bold hover:border-slate-500">
            Read funding policy
          </Link>
        </div>
      </div>
    </article>
  );
}

export function CampaignBoard({
  priceVisibility,
}: {
  priceVisibility: PublicPlanningPriceVisibility;
}) {
  const [state, setState] = useState<LoadState>('loading');
  const [campaigns, setCampaigns] = useState<PublicCampaign[]>([]);
  const [error, setError] = useState<string | null>(null);
  const currentOfferCampaigns = campaigns.filter(isCurrentOfferCampaign);

  useEffect(() => {
    let current = true;
    getPublishedCampaigns().then((result) => {
      if (!current) return;
      setCampaigns(result.campaigns);
      setError(result.error);
      setState(result.error ? 'error' : result.campaigns.length > 0 ? 'published' : 'empty');
    });
    return () => {
      current = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <div
        className="rounded-3xl border border-slate-200 p-8 text-slate-600"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        Checking the published campaign record…
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-900" role="alert">
          {error}
        </div>
        <ConfigurationPreview priceVisibility={priceVisibility} dataUnavailable />
      </div>
    );
  }

  if (state === 'empty') return <ConfigurationPreview priceVisibility={priceVisibility} />;

  if (currentOfferCampaigns.length === 0) {
    return (
      <div className="space-y-5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950" role="status">
          <strong>Inactive model records were not displayed.</strong> Published campaign data exists, but none of it matches current plan{' '}
          <code>{FOUNDING_CAMPAIGN.planId}</code> and model version <code>{FOUNDING_CAMPAIGN.offerModelVersion}</code>.
          Legacy or mismatched inventory cannot be treated as the active offer.
        </div>
        <ConfigurationPreview priceVisibility={priceVisibility} />
      </div>
    );
  }

  return <div className="space-y-8">{currentOfferCampaigns.map((campaign) => <PublishedCampaign key={campaign.id} campaign={campaign} priceVisibility={priceVisibility} />)}</div>;
}
