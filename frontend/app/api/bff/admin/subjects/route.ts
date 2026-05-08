import { authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, API_BASE_URL } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`admin-subjects:${scope}`, 60_000, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/admin/subjects`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
