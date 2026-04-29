import { cookies } from 'next/headers';
import { API_BASE_URL, requireCsrf, ClassChangeLimitSchema, PositiveIntIdSchema, badRequest } from '@/app/api/bff/_utils';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const token = (await cookies()).get('stoken')?.value;
    const body = await request.json().catch(() => null);
    const parsedBody = ClassChangeLimitSchema.safeParse(body);
    if (!parsedBody.success) {
        return badRequest('Invalid class change payload', parsedBody.error.flatten());
    }

    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const { id } = await params;
    const parsedId = PositiveIntIdSchema.safeParse(id);
    if (!parsedId.success) {
        return badRequest('Invalid user id', parsedId.error.flatten());
    }

    const res = await fetch(`${API_BASE_URL}/api/admin/user/${parsedId.data}/class-change-limit`, {
        method: 'POST',
        headers,
        body: JSON.stringify(parsedBody.data),
        cache: 'no-store',
    });
    const text = await res.text();
    return new Response(text || JSON.stringify({ success: res.ok }), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
