'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, UserCheck, Shield, Mail, Phone, Building2 } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';

interface User {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: {
        id: string;
        name: string;
        approval_limit: number;
    } | null;
    is_active: boolean;
    is_staff: boolean;
    created_at: string;
    profile?: {
        employee_id: string;
    };
}

export default function StaffPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchUsers = async (query = '') => {
        try {
            setIsLoading(true);
            const response = await api.get(`/users/${query ? `?search=${query}` : ''}`);
            const data = response?.data;
            setUsers(Array.isArray(data) ? data : data?.results || []);
        } catch (error) {
            console.error('Failed to fetch users:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchUsers(searchQuery);
        }, 500);
        return () => clearTimeout(timer);
    }, [searchQuery]);

    const columns = [
        {
            header: 'Staff Member',
            accessor: (user: User) => (
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                        {user.first_name[0]}{user.last_name[0]}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
                            {user.profile?.employee_id && (
                                <span className="text-[10px] font-bold bg-muted px-1.5 py-0.5 rounded text-muted-foreground border border-border uppercase tracking-tighter">
                                    {user.profile.employee_id}
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                    </div>
                </div>
            ),
        },
        {
            header: 'Role',
            accessor: (user: User) => (
                <div className="flex items-center gap-2">
                    <Shield className="h-3 w-3 text-primary" />
                    <span>{user.role?.name || 'No Role'}</span>
                </div>
            ),
        },
        {
            header: 'Branch',
            accessor: (user: any) => (
                <div className="flex items-center gap-2">
                    <Building2 className="h-3 w-3 text-emerald-400" />
                    <span>{user.branch?.name || 'Global'}</span>
                </div>
            ),
        },
        {
            header: 'Approval Limit',
            accessor: (user: User) => (
                user.role?.approval_limit ? (
                    <span className="font-medium">KES {user.role.approval_limit.toLocaleString()}</span>
                ) : (
                    <span className="text-muted-foreground">N/A</span>
                )
            ),
        },
        {
            header: 'Access Level',
            accessor: (user: User) => (
                <div className="flex items-center gap-2">
                    {user.is_staff ? (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400">
                            Admin
                        </span>
                    ) : (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400">
                            Staff
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: 'Status',
            accessor: (user: User) => (
                user.is_active ? (
                    <div className="flex items-center gap-1.5 text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        <UserCheck className="h-3.5 w-3.5" />
                        Active
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-muted-foreground bg-slate-500/10 px-2 py-1 rounded-full text-xs font-medium w-fit">
                        Inactive
                    </div>
                )
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Staff Management</h1>
                    <p className="text-muted-foreground mt-2">Manage your team members, roles, and permissions</p>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={users}
                isLoading={isLoading}
                onSearch={setSearchQuery}
                onRowClick={(user) => router.push(`/staff/${user.id}`)}
                actionButton={{
                    label: 'Invite Staff',
                    icon: Plus,
                    onClick: () => router.push('/staff/new'),
                }}
            />
        </div>
    );
}
