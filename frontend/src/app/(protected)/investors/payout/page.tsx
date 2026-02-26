'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Banknote, Landmark, ArrowUpRight, Info } from 'lucide-react';
import api from '@/lib/api';

interface Investment {
    id: string;
    investment_number: string;
    principal_amount: number;
    investor_name: string;
}

function PayoutForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        investment: '',
        payout_type: 'interest',
        amount: '',
        payout_date: new Date().toISOString().split('T')[0],
        reference: '',
        payment_method: 'bank_transfer',
        notes: '',
    });

    useEffect(() => {
        const fetchInvestments = async () => {
            try {
                const investorId = searchParams.get('investor');
                const url = `/investors/investments/${investorId ? `?investor=${investorId}` : ''}`;
                const response = await api.get(url);
                setInvestments(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch investments:', error);
            }
        };
        fetchInvestments();
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/investors/payouts/', {
                ...formData,
                amount: parseFloat(formData.amount),
            });
            router.push('/investors');
        } catch (error) {
            console.error('Failed to process payout:', error);
            alert('Failed to process payout. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="glass rounded-xl p-8 border border-border space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Investment Portfolio</label>
                    <select
                        name="investment"
                        required
                        value={formData.investment}
                        onChange={handleChange}
                        className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Choose Investment</option>
                        {investments.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.investor_name} - {inv.investment_number} (Principal: KES {parseFloat(inv.principal_amount.toString()).toLocaleString()})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Payout Type</label>
                        <select
                            name="payout_type"
                            required
                            value={formData.payout_type}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="interest">Interest Payment</option>
                            <option value="principal">Principal Return</option>
                            <option value="bonus">Bonus / Extra</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Payout Amount (KES)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">KES</span>
                            <input
                                type="number"
                                name="amount"
                                required
                                step="0.01"
                                value={formData.amount}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full bg-input border border-border rounded-lg py-2.5 pl-14 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Payment Reference</label>
                        <input
                            type="text"
                            name="reference"
                            value={formData.reference}
                            onChange={handleChange}
                            placeholder="e.g., Bank Ref, Transaction ID"
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Payout Date</label>
                        <input
                            type="date"
                            name="payout_date"
                            required
                            value={formData.payout_date}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <Info className="h-4 w-4 text-amber-500 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                        Processing a payout will update the investor's ledger and reduce the outstanding expected return on the selected investment. Ensure you have sufficient funds in the treasury account.
                    </p>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Notes</label>
                    <textarea
                        name="notes"
                        rows={2}
                        value={formData.notes}
                        onChange={handleChange}
                        className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                </div>
            </div>

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
                    disabled={isSubmitting}
                    className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-emerald-600 text-foreground hover:bg-emerald-500 transition-all font-bold shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                >
                    <ArrowUpRight className="h-4 w-4" />
                    {isSubmitting ? 'Processing...' : 'Process Payout'}
                </button>
            </div>
        </form>
    );
}

export default function PayoutPage() {
    const router = useRouter();

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Investor Payout</h1>
                    <p className="text-muted-foreground mt-1">Record returns to a capital provider</p>
                </div>
            </div>

            <Suspense fallback={<div className="text-muted-foreground">Loading form...</div>}>
                <PayoutForm />
            </Suspense>
        </div>
    );
}
