import { cookies, headers } from 'next/headers';

export const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

type CacheItem = {
    expiresAt: number;
    status: number;
    body: string;
};

type Store = {
    rate: Map<string, number[]>;
    cache: Map<string, CacheItem>;
};

function getStore(): Store {
    const g = globalThis as unknown as { __bffStore?: Store };
    if (!g.__bffStore) {
        g.__bffStore = {
            rate: new Map<string, number[]>(),
            cache: new Map<string, CacheItem>(),
        };
    }
    return g.__bffStore;
}

export async function authHeadersFromCookies(extra?: HeadersInit): Promise<HeadersInit> {
    const token = (await cookies()).get('stoken')?.value;
    const merged: Record<string, string> = {};
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        for (const [k, v] of Object.entries(extra as Record<string, string>)) {
            if (typeof v === 'string') merged[k] = v;
        }
    }
    if (token) merged.Authorization = `Bearer ${token}`;
    return merged;
}

function clientIp(request: Request): string {
    const fwd = request.headers.get('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
    return request.headers.get('cf-connecting-ip') || 'unknown';
}

export function enforceRateLimit(request: Request, scope: string, limit: number, windowMs: number): Response | null {
    const store = getStore();
    const now = Date.now();
    const key = `${scope}:${clientIp(request)}`;
    const arr = store.rate.get(key) || [];
    const recent = arr.filter((t) => now - t < windowMs);

    if (recent.length >= limit) {
        const retryAfter = Math.max(1, Math.ceil((windowMs - (now - recent[0])) / 1000));
        return Response.json(
            { detail: 'Too many requests' },
            { status: 429, headers: { 'Retry-After': String(retryAfter) } }
        );
    }

    recent.push(now);
    store.rate.set(key, recent);
    return null;
}

export async function issueCsrfCookie(): Promise<string> {
    const token = crypto.randomUUID().replace(/-/g, '');
    const store = await cookies();
    store.set('csrf_token', token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
    });
    return token;
}

export async function requireCsrf(request: Request): Promise<Response | null> {
    const store = await cookies();
    const cookieToken = store.get('csrf_token')?.value;
    const headerToken = request.headers.get('x-csrf-token');

    if (!cookieToken || !headerToken || cookieToken !== headerToken) {
        return Response.json({ detail: 'Invalid CSRF token' }, { status: 403 });
    }
    return null;
}

export async function cacheScopeFromToken(): Promise<string> {
    const token = (await cookies()).get('stoken')?.value || 'anon';
    return token.slice(-16);
}

export function withTtlCache(
    key: string,
    ttlMs: number,
    producer: () => Promise<{ status: number; body: string }>
): Promise<{ status: number; body: string }> {
    const store = getStore();
    const now = Date.now();
    const hit = store.cache.get(key);
    if (hit && hit.expiresAt > now) {
        return Promise.resolve({ status: hit.status, body: hit.body });
    }

    return producer().then((result) => {
        store.cache.set(key, {
            status: result.status,
            body: result.body,
            expiresAt: now + ttlMs,
        });
        return result;
    });
}
