import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const headers = await authHeadersFromCookies();

    const reqUrl = new URL(request.url);
    const className = reqUrl.searchParams.get('class_name');
    const target = className
        ? `${API_BASE_URL}/api/stats/student-count?class_name=${encodeURIComponent(className)}`
        : `${API_BASE_URL}/api/stats/student-count`;

    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`student-count:${scope}:${className || '__all__'}`, 15_000, async () => {
        const res = await fetch(target, { headers, cache: 'no-store' });
        const body = await res.text();
        return { status: res.status, body };
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
