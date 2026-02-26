'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save, User, PiggyBank, Briefcase, Info } from 'lucide-react';
import api from '@/lib/api';

interface Borrower {
    id: string;
    borrower_type: string;
    first_name?: string;
    last_name?: string;
    business_name?: string;
    borrower_number: string;
    id_number?: string;
    tax_id?: string;
}

interface Product {
    id: string;
    name: string;
    code: string;
    interest_rate: number;
}

function SavingsForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [borrowers, setBorrowers] = useState<Borrower[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        borrower: searchParams.get('borrower') || '',
        product: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [borrowersRes, productsRes] = await Promise.all([
                    api.get('/customers/borrowers/'),
                    api.get('/savings/products/')
                ]);
                const borrowerList = borrowersRes.data.results || borrowersRes.data;
                setBorrowers(borrowerList);
                setProducts(productsRes.data.results || productsRes.data);

                // If borrower is in URL but not in the initial list, fetch them specifically
                const borrowerId = searchParams.get('borrower');
                if (borrowerId && !borrowerList.find((c: any) => c.id === borrowerId)) {
                    const singleRes = await api.get(`/customers/borrowers/${borrowerId}/`);
                    setBorrowers(prev => [...prev, singleRes.data]);
                    setFormData(prev => ({ ...prev, borrower: borrowerId }));
                }
            } catch (error) {
                console.error('Failed to fetch account options:', error);
            }
        };
        fetchData();
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const response = await api.post('/savings/accounts/', formData);
            router.push(`/savings/${response.data.id}`);
        } catch (error) {
            console.error('Failed to open account:', error);
            alert('Failed to open savings account. Please ensure borrower does not already have this product.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const selectedProduct = products.find(p => p.id === formData.product);

    const getBorrowerName = (b: Borrower) => {
        if (b.borrower_type === 'company' || b.borrower_type === 'institution') return b.business_name;
        return `${b.first_name} ${b.last_name}`;
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Open Savings Account</h1>
                    <p className="text-muted-foreground mt-1">Assign a savings product to a borrower</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-8">
                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <User className="h-3 w-3" /> Select Member / Borrower
                        </label>
                        <select
                            required
                            value={formData.borrower}
                            onChange={(e) => setFormData({ ...formData, borrower: e.target.value })}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">Choose a borrower...</option>
                            {borrowers.map(b => (
                                <option key={b.id} value={b.id}>
                                    {getBorrowerName(b)} ({b.borrower_number})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Briefcase className="h-3 w-3" /> Select Savings Product
                        </label>
                        <div className="grid grid-cols-1 gap-3">
                            {products.map(p => (
                                <label
                                    key={p.id}
                                    className={`flex items-center justify-between p-4 rounded-xl border transition-all cursor-pointer ${formData.product === p.id
                                        ? 'bg-primary/10 border-primary text-foreground'
                                        : 'bg-muted border-white/10 text-muted-foreground hover:border-white/20'
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <input
                                            type="radio"
                                            name="product"
                                            value={p.id}
                                            checked={formData.product === p.id}
                                            onChange={(e) => setFormData({ ...formData, product: e.target.value })}
                                            className="h-4 w-4 text-primary focus:ring-primary bg-slate-900"
                                        />
                                        <div>
                                            <p className="font-bold text-sm tracking-wide">{p.name}</p>
                                            <p className="text-[10px] uppercase font-bold text-muted-foreground">{p.code}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-primary">{p.interest_rate}%</p>
                                        <p className="text-[10px] uppercase text-muted-foreground">Per Annum</p>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-start gap-4 p-4 rounded-xl bg-blue-500/5 border border-blue-500/10">
                        <Info className="h-5 w-5 text-blue-400 mt-0.5" />
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                            Opening an account will generate a unique SAV-XXXXXX account number. The customer can start depositing immediately once the account is active.
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.borrower || !formData.product}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Processing...' : 'Activate Account'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function OpenSavingsAccountPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading form...</div>}>
            <SavingsForm />
        </Suspense>
    );
}
