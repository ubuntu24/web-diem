"use client";

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Ghost, Home, ArrowLeft } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function NotFound() {
    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors relative overflow-hidden">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            {/* Background blobs */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-20 left-20 w-[400px] h-[400px] bg-purple-100 dark:bg-purple-900/20 rounded-full blur-3xl opacity-60"></div>
                <div className="absolute bottom-20 right-20 w-[400px] h-[400px] bg-blue-100 dark:bg-blue-900/20 rounded-full blur-3xl opacity-60"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="text-center relative z-10 p-8 max-w-lg mx-auto"
            >
                <motion.div
                    animate={{
                        y: [0, -20, 0],
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: "easeInOut"
                    }}
                    className="w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-slate-200 dark:shadow-slate-900/50"
                >
                    <Ghost className="w-16 h-16 text-slate-400 dark:text-slate-500" />
                </motion.div>

                <h1 className="text-8xl font-black text-slate-200 dark:text-slate-800 mb-2 select-none">404</h1>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Trang không tìm thấy</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-8 max-w-md mx-auto">
                    Có vẻ như bạn đã đi lạc vào vùng không xác định. Trang bạn tìm kiếm không tồn tại hoặc đã bị di chuyển.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={() => window.history.back()}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium shadow-sm hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition-all w-full sm:w-auto justify-center"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Quay lại
                    </button>

                    <Link
                        href="/"
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium shadow-lg shadow-blue-200 dark:shadow-blue-900/30 transition-all w-full sm:w-auto justify-center"
                    >
                        <Home className="w-4 h-4" />
                        Về trang chủ
                    </Link>
                </div>
            </motion.div>
        </div>
    );
}
