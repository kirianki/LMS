'use client';

import { useState, useEffect } from 'react';
import { Calendar, Clock, BarChart3, ChevronDown, ChevronUp, Save, Info } from 'lucide-react';
import { addDays, addWeeks, addMonths, addYears, format, parseISO, isValid } from 'date-fns';
import api from '@/lib/api';

interface ScheduleItem {
    id?: string;
    installment_number: number;
    due_date: string;
    principal_due: number | string;
    interest_due: number | string;
    fees_due: number | string;
    total_due: number | string;
}

interface RepaymentScheduleEditorProps {
    applicationId: string;
    approvedAmount: number;
    approvedTerm?: number;
    frequency?: string;
    isEditable: boolean;
}

export default function RepaymentScheduleEditor({ applicationId, approvedAmount, approvedTerm, frequency = 'monthly', isEditable }: RepaymentScheduleEditorProps) {
    const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isCollapsed, setIsCollapsed] = useState(true);

    // Fetch schedule on mount
    useEffect(() => {
        fetchSchedule();
    }, [applicationId]);

    const fetchSchedule = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/loans/applications/${applicationId}/manage_schedule/`);
            setSchedule(res.data);
            setError(null);
        } catch (err: any) {
            console.error(err);
            setError('Failed to load schedule.');
        } finally {
            setLoading(false);
        }
    };

    const addInterval = (date: Date, freq: string) => {
        const f = freq.toLowerCase().replace('-', '').replace(' ', '');
        switch (f) {
            case 'daily': return addDays(date, 1);
            case 'weekly': return addWeeks(date, 1);
            case 'biweekly': return addDays(date, 14);
            case 'monthly': return addMonths(date, 1);
            case 'quarterly': return addMonths(date, 3);
            case 'biannually': return addMonths(date, 6);
            case 'annually': return addYears(date, 1);
            default: return addMonths(date, 1);
        }
    };

    const handleChange = (index: number, field: keyof ScheduleItem, value: any) => {
        const newSchedule = [...schedule];
        newSchedule[index] = { ...newSchedule[index], [field]: value };

        // Date Cascading Logic
        if (field === 'due_date' && index < schedule.length - 1) {
            let currentDate = parseISO(value);
            if (isValid(currentDate)) {
                for (let i = index + 1; i < newSchedule.length; i++) {
                    currentDate = addInterval(currentDate, frequency);
                    newSchedule[i] = {
                        ...newSchedule[i],
                        due_date: format(currentDate, 'yyyy-MM-dd')
                    };
                }
            }
        }

        // Auto-update total_due for display
        const p = parseFloat(newSchedule[index].principal_due as string) || 0;
        const i = parseFloat(newSchedule[index].interest_due as string) || 0;
        const f = parseFloat(newSchedule[index].fees_due as string) || 0;
        newSchedule[index].total_due = (p + i + f).toFixed(2);

        setSchedule(newSchedule);
    };

    const handleSave = async () => {
        const totalPrincipal = schedule.reduce((sum, item) => sum + (parseFloat(item.principal_due as string) || 0), 0);
        if (Math.abs(totalPrincipal - approvedAmount) > 1.0) {
            alert(`Total Principal (${totalPrincipal.toFixed(2)}) must match Approved Amount (${approvedAmount.toFixed(2)})`);
            return;
        }

        try {
            setSaving(true);
            await api.put(`/loans/applications/${applicationId}/manage_schedule/`, schedule);
            alert('Schedule updated successfully!');
            fetchSchedule();
        } catch (err: any) {
            console.error(err);
            alert(err.response?.data?.error || 'Failed to save schedule.');
        } finally {
            setSaving(false);
        }
    };

    const totalPrincipal = schedule.reduce((sum, item) => sum + (parseFloat(item.principal_due as string) || 0), 0);
    const totalInterest = schedule.reduce((sum, item) => sum + (parseFloat(item.interest_due as string) || 0), 0);

    if (loading) return (
        <div className="glass p-8 rounded-3xl border border-border mt-6 flex flex-col items-center justify-center gap-4">
            <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] animate-pulse">Synchronizing Schedule...</p>
        </div>
    );

    if (error) return (
        <div className="bg-destructive/10 p-6 rounded-3xl border border-destructive/20 mt-6 flex items-center gap-4 text-destructive">
            <Info className="h-6 w-6" />
            <p className="font-bold">{error}</p>
        </div>
    );

    const startDate = schedule[0]?.due_date || 'N/A';
    const installmentCount = schedule.length || approvedTerm || 0;

    return (
        <div className="glass rounded-3xl border border-border mt-6 overflow-hidden shadow-2xl transition-all duration-500 hover:shadow-primary/5">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 gap-4 border-b border-border bg-background/30">
                <div>
                    <h3 className="text-xl font-bold text-foreground font-heading">Repayment Schedule</h3>
                    <p className="text-xs text-muted-foreground uppercase tracking-widest mt-1">PROVISIONAL • EDITABLE BEFORE DISBURSEMENT</p>
                </div>
                <div className="flex flex-wrap gap-3 w-full md:w-auto">
                    <button
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className="flex-1 md:flex-none text-sm font-semibold text-primary hover:bg-primary/10 px-4 py-2.5 rounded-2xl transition-all flex items-center justify-center gap-2 border border-primary/20 whitespace-nowrap"
                    >
                        {isCollapsed ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronUp className="h-4 w-4 shrink-0" />}
                        {isCollapsed ? 'Expand View' : 'Collapse View'}
                    </button>
                    {isEditable && (
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex-1 md:flex-none bg-primary text-primary-foreground px-6 py-2.5 rounded-2xl hover:opacity-90 disabled:opacity-50 text-sm font-bold shadow-lg shadow-primary/25 transition-all flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <Save className="h-4 w-4 shrink-0" />
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                    )}
                </div>
            </div>

            <div className="p-6">
                {/* Summary Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                    <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10 group transition-all hover:bg-primary/10">
                        <p className="text-[10px] font-black text-primary/60 uppercase mb-2 flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            First Date
                        </p>
                        <p className="text-lg font-bold text-foreground">
                            {startDate !== 'N/A' ? format(parseISO(startDate), 'dd MMM yyyy') : 'Not set'}
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 group transition-all hover:bg-emerald-500/10">
                        <p className="text-[10px] font-black text-emerald-600/60 uppercase mb-2 flex items-center gap-2">
                            <Clock className="h-3.5 w-3.5" />
                            Frequency
                        </p>
                        <p className="text-lg font-bold text-foreground capitalize truncate" title={frequency}>
                            {frequency.replace(/_/g, ' ')}
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-violet-500/5 border border-violet-500/10 group transition-all hover:bg-violet-500/10">
                        <p className="text-[10px] font-black text-violet-600/60 uppercase mb-2 flex items-center gap-2">
                            <BarChart3 className="h-3.5 w-3.5" />
                            Term
                        </p>
                        <p className="text-lg font-bold text-foreground">
                            {installmentCount} Units
                        </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 group transition-all hover:bg-amber-500/10">
                        <p className="text-[10px] font-black text-amber-600 uppercase mb-2 flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            Commitment
                        </p>
                        <p className="text-lg font-bold text-foreground">
                            KES {approvedAmount.toLocaleString()}
                        </p>
                    </div>
                </div>

                {!isCollapsed && (
                    <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="overflow-x-auto rounded-3xl border border-border bg-background/20 overflow-hidden">
                            <table className="w-full text-sm text-left">
                                <thead className="text-[10px] text-muted-foreground uppercase bg-muted/30 font-black tracking-widest border-b border-border">
                                    <tr>
                                        <th className="px-6 py-5 text-center w-16">#</th>
                                        <th className="px-6 py-5">Due Date</th>
                                        <th className="px-6 py-5">Principal (KES)</th>
                                        <th className="px-6 py-5 text-center">Interest</th>
                                        <th className="px-6 py-5 text-center">Fees</th>
                                        <th className="px-6 py-5 text-right bg-primary/5 font-bold">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {schedule.map((item, index) => (
                                        <tr key={index} className="hover:bg-muted/30 transition-colors group">
                                            <td className="px-6 py-4 text-center font-bold text-muted-foreground group-hover:text-primary transition-colors">
                                                {item.installment_number}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditable ? (
                                                    <input
                                                        type="date"
                                                        value={item.due_date}
                                                        onChange={(e) => handleChange(index, 'due_date', e.target.value)}
                                                        className="bg-background/50 border border-border rounded-xl px-4 py-2 w-full text-sm font-bold text-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all outline-none group-hover:bg-background"
                                                    />
                                                ) : <span className="font-bold text-foreground">{item.due_date}</span>}
                                            </td>
                                            <td className="px-6 py-4">
                                                {isEditable ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.principal_due}
                                                        onChange={(e) => handleChange(index, 'principal_due', e.target.value)}
                                                        className="bg-background/50 border border-border rounded-xl px-4 py-2 w-full font-bold text-foreground focus:ring-2 focus:ring-primary/50 outline-none group-hover:bg-background"
                                                    />
                                                ) : <span className="font-semibold">{formatMoney(item.principal_due)}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isEditable ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.interest_due}
                                                        onChange={(e) => handleChange(index, 'interest_due', e.target.value)}
                                                        className="bg-background/50 border border-border rounded-xl px-4 py-2 w-24 text-center font-bold text-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none group-hover:bg-background"
                                                    />
                                                ) : <span className="text-muted-foreground font-medium">{formatMoney(item.interest_due)}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {isEditable ? (
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={item.fees_due}
                                                        onChange={(e) => handleChange(index, 'fees_due', e.target.value)}
                                                        className="bg-background/50 border border-border rounded-xl px-4 py-2 w-24 text-center font-bold text-muted-foreground focus:ring-2 focus:ring-primary/50 outline-none group-hover:bg-background"
                                                    />
                                                ) : <span className="text-muted-foreground font-medium">{formatMoney(item.fees_due)}</span>}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-foreground bg-primary/5 group-hover:bg-primary/10 transition-colors">
                                                {Number(item.total_due).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/30 font-black border-t-2 border-border">
                                    <tr>
                                        <td colSpan={2} className="px-6 py-6 text-right text-muted-foreground uppercase tracking-widest text-[10px]">Variance Control:</td>
                                        <td className={`px-6 py-6 font-bold ${Math.abs(totalPrincipal - approvedAmount) > 1 ? 'text-destructive' : 'text-emerald-500'}`}>
                                            {totalPrincipal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-6 py-6 text-center text-muted-foreground font-medium">{totalInterest.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td colSpan={2} className="px-6 py-6 text-right">
                                            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mr-3">Approval Limit:</span>
                                            <span className="text-primary text-base">KES {approvedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    function formatMoney(val: any) {
        return Number(val).toLocaleString(undefined, { minimumFractionDigits: 2 });
    }
}
