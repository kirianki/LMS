'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    TrendingUp,
    TrendingDown,
    DollarSign,
    Landmark,
    Receipt,
    AlertCircle,
    Plus,
    BookOpen,
    FileText,
    Banknote
} from 'lucide-react';
import MetricCard from '@/components/dashboard/MetricCard';
import api from '@/lib/api';

interface AccountingData {
    total_assets: number;
    total_liabilities: number;
    net_equity: number;
    cash_on_hand: number;
    pending_expenses_count: number;
    this_month_expenses: number;
    currency: string;
}

export default function AccountingDashboard() {
    const router = useRouter();
    const [data, setData] = useState<AccountingData | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch real data from multiple endpoints
                const [balanceSheet, treasury, pendingExpenses, allExpenses] = await Promise.all([
                    api.get('/accounting/reports/balance_sheet/'),
                    api.get('/treasury/snapshots/summary/').catch(() => ({ data: { total_cash: 0 } })),
                    api.get('/expenses/expenses/?status=pending'),
                    api.get('/expenses/expenses/?status=paid')
                ]);

                // Calculate this month's expenses
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();

                const monthTotal = (allExpenses.data.results || allExpenses.data).reduce((acc: number, exp: any) => {
                    const d = new Date(exp.date);
                    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
                        return acc + parseFloat(exp.amount);
                    }
                    return acc;
                }, 0);

                setData({
                    total_assets: parseFloat(balanceSheet.data.assets?.total || 0),
                    total_liabilities: parseFloat(balanceSheet.data.liabilities?.total || 0),
                    net_equity: parseFloat(balanceSheet.data.equity?.total || 0),
                    cash_on_hand: parseFloat(treasury.data.total_cash || 0),
                    pending_expenses_count: (pendingExpenses.data.results || pendingExpenses.data).length,
                    this_month_expenses: monthTotal,
                    currency: 'KES'
                });
            } catch (error) {
                console.error('Failed to fetch accounting data:', error);
                // Fallback to zeros rather than crashing
                setData({
                    total_assets: 0,
                    total_liabilities: 0,
                    net_equity: 0,
                    cash_on_hand: 0,
                    pending_expenses_count: 0,
                    this_month_expenses: 0,
                    currency: 'KES'
                });
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: data?.currency || 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading accounting data...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-red-400">Failed to load accounting data</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Accounting</h1>
                <p className="text-muted-foreground mt-2">Financial overview and operations management</p>
            </div>

            {/* Financial Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Assets"
                    value={formatCurrency(data.total_assets)}
                    icon={TrendingUp}
                    trend="up"
                />

                <MetricCard
                    title="Total Liabilities"
                    value={formatCurrency(data.total_liabilities)}
                    icon={TrendingDown}
                    trend="down"
                />

                <MetricCard
                    title="Net Equity"
                    value={formatCurrency(data.net_equity)}
                    icon={DollarSign}
                    trend="neutral"
                    subtitle="Assets - Liabilities"
                />

                <MetricCard
                    title="Cash on Hand"
                    value={formatCurrency(data.cash_on_hand)}
                    icon={Landmark}
                    trend="neutral"
                    subtitle="All cash accounts"
                />

                <MetricCard
                    title="Pending Expenses"
                    value={data.pending_expenses_count}
                    icon={AlertCircle}
                    subtitle="Awaiting approval"
                    trend="neutral"
                />

                <MetricCard
                    title="This Month's Expenses"
                    value={formatCurrency(data.this_month_expenses)}
                    icon={Receipt}
                    trend="neutral"
                />
            </div>

            {/* Quick Actions */}
            <div className="glass rounded-xl p-6 border border-border">
                <h2 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                        onClick={() => router.push('/accounting/coa')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-primary/10">
                            <BookOpen className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Chart of Accounts</p>
                            <p className="text-xs text-muted-foreground">Manage account structure</p>
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/accounting/journal/new')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-emerald-500/10">
                            <FileText className="h-5 w-5 text-emerald-400" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Create Journal Entry</p>
                            <p className="text-xs text-muted-foreground">Record transactions</p>
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/accounting/treasury')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-blue-500/10">
                            <Landmark className="h-5 w-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">View Treasury</p>
                            <p className="text-xs text-muted-foreground">Cash accounts & transactions</p>
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/accounting/expenses/new')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-amber-500/10">
                            <Receipt className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Submit Expense</p>
                            <p className="text-xs text-muted-foreground">Record new expense</p>
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/accounting/payroll')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-purple-500/10">
                            <Banknote className="h-5 w-5 text-purple-400" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Process Payroll</p>
                            <p className="text-xs text-muted-foreground">Monthly staff payments</p>
                        </div>
                    </button>

                    <button
                        onClick={() => router.push('/accounting/reports')}
                        className="flex items-center gap-3 p-4 rounded-lg bg-muted hover:bg-white/10 border border-white/10 transition-colors text-left"
                    >
                        <div className="p-2 rounded-lg bg-indigo-500/10">
                            <FileText className="h-5 w-5 text-indigo-400" />
                        </div>
                        <div>
                            <p className="font-medium text-foreground">Financial Reports</p>
                            <p className="text-xs text-muted-foreground">Balance Sheet, P&L, etc.</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}
