import { cookies } from 'next/headers';
import { API_BASE_URL, authHeadersFromCookies, cacheScopeFromToken, withTtlCache, fetchUpstream } from '@/app/api/bff/_utils';

// GET hidden subjects for a student (admin only)
export async function GET(request: Request) {
  const url = new URL(request.url);
  const msv = url.searchParams.get('msv');
  if (!msv) return new Response(JSON.stringify({ error: 'msv required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const headers = await authHeadersFromCookies();
  const scope = await cacheScopeFromToken();
  const cached = await withTtlCache(`admin-hidden-subjects:${msv}:${scope}`, 5_000, async () => {
    return fetchUpstream(`${API_BASE_URL}/api/admin/hidden-subjects/${msv}`, { headers, cache: 'no-store' });
  });

  return new Response(cached.body, { status: cached.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

// POST to hide a subject (admin only)
export async function POST(request: Request) {
  const headers = await authHeadersFromCookies();
  const body = await request.json();
  const cached = await fetchUpstream(`${API_BASE_URL}/api/admin/hidden-subjects`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return new Response(cached.body, { status: cached.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}

// DELETE to unhide a subject (admin only)
export async function DELETE(request: Request) {
  const headers = await authHeadersFromCookies();
  const body = await request.json();
  const cached = await fetchUpstream(`${API_BASE_URL}/api/admin/hidden-subjects`, { method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return new Response(cached.body, { status: cached.status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
