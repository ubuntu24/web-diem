import { cookies } from 'next/headers';
import { API_BASE_URL, PositiveIntIdSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const token = (await cookies()).get('stoken')?.value;
    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const { id } = await params;
    const parsedId = PositiveIntIdSchema.safeParse(id);
    if (!parsedId.success) {
        return badRequest('Invalid user id', parsedId.error.flatten());
    }
    const res = await fetch(`${API_BASE_URL}/api/admin/user/${parsedId.data}/details`, {
        method: 'GET',
        headers,
        cache: 'no-store',
    });
    const body = await res.text();
    return new Response(body, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
