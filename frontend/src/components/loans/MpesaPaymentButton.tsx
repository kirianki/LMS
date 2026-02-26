'use client';

import { useState } from 'react';
import { Phone, Send, Loader2, Smartphone, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface MpesaPaymentButtonProps {
    loan: any;
    installment?: any;
    onSuccess?: () => void;
}

export default function MpesaPaymentButton({ loan, installment, onSuccess }: MpesaPaymentButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [phone, setPhone] = useState(loan.borrower_details?.mpesa_number || loan.borrower_phone || '');
    const [amount, setAmount] = useState(() => {
        if (installment) {
            const due = Number(installment.total_due) + Number(installment.penalty_due || 0);
            const remaining = due - Number(installment.paid_amount || 0);
            return remaining.toFixed(2);
        }
        return Number(loan.outstanding_balance).toFixed(2);
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleInitiate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setStatus('idle');
        setMessage('');

        try {
            const response = await api.post(`/loans/loans/${loan.id}/initiate-mpesa-payment/`, {
                phone_number: phone,
                amount: Number(amount),
                installment_id: installment?.id
            });

            setStatus('success');
            setMessage(response.data.message || 'Payment request sent! Please check your phone.');

            if (onSuccess) {
                // We might want to delay this or wait for webhook, 
                // but for UI responsiveness we can call it after a short delay
                setTimeout(onSuccess, 3000);
            }

            // Auto close after success
            setTimeout(() => {
                setIsOpen(false);
                setStatus('idle');
                setMessage('');
            }, 5000);

        } catch (error: any) {
            console.error('Failed to initiate M-Pesa payment:', error);
            setStatus('error');
            setMessage(error.response?.data?.error || 'Failed to initiate payment. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#25D366] text-white font-semibold hover:bg-[#1ebd54] transition-all shadow-lg shadow-green-500/20 text-sm"
            >
                <Smartphone className="h-4 w-4" />
                Lipa na M-Pesa
            </button>

            {isOpen && (
                <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="glass rounded-3xl border border-border w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="p-6 bg-gradient-to-br from-[#25D366]/10 to-transparent border-b border-border">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-2xl bg-[#25D366]/20">
                                    <Smartphone className="h-6 w-6 text-[#25D366]" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Initiate M-Pesa</h3>
                                    <p className="text-xs text-muted-foreground">Request payment directly to customer</p>
                                </div>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="p-6 space-y-4">
                            {status === 'success' ? (
                                <div className="py-8 text-center space-y-4 animate-in slide-in-from-bottom-4 duration-300">
                                    <div className="mx-auto w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
                                        <CheckCircle2 className="h-10 w-10 text-green-500" />
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-lg font-bold text-foreground">Request Sent!</h4>
                                        <p className="text-sm text-muted-foreground px-4 text-pretty">
                                            {message}
                                        </p>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground animate-pulse">
                                        The loan balance will update automatically once confirmed.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleInitiate} className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground ml-1">
                                            Amount (KES)
                                        </label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            required
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366] transition-all"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-medium text-muted-foreground ml-1">
                                            Customer Phone Number
                                        </label>
                                        <div className="relative">
                                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                            <input
                                                type="tel"
                                                required
                                                placeholder="2547XXXXXXXX"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-[#25D366] transition-all"
                                            />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground ml-1">
                                            Use format: 254712345678
                                        </p>
                                    </div>

                                    {status === 'error' && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-500 animate-in shake duration-300">
                                            {message}
                                        </div>
                                    )}

                                    <div className="flex gap-3 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsOpen(false)}
                                            disabled={isSubmitting}
                                            className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={isSubmitting || !amount || !phone}
                                            className="flex-1 px-4 py-3 rounded-xl bg-[#25D366] text-white font-semibold hover:bg-[#1ebd54] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                                        >
                                            {isSubmitting ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    Sending...
                                                </>
                                            ) : (
                                                <>
                                                    <Send className="h-4 w-4" />
                                                    Send STK Push
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
