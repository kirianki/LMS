'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import api from '@/lib/api';

export default function SettingsProvider({ children }: { children: React.ReactNode }) {
    const { setSettings, setLoading } = useSettingsStore();

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                setLoading(true);
                const response = await api.get('/settings/site/');
                setSettings(response.data);
            } catch (error: any) {
                console.error('Settings fetch failed:', error?.message);
                // System might still be in initial state, so don't logout automatically here
            } finally {
                setLoading(false);
            }
        };

        fetchSettings();
    }, [setSettings, setLoading]);

    return <>{children}</>;
}
