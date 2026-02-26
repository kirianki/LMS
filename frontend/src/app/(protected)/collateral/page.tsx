'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    Plus,
    ShieldCheck,
    Car,
    Home,
    Briefcase,
    Layers,
    Search,
    TrendingUp,
    Clock,
    CheckCircle2,
    Users
} from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Collateral {
    id: string;
    collateral_type: string;
    status: string;
    market_value: number;
    forced_sale_value: number;
    valuation_date: string;
    borrower_name: string; // Updated to match serializer
    reg_number?: string;
    lr_number?: string;
}

export default function CollateralPage() {
    const router = useRouter();
    const [collaterals, setCollaterals] = useState<Collateral[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_value: 0,
        pending_valuations: 0,
        pledged_count: 0
    });

    const fetchCollaterals = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/collateral/collateral/${query ? `?search=${query}` : ''}`);
            const data = response?.data;
            const processedData = Array.isArray(data) ? data : data?.results || [];
            setCollaterals(processedData);

            // Calculate Stats
            const totalValue = processedData.reduce((sum: number, c: Collateral) => sum + parseFloat(c.market_value.toString()), 0);
            const pending = processedData.filter((c: Collateral) => c.status === 'available').length;
            const pledged = processedData.filter((c: Collateral) => c.status === 'pledged').length;

            setStats({
                total_value: totalValue,
                pending_valuations: pending,
                pledged_count: pledged
            });
        } catch (error) {
            console.error('Failed to fetch collateral:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchCollaterals(searchQuery);
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

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'motor_vehicle': return <Car className="h-4 w-4" />;
            case 'land_property': return <Home className="h-4 w-4" />;
            case 'business_asset': return <Briefcase className="h-4 w-4" />;
            default: return <Layers className="h-4 w-4" />;
        }
    };

    const columns = [
        {
            header: 'Collateral Asset',
            accessor: (c: Collateral) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {getTypeIcon(c.collateral_type)}
                    </div>
                    <div>
                        <p className="font-bold text-foreground capitalize">{c.collateral_type?.replace('_', ' ') || 'Other'}</p>
                        <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                            {c.reg_number || c.lr_number || c.id.substring(0, 8)}
                        </p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Owner',
            accessor: (c: Collateral) => (
                <div className="flex flex-col">
                    <span className="text-sm text-slate-200">{c.borrower_name || 'N/A'}</span>
                </div>
            ),
        },
        {
            header: 'Valuation (Market)',
            accessor: (c: Collateral) => (
                <div className="flex flex-col">
                    <span className="font-bold text-foreground">{formatCurrency(c.market_value)}</span>
                    <span className="text-[10px] text-muted-foreground">Value as of {new Date(c.valuation_date).toLocaleDateString()}</span>
                </div>
            ),
        },
        {
            header: 'FSV',
            accessor: (c: Collateral) => (
                <span className="text-muted-foreground font-medium">{formatCurrency(c.forced_sale_value)}</span>
            ),
        },
        {
            header: 'Status',
            accessor: (c: Collateral) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${c.status === 'pledged' ? 'bg-amber-500/10 text-amber-400' :
                    c.status === 'available' ? 'bg-emerald-500/10 text-emerald-400' :
                        'bg-slate-500/10 text-muted-foreground'
                    }`}>
                    {c.status}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Collateral Registry</h1>
                    <p className="text-muted-foreground mt-2">Track pledged assets and asset valuation status</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push('/collateral/valuers')}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors text-sm font-semibold"
                    >
                        <Users className="h-4 w-4" />
                        Manage Valuers
                    </button>
                    <button
                        onClick={() => router.push('/collateral/new')}
                        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Add Asset
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-12 w-12 text-primary" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Pledged Value</p>
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(stats.total_value)}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Secure Exposure
                    </div>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Clock className="h-12 w-12 text-amber-500" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Available Assets</p>
                    <p className="text-3xl font-bold text-foreground">{stats.pending_valuations}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground font-bold">
                        Ready for pledging
                    </div>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldCheck className="h-12 w-12 text-blue-400" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Pledged Count</p>
                    <p className="text-3xl font-bold text-foreground">{stats.pledged_count}</p>
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-blue-400 font-bold">
                        Active Securities
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={collaterals}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(c) => router.push(`/collateral/${c.id}`)}
                actionButton={{
                    label: 'Add Asset',
                    icon: Plus,
                    onClick: () => router.push('/collateral/new'),
                }}
            />
        </div>
    );
}
