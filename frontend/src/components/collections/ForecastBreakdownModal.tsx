'use client';

import { useState, useEffect } from 'react';
import { X, Calendar, Download, Search, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';

interface BreakdownItem {
    id: string | number;
    loan_id: string;
    loan_number: string;
    borrower: string;
    due_date: string;
    amount_due: number;
    status: string;
}

interface ForecastBreakdownModalProps {
    isOpen: boolean;
    onClose: () => void;
    month: string;
}

export default function ForecastBreakdownModal({ isOpen, onClose, month }: ForecastBreakdownModalProps) {
    const router = useRouter();
    const [data, setData] = useState<BreakdownItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        if (isOpen && month) {
            fetchBreakdown();
        }
    }, [isOpen, month]);

    const fetchBreakdown = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/loans/collections_forecast_detail/?month=${encodeURIComponent(month)}`);
            setData(response.data);
        } catch (error) {
            console.error('Failed to fetch forecast breakdown:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    const columns = [
        {
            header: 'Loan #',
            accessor: (item: BreakdownItem) => (
                <button
                    onClick={() => router.push(`/loans/${item.loan_id}`)}
                    className="flex items-center gap-1 font-bold text-primary hover:underline group"
                >
                    {item.loan_number}
                    <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
            )
        },
        {
            header: 'Borrower',
            accessor: (item: BreakdownItem) => <span className="font-medium text-foreground">{item.borrower}</span>
        },
        {
            header: 'Due Date',
            accessor: (item: BreakdownItem) => <span className="text-muted-foreground">{item.due_date}</span>
        },
        {
            header: 'Amount Due',
            accessor: (item: BreakdownItem) => (
                <span className="font-bold text-foreground">
                    KES {Number(item.amount_due).toLocaleString()}
                </span>
            )
        },
        {
            header: 'Status',
            accessor: (item: BreakdownItem) => (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${item.status === 'overdue' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                    item.status === 'partial' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' :
                        'bg-blue-500/10 text-blue-500 border-blue-500/20'
                    }`}>
                    {item.status}
                </span>
            )
        }
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-300">
            <div className="glass w-full max-w-5xl max-h-[85vh] rounded-[2.5rem] border border-border flex flex-col overflow-hidden shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-8 duration-500">
                {/* Header */}
                <div className="p-8 border-b border-border flex items-center justify-between bg-primary/5">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20">
                            <Calendar className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground font-heading">
                                Collections Breakdown
                            </h2>
                            <p className="text-sm text-muted-foreground font-medium uppercase tracking-widest">{month}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-3 rounded-2xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
                    >
                        <X className="h-6 w-6" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden flex flex-col p-8">
                    <div className="flex-1 overflow-auto bg-muted/20 rounded-3xl border border-border/50 shadow-inner">
                        <DataTable
                            columns={columns}
                            data={data}
                            isLoading={isLoading}
                            onSearch={setSearchTerm}
                            onExport={() => {
                                const headers = ['Loan #', 'Borrower', 'Due Date', 'Amount Due', 'Status'];
                                const rows = data.map(item => [
                                    item.loan_number,
                                    item.borrower,
                                    item.due_date,
                                    item.amount_due,
                                    item.status
                                ]);
                                const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const link = document.createElement("a");
                                link.href = URL.createObjectURL(blob);
                                link.download = `collections_breakdown_${month.replace(' ', '_')}.csv`;
                                link.click();
                            }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="px-8 py-6 border-t border-border bg-muted/10 flex justify-end gap-3">
                    <div className="flex-1 flex items-center text-sm text-muted-foreground">
                        <span className="font-bold text-primary mr-1">{data.length}</span> records for this period
                    </div>
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-2xl bg-foreground text-background font-bold hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-foreground/10"
                    >
                        Close Breakdown
                    </button>
                </div>
            </div>
        </div>
    );
}
