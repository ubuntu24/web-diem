"use client";

import React, { useState, useEffect, useRef } from 'react';
import { User as UserType, getChatHistoryBff, banUserBff, ChatMessage } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ShieldAlert, MessageCircle, User, Sparkles, Zap } from 'lucide-react';
import { toast } from 'react-hot-toast';

// Local Message mapping
type Message = ChatMessage;

interface PublicChatProps {
    user: UserType | null;
    socket: WebSocket | null;
    isOpen: boolean;
    onClose: () => void;
}

export default function PublicChat({ user, socket, isOpen, onClose }: PublicChatProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<number>(socket?.readyState ?? 3);
    const scrollRef = useRef<HTMLDivElement>(null);

    const [banModal, setBanModal] = useState<{ isOpen: boolean; msg: Message | null }>({ isOpen: false, msg: null });
    const [banReason, setBanReason] = useState('Hành vi không chuẩn mực khi chat');

    const [replyTo, setReplyTo] = useState<Message | null>(null);

    // Monitor socket state changes
    useEffect(() => {
        if (!socket) {
            setStatus(3); // CLOSED
            return;
        }

        const updateStatus = () => {
            setStatus(socket.readyState);
        };
        const handleError = () => updateStatus();

        // Initial check
        updateStatus();

        socket.addEventListener('open', updateStatus);
        socket.addEventListener('close', updateStatus);
        socket.addEventListener('error', handleError);

        return () => {
            socket.removeEventListener('open', updateStatus);
            socket.removeEventListener('close', updateStatus);
            socket.removeEventListener('error', handleError);
        };
    }, [socket]);

    useEffect(() => {
        if (isOpen) {
            getChatHistoryBff().then(setMessages).catch(() => { });
        }
    }, [isOpen]);

    useEffect(() => {
        if (!socket) return;

        const handleMsg = (event: MessageEvent) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'chat_message') {
                    setMessages((prev: Message[]) => [...prev, {
                        id: data.id,
                        username: data.username,
                        full_name: data.full_name,
                        message: data.message,
                        timestamp: data.timestamp,
                        reply_to: data.reply_to,
                        reply_metadata: data.reply_metadata
                    }]);
                }
                if (data.type === 'user_banned') {
                    setMessages((prev: Message[]) => [...prev, {
                        id: Date.now(),
                        username: 'SYSTEM',
                        full_name: '🛡️ HỆ THỐNG',
                        message: `Người dùng ${data.username} đã bị cấm khỏi phòng chat do vi phạm nội quy.`,
                        timestamp: new Date().toISOString()
                    }]);
                    if (user?.loginUsername === data.username) {
                        toast.error('Bạn đã bị cấm khỏi phòng chat!', { duration: 5000 });
                        setTimeout(() => window.location.reload(), 2000);
                    }
                }
            } catch { }
        };

        socket.addEventListener('message', handleMsg);
        return () => socket.removeEventListener('message', handleMsg);
    }, [socket, user]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const send = () => {
        if (!input.trim() || !socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ 
            type: 'chat', 
            message: input,
            reply_to: replyTo?.id
        }));
        setInput('');
        setReplyTo(null);
    };

    const handleBanClick = (msg: Message) => {
        setBanModal({ isOpen: true, msg });
        setBanReason('Hành vi không chuẩn mực khi chat');
    };

    const executeBan = async () => {
        if (!banModal.msg) return;
        const targetUsername = banModal.msg.username;
        
        setBanModal({ isOpen: false, msg: null });
        const loadingToast = toast.loading(`Đang thực hiện cấm ${targetUsername}...`);
        
        try {
            await banUserBff(targetUsername, undefined, undefined, banReason || 'Vi phạm nội quy chat');
            toast.success(`Đã ban ${targetUsername} thành công!`, { id: loadingToast });
        } catch (e) {
            toast.error('Lỗi khi thực hiện lệnh cấm: ' + e, { id: loadingToast });
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Modal Overlay */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/40 backdrop-blur-[6px] z-[60]"
                        onClick={onClose}
                    />

                    {/* Ban Confirmation Modal (Highest Z-Index) */}
                    <AnimatePresence>
                        {banModal.isOpen && (
                            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                                    onClick={() => setBanModal({ isOpen: false, msg: null })}
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                    className="relative bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800 p-8"
                                >
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-rose-500/10 dark:bg-rose-500/20 rounded-3xl flex items-center justify-center mb-6 mx-auto">
                                            <ShieldAlert className="w-10 h-10 text-rose-600 dark:text-rose-500" />
                                        </div>
                                        
                                        <h4 className="text-2xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">Xác nhận cấm?</h4>
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 font-bold italic">
                                            Quyền trượng đang trừng phạt <span className="text-rose-600 font-black">"{banModal.msg?.username}"</span>. 
                                        </p>

                                        <div className="space-y-6">
                                            <div className="text-left">
                                                <label className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest ml-1 mb-2 block">Lý do hành quyết</label>
                                                <textarea 
                                                    value={banReason}
                                                    onChange={(e) => setBanReason(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border-2 border-border rounded-2xl px-4 py-3 text-sm focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all dark:text-white resize-none font-bold"
                                                    rows={3}
                                                    placeholder="Nhập lý do cụ thể..."
                                                />
                                            </div>

                                            <div className="flex gap-4">
                                                <button 
                                                    onClick={() => setBanModal({ isOpen: false, msg: null })}
                                                    className="flex-1 px-4 py-4 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-black uppercase tracking-widest hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95"
                                                >
                                                    Hủy
                                                </button>
                                                <button 
                                                    onClick={executeBan}
                                                    className="flex-1 px-4 py-4 rounded-2xl bg-rose-600 text-white text-xs font-black uppercase tracking-widest hover:bg-rose-700 shadow-xl shadow-rose-500/30 transition-all active:scale-95"
                                                >
                                                    Thực thi
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        )}
                    </AnimatePresence>

                    {/* Chat Modal */}
                    <motion.div
                        initial={{ opacity: 0, y: 100, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 100, scale: 0.9 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed inset-x-0 bottom-0 sm:bottom-28 sm:right-8 sm:left-auto z-[70] w-full sm:w-96 h-[85vh] sm:h-[600px] flex flex-col mx-auto sm:mx-0"
                    >
                        <div className="premium-glass rounded-t-[3rem] sm:rounded-[2.5rem] shadow-2xl border-border/50 overflow-hidden flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between px-7 py-6 sm:px-6 sm:py-5 bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-xl">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 sm:w-10 sm:h-10 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md shadow-inner border border-white/10 group animate-pulse">
                                        <Zap className="w-6 h-6 sm:w-5 h-5 text-white fill-white/20" />
                                    </div>
                                    <div>
                                        <h3 className="font-black text-sm uppercase tracking-widest italic">lifesuck Stream</h3>
                                        <div className="flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full shadow-[0_0_10px_rgba(74,222,128,0.8)] ${status === 1 ? 'bg-emerald-400' : status === 0 ? 'bg-amber-400' : 'bg-rose-500'
                                                }`}></span>
                                            <span className="text-[10px] text-white/90 font-black uppercase tracking-tighter">
                                                {status === 1 ? 'Chế độ trực tiếp' : status === 0 ? 'Đang chuẩn bị...' : 'Ngoại tuyến'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-3 sm:p-2 rounded-2xl hover:bg-white/20 transition-all active:scale-90 bg-black/10 border border-white/5 shadow-inner"
                                >
                                    <X className="w-5 h-5 sm:w-4 sm:h-4" />
                                </button>
                            </div>

                            {/* Messages Area */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/10 dark:bg-slate-900/10 scrollbar-none">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50 py-20 animate-pulse">
                                        <Sparkles className="w-12 h-12 text-indigo-400" />
                                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 italic">Khởi thủy dòng chảy tri thức</p>
                                    </div>
                                )}
                                {messages.map((m) => {
                                    const isSystem = m.username === 'SYSTEM';
                                    const isMe = m.username?.toLowerCase() === user?.loginUsername?.toLowerCase();

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                                            animate={{ opacity: 1, scale: 1, y: 0 }}
                                            key={m.id}
                                            className={`flex flex-col group ${isSystem ? 'items-center py-4' : isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {!isSystem && (
                                                <div className="flex items-center gap-3 mb-2 px-1">
                                                    {!isMe && <User className="w-3.5 h-3.5 text-slate-400" />}
                                                    <span className={`text-[11px] font-black uppercase tracking-[0.15em] ${isMe ? 'text-indigo-500 italic' : 'text-slate-500'}`}>
                                                        {m.full_name || m.username}
                                                    </span>
                                                    {user?.role === 1 && !isMe && (
                                                        <button
                                                            onClick={() => handleBanClick(m)}
                                                            className="text-[9px] text-rose-500 hover:text-white hover:bg-rose-600 font-black uppercase transition-all flex items-center gap-1 bg-rose-500/10 px-2 py-1 rounded-lg border border-rose-500/20 active:scale-95"
                                                            title="Trừng phạt"
                                                        >
                                                            <ShieldAlert className="w-3 h-3" />
                                                            BAN
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quoted Message */}
                                            {m.reply_metadata && (
                                                <div className={`mb-2 max-w-[85%] text-[11px] px-4 py-2.5 rounded-2xl border-l-[6px] shadow-sm ${
                                                    isMe 
                                                        ? 'bg-indigo-500/5 dark:bg-indigo-500/10 border-indigo-400 text-indigo-700/80 dark:text-indigo-300 font-bold' 
                                                        : 'bg-slate-500/5 dark:bg-slate-800/80 border-slate-400 text-slate-500 dark:text-slate-400 font-bold'
                                                } truncate`}>
                                                    <span className="font-black block text-[9px] uppercase tracking-widest mb-1 opacity-70 italic">
                                                        @{m.reply_metadata.full_name || m.reply_metadata.username}
                                                    </span>
                                                    <span className="italic">"{m.reply_metadata.message}"</span>
                                                </div>
                                            )}

                                            <div className="relative flex items-center gap-3 max-w-[95%]">
                                                {!isSystem && isMe && (
                                                    <button 
                                                        onClick={() => setReplyTo(m)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 sm:p-2 bg-indigo-500/5 dark:bg-indigo-500/10 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-slate-400 active:scale-90"
                                                    >
                                                        <MessageCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                    </button>
                                                )}

                                                <div className={`${isSystem
                                                        ? 'bg-rose-500/10 border-2 border-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] px-6 py-2 rounded-full font-black uppercase tracking-widest italic flex items-center gap-2'
                                                        : isMe
                                                            ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-[1.5rem] rounded-tr-none px-5 py-3 text-sm shadow-xl shadow-indigo-500/15 font-bold leading-relaxed'
                                                            : 'bg-white dark:bg-slate-800/80 backdrop-blur-md border-2 border-border/50 text-slate-800 dark:text-slate-100 rounded-[1.5rem] rounded-tl-none px-5 py-3 text-sm shadow-lg font-bold leading-relaxed'
                                                    } transition-all hover:scale-[1.02] active:scale-[0.98]`}>
                                                    {isSystem && <ShieldAlert className="w-3.5 h-3.5" />}
                                                    {m.message}
                                                </div>

                                                {!isSystem && !isMe && (
                                                    <button 
                                                        onClick={() => setReplyTo(m)}
                                                        className="opacity-0 group-hover:opacity-100 p-2 sm:p-2 bg-slate-500/5 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-xl transition-all text-slate-400 active:scale-90"
                                                    >
                                                        <MessageCircle className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
                                                    </button>
                                                )}
                                            </div>

                                            {!isSystem && (
                                                <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-2 px-1 opacity-60">
                                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Input Area */}
                            <div className="p-6 bg-white dark:bg-slate-900 border-t border-border/50">
                                {/* Reply Preview */}
                                <AnimatePresence>
                                    {replyTo && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="bg-indigo-500/5 dark:bg-indigo-500/10 border-2 border-indigo-500/20 rounded-t-2xl px-4 py-3 flex items-center justify-between mb-0 border-b-0 overflow-hidden"
                                        >
                                            <div className="flex flex-col truncate pr-4 text-left">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-3 h-3 text-indigo-500" />
                                                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest italic">Phản hồi @{replyTo.full_name || replyTo.username}</span>
                                                </div>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate italic mt-0.5">"{replyTo.message.substring(0, 50)}..."</span>
                                            </div>
                                            <button 
                                                onClick={() => setReplyTo(null)}
                                                className="p-2 hover:bg-rose-500/10 hover:text-rose-500 rounded-xl transition-all text-slate-400 active:scale-90"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className={`relative flex items-center gap-3 ${replyTo ? 'border-2 border-indigo-500/20 border-t-0 p-3 bg-indigo-500/[0.02] rounded-b-3xl' : ''}`}>
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && send()}
                                            placeholder={user ? "Phát sóng tin nhắn..." : "Mất kết nối..."}
                                            disabled={!user || status !== 1}
                                            className={`w-full bg-slate-50 dark:bg-slate-950 border-2 border-border rounded-2xl px-6 py-4 sm:px-5 sm:py-3.5 text-base sm:text-sm outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/50 transition-all disabled:opacity-50 dark:text-slate-100 placeholder:text-slate-500 font-bold italic shadow-inner ${replyTo ? 'bg-transparent border-none' : ''}`}
                                        />
                                    </div>
                                    <button
                                        onClick={send}
                                        disabled={!user || !input.trim() || status !== 1}
                                        className="p-4 sm:p-3.5 bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl shadow-xl shadow-indigo-500/30 hover:scale-[1.05] active:scale-[0.95] transition-all disabled:opacity-50 disabled:grayscale flex-shrink-0 border border-white/10"
                                    >
                                        <Send className="w-6 h-6 sm:w-5 h-5 flex-shrink-0" />
                                    </button>
                                </div>
                                {!user && (
                                    <p className="text-[10px] text-center text-slate-500 mt-4 font-black uppercase tracking-[0.2em] italic opacity-70 animate-pulse">
                                        Hệ thống yêu cầu xác thực để phát sóng
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
