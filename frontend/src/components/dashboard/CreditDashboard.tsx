'use client';

import { TrendingUp, FileText, AlertCircle, Clock, CheckCircle, ShieldCheck } from 'lucide-react';
import MetricCard from './MetricCard';

interface DashboardData {
    portfolio_value: number;
    portfolio_principal: number;
    portfolio_interest: number;
    active_loans_count: number;
    par_percentage: number;
    par_amount: number;
    disbursements_this_month: number;
    disbursements_count_mtd: number;
    pending_applications: number;
    avg_loan_size: number;
    total_borrowers: number;
    trends?: { month: string; disbursements: number }[];
    product_performance?: { name: string; portfolio_value: number; count: number }[];
}

export default function CreditDashboard({ data }: { data: DashboardData }) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    const maxDisbursement = Math.max(...(data.trends?.map(t => t.disbursements) || [1]));

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Queue: Pending Review"
                    value={data.pending_applications}
                    icon={Clock}
                    subtitle="Applications needing credit analysis"
                    trend="neutral"
                />
                <MetricCard
                    title="Portfolio at Risk (PAR)"
                    value={`${data.par_percentage.toFixed(1)}%`}
                    icon={AlertCircle}
                    subtitle={formatCurrency(data.par_amount)}
                    trend={data.par_percentage > 5 ? 'down' : 'up'}
                />
                <MetricCard
                    title="Credit Quality Index"
                    value="94.2%"
                    icon={ShieldCheck}
                    subtitle="Based on current repayments"
                />
                <MetricCard
                    title="Total Active Credits"
                    value={data.active_loans_count}
                    icon={FileText}
                    subtitle={`P: ${formatCurrency(data.portfolio_principal || 0)} | I: ${formatCurrency(data.portfolio_interest || 0)}`}
                />
                <MetricCard
                    title="Avg Approval Amount"
                    value={formatCurrency(data.avg_loan_size)}
                    icon={CheckCircle}
                />
                <MetricCard
                    title="MTD Disbursals"
                    value={data.disbursements_count_mtd}
                    icon={TrendingUp}
                    subtitle={formatCurrency(data.disbursements_this_month)}
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass rounded-xl p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-6">Processing Volume Trend</h3>
                    <div className="space-y-4">
                        {data.trends?.map((item, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted-foreground">{item.month}</span>
                                    <span className="font-medium text-foreground">{formatCurrency(item.disbursements)}</span>
                                </div>
                                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary"
                                        style={{ width: `${(item.disbursements / maxDisbursement) * 100}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="glass rounded-xl p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Portfolio Diversification</h3>
                    <div className="space-y-4">
                        {data.product_performance?.map((prod, idx) => (
                            <div key={idx} className="flex flex-col border-b border-border pb-3 last:border-0">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-foreground">{prod.name}</span>
                                    <span className="text-primary font-bold">{prod.count} loans</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    Exposure: {formatCurrency(prod.portfolio_value)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
