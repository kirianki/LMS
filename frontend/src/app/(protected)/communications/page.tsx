'use client';

import { useState, useEffect } from 'react';
import {
    MessageSquare,
    Mail,
    Filter,
    Search,
    RefreshCw,
    Plus,
    CheckCircle,
    XCircle,
    Clock,
    Smartphone,
    Send
} from 'lucide-react';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import MessageModal from '@/components/common/MessageModal';

interface CommunicationLog {
    id: string;
    recipient: string;
    message_type: 'sms' | 'email' | 'whatsapp';
    content: string;
    status: 'queued' | 'sent' | 'failed' | 'delivered';
    provider: string;
    provider_response: any;
    created_at: string;
    sent_at: string | null;
    borrower_name?: string;
    loan_number?: string;
}

export default function CommunicationsPage() {
    const [logs, setLogs] = useState<CommunicationLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'queued' | 'sent' | 'failed'>('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal State
    const [isComposeOpen, setIsComposeOpen] = useState(false);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (activeTab !== 'all') params.status = activeTab;
            if (searchQuery) params.search = searchQuery;

            const response = await api.get('/notifications/logs/', { params });
            // Handle pagination if results is paginated
            const data = Array.isArray(response.data) ? response.data :
                (Array.isArray(response.data?.results) ? response.data.results : []);
            setLogs(data);
        } catch (error) {
            console.error('Failed to fetch communication logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [activeTab]); // Fetch when tab changes

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs();
    };

    const columns = [
        {
            header: 'Date',
            accessor: (item: CommunicationLog) => (
                <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(item.created_at).toLocaleString()}
                </div>
            )
        },
        {
            header: 'Recipient',
            accessor: (item: CommunicationLog) => (
                <div>
                    <div className="font-medium text-foreground">{item.recipient}</div>
                    {item.borrower_name && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="opacity-70">Borrower:</span> {item.borrower_name}
                        </div>
                    )}
                </div>
            )
        },
        {
            header: 'Type',
            accessor: (item: CommunicationLog) => {
                const type = item.message_type;
                return (
                    <div className="flex items-center gap-2">
                        {type === 'sms' && <Smartphone className="h-4 w-4 text-blue-500" />}
                        {type === 'email' && <Mail className="h-4 w-4 text-purple-500" />}
                        <span className="capitalize text-sm">{type}</span>
                    </div>
                );
            }
        },
        {
            header: 'Message',
            accessor: (item: CommunicationLog) => (
                <div className="max-w-[300px] truncate text-sm text-foreground" title={item.content}>
                    {item.content}
                </div>
            )
        },
        {
            header: 'Status',
            accessor: (item: CommunicationLog) => {
                const status = item.status;
                let colorClass = 'bg-gray-100 text-gray-600';
                let Icon = Clock;

                if (status === 'sent' || status === 'delivered') {
                    colorClass = 'bg-emerald-100 text-emerald-600';
                    Icon = CheckCircle;
                } else if (status === 'failed') {
                    colorClass = 'bg-red-100 text-red-600';
                    Icon = XCircle;
                }

                return (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
                        <Icon className="h-3.5 w-3.5" />
                        <span className="capitalize">{status}</span>
                    </span>
                );
            }
        },
        {
            header: 'Provider',
            accessor: (item: CommunicationLog) => (
                <div className="text-xs text-muted-foreground capitalize">
                    {item.provider || '-'}
                </div>
            )
        }
    ];

    return (
        <div className="h-full flex flex-col space-y-6 max-w-[1600px] mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
                        <MessageSquare className="h-6 w-6 text-primary" />
                        Communications
                    </h1>
                    <p className="text-muted-foreground text-sm mt-1">
                        View and manage SMS, Email, and other correspondence.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => fetchLogs()}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsComposeOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors font-medium shadow-sm"
                    >
                        <Plus className="h-4 w-4" />
                        Send Message
                    </button>
                </div>
            </div>

            {/* Metrics Cards (Optional) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {['all', 'queued', 'sent', 'failed'].map((status) => (
                    <div
                        key={status}
                        onClick={() => setActiveTab(status as any)}
                        className={`cursor-pointer p-4 rounded-xl border transition-all ${activeTab === status
                            ? 'bg-primary/5 border-primary shadow-sm'
                            : 'bg-card border-border hover:border-primary/30'
                            }`}
                    >
                        <div className="flex justify-between items-start">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{status === 'all' ? 'Total Messages' : status}</p>
                            {status === 'sent' && <CheckCircle className="h-4 w-4 text-emerald-500" />}
                            {status === 'failed' && <XCircle className="h-4 w-4 text-red-500" />}
                            {status === 'queued' && <Clock className="h-4 w-4 text-amber-500" />}
                        </div>
                        <p className="text-2xl font-bold mt-2 text-foreground">
                            {activeTab === status ? logs.length : '-'}
                        </p>
                    </div>
                ))}
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col md:flex-row justify-between gap-4 bg-card p-4 rounded-xl border border-border">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
                    {['all', 'queued', 'sent', 'failed'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab
                                ? 'bg-secondary text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                }`}
                        >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search recipient or content..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 pr-4 py-2 h-10 w-full md:w-[250px] rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <button type='submit' className="p-2.5 rounded-lg border border-border hover:bg-muted text-muted-foreground transition-all">
                        <Filter className="h-4 w-4" />
                    </button>
                </form>
            </div>

            {/* Data Table */}
            <div className="flex-1 bg-card rounded-xl border border-border overflow-hidden">
                <DataTable
                    columns={columns}
                    data={logs}
                    isLoading={isLoading}
                />
            </div>

            {/* Compose Message Modal */}
            <MessageModal
                isOpen={isComposeOpen}
                onClose={() => setIsComposeOpen(false)}
                onSuccess={() => fetchLogs()}
            />
        </div>
    );
}
