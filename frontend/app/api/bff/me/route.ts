import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, issueCsrfCookie, withTtlCache } from '@/app/api/bff/_utils';

export async function GET() {
    const store = await cookies();
    if (!store.get('csrf_token')?.value) {
        await issueCsrfCookie();
    }

    const headers = await authHeadersFromCookies();
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`me:${scope}`, 5_000, async () => {
        const res = await fetch(`${API_BASE_URL}/api/me`, { headers, cache: 'no-store' });
        const body = await res.text();
        return { status: res.status, body };
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
