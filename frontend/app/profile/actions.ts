"use server";

import { cookies } from 'next/headers';

const API_BASE_URL = process.env.API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function updateProfileAction(fullName: string) {
    const token = (await cookies()).get('stoken')?.value;
    
    if (!token) {
        return { success: false, error: 'Phiên đăng nhập hết hạn' };
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/profile`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ full_name: fullName }),
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: 'Cập nhật thất bại' }));
            return { success: false, error: errorData?.detail || 'Cập nhật thất bại' };
        }

        return { success: true };
    } catch (err) {
        console.error('Update profile action error:', err);
        return { success: false, error: 'Không thể kết nối máy chủ' };
    }
}
