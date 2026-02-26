'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, UserPlus, Mail, Phone, CheckCircle, XCircle, Search, Layers } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Valuer {
    id: string;
    name: string;
    email: string;
    phone: string;
    valuation_types: string[];
    is_active: boolean;
}

export default function ValuersPage() {
    const router = useRouter();
    const [valuers, setValuers] = useState<Valuer[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchValuers = async () => {
            try {
                const response = await api.get('/collateral/valuers/');
                setValuers(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch valuers:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchValuers();
    }, []);

    const columns = [
        {
            header: 'Valuer / Company',
            accessor: (v: Valuer) => (
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 font-bold">
                        {v.name[0]}
                    </div>
                    <p className="font-bold text-foreground">{v.name}</p>
                </div>
            ),
        },
        {
            header: 'Contact Info',
            accessor: (v: Valuer) => (
                <div className="text-xs space-y-1">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Mail className="h-3 w-3 opacity-50" /> {v.email}
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-3 w-3 opacity-50" /> {v.phone}
                    </div>
                </div>
            ),
        },
        {
            header: 'Specializations',
            accessor: (v: Valuer) => (
                <div className="flex flex-wrap gap-1">
                    {v.valuation_types.map(type => (
                        <span key={type} className="text-[9px] px-1.5 py-0.5 rounded bg-muted border border-border text-muted-foreground font-bold uppercase tracking-tight">
                            {type.replace('_', ' ')}
                        </span>
                    ))}
                    {v.valuation_types.length === 0 && <span className="text-[10px] text-slate-600 italic">General</span>}
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: (v: Valuer) => (
                v.is_active ? (
                    <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-bold uppercase tracking-widest">
                        <CheckCircle className="h-3 w-3" /> Accredited
                    </span>
                ) : (
                    <span className="flex items-center gap-1.5 text-slate-600 text-[10px] font-bold uppercase tracking-widest">
                        <XCircle className="h-3 w-3" /> Inactive
                    </span>
                )
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
                        <h1 className="text-3xl font-bold text-foreground font-heading">Valuation Partners</h1>
                        <p className="text-muted-foreground mt-1">Manage accredited external valuation companies</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push('/collateral/valuers/new')}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-foreground font-bold text-sm shadow-lg shadow-emerald-900/20 hover:bg-emerald-500 transition-all"
                >
                    <UserPlus className="h-4 w-4" />
                    Onboard Valuer
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                    <DataTable
                        columns={columns}
                        data={valuers}
                        isLoading={isLoading}
                    />
                </div>
                <div className="glass rounded-xl p-6 border border-border space-y-6 h-fit">
                    <div className="flex items-center gap-2 text-primary opacity-50">
                        <Layers className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Institutional Policy</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed italic border-l-2 border-primary/20 pl-4">
                        Valuers listed here are the only ones authorized to provide reports for collateral security. AI parsing is optimized for formats used by these accredited partners.
                    </p>
                </div>
            </div>
        </div>
    );
}
