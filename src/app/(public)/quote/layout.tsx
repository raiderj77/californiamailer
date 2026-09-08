import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Request a Written Quote | CaliforniaMailer',
  description: 'Request a written direct-mail quote before making any payment.',
  alternates: { canonical: '/quote' },
};

export default function QuoteLayout({ children }: { children: React.ReactNode }) {
  return children;
}
