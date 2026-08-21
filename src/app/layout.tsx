import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://californiamailer.com/#organization',
      name: 'CaliforniaMailer',
      url: 'https://californiamailer.com',
      email: 'hello@californiamailer.com',
      description: 'Owner-managed planning for a pre-funded Monterey Peninsula cooperative direct-mail campaign.',
    },
    {
      '@type': 'WebSite',
      '@id': 'https://californiamailer.com/#website',
      name: 'CaliforniaMailer',
      url: 'https://californiamailer.com',
      publisher: { '@id': 'https://californiamailer.com/#organization' },
    },
  ],
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://californiamailer.com'),
  title: {
    default: 'CaliforniaMailer',
    template: '%s',
  },
  description: 'Owner-managed, pre-funded shared-mailer planning for one Monterey Peninsula founding campaign.',
  manifest: "/manifest.json",
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://californiamailer-1998.firebaseapp.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://apis.google.com" />
        <meta name="theme-color" content="#2563eb" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteStructuredData).replace(/</g, '\\u003c') }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
       </body>
     </html>
  );
}
