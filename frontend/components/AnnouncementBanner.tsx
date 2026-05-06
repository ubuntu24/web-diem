'use client';

import { useState, useEffect } from 'react';
import { getSystemConfigBff } from '@/lib/api';
import { Megaphone, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AnnouncementBanner() {
    const [announcement, setAnnouncement] = useState<string>('');
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const fetchConfig = async () => {
            try {
                const config = await getSystemConfigBff();
                if (config.announcement) {
                    setAnnouncement(config.announcement);
                }
            } catch (error) {
                // Ignore
            }
        };
        fetchConfig();
    }, []);

    if (!announcement || !visible) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="bg-indigo-600 dark:bg-indigo-900 text-white relative overflow-hidden"
            >
                <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 flex-1 justify-center">
                        <Megaphone className="w-4 h-4 flex-shrink-0 animate-bounce" />
                        <p className="text-sm font-medium leading-tight text-center">
                            {announcement}
                        </p>
                    </div>
                    <button 
                        onClick={() => setVisible(false)}
                        className="p-1 hover:bg-white/20 rounded-full transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
                {/* Subtle shine effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -skew-x-12 translate-x-[-100%] animate-[shimmer_3s_infinite]" />
            </motion.div>
        </AnimatePresence>
    );
}
