import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Fallback matches backend's local fallback if env not set
const SECRET_KEY = process.env.SECRET_KEY || "dev-secret-key-replace-this-immediately";
// encode the secret for jose
const secret = new TextEncoder().encode(SECRET_KEY);

const DEFAULT_ALLOWED_METHODS = ['GET', 'POST', 'HEAD', 'OPTIONS'] as const;
const ROUTE_METHOD_OVERRIDES: Array<{ prefix: string; methods: readonly string[] }> = [
  { prefix: '/api/bff/update-user-profile', methods: ['GET', 'PATCH', 'HEAD', 'OPTIONS'] },
  { prefix: '/api/bff/admin/ban/', methods: ['DELETE', 'HEAD', 'OPTIONS'] },
  { prefix: '/api/bff/admin', methods: ['GET', 'POST', 'DELETE', 'HEAD', 'OPTIONS'] },
];

export function resolveAllowedMethods(pathname: string): readonly string[] {
  const override = ROUTE_METHOD_OVERRIDES.find((rule) => pathname.startsWith(rule.prefix));
  return override?.methods || DEFAULT_ALLOWED_METHODS;
}

export async function middleware(request: NextRequest) {
  // 1. Restrict HTTP methods early for all routes (including /api)
  const allowedMethods = resolveAllowedMethods(request.nextUrl.pathname);
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        Allow: allowedMethods.join(', '),
      },
    });
  }

  if (!allowedMethods.includes(request.method)) {
    return new NextResponse(null, {
      status: 405,
      statusText: 'Method Not Allowed',
      headers: {
        Allow: allowedMethods.join(', '),
      },
    });
  }

  // 2. Protect /phim/* routes
  if (request.nextUrl.pathname.startsWith('/phim')) {
    const token = request.cookies.get('stoken')?.value;

    // If no session token is found, redirect to login page
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Cryptographically verify the token
    try {
      await jwtVerify(token, secret);
      // Signature is valid, allow request
      return NextResponse.next();
    } catch (err) {
      // Token is fake, expired, or invalid
      console.warn("Middleware JWT Verification failed:", err);
      // Optionally delete the fake cookie
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('stoken');
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
