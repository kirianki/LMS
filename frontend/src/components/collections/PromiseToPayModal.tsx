'use client';

import { useState } from 'react';
import { X, DollarSign, Calendar, FileText, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

interface PromiseToPayModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: string;
    onSuccess: () => void;
}

export default function PromiseToPayModal({ isOpen, onClose, caseId, onSuccess }: PromiseToPayModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        promised_amount: '',
        promised_date: '',
        notes: ''
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post(`/loans/collection-cases/${caseId}/record_promise/`, {
                promised_amount: Number(formData.promised_amount),
                promised_date: formData.promised_date,
                notes: formData.notes
            });
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                promised_amount: '',
                promised_date: '',
                notes: ''
            });
        } catch (error: any) {
            console.error('Failed to record promise:', error);
            alert(error.response?.data?.error || 'Failed to record promise to pay');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    // Get tomorrow's date as minimum
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const minDate = tomorrow.toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            Record Promise to Pay
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track borrower's payment commitment
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Promised Amount */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            Promised Amount <span className="text-red-400">*</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                KES
                            </span>
                            <input
                                type="number"
                                required
                                min="1"
                                step="0.01"
                                value={formData.promised_amount}
                                onChange={(e) => setFormData({ ...formData, promised_amount: e.target.value })}
                                placeholder="0.00"
                                className="w-full bg-input border border-border rounded-xl py-3 pl-16 pr-4 text-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    {/* Promised Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Promised Payment Date <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="date"
                            required
                            min={minDate}
                            value={formData.promised_date}
                            onChange={(e) => setFormData({ ...formData, promised_date: e.target.value })}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                        <p className="text-xs text-muted-foreground italic pl-1">
                            Date when the borrower commits to make the payment
                        </p>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Additional Notes
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Any additional context about this promise (e.g., source of funds, conditions)..."
                            rows={3}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
                        <CheckCircle2 className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs text-blue-400 leading-relaxed">
                            <p className="font-semibold mb-1">Promise Tracking</p>
                            <p>
                                This promise will be automatically tracked. If payment is received on or before the promised date,
                                it will be marked as "Kept". Otherwise, it will be marked as "Broken" to help assess borrower reliability.
                            </p>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 rounded-xl bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-600/20"
                        >
                            {isSubmitting ? 'Recording...' : 'Record Promise'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
