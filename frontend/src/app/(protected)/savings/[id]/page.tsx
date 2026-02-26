'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    PiggyBank,
    Wallet,
    History,
    TrendingUp,
    ArrowUpCircle,
    ArrowDownCircle,
    Info,
    Calendar,
    Clock,
    User,
    ChevronRight,
    ArrowDownLeft,
    ArrowUpRight
} from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Transaction {
    id: string;
    transaction_type: string;
    amount: number;
    balance_after: number;
    transaction_date: string;
    reference: string;
    description: string;
}

interface AccountDetails {
    id: string;
    account_number: string;
    borrower_name: string;
    product_name: string;
    current_balance: number;
    accrued_interest: number;
    interest_rate: number;
    status: string;
    opened_date: string;
    last_transaction_date: string;
}

export default function SavingsAccountDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const [accRes, transRes] = await Promise.all([
                    api.get(`/savings/accounts/${params.id}/`),
                    api.get(`/savings/transactions/?account=${params.id}`)
                ]);
                setAccount(accRes.data);
                setTransactions(transRes.data.results || transRes.data);
            } catch (error) {
                console.error('Failed to fetch savings details:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [params.id]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
        }).format(amount);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading account...</div>;
    if (!account) return <div className="p-8 text-center text-red-400">Account not found</div>;

    const columns = [
        {
            header: 'Date',
            accessor: (t: Transaction) => (
                <div className="flex flex-col">
                    <span className="text-foreground text-xs">{new Date(t.transaction_date).toLocaleDateString()}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{new Date(t.transaction_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            ),
        },
        {
            header: 'Type',
            accessor: (t: Transaction) => (
                <div className="flex items-center gap-2">
                    {t.transaction_type === 'deposit' ? (
                        <ArrowDownLeft className="h-3 w-3 text-emerald-400" />
                    ) : (
                        <ArrowUpRight className="h-3 w-3 text-primary" />
                    )}
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${t.transaction_type === 'deposit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-primary/10 text-primary'
                        }`}>
                        {t.transaction_type}
                    </span>
                </div>
            ),
        },
        {
            header: 'Description',
            accessor: (t: Transaction) => (
                <div>
                    <p className="text-foreground text-xs font-medium">{t.description || 'Standard transaction'}</p>
                    <p className="text-[10px] text-muted-foreground font-mono italic">{t.reference}</p>
                </div>
            ),
        },
        {
            header: 'Amount',
            accessor: (t: Transaction) => (
                <span className={`font-bold ${t.transaction_type === 'deposit' || t.transaction_type === 'interest' ? 'text-emerald-400' : 'text-primary'}`}>
                    {t.transaction_type === 'deposit' || t.transaction_type === 'interest' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
            ),
        },
        {
            header: 'Balance After',
            accessor: (t: Transaction) => (
                <span className="text-muted-foreground text-xs">{formatCurrency(t.balance_after)}</span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground font-heading">{account.borrower_name}</h1>
                            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold font-mono tracking-wider">
                                {account.account_number}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{account.product_name} • {account.interest_rate}% p.a</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push(`/savings/${account.id}/withdraw`)}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-all font-semibold text-sm"
                    >
                        <ArrowUpCircle className="h-4 w-4" />
                        Withdraw
                    </button>
                    <button
                        onClick={() => router.push(`/savings/${account.id}/deposit`)}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-sm"
                    >
                        <ArrowDownCircle className="h-4 w-4" />
                        Deposit Cash
                    </button>
                </div>
            </div>

            {/* Balances Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2 glass rounded-xl p-8 border border-border bg-primary/5 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 text-primary opacity-50">
                        <Wallet className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Current Available Balance</span>
                    </div>
                    <p className="text-5xl font-bold text-foreground tracking-tighter">{formatCurrency(account.current_balance)}</p>
                    <div className="mt-6 flex items-center gap-4">
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                            <TrendingUp className="h-3 w-3" />
                            Active Yield
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            Last Activity: {account.last_transaction_date ? new Date(account.last_transaction_date).toLocaleDateString() : 'None'}
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 border border-border flex flex-col justify-between">
                    <div>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Accrued Interest</p>
                        <p className="text-2xl font-bold text-emerald-400">{formatCurrency(account.accrued_interest)}</p>
                    </div>
                    <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline text-left mt-4 flex items-center gap-1 group">
                        Post Interest Now <ChevronRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>

                <div className="glass rounded-xl p-6 border border-border flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Account Info</p>
                        </div>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Opened</span>
                                <span className="text-foreground font-medium">{new Date(account.opened_date).toLocaleDateString()}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">Currency</span>
                                <span className="text-foreground font-medium italic">KES (Shilling)</span>
                            </div>
                        </div>
                    </div>
                    <div className="pt-4 border-t border-border mt-4">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">{account.status}</span>
                    </div>
                </div>
            </div>

            {/* History Table */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={transactions}
                    isLoading={false}
                />
            </div>

            {/* Context Note */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-orange-500/5 border border-orange-500/10">
                <Info className="h-4 w-4 text-orange-400 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed italic">
                    Interest is calculated daily based on the product's defined method and posted automatically at the end of the compounding period. Withdrawals are subject to terms of the {account.product_name} product.
                </p>
            </div>
        </div>
    );
}
