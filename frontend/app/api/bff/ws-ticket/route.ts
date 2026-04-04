import { cookies } from 'next/headers';
import { API_BASE_URL, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const token = (await cookies()).get('stoken')?.value;
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/ws-ticket`, {
        method: 'POST',
        headers,
        cache: 'no-store',
    });
    const body = await res.text();
    return new Response(body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
