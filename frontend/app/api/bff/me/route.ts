import { cookies } from 'next/headers';
import { getApiBaseUrl, authHeadersFromCookies, cacheScopeFromToken, issueCsrfCookie, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    // Always refresh CSRF cookie so it stays in sync with HMAC-derived token.
    // (Old approach: only issue when missing → stale after hot-reload)
    await issueCsrfCookie();

    // Pass request so authHeadersFromCookies can forward the real client IP
    const headers = await authHeadersFromCookies(undefined, request);
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`me:${scope}`, 5_000, async () => {
        return fetchUpstream(`${getApiBaseUrl()}/api/me`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
