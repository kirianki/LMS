'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Check, X, FileText, User, Calendar, Tag, DollarSign, Clock } from 'lucide-react';
import api from '@/lib/api';

interface Expense {
    id: string;
    expense_number: string;
    account_code: string;
    account_name: string;
    amount: number;
    description: string;
    date: string;
    vendor: string;
    status: 'pending' | 'approved' | 'rejected' | 'paid';
    created_at: string;
    approved_at: string;
    status_display: string;
    receipt: string | null;
}

interface CashAccount {
    id: string;
    name: string;
    account_type: string;
    current_balance: string;
}

export default function ExpenseDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [expense, setExpense] = useState<Expense | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isActioning, setIsActioning] = useState(false);
    const [cashAccounts, setCashAccounts] = useState<CashAccount[]>([]);
    const [selectedCashAccountId, setSelectedCashAccountId] = useState<string>('');

    useEffect(() => {
        const fetchExpense = async () => {
            try {
                const response = await api.get(`/expenses/expenses/${params.id}/`);
                setExpense(response.data);
            } catch (error) {
                console.error('Failed to fetch expense:', error);
            } finally {
                setIsLoading(false);
            }
        };

        const fetchCashAccounts = async () => {
            try {
                const response = await api.get('/treasury/accounts/');
                setCashAccounts(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch cash accounts:', error);
            }
        };

        fetchExpense();
        fetchCashAccounts();
    }, [params.id]);

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this expense?')) return;
        setIsActioning(true);
        try {
            await api.post(`/expenses/expenses/${params.id}/approve/`);
            router.refresh();
            // Refetch to show updated status
            const response = await api.get(`/expenses/expenses/${params.id}/`);
            setExpense(response.data);
        } catch (error) {
            console.error('Failed to approve:', error);
            alert('Approval failed');
        } finally {
            setIsActioning(false);
        }
    };

    const handlePay = async () => {
        if (!selectedCashAccountId) {
            alert('Please select a payment account first.');
            return;
        }
        if (!confirm('Are you sure you want to mark this expense as paid? This will post it to the General Ledger.')) return;
        setIsActioning(true);
        try {
            await api.post(`/expenses/expenses/${params.id}/pay/`, {
                payment_account_id: selectedCashAccountId
            });
            // Refetch to show updated status
            const response = await api.get(`/expenses/expenses/${params.id}/`);
            setExpense(response.data);
        } catch (error) {
            console.error('Failed to pay:', error);
            alert('Payment marking failed');
        } finally {
            setIsActioning(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
        }).format(value);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading expense...</div>;
    if (!expense) return <div className="p-8 text-center text-red-400">Expense not found</div>;

    const statusColors = {
        pending: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        approved: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        rejected: 'bg-red-500/10 text-red-500 border-red-500/20',
        paid: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading">{expense.expense_number}</h1>
                        <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-widest ${statusColors[expense.status]}`}>
                            {expense.status === 'pending' && <Clock className="h-3 w-3" />}
                            {expense.status_display}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {expense.status === 'approved' && (
                        <div className="flex items-center gap-2 mr-4">
                            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Pay From:</span>
                            <select
                                value={selectedCashAccountId}
                                onChange={(e) => setSelectedCashAccountId(e.target.value)}
                                className="bg-input border border-border rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-primary outline-none text-foreground min-w-[200px]"
                            >
                                <option value="">Select Account...</option>
                                {cashAccounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} (KES {parseFloat(acc.current_balance).toLocaleString()})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {expense.status === 'pending' && (
                        <>
                            <button
                                disabled={isActioning}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-input border border-border text-muted-foreground hover:text-red-400 transition-colors font-semibold"
                            >
                                <X className="h-4 w-4" />
                                Reject
                            </button>
                            <button
                                onClick={handleApprove}
                                disabled={isActioning}
                                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-semibold shadow-lg shadow-primary/20"
                            >
                                <Check className="h-4 w-4" />
                                Approve Expense
                            </button>
                        </>
                    )}
                    {expense.status === 'approved' && (
                        <button
                            onClick={handlePay}
                            disabled={isActioning || !selectedCashAccountId}
                            className={`flex items-center gap-2 px-6 py-2.5 rounded-lg text-white transition-colors font-semibold shadow-lg ${!selectedCashAccountId ? 'bg-emerald-600/50 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20'}`}
                        >
                            <DollarSign className="h-4 w-4" />
                            Mark as Paid
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="glass rounded-xl p-8 border border-border space-y-8">
                        <div>
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Expense Description</h3>
                            <p className="text-lg text-foreground leading-relaxed">{expense.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-border">
                            <div>
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Expense Account</h3>
                                <div className="flex items-center gap-2 text-foreground">
                                    <Tag className="h-4 w-4 text-primary" />
                                    <span className="font-semibold">{expense.account_name} ({expense.account_code})</span>
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Vendor</h3>
                                <div className="flex items-center gap-2 text-foreground">
                                    <User className="h-4 w-4 text-primary" />
                                    <span className="font-semibold">{expense.vendor || 'N/A'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-xl p-8 border border-border">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Supporting Documents</h3>
                        {expense.receipt ? (
                            <div className="rounded-xl overflow-hidden border border-border">
                                <img
                                    src={expense.receipt.startsWith('http') ? expense.receipt : `${process.env.NEXT_PUBLIC_API_URL}${expense.receipt}`}
                                    alt="Expense Receipt"
                                    className="w-full h-auto object-contain max-h-[500px]"
                                />
                            </div>
                        ) : (
                            <div className="aspect-[4/3] rounded-xl bg-input border border-border flex flex-col items-center justify-center gap-3 text-muted-foreground italic">
                                <FileText className="h-10 w-10 opacity-20" />
                                <p className="text-sm">No receipt image attached</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="glass rounded-xl p-6 border border-border">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Financial Summary</h3>
                        <div className="space-y-4">
                            <div className="flex flex-col gap-1">
                                <span className="text-xs text-muted-foreground">Total Amount</span>
                                <span className="text-3xl font-bold text-foreground">{formatCurrency(expense.amount)}</span>
                            </div>
                            <div className="pt-4 border-t border-border space-y-3">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Submitted</span>
                                    <span className="text-foreground">{new Date(expense.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Approved Date</span>
                                    <span className="text-foreground">{expense.approved_at ? new Date(expense.approved_at).toLocaleDateString() : 'Pending'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-xl p-6 border border-border">
                        <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">History</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3 items-start">
                                <div className="mt-1 h-2 w-2 rounded-full bg-primary" />
                                <div>
                                    <p className="text-sm text-foreground">Expense Submitted</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(expense.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            {expense.status === 'approved' && (
                                <div className="flex gap-3 items-start">
                                    <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
                                    <div>
                                        <p className="text-sm text-foreground">Expense Approved</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(expense.approved_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
