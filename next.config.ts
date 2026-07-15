import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/blog/best-direct-mail-monterey-county',
        destination: '/services',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
