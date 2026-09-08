/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      ],
    }];
  },
  async redirects() {
    return [{
      source: '/blog/best-direct-mail-monterey-county',
      destination: '/services',
      permanent: true,
    }];
  },
  reactStrictMode: true,
  
  // Optimize CSS
  experimental: {
    optimizeCss: true,
  },
  
  // Improve JavaScript output
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;
