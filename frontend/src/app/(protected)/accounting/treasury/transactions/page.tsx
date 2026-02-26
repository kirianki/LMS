'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowUpRight,
    ArrowDownLeft,
    Search,
    Filter,
    Download,
    Landmark,
    Banknote,
    Receipt,
    Wallet
} from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Transaction {
    id: string;
    transaction_type: 'credit' | 'debit';
    category: string;
    amount: number;
    description: string;
    reference: string;
    created_at: string;
    account_name: string;
}

export default function TreasuryTransactionsPage() {
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchTransactions = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/treasury/transactions/${query ? `?search=${query}` : ''}`);
            setTransactions(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch treasury transactions:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchTransactions(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'loan_disbursement': return <ArrowUpRight className="h-4 w-4 text-amber-400" />;
            case 'loan_repayment': return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
            case 'expense': return <Receipt className="h-4 w-4 text-red-400" />;
            case 'payroll': return <Banknote className="h-4 w-4 text-purple-400" />;
            default: return <Wallet className="h-4 w-4 text-blue-400" />;
        }
    };

    const columns = [
        {
            header: 'Date',
            accessor: (tx: Transaction) => new Date(tx.created_at).toLocaleDateString(),
        },
        {
            header: 'Description',
            accessor: (tx: Transaction) => (
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-white/5">
                        {getCategoryIcon(tx.category)}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{tx.description}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">{tx.category.replace(/_/g, ' ')}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Account',
            accessor: (tx: Transaction) => tx.account_name,
        },
        {
            header: 'Reference',
            accessor: (tx: Transaction) => (
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono text-muted-foreground">
                    {tx.reference}
                </code>
            ),
        },
        {
            header: 'Amount',
            accessor: (tx: Transaction) => (
                <span className={`font-bold ${tx.transaction_type === 'credit' ? 'text-emerald-400' : 'text-red-400'}`}>
                    {tx.transaction_type === 'credit' ? '+' : '-'} {formatCurrency(tx.amount)}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Transactions</h1>
                    <p className="text-muted-foreground mt-2">Historical log of all cash movements</p>
                </div>
                <div className="flex gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-white/10 border border-white/10 transition-colors">
                        <Download className="h-4 w-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={transactions}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(tx) => router.push(`/accounting/treasury/transactions/${tx.id}`)}
            />
        </div>
    );
}
