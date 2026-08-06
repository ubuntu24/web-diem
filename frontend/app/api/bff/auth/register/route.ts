import { getApiBaseUrl, RegisterBodySchema, badRequest } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = RegisterBodySchema.safeParse(body);
    if (!parsed.success) {
        return badRequest('Invalid register payload', parsed.error.flatten());
    }

    const res = await fetch(`${getApiBaseUrl()}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
        cache: 'no-store',
    });

    const text = await res.text();
    return new Response(text, {
        status: res.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
