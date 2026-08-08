import { cookies } from 'next/headers';
import { getApiBaseUrl, enforceRateLimit, issueCsrfCookie, LoginBodySchema, badRequest } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const limited = enforceRateLimit(request, 'login', 12, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    const parsed = LoginBodySchema.safeParse(body);
    if (!parsed.success) {
        return badRequest('Invalid login payload', parsed.error.flatten());
    }

    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        let res: Response;
        let text: string;
        try {
            res = await fetch(`${getApiBaseUrl()}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed.data),
                cache: 'no-store',
                signal: controller.signal,
            });
            text = await res.text();
        } finally {
            clearTimeout(timer);
        }
        if (!res.ok) {
            console.error('[BFF Login Error] Backend returned:', text);
            return new Response(text || 'Backend Internal Error', {
                status: res.status,
                headers: { 'Content-Type': 'application/json; charset=utf-8' },
            });
        }

        const data = JSON.parse(text);
        const token = data?.access_token;
        const role = data?.role ?? 0;

        if (token) {
            const store = await cookies();
            store.set('stoken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
            });
            store.set('role', String(role), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
            });
            await issueCsrfCookie();
        }

        return Response.json({
            access_token: token,
            token_type: data?.token_type ?? 'bearer',
            role: data?.role ?? 0,
            class_change_limit: data?.class_change_limit ?? 0,
        });
    } catch (error: any) {
        console.error('[BFF Login Fatal Error]:', error);
        return Response.json({
            detail: 'BFF could not reach Backend',
            error: error.message,
            tip: 'Check if BACKEND container is running and API_URL is correct.'
        }, { status: 500 });
    }
}
