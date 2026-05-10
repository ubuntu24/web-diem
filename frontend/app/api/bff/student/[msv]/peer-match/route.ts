import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, MsvSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(_: Request, { params }: { params: Promise<{ msv: string }> }) {
    try {
        const headers = await authHeadersFromCookies();
        const { msv } = await params;
        
        const validation = MsvSchema.safeParse(msv);
        if (!validation.success) {
            return badRequest('Invalid MSV format', validation.error.flatten());
        }
        const safeMsv = validation.data;

        const scope = await cacheScopeFromToken();
        const cached = await withTtlCache(`student-peer-match:${scope}:${safeMsv}`, 600_000, async () => {
            const url = `${API_BASE_URL}/api/student/${encodeURIComponent(safeMsv)}/peer-match`;
            const result = await fetchUpstream(url, { headers, cache: 'no-store' });
            return result;
        });

        return new Response(cached.body, {
            status: cached.status,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}
