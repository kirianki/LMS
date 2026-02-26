'use client';

import { X } from 'lucide-react';
import LoanApplicationForm from './LoanApplicationForm';

interface NewApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function NewApplicationModal({ isOpen, onClose, onSuccess }: NewApplicationModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-background/50 backdrop-blur-md z-10">
                    <div>
                        <h2 className="text-2xl font-bold text-foreground font-heading">New Loan Application</h2>
                        <p className="text-sm text-muted-foreground mt-1">Initiate a new credit request for a borrower</p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="p-6">
                    <LoanApplicationForm
                        onSuccess={() => {
                            onSuccess();
                            onClose();
                        }}
                        onCancel={onClose}
                    />
                </div>
            </div>
        </div>
    );
}
