import { NextRequest } from 'next/server';
import { API_BASE_URL, authHeadersFromCookies, fetchUpstream } from '@/app/api/bff/_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
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
    const headers = await authHeadersFromCookies();
    const body = await request.json();
    
    // Explicitly use fetch for POST and return the response body text
    const res = await fetch(`${API_BASE_URL}/api/admin/system/config`, {
        method: 'POST',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const bodyText = await res.text();
    return new Response(bodyText, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
