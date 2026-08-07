// Debug build-version endpoint removed for production.
export const dynamic = 'force-dynamic';

export async function GET() {
    return Response.json({ detail: 'Not Found' }, { status: 404 });
}
