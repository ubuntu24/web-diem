import { authHeadersFromCookies, API_BASE_URL } from '../_utils';

export async function GET() {
    const headers = await authHeadersFromCookies();
    const res = await fetch(`${API_BASE_URL}/api/me-profile`, {
        headers,
        next: { revalidate: 0 }
    });
    
    if (!res.ok) {
        return Response.json({ detail: 'Failed to fetch profile' }, { status: res.status });
    }
    
    const data = await res.json();
    return Response.json(data);
}

export async function PATCH(req: Request) {
    console.log('BFF: PATCH /api/bff/profile hit');
    const headers = await authHeadersFromCookies();
    const body = await req.json();

    const res = await fetch(`${API_BASE_URL}/api/profile`, {
        method: 'PATCH',
        headers: {
            ...headers,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: 'Failed to update profile' }));
        return Response.json(errorData, { status: res.status });
    }

    return Response.json({ message: 'Profile updated successfully' });
}
