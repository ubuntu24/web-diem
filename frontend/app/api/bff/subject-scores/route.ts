import { NextRequest } from 'next/server';
import { authHeadersFromCookies, fetchUpstream, API_BASE_URL } from '@/app/api/bff/_utils';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    const headers = await authHeadersFromCookies();

    // No cache for scores to ensure freshness when students are browsing
    const response = await fetchUpstream(
        `${API_BASE_URL}/api/subject-scores?subject=${encodeURIComponent(subject || '')}`,
        { headers, cache: 'no-store' }
    );

    return new Response(response.body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
