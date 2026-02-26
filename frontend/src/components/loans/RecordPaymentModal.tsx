'use client';

import { useState, useEffect } from 'react';
import { X, DollarSign, Calendar, CreditCard, FileText, AlertCircle, CheckCircle2, Wallet } from 'lucide-react';
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
            // Handle pagination from backend
            const data = response.data.results || response.data;

            if (!Array.isArray(data)) {
                console.error('Expected array of accounts, got:', data);
                return;
            }

            setAccounts(data);

            // Auto-select based on payment method
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

        // Find match by account_type or fallback to first
        const account = treasuryList.find(acc => acc.account_type === type) || treasuryList[0];
        const finalId = account?.id || '';

        setFormData((prev: any) => ({ ...prev, cash_account_id: finalId }));
    };

    const calculateAllocation = async () => {
        setIsLoading(true);
        try {
            // Simulate allocation calculation (backend does this automatically on POST)
            const amount = Number(formData.amount);
            const outstandingPenalties = Number(loan.outstanding_penalties || 0);
            const outstandingInterest = Number(loan.outstanding_interest || 0);
            const outstandingPrincipal = Number(loan.outstanding_principal || 0);

            let remaining = amount;
            const penaltyPaid = Math.min(remaining, outstandingPenalties);
            remaining -= penaltyPaid;

            const interestPaid = Math.min(remaining, outstandingInterest);
            remaining -= interestPaid;

            const principalPaid = Math.min(remaining, outstandingPrincipal);

            setAllocation({
                penalty_paid: penaltyPaid,
                interest_paid: interestPaid,
                principal_paid: principalPaid,
                total: amount
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
            await api.post(`/loans/loans/${loan.id}/repayments/`, {
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
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading">Record Payment</h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Loan: {loan.loan_number} | {loan.borrower_name}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Outstanding Balance Summary */}
                    <div className="grid grid-cols-3 gap-4 p-4 rounded-xl bg-muted/30 border border-border">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Principal</p>
                            <p className="text-sm font-bold text-foreground">
                                KES {Number(loan.outstanding_principal).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Interest</p>
                            <p className="text-sm font-bold text-foreground">
                                KES {Number(loan.outstanding_interest).toLocaleString()}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Penalties</p>
                            <p className="text-sm font-bold text-orange-400">
                                KES {Number(loan.outstanding_penalties || 0).toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Payment Amount */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Payment Amount <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="number"
                                step="0.01"
                                min="0"
                                required
                                value={formData.amount}
                                onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                placeholder="0.00"
                            />
                        </div>
                    </div>

                    {/* Allocation Preview */}
                    {allocation && (
                        <div className="space-y-3 p-4 rounded-xl bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 text-primary mb-2">
                                <CheckCircle2 className="h-4 w-4" />
                                <p className="text-sm font-semibold">Payment Allocation Preview</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                {allocation.penalty_paid > 0 && (
                                    <div>
                                        <p className="text-xs text-muted-foreground">Penalties</p>
                                        <p className="text-sm font-semibold text-orange-400">
                                            KES {allocation.penalty_paid.toLocaleString()}
                                        </p>
                                    </div>
                                )}
                                <div>
                                    <p className="text-xs text-muted-foreground">Interest</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        KES {allocation.interest_paid.toLocaleString()}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-muted-foreground">Principal</p>
                                    <p className="text-sm font-semibold text-foreground">
                                        KES {allocation.principal_paid.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Payment Date <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="date"
                                required
                                value={formData.payment_date}
                                onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                            />
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Payment Method <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { value: 'mpesa', label: 'M-Pesa' },
                                { value: 'cash', label: 'Cash' },
                                { value: 'bank_transfer', label: 'Bank Transfer' },
                                { value: 'cheque', label: 'Cheque' }
                            ].map((method) => (
                                <button
                                    key={method.value}
                                    type="button"
                                    onClick={() => {
                                        setFormData({ ...formData, payment_method: method.value });
                                        updateDefaultAccount(method.value, accounts);
                                    }}
                                    className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${formData.payment_method === method.value
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                                        }`}
                                >
                                    {method.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Treasury Account Selection */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Deposit to Treasury Account <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <select
                                required
                                value={formData.cash_account_id}
                                onChange={(e) => setFormData({ ...formData, cash_account_id: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none transition-all"
                            >
                                <option value="" disabled>Select receiving account...</option>
                                {accounts.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                        {acc.name} ({acc.coa_account_code || 'No Code'})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="text-[10px] text-muted-foreground ml-1 mt-1">
                            This payment will debit the selected treasury account and update the ledger.
                        </p>
                    </div>

                    {/* Reference Number */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Reference Number
                        </label>
                        <div className="relative">
                            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="text"
                                value={formData.reference_number}
                                onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                placeholder="e.g., Transaction ID, Cheque #"
                            />
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-muted-foreground ml-1">
                            Notes (Optional)
                        </label>
                        <textarea
                            rows={3}
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                            placeholder="Additional payment details..."
                        />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || !formData.amount || Number(formData.amount) <= 0}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? 'Recording...' : 'Record Payment'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
