'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function ThemeInjector() {
    const { settings } = useSettingsStore();

    useEffect(() => {
        const root = document.documentElement;

        // Prioritize Env variables, then SiteSettings, then hardcoded defaults
        const primaryColor = process.env.NEXT_PUBLIC_PRIMARY_COLOR || settings?.primary_color || '#2EAD8F';
        const secondaryColor = process.env.NEXT_PUBLIC_SECONDARY_COLOR || settings?.secondary_color || '#3B82F6';

        root.style.setProperty('--app-primary', primaryColor);
        root.style.setProperty('--app-secondary', secondaryColor);

    }, [settings]);

    return null;
}
