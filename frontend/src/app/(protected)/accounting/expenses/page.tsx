'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Receipt, CheckCircle, XCircle, Clock, DollarSign } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Expense {
    id: string;
    expense_number: string;
    account_code: string;
    account_name: string;
    amount: number;
    description: string;
    date: string;
    vendor: string;
    status: string;
    expense_class: string;
    expense_class_display: string;
    created_by: {
        first_name: string;
        last_name: string;
    };
}

export default function ExpensesPage() {
    const router = useRouter();
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchExpenses = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/expenses/expenses/${query ? `?search=${query}` : ''}`);
            setExpenses(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch expenses:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchExpenses(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const getStatusBadge = (status: string) => {
        const badges = {
            pending: { color: 'bg-amber-500/10 text-amber-400', icon: Clock },
            approved: { color: 'bg-blue-500/10 text-blue-400', icon: CheckCircle },
            rejected: { color: 'bg-red-500/10 text-red-400', icon: XCircle },
            paid: { color: 'bg-emerald-500/10 text-emerald-400', icon: DollarSign },
        };
        const badge = badges[status as keyof typeof badges] || badges.pending;
        const Icon = badge.icon;

        return (
            <span className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${badge.color} w-fit`}>
                <Icon className="h-3.5 w-3.5" />
                {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
        );
    };

    const getClassBadge = (expenseClass: string, display: string) => {
        const badges = {
            fixed: 'bg-indigo-500/10 text-indigo-400',
            recurring: 'bg-purple-500/10 text-purple-400',
            variable: 'bg-slate-500/10 text-slate-400',
            one_time: 'bg-pink-500/10 text-pink-400',
        };
        const color = badges[expenseClass as keyof typeof badges] || badges.variable;

        return (
            <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${color} w-fit`}>
                {display || expenseClass}
            </span>
        );
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const columns = [
        {
            header: 'Expense',
            accessor: (expense: Expense) => (
                <div>
                    <p className="font-medium text-foreground">{expense.expense_number}</p>
                    <p className="text-sm text-muted-foreground">{expense.account_code ? `${expense.account_code} - ${expense.account_name}` : expense.account_name}</p>
                </div>
            ),
        },
        {
            header: 'Description',
            accessor: (expense: Expense) => (
                <div>
                    <p className="text-sm text-foreground">{expense.description.substring(0, 50)}{expense.description.length > 50 && '...'}</p>
                    {expense.vendor && <p className="text-xs text-muted-foreground">Vendor: {expense.vendor}</p>}
                </div>
            ),
        },
        {
            header: 'Amount',
            accessor: (expense: Expense) => (
                <span className="font-bold text-foreground">{formatCurrency(expense.amount)}</span>
            ),
        },
        {
            header: 'Date',
            accessor: (expense: Expense) => new Date(expense.date).toLocaleDateString(),
        },
        {
            header: 'Class',
            accessor: (expense: Expense) => getClassBadge(expense.expense_class, expense.expense_class_display),
        },
        {
            header: 'Status',
            accessor: (expense: Expense) => getStatusBadge(expense.status),
        },
        {
            header: 'Submitted By',
            accessor: (expense: Expense) => (
                <span className="text-sm text-slate-300">
                    {expense.created_by?.first_name} {expense.created_by?.last_name}
                </span>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Expenses</h1>
                <p className="text-muted-foreground mt-2">Track and approve operational expenses</p>
            </div>

            <DataTable
                columns={columns}
                data={expenses}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(expense) => router.push(`/accounting/expenses/${expense.id}`)}
                actionButton={{
                    label: 'New Expense',
                    icon: Plus,
                    onClick: () => router.push('/accounting/expenses/new'),
                }}
            />
        </div>
    );
}
