'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, User, Phone, CreditCard, ShieldCheck, Building2 } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface Borrower {
    id: string;
    borrower_number: string;
    borrower_type: 'individual' | 'company' | 'institution' | 'group';
    first_name?: string;
    last_name?: string;
    business_name?: string;
    phone_number: string;
    id_number: string;
    hybrid_score: number;
    is_verified: boolean;
    created_at: string;
}

export default function BorrowersPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        borrower_type: '',
        is_verified: ''
    });

    const fetchBorrowers = async () => {
        try {
            setIsLoading(true);
            const params: any = {};
            if (searchQuery) params.search = searchQuery;
            if (filters.borrower_type) params.borrower_type = filters.borrower_type;
            if (filters.is_verified) params.is_verified = filters.is_verified;

            const response = await api.get('/customers/borrowers/', { params });
            const data = response?.data;
            if (data) {
                const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                setBorrowers(results);
            }
        } catch (error) {
            console.error('Failed to fetch borrowers:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBorrowers();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery, filters]);

    const getBorrowerName = (borrower: Borrower) => {
        if (borrower.borrower_type === 'company' || borrower.borrower_type === 'institution') {
            return borrower.business_name || 'N/A';
        }
        return `${borrower.first_name} ${borrower.last_name}`;
    };

    const columns = [
        {
            header: 'Borrower',
            accessor: (borrower: Borrower) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {borrower.borrower_type === 'individual' ? (
                            <span>{borrower.first_name?.[0]}{borrower.last_name?.[0]}</span>
                        ) : (
                            <Building2 className="h-4 w-4" />
                        )}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{getBorrowerName(borrower)}</p>
                        <p className="text-xs text-muted-foreground">{borrower.borrower_number} • {borrower.id_number}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Type',
            accessor: (borrower: Borrower) => (
                <span className="capitalize text-xs text-muted-foreground bg-secondary px-2 py-1 rounded-md">
                    {borrower.borrower_type}
                </span>
            ),
        },
        {
            header: 'Phone Number',
            accessor: (borrower: Borrower) => (
                <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    <span>{borrower.phone_number}</span>
                </div>
            ),
        },
        {
            header: 'Credit Score',
            accessor: (borrower: Borrower) => (
                <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${borrower.hybrid_score > 700 ? 'bg-emerald-500' :
                        borrower.hybrid_score > 500 ? 'bg-amber-500' : 'bg-red-500'
                        }`} />
                    <span className="font-medium">{borrower.hybrid_score}</span>
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: (borrower: Borrower) => (
                borrower.is_verified ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        <ShieldCheck className="h-3.5 w-3.5" />
                        Verified
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground bg-slate-500/10 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        Pending
                    </div>
                )
            ),
        },
        {
            header: 'Registered',
            accessor: (borrower: Borrower) => new Date(borrower.created_at).toLocaleDateString(),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Borrowers</h1>
                    <p className="text-muted-foreground mt-2">Manage your borrower directory and credit profiles</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={borrowers}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(borrower) => router.push(`/borrowers/${borrower.id}`)}
                onExport={() => {
                    const headers = ['Number', 'Name', 'Type', 'Phone', 'ID Number', 'Score', 'Status'];
                    const rows = borrowers.map(b => [
                        b.borrower_number,
                        getBorrowerName(b),
                        b.borrower_type,
                        b.phone_number,
                        b.id_number,
                        b.hybrid_score,
                        b.is_verified ? 'Verified' : 'Pending'
                    ]);
                    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                    const link = document.createElement("a");
                    const url = URL.createObjectURL(blob);
                    link.setAttribute("href", url);
                    link.setAttribute("download", `borrowers_export_${new Date().toISOString().split('T')[0]}.csv`);
                    link.style.visibility = 'hidden';
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                }}
                actionButton={(user?.is_superuser || user?.permissions?.includes('customers.add_borrower')) ? {
                    label: 'New Borrower',
                    icon: Plus,
                    onClick: () => router.push('/borrowers/new'),
                } : undefined}
                filterContent={
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Borrower Type</label>
                            <select
                                value={filters.borrower_type}
                                onChange={(e) => setFilters(prev => ({ ...prev, borrower_type: e.target.value }))}
                                className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                            >
                                <option value="">All Types</option>
                                <option value="individual">Individual</option>
                                <option value="company">Company</option>
                                <option value="institution">Institution</option>
                                <option value="group">Group</option>
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Verification Status</label>
                            <select
                                value={filters.is_verified}
                                onChange={(e) => setFilters(prev => ({ ...prev, is_verified: e.target.value }))}
                                className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                            >
                                <option value="">All Statuses</option>
                                <option value="true">Verified Only</option>
                                <option value="false">Pending Only</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ borrower_type: '', is_verified: '' })}
                                className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg transition-all uppercase tracking-widest border border-border"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                }
            />
        </div>
    );
}
