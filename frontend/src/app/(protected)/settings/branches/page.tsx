'use client';

import { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Building2,
    MapPin,
    Phone,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    Loader2,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

interface Branch {
    id: string;
    name: string;
    code: string;
    address: string;
    phone: string;
    is_active: boolean;
    created_at: string;
}

export default function BranchesPage() {
    const [branches, setBranches] = useState<Branch[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        code: '',
        address: '',
        phone: '',
        is_active: true
    });

    useEffect(() => {
        fetchBranches();
    }, []);

    const fetchBranches = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/branches/branches/');
            const data = response?.data;
            setBranches(Array.isArray(data) ? data : data?.results || []);
        } catch (error) {
            console.error('Failed to fetch branches:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenModal = (branch?: Branch) => {
        if (branch) {
            setEditingBranch(branch);
            setFormData({
                name: branch.name,
                code: branch.code,
                address: branch.address,
                phone: branch.phone,
                is_active: branch.is_active
            });
        } else {
            setEditingBranch(null);
            setFormData({
                name: '',
                code: '',
                address: '',
                phone: '',
                is_active: true
            });
        }
        setIsModalOpen(true);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingBranch) {
                await api.patch(`/branches/branches/${editingBranch.id}/`, formData);
            } else {
                await api.post('/branches/branches/', formData);
            }
            fetchBranches();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error('Failed to save branch:', error);
            alert(error.response?.data?.detail || 'Failed to save branch. Ensure the code is unique.');
        } finally {
            setIsSaving(false);
        }
    };

    const toggleStatus = async (branch: Branch) => {
        try {
            await api.patch(`/branches/branches/${branch.id}/`, { is_active: !branch.is_active });
            fetchBranches();
        } catch (error) {
            console.error('Failed to toggle status:', error);
        }
    };

    const filteredBranches = branches.filter(b =>
        b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.code.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading italic tracking-tight">Organization Branches</h1>
                        <p className="text-muted-foreground mt-1">Manage physical locations and service centers.</p>
                    </div>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all"
                >
                    <Plus className="h-5 w-5" />
                    New Branch
                </button>
            </div>

            <div className="glass rounded-2xl border border-white/5 overflow-hidden">
                <div className="p-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Search by name or code..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="bg-transparent border-none outline-none text-sm w-full text-foreground placeholder:text-muted-foreground"
                    />
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                                <th className="px-6 py-4">Branch</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4 text-center">Status</th>
                                <th className="px-6 py-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                Array(3).fill(0).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={4} className="px-6 py-8 h-20 bg-white/[0.02]" />
                                    </tr>
                                ))
                            ) : filteredBranches.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">
                                        No branches found.
                                    </td>
                                </tr>
                            ) : filteredBranches.map((branch) => (
                                <tr key={branch.id} className="hover:bg-white/[0.02] transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                                                <Building2 className="h-5 w-5" />
                                            </div>
                                            <div>
                                                <p className="font-bold text-foreground">{branch.name}</p>
                                                <p className="text-xs text-muted-foreground font-mono">{branch.code}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <MapPin className="h-3 w-3" />
                                                <span>{branch.address || 'No address provided'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Phone className="h-3 w-3" />
                                                <span>{branch.phone || 'No phone provided'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => toggleStatus(branch)}
                                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase transition-all ${branch.is_active
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                : 'bg-red-500/10 text-red-400 border border-red-500/20 opacity-50'
                                                }`}
                                        >
                                            {branch.is_active ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                            {branch.is_active ? 'Active' : 'Inactive'}
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => handleOpenModal(branch)}
                                                className="p-2 hover:bg-primary/20 hover:text-primary rounded-lg transition-colors text-muted-foreground"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
                    <div className="bg-slate-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-white/5 bg-white/5 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-foreground">
                                {editingBranch ? 'Edit Branch' : 'Create New Branch'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                                <XCircle className="h-6 w-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-2 md:col-span-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Branch Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                                        placeholder="Main HQ"
                                    />
                                </div>
                                <div className="space-y-1 col-span-2 md:col-span-1">
                                    <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Branch Code</label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground text-sm font-mono focus:ring-2 focus:ring-primary transition-all outline-none"
                                        placeholder="HQ001"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Phone Number</label>
                                <input
                                    type="text"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                                    placeholder="+254 7XX XXX XXX"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Physical Address</label>
                                <textarea
                                    rows={3}
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground text-sm focus:ring-2 focus:ring-primary transition-all outline-none"
                                    placeholder="Enter full address details..."
                                />
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                                <span className="text-sm font-medium text-foreground">Mark as Active</span>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-6 py-3 bg-muted hover:bg-muted/80 text-foreground font-bold rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                                >
                                    {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                                    {editingBranch ? 'Save Changes' : 'Create Branch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
