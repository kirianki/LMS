'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, FileText } from 'lucide-react';
import LoanApplicationForm from '@/components/loans/LoanApplicationForm';

function NewLoanApplicationContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const borrowerId = searchParams.get('borrower');

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-xl hover:bg-muted text-muted-foreground transition-all border border-border"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                            <FileText className="h-8 w-8 text-primary" />
                            Launch New Application
                        </h1>
                        <p className="text-muted-foreground mt-1">Configure credit terms and submit for underwriting</p>
                    </div>
                </div>
            </div>

            <LoanApplicationForm
                initialBorrowerId={borrowerId || undefined}
                onSuccess={(id) => {
                    alert('Application created successfully!');
                    router.push(`/loans/applications/${id}`);
                }}
                onCancel={() => router.back()}
                showSummaryInSidebar={true}
            />
        </div>
    );
}

export default function NewLoanApplicationPage() {
    return (
        <Suspense fallback={
            <div className="flex h-[400px] items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <div className="text-muted-foreground font-bold tracking-widest uppercase text-xs animate-pulse">Initializing Application Flow...</div>
                </div>
            </div>
        }>
            <NewLoanApplicationContent />
        </Suspense>
    );
}
