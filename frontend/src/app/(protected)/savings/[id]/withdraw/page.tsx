'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, ArrowUpCircle, Landmark, Info, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface Account {
    id: string;
    account_number: string;
    borrower_name: string;
    current_balance: number;
}

export default function SavingsWithdrawalPage() {
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

        if (parseFloat(formData.amount) > (account?.current_balance || 0)) {
            alert('Insufficient funds in the savings account.');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post(`/savings/accounts/${params.id}/withdraw/`, {
                amount: parseFloat(formData.amount),
                reference: formData.reference,
                description: formData.description || 'Cash withdrawal',
            });
            router.push(`/savings/${params.id}`);
        } catch (error) {
            console.error('Failed to process withdrawal:', error);
            alert('Failed to process withdrawal. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!account) return <div className="p-8 text-center text-muted-foreground">Loading account...</div>;

    const isOverLimit = parseFloat(formData.amount) > account.current_balance;

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Withdraw Cash</h1>
                    <p className="text-muted-foreground mt-1">Outward transaction from {account.account_number}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-8">
                    <div className="p-6 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Available Balance</p>
                            <p className="text-2xl font-bold text-foreground">KES {parseFloat(account.current_balance.toString()).toLocaleString()}</p>
                        </div>
                        <Landmark className="h-10 w-10 text-amber-500 opacity-20" />
                    </div>

                    <div className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Withdrawal Amount (KES)</label>
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
                                    className={`w-full bg-input border rounded-lg py-3 pl-14 pr-4 transition-all focus:outline-none focus:ring-2 font-bold text-xl ${isOverLimit ? 'border-red-500 text-red-500 focus:ring-red-500' : 'border-border text-foreground focus:ring-primary'
                                        }`}
                                />
                            </div>
                            {isOverLimit && (
                                <p className="mt-2 text-xs text-red-400 flex items-center gap-1 font-medium">
                                    <AlertTriangle className="h-3 w-3" />
                                    Amount exceeds the available balance!
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Reference / ID</label>
                                <input
                                    type="text"
                                    value={formData.reference}
                                    onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                    placeholder="e.g., WITH-12345"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                                <input
                                    type="text"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Cash Withdrawal"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                        <Info className="h-4 w-4 text-primary mt-0.5" />
                        <p className="text-xs text-muted-foreground italic leading-relaxed">
                            Withdrawals are processed instantly and will reflect as internal cash movement in the treasury. Ensure identity verification is completed before disbursement.
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
                        disabled={isSubmitting || !formData.amount || isOverLimit}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        <ArrowUpCircle className="h-4 w-4" />
                        {isSubmitting ? 'Processing...' : 'Confirm Withdrawal'}
                    </button>
                </div>
            </form>
        </div>
    );
}
