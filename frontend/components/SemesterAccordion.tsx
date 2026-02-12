"use client";

import { useState } from 'react';
import { Grade } from '@/lib/types';
import GradeTable from './GradeTable';
import { ChevronDown } from 'lucide-react';

interface SemesterAccordionProps {
    semester: string;
    grades: Grade[];
    gpa: string;
}

export default function SemesterAccordion({ semester, grades, gpa }: SemesterAccordionProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Filter out empty subjects (summary rows)
    const validGrades = grades.filter(g => g.ten_mon && g.ten_mon.trim() !== '');

    if (validGrades.length === 0) return null;

    return (
        <div className={`bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200 ${isOpen ? 'ring-2 ring-blue-500/10 shadow-md' : ''}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full px-6 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors ${isOpen ? 'bg-slate-50 border-b border-slate-200' : ''}`}
            >
                <div className="flex items-center gap-3">
                    <div className={`w-1 h-5 rounded-full ${isOpen ? 'bg-blue-600' : 'bg-slate-300'}`}></div>
                    <span className="font-bold text-lg text-slate-800">Học Kỳ {semester}</span>
                </div>

                <div className="flex items-center gap-4">
                    {gpa && (
                        <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 rounded-full text-sm text-slate-600 border border-slate-200">
                            <span>GPA:</span>
                            <span className="font-bold text-blue-600">{gpa}</span>
                        </div>
                    )}
                    <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>
            </button>

            {isOpen && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                    <GradeTable grades={validGrades} />
                </div>
            )}
        </div>
    );
}
