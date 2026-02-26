'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Users, Coins, TrendingUp, Building2, Search } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Investor {
    id: string;
    investor_number: string;
    name: string;
    investor_type: string;
    email: string;
    phone: string;
    is_active: boolean;
    created_at: string;
}

export default function InvestorsPage() {
    const router = useRouter();
    const [investors, setInvestors] = useState<Investor[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_investors: 0,
        total_capital: 0,
    });

    const fetchInvestors = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/investors/investors/${query ? `?search=${query}` : ''}`);
            const data = response.data.results || response.data;
            setInvestors(data);

            // Calculate simple stats for now
            // In a real app, these would come from a dedicated stats endpoint
            setStats({
                total_investors: data.length,
                total_capital: 0, // This would need total from investments
            });
        } catch (error) {
            console.error('Failed to fetch investors:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchInvestors(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    const columns = [
        {
            header: 'Investor',
            accessor: (investor: Investor) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {investor.name[0]}
                    </div>
                    <div>
                        <p className="font-medium text-foreground">{investor.name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{investor.investor_number}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Type',
            accessor: (investor: Investor) => (
                <div className="flex items-center gap-2">
                    {investor.investor_type === 'individual' ? (
                        <Users className="h-4 w-4 text-emerald-400" />
                    ) : (
                        <Building2 className="h-4 w-4 text-blue-400" />
                    )}
                    <span className="capitalize">{investor.investor_type}</span>
                </div>
            ),
        },
        {
            header: 'Contact',
            accessor: (investor: Investor) => (
                <div className="text-xs">
                    <p className="text-slate-300">{investor.email}</p>
                    <p className="text-muted-foreground">{investor.phone}</p>
                </div>
            ),
        },
        {
            header: 'Joined',
            accessor: (investor: Investor) => new Date(investor.created_at).toLocaleDateString(),
        },
        {
            header: 'Status',
            accessor: (investor: Investor) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${investor.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-muted-foreground'
                    }`}>
                    {investor.is_active ? 'Active' : 'Inactive'}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Investors</h1>
                    <p className="text-muted-foreground mt-2">Manage capital providers and their portfolios</p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="h-12 w-12 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Investors</p>
                    <p className="text-3xl font-bold text-foreground">{stats.total_investors}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Coins className="h-12 w-12 text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Capital</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.total_capital)}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-12 w-2 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Yield (Avg)</p>
                    <p className="text-3xl font-bold text-foreground">0.0%</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={investors}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(investor) => router.push(`/investors/${investor.id}`)}
                actionButton={{
                    label: 'New Investor',
                    icon: Plus,
                    onClick: () => router.push('/investors/new'),
                }}
            />
        </div>
    );
}
