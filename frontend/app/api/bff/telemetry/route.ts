import { NextRequest } from 'next/server';
import { authHeadersFromCookies, API_BASE_URL, fetchUpstream } from '../_utils';

/**
 * Silent telemetry endpoint — receives client fingerprint data and forwards to backend.
 * No explicit auth check needed since the backend endpoint handles it silently.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const headers = await authHeadersFromCookies({ 'Content-Type': 'application/json' }, request);

        await fetchUpstream(`${API_BASE_URL}/api/telemetry`, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        return Response.json({ ok: true });
    } catch {
        return Response.json({ ok: true }); // Never reveal errors
    }
}
