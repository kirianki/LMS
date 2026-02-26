'use client';

import { useState, useEffect } from 'react';
import { X, Package, Percent, Wallet, Settings, Info } from 'lucide-react';
import api from '@/lib/api';

interface SavingsProductModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    editingProduct?: any;
}

export default function SavingsProductModal({ isOpen, onClose, onSuccess, editingProduct }: SavingsProductModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        interest_rate: '',
        minimum_balance: '0',
        interest_method: 'daily_min',
        compounding_period: 'monthly',
        withdrawal_fee: '0',
        maintenance_fee: '0',
        is_active: true
    });

    useEffect(() => {
        if (editingProduct) {
            setFormData({
                name: editingProduct.name || '',
                code: editingProduct.code || '',
                description: editingProduct.description || '',
                interest_rate: editingProduct.interest_rate || '',
                minimum_balance: editingProduct.minimum_balance || '0',
                interest_method: editingProduct.interest_method || 'daily_min',
                compounding_period: editingProduct.compounding_period || 'monthly',
                withdrawal_fee: editingProduct.withdrawal_fee || '0',
                maintenance_fee: editingProduct.maintenance_fee || '0',
                is_active: editingProduct.is_active ?? true
            });
        } else {
            setFormData({
                name: '',
                code: '',
                description: '',
                interest_rate: '',
                minimum_balance: '0',
                interest_method: 'daily_min',
                compounding_period: 'monthly',
                withdrawal_fee: '0',
                maintenance_fee: '0',
                is_active: true
            });
        }
    }, [editingProduct, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload = {
                ...formData,
                interest_rate: Number(formData.interest_rate),
                minimum_balance: Number(formData.minimum_balance),
                withdrawal_fee: Number(formData.withdrawal_fee),
                maintenance_fee: Number(formData.maintenance_fee),
            };

            if (editingProduct) {
                await api.patch(`/savings/products/${editingProduct.id}/`, payload);
            } else {
                await api.post('/savings/products/', payload);
            }

            onSuccess();
        } catch (error: any) {
            console.error('Failed to save product:', error);
            alert(error.response?.data?.detail || 'Failed to save product. Please check all fields.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading">
                            {editingProduct ? 'Edit Savings Product' : 'New Savings Product'}
                        </h2>
                        <p className="text-sm text-muted-foreground mt-1">Configure interest calculation and fee rules</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Package className="h-5 w-5" />
                            <h3 className="font-semibold uppercase tracking-wider text-xs">Identification</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Product Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., Fixed Deposit"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Product Code *</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.code}
                                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    placeholder="e.g., SAV-FIX"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Interest Config */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-emerald-400">
                            <Percent className="h-5 w-5" />
                            <h3 className="font-semibold uppercase tracking-wider text-xs">Interest Configuration</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Interest Rate (% p.a) *</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    required
                                    value={formData.interest_rate}
                                    onChange={(e) => setFormData({ ...formData, interest_rate: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                                    placeholder="0.00"
                                />
                            </div>
                            <div className="space-y-2 text-foreground font-medium">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Calculation Method</label>
                                <select
                                    value={formData.interest_method}
                                    onChange={(e) => setFormData({ ...formData, interest_method: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="daily_min">Daily Minimum Balance</option>
                                    <option value="avg_daily">Average Daily Balance</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Compounding</label>
                                <select
                                    value={formData.compounding_period}
                                    onChange={(e) => setFormData({ ...formData, compounding_period: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 focus:outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="daily">Daily</option>
                                    <option value="monthly">Monthly</option>
                                    <option value="yearly">Yearly</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Fees & Balance */}
                    <div className="space-y-4 pt-4 border-t border-border">
                        <div className="flex items-center gap-2 text-blue-400">
                            <Wallet className="h-5 w-5" />
                            <h3 className="font-semibold uppercase tracking-wider text-xs">Fees & Requirements</h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Min. Balance *</label>
                                <input
                                    type="number"
                                    required
                                    value={formData.minimum_balance}
                                    onChange={(e) => setFormData({ ...formData, minimum_balance: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Withdrawal Fee</label>
                                <input
                                    type="number"
                                    value={formData.withdrawal_fee}
                                    onChange={(e) => setFormData({ ...formData, withdrawal_fee: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Monthly Maintenance</label>
                                <input
                                    type="number"
                                    value={formData.maintenance_fee}
                                    onChange={(e) => setFormData({ ...formData, maintenance_fee: e.target.value })}
                                    className="w-full bg-input border border-border rounded-xl py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-4">
                        <input
                            type="checkbox"
                            id="is_active"
                            checked={formData.is_active}
                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            className="w-4 h-4 text-primary bg-input border-border rounded focus:ring-primary"
                        />
                        <label htmlFor="is_active" className="text-sm font-medium text-foreground cursor-pointer">
                            Active (Available for new accounts)
                        </label>
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
                            className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20"
                        >
                            {isSubmitting ? 'Saving...' : editingProduct ? 'Update Product' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
