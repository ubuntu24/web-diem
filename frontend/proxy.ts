import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';


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

const PUBLIC_PATHS = ['/login', '/register', '/api/bff/auth', '/v/auth', '/v/system/announcement'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Restrict HTTP methods early for all routes (including /api)
  const allowedMethods = resolveAllowedMethods(pathname);
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

  // 2. Allow public paths without authentication
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path));
  if (isPublicPath) {
    return NextResponse.next();
  }

  // 3. Protect all other routes: require login (cookie `stoken`).
  const token = request.cookies.get('stoken')?.value;
  if (!token) {
    // If it's an API request, return 401 instead of redirecting to login page
    if (pathname.startsWith('/api/') || pathname.startsWith('/v/')) {
      return new NextResponse(JSON.stringify({ error: 'Authentication required' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Verification is best-effort: only verify signature if Next has `SECRET_KEY`.
  if (secret) {
    try {
      await jwtVerify(token, secret);
    } catch (err) {
      console.warn('Middleware JWT verification failed:', err);
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

export default proxy;
