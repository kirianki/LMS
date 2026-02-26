'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    Users,
    Wallet,
    PiggyBank,
    FileText,
    Settings,
    Building2,
    History as HistoryIcon,
    ChevronLeft,
    ChevronDown,
    Shield,
    UserCog,
    Calculator,
    BookOpen,
    Landmark,
    Receipt,
    Banknote,
    Coins,
    ShieldCheck,
    Package,
    AlertCircle,
    ArrowRightLeft,
    Code,
    MessageSquare,
    Briefcase,
    FileSpreadsheet,
    PieChart,
    CircleDot
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import ThemeToggle from '@/components/common/ThemeToggle';

type MenuItem = {
    icon: any;
    label: string;
    href?: string;
    permission?: string;
    subItems?: MenuItem[];
};

type MenuSection = {
    label?: string;
    items: MenuItem[];
};

const menuSections: MenuSection[] = [
    {
        items: [
            { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
            { icon: Users, label: 'Borrowers', href: '/borrowers', permission: 'customers.view_borrower' },
        ]
    },
    {
        label: 'Core Banking',
        items: [
            {
                icon: Wallet, label: 'Loan Management',
                subItems: [
                    { icon: Package, label: 'Products', href: '/loans/products', permission: 'loans.view_loanproduct' },
                    { icon: FileText, label: 'Applications', href: '/loans/applications', permission: 'loans.view_loanapplication' },
                    { icon: Briefcase, label: 'Loans', href: '/loans', permission: 'loans.view_loan' },
                ]
            },
            { icon: AlertCircle, label: 'Collections', href: '/loans/collections', permission: 'loans.view_collectioncase' },
            { icon: PiggyBank, label: 'Savings & Deposits', href: '/savings', permission: 'savings.view_savingsaccount' },
            { icon: ShieldCheck, label: 'Collateral Registry', href: '/collateral', permission: 'collateral.view_collateral' },
        ]
    },
    {
        label: 'Treasury & Finance',
        items: [
            {
                icon: Landmark, label: 'Treasury Management',
                subItems: [
                    { icon: Landmark, label: 'Cash Accounts', href: '/accounting/treasury', permission: 'treasury.view_cashaccount' },
                    { icon: ArrowRightLeft, label: 'Transactions', href: '/accounting/treasury/transactions', permission: 'treasury.view_cashaccount' },
                ]
            },
            { icon: Coins, label: 'Investor Capital', href: '/investors', permission: 'investors.view_investor' },
            { icon: Receipt, label: 'Expense Tracking', href: '/accounting/expenses', permission: 'expenses.view_expense' },
            { icon: Banknote, label: 'Payroll', href: '/accounting/payroll', permission: 'users.view_payrollrecord' },
        ]
    },
    {
        label: 'Accounting & Reports',
        items: [
            { icon: Calculator, label: 'Ledger Overview', href: '/accounting', permission: 'accounting.view_ledgerentry' },
            {
                icon: BookOpen, label: 'General Ledger',
                subItems: [
                    { icon: BookOpen, label: 'Chart of Accounts', href: '/accounting/coa', permission: 'accounting.view_chartofaccount' },
                    { icon: FileSpreadsheet, label: 'Journal Entries', href: '/accounting/journal', permission: 'accounting.view_journalentry' },
                ]
            },
            { icon: PieChart, label: 'Financial Reports', href: '/accounting/reports', permission: 'accounting.view_ledgerentry' },
        ]
    },
    {
        label: 'Administration',
        items: [
            { icon: UserCog, label: 'Staff Directory', href: '/staff', permission: 'users.view_user' },
            { icon: MessageSquare, label: 'Communications', href: '/communications', permission: 'notifications.view_communicationlog' },
            {
                icon: Settings, label: 'System Settings',
                subItems: [
                    { icon: Settings, label: 'Workspace', href: '/settings', permission: 'accounts.view_sitesettings' },
                    { icon: Building2, label: 'Branches', href: '/settings/branches', permission: 'branches.view_branch' },
                    { icon: Code, label: 'Document Blueprints', href: '/settings/documents', permission: 'accounts.view_sitesettings' },
                    { icon: Shield, label: 'Access Control', href: '/settings/roles', permission: 'auth.view_permission' },
                    { icon: HistoryIcon, label: 'Audit Log', href: '/settings/audit-log', permission: 'auditlog.view_activitylog' },
                ]
            }
        ]
    }
];

export default function Sidebar() {
    const pathname = usePathname();
    const { user } = useAuthStore();
    const [collapsed, setCollapsed] = useState(false);

    // Track which submenu parents are expanded
    const [expandedItems, setExpandedItems] = useState<{ [key: string]: boolean }>({});

    const { settings } = useSettingsStore();

    const isActiveHref = (href: string | undefined) => {
        if (!href) return false;
        if (pathname === href) return true;
        if (!pathname.startsWith(href + '/')) return false;

        let hasMoreSpecificMatch = false;
        menuSections.forEach(section => {
            section.items.forEach(item => {
                if (item.href && item.href !== href && (pathname === item.href || pathname.startsWith(item.href + '/')) && item.href.length > href.length) {
                    hasMoreSpecificMatch = true;
                }
                if (item.subItems) {
                    item.subItems.forEach(sub => {
                        if (sub.href && sub.href !== href && (pathname === sub.href || pathname.startsWith(sub.href + '/')) && sub.href.length > href.length) {
                            hasMoreSpecificMatch = true;
                        }
                    });
                }
            });
        });
        return !hasMoreSpecificMatch;
    };

    // Auto-expand parents if active
    useEffect(() => {
        const newExpanded = { ...expandedItems };
        menuSections.forEach(section => {
            section.items.forEach(item => {
                if (item.subItems) {
                    const hasActiveChild = item.subItems.some(sub => isActiveHref(sub.href));
                    if (hasActiveChild) {
                        newExpanded[item.label] = true;
                    }
                }
            });
        });
        setExpandedItems(newExpanded);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pathname]);

    const toggleItem = (label: string) => {
        if (collapsed) setCollapsed(false); // Auto-expand sidebar if clicking a parent while collapsed
        setExpandedItems(prev => ({
            ...prev,
            [label]: !prev[label]
        }));
    };

    // Advanced permission-driven filtering for nested items
    const filteredSections = menuSections.map(section => {
        const visibleItems = section.items.map(item => {
            // Check top-level permission (if any)
            const canViewTop = !item.permission || user?.is_superuser || user?.permissions?.includes(item.permission);

            // Filter subItems if they exist
            if (item.subItems) {
                const visibleSub = item.subItems.filter(sub => {
                    return !sub.permission || user?.is_superuser || user?.permissions?.includes(sub.permission);
                });

                // If it's a parent node, only show it if it has visible subItems
                if (visibleSub.length > 0) {
                    return { ...item, subItems: visibleSub };
                }
                return null;
            }

            return canViewTop ? item : null;
        }).filter(Boolean) as MenuItem[];

        return {
            ...section,
            items: visibleItems
        };
    }).filter(section => section.items.length > 0);

    return (
        <aside className={`glass border-r border-border flex flex-col transition-all duration-300 ${collapsed ? 'w-20' : 'w-64'} z-20 relative`}>
            {/* Logo Section */}
            <div className="flex items-center justify-between p-6 border-b border-border h-20">
                {!collapsed && (
                    <div className="flex items-center gap-3 overflow-hidden">
                        {settings?.logo ? (
                            <img
                                src={settings.logo.startsWith('http')
                                    ? settings.logo.replace(/localhost(?!:)/, 'localhost:9090')
                                    : settings.logo}
                                alt="Logo"
                                className="h-8 w-8 rounded-lg object-contain bg-muted shrink-0"
                            />
                        ) : (
                            <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                                <span className="text-primary font-bold">{settings?.company_name?.[0] || 'A'}</span>
                            </div>
                        )}
                        <div className="min-w-0">
                            <h2 className="text-foreground font-semibold text-sm truncate">{settings?.company_name || 'Aurum'}</h2>
                            <p className="text-xs text-muted-foreground truncate">{settings?.company_tagline || 'Finance'}</p>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className={`p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0 ${collapsed ? 'mx-auto' : ''}`}
                >
                    <ChevronLeft className={`h-4 w-4 transition-transform ${collapsed ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-6 overflow-y-auto no-scrollbar">
                {filteredSections.map((section, sectionIdx) => (
                    <div key={sectionIdx} className="space-y-1">
                        {section.label && !collapsed && (
                            <div className="px-3 pb-2 text-muted-foreground/60 text-[10px] font-bold uppercase tracking-wider">
                                {section.label}
                            </div>
                        )}

                        <div className="space-y-1">
                            {section.items.map((item) => {
                                const Icon = item.icon;

                                // Handling Parent item with subItems
                                if (item.subItems) {
                                    const isExpanded = expandedItems[item.label];
                                    const hasActiveChild = item.subItems.some(sub => isActiveHref(sub.href));

                                    return (
                                        <div key={item.label} className="space-y-1">
                                            <button
                                                onClick={() => toggleItem(item.label)}
                                                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors group ${hasActiveChild && !isExpanded
                                                    ? 'bg-primary/5 text-primary font-medium'
                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <Icon className={`h-5 w-5 flex-shrink-0 ${hasActiveChild && !isExpanded ? 'text-primary' : ''}`} />
                                                    {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                                                </div>
                                                {!collapsed && (
                                                    <ChevronDown className={`h-4 w-4 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
                                                )}
                                            </button>

                                            {/* SubItems */}
                                            {isExpanded && !collapsed && (
                                                <div className="pl-9 pr-2 space-y-1 relative before:absolute before:inset-y-0 before:left-5 before:w-px before:bg-border/60">
                                                    {item.subItems.map((sub) => {
                                                        const SubIcon = sub.icon;
                                                        const isSubActive = isActiveHref(sub.href);

                                                        return (
                                                            <Link
                                                                key={sub.href}
                                                                href={sub.href!}
                                                                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors relative text-sm ${isSubActive
                                                                    ? 'bg-primary/10 text-primary font-medium before:absolute before:left-[-17px] before:top-1/2 before:-translate-y-1/2 before:w-[17px] before:h-px before:bg-primary'
                                                                    : 'text-muted-foreground hover:bg-muted hover:text-foreground before:absolute before:left-[-17px] before:top-1/2 before:-translate-y-1/2 before:w-[17px] before:h-px before:bg-border/60'
                                                                    }`}
                                                            >
                                                                <SubIcon className="h-4 w-4 flex-shrink-0" />
                                                                <span className="truncate">{sub.label}</span>
                                                            </Link>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                }

                                // Handling Standard Flat Item
                                const flatIsActive = isActiveHref(item.href);

                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href!}
                                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group ${flatIsActive
                                            ? 'bg-primary/10 text-primary font-semibold'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                                            }`}
                                    >
                                        <Icon className="h-5 w-5 flex-shrink-0" />
                                        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            {/* Theme Toggle Section */}
            {!collapsed && (
                <div className="p-4 border-t border-border shrink-0 bg-background/50 backdrop-blur-sm">
                    <ThemeToggle />
                </div>
            )}
        </aside>
    );
}
