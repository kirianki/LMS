'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';
import api from '@/lib/api';

export default function NewAccountPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        account_type: 'asset',
        parent: '',
        description: '',
    });

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/accounting/accounts/');
                setAccounts(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
            }
        };

        fetchAccounts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/accounting/accounts/', {
                ...formData,
                parent: formData.parent || null,
            });
            router.push('/accounting/coa');
        } catch (error) {
            console.error('Failed to create account:', error);
            alert('Failed to create account');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">New Account</h1>
                    <p className="text-muted-foreground mt-1">Add a new account to your chart</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Account Details</h2>
                    </div>
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Account Code</label>
                                <input
                                    type="text"
                                    name="code"
                                    required
                                    value={formData.code}
                                    onChange={handleChange}
                                    placeholder="e.g., 1000, 2000"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Account Type</label>
                                <select
                                    name="account_type"
                                    value={formData.account_type}
                                    onChange={handleChange}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="asset">Asset</option>
                                    <option value="liability">Liability</option>
                                    <option value="equity">Equity</option>
                                    <option value="income">Income</option>
                                    <option value="expense">Expense</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Account Name</label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., Cash in Bank"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Parent Account (Optional)</label>
                            <select
                                name="parent"
                                value={formData.parent}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">None (Top-level account)</option>
                                {accounts.map((account) => (
                                    <option key={account.id} value={account.id}>
                                        {account.code} - {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Description (Optional)</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Creating...' : 'Create Account'}
                    </button>
                </div>
            </form>
        </div>
    );
}
