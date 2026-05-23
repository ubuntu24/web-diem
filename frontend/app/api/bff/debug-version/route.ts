// DEBUG ENDPOINT - TẠM THỜI ĐỂ KIỂM TRA PRODUCTION BUILD VERSION
// TODO: Xoá sau khi debug xong

export const dynamic = 'force-dynamic';

export async function GET() {
    return Response.json({
        build_time: new Date().toISOString(),
        version: 'v20260523-admin-hide-subject',
        features: ['admin-hide-subject', 'force-dynamic'],
        node_env: process.env.NODE_ENV,
        api_url: process.env.API_URL ? 'SET' : 'NOT SET',
    });
}
