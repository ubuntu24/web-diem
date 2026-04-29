import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, MaLopSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const headers = await authHeadersFromCookies();

    const reqUrl = new URL(request.url);
    const className = reqUrl.searchParams.get('class_name');
    if (className) {
        const parsedClassName = MaLopSchema.safeParse(className);
        if (!parsedClassName.success) {
            return badRequest('Invalid class_name format', parsedClassName.error.flatten());
        }
    }
    const target = className
        ? `${API_BASE_URL}/api/stats/student-count?class_name=${encodeURIComponent(className)}`
        : `${API_BASE_URL}/api/stats/student-count`;

    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`student-count:${scope}:${className || '__all__'}`, 15_000, async () => {
        return fetchUpstream(target, { headers, cache: 'no-store' });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
