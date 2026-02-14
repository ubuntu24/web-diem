'use server';

import { getStudentsByClass, searchStudents, getClasses, getOnlineUsers, getStudent, getMe, getStudentCount, loginUser, registerUser, getUsers, resetUserLimit, type LoginResponse, type AdminUser } from '@/lib/api';
import { Student } from '@/lib/types';

/**
 * Server Action to fetch students for a class.
 * This hides the direct API call /api/class/{maLop}/students in the Network tab.
 */
export async function getStudentsAction(maLop: string, token?: string): Promise<Student[]> {
    try {
        // This fetch happens on the server (the Next.js server) 
        // calling your FastAPI backend. The browser only sees a POST to 'http://.../'
        return await getStudentsByClass(maLop, token);
    } catch (error) {
        console.error("Error in getStudentsAction:", error);
        return [];
    }
}

/**
 * Server Action to search students.
 * This hides the direct API call /api/search?query=... in the Network tab.
 */
export async function searchStudentsAction(query: string, token?: string): Promise<Student[]> {
    try {
        return await searchStudents(query, token);
    } catch (error) {
        console.error("Error in searchStudentsAction:", error);
        return [];
    }
}

/**
 * Server Action to get class list.
 */
export async function getClassesAction(token?: string): Promise<string[]> {
    try {
        return await getClasses(token);
    } catch (error) {
        console.error("Error in getClassesAction:", error);
        return [];
    }
}

/**
 * Server Action to get online count.
 */
export async function getOnlineCountAction(token?: string): Promise<number> {
    try {
        return await getOnlineUsers(token);
    } catch (error) {
        return 0;
    }
}

/**
 * Server Action to fetch a single student's grades.
 */
export async function getStudentAction(msv: string, token?: string): Promise<Student | null> {
    try {
        return await getStudent(msv, token);
    } catch (error) {
        console.error("Error in getStudentAction:", error);
        return null;
    }
}

/**
 * Server Action to fetch current user info.
 */
export async function getMeAction(token?: string): Promise<any> {
    try {
        return await getMe(token);
    } catch (error) {
        console.error("Error in getMeAction:", error);
        return null;
    }
}

/**
 * Server Action to fetch student count.
 */
export async function getStudentCountAction(maLop?: string, token?: string): Promise<number> {
    try {
        return await getStudentCount(maLop, token);
    } catch (error) {
        return 0;
    }
}

/**
 * Server Action to login user.
 * This hides the /api/login endpoint from the browser Network tab.
 */
export async function loginAction(username: string, password: string): Promise<{ success: boolean; access_token?: string; role?: number; error?: string }> {
    try {
        const data = await loginUser(username, password);
        return { success: true, access_token: data.access_token, role: data.role };
    } catch (error: any) {
        return { success: false, error: error.message || 'Đăng nhập thất bại' };
    }
}

/**
 * Server Action to register user.
 * This hides the /api/register endpoint from the browser Network tab.
 */
export async function registerAction(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
        await registerUser(username, password);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Đăng ký thất bại' };
    }
}

/**
 * Server Action to get all users (admin).
 * This hides the /api/admin/users endpoint from the browser Network tab.
 */
export async function getUsersAction(token?: string): Promise<AdminUser[]> {
    try {
        return await getUsers(token);
    } catch (error) {
        console.error("Error in getUsersAction:", error);
        return [];
    }
}

/**
 * Server Action to reset user limit (admin).
 * This hides the /api/admin/user/{id}/reset-limit endpoint from the browser Network tab.
 */
export async function resetUserLimitAction(userId: number, token?: string): Promise<{ success: boolean; error?: string }> {
    try {
        await resetUserLimit(userId, token);
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message || 'Reset thất bại' };
    }
}
