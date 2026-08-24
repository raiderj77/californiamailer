import type { Metadata } from "next";
import "./globals.css";

const siteStructuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': 'https://californiamailer.com/#organization',
      name: 'CaliforniaMailer',
      url: 'https://californiamailer.com',
      description: 'Owner-managed California planning for shared mailers, single-business postcards, and documented partner-distributed advertising.',
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

export const metadata: Metadata = {
  metadataBase: new URL('https://californiamailer.com'),
  title: {
    default: 'CaliforniaMailer',
    template: '%s',
  },
  description: 'Owner-managed California planning for shared mailers, single-business postcards, and documented partner-distributed advertising.',
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
      <body>
        {children}
       </body>
     </html>
  );
}
