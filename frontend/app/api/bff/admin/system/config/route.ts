import { NextRequest } from 'next/server';
import { API_BASE_URL, authHeadersFromCookies, fetchUpstream, requireCsrf } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const headers = await authHeadersFromCookies(undefined, request);
    const res = await fetchUpstream(`${API_BASE_URL}/api/admin/system/config`, { 
        headers, 
        cache: 'no-store' 
    });

    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

export async function POST(request: NextRequest) {
    const csrfErr = await requireCsrf(request);
    if (csrfErr) return csrfErr;

    const headers = await authHeadersFromCookies(undefined, request);
    const body = await request.json();
    
    const res = await fetchUpstream(`${API_BASE_URL}/api/admin/system/config`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        cache: 'no-store',
    });

    return new Response(res.body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}

