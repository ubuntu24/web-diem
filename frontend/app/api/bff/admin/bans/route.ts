import { API_BASE_URL, authHeadersFromCookies } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const res = await fetch(`${API_BASE_URL}/api/admin/bans`, {
        headers,
        cache: 'no-store',
    });
    return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
