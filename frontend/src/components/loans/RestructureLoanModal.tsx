'use client';

import { useState, useMemo } from 'react';
import {
    X, Calendar, Percent, RefreshCw, Layers, ShieldCheck, FileText, AlertCircle, Save,
    TrendingDown, CheckCircle2, Info, ChevronDown, BarChart3, Clock, Banknote
} from 'lucide-react';
import api from '@/lib/api';

interface RestructureLoanModalProps {
    loan: any;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

function fmt(val: number | string | undefined | null) {
    if (val === undefined || val === null) return 'KES 0.00';
    return `KES ${parseFloat(String(val)).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RestructureLoanModal({ loan, isOpen, onClose, onSuccess }: RestructureLoanModalProps) {
    const [formData, setFormData] = useState({
        new_term: loan.term || '',
        new_interest_rate: loan.interest_rate || '',
        new_frequency: loan.repayment_frequency || 'monthly',
        capitalize_arrears: false,
        waive_penalties: false,
        waive_interest: false,
        notes: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [successSummary, setSuccessSummary] = useState<any>(null);

    // Live projected instalment estimate
    const projectedInstalment = useMemo(() => {
        const principal = parseFloat(String(loan.outstanding_principal || 0));
        const rate = parseFloat(String(formData.new_interest_rate || 0));
        const term = parseInt(String(formData.new_term || 1));
        const freq = formData.new_frequency;

        if (!principal || !term) return null;

        const termUnit = loan.product_details?.term_unit || 'months';
        let numInstallments = term;
        if (freq === 'weekly') numInstallments = termUnit === 'months' ? Math.floor(term * 4.33) : term;
        else if (freq === 'quarterly') numInstallments = Math.max(1, Math.floor(term / 3));
        else if (freq === 'bi_annually') numInstallments = Math.max(1, Math.floor(term / 6));
        else if (freq === 'annually') numInstallments = Math.max(1, Math.floor(term / 12));
        else if (freq === 'bullet') numInstallments = 1;

        // Flat interest estimate
        const years = termUnit === 'months' ? term / 12 : termUnit === 'weeks' ? term / 52 : term / 365;
        const totalInterest = principal * (rate / 100) * years;
        const installment = (principal + totalInterest) / numInstallments;
        return { installment, numInstallments, totalInterest };
    }, [formData.new_term, formData.new_interest_rate, formData.new_frequency, loan]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessSummary(null);
        setIsSubmitting(true);

        try {
            const res = await api.post(`/loans/${loan.id}/restructure/`, formData);
            setSuccessSummary(res.data.summary);
        } catch (err: any) {
            setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to restructure loan.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (successSummary) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
                <div className="glass rounded-[2rem] border border-border w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden">
                    <div className="p-10 flex flex-col items-center gap-6 text-center">
                        <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center">
                            <CheckCircle2 className="w-9 h-9 text-emerald-500" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-foreground">Restructure Successful</h2>
                            <p className="text-xs text-foreground mt-1 uppercase tracking-widest font-bold">{loan.loan_number} — Modified</p>
                        </div>
                        <div className="w-full rounded-2xl bg-muted/40 border border-border divide-y divide-border text-sm font-medium">
                            {[
                                { label: 'Previous Principal', value: fmt(successSummary.previous_principal) },
                                { label: 'Previous Interest', value: fmt(successSummary.previous_interest) },
                                { label: 'Previous Penalties', value: fmt(successSummary.previous_penalties) },
                                successSummary.waived_penalties > 0 && { label: 'Penalties Waived', value: fmt(successSummary.waived_penalties), positive: true },
                                successSummary.waived_interest > 0 && { label: 'Interest Waived', value: fmt(successSummary.waived_interest), positive: true },
                                successSummary.capitalized > 0 && { label: 'Capitalized into Principal', value: fmt(successSummary.capitalized), neutral: true },
                                { label: 'New Interest Charged', value: fmt(successSummary.new_interest_charged) },
                                { label: 'New Installments', value: `${successSummary.new_installments} payments` },
                            ].filter(Boolean).map((row: any, i) => (
                                <div key={i} className="flex items-center justify-between px-4 py-3">
                                    <span className="text-foreground text-xs uppercase tracking-wide">{row.label}</span>
                                    <span className={`font-black ${row.positive ? 'text-emerald-500' : row.neutral ? 'text-amber-500' : 'text-foreground'}`}>{row.value}</span>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={() => { setSuccessSummary(null); onSuccess(); onClose(); }}
                            className="w-full px-6 py-4 rounded-2xl bg-primary text-white font-black hover:shadow-xl hover:shadow-primary/20 transition-all"
                        >
                            Done
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="glass rounded-[2rem] border border-border w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="flex items-center justify-between px-8 py-6 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Restructure Facility</h2>
                        <p className="text-xs text-foreground mt-0.5 uppercase tracking-widest font-bold">
                            Modification of Active Terms • {loan.loan_number}
                            {loan.is_restructured && (
                                <span className="ml-3 inline-flex items-center gap-1 text-amber-500">
                                    <Clock className="w-3 h-3" /> Previously Restructured
                                </span>
                            )}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition-all">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1">
                    {/* Current Position Panel */}
                    <div className="px-8 pt-6 pb-2">
                        <p className="text-[10px] font-black text-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Info className="w-3.5 h-3.5" /> Current Outstanding Position
                        </p>
                        <div className="grid grid-cols-3 gap-3">
                            {[
                                { label: 'Principal', value: loan.outstanding_principal, icon: Banknote, color: 'text-primary' },
                                { label: 'Interest', value: loan.outstanding_interest, icon: BarChart3, color: 'text-blue-500' },
                                { label: 'Penalties', value: loan.outstanding_penalties, icon: AlertCircle, color: 'text-rose-500' },
                            ].map(({ label, value, icon: Icon, color }) => (
                                <div key={label} className="rounded-2xl bg-muted/50 border border-border p-4">
                                    <div className="flex items-center gap-1.5 mb-1">
                                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{label}</span>
                                    </div>
                                    <p className="text-sm font-black text-foreground">{fmt(value)}</p>
                                </div>
                            ))}
                        </div>
                        <div className="mt-3 rounded-2xl bg-muted/50 border border-border px-4 py-3 flex items-center justify-between">
                            <span className="text-[10px] font-black text-foreground uppercase tracking-widest">Total Outstanding Balance</span>
                            <span className="text-sm font-black text-foreground">{fmt(loan.outstanding_balance)}</span>
                        </div>
                    </div>

                    {/* Form */}
                    <form id="restructureForm" onSubmit={handleSubmit} className="px-8 py-6 space-y-5">
                        {error && (
                            <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600">
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <p className="text-sm font-bold">{error}</p>
                            </div>
                        )}

                        {/* Term & Rate */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                    New Term ({loan.product_details?.term_unit || 'months'})
                                </label>
                                <div className="relative">
                                    <Calendar className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={formData.new_term}
                                        onChange={(e) => setFormData({ ...formData, new_term: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        placeholder="Duration"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">New Interest Rate (%)</label>
                                <div className="relative">
                                    <Percent className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.new_interest_rate}
                                        onChange={(e) => setFormData({ ...formData, new_interest_rate: e.target.value })}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                        placeholder="Annual Rate"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Frequency */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Repayment Frequency</label>
                            <div className="relative">
                                <RefreshCw className="w-4 h-4 text-muted-foreground absolute left-4 top-1/2 -translate-y-1/2" />
                                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                                <select
                                    value={formData.new_frequency}
                                    onChange={(e) => setFormData({ ...formData, new_frequency: e.target.value })}
                                    className="w-full pl-12 pr-10 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm appearance-none"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="bi_annually">Bi-Annually</option>
                                    <option value="annually">Annually</option>
                                    <option value="bullet">Bullet (At Maturity)</option>
                                </select>
                            </div>
                        </div>

                        {/* Projected Instalment */}
                        {projectedInstalment && (
                            <div className="rounded-2xl bg-primary/5 border border-primary/20 px-5 py-4 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="w-4 h-4 text-primary" />
                                    <span className="text-xs font-black text-foreground uppercase tracking-widest">Estimated New Instalment</span>
                                </div>
                                <div className="text-right">
                                    <p className="text-base font-black text-primary">{fmt(projectedInstalment.installment)}</p>
                                    <p className="text-[10px] text-foreground">× {projectedInstalment.numInstallments} payments</p>
                                </div>
                            </div>
                        )}

                        {/* Toggles */}
                        <div className="space-y-3 pt-2 border-t border-border">
                            <p className="text-[10px] font-black text-foreground uppercase tracking-widest pt-2">Arrears & Penalty Handling</p>

                            {[
                                {
                                    key: 'capitalize_arrears', icon: Layers, iconColor: 'text-primary',
                                    label: 'Capitalize Arrears',
                                    description: 'Roll outstanding interest and penalties into the principal. The new schedule will be built on the inflated balance.',
                                },
                                {
                                    key: 'waive_penalties', icon: ShieldCheck, iconColor: 'text-emerald-500',
                                    label: 'Waive Existing Penalties',
                                    description: 'Forgive all outstanding late payment penalties. Applied before capitalization.',
                                },
                                {
                                    key: 'waive_interest', icon: ShieldCheck, iconColor: 'text-blue-500',
                                    label: 'Waive Outstanding Interest',
                                    description: 'Forgive all accrued interest. Fresh interest will be calculated on the remaining principal only.',
                                },
                            ].map(({ key, icon: Icon, iconColor, label, description }) => (
                                <label key={key} className="flex items-start gap-4 p-4 rounded-2xl border border-border hover:bg-muted/30 transition-all cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={(formData as any)[key]}
                                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                                        className="mt-1 w-5 h-5 rounded border-border text-primary focus:ring-primary/20"
                                    />
                                    <div className="space-y-0.5">
                                        <div className="flex items-center gap-2">
                                            <Icon className={`w-4 h-4 ${iconColor}`} />
                                            <span className="text-sm font-black text-foreground uppercase tracking-tight">{label}</span>
                                        </div>
                                        <p className="text-xs text-foreground leading-relaxed">{description}</p>
                                    </div>
                                </label>
                            ))}
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Restructuring Reason / Notes</label>
                            <div className="relative">
                                <FileText className="w-4 h-4 text-muted-foreground absolute left-4 top-4" />
                                <textarea
                                    rows={3}
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm resize-none"
                                    placeholder="Reason for restructuring this facility..."
                                />
                            </div>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-8 py-5 border-t border-border bg-muted/30 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl bg-white border border-border text-foreground font-black hover:bg-muted transition-all"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="restructureForm"
                        disabled={isSubmitting}
                        className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-black hover:shadow-xl hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Processing...</>
                        ) : (
                            <><Save className="h-4 w-4" /> Confirm Restructure</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
