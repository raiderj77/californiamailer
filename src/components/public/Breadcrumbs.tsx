'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const labels: Record<string, string> = {
  about: 'About',
  advertisers: 'For advertisers',
  'advertiser-content-standards': 'Content standards',
  'business-login': 'Business portal',
  contact: 'Contact',
  'coop-board': 'Current mailers',
  coupon: 'Local coupons',
  faq: 'FAQ',
  'founding-mailer': 'Founding mailer',
  'funding-policy': 'Funding and refunds',
  'how-it-works': 'How it works',
  'local-deals': 'Local deals email',
  'mailing-areas': 'Mailing areas',
  pricing: 'Pricing',
  privacy: 'Privacy',
  quote: 'Advertiser inquiry',
  reserve: 'Placement review',
  'sample-card': 'Concept sample',
  terms: 'Terms',
  territory: 'Mailing areas',
  'monterey-peninsula': 'Monterey Peninsula',
  access: 'One-time access',
};

export function Breadcrumbs() {
  const pathname = usePathname();
  if (pathname === '/home' || pathname.startsWith('/reservation/') || pathname.endsWith('/unsubscribe')) return null;
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  return <nav aria-label="Breadcrumbs" className="border-b border-slate-100 bg-white">
    <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-3 text-sm text-slate-600">
      <li><Link href="/home" className="font-medium hover:text-blue-700">Home</Link></li>
      {segments.map((segment, index) => {
        const href = segment === 'territory' && index === 0
          ? '/mailing-areas'
          : segment === 'coupon' && index === 0
            ? '/local-deals'
            : `/${segments.slice(0, index + 1).join('/')}`;
        const current = index === segments.length - 1;
        return <li key={href} className="flex items-center gap-2"><span aria-hidden="true" className="text-slate-400">/</span>{current ? <span aria-current="page" className="font-bold text-slate-900">{labels[segment] || segment.replaceAll('-', ' ')}</span> : <Link href={href} className="font-medium hover:text-blue-700">{labels[segment] || segment.replaceAll('-', ' ')}</Link>}</li>;
      })}
    </ol>
  </nav>;
}
