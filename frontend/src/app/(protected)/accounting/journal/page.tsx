'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, FileText, CheckCircle, XCircle, FileX } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface JournalEntry {
    id: string;
    date: string;
    description: string;
    reference: string;
    status: string;
    created_at: string;
    created_by: {
        first_name: string;
        last_name: string;
    };
}

export default function JournalEntriesPage() {
    const router = useRouter();
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchEntries = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/accounting/journal/${query ? `?search=${query}` : ''}`);
            setEntries(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch journal entries:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchEntries(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const getStatusBadge = (status: string) => {
        const badges = {
            draft: { color: 'bg-slate-500/10 text-muted-foreground', icon: FileText },
            posted: { color: 'bg-emerald-500/10 text-emerald-400', icon: CheckCircle },
            void: { color: 'bg-red-500/10 text-red-400', icon: FileX },
        };
        const badge = badges[status as keyof typeof badges] || badges.draft;
        const Icon = badge.icon;

        return (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge.color} w-fit`}>
                <Icon className="h-3.5 w-3.5" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const columns = [
        {
            header: 'Date',
            accessor: (entry: JournalEntry) => new Date(entry.date).toLocaleDateString(),
        },
        {
            header: 'Description',
            accessor: (entry: JournalEntry) => (
                <div>
                    <p className="font-medium text-foreground">{entry.description}</p>
                    {entry.reference && <p className="text-xs text-muted-foreground">Ref: {entry.reference}</p>}
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: (entry: JournalEntry) => getStatusBadge(entry.status),
        },
        {
            header: 'Created By',
            accessor: (entry: JournalEntry) => (
                <span className="text-sm text-slate-300">
                    {entry.created_by?.first_name} {entry.created_by?.last_name}
                </span>
            ),
        },
        {
            header: 'Created',
            accessor: (entry: JournalEntry) => new Date(entry.created_at).toLocaleDateString(),
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Journal Entries</h1>
                <p className="text-muted-foreground mt-2">Double-entry bookkeeping transactions</p>
            </div>

            <DataTable
                columns={columns}
                data={entries}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(entry) => router.push(`/accounting/journal/${entry.id}`)}
                actionButton={{
                    label: 'New Entry',
                    icon: Plus,
                    onClick: () => router.push('/accounting/journal/new'),
                }}
            />
        </div>
    );
}
