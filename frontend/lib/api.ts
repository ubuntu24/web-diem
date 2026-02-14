import { Student } from './types';

// Detect if we are running on the server or in the browser
const IS_SERVER = typeof window === 'undefined';
// Server-side: use API_URL env (Docker: http://backend:8000) or fallback to localhost
// Browser-side: should not happen (all calls go through Server Actions)
const API_BASE_URL = IS_SERVER ? (process.env.API_URL || 'http://127.0.0.1:8000') : '';

// Helper: get token safely (never access localStorage on server)
function getToken(tokenOverride?: string): string | null {
    if (tokenOverride) return tokenOverride;
    if (IS_SERVER) return null;
    try { return localStorage.getItem('token'); } catch { return null; }
}

// Helper: build auth headers
function authHeaders(tokenOverride?: string): HeadersInit {
    const token = getToken(tokenOverride);
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Fixed Key for "Black Box" decryption
const PAYLOAD_KEY = "PAYLOAD_OBFUSCATION_KEY_2026";

function decryptPayload(cipher: string): any {
    try {
        // Base64 Decode (Base64 URL)
        let b64 = cipher.replace(/-/g, '+').replace(/_/g, '/');
        while (b64.length % 4) b64 += '=';

        const binaryString = atob(b64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // XOR Decrypt
        const keyBytes = new TextEncoder().encode(PAYLOAD_KEY);
        const decryptedBytes = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i++) {
            decryptedBytes[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
        }

        const jsonStr = new TextDecoder().decode(decryptedBytes);
        return JSON.parse(jsonStr);
    } catch (e) {
        // Fallback or log if it wasn't encrypted
        try { return JSON.parse(cipher); } catch { return null; }
    }
}

async function parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();
    console.log(`[API] Raw response (first 50 chars): ${text.substring(0, 50)}...`);

    // If it's a simple JSON object/array (errors or legacy), return it
    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            console.log(`[API] Parsed as raw JSON:`, parsed);
            return parsed;
        } catch (e) {
            console.error(`[API] Failed to parse JSON text that started with { or [`);
        }
    }

    // FastAPI JSON-serializes strings with quotes: "base64..." → strip them first
    let payload = text;
    if (text.startsWith('"')) {
        try { payload = JSON.parse(text); } catch { /* keep original */ }
    }

    // Attempt decryption on the unquoted payload
    console.log(`[API] Attempting decryption...`);
    const decrypted = decryptPayload(payload);
    if (decrypted) {
        console.log(`[API] Successfully decrypted payload.`);
        return decrypted;
    }

    console.error(`[API] Decryption failed or returned null.`);
    // Last resort fallback
    try { return JSON.parse(text); } catch { return text as any; }
}

export async function getClasses(tokenOverride?: string): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}/api/classes`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data: any = await parseResponse(res);
    return data?.classes || [];
}

export async function getStudentsByClass(maLop: string, tokenOverride?: string): Promise<Student[]> {
    const url = `${API_BASE_URL}/api/class/${encodeURIComponent(maLop)}/students`;
    console.log(`[API] Fetching students: ${url}`);
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) {
        console.error(`[API] Students fetch failed: ${res.status}`);
        throw new Error('Failed to fetch students');
    }
    const data: any = await parseResponse(res);
    return data?.students || [];
}

export async function getStudent(msv: string, tokenOverride?: string): Promise<Student> {
    const url = `${API_BASE_URL}/api/student/${encodeURIComponent(msv)}`;
    console.log(`[API] Fetching student detail: ${url}`);
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[getStudent] Failed: ${res.status} ${text}`);
        throw new Error('Failed to fetch student');
    }
    return parseResponse(res);
}

export async function searchStudents(query: string, tokenOverride?: string): Promise<Student[]> {
    const url = `${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`;
    console.log(`[API] Searching students: ${url}`);
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to search students');
    const data: any = await parseResponse(res);
    return data?.results || [];
}

export interface User {
    id?: number;
    username?: string;
    role?: number;
    created_at?: string;
    reset_limit_at?: string | null;
}

export async function getMe(tokenOverride?: string): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch user info');
    const data: any = await parseResponse(res);
    // Backend returns short field names: u=username, r=role, rl=reset_limit_at, ca=created_at
    return {
        username: data.u ?? data.username,
        role: data.r ?? data.role,
        reset_limit_at: data.rl ?? data.reset_limit_at,
        created_at: data.ca ?? data.created_at,
    };
}

export async function getStudentCount(className?: string, tokenOverride?: string): Promise<number> {
    const url = className
        ? `${API_BASE_URL}/api/stats/student-count?class_name=${encodeURIComponent(className)}`
        : `${API_BASE_URL}/api/stats/student-count`;

    console.log(`[API] Student count: ${url}`);
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch student count');
    const data: any = await parseResponse(res);
    return data.count || 0;
}

export async function getOnlineUsers(tokenOverride?: string): Promise<number> {
    const res = await fetch(`${API_BASE_URL}/api/stats/online-users`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch online users');
    const data: any = await parseResponse(res);
    return data.count;
}

export interface AccessHistory {
    date: string;
    count: number;
}

export interface AdminUser {
    id: number;
    username: string;
    role: number;
    access_history?: AccessHistory[];
    reset_limit_at?: string | null;
}

export async function resetUserLimit(userId: number, tokenOverride?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/user/${userId}/reset-limit`, {
        method: 'POST',
        headers: authHeaders(tokenOverride)
    });
    if (!res.ok) throw new Error('Failed to reset user limit');
}

export async function getUsers(tokenOverride?: string): Promise<AdminUser[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export interface LoginResponse {
    access_token: string;
    role?: number;
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Tên đăng nhập hoặc mật khẩu không đúng');
    return res.json();
}

export async function registerUser(username: string, password: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Đăng ký thất bại');
    }
}

