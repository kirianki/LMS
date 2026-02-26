'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Shield, Edit, Trash2, Key, Users } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface Role {
    id: string;
    name: string;
    description: string;
    approval_limit: number;
    is_system_role: boolean;
    permissions_list: string[];
}

export default function RolesPage() {
    const router = useRouter();
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const fetchRoles = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/roles/');
            const data = response?.data;
            setRoles(Array.isArray(data) ? data : data?.results || []);
        } catch (error) {
            console.error('Failed to fetch roles:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    const handleDelete = async (id: string, isSystem: boolean) => {
        if (isSystem) {
            alert('System roles cannot be deleted');
            return;
        }
        if (!confirm('Are you sure you want to delete this role? Users assigned to this role will lose their permissions.')) return;

        try {
            await api.delete(`/roles/${id}/`);
            fetchRoles();
        } catch (error) {
            console.error('Failed to delete role:', error);
            alert('Failed to delete role');
        }
    };

    const columns = [
        {
            header: 'Role',
            accessor: (role: Role) => (
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                        <Shield className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                        <p className="font-bold text-foreground">{role.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1 max-w-[250px]">
                            {role.description || 'No description'}
                        </p>
                    </div>
                    {role.is_system_role && (
                        <span className="px-2 py-0.5 text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full">
                            System
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: 'Permissions',
            accessor: (role: Role) => {
                const count = role.permissions_list?.length || 0;
                return (
                    <div className="flex items-center gap-2">
                        <Key className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className={`text-sm font-bold ${count > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {count} {count === 1 ? 'permission' : 'permissions'}
                        </span>
                    </div>
                );
            },
        },
        {
            header: 'Approval Limit',
            accessor: (role: Role) => (
                <span className="font-medium text-sm">
                    KES {(role.approval_limit || 0).toLocaleString()}
                </span>
            ),
        },
        {
            header: '',
            accessor: (role: Role) => (
                <div className="flex items-center gap-1 justify-end">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/settings/roles/${role.id}`);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
                    >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                    </button>
                    {!role.is_system_role && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(role.id, role.is_system_role);
                            }}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <Shield className="h-8 w-8 text-primary" />
                        Access Control
                    </h1>
                    <p className="text-muted-foreground mt-2">Manage roles and their permissions — like Django Admin, but simpler</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Total Roles</p>
                            <p className="text-2xl font-bold text-foreground mt-1">{roles.length}</p>
                        </div>
                        <Shield className="h-8 w-8 text-primary/30" />
                    </div>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">System Roles</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                                {roles.filter(r => r.is_system_role).length}
                            </p>
                        </div>
                        <Key className="h-8 w-8 text-amber-400/30" />
                    </div>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Custom Roles</p>
                            <p className="text-2xl font-bold text-foreground mt-1">
                                {roles.filter(r => !r.is_system_role).length}
                            </p>
                        </div>
                        <Users className="h-8 w-8 text-emerald-400/30" />
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={roles}
                isLoading={isLoading}
                onRowClick={(role: Role) => router.push(`/settings/roles/${role.id}`)}
                actionButton={{
                    label: 'Create Role',
                    icon: Plus,
                    onClick: () => router.push('/settings/roles/new'),
                }}
            />
        </div>
    );
}
