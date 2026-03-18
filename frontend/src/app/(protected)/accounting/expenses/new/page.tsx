'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Receipt, Camera, DollarSign } from 'lucide-react';
import api from '@/lib/api';

interface Account {
    id: string;
    code: string;
    name: string;
}

export default function NewExpensePage() {
    const router = useRouter();
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        account: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        vendor: '',
        expense_class: 'variable',
    });
    const [receipt, setReceipt] = useState<File | null>(null);
    const [receiptPreview, setReceiptPreview] = useState<string | null>(null);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                // Fetch expense accounts from COA
                const response = await api.get('/accounting/accounts/?account_type=expense');
                setAccounts(response.data.results || response.data);
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
            }
        };
        fetchAccounts();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const data = new FormData();
            data.append('account', formData.account);
            data.append('amount', formData.amount);
            data.append('description', formData.description);
            data.append('date', formData.date);
            data.append('vendor', formData.vendor);
            data.append('expense_class', formData.expense_class);
            if (receipt) {
                data.append('receipt', receipt);
            }

            await api.post('/expenses/expenses/', data, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            router.push('/accounting/expenses');
        } catch (error) {
            console.error('Failed to submit expense:', error);
            alert('Failed to submit expense. Please check your data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setReceipt(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setReceiptPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Submit Expense</h1>
                    <p className="text-muted-foreground mt-1">Record a new operational expenditure</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Expense Account</label>
                            <select
                                required
                                value={formData.account}
                                onChange={(e) => setFormData({ ...formData, account: e.target.value })}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select Account</option>
                                {accounts.map(acc => (
                                    <option key={acc.id} value={acc.id}>{acc.code} - {acc.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Amount (KES)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">KES</span>
                                <input
                                    type="number"
                                    required
                                    step="0.01"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                                    placeholder="0.00"
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-14 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Vendor / Merchant</label>
                            <input
                                type="text"
                                value={formData.vendor}
                                onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                                placeholder="e.g., Safaricom, etc."
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Expense Class</label>
                            <select
                                required
                                value={formData.expense_class}
                                onChange={(e) => setFormData({ ...formData, expense_class: e.target.value })}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="fixed">Fixed (e.g., Rent, Insurance)</option>
                                <option value="recurring">Recurring (e.g., Utilities)</option>
                                <option value="variable">Variable (e.g., Supplies)</option>
                                <option value="one_time">One-Time / Ad-Hoc</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Expense Date</label>
                            <input
                                type="date"
                                required
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Description / Purpose</label>
                        <textarea
                            required
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            rows={3}
                            placeholder="What was this expense for?"
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Receipt Image (Supporting Document)</label>
                        <input
                            type="file"
                            id="receipt-upload"
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <label
                            htmlFor="receipt-upload"
                            className="border-2 border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:border-primary/50 hover:text-slate-300 transition-all cursor-pointer overflow-hidden min-h-[160px]"
                        >
                            {receiptPreview ? (
                                <img src={receiptPreview} alt="Receipt preview" className="max-h-32 object-contain" />
                            ) : (
                                <>
                                    <Camera className="h-8 w-8" />
                                    <p className="text-sm font-medium">Click to upload receipt image</p>
                                    <p className="text-xs">Supports PNG, JPG (Max 5MB)</p>
                                </>
                            )}
                        </label>
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
                        className="flex items-center gap-2 px-8 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
                    </button>
                </div>
            </form>
        </div>
    );
}
