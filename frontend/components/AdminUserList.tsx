import { useState, useEffect } from 'react';
import { AdminUser, getUsers, updateUserPermissions, getClasses } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Shield, Edit, Save, X, Check, Loader2, User as UserIcon } from 'lucide-react';

export default function AdminUserList() {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [allClasses, setAllClasses] = useState<string[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Edit Modal State
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        try {
            const [usersData, classesData] = await Promise.all([getUsers(), getClasses()]);
            setUsers(usersData);
            setAllClasses(classesData);
        } catch (error) {
            console.error("Failed to load admin data", error);
        } finally {
            setLoading(false);
        }
    }

    async function handleSavePermissions() {
        if (!editingUser) return;
        setSaving(true);
        try {
            await updateUserPermissions(editingUser.id, selectedPermissions);
            // Update local state
            setUsers(users.map(u =>
                u.id === editingUser.id ? { ...u, allowed_classes: selectedPermissions } : u
            ));
            alert("Đã cập nhật quyền thành công!");
            setEditingUser(null);
        } catch (error) {
            console.error("Failed to save permissions", error);
            alert("Có lỗi xảy ra khi lưu quyền hạn.");
        } finally {
            setSaving(false);
        }
    }

    const filteredUsers = users.filter(u =>
        u.username.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const openEditModal = (user: AdminUser) => {
        setEditingUser(user);
        setSelectedPermissions(user.allowed_classes || []);
    };

    const togglePermission = (cls: string) => {
        setSelectedPermissions(prev =>
            prev.includes(cls) ? prev.filter(c => c !== cls) : [...prev, cls]
        );
    };

    const toggleAll = () => {
        if (selectedPermissions.length === allClasses.length) {
            setSelectedPermissions([]);
        } else {
            setSelectedPermissions([...allClasses]);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Shield className="w-6 h-6 text-indigo-600" />
                        Quản Lý Người Dùng
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Phân quyền xem lớp cho tài khoản thường</p>
                </div>

                <div className="relative w-full md:w-64">
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
                                    <th className="px-6 py-3">Lớp được xem</th>
                                    <th className="px-6 py-3 text-right">Thao tác</th>
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
                                        <td className="px-6 py-4">
                                            {user.role === 1 ? (
                                                <span className="text-xs italic opacity-70 text-slate-500 dark:text-slate-400">Toàn quyền</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1">
                                                    {user.allowed_classes && user.allowed_classes.length > 0 ? (
                                                        <>
                                                            {user.allowed_classes.slice(0, 3).map(c => (
                                                                <span key={c} className="px-1.5 py-0.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 rounded text-xs">
                                                                    {c}
                                                                </span>
                                                            ))}
                                                            {user.allowed_classes.length > 3 && (
                                                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs rounded">
                                                                    +{user.allowed_classes.length - 3}
                                                                </span>
                                                            )}
                                                        </>
                                                    ) : (
                                                        <span className="text-slate-400 italic text-xs">Chưa cấp quyền</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.role !== 1 && (
                                                <button
                                                    onClick={() => openEditModal(user)}
                                                    className="px-3 py-1.5 text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-md transition-colors text-xs font-bold flex items-center gap-1 ml-auto"
                                                >
                                                    <Edit className="w-3.5 h-3.5" />
                                                    Cấp quyền
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            <AnimatePresence>
                {editingUser && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
                        onClick={() => setEditingUser(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                                <h3 className="font-bold text-lg text-slate-800 dark:text-white flex items-center gap-2">
                                    <Shield className="w-5 h-5 text-indigo-500" />
                                    Cấp quyền: <span className="text-indigo-600">{editingUser.username}</span>
                                </h3>
                                <button onClick={() => setEditingUser(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    <X className="w-5 h-5 text-slate-500" />
                                </button>
                            </div>

                            <div className="p-4 overflow-y-auto flex-1 bg-white dark:bg-slate-800">
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                                        Đã chọn: <span className="text-indigo-600 font-bold">{selectedPermissions.length}</span> lớp
                                    </span>
                                    <button
                                        onClick={toggleAll}
                                        className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                    >
                                        {selectedPermissions.length === allClasses.length ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {allClasses.map(cls => (
                                        <div
                                            key={cls}
                                            onClick={() => togglePermission(cls)}
                                            className={`
                                                cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium flex items-center justify-between transition-all select-none
                                                ${selectedPermissions.includes(cls)
                                                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-900/40 dark:border-indigo-800 dark:text-indigo-300'
                                                    : 'bg-slate-50 border-slate-100 text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'}
                                            `}
                                        >
                                            <span>{cls}</span>
                                            {selectedPermissions.includes(cls) && <Check className="w-3.5 h-3.5" />}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end gap-3 sticky bottom-0 z-10 transition-colors">
                                <button
                                    onClick={() => setEditingUser(null)}
                                    className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleSavePermissions}
                                    disabled={saving}
                                    className="px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-lg flex items-center gap-2 disabled:opacity-70 transition-all"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Lưu thay đổi
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
