import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, MsvSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(_: Request, { params }: { params: Promise<{ msv: string }> }) {
    const headers = await authHeadersFromCookies();

    const { msv } = await params;
    console.log(`[BFF] Fetching student details for: ${msv}`);

    // Security: Validate MSV input
    const validation = MsvSchema.safeParse(msv);
    if (!validation.success) {
        console.error('[BFF] MSV Validation failed:', validation.error.format());
        return badRequest('Invalid student ID format', validation.error.flatten());
    }
    const safeMsv = validation.data;

    const scope = await cacheScopeFromToken();
    const cached = await withTtlCache(`student:${scope}:${safeMsv}`, 10_000, async () => {
        const url = `${API_BASE_URL}/api/student/${encodeURIComponent(safeMsv)}`;
        console.log(`[BFF] Upstream request: ${url}`);
        return fetchUpstream(url, {
            headers,
            cache: 'no-store',
        });
    });

    return new Response(cached.body, {
        status: cached.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
