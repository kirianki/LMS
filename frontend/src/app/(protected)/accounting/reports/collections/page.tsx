'use client';

import { useState, useEffect } from 'react';
import {
    TrendingUp,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    PieChart,
    CreditCard,
    ArrowDownCircle,
    CheckCircle2,
    FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function CollectionsReport() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [dateRange, setDateRange] = useState({
        start: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd'),
        end: format(new Date(), 'yyyy-MM-dd')
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/collections/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching collections report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (type: 'pdf' | 'docx') => {
        try {
            const response = await api.get('/accounting/reports/collections/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    export_type: type
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            const extension = type === 'docx' ? 'docx' : 'pdf';
            link.setAttribute('download', `Collections_${dateRange.start}_${dateRange.end}.${extension}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error(`Error exporting ${type}:`, error);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Collections Report</h1>
                    <p className="text-muted-foreground">Summary of all repayments received and their allocation (Principal, Interest, Fees)</p>
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
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="glass rounded-xl p-4 border border-border">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Total Collected</h3>
                            <p className="text-2xl font-bold text-emerald-400">
                                KES {parseFloat(data.summary.total_collected).toLocaleString()}
                            </p>
                        </div>
                        <div className="glass rounded-xl p-4 border border-border">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Interest Portion</h3>
                            <p className="text-2xl font-bold text-primary">
                                KES {parseFloat(data.summary.total_interest).toLocaleString()}
                            </p>
                        </div>
                        <div className="glass rounded-xl p-4 border border-border">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Principal Repaid</h3>
                            <p className="text-2xl font-bold text-foreground">
                                KES {parseFloat(data.summary.total_principal).toLocaleString()}
                            </p>
                        </div>
                        <div className="glass rounded-xl p-4 border border-border">
                            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Fees & Penalties</h3>
                            <p className="text-2xl font-bold text-orange-400">
                                KES {(parseFloat(data.summary.total_fees) + parseFloat(data.summary.total_penalties)).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Breakdown Chart Placeholder */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="md:col-span-2 glass rounded-xl border border-border overflow-hidden">
                            <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Repayments</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse text-sm">
                                    <thead>
                                        <tr className="bg-white/5 border-b border-border">
                                            <th className="p-4 font-semibold text-muted-foreground text-xs uppercase">Date</th>
                                            <th className="p-4 font-semibold text-muted-foreground text-xs uppercase">Borrower</th>
                                            <th className="p-4 font-semibold text-muted-foreground text-xs uppercase">Method</th>
                                            <th className="p-4 font-semibold text-muted-foreground text-xs uppercase text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.data.map((row: any, idx: number) => (
                                            <tr key={idx} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                                                <td className="p-4">{row.date}</td>
                                                <td className="p-4">
                                                    <div className="font-medium text-foreground">{row.borrower}</div>
                                                    <div className="text-[10px] text-muted-foreground">{row.loan}</div>
                                                </td>
                                                <td className="p-4">
                                                    <span className="px-2 py-0.5 rounded-full text-[10px] bg-muted text-muted-foreground uppercase font-bold">
                                                        {row.method}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right font-bold text-emerald-400">
                                                    {parseFloat(row.amount).toLocaleString()}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="glass rounded-xl border border-border p-6 flex flex-col items-center justify-center text-center">
                            <div className="p-4 rounded-full bg-primary/10 mb-4">
                                <PieChart className="h-8 w-8 text-primary" />
                            </div>
                            <h3 className="font-bold text-foreground mb-2">Collection Split</h3>
                            <div className="w-full space-y-3 mt-4">
                                {[
                                    { label: 'Principal', value: data.summary.total_principal, color: 'bg-foreground' },
                                    { label: 'Interest', value: data.summary.total_interest, color: 'bg-primary' },
                                    { label: 'Fees', value: data.summary.total_fees, color: 'bg-orange-400' }
                                ].map((item, idx) => {
                                    const percentage = (parseFloat(item.value) / parseFloat(data.summary.total_collected) * 100) || 0;
                                    return (
                                        <div key={idx} className="space-y-1">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">{item.label}</span>
                                                <span className="font-medium text-foreground">{percentage.toFixed(1)}%</span>
                                            </div>
                                            <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                                                <div className={`h-full ${item.color}`} style={{ width: `${percentage}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
