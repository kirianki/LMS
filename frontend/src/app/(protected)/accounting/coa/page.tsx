'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Book, TrendingUp, TrendingDown, Minus, DollarSign } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface ChartOfAccount {
    id: string;
    code: string;
    name: string;
    account_type: string;
    balance: number;
    parent: string | null;
    is_active: boolean;
}

export default function ChartOfAccountsPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<ChartOfAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const pageSize = 20;

    const fetchAccounts = async (query = '', pageNum = 1) => {
        try {
            setIsLoading(true);
            const response = await api.get(`/accounting/accounts/`, {
                params: {
                    search: query,
                    page: pageNum,
                    page_size: pageSize
                }
            });

            const data = response?.data;

            if (data?.results) {
                setAccounts(data.results);
                setTotalCount(data.count);
            } else if (Array.isArray(data)) {
                setAccounts(data);
                setTotalCount(data.length);
            } else {
                setAccounts([]);
                setTotalCount(0);
            }
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchAccounts(searchQuery, page);
        }, searchQuery ? 500 : 0);
        return () => clearTimeout(timer);
    }, [searchQuery, page]);

    const getAccountTypeIcon = (type: string) => {
        switch (type) {
            case 'asset':
                return <TrendingUp className="h-4 w-4 text-emerald-500" />;
            case 'liability':
                return <TrendingDown className="h-4 w-4 text-red-500" />;
            case 'equity':
                return <DollarSign className="h-4 w-4 text-blue-500" />;
            case 'income':
                return <Plus className="h-4 w-4 text-green-500" />;
            case 'expense':
                return <Minus className="h-4 w-4 text-amber-500" />;
            default:
                return <Book className="h-4 w-4 text-muted-foreground" />;
        }
    };

    const getAccountTypeBadge = (type: string) => {
        const colors = {
            asset: 'bg-emerald-500/10 text-emerald-400',
            liability: 'bg-red-500/10 text-red-400',
            equity: 'bg-blue-500/10 text-blue-400',
            income: 'bg-green-500/10 text-green-400',
            expense: 'bg-amber-500/10 text-amber-400',
        };
        return colors[type as keyof typeof colors] || 'bg-slate-500/10 text-muted-foreground';
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const columns = [
        {
            header: 'Account',
            accessor: (account: ChartOfAccount) => (
                <div className="flex items-center gap-3">
                    {getAccountTypeIcon(account.account_type)}
                    <div>
                        <p className="font-medium text-foreground">{account.code}</p>
                        <p className="text-sm text-muted-foreground">{account.name}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Type',
            accessor: (account: ChartOfAccount) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getAccountTypeBadge(account.account_type)}`}>
                    {account.account_type.charAt(0).toUpperCase() + account.account_type.slice(1)}
                </span>
            ),
        },
        {
            header: 'Balance',
            accessor: (account: ChartOfAccount) => (
                <span className="font-medium">{formatCurrency(account.balance)}</span>
            ),
        },
        {
            header: 'Status',
            accessor: (account: ChartOfAccount) => (
                account.is_active ? (
                    <span className="text-emerald-400 text-sm">Active</span>
                ) : (
                    <span className="text-muted-foreground text-sm">Inactive</span>
                )
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Chart of Accounts</h1>
                    <p className="text-muted-foreground mt-2">Manage your account structure and ledger</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
                onSearch={(q) => {
                    setSearchQuery(q);
                    setPage(1); // Reset to page 1 on search
                }}
                pagination={{
                    totalCount,
                    pageSize,
                    currentPage: page,
                    onPageChange: setPage
                }}
                onRowClick={(account) => router.push(`/accounting/coa/${account.id}`)}
                actionButton={{
                    label: 'New Account',
                    icon: Plus,
                    onClick: () => router.push('/accounting/coa/new'),
                }}
            />
        </div>
    );
}
