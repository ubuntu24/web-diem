import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const headers = await authHeadersFromCookies(undefined, request);
    const scope = await cacheScopeFromToken();
    const isDev = process.env.NODE_ENV !== 'production';
    const ttl = isDev ? 0 : 120_000;
    const cached = await withTtlCache(`classes:${scope}`, ttl, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/classes`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
