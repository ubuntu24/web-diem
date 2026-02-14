import { useState, useEffect } from 'react';
import { Search, Shield, Edit, Save, X, Check, Loader2, User as UserIcon, Star, Activity } from 'lucide-react';
import { AdminUser } from '@/lib/api';
import { getUsersAction, resetUserLimitAction } from '@/app/actions';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminUserList() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const token = localStorage.getItem('token') || undefined;
            const usersData = await getUsersAction(token);
            setUsers(usersData);
        } catch (error) {
            console.error("Failed to load admin data", error);
        } finally {
            setLoading(false);
        }
    }

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-indigo-600" />
                        Quản Lý Người Dùng
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Danh sách tài khoản và lịch sử truy cập</p>
                </div>

                <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                    <div className="relative flex-1 md:w-48">
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full pl-3 pr-3 py-2 bg-slate-100 dark:bg-slate-900 border-transparent focus:bg-white dark:focus:bg-slate-950 border focus:border-indigo-500 rounded-lg text-sm transition-all outline-none text-slate-900 dark:text-white"
                        />
                    </div>
                    <div className="relative flex-1 md:w-64">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            placeholder="Tìm tài khoản..."
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
            ) : (
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
                                                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">User</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.role !== 1 && (
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            if (confirm(`Bạn có chắc muốn reset lượt đổi lớp cho ${user.username}?`)) {
                                                                const token = localStorage.getItem('token') || undefined;
                                                                resetUserLimitAction(user.id, token).then((result) => {
                                                                    if (result.success) {
                                                                        alert(`Đã reset lượt đổi lớp cho ${user.username}`);
                                                                        loadData();
                                                                    } else {
                                                                        alert(result.error || 'Reset thất bại');
                                                                    }
                                                                }).catch(console.error);
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
            )}
        </div>
    );
}
