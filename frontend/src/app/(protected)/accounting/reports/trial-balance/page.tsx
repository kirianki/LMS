'use client';

import { useState, useEffect } from 'react';
import {
    Scale,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function TrialBalance() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/trial_balance/', {
                params: { date }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching trial balance:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchReport();
    }, []);

    const handleExport = async (format: string = 'pdf') => {
        try {
            const response = await api.get('/accounting/reports/trial_balance/', {
                params: {
                    date,
                    export_type: format
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Trial_Balance_${date}.${format}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Error exporting report:', error);
        }
    };

    const formatCurrency = (amount: number | string) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(parseFloat(amount.toString()));
    };

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Trial Balance</h1>
                    <p className="text-muted-foreground">Listing of ending balances for all accounts</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-xl p-4 border border-border flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">As of:</span>
                    <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="bg-transparent border-none text-sm focus:ring-0 text-foreground"
                    />
                </div>
                <button
                    onClick={fetchReport}
                    className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
                >
                    <Filter className="h-4 w-4" />
                    Update Report
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
                <div className="glass rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                                <tr>
                                    <th className="px-4 py-3">Code</th>
                                    <th className="px-4 py-3">Account Name</th>
                                    <th className="px-4 py-3 text-right">Debit</th>
                                    <th className="px-4 py-3 text-right">Credit</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {(data?.report ?? []).length > 0 ? (
                                    (data?.report ?? []).map((item: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                            <td className="px-4 py-3 text-muted-foreground font-mono">{item.code}</td>
                                            <td className="px-4 py-3 text-foreground font-medium">{item.name}</td>
                                            <td className="px-4 py-3 text-right text-foreground">
                                                {item.debit > 0 ? formatCurrency(item.debit) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-right text-foreground">
                                                {item.credit > 0 ? formatCurrency(item.credit) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                                            No accounts found for this period.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-muted/50 font-bold border-t border-border">
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-right text-foreground uppercase text-xs tracking-wider">Totals</td>
                                    <td className="px-4 py-3 text-right text-emerald-400">
                                        {formatCurrency(data?.total_debit ?? 0)}
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-400">
                                        {formatCurrency(data?.total_credit ?? 0)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
