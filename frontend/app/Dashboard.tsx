"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    decryptPayload,
    getClassesBffRaw,
    getStudentsByClassBffRaw,
    getStudentBffRaw,
    searchStudentsBffRaw,
    getMeBff,
    getStudentCountBff,
    getOnlineUsersBff,
    getWebSocketTicketBff,
    getDeviceFingerprint,
    logoutUserBff,
} from '@/lib/api';
import PublicChat from './PublicChat';
import { Student, Grade } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import SemesterAccordion from '@/components/SemesterAccordion';
import GPASimulator from '@/components/GPASimulator';
import { compareSemesterKeys } from '@/lib/utils';
import { Search, Loader2, ChevronRight, Home as HomeIcon, Sparkles, ChevronLeft, Users, Award, Shield, MapPin, Star, MessageCircle, Film, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserMenu from '@/components/UserMenu';
import HeroSection from '@/components/HeroSection';
import AdminUserList from '@/components/AdminUserList';
import AdminSubjectPerformance from '@/components/AdminSubjectPerformance';
import ClassPicker from '@/components/ClassPicker';
import FeedbackButton from '@/components/FeedbackButton';
import StudentCharts from '@/components/StudentCharts';
import anime from 'animejs/lib/anime.js';

export default function Dashboard() {
    const router = useRouter();
    const [view, setView] = useState<'classes' | 'students' | 'grades' | 'search' | 'admin' | 'subject_performance'>('classes');
    const [loading, setLoading] = useState(false);
    const [classes, setClasses] = useState<string[]>([]);
    const [students, setStudents] = useState<Student[]>([]);
    const [selectedClass, setSelectedClass] = useState('');
    const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [localSearchTerm, setLocalSearchTerm] = useState('');
    const [gpa, setGpa] = useState('N/A');

    // Push browser history when view changes so back button works
    function navigateView(newView: typeof view, extra?: Record<string, string>) {
        setView(newView);
        const state = { view: newView, ...extra };
        sessionStorage.setItem('dashboardState', JSON.stringify(state));
        window.history.pushState(state, '', window.location.pathname);
    }

    const [role, setRole] = useState<number>(0);
    const [username, setUsername] = useState('User'); // This is the DISPLAY name (full_name or username)
    const [loginUsername, setLoginUsername] = useState(''); // This is the ACTUAL login username
    const [totalCredits, setTotalCredits] = useState(0);
    const [totalPoints, setTotalPoints] = useState(0);
    const [totalStudentCount, setTotalStudentCount] = useState(0);
    const [onlineUsers, setOnlineUsers] = useState(1);
    const [showClassPicker, setShowClassPicker] = useState(false);
    const [sortBy, setSortBy] = useState<'cumulative' | 'semester'>('cumulative');
    const [sortingScale, setSortingScale] = useState<'4' | '10'>('4');
    const [selectedSemester, setSelectedSemester] = useState<string>('all');
    const [compareMode, setCompareMode] = useState(false);
    const [selectedClasses, setSelectedClasses] = useState<string[]>([]);
    const [isVipLimitReached, setIsVipLimitReached] = useState(false);
    const [classChangeLimit, setClassChangeLimit] = useState(5);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [chatSocket, setChatSocket] = useState<WebSocket | null>(null);

    // ---------------------------------------------------------------------------
    // GPA helpers (Centralized in Backend)
    // ---------------------------------------------------------------------------

    function toNumber(value: unknown): number | null {
        if (value === null || value === undefined) return null;
        if (typeof value === 'number') return Number.isFinite(value) ? value : null;
        const text = String(value).trim().replace(',', '.');
        if (!text) return null;
        const n = Number(text);
        return Number.isFinite(n) ? n : null;
    }

    function cleanScore(raw10: unknown, raw4: unknown): { s10: number | null; s4: number | null } {
        let s10 = toNumber(raw10);
        let s4 = toNumber(raw4);

        if (s10 !== null && (s10 < 0 || s10 > 10)) s10 = null;
        if (s4 !== null && (s4 < 0 || s4 > 4)) s4 = null;

        if (s10 === null && s4 === null) return { s10: null, s4: null };

        if (s4 === null && s10 !== null) s4 = (s10 * 4) / 10;
        if (s10 === null && s4 !== null) s10 = (s4 * 10) / 4;

        return { s10, s4 };
    }

    function isExcludedFromGPA(grade: Grade): boolean {
        // Backend now handles exclusion logic (ma_mon, keywords, score range)
        return grade.exclude_from_gpa === true;
    }

    function getNormalizedSemester(grade: Grade): string {
        // Backend now handles semester normalization (Học vượt, Khác, etc.)
        return grade.normalized_semester || grade.hoc_ky || 'Khác';
    }

    // ---------------------------------------------------------------------------
    // Field Mapping (Privacy)
    // ---------------------------------------------------------------------------
    function mapGrade(g: any): Grade {
        return {
            ma_mon: g.m,
            ten_mon: g.t,
            hoc_ky: g.h,
            so_tin_chi: g.s,
            chuyen_can: g.c,
            he_so_1_l1: g.h1_1,
            he_so_1_l2: g.h1_2,
            he_so_1_l3: g.h1_3,
            he_so_1_l4: g.h1_4,
            he_so_1_l5: g.h1_5,
            he_so_1_l6: g.h1_6,
            he_so_1_l7: g.h1_7,
            he_so_1_l8: g.h1_8,
            he_so_1_l9: g.h1_9,
            he_so_2_l1: g.h2_1,
            he_so_2_l2: g.h2_2,
            he_so_2_l3: g.h2_3,
            he_so_2_l4: g.h2_4,
            he_so_2_l5: g.h2_5,
            he_so_2_l6: g.h2_6,
            he_so_2_l7: g.h2_7,
            he_so_2_l8: g.h2_8,
            he_so_2_l9: g.h2_9,
            thuc_hanh_1: g.th1,
            thuc_hanh_2: g.th2,
            thuong_ky_1: g.tk1,
            thuong_ky_2: g.tk2,
            thuong_ky_3: g.tk3,
            tb_thuong_ky: g.tb_tk,
            dieu_kien_thi: g.dk,
            diem_thi: g.dt,
            vang_thi: g.vt,
            tong_ket_1: g.s10_1,
            tong_ket_10: g.s10,
            tong_ket_4: g.s4,
            diem_chu: g.chu,
            xep_loai: g.xl,
            ket_qua: g.kq,
            diem_thi_kn_1: g.kn1,
            diem_thi_kn_2: g.kn2,
            diem_thi_kn_3: g.kn3,
            diem_thi_kn_4: g.kn4,
            da_thi_lai_trong_ky: g.tl_flag,
            tb_hoc_ky_10: g.hk10,
            tb_hoc_ky_4: g.hk4,
            tb_tich_luy_10: g.tl10,
            tb_tich_luy_4: g.tl4,
            tin_chi_dang_ky: g.tc_dk,
            tin_chi_tich_luy: g.tc_tl,
            xu_ly_hoc_vu: g.xlhv,
            loai_du_lieu: g.ldl,
            exclude_from_gpa: g.e,
            normalized_semester: g.nh,
            clean_name: g.cn
        };
    }

    function mapStudent(s: any): Student {
        const maskedId = String(s?.i || '').trim();
        const fallbackName = maskedId ? `User ${maskedId.slice(-6)}` : 'User an danh';
        const semesterGpaRaw = s.hg && typeof s.hg === 'object' ? s.hg : {};
        const semesterGpa = Object.fromEntries(
            Object.entries(semesterGpaRaw).map(([k, v]: [string, any]) => [
                k,
                {
                    gpa4: Number(v?.g4 || 0),
                    gpa10: Number(v?.g10 || 0),
                }
            ])
        );
        return {
            msv: s.i,
            ho_ten: s.n || fallbackName,
            ngay_sinh: s.b,
            ma_lop: s.c,
            noi_sinh: s.p,
            gpa: s.g,
            gpa10: s.g10,
            total_credits: s.tc,
            diem: s.d ? s.d.map(mapGrade) : null,
            semesters: Array.isArray(s.hs) ? s.hs : [],
            semester_gpa: semesterGpa,
        };
    }
    function calculateSemesterGPA(student: Student, semester: string): { gpa4: number, gpa10: number } {
        const fallback = student.semester_gpa?.[semester];
        if (fallback) return fallback;

        if (!student.diem) return { gpa4: 0, gpa10: 0 };
        const target = semester.trim().toLowerCase();
        const rows = student.diem.filter(
            d => !isExcludedFromGPA(d) && getNormalizedSemester(d).toLowerCase() === target
        );
        if (!rows.length) return { gpa4: 0, gpa10: 0 };

        const map = new Map<string, { s4: number; s10: number; cr: number }>();
        rows.forEach(g => {
            const { s10, s4 } = cleanScore(g.tong_ket_10, g.tong_ket_4);
            const cr = toNumber(g.so_tin_chi);
            if (!cr || cr <= 0 || s10 === null || s4 === null) return;
            let rawName = (g.ten_mon || '').trim().toLowerCase();
            const suffixes = ['_ hv', '_hv', '(hoc vuot)', '(hv)'];
            for (const suffix of suffixes) {
                if (rawName.endsWith(suffix)) {
                    rawName = rawName.slice(0, -suffix.length).trim();
                }
            }
            const key = (rawName ? `N_${rawName}` : '') || (g.ma_mon || '').trim();

            const existing = map.get(key);
            if (!existing || s10 > existing.s10) {
                map.set(key, { s4, s10, cr });
            }
        });

        let p4 = 0, p10 = 0, tc = 0;
        map.forEach(v => { p4 += v.s4 * v.cr; p10 += v.s10 * v.cr; tc += v.cr; });
        return {
            gpa4: tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0,
            gpa10: tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0,
        };
    }

    function calculateSemesterGPAData(student: Student): Record<string, { gpa4: number, gpa10: number }> {
        if (!student.diem) return {};
        const semesters = new Set((student.diem || []).map(g => getNormalizedSemester(g)));
        const result: Record<string, { gpa4: number, gpa10: number }> = {};
        semesters.forEach(sem => {
            result[sem] = calculateSemesterGPA(student, sem);
        });
        return result;
    }

    function calculateCumulativeGPA(student: Student): { gpa4: number, gpa10: number, totalCredits: number, totalPoints4: number, totalPoints10: number } {
        // Fallback for minimized student objects (e.g. from search/class list)
        if (!student.diem) {
            return {
                gpa4: student.gpa || 0,
                gpa10: student.gpa10 || 0,
                totalCredits: (student as any).total_credits || 0,
                totalPoints4: (student.gpa || 0) * ((student as any).total_credits || 0),
                totalPoints10: (student.gpa10 || 0) * ((student as any).total_credits || 0)
            };
        }

        const map = new Map<string, { s4: number; s10: number; cr: number }>();
        student.diem.forEach(g => {
            if (isExcludedFromGPA(g)) return;
            const { s10, s4 } = cleanScore(g.tong_ket_10, g.tong_ket_4);
            const cr = toNumber(g.so_tin_chi);
            if (!cr || cr <= 0 || s10 === null || s4 === null) return;
            let rawName = (g.ten_mon || '').trim().toLowerCase();
            const suffixes = ['_ hv', '_hv', '(hoc vuot)', '(hv)'];
            for (const suffix of suffixes) {
                if (rawName.endsWith(suffix)) {
                    rawName = rawName.slice(0, -suffix.length).trim();
                }
            }
            const key = (rawName ? `N_${rawName}` : '') || (g.ma_mon || '').trim();

            const existing = map.get(key);
            if (!existing || s10 > existing.s10) {
                map.set(key, { s4, s10, cr });
            }
        });

        let p4 = 0, p10 = 0, tc = 0;
        map.forEach(v => {
            if (v.s10 >= 4.0) {
                p4 += v.s4 * v.cr; p10 += v.s10 * v.cr; tc += v.cr;
            }
        });

        const gpa4 = tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0;
        const gpa10 = tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0;

        return { gpa4, gpa10, totalCredits: tc, totalPoints4: p4, totalPoints10: p10 };
    }

    useEffect(() => {
        const roleStored = localStorage.getItem('role');
        setRole(roleStored ? parseInt(roleStored) : 0);

        getMeBff().then(user => {
            if (!user) {
                router.push('/login');
                return;
            }
            const displayedName = user.full_name || user.username;
            const role = user.role;
            const classChangeLimit = user.class_change_limit;
            const resetLimitAt = user.reset_limit_at;

            if (user.username) setLoginUsername(user.username);
            if (displayedName) setUsername(displayedName);
            if (role !== undefined) setRole(role);

            const storedClass = localStorage.getItem('selectedClass') || '';
            setSelectedClass(storedClass);
            if (role !== undefined) localStorage.setItem('role', role.toString());

            if (role === 0) {
                const limit = classChangeLimit ?? 5;
                setClassChangeLimit(limit);

                if (resetLimitAt) {
                    const lastApplied = localStorage.getItem('lastResetApplied');
                    if (!lastApplied || new Date(resetLimitAt) > new Date(lastApplied)) {
                        localStorage.removeItem('classChanges');
                        localStorage.removeItem('classChangeDate');
                        localStorage.setItem('lastResetApplied', resetLimitAt);
                        setIsVipLimitReached(false);
                    }
                }

                if (limit === -1) {
                    setIsVipLimitReached(false);
                } else {
                    const count = parseInt(localStorage.getItem('classChanges') || '0');
                    const today = new Date().toISOString().slice(0, 10);
                    const storedDate = localStorage.getItem('classChangeDate');
                    if (storedDate === today && count >= limit) {
                        setIsVipLimitReached(true);
                    }
                }

                // Vai tro 0: chi hien thi so ban ghi trong lop dang chon, khong bao gio goi tong toan truong
                if (storedClass) {
                    getStudentCountBff(storedClass).then(c => setTotalStudentCount(c)).catch(() => { });
                    loadStudentsForClass(storedClass, false);
                } else {
                    setTotalStudentCount(0);
                    setShowClassPicker(true);
                }
            } else {
                // Vai tro 1 (quan tri): hien thi tong ban ghi he thong
                getStudentCountBff(undefined).then(c => setTotalStudentCount(c)).catch(() => { });
            }
        });

        loadClasses(false);

        let socket: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;
        let onlinePollInterval: NodeJS.Timeout | null = null;
        let reconnectAttempts = 0;
        let stopped = false;

        const startOnlinePolling = () => {
            if (onlinePollInterval) return;
            const poll = () => {
                getOnlineUsersBff().then((count) => {
                    if (typeof count === 'number' && Number.isFinite(count)) {
                        setOnlineUsers(count);
                    }
                }).catch(() => { });
            };
            poll();
            onlinePollInterval = setInterval(poll, 15000);
        };

        const stopOnlinePolling = () => {
            if (!onlinePollInterval) return;
            clearInterval(onlinePollInterval);
            onlinePollInterval = null;
        };

        const normalizeWsUrl = (rawUrl: string): string => {
            const pageProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            let wsUrl = (rawUrl || '').trim();

            if (!wsUrl) {
                return `${pageProtocol}//${window.location.host}/_s/online-count`;
            }

            if (wsUrl.startsWith('/')) {
                wsUrl = `${pageProtocol}//${window.location.host}${wsUrl}`;
            }

            if (wsUrl.startsWith('http://')) {
                wsUrl = `ws://${wsUrl.slice('http://'.length)}`;
            } else if (wsUrl.startsWith('https://')) {
                wsUrl = `wss://${wsUrl.slice('https://'.length)}`;
            } else if (!wsUrl.startsWith('ws://') && !wsUrl.startsWith('wss://')) {
                wsUrl = `${pageProtocol}//${wsUrl.replace(/^\/+/, '')}`;
            }

            if (window.location.protocol === 'https:' && wsUrl.startsWith('ws://')) {
                wsUrl = `wss://${wsUrl.slice('ws://'.length)}`;
            }
            return wsUrl;
        };

        const connectWebSocket = () => {
            if (stopped) return;
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const envWsUrl = (process.env.NEXT_PUBLIC_WS_URL || '').trim();
            let wsUrl = envWsUrl || `${protocol}//${window.location.host}/_s/online-count`;
            if (window.location.port === '3000') {
                const hostname = window.location.hostname;
                wsUrl = `${protocol}//${hostname}:8000/ws/online-count`;
            }
            wsUrl = normalizeWsUrl(wsUrl);
            // SECURITY: không gửi JWT trực tiếp qua WebSocket message.
            // Dùng one-time ticket ngắn hạn để xác thực kết nối.
            socket = new WebSocket(wsUrl);
            setChatSocket(socket);
            socket.onopen = async () => {
                reconnectAttempts = 0;
                stopOnlinePolling();
                const ticket = await getWebSocketTicketBff();
                if (ticket) {
                    const fp = getDeviceFingerprint();
                    socket?.send(JSON.stringify({ type: 'auth_ticket', ticket, fp }));
                }
            };
            socket.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data && typeof data.count === 'number') setOnlineUsers(data.count);
                    if (data && data.type === 'reset_limit') {
                        localStorage.removeItem('classChanges');
                        localStorage.removeItem('classChangeDate');
                        setIsVipLimitReached(false);
                    }
                    if (data && data.type === 'update_limit') {
                        const newLimit = data.limit;
                        setClassChangeLimit(newLimit);
                        if (newLimit === -1) {
                            setIsVipLimitReached(false);
                        } else {
                            const count = parseInt(localStorage.getItem('classChanges') || '0');
                            const today = new Date().toISOString().slice(0, 10);
                            const storedDate = localStorage.getItem('classChangeDate');
                            if (storedDate === today && count >= newLimit) {
                                setIsVipLimitReached(true);
                            } else {
                                setIsVipLimitReached(false);
                            }
                        }
                    }
                } catch (error) { }
            };
            socket.onclose = () => {
                if (stopped) return;
                setChatSocket(null);
                reconnectAttempts += 1;

                if (reconnectAttempts >= 4) {
                    // Fallback to polling so online counter still updates without WS.
                    startOnlinePolling();
                }

                const backoffMs = Math.min(20000, 3000 * reconnectAttempts);
                reconnectTimeout = setTimeout(connectWebSocket, backoffMs);
            };
            socket.onerror = () => {
                socket?.close();
            };
        };

        connectWebSocket();

        return () => {
            stopped = true;
            if (socket) {
                socket.onclose = null;
                socket.close();
            }
            setChatSocket(null);
            clearTimeout(reconnectTimeout);
            stopOnlinePolling();
        };
    }, []);

    // Set initial history state & handle browser back button
    useEffect(() => {
        const savedStateStr = sessionStorage.getItem('dashboardState');
        let stateToReplace: any = { view: 'classes' };
        
        if (savedStateStr) {
            try {
                const parsed = JSON.parse(savedStateStr);
                if (parsed && parsed.view) {
                    stateToReplace = parsed;
                    setView(parsed.view);
                    
                    // Restore data based on view
                    if (parsed.view === 'students' && parsed.cls) {
                        loadStudentsForClass(parsed.cls, false);
                    } else if (parsed.view === 'grades' && parsed.msv) {
                        loadGrade(parsed.msv, false);
                    }
                }
            } catch(e) {}
        }
        
        window.history.replaceState(stateToReplace, '', window.location.pathname);

        const handlePopState = (e: PopStateEvent) => {
            const state = e.state;
            if (!state || !state.view) {
                // No state → go to classes view
                setView('classes');
                return;
            }
            const v = state.view as typeof view;
            if (v === 'students' && state.cls) {
                // Reload students list for the class
                console.log('[Dashboard] PopState: reloading students for class', state.cls);
                setSelectedClass(state.cls);
                getStudentsByClassBffRaw(state.cls).then(async encrypted => {
                    const data = encrypted ? await decryptPayload(encrypted) : null;
                    setStudents((data?.students || []).map(mapStudent));
                    setView('students');
                }).catch((err) => {
                    console.error('[Dashboard] PopState: error loading students', err);
                    setView('classes');
                });
            } else if (v === 'grades' && state.msv) {
                // Reload grade detail
                console.log('[Dashboard] PopState: reloading grades for student', state.msv);
                getStudentBffRaw(state.msv).then(async encrypted => {
                    const data = encrypted ? await decryptPayload(encrypted) : null;
                    if (data) {
                        const mapped = mapStudent(data);
                        setCurrentStudent(mapped);
                        calculateGPA(mapped);
                        setView('grades');
                    } else {
                        console.warn('[Dashboard] PopState: Student data not found or decryption failed');
                        setView('classes');
                    }
                }).catch((err) => {
                    console.error('[Dashboard] PopState: Error loading student details', err);
                    setView('classes');
                });
            } else {
                setView(v);
            }
        };

        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const handleLogout = () => {
        logoutUserBff().catch(() => { });
        localStorage.removeItem('role');
        localStorage.removeItem('selectedClass');
        localStorage.removeItem('classChanges');
        localStorage.removeItem('classChangeDate');
        router.push('/login');
    };

    async function loadClasses(navigate = true) {
        setLoading(true);
        try {
            const encrypted = await getClassesBffRaw();
            const data = encrypted ? await decryptPayload(encrypted) : null;
            setClasses(data?.classes || []);
            if (navigate) navigateView('classes');
        } catch (error) {
            // silenced
        } finally {
            setLoading(false);
        }
    }

    async function loadStudentsForClass(cls: string, navigate = true) {
        setLoading(true);
        setSelectedClass(cls);
        try {
            const encrypted = await getStudentsByClassBffRaw(cls);
            const data = encrypted ? await decryptPayload(encrypted) : null;
            setStudents((data?.students || []).map(mapStudent));
            if (navigate) navigateView('students', { cls });
            getStudentCountBff(cls).then(count => setTotalStudentCount(count)).catch(() => { });
        } catch (error) {
            // silenced
        } finally {
            setLoading(false);
        }
    }

    async function loadStudents(maLop: string | string[], navigate = true) {
        if (role === 0 && typeof maLop === 'string') {
            localStorage.setItem('selectedClass', maLop);
            getStudentCountBff(maLop).then(count => setTotalStudentCount(count)).catch(() => { });
        }

        setLoading(true);
        const maLopStr = Array.isArray(maLop) ? maLop.join(',') : maLop;
        setSelectedClass(maLopStr);
        setLocalSearchTerm('');
        try {
            const encrypted = await getStudentsByClassBffRaw(maLopStr);
            const data = encrypted ? await decryptPayload(encrypted) : null;

            setStudents((data?.students || []).map(mapStudent));
            if (navigate) navigateView('students', { cls: maLopStr });
        } catch (error) {
            // silenced
            alert('Lỗi hệ thống khi tải danh sách bản ghi.');
        } finally {
            setLoading(false);
        }
    }

    const toggleClassSelection = (cls: string) => {
        setSelectedClasses(prev => prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]);
    };

    async function loadGrade(msv: string, navigate = true) {
        console.log('[Dashboard] loadGrade called for MSV:', msv);
        setLoading(true);
        try {
            const encrypted = await getStudentBffRaw(msv);
            console.log('[Dashboard] Received encrypted data from BFF');
            const data = encrypted ? await decryptPayload(encrypted) : null;
            if (data) {
                console.log('[Dashboard] Decrypted student data successfully');
                const mapped = mapStudent(data);
                setCurrentStudent(mapped);
                if (!mapped.semester_gpa || Object.keys(mapped.semester_gpa).length === 0) {
                    mapped.semester_gpa = calculateSemesterGPAData(mapped);
                }
                calculateGPA(mapped);
                if (navigate) navigateView('grades', { msv });
            } else {
                console.warn('[Dashboard] Failed to decrypt student payload');
                alert('Không thể tải thông tin bản ghi. Vui lòng thử lại.');
            }
        } catch (error) {
            console.error('[Dashboard] Error in loadGrade:', error);
            alert('Lỗi khi tải thành tích. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    }

    async function handleSearch(navigate = true) {
        if (!searchQuery.trim()) return;
        setLoading(true);
        try {
            const encrypted = await searchStudentsBffRaw(searchQuery);
            const data = encrypted ? await decryptPayload(encrypted) : null;
            setStudents((data?.results || []).map(mapStudent));
            if (navigate) navigateView('search');
        } catch (error) {
            // silenced
        } finally {
            setLoading(false);
        }
    }

    function calculateGPA(student: Student) {
        const cum = calculateCumulativeGPA(student);
        setTotalCredits(cum.totalCredits);
        setTotalPoints(cum.totalPoints4);
        const val = sortingScale === '4' ? cum.gpa4 : cum.gpa10;
        setGpa(val > 0 ? val.toFixed(2) : 'N/A');

        // Populate semester_gpa for charts if missing
        if (!student.semester_gpa || Object.keys(student.semester_gpa).length === 0) {
            student.semester_gpa = calculateSemesterGPAData(student);
        }
    }

    useEffect(() => {
        if (!currentStudent) return;
        calculateGPA(currentStudent);
    }, [currentStudent, sortingScale]);

    // Anime.js View Transition
    useEffect(() => {
        if (!anime) return;
        (anime as any)({
            targets: '.animate-view-entry',
            translateY: [20, 0],
            opacity: [0, 1],
            easing: 'easeOutExpo',
            duration: 800,
            delay: (el: any, i: number) => i * 100
        });
    }, [view, loading]);

    // Anime.js Stagger for Lists
    useEffect(() => {
        if (!anime || loading) return;
        (anime as any)({
            targets: '.stagger-item',
            translateX: [-20, 0],
            opacity: [0, 1],
            delay: (el: any, i: number) => i * 50,
            easing: 'easeOutQuad',
            duration: 600
        });
    }, [view, loading, students, classes]);

    const gradesBySemester = (() => {
        // Buoc 1: Gom thanh tich theo tung ky
        const grouped = (currentStudent?.diem || []).reduce((acc, grade) => {
            const hk = getNormalizedSemester(grade);
            if (!acc[hk]) acc[hk] = [];
            acc[hk].push(grade);
            return acc;
        }, {} as Record<string, Grade[]>);

        // Step 2: Deduplicate within each semester (keep highest score)
        // Use normalized name as key to catch HV variants (e.g. "Tiếng anh 2" vs "Tiếng anh 2_ HV")
        const normalizeSubjectName = (name: string) => {
            let n = (name || '').trim().toLowerCase();
            for (const suffix of ['_ hv', '_hv', '(hoc vuot)', '(hv)']) {
                if (n.endsWith(suffix)) n = n.slice(0, -suffix.length).trim();
            }
            return n;
        };

        for (const hk of Object.keys(grouped)) {
            const grades = grouped[hk];
            const seen = new Map<string, Grade>();
            for (const g of grades) {
                const normName = normalizeSubjectName(g.ten_mon || '');
                const maMon = (g.ma_mon || '').trim();
                // Use normalized name as primary key to catch same-subject with different ma_mon
                // (e.g. "Tiếng anh 4_ HV" with different codes)
                const key = (normName ? `N_${normName}` : '') || maMon;
                if (!key) continue; // No identifiable key → always keep

                const existing = seen.get(key);
                if (!existing) {
                    seen.set(key, g);
                } else {
                    const curScore = toNumber(g.tong_ket_10);
                    const existScore = toNumber(existing.tong_ket_10);
                    if (curScore !== null && (existScore === null || curScore > existScore)) {
                        seen.set(key, g);
                    }
                }
            }
            // Keep entries without key + deduplicated entries
            grouped[hk] = grades.filter(g => {
                const normName = normalizeSubjectName(g.ten_mon || '');
                const maMon = (g.ma_mon || '').trim();
                const key = (normName ? `N_${normName}` : '') || maMon;
                if (!key) return true;
                return seen.get(key) === g;
            });
        }

        return grouped;
    })();

    const sortedSemesterKeys = Object.keys(gradesBySemester).sort(compareSemesterKeys);

    const allSemesters = Array.from(new Set(students.flatMap(s => ([
        ...(s.diem ? s.diem.map(d => getNormalizedSemester(d)) : []),
        ...((s.semesters || [])),
        ...Object.keys(s.semester_gpa || {})
    ]))))
        .filter(Boolean)
        .sort(compareSemesterKeys);

    const getSemesterValue = (student: Student, semester: string, scale: '4' | '10') => {
        const semGPA = calculateSemesterGPA(student, semester);
        const direct = scale === '4' ? semGPA.gpa4 : semGPA.gpa10;
        if (direct > 0) return direct;
        const fallback = student.semester_gpa?.[semester];
        if (!fallback) return 0;
        return scale === '4' ? fallback.gpa4 : fallback.gpa10;
    };

    const filteredStudents = students.filter(sv =>
        sv.ho_ten.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
        sv.msv.toLowerCase().includes(localSearchTerm.toLowerCase())
    ).sort((a, b) => {
        let valA = 0;
        if (selectedSemester === 'all') {
            const cumGPA = calculateCumulativeGPA(a);
            valA = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
        } else {
            valA = getSemesterValue(a, selectedSemester, sortingScale);
        }
        let valB = 0;
        if (selectedSemester === 'all') {
            const cumGPA = calculateCumulativeGPA(b);
            valB = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
        } else {
            valB = getSemesterValue(b, selectedSemester, sortingScale);
        }
        return valB - valA;
    });

    return (
        <div className="min-h-screen bg-background transition-colors duration-500">
            <header className="sticky top-0 z-40 premium-glass border-b border-border/50 transition-all">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 sm:h-20 flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => loadClasses()}>
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform duration-300">
                                <Award className="w-6 h-6 sm:w-7 sm:h-7" />
                            </div>
                            <div className="hidden sm:block">
                                <h1 className="text-xl font-black tracking-tight text-foreground group-hover:text-indigo-500 transition-colors uppercase">lifesuck</h1>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest leading-tight">Bảng Điều Khiển Cao Cấp</p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {role === 1 && (
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => navigateView('admin')}
                                    className={`p-2 rounded-lg transition-colors ${view === 'admin' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                                    title="Quản lý người dùng"
                                >
                                    <Shield className="w-5 h-5" />
                                </button>
                                <button
                                    onClick={() => navigateView('subject_performance')}
                                    className={`p-2 rounded-lg transition-colors ${view === 'subject_performance' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                                    title="Hiệu suất theo bản ghi"
                                >
                                    <BarChart2 className="w-5 h-5" />
                                </button>
                                <div className="flex-1 max-w-xl mx-auto hidden md:block">
                                    <div className="relative group">
                                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                                        <input
                                            type="text"
                                            placeholder="Tìm kiếm bản ghi (Tên hoặc ID)..."
                                            className="w-full pl-10 pr-4 py-2.5 bg-background dark:bg-slate-900 border-border group-focus-within:border-indigo-500/50 group-focus-within:ring-4 group-focus-within:ring-indigo-500/10 border-2 rounded-xl text-sm transition-all outline-none text-foreground font-semibold placeholder-slate-500 shadow-inner"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                        {isVipLimitReached && role === 0 && (
                            <Link href="/vip" className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm hover:scale-105 transition-transform">
                                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                                    <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                                </div>
                                NÂNG CẤP VIP
                            </Link>
                        )}

                        <UserMenu username={username} onLogout={handleLogout} />
                        {role === 0 && (
                            <button
                                onClick={() => setShowClassPicker(true)}
                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${selectedClass ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200' : 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 animate-pulse'}`}
                            >
                                <MapPin className="w-4 h-4" />
                                <span className="text-xs font-bold">{selectedClass || 'Chọn lớp'}</span>
                            </button>
                        )}
                    </div>
                </div>
            </header >

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-8 premium-glass px-5 py-4 rounded-2xl border-border/50 shadow-xl transition-all">
                    <div className="flex items-center gap-2 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer font-bold transition-colors group" onClick={() => loadClasses()}>
                        <HomeIcon className="w-4 h-4 group-hover:scale-110 transition-transform" />
                        <span>Trang chủ</span>
                    </div>
                    {view !== 'classes' && (
                        <>
                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                            {view === 'search' ? (
                                <span className="font-semibold text-slate-900 dark:text-white">Tìm kiếm: "{searchQuery}"</span>
                            ) : (
                                <>
                                    <span className={`hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors ${!selectedClass ? 'hidden' : ''}`} onClick={() => loadStudents(selectedClass)}>
                                        {selectedClass}
                                    </span>
                                    {view === 'admin' && <span className="font-semibold text-slate-900 dark:text-white">Quản trị hệ thống</span>}
                                    {view === 'subject_performance' && <span className="font-semibold text-slate-900 dark:text-white">Hiệu suất theo bản ghi</span>}

                                    {view === 'grades' && currentStudent && (
                                        <>
                                            <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
                                            <span className="font-semibold text-slate-900 dark:text-white line-clamp-1">{currentStudent.ho_ten}</span>
                                        </>
                                    )}
                                </>
                            )}
                        </>
                    )}
                </div>

                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center py-20">
                            <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
                            <p className="text-slate-500 font-medium">Đang xử lý...</p>
                        </motion.div>
                    ) : (
                        <>
                            {view === 'classes' && (
                                <div className="space-y-6">
                                    {role !== 0 && (
                                        <div className="flex items-center justify-between premium-glass p-5 rounded-2xl border-border/50 shadow-lg transition-all mb-6">
                                            <div className="flex items-center gap-4">
                                                <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
                                                    <Users className="w-6 h-6" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold text-slate-900 dark:text-white text-lg">Chế độ so sánh</h4>
                                                    <p className="text-sm text-slate-500 dark:text-slate-400">Chọn nhiều lớp để phân tích dữ liệu tổng hợp</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                {compareMode && selectedClasses.length > 0 && (
                                                    <button onClick={() => loadStudents(selectedClasses)} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-black shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 active:scale-95 transition-all flex items-center gap-2">
                                                        <Award className="w-4 h-4" />
                                                        SO SÁNH {selectedClasses.length} LỚP
                                                    </button>
                                                )}
                                                <button onClick={() => { setCompareMode(!compareMode); setSelectedClasses([]); }} className={`px-6 py-2.5 rounded-xl text-sm font-black transition-all active:scale-95 ${compareMode ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300' : 'bg-white dark:bg-slate-900 border-2 border-border text-slate-700 dark:text-slate-300 hover:border-indigo-500/50 shadow-sm'}`}>
                                                    {compareMode ? 'HỦY BỎ' : 'CHỌN NHIỀU LỚP'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                    <HeroSection username={username} totalClasses={role === 0 ? (selectedClass ? 1 : 0) : classes.length} totalStudents={totalStudentCount} onlineUsers={onlineUsers} role={role} />
                                    {role === 0 ? (
                                        selectedClass ? (
                                            <div className="grid grid-cols-1 gap-3">
                                                <div onClick={() => loadStudents(selectedClass)} className="animate-view-entry bg-white dark:bg-slate-800 p-5 rounded-xl border border-indigo-200 dark:border-indigo-700 transition-all flex items-center gap-4 group cursor-pointer shadow-sm hover:shadow-lg hover:border-indigo-400">
                                                    <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 group-hover:scale-110 transition-transform"><MapPin className="w-6 h-6" /></div>
                                                    <div className="flex-1"><div className="font-bold text-lg text-slate-900 dark:text-white">{selectedClass}</div><div className="text-xs text-slate-500 dark:text-slate-400">Nhấn để xem danh sách người dùng</div></div>
                                                    <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-12"><MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" /><p className="text-slate-500 dark:text-slate-400 font-medium">Vui lòng chọn lớp để bắt đầu</p><button onClick={() => setShowClassPicker(true)} className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors">Chọn lớp</button></div>
                                        )
                                    ) : (
                                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                                            {classes.map((cls, index) => (
                                                <div key={cls} onClick={() => compareMode ? toggleClassSelection(cls) : loadStudents(cls)} className={`stagger-item premium-card p-4 md:p-6 rounded-2xl flex flex-col items-center justify-center gap-4 group relative overflow-hidden ${compareMode && selectedClasses.includes(cls) ? 'border-indigo-500 bg-indigo-500/5 ring-4 ring-indigo-500/10' : ''} cursor-pointer`}>
                                                    {compareMode && (<div className={`absolute top-3 right-3 w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all duration-300 ${selectedClasses.includes(cls) ? 'bg-indigo-600 border-indigo-600 scale-110' : 'bg-white/50 dark:bg-slate-800/50 border-border'}`}>{selectedClasses.includes(cls) && <div className="w-2 h-2 bg-white rounded-sm" />}</div>)}
                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${compareMode && selectedClasses.includes(cls) ? 'bg-indigo-600 text-white' : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 dark:bg-indigo-500/20'} group-hover:scale-110 group-hover:rotate-6 shadow-indigo-500/10 shadow-lg`}><span className="font-black text-sm tracking-widest">{cls.substring(0, 2)}</span></div>
                                                    <div className={`font-bold text-sm truncate w-full text-center transition-colors ${compareMode && selectedClasses.includes(cls) ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'} group-hover:text-indigo-600`}>{cls}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {view === 'admin' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><AdminUserList /></motion.div>
                            )}

                            {view === 'subject_performance' && (
                                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}><AdminSubjectPerformance /></motion.div>
                            )}



                            {(view === 'students' || view === 'search') && (
                                <div className="premium-glass rounded-2xl border-border/50 shadow-2xl overflow-hidden transition-all">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-border/50 bg-slate-500/5 dark:bg-slate-900/50 gap-4 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-600">
                                                <Users className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-foreground flex items-center gap-3">
                                                    {view === 'search' ? 'Kết quả tìm kiếm' : `Lớp ${selectedClass}`}
                                                    <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">{filteredStudents.length} NGƯỜI DÙNG</span>
                                                </h3>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3">
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => setSortingScale(sortingScale === '4' ? '10' : '4')} className={`h-10 px-4 text-xs font-black rounded-xl border-2 transition-all flex items-center gap-2 active:scale-95 ${sortingScale === '10' ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-background border-border text-slate-600 dark:text-slate-300 hover:border-indigo-500/50'}`}><Sparkles className={`w-3.5 h-3.5 ${sortingScale === '10' ? 'text-indigo-200' : 'text-indigo-500'}`} />HỆ {sortingScale}</button>
                                                <select value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)} className="px-3 py-1 text-xs font-black bg-background border-2 border-border rounded-xl outline-none focus:border-indigo-500 text-slate-700 dark:text-slate-300 h-10 min-w-[140px] shadow-sm transition-all" title="Sắp xếp theo kỳ">
                                                    <option value="all">KỲ TÍCH LŨY</option>
                                                    {allSemesters.map(sem => (<option key={sem} value={sem}>{/^\d+/.test(sem) ? `KỲ ${sem}` : sem.toUpperCase()}</option>))}
                                                </select>
                                            </div>
                                            <div className="relative w-full md:w-64">
                                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    placeholder="Lọc nhanh..."
                                                    className="w-full pl-10 pr-4 py-2 bg-background border-2 border-border rounded-xl text-sm outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/5 transition-all text-foreground font-bold placeholder-slate-400 shadow-inner"
                                                    value={localSearchTerm}
                                                    onChange={(e) => setLocalSearchTerm(e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-slate-700">
                                        {filteredStudents.length === 0 ? (
                                            <div className="p-8 text-center text-slate-500 dark:text-slate-400">{localSearchTerm ? 'Không tìm thấy kết quả phù hợp.' : 'Không có dữ liệu.'}</div>
                                        ) : (
                                            filteredStudents.map((sv) => (
                                                <div key={sv.msv} onClick={() => loadGrade(sv.msv)} className="stagger-item p-4 md:p-6 hover:bg-indigo-500/5 dark:hover:bg-indigo-500/10 cursor-pointer transition-all flex items-center gap-4 md:gap-6 group relative">
                                                    <div className="relative shrink-0">
                                                        <div className="w-20 h-20 bg-slate-500/5 dark:bg-slate-800 rounded-3xl flex items-center justify-center text-slate-400 dark:text-slate-300 group-hover:bg-indigo-500/20 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-all duration-500 group-hover:rotate-6 group-hover:scale-105 border-2 border-border shadow-inner"><span className="font-black text-3xl">{sv.ho_ten.charAt(0).toUpperCase()}</span></div>
                                                        <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
                                                            {(() => {
                                                                const cumGPA = calculateCumulativeGPA(sv);
                                                                const val = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
                                                                return (<div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black text-white border-4 border-background shadow-xl ${sortingScale === '4' ? (val >= 3.2 ? 'bg-emerald-500' : val >= 2.5 ? 'bg-amber-500' : 'bg-rose-500') : (val >= 8.0 ? 'bg-emerald-500' : val >= 6.5 ? 'bg-amber-500' : 'bg-rose-500')} group-hover:scale-110 transition-transform duration-300`} title={`Thành tích Tích lũy (Hệ ${sortingScale})`}>{val.toFixed(2)}</div>);
                                                            })()}
                                                            {selectedSemester !== 'all' && (() => {
                                                                const semVal = getSemesterValue(sv, selectedSemester, sortingScale);
                                                                return (
                                                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-[10px] font-black text-white border-4 border-background shadow-xl ${sortingScale === '4' ? (semVal >= 3.2 ? 'bg-sky-500' : semVal >= 2.5 ? 'bg-blue-500' : 'bg-slate-500') : (semVal >= 8.0 ? 'bg-sky-500' : semVal >= 6.5 ? 'bg-blue-500' : 'bg-slate-500')} group-hover:scale-110 transition-transform duration-500 translate-y-1`} title={`Thành tích Kỳ (Hệ ${sortingScale})`}>{semVal.toFixed(1)}</div>
                                                                );
                                                            })()}
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-black text-lg md:text-xl text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors break-words leading-tight">{sv.ho_ten}</div>
                                                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2 font-bold uppercase tracking-widest">{role !== 0 && (<><span className="font-mono text-indigo-500/70">{sv.msv}</span><span className="w-1.5 h-1.5 rounded-full bg-border"></span></>)}{role !== 0 && sv.ngay_sinh && <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" />{sv.ngay_sinh}</span>}</div>
                                                    </div>
                                                    {sv.ma_lop && (<div className="hidden sm:block px-4 py-2 bg-slate-500/5 dark:bg-slate-800 rounded-xl text-xs font-black text-slate-500 dark:text-slate-400 border border-border group-hover:border-indigo-500/50 transition-colors uppercase tracking-widest">{sv.ma_lop}</div>)}
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center group-hover:bg-indigo-500/10 transition-all"><ChevronRight className="w-6 h-6 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" /></div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}

                            {view === 'grades' && currentStudent && (
                                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                                    <div className="lg:col-span-1 space-y-6">
                                        <div className="premium-glass rounded-3xl border-border/50 shadow-2xl p-8 sticky top-28 transition-all">
                                            <div className="flex flex-col items-center text-center pb-8 border-b border-border/50">
                                                <div className="w-24 h-24 bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 ring-8 ring-indigo-500/5 shadow-inner">
                                                    <UserIconBig />
                                                </div>
                                                <h2 className="text-2xl font-black text-foreground leading-tight">{currentStudent.ho_ten}</h2>
                                                {role !== 0 && (<p className="text-sm text-indigo-500 font-black font-mono mt-2 tracking-widest uppercase">{currentStudent.msv}</p>)}
                                            </div>
                                            <div className="pt-6 space-y-4">
                                                <InfoRow label="LỚP" value={currentStudent.ma_lop} />
                                                {role !== 0 && (
                                                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="space-y-4">
                                                        <InfoRow label="NGÀY SINH" value={currentStudent.ngay_sinh} />
                                                        <InfoRow label="QUÊ QUÁN" value={currentStudent.noi_sinh} />
                                                    </motion.div>
                                                )}
                                            </div>
                                            <div className="mt-8 p-6 bg-gradient-to-br from-indigo-600 to-violet-700 dark:from-indigo-600/20 dark:to-violet-700/20 border-2 border-indigo-400/20 rounded-2xl text-white text-center shadow-2xl shadow-indigo-500/20">
                                                <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-1 text-indigo-100 italic">CÔNG LỰC TÍCH LŨY</div>
                                                <div className="text-4xl font-black text-white">{gpa}</div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="lg:col-span-3 space-y-8 animate-view-entry">
                                        <StudentCharts student={currentStudent} scale={sortingScale} />
                                        


                                        <div className="flex items-center gap-2 mb-2"><h3 className="font-bold text-slate-800 dark:text-white uppercase tracking-widest text-sm opacity-60">Bản ghi hiệu suất</h3></div>
                                        {sortedSemesterKeys.map(hk => {
                                            const semesterGrades = gradesBySemester[hk];
                                            const semGPA = calculateSemesterGPA(currentStudent, hk);
                                            const displayGPA = (sortingScale === '4' ? semGPA.gpa4 : semGPA.gpa10).toFixed(2);
                                            return (<SemesterAccordion key={hk} semester={hk} grades={semesterGrades} gpa={displayGPA} />);
                                        })}
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {showClassPicker && (
                        <ClassPicker
                            classes={classes}
                            currentClass={selectedClass}
                            maxChanges={classChangeLimit}
                            onClassSelected={(cls) => {
                                setSelectedClass(cls);
                                loadStudents(cls);
                                if (classChangeLimit === -1) {
                                    setIsVipLimitReached(false);
                                } else {
                                    const count = parseInt(localStorage.getItem('classChanges') || '0');
                                    if (count >= classChangeLimit) setIsVipLimitReached(true);
                                }
                            }}
                            onClose={selectedClass ? () => setShowClassPicker(false) : undefined}
                        />
                    )}
                </AnimatePresence>
            </main>

            <AnimatePresence>
                {view === 'grades' && currentStudent && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-6 right-6 z-40">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full relative transition-colors"><button onClick={() => { const el = document.getElementById('gpa-simulator-container'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="absolute -top-3 -right-3 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition"><Sparkles className="w-5 h-5" /></button><div className="text-sm font-medium text-slate-600 dark:text-slate-200 mb-2">Xem thành tích tích lũy dự kiến?</div><div className="text-xs text-slate-400 dark:text-slate-400">Cuộn xuống dưới cùng để thêm bản ghi dự kiến.</div></div>
                    </motion.div>
                )}
            </AnimatePresence>

            {view === 'grades' && currentStudent && (
                <div id="gpa-simulator-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20"><div className="mt-12 border-t border-slate-200 pt-8"><h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><Sparkles className="w-6 h-6 text-indigo-500" />Mô phỏng Thành tích Dự Kiến</h2><GPASimulator currentCredits={totalCredits} currentPoints={totalPoints} /></div></div>
            )}
            <FeedbackButton username={username} />

            <PublicChat
                user={{ username, loginUsername, role }}
                socket={chatSocket}
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
            />

            {!isChatOpen && (
                <motion.button
                    onClick={() => setIsChatOpen(true)}
                    className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-xl shadow-violet-500/30 dark:shadow-violet-900/50 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                    whileHover={{ rotate: [0, 10, -10, 0] }}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    title="Chat Công Cộng"
                >
                    <MessageCircle className="w-6 h-6 sm:w-7 sm:h-7" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></div>
                </motion.button>
            )}
        </div >
    );
}

function UserIcon() {
    return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>)
}

function UserIconBig() {
    return (<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-blue-600"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>)
}

function InfoRow({ label, value }: { label: string, value?: string }) {
    return (<div className="flex justify-between items-center text-sm"><span className="text-slate-500 dark:text-slate-400">{label}</span><span className="font-medium text-slate-900 dark:text-slate-200">{value || '--'}</span></div>)
}
