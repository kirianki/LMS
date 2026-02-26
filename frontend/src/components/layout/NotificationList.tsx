'use client';

import { Bell, Check, ExternalLink, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Notification } from '@/hooks/useNotifications';
import Link from 'next/link';

interface NotificationListProps {
    notifications: Notification[];
    onMarkRead: (id: string) => void;
    onMarkAllRead: () => void;
    onClose: () => void;
}

export default function NotificationList({
    notifications,
    onMarkRead,
    onMarkAllRead,
    onClose
}: NotificationListProps) {
    return (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-widest">Notifications</h3>
                {notifications.some(n => !n.is_read) && (
                    <button
                        onClick={onMarkAllRead}
                        className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-tight"
                    >
                        Mark all as read
                    </button>
                )}
            </div>

            <div className="max-h-[400px] overflow-y-auto">
                {notifications.length === 0 ? (
                    <div className="p-10 text-center">
                        <div className="bg-slate-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Bell className="h-5 w-5 text-slate-300" />
                        </div>
                        <p className="text-slate-400 text-xs font-bold">No notifications yet</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-50">
                        {notifications.map((n) => (
                            <div
                                key={n.id}
                                className={`p-4 hover:bg-slate-50 transition-all group relative ${!n.is_read ? 'bg-indigo-50/30' : ''}`}
                            >
                                <div className="flex gap-3">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!n.is_read ? 'bg-indigo-600 animate-pulse' : 'bg-transparent'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className={`text-sm font-bold truncate ${!n.is_read ? 'text-slate-900' : 'text-slate-600'}`}>
                                                {n.title}
                                            </p>
                                            <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 shrink-0">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 line-clamp-2 mb-2 leading-relaxed">
                                            {n.message}
                                        </p>

                                        <div className="flex items-center gap-3">
                                            {n.link && (
                                                <Link
                                                    href={n.link}
                                                    onClick={onClose}
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-700"
                                                >
                                                    View Details
                                                    <ExternalLink className="h-3 w-3" />
                                                </Link>
                                            )}
                                            {!n.is_read && (
                                                <button
                                                    onClick={() => onMarkRead(n.id)}
                                                    className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 ml-auto"
                                                >
                                                    Dismiss
                                                    <Check className="h-3 w-3" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-slate-100 bg-slate-50/30 text-center">
                <button className="text-[10px] font-bold text-slate-500 hover:text-slate-700 transition-colors uppercase">
                    View full history
                </button>
            </div>
        </div>
    );
}
