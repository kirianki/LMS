'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    Wallet,
    Coins,
    History,
    User,
    Mail,
    Phone,
    MapPin,
    Landmark,
    Plus,
    TrendingUp,
    ArrowUpRight,
    Building2,
    Calendar,
    ArrowRight
} from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Investment {
    id: string;
    investment_number: string;
    principal_amount: number;
    expected_return_rate: number;
    investment_date: string;
    maturity_date: string;
    status: string;
    status_display: string;
    total_paid_out: number;
}

interface Payout {
    id: string;
    payout_type_display: string;
    amount: number;
    payout_date: string;
    reference: string;
}

interface Investor {
    id: string;
    investor_number: string;
    name: string;
    investor_type: string;
    email: string;
    phone: string;
    address: string;
    id_number: string;
    kra_pin: string;
    bank_name: string;
    bank_account: string;
    is_active: boolean;
}

export default function InvestorProfilePage() {
    const params = useParams();
    const router = useRouter();
    const [investor, setInvestor] = useState<Investor | null>(null);
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('investments');

    useEffect(() => {
        const fetchInvestorData = async () => {
            try {
                const [investorRes, investmentsRes] = await Promise.all([
                    api.get(`/investors/investors/${params.id}/`),
                    api.get(`/investors/investments/?investor=${params.id}`),
                ]);
                setInvestor(investorRes.data);
                setInvestments(investmentsRes.data.results || investmentsRes.data);
            } catch (error) {
                console.error('Failed to fetch investor data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchInvestorData();
    }, [params.id]);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading profile...</div>;
    if (!investor) return <div className="p-8 text-center text-red-400">Investor not found</div>;

    const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.principal_amount.toString()), 0);
    const activeInvestments = investments.filter(inv => inv.status === 'active').length;

    const investmentColumns = [
        {
            header: 'Investment #',
            accessor: (inv: Investment) => (
                <span className="font-mono text-xs font-bold text-foreground">{inv.investment_number}</span>
            ),
        },
        {
            header: 'Principal',
            accessor: (inv: Investment) => (
                <span className="font-bold text-foreground">{formatCurrency(inv.principal_amount)}</span>
            ),
        },
        {
            header: 'Rate',
            accessor: (inv: Investment) => (
                <span className="text-emerald-400 text-xs font-bold">{inv.expected_return_rate}% APR</span>
            ),
        },
        {
            header: 'Maturity',
            accessor: (inv: Investment) => (
                <div className="text-xs">
                    <p className="text-foreground">{new Date(inv.maturity_date).toLocaleDateString()}</p>
                    <p className="text-muted-foreground text-[10px] uppercase">
                        {Math.ceil((new Date(inv.maturity_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days left
                    </p>
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: (inv: Investment) => (
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${inv.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-muted-foreground'
                    }`}>
                    {inv.status_display}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground font-heading">{investor.name}</h1>
                            <span className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-bold font-mono tracking-wider">
                                {investor.investor_number}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">{investor.email}</p>
                    </div>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => router.push(`/investors/payout?investor=${investor.id}`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors text-sm font-semibold"
                    >
                        <ArrowUpRight className="h-4 w-4 text-emerald-400" />
                        Process Payout
                    </button>
                    <button
                        onClick={() => router.push(`/investors/new-investment?investor=${investor.id}`)}
                        className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Add Capital
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Wallet className="h-10 w-10 text-primary" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Invested</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(totalInvested)}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp className="h-10 w-10 text-emerald-400" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Active Placements</p>
                    <p className="text-2xl font-bold text-foreground">{activeInvestments}</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                        <History className="h-10 w-10 text-blue-400" />
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Returns Paid</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(0)}</p>
                </div>
            </div>

            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="flex border-b border-border">
                    {['investments', 'payouts', 'profile'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-8 py-4 text-sm font-medium transition-colors capitalize ${activeTab === tab
                                    ? 'text-primary border-b-2 border-primary bg-primary/5'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-0">
                    {activeTab === 'investments' && (
                        <DataTable
                            columns={investmentColumns}
                            data={investments}
                            isLoading={false}
                        />
                    )}
                    {activeTab === 'payouts' && (
                        <div className="p-12 text-center text-muted-foreground">
                            <Coins className="h-12 w-12 mx-auto mb-4 opacity-10" />
                            <p className="font-medium">No payout history found</p>
                            <p className="text-xs">Once returns are processed, they will appear here</p>
                        </div>
                    )}
                    {activeTab === 'profile' && (
                        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Investor Information</h3>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                                                <User className="h-3 w-3" /> Entity Type
                                            </dt>
                                            <dd className="text-sm text-foreground font-medium capitalize">{investor.investor_type}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1 flex items-center gap-2">
                                                <Calendar className="h-3 w-3" /> Joined Date
                                            </dt>
                                            <dd className="text-sm text-foreground font-medium">Jan 27, 2026</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">ID / Reg Number</dt>
                                            <dd className="text-sm text-foreground font-medium">{investor.id_number || '---'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">KRA PIN</dt>
                                            <dd className="text-sm text-foreground font-mono uppercase font-bold">{investor.kra_pin || '---'}</dd>
                                        </div>
                                    </dl>
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Contact & Logistics</h3>
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-primary">
                                                <Phone className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Phone</dt>
                                                <dd className="text-foreground font-medium">{investor.phone}</dd>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm">
                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-primary">
                                                <Mail className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Email</dt>
                                                <dd className="text-foreground font-medium">{investor.email}</dd>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-4 text-sm text-slate-300">
                                            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-primary flex-shrink-0">
                                                <MapPin className="h-4 w-4" />
                                            </div>
                                            <div>
                                                <dt className="text-[10px] text-muted-foreground uppercase tracking-wider">Address</dt>
                                                <dd className="text-foreground font-medium mt-0.5">{investor.address || 'Not specified'}</dd>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div className="glass rounded-xl p-8 border border-border bg-primary/5">
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 border-b border-border pb-4 flex items-center justify-between">
                                        Settlement Instructions
                                        <Landmark className="h-4 w-4 text-primary opacity-50" />
                                    </h3>
                                    <div className="space-y-6">
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Beneficiary Bank</dt>
                                            <dd className="text-sm text-foreground font-bold">{investor.bank_name || 'Not provided'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Account Number</dt>
                                            <dd className="text-lg text-primary font-mono font-bold tracking-widest">{investor.bank_account || '---'}</dd>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-6 border border-border rounded-xl bg-input">
                                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                                        Note: Payouts will be processed to the provided settlement account. Ensure bank details are verified before processing interest or principal returns.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
