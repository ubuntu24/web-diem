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
  poweredByHeader: false, // Security: Remove X-Powered-By header
  // Security Headers
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const cloudflareInsights = 'https://static.cloudflareinsights.com';
    const scriptSrc = isDev
      ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${cloudflareInsights} https://cdn.jsdelivr.net`
      : `script-src 'self' 'unsafe-inline' ${cloudflareInsights} https://cdn.jsdelivr.net`;

    const csp = [
      "default-src 'self' https: http:",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "frame-src 'self' https: http:",
      "object-src 'none'",
      "img-src 'self' data: blob: https: http:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "style-src 'self' 'unsafe-inline' https: http:",
      scriptSrc,
      "connect-src 'self' ws: wss: https: http: blob:",
      "media-src 'self' blob: https: http:",
      "form-action 'self'"
    ].join('; ');

    return [
      {
        source: '/phim/:path*',
        headers: [
          {
            key: 'X-Robots-Tag',
            value: 'noindex, nofollow, noarchive'
          }
        ]
      },
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: csp
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
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
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
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
        source: '/v/profile',
        destination: '/api/bff/update-user-profile', // Specific route for profile to avoid 404
      },
      {
        source: '/v/:path*',
        destination: '/api/bff/:path*', // Global API Cloaking Path
      },
      {
        source: '/health',
        destination: `${apiBase}/api/health`, // Map public health to backend health
      },
    ]
  },
  output: 'standalone',
  // ⚡ OPTIMIZATION: Reduce memory usage during build (Fix OOM 137)
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
