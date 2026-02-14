"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Search, MapPin, Check, Star, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface ClassPickerProps {
    classes: string[];
    onClassSelected: (className: string) => void;
    currentClass?: string;
    onClose?: () => void;
}

const CLASS_CHANGE_KEY = 'classChanges';
const CLASS_CHANGE_DATE_KEY = 'classChangeDate';
const MAX_CHANGES = 3;

function getClassChangeCount(): number {
    const today = new Date().toISOString().slice(0, 10);
    const storedDate = localStorage.getItem(CLASS_CHANGE_DATE_KEY);
    if (storedDate !== today) {
        localStorage.setItem(CLASS_CHANGE_DATE_KEY, today);
        localStorage.setItem(CLASS_CHANGE_KEY, '0');
        return 0;
    }
    return parseInt(localStorage.getItem(CLASS_CHANGE_KEY) || '0');
}

function incrementClassChange(): number {
    const count = getClassChangeCount() + 1;
    localStorage.setItem(CLASS_CHANGE_KEY, count.toString());
    localStorage.setItem(CLASS_CHANGE_DATE_KEY, new Date().toISOString().slice(0, 10));
    return count;
}

export default function ClassPicker({
    classes,
    onClassSelected,
    currentClass,
    onClose
}: ClassPickerProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState<string | null>(null);

    const filteredClasses = classes.filter(c =>
        c.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const classChangeCount = getClassChangeCount();
    const remainingChanges = Math.max(0, MAX_CHANGES - classChangeCount);
    const isLimitReached = classChangeCount >= MAX_CHANGES;

    const handleSelect = (className: string) => {
        if (className === currentClass) {
            onClose?.();
            return;
        }

        if (isLimitReached) {
            setError("Bạn đã hết lượt đổi lớp trong ngày. Nâng cấp VIP để đổi không giới hạn!");
            return;
        }

        incrementClassChange();
        localStorage.setItem('selectedClass', className);
        onClassSelected(className);
        onClose?.();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-md">
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]"
            >
                {/* Header */}
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-50/50 to-blue-50/50 dark:from-indigo-900/20 dark:to-blue-900/20">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <MapPin className="w-6 h-6 text-indigo-600" />
                                Lựa chọn lớp học
                            </h2>
                            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Chọn lớp bạn muốn xem thông tin hôm nay</p>
                        </div>
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold transition-colors ${isLimitReached
                            ? 'bg-red-50 border-red-200 text-red-600 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400'
                            : 'bg-slate-50 border-slate-200 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
                            }`}>
                            <Star className={`w-4 h-4 ${isLimitReached ? 'text-red-500' : 'text-slate-400'}`} />
                            Còn {remainingChanges}/{MAX_CHANGES} lượt đổi
                        </div>
                    </div>

                    <div className="relative">
                        <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm lớp (ví dụ: DHMT16A1HN)..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {isLimitReached && (
                        <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-center justify-between gap-3 animate-pulse">
                            <div className="flex items-center gap-3">
                                <Star className="w-5 h-5 text-amber-500 shrink-0" />
                                <div className="text-sm font-bold text-amber-800 dark:text-amber-300">
                                    Bạn đã dùng hết lượt đổi lớp hôm nay!
                                </div>
                            </div>
                            <Link
                                href="/vip"
                                className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg transition-all shadow-md font-bold text-xs"
                            >
                                Nâng cấp VIP
                            </Link>
                        </div>
                    )}

                    {error && !isLimitReached && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                            <div className="text-sm font-semibold text-red-800 dark:text-red-300">
                                {error}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredClasses.length > 0 ? (
                            filteredClasses.map(cls => (
                                <button
                                    key={cls}
                                    onClick={() => handleSelect(cls)}
                                    disabled={isLimitReached && cls !== currentClass}
                                    className={`
                                        group relative p-4 rounded-xl border flex items-center justify-between transition-all text-left
                                        ${cls === currentClass
                                            ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20'
                                            : isLimitReached && cls !== currentClass
                                                ? 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed opacity-60'
                                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md'
                                        }
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm transition-colors ${cls === currentClass
                                            ? 'bg-white/20 text-white'
                                            : 'bg-slate-100 dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-50 dark:group-hover:bg-indigo-900/30'
                                            }`}>
                                            {cls.substring(0, 2)}
                                        </div>
                                        <div>
                                            <div className="font-bold">{cls}</div>
                                            <div className={`text-[10px] uppercase tracking-wider font-semibold ${cls === currentClass ? 'text-indigo-100' : 'text-slate-400'}`}>
                                                {cls === currentClass ? 'Đang chọn' : 'Nhấn để chọn'}
                                            </div>
                                        </div>
                                    </div>

                                    {cls === currentClass && <Check className="w-5 h-5 text-white" />}
                                </button>
                            ))
                        ) : (
                            <div className="col-span-full py-20 text-center">
                                <Search className="w-12 h-12 text-slate-200 dark:text-slate-800 mx-auto mb-4" />
                                <p className="text-slate-500 dark:text-slate-400 font-medium">Không tìm thấy lớp nào phù hợp</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">
                        LIFE SUCKS • CLASS PICK v1.0
                    </p>
                    {(currentClass || onClose) && (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            Đóng
                        </button>
                    )}
                </div>
            </motion.div>
        </div>
    );
}
