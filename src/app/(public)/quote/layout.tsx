import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Advertiser Inquiry | CaliforniaMailer',
  description: 'Ask the owner a written question about the proposed Monterey Peninsula cooperative mailer.',
  alternates: { canonical: 'https://californiamailer.com/quote' },
};

export default function QuoteLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
