"use client";

import { useState, useMemo } from 'react';
import { Plus, Trash2, Calculator, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface GPASimulatorProps {
    currentCredits: number;
    currentPoints: number; // This is sum(score * credit)
}

interface SimulatedSubject {
    id: string;
    name: string;
    credit: number;
    score: number;
}

export default function GPASimulator({ currentCredits, currentPoints }: GPASimulatorProps) {
    const [subjects, setSubjects] = useState<SimulatedSubject[]>([]);
    const [newCredit, setNewCredit] = useState(3);
    const [newScore, setNewScore] = useState(4.0);

    const { projectedGPA, additionalCredits } = useMemo(() => {
        const simPoints = subjects.reduce((acc, sub) => acc + (sub.score * sub.credit), 0);
        const simCredits = subjects.reduce((acc, sub) => acc + sub.credit, 0);

        const totalPoints = currentPoints + simPoints;
        const totalCredits = currentCredits + simCredits;

        return {
            projectedGPA: totalCredits > 0 ? (totalPoints / totalCredits).toFixed(2) : 'N/A',
            additionalCredits: simCredits
        };
    }, [currentCredits, currentPoints, subjects]);

    const addSubject = () => {
        if (newCredit <= 0 || newScore < 0 || newScore > 4) return;

        const newSubject: SimulatedSubject = {
            id: Math.random().toString(36).substr(2, 9),
            name: `Môn dự kiến ${subjects.length + 1}`,
            credit: newCredit,
            score: newScore
        };

        setSubjects([...subjects, newSubject]);
    };

    const removeSubject = (id: string) => {
        setSubjects(subjects.filter(s => s.id !== id));
    };

    if (currentCredits === 0) return null;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-6 transition-colors">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                    <Calculator className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-900 dark:text-white">Tính điểm tích lũy dự kiến</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Thêm các môn học kỳ tới để xem GPA thay đổi thế nào</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left: Input & List */}
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Tín chỉ</label>
                            <input
                                type="number"
                                value={newCredit}
                                onChange={(e) => setNewCredit(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-colors placeholder-slate-400 dark:placeholder-slate-600"
                                min="1" max="10"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Điểm (hệ 4)</label>
                            <input
                                type="number"
                                value={newScore}
                                onChange={(e) => setNewScore(Number(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 dark:text-white transition-colors placeholder-slate-400 dark:placeholder-slate-600"
                                min="0" max="4" step="0.1"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={addSubject}
                                className="px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 transition-colors flex items-center justify-center shadow-lg shadow-blue-500/20"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        <AnimatePresence initial={false}>
                            {subjects.map(sub => (
                                <motion.div
                                    key={sub.id}
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 rounded-lg border border-slate-100 dark:border-slate-700/50 group transition-colors hover:bg-slate-100 dark:hover:bg-slate-900"
                                >
                                    <div className="text-sm">
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{sub.name}</span>
                                        <span className="text-slate-400 dark:text-slate-600 mx-2">|</span>
                                        <span className="text-slate-500 dark:text-slate-400">{sub.credit} tín</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-slate-900 dark:text-white">{sub.score}</span>
                                        <button
                                            onClick={() => removeSubject(sub.id)}
                                            className="text-slate-400 hover:text-red-500 dark:text-slate-500 dark:hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {subjects.length === 0 && (
                            <p className="text-center text-sm text-slate-400 dark:text-slate-500 py-4 italic">Chưa có môn dự kiến nào</p>
                        )}
                    </div>
                </div>

                {/* Right: Result */}
                <div className="bg-indigo-600 dark:bg-indigo-900 rounded-xl p-6 text-white flex flex-col justify-center items-center text-center relative overflow-hidden ring-1 ring-inset ring-white/10 dark:ring-white/5 transition-colors shadow-lg">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <RefreshCw className="w-24 h-24" />
                    </div>

                    <div className="relative z-10">
                        <div className="text-indigo-200 dark:text-indigo-300 text-sm font-medium mb-1 uppercase tracking-wider">GPA Tích Lũy Dự Kiến</div>
                        <div className="text-5xl font-bold mb-4 tracking-tight text-white dark:text-indigo-50">
                            {projectedGPA}
                        </div>

                        <div className="inline-flex items-center gap-2 bg-indigo-500/50 dark:bg-indigo-950/50 px-3 py-1.5 rounded-full text-sm border border-indigo-400/30 dark:border-indigo-500/30 text-white dark:text-indigo-200">
                            <span>+{additionalCredits} tín chỉ mới</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
