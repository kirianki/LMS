'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Book, TrendingUp, TrendingDown, BookOpen } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface LedgerEntry {
    id: string;
    date: string;
    description: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
}

interface AccountDetails {
    account_name: string;
    account_code: string;
    opening_balance: number;
    closing_balance: number;
    history: LedgerEntry[];
}

export default function AccountDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [data, setData] = useState<AccountDetails | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLedger = async () => {
            try {
                const response = await api.get(`/accounting/reports/general_ledger/?account_id=${params.id}`);
                setData(response.data);
            } catch (error) {
                console.error('Failed to fetch general ledger:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLedger();
    }, [params.id]);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(value);
    };

    const columns = [
        {
            header: 'Date',
            accessor: (entry: LedgerEntry) => new Date(entry.date).toLocaleDateString(),
        },
        {
            header: 'Description',
            accessor: (entry: LedgerEntry) => (
                <div>
                    <p className="text-foreground font-medium">{entry.description}</p>
                    <p className="text-xs text-muted-foreground">{entry.reference}</p>
                </div>
            ),
        },
        {
            header: 'Debit',
            accessor: (entry: LedgerEntry) => (
                <span className={entry.debit > 0 ? "text-foreground" : "text-slate-600"}>
                    {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                </span>
            ),
        },
        {
            header: 'Credit',
            accessor: (entry: LedgerEntry) => (
                <span className={entry.credit > 0 ? "text-foreground" : "text-slate-600"}>
                    {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                </span>
            ),
        },
        {
            header: 'Balance',
            accessor: (entry: LedgerEntry) => (
                <span className="font-bold text-foreground">{formatCurrency(entry.balance)}</span>
            ),
        }
    ];

    if (isLoading) {
        return <div className="p-8 text-center text-muted-foreground">Loading ledger...</div>;
    }

    if (!data) {
        return <div className="p-8 text-center text-red-400">Account not found</div>;
    }

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">{data.account_name}</h1>
                    <p className="text-muted-foreground mt-1">Code: {data.account_code}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-sm text-muted-foreground text-uppercase tracking-wider">Opening Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(data.opening_balance)}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-primary" />
                        <span className="text-sm text-muted-foreground text-uppercase tracking-wider">Closing Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(data.closing_balance)}</p>
                </div>
            </div>

            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="p-6 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">General Ledger History</h2>
                    </div>
                </div>
                <DataTable
                    columns={columns}
                    data={data.history}
                    isLoading={isLoading}
                />
            </div>
        </div>
    );
}
