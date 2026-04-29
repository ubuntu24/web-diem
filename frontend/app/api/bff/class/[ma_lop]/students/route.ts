import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream, MaLopSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(_: Request, { params }: { params: Promise<{ ma_lop: string }> }) {
    try {
        console.log('[BFF] Request received for class students');
        const headers = await authHeadersFromCookies();

        const { ma_lop } = await params;
        console.log(`[BFF] ma_lop: ${ma_lop}`);

        // Security: Validate ma_lop input
        const validation = MaLopSchema.safeParse(ma_lop);
        if (!validation.success) {
            console.error('[BFF] Validation failed:', validation.error.format());
            return badRequest('Invalid class code format', validation.error.flatten());
        }
        const safeMaLop = validation.data;
        console.log('[BFF] Validation successful');

        const scope = await cacheScopeFromToken();
        const cached = await withTtlCache(`class-students:${scope}:${safeMaLop}`, 10_000, async () => {
            const url = `${API_BASE_URL}/api/class/${encodeURIComponent(safeMaLop)}/students`;
            console.log(`[BFF] Fetching students from: ${url}`);
            const result = await fetchUpstream(url, {
                headers,
                cache: 'no-store',
            });
            console.log(`[BFF] Upstream response: ${result.status}`);
            return result;
        });

        return new Response(cached.body, {
            status: cached.status,
            headers: { 'Content-Type': 'application/json; charset=utf-8' },
        });
    } catch (error: any) {
        console.error('[BFF] Error in GET /v/class/[ma_lop]/students:', error);
        return new Response(JSON.stringify({ error: error.message, stack: error.stack }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
