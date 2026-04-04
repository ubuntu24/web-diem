import { enforceRateLimit, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    const limited = enforceRateLimit(request, 'feedback', 6, 60_000);
    if (limited) return limited;

    const csrfError = await requireCsrf(request);
    if (csrfError) return csrfError;

    const body = await request.json().catch(() => null);
    const message = String(body?.message || '').trim();
    const username = String(body?.username || 'An danh').trim();

    if (!message) {
        return Response.json({ success: false, error: 'No message' }, { status: 400 });
    }

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!botToken || !chatId) {
        return Response.json({ success: false, error: 'Telegram chua duoc cau hinh' }, { status: 500 });
    }

    const now = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const text = `MEOMEOW\n\nNguoi gui: ${username}\nNoi dung: ${message}\n\n${now}`;

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text,
        }),
        cache: 'no-store',
    });

    if (!res.ok) {
        return Response.json({ success: false, error: 'Gui tin nhan Telegram that bai' }, { status: 502 });
    }

    return Response.json({ success: true });
}
