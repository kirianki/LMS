'use client';

import { useState, useEffect } from 'react';
import { X, UserPlus, Phone, CreditCard, Tag, DollarSign, Search, User } from 'lucide-react';
import api from '@/lib/api';

interface GuarantorEntryModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    applicationId: string;
}

export default function GuarantorEntryModal({ isOpen, onClose, onSuccess, applicationId }: GuarantorEntryModalProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [guarantorType, setGuarantorType] = useState<'external' | 'borrower'>('external');
    const [searchQuery, setSearchQuery] = useState('');
    const [borrowers, setBorrowers] = useState<any[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        id_number: '',
        phone_number: '',
        relationship: '',
        amount_guaranteed: '',
        borrower: null as string | null,
    });

    useEffect(() => {
        if (guarantorType === 'borrower' && searchQuery.length >= 3) {
            const delayDebounceFn = setTimeout(() => {
                searchBorrowers();
            }, 500);
            return () => clearTimeout(delayDebounceFn);
        }
    }, [searchQuery, guarantorType]);

    const searchBorrowers = async () => {
        setIsSearching(true);
        try {
            const response = await api.get(`/customers/borrowers/?search=${searchQuery}`);
            setBorrowers(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to search borrowers:', error);
        } finally {
            setIsSearching(false);
        }
    };

    const handleSelectBorrower = (borrower: any) => {
        let name = `${borrower.first_name || ''} ${borrower.last_name || ''}`;
        if (borrower.borrower_type === 'company' || borrower.borrower_type === 'institution') {
            name = borrower.business_name;
        }

        setFormData({
            ...formData,
            name: name.trim(),
            id_number: borrower.id_number || borrower.tax_id || '',
            phone_number: borrower.phone_number,
            borrower: borrower.id
        });
        setGuarantorType('external'); // Switch back to form view but with populated data
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            await api.post('/loans/guarantors/', {
                application: applicationId,
                ...formData,
                amount_guaranteed: Number(formData.amount_guaranteed)
            });
            onSuccess();
            onClose();
            // Reset
            setFormData({
                name: '',
                id_number: '',
                phone_number: '',
                relationship: '',
                amount_guaranteed: '',
                borrower: null,
            });
        } catch (error: any) {
            console.error('Failed to add guarantor:', error);
            alert(error.response?.data?.error || 'Failed to add guarantor');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const getBorrowerName = (b: any) => {
        if (b.borrower_type === 'company' || b.borrower_type === 'institution') return b.business_name;
        return `${b.first_name} ${b.last_name}`;
    };

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <h2 className="text-xl font-bold text-foreground font-heading flex items-center gap-2">
                        <UserPlus className="h-5 w-5 text-primary" />
                        Add Guarantor
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Toggle Selector */}
                    <div className="flex p-1 bg-muted/30 rounded-xl border border-border">
                        <button
                            onClick={() => setGuarantorType('external')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${guarantorType === 'external' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                        >
                            Enter Details
                        </button>
                        <button
                            onClick={() => setGuarantorType('borrower')}
                            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${guarantorType === 'borrower' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground'}`}
                        >
                            Select Existing Borrower
                        </button>
                    </div>

                    {guarantorType === 'borrower' ? (
                        <div className="space-y-4">
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-input border border-border rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none"
                                    placeholder="Search by name, phone or ID..."
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2">
                                {isSearching ? (
                                    <div className="text-center py-4 text-muted-foreground animate-pulse text-xs">Searching...</div>
                                ) : borrowers.length > 0 ? (
                                    borrowers.map((b) => (
                                        <div
                                            key={b.id}
                                            onClick={() => handleSelectBorrower(b)}
                                            className="p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors flex items-center gap-3 group"
                                        >
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                                                <User className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-start">
                                                    <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{getBorrowerName(b)}</p>
                                                    <span className="text-[9px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{b.borrower_number}</span>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{b.phone_number} • {b.id_number || b.tax_id}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : searchQuery.length >= 3 ? (
                                    <div className="text-center py-4 text-muted-foreground text-xs italic">No borrowers found.</div>
                                ) : (
                                    <div className="text-center py-4 text-muted-foreground text-[10px] italic uppercase tracking-wider">Type at least 3 characters to search</div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Full Name</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <Tag className="h-4 w-4 text-muted-foreground" />
                                        </div>
                                        <input
                                            type="text"
                                            required
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                            placeholder="e.g. John Doe"
                                        />
                                    </div>
                                    {formData.borrower && (
                                        <p className="text-[10px] text-emerald-500 mt-1 flex items-center gap-1">
                                            <Tag className="h-3 w-3" /> Linked to existing borrower record
                                        </p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">ID Number</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <CreditCard className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={formData.id_number}
                                                onChange={(e) => setFormData({ ...formData, id_number: e.target.value })}
                                                className="w-full bg-input border border-border rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="National ID"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Phone Number</label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Phone className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <input
                                                type="text"
                                                required
                                                value={formData.phone_number}
                                                onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                                                className="w-full bg-input border border-border rounded-xl py-2 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                                                placeholder="07..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Relationship</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.relationship}
                                        onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2 px-3 text-sm focus:outline-none"
                                        placeholder="e.g. Spouse, Employer, Friend"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 block">Amount Guaranteed (KES)</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <DollarSign className="h-4 w-4 text-emerald-500" />
                                        </div>
                                        <input
                                            type="number"
                                            required
                                            value={formData.amount_guaranteed}
                                            onChange={(e) => setFormData({ ...formData, amount_guaranteed: e.target.value })}
                                            className="w-full bg-input border border-border rounded-xl py-2 pl-10 pr-3 text-sm font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-6 sticky bottom-0 bg-background py-2">
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
                                    className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-primary/20"
                                >
                                    {isSubmitting ? 'Saving...' : 'Confirm Guarantor'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}
