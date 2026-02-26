'use client';

import { useState } from 'react';
import { X, Landmark, Smartphone, Wallet, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface AccountFormData {
    name: string;
    account_type: string;
    account_number: string;
    bank_name: string;
    opening_balance: string;
    is_active: boolean;
}

interface CreateAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreateAccountModal({ isOpen, onClose, onSuccess }: CreateAccountModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formData, setFormData] = useState<AccountFormData>({
        name: '',
        account_type: 'bank',
        account_number: '',
        bank_name: '',
        opening_balance: '0.00',
        is_active: true,
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await api.post('/treasury/accounts/', {
                ...formData,
                opening_balance: parseFloat(formData.opening_balance),
            });

            onSuccess();
            onClose();
            // Reset form
            setFormData({
                name: '',
                account_type: 'bank',
                account_number: '',
                bank_name: '',
                opening_balance: '0.00',
                is_active: true,
            });
        } catch (err: any) {
            console.error('Failed to create account:', err);
            setError(err.response?.data?.error || 'Failed to create account. Please check all fields.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const accountTypes = [
        { value: 'bank', label: 'Bank Account', icon: Landmark, color: 'primary' },
        { value: 'mobile_money', label: 'Mobile Money', icon: Smartphone, color: 'emerald-400' },
        { value: 'cash', label: 'Petty Cash', icon: Wallet, color: 'amber-400' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading">Create New Account</h2>
                        <p className="text-muted-foreground text-sm mt-1 font-sans">Add a cash or bank account to your treasury</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-muted rounded-xl transition-colors"
                    >
                        <X className="h-6 w-6 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-8">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-200 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Account Type Selection */}
                    <div className="space-y-4">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                            Account Type
                        </label>
                        <div className="grid grid-cols-3 gap-4">
                            {accountTypes.map((type) => {
                                const Icon = type.icon;
                                const isSelected = formData.account_type === type.value;
                                return (
                                    <button
                                        key={type.value}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, account_type: type.value })}
                                        className={`p-6 rounded-2xl border transition-all flex flex-col items-center gap-3 ${isSelected
                                            ? `bg-primary/10 border-primary shadow-[0_0_20px_rgba(var(--app-primary-rgb),0.1)]`
                                            : 'bg-muted/10 border-border hover:border-muted-foreground/30'
                                            }`}
                                    >
                                        <div className={`p-3 rounded-xl ${isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                            <Icon className="h-6 w-6" />
                                        </div>
                                        <p className={`text-xs font-bold uppercase tracking-wider ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                                            {type.label}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Account Name */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                Account Name
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Equity Bank - Main Operations"
                                className="w-full px-5 py-3.5 bg-muted/20 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all"
                                required
                            />
                        </div>

                        {/* Conditional Fields for Bank Account */}
                        {formData.account_type === 'bank' && (
                            <>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                        Bank Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.bank_name}
                                        onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                                        placeholder="e.g., Equity Bank"
                                        className="w-full px-5 py-3.5 bg-muted/20 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                        Account Number
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.account_number}
                                        onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                        placeholder="Enter account number"
                                        className="w-full px-5 py-3.5 bg-muted/20 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all font-mono"
                                        required
                                    />
                                </div>
                            </>
                        )}

                        {/* Account Number for Mobile Money */}
                        {formData.account_type === 'mobile_money' && (
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                    Till/Paybill Number
                                </label>
                                <input
                                    type="text"
                                    value={formData.account_number}
                                    onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                                    placeholder="Enter identifier"
                                    className="w-full px-5 py-3.5 bg-muted/20 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all font-mono"
                                />
                            </div>
                        )}

                        {/* Opening Balance */}
                        <div className="space-y-2 md:col-span-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-1">
                                Opening Balance (KES)
                            </label>
                            <div className="relative">
                                <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none border-r border-border pr-3">
                                    <span className="text-muted-foreground font-bold text-sm">KES</span>
                                </div>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formData.opening_balance}
                                    onChange={(e) => setFormData({ ...formData, opening_balance: e.target.value })}
                                    className="w-full pl-20 pr-5 py-4 bg-muted/20 border border-border rounded-xl text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none transition-all font-mono text-xl"
                                    required
                                />
                            </div>
                            <div className="mt-2 bg-primary/5 border border-primary/20 rounded-xl p-4 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                    <strong className="text-primary block mb-1">Initialization Balance</strong>
                                    Enter the baseline balance for this account. Future transactions will adjust this value automatically.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center justify-between p-4 bg-muted/10 border border-border rounded-2xl">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${formData.is_active ? 'bg-emerald-500/10' : 'bg-muted'}`}>
                                <div className={`h-2 w-2 rounded-full ${formData.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-muted-foreground'}`} />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-foreground">Active Status</p>
                                <p className="text-xs text-muted-foreground font-sans">Available for transactions</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                value=""
                                className="sr-only peer"
                                checked={formData.is_active}
                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                            />
                            <div className="w-11 h-6 bg-muted/30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                        </label>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-4 rounded-xl border border-border text-foreground font-bold hover:bg-muted transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-6 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 disabled:opacity-50 transition-all uppercase tracking-widest text-xs shadow-lg shadow-primary/20"
                        >
                            {loading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Processing...
                                </div>
                            ) : (
                                'Create Account'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
