'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import AdminDashboard from '@/components/dashboard/AdminDashboard';
import BranchDashboard from '@/components/dashboard/BranchDashboard';
import CreditDashboard from '@/components/dashboard/CreditDashboard';

interface DashboardData {
    portfolio_value: number;
    portfolio_principal: number;
    portfolio_interest: number;
    portfolio_penalties: number;
    portfolio_arrears: number;
    active_loans_count: number;
    par_percentage: number;
    par_amount: number;
    disbursements_this_month: number;
    disbursements_count_mtd: number;
    pending_applications: number;
    avg_loan_size: number;
    total_borrowers: number;
    active_borrowers: number;
    inactive_borrowers: number;
    trends?: { month: string; disbursements: number }[];
    branch_performance?: { name: string; portfolio_value: number; active_loans: number }[];
    product_performance?: { name: string; portfolio_value: number; count: number }[];
    total_collections_mtd: number;
    revenue_mtd: number;
    upcoming_repayments?: { loan_number: string; amount_due: number; due_date: string; borrower_name: string }[];
    collections_breakdown?: { month: string; year: number; principal: number; interest: number; penalty: number }[];
}

export default function DashboardPage() {
    const { user } = useAuthStore();
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);

    const perms = user?.permissions || [];
    const isSuper = user?.is_superuser;
    const branchName = user?.branch?.name;

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                // The backend API now automatically scopes data based on the user's role/branch
                const response = await api.get('/loans/dashboard_summary/');
                setData(response.data);
            } catch (error) {
                console.error('Failed to fetch dashboard:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboard();
    }, []);

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Loading secure dashboard...</div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-red-400">Failed to load dashboard data</div>
            </div>
        );
    }

    const renderDashboard = () => {

        // Admin/System-wide view: requires user management or superuser
        if (isSuper || perms.includes('users.view_user')) {
            return <AdminDashboard data={data} />;
        }

        // Branch-specific view: requires loan viewing and a branch assignment
        if (perms.includes('loans.view_loan') && branchName) {
            return <BranchDashboard data={data} branchName={branchName} />;
        }

        // Credit operations view: requires loan application permissions
        if (perms.includes('loans.view_loanapplication')) {
            return <CreditDashboard data={data} />;
        }

        // Default: restricted minimal view using AdminDashboard shell with data
        return <AdminDashboard data={data} />;
    };

    return (
        <div className="space-y-6">
            {/* Dynamic Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">
                    {isSuper || perms.includes('users.view_user') ? 'Executive Dashboard' :
                        perms.includes('loans.view_loan') && branchName ? 'Branch Dashboard' :
                            perms.includes('loans.view_loanapplication') ? 'Credit Operations' :
                                'My Dashboard'}
                </h1>
                <p className="text-muted-foreground mt-2">
                    {isSuper || perms.includes('users.view_user') ? 'Portfolio overview and organizational performance' :
                        perms.includes('loans.view_loan') && branchName ? `Managing operations for ${branchName}` :
                            'Operations and performance tracking'}
                </p>
            </div>

            {renderDashboard()}
        </div>
    );
}
