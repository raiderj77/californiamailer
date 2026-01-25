'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const navItems = [
  { name: 'Dashboard', href: '/' },
  { name: 'Territories', href: '/territories' },
  { name: 'Prospects', href: '/prospects' },
  { name: 'Activities', href: '/activities' },
  { name: 'Campaigns', href: '/campaigns' },
  { name: 'Calendar', href: '/calendar' },
  { name: 'Tasks', href: '/tasks' },
  { name: 'Reminders', href: '/reminders' },
  { name: 'Invoices', href: '/invoices' },
  { name: 'Reports', href: '/reports' },
  { name: 'Templates', href: '/templates' },
  { name: 'Clients', href: '/clients' },
  { name: 'Team', href: '/team' },
  { name: 'Import', href: '/import' },
  { name: 'Pricing', href: '/pricing' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-20 left-4 z-50 bg-blue-600 text-white p-3 rounded-full shadow-lg"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed md:static inset-y-0 left-0 z-40
          w-52 bg-white border-r min-h-screen
          transform transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg text-blue-600">CAMailer</h2>
        </div>
        <nav className="p-2 overflow-y-auto max-h-[calc(100vh-60px)]">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm mb-1 ${
                pathname === item.href
                  ? 'bg-blue-50 text-blue-700 font-medium'
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
