'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    User,
    Mail,
    Shield,
    Calendar,
    Edit,
    Lock,
    Activity,
    DollarSign,
    Briefcase,
    CreditCard,
    FileText,
    Percent,
    Plus,
    Trash2,
    Upload,
    ExternalLink
} from 'lucide-react';
import api from '@/lib/api';

interface Allowance {
    id: string;
    name: string;
    amount: number;
}

interface Deduction {
    id: string;
    name: string;
    amount: number;
}

interface StaffProfile {
    id: string;
    employee_number: string;
    id_number: string;
    kra_pin: string;
    nssf_number: string;
    nhif_number: string;
    department: string;
    position: string;
    hire_date: string;
    basic_salary: number;
    bank_name: string;
    bank_account: string;
    allowances: Allowance[];
    deductions: Deduction[];
}

interface StaffDocument {
    id: string;
    category: 'national_id' | 'contract' | 'kra_cert' | 'academic' | 'other';
    file: string;
    name: string;
    uploaded_at: string;
}

interface StaffContract {
    id: string;
    basic_salary: string | number;
    housing_allowance: string | number;
    transport_allowance: string | number;
    other_allowances: string | number;
    bank_name: string;
    bank_account: string;
    start_date: string;
    end_date: string | null;
    status: string;
    allowances: { id: string; name: string; amount: number; calculation_type: string; percentage_basis: string }[];
    deductions: { id: string; name: string; amount: number; calculation_type: string; percentage_basis: string }[];
}

interface StaffMember {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: {
        id: string;
        name: string;
        description: string;
        approval_limit: number;
    } | null;
    branch?: {
        id: string;
        name: string;
    } | null;
    profile?: {
        employee_id: string;
        avatar: string | null;
        phone_number: string;
        bio: string;
        job_title: string;
        location: string;
        kra_pin: string;
        nssf_number: string;
        shif_number: string;
    };
    contracts: StaffContract[];
    payroll_records: any[];
    documents: StaffDocument[];
    is_active: boolean;
    is_staff: boolean;
    date_joined: string;
}

export default function StaffDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [staff, setStaff] = useState<StaffMember | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');

    useEffect(() => {
        const fetchStaffData = async () => {
            try {
                // Fetch User data which now includes contracts and payroll_records
                const userRes = await api.get(`/users/${params.id}/`);
                setStaff(userRes.data);
            } catch (error) {
                console.error('Failed to fetch staff data:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchStaffData();
    }, [params.id]);

    const formatCurrency = (amount: number | string) => {
        const num = typeof amount === 'string' ? parseFloat(amount) : amount;
        return new Intl.NumberFormat('en-KE', {
            style: 'currency',
            currency: 'KES',
        }).format(num);
    };

    const handleFileUpload = async (category: string, file: File) => {
        const formData = new FormData();
        formData.append('category', category);
        formData.append('file', file);
        formData.append('user', params.id as string);
        formData.append('name', file.name);

        try {
            await api.post('/documents/', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            // Refresh data
            const userRes = await api.get(`/users/${params.id}/`);
            setStaff(userRes.data);
        } catch (error) {
            console.error('Failed to upload document:', error);
            alert('Failed to upload document');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading staff member...</div>
            </div>
        );
    }

    if (!staff) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-red-400">Staff member not found</div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-bold text-foreground font-heading">
                                {staff.first_name} {staff.last_name}
                            </h1>
                            {staff.branch && (
                                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wider">
                                    {staff.branch.name}
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">{staff.email}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => router.push(`/staff/${params.id}/hr`)}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-semibold shadow-lg shadow-primary/20"
                    >
                        <Edit className="h-4 w-4" />
                        Manage HR & Contract
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors">
                        <Lock className="h-4 w-4" />
                        Reset Password
                    </button>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Role</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{staff.role?.name || 'No Role'}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        <span className="text-xs text-muted-foreground">Approval Limit</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">
                        {staff.role?.approval_limit ? formatCurrency(staff.role.approval_limit) : 'N/A'}
                    </p>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">Department</span>
                    </div>
                    <p className="text-sm font-medium text-foreground">
                        {staff.profile?.job_title || 'Not Assigned'}
                    </p>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Activity className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Status</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-foreground">
                            {staff.is_active ? <span className="text-emerald-400">Active</span> : <span className="text-muted-foreground">Inactive</span>}
                        </p>
                        <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                            {staff.is_staff ? 'Admin' : 'Staff'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="flex border-b border-border overflow-x-auto">
                    {['overview', 'contract', 'payroll', 'documents'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-4 text-sm font-medium transition-colors capitalize whitespace-nowrap ${activeTab === tab
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab === 'contract' ? 'HR & Contract' : tab}
                        </button>
                    ))}
                </div>

                <div className="p-8">
                    {/* Overview Tab */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Personal Details</h3>
                                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">Full Name</dt>
                                            <dd className="text-sm text-foreground font-medium">{staff.first_name} {staff.last_name}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">Email</dt>
                                            <dd className="text-sm text-foreground font-medium">{staff.email}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">ID Number</dt>
                                            <dd className="text-sm text-foreground font-medium">{staff.profile?.employee_id || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">Phone Number</dt>
                                            <dd className="text-sm text-foreground font-medium">{staff.profile?.phone_number || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground mb-1">Date Joined</dt>
                                            <dd className="text-sm text-foreground font-medium">
                                                {staff.date_joined ? new Date(staff.date_joined).toLocaleDateString() : 'N/A'}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                            <div className="space-y-8">
                                <div>
                                    <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6">Access & Security</h3>
                                    <dl className="grid grid-cols-1 gap-y-6">
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                                            <div>
                                                <p className="text-sm text-foreground font-medium">Administrator Access</p>
                                                <p className="text-xs text-muted-foreground">Can manage system settings and users</p>
                                            </div>
                                            <div className={`h-2 w-2 rounded-full ${staff.is_staff ? 'bg-emerald-500' : 'bg-slate-700'}`} />
                                        </div>
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                                            <div>
                                                <p className="text-sm text-foreground font-medium">Account Status</p>
                                                <p className="text-xs text-muted-foreground">Determines if the user can log in</p>
                                            </div>
                                            <div className={`h-2 w-2 rounded-full ${staff.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* HR & Contract Tab */}
                    {activeTab === 'contract' && (
                        <div className="space-y-12">
                            {/* Payroll Meta */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <div className="glass rounded-xl p-6 border border-border bg-primary/5">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Active Contract Base</h3>
                                    <p className="text-3xl font-bold text-foreground tracking-tight">
                                        {staff.contracts?.[0]?.basic_salary ? formatCurrency(staff.contracts[0].basic_salary) : 'No Active Contract'}
                                    </p>
                                </div>
                                <div className="glass rounded-xl p-6 border border-border">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Statutory Info</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">KRA PIN</span>
                                            <span className="text-foreground font-mono">{staff.profile?.kra_pin || '---'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">NSSF</span>
                                            <span className="text-foreground font-mono">{staff.profile?.nssf_number || '---'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">SHIF</span>
                                            <span className="text-foreground font-mono">{staff.profile?.shif_number || '---'}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="glass rounded-xl p-6 border border-border">
                                    <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Bank Details</h3>
                                    <div className="space-y-3">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Bank</span>
                                            <span className="text-foreground font-medium">{staff.contracts?.[0]?.bank_name || '---'}</span>
                                        </div>
                                        <div className="flex justify-between text-xs">
                                            <span className="text-muted-foreground">Account</span>
                                            <span className="text-foreground font-mono">{staff.contracts?.[0]?.bank_account || '---'}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Recurring Items */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Plus className="h-4 w-4 text-emerald-500" />
                                            Standard Allowances
                                        </h3>
                                        <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Add</button>
                                    </div>
                                    <div className="space-y-3">
                                        {staff.contracts?.[0]?.allowances?.map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                                                <div>
                                                    <span className="text-sm text-foreground font-medium">{item.name}</span>
                                                    {item.calculation_type === 'percentage' && (
                                                        <span className="ml-2 text-[10px] text-muted-foreground">
                                                            ({item.amount}% of {item.percentage_basis})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm text-emerald-400 font-bold">
                                                        {item.calculation_type === 'percentage' ? `${item.amount}%` : formatCurrency(item.amount)}
                                                    </span>
                                                    <Trash2 className="h-4 w-4 text-slate-600 hover:text-red-400 cursor-pointer transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                        {(!staff.contracts?.[0]?.allowances || staff.contracts[0].allowances.length === 0) && (
                                            <p className="text-sm text-slate-600 italic py-4 text-center border border-dashed border-border rounded-lg">No recurring allowances</p>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                            <Trash2 className="h-4 w-4 text-primary" />
                                            Standard Deductions
                                        </h3>
                                        <button className="text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">Add</button>
                                    </div>
                                    <div className="space-y-3">
                                        {staff.contracts?.[0]?.deductions?.map((item: any) => (
                                            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted border border-border">
                                                <div>
                                                    <span className="text-sm text-foreground font-medium">{item.name}</span>
                                                    {item.calculation_type === 'percentage' && (
                                                        <span className="ml-2 text-[10px] text-muted-foreground">
                                                            ({item.amount}% of {item.percentage_basis})
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className="text-sm text-primary font-bold">
                                                        ({item.calculation_type === 'percentage' ? `${item.amount}%` : formatCurrency(item.amount)})
                                                    </span>
                                                    <Trash2 className="h-4 w-4 text-slate-600 hover:text-red-400 cursor-pointer transition-colors" />
                                                </div>
                                            </div>
                                        ))}
                                        {(!staff.contracts?.[0]?.deductions || staff.contracts[0].deductions.length === 0) && (
                                            <p className="text-sm text-slate-600 italic py-4 text-center border border-dashed border-border rounded-lg">No recurring deductions</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payroll Tab */}
                    {activeTab === 'payroll' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest">Payroll History</h3>
                                <button
                                    onClick={() => router.push(`/accounting/payroll/new?staff=${params.id}`)}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-xs font-bold transition-all hover:bg-primary/90"
                                >
                                    <Plus className="h-4 w-4" />
                                    Generate Payslip
                                </button>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {staff.payroll_records?.map((record) => (
                                    <div key={record.id} className="glass rounded-xl p-4 border border-border flex items-center justify-between">
                                        <div>
                                            <p className="font-bold text-foreground">{record.month}/{record.year}</p>
                                            <p className="text-xs text-muted-foreground">Net: {formatCurrency(parseFloat(record.net_pay))}</p>
                                        </div>
                                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${record.status === 'paid' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                                            }`}>
                                            {record.status}
                                        </span>
                                    </div>
                                ))}
                                {(!staff.payroll_records || staff.payroll_records.length === 0) && (
                                    <div className="col-span-2 text-center py-12 text-slate-600 italic border border-dashed border-border rounded-xl">
                                        No payroll records found for this staff member.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Documents Tab */}
                    {activeTab === 'documents' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { id: 'national_id', name: 'National ID', icon: CreditCard },
                                { id: 'contract', name: 'Contract Agreement', icon: FileText },
                                { id: 'kra_cert', name: 'KRA Certificate', icon: Percent },
                                { id: 'academic', name: 'Academic Papers', icon: Briefcase },
                            ].map((docType) => {
                                const existingDoc = staff.documents?.find(d => d.category === docType.id);
                                return (
                                    <div key={docType.id} className="glass rounded-xl p-6 border border-border flex flex-col items-center gap-4 hover:border-primary/50 transition-colors group relative">
                                        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                                            <docType.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-bold text-foreground">{docType.name}</p>
                                            {existingDoc ? (
                                                <div className="mt-2 space-y-2">
                                                    <p className="text-[10px] text-emerald-400 font-medium truncate max-w-[150px]">
                                                        {existingDoc.name || 'document.pdf'}
                                                    </p>
                                                    <a
                                                        href={existingDoc.file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
                                                    >
                                                        View <ExternalLink className="h-3 w-3" />
                                                    </a>
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground mt-1 italic">No document uploaded</p>
                                            )}
                                        </div>

                                        <div className="w-full mt-2">
                                            <label className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-muted border border-border hover:bg-muted/80 cursor-pointer transition-colors">
                                                <Upload className="h-3 w-3 text-muted-foreground" />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                                                    {existingDoc ? 'Replace' : 'Upload'}
                                                </span>
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) {
                                                            handleFileUpload(docType.id, e.target.files[0]);
                                                        }
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
