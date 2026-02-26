'use client';

import { useState } from 'react';
import { X, Scale, FileText, DollarSign, Calendar, Upload, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface RecoveryActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    loanId: string;
    onSuccess: () => void;
}

export default function RecoveryActionModal({ isOpen, onClose, loanId, onSuccess }: RecoveryActionModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        action_type: 'demand_letter',
        action_date: new Date().toISOString().split('T')[0],
        details: '',
        cost_incurred: '',
        document: null as File | null
    });

    const actionTypes = [
        { value: 'demand_letter', label: 'Demand Letter Sent', severity: 'low' },
        { value: 'legal_notice', label: 'Legal Notice', severity: 'medium' },
        { value: 'court_filing', label: 'Court Filing', severity: 'high' },
        { value: 'collateral_seizure', label: 'Collateral Seizure', severity: 'high' },
        { value: 'auction', label: 'Auction Scheduled', severity: 'high' },
        { value: 'settlement', label: 'Settlement Agreement', severity: 'medium' },
        { value: 'write_off', label: 'Write-off Approved', severity: 'critical' },
    ];

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData({ ...formData, document: e.target.files[0] });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = new FormData();
            payload.append('loan', loanId);
            payload.append('action_type', formData.action_type);
            payload.append('action_date', formData.action_date);
            payload.append('details', formData.details);
            payload.append('cost_incurred', formData.cost_incurred || '0');

            if (formData.document) {
                payload.append('document', formData.document);
            }

            await api.post('/loans/recovery-actions/', payload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onSuccess();
            onClose();
            // Reset form
            setFormData({
                action_type: 'demand_letter',
                action_date: new Date().toISOString().split('T')[0],
                details: '',
                cost_incurred: '',
                document: null
            });
        } catch (error: any) {
            console.error('Failed to record recovery action:', error);
            alert(error.response?.data?.error || 'Failed to record recovery action');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const selectedAction = actionTypes.find(a => a.value === formData.action_type);
    const severityColors: any = {
        low: 'border-yellow-500/50 bg-yellow-500/5',
        medium: 'border-orange-500/50 bg-orange-500/5',
        high: 'border-red-500/50 bg-red-500/5',
        critical: 'border-red-600/50 bg-red-600/5'
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                            <Scale className="h-6 w-6 text-red-500" />
                            Record Recovery Action
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            Track legal and recovery proceedings
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Action Type */}
                    <div className="space-y-3">
                        <label className="text-sm font-semibold text-foreground">
                            Action Type <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {actionTypes.map((action) => {
                                const isSelected = formData.action_type === action.value;
                                return (
                                    <button
                                        key={action.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, action_type: action.value })}
                                        className={`p-3 rounded-xl border-2 transition-all text-left ${isSelected
                                                ? `${severityColors[action.severity]} border-2`
                                                : 'border-border bg-muted/20 hover:border-primary/50'
                                            }`}
                                    >
                                        <span className={`text-sm font-semibold ${isSelected ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {action.label}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Warning for severe actions */}
                    {selectedAction && (selectedAction.severity === 'high' || selectedAction.severity === 'critical') && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div className="text-xs text-red-400 leading-relaxed">
                                <p className="font-semibold mb-1">High-Severity Action</p>
                                <p>
                                    This action represents a significant escalation in the recovery process. Ensure all
                                    necessary approvals and documentation are in place before proceeding.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Action Date */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-primary" />
                            Action Date <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="date"
                            required
                            value={formData.action_date}
                            onChange={(e) => setFormData({ ...formData, action_date: e.target.value })}
                            max={new Date().toISOString().split('T')[0]}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Details */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground">
                            Action Details <span className="text-red-400">*</span>
                        </label>
                        <textarea
                            required
                            value={formData.details}
                            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
                            placeholder="Describe the recovery action taken, parties involved, outcomes, next steps..."
                            rows={4}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    {/* Cost Incurred */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <DollarSign className="h-4 w-4 text-primary" />
                            Cost Incurred (Optional)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold">
                                KES
                            </span>
                            <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={formData.cost_incurred}
                                onChange={(e) => setFormData({ ...formData, cost_incurred: e.target.value })}
                                placeholder="0.00"
                                className="w-full bg-input border border-border rounded-xl py-3 pl-16 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <p className="text-xs text-muted-foreground italic pl-1">
                            Legal fees, court costs, or other expenses related to this action
                        </p>
                    </div>

                    {/* Document Upload */}
                    <div className="space-y-2">
                        <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                            <Upload className="h-4 w-4 text-primary" />
                            Supporting Document (Optional)
                        </label>
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,image/*"
                            onChange={handleFileChange}
                            className="w-full bg-input border border-border rounded-xl p-3 text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-primary file:text-white hover:file:bg-primary/90"
                        />
                        {formData.document && (
                            <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {formData.document.name}
                            </p>
                        )}
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
                            className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-red-600/20"
                        >
                            {isSubmitting ? 'Recording...' : 'Record Action'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
