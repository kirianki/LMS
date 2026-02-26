'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Landmark, ArrowUpDown, Info } from 'lucide-react';
import api from '@/lib/api';

interface CashAccount {
    id: string;
    name: string;
    current_balance: number;
}

export default function NewTreasuryTransactionPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        transaction_type: 'debit' as 'credit' | 'debit',
        category: 'other',
        amount: '',
        reference: '',
        description: '',
    });

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/treasury/accounts/');
                setAccounts(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
            }
        };
        fetchAccounts();
    }, []);

    const categories = [
        { id: 'loan_disbursement', label: 'Loan Disbursement' },
        { id: 'loan_repayment', label: 'Loan Repayment' },
        { id: 'investment_received', label: 'Investment Received' },
        { id: 'investor_payout', label: 'Investor Payout' },
        { id: 'expense', label: 'Expense' },
        { id: 'payroll', label: 'Payroll' },
        { id: 'transfer', label: 'Account Transfer' },
        { id: 'interest_income', label: 'Interest Income' },
        { id: 'fee_income', label: 'Fee Income' },
        { id: 'other', label: 'Other' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/treasury/transactions/', {
                ...formData,
                amount: parseFloat(formData.amount),
            });
            router.push('/accounting/treasury');
        } catch (error) {
            console.error('Failed to record transaction:', error);
            alert('Failed to record transaction. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">New Transaction</h1>
                    <p className="text-muted-foreground mt-1">Record a manual cash movement</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Select Account</label>
                            <select
                                required
                                value={formData.account}
                                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select Cash Account</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.name} (KES {acc.current_balance.toLocaleString()})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Transaction Type</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, transaction_type: 'credit' })}
                                    className={`py-2.5 rounded-lg border font-medium transition-all ${formData.transaction_type === 'credit'
                                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]'
                                            : 'bg-input border-border text-muted-foreground'
                                        }`}
                                >
                                    Money In (Credit)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, transaction_type: 'debit' })}
                                    className={`py-2.5 rounded-lg border font-medium transition-all ${formData.transaction_type === 'debit'
                                            ? 'bg-primary/10 border-primary text-primary shadow-[0_0_15px_-3px_rgba(var(--primary-rgb),0.3)]'
                                            : 'bg-input border-border text-muted-foreground'
                                        }`}
                                >
                                    Money Out (Debit)
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Category</label>
                            <select
                                required
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                {categories.map(cat => (
                                    <option key={cat.id} value={cat.id}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Amount (KES)</label>
                            <input
                                type="number"
                                required
                                step="0.01"
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Reference / Internal ID</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            placeholder="e.g., MPESA-ID, CHQ-NO"
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="Add memo here..."
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                        <Info className="h-4 w-4 text-blue-400 mt-0.5" />
                        <p className="text-xs text-muted-foreground">
                            Recording a transaction here will update the cash account balance and generate corresponding ledger entries in the general ledger.
                        </p>
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
                        className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Recording...' : 'Record Transaction'}
                    </button>
                </div>
            </form>
        </div>
    );
}
