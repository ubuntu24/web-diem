import { enforceRateLimit, requireCsrf } from '@/app/api/bff/_utils';

export async function POST(request: Request) {
    try {
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

        // Diagnostic logs (shielded)
        console.log(`[BFF Feedback] Attempting to send message from: ${username}`);
        if (!botToken || !chatId) {
            console.error('[BFF Feedback] Critical: TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing from environment');
            return Response.json({ success: false, error: 'Telegram chua duoc cau hinh' }, { status: 500 });
        }

        let nowStr: string;
        try {
            nowStr = new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
        } catch (e) {
            console.warn('[BFF Feedback] Date formatting failed, using standard ISO string');
            nowStr = new Date().toISOString();
        }

        const text = `MEOMEOW\n\nNguoi gui: ${username}\nNoi dung: ${message}\n\n${nowStr}`;

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
            const errorText = await res.text().catch(() => 'Unknown error');
            console.error(`[BFF Feedback] Telegram API error (${res.status}):`, errorText);
            return Response.json({ success: false, error: 'Gui tin nhan Telegram that bai' }, { status: 502 });
        }

        console.log('[BFF Feedback] Message sent successfully');
        return Response.json({ success: true });
    } catch (error: any) {
        console.error('[BFF Feedback] Runtime Error in POST handler:', error?.message || error);
        return Response.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
    }
}
