"use client";

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import { User, LogOut, FileText, ChevronDown } from 'lucide-react';
import Link from 'next/link';

interface UserMenuProps {
    username: string;
    role: number;
    onLogout: () => void;
}

export default function UserMenu({ username, role, onLogout }: UserMenuProps) {
    return (
        <Menu as="div" className="relative inline-block text-left">
            <div>
                <Menu.Button className="flex items-center gap-2 hover:bg-slate-100 px-3 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/20">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {username.charAt(0).toUpperCase()}
                    </div>
                    <div className="hidden md:flex flex-col items-start">
                        <span className="text-sm font-medium text-slate-700">{username}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                            {role === 1 ? 'Admin' : 'Guest'}
                        </span>
                    </div>
                    <ChevronDown className="w-4 h-4 text-slate-400" />
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
                <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right divide-y divide-gray-100 rounded-xl bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                    <div className="px-1 py-1 ">
                        <Menu.Item>
                            {({ active }) => (
                                <Link
                                    href="/profile"
                                    className={`${active ? 'bg-blue-50 text-blue-600' : 'text-slate-900'
                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                >
                                    <FileText className="mr-2 h-4 w-4" aria-hidden="true" />
                                    Hồ sơ cá nhân
                                </Link>
                            )}
                        </Menu.Item>
                    </div>
                    <div className="px-1 py-1">
                        <Menu.Item>
                            {({ active }) => (
                                <button
                                    onClick={onLogout}
                                    className={`${active ? 'bg-red-50 text-red-600' : 'text-slate-900'
                                        } group flex w-full items-center rounded-lg px-2 py-2 text-sm transition-colors`}
                                >
                                    <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
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
