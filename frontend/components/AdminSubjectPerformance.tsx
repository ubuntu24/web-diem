'use client';

import { useState, useEffect } from 'react';
import { 
    Search, BookOpen, Loader2, ChevronRight, Users, 
    Award, BarChart2, Filter, LayoutGrid, List,
    ChevronDown, ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAdminSubjectsBffRaw, getAdminSubjectScoresBffRaw } from '@/lib/api';
import { toast } from 'react-hot-toast';

interface Subject {
    code: string;
    name: string;
}

interface ScoreRecord {
    msv: string;
    ho_ten: string;
    score: number | null;
    total_10: number | null;
    letter: string | null;
    semester: string | null;
}

interface ClassGroup {
    [className: string]: ScoreRecord[];
}

export default function AdminSubjectPerformance() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [loadingSubjects, setLoadingSubjects] = useState(true);
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [subjectData, setSubjectData] = useState<ClassGroup | null>(null);
    const [loadingData, setLoadingData] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

    useEffect(() => {
        const fetchSubjects = async () => {
            try {
                const res = await getAdminSubjectsBffRaw();
                if (res) {
                    setSubjects(JSON.parse(res));
                }
            } catch (error) {
                toast.error('Không thể tải danh sách bản ghi');
            } finally {
                setLoadingSubjects(false);
            }
        };
        fetchSubjects();
    }, []);

    const handleSelectSubject = async (subject: Subject) => {
        setSelectedSubject(subject);
        setLoadingData(true);
        try {
            const res = await getAdminSubjectScoresBffRaw(subject.code);
            if (res) {
                setSubjectData(JSON.parse(res));
            }
        } catch (error) {
            toast.error('Không thể tải dữ liệu hiệu suất');
        } finally {
            setLoadingData(false);
        }
    };

    const handleSelectAllCodes = async (items: Subject[]) => {
        const firstName = items[0].name;
        setSelectedSubject({ code: 'ALL', name: firstName });
        setLoadingData(true);
        try {
            const results = await Promise.all(
                items.map(s => getAdminSubjectScoresBffRaw(s.code))
            );
            
            const mergedData: ClassGroup = {};
            results.forEach(res => {
                if (res) {
                    const data: ClassGroup = JSON.parse(res);
                    Object.entries(data).forEach(([className, records]) => {
                        if (!mergedData[className]) mergedData[className] = [];
                        // Combine records, potentially deduplicating if needed, but here we just append
                        mergedData[className] = [...mergedData[className], ...records];
                    });
                }
            });
            setSubjectData(mergedData);
        } catch (error) {
            toast.error('Lỗi khi tải dữ liệu tổng hợp');
        } finally {
            setLoadingData(false);
        }
    };

    const [expandedGroups, setExpandedGroups] = useState<string[]>([]);
    const [expandedClasses, setExpandedClasses] = useState<string[]>([]);

    useEffect(() => {
        setExpandedClasses([]);
    }, [selectedSubject]);

    const toggleGroup = (name: string) => {
        setExpandedGroups(prev => 
            prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name]
        );
    };

    const groupedSubjects = (subjects: Subject[]) => {
        const groups: { [name: string]: Subject[] } = {};
        subjects.forEach(s => {
            if (!groups[s.name]) groups[s.name] = [];
            groups[s.name].push(s);
        });
        return Object.entries(groups).map(([name, items]) => ({ name, items }));
    };

    const filteredSubjects = subjects.filter(s => 
        (s.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
        (s.code || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <BookOpen className="w-32 h-32 text-indigo-600 rotate-12" />
                </div>
                
                <div className="relative z-10">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                            <BarChart2 className="w-6 h-6" />
                        </div>
                        Hiệu Suất Theo Môn
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400 mt-1 max-w-lg">
                        Phân tích kết quả học tập của tất cả người dùng theo từng bản ghi cụ thể. 
                        Dữ liệu được phân nhóm theo lớp để dễ dàng theo dõi.
                    </p>
                </div>

                <div className="mt-8 flex flex-col md:flex-row gap-4 items-center">
                    <div className="relative flex-1 w-full">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm bản ghi (Tên hoặc mã)..."
                            className="w-full pl-12 pr-4 py-3 bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-950 border-2 focus:border-indigo-500 rounded-2xl text-sm transition-all outline-none text-slate-900 dark:text-white font-bold"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    
                    {selectedSubject && (
                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
                            <button 
                                onClick={() => setViewMode('grid')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <LayoutGrid className="w-5 h-5" />
                            </button>
                            <button 
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500'}`}
                            >
                                <List className="w-5 h-5" />
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Subject Selector Sidebar */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col max-h-[600px]">
                        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                            <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">Danh sách bản ghi</span>
                            <span className="text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">{filteredSubjects.length}</span>
                        </div>
                        <div className="overflow-y-auto flex-1 p-2 space-y-1 custom-scrollbar">
                            {loadingSubjects ? (
                                <div className="py-20 flex flex-col items-center justify-center opacity-50">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
                                    <span className="text-xs font-medium">Đang tải...</span>
                                </div>
                            ) : filteredSubjects.length === 0 ? (
                                <div className="py-20 text-center text-slate-400 text-xs italic">Không tìm thấy bản ghi nào</div>
                            ) : (
                                groupedSubjects(filteredSubjects).map(({ name, items }, gIndex) => {
                                    const isExpanded = expandedGroups.includes(name) || searchQuery.length > 0;
                                    const hasMultiple = items.length > 1;
                                    const isActive = items.some(s => s.code === selectedSubject?.code) || (selectedSubject?.code === 'ALL' && selectedSubject?.name === name);
                                    const isAllSelected = selectedSubject?.code === 'ALL' && selectedSubject?.name === name;

                                    return (
                                        <div key={name} className="space-y-1">
                                            <button
                                                onClick={() => hasMultiple ? toggleGroup(name) : handleSelectSubject(items[0])}
                                                className={`w-full text-left p-3 rounded-xl transition-all flex items-center gap-3 group ${(!hasMultiple && isActive) || (hasMultiple && isAllSelected) ? 'bg-indigo-600 text-white shadow-lg' : 'hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-700 dark:text-slate-300'}`}
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors ${(!hasMultiple && isActive) || (hasMultiple && isAllSelected) ? 'bg-white/20' : 'bg-indigo-500/10 text-indigo-600'}`}>
                                                    <BookOpen className="w-4 h-4" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-sm truncate leading-tight">{name}</p>
                                                    {!hasMultiple && (
                                                        <p className={`text-[10px] font-mono mt-0.5 ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{items[0].code}</p>
                                                    )}
                                                    {hasMultiple && (
                                                        <p className={`text-[10px] font-bold mt-0.5 uppercase tracking-tighter ${isAllSelected ? 'text-indigo-100' : 'text-indigo-500'}`}>{items.length} phiên bản mã</p>
                                                    )}
                                                </div>
                                                {hasMultiple ? (
                                                    isExpanded ? <ChevronUp className="w-4 h-4 opacity-50" /> : <ChevronDown className="w-4 h-4 opacity-50" />
                                                ) : (
                                                    <ChevronRight className={`w-4 h-4 transition-transform ${isActive ? 'translate-x-1' : 'opacity-0 group-hover:opacity-100'}`} />
                                                )}
                                            </button>

                                            <AnimatePresence>
                                                {hasMultiple && isExpanded && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: 'auto', opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="overflow-hidden ml-4 pl-4 border-l-2 border-slate-100 dark:border-slate-800 space-y-1"
                                                    >
                                                        {/* Option to select all versions */}
                                                        <button
                                                            onClick={() => handleSelectAllCodes(items)}
                                                            className={`w-full text-left p-2 rounded-lg text-xs font-bold transition-all flex items-center justify-between group ${isAllSelected ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}
                                                        >
                                                            <span>Tất cả phiên bản</span>
                                                            {isAllSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                                        </button>

                                                        {items.map((s, sIndex) => (
                                                            <button
                                                                key={`${s.code}-${sIndex}`}
                                                                onClick={() => handleSelectSubject(s)}
                                                                className={`w-full text-left p-2 rounded-lg text-xs font-medium transition-all flex items-center justify-between group ${selectedSubject?.code === s.code ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 font-bold' : 'text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-900/50'}`}
                                                            >
                                                                <span className="font-mono">{s.code}</span>
                                                                {selectedSubject?.code === s.code && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                                                            </button>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>

                {/* Performance Display Area */}
                <div className="lg:col-span-8">
                    <AnimatePresence mode="wait">
                        {!selectedSubject ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full min-h-[400px] bg-slate-50/50 dark:bg-slate-900/50 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center p-8 text-center"
                            >
                                <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-3xl shadow-xl flex items-center justify-center text-slate-300 dark:text-slate-600 mb-6">
                                    <Filter className="w-10 h-10" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Chưa chọn bản ghi</h3>
                                <p className="text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
                                    Vui lòng chọn một bản ghi từ danh sách bên trái để xem chi tiết hiệu suất của người dùng.
                                </p>
                            </motion.div>
                        ) : loadingData ? (
                            <motion.div 
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="h-full min-h-[400px] flex flex-col items-center justify-center"
                            >
                                <Loader2 className="w-12 h-12 text-indigo-600 animate-spin mb-4" />
                                <p className="font-bold text-slate-600 dark:text-slate-400">Đang tải dữ liệu hiệu suất...</p>
                                <p className="text-xs text-slate-400 mt-1 italic">Vui lòng đợi trong giây lát</p>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-6"
                            >
                                <div className="flex items-center justify-between px-2">
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-8 bg-indigo-600 rounded-full" />
                                        <div>
                                            <h3 className="text-xl font-black text-slate-900 dark:text-white">
                                                {selectedSubject.name}
                                            </h3>
                                            <p className="text-xs font-bold text-indigo-500 uppercase tracking-widest">
                                                {selectedSubject.code === 'ALL' ? 'Tất cả phiên bản mã' : selectedSubject.code}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-black text-slate-400 uppercase">Tổng số lớp</p>
                                        <div className="flex items-center gap-4 justify-end">
                                            <p className="text-2xl font-black text-indigo-600">{Object.keys(subjectData || {}).length}</p>
                                            <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                                <button 
                                                    onClick={() => setExpandedClasses(Object.keys(subjectData || {}))}
                                                    className="px-2 py-1 text-[10px] font-bold hover:text-indigo-600 transition-colors"
                                                >
                                                    Mở tất cả
                                                </button>
                                                <div className="w-px h-3 bg-slate-300 dark:bg-slate-700 self-center mx-1" />
                                                <button 
                                                    onClick={() => setExpandedClasses([])}
                                                    className="px-2 py-1 text-[10px] font-bold hover:text-indigo-600 transition-colors"
                                                >
                                                    Thu gọn
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {Object.keys(subjectData || {}).length === 0 ? (
                                    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center">
                                        <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                                        <p className="text-slate-500 font-bold">Không tìm thấy dữ liệu cho bản ghi này</p>
                                    </div>
                                ) : (
                                    <div className={viewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 gap-4" : "space-y-4"}>
                                        {Object.entries(subjectData || {}).map(([className, records], idx) => {
                                            const isClassExpanded = expandedClasses.includes(className);
                                            return (
                                                <motion.div
                                                    key={className}
                                                    initial={{ opacity: 0, scale: 0.95 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-fit"
                                                >
                                                    <button 
                                                        onClick={() => setExpandedClasses(prev => prev.includes(className) ? prev.filter(c => c !== className) : [...prev, className])}
                                                        className={`px-5 py-4 flex justify-between items-center transition-colors ${isClassExpanded ? 'bg-slate-50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700' : 'hover:bg-slate-50/50 dark:hover:bg-slate-900/30'}`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${isClassExpanded ? 'bg-indigo-600 text-white' : 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600'}`}>
                                                                <Users className="w-4 h-4" />
                                                            </div>
                                                            <span className="font-black text-slate-900 dark:text-white">{className}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-[10px] font-bold bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700">
                                                                {records.length} NGƯỜI DÙNG
                                                            </span>
                                                            {isClassExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                                                        </div>
                                                    </button>
                                                    
                                                    <AnimatePresence>
                                                        {isClassExpanded && (
                                                            <motion.div
                                                                initial={{ height: 0, opacity: 0 }}
                                                                animate={{ height: 'auto', opacity: 1 }}
                                                                exit={{ height: 0, opacity: 0 }}
                                                                className="overflow-hidden"
                                                            >
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full text-xs text-left">
                                                                        <thead className="bg-slate-50/50 dark:bg-slate-900/20 text-slate-400 uppercase font-bold">
                                                                            <tr>
                                                                                <th className="px-5 py-2">Họ tên</th>
                                                                                <th className="px-2 py-2 text-center">Điểm thi</th>
                                                                                <th className="px-5 py-2 text-right">Kỳ</th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                                            {[...records].sort((a, b) => {
                                                                                const nameA = (a.ho_ten || '').split(' ').pop() || '';
                                                                                const nameB = (b.ho_ten || '').split(' ').pop() || '';
                                                                                if (nameA !== nameB) return nameA.localeCompare(nameB, 'vi');
                                                                                return (a.ho_ten || '').localeCompare(b.ho_ten || '', 'vi');
                                                                            }).map((r, rIdx) => (
                                                                                <tr key={`${r.msv}-${rIdx}`} className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors group">
                                                                                    <td className="px-5 py-3 font-bold text-slate-700 dark:text-slate-300">
                                                                                        <div className="flex flex-col">
                                                                                            <span>{r.ho_ten}</span>
                                                                                            <span className="text-[9px] font-mono text-slate-400 group-hover:text-indigo-400 transition-colors uppercase">{r.msv}</span>
                                                                                        </div>
                                                                                    </td>
                                                                                    <td className="px-2 py-3 text-center">
                                                                                        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-lg font-black ${
                                                                                            (r.score || 0) >= 8.5 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                                                                                            (r.score || 0) >= 7.0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                                            (r.score || 0) >= 5.5 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                                                            'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                                                                                        }`}>
                                                                                            {r.score !== null ? r.score.toFixed(1) : '—'}
                                                                                        </div>
                                                                                        {r.letter && (
                                                                                            <span className="ml-1 text-[10px] font-black text-slate-400">{r.letter}</span>
                                                                                        )}
                                                                                    </td>
                                                                                    <td className="px-5 py-3 text-right">
                                                                                        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded-md uppercase">
                                                                                            {r.semester || 'N/A'}
                                                                                        </span>
                                                                                    </td>
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </motion.div>
                                                        )}
                                                    </AnimatePresence>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
