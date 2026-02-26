'use client';

import { useState } from 'react';
import {
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    Search,
    Filter,
    Download,
    Plus
} from 'lucide-react';

interface Column<T> {
    header: string;
    accessor: keyof T | ((item: T) => React.ReactNode);
    className?: string;
}

interface DataTableProps<T> {
    columns: Column<T>[];
    data: T[];
    isLoading?: boolean;
    onSearch?: (query: string) => void;
    onRowClick?: (item: T) => void;
    actionButton?: {
        label: string;
        onClick: () => void;
        icon?: React.ComponentType<{ className?: string }>;
    };
    onExport?: () => void;
    filterContent?: React.ReactNode;
    pagination?: {
        totalCount: number;
        pageSize: number;
        currentPage: number;
        onPageChange: (page: number) => void;
    };
}

export default function DataTable<T extends { id: string | number }>({
    columns,
    data,
    isLoading,
    onSearch,
    onRowClick,
    actionButton,
    onExport,
    filterContent,
    pagination
}: DataTableProps<T>) {
    const [showFilters, setShowFilters] = useState(false);

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search..."
                        onChange={(e) => onSearch?.(e.target.value)}
                        className="w-full bg-input border border-border rounded-lg py-2 pl-10 pr-4 text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
                    />
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {filterContent && (
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-sm ${showFilters ? 'bg-primary/10 border-primary text-primary' : 'bg-input border-border text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <Filter className="h-4 w-4" />
                            <span>Filter</span>
                        </button>
                    )}
                    {onExport && (
                        <button
                            onClick={onExport}
                            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-input border border-border text-muted-foreground hover:text-foreground transition-colors text-sm"
                        >
                            <Download className="h-4 w-4" />
                            <span>Export</span>
                        </button>
                    )}
                    {actionButton && (
                        <button
                            onClick={actionButton.onClick}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors text-sm font-semibold shadow-lg shadow-primary/20"
                        >
                            {actionButton.icon ? <actionButton.icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            <span>{actionButton.label}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Content Slot */}
            {filterContent && showFilters && (
                <div className="p-6 bg-muted/30 border border-border rounded-xl animate-in fade-in slide-in-from-top-2 duration-200">
                    {filterContent}
                </div>
            )}

            {/* Table */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-muted text-muted-foreground uppercase text-xs font-bold tracking-wider">
                            <tr>
                                {columns.map((col, idx) => (
                                    <th key={idx} className={`px-6 py-4 ${col.className || ''}`}>
                                        {col.header}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        {columns.map((_, j) => (
                                            <td key={j} className="px-6 py-4">
                                                <div className="h-4 bg-muted rounded w-full"></div>
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            ) : !Array.isArray(data) || data.length === 0 ? (
                                <tr>
                                    <td colSpan={columns.length} className="px-6 py-12 text-center text-muted-foreground">
                                        No results found.
                                    </td>
                                </tr>
                            ) : (
                                data.map((item) => (
                                    <tr
                                        key={item.id}
                                        onClick={() => onRowClick?.(item)}
                                        className="hover:bg-muted/50 cursor-pointer transition-colors"
                                    >
                                        {columns.map((col, idx) => (
                                            <td key={idx} className={`px-6 py-4 text-foreground/80 ${col.className || ''}`}>
                                                {typeof col.accessor === 'function'
                                                    ? col.accessor(item)
                                                    : (item[col.accessor] as React.ReactNode)}
                                            </td>
                                        ))}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-xs text-muted-foreground">
                        {pagination ? (
                            <>
                                Showing <span className="text-foreground font-medium">
                                    {Math.min((pagination.currentPage - 1) * pagination.pageSize + 1, pagination.totalCount)}
                                </span> to <span className="text-foreground font-medium">
                                    {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount)}
                                </span> of <span className="text-foreground font-medium">{pagination.totalCount}</span> results
                            </>
                        ) : (
                            <>
                                Showing <span className="text-foreground font-medium">{data.length}</span> results
                            </>
                        )}
                    </p>
                    {pagination && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => pagination.onPageChange(1)}
                                disabled={pagination.currentPage === 1}
                                className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronsLeft className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => pagination.onPageChange(pagination.currentPage - 1)}
                                disabled={pagination.currentPage === 1}
                                className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </button>
                            <div className="flex items-center gap-1 min-w-[3rem] justify-center">
                                <span className="text-sm font-medium text-foreground">
                                    {pagination.currentPage}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    / {Math.ceil(pagination.totalCount / pagination.pageSize) || 1}
                                </span>
                            </div>
                            <button
                                onClick={() => pagination.onPageChange(pagination.currentPage + 1)}
                                disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight className="h-4 w-4" />
                            </button>
                            <button
                                onClick={() => pagination.onPageChange(Math.ceil(pagination.totalCount / pagination.pageSize))}
                                disabled={pagination.currentPage >= Math.ceil(pagination.totalCount / pagination.pageSize)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronsRight className="h-4 w-4" />
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
