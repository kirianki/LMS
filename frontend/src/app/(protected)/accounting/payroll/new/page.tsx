'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Users, Calendar, Calculator } from 'lucide-react';
import api from '@/lib/api';

interface Staff {
    id: string;
    full_name: string;
    base_salary: number;
    employee_number: string;
}

export default function NewPayrollPage() {
    const router = useRouter();
    const [staff, setStaff] = useState<Staff[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        staff: '',
        period: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
        basic_pay: 0,
    });

    useEffect(() => {
        const fetchStaff = async () => {
            try {
                const response = await api.get('/expenses/staff/');
                setStaff(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch staff:', error);
            }
        };
        fetchStaff();
    }, []);

    const handleStaffChange = (staffId: string) => {
        const selected = staff.find(s => s.id === staffId);
        setFormData({
            ...formData,
            staff: staffId,
            basic_pay: selected ? parseFloat(selected.base_salary.toString()) : 0
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/expenses/payroll/', formData);
            router.push('/accounting/payroll');
        } catch (error) {
            console.error('Failed to generate payroll:', error);
            alert('Failed to generate payroll. Ensure the period is unique for this staff member.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">New Payroll Entry</h1>
                    <p className="text-muted-foreground mt-1">Generate a payslip for a staff member</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Select Staff</label>
                            <div className="relative">
                                <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <select
                                    required
                                    value={formData.staff}
                                    onChange={(e) => handleStaffChange(e.target.value)}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none"
                                >
                                    <option value="">Select Employee</option>
                                    {staff.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name} ({s.employee_number})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Payroll Period</label>
                            <div className="relative">
                                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="month"
                                    required
                                    value={formData.period}
                                    onChange={(e) => setFormData({ ...formData, period: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mb-1">Estimated Basic Pay</p>
                            <p className="text-2xl font-bold text-foreground">KES {formData.basic_pay.toLocaleString()}</p>
                        </div>
                        <Calculator className="h-8 w-8 text-primary opacity-50" />
                    </div>

                    <div className="flex items-start gap-3 p-4 bg-input border border-border rounded-lg text-xs text-muted-foreground">
                        <p>
                            Generating this entry will create a draft payslip based on the employee's base salary.
                            You can add allowances and deductions on the next screen after saving.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Generating...' : 'Generate Payslip'}
                    </button>
                </div>
            </form>
        </div>
    );
}
