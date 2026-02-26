'use client';

import { useEffect, useState } from 'react';
import {
    Users,
    Wallet,
    TrendingUp,
    AlertCircle,
    Building2,
    ArrowUpRight,
    ArrowDownRight,
    Search
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import DataTable from '@/components/ui/DataTable';

interface Stats {
    total_loans: number;
    active_loans: number;
    disbursed_this_month: number;
    collections_this_month: number;
    par_30: number;
    total_borrowers: number;
}

export default function BranchDashboard() {
    const { user } = useAuthStore();
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentLoans, setRecentLoans] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBranchData = async () => {
            try {
                setIsLoading(true);
                // These endpoints will be filtered by BranchScopingFilterBackend on the backend
                const [statsRes, loansRes] = await Promise.all([
                    api.get('/loans/dashboard-summary/'),
                    api.get('/loans/?limit=5&ordering=-created_at')
                ]);

                setStats(statsRes.data);
                setRecentLoans(loansRes.data.results || []);
            } catch (error) {
                console.error('Failed to fetch branch dashboard data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchBranchData();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);
    };

    const statCards = [
        {
            label: 'Total Borrowers',
            value: stats?.total_borrowers || 0,
            icon: Users,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10'
        },
        {
            label: 'Active Portfolio',
            value: formatCurrency(stats?.active_loans || 0),
            icon: Wallet,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10'
        },
        {
            label: 'MTD Collections',
            value: formatCurrency(stats?.collections_this_month || 0),
            icon: TrendingUp,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10'
        },
        {
            label: 'PAR (>30 Days)',
            value: `${stats?.par_30 || 0}%`,
            icon: AlertCircle,
            color: 'text-red-500',
            bg: 'bg-red-500/10'
        }
    ];

    const columns = [
        {
            header: 'Loan #',
            accessor: 'loan_number',
        },
        {
            header: 'Borrower',
            accessor: (loan: any) => loan.borrower_name,
        },
        {
            header: 'Amount',
            accessor: (loan: any) => formatCurrency(loan.principal_amount),
        },
        {
            header: 'Status',
            accessor: (loan: any) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${loan.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-500/10 text-slate-400'
                    }`}>
                    {loan.status}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">
                        Branch Overview: <span className="text-primary">{user?.branch?.name || 'Assigned Branch'}</span>
                    </h1>
                    <p className="text-muted-foreground mt-2">Real-time performance metrics for your branch portfolio</p>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest bg-muted px-3 py-1.5 rounded-lg border border-border">
                        Manager: {user?.first_name} {user?.last_name}
                    </span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {statCards.map((stat, i) => (
                    <div key={i} className="glass rounded-2xl p-6 border border-border hover:border-primary/50 transition-all group">
                        <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`h-6 w-6 ${stat.color}`} />
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm text-muted-foreground">{stat.label}</p>
                        <h3 className="text-2xl font-bold text-foreground mt-1 tracking-tight">{stat.value}</h3>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Recent Activity */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-foreground font-heading">Recent Branch Loans</h2>
                        <button className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">View All</button>
                    </div>
                    <div className="glass rounded-2xl border border-border overflow-hidden">
                        <DataTable
                            columns={columns}
                            data={recentLoans}
                            isLoading={isLoading}
                        />
                    </div>
                </div>

                {/* Team / Announcements */}
                <div className="space-y-6">
                    <h2 className="text-xl font-bold text-foreground font-heading">Branch Team</h2>
                    <div className="glass rounded-2xl p-6 border border-border space-y-6">
                        <div className="space-y-4">
                            {/* This would ideally fetch from a branch staff endpoint */}
                            <p className="text-sm text-muted-foreground italic">Branch-specific team management coming soon.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
