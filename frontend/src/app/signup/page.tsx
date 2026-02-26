'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, User, Mail, Lock, Sparkles, Loader2, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import api from '@/lib/api';
export default function SignupPage() {
    const router = useRouter();
    const [isProvisioning, setIsProvisioning] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        first_name: '',
        last_name: '',
        email: '',
        password: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        setIsProvisioning(true);
        try {
            // Call the new public registration endpoint
            await api.post('/users/register/', {
                email: formData.email,
                password: formData.password,
                first_name: formData.first_name,
                last_name: formData.last_name,
                name: formData.name, // Company Name
            });

            // Redirect to login after success
            setTimeout(() => {
                router.push('/login');
            }, 2000);

        } catch (error: any) {
            console.error('Signup failed:', error);
            let errorMsg = 'Registration failed. Please check your details.';
            if (error.response?.data) {
                errorMsg = JSON.stringify(error.response.data);
            }
            alert(errorMsg);
            setIsProvisioning(false);
        }
    };

    if (isProvisioning) {
        return (
            <div className="flex min-h-screen items-center justify-center p-6 bg-background">
                <div className="glass w-full max-w-md overflow-hidden rounded-3xl p-12 text-center shadow-2xl relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-primary/20">
                        <div className="h-full bg-primary animate-[loading_2s_ease-in-out_infinite]" style={{ width: '40%' }} />
                    </div>

                    <div className="relative mx-auto mb-8 h-24 w-24">
                        <div className="absolute inset-0 animate-pulse rounded-full bg-primary/20" />
                        <div className="relative flex h-full w-full items-center justify-center rounded-full bg-input border border-border shadow-inner">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-bold text-foreground mb-4 font-heading">Provisioning Workspace</h1>
                    <p className="text-muted-foreground leading-relaxed mb-10">
                        We&apos;re setting up your secure environment. This involves schema isolation and security bootstrapping.
                    </p>

                    <div className="space-y-4 text-left bg-muted p-6 rounded-2xl border border-border">
                        {[
                            { label: 'Initializing secure schema', done: true },
                            { label: 'Running migrations', done: false },
                            { label: 'Bootstrapping roles', done: false },
                            { label: 'Finalizing setup', done: false }
                        ].map((step, i) => (
                            <div key={i} className="flex items-center gap-3">
                                {step.done ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                ) : (
                                    <div className="h-4 w-4 rounded-full border border-border animate-pulse" />
                                )}
                                <span className={step.done ? 'text-foreground/80' : 'text-muted-foreground'}>{step.label}...</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen items-center justify-center p-6">
            <div className="glass w-full max-w-lg overflow-hidden rounded-2xl shadow-2xl">
                <div className="p-8">
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 font-heading">
                            Get Started with Aurum
                        </h1>
                        <p className="text-muted-foreground">Launch your financial institution in minutes.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Company Name</label>
                            <div className="relative">
                                <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    required
                                    placeholder="Acme Microfinance"
                                    className="w-full rounded-lg bg-input border border-border py-2 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">First Name</label>
                                <div className="relative">
                                    <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        required
                                        className="w-full rounded-lg bg-input border border-border py-2 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        value={formData.first_name}
                                        onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Last Name</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full rounded-lg bg-input border border-border py-2 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Work Email</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    required
                                    className="w-full rounded-lg bg-input border border-border py-2 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    required
                                    className="w-full rounded-lg bg-input border border-border py-2 pl-10 pr-12 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-white transition-all hover:bg-primary/90 active:scale-95 shadow-lg shadow-primary/20"
                        >
                            <Sparkles className="h-5 w-5" />
                            Register Admin Account
                        </button>
                    </form>

                    <p className="mt-8 text-center text-sm text-muted-foreground">
                        Already have an account?{' '}
                        <button onClick={() => router.push('/login')} className="text-primary hover:underline">
                            Sign In
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
