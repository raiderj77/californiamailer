import { createHash } from 'node:crypto';
import type { Metadata } from 'next';
import Link from 'next/link';
import { PublicShell } from '@/components/public/PublicShell';
import {
  EMPTY_COUPON_DRAFT,
  couponDraftIsComplete,
  normalizeCouponDraft,
  publicCouponUnavailableReason,
  type CouponDraftContent,
} from '@/lib/couponRules';
import { getAdminFirestore } from '@/lib/firebaseAdmin';
import { normalizeCouponCode, safeTrackingDestination } from '@/lib/trackingRules';

export const metadata: Metadata = {
  title: 'Local coupon | CaliforniaMailer',
  description: 'A business-submitted coupon reviewed before publication by CaliforniaMailer.',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

interface PublicCoupon {
  couponCode: string;
  businessName: string;
  businessPath: string;
  content: CouponDraftContent;
}

async function readPublicCoupon(rawCode: string): Promise<PublicCoupon | null> {
  const couponCode = normalizeCouponCode(rawCode);
  if (couponCode.length < 3 || couponCode.length > 40) return null;
  const db = getAdminFirestore();
  const claimId = createHash('sha256').update(couponCode).digest('hex');
  const claimSnapshot = await db.collection('trackingcouponclaims').doc(claimId).get();
  const claim = claimSnapshot.data();
  const trackingId = String(claim?.trackingId || '');
  const reservationId = String(claim?.reservationId || '');
  if (
    !claimSnapshot.exists
    || !/^[A-Za-z0-9_-]{20,40}$/.test(trackingId)
    || !/^[A-Za-z0-9]{10,40}$/.test(reservationId)
  ) return null;

  const [couponSnapshot, trackingSnapshot, reservationSnapshot] = await Promise.all([
    db.collection('coupons').doc(trackingId).get(),
    db.collection('trackinglinks').doc(trackingId).get(),
    db.collection('reservations').doc(reservationId).get(),
  ]);
  const coupon = couponSnapshot.data();
  const tracking = trackingSnapshot.data();
  const reservation = reservationSnapshot.data();
  const content = coupon?.publishedContent
    ? normalizeCouponDraft(coupon.publishedContent as Partial<CouponDraftContent>)
    : normalizeCouponDraft(EMPTY_COUPON_DRAFT);
  const ownershipMatches = Boolean(
    couponSnapshot.exists
    && trackingSnapshot.exists
    && reservationSnapshot.exists
    && claim?.reservationId === reservationSnapshot.id
    && claim?.trackingId === trackingSnapshot.id
    && claim?.campaignId === reservation?.campaignId
    && tracking?.reservationId === reservationSnapshot.id
    && tracking?.campaignId === reservation?.campaignId
    && reservation?.trackingId === trackingSnapshot.id
    && coupon?.reservationId === reservationSnapshot.id
    && coupon?.trackingId === trackingSnapshot.id
    && coupon?.campaignId === reservation?.campaignId,
  );
  const codeMatches = [claim?.couponCode, tracking?.couponCode, coupon?.couponCode]
    .every((value) => normalizeCouponCode(String(value || '')) === couponCode);
  const unavailableReason = publicCouponUnavailableReason({
    publicationStatus: coupon?.publicationStatus,
    hasPublishedContent: couponDraftIsComplete(content),
    trackingActive: tracking?.active === true,
    reservationPaid: reservation?.status === 'paid',
    trackingOwnsReservation: ownershipMatches,
    couponCodeMatches: codeMatches,
  });
  if (unavailableReason) return null;

  const businessName = String(
    coupon?.businessName || tracking?.businessName || reservation?.businessName || '',
  ).trim().slice(0, 160);
  const hasSafeDestination = Boolean(
    safeTrackingDestination(String(tracking?.destinationUrl || '')),
  );
  if (!businessName || !hasSafeDestination) return null;
  return {
    couponCode,
    businessName,
    businessPath: `/go/${encodeURIComponent(trackingSnapshot.id)}`,
    content,
  };
}

export default async function CouponPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  let coupon: PublicCoupon | null = null;
  try {
    coupon = await readPublicCoupon(code);
  } catch {
    coupon = null;
  }

  if (!coupon) {
    return (
      <PublicShell>
        <section className="mx-auto max-w-3xl px-5 py-24 text-center">
          <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Local coupon</p>
          <h1 className="mt-4 text-4xl font-black text-slate-950">Coupon unavailable</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg leading-8 text-slate-600">
            This code is not currently tied to an owner-published coupon, an active tracking
            record, and a provider-verified paid reservation. No redemption is inferred.
          </p>
          <Link
            href="/local-deals"
            className="mt-8 inline-flex rounded-full bg-slate-950 px-6 py-3 font-black text-white"
          >
            View current public offers
          </Link>
        </section>
      </PublicShell>
    );
  }

  const expired = Boolean(
    coupon.content.expiresOn
    && coupon.content.expiresOn < new Date().toISOString().slice(0, 10),
  );
  return (
    <PublicShell>
      <main className="bg-gradient-to-b from-blue-50 via-white to-amber-50 px-5 py-16 sm:py-24">
        <article className="mx-auto max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-xl shadow-blue-950/10">
          <div className="bg-slate-950 px-6 py-5 text-center text-sm font-black uppercase tracking-[.22em] text-white">
            Business-submitted local offer
          </div>
          <div className="p-7 sm:p-12">
            <p className="text-sm font-black uppercase tracking-[.18em] text-blue-700">
              {coupon.businessName}
            </p>
            <h1 className="mt-4 text-4xl font-black leading-tight text-slate-950 sm:text-5xl">
              {coupon.content.headline}
            </h1>
            {coupon.content.body && (
              <p className="mt-5 whitespace-pre-wrap text-lg leading-8 text-slate-600">
                {coupon.content.body}
              </p>
            )}

            <section className="mt-8 rounded-3xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 sm:p-8">
              <p className="text-xs font-black uppercase tracking-[.2em] text-blue-700">Offer</p>
              <p className="mt-3 text-3xl font-black leading-tight text-slate-950">
                {coupon.content.offer}
              </p>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
                <span className="rounded-full bg-white px-4 py-2 font-black text-slate-900">
                  Code: {coupon.couponCode}
                </span>
                <span className={expired ? 'font-black text-rose-700' : 'font-bold text-slate-600'}>
                  {coupon.content.expiresOn
                    ? `${expired ? 'Expired' : 'Expires'} ${formatCouponDate(coupon.content.expiresOn)}`
                    : 'No expiration date stated'}
                </span>
              </div>
            </section>

            {coupon.content.backHeadline && (
              <h2 className="mt-8 text-2xl font-black text-slate-950">
                {coupon.content.backHeadline}
              </h2>
            )}
            {coupon.content.servicesList && (
              <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">
                {coupon.content.servicesList}
              </p>
            )}
            {coupon.content.backCoupon && (
              <p className="mt-5 rounded-2xl bg-amber-50 p-5 font-bold leading-7 text-amber-950">
                {coupon.content.backCoupon}
              </p>
            )}

            <h2 className="mt-8 text-sm font-black uppercase tracking-[.16em] text-slate-700">
              Terms supplied for this offer
            </h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">
              {coupon.content.terms}
            </p>

            <a
              href={coupon.businessPath}
              target="_blank"
              rel="noopener noreferrer nofollow sponsored"
              className="mt-8 inline-flex rounded-full bg-blue-700 px-6 py-3 font-black text-white hover:bg-blue-800"
            >
              {expired
                ? `Visit ${coupon.businessName} for current information`
                : coupon.content.callToAction}
            </a>

            <aside className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950">
              The business supplied this offer and its terms. CaliforniaMailer reviewed the page
              before publication but does not directly verify that a redemption was accepted or
              completed. Confirm eligibility, availability, and final terms with the business.
              This page has no redemption form and CaliforniaMailer does not record a redemption,
              lead, or sale when you open the business website. The business site has its own
              privacy practices.
            </aside>
          </div>
        </article>
      </main>
    </PublicShell>
  );
}

function formatCouponDate(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
