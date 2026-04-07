import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`admin-users:${scope}`, 5_000, async () => {
        return fetchUpstream(`${API_BASE_URL}/api/admin/users`, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
