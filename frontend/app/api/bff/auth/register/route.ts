import { RegisterBodySchema, badRequest } from '@/app/api/bff/_utils';

const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = RegisterBodySchema.safeParse(body);
    if (!parsed.success) {
        return badRequest('Invalid register payload', parsed.error.flatten());
    }

    const res = await fetch(`${API_BASE_URL}/api/register`, {
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
