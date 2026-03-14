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
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-muted/50 text-muted-foreground border border-border">
                        <User className="h-4 w-4" />
                    </div>
                    <div>
                        <p className="font-black text-foreground text-sm tracking-tight">{log.user_name || 'System'}</p>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black font-mono mt-0.5 opacity-60">ID: {log.id.split('-')[0]}</p>
                    </div>
                </div>
            ),
            header: 'User'
        },
        {
            accessor: (log: AuditLog) => (
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm ${log.action === 'delete' || log.action === 'reject'
                    ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    : log.action === 'approve' || log.action === 'disburse'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-primary/10 text-primary border-primary/20'
                    }`}>
                    {log.action_display}
                </span>
            ),
            header: 'Action'
        },
        {
            accessor: (log: AuditLog) => (
                <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-xl border border-border shadow-sm">
                    {log.module}
                </span>
            ),
            header: 'Module'
        },
        {
            accessor: (log: AuditLog) => (
                <p className="text-sm font-bold text-foreground max-w-md line-clamp-1">{log.description}</p>
            ),
            header: 'Activity'
        },
        {
            accessor: (log: AuditLog) => (
                <div className="flex flex-col items-end">
                    <p className="text-sm font-black text-foreground tabular-nums">
                        {new Date(log.timestamp).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest tabular-nums mt-0.5 opacity-60">
                        {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
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
        <div className="space-y-8 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black text-foreground tracking-tight flex items-center gap-4">
                        <History className="h-10 w-10 text-primary" />
                        System Audit Log
                    </h1>
                    <p className="text-muted-foreground mt-2 font-medium flex items-center gap-2">
                        Track and monitor all critical activities across the platform
                        <span className="h-1 w-1 rounded-full bg-border" />
                        <span className="text-[10px] font-black uppercase tracking-widest bg-orange-500/10 text-orange-500 px-2 py-0.5 rounded-lg border border-orange-500/20">
                            Immutable Ledger
                        </span>
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-muted/50 border border-border text-muted-foreground hover:bg-muted transition-all cursor-pointer">
                        <Shield className="h-4 w-4" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Compliance Mode</span>
                    </div>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {[
                    { label: 'Total Events', value: logs.length, icon: Monitor, color: 'primary' },
                    { label: 'Last 24 Hours', value: '--', icon: Clock, color: 'emerald' },
                    { label: 'Critical Errors', value: '0', icon: AlertCircle, color: 'rose' },
                    { label: 'Retention Policy', value: '90 Days', icon: Calendar, color: 'indigo' },
                ].map((stat, i) => (
                    <div key={i} className="glass rounded-[2rem] p-8 border border-border flex items-center gap-6 group hover:border-primary/50 transition-all duration-500">
                        <div className={`p-4 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-500 group-hover:scale-110 transition-transform duration-500 shadow-sm`}>
                            <stat.icon className="h-8 w-8" />
                        </div>
                        <div>
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{stat.label}</p>
                            <p className="text-3xl font-black text-foreground mt-1 tabular-nums tracking-tight">{stat.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content */}
            <div className="glass rounded-[2.5rem] border border-border overflow-hidden p-8 shadow-2xl relative">
                <div className="absolute top-0 right-0 p-8 flex items-center gap-4 z-10">
                    <button
                        onClick={() => {
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
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-xs font-black uppercase tracking-widest hover:bg-muted transition-all"
                    >
                        <Download className="h-4 w-4" />
                        Export
                    </button>
                </div>

                <div className="mb-8">
                    <DataTable
                        columns={columns}
                        data={logs}
                        isLoading={isLoading}
                        onSearch={setSearchQuery}
                        filterContent={
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Filter by Module</label>
                                    <div className="relative">
                                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                        <select
                                            value={filters.module}
                                            onChange={(e) => setFilters(prev => ({ ...prev, module: e.target.value }))}
                                            className="w-full bg-muted/50 border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-black appearance-none"
                                        >
                                            <option value="">All Functional Modules</option>
                                            {modules.map(m => <option key={m} value={m}>{m}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest pl-2">Action Type</label>
                                    <div className="relative">
                                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-50" />
                                        <select
                                            value={filters.action}
                                            onChange={(e) => setFilters(prev => ({ ...prev, action: e.target.value }))}
                                            className="w-full bg-muted/50 border border-border rounded-2xl pl-12 pr-4 py-4 text-sm focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none transition-all font-black appearance-none"
                                        >
                                            <option value="">All logged activities</option>
                                            {actions.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        }
                    />
                </div>
            </div>
        </div>
    );
}
