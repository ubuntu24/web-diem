'use client';

import { useState, useEffect } from 'react';
import { Search, Shield, Edit, Save, X, Check, Loader2, User as UserIcon, Star, Activity } from 'lucide-react';
import { AdminUser, getUsersBff, resetUserLimitBff, updateUserLimitBff, getBansBff, unbanUserBff } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function AdminUserList() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [bans, setBans] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'moderation'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const usersData = await getUsersBff();
                setUsers(usersData);
            } else {
                const bansData = await getBansBff();
                setBans(bansData || []);
            }
        } catch (error) {
            // silenced
        } finally {
            setLoading(false);
        }
    }

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleUnban = async (id: number) => {
        if (!confirm('Bạn có muốn gỡ cấm cho thiết bị/tài khoản này?')) return;
        try {
            await unbanUserBff(id);
            toast.success('Đã gỡ cấm thành công!');
            loadData();
        } catch (e) {
            toast.error('Gỡ cấm thất bại');
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Tabs */}
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                            <Shield className="w-6 h-6 text-indigo-600" />
                            Quản Trị Hệ Thống
                        </h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Điều chỉnh giới hạn & Xử lý vi phạm</p>
                    </div>

                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg">
                        <button 
                            onClick={() => setActiveTab('users')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'users' ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Người dùng
                        </button>
                        <button 
                            onClick={() => setActiveTab('moderation')}
                            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all ${activeTab === 'moderation' ? 'bg-white dark:bg-slate-800 text-red-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            Danh sách cấm
                        </button>
                    </div>
                </div>

                <div className="p-4 flex flex-col md:flex-row items-stretch md:items-center gap-2 justify-end">
                    {activeTab === 'users' && (
                        <div className="relative flex-1 md:w-48">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                max={new Date().toISOString().split('T')[0]}
                                className="w-full pl-3 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-950 border focus:border-indigo-500 rounded-lg text-sm transition-all outline-none text-slate-900 dark:text-white"
                            />
                        </div>
                    )}
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder={activeTab === 'users' ? "Tìm tài khoản..." : "Tìm trong danh sách ban..."}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-950 border focus:border-indigo-500 rounded-lg text-sm transition-all outline-none text-slate-900 dark:text-white"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
                </div>
            ) : activeTab === 'users' ? (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Tài khoản</th>
                                    <th className="px-6 py-3">Vai trò</th>
                                    <th className="px-6 py-3 text-right">Thao tác</th>
                                    <th className="px-6 py-3">Ngày {selectedDate.split('-').reverse().slice(0, 2).join('/')}</th>
                                    <th className="px-6 py-3">Lịch sử (30n)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {filteredUsers.map(user => (
                                    <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                                    <UserIcon className="w-4 h-4" />
                                                </div>
                                                {user.username}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {user.role === 1 ? (
                                                <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-bold">Admin</span>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">User</span>
                                                    <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.class_change_limit === -1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                        {user.class_change_limit === -1 ? '∞ lượt đổi' : `${user.class_change_limit ?? 5} lượt đổi`}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.role !== 1 && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            const currentLimit = user.class_change_limit ?? 5;
                                                            const promptMsg = `Nhập số lượt đổi lớp mới cho ${user.username}\n(Nhập -1 để không giới hạn):`;
                                                            const newLimitStr = prompt(promptMsg, currentLimit.toString());
                                                            if (newLimitStr !== null) {
                                                                const newLimit = parseInt(newLimitStr);
                                                                if (!isNaN(newLimit)) {
                                                                    updateUserLimitBff(user.id, newLimit).then(() => {
                                                                        toast.success(`Đã cập nhật lượt đổi lớp cho ${user.username}`);
                                                                        loadData();
                                                                    }).catch(() => {
                                                                        toast.error('Cập nhật thất bại');
                                                                    });
                                                                } else {
                                                                    toast.error('Giá trị không hợp lệ');
                                                                }
                                                            }
                                                        }}
                                                        className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                                        title={`Sửa lượt đổi (hiện tại: ${user.class_change_limit === -1 ? '∞' : (user.class_change_limit ?? 5)})`}
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Bạn có chắc muốn reset lượt đổi lớp cho ${user.username}?`)) {
                                                                resetUserLimitBff(user.id).then(() => {
                                                                    toast.success(`Đã reset lượt đổi lớp cho ${user.username}`);
                                                                    loadData();
                                                                }).catch(() => {
                                                                    toast.error('Reset thất bại');
                                                                });
                                                            }
                                                        }}
                                                        className="p-1.5 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/30 rounded-md transition-colors"
                                                        title="Reset lượt đổi lớp"
                                                    >
                                                        <Activity className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`font-bold ${(user.access_history?.find(h => h.date === selectedDate)?.count || 0) > 0
                                                ? 'text-indigo-600'
                                                : 'text-slate-400'
                                                }`}>
                                                {user.access_history?.find(h => h.date === selectedDate)?.count || 0} lần
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 w-32">
                                                {user.access_history && user.access_history.length > 0 ? (
                                                    <div className="flex gap-0.5 items-end h-8 border-b border-slate-100 dark:border-slate-700">
                                                        {[...Array(30)].map((_, i) => {
                                                            const d = new Date();
                                                            d.setDate(d.getDate() - (29 - i));
                                                            const dateStr = d.toISOString().split('T')[0];
                                                            const dayData = user.access_history?.find(h => h.date === dateStr);
                                                            // If more than 0, show a bar. Max height at 10 or more logins.
                                                            const height = dayData ? Math.min(100, (dayData.count / 5) * 100) : 0;
                                                            return (
                                                                <div
                                                                    key={i}
                                                                    title={`${dateStr}: ${dayData?.count || 0} lần`}
                                                                    className={`flex-1 rounded-t-[1px] transition-all hover:bg-indigo-500 ${dayData ? 'bg-indigo-400' : 'bg-slate-100 dark:bg-slate-800'}`}
                                                                    style={{ height: dayData ? `${Math.max(15, height)}%` : '2px' }}
                                                                />
                                                            );
                                                        })}
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-xs">Không có dữ liệu</span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold">
                                <tr>
                                    <th className="px-6 py-3">Tài khoản</th>
                                    <th className="px-6 py-3">Địa chỉ IP</th>
                                    <th className="px-6 py-3">Mã thiết bị (FP)</th>
                                    <th className="px-6 py-3">Lý do</th>
                                    <th className="px-6 py-3 text-right">Thao tác</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {bans.filter(b => b.username?.toLowerCase().includes(searchQuery.toLowerCase()) || b.ip_address?.includes(searchQuery)).map(ban => (
                                    <tr key={ban.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-red-600 dark:text-red-400">
                                            {ban.username || 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600 dark:text-slate-400 font-mono text-xs">
                                            {ban.ip_address || <span className="italic opacity-50">Không rõ</span>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-500 font-mono text-[10px] max-w-[200px] truncate" title={ban.device_fingerprint}>
                                            {ban.device_fingerprint || <span className="italic opacity-50">Không rõ</span>}
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 dark:text-slate-300">
                                            {ban.reason}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button 
                                                onClick={() => handleUnban(ban.id)}
                                                className="px-3 py-1 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-md hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors border border-green-200 dark:border-green-800"
                                            >
                                                Gỡ cấm
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {bans.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-10 text-center text-slate-500 dark:text-slate-400 italic">
                                            Danh sách cấm đang trống.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
