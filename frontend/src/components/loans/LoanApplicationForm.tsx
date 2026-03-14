'use client';

import { useState, useEffect } from 'react';
import {
    User,
    Briefcase,
    DollarSign,
    Clock,
    FileText,
    CheckCircle2,
    Search,
    Building2,
    ArrowRight,
    RefreshCw,
    AlertCircle
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

interface LoanApplicationFormProps {
    onSuccess: (applicationId: string) => void;
    onCancel: () => void;
    initialBorrowerId?: string;
    showSummaryInSidebar?: boolean;
}

interface Product {
    id: string;
    name: string;
    code: string;
    min_amount: number;
    max_amount: number;
    default_term: number;
    min_term: number;
    max_term: number;
    suggested_interest_rate: number | null;
}

export default function LoanApplicationForm({
    onSuccess,
    onCancel,
    initialBorrowerId,
    showSummaryInSidebar = false
}: LoanApplicationFormProps) {
    const { user } = useAuthStore();
    const [borrowers, setBorrowers] = useState<any[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        borrower: initialBorrowerId || '',
        product: '',
        requested_amount: '',
        requested_term: '',
        purpose: '',
        refinances_loan: ''
    });

    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isRefinancing, setIsRefinancing] = useState(false);
    const [eligibleLoans, setEligibleLoans] = useState<any[]>([]);
    const [selectedLoan, setSelectedLoan] = useState<any>(null);
    const [payoffPreview, setPayoffPreview] = useState<{ payoff: number, net: number } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            const [borrowerRes, prodRes] = await Promise.all([
                api.get('/customers/borrowers/'),
                api.get('/loans/products/')
            ]);
            setBorrowers(borrowerRes.data.results || borrowerRes.data);
            setProducts(prodRes.data.results || prodRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    // Fetch active loans for selected borrower
    const fetchEligibleLoans = async (borrowerId: string) => {
        try {
            const response = await api.get(`/loans/?borrower=${borrowerId}&status=active`);
            const loans = response.data.results || response.data;
            // Filter out already refinanced loans
            setEligibleLoans(loans.filter((l: any) => !l.is_refinanced));
        } catch (error) {
            console.error('Failed to fetch eligible loans:', error);
        }
    };

    // Fetch loans when borrower changes
    useEffect(() => {
        if (formData.borrower && isRefinancing) {
            fetchEligibleLoans(formData.borrower);
        }
    }, [formData.borrower, isRefinancing]);

    // Calculate refinancing preview
    useEffect(() => {
        if (isRefinancing && selectedLoan && formData.requested_amount) {
            const payoff = parseFloat(selectedLoan.outstanding_balance);
            const net = parseFloat(formData.requested_amount) - payoff;
            setPayoffPreview({ payoff, net });
        } else {
            setPayoffPreview(null);
        }
    }, [isRefinancing, selectedLoan, formData.requested_amount]);

    const handleProductChange = (productId: string) => {
        const product = products.find((p: Product) => p.id === productId);
        setSelectedProduct(product || null);
        setFormData({
            ...formData,
            product: productId,
            requested_amount: product ? product.min_amount.toString() : '',
            requested_term: product ? product.default_term.toString() : ''
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            const payload: any = {
                ...formData,
                requested_amount: Number(formData.requested_amount),
                requested_term: Number(formData.requested_term),
                status: 'submitted',
                branch: user?.branch?.id
            };

            // Only include refinances_loan if refinancing is enabled
            if (isRefinancing && formData.refinances_loan) {
                payload.refinances_loan = formData.refinances_loan;
            } else {
                delete payload.refinances_loan;
            }

            const res = await api.post('/loans/applications/', payload);
            onSuccess(res.data.id);
        } catch (error: any) {
            console.error('Failed to create application:', error);
            alert(error.response?.data?.error || 'Failed to create application. Please check limits.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getBorrowerName = (b: any) => {
        if (b.borrower_type === 'company' || b.borrower_type === 'institution') return b.business_name;
        return `${b.first_name} ${b.last_name}`;
    };

    const filteredBorrowers = borrowers.filter((b: any) => {
        const name = getBorrowerName(b).toLowerCase();
        return name.includes(searchQuery.toLowerCase()) ||
            b.id_number?.includes(searchQuery) ||
            b.borrower_number?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const selectedBorrower = borrowers.find(b => b.id === formData.borrower);

    const FormContent = (
        <div className="space-y-6">
            {/* Step 1: Borrower Selection */}
            <div className={`p-6 rounded-2xl border border-border ${showSummaryInSidebar ? 'glass' : 'bg-muted/10'}`}>
                <div className="flex items-center gap-2 text-primary mb-6">
                    <User className="h-5 w-5" />
                    <h3 className="font-semibold text-lg">Borrower Selection</h3>
                </div>

                {!formData.borrower ? (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <input
                                type="text"
                                placeholder="Search by name, ID, or borrower number..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto border border-border rounded-xl bg-background divide-y divide-border">
                            {isLoadingData ? (
                                <div className="p-8 text-center text-sm text-muted-foreground animate-pulse font-medium">Loading borrowers...</div>
                            ) : filteredBorrowers.length === 0 ? (
                                <div className="p-8 text-center text-sm text-muted-foreground italic">No matches found.</div>
                            ) : (
                                filteredBorrowers.map((b: any) => (
                                    <button
                                        key={b.id}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, borrower: b.id })}
                                        className="w-full text-left p-4 hover:bg-primary/5 transition-colors flex items-center justify-between group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="p-2.5 rounded-full bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary transition-all">
                                                {b.borrower_type === 'individual' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">{getBorrowerName(b)}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{b.borrower_number}</p>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-all" />
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-2.5 rounded-full bg-primary/10 text-primary">
                                {selectedBorrower?.borrower_type === 'individual' ? <User className="h-5 w-5" /> : <Building2 className="h-5 w-5" />}
                            </div>
                            <div>
                                <p className="font-bold text-foreground text-lg">{selectedBorrower ? getBorrowerName(selectedBorrower) : 'Selected Borrower'}</p>
                                <p className="text-sm text-muted-foreground">{selectedBorrower?.borrower_number || 'N/A'}</p>
                            </div>
                        </div>
                        {!initialBorrowerId && (
                            <button
                                type="button"
                                onClick={() => setFormData({ ...formData, borrower: '' })}
                                className="text-xs font-bold text-primary hover:underline uppercase tracking-widest"
                            >
                                Change
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Refinancing Section - shown only if borrower is selected */}
            {formData.borrower && (
                <div className={`p-6 rounded-2xl border border-border ${showSummaryInSidebar ? 'glass' : 'bg-muted/10'}`}>
                    <div className="flex items-center gap-2 text-primary mb-6">
                        <RefreshCw className="h-5 w-5" />
                        <h3 className="font-semibold text-lg">Loan Refinancing</h3>
                    </div>

                    <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-border hover:border-primary/50 transition-all cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={isRefinancing}
                            onChange={(e) => {
                                setIsRefinancing(e.target.checked);
                                if (!e.target.checked) {
                                    setFormData({ ...formData, refinances_loan: '' });
                                    setSelectedLoan(null);
                                }
                            }}
                            className="h-5 w-5 rounded border-2 border-border text-primary focus:ring-2 focus:ring-primary"
                        />
                        <div>
                            <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                                This loan will pay off an existing loan
                            </span>
                            <p className="text-xs text-muted-foreground mt-1">
                                Use this new loan to refinance and close out an active loan
                            </p>
                        </div>
                    </label>

                    {isRefinancing && (
                        <div className="mt-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">
                                    Select Loan to Refinance
                                </label>
                                <select
                                    value={formData.refinances_loan}
                                    onChange={(e) => {
                                        setFormData({ ...formData, refinances_loan: e.target.value });
                                        const loan = eligibleLoans.find(l => l.id === e.target.value);
                                        setSelectedLoan(loan || null);
                                    }}
                                    className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none transition-all font-medium"
                                >
                                    <option value="">Select a loan to refinance...</option>
                                    {eligibleLoans.map((loan) => (
                                        <option key={loan.id} value={loan.id}>
                                            {loan.loan_number} - Outstanding: KES {Number(loan.outstanding_balance).toLocaleString()}
                                        </option>
                                    ))}
                                </select>
                                {eligibleLoans.length === 0 && (
                                    <p className="text-xs text-orange-400 flex items-center gap-1 pl-1">
                                        <AlertCircle className="h-3 w-3" />
                                        No active loans available for refinancing
                                    </p>
                                )}
                            </div>

                            {payoffPreview && payoffPreview.net >= 0 && (
                                <div className="p-4 bg-primary/5 rounded-xl border border-primary/20">
                                    <h4 className="font-semibold mb-3 text-sm text-primary flex items-center gap-2">
                                        <CheckCircle2 className="h-4 w-4" />
                                        Refinancing Breakdown
                                    </h4>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">New Loan Amount:</span>
                                            <span className="font-semibold text-foreground">KES {Number(formData.requested_amount).toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-orange-400">
                                            <span>Less: Payoff {selectedLoan?.loan_number}:</span>
                                            <span className="font-semibold">KES {payoffPreview.payoff.toLocaleString()}</span>
                                        </div>
                                        <div className="h-px bg-border my-2" />
                                        <div className="flex justify-between border-t pt-2 text-primary">
                                            <span className="font-bold">Net to Customer:</span>
                                            <span className="font-bold text-lg">KES {payoffPreview.net.toLocaleString()}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {payoffPreview && payoffPreview.net < 0 && (
                                <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/20">
                                    <p className="text-sm text-red-400 flex items-center gap-2">
                                        <AlertCircle className="h-4 w-4" />
                                        New loan amount must be greater than the outstanding balance (KES {payoffPreview.payoff.toLocaleString()})
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Step 2: Loan Details */}
            <div className={`p-6 rounded-2xl border border-border ${showSummaryInSidebar ? 'glass' : 'bg-muted/10'}`}>
                <div className="flex items-center gap-2 text-primary mb-6">
                    <Briefcase className="h-5 w-5" />
                    <h3 className="font-semibold text-lg">Loan Configuration</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Loan Product</label>
                        <select
                            required
                            value={formData.product}
                            onChange={(e) => handleProductChange(e.target.value)}
                            className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary appearance-none transition-all font-medium"
                        >
                            <option value="">Select a product</option>
                            {products.map((p: Product) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Requested Term (Months)</label>
                        <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="number"
                                required
                                min={selectedProduct?.min_term || 1}
                                max={selectedProduct?.max_term || 120}
                                value={formData.requested_term}
                                onChange={(e) => setFormData({ ...formData, requested_term: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold"
                            />
                        </div>
                        {selectedProduct && (
                            <p className="text-[10px] text-muted-foreground font-bold pl-1 italic">
                                Allowable: {selectedProduct.min_term} - {selectedProduct.max_term} months
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Requested Amount</label>
                        <div className="relative">
                            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                            <input
                                type="number"
                                required
                                min={selectedProduct?.min_amount || 0}
                                max={selectedProduct?.max_amount || 10000000}
                                value={formData.requested_amount}
                                onChange={(e) => setFormData({ ...formData, requested_amount: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-bold text-lg"
                            />
                        </div>
                        {selectedProduct && (
                            <p className="text-[10px] text-muted-foreground font-bold pl-1 italic">
                                Allowable: KES {Number(selectedProduct.min_amount).toLocaleString()} - KES {Number(selectedProduct.max_amount).toLocaleString()}
                            </p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Purpose of Loan</label>
                        <div className="relative">
                            <FileText className="absolute left-3 top-3.5 h-5 w-5 text-muted-foreground" />
                            <textarea
                                rows={1}
                                required
                                value={formData.purpose}
                                onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                                className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none font-medium"
                                placeholder="Business expansion..."
                            />
                        </div>
                    </div>
                </div>
            </div>

            {!showSummaryInSidebar && (
                <div className="flex gap-4 pt-4">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 py-4 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/80 transition-all border border-border"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting || !formData.borrower || !formData.product}
                        className="flex-1 py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-primary/30 flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                            <>
                                <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                Submitting...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-5 w-5" />
                                Submit Application
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );

    if (showSummaryInSidebar) {
        return (
            <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                    {FormContent}
                </div>
                <div>
                    <div className="glass rounded-2xl p-6 border border-border sticky top-6">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Application Summary</h3>

                        <div className="space-y-4 mb-8">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Product</span>
                                <span className="font-bold text-foreground">{selectedProduct?.name || '---'}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground font-medium">Default Rate</span>
                                <span className="font-bold text-foreground">{selectedProduct?.suggested_interest_rate ? `${selectedProduct.suggested_interest_rate}% p.a.` : '---'}</span>
                            </div>
                            <div className="h-px bg-border my-2" />
                            <div className="flex justify-between items-end">
                                <span className="text-sm text-muted-foreground font-medium mb-1">Total Requested</span>
                                <div className="text-right">
                                    <p className="text-xs text-muted-foreground font-black uppercase tracking-widest italic">KES</p>
                                    <p className="text-3xl font-black text-primary">{formData.requested_amount ? Number(formData.requested_amount).toLocaleString() : '0'}</p>
                                </div>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting || !formData.borrower || !formData.product}
                            className="w-full py-4 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-2xl shadow-primary/40 flex items-center justify-center gap-3 text-lg"
                        >
                            {isSubmitting ? (
                                <>
                                    <div className="h-5 w-5 border-3 border-white/20 border-t-white rounded-full animate-spin" />
                                    Submitting...
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="h-6 w-6" />
                                    Submit Application
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        );
    }

    return (
        <form onSubmit={handleSubmit}>
            {FormContent}
        </form>
    );
}
