'use client';

import { useState, useEffect } from 'react';
import {
    Activity,
    Download,
    ChevronLeft,
    AlertTriangle,
    ShieldCheck,
    BarChart3,
    ArrowUpRight,
    Target
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';

export default function PortfolioPerformance() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<any>(null);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const response = await api.get('/accounting/reports/portfolio_performance/');
            setData(response.data);
        } catch (error) {
            console.error('Error fetching portfolio performance:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async () => {
        try {
            const response = await api.get('/accounting/reports/portfolio_performance/', {
                params: {
                    export_type: 'pdf'
                },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Portfolio_Performance.pdf`);
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

    const getRiskColor = (risk: string) => {
        switch (risk.toLowerCase()) {
            case 'low': return 'text-emerald-400 bg-emerald-500/10';
            case 'moderate': return 'text-amber-400 bg-amber-500/10';
            case 'high': return 'text-rose-400 bg-rose-500/10';
            default: return 'text-muted-foreground bg-muted';
        }
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Portfolio Performance</h1>
                    <p className="text-muted-foreground">High-level risk assessment and product-specific performance metrics</p>
                </div>
                <button
                    onClick={handleExport}
                    className="ml-auto px-4 py-2 glass border border-border rounded-lg flex items-center gap-2 hover:bg-white/5 transition-colors"
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
                    {/* Risk Summary Header */}
                    <div className="glass rounded-2xl p-8 border border-border relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-10">
                            <Activity className="h-32 w-32" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                            <div className="space-y-4">
                                <span className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider ${getRiskColor(data.risk_level)}`}>
                                    Overall Risk: {data.risk_level}
                                </span>
                                <h2 className="text-4xl font-bold text-foreground">
                                    KES {parseFloat(data.par_metrics.total_portfolio).toLocaleString()}
                                </h2>
                                <p className="text-muted-foreground">Total Active Portfolio Outstanding</p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 border-l border-border/50 pl-0 md:pl-8">
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground uppercase font-semibold">PAR 30</p>
                                    <p className={`text-xl font-bold ${data.par_metrics.par30_percent > 10 ? 'text-rose-400' : 'text-emerald-400'}`}>
                                        {data.par_metrics.par30_percent.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">KES {parseFloat(data.par_metrics.par30_amount).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground uppercase font-semibold">PAR 60</p>
                                    <p className="text-xl font-bold text-foreground">
                                        {data.par_metrics.par60_percent.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">KES {parseFloat(data.par_metrics.par60_amount).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm text-muted-foreground uppercase font-semibold">PAR 90</p>
                                    <p className="text-xl font-bold text-foreground">
                                        {data.par_metrics.par90_percent.toFixed(2)}%
                                    </p>
                                    <p className="text-xs text-muted-foreground">KES {parseFloat(data.par_metrics.par90_amount).toLocaleString()}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Product Breakdown */}
                        <div className="lg:col-span-2 space-y-6">
                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Product Performance</h3>
                                </div>
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
                                            {data.products.map((p: any, idx: number) => {
                                                const share = (p.outstanding_balance / data.par_metrics.total_portfolio) * 100;
                                                return (
                                                    <tr key={idx} className="border-b border-border/50 hover:bg-white/5 transition-colors">
                                                        <td className="p-4 text-foreground font-medium">{p.name}</td>
                                                        <td className="p-4 text-center">{p.active_loans}</td>
                                                        <td className="p-4 text-right font-bold">
                                                            KES {parseFloat(p.outstanding_balance).toLocaleString()}
                                                        </td>
                                                        <td className="p-4 text-right">
                                                            <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
                                                                <span>{share.toFixed(1)}%</span>
                                                                <div className="h-1 w-12 bg-border rounded-full overflow-hidden">
                                                                    <div className="h-full bg-primary" style={{ width: `${share}%` }}></div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Risk Metrics Cards */}
                        <div className="space-y-6">
                            <div className="glass rounded-xl p-6 border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-emerald-500/10">
                                        <ShieldCheck className="h-5 w-5 text-emerald-400" />
                                    </div>
                                    <h3 className="font-bold text-foreground">Health Indicator</h3>
                                </div>
                                <p className="text-sm text-muted-foreground leading-relaxed">
                                    Your portfolio is currently in a <strong>{data.risk_level.toLowerCase()}</strong> risk state.
                                    {data.par_metrics.par30_percent < 5
                                        ? " Your collection efforts are highly effective. Keep maintaining current credit standards."
                                        : " We recommend reviewing your collection strategies for the 31-60 day bucket."}
                                </p>
                            </div>

                            <div className="glass rounded-xl p-6 border border-border">
                                <div className="flex items-center gap-3 mb-4">
                                    <div className="p-2 rounded-lg bg-primary/10">
                                        <Target className="h-5 w-5 text-primary" />
                                    </div>
                                    <h3 className="font-bold text-foreground">Strategic Insight</h3>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-4">
                                        <ArrowUpRight className="h-4 w-4 text-emerald-400 mt-1 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            Top Product: <strong>{data.products.length > 0 ? data.products.reduce((prev: any, current: any) => (prev.outstanding_balance > current.outstanding_balance) ? prev : current).name : 'No products available'}</strong>
                                        </p>
                                    </div>
                                    <div className="flex items-start gap-4">
                                        <AlertTriangle className="h-4 w-4 text-orange-400 mt-1 shrink-0" />
                                        <p className="text-xs text-muted-foreground">
                                            {data.par_metrics.par30_amount > 0
                                                ? `KES ${parseFloat(data.par_metrics.par30_amount).toLocaleString()} is at immediate risk (30+ days).`
                                                : "Zero immediate risk in the 30+ day bucket."}
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
