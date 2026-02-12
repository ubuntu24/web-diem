import { Student } from '@/lib/types';
import { User, CreditCard, Users, Calendar, Award } from 'lucide-react';

interface SidebarProps {
    student: Student;
    gpa: string;
}

export default function Sidebar({ student, gpa }: SidebarProps) {
    return (
        <aside className="w-full md:w-80 shrink-0 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 flex flex-col items-center text-center sticky top-6">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-sm">
                    <User className="w-10 h-10 text-slate-400" />
                </div>

                <h2 className="text-xl font-bold text-slate-900 mb-4">{student.ho_ten}</h2>

                <div className="w-full space-y-3 text-sm text-slate-600">
                    <div className="flex items-center justify-center gap-2 bg-slate-50 p-2 rounded-lg">
                        <CreditCard className="w-4 h-4 text-blue-600" />
                        <span>{student.msv}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-slate-50 p-2 rounded-lg">
                        <Users className="w-4 h-4 text-blue-600" />
                        <span>{student.ma_lop || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-center gap-2 bg-slate-50 p-2 rounded-lg">
                        <Calendar className="w-4 h-4 text-blue-600" />
                        <span>{student.ngay_sinh || 'N/A'}</span>
                    </div>
                </div>

                <div className="w-full mt-6 pt-6 border-t border-slate-100">
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-lg">
                        <span className="block text-xs uppercase tracking-wider opacity-80 mb-1 font-semibold">CPA Tích Lũy</span>
                        <span className="text-3xl font-extrabold">{gpa}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
