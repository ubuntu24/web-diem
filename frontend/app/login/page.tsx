"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Loader2, Lock, User, CheckCircle2, AlertCircle, Award } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { loginUserBff } from '@/lib/api';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    async function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await loginUserBff(username, password);

            if (result?.access_token) {
                localStorage.setItem('role', String(result.role ?? 0));
                toast.success('Đăng nhập thành công!');
                // Full navigation guarantees new cookies are used immediately by RSC routes.
                setTimeout(() => {
                    window.location.href = '/dashboard';
                }, 800);
            } else {
                throw new Error('Đăng nhập không thành công, không nhận được token.');
            }
        } catch (err: any) {
            const msg = err.message || 'Đăng nhập thất bại';
            setError(msg);
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden transition-colors selection:bg-indigo-500/30">
            {/* Theme Toggle */}
            <div className="absolute top-6 right-6 z-50">
                <ThemeToggle />
            </div>

            {/* Background blobs */}
            <div className="absolute inset-0 overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-indigo-600/10 dark:bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-violet-600/10 dark:bg-violet-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", duration: 0.6 }}
                className="premium-glass p-10 rounded-[2.5rem] shadow-2xl w-full max-w-md border-border/50 relative z-10 mx-4"
            >
                <div className="text-center mb-10">
                    <motion.div
                        initial={{ rotate: -10 }}
                        animate={{ rotate: 0 }}
                        className="w-16 h-16 bg-gradient-to-br from-indigo-600 to-violet-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-indigo-500/30 text-white"
                    >
                        <Award className="w-8 h-8" />
                    </motion.div>
                    <h1 className="text-3xl font-black text-foreground tracking-tight">Chào mừng bạn quay lại</h1>
                    <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 font-bold uppercase tracking-widest italic">Đăng nhập hệ thống</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Tài khoản</label>
                        <div className="relative group">
                            <User className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-background dark:bg-slate-900 border-2 border-border group-focus-within:border-indigo-500/50 group-focus-within:ring-4 group-focus-within:ring-indigo-500/10 rounded-2xl outline-none transition-all text-foreground font-bold placeholder-slate-500 shadow-inner"
                                placeholder="Nhập tên đăng nhập..."
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                        <div className="relative group">
                            <Lock className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full pl-12 pr-4 py-3.5 bg-background dark:bg-slate-900 border-2 border-border group-focus-within:border-indigo-500/50 group-focus-within:ring-4 group-focus-within:ring-indigo-500/10 rounded-2xl outline-none transition-all text-foreground font-bold placeholder-slate-500 shadow-inner"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-3 text-rose-600 dark:text-rose-400 text-sm bg-rose-500/10 p-4 rounded-2xl border border-rose-500/20 font-bold"
                        >
                            <AlertCircle className="w-5 h-5 shrink-0" />
                            <span>{error}</span>
                        </motion.div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-700 hover:scale-[1.02] active:scale-[0.98] text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-500/20 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-widest uppercase text-sm"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                <span>ĐANG XÁC THỰC...</span>
                            </>
                        ) : (
                            <span>Đăng Nhập Ngay</span>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-3">Lần đầu truy cập?</p>
                    <a href="/register" className="inline-block font-black text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline underline-offset-8 decoration-2 transition-all">
                        Kiến tạo tài khoản mới
                    </a>
                </div>
            </motion.div>
        </div>
    );
}
