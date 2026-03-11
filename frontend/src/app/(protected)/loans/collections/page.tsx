'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, PhoneCall, MessageSquare, Users, Calendar, TrendingDown } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';
import Link from 'next/link';
import LogInteractionModal from '@/components/collections/LogInteractionModal';
import PromiseToPayModal from '@/components/collections/PromiseToPayModal';
import ForecastBreakdownModal from '@/components/collections/ForecastBreakdownModal';

interface CollectionCase {
    id: string;
    loan: string;
    loan_number: string;
    days_overdue: number;
    overdue_amount: string | number;
    priority: string;
    assigned_to?: string;
    assigned_to_name?: string;
    next_follow_up: string;
    borrower_name?: string;
}

interface AgingReport {
    buckets: {
        [key: string]: {
            count: number;
            amount: number;
        };
    };
}

interface ParMetrics {
    par_1_plus_percent: number;
    par_1_plus_amount: number;
    par_30_plus_percent: number;
    par_30_plus_amount: number;
    par_90_plus_percent: number;
    par_90_plus_amount: number;
}

interface ForecastItem {
    month: string;
    expected: number;
    actual: number;
    rate: number;
}

export default function CollectionsPage() {
    const router = useRouter();
    const [cases, setCases] = useState<CollectionCase[]>([]);
    const [agingReport, setAgingReport] = useState<AgingReport | null>(null);
    const [parMetrics, setParMetrics] = useState<ParMetrics | null>(null);
    const [forecast, setForecast] = useState<ForecastItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [priorityFilter, setPriorityFilter] = useState('all');

    // Modal states
    const [showLogInteraction, setShowLogInteraction] = useState(false);
    const [showPromiseToPay, setShowPromiseToPay] = useState(false);
    const [showForecastBreakdown, setShowForecastBreakdown] = useState(false);
    const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
    const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCollectionData();
        }, 500);
        return () => clearTimeout(timer);
    }, [priorityFilter, searchTerm]);

    const fetchCollectionData = async () => {
        setIsLoading(true);
        setError(null); // Clear previous errors
        try {
            const params: any = {};
            if (priorityFilter !== 'all') params.priority = priorityFilter;
            if (searchTerm) params.search = searchTerm;

            const [casesRes, reportsRes] = await Promise.all([
                api.get('/loans/collection-cases/', { params }),
                api.get('/loans/arrears_reports/')
            ]);
            setCases(Array.isArray(casesRes.data.results) ? casesRes.data.results : (Array.isArray(casesRes.data) ? casesRes.data : []));
            setAgingReport(reportsRes.data.aging);
            setParMetrics(reportsRes.data.par);
            setForecast(reportsRes.data.forecast || []);

            if (process.env.NODE_ENV === 'development') {
                console.log('Fetched collections data:', {
                    cases_raw: casesRes.data,
                    aging: reportsRes.data.aging
                });
            }
        } catch (error: any) {
            console.error('Failed to fetch collection data:', error);
            setError(error.response?.data?.detail || error.message || 'Failed to load collection data');
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        {
            accessor: (c: any) => (
                <Link href={`/loans/${c.loan}`} className="text-primary hover:underline font-medium">
                    {c.loan_number}
                </Link>
            ),
            header: 'Loan #'
        },
        {
            accessor: (c: any) => (
                <div>
                    <p className="font-medium text-foreground">{c.borrower_name || 'N/A'}</p>
                </div>
            ),
            header: 'Borrower'
        },
        {
            accessor: (c: any) => {
                const days = c.days_overdue || 0;
                const color = days > 90 ? 'text-red-400' : days > 60 ? 'text-orange-400' : 'text-yellow-400';
                return <span className={`font-bold ${color}`}>{days} days</span>;
            },
            header: 'Days Overdue'
        },
        {
            accessor: (c: any) => (
                <span className="font-semibold text-red-400">
                    KES {Number(c.overdue_amount).toLocaleString()}
                </span>
            ),
            header: 'Amount Overdue'
        },
        {
            accessor: (c: any) => {
                const priorityColors: any = {
                    critical: 'bg-red-500/10 text-red-400 border-red-500/20',
                    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
                    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
                    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                };
                return (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[c.priority]}`}>
                        {c.priority?.toUpperCase()}
                    </span>
                );
            },
            header: 'Priority'
        },
        {
            accessor: (c: any) => (
                <span className="text-sm text-muted-foreground">
                    {c.assigned_to_name || 'Unassigned'}
                </span>
            ),
            header: 'Assigned To'
        },
        {
            accessor: (c: any) => (
                <span className="text-sm text-foreground">
                    {c.next_follow_up ? new Date(c.next_follow_up).toLocaleDateString() : 'Not scheduled'}
                </span>
            ),
            header: 'Next Follow-up'
        },
        {
            accessor: (c: any) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCaseId(c.id);
                            setShowLogInteraction(true);
                        }}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Log Interaction"
                    >
                        <PhoneCall className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCaseId(c.id);
                            setShowPromiseToPay(true);
                        }}
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                        title="Record Promise to Pay"
                    >
                        <MessageSquare className="h-4 w-4" />
                    </button>
                </div>
            ),
            header: 'Actions'
        }
    ];

    const filteredCases = cases;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <AlertCircle className="h-8 w-8 text-orange-400" />
                        Collections & Arrears
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage overdue loans and recovery activities</p>
                </div>
            </div>

            {/* PAR Metrics */}
            {parMetrics && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    <div className="glass group relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-yellow-500/10">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <TrendingDown className="h-24 w-24 text-yellow-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 rounded-2xl bg-yellow-500/10 border border-yellow-500/20">
                                    <TrendingDown className="h-5 w-5 text-yellow-400" />
                                </div>
                                <span className="text-[10px] font-bold text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Low Risk</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">PAR 1+</p>
                            <h3 className="text-3xl font-black text-foreground tracking-tight italic">
                                {parMetrics.par_1_plus_percent?.toFixed(2) || 0}<span className="text-lg ml-0.5 text-yellow-400/50">%</span>
                            </h3>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-yellow-500 to-yellow-300 rounded-full"
                                        style={{ width: `${Math.min(parMetrics.par_1_plus_percent || 0, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs font-bold text-foreground/70">
                                    {Number(parMetrics.par_1_plus_amount || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">KES</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-orange-500/10">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <TrendingDown className="h-24 w-24 text-orange-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/20">
                                    <TrendingDown className="h-5 w-5 text-orange-400" />
                                </div>
                                <span className="text-[10px] font-bold text-orange-500 bg-orange-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Medium Risk</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">PAR 30+</p>
                            <h3 className="text-3xl font-black text-foreground tracking-tight italic">
                                {parMetrics.par_30_plus_percent?.toFixed(2) || 0}<span className="text-lg ml-0.5 text-orange-400/50">%</span>
                            </h3>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-500 to-orange-300 rounded-full"
                                        style={{ width: `${Math.min(parMetrics.par_30_plus_percent || 0, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs font-bold text-foreground/70">
                                    {Number(parMetrics.par_30_plus_amount || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">KES</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-red-500/10">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <TrendingDown className="h-24 w-24 text-red-500" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 rounded-2xl bg-red-500/10 border border-red-500/20">
                                    <TrendingDown className="h-5 w-5 text-red-400" />
                                </div>
                                <span className="text-[10px] font-bold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full uppercase tracking-wider">High Risk</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">PAR 90+</p>
                            <h3 className="text-3xl font-black text-foreground tracking-tight italic">
                                {parMetrics.par_90_plus_percent?.toFixed(2) || 0}<span className="text-lg ml-0.5 text-red-400/50">%</span>
                            </h3>
                            <div className="mt-4 flex items-center gap-2">
                                <div className="h-1.5 flex-1 bg-white/5 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full"
                                        style={{ width: `${Math.min(parMetrics.par_90_plus_percent || 0, 100)}%` }}
                                    />
                                </div>
                                <p className="text-xs font-bold text-foreground/70">
                                    {Number(parMetrics.par_90_plus_amount || 0).toLocaleString()} <span className="text-[10px] text-muted-foreground font-medium">KES</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-3xl p-6 border border-white/10 shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-primary/10">
                        <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <Users className="h-24 w-24 text-primary" />
                        </div>
                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-4">
                                <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                                    <Users className="h-5 w-5 text-primary" />
                                </div>
                                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Operations</span>
                            </div>
                            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Active Cases</p>
                            <h3 className="text-3xl font-black text-foreground tracking-tight italic">
                                {cases.length}<span className="text-lg ml-1.5 text-primary/50 font-heading">Cases</span>
                            </h3>
                            <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-3">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter italic">Total recovery pipeline</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Collections Forecast */}
            {forecast.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                                <Calendar className="h-4 w-4 text-primary" />
                            </div>
                            Collections Roadmap
                        </h2>
                        <div className="flex gap-2">
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[10px] font-bold text-muted-foreground">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50" />
                                HIGH PERFORMANCE
                            </div>
                        </div>
                    </div>
                    <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-6 px-6 mask-linear-right">
                        {forecast.map((item, index) => (
                            <div
                                key={index}
                                className="glass-card min-w-[240px] rounded-2xl p-4 border border-white/5 shadow-lg hover:border-primary/40 hover:bg-white/[0.04] transition-all cursor-pointer group flex flex-col justify-between"
                                onClick={() => {
                                    setSelectedMonth(item.month);
                                    setShowForecastBreakdown(true);
                                }}
                            >
                                <div>
                                    <div className="flex justify-between items-start mb-4">
                                        <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                                            {item.month}
                                        </p>
                                        <div className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase ${item.rate > 90 ? 'bg-emerald-500/10 text-emerald-400' :
                                            item.rate > 70 ? 'bg-yellow-500/10 text-yellow-400' :
                                                'bg-red-500/10 text-red-400'
                                            }`}>
                                            {item.rate.toFixed(0)}% Eff.
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="space-y-0.5">
                                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Projected</p>
                                                <p className="text-sm font-black text-foreground tracking-tighter italic">
                                                    KES {item.expected.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="space-y-0.5 text-right">
                                                <p className="text-[9px] text-muted-foreground font-bold uppercase tracking-tight">Collected</p>
                                                <p className="text-sm font-black text-emerald-400 tracking-tighter italic">
                                                    KES {item.actual.toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="relative h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 ease-out group-hover:scale-x-[1.02] origin-left ${item.rate > 90 ? 'bg-emerald-500' : item.rate > 70 ? 'bg-yellow-500' : 'bg-red-500'
                                                    }`}
                                                style={{ width: `${Math.min(item.rate, 100)}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Arrears Aging Buckets */}
            {agingReport && (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="glass group relative overflow-hidden rounded-2xl p-5 border-l-4 border-yellow-500 transition-all hover:bg-yellow-500/5 cursor-default shadow-xl">
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                            <AlertCircle className="h-16 w-16 text-yellow-500" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Early Arrears (1-30)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-foreground italic">
                                {agingReport.buckets?.['1-30']?.count || 0}
                            </p>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Loans</span>
                        </div>
                        <p className="text-sm font-bold text-yellow-400 mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-yellow-500/50">KES</span>
                            {Number(agingReport.buckets?.['1-30']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-2xl p-5 border-l-4 border-orange-500 transition-all hover:bg-orange-500/5 cursor-default shadow-xl">
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                            <AlertCircle className="h-16 w-16 text-orange-500" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Mild Delinquent (31-60)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-foreground italic">
                                {agingReport.buckets?.['31-60']?.count || 0}
                            </p>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Loans</span>
                        </div>
                        <p className="text-sm font-bold text-orange-400 mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-orange-500/50">KES</span>
                            {Number(agingReport.buckets?.['31-60']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-2xl p-5 border-l-4 border-red-500 transition-all hover:bg-red-500/5 cursor-default shadow-xl">
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                            <AlertCircle className="h-16 w-16 text-red-500" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">High Risk (61-90)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-foreground italic">
                                {agingReport.buckets?.['61-90']?.count || 0}
                            </p>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Loans</span>
                        </div>
                        <p className="text-sm font-bold text-red-400 mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-red-500/50">KES</span>
                            {Number(agingReport.buckets?.['61-90']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass group relative overflow-hidden rounded-2xl p-5 border-l-4 border-red-600 transition-all hover:bg-red-600/5 cursor-default shadow-xl">
                        <div className="absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity">
                            <AlertCircle className="h-16 w-16 text-red-600" />
                        </div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-3">Default Warning (90+)</p>
                        <div className="flex items-baseline gap-2">
                            <p className="text-2xl font-black text-foreground italic">
                                {agingReport.buckets?.['90+']?.count || 0}
                            </p>
                            <span className="text-[10px] font-bold text-muted-foreground uppercase">Loans</span>
                        </div>
                        <p className="text-sm font-bold text-red-600 mt-2 flex items-center gap-1.5">
                            <span className="text-[10px] text-red-600/50">KES</span>
                            {Number(agingReport.buckets?.['90+']?.amount || 0).toLocaleString()}
                        </p>
                    </div>
                </div>
            )}

            {/* Priority Filters */}
            <div className="flex gap-2">
                {['all', 'critical', 'high', 'medium', 'low'].map((priority) => (
                    <button
                        key={priority}
                        onClick={() => setPriorityFilter(priority)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${priorityFilter === priority
                            ? 'bg-primary text-white shadow-lg shadow-primary/20'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                    </button>
                ))}
            </div>

            {/* Collection Cases Table */}
            <div className="glass rounded-2xl border border-border overflow-hidden shadow-xl">
                <DataTable
                    columns={columns}
                    data={filteredCases}
                    isLoading={isLoading}
                    onSearch={setSearchTerm}
                    onRowClick={(c: any) => {
                        const caseId = c.id || c.pk;
                        if (!caseId) {
                            console.error('Case ID missing in row click:', c);
                            return;
                        }
                        router.push(`/loans/collections/${caseId}`);
                    }}
                    onExport={() => {
                        const headers = ['Loan #', 'Borrower', 'Days Overdue', 'Amount Overdue', 'Priority', 'Assigned To'];
                        const rows = cases.map(c => [
                            c.loan_number,
                            c.borrower_name || 'N/A',
                            c.days_overdue,
                            c.overdue_amount,
                            c.priority,
                            c.assigned_to_name || 'Unassigned'
                        ]);
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `collections_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                />
            </div>

            {/* Modals */}
            {selectedCaseId && (
                <>
                    <LogInteractionModal
                        isOpen={showLogInteraction}
                        onClose={() => {
                            setShowLogInteraction(false);
                            setSelectedCaseId(null);
                        }}
                        caseId={selectedCaseId}
                        onSuccess={fetchCollectionData}
                    />
                    <PromiseToPayModal
                        isOpen={showPromiseToPay}
                        onClose={() => {
                            setShowPromiseToPay(false);
                            setSelectedCaseId(null);
                        }}
                        caseId={selectedCaseId}
                        onSuccess={fetchCollectionData}
                    />
                </>
            )}

            {selectedMonth && (
                <ForecastBreakdownModal
                    isOpen={showForecastBreakdown}
                    onClose={() => {
                        setShowForecastBreakdown(false);
                        setSelectedMonth(null);
                    }}
                    month={selectedMonth}
                />
            )}
        </div>
    );
}
