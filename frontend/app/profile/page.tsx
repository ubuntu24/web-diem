"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { User, Calendar, Shield, ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { type User as UserType } from '../../lib/api';
import { getMeAction } from '@/app/actions';

import { ThemeToggle } from '@/components/ThemeToggle';

export default function ProfilePage() {
    const [user, setUser] = useState<UserType | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const token = localStorage.getItem('token') || undefined;
                const userData = await getMeAction(token);
                if (!userData) throw new Error('No user data');
                setUser(userData);
            } catch (error) {
                console.error("Failed to fetch profile", error);
                router.push('/login');
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950 py-12 px-4 sm:px-6 lg:px-8 transition-colors relative">
            {/* Theme Toggle */}
            <div className="absolute top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <div className="max-w-md mx-auto">
                <div className="mb-8">
                    <button
                        onClick={() => router.back()}
                        className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors font-medium group"
                    >
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        Quay lại
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
                >
                    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 h-32 relative">
                        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2">
                            <div className="w-24 h-24 bg-white dark:bg-slate-800 rounded-full p-1 shadow-lg transition-colors">
                                <div className="w-full h-full bg-blue-100 dark:bg-blue-900/50 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-3xl transition-colors">
                                    {(user.username ?? '?').charAt(0).toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-12 pb-8 px-8 text-center">
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">{user.username}</h1>

                        <div className="space-y-4 text-left">
                            <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700/50 transition-colors">
                                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center text-purple-500 shadow-sm border border-slate-100 dark:border-slate-700">
                                    <Calendar className="w-5 h-5" />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider">Ngày tham gia</p>
                                    <p className="font-semibold text-slate-900 dark:text-white">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
