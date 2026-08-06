import { cookies } from 'next/headers';
import { getApiBaseUrl, authHeadersFromCookies, fetchUpstream, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const headers = await authHeadersFromCookies(undefined, request);
    const res = await fetchUpstream(`${getApiBaseUrl()}/api/user/class-change`, {
        method: 'POST',
        headers,
    });

    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
