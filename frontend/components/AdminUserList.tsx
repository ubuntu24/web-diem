'use client';

import { useState, useEffect } from 'react';
import {
    Search, Shield, Edit, Loader2, User as UserIcon,
    X, Globe, Clock, BarChart2, AlertTriangle, Monitor, ChevronRight
} from 'lucide-react';
import {
    AdminUser, UserDetails, getUsersBff, resetUserLimitBff,
    updateUserLimitBff, getBansBff, unbanUserBff, getUserDetailsBff,
    getAuditLogsBff, getSystemConfigBff, updateSystemConfigBff,
    getOnlineUsersListBff, AuditLogEntry
} from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
    Terminal, Settings, Trash2, Send, Info, Activity
} from 'lucide-react';

// ─── Modal chi tiết user ───────────────────────────────────────────────────
function UserDetailModal({ userId, username, onClose }: { userId: number; username: string; onClose: () => void }) {
    const [data, setData] = useState<UserDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getUserDetailsBff(userId).then(d => {
            setData(d);
            setLoading(false);
        });
    }, [userId]);

    // Đóng khi nhấn ESC
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [onClose]);

    const totalAccess = data?.total_access ?? 0;
    const last30 = (() => {
        if (!data?.access_history) return [];
        const result: { date: string; count: number }[] = [];
        for (let i = 29; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const found = data.access_history.find(h => h.date === dateStr);
            result.push({ date: dateStr, count: found?.count ?? 0 });
        }
        return result;
    })();
    const maxBar = Math.max(1, ...last30.map(d => d.count));

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
            >
                <motion.div
                    initial={{ opacity: 0, scale: 0.92, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, y: 20 }}
                    transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                    className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-indigo-600 to-violet-600">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                                <UserIcon className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h3 className="text-white font-bold text-lg leading-tight">{username}</h3>
                                <p className="text-indigo-100 text-xs">Chi tiết truy cập & địa chỉ IP</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="text-white/70 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="overflow-y-auto flex-1 p-6 space-y-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
                                <p className="text-slate-400 text-sm">Đang tải dữ liệu...</p>
                            </div>
                        ) : !data ? (
                            <div className="text-center py-16 text-slate-500">Không tải được dữ liệu.</div>
                        ) : (
                            <>
                                {/* Stat row */}
                                <div className="grid grid-cols-3 gap-3">
                                    <StatCard
                                        icon={<BarChart2 className="w-4 h-4 text-indigo-500" />}
                                        label="Tổng lượt vào"
                                        value={totalAccess.toLocaleString()}
                                        color="indigo"
                                    />
                                    <StatCard
                                        icon={<Globe className="w-4 h-4 text-emerald-500" />}
                                        label="IP duy nhất"
                                        value={data.ip_history.length.toString()}
                                        color="emerald"
                                    />
                                    <StatCard
                                        icon={<Clock className="w-4 h-4 text-amber-500" />}
                                        label="Hoạt động cuối"
                                        value={data.last_active
                                            ? new Date(data.last_active).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
                                            : 'N/A'}
                                        color="amber"
                                    />
                                </div>

                                {/* Bar chart 30 ngày */}
                                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                        <BarChart2 className="w-3.5 h-3.5" /> Lượt truy cập 30 ngày qua
                                    </p>
                                    <div className="flex items-end gap-0.5 h-20">
                                        {last30.map((d, i) => {
                                            const h = d.count > 0 ? Math.max(8, Math.round((d.count / maxBar) * 80)) : 2;
                                            return (
                                                <div
                                                    key={i}
                                                    title={`${d.date}: ${d.count} lần`}
                                                    className={`flex-1 rounded-sm transition-all hover:opacity-80 cursor-default ${d.count > 0 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'}`}
                                                    style={{ height: `${h}px` }}
                                                />
                                            );
                                        })}
                                    </div>
                                    <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                                        <span>30 ngày trước</span>
                                        <span>Hôm nay</span>
                                    </div>
                                </div>

                                {/* IP History (Enhanced) */}
                                <div>
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                        <Globe className="w-3.5 h-3.5" /> Địa chỉ IP đã vào web
                                    </p>
                                    {data.ip_history.length === 0 ? (
                                        <p className="text-sm text-slate-400 italic px-1">Chưa có dữ liệu IP (user chưa vào web sau khi cập nhật).</p>
                                    ) : (
                                        <div className="space-y-3">
                                            {data.ip_history.map((entry, i) => (
                                                <div key={i} className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl px-4 py-3 space-y-2">
                                                    {/* Row 1: IP + Location + Badges */}
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex items-center gap-2.5 min-w-0">
                                                            <Monitor className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                            <div className="min-w-0">
                                                                <span className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-100 select-all">{entry.ip}</span>
                                                                {entry.location && (
                                                                    <p className="text-[11px] text-indigo-500 font-medium">{entry.location}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {/* Badges */}
                                                        <div className="flex flex-wrap gap-1 flex-shrink-0">
                                                            {entry.is_proxy && (
                                                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded text-[9px] font-bold uppercase">VPN</span>
                                                            )}
                                                            {entry.is_mobile && (
                                                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded text-[9px] font-bold uppercase">Mobile</span>
                                                            )}
                                                            {entry.is_hosting && (
                                                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded text-[9px] font-bold uppercase">DC</span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Row 2: ISP + Metadata */}
                                                    {(entry.isp || entry.district || entry.timezone) && (
                                                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400 border-t border-slate-50 dark:border-slate-700/50 pt-2">
                                                            {entry.isp && (
                                                                <span title="Nhà mạng (ISP)">🌐 {entry.isp}</span>
                                                            )}
                                                            {entry.district && (
                                                                <span title="Quận/Huyện">📍 {entry.district}</span>
                                                            )}
                                                            {entry.timezone && (
                                                                <span title="Múi giờ">🕐 {entry.timezone}</span>
                                                            )}
                                                            {entry.screen_res && (
                                                                <span title="Độ phân giải màn hình">🖥️ {entry.screen_res}</span>
                                                            )}
                                                            {entry.platform && (
                                                                <span title="Hệ điều hành">💻 {entry.platform}</span>
                                                            )}
                                                            {entry.language && (
                                                                <span title="Ngôn ngữ trình duyệt">🗣️ {entry.language}</span>
                                                            )}
                                                            {entry.connection_type && (
                                                                <span title="Loại kết nối">📶 {entry.connection_type}</span>
                                                            )}
                                                        </div>
                                                    )}

                                                    {/* Row 3: User-Agent (collapsible hint) */}
                                                    {entry.user_agent && (
                                                        <p className="text-[9px] text-slate-400 truncate border-t border-slate-50 dark:border-slate-700/50 pt-1" title={entry.user_agent}>
                                                            UA: {entry.user_agent}
                                                        </p>
                                                    )}

                                                    {/* Row 4: Stats */}
                                                    <div className="flex items-center gap-4 text-right border-t border-slate-50 dark:border-slate-700/50 pt-2">
                                                        <div>
                                                            <p className="text-[11px] text-slate-400">Lần vào web</p>
                                                            <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{entry.hit_count}</p>
                                                        </div>
                                                        {entry.first_seen && (
                                                            <div>
                                                                <p className="text-[11px] text-slate-400">Lần đầu</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {new Date(entry.first_seen).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {entry.last_seen && (
                                                            <div>
                                                                <p className="text-[11px] text-slate-400">Lần cuối</p>
                                                                <p className="text-xs text-slate-500">
                                                                    {new Date(entry.last_seen).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {entry.lat != null && entry.lon != null && (
                                                            <div className="ml-auto">
                                                                <a
                                                                    href={`https://www.google.com/maps?q=${entry.lat},${entry.lon}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-[10px] text-indigo-500 hover:underline"
                                                                    title={`${entry.lat}, ${entry.lon}`}
                                                                >
                                                                    📌 Bản đồ
                                                                </a>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {/* Ban IPs */}
                                {data.ban_ips.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <AlertTriangle className="w-3.5 h-3.5" /> IP đã bị cấm liên quan
                                        </p>
                                        <div className="space-y-2">
                                            {data.ban_ips.map((b, i) => (
                                                <div key={i} className="flex items-center justify-between bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800 rounded-lg px-4 py-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                                                        <span className="font-mono text-sm font-semibold text-red-700 dark:text-red-400 select-all">{b.ip}</span>
                                                    </div>
                                                    <div className="text-right">
                                                        {b.reason && <p className="text-xs text-red-500 max-w-[160px] truncate">{b.reason}</p>}
                                                        {b.banned_at && (
                                                            <p className="text-[11px] text-slate-400">
                                                                {new Date(b.banned_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Access History Table */}
                                {data.access_history.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                            <Activity className="w-3.5 h-3.5" /> Lịch sử truy cập gần đây
                                        </p>
                                        <div className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs text-slate-500 font-semibold uppercase">Ngày</th>
                                                        <th className="px-4 py-2 text-right text-xs text-slate-500 font-semibold uppercase">Số lượt</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                    {data.access_history.slice(0, 10).map((row, i) => (
                                                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                                                            <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                                                                {new Date(row.date + 'T00:00:00').toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                                            </td>
                                                            <td className="px-4 py-2 text-right">
                                                                <span className="font-bold text-indigo-600 dark:text-indigo-400">{row.count}</span>
                                                                <span className="text-slate-400 ml-1 text-xs">lần</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
    const colorMap: Record<string, string> = {
        indigo: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800',
        emerald: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800',
        amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800',
    };
    return (
        <div className={`rounded-xl border p-3 ${colorMap[color] || colorMap.indigo}`}>
            <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-[11px] text-slate-500 dark:text-slate-400">{label}</span></div>
            <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────
export default function AdminUserList() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
    const [bans, setBans] = useState<any[]>([]);
    const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
    const [systemConfig, setSystemConfig] = useState<Record<string, string>>({});
    
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'users' | 'moderation' | 'logs' | 'settings'>('users');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedUser, setSelectedUser] = useState<{ id: number; username: string } | null>(null);
    const [announcementText, setAnnouncementText] = useState('');
    const [showOnlineOnly, setShowOnlineOnly] = useState(false);

    useEffect(() => {
        loadData();
        
        // Cập nhật danh sách online mỗi 3s khi đang ở tab users để hiển thị off nhanh
        const interval = setInterval(async () => {
            if (activeTab === 'users') {
                try {
                    const online = await getOnlineUsersListBff();
                    setOnlineUsers(online);
                } catch(e) {}
            }
        }, 3000);
        
        return () => clearInterval(interval);
    }, [activeTab]);

    async function loadData() {
        setLoading(true);
        try {
            if (activeTab === 'users') {
                const [usersData, online] = await Promise.all([getUsersBff(), getOnlineUsersListBff()]);
                setUsers(usersData);
                setOnlineUsers(online);
            } else if (activeTab === 'moderation') {
                const bansData = await getBansBff();
                setBans(bansData || []);
            } else if (activeTab === 'logs') {
                const logs = await getAuditLogsBff(100);
                setAuditLogs(logs);
            } else if (activeTab === 'settings') {
                const config = await getSystemConfigBff();
                setSystemConfig(config);
                setAnnouncementText(config.announcement || '');
            }
        } catch (error) {
            // silenced
        } finally {
            setLoading(false);
        }
    }

    const sortedUsers = [...users]
        .filter(u => {
            const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesOnline = showOnlineOnly ? onlineUsers.includes(u.username) : true;
            return matchesSearch && matchesOnline;
        })
        .sort((a, b) => {
            // Priority 1: Hit count for selectedDate (descending)
            const countA = a.access_history?.find(h => h.date === selectedDate)?.count || 0;
            const countB = b.access_history?.find(h => h.date === selectedDate)?.count || 0;
            if (countB !== countA) return countB - countA;

            // Priority 2: Total history hits (descending)
            const totalA = a.access_history?.reduce((acc, h) => acc + h.count, 0) || 0;
            const totalB = b.access_history?.reduce((acc, h) => acc + h.count, 0) || 0;
            if (totalB !== totalA) return totalB - totalA;

            // Priority 3: Role (Admin first)
            if (a.role !== b.role) return (b.role || 0) - (a.role || 0);

            // Priority 4: Username (alphabetical)
            return a.username.localeCompare(b.username);
        });

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
        <>
            {/* Modal */}
            {selectedUser && (
                <UserDetailModal
                    userId={selectedUser.id}
                    username={selectedUser.username}
                    onClose={() => setSelectedUser(null)}
                />
            )}

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

                        <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-lg overflow-x-auto no-scrollbar">
                            <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon={<UserIcon className="w-4 h-4" />} label="Người dùng" />
                            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<Terminal className="w-4 h-4" />} label="Nhật ký" />
                            <TabButton active={activeTab === 'moderation'} onClick={() => setActiveTab('moderation')} icon={<Shield className="w-4 h-4" />} label="Cấm" />
                            <TabButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon={<Settings className="w-4 h-4" />} label="Cài đặt" />
                        </div>
                    </div>

                    {(activeTab === 'users' || activeTab === 'moderation') && (
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

                            {activeTab === 'users' && (
                                <button
                                    onClick={() => setShowOnlineOnly(!showOnlineOnly)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all border ${
                                        showOnlineOnly 
                                            ? 'bg-green-100 border-green-200 text-green-700 dark:bg-green-900/30 dark:border-green-800 dark:text-green-400' 
                                            : 'bg-slate-100 border-transparent text-slate-600 dark:bg-slate-900 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800'
                                    }`}
                                >
                                    <Activity className={`w-4 h-4 ${showOnlineOnly ? 'animate-pulse' : ''}`} />
                                    Online ({onlineUsers.length})
                                </button>
                            )}
                        </div>
                    )}
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
                                        <th className="px-6 py-3">IP / Vị trí</th>
                                        <th className="px-6 py-3 text-right">Thao tác</th>
                                        <th className="px-6 py-3">Ngày {selectedDate.split('-').reverse().slice(0, 2).join('/')}</th>
                                        <th className="px-6 py-3">Lịch sử (30n)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {sortedUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-slate-900 dark:text-white">
                                                {/* ← Click vào đây để xem chi tiết */}
                                                <button
                                                    onClick={() => setSelectedUser({ id: user.id, username: user.username })}
                                                    className="flex items-center gap-2 group hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                    title="Xem IP & lượt truy cập"
                                                >
                                                    <div className="relative">
                                                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/30 flex items-center justify-center text-slate-500 group-hover:text-indigo-600 transition-colors">
                                                            <UserIcon className="w-4 h-4" />
                                                        </div>
                                                        {onlineUsers.includes(user.username) && (
                                                            <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-white dark:border-slate-800 rounded-full shadow-sm" title="Đang trực tuyến" />
                                                        )}
                                                    </div>
                                                    <div className="flex flex-col items-start">
                                                        <span className="font-semibold">{user.username}</span>
                                                        {onlineUsers.includes(user.username) && (
                                                            <span className="text-[10px] text-green-600 dark:text-green-400 font-bold uppercase tracking-wider">Trực tuyến</span>
                                                        )}
                                                    </div>
                                                    <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                                                </button>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.role === 1 ? (
                                                    <span className="px-2 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-md text-xs font-bold">Admin</span>
                                                ) : (
                                                    <div className="flex items-center gap-2">
                                                        <span className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-md text-xs font-medium">User</span>
                                                        <span className={`px-2 py-1 rounded-md text-xs font-bold ${user.class_change_limit === -1 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                                            {user.class_change_limit === -1 ? '∞ lượt đổi lớp' : `${user.class_change_limit ?? 5} lượt đổi lớp`}
                                                        </span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-300">{user.last_ip || '—'}</span>
                                                    {user.last_location && (
                                                        <span className="text-[10px] text-indigo-500 font-medium">{user.last_location}</span>
                                                    )}
                                                </div>
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
                ) : activeTab === 'logs' ? (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
                        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="font-bold flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-indigo-500" />
                                Nhật ký hệ thống
                            </h3>
                            <button onClick={loadData} className="text-xs text-indigo-500 hover:underline">Làm mới</button>
                        </div>
                        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 uppercase text-xs font-semibold sticky top-0">
                                    <tr>
                                        <th className="px-6 py-3">Thời gian</th>
                                        <th className="px-6 py-3">Admin</th>
                                        <th className="px-6 py-3">Hành động</th>
                                        <th className="px-6 py-3">Chi tiết</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {auditLogs.map((log, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                            <td className="px-6 py-3 text-slate-500 text-xs whitespace-nowrap">
                                                {new Date(log.created_at).toLocaleString('vi-VN')}
                                            </td>
                                            <td className="px-6 py-3 font-medium text-slate-700 dark:text-slate-200">
                                                {log.username}
                                            </td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    log.action.includes('BAN') ? 'bg-red-100 text-red-700' : 
                                                    log.action.includes('UPDATE') ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-500 text-xs truncate max-w-xs" title={log.details ?? undefined}>
                                                {log.details}
                                            </td>
                                        </tr>
                                    ))}
                                    {auditLogs.length === 0 && (
                                        <tr>
                                            <td colSpan={4} className="px-6 py-10 text-center text-slate-400 italic">Trống</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'moderation' ? (
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
                ) : activeTab === 'settings' ? (
                    <div className="max-w-2xl">
                        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-indigo-500" />
                                Cấu hình hệ thống
                            </h3>
                            
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                        Thông báo toàn trang (Announcement Banner)
                                    </label>
                                    <textarea 
                                        value={announcementText}
                                        onChange={(e) => setAnnouncementText(e.target.value)}
                                        placeholder="Nhập nội dung thông báo hiển thị cho tất cả người dùng..."
                                        className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[120px] transition-all"
                                    />
                                    <p className="mt-1 text-[10px] text-slate-400 italic">* Để trống nếu muốn ẩn thông báo.</p>
                                </div>
                                
                                <div className="pt-4 flex justify-end">
                                    <button 
                                        onClick={async () => {
                                            try {
                                                await updateSystemConfigBff({ announcement: announcementText });
                                                toast.success('Đã cập nhật cấu hình');
                                            } catch (e) {
                                                toast.error('Cập nhật thất bại');
                                            }
                                        }}
                                        className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/20 transition-all active:scale-95"
                                    >
                                        <Send className="w-4 h-4" />
                                        Lưu cấu hình
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="mt-6 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl p-4 flex gap-3">
                            <Info className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <div className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                                <strong>Lưu ý:</strong> Mọi thay đổi trong phần cài đặt sẽ được ghi lại trong nhật ký hệ thống. Hãy cẩn thận khi thay đổi các thông số nhạy cảm.
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden p-6 text-center text-slate-500">
                        Chức năng chưa được triển khai đầy đủ.
                    </div>
                )}
            </div>
        </>
    );
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition-all flex items-center gap-2 whitespace-nowrap ${active ? 'bg-white dark:bg-slate-800 text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
        >
            {icon}
            {label}
        </button>
    );
}
