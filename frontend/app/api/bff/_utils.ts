import { cookies, headers } from 'next/headers';
import { z } from 'zod';

export const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
const PAYLOAD_KEY = process.env.PAYLOAD_OBFUSCATION_KEY || "PAYLOAD_OBFUSCATION_KEY_2026";
const BFF_CACHE_MAX_KEYS = Number(process.env.BFF_CACHE_MAX_KEYS || 1000);

export async function fetchUpstream(url: string, init?: RequestInit): Promise<{ status: number, body: string }> {
    const res = await fetch(url, init);
    const text = await res.text();
    return { status: res.status, body: text };
}

export function badRequest(error: string, details?: unknown): Response {
    return Response.json({ error, ...(details ? { details } : {}) }, { status: 400 });
}

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
    const g = globalThis as unknown as { __bffStoreV3?: Store };
    if (!g.__bffStoreV3) {
        g.__bffStoreV3 = {
            rate: new Map<string, number[]>(),
            cache: new Map<string, CacheItem>(),
        };
    }
    return g.__bffStoreV3;
}

export async function authHeadersFromCookies(extra?: HeadersInit, clientRequest?: Request): Promise<HeadersInit> {
    const token = (await cookies()).get('stoken')?.value;
    const merged: Record<string, string> = {};
    if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
        for (const [k, v] of Object.entries(extra as Record<string, string>)) {
            if (typeof v === 'string') merged[k] = v;
        }
    }
    if (token) merged.Authorization = `Bearer ${token}`;

    // Forward real client IP to backend (avoids Docker internal 172.x.x.x)
    // Extract using Next.js headers() utility for all server-side contexts
    try {
        const reqHeaders = await headers();
        const fwd = (clientRequest ? clientRequest.headers.get('x-forwarded-for') : null) || reqHeaders.get('x-forwarded-for');
        const realIp =
            (clientRequest ? clientRequest.headers.get('cf-connecting-ip') : null) ||
            reqHeaders.get('cf-connecting-ip') ||
            (fwd ? fwd.split(',')[0].trim() : null) ||
            (clientRequest ? clientRequest.headers.get('x-real-ip') : null) ||
            reqHeaders.get('x-real-ip');

        if (realIp) merged['X-Real-IP'] = realIp;
    } catch (e) {
        // Fallback for cases outside request context
    }

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
    for (const [k, v] of store.cache) {
        if (v.expiresAt <= now) {
            store.cache.delete(k);
        }
    }

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

        if (store.cache.size > BFF_CACHE_MAX_KEYS) {
            let oldestKey: string | null = null;
            let oldestExpiresAt = Number.POSITIVE_INFINITY;
            for (const [candidateKey, candidateValue] of store.cache) {
                if (candidateValue.expiresAt < oldestExpiresAt) {
                    oldestExpiresAt = candidateValue.expiresAt;
                    oldestKey = candidateKey;
                }
            }
            if (oldestKey) {
                store.cache.delete(oldestKey);
            }
        }

        return result;
    });
}

export const MaLopSchema = z.string().min(2).max(500).regex(/^[a-zA-Z0-9\s.\-_,]+$/, 'Invalid characters in class code');
export const MsvSchema = z.string().trim().superRefine((value, ctx) => {
    const isPlainMsv = /^[a-zA-Z0-9]{5,20}$/.test(value);
    const isObfuscatedMsv = /^T_[A-Za-z0-9_-]{20,512}$/.test(value);

    if (!isPlainMsv && !isObfuscatedMsv) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Invalid characters in MSV',
        });
    }
});

const sqlMetaPattern = /('|--|\/\*|\*\/|;|\bunion\b|\bselect\b|\bdrop\b|\binsert\b|\bupdate\b|\bdelete\b)/i;
export const SearchQuerySchema = z.string()
    .trim()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query is too long')
    .refine((value) => !sqlMetaPattern.test(value), 'Search query contains blocked patterns');

export const PositiveIntIdSchema = z.coerce.number().int().positive();

export const LoginBodySchema = z.object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
});

export const RegisterBodySchema = z.object({
    username: z.string().trim().min(1).max(64),
    password: z.string().min(1).max(128),
    email: z.string().email().max(254).optional(),
    phone: z.string().trim().max(20).optional(),
    age: z.coerce.number().int().min(18).max(120).optional(),
});

export const AdminBanBodySchema = z.object({
    user_id: z.coerce.number().int().positive().optional(),
    username: z.string().trim().min(1).max(64).optional(),
    reason: z.string().trim().max(200).optional(),
    expires_in_minutes: z.coerce.number().int().positive().max(60 * 24 * 365).optional(),
}).refine((value) => Boolean(value.user_id || value.username), {
    message: 'user_id or username is required',
});

export const ClassChangeLimitSchema = z.object({
    limit: z.coerce.number().int().min(0).max(1000),
});

export const ProfileUpdateSchema = z.object({
    full_name: z.string().min(2).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(10).max(15).optional(),
    address: z.string().max(200).optional(),
    bio: z.string().max(500).optional(),
}).strict();
