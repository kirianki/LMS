'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';

export interface Notification {
    id: string;
    title: string;
    message: string;
    notification_type: string;
    notification_type_display: string;
    link?: string;
    is_read: boolean;
    created_at: string;
}

export function useNotifications() {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);

    const fetchNotifications = useCallback(async () => {
        try {
            setLoading(true);
            const res = await api.get('/notifications/');
            setNotifications(res.data?.results || res.data || []);

            const countRes = await api.get('/notifications/unread_count/');
            setUnreadCount(countRes.data.unread_count);
        } catch (err) {
            console.error('Failed to fetch notifications:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    const markAsRead = async (id: string) => {
        try {
            await api.post(`/notifications/${id}/mark_as_read/`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark notification as read:', err);
        }
    };

    const markAllAsRead = async () => {
        try {
            await api.post('/notifications/mark_all_as_read/');
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all notifications as read:', err);
        }
    };

    useEffect(() => {
        fetchNotifications();

        // Polling every 30 seconds for new notifications
        const interval = setInterval(fetchNotifications, 30000);
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    return {
        notifications,
        unreadCount,
        loading,
        markAsRead,
        markAllAsRead,
        refresh: fetchNotifications
    };
}
