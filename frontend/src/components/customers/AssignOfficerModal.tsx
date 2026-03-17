'use client';

import { useState, useEffect } from 'react';
import { X, UserCheck, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface AssignOfficerModalProps {
    borrowerId: string;
    currentOfficerId?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AssignOfficerModal({ borrowerId, currentOfficerId, isOpen, onClose, onSuccess }: AssignOfficerModalProps) {
    const [officers, setOfficers] = useState<any[]>([]);
    const [selectedOfficer, setSelectedOfficer] = useState<string>(currentOfficerId || '');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchOfficers();
            setSelectedOfficer(currentOfficerId || '');
            setError(null);
        }
    }, [isOpen, currentOfficerId]);

    const fetchOfficers = async () => {
        setIsLoading(true);
        try {
            // Fetch users. You might want to filter this by role='Loan Officer' or similar in a real scenario
            const response = await api.get('/users/');
            const data = response.data.results || response.data;
            if (Array.isArray(data)) {
                setOfficers(data);
            }
        } catch (err) {
            console.error('Failed to fetch officers:', err);
            setError('Failed to load users for assignment.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedOfficer) {
            setError('Please select an officer.');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            await api.patch(`/customers/borrowers/${borrowerId}/`, {
                loan_officer: selectedOfficer
            });
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to assign officer:', err);
            setError(err.response?.data?.error || 'Failed to assign officer. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="bg-background rounded-2xl border border-border w-full max-w-md flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <div>
                        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                            <UserCheck className="h-5 w-5 text-primary" />
                            Assign Loan Officer
                        </h2>
                        <p className="text-xs text-muted-foreground mt-1">Reassign this customer's portfolio.</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-sm">
                            <AlertCircle className="h-4 w-4" />
                            {error}
                        </div>
                    )}

                    <form id="assignOfficerForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-foreground">Select Officer</label>
                            <select
                                value={selectedOfficer}
                                onChange={(e) => setSelectedOfficer(e.target.value)}
                                className="w-full bg-input border border-border rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary outline-none transition-all"
                                disabled={isLoading}
                            >
                                <option value="" disabled>Select an officer...</option>
                                {officers.map(officer => (
                                    <option key={officer.id} value={officer.id}>
                                        {officer.first_name} {officer.last_name} ({officer.email})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </form>
                </div>

                <div className="p-6 border-t border-border bg-muted/30 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg bg-background border border-border text-foreground hover:bg-muted font-medium transition-colors"
                        disabled={isSubmitting}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="assignOfficerForm"
                        disabled={isSubmitting || isLoading || !selectedOfficer}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 font-medium transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isSubmitting ? 'Saving...' : 'Assign Officer'}
                    </button>
                </div>
            </div>
        </div>
    );
}
