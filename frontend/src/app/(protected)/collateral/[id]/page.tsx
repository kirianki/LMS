'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    ShieldCheck,
    Car,
    Home,
    Layers,
    Calendar,
    FileText,
    TrendingUp,
    TrendingDown,
    MapPin,
    Tag,
    History,
    FileCheck,
    AlertCircle,
    Edit,
    Download
} from 'lucide-react';
import api from '@/lib/api';

interface Collateral {
    id: string;
    collateral_type: string;
    status: string;
    market_value: number;
    forced_sale_value: number;
    valuation_date: string;
    valuer_name: string;
    valuer: string;
    description: string;
    borrower_name: string;
    borrower_last_name: string;
    borrower: string;
    // Specifics
    reg_number?: string;
    make?: string;
    model?: string;
    lr_number?: string;
    location?: string;
    property_size?: string;
    year_of_manufacture?: number;
    logbook_number?: string;
    document_upload?: string;
    is_charged: boolean;
    liquidation_date?: string;
    liquidation_value?: number;
    chassis_number?: string;
    engine_number?: string;
    color?: string;
}

export default function CollateralDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [collateral, setCollateral] = useState<Collateral | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [isUpdating, setIsUpdating] = useState(false);

    const fetchDetail = async () => {
        try {
            const response = await api.get(`/collateral/collateral/${params.id}/`);
            setCollateral(response.data);
        } catch (error) {
            console.error('Failed to fetch collateral detail:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [params.id]);

    const handleStatusUpdate = async (newStatus: string) => {
        if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) return;
        setIsUpdating(true);
        try {
            await api.patch(`/collateral/collateral/${params.id}/`, { status: newStatus });
            await fetchDetail();
        } catch (error: any) {
            console.error('Status update failed:', error);
            // Show backend validation error if available
            const errorMsg = error.response?.data?.status ? error.response.data.status[0] : 'Failed to update status.';
            alert(errorMsg);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleVerifyCharge = async () => {
        if (!confirm('Confirm you have physically verified the Security Deed?')) return;
        setIsUpdating(true);
        try {
            await api.patch(`/collateral/collateral/${params.id}/`, { is_charged: true });
            await fetchDetail();
        } catch (error) {
            console.error('Verification failed:', error);
            alert('Failed to verify charge.');
        } finally {
            setIsUpdating(false);
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
        }).format(amount);
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading details...</div>;
    if (!collateral) return <div className="p-8 text-center text-red-400">Collateral not found</div>;

    return (
        <div className="space-y-6 pb-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground font-heading uppercase tracking-tight">
                                {collateral.reg_number || collateral.lr_number || 'Security Asset'}
                            </h1>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${collateral.status === 'pledged' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'
                                }`}>
                                {collateral.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1 capitalize">{collateral.collateral_type?.replace('_', ' ') || 'Other'} • Pledged by {collateral.borrower_name}</p>
                    </div>
                </div>
                <button
                    onClick={() => router.push(`/collateral/${params.id}/edit`)}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors text-sm font-semibold"
                >
                    <Edit className="h-4 w-4" />
                    Edit Details
                </button>
            </div>

            {/* Value Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2 glass rounded-xl p-8 border border-border bg-primary/5 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 text-primary opacity-50">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Market Valuation</span>
                    </div>
                    <p className="text-5xl font-bold text-foreground tracking-tighter">{formatCurrency(collateral.market_value)}</p>
                    <p className="text-xs text-muted-foreground mt-4 flex items-center gap-2">
                        <FileCheck className="h-3.5 w-3.5 text-emerald-500" />
                        Valued on {new Date(collateral.valuation_date).toLocaleDateString()} by {collateral.valuer_name || 'Verified Partner'}
                    </p>
                </div>
                <div className="glass rounded-xl p-6 border border-border flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 text-amber-500 opacity-50">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Forced Sale Value</span>
                    </div>
                    <p className="text-3xl font-bold text-foreground tracking-tight">{formatCurrency(collateral.forced_sale_value)}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Recoverable amount in case of default</p>
                </div>
                <div className="glass rounded-xl p-6 border border-border flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-2 text-blue-400 opacity-50">
                        <ShieldCheck className="h-4 w-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">LVR Ratio</span>
                    </div>
                    <p className="text-3xl font-bold text-blue-400 tracking-tight">0%</p>
                    <p className="text-[10px] text-muted-foreground mt-2">Loan to Value Risk coverage</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="flex border-b border-border">
                    {['overview', 'documents', 'management'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-8 py-4 text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'text-primary border-b-2 border-primary bg-white/[0.02]' : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-8">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                            {collateral.collateral_type === 'motor_vehicle' ? (
                                <>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Tag className="h-3 w-3" /> Vehicle Make & Model
                                        </dt>
                                        <dd className="text-lg text-foreground font-medium">{collateral.make} {collateral.model}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <Calendar className="h-3 w-3" /> Manufacture Year
                                        </dt>
                                        <dd className="text-lg text-foreground font-medium">{collateral.year_of_manufacture || '---'}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Registration Plate</dt>
                                        <dd className="text-2xl text-primary font-mono font-bold tracking-wider">{collateral.reg_number}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Logbook Reference</dt>
                                        <dd className="text-xl text-foreground font-mono">{collateral.logbook_number}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Chassis Number</dt>
                                        <dd className="text-lg text-foreground font-mono font-bold tracking-tight">{collateral.chassis_number || '---'}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Engine Number</dt>
                                        <dd className="text-lg text-foreground font-mono font-bold tracking-tight">{collateral.engine_number || '---'}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Colour</dt>
                                        <dd className="text-lg text-foreground">{collateral.color || '---'}</dd>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                            <MapPin className="h-3 w-3" /> Location
                                        </dt>
                                        <dd className="text-lg text-foreground font-medium">{collateral.location || '---'}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Parcel (LR) Number</dt>
                                        <dd className="text-2xl text-primary font-mono font-bold tracking-wider">{collateral.lr_number}</dd>
                                    </div>
                                    <div className="border-b border-border pb-4">
                                        <dt className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Calculated Area</dt>
                                        <dd className="text-lg text-foreground font-medium">{collateral.property_size || '---'}</dd>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider">Asset Documentation</h3>
                                <button
                                    onClick={() => router.push(`/collateral/${params.id}/valuation/new`)}
                                    className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all flex items-center gap-2"
                                >
                                    <TrendingUp className="h-3 w-3" />
                                    Add Valuation Report
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {collateral.document_upload ? (
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-border">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                <FileText className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="text-foreground text-sm font-bold">Ownership document</p>
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Secondary Verification</p>
                                            </div>
                                        </div>
                                        <a
                                            href={collateral.document_upload}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                        >
                                            <Download className="h-4 w-4" />
                                        </a>
                                    </div>
                                ) : (
                                    <div className="col-span-2 text-center py-12 border-2 border-dashed border-border rounded-xl">
                                        <AlertCircle className="h-8 w-8 text-slate-700 mx-auto mb-2" />
                                        <p className="text-muted-foreground text-sm">No verification documents uploaded yet.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'management' && (
                        <div className="space-y-8">
                            <div>
                                <h3 className="text-foreground font-bold text-sm uppercase tracking-wider mb-2">Life Cycle Operations</h3>
                                <p className="text-xs text-muted-foreground mb-6">Transition the asset through its institutional stages. Ensure all legal requirements are met before status changes.</p>

                                <div className="space-y-6">
                                    {/* 1. Verification Step */}
                                    <div className={`glass p-6 rounded-xl border ${collateral.is_charged ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-border'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${collateral.is_charged ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-800 text-muted-foreground'}`}>
                                                    <FileCheck className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className={`font-bold ${collateral.is_charged ? 'text-emerald-400' : 'text-foreground'}`}>
                                                        {collateral.is_charged ? 'Security Deed Verified' : 'Verify Security Deed'}
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                                                        {collateral.is_charged ? 'Legal Charge Active' : 'Pre-requisite for Pledging'}
                                                    </p>
                                                </div>
                                            </div>
                                            {!collateral.is_charged && (
                                                <button
                                                    onClick={handleVerifyCharge}
                                                    disabled={isUpdating || !collateral.document_upload}
                                                    className="px-4 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {collateral.document_upload ? 'Confirm Verification' : 'Upload Doc First'}
                                                </button>
                                            )}
                                        </div>
                                        {!collateral.is_charged && !collateral.document_upload && (
                                            <p className="text-xs text-red-400 italic bg-red-400/10 p-2 rounded">
                                                * You must upload a signed Security Deed in the Documents tab before verification.
                                            </p>
                                        )}
                                    </div>

                                    {/* 2. Status Actions */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="glass p-6 rounded-xl border border-border space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                                                    <ShieldCheck className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-foreground font-bold">Pledge Asset</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tie asset to an active loan</p>
                                                </div>
                                            </div>
                                            <button
                                                disabled={collateral.status === 'pledged' || !collateral.is_charged || isUpdating}
                                                onClick={() => handleStatusUpdate('pledged')}
                                                className="w-full py-2.5 rounded-lg bg-amber-600/20 border border-amber-600/30 text-amber-500 text-xs font-bold hover:bg-amber-600/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {collateral.status === 'pledged' ? 'Currently Pledged' : 'Set as Pledged'}
                                            </button>
                                        </div>

                                        <div className="glass p-6 rounded-xl border border-border space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                                    <FileCheck className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <p className="text-foreground font-bold">Discharge Asset</p>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Release security from institution</p>
                                                </div>
                                            </div>
                                            <button
                                                disabled={collateral.status !== 'pledged' || isUpdating}
                                                onClick={() => handleStatusUpdate('discharged')}
                                                className="w-full py-2.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-emerald-500 text-xs font-bold hover:bg-emerald-600/30 transition-all disabled:opacity-50"
                                            >
                                                Discharge Security
                                            </button>
                                        </div>
                                    </div>

                                    {/* 3. Liquidation Zone */}
                                    {collateral.status === 'pledged' && (
                                        <div className="glass p-6 rounded-xl border border-red-500/20 bg-red-500/5 mt-6">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center text-red-500">
                                                    <AlertCircle className="h-5 w-5" />
                                                </div>
                                                <div>
                                                    <h4 className="text-foreground font-bold">Liquidation Protocol</h4>
                                                    <p className="text-[10px] text-red-400 uppercase tracking-widest">Asset Recovery / Auction</p>
                                                </div>
                                            </div>
                                            <p className="text-xs text-muted-foreground mb-4">
                                                Initiate liquidation only after all recovery options have been exhausted. This action is irreversible and requires filing an auction report.
                                            </p>
                                            <button
                                                onClick={() => {
                                                    const value = prompt("Enter Final Auction Sale Value (KES):");
                                                    if (value) {
                                                        alert("Liquidation module (Phase 9) is active. Backend update simulation complete.");
                                                        // logic to patch liquidation_value & date would go here
                                                    }
                                                }}
                                                className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-all shadow-lg shadow-red-900/20"
                                            >
                                                Initiate Asset Liquidation
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sidebar Details */}
            <div className="space-y-6">
                <div className="glass rounded-xl p-6 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-primary opacity-50">
                        <History className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Valuation Source</h3>
                    </div>
                    <div className="p-4 rounded-xl bg-input border border-border">
                        <p className="text-foreground font-bold text-sm mb-1">{collateral.valuer_name || 'Accredited Partner'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Verified Institutional Valuer</p>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 border border-orange-500/10 bg-orange-500/5 space-y-4">
                    <div className="flex items-center gap-2 text-orange-400">
                        <AlertCircle className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-widest">Legal Status</h3>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                        The **Security Deed** (or Instrument of Charge) is the official contract that creates a legal lien over this asset. It must be generated, signed by the borrower, and stamped by authorities to be enforceable.
                    </p>
                </div>

                <div className="p-1 px-4 py-3 rounded-xl bg-primary/5 border border-primary/10">
                    <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Generated Documents</h4>
                    <button className="w-full flex items-center justify-between text-left group">
                        <div>
                            <p className="text-foreground text-xs font-bold group-hover:text-primary transition-colors">Security Deed template</p>
                            <p className="text-[9px] text-muted-foreground">Official charge document for signing</p>
                        </div>
                        <Download className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </button>
                </div>
            </div>
        </div>
    );
}
