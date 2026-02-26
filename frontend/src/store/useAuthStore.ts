import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
    user: {
        id: string;
        email: string;
        first_name: string;
        last_name: string;
        role: {
            id: string;
            name: string;
        } | null;
        branch?: {
            id: string;
            name: string;
        } | null;
        contracts?: any[];
        payroll_records?: any[];
        profile?: {
            avatar: string | null;
            phone_number: string;
            bio: string;
            job_title: string;
            location: string;
        };
        permissions: string[];
        is_staff?: boolean;
        is_superuser?: boolean;
        date_joined?: string;
    } | null;
    token: string | null;
    refreshToken: string | null;
    isAuthenticated: boolean;
    login: (user: any, access: string, refresh: string) => void;
    logout: () => void;
    refreshTokens: (access: string, refresh: string) => void;
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            token: null,
            refreshToken: null,
            isAuthenticated: false,
            login: (user, access, refresh) => set({
                user,
                token: access,
                refreshToken: refresh,
                isAuthenticated: true
            }),
            logout: () => set({
                user: null,
                token: null,
                refreshToken: null,
                isAuthenticated: false
            }),
            refreshTokens: (access, refresh) => set({
                token: access,
                refreshToken: refresh
            }),
        }),
        {
            name: 'auth-storage',
        }
    )
);
