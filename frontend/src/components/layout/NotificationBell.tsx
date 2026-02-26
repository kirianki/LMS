'use client';

import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationList from './NotificationList';

export default function NotificationBell() {
    const [isOpen, setIsOpen] = useState(false);
    const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`relative p-2.5 rounded-xl transition-all duration-200 group ${isOpen
                        ? 'bg-slate-100 text-slate-900 shadow-inner'
                        : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-100 hover:border-slate-200'
                    }`}
            >
                <Bell className={`h-5 w-5 transition-transform duration-300 ${isOpen ? 'rotate-12' : 'group-hover:scale-110'}`} />
                {unreadCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-rose-500 text-white text-[10px] font-black min-w-[20px] h-[20px] px-1 rounded-full flex items-center justify-center border-2 border-white shadow-sm animate-in zoom-in duration-300">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-3 z-50 origin-top-right">
                    <NotificationList
                        notifications={notifications}
                        onMarkRead={markAsRead}
                        onMarkAllRead={markAllAsRead}
                        onClose={() => setIsOpen(false)}
                    />
                </div>
            )}
        </div>
    );
}
