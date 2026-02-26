'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Shield, Save, Search, CheckSquare, Square, Key, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';

const APP_LABELS: { [key: string]: string } = {
    loans: 'Loans & Applications',
    customers: 'Customer Management',
    accounting: 'Accounting & Finance',
    treasury: 'Treasury',
    branches: 'Branch Management',
    users: 'Users & Staff',
    notifications: 'Notifications',
    auditlog: 'Audit Log',
    accounts: 'Organization Settings',
    savings: 'Savings',
    collateral: 'Collateral',
    investors: 'Investors',
    auth: 'Authentication',
};

function formatPermName(name: string): string {
    return name
        .replace(/^Can /, '')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function getActionType(codename: string): 'view' | 'add' | 'change' | 'delete' | 'other' {
    if (codename.startsWith('view_')) return 'view';
    if (codename.startsWith('add_')) return 'add';
    if (codename.startsWith('change_')) return 'change';
    if (codename.startsWith('delete_')) return 'delete';
    return 'other';
}

const actionColors: { [key: string]: string } = {
    view: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    add: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    change: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    delete: 'bg-red-500/10 text-red-400 border-red-500/20',
    other: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
};

const actionLabels: { [key: string]: string } = {
    view: 'VIEW',
    add: 'ADD',
    change: 'EDIT',
    delete: 'DELETE',
    other: 'ACTION',
};

export default function CreateRolePage() {
    const router = useRouter();
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [isGroupsInitialized, setIsGroupsInitialized] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        approval_limit: '',
        permission_ids: [] as number[],
    });
    const [allPermissions, setAllPermissions] = useState<any[]>([]);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const response = await api.get('/permissions/');
                const perms = Array.isArray(response.data) ? response.data : response.data.results || [];
                setAllPermissions(perms);
            } catch (error) {
                console.error('Failed to fetch permissions:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPermissions();
    }, []);

    const groupedPermissions = useMemo(() => {
        const groups: { [key: string]: any[] } = {};
        allPermissions.forEach((p: any) => {
            const label = p.app_label || 'other';
            if (!groups[label]) groups[label] = [];
            groups[label].push(p);
        });

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const filtered: { [key: string]: any[] } = {};
            Object.entries(groups).forEach(([key, perms]) => {
                const matching = perms.filter(
                    (p) =>
                        p.name.toLowerCase().includes(q) ||
                        p.codename.toLowerCase().includes(q) ||
                        key.toLowerCase().includes(q)
                );
                if (matching.length > 0) filtered[key] = matching;
            });
            return filtered;
        }

        return groups;
    }, [allPermissions, searchQuery]);

    const sortedGroups = useMemo(() => {
        return Object.entries(groupedPermissions).sort(([a], [b]) => {
            const labelA = APP_LABELS[a] || a;
            const labelB = APP_LABELS[b] || b;
            return labelA.localeCompare(labelB);
        });
    }, [groupedPermissions]);

    useEffect(() => {
        if (!isGroupsInitialized && sortedGroups.length > 0) {
            setCollapsedGroups(new Set(sortedGroups.map(([group]) => group)));
            setIsGroupsInitialized(true);
        }
    }, [sortedGroups, isGroupsInitialized]);

    const handleTogglePermission = (id: number) => {
        setFormData((prev) => {
            const current = [...prev.permission_ids];
            if (current.includes(id)) {
                return { ...prev, permission_ids: current.filter((pid) => pid !== id) };
            } else {
                return { ...prev, permission_ids: [...current, id] };
            }
        });
    };

    const handleToggleGroup = (groupPerms: any[]) => {
        const permIds = groupPerms.map((p) => p.id);
        const allSelected = permIds.every((id) => formData.permission_ids.includes(id));

        setFormData((prev) => {
            if (allSelected) {
                return { ...prev, permission_ids: prev.permission_ids.filter((id) => !permIds.includes(id)) };
            } else {
                const newIds = new Set([...prev.permission_ids, ...permIds]);
                return { ...prev, permission_ids: Array.from(newIds) };
            }
        });
    };

    const handleSelectAll = () => {
        setFormData((prev) => ({ ...prev, permission_ids: allPermissions.map((p) => p.id) }));
    };

    const handleDeselectAll = () => {
        setFormData((prev) => ({ ...prev, permission_ids: [] }));
    };

    const toggleGroupCollapse = (group: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(group)) next.delete(group);
            else next.add(group);
            return next;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Role name is required');
            return;
        }
        setIsSaving(true);
        try {
            await api.post('/roles/', {
                ...formData,
                approval_limit: parseFloat(formData.approval_limit) || 0,
            });
            router.push('/settings/roles');
        } catch (error: any) {
            console.error('Failed to create role:', error);
            alert(error.response?.data?.name?.[0] || 'Failed to create role');
        } finally {
            setIsSaving(false);
        }
    };

    const totalPerms = allPermissions.length;
    const selectedCount = formData.permission_ids.length;

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Loading permissions...</div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-6xl pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                            <Shield className="h-7 w-7 text-primary" />
                            Create New Role
                        </h1>
                        <p className="text-muted-foreground mt-1">
                            Define the role and assign permissions
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleSubmit}
                    disabled={isSaving || !formData.name.trim()}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                >
                    <Save className="h-4 w-4" />
                    {isSaving ? 'Creating...' : 'Create Role'}
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* Left: Role Details */}
                    <div className="lg:col-span-1 space-y-6">
                        <div className="glass rounded-2xl p-6 border border-border">
                            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Shield className="h-4 w-4 text-primary" />
                                Role Details
                            </h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Name *</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        placeholder="e.g., Branch Manager"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Description</label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none transition-all"
                                        rows={3}
                                        placeholder="Describe the role's responsibilities..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-muted-foreground mb-1.5">Approval Limit (KES)</label>
                                    <input
                                        type="number"
                                        value={formData.approval_limit}
                                        onChange={(e) => setFormData({ ...formData, approval_limit: e.target.value })}
                                        className="w-full bg-input border border-border rounded-xl py-2.5 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className="glass rounded-2xl p-6 border border-border">
                            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Summary</h2>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Selected</span>
                                    <span className="text-sm font-bold text-primary">{selectedCount}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Available</span>
                                    <span className="text-sm font-bold text-foreground">{totalPerms}</span>
                                </div>
                                <div className="w-full bg-muted rounded-full h-2 mt-2">
                                    <div
                                        className="bg-primary rounded-full h-2 transition-all duration-300"
                                        style={{ width: `${totalPerms > 0 ? (selectedCount / totalPerms) * 100 : 0}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Permissions */}
                    <div className="lg:col-span-3">
                        <div className="glass rounded-2xl border border-border overflow-hidden">
                            {/* Toolbar */}
                            <div className="p-4 border-b border-border">
                                <div className="flex items-center justify-between gap-4 flex-wrap">
                                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                                        <Key className="h-5 w-5 text-primary" />
                                        Permissions
                                    </h2>
                                    <div className="flex items-center gap-2">
                                        <button type="button" onClick={handleSelectAll} className="px-3 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors">
                                            Select All
                                        </button>
                                        <button type="button" onClick={handleDeselectAll} className="px-3 py-1.5 text-xs font-bold text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                            Deselect All
                                        </button>
                                    </div>
                                </div>
                                <div className="relative mt-3">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="text"
                                        placeholder="Search permissions..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2.5 bg-input border border-border rounded-xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Permission Groups */}
                            <div className="divide-y divide-border">
                                {sortedGroups.map(([group, perms]) => {
                                    const groupLabel = APP_LABELS[group] || group.charAt(0).toUpperCase() + group.slice(1);
                                    const groupPermIds = perms.map((p: any) => p.id);
                                    const selectedInGroup = groupPermIds.filter((id: number) => formData.permission_ids.includes(id)).length;
                                    const allGroupSelected = selectedInGroup === perms.length;
                                    const isCollapsed = collapsedGroups.has(group);

                                    return (
                                        <div key={group}>
                                            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors">
                                                <button type="button" onClick={() => toggleGroupCollapse(group)} className="flex items-center gap-2 flex-1">
                                                    {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                                                    <span className="text-sm font-bold text-foreground">{groupLabel}</span>
                                                    <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                                                        {selectedInGroup}/{perms.length}
                                                    </span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleGroup(perms)}
                                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-colors ${allGroupSelected ? 'text-red-400 hover:bg-red-500/10' : 'text-emerald-400 hover:bg-emerald-500/10'
                                                        }`}
                                                >
                                                    {allGroupSelected ? <><Square className="h-3 w-3" /> Deselect All</> : <><CheckSquare className="h-3 w-3" /> Select All</>}
                                                </button>
                                            </div>

                                            {!isCollapsed && (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-0">
                                                    {perms.map((p: any) => {
                                                        const isSelected = formData.permission_ids.includes(p.id);
                                                        const actionType = getActionType(p.codename);
                                                        return (
                                                            <label
                                                                key={p.id}
                                                                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors border-b border-border/50 last:border-b-0 ${isSelected ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'
                                                                    }`}
                                                            >
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-primary/20 focus:ring-offset-0 shrink-0"
                                                                    checked={isSelected}
                                                                    onChange={() => handleTogglePermission(p.id)}
                                                                />
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <span className={`px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded border ${actionColors[actionType]}`}>
                                                                        {actionLabels[actionType]}
                                                                    </span>
                                                                    <span className="text-sm text-foreground truncate">
                                                                        {formatPermName(p.name)}
                                                                    </span>
                                                                </div>
                                                            </label>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {sortedGroups.length === 0 && (
                                <div className="p-8 text-center text-muted-foreground text-sm">
                                    No permissions match your search
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Bar */}
                <div className="flex items-center justify-between pt-4 border-t border-border">
                    <p className="text-sm text-muted-foreground">
                        {selectedCount} permission{selectedCount !== 1 ? 's' : ''} will be assigned to this role
                    </p>
                    <div className="flex items-center gap-3">
                        <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !formData.name.trim()}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                        >
                            <Save className="h-4 w-4" />
                            {isSaving ? 'Creating...' : 'Create Role'}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
