import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// For `/phim/*` we want to enforce login, but we must not blindly use a fallback secret
// because that can make `jwtVerify` fail and redirect logged-in users to `/login`.
const SECRET_KEY = process.env.SECRET_KEY;
const secret = SECRET_KEY ? new TextEncoder().encode(SECRET_KEY) : null;

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

  // 2. Protect /phim/* routes: require login (cookie `stoken`).
  // Verification is best-effort: only verify signature if Next has `SECRET_KEY`.
  if (request.nextUrl.pathname.startsWith('/phim')) {
    const token = request.cookies.get('stoken')?.value;
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // If we don't have the signing secret configured in this runtime,
    // we can't verify safely; but we still require that the cookie exists.
    if (secret) {
      try {
        await jwtVerify(token, secret);
      } catch (err) {
        console.warn('Middleware JWT verification failed for /phim:', err);
        const response = NextResponse.redirect(new URL('/login', request.url));
        response.cookies.delete('stoken');
        return response;
      }
    }

    return NextResponse.next();
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
