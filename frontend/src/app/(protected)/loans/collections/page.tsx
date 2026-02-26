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
    loan?: {
        id: string;
        loan_number: string;
        borrower_name?: string;
        borrower_phone?: string;
    };
    days_overdue: number;
    overdue_amount: string | number;
    priority: string;
    assigned_to?: {
        first_name: string;
        last_name: string;
    };
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
        } catch (error) {
            console.error('Failed to fetch collection data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        {
            accessor: (c: any) => (
                <Link href={`/loans/${c.loan?.id}`} className="text-primary hover:underline font-medium">
                    {c.loan?.loan_number}
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
                    {c.assigned_to?.first_name && c.assigned_to?.last_name
                        ? `${c.assigned_to.first_name} ${c.assigned_to.last_name}`
                        : 'Unassigned'}
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">PAR 1+</p>
                            <TrendingDown className="h-5 w-5 text-yellow-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{parMetrics.par_1_plus_percent?.toFixed(2) || 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            KES {Number(parMetrics.par_1_plus_amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">PAR 30+</p>
                            <TrendingDown className="h-5 w-5 text-orange-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{parMetrics.par_30_plus_percent?.toFixed(2) || 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            KES {Number(parMetrics.par_30_plus_amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">PAR 90+</p>
                            <TrendingDown className="h-5 w-5 text-red-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{parMetrics.par_90_plus_percent?.toFixed(2) || 0}%</p>
                        <p className="text-xs text-muted-foreground mt-1">
                            KES {Number(parMetrics.par_90_plus_amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Cases</p>
                            <Users className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{cases.length}</p>
                    </div>
                </div>
            )}

            {/* Collections Forecast */}
            {forecast.length > 0 && (
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-foreground flex items-center gap-3">
                        <TrendingDown className="h-5 w-5 text-primary" />
                        Collections Forecast (Next 12 Months)
                    </h2>
                    <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-2 px-2 mask-linear-right">
                        {forecast.map((item, index) => (
                            <div
                                key={index}
                                className="glass min-w-[280px] rounded-xl p-5 border border-border shadow-lg hover:border-primary/50 transition-all cursor-pointer group active:scale-[0.98]"
                                onClick={() => {
                                    setSelectedMonth(item.month);
                                    setShowForecastBreakdown(true);
                                }}
                            >
                                <p className="text-xs font-bold text-primary uppercase tracking-wider mb-3 pb-2 border-b border-border group-hover:border-primary/20 transition-colors">
                                    {item.month}
                                </p>
                                <div className="space-y-3">
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Target</p>
                                            <p className="text-sm font-bold text-foreground">
                                                KES {item.expected.toLocaleString()}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-tighter">Actual</p>
                                            <p className="text-sm font-bold text-emerald-400">
                                                KES {item.actual.toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${item.rate > 90 ? 'bg-emerald-500' : item.rate > 70 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                            style={{ width: `${Math.min(item.rate, 100)}%` }}
                                        />
                                    </div>
                                    <div className="flex justify-between items-center text-[10px]">
                                        <span className="text-muted-foreground font-medium uppercase">Efficiency</span>
                                        <span className={`font-bold px-1.5 py-0.5 rounded transition-colors ${item.rate > 90 ? 'text-emerald-400 bg-emerald-500/10' :
                                            item.rate > 70 ? 'text-yellow-400 bg-yellow-500/10' :
                                                'text-red-400 bg-red-500/10'
                                            }`}>{item.rate.toFixed(1)}%</span>
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
                    <div className="glass rounded-xl p-5 border-l-4 border-yellow-500/50 hover:bg-yellow-500/5 transition-colors">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">1-30 Days</p>
                        <p className="text-xl font-bold text-foreground">
                            {agingReport.buckets?.['1-30']?.count || 0} loans
                        </p>
                        <p className="text-sm text-yellow-400 mt-1">
                            KES {Number(agingReport.buckets?.['1-30']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-xl p-5 border-l-4 border-orange-500/50 hover:bg-orange-500/5 transition-colors">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">31-60 Days</p>
                        <p className="text-xl font-bold text-foreground">
                            {agingReport.buckets?.['31-60']?.count || 0} loans
                        </p>
                        <p className="text-sm text-orange-400 mt-1">
                            KES {Number(agingReport.buckets?.['31-60']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-xl p-5 border-l-4 border-red-500/50 hover:bg-red-500/5 transition-colors">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">61-90 Days</p>
                        <p className="text-xl font-bold text-foreground">
                            {agingReport.buckets?.['61-90']?.count || 0} loans
                        </p>
                        <p className="text-sm text-red-400 mt-1">
                            KES {Number(agingReport.buckets?.['61-90']?.amount || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-xl p-5 border-l-4 border-red-600/50 hover:bg-red-600/5 transition-colors">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">90+ Days</p>
                        <p className="text-xl font-bold text-foreground">
                            {agingReport.buckets?.['90+']?.count || 0} loans
                        </p>
                        <p className="text-sm text-red-600 mt-1">
                            KES {Number(agingReport.buckets?.['90+']?.amount || 0).toLocaleString()}
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
                    onRowClick={(c: any) => router.push(`/loans/collections/${c.id}`)}
                    onExport={() => {
                        const headers = ['Loan #', 'Borrower', 'Days Overdue', 'Amount Overdue', 'Priority', 'Assigned To'];
                        const rows = cases.map(c => [
                            c.loan?.loan_number,
                            c.borrower_name || 'N/A',
                            c.days_overdue,
                            c.overdue_amount,
                            c.priority,
                            c.assigned_to ? `${c.assigned_to.first_name} ${c.assigned_to.last_name}` : 'Unassigned'
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
