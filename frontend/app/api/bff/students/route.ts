import { API_BASE_URL, authHeadersFromCookies, fetchUpstream, MaLopSchema, badRequest } from '@/app/api/bff/_utils';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const maLop = searchParams.get('class');

    if (!maLop) {
        return new Response(JSON.stringify({ error: 'Missing class parameter' }), { status: 400 });
    }

    // Security: Validate class parameter
    const validation = MaLopSchema.safeParse(maLop);
    if (!validation.success) {
        return badRequest('Invalid class code format', validation.error.flatten());
    }

    const headers = await authHeadersFromCookies(undefined, request);

    // Fallback handler proxies to the canonical backend route
    const upstreamUrl = `${API_BASE_URL}/api/class/${encodeURIComponent(validation.data)}/students`;
    const upstream = await fetchUpstream(upstreamUrl, { headers, cache: 'no-store' });

    return new Response(upstream.body, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
