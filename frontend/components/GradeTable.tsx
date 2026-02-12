"use client";

import { useState } from 'react';
import { Grade } from '@/lib/types';
import { ChevronDown } from 'lucide-react';

interface GradeTableProps {
    grades: Grade[];
}

export default function GradeTable({ grades }: GradeTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-medium">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th className="px-6 py-4 font-bold tracking-wider">Môn Học</th>
                        <th className="px-6 py-4 font-bold tracking-wider text-center">Tín Chỉ</th>
                        <th className="px-6 py-4 font-bold tracking-wider text-center">Điểm Thi</th>
                        <th className="px-6 py-4 font-bold tracking-wider text-center">Tổng Kết</th>
                        <th className="px-6 py-4 font-bold tracking-wider text-center">Điểm Chữ</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                    {grades.map((grade, index) => {
                        const score = parseFloat(grade.tong_ket_10);
                        const isHigh = !isNaN(score) && score >= 8.5;
                        const isPass = grade.diem_chu !== 'F' && Boolean(grade.diem_chu);

                        return (
                            <GradeRow key={index} grade={grade} isPass={isPass} isHigh={isHigh} />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function GradeRow({ grade, isPass, isHigh }: { grade: Grade; isPass: boolean; isHigh: boolean }) {
    const [isOpen, setIsOpen] = useState(false);

    const getGradeColor = (diem_chu: string) => {
        if (!diem_chu) return 'bg-slate-100 text-slate-700 border-slate-200';
        const char = diem_chu.charAt(0).toUpperCase();

        switch (char) {
            case 'A': return 'bg-green-100 text-green-700 border-green-200';
            case 'B': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'C': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
            case 'D': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'F': return 'bg-red-100 text-red-700 border-red-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    const details = [
        { label: 'Chuyên Cần', value: grade.chuyen_can },
        { label: 'HS1 (L1)', value: grade.he_so_1_l1 },
        { label: 'HS1 (L2)', value: grade.he_so_1_l2 },
        { label: 'HS1 (L3)', value: grade.he_so_1_l3 },
        { label: 'HS1 (L4)', value: grade.he_so_1_l4 },
        { label: 'HS2 (L1)', value: grade.he_so_2_l1 },
        { label: 'HS2 (L2)', value: grade.he_so_2_l2 },
        { label: 'HS2 (L3)', value: grade.he_so_2_l3 },
        { label: 'HS2 (L4)', value: grade.he_so_2_l4 },
        { label: 'Thực Hành 1', value: grade.thuc_hanh_1 },
        { label: 'Thực Hành 2', value: grade.thuc_hanh_2 },
        { label: 'TB Thường Kỳ', value: grade.tb_thuong_ky },
        { label: 'Điều Kiện Thi', value: grade.dieu_kien_thi },
    ].filter(d => d.value);

    const hasDetails = details.length > 0;

    return (
        <>
            <tr
                className={`transition-all border-b border-slate-50 ${isHigh ? 'bg-blue-50/40' : 'hover:bg-slate-50'} ${hasDetails ? 'cursor-pointer' : ''} ${isOpen ? 'bg-slate-50/80' : ''}`}
                onClick={() => hasDetails && setIsOpen(!isOpen)}
            >
                <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                        <span className="line-clamp-2">{grade.ten_mon}</span>
                        {hasDetails && (
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
                        )}
                    </div>
                </td>
                <td className="px-6 py-4 text-center text-slate-500 font-bold">{grade.so_tin_chi}</td>
                <td className="px-6 py-4 text-center text-slate-600">{grade.diem_thi || '-'}</td>
                <td className="px-6 py-4 text-center font-bold text-slate-800">{grade.tong_ket_10 || '-'}</td>
                <td className="px-6 py-4 text-center">
                    <span
                        className={`inline-flex items-center justify-center min-w-[2.75rem] px-2.5 py-1 rounded-full text-[11px] font-black border transition-all hover:scale-110 shadow-sm ${getGradeColor(grade.diem_chu || '')}`}
                    >
                        {grade.diem_chu || '-'}
                    </span>
                </td>
            </tr>
            {hasDetails && isOpen && (
                <tr className="animate-in fade-in zoom-in-95 duration-300">
                    <td colSpan={5} className="px-6 py-6 bg-slate-50/50 border-b border-slate-100 shadow-inner">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {details.map((item, i) => (
                                <div key={i} className="bg-white p-3 rounded-xl border border-slate-200 shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col items-center text-center">
                                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 mb-1">{item.label}</div>
                                    <div className="text-base font-bold text-blue-600 font-mono">{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
