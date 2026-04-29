import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Protect /phim/* routes
  if (request.nextUrl.pathname.startsWith('/phim')) {
    const token = request.cookies.get('stoken')?.value;
    
    // If no session token is found, redirect to login page
    if (!token) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Otherwise, allow the request to proceed
    return NextResponse.next();
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
