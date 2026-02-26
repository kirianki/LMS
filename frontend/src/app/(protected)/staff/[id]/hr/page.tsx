'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    Save,
    Briefcase,
    DollarSign,
    CreditCard,
    FileText,
    Plus,
    Trash2,
    User,
    TrendingUp,
    TrendingDown
} from 'lucide-react';
import api from '@/lib/api';

interface Allowance {
    id?: string;
    name: string;
    amount: string;
    calculation_type: 'fixed' | 'percentage';
    percentage_basis: 'basic' | 'gross';
}

interface Deduction {
    id?: string;
    name: string;
    amount: string;
    calculation_type: 'fixed' | 'percentage';
    percentage_basis: 'basic' | 'gross';
}

export default function StaffHRPage() {
    const params = useParams();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        id_number: '',
        kra_pin: '',
        nssf_number: '',
        shif_number: '',
        department: '',
        position: '',
        hire_date: '',
        basic_salary: '',
        bank_name: '',
        bank_account: '',
    });

    const [allowances, setAllowances] = useState<Allowance[]>([]);
    const [deductions, setDeductions] = useState<Deduction[]>([]);

    useEffect(() => {
        const fetchHRData = async () => {
            try {
                // Fetch User info
                const userRes = await api.get(`/users/${params.id}/`);
                const user = userRes.data;

                // Fetch Staff Profile
                const staffRes = await api.get(`/expenses/staff/?user=${params.id}`);
                const profile = staffRes.data.results?.[0] || null;

                setFormData({
                    first_name: user.first_name,
                    last_name: user.last_name,
                    id_number: profile?.id_number || '',
                    kra_pin: profile?.kra_pin || '',
                    nssf_number: profile?.nssf_number || '',
                    shif_number: profile?.shif_number || '',
                    department: profile?.department || '',
                    position: profile?.position || '',
                    hire_date: profile?.hire_date || '',
                    basic_salary: profile?.basic_salary?.toString() || '',
                    bank_name: profile?.bank_name || '',
                    bank_account: profile?.bank_account || '',
                });

                if (profile) {
                    setAllowances(profile.allowances.map((a: any) => ({
                        ...a,
                        amount: a.amount.toString(),
                        calculation_type: a.calculation_type || 'fixed',
                        percentage_basis: a.percentage_basis || 'basic'
                    })));
                    setDeductions(profile.deductions.map((d: any) => ({
                        ...d,
                        amount: d.amount.toString(),
                        calculation_type: d.calculation_type || 'fixed',
                        percentage_basis: d.percentage_basis || 'basic'
                    })));
                }
            } catch (error) {
                console.error('Failed to fetch HR data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchHRData();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // 1. Fetch current User & Profile data
            const userRes = await api.get(`/users/${params.id}/`);
            const user = userRes.data;
            const existingContract = user.contracts?.[0];

            // 2. Update Profile (KRA, NSSF, SHIF) via nested update
            await api.patch(`/users/${params.id}/`, {
                first_name: formData.first_name,
                last_name: formData.last_name,
                profile: {
                    kra_pin: formData.kra_pin,
                    nssf_number: formData.nssf_number,
                    shif_number: formData.shif_number,
                    department: formData.department,
                    job_title: formData.position,
                }
            });

            // 3. Create or Update StaffContract
            const contractPayload = {
                user: params.id,
                basic_salary: parseFloat(formData.basic_salary) || 0,
                bank_name: formData.bank_name,
                bank_account: formData.bank_account,
                start_date: formData.hire_date || new Date().toISOString().split('T')[0],
                status: 'active'
            };

            let contractId: string;
            if (existingContract) {
                await api.patch(`/contracts/${existingContract.id}/`, contractPayload);
                contractId = existingContract.id;
            } else {
                const newContractRes = await api.post(`/contracts/`, contractPayload);
                contractId = newContractRes.data.id;
            }

            // 4. Sync Allowances & Deductions
            // Delete existing ones
            if (existingContract) {
                for (const a of existingContract.allowances || []) {
                    await api.delete(`/allowances/${a.id}/`);
                }
                for (const d of existingContract.deductions || []) {
                    await api.delete(`/deductions/${d.id}/`);
                }
            }

            // Create new ones
            for (const a of allowances) {
                if (!a.name || !a.amount) continue;
                await api.post(`/allowances/`, {
                    contract: contractId,
                    name: a.name,
                    amount: parseFloat(a.amount),
                    calculation_type: a.calculation_type,
                    percentage_basis: a.percentage_basis
                });
            }
            for (const d of deductions) {
                if (!d.name || !d.amount) continue;
                await api.post(`/deductions/`, {
                    contract: contractId,
                    name: d.name,
                    amount: parseFloat(d.amount),
                    calculation_type: d.calculation_type,
                    percentage_basis: d.percentage_basis
                });
            }

            // 5. Legacy Sync (Optional, keep for backward compatibility if needed)
            try {
                const staffRes = await api.get(`/expenses/staff/?user=${params.id}`);
                const profile = staffRes.data.results?.[0];
                const expensesPayload = {
                    user: params.id,
                    first_name: formData.first_name,
                    last_name: formData.last_name,
                    email: user.email,
                    id_number: formData.id_number,
                    shif_number: formData.shif_number,
                    basic_salary: parseFloat(formData.basic_salary) || 0,
                    position: formData.position,
                    department: formData.department,
                    hire_date: formData.hire_date || new Date().toISOString().split('T')[0],
                };
                if (profile) await api.patch(`/expenses/staff/${profile.id}/`, expensesPayload);
                else await api.post(`/expenses/staff/`, expensesPayload);
            } catch (err) {
                console.warn('Legacy expenses sync failed', err);
            }

            router.push(`/staff/${params.id}`);
        } catch (error) {
            console.error('Failed to save HR data:', error);
            alert('Failed to save HR & Contract data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const addAllowance = () => setAllowances([...allowances, { name: '', amount: '', calculation_type: 'fixed', percentage_basis: 'basic' }]);
    const addDeduction = () => setDeductions([...deductions, { name: '', amount: '', calculation_type: 'fixed', percentage_basis: 'basic' }]);

    if (isLoading) return <div className="p-8 text-center text-muted-foreground">Loading HR details...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">HR & Contract Management</h1>
                    <p className="text-muted-foreground mt-1">Manage employment details for {formData.first_name} {formData.last_name}</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Identification & Employment */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass rounded-xl p-6 border border-border space-y-6">
                        <div className="flex items-center gap-2 text-primary">
                            <Briefcase className="h-5 w-5" />
                            <h2 className="font-semibold text-foreground uppercase tracking-wider text-xs">Employment Details</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Position / Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Department</label>
                                <input
                                    type="text"
                                    value={formData.department}
                                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Hire Date</label>
                                <input
                                    type="date"
                                    value={formData.hire_date}
                                    onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-xl p-6 border border-border space-y-6">
                        <div className="flex items-center gap-2 text-amber-500">
                            <FileText className="h-5 w-5" />
                            <h2 className="font-semibold text-foreground uppercase tracking-wider text-xs">Statutory Identification</h2>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">ID/Passport Number</label>
                                <input
                                    type="text"
                                    value={formData.id_number}
                                    onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">KRA PIN</label>
                                <input
                                    type="text"
                                    value={formData.kra_pin}
                                    onChange={(e) => setFormData({ ...formData, kra_pin: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground font-mono focus:ring-2 focus:ring-primary outline-none uppercase"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">NSSF Number</label>
                                <input
                                    type="text"
                                    value={formData.nssf_number}
                                    onChange={(e) => setFormData({ ...formData, nssf_number: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">SHIF Number</label>
                                <input
                                    type="text"
                                    value={formData.shif_number}
                                    onChange={(e) => setFormData({ ...formData, shif_number: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial & Contract */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="glass rounded-xl p-6 border border-border space-y-6">
                        <div className="flex items-center gap-2 text-emerald-500">
                            <DollarSign className="h-5 w-5" />
                            <h2 className="font-semibold text-foreground uppercase tracking-wider text-xs">Payroll & Bank</h2>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Basic Monthly Salary (KES)</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.basic_salary}
                                    onChange={(e) => setFormData({ ...formData, basic_salary: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-bold text-xl focus:ring-2 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Bank Name</label>
                                    <input
                                        type="text"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                        className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Account Number</label>
                                    <input
                                        type="text"
                                        value={formData.bank_account}
                                        onChange={(e) => setFormData({ ...formData, bank_account: e.target.value })}
                                        className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground font-mono focus:ring-2 focus:ring-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="glass rounded-xl p-6 border border-border">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-emerald-400">
                                    <TrendingUp className="h-4 w-4" />
                                    <h2 className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Standard Allowances</h2>
                                </div>
                                <button type="button" onClick={addAllowance} className="p-1 px-2 rounded bg-primary/20 text-primary text-[10px] font-bold hover:bg-primary/30">ADD</button>
                            </div>
                            <div className="space-y-2">
                                {allowances.map((a, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            placeholder="Name"
                                            value={a.name}
                                            onChange={(e) => {
                                                const newA = [...allowances];
                                                newA[i].name = e.target.value;
                                                setAllowances(newA);
                                            }}
                                            className="flex-1 bg-muted border border-white/10 rounded py-1.5 px-3 text-sm text-foreground outline-none"
                                        />
                                        <input
                                            placeholder="Amount"
                                            type="number"
                                            value={a.amount}
                                            onChange={(e) => {
                                                const newA = [...allowances];
                                                newA[i].amount = e.target.value;
                                                setAllowances(newA);
                                            }}
                                            className="w-20 bg-muted border border-white/10 rounded py-1.5 px-3 text-sm text-foreground outline-none font-bold text-right"
                                        />
                                        <select
                                            value={a.calculation_type}
                                            onChange={(e) => {
                                                const newA = [...allowances];
                                                newA[i].calculation_type = e.target.value as any;
                                                setAllowances(newA);
                                            }}
                                            className="w-24 bg-muted border border-white/10 rounded py-1.5 px-2 text-[10px] text-foreground outline-none"
                                        >
                                            <option value="fixed">Fixed</option>
                                            <option value="percentage">%</option>
                                        </select>
                                        {a.calculation_type === 'percentage' && (
                                            <select
                                                value={a.percentage_basis}
                                                onChange={(e) => {
                                                    const newA = [...allowances];
                                                    newA[i].percentage_basis = e.target.value as any;
                                                    setAllowances(newA);
                                                }}
                                                className="w-20 bg-muted border border-white/10 rounded py-1.5 px-2 text-[10px] text-foreground outline-none"
                                            >
                                                <option value="basic">of Basic</option>
                                                <option value="gross">of Gross</option>
                                            </select>
                                        )}
                                        <button type="button" onClick={() => setAllowances(allowances.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="glass rounded-xl p-6 border border-border">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-primary">
                                    <TrendingDown className="h-4 w-4" />
                                    <h2 className="font-semibold text-foreground uppercase tracking-wider text-[10px]">Standard Deductions</h2>
                                </div>
                                <button type="button" onClick={addDeduction} className="p-1 px-2 rounded bg-primary/20 text-primary text-[10px] font-bold hover:bg-primary/30">ADD</button>
                            </div>
                            <div className="space-y-2">
                                {deductions.map((d, i) => (
                                    <div key={i} className="flex gap-2">
                                        <input
                                            placeholder="Name"
                                            value={d.name}
                                            onChange={(e) => {
                                                const newD = [...deductions];
                                                newD[i].name = e.target.value;
                                                setDeductions(newD);
                                            }}
                                            className="flex-1 bg-muted border border-white/10 rounded py-1.5 px-3 text-sm text-foreground outline-none"
                                        />
                                        <input
                                            placeholder="Amount"
                                            type="number"
                                            value={d.amount}
                                            onChange={(e) => {
                                                const newD = [...deductions];
                                                newD[i].amount = e.target.value;
                                                setDeductions(newD);
                                            }}
                                            className="w-20 bg-muted border border-white/10 rounded py-1.5 px-3 text-sm text-foreground outline-none font-bold text-right"
                                        />
                                        <select
                                            value={d.calculation_type}
                                            onChange={(e) => {
                                                const newD = [...deductions];
                                                newD[i].calculation_type = e.target.value as any;
                                                setDeductions(newD);
                                            }}
                                            className="w-24 bg-muted border border-white/10 rounded py-1.5 px-2 text-[10px] text-foreground outline-none"
                                        >
                                            <option value="fixed">Fixed</option>
                                            <option value="percentage">%</option>
                                        </select>
                                        {d.calculation_type === 'percentage' && (
                                            <select
                                                value={d.percentage_basis}
                                                onChange={(e) => {
                                                    const newD = [...deductions];
                                                    newD[i].percentage_basis = e.target.value as any;
                                                    setDeductions(newD);
                                                }}
                                                className="w-20 bg-muted border border-white/10 rounded py-1.5 px-2 text-[10px] text-foreground outline-none"
                                            >
                                                <option value="basic">of Basic</option>
                                                <option value="gross">of Gross</option>
                                            </select>
                                        )}
                                        <button type="button" onClick={() => setDeductions(deductions.filter((_, idx) => idx !== i))} className="p-1.5 text-slate-600 hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 p-6 glass rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Discard Changes
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Saving...' : 'Save HR & Contract'}
                    </button>
                </div>
            </form>
        </div>
    );
}
