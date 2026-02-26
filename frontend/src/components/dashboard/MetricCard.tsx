'use client';

import { TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
    title: string;
    value: string | number;
    change?: number;
    icon: React.ComponentType<{ className?: string }>;
    trend?: 'up' | 'down' | 'neutral';
    subtitle?: string;
}

export default function MetricCard({ title, value, change, icon: Icon, trend = 'neutral', subtitle }: MetricCardProps) {
    const getTrendColor = () => {
        if (trend === 'up') return 'text-emerald-500';
        if (trend === 'down') return 'text-red-500';
        return 'text-muted-foreground';
    };

    const getTrendBgColor = () => {
        if (trend === 'up') return 'bg-emerald-500/10';
        if (trend === 'down') return 'bg-red-500/10';
        return 'bg-muted';
    };

    return (
        <div className="glass rounded-xl p-6 border border-border hover:border-primary/20 transition-all duration-300">
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-sm font-medium text-muted-foreground">{title}</p>
                    <h3 className="text-2xl font-bold text-foreground mt-2">{value}</h3>
                    {subtitle && <p className="text-xs text-muted-foreground mt-1 opacity-80">{subtitle}</p>}

                    {change !== undefined && (
                        <div className={`flex items-center gap-1 mt-3 text-sm ${getTrendColor()}`}>
                            {trend === 'up' ? (
                                <TrendingUp className="h-4 w-4" />
                            ) : trend === 'down' ? (
                                <TrendingDown className="h-4 w-4" />
                            ) : null}
                            <span className="font-medium">
                                {change > 0 ? '+' : ''}{change}%
                            </span>
                            <span className="text-slate-500 ml-1">vs last month</span>
                        </div>
                    )}
                </div>

                <div className={`p-3 rounded-lg ${getTrendBgColor()}`}>
                    <Icon className={`h-6 w-6 ${getTrendColor()}`} />
                </div>
            </div>
        </div>
    );
}
