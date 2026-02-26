'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, LogIn, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import api from '@/lib/api';

export default function LoginPage() {
    const router = useRouter();
    const { login } = useAuthStore();
    const { settings, isLoading } = useSettingsStore();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
    });

    const handleLoginSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await api.post('/auth/token/', formData);
            const { user, access, refresh } = response.data;

            let currentUser = user;

            // If backend doesn't return user in token response, fetch it separately
            if (!currentUser && access) {
                // Set the token temporarily in the store so the next API call can use it
                login(null, access, refresh);
                try {
                    const userResponse = await api.get('/users/me/');
                    currentUser = userResponse.data;
                } catch (userError) {
                    console.error('Failed to fetch user profile:', userError);
                }
            }

            if (currentUser) {
                login(currentUser, access, refresh);
                router.push('/dashboard');
            } else {
                alert('Login successful, but could not retrieve user profile.');
            }
        } catch (error) {
            console.error('Login failed:', error);
            alert('Invalid email or password.');
        }
    };

    if (isLoading) return <div className="flex h-screen items-center justify-center text-foreground font-medium">Loading Aurum Finance...</div>;

    return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
            <div className="glass w-full max-w-md overflow-hidden rounded-2xl shadow-2xl border border-border/50">
                <div className="p-8">
                    <div className="mb-8 text-center">
                        {settings?.logo ? (
                            <img
                                src={settings.logo.startsWith('http')
                                    ? settings.logo.replace(/localhost(?!:)/, 'localhost:9090')
                                    : settings.logo}
                                alt={settings.company_name}
                                className="mx-auto mb-4 h-14 object-contain"
                            />
                        ) : (
                            <div className="mx-auto mb-4 h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                                <ShieldCheck className="h-8 w-8 text-primary" />
                            </div>
                        )}
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 font-heading">
                            {settings?.company_name || 'Aurum Finance'}
                        </h1>
                        <p className="text-muted-foreground font-medium">
                            {settings?.company_tagline || 'Advanced Loan Management System'}
                        </p>
                    </div>

                    <form onSubmit={handleLoginSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Email Address</label>
                            <div className="relative group">
                                <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type="email"
                                    required
                                    autoFocus
                                    className="w-full rounded-xl bg-input/50 border border-border py-3.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <label className="text-sm font-medium text-muted-foreground">Password</label>
                                <button type="button" className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                                    Forgot password?
                                </button>
                            </div>
                            <div className="relative group">
                                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full rounded-xl bg-input/50 border border-border py-3.5 pl-11 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                                    placeholder="••••••••"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3.5 top-3.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:translate-y-[-1px] active:scale-95"
                        >
                            <LogIn className="h-5 w-5" />
                            Sign In to Dashboard
                        </button>
                    </form>

                    <div className="mt-8 pt-6 border-t border-border/50 text-center">
                        <p className="text-sm text-muted-foreground">
                            Aurum Finance Platform &copy; {new Date().getFullYear()}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
