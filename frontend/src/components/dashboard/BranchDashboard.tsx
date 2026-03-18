'use client';

import { Users, Wallet, TrendingUp, AlertCircle, Building2, FileText, DollarSign, Activity, UserMinus } from 'lucide-react';
import MetricCard from './MetricCard';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from 'recharts';

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
    product_performance?: { name: string; portfolio_value: number; count: number }[];
    collections_breakdown?: { month: string; year: number; principal: number; interest: number; penalty: number; is_forecast?: boolean }[];
}

export default function BranchDashboard({ data, branchName }: { data: DashboardData, branchName?: string }) {
    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value);
    };

    // Prepare data for Pie Chart
    const portfolioBreakdownData = [
        { name: 'Principal', value: data.portfolio_principal || 0, color: '#3b82f6' }, // Blue
        { name: 'Interest', value: data.portfolio_interest || 0, color: '#10b981' }, // Green
        { name: 'Penalties', value: data.portfolio_penalties || 0, color: '#f59e0b' }, // Amber
    ].filter(item => item.value > 0);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 mb-2">
                <Building2 className="h-5 w-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Branch: {branchName || 'Assigned Branch'}</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Branch Portfolio"
                    value={formatCurrency(data.portfolio_value)}
                    icon={Wallet}
                    subtitle={`Avg Size: ${formatCurrency(data.avg_loan_size)}`}
                    trend="neutral"
                />
                <MetricCard
                    title="Disbursements (MTD)"
                    value={formatCurrency(data.disbursements_this_month)}
                    icon={DollarSign}
                    subtitle={`${data.disbursements_count_mtd} loans this month`}
                />
                <MetricCard
                    title="Portfolio in Arrears"
                    value={formatCurrency(data.portfolio_arrears)}
                    icon={AlertCircle}
                    subtitle={`PAR: ${data.par_percentage.toFixed(1)}%`}
                    trend={data.par_percentage > 5 ? 'down' : 'up'}
                />
                <MetricCard
                    title="Pending Applications"
                    value={data.pending_applications}
                    icon={TrendingUp}
                    subtitle="Awaiting credit review"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Borrower Demographics */}
                <div className="glass rounded-xl p-6 border border-border lg:col-span-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-6">
                        <Users className="h-5 w-5 text-primary" />
                        <h3 className="text-lg font-semibold text-foreground">Borrower Health</h3>
                    </div>

                    <div className="flex-1 flex flex-col justify-center space-y-8">
                        <div>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <p className="text-sm text-muted-foreground">Total Borrowers</p>
                                    <p className="text-3xl font-bold text-foreground">{data.total_borrowers}</p>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="flex items-center gap-1.5 text-emerald-500">
                                        <Activity className="h-4 w-4" /> Active
                                    </span>
                                    <span className="font-medium">{data.active_borrowers}</span>
                                </div>
                                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-emerald-500 transition-all duration-1000 ease-out"
                                        style={{ width: `${data.total_borrowers ? (data.active_borrowers / data.total_borrowers) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                        <UserMinus className="h-4 w-4" /> Inactive
                                    </span>
                                    <span className="font-medium">{data.inactive_borrowers}</span>
                                </div>
                                <div className="h-2.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-1000 ease-out"
                                        style={{ width: `${data.total_borrowers ? (data.inactive_borrowers / data.total_borrowers) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Portfolio Breakdown Pie Chart */}
                <div className="glass rounded-xl p-6 border border-border lg:col-span-1">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Portfolio Composition</h3>
                    {portfolioBreakdownData.length > 0 ? (
                        <div className="h-[250px] w-full">
                            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={portfolioBreakdownData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {portfolioBreakdownData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(value as number)}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="h-[250px] flex items-center justify-center text-muted-foreground">No portfolio data available</div>
                    )}
                    <div className="flex justify-center gap-4 mt-2 flex-wrap">
                        {portfolioBreakdownData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 text-sm">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Disbursement Trends Bar Chart */}
                <div className="glass rounded-xl p-6 border border-border lg:col-span-1">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Disbursement Trends</h3>
                    <div className="h-[260px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                            <BarChart data={data.trends || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `KES ${value / 1000}k`}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    width={65}
                                />
                                <Tooltip
                                    formatter={(value: any) => [formatCurrency(value as number), 'Disbursed']}
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                                />
                                <Bar dataKey="disbursements" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass rounded-xl p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Product Mix</h3>
                    <div className="space-y-4">
                        {data.product_performance?.map((prod, idx) => (
                            <div key={idx} className="flex flex-col border-b border-border pb-3 last:border-0">
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-medium text-foreground">{prod.name}</span>
                                    <span className="text-primary font-bold">{prod.count}</span>
                                </div>
                                <div className="text-xs text-muted-foreground">
                                    {formatCurrency(prod.portfolio_value)}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="glass rounded-xl p-6 border border-border">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Rolling Collections Window</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                            <BarChart data={data.collections_breakdown || []} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `K ${value / 1000}k`}
                                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                                    width={65}
                                />
                                <Tooltip
                                    formatter={(value: any, name: any, props: any) => {
                                        const label = name ? String(name).charAt(0).toUpperCase() + String(name).slice(1) : '';
                                        const isForecast = props.payload.is_forecast;
                                        return [`${formatCurrency(value as number)}${isForecast ? ' (Forecast)' : ''}`, label];
                                    }}
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.4 }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0.5rem', color: 'hsl(var(--foreground))' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px' }} />
                                <Bar dataKey="principal" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]}>
                                    {(data.collections_breakdown || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={entry.is_forecast ? 0.4 : 1} stroke={entry.is_forecast ? '#3b82f6' : 'none'} strokeDasharray={entry.is_forecast ? '4 4' : '0'} />
                                    ))}
                                </Bar>
                                <Bar dataKey="interest" stackId="a" fill="#10b981">
                                    {(data.collections_breakdown || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={entry.is_forecast ? 0.4 : 1} stroke={entry.is_forecast ? '#10b981' : 'none'} strokeDasharray={entry.is_forecast ? '4 4' : '0'} />
                                    ))}
                                </Bar>
                                <Bar dataKey="penalty" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]}>
                                    {(data.collections_breakdown || []).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fillOpacity={entry.is_forecast ? 0.4 : 1} stroke={entry.is_forecast ? '#f59e0b' : 'none'} strokeDasharray={entry.is_forecast ? '4 4' : '0'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
