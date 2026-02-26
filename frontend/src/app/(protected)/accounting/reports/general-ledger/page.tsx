'use client';

import { useState, useEffect } from 'react';
import {
    FileText,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    Search
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format, startOfMonth, endOfMonth } from 'date-fns';

export default function GeneralLedger() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [accounts, setAccounts] = useState<any[]>([]);
    const [selectedAccount, setSelectedAccount] = useState('');
    const [dateRange, setDateRange] = useState({
        start: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
        end: format(endOfMonth(new Date()), 'yyyy-MM-dd')
    });

    useEffect(() => {
        // Fetch accounts for dropdown
        api.get('/accounting/accounts/').then(res => {
            setAccounts(res.data.results || res.data);
        }).catch(err => console.error(err));
    }, []);

    const fetchReport = async () => {
        if (!selectedAccount) return;
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/general_ledger/', {
                params: {
                    account_id: selectedAccount,
                    start_date: dateRange.start,
                    end_date: dateRange.end
                }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching general ledger:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: string = 'pdf') => {
        if (!selectedAccount) return;
        try {
            const response = await api.get('/accounting/reports/general_ledger/', {
                params: {
                    account_id: selectedAccount,
                    start_date: dateRange.start,
                    end_date: dateRange.end,
                    export_type: format
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `General_Ledger_${dateRange.start}_${dateRange.end}.${format}`);
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">General Ledger</h1>
                    <p className="text-muted-foreground">Detailed transaction history for specific accounts</p>
                </div>
            </div>

            {/* Filters */}
            <div className="glass rounded-xl p-4 border border-border flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                    <select
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full bg-transparent border border-border rounded-lg px-3 py-2 text-sm focus:ring-primary focus:border-primary text-foreground"
                    >
                        <option value="">Select Account...</option>
                        <option value="all" className="font-bold text-primary">--- ALL ACCOUNTS ---</option>
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                                {acc.code} - {acc.name}
                            </option>
                        ))}
                    </select>
                </div>
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
                    disabled={!selectedAccount}
                    className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    <Filter className="h-4 w-4" />
                    Load Ledger
                </button>
                <button
                    onClick={() => handleExport('pdf')}
                    disabled={!data}
                    className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    <Download className="h-4 w-4" />
                    Export PDF
                </button>
                <button
                    onClick={() => handleExport('docx')}
                    disabled={!data}
                    className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors disabled:opacity-50"
                >
                    <FileText className="h-4 w-4" />
                    Export Word
                </button>
            </div>

            {loading ? (
                <div className="h-64 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            ) : data ? (
                <div className="space-y-8">
                    {data.is_bulk ? (
                        <>
                            <div className="glass rounded-xl p-4 border border-primary/20 bg-primary/5 flex items-center justify-between">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-foreground">Consolidated General Ledger</h3>
                                    <p className="text-xs text-muted-foreground">Showing history for {(data?.accounts ?? []).length} active accounts</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-muted-foreground">
                                        Total Opening: <span className="text-foreground">{formatCurrency(data?.total_opening ?? 0)}</span>
                                    </div>
                                    <div className="text-sm font-bold text-primary">
                                        Total Closing: <span>{formatCurrency(data?.total_closing ?? 0)}</span>
                                    </div>
                                </div>
                            </div>

                            {(data?.accounts ?? []).map((accountLedger: any) => (
                                <LedgerTable
                                    key={accountLedger.account_id}
                                    data={accountLedger}
                                    formatCurrency={formatCurrency}
                                />
                            ))}
                        </>
                    ) : (
                        <LedgerTable data={data} formatCurrency={formatCurrency} />
                    )}
                </div>
            ) : (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl">
                    <Search className="h-8 w-8 mb-2" />
                    <p>Select an account to view the ledger</p>
                </div>
            )}
        </div>
    );
}

function LedgerTable({ data, formatCurrency }: { data: any, formatCurrency: any }) {
    return (
        <div className="glass rounded-xl border border-border overflow-hidden">
            <div className="p-4 bg-white/5 border-b border-border flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground">
                        {data?.account_code} - {data?.account_name}
                    </h2>
                    <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{data?.account_type}</span>
                </div>
                <div className="text-sm font-medium text-muted-foreground">
                    Opening Balance: <span className="text-foreground">{formatCurrency(data?.opening_balance ?? 0)}</span>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
                        <tr>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Ref</th>
                            <th className="px-4 py-3 text-right">Debit</th>
                            <th className="px-4 py-3 text-right">Credit</th>
                            <th className="px-4 py-3 text-right">Balance</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {(data?.history ?? []).length > 0 ? (
                            (data?.history ?? []).map((entry: any) => (
                                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{entry.date}</td>
                                    <td className="px-4 py-3 text-foreground">{entry.description}</td>
                                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{entry.reference}</td>
                                    <td className="px-4 py-3 text-right text-foreground">
                                        {entry.debit > 0 ? formatCurrency(entry.debit) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-foreground">
                                        {entry.credit > 0 ? formatCurrency(entry.credit) : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right font-medium text-foreground">
                                        {formatCurrency(entry.balance)}
                                    </td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                                    No transactions found for this period.
                                </td>
                            </tr>
                        )}
                    </tbody>
                    <tfoot className="bg-muted/50 font-bold border-t border-border">
                        <tr>
                            <td colSpan={5} className="px-4 py-3 text-right text-foreground">Closing Balance</td>
                            <td className="px-4 py-3 text-right text-primary">
                                {formatCurrency(data?.closing_balance ?? 0)}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
