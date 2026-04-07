import { Student } from './types';

// Detect if we are running on the server or in the browser
const IS_SERVER = typeof window === 'undefined';
// Server-side: use API_URL env (Docker: http://backend:8000) or fallback to localhost
// Browser-side: should not happen (all calls go through Server Actions)
const API_BASE_URL = IS_SERVER
    ? (process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000')
    : '';

// Helper: get token safely (never access localStorage on server)
function getToken(tokenOverride?: string): string | null {
    if (tokenOverride) return tokenOverride;
    return null;
}

// Helper: build auth headers
function authHeaders(tokenOverride?: string): HeadersInit {
    const token = getToken(tokenOverride);
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
}

// Fixed Key for "Black Box" decryption

/**
 * Fetches a URL and returns the raw encrypted payload string (NOT decrypted).
 * Used by Server Actions so the encrypted blob is passed to the browser,
 * which decrypts it locally — plaintext never appears in F12 Network tab.
 */
async function fetchRawEncrypted(url: string, headers: HeadersInit): Promise<string | null> {
    try {
        const res = await fetch(url, { headers });
        if (!res.ok) return null;
        const text = await res.text();
        // FastAPI JSON-wraps strings: "base64..." → strip outer quotes
        if (text.startsWith('"')) {
            try { return JSON.parse(text); } catch { /* keep original */ }
        }
        return text;
    } catch {
        return null;
    }
}

async function fetchBffRaw(url: string): Promise<string | null> {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return null;
        const text = await res.text();
        if (text.startsWith('"')) {
            try { return JSON.parse(text); } catch { }
        }
        return text;
    } catch {
        return null;
    }
}

async function fetchBff(url: string): Promise<any> {
    try {
        const res = await fetch(url, { credentials: 'include' });
        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

function getCookieValue(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${name}=`));
    if (!raw) return null;
    return decodeURIComponent(raw.split('=').slice(1).join('='));
}

function withCsrf(headers?: HeadersInit): HeadersInit {
    const token = getCookieValue('csrf_token');
    const out: Record<string, string> = {};
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
        for (const [k, v] of Object.entries(headers as Record<string, string>)) {
            if (typeof v === 'string') out[k] = v;
        }
    }
    if (token) out['X-CSRF-Token'] = token;
    return out;
}

async function parseResponse<T>(res: Response): Promise<T> {
    const text = await res.text();

    // If it's a simple JSON object/array (errors or legacy), return it
    if (text.startsWith('{') || text.startsWith('[')) {
        try {
            const parsed = JSON.parse(text);
            return parsed;
        } catch (e) {
        }
    }

    // FastAPI JSON-serializes strings with quotes: "base64..." → strip them first
    let payload = text;
    if (text.startsWith('"')) {
        try { payload = JSON.parse(text); } catch { /* keep original */ }
    }
    // silenced
    // Last resort fallback
    try { return JSON.parse(text); } catch { return text as any; }
}

export function decryptPayload(payload: unknown): any {
    if (payload === null || payload === undefined) return null;
    if (typeof payload !== 'string') return payload;

    const text = payload.trim();
    if (!text) return null;

    // Already plain JSON.
    if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try { return JSON.parse(text); } catch { /* fall through */ }
    }

    // Handle JSON-stringified payload, e.g. "{...}" or "[...]".
    if (text.startsWith('"') && text.endsWith('"')) {
        try {
            const unwrapped = JSON.parse(text);
            return decryptPayload(unwrapped);
        } catch { /* fall through */ }
    }

    // If payload is not JSON (or cannot be parsed), return raw text.
    try { return JSON.parse(text); } catch { return text; }
}

export async function getClasses(tokenOverride?: string): Promise<string[]> {
    const res = await fetch(`${API_BASE_URL}/api/classes`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data: any = await parseResponse(res);
    return data?.classes || [];
}

/** Raw version — returns encrypted blob, NOT decrypted. For Server Actions. */
export async function getClassesRaw(tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/classes`, authHeaders(tokenOverride));
}

export async function getClassesBff(): Promise<any> {
    const res = await fetch('/v/classes', { credentials: 'include' });
    return res.ok ? res.json() : null;
}

export async function getClassesBffRaw(): Promise<string | null> {
    return fetchBffRaw('/v/classes');
}
// ... (repeating this pattern for overall file)

export async function getStudentsByClass(maLop: string, tokenOverride?: string): Promise<Student[]> {
    const url = `${API_BASE_URL}/api/class/${encodeURIComponent(maLop)}/students`;
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) {
        // silenced
        throw new Error('Failed to fetch students');
    }
    const data: any = await parseResponse(res);
    return data?.students || [];
}

/** Raw version — returns encrypted blob, NOT decrypted. For Server Actions. */
export async function getStudentsByClassRaw(maLop: string, tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/class/${encodeURIComponent(maLop)}/students`, authHeaders(tokenOverride));
}

export async function getStudentsByClassBff(maLop: string): Promise<any> {
    const res = await fetch(`/v/class/${encodeURIComponent(maLop)}/students`, { credentials: 'include' });
    return res.ok ? res.json() : null;
}

export async function getStudentsByClassBffRaw(maLop: string): Promise<string | null> {
    return fetchBffRaw(`/v/class/${encodeURIComponent(maLop)}/students`);
}

export async function getStudent(msv: string, tokenOverride?: string): Promise<Student> {
    const url = `${API_BASE_URL}/api/student/${encodeURIComponent(msv)}`;
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        // silenced
        throw new Error('Failed to fetch student');
    }
    return parseResponse(res);
}

/** Raw version — returns encrypted blob, NOT decrypted. For Server Actions. */
export async function getStudentRaw(msv: string, tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/student/${encodeURIComponent(msv)}`, authHeaders(tokenOverride));
}

export async function getStudentBff(msv: string): Promise<any> {
    const res = await fetch(`/v/student/${encodeURIComponent(msv)}`, { credentials: 'include' });
    return res.ok ? res.json() : null;
}

export async function getStudentBffRaw(msv: string): Promise<string | null> {
    return fetchBffRaw(`/v/student/${encodeURIComponent(msv)}`);
}

export async function searchStudents(query: string, tokenOverride?: string): Promise<Student[]> {
    const url = `${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to search students');
    const data: any = await parseResponse(res);
    return data?.results || [];
}

/** Raw version — returns encrypted blob, NOT decrypted. For Server Actions. */
export async function searchStudentsRaw(query: string, tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`, authHeaders(tokenOverride));
}

export async function searchStudentsBff(query: string): Promise<any> {
    const res = await fetch(`/v/search?query=${encodeURIComponent(query)}`, { credentials: 'include' });
    return res.ok ? res.json() : null;
}

export async function searchStudentsBffRaw(query: string): Promise<string | null> {
    return fetchBffRaw(`/v/search?query=${encodeURIComponent(query)}`);
}

export interface User {
    id?: number;
    username?: string;
    role?: number;
    created_at?: string;
    reset_limit_at?: string | null;
    class_change_limit?: number;
}

export async function getMe(tokenOverride?: string): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/api/me`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch user info');
    const data: any = await parseResponse(res);
    // Backend returns short field names: u=username, r=role, rl=reset_limit_at, ca=created_at, cl=class_change_limit
    return {
        username: data.u ?? data.username,
        role: data.r ?? data.role,
        reset_limit_at: data.rl ?? data.reset_limit_at,
        created_at: data.ca ?? data.created_at,
        class_change_limit: data.cl ?? data.class_change_limit,
    };
}

/** Raw version — returns encrypted blob, NOT decrypted. For Server Actions. */
export async function getMeRaw(tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/me`, authHeaders(tokenOverride));
}

export async function getProfile(tokenOverride?: string): Promise<User> {
    const res = await fetch(`${API_BASE_URL}/api/me-profile`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) {
        return getMe(tokenOverride);
    }
    const data: any = await parseResponse(res);
    return {
        username: data.u ?? data.username,
        created_at: data.ca ?? data.created_at,
    };
}

export async function getProfileRaw(tokenOverride?: string): Promise<string | null> {
    return fetchRawEncrypted(`${API_BASE_URL}/api/me-profile`, authHeaders(tokenOverride));
}

export async function getStudentCount(className?: string, tokenOverride?: string): Promise<number> {
    const url = className
        ? `${API_BASE_URL}/api/stats/student-count?class_name=${encodeURIComponent(className)}`
        : `${API_BASE_URL}/api/stats/student-count`;

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

export async function getWebSocketTicket(tokenOverride?: string): Promise<string | null> {
    const res = await fetch(`${API_BASE_URL}/api/ws-ticket`, {
        method: 'POST',
        headers: authHeaders(tokenOverride),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.ticket || null;
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
    class_change_limit?: number;
}

export async function resetUserLimit(userId: number, tokenOverride?: string): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/api/admin/user/${userId}/reset-limit`, {
        method: 'POST',
        headers: authHeaders(tokenOverride)
    });
    if (!res.ok) throw new Error('Failed to reset user limit');
}

export async function updateUserLimit(userId: number, limit: number, tokenOverride?: string): Promise<void> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json'
    };
    const authH = authHeaders(tokenOverride) as Record<string, string>;
    if (authH['Authorization']) {
        headers['Authorization'] = authH['Authorization'];
    }

    const res = await fetch(`${API_BASE_URL}/api/admin/user/${userId}/class-change-limit`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit })
    });
    if (!res.ok) throw new Error('Failed to update user limit');
}

export async function getUsers(tokenOverride?: string): Promise<AdminUser[]> {
    const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers: authHeaders(tokenOverride) });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export interface LoginResponse {
    access_token: string;
    role?: number;
    class_change_limit?: number;
}

export async function loginUser(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        try {
            const parsed = JSON.parse(text);
            throw new Error(parsed?.detail || 'Tên đăng nhập hoặc mật khẩu không đúng');
        } catch {
            throw new Error(text || 'Không thể kết nối máy chủ đăng nhập');
        }
    }
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

export async function getMeBff(): Promise<User | null> {
    const data = await fetchBff('/v/me');
    if (!data) return null;
    return {
        username: data.u ?? data.username,
        role: data.r ?? data.role,
        reset_limit_at: data.rl ?? data.reset_limit_at,
        created_at: data.ca ?? data.created_at,
        class_change_limit: data.cl ?? data.class_change_limit,
    };
}

export async function getProfileBff(): Promise<User | null> {
    const data = await fetchBff('/v/profile');
    if (!data) return null;
    return {
        username: data.u ?? data.username,
        created_at: data.ca ?? data.created_at,
    };
}

export async function getStudentCountBff(className?: string): Promise<number> {
    const url = className
        ? `/v/stats/student-count?class_name=${encodeURIComponent(className)}`
        : '/v/stats/student-count';
    const data = await fetchBff(url);
    if (!data) return 0;
    return data?.count || 0;
}

export async function getOnlineUsersBff(): Promise<number> {
    const data = await fetchBff('/v/stats/online-users');
    if (!data) return 0;
    return data?.count || 0;
}

export async function getWebSocketTicketBff(): Promise<string | null> {
    const res = await fetch('/v/ws-ticket', {
        method: 'POST',
        credentials: 'include',
        headers: withCsrf(),
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.ticket || null;
}

export async function loginUserBff(username: string, password: string): Promise<LoginResponse> {
    const res = await fetch('/v/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        try {
            const parsed = JSON.parse(text);
            throw new Error(parsed?.detail || 'Tên đăng nhập hoặc mật khẩu không đúng');
        } catch {
            throw new Error(text || 'Không thể kết nối máy chủ đăng nhập');
        }
    }
    return res.json();
}

export async function registerUserBff(username: string, password: string): Promise<void> {
    const res = await fetch('/v/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        try {
            const parsed = JSON.parse(text);
            throw new Error(parsed?.detail || 'Đăng ký thất bại');
        } catch {
            throw new Error(text || 'Đăng ký thất bại');
        }
    }
}

export async function logoutUserBff(): Promise<void> {
    await fetch('/v/auth/logout', {
        method: 'POST',
        credentials: 'include',
        headers: withCsrf(),
    });
}

export async function getUsersBff(): Promise<AdminUser[]> {
    const res = await fetch('/v/admin/users', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export async function resetUserLimitBff(userId: number): Promise<void> {
    const res = await fetch(`/v/admin/user/${userId}/reset-limit`, {
        method: 'POST',
        credentials: 'include',
        headers: withCsrf(),
    });
    if (!res.ok) throw new Error('Failed to reset user limit');
}

export async function updateUserLimitBff(userId: number, limit: number): Promise<void> {
    const res = await fetch(`/v/admin/user/${userId}/class-change-limit`, {
        method: 'POST',
        headers: withCsrf({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ limit }),
    });
    if (!res.ok) throw new Error('Failed to update user limit');
}

export async function sendFeedbackBff(message: string, username?: string): Promise<{ success: boolean; error?: string }> {
    const res = await fetch('/v/feedback', {
        method: 'POST',
        headers: withCsrf({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ message, username }),
    });
    const data = await res.json().catch(() => ({ success: false, error: 'Gửi ý kiến thất bại' }));
    if (!res.ok) {
        return { success: false, error: data?.error || 'Gửi ý kiến thất bại' };
    }
    return { success: true };
}

// --- Chat & Moderation ---

/** Generates or retrieves a persistent device fingerprint. */
export function getDeviceFingerprint(): string {
    if (typeof window === 'undefined') return 'server';
    let fp = localStorage.getItem('device_fp');
    if (!fp) {
        fp = crypto.randomUUID();
        localStorage.setItem('device_fp', fp);
    }
    return fp;
}

export async function getChatHistoryBff(): Promise<any[]> {
    const data = await fetchBff('/v/chat/history');
    return data?.messages || [];
}

export async function banUserBff(user: string, ip?: string, fp?: string, reason?: string): Promise<void> {
    const res = await fetch('/v/admin/ban', {
        method: 'POST',
        headers: withCsrf({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ username: user, ip, fp, reason }),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to ban user');
}

export async function getBansBff(): Promise<any[]> {
    const res = await fetch('/v/admin/bans', { credentials: 'include' });
    if (!res.ok) return [];
    return res.json();
}

export async function unbanUserBff(banId: number): Promise<void> {
    const res = await fetch(`/v/admin/ban/${banId}`, {
        method: 'DELETE',
        headers: withCsrf(),
        credentials: 'include',
    });
    if (!res.ok) throw new Error('Failed to unban user');
}


