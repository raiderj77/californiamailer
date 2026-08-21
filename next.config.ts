import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: '/blog/best-direct-mail-monterey-county',
        destination: '/services',
        permanent: true,
      },
      {
        source: '/areas/monterey-peninsula',
        destination: '/territory/monterey-peninsula',
        permanent: true,
      },
      {
        source: '/areas/:path*',
        destination: '/mailing-areas',
        permanent: true,
      },
      { source: '/campaigns', destination: '/launch', permanent: false },
      { source: '/coopspots', destination: '/launch', permanent: false },
      { source: '/reports', destination: '/economics', permanent: false },
      { source: '/invoices', destination: '/economics', permanent: false },
      { source: '/clients', destination: '/prospects', permanent: false },
      { source: '/portal', destination: '/launch', permanent: false },
      { source: '/proofs', destination: '/launch', permanent: false },
      { source: '/offers', destination: '/launch', permanent: false },
      { source: '/territories', destination: '/eddm', permanent: false },
      { source: '/team', destination: '/dashboard', permanent: false },
      { source: '/tasks', destination: '/dashboard', permanent: false },
      { source: '/reminders', destination: '/prospects', permanent: false },
      { source: '/calendar', destination: '/dashboard', permanent: false },
      { source: '/templates', destination: '/sales-desk', permanent: false },
    ];
  },
};

export default nextConfig;
