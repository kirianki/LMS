'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/useAuthStore';
import Sidebar from '@/components/layout/Sidebar';
import TopBar from '@/components/layout/TopBar';
import PageLoader from '@/components/ui/PageLoader';

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
        return <PageLoader message="Redirecting to login..." />;
    }

    // If we have a token but no user yet, we might be fetching it
    if (!user) {
        return <PageLoader message="Loading your profile..." />;
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
