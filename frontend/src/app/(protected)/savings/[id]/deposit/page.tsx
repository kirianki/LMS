'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, ArrowDownCircle, Landmark, Info } from 'lucide-react';
import api from '@/lib/api';

interface Account {
    id: string;
    account_number: string;
    borrower_name: string;
    current_balance: number;
}

export default function SavingsDepositPage() {
    const params = useParams();
    const router = useRouter();
    const [account, setAccount] = useState<Account | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        amount: '',
        reference: '',
        description: '',
    });

    useEffect(() => {
        const fetchAccount = async () => {
            try {
                const response = await api.get(`/savings/accounts/${params.id}/`);
                setAccount(response.data);
            } catch (error) {
                console.error('Failed to fetch account:', error);
            }
        };
        fetchAccount();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`/savings/accounts/${params.id}/deposit/`, {
                amount: parseFloat(formData.amount),
                reference: formData.reference,
                description: formData.description || 'Cash deposit',
            });
            router.push(`/savings/${params.id}`);
        } catch (error) {
            console.error('Failed to process deposit:', error);
            alert('Failed to process deposit. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!account) return <div className="p-8 text-center text-muted-foreground">Loading account...</div>;

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Deposit Cash</h1>
                    <p className="text-muted-foreground mt-1">Inward transaction for {account.account_number}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-8">
                    <div className="p-6 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Current Balance</p>
                            <p className="text-2xl font-bold text-emerald-400">KES {parseFloat(account.current_balance.toString()).toLocaleString()}</p>
                        </div>
                        <Landmark className="h-10 w-10 text-emerald-500 opacity-20" />
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Deposit Amount (KES)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">KES</span>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    min="1"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full bg-input border border-border rounded-lg py-3 pl-14 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-xl"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Reference (Voucher/ID)</label>
                                <input
                                    type="text"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    placeholder="e.g., SLIP-12345"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Cash Deposit"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <Info className="h-4 w-4 text-emerald-400 mt-0.5" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                            This deposit will be credited to {account.borrower_name}'s account and a corresponding ledger entry will be recorded in the system treasury.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.amount}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-emerald-600 text-foreground hover:bg-emerald-500 transition-all font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                    >
                        <ArrowDownCircle className="h-4 w-4" />
                        {isSubmitting ? 'Processing...' : 'Complete Deposit'}
                    </button>
                </div>
            </form>
        </div>
    );
}
