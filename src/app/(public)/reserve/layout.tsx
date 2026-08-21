import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Founding Placement Review | CaliforniaMailer',
  description: 'Check a proposed category and record interest in the Monterey Peninsula founding mailer without creating a payment or sold placement.',
  alternates: { canonical: 'https://californiamailer.com/reserve' },
};

export default function ReserveLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
