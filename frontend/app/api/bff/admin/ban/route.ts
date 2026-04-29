import { API_BASE_URL, authHeadersFromCookies, requireCsrf, AdminBanBodySchema, badRequest } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => null);
    const parsed = AdminBanBodySchema.safeParse(body);
    if (!parsed.success) {
        return badRequest('Invalid ban payload', parsed.error.flatten());
    }
    const headers = await authHeadersFromCookies({ 'Content-Type': 'application/json' });

    const res = await fetch(`${API_BASE_URL}/api/admin/ban`, {
        method: 'POST',
        headers,
        body: JSON.stringify(parsed.data),
        cache: 'no-store',
    });
    return new Response(await res.text(), {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
