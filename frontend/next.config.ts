import type { NextConfig } from "next";

// 1. Define default constants
const DEFAULT_API = 'http://localhost:8000';

// 2. Logic to determine API Base URL
// Priority: API_URL env var -> Default
// Logic to determine API Base URL
const getApiBase = () => {
  const url = process.env.API_URL || DEFAULT_API;
  return url;
};

const apiBase = getApiBase();

// API config loaded silently

const nextConfig: NextConfig = {
  // Security Headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const cloudflareInsights = 'https://static.cloudflareinsights.com';
    const scriptSrc = isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${cloudflareInsights}`
      : `script-src 'self' 'unsafe-inline' ${cloudflareInsights}`;

    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com",
      "object-src 'none'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      scriptSrc,
      "connect-src 'self' ws: wss: https: http:",
      "form-action 'self'",
      "upgrade-insecure-requests"
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-site'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless'
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
        source: '/static/:path*',
        destination: `${apiBase}/static/:path*`, // Proxy static files
      },
      {
        source: '/_s/:path*',
        destination: `${apiBase}/ws/:path*`, // WebSocket Proxy
      },
      {
        source: '/v/:path*',
        destination: '/api/bff/:path*', // Global API Cloaking Path
      },
    ]
  },
};

export default nextConfig;
