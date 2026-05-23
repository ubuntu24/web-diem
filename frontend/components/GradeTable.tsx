"use client";

import { useState, useCallback } from 'react';
import { Grade } from '@/lib/types';
import { getSubjectKey } from '@/lib/utils';
import { ChevronDown, RotateCcw, BookX, EyeOff, Eye, Loader2 } from 'lucide-react';

interface GradeTableProps {
    grades: Grade[];
    /** MSV của sinh viên đang xem — chỉ truyền khi admin role=1 đang xem người khác */
    adminMsv?: string;
}

/** Có điểm thi KN (thi lần 2) */
function _hasRetakeExam(grade: Grade): boolean {
    return !!(grade.diem_thi_kn_1 || grade.diem_thi_kn_2 || grade.diem_thi_kn_3 || grade.diem_thi_kn_4);
}

function _isRetake(grade: Grade): boolean {
    const tk10 = parseFloat(grade.tong_ket_10 || '');
    if (isNaN(tk10)) return false;
    const tk1 = parseFloat(grade.tong_ket_1 || '');
    const failedFirst = !isNaN(tk1) && tk1 < 4;
    const hasRetakeScore = _hasRetakeExam(grade);
    if (tk10 < 4) return !hasRetakeScore;
    else return failedFirst || hasRetakeScore;
}

function _isRelearn(grade: Grade): boolean {
    const tk10 = parseFloat(grade.tong_ket_10 || '');
    if (isNaN(tk10) || tk10 >= 4) return false;
    return _hasRetakeExam(grade);
}

export default function GradeTable({ grades, adminMsv }: GradeTableProps) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm text-left font-medium">
                <thead className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 transition-colors">
                    <tr>
                        <th className="px-3 md:px-6 py-3 md:py-4 font-bold tracking-wider">Bản Ghi</th>
                        <th className="px-2 md:px-6 py-3 md:py-4 font-bold tracking-wider text-center">Tín Chỉ</th>
                        <th className="px-2 md:px-6 py-3 md:py-4 font-bold tracking-wider text-center">Thành tích thi</th>
                        <th className="px-2 md:px-6 py-3 md:py-4 font-bold tracking-wider text-center">Thành Tích (hệ 4)</th>
                        <th className="px-2 md:px-6 py-3 md:py-4 font-bold tracking-wider text-center">Kết quả</th>
                        {adminMsv && <th className="px-2 md:px-6 py-3 md:py-4 font-bold tracking-wider text-center">Ẩn môn</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {grades.map((grade, index) => {
                        const score = parseFloat(grade.tong_ket_10);
                        const isHigh = !isNaN(score) && score >= 8.5;
                        return (
                            <GradeRow
                                key={index}
                                grade={grade}
                                isHigh={isHigh}
                                adminMsv={adminMsv}
                            />
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

type DetailItem = {
    label: string;
    value?: string | null;
    highlight?: boolean;
};

function GradeRow({ grade, isHigh, adminMsv }: { grade: Grade; isHigh: boolean; adminMsv?: string }) {
    const [isOpen, setIsOpen] = useState(false);
    const [hiding, setHiding] = useState(false);
    const [hidden, setHidden] = useState(false);

    const subjectKey = getSubjectKey(grade);

    const handleToggleHide = useCallback(async (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!adminMsv || !subjectKey) return;
        setHiding(true);
        try {
            const method = hidden ? 'DELETE' : 'POST';
            const res = await fetch('/api/bff/admin/hidden-subjects', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ msv: adminMsv, subject_key: subjectKey }),
            });
            if (res.ok) {
                setHidden(!hidden);
            } else {
                const err = await res.json().catch(() => ({}));
                alert(err?.detail || 'Lỗi khi cập nhật trạng thái ẩn');
            }
        } catch {
            alert('Lỗi kết nối');
        } finally {
            setHiding(false);
        }
    }, [adminMsv, subjectKey, hidden]);

    if (grade.loai_du_lieu === 'ChuanDauRa') {
        return (
            <tr className="border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-slate-900 dark:text-slate-200 min-w-[150px]">
                    {grade.ten_mon}
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center text-slate-500 dark:text-slate-400">
                    {grade.so_tin_chi || '-'}
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center text-slate-600 dark:text-slate-300">
                    {grade.diem_chu || '-'}
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center text-slate-600 dark:text-slate-300">
                    -
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center">
                    <span className={`inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-black border ${(grade.ket_qua || '').includes('Hoàn tất') ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'}`}>
                        {grade.ket_qua || '-'}
                    </span>
                </td>
                {adminMsv && <td />}
            </tr>
        );
    }

    const getGradeColor = (diem_chu: string) => {
        if (!diem_chu) return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        const char = diem_chu.charAt(0).toUpperCase();
        switch (char) {
            case 'A': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800';
            case 'B': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';
            case 'C': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800';
            case 'D': return 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border-orange-200 dark:border-orange-800';
            case 'F': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
            case 'P': return 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800';
            default: return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
        }
    };

    const details: DetailItem[] = [
        { label: 'Chuyên Cần', value: grade.chuyen_can },
        { label: 'Thường Kỳ 1', value: grade.thuong_ky_1 },
        { label: 'Thường Kỳ 2', value: grade.thuong_ky_2 },
        { label: 'Thường Kỳ 3', value: grade.thuong_ky_3 },
        { label: 'HS1 (L1)', value: grade.he_so_1_l1 },
        { label: 'HS1 (L2)', value: grade.he_so_1_l2 },
        { label: 'HS1 (L3)', value: grade.he_so_1_l3 },
        { label: 'HS1 (L4)', value: grade.he_so_1_l4 },
        { label: 'HS1 (L5)', value: grade.he_so_1_l5 },
        { label: 'HS1 (L6)', value: grade.he_so_1_l6 },
        { label: 'HS1 (L7)', value: grade.he_so_1_l7 },
        { label: 'HS1 (L8)', value: grade.he_so_1_l8 },
        { label: 'HS1 (L9)', value: grade.he_so_1_l9 },
        { label: 'HS2 (L1)', value: grade.he_so_2_l1 },
        { label: 'HS2 (L2)', value: grade.he_so_2_l2 },
        { label: 'HS2 (L3)', value: grade.he_so_2_l3 },
        { label: 'HS2 (L4)', value: grade.he_so_2_l4 },
        { label: 'HS2 (L5)', value: grade.he_so_2_l5 },
        { label: 'HS2 (L6)', value: grade.he_so_2_l6 },
        { label: 'HS2 (L7)', value: grade.he_so_2_l7 },
        { label: 'HS2 (L8)', value: grade.he_so_2_l8 },
        { label: 'HS2 (L9)', value: grade.he_so_2_l9 },
        { label: 'Thực Hành 1', value: grade.thuc_hanh_1 },
        { label: 'Thực Hành 2', value: grade.thuc_hanh_2 },
        { label: 'TB Thường Kỳ', value: grade.tb_thuong_ky },
        { label: 'Vắng Thi', value: grade.vang_thi },
        { label: 'Xếp Loại', value: grade.xep_loai },
        { label: 'Thi KN 1', value: grade.diem_thi_kn_1 },
        { label: 'Thi KN 2', value: grade.diem_thi_kn_2 },
        { label: 'Thi KN 3', value: grade.diem_thi_kn_3 },
        { label: 'Thi KN 4', value: grade.diem_thi_kn_4 },
        { label: 'Tổng Kết Lần 1', value: grade.tong_ket_1, highlight: _isRetake(grade) || _isRelearn(grade) },
    ].filter(d => d.value);

    const hasDetails = details.length > 0;
    const isRetake = _isRetake(grade);
    const isRelearn = _isRelearn(grade);

    return (
        <>
            <tr
                className={`transition-all border-b border-slate-50 dark:border-slate-800 ${hidden ? 'opacity-40 bg-slate-100/60 dark:bg-slate-800/40' : isHigh ? 'bg-blue-50/40 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'} ${hasDetails ? 'cursor-pointer' : ''} ${isOpen ? 'bg-slate-50/80 dark:bg-slate-800/80' : ''}`}
                onClick={() => hasDetails && setIsOpen(!isOpen)}
            >
                <td className="px-3 md:px-6 py-3 md:py-4 font-medium text-slate-900 dark:text-slate-200 min-w-[150px]">
                    <div className="flex items-start gap-2">
                        <span className="break-words">{grade.ten_mon}</span>
                        {isRetake && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-800 shrink-0 mt-0.5">
                                <RotateCcw className="w-2.5 h-2.5" />
                                Thi lại
                            </span>
                        )}
                        {isRelearn && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 shrink-0 mt-0.5">
                                <BookX className="w-2.5 h-2.5" />
                                Học lại
                            </span>
                        )}
                        {hidden && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-tight bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-300 dark:border-slate-600 shrink-0 mt-0.5">
                                <EyeOff className="w-2.5 h-2.5" />
                                Đang ẩn
                            </span>
                        )}
                        {hasDetails && (
                            <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-300 mt-0.5 ${isOpen ? 'rotate-180' : ''}`} />
                        )}
                    </div>
                </td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center text-slate-500 dark:text-slate-400 font-bold">{grade.so_tin_chi}</td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center text-slate-600 dark:text-slate-300">{grade.diem_thi || '-'}</td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center font-bold text-slate-800 dark:text-slate-100">{grade.tong_ket_10 || '-'}</td>
                <td className="px-2 md:px-6 py-3 md:py-4 text-center">
                    <span
                        className={`inline-flex items-center justify-center min-w-[2.75rem] px-2.5 py-1 rounded-full text-[11px] font-black border transition-all hover:scale-110 shadow-sm ${getGradeColor(grade.diem_chu || '')}`}
                    >
                        {grade.diem_chu || '-'}
                    </span>
                </td>
                {adminMsv && (
                    <td className="px-2 py-3 text-center">
                        <button
                            onClick={handleToggleHide}
                            disabled={hiding || !subjectKey}
                            title={hidden ? 'Bỏ ẩn môn này' : 'Ẩn môn này với user'}
                            className={`inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-xs font-semibold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${hidden
                                ? 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:text-amber-300 dark:border-amber-700 dark:bg-amber-900/20 dark:hover:bg-amber-900/30'
                                : 'text-slate-700 border-slate-300 bg-white hover:bg-slate-100 dark:text-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:hover:bg-slate-700'
                                }`}
                        >
                            {hiding
                                ? <Loader2 className="w-4 h-4 animate-spin" />
                                : hidden
                                    ? <Eye className="w-4 h-4" />
                                    : <EyeOff className="w-4 h-4" />
                            }
                            <span className="hidden md:inline">{hidden ? 'Bỏ ẩn' : 'Ẩn'}</span>
                        </button>
                    </td>
                )}
            </tr>
            {hasDetails && isOpen && (
                <tr className="animate-in fade-in zoom-in-95 duration-300">
                    <td colSpan={adminMsv ? 6 : 5} className="px-6 py-6 bg-slate-50/50 dark:bg-slate-900/30 border-b border-slate-100 dark:border-slate-800 shadow-inner">
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                            {details.map((item, i) => (
                                <div key={i} className={`p-3 rounded-xl border shadow-[0_2px_4px_rgba(0,0,0,0.02)] flex flex-col items-center text-center ${item.highlight
                                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                                    }`}>
                                    <div className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 dark:text-slate-500 mb-1">{item.label}</div>
                                    <div className={`text-base font-bold font-mono ${item.highlight
                                        ? 'text-red-500 dark:text-red-400'
                                        : 'text-blue-600 dark:text-blue-400'
                                        }`}>{item.value}</div>
                                </div>
                            ))}
                        </div>
                    </td>
                </tr>
            )}
        </>
    );
}
