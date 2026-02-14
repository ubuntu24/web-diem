import { ClassListResponse, Student, StudentListResponse, SearchResponse } from './types';

const API_BASE_URL = ''; // Next.js rewrites proxy to backend

export async function getClasses(): Promise<string[]> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/classes`, { headers });
    if (res.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
        throw new Error('Unauthorized');
    }
    if (!res.ok) throw new Error('Failed to fetch classes');
    const data: ClassListResponse = await res.json();
    return data.classes;
}

export async function getStudentsByClass(maLop: string): Promise<Student[]> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/class/${maLop}/students`, { headers });
    if (!res.ok) throw new Error('Failed to fetch students');
    const data: StudentListResponse = await res.json();
    return data.students;
}

export async function getStudent(msv: string): Promise<Student> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/student/${msv}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch student');
    return res.json();
}

export async function searchStudents(query: string): Promise<Student[]> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/search?query=${encodeURIComponent(query)}`, { headers });
    if (!res.ok) throw new Error('Failed to search students');
    const data: SearchResponse = await res.json();
    return data.results;
}

export interface User {
    id: number;
    username: string;
    role: number;
    created_at: string;
    reset_limit_at?: string | null;
}

export async function getMe(): Promise<User> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return res.json();
}


export async function getStudentCount(className?: string): Promise<number> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const url = className
        ? `${API_BASE_URL}/api/stats/student-count?class_name=${encodeURIComponent(className)}`
        : `${API_BASE_URL}/api/stats/student-count`;

    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error('Failed to fetch student count');
    const data = await res.json();
    return data.count;
}

export async function getOnlineUsers(): Promise<number> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/stats/online-users`, { headers });
    if (!res.ok) throw new Error('Failed to fetch online users');
    const data = await res.json();
    return data.count;
}

export interface AccessHistory {
    date: string;
    count: number;
}

export interface AdminUser {
    id: number;
    username: string;
    role: number;
    access_history?: AccessHistory[];
    reset_limit_at?: string | null;
}

export async function getUsers(): Promise<AdminUser[]> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export async function resetUserLimit(userId: number): Promise<void> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/admin/user/${userId}/reset-limit`, {
        method: 'POST',
        headers
    });
    if (!res.ok) throw new Error('Failed to reset user limit');
}

