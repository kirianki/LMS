'use client';

import { Wallet, Users, TrendingUp, AlertCircle, FileText, DollarSign, Activity, UserMinus, Calendar, ArrowRight, Clock } from 'lucide-react';
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
    branch_performance?: { name: string; portfolio_value: number; active_loans: number }[];
    product_performance?: { name: string; portfolio_value: number; count: number }[];
    total_collections_mtd: number;
    revenue_mtd: number;
    upcoming_repayments?: { loan_number: string; amount_due: number; due_date: string; borrower_name: string }[];
    collections_breakdown?: { month: string; year: number; principal: number; interest: number; penalty: number }[];
}

export default function AdminDashboard({ data }: { data: DashboardData }) {
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
        { name: 'Interest', value: data.portfolio_interest || 0, color: '#10b981' }, // Emerald
        { name: 'Penalties', value: data.portfolio_penalties || 0, color: '#f59e0b' }, // Amber
    ].filter(item => item.value > 0);

    return (
        <div className="space-y-8 pb-12">
            {/* Top Metrics Row - Glassmorphism styled */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <MetricCard
                    title="Total Portfolio"
                    value={formatCurrency(data.portfolio_value)}
                    icon={Wallet}
                    subtitle={`Avg Size: ${formatCurrency(data.avg_loan_size)}`}
                    trend="neutral"
                />
                <MetricCard
                    title="Net Revenue (MTD)"
                    value={formatCurrency(data.revenue_mtd || 0)}
                    icon={TrendingUp}
                    subtitle="Interest & Penalties"
                />
                <MetricCard
                    title="Total Collections (MTD)"
                    value={formatCurrency(data.total_collections_mtd || 0)}
                    icon={DollarSign}
                    subtitle={`${data.active_loans_count} Active Loans`}
                />
                <MetricCard
                    title="At Risk Portfolio"
                    value={formatCurrency(data.portfolio_arrears)}
                    icon={AlertCircle}
                    subtitle={`PAR: ${data.par_percentage.toFixed(1)}%`}
                    trend={data.par_percentage > 5 ? 'down' : 'up'}
                />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Upcoming Repayments / Inflow Pipeline */}
                <div className="glass rounded-[2rem] p-8 border border-border lg:col-span-1 flex flex-col h-[350px] hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className="flex justify-between items-center mb-6 shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-foreground">Pending Inflows</h3>
                                <p className="text-xs text-muted-foreground font-medium">Next 7 Days</p>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-2 space-y-3 font-mono custom-scrollbar">
                        {data.upcoming_repayments && data.upcoming_repayments.length > 0 ? (
                            data.upcoming_repayments.map((rep, idx) => (
                                <div key={idx} className="group p-4 rounded-2xl bg-muted/30 border border-border/50 hover:bg-background hover:border-primary/30 transition-all flex items-center justify-between shrink-0">
                                    <div className="space-y-1 overflow-hidden">
                                        <p className="text-sm font-bold text-foreground font-sans truncate pr-2" title={rep.borrower_name}>{rep.borrower_name}</p>
                                        <p className="text-[10px] text-muted-foreground font-bold tracking-widest">{rep.loan_number}</p>
                                    </div>
                                    <div className="text-right shrink-0 pl-2">
                                        <p className="text-sm font-black text-foreground text-primary">KES {Number(rep.amount_due).toLocaleString()}</p>
                                        <p className="text-[10px] text-muted-foreground uppercase flex items-center justify-end gap-1 mt-1 font-sans font-bold">
                                            <Clock className="h-3 w-3 text-muted-foreground/50" /> {new Date(rep.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-50 font-sans">
                                <Calendar className="h-10 w-10 text-muted-foreground stroke-1" />
                                <p className="text-sm font-medium">No impending repayments</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Portfolio Breakdown Pie Chart */}
                <div className="glass rounded-[2rem] p-8 border border-border lg:col-span-1 flex flex-col h-[350px] hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-4 shrink-0">
                        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-foreground">Asset Composition</h3>
                            <p className="text-xs text-muted-foreground font-medium">Value Distribution</p>
                        </div>
                    </div>
                    {portfolioBreakdownData.length > 0 ? (
                        <div className="flex-1 w-full min-h-[200px]">
                            <ResponsiveContainer width="100%" height="100%" minHeight={0}>
                                <PieChart>
                                    <Pie
                                        data={portfolioBreakdownData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={65}
                                        outerRadius={85}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={4}
                                    >
                                        {portfolioBreakdownData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: any) => formatCurrency(value as number)}
                                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'border: rgba(255, 255, 255, 0.1)', borderRadius: '1rem', color: 'hsl(var(--foreground))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' }}
                                        itemStyle={{ color: 'hsl(var(--foreground))', fontWeight: 'bold' }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 font-sans">
                            <Activity className="h-10 w-10 mb-3 stroke-1" />
                            <p className="text-sm font-medium">No portfolio data</p>
                        </div>
                    )}
                    <div className="flex justify-center gap-3 flex-wrap shrink-0">
                        {portfolioBreakdownData.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border/50 text-[10px] font-bold uppercase tracking-wider">
                                <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: item.color }} />
                                <span className="text-foreground">{item.name}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Disbursement Trends Bar Chart */}
                <div className="glass rounded-[2rem] p-8 border border-border lg:col-span-1 flex flex-col h-[350px] hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-6 shrink-0">
                        <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-foreground">Capital Deployment</h3>
                            <p className="text-xs text-muted-foreground font-medium">6 Month Trend</p>
                        </div>
                    </div>
                    <div className="flex-1 w-full min-h-[200px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data.trends || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                                <XAxis
                                    dataKey="month"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(value) => `K ${value / 1000}k`}
                                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                    width={55}
                                />
                                <Tooltip
                                    formatter={(value: any) => [formatCurrency(value as number), 'Disbursed']}
                                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'border: rgba(255, 255, 255, 0.1)', borderRadius: '1rem', color: 'hsl(var(--foreground))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' }}
                                />
                                <Bar dataKey="disbursements" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40}>
                                    {data.trends?.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={'hsl(var(--primary))'} fillOpacity={index === data.trends!.length - 1 ? 1 : 0.6} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Collections Breakdown Stacked Bar Chart */}
            <div className="glass rounded-[2rem] p-8 border border-border flex flex-col hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                <div className="flex items-center gap-3 mb-6 shrink-0">
                    <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
                        <Activity className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-lg font-black text-foreground">Collections Breakdown</h3>
                        <p className="text-xs text-muted-foreground font-medium">Principal, Interest & Penalties (12 Months)</p>
                    </div>
                </div>
                <div className="flex-1 w-full h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data.collections_breakdown || []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(value) => `K ${value / 1000}k`}
                                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))', fontWeight: 600 }}
                                width={65}
                            />
                            <Tooltip
                                formatter={(value: any, name: any) => [formatCurrency(value as number), name ? String(name).charAt(0).toUpperCase() + String(name).slice(1) : '']}
                                cursor={{ fill: 'hsl(var(--muted))', opacity: 0.2 }}
                                contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'border: rgba(255, 255, 255, 0.1)', borderRadius: '1rem', color: 'hsl(var(--foreground))', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.3)' }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '12px', fontWeight: 'bold' }} />
                            <Bar dataKey="principal" stackId="a" fill="#3b82f6" radius={[0, 0, 4, 4]} maxBarSize={40} />
                            <Bar dataKey="interest" stackId="a" fill="#10b981" maxBarSize={40} />
                            <Bar dataKey="penalty" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Bottom Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">

                {/* Borrower Demographics */}
                <div className="glass rounded-[2rem] p-8 border border-border lg:col-span-1 flex flex-col hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-8">
                        <div className="p-2.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20">
                            <Users className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-foreground">Client Base</h3>
                            <p className="text-xs text-muted-foreground font-medium">Active Engagement</p>
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col justify-center space-y-8">
                        <div className="bg-muted/30 p-5 rounded-2xl border border-border">
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Total Verified Base</p>
                                    <p className="text-3xl font-black text-foreground">{data.total_borrowers}</p>
                                </div>
                                <Users className="h-8 w-8 text-primary/30" />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <div className="flex justify-between text-xs mb-2 font-bold uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5 text-emerald-500">
                                        Active
                                    </span>
                                    <span className="text-foreground">{data.active_borrowers}</span>
                                </div>
                                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border">
                                    <div
                                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                                        style={{ width: `${data.total_borrowers ? (data.active_borrowers / data.total_borrowers) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between text-xs mb-2 font-bold uppercase tracking-wider">
                                    <span className="flex items-center gap-1.5 text-muted-foreground">
                                        Inactive
                                    </span>
                                    <span className="text-foreground">{data.inactive_borrowers}</span>
                                </div>
                                <div className="h-2 w-full bg-muted/50 rounded-full overflow-hidden border border-border">
                                    <div
                                        className="h-full bg-slate-400 dark:bg-slate-600 transition-all duration-1000 ease-out"
                                        style={{ width: `${data.total_borrowers ? (data.inactive_borrowers / data.total_borrowers) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Branch Operations */}
                <div className="glass rounded-[2rem] p-8 border border-border lg:col-span-2 overflow-hidden hover:shadow-xl hover:shadow-primary/5 transition-all duration-500">
                    <div className="flex items-center gap-3 mb-6 shrink-0">
                        <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                            <Activity className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-foreground">Branch Operations</h3>
                            <p className="text-xs text-muted-foreground font-medium">Portfolio distribution across branches</p>
                        </div>
                    </div>
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-xs font-black text-muted-foreground uppercase tracking-wider border-b border-border/50">
                                    <th className="text-left pb-4 px-2">Branch Hub</th>
                                    <th className="text-right pb-4 px-2">Active Facilities</th>
                                    <th className="text-right pb-4 px-2">AUM (Portfolio)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/50">
                                {data.branch_performance && data.branch_performance.length > 0 ? data.branch_performance.map((branch, idx) => (
                                    <tr key={idx} className="group hover:bg-muted/10 transition-colors">
                                        <td className="py-4 px-2 font-bold text-foreground flex items-center gap-3">
                                            <div className="h-2 w-2 rounded-full bg-indigo-400/50 group-hover:bg-indigo-500 transition-colors shadow-sm" />
                                            {branch.name}
                                        </td>
                                        <td className="py-4 px-2 text-right font-medium text-muted-foreground">{branch.active_loans}</td>
                                        <td className="py-4 px-2 text-right font-black text-foreground">{formatCurrency(branch.portfolio_value)}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={3} className="py-12 text-center text-muted-foreground font-medium italic opacity-50">No operational branches with active data</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
}
