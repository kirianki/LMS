'use client';

import { useState, useEffect } from 'react';
import {
    Scale,
    Download,
    Filter,
    Calendar,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    CheckCircle2,
    AlertCircle,
    FileText
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { format } from 'date-fns';

export default function BalanceSheet() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
    const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
        'assets': true,
        'liabilities': true,
        'equity': true
    });

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/balance_sheet/', {
                params: { date }
            });
            setData(response.data);
        } catch (error) {
            console.error('Error fetching balance sheet:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (format: string = 'pdf') => {
        try {
            const response = await api.get('/accounting/reports/balance_sheet/', {
                params: {
                    date,
                    export_type: format
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Balance_Sheet_${date}.${format}`);
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

    const toggleSection = (section: string) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Balance Sheet</h1>
                    <p className="text-muted-foreground">Snapshot of company's financial position</p>
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
                <>
                    {/* Safety Check */}
                    <div className={`rounded-xl p-4 border flex items-center gap-3 ${(data?.is_balanced ?? true) ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-rose-500/10 border-rose-500/20'}`}>
                        {(data?.is_balanced ?? true) ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                        ) : (
                            <AlertCircle className="h-5 w-5 text-rose-400" />
                        )}
                        <div>
                            <h3 className={`font-semibold ${(data?.is_balanced ?? true) ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {(data?.is_balanced ?? true) ? 'Balanced' : 'Unbalanced'}
                            </h3>
                            <p className="text-xs text-muted-foreground">
                                Assets {(data?.is_balanced ?? true) ? 'equal' : 'do not equal'} Liabilities + Equity
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Assets Column */}
                        <div className="space-y-6">
                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <div
                                    className="p-4 bg-white/5 border-b border-border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => toggleSection('assets')}
                                >
                                    <h2 className="text-lg font-bold text-foreground">Assets</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-foreground">{formatCurrency(data?.assets?.total ?? 0)}</span>
                                        {expandedSections['assets'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                </div>
                                {expandedSections['assets'] && (
                                    <div className="p-0">
                                        {(data?.assets?.details ?? []).map((account: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors">
                                                <span className="text-sm text-foreground">{account.name}</span>
                                                <span className="text-sm font-medium text-foreground">{formatCurrency(account.balance)}</span>
                                            </div>
                                        ))}
                                        {(data?.assets?.details ?? []).length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground text-sm">No assets recorded.</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Liabilities & Equity Column */}
                        <div className="space-y-6">
                            {/* Liabilities */}
                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <div
                                    className="p-4 bg-white/5 border-b border-border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => toggleSection('liabilities')}
                                >
                                    <h2 className="text-lg font-bold text-foreground">Liabilities</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-foreground">{formatCurrency(data?.liabilities?.total ?? 0)}</span>
                                        {expandedSections['liabilities'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                </div>
                                {expandedSections['liabilities'] && (
                                    <div className="p-0">
                                        {(data?.liabilities?.details ?? []).map((account: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors">
                                                <span className="text-sm text-foreground">{account.name}</span>
                                                <span className="text-sm font-medium text-foreground">{formatCurrency(account.balance)}</span>
                                            </div>
                                        ))}
                                        {(data?.liabilities?.details ?? []).length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground text-sm">No liabilities recorded.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Equity */}
                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <div
                                    className="p-4 bg-white/5 border-b border-border flex items-center justify-between cursor-pointer hover:bg-white/10 transition-colors"
                                    onClick={() => toggleSection('equity')}
                                >
                                    <h2 className="text-lg font-bold text-foreground">Equity</h2>
                                    <div className="flex items-center gap-4">
                                        <span className="font-bold text-foreground">{formatCurrency(data?.equity?.total ?? 0)}</span>
                                        {expandedSections['equity'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                    </div>
                                </div>
                                {expandedSections['equity'] && (
                                    <div className="p-0">
                                        {(data?.equity?.details ?? []).map((account: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between p-4 border-b border-border/50 last:border-0 hover:bg-white/5 transition-colors">
                                                <span className="text-sm text-foreground">{account.name}</span>
                                                <span className="text-sm font-medium text-foreground">{formatCurrency(account.balance)}</span>
                                            </div>
                                        ))}
                                        {(data?.equity?.details ?? []).length === 0 && (
                                            <div className="p-8 text-center text-muted-foreground text-sm">No equity recorded.</div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Verification Total */}
                            <div className="rounded-xl p-4 bg-muted/50 border border-border flex items-center justify-between">
                                <span className="font-bold text-muted-foreground uppercase text-xs">Total Liabilities & Equity</span>
                                <span className="font-bold text-lg text-foreground">
                                    {formatCurrency(parseFloat(data?.liabilities?.total ?? 0) + parseFloat(data?.equity?.total ?? 0))}
                                </span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
