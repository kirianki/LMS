'use client';

import { useState, useEffect } from 'react';
import { X, CheckCircle2, AlertCircle, Percent, DollarSign, Shield, Info } from 'lucide-react';
import api from '@/lib/api';

interface ApplicationApprovalModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    application: any;
}

export default function ApplicationApprovalModal({ isOpen, onClose, onSuccess, application }: ApplicationApprovalModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        approved_amount: '',
        approved_term: '',
        approved_interest_rate: '',
        approved_interest_method: 'reducing_balance',
        approved_interest_period: 'per_year',
        approved_repayment_frequency: 'monthly',
        penalty_type: 'fixed',
        penalty_value: '0',
        penalty_grace_period: '0',
        penalty_basis: 'per_day',
        deductions: [] as any[],
        notes: '',
    });

    const [riskProfile, setRiskProfile] = useState<any>(null);
    const [isLoadingRisk, setIsLoadingRisk] = useState(false);

    useEffect(() => {
        if (application && isOpen) {
            // If revising, use approved terms instead of requested ones
            const isRevising = application.status === 'approved' || application.status === 'offer_sent';

            setFormData({
                approved_amount: (isRevising ? application.approved_amount : application.requested_amount).toString(),
                approved_term: (isRevising ? application.approved_term : application.requested_term).toString(),
                approved_interest_rate: (isRevising ? application.approved_interest_rate : (application.product_details?.suggested_interest_rate || application.product?.suggested_interest_rate || '')).toString(),
                approved_interest_method: application.approved_interest_method || 'reducing_balance',
                approved_interest_period: application.approved_interest_period || application.product_details?.suggested_interest_period || application.product?.suggested_interest_period || 'per_year',
                deductions: application.deductions && application.deductions.length > 0
                    ? application.deductions.map((d: any) => ({
                        name: d.name,
                        charge_method: d.charge_method,
                        value: d.value.toString(),
                        is_withheld: d.is_withheld
                    }))
                    : [
                        {
                            name: 'PROCESSING FEE',
                            charge_method: 'percentage',
                            value: application.product?.suggested_processing_fee_percent?.toString() || '2',
                            is_withheld: true
                        },
                        {
                            name: 'PROVISION FOR RECOVERY',
                            charge_method: 'percentage',
                            value: '0.5',
                            is_withheld: true
                        },
                        {
                            name: 'MAINTENANCE FEE',
                            charge_method: 'fixed',
                            value: '0',
                            is_withheld: true
                        },
                        {
                            name: 'TRACKER INSTAL\'/MAINTENANCE',
                            charge_method: 'fixed',
                            value: '5000',
                            is_withheld: true
                        },
                        {
                            name: 'MOTOR VEHICLE INSURANCE FEE',
                            charge_method: 'fixed',
                            value: '0',
                            is_withheld: true
                        }
                    ],
                approved_repayment_frequency: application.approved_repayment_frequency || application.repayment_frequency || application.product?.repayment_frequency || 'monthly',
                penalty_type: application.penalty_type || application.product?.penalty_type || 'percentage',
                penalty_value: (application.penalty_value || application.product?.penalty_value || 10).toString(),
                penalty_grace_period: (application.penalty_grace_period || application.product?.penalty_grace_period || 0).toString(),
                penalty_basis: application.penalty_basis || application.product?.penalty_basis || 'per_day',
                notes: application.review_notes || '',
            });
            fetchRiskProfile();
        }
    }, [application, isOpen]);

    const fetchRiskProfile = async () => {
        if (!application?.borrower_details?.id) return;
        setIsLoadingRisk(true);
        try {
            // In a real system, we might have an endpoint for this
            // For now, we use the customer data
            setRiskProfile({
                credit_score: application.borrower_details.hybrid_score || application.borrower_details.internal_score || 0,
                risk_category: 'medium', // Default to medium if not set
            });
        } catch (error) {
            console.error('Failed to fetch risk profile:', error);
        } finally {
            setIsLoadingRisk(false);
        }
    };

    const isMissingRequirements = () => {
        if (!application) return false;

        // Multi-collateral support: check both old single 'collateral' and new 'collateral_items'
        const requiresCollateral = application.product_details?.requires_collateral || application.product?.requires_collateral;
        const hasCollateral = application.collateral || (application.collateral_items && application.collateral_items.length > 0);

        if (requiresCollateral && !hasCollateral) return true;

        const requiresGuarantor = application.product_details?.requires_guarantor || application.product?.requires_guarantor;
        if (requiresGuarantor && (!application.guarantors || application.guarantors.length === 0)) return true;

        return false;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (isMissingRequirements()) {
            alert('Cannot approve: Mandatory requirements (collateral/guarantors) are missing.');
            return;
        }

        setIsSubmitting(true);

        try {
            await api.post(`/loans/applications/${application.id}/approve/`, {
                approved_amount: Number(formData.approved_amount),
                approved_term: Number(formData.approved_term),
                approved_interest_rate: Number(formData.approved_interest_rate),
                approved_interest_method: formData.approved_interest_method,
                approved_interest_period: formData.approved_interest_period,
                deductions: formData.deductions.map(d => ({
                    ...d,
                    value: Number(d.value)
                })),
                approved_repayment_frequency: formData.approved_repayment_frequency,
                penalty_type: formData.penalty_type,
                penalty_value: Number(formData.penalty_value),
                penalty_grace_period: Number(formData.penalty_grace_period),
                penalty_basis: formData.penalty_basis,
                notes: formData.notes
            });

            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Failed to approve application:', error);
            alert(error.response?.data?.error || 'Failed to approve application. Please check values.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !application) return null;

    const totalWithheldDeductions = formData.deductions
        .filter(d => d.is_withheld)
        .reduce((sum, d) => {
            const val = Number(d.value) || 0;
            const amount = d.charge_method === 'percentage'
                ? (Number(formData.approved_amount) * val) / 100
                : val;
            return sum + amount;
        }, 0);

    const addDeduction = () => {
        setFormData({
            ...formData,
            deductions: [...formData.deductions, { name: '', charge_method: 'fixed', value: '0', is_withheld: true }]
        });
    };

    const removeDeduction = (index: number) => {
        const newDeductions = [...formData.deductions];
        newDeductions.splice(index, 1);
        setFormData({ ...formData, deductions: newDeductions });
    };

    const updateDeduction = (index: number, field: string, value: any) => {
        const newDeductions = [...formData.deductions];
        newDeductions[index] = { ...newDeductions[index], [field]: value };
        setFormData({ ...formData, deductions: newDeductions });
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading flex items-center gap-2">
                            <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                            {(application.status === 'approved' || application.status === 'offer_sent') ? 'Revise Approved Terms' : 'Approve Application'}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">
                            {(application.status === 'approved' || application.status === 'offer_sent')
                                ? `Update loan parameters for ${application.borrower_details?.name}`
                                : `Configure final loan terms for ${application.borrower_details?.name}`}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Risk Profile & Scoring */}
                    <div className="bg-primary/5 rounded-2xl p-4 border border-primary/10 flex items-start gap-4">
                        <Shield className="h-8 w-8 text-primary shrink-0" />
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                Customer Risk Profile
                                {isLoadingRisk && <span className="text-[10px] animate-pulse">Analyzing...</span>}
                            </h3>
                            <div className="grid grid-cols-2 gap-4 mt-2">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Credit Score</p>
                                    <p className="text-lg font-bold text-primary">{riskProfile?.credit_score || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Risk Category</p>
                                    <p className="text-lg font-bold text-amber-500 capitalize">{riskProfile?.risk_category || 'Calculating...'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Final Amounts */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <DollarSign className="h-4 w-4 text-primary" />
                                Loan Terms
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Approved Amount</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.approved_amount}
                                        onChange={(e) => setFormData({ ...formData, approved_amount: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <p className="text-[10px] text-muted-foreground mt-1 italic">Requested: KES {Number(application.requested_amount).toLocaleString()}</p>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Approved Term (Months)</label>
                                    <input
                                        type="number"
                                        required
                                        value={formData.approved_term}
                                        onChange={(e) => setFormData({ ...formData, approved_term: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Interest Rate */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-foreground flex items-center gap-2">
                                <Percent className="h-4 w-4 text-primary" />
                                Pricing
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Interest Rate (%)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={formData.approved_interest_rate}
                                        onChange={(e) => setFormData({ ...formData, approved_interest_rate: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Interest Period</label>
                                        <select
                                            value={formData.approved_interest_period}
                                            onChange={(e) => setFormData({ ...formData, approved_interest_period: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-heading"
                                        >
                                            <option value="per_year">Per Annum</option>
                                            <option value="per_month">Per Month</option>
                                            <option value="per_day">Per Day</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium text-muted-foreground mb-1 block">Interest Method</label>
                                        <select
                                            value={formData.approved_interest_method}
                                            onChange={(e) => setFormData({ ...formData, approved_interest_method: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-heading"
                                        >
                                            <option value="reducing_balance">Reducing Balance</option>
                                            <option value="flat">Flat Rate</option>
                                            <option value="interest_only">Interest Only</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Frequency */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Repayment Frequency</label>
                                <select
                                    value={formData.approved_repayment_frequency}
                                    onChange={(e) => setFormData({ ...formData, approved_repayment_frequency: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-heading"
                                >
                                    <option value="weekly">Weekly</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="quarterly">Quarterly</option>
                                    <option value="bi_annually">Bi-Annually</option>
                                    <option value="annually">Annually</option>
                                    <option value="bullet">Bullet (One-off)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Penalties Section */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <h3 className="font-semibold text-foreground flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-primary" />
                            Penalty Configuration
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Method</label>
                                <select
                                    value={formData.penalty_type}
                                    onChange={(e) => setFormData({ ...formData, penalty_type: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                >
                                    <option value="fixed">Fixed Amount</option>
                                    <option value="percentage">% of Principal</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Value</label>
                                <input
                                    type="number"
                                    value={formData.penalty_value}
                                    onChange={(e) => setFormData({ ...formData, penalty_value: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Basis</label>
                                <select
                                    value={formData.penalty_basis}
                                    onChange={(e) => setFormData({ ...formData, penalty_basis: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                >
                                    <option value="per_day">Per Day</option>
                                    <option value="per_week">Per Week</option>
                                    <option value="per_month">Per Month</option>
                                    {formData.penalty_type === 'fixed' && (
                                        <option value="per_installment">Per Installment</option>
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground mb-1 block">Grace Period (Days)</label>
                                <input
                                    type="number"
                                    value={formData.penalty_grace_period}
                                    onChange={(e) => setFormData({ ...formData, penalty_grace_period: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                />
                            </div>
                        </div>
                    </div>
                    {/* Dynamic Deductions Section */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center justify-between">
                            <h3 className="font-semibold text-foreground">Deductions & Fees</h3>
                            <button
                                type="button"
                                onClick={addDeduction}
                                className="text-xs font-bold text-primary hover:text-primary/80"
                            >
                                + Add Deduction
                            </button>
                        </div>
                        <div className="space-y-3">
                            {formData.deductions.map((deduction, index) => (
                                <div key={index} className="flex flex-wrap md:flex-nowrap gap-3 items-end bg-muted/20 p-3 rounded-xl border border-border">
                                    <div className="flex-1 min-w-[150px]">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Name</label>
                                        <input
                                            type="text"
                                            value={deduction.name}
                                            onChange={(e) => updateDeduction(index, 'name', e.target.value)}
                                            placeholder="e.g. Legal Fee"
                                            className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm focus:outline-none"
                                        />
                                    </div>
                                    <div className="w-32">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Method</label>
                                        <select
                                            value={deduction.charge_method}
                                            onChange={(e) => updateDeduction(index, 'charge_method', e.target.value)}
                                            className="w-full bg-input border border-border rounded-lg py-1.5 px-2 text-sm focus:outline-none"
                                        >
                                            <option value="fixed">Fixed</option>
                                            <option value="percentage">% of Principal</option>
                                        </select>
                                    </div>
                                    <div className="w-24">
                                        <label className="text-[10px] uppercase font-bold text-muted-foreground mb-1 block">Value</label>
                                        <input
                                            type="number"
                                            value={deduction.value}
                                            onChange={(e) => updateDeduction(index, 'value', e.target.value)}
                                            className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 mb-2 px-2">
                                        <input
                                            type="checkbox"
                                            checked={deduction.is_withheld}
                                            onChange={(e) => updateDeduction(index, 'is_withheld', e.target.checked)}
                                            id={`withheld-${index}`}
                                            className="rounded border-border text-primary focus:ring-primary"
                                        />
                                        <label htmlFor={`withheld-${index}`} className="text-[10px] font-bold text-muted-foreground uppercase cursor-pointer">Withhold</label>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => removeDeduction(index)}
                                        className="p-2 text-red-400 hover:text-red-500 transition-colors mb-1"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-medium text-muted-foreground block">Review Notes</label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            placeholder="Add any internal approval notes here..."
                            rows={3}
                            className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                        />
                    </div>

                    {/* Summary Card */}
                    <div className="bg-muted/50 rounded-2xl p-4 border border-border">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-foreground">Total Withheld Deductions</span>
                            <span className="text-sm font-bold text-primary">KES {totalWithheldDeductions.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-background/50 p-2 rounded-lg">
                            <Info className="h-3 w-3 shrink-0" />
                            <span>Net disbursement will be KES {(Number(formData.approved_amount) - totalWithheldDeductions).toLocaleString()} after withholding deductions.</span>
                        </div>
                    </div>

                    {isMissingRequirements() && (
                        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
                            <div>
                                <p className="text-xs font-bold text-red-400 uppercase tracking-wider">Missing Requirements</p>
                                <p className="text-[10px] text-red-400/80 mt-1 lines-tight">
                                    {(application.product_details?.requires_collateral || application.product?.requires_collateral) &&
                                        (!application.collateral && (!application.collateral_items || application.collateral_items.length === 0)) &&
                                        "• Collateral must be attached for this product. "}
                                    {(application.product_details?.requires_guarantor || application.product?.requires_guarantor) &&
                                        (!application.guarantors || application.guarantors.length === 0) &&
                                        "• At least one guarantor is required. "}
                                    Please exit and add these requirements before approving.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-3 rounded-xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || isMissingRequirements()}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? 'Processing...' : (application.status === 'approved' || application.status === 'offer_sent') ? 'Save Revised Terms' : 'Confirm Approval'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
