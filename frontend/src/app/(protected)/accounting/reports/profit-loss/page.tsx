'use client';

import { useState, useEffect } from 'react';
import {
    TrendingUp,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    TrendingDown,
    DollarSign,
    FileText
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Suspense } from 'react';

export default function ProfitLossPage() {
    return (
        <Suspense fallback={
            <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        }>
            <ProfitLoss />
        </Suspense>
    );
}

function ProfitLoss() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        start: searchParams.get('start_date') || format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: searchParams.get('end_date') || format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/profit_loss/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching profit & loss:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: string = 'pdf') => {
        try {
            const response = await api.get('/accounting/reports/profit_loss/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    export_type: format
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Profit_Loss_${dateRange.start}_${dateRange.end}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting report:', error);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const formatCurrency = (amount: number | string) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(parseFloat(amount.toString()));
    };

    const isProfitable = data && parseFloat(data?.net_profit ?? 0) > 0;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-full hover:bg-muted transition-colors"
                >
                    <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Profit & Loss</h1>
                    <p className="text-muted-foreground">Detailed statement of revenue, expenses and net income</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-xl p-4 border border-border flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="date"
                        value={dateRange.start}
                        onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                        className="bg-transparent border-none text-sm focus:ring-0 text-foreground"
                    />
                    <span className="text-muted-foreground">to</span>
                    <input
                        type="date"
                        value={dateRange.end}
                        onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                        className="bg-transparent border-none text-sm focus:ring-0 text-foreground"
                    />
                </div>
                <button
                    onClick={fetchReport}
                    className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <Filter className="h-4 w-4" />
                    Apply Filters
                </button>
                <button
                    onClick={() => handleExport('pdf')}
                    className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                    <Download className="h-4 w-4" />
                    Export PDF
                </button>
                <button
                    onClick={() => handleExport('docx')}
                    className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                    <FileText className="h-4 w-4" />
                    Export Word
                </button>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : data && (
                <>
                    {/* High Level Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass rounded-xl p-6 border border-border hover:border-emerald-500/50 transition-colors">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Income</h3>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.income?.total ?? 0)}</p>
                        </div>
                        <div className="glass rounded-xl p-6 border border-border hover:border-rose-500/50 transition-colors">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 rounded-lg bg-rose-500/10">
                                    <TrendingDown className="h-5 w-5 text-rose-400" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Expenses</h3>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(data?.expenses?.total ?? 0)}</p>
                        </div>
                        <div className={`glass rounded-xl p-6 border transition-colors ${isProfitable ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-rose-500/50 bg-rose-500/5'}`}>
                            <div className="flex items-center gap-4 mb-2">
                                <div className={`p-2 rounded-lg ${isProfitable ? 'bg-emerald-500/20' : 'bg-rose-500/20'}`}>
                                    <DollarSign className={`h-5 w-5 ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`} />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Net Profit</h3>
                            </div>
                            <p className={`text-2xl font-bold ${isProfitable ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatCurrency(data?.net_profit ?? 0)}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Income Breakdown */}
                        <div className="glass rounded-xl border border-border overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-border flex items-center justify-between">
                                <h2 className="text-lg font-bold text-emerald-400">Income Accounts</h2>
                            </div>
                            <div className="p-0">
                                {(data?.income?.details ?? []).length > 0 ? (
                                    (data?.income?.details ?? []).map((account: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 cursor-pointer group transition-colors"
                                            onClick={() => router.push(`/accounting/reports/general-ledger?account_id=${account.id}&start_date=${dateRange.start}&end_date=${dateRange.end}`)}
                                        >
                                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{account.name}</span>
                                            <span className="text-sm font-medium text-emerald-400">{formatCurrency(account.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">No income recorded for this period.</div>
                                )}
                            </div>
                            <div className="p-4 bg-emerald-500/10 border-t border-emerald-500/20 flex items-center justify-between">
                                <span className="font-bold text-sm text-emerald-200 uppercase">Total Income</span>
                                <span className="font-bold text-emerald-400">{formatCurrency(data?.income?.total ?? 0)}</span>
                            </div>
                        </div>

                        {/* Expense Breakdown */}
                        <div className="glass rounded-xl border border-border overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-border flex items-center justify-between">
                                <h2 className="text-lg font-bold text-rose-400">Expense Accounts</h2>
                            </div>
                            <div className="p-0">
                                {(data?.expenses?.details ?? []).length > 0 ? (
                                    (data?.expenses?.details ?? []).map((account: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 cursor-pointer group transition-colors"
                                            onClick={() => router.push(`/accounting/reports/general-ledger?account_id=${account.id}&start_date=${dateRange.start}&end_date=${dateRange.end}`)}
                                        >
                                            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{account.name}</span>
                                            <span className="text-sm font-medium text-rose-400">{formatCurrency(account.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">No expenses recorded for this period.</div>
                                )}
                            </div>
                            <div className="p-4 bg-rose-500/10 border-t border-rose-500/20 flex items-center justify-between">
                                <span className="font-bold text-sm text-rose-200 uppercase">Total Expenses</span>
                                <span className="font-bold text-rose-400">{formatCurrency(data?.expenses?.total ?? 0)}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
