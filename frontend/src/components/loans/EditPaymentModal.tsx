'use client';

import { useState, useEffect } from 'react';
import { X, Save, AlertCircle, DollarSign, Calendar, CreditCard } from 'lucide-react';
import api from '@/lib/api';

interface Repayment {
    id: string;
    payment_date: string;
    payment_method: string;
    reference_number: string;
    amount: number;
    notes?: string;
    cash_account_id?: string;
}

interface EditPaymentModalProps {
    loanId: string;
    payment: Repayment | null;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function EditPaymentModal({ loanId, payment, isOpen, onClose, onSuccess }: EditPaymentModalProps) {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState('');
    const [method, setMethod] = useState('');
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (payment) {
            setAmount(payment.amount.toString());
            setDate(payment.payment_date);
            setMethod(payment.payment_method);
            setReference(payment.reference_number || '');
            setNotes(payment.notes || '');
            setError(null);
        }
    }, [payment]);

    if (!isOpen || !payment) return null;

    const handleSave = async () => {
        setIsSaving(true);
        setError(null);
        try {
            await api.patch(`/loans/${loanId}/repayments/`, {
                repayment_id: payment.id,
                amount: parseFloat(amount),
                payment_date: date,
                payment_method: method,
                reference_number: reference,
                notes: notes
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to update payment. Please ensure all values are valid.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-background w-full max-w-lg rounded-[2.5rem] border border-border shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                <div className="p-8 border-b border-border flex items-center justify-between bg-muted/30">
                    <div>
                        <h2 className="text-2xl font-black text-foreground">Edit Payment</h2>
                        <p className="text-xs text-foreground mt-1">Adjusting this payment will trigger a full loan reconciliation.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-muted rounded-full transition-colors">
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="p-8 space-y-6">
                    {error && (
                        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center gap-3 text-rose-600 animate-shake">
                            <AlertCircle className="h-5 w-5" />
                            <p className="text-sm font-bold">{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Payment Amount (KES)</label>
                            <div className="relative">
                                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Date</label>
                                <div className="relative">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="date"
                                        value={date}
                                        onChange={(e) => setDate(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Method</label>
                                <div className="relative">
                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <select
                                        value={method}
                                        onChange={(e) => setMethod(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold text-sm appearance-none"
                                    >
                                        <option value="mpesa">M-Pesa</option>
                                        <option value="bank">Bank</option>
                                        <option value="cash">Cash</option>
                                        <option value="cheque">Cheque</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Reference Number</label>
                            <input
                                type="text"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                className="w-full px-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold"
                                placeholder="E.g. RK8293XJ91"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-[10px] font-black text-foreground uppercase tracking-widest ml-1">Internal Notes</label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                className="w-full px-4 py-4 rounded-2xl bg-muted/50 border border-border focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold min-h-[100px] resize-none"
                                placeholder="Reason for correction..."
                            />
                        </div>
                    </div>
                </div>

                <div className="p-8 bg-muted/30 border-t border-border flex items-center gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-6 py-4 rounded-2xl bg-white border border-border text-foreground font-black hover:bg-muted transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="flex-1 px-6 py-4 rounded-2xl bg-primary text-white font-black hover:shadow-xl hover:shadow-primary/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isSaving ? (
                            <><div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> Saving...</>
                        ) : (
                            <><Save className="h-4 w-4" /> Save Corrections</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
