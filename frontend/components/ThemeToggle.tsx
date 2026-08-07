"use client"

import * as React from "react"
import { Moon, Sun, Monitor } from "lucide-react"
import { useTheme } from "next-themes"
import { motion, AnimatePresence } from "framer-motion"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [isOpen, setIsOpen] = React.useState(false)
    const [mounted, setMounted] = React.useState(false)

    React.useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return <div className="w-9 h-9"></div> // Placeholder to avoid layout shift
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 transition-colors"
                title="Đổi giao diện"
            >
                {theme === 'system' ? (
                    <Monitor className="h-5 w-5" />
                ) : (
                    <>
                        <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                        <Moon className="absolute top-2 left-2 h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    </>
                )}
                <span className="sr-only">Toggle theme</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            className="absolute right-0 mt-2 w-36 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg z-50 overflow-hidden"
                        >
                            <div className="p-1">
                                <button
                                    onClick={() => { setTheme("light"); setIsOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'light' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <Sun className="h-4 w-4" />
                                    <span>Sáng</span>
                                </button>
                                <button
                                    onClick={() => { setTheme("dark"); setIsOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'dark' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <Moon className="h-4 w-4" />
                                    <span>Tối</span>
                                </button>
                                <button
                                    onClick={() => { setTheme("system"); setIsOpen(false); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${theme === 'system' ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                >
                                    <Monitor className="h-4 w-4" />
                                    <span>Hệ thống</span>
                                </button>
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    )
}
