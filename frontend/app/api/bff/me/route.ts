import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, issueCsrfCookie, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const store = await cookies();
    if (!store.get('csrf_token')?.value) {
        await issueCsrfCookie();
    }

    // Pass request so authHeadersFromCookies can forward the real client IP
    const headers = await authHeadersFromCookies(undefined, request);
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`me:${scope}`, 5_000, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/me`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
