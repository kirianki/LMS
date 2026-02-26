'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Shield, Save } from 'lucide-react';
import api from '@/lib/api';

export default function NewStaffPage() {
    const router = useRouter();
    const [roles, setRoles] = useState<any[]>([]);
    const [branches, setBranches] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        role_id: '',
        branch_id: '',
        is_staff: false,
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [rolesRes, branchesRes] = await Promise.all([
                    api.get('/roles/'),
                    api.get('/branches/branches/')
                ]);
                setRoles(rolesRes.data.results || rolesRes.data);
                setBranches(branchesRes.data.results || branchesRes.data);
            } catch (error) {
                console.error('Failed to fetch roles or branches:', error);
            }
        };

        fetchData();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/users/', formData);
            router.push('/staff');
        } catch (error) {
            console.error('Failed to create staff:', error);
            alert('Failed to create staff member. Please check the form.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    return (
        <div className="space-y-6 max-w-2xl">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Invite Staff Member</h1>
                    <p className="text-muted-foreground mt-1">Add a new team member to your organization</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Personal Information */}
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                            <input
                                type="text"
                                name="first_name"
                                required
                                value={formData.first_name}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                            <input
                                type="text"
                                name="last_name"
                                required
                                value={formData.last_name}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Account Details */}
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Account Details</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Temporary Password</label>
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="User will be prompted to change on first login"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Role & Permissions */}
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Role & Permissions</h2>
                    </div>
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Role</label>
                            <select
                                name="role_id"
                                required
                                value={formData.role_id}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select a role</option>
                                {roles.map((role) => (
                                    <option key={role.id} value={role.id}>
                                        {role.name} {role.approval_limit > 0 && `(Limit: KES ${role.approval_limit.toLocaleString()})`}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Branch Assignment</label>
                            <select
                                name="branch_id"
                                required
                                value={formData.branch_id}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select a branch</option>
                                {branches.map((branch) => (
                                    <option key={branch.id} value={branch.id}>
                                        {branch.name} ({branch.code})
                                    </option>
                                ))}
                            </select>
                            <p className="text-[10px] text-muted-foreground mt-2 italic">User will primarily manage data within this branch.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                name="is_staff"
                                id="is_staff"
                                checked={formData.is_staff}
                                onChange={handleChange}
                                className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-2 focus:ring-primary"
                            />
                            <label htmlFor="is_staff" className="text-sm text-slate-300">
                                Grant admin access (can manage users and settings)
                            </label>
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Creating...' : 'Create Staff Member'}
                    </button>
                </div>
            </form>
        </div>
    );
}
