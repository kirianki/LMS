'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, PiggyBank, TrendingUp, Wallet, ArrowUpRight, ArrowDownLeft, Search } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface SavingsAccount {
    id: string;
    account_number: string;
    borrower_name: string;
    product_name: string;
    current_balance: number;
    status: string;
}

export default function SavingsPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<SavingsAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_accounts: 0,
        total_balance: 0,
    });

    const fetchAccounts = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/savings/accounts/${query ? `?search=${query}` : ''}`);
            const data = response?.data;
            const accountsList = Array.isArray(data) ? data : data?.results || [];
            setAccounts(accountsList);

            // Calculate simple stats
            const total = accountsList.reduce((sum: number, acc: SavingsAccount) => sum + parseFloat(acc.current_balance.toString()), 0);
            setStats({
                total_accounts: accountsList.length,
                total_balance: total,
            });
        } catch (error) {
            console.error('Failed to fetch savings accounts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAccounts(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const columns = [
        {
            header: 'Account Number',
            accessor: (acc: SavingsAccount) => (
                <span className="font-mono text-xs font-bold text-foreground uppercase tracking-wider">{acc.account_number}</span>
            ),
        },
        {
            header: 'Borrower',
            accessor: (acc: SavingsAccount) => (
                <p className="font-medium text-foreground">{acc.borrower_name}</p>
            ),
        },
        {
            header: 'Product',
            accessor: (acc: SavingsAccount) => (
                <span className="text-xs px-2 py-1 rounded bg-muted border border-border text-muted-foreground">
                    {acc.product_name}
                </span>
            ),
        },
        {
            header: 'Balance',
            accessor: (acc: SavingsAccount) => (
                <span className="font-bold text-emerald-400">{formatCurrency(acc.current_balance)}</span>
            ),
        },
        {
            header: 'Status',
            accessor: (acc: SavingsAccount) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${acc.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-muted-foreground'
                    }`}>
                    {acc.status}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Savings Accounts</h1>
                    <p className="text-muted-foreground mt-2">Manage borrower deposits and interest accruals</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/savings/products')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-muted-foreground hover:text-foreground transition-colors text-sm font-semibold"
                    >
                        Manage Products
                    </button>
                    <button
                        onClick={() => router.push('/savings/new')}
                        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Open Account
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <PiggyBank className="h-12 w-12 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Accounts</p>
                    <p className="text-3xl font-bold text-foreground">{stats.total_accounts}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="h-12 w-12 text-emerald-500" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Savings</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.total_balance)}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-12 w-12 text-blue-500" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Interest Accrued</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(0)}</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(acc) => router.push(`/savings/${acc.id}`)}
                actionButton={{
                    label: 'Open Account',
                    icon: Plus,
                    onClick: () => router.push('/savings/new'),
                }}
            />
        </div>
    );
}
