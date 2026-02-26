'use client';

import { useState } from 'react';
import { X, PhoneCall, MessageSquare, Mail, MapPin, FileText, Calendar } from 'lucide-react';
import api from '@/lib/api';

interface LogInteractionModalProps {
    isOpen: boolean;
    onClose: () => void;
    caseId: string;
    onSuccess: () => void;
}

export default function LogInteractionModal({ isOpen, onClose, caseId, onSuccess }: LogInteractionModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        contact_method: 'phone',
        note: '',
        customer_response: '',
        next_follow_up: ''
    });

    const contactMethods = [
        { value: 'phone', label: 'Phone Call', icon: PhoneCall, color: 'emerald' },
        { value: 'sms', label: 'SMS', icon: MessageSquare, color: 'blue' },
        { value: 'email', label: 'Email', icon: Mail, color: 'purple' },
        { value: 'visit', label: 'Physical Visit', icon: MapPin, color: 'orange' },
        { value: 'letter', label: 'Letter', icon: FileText, color: 'slate' },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post(`/loans/collection-cases/${caseId}/log_interaction/`, formData);
            onSuccess();
            onClose();
            // Reset form
            setFormData({
                contact_method: 'phone',
                note: '',
                customer_response: '',
                next_follow_up: ''
            });
        } catch (error: any) {
            console.error('Failed to log interaction:', error);
            alert(error.response?.data?.error || 'Failed to log interaction');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                            <PhoneCall className="h-6 w-6 text-primary" />
                            Log Collection Activity
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Record interaction with borrower
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Contact Method Selection */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-foreground">Contact Method</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {contactMethods.map((method) => {
                                const Icon = method.icon;
                                const isSelected = formData.contact_method === method.value;
                                return (
                                    <button
                                        key={method.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, contact_method: method.value })}
                                        className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${isSelected
                                                ? `border-${method.color}-500 bg-${method.color}-500/10`
                                                : 'border-border bg-muted/20 hover:border-primary/50'
                                            }`}
                                    >
                                        <Icon className={`h-5 w-5 ${isSelected ? `text-${method.color}-500` : 'text-muted-foreground'}`} />
                                        <span className={`text-xs font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {method.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Interaction Notes */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                            Interaction Details <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            required
                            value={formData.note}
                            onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                            placeholder="Describe the collection activity, what was discussed, actions taken..."
                            rows={4}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Customer Response */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                            Borrower's Response
                        </label>
                        <textarea
                            value={formData.customer_response}
                            onChange={(e) => setFormData({ ...formData, customer_response: e.target.value })}
                            placeholder="Record the borrower's response, commitments, or concerns..."
                            rows={3}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Next Follow-up */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Next Follow-up Date
                        </label>
                        <input
                            type="date"
                            value={formData.next_follow_up}
                            onChange={(e) => setFormData({ ...formData, next_follow_up: e.target.value })}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
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
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? 'Logging...' : 'Log Interaction'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
