'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const { user, token } = useAuthStore();

    useEffect(() => {
        // Only redirect if we have neither token nor are we in a state of fetching
        if (!token) {
            router.push('/login');
        }
    }, [token, router]);

    if (!token) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="text-muted-foreground">Redirecting to login...</div>
            </div>
        );
    }

    // If we have a token but no user yet, we might be fetching it
    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <div className="text-muted-foreground">Loading your profile...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-background">
            <Sidebar />
            <div className="flex flex-1 flex-col overflow-hidden">
                <TopBar />
                <main className="flex-1 overflow-y-auto p-6">
                    {children}
                </main>
            </div>
        </div>
    );
}
