"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getClasses, getStudentsByClass, getStudent, searchStudents, getStudentCount, getOnlineUsers } from '@/lib/api';
import { Student } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import SemesterAccordion from '@/components/SemesterAccordion';
import GPASimulator from '@/components/GPASimulator';
import { Search, Loader2, Skull, ChevronRight, Home as HomeIcon, Sparkles, ChevronLeft, Users, Award, Shield, MapPin, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserMenu from '@/components/UserMenu';
import { getMe } from '@/lib/api';
import HeroSection from '@/components/HeroSection';
import AdminUserList from '@/components/AdminUserList';
import ClassPicker from '@/components/ClassPicker';

export default function Home() {
  const router = useRouter();
  const [view, setView] = useState<'classes' | 'students' | 'grades' | 'search' | 'admin'>('classes');
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<string[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [currentStudent, setCurrentStudent] = useState<Student | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [localSearchTerm, setLocalSearchTerm] = useState('');
  const [gpa, setGpa] = useState('N/A');

  const [role, setRole] = useState<number>(0);
  const [username, setUsername] = useState('User');
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

  // ---------------------------------------------------------------------------
  // GPA helpers (clean version)
  // ---------------------------------------------------------------------------

  const EXCLUDED_MA_MON = new Set(['0101000515', '0101000509', '0101000518']);
  const EXCLUDED_KEYWORDS = [
    'giáo dục thể chất', 'gdtc',
    'giáo dục quốc phòng', 'gdqp',
    'thể dục',
    'toeic',
    'tiếng anh đầu vào', 'tieng anh dau vao',
    'english placement',
    'xếp lớp tiếng anh', 'xep lop tieng anh',
    'kiểm tra đầu vào tiếng anh', 'kiem tra dau vao tieng anh',
    'điểm test tiếng anh đầu vào', 'diem test tieng anh dau vao',
  ];

  function toNumber(value: unknown): number | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    const n = Number(String(value).trim().replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }

  function cleanScore(raw10: unknown, raw4: unknown): { s10: number | null; s4: number | null } {
    let s10 = toNumber(raw10);
    let s4 = toNumber(raw4);

    // Clamp to valid academic range
    if (s10 !== null && (s10 < 0 || s10 > 10)) s10 = null;
    if (s4 !== null && (s4 < 0 || s4 > 4)) s4 = null;

    if (s10 === null && s4 === null) return { s10: null, s4: null };

    if (s4 === null && s10 !== null) s4 = (s10 * 4) / 10;
    if (s10 === null && s4 !== null) s10 = (s4 * 10) / 4;

    return { s10, s4 };
  }

  function isExcludedFromGPA(grade: { ten_mon?: string; ma_mon?: string; exclude_from_gpa?: boolean; tong_ket_10?: string }): boolean {
    // Layer 1: backend flag
    if (grade.exclude_from_gpa === true) return true;

    // Layer 2: hard-coded ma_mon
    if (EXCLUDED_MA_MON.has((grade.ma_mon || '').trim())) return true;

    // Layer 3: name keywords
    const name = (grade.ten_mon || '').trim().toLowerCase();
    if (name && EXCLUDED_KEYWORDS.some(kw => name.includes(kw))) return true;

    // Layer 4: score > 10 → non-academic
    const raw10 = toNumber(grade.tong_ket_10);
    if (raw10 !== null && raw10 > 10) return true;

    return false;
  }

  function getNormalizedSemester(grade: any): string {
    let hk = (grade.hoc_ky || '').trim();
    const ldl = (grade.loai_du_lieu || '').trim();
    const tenMon = (grade.ten_mon || '').trim().toLowerCase();

    // Robust detection of "Học vượt" (HV)
    const isHocVuot =
      hk.toUpperCase() === 'HV' ||
      ldl.toUpperCase() === 'HV' ||
      hk.toLowerCase().includes('hoc vuot') ||
      ldl.toLowerCase().includes('hoc vuot') ||
      tenMon.includes('_ hv') ||
      tenMon.includes('(hoc vuot)') ||
      tenMon.includes('(hv)');

    if (isHocVuot) return 'Học vượt';
    if (!hk && ldl) return ldl;
    return hk || 'Khác';
  }

  function calculateSemesterGPA(student: Student, semester: string): { gpa4: number, gpa10: number } {
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
      const key = (g.ma_mon || '').trim() || `N_${(g.ten_mon || '').trim().toLowerCase()}`;
      map.set(key, { s4, s10, cr }); // latest wins
    });

    let p4 = 0, p10 = 0, tc = 0;
    map.forEach(v => { p4 += v.s4 * v.cr; p10 += v.s10 * v.cr; tc += v.cr; });
    return {
      gpa4: tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0,
      gpa10: tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0,
    };
  }

  function calculateCumulativeGPA(student: Student): { gpa4: number, gpa10: number, totalCredits: number, totalPoints4: number, totalPoints10: number } {
    if (!student.diem || !student.diem.length) return { gpa4: 0, gpa10: 0, totalCredits: 0, totalPoints4: 0, totalPoints10: 0 };

    const map = new Map<string, { s4: number; s10: number; cr: number }>();
    student.diem.forEach(g => {
      if (isExcludedFromGPA(g)) return;
      const { s10, s4 } = cleanScore(g.tong_ket_10, g.tong_ket_4);
      const cr = toNumber(g.so_tin_chi);
      if (!cr || cr <= 0 || s10 === null || s4 === null) return;
      const key = (g.ma_mon || '').trim() || `N_${(g.ten_mon || '').trim().toLowerCase()}`;
      map.set(key, { s4, s10, cr }); // latest wins
    });

    let p4 = 0, p10 = 0, tc = 0;
    map.forEach(v => { p4 += v.s4 * v.cr; p10 += v.s10 * v.cr; tc += v.cr; });

    const gpa4 = tc > 0 ? parseFloat((p4 / tc).toFixed(2)) : 0;
    const gpa10 = tc > 0 ? parseFloat((p10 / tc).toFixed(2)) : 0;

    return { gpa4, gpa10, totalCredits: tc, totalPoints4: p4, totalPoints10: p10 };
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    const roleStored = localStorage.getItem('role');
    if (!token) {
      router.push('/login');
      return;
    }
    setRole(roleStored ? parseInt(roleStored) : 0);

    // Fetch user details
    getMe().then(user => {
      setUsername(user.username);
      setRole(user.role);

      // Read selected class from localStorage
      const storedClass = localStorage.getItem('selectedClass') || '';
      setSelectedClass(storedClass);

      localStorage.setItem('role', user.role.toString());

      // If regular user: show class picker if no class, or auto-load students
      if (user.role === 0) {
        // Handle offline reset
        if (user.reset_limit_at) {
          const lastApplied = localStorage.getItem('lastResetApplied');
          if (!lastApplied || new Date(user.reset_limit_at) > new Date(lastApplied)) {
            console.log("Applying offline limit reset from server");
            localStorage.removeItem('classChanges');
            localStorage.removeItem('classChangeDate');
            localStorage.setItem('lastResetApplied', user.reset_limit_at);
            setIsVipLimitReached(false);
          }
        }

        // Check VIP limit
        const count = parseInt(localStorage.getItem('classChanges') || '0');
        const today = new Date().toISOString().slice(0, 10);
        const storedDate = localStorage.getItem('classChangeDate');
        if (storedDate === today && count >= 3) {
          setIsVipLimitReached(true);
        }

        if (!storedClass) {
          setShowClassPicker(true);
        } else {
          // Auto-load the stored class's students
          loadStudentsForClass(storedClass);
        }
      }
    }).catch(() => {
      // Fallback or redirect if token invalid
      localStorage.removeItem('token');
      router.push('/login');
    });

    const storedClass = localStorage.getItem('selectedClass') || '';
    getStudentCount(roleStored && parseInt(roleStored) === 0 ? storedClass : undefined)
      .then(count => setTotalStudentCount(count))
      .catch(console.error);

    // Initial fetch for online users
    getOnlineUsers().then(count => setOnlineUsers(count)).catch(console.error);

    // WebSocket for real-time online users
    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    const connectWebSocket = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      let wsUrl = `${protocol}//${window.location.host}/ws/online-count`;

      // HOTFIX: Next.js rewrites don't proxy WebSockets reliably in production builds.
      // If we are on port 3000 (frontend default), try connecting directly to backend port 8000.
      if (window.location.port === '3000') {
        const hostname = window.location.hostname;
        wsUrl = `${protocol}//${hostname}:8000/ws/online-count`;
        console.log("Detected port 3000, switching WS to backend port 8000:", wsUrl);
      } else {
        console.log("Using relative WS URL (assuming Nginx/Cloudflare proxy):", wsUrl);
      }

      // Append Token for User Identification (Account-based counting)
      const token = localStorage.getItem('token');
      if (token) {
        wsUrl += `?token=${token}`;
      }

      socket = new WebSocket(wsUrl);

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data && typeof data.count === 'number') {
            setOnlineUsers(data.count);
          }
          if (data && data.type === 'reset_limit') {
            console.log("Limit reset signal received via WebSocket");
            localStorage.removeItem('classChanges');
            localStorage.removeItem('classChangeDate');
            setIsVipLimitReached(false);
          }
        } catch (error) {
          console.error("WebSocket message error:", error);
        }
      };

      socket.onclose = () => {
        console.log("WebSocket disconnected. Reconnecting...");
        reconnectTimeout = setTimeout(connectWebSocket, 5000);
      };

      socket.onerror = (error) => {
        console.error("WebSocket error:", error);
        socket?.close();
      };
    };

    connectWebSocket();

    loadClasses();

    return () => {
      if (socket) {
        socket.onclose = null; // Prevent reconnection loop
        socket.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('selectedClass');
    localStorage.removeItem('classChanges');
    localStorage.removeItem('classChangeDate');
    router.push('/login');
  };

  async function loadClasses() {
    setLoading(true);
    try {
      const data = await getClasses();
      setClasses(data);
      setView('classes');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  // Helper to load students directly (used on mount for role 0)
  async function loadStudentsForClass(cls: string) {
    setLoading(true);
    setSelectedClass(cls);
    try {
      const data = await getStudentsByClass(cls);
      setStudents(data);
      setView('students');
      // Refresh count for this specific class
      getStudentCount(cls).then(count => setTotalStudentCount(count)).catch(console.error);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStudents(maLop: string | string[]) {
    // If it's a single class and user role is 0, store it
    if (role === 0 && typeof maLop === 'string') {
      localStorage.setItem('selectedClass', maLop);
      // Refresh count for this specific class
      getStudentCount(maLop).then(count => setTotalStudentCount(count)).catch(console.error);
    }

    setLoading(true);
    const maLopStr = Array.isArray(maLop) ? maLop.join(',') : maLop;
    if (!Array.isArray(maLop)) {
      setSelectedClass(maLop);
    }
    setLocalSearchTerm('');
    try {
      const data = await getStudentsByClass(maLopStr);
      console.log('Students Data:', data); // Debugging
      setStudents(data);
      setView('students');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  const toggleClassSelection = (cls: string) => {
    setSelectedClasses(prev =>
      prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
    );
  };

  async function loadGrade(msv: string) {
    setLoading(true);
    try {
      const data = await getStudent(msv);
      setCurrentStudent(data);
      calculateGPA(data);
      setView('grades');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    if (!searchQuery.trim()) return;
    setLoading(true);
    try {
      const results = await searchStudents(searchQuery);
      setStudents(results);
      setView('search');
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }

  function calculateGPA(student: Student) {
    const cum = calculateCumulativeGPA(student);

    setTotalCredits(cum.totalCredits);
    setTotalPoints(cum.totalPoints4); // Simulator expects system 4 points

    const val = sortingScale === '4' ? cum.gpa4 : cum.gpa10;
    setGpa(val > 0 ? val.toFixed(2) : 'N/A');
  }

  useEffect(() => {
    if (!currentStudent) return;
    calculateGPA(currentStudent);
  }, [currentStudent, sortingScale]);

  const gradesBySemester = currentStudent?.diem.reduce((acc, grade) => {
    const hk = getNormalizedSemester(grade);
    if (!acc[hk]) acc[hk] = [];
    acc[hk].push(grade);
    return acc;
  }, {} as Record<string, typeof currentStudent.diem>) || {};

  const parseSemester = (s: string) => {
    const sLower = s.toLowerCase();

    // 1. Year range Detection (e.g. 2023 - 2024)
    const yearMatch = s.match(/(\d{4})\s*-\s*(\d{4})/);
    let year = yearMatch ? parseInt(yearMatch[1]) : 0;

    // 2. Fallback Year (if no range, look for any 20xx number)
    if (year === 0) {
      const singleYearMatch = s.match(/20\d{2}/);
      if (singleYearMatch) year = parseInt(singleYearMatch[0]);
    }

    // 3. Semester Number Detection
    // Look for standalone 1, 2, 3 (not part of a year)
    const semMatch = s.match(/(?:^|[^0-9])([123])(?:$|[^0-9])/);
    let sem = semMatch ? parseInt(semMatch[1]) : 0;

    // 4. Special Labels (Phụ/Hè)
    if (sLower.includes('phu') || sLower.includes('hé')) sem = 3.5; // Always after 1 and 2

    const isOther = year === 0 && sem === 0;
    return { year, sem, isOther };
  };


  const sortedSemesterKeys = Object.keys(gradesBySemester).sort((a, b) => {
    const pa = parseSemester(a);
    const pb = parseSemester(b);

    // Standard semesters first, "Other" (e.g. Học vượt) at the bottom
    if (pa.isOther && !pb.isOther) return 1;
    if (!pa.isOther && pb.isOther) return -1;
    if (pa.isOther && pb.isOther) return a.localeCompare(b);

    // Sort descending by year, then descending by semester (3 -> 2 -> 1)
    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.sem - pa.sem;
  });

  // Extract unique semesters from all students for the dropdown
  const allSemesters = Array.from(new Set(students.flatMap(s => s.diem ? s.diem.map(d => getNormalizedSemester(d)) : [])))
    .filter(Boolean)
    .sort((a, b) => {
      const pa = parseSemester(a);
      const pb = parseSemester(b);

      if (pa.isOther && !pb.isOther) return 1;
      if (!pa.isOther && pb.isOther) return -1;
      if (pa.isOther && pb.isOther) return a.localeCompare(b);

      if (pa.year !== pb.year) return pb.year - pa.year;
      return pb.sem - pa.sem;
    });

  // Debugging Semester Calculation
  useEffect(() => {
    if (selectedSemester !== 'all' && students.length > 0) {
      console.log(`Debug: Calculating GPA for semester '${selectedSemester}'`);
      const sampleStudent = students[0];
      if (sampleStudent.diem) {
        const grades = sampleStudent.diem.filter(d => getNormalizedSemester(d).toLowerCase() === selectedSemester.trim().toLowerCase());
        console.log(`Debug: Sample student (${sampleStudent.ho_ten}) has ${grades.length} grades for this semester.`);
        console.log('Debug: Sample grades:', grades);
      }
    }
  }, [selectedSemester, students]);

  const filteredStudents = students.filter(sv =>
    sv.ho_ten.toLowerCase().includes(localSearchTerm.toLowerCase()) ||
    sv.msv.toLowerCase().includes(localSearchTerm.toLowerCase())
  ).sort((a, b) => {
    // Determine the value to sort by for student A
    let valA = 0;
    if (selectedSemester === 'all') {
      const cumGPA = calculateCumulativeGPA(a);
      valA = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
    } else {
      // Sort by semester GPA
      const semGPA = calculateSemesterGPA(a, selectedSemester);
      valA = sortingScale === '4' ? semGPA.gpa4 : semGPA.gpa10;
    }

    // Determine the value to sort by for student B
    let valB = 0;
    if (selectedSemester === 'all') {
      const cumGPA = calculateCumulativeGPA(b);
      valB = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
    } else {
      const semGPA = calculateSemesterGPA(b, selectedSemester);
      valB = sortingScale === '4' ? semGPA.gpa4 : semGPA.gpa10;
    }

    // descending order
    return valB - valA;
  });

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors">
      {/* Sleek Navbar */}
      <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 sticky top-0 z-50 transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div
            className="flex items-center gap-2 cursor-pointer group"
            onClick={loadClasses}
          >
            <div className="bg-slate-950 dark:bg-blue-600 p-1.5 rounded-lg group-hover:bg-black dark:group-hover:bg-blue-700 transition-colors">
              <Skull className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">LIFE SUCKS</span>
          </div>

          <div className="flex items-center gap-4">
            {role === 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setView('admin')}
                  className={`p-2 rounded-lg transition-colors ${view === 'admin' ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400'}`}
                  title="Quản lý người dùng"
                >
                  <Shield className="w-5 h-5" />
                </button>

                <div className="flex-1 max-w-xl mx-auto hidden md:block">
                  <div className="relative group">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-blue-500 transition-colors" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm sinh viên (Tên hoặc MSV)..."
                      className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-800 border-transparent focus:bg-white dark:focus:bg-slate-900 border focus:border-blue-500 rounded-lg text-sm transition-all outline-none text-slate-900 dark:text-slate-100 font-medium placeholder-slate-500"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                </div>
              </div>
            )}

            {isVipLimitReached && role === 0 && (
              <Link
                href="/vip"
                className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-amber-400 to-amber-600 text-white rounded-full text-[10px] font-black uppercase tracking-tighter shadow-sm hover:scale-105 transition-transform"
              >
                <div className="w-4 h-4 rounded-full bg-white flex items-center justify-center">
                  <Star className="w-2.5 h-2.5 text-amber-600 fill-amber-600" />
                </div>
                UPGRADE VIP
              </Link>
            )}

            <UserMenu username={username} onLogout={handleLogout} />

            {role === 0 && (
              <button
                onClick={() => setShowClassPicker(true)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all ${selectedClass
                  ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  : 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 animate-pulse'
                  }`}
              >
                <MapPin className="w-4 h-4" />
                <span className="text-xs font-bold">{selectedClass || 'Chọn lớp'}</span>
              </button>
            )}

          </div>
        </div>
      </header >

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Functional Breadcrumbs */}
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-6 bg-white dark:bg-slate-900 px-4 py-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
          <div
            className="flex items-center gap-1.5 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer font-medium transition-colors"
            onClick={loadClasses}
          >
            <HomeIcon className="w-4 h-4" />
            <span>Danh sách lớp</span>
          </div>

          {view !== 'classes' && (
            <>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600" />
              {view === 'search' ? (
                <span className="font-semibold text-slate-900 dark:text-white">Tìm kiếm: "{searchQuery}"</span>
              ) : (
                <>
                  <span
                    className={`hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer transition-colors ${!selectedClass ? 'hidden' : ''}`}
                    onClick={() => loadStudents(selectedClass)}
                  >
                    {selectedClass}
                  </span>
                  {view === 'admin' && (
                    <span className="font-semibold text-slate-900 dark:text-white">Quản trị hệ thống</span>
                  )}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20"
            >
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-slate-500 font-medium">Đang xử lý...</p>
            </motion.div>
          ) : (
            <>
              {view === 'classes' && (
                <div className="space-y-6">
                  {role !== 0 && (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white">Chế độ so sánh</h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400">Chọn nhiều lớp để so sánh điểm số</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {compareMode && selectedClasses.length > 0 && (
                          <button
                            onClick={() => loadStudents(selectedClasses)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center gap-2"
                          >
                            <Award className="w-4 h-4" />
                            So sánh {selectedClasses.length} lớp
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setCompareMode(!compareMode);
                            setSelectedClasses([]);
                          }}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${compareMode ? 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                        >
                          {compareMode ? 'Hủy bỏ' : 'Chọn nhiều lớp'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Hero Section */}
                  <HeroSection
                    username={username}
                    totalClasses={role === 0 ? (selectedClass ? 1 : 0) : classes.length}
                    totalStudents={totalStudentCount}
                    onlineUsers={onlineUsers}
                    role={role}
                  />

                  {/* Role 0: Show only selected class or prompt to pick */}
                  {role === 0 ? (
                    selectedClass ? (
                      <div className="grid grid-cols-1 gap-3">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          whileHover={{ y: -5, transition: { duration: 0.2 } }}
                          onClick={() => loadStudents(selectedClass)}
                          className="bg-white dark:bg-slate-800 p-5 rounded-xl border border-indigo-200 dark:border-indigo-700 transition-all flex items-center gap-4 group cursor-pointer shadow-sm hover:shadow-lg hover:border-indigo-400"
                        >
                          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 group-hover:scale-110 transition-transform">
                            <MapPin className="w-6 h-6" />
                          </div>
                          <div className="flex-1">
                            <div className="font-bold text-lg text-slate-900 dark:text-white">{selectedClass}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Nhấn để xem danh sách sinh viên</div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors" />
                        </motion.div>
                      </div>
                    ) : (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Vui lòng chọn lớp để bắt đầu</p>
                        <button
                          onClick={() => setShowClassPicker(true)}
                          className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
                        >
                          Chọn lớp
                        </button>
                      </div>
                    )
                  ) : (
                    /* Role 1 (Admin): Show all classes grid */
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      {classes.map((cls, index) => (
                        <motion.div
                          key={cls}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          whileHover={{ y: -5, transition: { duration: 0.2 } }}
                          onClick={() => compareMode ? toggleClassSelection(cls) : loadStudents(cls)}
                          className={`bg-white dark:bg-slate-800 p-3 md:p-5 rounded-xl border transition-all flex flex-col items-center justify-center gap-3 group relative overflow-hidden shadow-sm hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 ${compareMode && selectedClasses.includes(cls)
                            ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500'
                            : 'border-slate-100 dark:border-slate-700'
                            } cursor-pointer`}
                        >
                          {compareMode && (
                            <div className={`absolute top-2 right-2 w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${selectedClasses.includes(cls) ? 'bg-indigo-600 border-indigo-600' : 'bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600'
                              }`}>
                              {selectedClasses.includes(cls) && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                            </div>
                          )}
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${compareMode && selectedClasses.includes(cls) ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-700 dark:to-slate-700 text-indigo-600 dark:text-indigo-300'
                            } group-hover:scale-110 transition-transform shadow-inner`}>
                            <span className="font-bold text-sm tracking-tight">{cls.substring(0, 2)}</span>
                          </div>
                          <div className={`font-semibold text-sm truncate w-full text-center group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ${compareMode && selectedClasses.includes(cls) ? 'text-indigo-900 dark:text-indigo-200' : 'text-slate-600 dark:text-slate-300'
                            }`}>{cls}</div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {view === 'admin' && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <AdminUserList />
                </motion.div>
              )}

              {(view === 'students' || view === 'search') && (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50 gap-4 transition-colors">
                    <div className="flex items-center gap-4">
                      <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        {view === 'search' ? 'Kết quả tìm kiếm' : `Lớp ${selectedClass}`}
                        <span className="text-xs font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-600">
                          {filteredStudents.length}
                        </span>
                      </h3>

                      {/* Sort Toggle */}
                      {view === 'students' && (
                        <div className="flex items-center gap-2">
                          {/* Scale Toggle */}
                          <button
                            onClick={() => setSortingScale(sortingScale === '4' ? '10' : '4')}
                            className={`h-8 px-3 text-xs font-bold rounded-md border transition-all flex items-center gap-1.5 ${sortingScale === '10'
                              ? 'bg-indigo-600 border-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                              }`}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${sortingScale === '10' ? 'text-indigo-200' : 'text-indigo-500'}`} />
                            Hệ {sortingScale}
                          </button>

                          {/* Semester Dropdown */}
                          <select
                            value={selectedSemester}
                            onChange={(e) => setSelectedSemester(e.target.value)}
                            className="px-2 py-1 text-xs font-medium bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md outline-none focus:border-blue-500 text-slate-700 dark:text-slate-300 h-8"
                          >
                            <option value="all">Tích lũy (All)</option>
                            {allSemesters.map(sem => (
                              <option key={sem} value={sem}>{sem}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {view === 'students' && (
                      <div className="relative max-w-xs w-full">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Tìm trong lớp này..."
                          className="w-full pl-9 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-slate-900 dark:text-slate-100 font-medium placeholder-slate-400"
                          value={localSearchTerm}
                          onChange={(e) => setLocalSearchTerm(e.target.value)}
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 divide-y divide-gray-100 dark:divide-slate-700">
                    {filteredStudents.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                        {localSearchTerm ? 'Không tìm thấy sinh viên phù hợp.' : 'Không có dữ liệu.'}
                      </div>
                    ) : (
                      filteredStudents.map((sv) => (
                        <div
                          key={sv.msv}
                          onClick={() => loadGrade(sv.msv)}
                          className="p-3 md:p-4 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors flex items-center gap-3 md:gap-4 group"
                        >
                          <div className="relative">
                            <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center text-slate-400 dark:text-slate-300 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              <span className="font-bold text-2xl">{sv.ho_ten.charAt(0).toUpperCase()}</span>
                            </div>

                            {/* GPA Badge - Even Bigger */}
                            {/* GPA Badges Comparison */}
                            <div className="absolute -bottom-2 -right-2 flex gap-1 z-10">
                              {/* Cumulative GPA Badge */}
                              {(() => {
                                const cumGPA = calculateCumulativeGPA(sv);
                                const val = sortingScale === '4' ? cumGPA.gpa4 : cumGPA.gpa10;
                                return (
                                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white border-2 border-white dark:border-slate-800 shadow-md ${sortingScale === '4'
                                    ? (val >= 3.2 ? 'bg-green-500' : val >= 2.5 ? 'bg-yellow-500' : 'bg-red-500')
                                    : (val >= 8.0 ? 'bg-green-500' : val >= 6.5 ? 'bg-yellow-500' : 'bg-red-500')
                                    }`}
                                    title={`GPA Tích lũy (Hệ ${sortingScale})`}
                                  >
                                    {val.toFixed(2)}
                                  </div>
                                );
                              })()}

                              {/* Semester GPA Badge (Only if a specific semester is selected) */}
                              {selectedSemester !== 'all' && (
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white border-2 border-white dark:border-slate-800 shadow-md ${sortingScale === '4'
                                  ? (calculateSemesterGPA(sv, selectedSemester).gpa4 >= 3.2 ? 'bg-green-500' : calculateSemesterGPA(sv, selectedSemester).gpa4 >= 2.5 ? 'bg-yellow-500' : 'bg-red-500')
                                  : (calculateSemesterGPA(sv, selectedSemester).gpa10 >= 8.0 ? 'bg-green-500' : calculateSemesterGPA(sv, selectedSemester).gpa10 >= 6.5 ? 'bg-yellow-500' : 'bg-red-500')
                                  }`}
                                  title={`GPA Học kỳ (Hệ ${sortingScale})`}
                                >
                                  {sortingScale === '4' ? calculateSemesterGPA(sv, selectedSemester).gpa4 : calculateSemesterGPA(sv, selectedSemester).gpa10}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="font-bold text-base md:text-lg text-slate-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-400 break-words">{sv.ho_ten}</div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                              {role !== 0 && (
                                <>
                                  <span className="font-mono">{sv.msv}</span>
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                </>
                              )}
                              <span>{sv.ngay_sinh}</span>
                            </div>
                          </div>

                          {sv.ma_lop && (
                            <div className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 rounded-md text-sm font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
                              {sv.ma_lop}
                            </div>
                          )}

                          <ChevronRight className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-400 group-hover:translate-x-1 transition-all" />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {view === 'grades' && currentStudent && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="grid grid-cols-1 lg:grid-cols-4 gap-6"
                >
                  {/* Detailed Sidebar Info */}
                  <div className="lg:col-span-1 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 sticky top-24 transition-colors">
                      <div className="flex flex-col items-center text-center pb-6 border-b border-slate-100 dark:border-slate-700">
                        <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-3">
                          <UserIconBig />
                        </div>
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentStudent.ho_ten}</h2>
                        {role !== 0 && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 font-mono mt-1">{currentStudent.msv}</p>
                        )}
                      </div>
                      <div className="pt-4 space-y-3">
                        <InfoRow label="Lớp" value={currentStudent.ma_lop} />
                        {role !== 0 && (
                          <>
                            <InfoRow label="Ngày sinh" value={currentStudent.ngay_sinh} />
                            <InfoRow label="Nơi sinh" value={currentStudent.noi_sinh} />
                          </>
                        )}
                      </div>
                      <div className="mt-6 p-4 bg-slate-900 dark:bg-indigo-950/50 border border-slate-800 dark:border-indigo-900/50 rounded-lg text-white text-center shadow-inner">
                        <div className="text-xs uppercase tracking-wider opacity-70 mb-1 text-slate-300 dark:text-indigo-200">GPA Tích Lũy</div>
                        <div className="text-3xl font-bold text-white dark:text-indigo-100">{gpa}</div>
                      </div>
                    </div>
                  </div>

                  {/* Main Content */}
                  <div className="lg:col-span-3 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-bold text-slate-800 dark:text-white">Bảng Điểm Chi Tiết</h3>
                    </div>

                    {sortedSemesterKeys.map(hk => {
                      const semesterGrades = gradesBySemester[hk];
                      const semGPA = calculateSemesterGPA(currentStudent, hk);
                      const displayGPA = (sortingScale === '4' ? semGPA.gpa4 : semGPA.gpa10).toFixed(2);

                      return (
                        <SemesterAccordion
                          key={hk}
                          semester={hk}
                          grades={semesterGrades}
                          gpa={displayGPA}
                        />
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>

        {/* Global Class Picker Overlay */}
        <AnimatePresence>
          {showClassPicker && (
            <ClassPicker
              classes={classes}
              currentClass={selectedClass}
              onClassSelected={(cls) => {
                setSelectedClass(cls);
                // Refresh data for the new class
                loadStudents(cls);

                // Check if limit reached after selection
                const count = parseInt(localStorage.getItem('classChanges') || '0');
                if (count >= 3) setIsVipLimitReached(true);
              }}
              onClose={selectedClass ? () => setShowClassPicker(false) : undefined}
            />
          )}
        </AnimatePresence>
      </main>

      {/* GPA Simulator Modal/Section */}
      <AnimatePresence>
        {view === 'grades' && currentStudent && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-40"
          >
            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full relative transition-colors">
              <button
                onClick={() => {
                  const el = document.getElementById('gpa-simulator-container');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="absolute -top-3 -right-3 bg-indigo-600 text-white p-2 rounded-full shadow-lg hover:bg-indigo-700 transition"
              >
                <Sparkles className="w-5 h-5" />
              </button>
              <div className="text-sm font-medium text-slate-600 dark:text-slate-200 mb-2">Xem điểm tích lũy dự kiến?</div>
              <div className="text-xs text-slate-400 dark:text-slate-400">Cuộn xuống dưới cùng để thêm môn học dự kiến.</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {
        view === 'grades' && currentStudent && (
          <div id="gpa-simulator-container" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
            <div className="mt-12 border-t border-slate-200 pt-8">
              <h2 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <Sparkles className="w-6 h-6 text-indigo-500" />
                Mô phỏng Điểm Tích Lũy
              </h2>
              <GPASimulator currentCredits={totalCredits} currentPoints={totalPoints} />
            </div>
          </div>
        )
      }

    </div >
  );
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function UserIconBig() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 text-blue-600">
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

function InfoRow({ label, value }: { label: string, value?: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-900 dark:text-slate-200">{value || '--'}</span>
    </div>
  )
}
