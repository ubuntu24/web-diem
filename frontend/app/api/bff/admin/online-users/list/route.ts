import { API_BASE_URL, authHeadersFromCookies, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    // No caching for online list to ensure real-time accuracy
    const result = await fetchUpstream(`${API_BASE_URL}/api/admin/online-users/list`, { 
        headers, 
        cache: 'no-store' 
    });

    return new Response(result.body, {
        status: result.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
