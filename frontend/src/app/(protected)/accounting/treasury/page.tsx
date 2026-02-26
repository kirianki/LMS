'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Landmark, ArrowUpDown } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import CreateAccountModal from '@/components/treasury/CreateAccountModal';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface CashAccount {
    id: string;
    name: string;
    account_type: string;
    account_number: string;
    bank_name: string;
    current_balance: number;
    is_active: boolean;
}

export default function TreasuryPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [totalCash, setTotalCash] = useState(0);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const fetchAccounts = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/treasury/accounts/');
            const data = response.data.results || response.data;
            setAccounts(data);

            // Calculate total cash
            const total = data.reduce((sum: number, acc: CashAccount) => sum + parseFloat(acc.current_balance.toString()), 0);
            setTotalCash(total);
        } catch (error) {
            console.error('Failed to fetch cash accounts:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleCreateSuccess = () => {
        fetchAccounts(); // Refresh the list
    };

    const getAccountTypeIcon = (type: string) => {
        switch (type) {
            case 'bank':
                return '🏦';
            case 'cash':
                return '💵';
            case 'mobile_money':
                return '📱';
            default:
                return '💰';
        }
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
            accessor: (account: CashAccount) => (
                <div className="flex items-center gap-3">
                    <div className="text-2xl">{getAccountTypeIcon(account.account_type)}</div>
                    <div>
                        <p className="font-medium text-foreground">{account.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {account.account_type === 'bank' && account.account_number}
                            {account.account_type === 'bank' && account.bank_name && ` · ${account.bank_name}`}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Type',
            accessor: (account: CashAccount) => (
                <span className="capitalize text-sm text-slate-300">
                    {account.account_type.replace('_', ' ')}
                </span>
            ),
        },
        {
            header: 'Balance',
            accessor: (account: CashAccount) => (
                <span className="font-bold text-lg text-foreground">{formatCurrency(account.current_balance)}</span>
            ),
        },
        {
            header: 'Status',
            accessor: (account: CashAccount) => (
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
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Treasury</h1>
                <p className="text-muted-foreground mt-2">Manage cash accounts and track financial transactions</p>
            </div>

            {/* Total Cash Summary */}
            <div className="glass rounded-xl p-6 border border-border">
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Total Cash on Hand</p>
                        <p className="text-4xl font-bold text-foreground mt-2">{formatCurrency(totalCash)}</p>
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/10">
                        <Landmark className="h-8 w-8 text-emerald-400" />
                    </div>
                </div>
            </div>

            {/* Cash Accounts */}
            <DataTable
                columns={columns}
                data={accounts}
                isLoading={isLoading}
                onRowClick={(account) => router.push(`/accounting/treasury/${account.id}`)}
                actionButton={(user?.is_superuser || user?.permissions?.includes('treasury.add_cashaccount')) ? {
                    label: 'New Account',
                    icon: Plus,
                    onClick: () => setShowCreateModal(true),
                } : undefined}
            />

            {/* Quick Link to Transactions */}
            <button
                onClick={() => router.push('/accounting/treasury/transactions')}
                className="w-full p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left flex items-center justify-between"
            >
                <div>
                    <p className="font-medium text-foreground">View All Transactions</p>
                    <p className="text-sm text-muted-foreground">See complete transaction history</p>
                </div>
                <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
            </button>

            {/* Create Account Modal */}
            <CreateAccountModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={handleCreateSuccess}
            />
        </div>
    );
}
