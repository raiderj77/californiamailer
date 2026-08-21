'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Production Board', href: '/production-board' },
  { name: 'CRM', href: '/crm' },
  { name: 'Founding Launch', href: '/launch' },
  { name: 'Mailer Calculator', href: '/shared-mailer-calculator' },
  { name: 'Costs & Print Gate', href: '/economics' },
  { name: 'Materials & Proofs', href: '/proof-workflow' },
  { name: 'Tracking & Reports', href: '/tracking' },
  { name: 'Coupons', href: '/coupons' },
  { name: 'Interest Inbox', href: '/interest-inbox' },
  { name: 'Business portals', href: '/business-portals' },
  { name: 'Refund Review', href: '/refunds' },
  { name: 'Sales Desk', href: '/sales-desk' },
  { name: 'Prospects', href: '/prospects' },
  { name: 'Activities', href: '/activities' },
  { name: 'Import', href: '/import' },
  { name: 'Territories & routes', href: '/eddm' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const closeNavigation = useCallback((restoreTriggerFocus = true) => {
    setIsOpen(false);
    if (restoreTriggerFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeNavigation();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]:not([aria-disabled="true"]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.body.style.overflow = priorOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [closeNavigation, isOpen]);

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 768px)');
    const closeAtDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsOpen(false);
    };
    desktop.addEventListener('change', closeAtDesktop);
    return () => desktop.removeEventListener('change', closeAtDesktop);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-50 flex h-16 items-center gap-3 border-b bg-white px-4 md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => (isOpen ? closeNavigation() : setIsOpen(true))}
          aria-label={isOpen ? 'Close owner navigation' : 'Open owner navigation'}
          aria-expanded={isOpen}
          aria-controls="owner-navigation"
          className="rounded-lg bg-blue-700 p-2.5 text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          {isOpen ? (
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
        <span className="font-black text-slate-950">CM Owner</span>
      </div>

      {isOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-x-0 bottom-0 top-16 z-30 bg-black/50 md:hidden"
          onClick={() => closeNavigation()}
        />
      )}

      <aside
        id="owner-navigation"
        ref={drawerRef}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-labelledby="owner-navigation-title"
        className={`
          fixed bottom-0 left-0 top-16 z-40 w-64 border-r bg-white
          transform transition-[transform,visibility] duration-200 ease-in-out
          md:sticky md:top-0 md:h-screen md:w-52 md:min-h-screen
          ${isOpen ? 'visible translate-x-0' : 'invisible -translate-x-full md:visible md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between border-b p-4">
          <h2 id="owner-navigation-title" className="text-lg font-bold text-blue-600">CM Owner</h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => closeNavigation()}
            className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 md:hidden"
            aria-label="Close owner navigation"
          >
            <svg aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav aria-label="Owner navigation" className="max-h-[calc(100vh-64px)] overflow-y-auto p-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`mb-1 block rounded-lg px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                pathname === item.href
                  ? 'bg-blue-50 font-medium text-blue-700'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {item.name}
            </Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
