import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Fallback matches backend's local fallback if env not set
const SECRET_KEY = process.env.SECRET_KEY || "dev-secret-key-replace-this-immediately";
// encode the secret for jose
const secret = new TextEncoder().encode(SECRET_KEY);

export async function middleware(request: NextRequest) {
  // Protect /phim/* routes
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
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
