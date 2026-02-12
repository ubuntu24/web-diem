"use client";

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { LogOut, User, ChevronDown, FileText } from 'lucide-react';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeToggle } from './ThemeToggle';
import Link from 'next/link';

interface UserMenuProps {
    username: string;
    onLogout: () => void;
}

export default function UserMenu({ username, onLogout }: UserMenuProps) {
    return (
        <Menu as="div" className="relative inline-block text-left">
            <div className="flex items-center gap-4">
                <ThemeToggle />

                <Menu.Button className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm group">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm group-hover:scale-105 transition-transform">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-700 dark:text-slate-200 text-sm hidden sm:block max-w-[100px] truncate">
                        {username}
                    </span>
                    <ChevronDown className="w-4 h-4 text-slate-400 dark:text-slate-500" />
                </Menu.Button>
            </div>

            <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
            >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right rounded-xl bg-white dark:bg-slate-800 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden z-50 border border-slate-200 dark:border-slate-700">
                    <div className="px-1 py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <Link
                                    href="/profile"
                                    className={`${active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                >
                                    <User className="mr-2 h-4 w-4" />
                                    Hồ sơ sinh viên
                                </Link>
                            )}
                        </Menu.Item>
                        <Menu.Item>
                            {({ active }) => (
                                <Link
                                    href="/docs"
                                    className={`${active ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-300'
                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                >
                                    <FileText className="mr-2 h-4 w-4" />
                                    Tài liệu API
                                </Link>
                            )}
                        </Menu.Item>
                    </div>
                    <div className="px-1 py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={onLogout}
                                    className={`${active ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300'
                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                >
                                    <LogOut className="mr-2 h-4 w-4" />
                                    Đăng xuất
                                </button>
                            )}
                        </Menu.Item>
                    </div>
                </Menu.Items>
            </Transition>
        </Menu>
    );
}
