import { API_BASE_URL, fetchUpstream, authHeadersFromCookies } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const res = await fetchUpstream(`${API_BASE_URL}/api/chat/history`, {
        headers,
        cache: 'no-store',
    });
    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
