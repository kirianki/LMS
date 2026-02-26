'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    Download,
    CheckCircle,
    Clock,
    Banknote,
    Receipt,
    User as UserIcon,
    Calendar,
    Briefcase,
    TrendingUp,
    TrendingDown,
    Printer,
    Check
} from 'lucide-react';
import api from '@/lib/api';
import { useToast } from '@/components/ui/use-toast';

interface PayrollRecord {
    id: string;
    user: string;
    user_name: string;
    user_email: string;
    contract: string;
    month: number;
    year: number;
    gross_pay: string;
    nssf: string;
    shif: string;
    paye: string;
    housing_levy: string;
    other_deductions: string;
    net_pay: string;
    status: string;
    payment_date: string | null;
    reference: string;
    created_at: string;
    processed_by: string;
    approved_by: string | null;
    approved_at: string | null;
}

export default function PayrollDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const { toast } = useToast();
    const [record, setRecord] = useState<PayrollRecord | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cashAccounts, setCashAccounts] = useState<any[]>([]);
    const [selectedAccountId, setSelectedAccountId] = useState<string>('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    const fetchPayrollDetail = async () => {
        try {
            setIsLoading(true);
            const response = await api.get(`/payroll/${params.id}/`);
            setRecord(response.data);

            // Fetch accounts if status is approved (ready for payment)
            if (response.data.status === 'approved') {
                const accRes = await api.get('/treasury/accounts/');
                setCashAccounts(accRes.data.results || accRes.data);
            }
        } catch (error) {
            console.error('Failed to fetch payroll detail:', error);
            toast({
                title: 'Error',
                description: 'Failed to load payroll details',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (params.id) {
            fetchPayrollDetail();
        }
    }, [params.id]);

    const handlePrint = async () => {
        try {
            const response = await api.get(`/payroll/${params.id}/payslip/`, {
                responseType: 'blob',
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `payslip_${record?.user_name || 'staff'}_${record?.month}_${record?.year}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error('Failed to download payslip:', error);
            toast({
                title: 'Error',
                description: 'Failed to generate payslip PDF',
                variant: 'destructive',
            });
        }
    };

    const handleApprove = async () => {
        if (!confirm('Are you sure you want to approve this payroll record?')) return;
        setIsSubmitting(true);
        try {
            await api.post(`/payroll/${params.id}/approve/`);
            toast({
                title: 'Success',
                description: 'Payroll record approved successfully',
            });
            fetchPayrollDetail();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to approve payroll',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePay = async () => {
        if (!selectedAccountId) {
            toast({
                title: 'Required',
                description: 'Please select an origin account',
                variant: 'destructive'
            });
            return;
        }

        const reference = prompt('Enter payment reference (optional):');
        if (reference === null) return;

        setIsSubmitting(true);
        try {
            await api.post(`/payroll/${params.id}/pay/`, {
                account_id: selectedAccountId,
                reference
            });
            toast({
                title: 'Success',
                description: 'Payroll record marked as paid and treasury transaction recorded',
            });
            setShowPaymentModal(false);
            fetchPayrollDetail();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to process payment',
                variant: 'destructive'
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (amount: string | number) => {
        const value = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(value);
    };

    const getMonthName = (month: number) => {
        return new Date(2000, month - 1).toLocaleString('default', { month: 'long' });
    };

    if (isLoading) return <div className="p-8 text-center text-muted-foreground italic">Loading payroll breakdown...</div>;
    if (!record) return <div className="p-8 text-center text-red-500">Payroll record not found.</div>;

    const totalStatutory = parseFloat(record.nssf) + parseFloat(record.shif) + parseFloat(record.paye) + parseFloat(record.housing_levy);

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all border border-transparent hover:border-border"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground font-heading">Payroll Breakdown</h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${record.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                record.status === 'approved' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                                    'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                }`}>
                                {record.status}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1 flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            For {getMonthName(record.month)} {record.year} • Processed on {new Date(record.created_at).toLocaleDateString()}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-input border border-border text-muted-foreground hover:text-foreground transition-all text-sm font-semibold"
                    >
                        <Printer className="h-4 w-4" />
                        Print Payslip
                    </button>
                    {record.status === 'draft' && (
                        <button
                            onClick={handleApprove}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500 transition-all text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Approve Payroll
                        </button>
                    )}
                    {record.status === 'approved' && (
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all text-sm font-bold shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                        >
                            <Banknote className="h-4 w-4" />
                            Mark as Paid
                        </button>
                    )}
                </div>
            </div>

            {/* Top Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-12 w-12 text-blue-400" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Gross Earnings</p>
                    <h3 className="text-3xl font-black text-foreground tracking-tight">{formatCurrency(record.gross_pay)}</h3>
                    <p className="text-[10px] text-blue-400 mt-2 font-bold flex items-center gap-1">
                        <Check className="h-3 w-3" />
                        INCLUDES ALLOWANCES
                    </p>
                </div>
                <div className="glass rounded-2xl p-6 border border-border relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                        <TrendingDown className="h-12 w-12 text-red-400" />
                    </div>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Deductions</p>
                    <h3 className="text-3xl font-black text-foreground tracking-tight">{formatCurrency(totalStatutory + parseFloat(record.other_deductions))}</h3>
                    <p className="text-[10px] text-red-400 mt-2 font-bold flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        STATUTORY & VOLUNTARY
                    </p>
                </div>
                <div className="glass rounded-2xl p-8 border border-primary/30 bg-primary/5 shadow-2xl shadow-primary/10 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-20 group-hover:rotate-12 transition-transform">
                        <Banknote className="h-16 w-16 text-primary" />
                    </div>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Net Take Home</p>
                    <h3 className="text-4xl font-black text-foreground tracking-tighter">{formatCurrency(record.net_pay)}</h3>
                    <div className="mt-4 pt-4 border-t border-primary/20">
                        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Payable via {record.reference || 'Bank Transfer'}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Staff Info & Summary */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass rounded-2xl p-6 border border-border space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center border border-border">
                                <UserIcon className="h-6 w-6 text-muted-foreground" />
                            </div>
                            <div>
                                <h4 className="font-bold text-foreground">{record.user_name}</h4>
                                <p className="text-xs text-muted-foreground">{record.user_email}</p>
                            </div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-border">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-2"><Briefcase className="h-4 w-4" /> Employee ID</span>
                                <span className="font-mono text-xs font-bold">STF-{record.id.split('-')[0].toUpperCase()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground flex items-center gap-2"><Calendar className="h-4 w-4" /> Period</span>
                                <span className="font-bold text-foreground">{getMonthName(record.month)} {record.year}</span>
                            </div>
                            {record.payment_date && (
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="h-4 w-4 text-emerald-500" /> Paid Date</span>
                                    <span className="font-bold text-emerald-500">{new Date(record.payment_date).toLocaleDateString()}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="glass rounded-2xl p-6 border border-border overflow-hidden">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="w-1 h-4 bg-primary rounded-full" />
                            <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">System Approval</h4>
                        </div>
                        <div className="space-y-4">
                            <div className="p-4 rounded-xl bg-muted/50 border border-border">
                                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 text-center">Reference ID</p>
                                <p className="font-mono text-center text-xs break-all">{record.id}</p>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground italic">
                                <Clock className="h-3.5 w-3.5" />
                                <span>Record locked after processing. Changes require administrative override.</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Earnings & Deductions Breakdown */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Statutory Deductions */}
                    <div className="glass rounded-2xl border border-border overflow-hidden">
                        <div className="p-6 border-b border-border bg-muted/30">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <TrendingDown className="h-4 w-4 text-red-400" />
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">KRA & Statutory Deductions</h4>
                                </div>
                                <span className="text-xs font-bold text-red-400">{formatCurrency(totalStatutory)}</span>
                            </div>
                        </div>
                        <div className="divide-y divide-border">
                            <div className="px-6 py-4 flex justify-between items-center hover:bg-muted/20 transition-colors">
                                <span className="text-sm font-medium text-muted-foreground">SHIF (2.75%)</span>
                                <span className="font-bold text-foreground">{formatCurrency(record.shif)}</span>
                            </div>
                            <div className="px-6 py-4 flex justify-between items-center hover:bg-muted/20 transition-colors">
                                <span className="text-sm font-medium text-muted-foreground">NSSF (Tier I & II)</span>
                                <span className="font-bold text-foreground">{formatCurrency(record.nssf)}</span>
                            </div>
                            <div className="px-6 py-4 flex justify-between items-center hover:bg-muted/20 transition-colors">
                                <span className="text-sm font-medium text-muted-foreground">Affordable Housing Levy (1.5%)</span>
                                <span className="font-bold text-foreground">{formatCurrency(record.housing_levy)}</span>
                            </div>
                            <div className="px-6 py-4 flex justify-between items-center bg-red-500/5 hover:bg-red-500/10 transition-colors">
                                <span className="text-sm font-bold text-red-500">PAYE (Tax)</span>
                                <span className="font-bold text-red-500 font-heading">{formatCurrency(record.paye)}</span>
                            </div>
                        </div>
                    </div>

                    {/* Voluntary Deductions */}
                    {parseFloat(record.other_deductions) > 0 && (
                        <div className="glass rounded-2xl border border-border overflow-hidden">
                            <div className="p-6 border-b border-border bg-muted/30">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-bold text-foreground uppercase tracking-widest">Other Deductions</h4>
                                    <span className="text-xs font-bold text-red-400">{formatCurrency(record.other_deductions)}</span>
                                </div>
                            </div>
                            <div className="px-6 py-4 flex justify-between items-center italic text-sm text-muted-foreground">
                                <span>Includes Sacco, Welfare, or Loans</span>
                                <span className="font-bold text-foreground not-italic">{formatCurrency(record.other_deductions)}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Account Selection Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="glass w-full max-w-md rounded-2xl border border-border p-8 space-y-6 shadow-2xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xl font-bold text-foreground">Complete Payment</h3>
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="text-muted-foreground hover:text-foreground p-1"
                            >
                                <ArrowLeft className="h-5 w-5 rotate-90" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Select the bank or cash account to deduct <strong>{formatCurrency(record.net_pay)}</strong> for {record.user_name}.
                            </p>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Origin Account</label>
                                <select
                                    className="w-full bg-input border border-border rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                                    value={selectedAccountId}
                                    onChange={(e) => setSelectedAccountId(e.target.value)}
                                >
                                    <option value="">Select Account...</option>
                                    {cashAccounts.map(account => (
                                        <option key={account.id} value={account.id}>
                                            {account.name} (KES {parseFloat(account.current_balance).toLocaleString()})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={() => setShowPaymentModal(false)}
                                className="flex-1 px-4 py-3 rounded-xl border border-border text-sm font-bold hover:bg-muted transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handlePay}
                                disabled={isSubmitting || !selectedAccountId}
                                className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-500 shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                            >
                                {isSubmitting ? 'Processing...' : 'Confirm Payment'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
