'use client';

import { useState, useEffect } from 'react';
import { Wallet, Plus, Search, Filter, TrendingUp, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import Link from 'next/link';
import api from '@/lib/api';
import NewApplicationModal from '@/components/loans/NewApplicationModal';

import { useAuthStore } from '@/store/useAuthStore';

interface Loan {
    id: string;
    loan_number: string;
    borrower_name?: string;
    borrower_id_number?: string;
    product_name?: string;
    product?: {
        name: string;
    } | string;
    principal_amount: string | number;
    outstanding_balance: string | number;
    status: string;
    days_in_arrears: number;
}

interface LoanStats {
    portfolio_value: number;
    active_loans_count: number;
    par_percentage: number;
    disbursements_today: number;
    disbursements_count: number;
}

export default function LoansPage() {
    const { user } = useAuthStore();
    const [loans, setLoans] = useState<Loan[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [stats, setStats] = useState<LoanStats | null>(null);
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [showNewModal, setShowNewModal] = useState(false);

    const [filters, setFilters] = useState({
        product: '',
        arrears_category: ''
    });
    const [products, setProducts] = useState<any[]>([]);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/loans/products/');
            setProducts(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchLoans();
            fetchStats();
        }, 500);
        return () => clearTimeout(timer);
    }, [statusFilter, searchTerm, filters]);

    const fetchLoans = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (statusFilter !== 'all') params.status = statusFilter;
            if (searchTerm) params.search = searchTerm;
            if (filters.product) params.product = filters.product;
            if (filters.arrears_category) params.arrears_category = filters.arrears_category;

            const response = await api.get('/loans/loans/', { params });
            const data = response?.data;
            if (data) {
                const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                setLoans(results);
            }
        } catch (error) {
            console.error('Failed to fetch loans:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchStats = async () => {
        try {
            const response = await api.get('/loans/dashboard_summary/');
            setStats(response.data);
        } catch (error) {
            console.error('Failed to fetch stats:', error);
        }
    };

    const columns = [
        {
            accessor: (loan: any) => (
                <Link href={`/loans/${loan.id}`} className="text-primary hover:underline font-medium">
                    {loan.loan_number}
                </Link>
            ),
            header: 'Loan #'
        },
        {
            accessor: (loan: any) => (
                <div>
                    <p className="font-medium text-foreground">{loan.borrower_name || 'N/A'}</p>
                </div>
            ),
            header: 'Borrower'
        },
        {
            accessor: (loan: any) => <span className="text-sm">{loan.product_name || 'N/A'}</span>,
            header: 'Product'
        },
        {
            accessor: (loan: any) => (
                <span className="font-semibold text-foreground">
                    KES {Number(loan.principal_amount).toLocaleString()}
                </span>
            ),
            header: 'Principal'
        },
        {
            accessor: (loan: any) => (
                <span className="font-medium text-foreground">
                    KES {Number(loan.outstanding_balance).toLocaleString()}
                </span>
            ),
            header: 'Outstanding'
        },
        {
            accessor: (loan: any) => {
                const statusColors: any = {
                    active: 'bg-green-500/10 text-green-400 border-green-500/20',
                    paid_off: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
                    written_off: 'bg-red-500/10 text-red-400 border-red-500/20',
                    defaulted: 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                };
                return (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[loan.status] || 'bg-muted text-muted-foreground'}`}>
                        {loan.status?.replace('_', ' ').toUpperCase()}
                    </span>
                );
            },
            header: 'Status'
        },
        {
            accessor: (loan: any) => {
                const dpd = loan.days_in_arrears || 0;
                if (dpd === 0) return <span className="text-muted-foreground text-sm">Current</span>;
                const color = dpd > 90 ? 'text-red-400' : dpd > 30 ? 'text-orange-400' : 'text-yellow-400';
                return <span className={`font-semibold ${color}`}>{dpd} days</span>;
            },
            header: 'DPD'
        },
        {
            accessor: (loan: any) => (
                <div className="flex items-center gap-2">
                    <Link
                        href={`/loans/${loan.id}`}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                        View
                    </Link>
                </div>
            ),
            header: 'Actions'
        }
    ];

    const filteredLoans = loans;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <Wallet className="h-8 w-8 text-primary" />
                        Loan Portfolio
                    </h1>
                    <p className="text-muted-foreground mt-1">Track and manage all active and historical loans</p>
                </div>
                {(user?.is_superuser || user?.permissions?.includes('loans.add_loanapplication')) && (
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                    >
                        <Plus className="h-5 w-5" />
                        New Application
                    </button>
                )}
            </div>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Portfolio Value</p>
                            <TrendingUp className="h-5 w-5 text-green-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            KES {Number(stats.portfolio_value || 0).toLocaleString()}
                        </p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Active Loans</p>
                            <CheckCircle2 className="h-5 w-5 text-blue-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.active_loans_count || 0}</p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">PAR 30+</p>
                            <AlertCircle className="h-5 w-5 text-orange-400" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">{stats.par_percentage?.toFixed(2) || 0}%</p>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Today's Disbursements</p>
                            <XCircle className="h-5 w-5 text-primary" />
                        </div>
                        <p className="text-2xl font-bold text-foreground">
                            KES {Number(stats.disbursements_today || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">{stats.disbursements_count || 0} loans</p>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by loan number or customer..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-input border border-border rounded-xl py-2.5 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>

                <div className="flex gap-2">
                    {['all', 'active', 'paid_off', 'defaulted'].map((status) => (
                        <button
                            key={status}
                            onClick={() => setStatusFilter(status)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${statusFilter === status
                                ? 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                        >
                            {status.replace('_', ' ').toUpperCase()}
                        </button>
                    ))}
                </div>
            </div>

            {/* Loans Table */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
                <DataTable
                    columns={columns}
                    data={filteredLoans}
                    isLoading={isLoading}
                    onSearch={setSearchTerm}
                    onExport={() => {
                        const headers = ['Loan #', 'Borrower', 'Product', 'Principal', 'Balance', 'Status', 'DPD'];
                        const rows = loans.map(loan => [
                            loan.loan_number,
                            loan.borrower_name || 'N/A',
                            loan.product_name || 'N/A',
                            loan.principal_amount,
                            loan.outstanding_balance,
                            loan.status,
                            loan.days_in_arrears || 0
                        ]);
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `loans_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    filterContent={
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loan Product</label>
                                <select
                                    value={filters.product}
                                    onChange={(e) => setFilters(prev => ({ ...prev, product: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                                >
                                    <option value="">All Products</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Arrears Category</label>
                                <select
                                    value={filters.arrears_category}
                                    onChange={(e) => setFilters(prev => ({ ...prev, arrears_category: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                                >
                                    <option value="">All Categories</option>
                                    <option value="performing">Performing</option>
                                    <option value="watch">Watch (1-30 days)</option>
                                    <option value="substandard">Substandard (31-90 days)</option>
                                    <option value="doubtful">Doubtful (91-180 days)</option>
                                    <option value="loss">Loss (&gt;180 days)</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => setFilters({ product: '', arrears_category: '' })}
                                    className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg transition-all uppercase tracking-widest border border-border"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    }
                />
            </div>

            <NewApplicationModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onSuccess={() => {
                    fetchLoans();
                    fetchStats();
                }}
            />
        </div>
    );
}
