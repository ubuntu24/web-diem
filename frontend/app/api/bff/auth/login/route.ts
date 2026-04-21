import { cookies } from 'next/headers';
import { API_BASE_URL, enforceRateLimit, issueCsrfCookie } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const limited = enforceRateLimit(request, 'login', 12, 60_000);
    if (limited) return limited;

    const body = await request.json().catch(() => null);
    if (!body?.username || !body?.password) {
        return Response.json({ detail: 'Missing username or password' }, { status: 400 });
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: body.username, password: body.password }),
            cache: 'no-store',
        });

        const text = await res.text();
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
                httpOnly: false,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 7,
            });
            const csrf = await issueCsrfCookie();
            data.csrf_token = csrf;
        }

        return Response.json(data);
    } catch (error: any) {
        console.error('[BFF Login Fatal Error]:', error);
        return Response.json({ 
            detail: 'BFF could not reach Backend',
            error: error.message,
            tip: 'Check if BACKEND container is running and API_URL is correct.'
        }, { status: 500 });
    }
}
