import { API_BASE_URL, authHeadersFromCookies, requireCsrf, PositiveIntIdSchema, badRequest } from '@/app/api/bff/_utils';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const { id } = await params;
    const parsedId = PositiveIntIdSchema.safeParse(id);
    if (!parsedId.success) {
        return badRequest('Invalid user id', parsedId.error.flatten());
    }
    const headers = await authHeadersFromCookies();

    const res = await fetch(`${API_BASE_URL}/api/admin/ban/${parsedId.data}`, {
        method: 'DELETE',
        headers,
        cache: 'no-store',
    });
    return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
