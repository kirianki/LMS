'use client';

import { useState, useEffect } from 'react';
import { X, Banknote, Calendar, CreditCard, FileText, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';
import api from '@/lib/api';

interface RecordPaymentModalProps {
    loan: any;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    installment?: any;
}

export default function RecordPaymentModal({ loan, isOpen, onClose, onSuccess, installment }: RecordPaymentModalProps) {
    const [formData, setFormData] = useState<any>({
        amount: installment ? (Number(installment.total_due) - Number(installment.paid_amount)).toString() : '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'mpesa',
        reference_number: '',
        cash_account_id: '',
        notes: '',
        principal_paid: '',
        interest_paid: '',
        penalty_paid: '',
    });
    const [accounts, setAccounts] = useState<any[]>([]);
    const [allocation, setAllocation] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        fetchTreasuryAccounts();
    }, []);

    useEffect(() => {
        if (formData.amount && Number(formData.amount) > 0) {
            calculateAllocation();
        } else {
            setAllocation(null);
        }
    }, [formData.amount]);

    const fetchTreasuryAccounts = async () => {
        try {
            const response = await api.get('/treasury/accounts/');
            const data = response.data.results || response.data;
            if (!Array.isArray(data)) return;
            setAccounts(data);
            updateDefaultAccount(formData.payment_method, data);
        } catch (error) {
            console.error('Failed to fetch treasury accounts:', error);
        }
    };

    const updateDefaultAccount = (method: string, treasuryList: any[]) => {
        let type = '';
        if (method === 'mpesa') type = 'mobile_money';
        else if (method === 'cash') type = 'cash';
        else if (method === 'bank_transfer') type = 'bank';

        const account = treasuryList.find(acc => acc.account_type === type) || treasuryList[0];
        setFormData((prev: any) => ({ ...prev, cash_account_id: account?.id || '' }));
    };

    const calculateAllocation = async () => {
        setIsLoading(true);
        try {
            const amount = Number(formData.amount);
            let remaining = amount;
            let penaltyPaid = 0;
            let interestPaid = 0;
            let principalPaid = 0;

            if (installment) {
                const penaltyDue = Number(installment.penalty_due || 0);
                const interestDue = Number(installment.interest_due || 0);
                const principalDue = Number(installment.principal_due || 0);
                const penAlreadyPaid = Number(installment.penalty_paid || 0);
                const intAlreadyPaid = Number(installment.interest_paid || 0);
                const priAlreadyPaid = Number(installment.principal_paid || 0);

                const penaltyRemaining = Math.max(0, penaltyDue - penAlreadyPaid);
                const interestRemaining = Math.max(0, interestDue - intAlreadyPaid);
                const principalRemaining = Math.max(0, principalDue - priAlreadyPaid);

                penaltyPaid = Math.min(remaining, penaltyRemaining);
                remaining -= penaltyPaid;
                interestPaid = Math.min(remaining, interestRemaining);
                remaining -= interestPaid;
                principalPaid = Math.min(remaining, principalRemaining);
                remaining -= principalPaid;
            } else {
                const outstandingPenalties = Number(loan.outstanding_penalties || 0);
                const outstandingInterest = Number(loan.outstanding_interest || 0);
                const outstandingPrincipal = Number(loan.outstanding_principal || 0);

                penaltyPaid = Math.min(remaining, outstandingPenalties);
                remaining -= penaltyPaid;
                interestPaid = Math.min(remaining, outstandingInterest);
                remaining -= interestPaid;
                principalPaid = Math.min(remaining, outstandingPrincipal);
                remaining -= principalPaid;
            }

            setAllocation({
                penalty_paid: penaltyPaid,
                interest_paid: interestPaid,
                principal_paid: principalPaid,
                overpayment: remaining,
                total: amount,
            });
        } catch (error) {
            console.error('Failed to calculate allocation:', error);
        } finally {
            setIsLoading(false);
        }
    };


    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post(`/loans/${loan.id}/repayments/`, {
                ...formData,
                amount: Number(formData.amount),
                installment_id: installment?.id
            });
            onSuccess();
            onClose();
            resetForm();
        } catch (error) {
            console.error('Failed to record payment:', error);
            alert('Failed to record payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            amount: '',
            payment_date: new Date().toISOString().split('T')[0],
            payment_method: 'mpesa',
            reference_number: '',
            cash_account_id: '',
            notes: ''
        });
        setAllocation(null);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="glass rounded-[2.5rem] border border-border w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-8 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Record Payment</h2>
                        <p className="text-[10px] text-foreground mt-1 uppercase tracking-widest font-bold">
                            {loan.loan_number} • {loan.borrower_name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-all"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Form Body */}
                <div className="p-8 overflow-y-auto flex-1 space-y-6">
                    <form id="recordPaymentForm" onSubmit={handleSubmit} className="space-y-6">
                        {/* Outstanding Balance Summary */}
                        <div className="grid grid-cols-3 gap-6 p-6 rounded-3xl bg-muted/30 border border-border relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-2 opacity-5">
                                <Banknote className="h-12 w-12" />
                            </div>
                            <div className="space-y-1 relative z-10">
                                <p className="text-[10px] font-black text-foreground uppercase tracking-widest opacity-60">Penalties Due</p>
                                <p className={`text-sm font-black ${installment ? (Number(installment.penalty_due) > 0 ? 'text-orange-500' : 'text-foreground/40') : (Number(loan.outstanding_penalties) > 0 ? 'text-orange-500' : 'text-foreground/40')}`}>
                                    KES {installment ? Number(installment.penalty_due || 0).toLocaleString() : Number(loan.outstanding_penalties || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 relative z-10">
                                <p className="text-[10px] font-black text-foreground uppercase tracking-widest opacity-60">Interest Due</p>
                                <p className="text-sm font-black text-foreground">
                                    KES {installment ? Number(installment.interest_due || 0).toLocaleString() : Number(loan.outstanding_interest || 0).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 relative z-10">
                                <p className="text-[10px] font-black text-foreground uppercase tracking-widest opacity-60">Principal Due</p>
                                <p className="text-sm font-black text-foreground">
                                    KES {installment ? Number(installment.principal_due || 0).toLocaleString() : Number(loan.outstanding_principal || 0).toLocaleString()}
                                </p>
                            </div>
                        </div>

                        {/* Payment Amount */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                Payment Amount <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Banknote className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    required
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground font-black focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {/* Allocation Preview */}
                        {allocation && (
                            <div className="space-y-4 p-6 rounded-3xl bg-emerald-500/5 border border-emerald-500/10 animate-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-emerald-600">
                                        <CheckCircle2 className="h-4 w-4" />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Payment Allocation Preview</span>
                                    </div>
                                    {allocation.overpayment > 0 && (
                                        <span className="text-[9px] font-black uppercase tracking-widest bg-emerald-500 text-white px-2 py-0.5 rounded-lg shadow-sm">
                                            Overpayment: KES {allocation.overpayment.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <div className="grid grid-cols-3 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Penalties</p>
                                        <p className={`text-sm font-black ${allocation.penalty_paid > 0 ? 'text-orange-500' : 'text-foreground/20'}`}>
                                            KES {allocation.penalty_paid.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Interest</p>
                                        <p className={`text-sm font-black ${allocation.interest_paid > 0 ? 'text-foreground' : 'text-foreground/20'}`}>
                                            KES {allocation.interest_paid.toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] font-black text-foreground/40 uppercase tracking-widest">Principal</p>
                                        <p className={`text-sm font-black ${allocation.principal_paid > 0 ? 'text-foreground' : 'text-foreground/20'}`}>
                                            KES {allocation.principal_paid.toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid grid-cols-2 gap-6">
                            {/* Payment Date */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                    Payment Date <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.payment_date}
                                        onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                        className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground font-black text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                                    />
                                </div>
                            </div>

                            {/* Reference Number */}
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                    Reference Number
                                </label>
                                <div className="relative">
                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={formData.reference_number}
                                        onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                        className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground font-black text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                                        placeholder="TXN ID"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Payment Method */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                Payment Method <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-4 gap-3">
                                {[
                                    { value: 'mpesa', label: 'M-Pesa' },
                                    { value: 'cash', label: 'Cash' },
                                    { value: 'bank_transfer', label: 'Bank' },
                                    { value: 'cheque', label: 'Cheque' }
                                ].map((method) => (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => {
                                            setFormData({ ...formData, payment_method: method.value });
                                            updateDefaultAccount(method.value, accounts);
                                        }}
                                        className={`p-3 rounded-2xl border transition-all text-[10px] font-black uppercase tracking-tight ${formData.payment_method === method.value
                                            ? 'border-primary bg-primary text-white shadow-lg shadow-primary/20'
                                            : 'border-border bg-muted/50 text-muted-foreground hover:border-primary/50'
                                            }`}
                                    >
                                        {method.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Treasury Account Selection */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                Deposit to Treasury Account <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                                <Wallet className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <select
                                    required
                                    value={formData.cash_account_id}
                                    onChange={(e) => setFormData({ ...formData, cash_account_id: e.target.value })}
                                    className="w-full bg-muted/50 border border-border rounded-2xl py-4 pl-12 pr-4 text-foreground font-black text-xs focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary appearance-none transition-all shadow-sm"
                                >
                                    <option value="" disabled>Select receiving account...</option>
                                    {accounts.map((acc) => (
                                        <option key={acc.id} value={acc.id}>
                                            {acc.name} ({acc.coa_account_code || 'No Code'})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <p className="text-[9px] font-bold text-foreground ml-2">
                                Updates treasurer ledger and treasury account balance.
                            </p>
                        </div>

                        {/* Notes */}
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">
                                Notes
                            </label>
                            <textarea
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                className="w-full bg-muted/50 border border-border rounded-2xl py-4 px-4 text-foreground font-bold text-sm focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none shadow-sm"
                                placeholder="Optional payment details..."
                            />
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-border bg-muted/30 flex items-center gap-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl bg-white border border-border text-foreground font-black hover:bg-muted transition-all shadow-sm"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="recordPaymentForm"
                        disabled={isSubmitting || !formData.amount || Number(formData.amount) <= 0}
                        className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-black hover:shadow-xl hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Processing...</>
                        ) : (
                            <><CheckCircle2 className="h-4 w-4" /> Record Repayment</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
