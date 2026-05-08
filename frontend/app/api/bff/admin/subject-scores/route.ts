import { NextRequest } from 'next/server';
import { authHeadersFromCookies, fetchUpstream, API_BASE_URL } from '@/app/api/bff/_utils';

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const subject = searchParams.get('subject');
    
    if (!subject) {
        return new Response(JSON.stringify({ error: 'Subject parameter is required' }), { status: 400 });
    }

    const headers = await authHeadersFromCookies();
    // No TTL cache for scores to ensure accuracy, or very short TTL
    const response = await fetchUpstream(`${API_BASE_URL}/api/admin/subject-scores?subject=${encodeURIComponent(subject)}`, { 
        headers, 
        cache: 'no-store' 
    });

    return new Response(response.body, {
        status: response.status,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
}
