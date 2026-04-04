import { cookies } from 'next/headers';
import { API_BASE_URL, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const store = await cookies();
    const token = store.get('stoken')?.value;

    const headers: HeadersInit = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    try {
        await fetch(`${API_BASE_URL}/api/logout`, {
            method: 'POST',
            headers,
            cache: 'no-store',
        });
    } catch {
        // ignore backend logout failure; local cookie deletion is authoritative for frontend.
    }

    store.delete('stoken');
    store.delete('role');
    return Response.json({ success: true });
}
