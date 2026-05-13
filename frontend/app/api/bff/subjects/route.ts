import { authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, API_BASE_URL } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const scope = await cacheScopeFromToken();
    // Neutralized route: used for performance analysis
    const cached = await withTtlCache(`performance-subjects:${scope}`, 60_000, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/subjects`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
