import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache } from '@/app/api/bff/_utils';

export async function GET(_: Request, { params }: { params: Promise<{ ma_lop: string }> }) {
    const headers = await authHeadersFromCookies();

    const { ma_lop } = await params;
    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`class-students:${scope}:${ma_lop}`, 10_000, async () => {
        const res = await fetch(`${API_BASE_URL}/api/class/${encodeURIComponent(ma_lop)}/students`, {
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
