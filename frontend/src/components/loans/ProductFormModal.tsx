'use client';

import { useState, useEffect } from 'react';
import { X, Package, DollarSign, Percent, Calendar, Shield, AlertTriangle } from 'lucide-react';
import api from '@/lib/api';

interface ProductFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingProduct?: any;
}

export default function ProductFormModal({ isOpen, onClose, onSuccess, editingProduct }: ProductFormModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        min_amount: '',
        max_amount: '',
        suggested_interest_rate: '',
        suggested_processing_fee_percent: '',
        default_term: '',
        min_term: '',
        max_term: '',
        term_unit: 'months',
        penalty_type: 'fixed',
        penalty_value: '0',
        penalty_grace_period: '0',
        penalty_basis: 'per_day',
        requires_collateral: false,
        min_collateral_value: '',
        max_ltv_ratio: '',
        requires_guarantor: false,
        min_credit_score: '',
        is_active: true
    });

    useEffect(() => {
        if (editingProduct) {
            setFormData({
                name: editingProduct.name || '',
                code: editingProduct.code || '',
                description: editingProduct.description || '',
                min_amount: editingProduct.min_amount || '',
                max_amount: editingProduct.max_amount || '',
                suggested_interest_rate: editingProduct.suggested_interest_rate || '',
                suggested_processing_fee_percent: editingProduct.suggested_processing_fee_percent || '',
                default_term: editingProduct.default_term || '',
                min_term: editingProduct.min_term || '',
                max_term: editingProduct.max_term || '',
                term_unit: editingProduct.term_unit || 'months',
                penalty_type: editingProduct.penalty_type || 'fixed',
                penalty_value: editingProduct.penalty_value?.toString() || '0',
                penalty_grace_period: editingProduct.penalty_grace_period?.toString() || '0',
                penalty_basis: editingProduct.penalty_basis || 'per_day',
                requires_collateral: editingProduct.requires_collateral || false,
                min_collateral_value: editingProduct.min_collateral_value || '',
                max_ltv_ratio: editingProduct.max_ltv_ratio || '',
                requires_guarantor: editingProduct.requires_guarantor || false,
                min_credit_score: editingProduct.min_credit_score || '',
                is_active: editingProduct.is_active ?? true
            });
        } else {
            resetForm();
        }
    }, [editingProduct, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...formData,
                min_amount: Number(formData.min_amount),
                max_amount: Number(formData.max_amount),
                suggested_interest_rate: formData.suggested_interest_rate ? Number(formData.suggested_interest_rate) : null,
                suggested_processing_fee_percent: formData.suggested_processing_fee_percent ? Number(formData.suggested_processing_fee_percent) : null,
                default_term: Number(formData.default_term),
                min_term: Number(formData.min_term),
                max_term: Number(formData.max_term),
                penalty_value: Number(formData.penalty_value),
                penalty_grace_period: Number(formData.penalty_grace_period),
                min_credit_score: formData.min_credit_score ? Number(formData.min_credit_score) : null,
                min_collateral_value: formData.requires_collateral ? Number(formData.min_collateral_value) : null,
                max_ltv_ratio: formData.requires_collateral ? Number(formData.max_ltv_ratio) : null
            };

            if (editingProduct) {
                await api.patch(`/loans/products/${editingProduct.id}/`, payload);
            } else {
                await api.post('/loans/products/', payload);
            }

            onSuccess();
        } catch (error: any) {
            console.error('Failed to save product:', error);
            alert(error.response?.data?.detail || 'Failed to save product. Please check all fields.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            code: '',
            description: '',
            min_amount: '',
            max_amount: '',
            suggested_interest_rate: '',
            suggested_processing_fee_percent: '',
            default_term: '',
            min_term: '',
            max_term: '',
            term_unit: 'months',
            penalty_type: 'fixed',
            penalty_value: '0',
            penalty_grace_period: '0',
            penalty_basis: 'per_day',
            requires_collateral: false,
            min_collateral_value: '',
            max_ltv_ratio: '',
            requires_guarantor: false,
            min_credit_score: '',
            is_active: true
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading">
                            {editingProduct ? 'Edit Loan Product' : 'New Loan Product'}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Configure product parameters and requirements</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Information */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Package className="h-5 w-5" />
                            <h3 className="font-semibold">Basic Information</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Product Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., SME Business Loan"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Product Code *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., SME-001"
                                />
                            </div>

                            <div className="md:col-span-2 space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Description</label>
                                <textarea
                                    rows={2}
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                    placeholder="Brief description of the product..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Amounts */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <DollarSign className="h-5 w-5" />
                            <h3 className="font-semibold">Loan Amounts</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Minimum Amount *</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.min_amount}
                                    onChange={(e) => setFormData({ ...formData, min_amount: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Maximum Amount *</label>
                                <input
                                    type="number"
                                    required
                                    min="0"
                                    value={formData.max_amount}
                                    onChange={(e) => setFormData({ ...formData, max_amount: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Suggested Configuration */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <Percent className="h-5 w-5" />
                            <h3 className="font-semibold">Suggested Defaults (Optional)</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Suggested Interest Rate (% p.a.)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.suggested_interest_rate}
                                    onChange={(e) => setFormData({ ...formData, suggested_interest_rate: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., 12"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Suggested Processing Fee (%)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.suggested_processing_fee_percent}
                                    onChange={(e) => setFormData({ ...formData, suggested_processing_fee_percent: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., 2"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground italic">
                            These values will be used as suggestions during loan creation, but can be overridden based on customer score.
                        </p>
                    </div>

                    {/* Term Configuration */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <Calendar className="h-5 w-5" />
                            <h3 className="font-semibold">Repayment Term</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Default Term *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.default_term}
                                    onChange={(e) => setFormData({ ...formData, default_term: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Min Term *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.min_term}
                                    onChange={(e) => setFormData({ ...formData, min_term: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Max Term *</label>
                                <input
                                    type="number"
                                    required
                                    min="1"
                                    value={formData.max_term}
                                    onChange={(e) => setFormData({ ...formData, max_term: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Term Unit *</label>
                                <select
                                    required
                                    value={formData.term_unit}
                                    onChange={(e) => setFormData({ ...formData, term_unit: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="days">Days</option>
                                    <option value="weeks">Weeks</option>
                                    <option value="months">Months</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Penalty Defaults */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <AlertTriangle className="h-5 w-5" />
                            <h3 className="font-semibold">Default Penalty Settings</h3>
                        </div>
                        <p className="text-xs text-muted-foreground italic">These defaults are pre-filled during approval but can be overridden per loan.</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Penalty Type</label>
                                <select
                                    value={formData.penalty_type}
                                    onChange={(e) => setFormData({ ...formData, penalty_type: e.target.value, penalty_basis: 'per_day' })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="fixed">Fixed Amount (KES)</option>
                                    <option value="percentage">Percentage of Principal (%)</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Penalty Basis</label>
                                <select
                                    value={formData.penalty_basis}
                                    onChange={(e) => setFormData({ ...formData, penalty_basis: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="per_day">Per Day (daily accrual)</option>
                                    <option value="per_week">Per Week</option>
                                    <option value="per_month">Per Month</option>
                                    {formData.penalty_type === 'fixed' && (
                                        <option value="per_installment">Per Installment (one-off flat fee)</option>
                                    )}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">
                                    Penalty Value ({formData.penalty_type === 'fixed' ? 'KES' : '%'})
                                </label>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.penalty_value}
                                    onChange={(e) => setFormData({ ...formData, penalty_value: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Grace Period (Days)</label>
                                <input
                                    type="number"
                                    min="0"
                                    value={formData.penalty_grace_period}
                                    onChange={(e) => setFormData({ ...formData, penalty_grace_period: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Requirements */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <Shield className="h-5 w-5" />
                            <h3 className="font-semibold">General Requirements</h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground">Minimum Credit Score</label>
                                <input
                                    type="number"
                                    min="0"
                                    max="1000"
                                    value={formData.min_credit_score}
                                    onChange={(e) => setFormData({ ...formData, min_credit_score: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., 500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Collateral & Requirements */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-primary">
                            <Shield className="h-5 w-5" />
                            <h3 className="font-semibold">Requirements</h3>
                        </div>

                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="requires_collateral"
                                    checked={formData.requires_collateral}
                                    onChange={(e) => setFormData({ ...formData, requires_collateral: e.target.checked })}
                                    className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary"
                                />
                                <label htmlFor="requires_collateral" className="text-sm font-medium text-foreground cursor-pointer">
                                    Requires Collateral
                                </label>
                            </div>

                            {formData.requires_collateral && (
                                <div className="ml-7 grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Minimum Asset Value *</label>
                                        <input
                                            type="number"
                                            required={formData.requires_collateral}
                                            min="0"
                                            value={formData.min_collateral_value}
                                            onChange={(e) => setFormData({ ...formData, min_collateral_value: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-muted-foreground">Max LTV Ratio (%) *</label>
                                        <input
                                            type="number"
                                            required={formData.requires_collateral}
                                            step="0.01"
                                            min="0"
                                            max="100"
                                            value={formData.max_ltv_ratio}
                                            onChange={(e) => setFormData({ ...formData, max_ltv_ratio: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="requires_guarantor"
                                    checked={formData.requires_guarantor}
                                    onChange={(e) => setFormData({ ...formData, requires_guarantor: e.target.checked })}
                                    className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary"
                                />
                                <label htmlFor="requires_guarantor" className="text-sm font-medium text-foreground cursor-pointer">
                                    Requires Guarantor
                                </label>
                            </div>

                            <div className="flex items-center gap-3">
                                <input
                                    type="checkbox"
                                    id="is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary"
                                />
                                <label htmlFor="is_active" className="text-sm font-medium text-foreground cursor-pointer">
                                    Active (available for new applications)
                                </label>
                            </div>
                        </div>
                    </div>

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
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
