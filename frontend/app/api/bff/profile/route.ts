import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const scope = await cacheScopeFromToken();

    const cached = await withTtlCache(`profile:${scope}`, 10_000, async () => {
        const profileRes = await fetch(`${API_BASE_URL}/api/me-profile`, { headers, cache: 'no-store' });
        if (profileRes.ok) {
            const body = await profileRes.text();
            return { status: profileRes.status, body };
        }

        const meRes = await fetch(`${API_BASE_URL}/api/me`, { headers, cache: 'no-store' });
        const body = await meRes.text();
        return { status: meRes.status, body };
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
