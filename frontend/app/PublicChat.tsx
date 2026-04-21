'use client';

import React, { useState, useEffect, useRef } from 'react';
import { User as UserType, getChatHistoryBff, banUserBff, ChatMessage } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, X, ShieldAlert, MessageCircle, User } from 'lucide-react';
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
    const [status, setStatus] = useState<number>(socket?.readyState ?? 0);
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
                        className="fixed inset-0 bg-black/40 backdrop-blur-[4px] z-[60]"
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
                                    className="relative bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden border border-slate-200 dark:border-slate-800"
                                >
                                    <div className="p-6">
                                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center mb-5 mx-auto">
                                            <ShieldAlert className="w-8 h-8 text-red-600 dark:text-red-500" />
                                        </div>
                                        
                                        <h4 className="text-lg font-bold text-center text-slate-900 dark:text-white mb-2">Xác nhận cấm tài khoản?</h4>
                                        <p className="text-sm text-center text-slate-500 dark:text-slate-400 mb-6 px-4">
                                            Bạn đang thực hiện cấm <span className="font-bold text-red-600">"{banModal.msg?.username}"</span>. 
                                            Tài khoản, IP và thiết bị của người này sẽ không thể truy cập chat.
                                        </p>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1 mb-1.5 block">Lý do cấm</label>
                                                <textarea 
                                                    value={banReason}
                                                    onChange={(e) => setBanReason(e.target.value)}
                                                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all dark:text-white resize-none"
                                                    rows={3}
                                                    placeholder="Nhập lý do cụ thể..."
                                                />
                                            </div>

                                            <div className="flex gap-3 pt-2">
                                                <button 
                                                    onClick={() => setBanModal({ isOpen: false, msg: null })}
                                                    className="flex-1 px-4 py-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                                >
                                                    Hủy bỏ
                                                </button>
                                                <button 
                                                    onClick={executeBan}
                                                    className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 shadow-lg shadow-red-500/30 transition-all active:scale-95"
                                                >
                                                    Xác nhận Ban
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
                                    const isMe = m.username?.toLowerCase() === user?.loginUsername?.toLowerCase();

                                    return (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            key={m.id}
                                            className={`flex flex-col group ${isSystem ? 'items-center py-2' : isMe ? 'items-end' : 'items-start'}`}
                                        >
                                            {!isSystem && (
                                                <div className="flex items-center gap-2 mb-1 px-1">
                                                    {!isMe && <User className="w-3 h-3 text-slate-400" />}
                                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-indigo-500' : 'text-slate-500'}`}>
                                                        {m.full_name || m.username}
                                                    </span>
                                                    {user?.role === 1 && !isMe && (
                                                        <button
                                                            onClick={() => handleBanClick(m)}
                                                            className="text-[10px] text-red-500 hover:text-red-700 font-bold uppercase transition-colors flex items-center gap-0.5 bg-red-50 dark:bg-red-900/20 px-1.5 py-0.5 rounded"
                                                            title="Ban tài khoản và thiết bị"
                                                        >
                                                            <ShieldAlert className="w-3 h-3" />
                                                            Ban
                                                        </button>
                                                    )}
                                                </div>
                                            )}

                                            {/* Quoted Message Rendering */}
                                            {m.reply_metadata && (
                                                <div className={`mb-1 max-w-[80%] text-[11px] px-3 py-1.5 rounded-xl border-l-4 ${
                                                    isMe 
                                                        ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-400 text-indigo-700 dark:text-indigo-300' 
                                                        : 'bg-slate-100/50 dark:bg-slate-800/50 border-slate-400 text-slate-600 dark:text-slate-400'
                                                } truncate shadow-sm`}>
                                                    <span className="font-bold block mb-0.5">
                                                        {m.reply_metadata.full_name || m.reply_metadata.username}
                                                    </span>
                                                    <span className="italic">{m.reply_metadata.message}</span>
                                                </div>
                                            )}

                                            <div className="relative flex items-center gap-2 max-w-[90%]">
                                                {!isSystem && isMe && (
                                                    <button 
                                                        onClick={() => setReplyTo(m)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all text-slate-400 hover:text-indigo-500"
                                                        title="Phản hồi"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                )}

                                                <div className={`${isSystem
                                                        ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800/50 text-red-700 dark:text-red-400 text-xs px-4 py-1.5 rounded-full font-bold'
                                                        : isMe
                                                            ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white rounded-tr-none px-4 py-2 rounded-2xl text-sm shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-tl-none px-4 py-2 rounded-2xl text-sm shadow-sm'
                                                    } transition-all hover:shadow-md relative`}>
                                                    {m.message}
                                                </div>

                                                {!isSystem && !isMe && (
                                                    <button 
                                                        onClick={() => setReplyTo(m)}
                                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-all text-slate-400 hover:text-indigo-500"
                                                        title="Phản hồi"
                                                    >
                                                        <MessageCircle className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
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
                                {/* Reply Preview */}
                                <AnimatePresence>
                                    {replyTo && (
                                        <motion.div 
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            className="bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-t-xl px-3 py-2 flex items-center justify-between mb-0 border-b-0 overflow-hidden"
                                        >
                                            <div className="flex flex-col truncate pr-4">
                                                <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Phản hồi {replyTo.full_name || replyTo.username}</span>
                                                <span className="text-xs text-slate-500 dark:text-slate-400 truncate italic">"{replyTo.message}"</span>
                                            </div>
                                            <button 
                                                onClick={() => setReplyTo(null)}
                                                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-400"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className={`relative flex items-center gap-2 ${replyTo ? 'border-r border-l border-b border-slate-200 dark:border-slate-700 rounded-b-xl p-2 bg-slate-50/30' : ''}`}>
                                    <div className="relative flex-1">
                                        <input
                                            type="text"
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && send()}
                                            placeholder={user ? "Nhập nội dung chat..." : "Đăng nhập để chat..."}
                                            disabled={!user}
                                            className={`w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all disabled:opacity-50 dark:text-slate-100 placeholder:text-slate-400 font-medium ${replyTo ? 'border-none bg-transparent' : ''}`}
                                        />
                                    </div>
                                    <button
                                        onClick={send}
                                        disabled={!user || !input.trim()}
                                        className="p-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl shadow-lg shadow-violet-500/20 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale flex-shrink-0"
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
