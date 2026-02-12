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
}

export async function getMe(): Promise<User> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/me`, { headers });
    if (!res.ok) throw new Error('Failed to fetch user info');
    return res.json();
}

export async function getStudentCount(): Promise<number> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/stats/student-count`, { headers });
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

export interface AdminUser {
    id: number;
    username: string;
    role: number;
    allowed_classes: string[];
}

export async function getUsers(): Promise<AdminUser[]> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/admin/users`, { headers });
    if (!res.ok) throw new Error('Failed to fetch users');
    return res.json();
}

export async function updateUserPermissions(userId: number, allowedClasses: string[]): Promise<void> {
    const token = localStorage.getItem('token');
    const headers: HeadersInit = {
        'Content-Type': 'application/json'
    };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE_URL}/api/admin/user/${userId}/permissions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ allowed_classes: allowedClasses })
    });

    if (!res.ok) throw new Error('Failed to update permissions');
}
