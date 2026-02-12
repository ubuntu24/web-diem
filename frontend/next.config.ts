import type { NextConfig } from "next";

// 1. Define default constants
const DEFAULT_API = 'http://localhost:8000';

// 2. Logic to determine API Base URL
// Priority: API_URL env var -> Default
const getApiBase = () => {
  return process.env.API_URL || DEFAULT_API;
};

const apiBase = getApiBase();

console.log('--------------------------------------------------');
console.log(`[CONFIG] Frontend API Target: ${apiBase}`);
console.log('--------------------------------------------------');

const nextConfig: NextConfig = {
  // Security Headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()'
          }
        ],
      },
    ]
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`, // Proxy to Backend
      },
      {
        source: '/static/:path*',
        destination: `${apiBase}/static/:path*`, // Proxy static files
      },
    ]
  },
};

export default nextConfig;
