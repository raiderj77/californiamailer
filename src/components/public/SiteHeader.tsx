'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const navigationLinks = [
  { href: '/how-it-works', label: 'How it works' },
  { href: '/advertisers', label: 'For advertisers' },
  { href: '/mailing-areas', label: 'Mailing areas' },
  { href: '/pricing', label: 'Pricing & formats' },
  { href: '/sample-card', label: 'Samples' },
  { href: '/founding-mailer', label: 'Founding mailer' },
  { href: '/faq', label: 'FAQ' },
];

function isCurrentLink(pathname: string, href: string) {
  return pathname === href || (href === '/mailing-areas' && pathname.startsWith('/territory/'));
}

export function SiteHeader() {
  const pathname = usePathname();
  const [openPathname, setOpenPathname] = useState<string | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = openPathname === pathname;

  useEffect(() => {
    if (!mobileOpen) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenPathname(null);
        menuButtonRef.current?.focus();
      }
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [mobileOpen]);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
        <Link href="/home" onClick={() => setOpenPathname(null)} className="text-xl font-black tracking-tight text-slate-950">
          California<span className="text-blue-700">Mailer</span>
        </Link>
        <nav aria-label="Main navigation" className="hidden items-center gap-4 text-sm font-medium text-slate-700 lg:flex">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrentLink(pathname, link.href) ? 'page' : undefined}
              className="hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/reserve"
          className="hidden rounded-full bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800 lg:inline-flex"
        >
          Review availability
        </Link>
        <button
          ref={menuButtonRef}
          type="button"
          aria-expanded={mobileOpen}
          aria-controls="mobile-site-navigation"
          aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
          onClick={() => setOpenPathname(mobileOpen ? null : pathname)}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 lg:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {mobileOpen ? (
              <path d="M6 6l12 12M18 6 6 18" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" />
            )}
          </svg>
        </button>
      </div>
      <nav
        id="mobile-site-navigation"
        aria-label="Mobile navigation"
        hidden={!mobileOpen}
        className="border-t border-slate-200 px-5 pb-5 pt-3 lg:hidden"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-1 text-base font-medium text-slate-800">
          {navigationLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isCurrentLink(pathname, link.href) ? 'page' : undefined}
              onClick={() => setOpenPathname(null)}
              className="rounded-lg px-3 py-3 hover:bg-slate-50 hover:text-blue-700"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href="/reserve"
            aria-current={pathname === '/reserve' ? 'page' : undefined}
            onClick={() => setOpenPathname(null)}
            className="mt-2 rounded-full bg-blue-700 px-4 py-3 text-center font-bold text-white hover:bg-blue-800"
          >
            Review availability
          </Link>
        </div>
      </nav>
    </header>
  );
}
