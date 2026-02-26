'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus, Trash2, AlertCircle, CheckCircle } from 'lucide-react';
import api from '@/lib/api';

interface Account {
    id: string;
    code: string;
    name: string;
}

interface EntryLine {
    account: string;
    description: string;
    entry_type: 'debit' | 'credit';
    amount: string;
}

export default function NewJournalEntryPage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        description: '',
        reference: '',
        status: 'posted' as 'draft' | 'posted',
    });

    const [lines, setLines] = useState<EntryLine[]>([
        { account: '', description: '', entry_type: 'debit', amount: '' },
        { account: '', description: '', entry_type: 'credit', amount: '' },
    ]);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/accounting/accounts/');
                setAccounts(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
            }
        };
        fetchAccounts();
    }, []);

    const addLine = () => {
        setLines([...lines, { account: '', description: '', entry_type: 'debit', amount: '' }]);
    };

    const removeLine = (index: number) => {
        if (lines.length <= 2) return;
        setLines(lines.filter((_, i) => i !== index));
    };

    const updateLine = (index: number, field: keyof EntryLine, value: string) => {
        const newLines = [...lines];
        newLines[index] = { ...newLines[index], [field]: value };
        setLines(newLines);
    };

    const totalDebits = lines
        .filter(l => l.entry_type === 'debit')
        .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

    const totalCredits = lines
        .filter(l => l.entry_type === 'credit')
        .reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);

    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01 && lines.length >= 2;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isBalanced) {
            alert('Journal entry must be balanced (Debits = Credits)');
            return;
        }

        setIsSubmitting(true);
        try {
            const payload = {
                ...formData,
                ledger_entries: lines.map(l => ({
                    account: l.account,
                    entry_type: l.entry_type,
                    amount: parseFloat(l.amount),
                })),
            };
            await api.post('/accounting/journal/', payload);
            router.push('/accounting/journal');
        } catch (error) {
            console.error('Failed to create journal entry:', error);
            alert('Failed to create journal entry. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 2,
        }).format(value);
    };

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">New Journal Entry</h1>
                    <p className="text-muted-foreground mt-1">Record a manual double-entry transaction</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="glass rounded-xl p-6 border border-border grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Entry Date</label>
                        <input
                            type="date"
                            required
                            value={formData.date}
                            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                            className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Reference / Voucher No.</label>
                        <input
                            type="text"
                            value={formData.reference}
                            onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                            placeholder="e.g., JV-123"
                            className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Internal Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                            className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="posted">Post Immediately</option>
                            <option value="draft">Save as Draft</option>
                        </select>
                    </div>
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description / Narration</label>
                        <textarea
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={2}
                            placeholder="Provide a clear description of the transaction..."
                            className="w-full bg-input border border-border rounded-lg py-2 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>
                </div>

                {/* Entry Lines */}
                <div className="glass rounded-xl border border-border overflow-hidden">
                    <div className="p-4 bg-muted flex items-center justify-between border-b border-border text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        <div className="grid grid-cols-12 gap-4 w-full px-2">
                            <div className="col-span-4">Account</div>
                            <div className="col-span-2">Type</div>
                            <div className="col-span-4">Amount</div>
                            <div className="col-span-2 text-right">Action</div>
                        </div>
                    </div>
                    <div className="p-2 space-y-2">
                        {lines.map((line, index) => (
                            <div key={index} className="grid grid-cols-12 gap-4 items-center p-2 rounded-lg hover:bg-muted transition-colors">
                                <div className="col-span-4">
                                    <select
                                        required
                                        value={line.account}
                                        onChange={(e) => updateLine(index, 'account', e.target.value)}
                                        className="w-full bg-input border border-border rounded-lg py-2 px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="">Select Account</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <select
                                        value={line.entry_type}
                                        onChange={(e) => updateLine(index, 'entry_type', e.target.value as any)}
                                        className="w-full bg-input border border-border rounded-lg py-2 px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="debit">Debit</option>
                                        <option value="credit">Credit</option>
                                    </select>
                                </div>
                                <div className="col-span-4">
                                    <input
                                        type="number"
                                        required
                                        step="0.01"
                                        value={line.amount}
                                        onChange={(e) => updateLine(index, 'amount', e.target.value)}
                                        placeholder="0.00"
                                        className="w-full bg-input border border-border rounded-lg py-2 px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div className="col-span-2 text-right">
                                    <button
                                        type="button"
                                        onClick={() => removeLine(index)}
                                        disabled={lines.length <= 2}
                                        className="p-2 text-muted-foreground hover:text-red-400 disabled:opacity-0 transition-colors"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 border-t border-border bg-muted flex items-center justify-between">
                        <button
                            type="button"
                            onClick={addLine}
                            className="flex items-center gap-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            Add Line
                        </button>
                        <div className="flex gap-8 text-sm">
                            <div className="text-right">
                                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Total Debits</p>
                                <p className="text-foreground font-bold">{formatCurrency(totalDebits)}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-muted-foreground uppercase tracking-wider text-[10px] font-bold">Total Credits</p>
                                <p className="text-foreground font-bold">{formatCurrency(totalCredits)}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Validation Info */}
                {!isBalanced && lines.length >= 2 && (
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                        <AlertCircle className="h-4 w-4" />
                        <p>Entry is not balanced. The difference is {formatCurrency(Math.abs(totalDebits - totalCredits))}.</p>
                    </div>
                )}

                {isBalanced && (
                    <div className="flex items-center gap-2 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
                        <CheckCircle className="h-4 w-4" />
                        <p>Entry is balanced and ready to post.</p>
                    </div>
                )}

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !isBalanced}
                        className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Posting...' : 'Save & Post Entry'}
                    </button>
                </div>
            </form>
        </div>
    );
}
