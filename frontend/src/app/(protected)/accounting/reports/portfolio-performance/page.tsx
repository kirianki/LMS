'use client';

import { useState, useEffect } from 'react';
import {
    Activity,
    Download,
    ChevronLeft,
    AlertTriangle,
    ShieldCheck,
    ArrowUpRight,
    Target,
    TrendingDown,
    TrendingUp,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import PageLoader from '@/components/ui/PageLoader';

// API shape:
// {
//   risk_level: 'Low' | 'Moderate' | 'High',
//   products: [{ name, active_loans, outstanding_balance }],
//   par_metrics: {
//     total_portfolio,
//     par_1_plus_amount, par_1_plus_percent,
//     par_30_plus_amount, par_30_plus_percent,
//     par_90_plus_amount, par_90_plus_percent,
//   }
// }

function fmt(value: any): string {
    const n = parseFloat(value ?? 0);
    return isNaN(n) ? '0.00' : n.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function pct(value: any): string {
    const n = parseFloat(value ?? 0);
    return isNaN(n) ? '0.00' : n.toFixed(2);
}

export default function PortfolioPerformance() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchReport = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/accounting/reports/portfolio_performance/');
            setData(response.data);
        } catch (err: any) {
            console.error('Error fetching portfolio performance:', err);
            setError('Failed to load portfolio performance report.');
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (type: 'pdf' | 'docx' = 'pdf') => {
        try {
            const response = await api.get('/accounting/reports/portfolio_performance/', {
                params: { export_type: type },
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Portfolio_Performance.${type}`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Error exporting:', err);
        }
    };

    useEffect(() => { fetchReport(); }, []);

    const getRiskColor = (risk: string = '') => {
        switch (risk.toLowerCase()) {
            case 'low': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
            case 'moderate': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
            case 'high': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
            default: return 'text-muted-foreground bg-muted border-border';
        }
    };

    const par = data?.par_metrics ?? {};
    const totalPortfolio = parseFloat(par.total_portfolio ?? 0);

    const parMetrics = [
        {
            label: 'PAR 1+',
            percent: par.par_1_plus_percent,
            amount: par.par_1_plus_amount,
            threshold: 15,
        },
        {
            label: 'PAR 30+',
            percent: par.par_30_plus_percent,
            amount: par.par_30_plus_amount,
            threshold: 10,
        },
        {
            label: 'PAR 90+',
            percent: par.par_90_plus_percent,
            amount: par.par_90_plus_amount,
            threshold: 5,
        },
    ];

    const topProduct = (data?.products ?? []).reduce(
        (best: any, p: any) =>
            parseFloat(p.outstanding_balance ?? 0) > parseFloat(best?.outstanding_balance ?? 0) ? p : best,
        null
    );

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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Portfolio Performance</h1>
                    <p className="text-muted-foreground">High-level risk assessment and product-specific performance metrics</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <button
                        onClick={() => handleExport('pdf')}
                        className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors text-sm"
                    >
                        <Download className="h-4 w-4" />
                        PDF
                    </button>
                    <button
                        onClick={() => handleExport('docx')}
                        className="px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors text-sm"
                    >
                        <Download className="h-4 w-4" />
                        DOCX
                    </button>
                </div>
            </div>

            {loading ? (
                <PageLoader message="Loading portfolio data..." fullscreen={false} />
            ) : error ? (
                <div className="glass rounded-xl p-8 border border-rose-500/30 text-center">
                    <AlertTriangle className="h-8 w-8 text-rose-400 mx-auto mb-3" />
                    <p className="text-rose-400 font-medium">{error}</p>
                    <button onClick={fetchReport} className="mt-4 px-4 py-2 text-sm bg-primary rounded-lg text-white">
                        Retry
                    </button>
                </div>
            ) : data && (
                <>
                    {/* Risk summary hero */}
                    <div className="glass rounded-2xl p-8 border border-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                            <Activity className="h-48 w-48" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-3">
                                <span className={`inline-flex px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border ${getRiskColor(data.risk_level)}`}>
                                    Overall Risk: {data.risk_level}
                                </span>
                                <h2 className="text-4xl font-bold text-foreground">
                                    KES {fmt(totalPortfolio)}
                                </h2>
                                <p className="text-muted-foreground">Total Active Portfolio Outstanding</p>
                            </div>

                            {/* PAR Cards */}
                            <div className="grid grid-cols-3 gap-6 md:border-l border-border/50 md:pl-8">
                                {parMetrics.map((m) => {
                                    const pctVal = parseFloat(m.percent ?? 0);
                                    const isRisky = pctVal > m.threshold;
                                    return (
                                        <div key={m.label} className="space-y-1">
                                            <p className="text-xs text-muted-foreground uppercase font-semibold tracking-wider">{m.label}</p>
                                            <p className={`text-2xl font-bold ${isRisky ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {pct(m.percent)}%
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                KES {fmt(m.amount)}
                                            </p>
                                            <div className="h-1 w-full bg-border rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${isRisky ? 'bg-rose-400' : 'bg-emerald-400'}`}
                                                    style={{ width: `${Math.min(pctVal * 2, 100)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Product Breakdown Table */}
                        <div className="lg:col-span-2">
                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <div className="p-4 border-b border-border bg-white/5">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product Performance</h3>
                                </div>

                                {(data.products ?? []).length === 0 ? (
                                    <div className="p-8 text-center text-muted-foreground text-sm">No active loan products found.</div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-white/5 border-b border-border text-xs">
                                                    <th className="p-4 uppercase text-muted-foreground font-semibold">Product Name</th>
                                                    <th className="p-4 uppercase text-muted-foreground font-semibold text-center">Active Loans</th>
                                                    <th className="p-4 uppercase text-muted-foreground font-semibold text-right">Outstanding Balance</th>
                                                    <th className="p-4 uppercase text-muted-foreground font-semibold text-right">Portfolio Share</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {(data.products ?? []).map((p: any, idx: number) => {
                                                    const bal = parseFloat(p.outstanding_balance ?? 0);
                                                    const share = totalPortfolio > 0 ? (bal / totalPortfolio) * 100 : 0;
                                                    return (
                                                        <tr key={idx} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                                                            <td className="p-4 text-foreground font-medium">{p.name}</td>
                                                            <td className="p-4 text-center">{p.active_loans ?? 0}</td>
                                                            <td className="p-4 text-right font-bold">KES {fmt(bal)}</td>
                                                            <td className="p-4 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                                                                    <div className="h-1.5 w-16 bg-border rounded-full overflow-hidden">
                                                                        <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(share, 100)}%` }} />
                                                                    </div>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Insight Cards */}
                        <div className="space-y-4">
                            <div className="glass rounded-xl p-6 border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-emerald-500/10">
                                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <h3 className="font-bold text-foreground">Portfolio Health</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Your portfolio is currently in a <strong>{(data.risk_level ?? '').toLowerCase()}</strong> risk state.{' '}
                                    {parseFloat(par.par_30_plus_percent ?? 0) < 5
                                        ? 'Collection efforts are highly effective. Keep maintaining current credit standards.'
                                        : 'We recommend reviewing your collection strategy for loans 30+ days overdue.'}
                                </p>
                            </div>

                            <div className="glass rounded-xl p-6 border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Target className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-foreground">Strategic Insights</h3>
                                </div>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <TrendingUp className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            Top Product: <strong>{topProduct?.name ?? 'N/A'}</strong> with KES {fmt(topProduct?.outstanding_balance ?? 0)} outstanding.
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <AlertTriangle className="h-4 w-4 text-orange-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            {parseFloat(par.par_30_plus_amount ?? 0) > 0
                                                ? `KES ${fmt(par.par_30_plus_amount)} is at immediate risk (30+ days overdue).`
                                                : 'Zero immediate risk in the 30+ day bucket. '}
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <TrendingDown className="h-4 w-4 text-rose-400 mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            {parseFloat(par.par_90_plus_amount ?? 0) > 0
                                                ? `KES ${fmt(par.par_90_plus_amount)} is severely overdue (90+ days) and may need write-off review.`
                                                : 'No loans in critical 90+ days bucket.'}
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <ArrowUpRight className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            PAR 1+ rate: <strong>{pct(par.par_1_plus_percent)}%</strong> of portfolio has any arrears.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
