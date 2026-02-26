'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, FileText, User, Printer, CheckCircle, FileX, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import api from '@/lib/api';

interface LedgerEntry {
    id: string;
    account_name: string;
    entry_type: 'debit' | 'credit';
    amount: string;
}

interface JournalEntry {
    id: string;
    date: string;
    description: string;
    reference: string;
    status: 'draft' | 'posted' | 'void';
    created_at: string;
    created_by: {
        first_name: string;
        last_name: string;
    } | null;
    ledger_entries: LedgerEntry[];
}

export default function JournalDetailsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchEntry = async () => {
            try {
                const response = await api.get(`/accounting/journal/${id}/`);
                setEntry(response.data);
            } catch (error) {
                console.error('Failed to fetch journal entry:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchEntry();
    }, [id]);

    const getStatusBadge = (status: string) => {
        const badges = {
            draft: { color: 'bg-slate-500/10 text-slate-400', icon: FileText },
            posted: { color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle },
            void: { color: 'bg-red-500/10 text-red-400', icon: FileX },
        };
        const badge = badges[status as keyof typeof badges] || badges.draft;
        const Icon = badge.icon;

        return (
            <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${badge.color} border border-white/5`}>
                <Icon className="h-3.5 w-3.5" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="text-center py-12">
                <h2 className="text-2xl font-bold">Journal entry not found</h2>
                <Button variant="link" onClick={() => router.back()} className="mt-4">
                    Go back
                </Button>
            </div>
        );
    }

    const totalDebits = entry.ledger_entries
        .filter(e => e.entry_type === 'debit')
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    const totalCredits = entry.ledger_entries
        .filter(e => e.entry_type === 'credit')
        .reduce((sum, e) => sum + parseFloat(e.amount), 0);

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <Button variant="ghost" className="gap-2 hover:bg-white/5" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                    Back to Journal
                </Button>
                <div className="flex gap-3">
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" />
                        Print
                    </Button>
                </div>
            </div>

            <Card className="bg-slate-900/50 border-white/10 overflow-hidden">
                <CardHeader className="border-b border-white/10 bg-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                            <CardTitle className="text-2xl font-bold font-heading">Journal Entry Details</CardTitle>
                            <p className="text-muted-foreground text-sm mt-1">Ref: {entry.reference || 'N/A'}</p>
                        </div>
                        {getStatusBadge(entry.status)}
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Date</p>
                                <p className="text-sm font-medium mt-0.5">{new Date(entry.date).toLocaleDateString('en-US', { dateStyle: 'long' })}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Created By</p>
                                <p className="text-sm font-medium mt-0.5">
                                    {entry.created_by ? `${entry.created_by.first_name} ${entry.created_by.last_name}` : 'System'}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                <FileText className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Description</p>
                                <p className="text-sm font-medium mt-0.5">{entry.description}</p>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-slate-900/50 border-white/10">
                <CardHeader className="border-b border-white/10">
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                        <Hash className="h-5 w-5 text-primary" />
                        Ledger Entries
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="border-white/10 hover:bg-transparent">
                                <TableHead className="w-[50%]">Account</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {entry.ledger_entries.map((ledger) => (
                                <TableRow key={ledger.id} className="border-white/10 hover:bg-white/5 transition-colors">
                                    <TableCell className="font-medium">{ledger.account_name}</TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {ledger.entry_type === 'debit' ?
                                            Number(ledger.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                                            '-'}
                                    </TableCell>
                                    <TableCell className="text-right tabular-nums">
                                        {ledger.entry_type === 'credit' ?
                                            Number(ledger.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) :
                                            '-'}
                                    </TableCell>
                                </TableRow>
                            ))}
                            <TableRow className="border-t-2 border-white/20 bg-white/5 font-bold">
                                <TableCell>Total</TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {totalDebits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                    {totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                            </TableRow>
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
