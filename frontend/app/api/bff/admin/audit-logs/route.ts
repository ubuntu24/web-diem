import { NextRequest } from 'next/server';
import { API_BASE_URL, authHeadersFromCookies, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET(request: NextRequest) {
    const headers = await authHeadersFromCookies();
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') || '50';
    
    const res = await fetchUpstream(`${API_BASE_URL}/api/admin/audit-logs?limit=${limit}`, { 
        headers, 
        cache: 'no-store' 
    });

    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
