import { cookies } from 'next/headers';
import { API_BASE_URL, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const token = (await cookies()).get('stoken')?.value;
    const body = await request.json().catch(() => null);

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const { id } = await params;
    const res = await fetch(`${API_BASE_URL}/api/admin/user/${encodeURIComponent(id)}/class-change-limit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: body?.limit }),
        cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text || JSON.stringify({ success: res.ok }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
