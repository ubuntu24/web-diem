import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, enforceRateLimit, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const limited = enforceRateLimit(request, 'search', 90, 60_000);
    if (limited) return limited;

    const headers = await authHeadersFromCookies();

    const url = new URL(request.url);
    const query = (url.searchParams.get('query') || '').trim();

    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`search:${scope}:${query.toLowerCase()}`, 12_000, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`, {
            headers,
            cache: 'no-store',
        });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
