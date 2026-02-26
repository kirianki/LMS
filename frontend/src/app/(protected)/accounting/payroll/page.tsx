'use client';

import { useEffect, useState } from 'react';
import {
    Plus,
    Download,
    CheckCircle,
    Clock,
    AlertCircle,
    Search,
    Filter,
    ArrowUpRight,
    Users,
    Banknote,
    Receipt,
    Eye
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import DataTable from '@/components/ui/DataTable';
import { useToast } from '@/components/ui/use-toast';

interface PayrollRecord {
    id: string;
    user_email: string; // Assuming we add this to serializer or use method field
    user_name: string;
    month: number;
    year: number;
    gross_pay: number;
    net_pay: number;
    status: string;
    created_at: string;
}

export default function PayrollManagementPage() {
    const { toast } = useToast();
    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({
        total_payroll: 0,
        staff_count: 0,
        pending_approval: 0
    });

    const fetchPayrollData = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/payroll/');
            const data = response.data.results || response.data;
            setRecords(data);

            // Calculate simple stats
            const total = data.reduce((acc: number, curr: any) => acc + parseFloat(curr.net_pay), 0);
            const pending = data.filter((r: any) => r.status === 'draft').length;

            setStats({
                total_payroll: total,
                staff_count: new Set(data.map((r: any) => r.user)).size,
                pending_approval: pending
            });
        } catch (error) {
            console.error('Failed to fetch payroll records:', error);
            toast({
                title: 'Error',
                description: 'Failed to load payroll records',
                variant: 'destructive'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchPayrollData();
    }, []);

    const handleRunPayroll = async () => {
        const month = new Date().getMonth() + 1;
        const year = new Date().getFullYear();

        if (!confirm(`Run payroll for ${month}/${year}?`)) return;

        try {
            const res = await api.post('/payroll/generate-monthly/', { month, year });
            toast({
                title: 'Success',
                description: res.data.message
            });
            fetchPayrollData();
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.response?.data?.error || 'Failed to run payroll',
                variant: 'destructive'
            });
        }
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(amount);
    };

    const columns = [
        {
            header: 'Staff Member',
            accessor: (record: any) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border border-border">
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex flex-col">
                        <Link
                            href={`/accounting/payroll/${record.id}`}
                            className="text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-2 group"
                        >
                            {record.user_name || record.user_email || 'Staff member'}
                            <Eye className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </Link>
                        <span className="text-[10px] text-muted-foreground uppercase">{record.user_email}</span>
                    </div>
                </div>
            ),
        },
        {
            header: 'Period',
            accessor: (record: any) => `${record.month}/${record.year}`,
        },
        {
            header: 'Gross Pay',
            accessor: (record: any) => formatCurrency(record.gross_pay),
        },
        {
            header: 'Net Pay',
            accessor: (record: any) => formatCurrency(record.net_pay),
        },
        {
            header: 'Status',
            accessor: (record: any) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${record.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' :
                    record.status === 'approved' ? 'bg-blue-500/10 text-blue-400' :
                        'bg-amber-500/10 text-amber-400'
                    }`}>
                    {record.status}
                </span>
            ),
        },
        {
            header: 'Date Processed',
            accessor: (record: any) => new Date(record.created_at).toLocaleDateString(),
        }
    ];

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Payroll Management</h1>
                    <p className="text-muted-foreground mt-2">Manage staff salaries, statutory deductions, and payslips</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleRunPayroll}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/20"
                    >
                        <Plus className="h-4 w-4" />
                        Run Monthly Payroll
                    </button>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-primary/10">
                            <Banknote className="h-5 w-5 text-primary" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Total Net Payroll</span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">{formatCurrency(stats.total_payroll)}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">FOR ACCUMULATED RECORDS</p>
                </div>
                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-blue-500/10">
                            <Users className="h-5 w-5 text-blue-500" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Staff Count</span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">{stats.staff_count}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">TOTAL ACTIVE CONTRACTS</p>
                </div>
                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2.5 rounded-xl bg-amber-500/10">
                            <Clock className="h-5 w-5 text-amber-500" />
                        </div>
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pending Approval</span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground tracking-tight">{stats.pending_approval}</h3>
                    <p className="text-[10px] text-muted-foreground mt-2 font-medium">DRAFT PAYSLIPS</p>
                </div>
            </div>

            {/* Payroll History */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-foreground font-heading">Payroll History</h2>
                    <div className="flex items-center gap-2">
                        <button className="p-2 rounded-lg bg-input border border-border text-muted-foreground hover:text-foreground transition-colors">
                            <Download className="h-4 w-4" />
                        </button>
                        <button className="p-2 rounded-lg bg-input border border-border text-muted-foreground hover:text-foreground transition-colors">
                            <Filter className="h-4 w-4" />
                        </button>
                    </div>
                </div>
                <div className="glass rounded-2xl border border-border overflow-hidden">
                    <DataTable
                        columns={columns}
                        data={records}
                        isLoading={isLoading}
                        onSearch={setSearchQuery}
                    />
                </div>
            </div>
        </div>
    );
}
