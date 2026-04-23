import { motion } from 'framer-motion';
import { Sparkles, BookOpen, Users, Activity } from 'lucide-react';
import { useEffect, useState } from 'react';

interface HeroSectionProps {
    username: string;
    totalClasses: number;
    totalStudents: number;
    onlineUsers?: number;
    role: number;
}

export default function HeroSection({ username, totalClasses, totalStudents, onlineUsers, role }: HeroSectionProps) {
    const [greeting, setGreeting] = useState('Chào bạn');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour < 12) setGreeting('Chào buổi sáng');
        else if (hour < 18) setGreeting('Chào buổi chiều');
        else setGreeting('Chào buổi tối');
    }, []);

    // role 0 = User, role 1 = Admin
    const isUser = role === 0;

    return (
        <div className="mb-8 space-y-6">
            {/* Greeting Banner */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 p-8 text-white shadow-xl"
            >
                <div className="relative z-10">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 flex flex-wrap items-center gap-2 md:gap-3">
                        {greeting}, {username}! <span className="text-3xl md:text-4xl">👋</span>
                    </h1>
                    <p className="text-indigo-100 text-base md:text-lg opacity-90">
                        {isUser
                            ? "Xem kết quả thành tích và theo dõi tiến độ cá nhân của bạn."
                            : "Quản lý dữ liệu hiệu suất và theo dõi tiến độ của các lớp."}
                    </p>
                </div>

                {/* Decorative Circles */}
                <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-white opacity-10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-indigo-400 opacity-20 rounded-full blur-2xl pointer-events-none"></div>
            </motion.div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatsCard
                    icon={<BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
                    label={isUser ? "Lớp đang theo dõi" : "Lớp đang quản lý"}
                    value={totalClasses.toString()}
                    color="bg-blue-50 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800"
                />
                <StatsCard
                    icon={<Users className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
                    label={isUser ? "Thành viên lớp" : "Tổng số người dùng"}
                    value={totalStudents > 0 ? totalStudents.toString() : "--"}
                    color="bg-emerald-50 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800"
                />
                <StatsCard
                    icon={<Activity className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
                    label="Đang trực tuyến"
                    value={onlineUsers ? `${onlineUsers} người` : "1 người"}
                    color="bg-amber-50 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
                />
            </div>
        </div>
    );
}

function StatsCard({ icon, label, value, color }: { icon: any, label: string, value: string, color: string }) {
    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className={`p-4 rounded-xl border ${color} flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow dark:bg-slate-800 dark:border-slate-700`}
        >
            <div className="p-3 bg-white dark:bg-slate-700 rounded-lg shadow-sm">
                {icon}
            </div>
            <div>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{label}</p>
                <p className="text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
            </div>
        </motion.div>
    );
}
