import type { NextConfig } from 'next';

const config: NextConfig = {
  output: 'standalone',
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }],
  },
};

export default config;