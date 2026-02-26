'use client';

import { useState, useEffect } from 'react';
import {
    History,
    Search,
    Filter,
    Download,
    User,
    Shield,
    Monitor,
    Clock,
    AlertCircle,
    Calendar
} from 'lucide-react';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';

interface AuditLog {
    id: string;
    user_name: string;
    action: string;
    action_display: string;
    module: string;
    description: string;
    timestamp: string;
    data: any;
}

export default function AuditLogPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filters, setFilters] = useState({
        module: '',
        action: ''
    });

    useEffect(() => {
        fetchLogs();
    }, [searchQuery, filters]);

    const fetchLogs = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (searchQuery) params.search = searchQuery;
            if (filters.module) params.module = filters.module;
            if (filters.action) params.action = filters.action;

            const res = await api.get('/auditlog/logs/', { params });
            setLogs(res.data.results || res.data);
        } catch (error) {
            console.error('Failed to fetch audit logs:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        {
            accessor: (log: AuditLog) => (
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10 text-primary">
                        <User className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground text-sm">{log.user_name || 'System'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black font-mono">ID: {log.id.split('-')[0]}</p>
                    </div>
                </div>
            ),
            header: 'User'
        },
        {
            accessor: (log: AuditLog) => (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${log.action === 'delete' || log.action === 'reject'
                        ? 'bg-red-500/10 text-red-500 border-red-500/20'
                        : log.action === 'approve' || log.action === 'disburse'
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-primary/10 text-primary border-primary/20'
                    }`}>
                    {log.action_display}
                </span>
            ),
            header: 'Action'
        },
        {
            accessor: (log: AuditLog) => (
                <span className="text-xs font-bold text-muted-foreground bg-muted/30 px-2 py-1 rounded-md border border-border">
                    {log.module}
                </span>
            ),
            header: 'Module'
        },
        {
            accessor: (log: AuditLog) => (
                <p className="text-sm text-foreground max-w-md line-clamp-1">{log.description}</p>
            ),
            header: 'Activity'
        },
        {
            accessor: (log: AuditLog) => (
                <div className="flex flex-col items-end">
                    <p className="text-sm font-bold text-foreground">
                        {new Date(log.timestamp).toLocaleDateString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {new Date(log.timestamp).toLocaleTimeString()}
                    </p>
                </div>
            ),
            header: 'Timestamp'
        }
    ];

    const modules = ['Loans', 'Customers', 'Configuration', 'Settings', 'Treasury'];
    const actions = [
        { value: 'create', label: 'Create' },
        { value: 'update', label: 'Update' },
        { value: 'delete', label: 'Delete' },
        { value: 'approve', label: 'Approve' },
        { value: 'disburse', label: 'Disburse' },
        { value: 'repay', label: 'Repayment' },
    ];

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <History className="h-8 w-8 text-primary" />
                        System Audit Log
                    </h1>
                    <p className="text-muted-foreground mt-1">Track and monitor all critical activities across the platform</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-500">
                        <Shield className="h-4 w-4" />
                        <span className="text-xs font-black uppercase tracking-widest italic">Immutable Logs</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass rounded-2xl p-6 border border-border flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                        <Monitor className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Total Events</p>
                        <p className="text-2xl font-bold text-foreground">{logs.length}</p>
                    </div>
                </div>
                <div className="glass rounded-2xl p-6 border border-border flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-500">
                        <Clock className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Last 24 Hours</p>
                        <p className="text-2xl font-bold text-foreground">--</p>
                    </div>
                </div>
                <div className="glass rounded-2xl p-6 border border-border flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-red-500/10 text-red-500">
                        <AlertCircle className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Critical Errors</p>
                        <p className="text-2xl font-bold text-foreground">0</p>
                    </div>
                </div>
                <div className="glass rounded-2xl p-6 border border-border flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-indigo-500/10 text-indigo-500">
                        <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-muted-foreground">Retention Policy</p>
                        <p className="text-2xl font-bold text-foreground">90 Days</p>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="glass rounded-2xl border border-border overflow-hidden p-6">
                <DataTable
                    columns={columns}
                    data={logs}
                    isLoading={isLoading}
                    onSearch={setSearchQuery}
                    onExport={() => {
                        const headers = ['Timestamp', 'User', 'Action', 'Module', 'Description'];
                        const rows = logs.map(log => [
                            new Date(log.timestamp).toISOString(),
                            log.user_name || 'System',
                            log.action_display,
                            log.module,
                            log.description
                        ]);
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `audit_log_${new Date().toISOString().split('T')[0]}.csv`);
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    filterContent={
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Module</label>
                                <select
                                    value={filters.module}
                                    onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold"
                                >
                                    <option value="">All Modules</option>
                                    {modules.map(m => <option key={m} value={m}>{m}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest pl-1">Action Type</label>
                                <select
                                    value={filters.action}
                                    onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none transition-all font-bold"
                                >
                                    <option value="">All Actions</option>
                                    {actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                </select>
                            </div>
                        </div>
                    }
                />
            </div>
        </div>
    );
}
