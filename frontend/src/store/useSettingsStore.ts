import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
    settings: {
        id?: string;
        company_name: string;
        company_tagline?: string;
        company_email?: string;
        company_phone?: string;
        company_address?: string;
        logo?: string;
        primary_color?: string;
        secondary_color?: string;
        report_footer_text?: string;
        mpesa_shortcode?: string;
        mpesa_consumer_key?: string;
        sms_sender_id?: string;
        is_ai_enabled?: boolean;
        is_automation_enabled?: boolean;
    } | null;
    isLoading: boolean;
    setSettings: (settings: any) => void;
    setLoading: (isLoading: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
    persist(
        (set) => ({
            settings: null,
            isLoading: true,
            setSettings: (settings) => set({ settings, isLoading: false }),
            setLoading: (isLoading) => set({ isLoading }),
        }),
        {
            name: 'settings-storage',
            partialize: (state) => ({
                settings: state.settings,
            }),
        }
    )
);
