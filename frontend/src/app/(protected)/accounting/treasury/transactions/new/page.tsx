'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Landmark, ArrowUpDown, Info, Search, ListFilter, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface CashAccount {
    id: string;
    name: string;
    current_balance: number;
    account_type: string;
}

interface COA {
    id: string;
    name: string;
    code: string;
    account_type: string;
}

export default function NewTreasuryTransactionPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [coas, setCoas] = useState<COA[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const [formData, setFormData] = useState({
        account: '',
        transaction_type: 'debit' as 'credit' | 'debit',
        category: 'other',
        amount: '',
        reference: '',
        description: '',
        counterparty_coa: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [accRes, coaRes] = await Promise.all([
                    api.get('/treasury/accounts/'),
                    api.get('/accounting/accounts/?is_active=true')
                ]);
                setAccounts(accRes.data.results || accRes.data);
                setCoas(coaRes.data.results || coaRes.data);
            } catch (error) {
                console.error('Failed to fetch treasury data:', error);
                setError('Failed to load necessary accounts. Please refresh the page.');
            }
        };
        fetchData();
    }, []);

    const categories = [
        { id: 'capital_injection', label: 'Capital Injection / Financing' },
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
        if (!formData.account) return alert('Please select a cash account');

        setIsSubmitting(true);
        setError(null);
        try {
            await api.post('/treasury/transactions/', {
                ...formData,
                amount: parseFloat(formData.amount),
                counterparty_coa: formData.counterparty_coa || null
            });
            router.push('/accounting/treasury');
        } catch (err: any) {
            console.error('Failed to record transaction:', err);
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to record transaction. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const filteredCoas = coas.filter(coa =>
        coa.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        coa.code.includes(searchTerm)
    );

    return (
        <div className="space-y-8 max-w-4xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-3 rounded-2xl bg-white border border-border text-foreground hover:bg-muted transition-all shadow-sm"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-black text-foreground tracking-tight">Manual Treasury Entry</h1>
                        <p className="text-xs font-bold text-foreground/60 uppercase tracking-widest mt-1">Record and Link Money Movements</p>
                    </div>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600 animate-in fade-in slide-in-from-top-2">
                    <AlertCircle className="h-5 w-5" />
                    <p className="text-sm font-bold">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Transaction Details */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass rounded-[2.5rem] p-8 border border-border shadow-xl space-y-8 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Landmark className="h-32 w-32" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Source/Target Cash Account</label>
                                <div className="relative">
                                    <Landmark className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <select
                                        required
                                        value={formData.account}
                                        onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                                        className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all appearance-none"
                                    >
                                        <option value="">Select Cash Account</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name} — KES {acc.current_balance.toLocaleString()}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Movement Type</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, transaction_type: 'credit' })}
                                        className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${formData.transaction_type === 'credit'
                                            ? 'bg-emerald-500 border-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                            : 'bg-muted/30 border-border text-muted-foreground hover:border-emerald-500/50'
                                            }`}
                                    >
                                        Money In
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData({ ...formData, transaction_type: 'debit' })}
                                        className={`py-4 rounded-2xl border-2 font-black text-xs uppercase tracking-widest transition-all ${formData.transaction_type === 'debit'
                                            ? 'bg-primary border-primary/80 text-white shadow-lg shadow-primary/20'
                                            : 'bg-muted/30 border-border text-muted-foreground hover:border-primary/50'
                                            }`}
                                    >
                                        Money Out
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Transation Category</label>
                                <div className="relative">
                                    <ListFilter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <select
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all appearance-none"
                                    >
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Amount (KES)</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-muted-foreground">KES</span>
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        value={formData.amount}
                                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                        placeholder="0.00"
                                        className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-14 pr-4 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 font-black text-xl"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Reference / Internal ID</label>
                            <input
                                type="text"
                                value={formData.reference}
                                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                                placeholder="e.g., MPESA-ID, CHEQUE-NUMBER, INJECTION-REF"
                                className="w-full bg-muted/50 border border-border rounded-2xl py-4 px-6 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Description / Memo</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={4}
                                placeholder="Details about this movement..."
                                className="w-full bg-muted/50 border border-border rounded-2xl py-4 px-6 text-foreground focus:outline-none focus:ring-4 focus:ring-primary/10 font-bold transition-all resize-none"
                            />
                        </div>
                    </div>
                </div>

                {/* Right Column: Ledger Selection */}
                <div className="space-y-6">
                    <div className="glass rounded-[2.5rem] p-8 border border-border shadow-xl space-y-6">
                        <div>
                            <h3 className="text-sm font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                <ArrowUpDown className="h-4 w-4 text-primary" /> GL Matching
                            </h3>
                            <p className="text-[10px] font-bold text-foreground/60 mt-1 uppercase tracking-tighter">Required for Balanced Books</p>
                        </div>

                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    placeholder="Search GL accounts..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full bg-muted/30 border border-border rounded-xl py-2.5 pl-11 pr-4 text-sm focus:outline-none focus:border-primary transition-all"
                                />
                            </div>

                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {filteredCoas.map(coa => (
                                    <label
                                        key={coa.id}
                                        className={`flex flex-col p-4 rounded-2xl border-2 cursor-pointer transition-all ${formData.counterparty_coa === coa.id
                                                ? 'bg-primary/10 border-primary shadow-sm'
                                                : 'bg-muted/10 border-transparent hover:border-border'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-foreground uppercase tracking-tighter">{coa.name}</span>
                                            <input
                                                type="radio"
                                                name="counterparty_coa"
                                                className="sr-only"
                                                value={coa.id}
                                                checked={formData.counterparty_coa === coa.id}
                                                onChange={() => setFormData({ ...formData, counterparty_coa: coa.id })}
                                            />
                                            {formData.counterparty_coa === coa.id && (
                                                <div className="h-2 w-2 rounded-full bg-primary" />
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between mt-1">
                                            <span className="text-[10px] font-bold text-muted-foreground uppercase">{coa.code}</span>
                                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/5 text-primary font-black uppercase tracking-widest">{coa.account_type}</span>
                                        </div>
                                    </label>
                                ))}
                                {filteredCoas.length === 0 && (
                                    <div className="text-center py-8">
                                        <p className="text-xs font-bold text-muted-foreground">No accounts match search</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                            <div className="flex items-center gap-2 mb-2">
                                <Info className="h-3 w-3 text-primary" />
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Double-Entry Note</span>
                            </div>
                            <p className="text-[10px] text-foreground/70 leading-relaxed font-medium">
                                This will automatically generate a Journal Entry. Credits will go to {formData.counterparty_coa ? coas.find(c => c.id === formData.counterparty_coa)?.name : 'selected account'} and {formData.transaction_type === 'credit' ? 'Debit' : 'Credit'} will hit your Cash Account.
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.account || !formData.counterparty_coa}
                        onClick={handleSubmit}
                        className="w-full py-5 rounded-[2rem] bg-foreground text-background font-black text-lg uppercase tracking-[0.2em] hover:bg-primary hover:text-white transition-all shadow-xl shadow-foreground/10 disabled:opacity-50 flex items-center justify-center gap-3 active:scale-[0.98]"
                    >
                        {isSubmitting ? (
                            <><div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" /> Processing...</>
                        ) : (
                            <><Save className="h-6 w-6" /> Commit Record</>
                        )}
                    </button>
                    {!formData.counterparty_coa && (
                        <p className="text-center text-[10px] font-black text-rose-500 uppercase tracking-widest animate-pulse">Select a GL account to continue</p>
                    )}
                </div>
            </form>
        </div>
    );
}

