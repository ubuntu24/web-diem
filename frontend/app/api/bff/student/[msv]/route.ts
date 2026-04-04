import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache } from '@/app/api/bff/_utils';

export async function GET(_: Request, { params }: { params: Promise<{ msv: string }> }) {
    const headers = await authHeadersFromCookies();

    const { msv } = await params;
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`student:${scope}:${msv}`, 10_000, async () => {
        const res = await fetch(`${API_BASE_URL}/api/student/${encodeURIComponent(msv)}`, {
            headers,
            cache: 'no-store',
        });
        const body = await res.text();
        return { status: res.status, body };
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
