'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User as UserType, getChatHistoryBff, banUserBff, ChatMessage } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ShieldAlert, MessageCircle, User } from 'lucide-react';

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
    const [status, setStatus] = useState<number>(socket?.readyState ?? 0);
    const scrollRef = useRef<HTMLDivElement>(null);

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
                        timestamp: data.timestamp
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
        socket.send(JSON.stringify({ type: 'chat', message: input }));
        setInput('');
    };

    const handleBan = async (msg: Message) => {
        if (user?.role !== 1) return;
        if (!confirm(`Bạn có chắc muốn BAN người dùng "${msg.username}"?`)) return;

        try {
            await banUserBff(msg.username, undefined, undefined, 'Hành vi không chừng mực trong chat');
            alert('Đã ban người dùng!');
        } catch (e) {
            alert('Lỗi: ' + e);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Modal Overlay (optional, but keep it consistent with feedback if needed) */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[60]"
                        onClick={onClose}
                    />

                    {/* Chat Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 30 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="fixed bottom-24 right-6 z-[70] w-[calc(100vw-3rem)] max-w-md h-[500px] flex flex-col"
                    >
                        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col h-full">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                                        <MessageCircle className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-sm tracking-tight">Chat Công Cộng</h3>
                                        <div className="flex items-center gap-1.5">
                                            <span className={`w-1.5 h-1.5 rounded-full animate-pulse shadow-[0_0_8px_rgba(74,222,128,0.5)] ${status === 1 ? 'bg-green-400' : status === 0 ? 'bg-amber-400' : 'bg-red-500'
                                                }`}></span>
                                            <span className="text-[10px] text-white/80 font-medium">
                                                {status === 1 ? 'Trực tiếp' : status === 0 ? 'Đang kết nối...' : 'Ngoại tuyến'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Messages Area */}
                            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50/30 dark:bg-slate-900/10">
                                {messages.length === 0 && (
                                    <div className="flex flex-col items-center justify-center h-full text-center space-y-3 opacity-30 py-20">
                                        <MessageCircle className="w-10 h-10 text-slate-400" />
                                        <p className="text-xs font-semibold text-slate-500">Mở lời trước đi nào!</p>
                                    </div>
                                )}
                                {messages.map((m) => {
                                    const isSystem = m.username === 'SYSTEM';

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            key={m.id}
                                            className={`flex flex-col ${isSystem ? 'items-center py-2' : isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {!isSystem && (
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    {!isMe && <User className="w-3 h-3 text-slate-400" />}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-indigo-500' : 'text-slate-500'}`}>
                                                        {m.full_name || m.username}
                                                    </span>
                                                    {user?.role === 1 && !isMe && (
                                                        <button
                                                            onClick={() => handleBan(m)}
                                                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors flex items-center gap-0.5 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded"
                                                            title="Ban tài khoản và thiết bị"
                                                        >
                                                            <ShieldAlert className="w-3 h-3" />
                                                            Ban
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                            <div className={`${isSystem
                                                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-700 dark:text-red-400 text-xs px-4 py-1.5 rounded-full font-bold'
                                                    : isMe
                                                        ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm'
                                                        : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none px-4 py-2 rounded-2xl max-w-[85%] text-sm shadow-sm'
                                                } transition-all hover:shadow-md`}>
                                                {m.message}
                                            </div>
                                            {!isSystem && (
                                                <span className="text-[9px] text-slate-400 mt-1 font-medium px-1">
                                                    {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            )}
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-700">
                                <div className="relative flex items-center gap-2">
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && send()}
                                            placeholder={user ? "Nhập nội dung chat..." : "Đăng nhập để chat..."}
                                            disabled={!user}
                                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all disabled:opacity-50 dark:text-slate-100 placeholder:text-slate-400 font-medium"
                                        />
                                    </div>
                                    <button
                                        onClick={send}
                                        disabled={!user || !input.trim()}
                                        className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-violet-500/20 active:scale-90 transition-all disabled:opacity-50 disabled:grayscale flex-shrink-0"
                                    >
                                        <Send className="w-5 h-5" />
                                    </button>
                                </div>
                                {!user && (
                                    <p className="text-[10px] text-center text-slate-500 mt-2">
                                        Vui lòng đăng nhập để có thể gửi tin nhắn.
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
