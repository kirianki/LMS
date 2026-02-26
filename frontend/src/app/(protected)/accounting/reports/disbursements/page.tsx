'use client';

import { useState, useEffect } from 'react';
import {
    FileText,
    Download,
    Filter,
    Calendar,
    Search,
    ChevronLeft,
    DollarSign,
    Box,
    Globe
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function DisbursementsReport() {
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
            const response = await api.get('/accounting/reports/disbursements/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching disbursements report:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/accounting/reports/disbursements/', {
                params: {
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    export_type: 'pdf'
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Disbursements_${dateRange.start}_${dateRange.end}.pdf`);
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Disbursements Report</h1>
                    <p className="text-muted-foreground">Detailed log of all loans disbursed within the selected period</p>
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
                    onClick={handleExport}
                    className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors"
                >
                    <Download className="h-4 w-4" />
                    Export PDF
                </button>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : data && (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="glass rounded-xl p-6 border border-border">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <DollarSign className="h-5 w-5 text-primary" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Disbursed</h3>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                KES {parseFloat(data.summary.total_amount).toLocaleString()}
                            </p>
                        </div>
                        <div className="glass rounded-xl p-6 border border-border">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 rounded-lg bg-orange-500/10">
                                    <Box className="h-5 w-5 text-orange-400" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Count</h3>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                {data.summary.count} Loans
                            </p>
                        </div>
                        <div className="glass rounded-xl p-6 border border-border">
                            <div className="flex items-center gap-4 mb-2">
                                <div className="p-2 rounded-lg bg-emerald-500/10">
                                    <Globe className="h-5 w-5 text-emerald-400" />
                                </div>
                                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Loan</h3>
                            </div>
                            <p className="text-2xl font-bold text-foreground">
                                KES {parseFloat(data.summary.avg_loan_size).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="glass rounded-xl border border-border overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-white/5 border-b border-border">
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground">Date</th>
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground">Loan #</th>
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground">Borrower</th>
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground">Product</th>
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground">Method</th>
                                        <th className="p-4 text-xs font-semibold uppercase text-muted-foreground text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.data.map((row: any, idx: number) => (
                                        <tr key={idx} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                                            <td className="p-4 text-sm text-foreground">{row.date}</td>
                                            <td className="p-4 text-sm font-medium text-primary">{row.loan_number}</td>
                                            <td className="p-4 text-sm text-foreground">{row.borrower}</td>
                                            <td className="p-4 text-sm text-muted-foreground">{row.product}</td>
                                            <td className="p-4 text-sm">
                                                <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-muted text-muted-foreground">
                                                    {row.method}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm font-bold text-foreground text-right">
                                                {parseFloat(row.amount).toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {data.data.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="p-12 text-center text-muted-foreground">
                                                No disbursements found for the selected period.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
