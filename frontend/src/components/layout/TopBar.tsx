'use client';

import { Search, User, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import NotificationBell from './NotificationBell';

export default function TopBar() {
    const { user, logout } = useAuthStore();
    const router = useRouter();
    const [showUserMenu, setShowUserMenu] = useState(false);

    const handleLogout = () => {
        logout();
        router.push('/login');
    };

    return (
        <header className="glass border-b border-border px-6 py-4">
            <div className="flex items-center justify-between">
                {/* Search Bar */}
                <div className="flex-1 max-w-xl">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search borrowers, loans... (Cmd+K)"
                            className="w-full bg-input border border-border rounded-lg py-2 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                {/* Right Actions */}
                <div className="flex items-center gap-4">
                    {/* Notifications */}
                    <NotificationBell />

                    {/* User Menu */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors"
                        >
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                                {user?.profile?.avatar ? (
                                    <img
                                        src={user.profile.avatar.startsWith('http')
                                            ? user.profile.avatar.replace(/:8000/, ':9090')
                                            : user.profile.avatar}
                                        alt="Avatar"
                                        className="h-full w-full object-cover"
                                    />
                                ) : (
                                    <User className="h-4 w-4 text-primary" />
                                )}
                            </div>
                            <div className="text-left hidden md:block">
                                <p className="text-sm font-medium text-foreground">
                                    {user?.first_name} {user?.last_name}
                                </p>
                                <p className="text-xs text-muted-foreground">{user?.role?.name || 'User'}</p>
                            </div>
                        </button>

                        {/* Dropdown */}
                        {showUserMenu && (
                            <div className="absolute right-0 mt-2 w-56 glass rounded-lg border border-border shadow-xl overflow-hidden z-50">
                                <div className="p-3 border-b border-border">
                                    <p className="text-sm font-medium text-foreground">{user?.email}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{user?.role?.name}</p>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={() => {
                                            router.push('/profile');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        <User className="h-4 w-4" />
                                        <span className="text-sm">Profile</span>
                                    </button>
                                    <button
                                        onClick={handleLogout}
                                        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-colors"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        <span className="text-sm">Logout</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
}
