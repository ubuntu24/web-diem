"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, Send, X, Loader2, CheckCircle } from "lucide-react";
import { sendFeedbackAction } from "@/app/actions";

export default function FeedbackButton({ username }: { username: string }) {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    const handleSend = async () => {
        if (!message.trim() || sending) return;
        setSending(true);
        try {
            const result = await sendFeedbackAction(message.trim(), username);
            if (result.success) {
                setSent(true);
                setMessage("");
                setTimeout(() => {
                    setSent(false);
                    setOpen(false);
                }, 2000);
            } else {
                alert("Gửi ý kiến thất bại. Vui lòng thử lại!");
            }
        } catch {
            alert("Gửi ý kiến thất bại. Vui lòng thử lại!");
        } finally {
            setSending(false);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <motion.button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-300/40 dark:shadow-violet-900/40 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                whileHover={{ rotate: [0, -10, 10, 0] }}
                title="Góp ý kiến"
            >
                <MessageSquarePlus className="w-6 h-6" />
            </motion.button>

            {/* Modal Overlay */}
            <AnimatePresence>
                {open && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60]"
                            onClick={() => !sending && setOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 30 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 30 }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="fixed bottom-24 left-6 z-[70] w-[calc(100vw-3rem)] max-w-md"
                        >
                            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                                {/* Header */}
                                <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white">
                                    <div className="flex items-center gap-2">
                                        <MessageSquarePlus className="w-5 h-5" />
                                        <span className="font-bold text-sm">Góp ý kiến</span>
                                    </div>
                                    <button
                                        onClick={() => !sending && setOpen(false)}
                                        className="p-1 rounded-full hover:bg-white/20 transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>

                                {/* Body */}
                                <div className="p-5">
                                    {sent ? (
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="flex flex-col items-center py-6 text-center"
                                        >
                                            <CheckCircle className="w-12 h-12 text-green-500 mb-3" />
                                            <p className="font-bold text-slate-800 dark:text-white">Cảm ơn bạn!</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Ý kiến đã được gửi thành công.</p>
                                        </motion.div>
                                    ) : (
                                        <>
                                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                                Hãy chia sẻ ý kiến, góp ý hoặc báo lỗi của bạn. Mọi phản hồi đều rất có giá trị!
                                            </p>
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Muốn web cải thiện gì hay muốn sửa lỗi gì thì ghi ra đây..."
                                                rows={4}
                                                className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-800 dark:text-slate-200 placeholder-slate-400 outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 transition-all resize-none"
                                                disabled={sending}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                                                        handleSend();
                                                    }
                                                }}
                                            />
                                            <div className="flex items-center justify-between mt-3">
                                                <span className="text-xs text-slate-400 dark:text-slate-500">
                                                    Ctrl + Enter để gửi
                                                </span>
                                                <button
                                                    onClick={handleSend}
                                                    disabled={!message.trim() || sending}
                                                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-sm font-bold shadow-md shadow-violet-200 dark:shadow-violet-900/30 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                                >
                                                    {sending ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <Send className="w-4 h-4" />
                                                    )}
                                                    {sending ? "Đang gửi..." : "Gửi ý kiến"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
