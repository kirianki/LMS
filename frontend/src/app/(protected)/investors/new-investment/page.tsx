'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, Coins, Calendar, TrendingUp, Percent } from 'lucide-react';
import api from '@/lib/api';

interface Investor {
    id: string;
    name: string;
    investor_number: string;
}

function NewInvestmentForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [investors, setInvestors] = useState<Investor[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        investor: searchParams.get('investor') || '',
        principal_amount: '',
        expected_return_rate: '',
        term_months: '12',
        investment_date: new Date().toISOString().split('T')[0],
        maturity_date: '',
        notes: '',
    });

    useEffect(() => {
        const fetchInvestors = async () => {
            try {
                const response = await api.get('/investors/investors/');
                setInvestors(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch investors:', error);
            }
        };
        fetchInvestors();
    }, []);

    // Auto-calculate maturity date when term or date changes
    useEffect(() => {
        if (formData.investment_date && formData.term_months) {
            const date = new Date(formData.investment_date);
            date.setMonth(date.getMonth() + parseInt(formData.term_months));
            setFormData(prev => ({ ...prev, maturity_date: date.toISOString().split('T')[0] }));
        }
    }, [formData.investment_date, formData.term_months]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/investors/investments/', {
                ...formData,
                principal_amount: parseFloat(formData.principal_amount),
                expected_return_rate: parseFloat(formData.expected_return_rate),
                term_months: parseInt(formData.term_months),
            });
            router.push(formData.investor ? `/investors/${formData.investor}` : '/investors');
        } catch (error) {
            console.error('Failed to record investment:', error);
            alert('Failed to record investment. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="glass rounded-xl p-8 border border-border space-y-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Select Investor</label>
                    <select
                        name="investor"
                        required
                        value={formData.investor}
                        onChange={handleChange}
                        className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Choose Investor</option>
                        {investors.map(inv => (
                            <option key={inv.id} value={inv.id}>{inv.name} ({inv.investor_number})</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Principal Capital Amount (KES)</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">KES</span>
                            <input
                                type="number"
                                name="principal_amount"
                                required
                                value={formData.principal_amount}
                                onChange={handleChange}
                                placeholder="0.00"
                                className="w-full bg-input border border-border rounded-lg py-2.5 pl-14 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Expected Annual Return (%)</label>
                        <div className="relative">
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">%</span>
                            <input
                                type="number"
                                name="expected_return_rate"
                                required
                                step="0.1"
                                value={formData.expected_return_rate}
                                onChange={handleChange}
                                placeholder="10.0"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                            />
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-border">
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Investment Term (Months)</label>
                        <input
                            type="number"
                            name="term_months"
                            required
                            value={formData.term_months}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Start Date</label>
                        <input
                            type="date"
                            name="investment_date"
                            required
                            value={formData.investment_date}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Maturity Date (Calculated)</label>
                        <input
                            type="date"
                            readOnly
                            value={formData.maturity_date}
                            className="w-full bg-slate-900/20 border border-border/50 rounded-lg py-2.5 px-4 text-muted-foreground cursor-not-allowed"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Investment Notes</label>
                    <textarea
                        name="notes"
                        rows={3}
                        value={formData.notes}
                        onChange={handleChange}
                        placeholder="Additional details about this capital placement..."
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
                    className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Recording...' : 'Record Investment'}
                </button>
            </div>
        </form>
    );
}

export default function NewInvestmentPage() {
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Add Capital Placement</h1>
                    <p className="text-muted-foreground mt-1">Record a new investment receipt</p>
                </div>
            </div>

            <Suspense fallback={<div className="text-muted-foreground">Loading form...</div>}>
                <NewInvestmentForm />
            </Suspense>
        </div>
    );
}
