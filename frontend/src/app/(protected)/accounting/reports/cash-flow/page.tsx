'use client';

import { useState, useEffect } from 'react';
import {
    ArrowRightLeft,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    ArrowUpCircle,
    ArrowDownCircle,
    Wallet,
    FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function CashFlow() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/cash_flow/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching cash flow:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: string = 'pdf') => {
        try {
            const response = await api.get('/accounting/reports/cash_flow/', {
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
            link.setAttribute('download', `Cash_Flow_${dateRange.start}_${dateRange.end}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting PDF:', error);
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

    const netCashPositive = data && parseFloat(data?.net_increase_in_cash ?? 0) >= 0;

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Cash Flow Statement</h1>
                    <p className="text-muted-foreground">Analysis of cash inflows and outflows (Direct Method)</p>
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
                    {/* Summary Card */}
                    <div className={`glass rounded-xl p-8 border text-center ${netCashPositive ? 'border-primary/20 bg-primary/5' : 'border-rose-500/20 bg-rose-500/5'}`}>
                        <div className={`inline-flex items-center justify-center p-4 rounded-full mb-4 ${netCashPositive ? 'bg-primary/20' : 'bg-rose-500/20'}`}>
                            <Wallet className={`h-8 w-8 ${netCashPositive ? 'text-primary' : 'text-rose-400'}`} />
                        </div>
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Net {netCashPositive ? 'Increase' : 'Decrease'} in Cash</h2>
                        <div className={`text-4xl font-bold mt-2 ${netCashPositive ? 'text-primary' : 'text-rose-400'}`}>
                            {formatCurrency(data?.net_increase_in_cash ?? 0)}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Operating Inflows */}
                        <div className="glass rounded-xl border border-border overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ArrowUpCircle className="h-5 w-5 text-emerald-400" />
                                    <h2 className="text-lg font-bold text-foreground">Cash Inflows</h2>
                                </div>
                            </div>
                            <div className="p-0">
                                {(data?.operating_activities?.inflow ?? []).length > 0 ? (
                                    (data?.operating_activities?.inflow ?? []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors">
                                            <div>
                                                <div className="text-sm text-foreground font-medium">{item.description || 'Deposit'}</div>
                                                <div className="text-xs text-muted-foreground">{item.date}</div>
                                            </div>
                                            <span className="text-sm font-bold text-emerald-400">+{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">No cash inflows in this period.</div>
                                )}
                            </div>
                        </div>

                        {/* Operating Outflows */}
                        <div className="glass rounded-xl border border-border overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-border flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <ArrowDownCircle className="h-5 w-5 text-rose-400" />
                                    <h2 className="text-lg font-bold text-foreground">Cash Outflows</h2>
                                </div>
                            </div>
                            <div className="p-0">
                                {(data?.operating_activities?.outflow ?? []).length > 0 ? (
                                    (data?.operating_activities?.outflow ?? []).map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors">
                                            <div>
                                                <div className="text-sm text-foreground font-medium">{item.description || 'Withdrawal'}</div>
                                                <div className="text-xs text-muted-foreground">{item.date}</div>
                                            </div>
                                            <span className="text-sm font-bold text-rose-400">-{formatCurrency(item.amount)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground text-sm">No cash outflows in this period.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
