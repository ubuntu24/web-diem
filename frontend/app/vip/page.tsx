"use client";

import { motion } from 'framer-motion';
import { ArrowLeft, Laugh, Music2, Volume2, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function VipPage() {
    const router = useRouter();
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Glows */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse" />
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="max-w-4xl w-full bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-1 shadow-2xl relative z-10 overflow-hidden"
            >
                <div className="bg-slate-950/80 rounded-[2.4rem] p-6 md:p-10">
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                            className="inline-block mb-4"
                        >
                            <div className="p-3 bg-gradient-to-tr from-indigo-500 to-purple-500 rounded-full">
                                <Music2 className="w-8 h-8 text-white" />
                            </div>
                        </motion.div>
                        <h1 className="text-3xl md:text-5xl font-black text-white mb-2 italic tracking-tighter">
                            SIÊU CẤP <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">VIP PRO</span> ĐÃ SẴN SÀNG!
                        </h1>
                        <p className="text-slate-400 font-medium">Bạn đã được chọn để nhận đặc quyền vô tận...</p>
                    </div>

                    {/* Rickroll Video Embed */}
                    <div className="aspect-video w-full rounded-2xl overflow-hidden shadow-2xl border border-white/5 bg-black relative group">
                        <iframe
                            className="w-full h-full"
                            src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1&controls=0&rel=0"
                            title="Rick Roll"
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                        ></iframe>

                        <div className="absolute inset-0 pointer-events-none border-2 border-white/10 rounded-2xl group-hover:border-indigo-500/30 transition-colors" />
                    </div>

                    {/* Fun Message */}
                    <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 px-2">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
                                <Laugh className="w-6 h-6 text-amber-400" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg leading-tight">Mục tiêu của tôi không phải tiền...</h3>
                                <p className="text-slate-500 text-sm">Mà là nụ cười của bạn (và sự cay cú nhẹ) ❤️</p>
                            </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <button
                                onClick={() => router.back()}
                                className="px-6 py-3 bg-white text-black font-black rounded-xl hover:bg-slate-200 transition-all flex items-center gap-2 group shadow-xl shadow-white/5"
                            >
                                <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                                QUAY LẠI HỌC BÀI ĐI
                            </button>
                            <span className="text-[10px] text-slate-700 font-bold tracking-widest uppercase flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                RICKROLLED v2.0 • FOR TEACHERS WITH LOVE
                            </span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Floaties */}
            <motion.div
                animate={{ y: [0, -20, 0], opacity: [0.2, 0.5, 0.2] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="absolute bottom-10 left-10 text-white/10 select-none"
            >
                <Volume2 size={120} />
            </motion.div>
        </div>
    );
}
