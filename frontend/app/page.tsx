"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, getStudentsByClass, getStudent, searchStudents, getStudentCount, getOnlineUsers } from '@/lib/api';
import { Student } from '@/lib/types';
import Sidebar from '@/components/Sidebar';
import SemesterAccordion from '@/components/SemesterAccordion';
import GPASimulator from '@/components/GPASimulator';
import { Search, Loader2, Skull, ChevronRight, Home as HomeIcon, Sparkles, ChevronLeft, Users, Award, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import UserMenu from '@/components/UserMenu';
import { getMe } from '@/lib/api';
import HeroSection from '@/components/HeroSection';
import AdminUserList from '@/components/AdminUserList';

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
  const [sortBy, setSortBy] = useState<'cumulative' | 'semester'>('cumulative');
  const [sortingScale, setSortingScale] = useState<'4' | '10'>('4');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [compareMode, setCompareMode] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState<string[]>([]);

  function calculateSemesterGPA(student: Student, semester: string): { gpa4: number, gpa10: number } {
    if (!student.diem) return { gpa4: 0, gpa10: 0 };
    // Normalize comparison to be safe
    const target = semester.trim().toLowerCase();
    const semesterGrades = student.diem.filter(d => (d.hoc_ky || '').trim().toLowerCase() === target);

    if (!semesterGrades.length) return { gpa4: 0, gpa10: 0 };

    let semPoints4 = 0;
    let semPoints10 = 0;
    let semCredits = 0;
    const subjectMap = new Map<string, { score4: number, score10: number, credit: number }>();

    semesterGrades.forEach(g => {
      const score4 = parseFloat(g.tong_ket_4);
      const score10 = parseFloat(g.tong_ket_10);
      const credit = parseInt(g.so_tin_chi);
      if (isNaN(score4) || isNaN(score10) || isNaN(credit) || credit === 0) return;

      // Handle Retakes
      if (subjectMap.has(g.ma_mon)) {
        const current = subjectMap.get(g.ma_mon)!;
        if (score4 > current.score4) {
          subjectMap.set(g.ma_mon, { score4, score10, credit });
        }
      } else {
        subjectMap.set(g.ma_mon, { score4, score10, credit });
      }
    });

    subjectMap.forEach(item => {
      semPoints4 += item.score4 * item.credit;
      semPoints10 += item.score10 * item.credit;
      semCredits += item.credit;
    });

    return {
      gpa4: semCredits > 0 ? parseFloat((semPoints4 / semCredits).toFixed(2)) : 0,
      gpa10: semCredits > 0 ? parseFloat((semPoints10 / semCredits).toFixed(2)) : 0
    };
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
      localStorage.setItem('role', user.role.toString());
    }).catch(() => {
      // Fallback or redirect if token invalid
      localStorage.removeItem('token');
      router.push('/login');
    });

    getStudentCount().then(count => setTotalStudentCount(count)).catch(console.error);

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

  async function loadStudents(maLop: string | string[]) {
    setLoading(true);
    const maLopStr = Array.isArray(maLop) ? maLop.join(',') : maLop;
    setSelectedClass(Array.isArray(maLop) ? `So sánh: ${maLop.join(', ')}` : maLop);
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
    if (!student.diem || student.diem.length === 0) {
      setGpa('N/A');
      return;
    }

    const subjectMap = new Map<string, { score4: number, score10: number, credit: number, name: string }>();

    student.diem.forEach(g => {
      const score4 = parseFloat(g.tong_ket_4);
      const score10 = parseFloat(g.tong_ket_10);
      const credit = parseInt(g.so_tin_chi);
      const name = g.ten_mon ? g.ten_mon.trim() : '';

      // 1. Filter out invalid numeric values
      if (isNaN(score4) || isNaN(score10) || isNaN(credit)) return;

      // 2. Exclude non-GPA subjects (Physical Education, Defense Education, etc.)
      const lowerName = name.toLowerCase();
      if (
        lowerName.includes('giáo dục thể chất') ||
        lowerName.includes('gdtc') ||
        lowerName.includes('giáo dục quốc phòng') ||
        lowerName.includes('gdqp') ||
        lowerName.includes('thể dục') ||
        credit === 0
      ) {
        return;
      }

      // 3. Handle Retakes: Keep the highest score for each subject (ma_mon)
      if (subjectMap.has(g.ma_mon)) {
        const current = subjectMap.get(g.ma_mon)!;
        if (score4 > current.score4) {
          subjectMap.set(g.ma_mon, { score4, score10, credit, name });
        }
      } else {
        subjectMap.set(g.ma_mon, { score4, score10, credit, name });
      }
    });

    let tPoints4 = 0;
    let tPoints10 = 0;
    let tCredits = 0;

    subjectMap.forEach(item => {
      tPoints4 += item.score4 * item.credit;
      tPoints10 += item.score10 * item.credit;
      tCredits += item.credit;
    });

    setTotalPoints(sortingScale === '4' ? tPoints4 : tPoints10);
    setTotalCredits(tCredits);

    const calc4 = tCredits > 0 ? (tPoints4 / tCredits).toFixed(2) : 'N/A';
    const calc10 = tCredits > 0 ? (tPoints10 / tCredits).toFixed(2) : 'N/A';

    setGpa(sortingScale === '4' ? calc4 : calc10);
  }

  const gradesBySemester = currentStudent?.diem.reduce((acc, grade) => {
    const hk = grade.hoc_ky || 'Khác';
    if (!acc[hk]) acc[hk] = [];
    acc[hk].push(grade);
    return acc;
  }, {} as Record<string, typeof currentStudent.diem>) || {};

  const sortedSemesterKeys = Object.keys(gradesBySemester).sort((a, b) => {
    const parse = (s: string) => {
      const match = s.match(/^(.+?) \((\d{4})\s*-\s*(\d{4})\)$/);
      if (!match) return { year: 0, sem: 0 };
      const semStr = match[1];
      const year = parseInt(match[2]);
      let sem = 0;
      if (semStr === '1') sem = 1;
      else if (semStr === '2') sem = 2;
      else if (semStr.toLowerCase().includes('phu')) sem = 3;
      return { year, sem };
    };

    const pa = parse(a);
    const pb = parse(b);

    if (pa.year !== pb.year) return pb.year - pa.year;
    return pb.sem - pa.sem;
  });

  // Extract unique semesters from all students for the dropdown
  const allSemesters = Array.from(new Set(students.flatMap(s => s.diem ? s.diem.map(d => (d.hoc_ky || '').trim()) : [])))
    .filter(Boolean) // Remove empty strings
    .sort((a, b) => {
      const parse = (s: string) => {
        const match = s.match(/^(.+?) \((\d{4})\s*-\s*(\d{4})\)$/);
        if (!match) return { year: 0, sem: 0 };
        const semStr = match[1];
        const year = parseInt(match[2]);
        let sem = 0;
        if (semStr === '1') sem = 1;
        else if (semStr === '2') sem = 2;
        else if (semStr.toLowerCase().includes('phu')) sem = 3;
        return { year, sem };
      };
      const pa = parse(a);
      const pb = parse(b);
      if (pa.year !== pb.year) return pb.year - pa.year;
      return pb.sem - pa.sem;
    });

  // Debugging Semester Calculation
  useEffect(() => {
    if (selectedSemester !== 'all' && students.length > 0) {
      console.log(`Debug: Calculating GPA for semester '${selectedSemester}'`);
      const sampleStudent = students[0];
      if (sampleStudent.diem) {
        const grades = sampleStudent.diem.filter(d => (d.hoc_ky || '').trim().toLowerCase() === selectedSemester.trim().toLowerCase());
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
      valA = (sortingScale === '4' ? a.gpa : a.gpa10) || 0;
    } else {
      // Sort by semester GPA
      const semGPA = calculateSemesterGPA(a, selectedSemester);
      valA = sortingScale === '4' ? semGPA.gpa4 : semGPA.gpa10;
    }

    // Determine the value to sort by for student B
    let valB = 0;
    if (selectedSemester === 'all') {
      valB = (sortingScale === '4' ? b.gpa : b.gpa10) || 0;
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

            <UserMenu username={username} onLogout={handleLogout} />
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
                  <HeroSection username={username} totalClasses={classes.length} totalStudents={totalStudentCount} onlineUsers={onlineUsers} />

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
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-extrabold text-white border-2 border-white dark:border-slate-800 shadow-md ${sortingScale === '4'
                                ? ((sv.gpa || 0) >= 3.2 ? 'bg-green-500' : (sv.gpa || 0) >= 2.5 ? 'bg-yellow-500' : 'bg-red-500')
                                : ((sv.gpa10 || 0) >= 8.0 ? 'bg-green-500' : (sv.gpa10 || 0) >= 6.5 ? 'bg-yellow-500' : 'bg-red-500')
                                }`}
                                title={`GPA Tích lũy (Hệ ${sortingScale})`}
                              >
                                {sortingScale === '4' ? sv.gpa : sv.gpa10}
                              </div>

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

                      // Calculate Semester GPA
                      let semPoints4 = 0;
                      let semPoints10 = 0;
                      let semCredits = 0;
                      semesterGrades.forEach(g => {
                        const score4 = parseFloat(g.tong_ket_4);
                        const score10 = parseFloat(g.tong_ket_10);
                        const credit = parseInt(g.so_tin_chi);
                        if (!isNaN(score4) && !isNaN(score10) && !isNaN(credit) && credit > 0) {
                          semPoints4 += score4 * credit;
                          semPoints10 += score10 * credit;
                          semCredits += credit;
                        }
                      });
                      const computedSemGPA4 = semCredits > 0 ? (semPoints4 / semCredits).toFixed(2) : 'N/A';
                      const computedSemGPA10 = semCredits > 0 ? (semPoints10 / semCredits).toFixed(2) : 'N/A';
                      const displayGPA = sortingScale === '4' ? computedSemGPA4 : computedSemGPA10;

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
