'use client';

import {
    FileText,
    TrendingUp,
    Scale,
    Activity,
    ArrowRightLeft,
    Clock,
    Download,
    ChevronRight,
    Search
} from 'lucide-react';
import { useRouter } from 'next/navigation';

const reportCategories = [
    {
        title: 'Lending Reports',
        items: [
            {
                id: 'portfolio-performance',
                title: 'Portfolio Performance',
                description: 'Overview of portfolio health, PAR metrics, and product stats.',
                icon: Activity,
                color: 'text-rose-400',
                bg: 'bg-rose-500/10',
                href: '/accounting/reports/portfolio-performance'
            },
            {
                id: 'disbursements',
                title: 'Disbursements',
                description: 'Detailed log of all loans disbursed within a date range.',
                icon: FileText,
                color: 'text-orange-400',
                bg: 'bg-orange-500/10',
                href: '/accounting/reports/disbursements'
            },
            {
                id: 'collections',
                title: 'Collections',
                description: 'Summary of repayments received and allocation breakdown.',
                icon: TrendingUp,
                color: 'text-indigo-400',
                bg: 'bg-indigo-500/10',
                href: '/accounting/reports/collections'
            }
        ]
    },
    {
        title: 'Financial Statements',
        items: [
            {
                id: 'balance-sheet',
                title: 'Balance Sheet',
                description: 'Statement of assets, liabilities, and equity at a specific point in time.',
                icon: Scale,
                color: 'text-blue-400',
                bg: 'bg-blue-500/10',
                href: '/accounting/reports/balance-sheet'
            },
            {
                id: 'profit-loss',
                title: 'Profit & Loss',
                description: 'Revenue, expenses, and net profit over a specific period.',
                icon: TrendingUp,
                color: 'text-emerald-400',
                bg: 'bg-emerald-500/10',
                href: '/accounting/reports/profit-loss'
            },
            {
                id: 'cash-flow',
                title: 'Cash Flow Statement',
                description: 'Analysis of cash inflows and outflows by category.',
                icon: ArrowRightLeft,
                color: 'text-pink-400',
                bg: 'bg-pink-500/10',
                href: '/accounting/reports/cash-flow'
            }
        ]
    },
    {
        title: 'Ledgers & Audit',
        items: [
            {
                id: 'general-ledger',
                title: 'General Ledger',
                description: 'Complete record of all transactions for specific accounts.',
                icon: FileText,
                color: 'text-purple-400',
                bg: 'bg-purple-500/10',
                href: '/accounting/reports/general-ledger'
            },
            {
                id: 'trial-balance',
                title: 'Trial Balance',
                description: 'Listing of all ledger account balances to ensure debits equal credits.',
                icon: Activity,
                color: 'text-amber-400',
                bg: 'bg-amber-500/10',
                href: '/accounting/reports/trial-balance'
            }
        ]
    }
];

export default function ReportsHub() {
    const router = useRouter();

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Financial Reports</h1>
                    <p className="text-muted-foreground mt-2">Generate and export comprehensive financial statements</p>
                </div>
            </div>

            {/* Categories */}
            <div className="space-y-12">
                {reportCategories.map((category) => (
                    <div key={category.title} className="space-y-4">
                        <div className="flex items-center gap-4">
                            <h2 className="text-xl font-bold text-foreground font-heading">{category.title}</h2>
                            <div className="h-px flex-1 bg-border/50"></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {category.items.map((report) => {
                                const Icon = report.icon;
                                return (
                                    <div
                                        key={report.id}
                                        className="glass rounded-xl p-6 border border-border hover:border-primary/50 transition-all cursor-pointer group"
                                        onClick={() => router.push(report.href)}
                                    >
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={`p-3 rounded-lg ${report.bg}`}>
                                                <Icon className={`h-6 w-6 ${report.color}`} />
                                            </div>
                                            <div className="p-2 rounded-full bg-border/50 group-hover:bg-primary/20 transition-colors">
                                                <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                                            </div>
                                        </div>
                                        <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-primary transition-colors">
                                            {report.title}
                                        </h3>
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {report.description}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent History / Scheduled Reports Section (Placeholder) */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="p-4 border-b border-border bg-white/5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent Generations</h2>
                    </div>
                </div>
                <div className="p-8 text-center">
                    <div className="inline-flex items-center justify-center p-4 rounded-full bg-muted mb-4">
                        <FileText className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                    <h3 className="text-foreground font-medium">No recent reports generated</h3>
                    <p className="text-sm text-muted-foreground mt-1">Generated report files will appear here for 24 hours.</p>
                </div>
            </div>
        </div>
    );
}
