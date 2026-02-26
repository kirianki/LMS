'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Landmark, ArrowUpDown, Clock, CheckCircle } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Transaction {
    id: string;
    transaction_type: string;
    category_display: string;
    amount: number;
    balance_after: number;
    transaction_date: string;
    reference: string;
    description: string;
}

interface AccountDetails {
    id: string;
    name: string;
    account_type: string;
    account_number: string;
    bank_name: string;
    current_balance: number;
}

export default function TreasuryAccountDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [account, setAccount] = useState<AccountDetails | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDetails = async () => {
            try {
                const [accRes, transRes] = await Promise.all([
                    api.get(`/treasury/accounts/${params.id}/`),
                    api.get(`/treasury/transactions/?account=${params.id}`)
                ]);
                setAccount(accRes.data);
                setTransactions(transRes.data.results || transRes.data);
            } catch (error) {
                console.error('Failed to fetch treasury details:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchDetails();
    }, [params.id]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const columns = [
        {
            header: 'Date',
            accessor: (t: Transaction) => new Date(t.transaction_date).toLocaleDateString(),
        },
        {
            header: 'Type',
            accessor: (t: Transaction) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${t.transaction_type === 'credit' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                    {t.transaction_type}
                </span>
            ),
        },
        {
            header: 'Description',
            accessor: (t: Transaction) => (
                <div>
                    <p className="text-foreground font-medium">{t.description || t.category_display}</p>
                    <p className="text-xs text-muted-foreground">{t.reference}</p>
                </div>
            ),
        },
        {
            header: 'Amount',
            accessor: (t: Transaction) => (
                <span className={`font-bold ${t.transaction_type === 'credit' ? 'text-emerald-400' : 'text-primary'}`}>
                    {t.transaction_type === 'credit' ? '+' : '-'}{formatCurrency(t.amount)}
                </span>
            ),
        },
        {
            header: 'Balance After',
            accessor: (t: Transaction) => (
                <span className="text-muted-foreground">{formatCurrency(t.balance_after)}</span>
            ),
        }
    ];

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading account...</div>;
    if (!account) return <div className="p-8 text-center text-red-400">Account not found</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">{account.name}</h1>
                    <p className="text-muted-foreground mt-1">{account.bank_name} {account.account_number}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Landmark className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-muted-foreground uppercase tracking-wider">Current Balance</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{formatCurrency(account.current_balance)}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground uppercase tracking-wider">Total Transactions</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{transactions.length}</p>
                </div>
            </div>

            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Transaction History</h2>
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={transactions}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}
