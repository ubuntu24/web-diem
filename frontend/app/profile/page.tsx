"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Calendar, Shield, ArrowLeft, Loader2, Edit3, Check, X, UserCircle } from 'lucide-react';
import { type User as UserType, getProfileBff } from '../../lib/api';
import { updateProfileAction } from './actions';
import { toast } from 'react-hot-toast';

import { ThemeToggle } from '@/components/ThemeToggle';

export default function ProfilePage() {
    const [user, setUser] = useState<UserType | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [newName, setNewName] = useState('');
    const [saving, setSaving] = useState(false);
    const router = useRouter();

    const fetchProfile = async () => {
        try {
            const userData = await getProfileBff();
            if (!userData) throw new Error('No user data');
            setUser(userData);
            setNewName(userData.full_name || '');
        } catch (error) {
            router.push('/login');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [router]);

    const handleSave = async () => {
        if (!newName.trim()) {
            toast.error('Tên không được để trống');
            return;
        }
        setSaving(true);
        try {
            const result = await updateProfileAction(newName.trim());
            if (result.success) {
                toast.success('Cập nhật hồ sơ thành công');
                setIsEditing(false);
                await fetchProfile(); // Refresh data
            } else {
                toast.error(result.error || 'Cập nhật thất bại');
            }
        } catch (error) {
            console.error('Update error:', error);
            toast.error('Không thể cập nhật hồ sơ');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-500" />
                <span className="ml-4 text-slate-600 dark:text-slate-300">Đang tải thông tin hồ sơ...</span>
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
                        Quay lại trang trước
                    </button>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-slate-800 transition-colors"
                >
                    <div className="bg-gradient-to-br from-indigo-500 via-blue-600 to-teal-500 h-40 relative">
                        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2">
                            <div className="w-28 h-28 bg-white dark:bg-slate-900 rounded-3xl p-1.5 shadow-2xl transform rotate-3 transition-colors">
                                <div className="w-full h-full bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-4xl transition-colors border border-slate-100 dark:border-slate-700">
                                    {(user.full_name || user.username || '?').charAt(0).toUpperCase()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-16 pb-10 px-8 text-center">
                        <AnimatePresence mode="wait">
                            {!isEditing ? (
                                <motion.div
                                    key="display"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="flex flex-col items-center"
                                >
                                    <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                                        {user.full_name || user.username}
                                    </h1>
                                    {user.full_name && (
                                        <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium text-sm">@{user.username}</p>
                                    )}

                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-indigo-50 dark:hover:bg-indigo-900/40 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all duration-300 font-semibold text-sm group"
                                    >
                                        <Edit3 className="w-4 h-4 group-hover:rotate-12 transition-transform" />
                                        Chỉnh sửa tên
                                    </button>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="edit"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="w-full space-y-4"
                                >
                                    <div className="relative group">
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder="Nhập tên hiển thị mới..."
                                            className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-500 transition-all font-medium text-lg text-center"
                                            autoFocus
                                            maxLength={50}
                                        />
                                    </div>
                                    <div className="flex gap-3 justify-center">
                                        <button
                                            onClick={handleSave}
                                            disabled={saving}
                                            className="flex-1 max-w-[140px] px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all font-bold shadow-lg shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2 disabled:opacity-70"
                                        >
                                            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                                            Lưu
                                        </button>
                                        <button
                                            onClick={() => {
                                                setIsEditing(false);
                                                setNewName(user.full_name || '');
                                            }}
                                            className="px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-all font-bold"
                                        >
                                            Hủy
                                        </button>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="mt-8 pt-8 border-t border-slate-100 dark:border-slate-800 space-y-4 text-left">
                            <div className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700/50 transition-colors group">
                                <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center text-purple-500 shadow-sm border border-slate-100 dark:border-slate-700 group-hover:scale-110 transition-transform">
                                    <Calendar className="w-6 h-6" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-widest mb-0.5">Thành viên từ</p>
                                    <p className="font-bold text-slate-900 dark:text-white text-lg">
                                        {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN', {
                                            day: 'numeric',
                                            month: 'long',
                                            year: 'numeric'
                                        }) : '—'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <p className="mt-8 text-center text-slate-400 dark:text-slate-500 text-xs font-medium">
                    Bạn có thể đổi tên hiển thị bất cứ lúc nào. Tên đăng nhập gốc sẽ không bị thay đổi.
                </p>
            </div>
        </div>
    );
}
