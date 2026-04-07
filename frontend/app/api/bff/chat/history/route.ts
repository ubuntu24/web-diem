import { API_BASE_URL, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET() {
    const res = await fetchUpstream(`${API_BASE_URL}/api/chat/history`, {
        cache: 'no-store',
    });
    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
