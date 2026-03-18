'use client';

import { useState, useEffect } from 'react';
import { X, PlusCircle, AlertCircle, Info, Landmark } from 'lucide-react';
import api from '@/lib/api';

interface ChartOfAccount {
    id: string;
    code: string;
    name: string;
    account_type: string;
}

interface TopUpModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    accountId: string;
    accountName: string;
}

export default function TopUpModal({ isOpen, onClose, onSuccess, accountId, accountName }: TopUpModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [counterpartyCoaCode, setCounterpartyCoaCode] = useState('3100'); // Default to Capital
    const [coas, setCoas] = useState<ChartOfAccount[]>([]);

    useEffect(() => {
        if (isOpen) {
            fetchCoas();
        }
    }, [isOpen]);

    const fetchCoas = async () => {
        try {
            const response = await api.get('/accounting/accounts/');
            const data = response.data.results || response.data;
            setCoas(data);
        } catch (err) {
            console.error('Failed to fetch COAs:', err);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            await api.post(`/treasury/accounts/${accountId}/top_up/`, {
                amount: parseFloat(amount),
                description,
                counterparty_coa_code: counterpartyCoaCode,
            });

            onSuccess();
            onClose();
            // Reset form
            setAmount('');
            setDescription('');
            setCounterpartyCoaCode('3100');
        } catch (err: any) {
            console.error('Top-up failed:', err);
            setError(err.response?.data?.error || 'Failed to process top-up. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="bg-primary/10 p-6 border-b border-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary rounded-2xl shadow-lg shadow-primary/20">
                            <PlusCircle className="h-6 w-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-foreground font-heading">Add Funds</h2>
                            <p className="text-muted-foreground text-xs uppercase tracking-widest mt-0.5">{accountName}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                            <p className="text-sm text-red-200 font-medium">{error}</p>
                        </div>
                    )}

                    {/* Amount Field */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">
                            Deposit Amount
                        </label>
                        <div className="relative group">
                            <div className="absolute left-6 top-1/2 -translate-y-1/2 flex items-center border-r border-white/10 pr-4">
                                <span className="text-primary font-bold text-lg">KES</span>
                            </div>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full pl-24 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl text-foreground placeholder-white/20 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all font-mono text-2xl font-bold"
                                required
                            />
                        </div>
                    </div>

                    {/* Description Field */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">
                            Reference / Narration
                        </label>
                        <input
                            type="text"
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="e.g., Initial Float, Bank Transfer..."
                            className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-foreground placeholder-white/20 focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
                        />
                    </div>

                    {/* Counterparty COA Selection */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] px-1">
                            Offsetting Ledger (Equity/Income)
                        </label>
                        <div className="relative">
                            <select
                                value={counterpartyCoaCode}
                                onChange={(e) => setCounterpartyCoaCode(e.target.value)}
                                className="w-full px-6 py-4 bg-white/5 border border-white/10 rounded-2xl text-foreground appearance-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:outline-none transition-all"
                                required
                            >
                                {coas
                                    .filter(coa => ['equity', 'income', 'liability'].includes(coa.account_type.toLowerCase()))
                                    .map((coa) => (
                                        <option key={coa.id} value={coa.code} className="bg-slate-900">
                                            {coa.code} - {coa.name}
                                        </option>
                                    ))}
                            </select>
                            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <Info className="h-4 w-4" />
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground/60 italic px-1">
                            This defines where the money is coming from (e.g., Capital Investment).
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4 flex gap-4">
                        <Landmark className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-1">GL Synchronization</p>
                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                This action will immediately update the Treasury balance and post a synchronized entry to the General Ledger.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-8 py-4 rounded-2xl border border-white/10 text-foreground font-bold hover:bg-white/5 transition-all text-xs uppercase tracking-[0.2em]"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-[2] px-8 py-4 bg-primary text-white font-bold rounded-2xl hover:brightness-110 active:scale-[0.98] disabled:opacity-50 transition-all text-xs uppercase tracking-[0.2em] shadow-xl shadow-primary/20"
                        >
                            {loading ? 'Processing...' : 'Confirm Deposit'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
