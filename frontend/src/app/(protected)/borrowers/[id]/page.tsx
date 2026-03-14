'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    User,
    Phone,
    MapPin,
    Briefcase,
    CreditCard,
    ShieldCheck,
    FileText,
    Edit,
    Download,
    Building2,
    Sparkles,
    BarChart3,
    MessageSquare,
    Mail,
    Smartphone,
    Send
} from 'lucide-react';
import api from '@/lib/api';
import { CustomerDocuments } from '@/components/customers/CustomerDocuments';
import { FinancialStatements } from '@/components/customers/FinancialStatements';
import MessageModal from '@/components/common/MessageModal';
import DataTable from '@/components/ui/DataTable';

interface BorrowerContact {
    id: string;
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
    designation?: string;
    is_primary: boolean;
}

interface BorrowerPhone {
    id: string;
    phone_number: string;
    description?: string;
    is_mpesa: boolean;
}

interface Borrower {
    id: string;
    borrower_number: string;
    borrower_type: 'individual' | 'company' | 'institution' | 'group';
    first_name?: string;
    last_name?: string;
    business_name?: string;
    email: string;
    phone_number: string;
    id_type: string;
    id_number: string;
    tax_id?: string;
    date_of_birth?: string;
    incorporation_date?: string;
    physical_address: string;
    city: string;
    postal_code: string;
    county: string;
    country: string;
    employment_status: string;
    monthly_income: number;
    crb_score: number | null;
    internal_score: number;
    hybrid_score: number | null;
    verification_status: string;
    is_verified: boolean;
    verification_notes: string;
    verified_at: string | null;
    created_at: string;
    contacts: BorrowerContact[];
    additional_phones?: BorrowerPhone[];
}

interface ActivityItem {
    id: string;
    date: string;
    type: string;
    display: string;
    description: string;
    user: string;
    icon: string;
}

export default function BorrowerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [borrower, setBorrower] = useState<Borrower | null>(null);
    const [savings, setSavings] = useState<any[]>([]);
    const [collateral, setCollateral] = useState<any[]>([]);
    const [loanApplications, setLoanApplications] = useState<any[]>([]);
    const [activeLoans, setActiveLoans] = useState<any[]>([]);
    const [history, setHistory] = useState<ActivityItem[]>([]);
    const [communications, setCommunications] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [isMessageModalOpen, setIsMessageModalOpen] = useState(false);

    useEffect(() => {
        if (!params.id || params.id === 'undefined') return;

        const fetchData = async () => {
            try {
                const [borrowerRes, savingsRes, collateralRes, applicationsRes, loansRes, historyRes, commRes] = await Promise.all([
                    api.get(`/customers/borrowers/${params.id}/`),
                    api.get(`/savings/accounts/?borrower=${params.id}`),
                    api.get(`/collateral/?borrower=${params.id}`),
                    api.get(`/loans/applications/?borrower=${params.id}`),
                    api.get(`/loans/?borrower=${params.id}`),
                    api.get(`/customers/borrowers/${params.id}/activity_feed/`),
                    api.get(`/notifications/logs/?related_borrower=${params.id}`)
                ]);
                setBorrower(borrowerRes.data);
                setHistory(historyRes.data);

                const commData = Array.isArray(commRes.data?.results) ? commRes.data.results : (Array.isArray(commRes.data) ? commRes.data : []);
                setCommunications(commData);
                const safeSet = (data: any) => Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                setSavings(safeSet(savingsRes.data));
                setCollateral(safeSet(collateralRes.data));
                setLoanApplications(safeSet(applicationsRes.data));
                setActiveLoans(safeSet(loansRes.data));
            } catch (error) {
                console.error('Failed to fetch borrower details:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [params.id]);

    const handleVerifyID = async (mode: 'auto' | 'manual') => {
        const notes = mode === 'manual' ? prompt('Enter verification notes:') : '';
        if (mode === 'manual' && notes === null) return;

        try {
            const response = await api.post(`/customers/borrowers/${params.id}/verify_id/`, {
                mode,
                notes
            });
            // Refresh borrower data
            const custRes = await api.get(`/customers/borrowers/${params.id}/`);
            setBorrower(custRes.data);
            alert(response.data.status || 'Verification process completed.');
        } catch (error: any) {
            console.error('Verification failed:', error);
            alert(error.response?.data?.error || 'Verification failed');
        }
    };

    const handleFetchCRB = async () => {
        try {
            await api.post(`/customers/borrowers/${params.id}/fetch_crb_report/`);
            // Refresh borrower data
            const response = await api.get(`/customers/borrowers/${params.id}/`);
            setBorrower(response.data);
            alert('CRB report fetched successfully!');
        } catch (error) {
            console.error('Failed to fetch CRB:', error);
            alert('Failed to fetch CRB report');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-muted-foreground">Loading borrower...</div>
            </div>
        );
    }

    if (!borrower) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-red-400">Borrower not found</div>
            </div>
        );
    }

    const isIndividual = borrower.borrower_type === 'individual';
    const displayName = isIndividual ? `${borrower.first_name} ${borrower.last_name}` : borrower.business_name;

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
                                {displayName}
                            </h1>
                            {!isIndividual && (
                                <span className="px-2 py-0.5 rounded-md bg-secondary text-secondary-foreground text-xs font-medium uppercase">
                                    {borrower.borrower_type}
                                </span>
                            )}
                        </div>
                        <p className="text-muted-foreground mt-1">{borrower.borrower_number}</p>
                    </div>
                </div>
                <button
                    onClick={() => setIsMessageModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                >
                    <MessageSquare className="h-4 w-4" />
                    Send Message
                </button>
                <button
                    onClick={() => router.push(`/borrowers/${params.id}/edit`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                >
                    <Edit className="h-4 w-4" />
                    Edit
                </button>
                <button
                    onClick={handleFetchCRB}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-semibold shadow-lg shadow-primary/20"
                >
                    <Download className="h-4 w-4" />
                    Fetch CRB
                </button>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <CreditCard className="h-4 w-4 text-primary" />
                        <span className="text-xs text-muted-foreground">Credit Score</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{borrower.hybrid_score || 'N/A'}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-border overflow-hidden relative group">
                    <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className={`h-4 w-4 ${borrower.verification_status === 'verified' ? 'text-emerald-500' : 'text-amber-500'}`} />
                        <span className="text-xs text-muted-foreground">Verification</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <p className={`text-sm font-bold capitalize ${borrower.verification_status === 'verified' ? 'text-emerald-400' :
                            borrower.verification_status === 'failed' ? 'text-red-400' : 'text-amber-400'
                            }`}>
                            {borrower.verification_status?.replace('_', ' ') || 'Pending'}
                        </p>
                        {borrower.verification_status !== 'verified' && (
                            <div className="flex gap-1">
                                <button
                                    onClick={() => handleVerifyID('auto')}
                                    className="p-1 px-2 text-[8px] bg-primary/20 text-primary rounded border border-primary/20 hover:bg-primary/30 font-bold"
                                    title="Automated AI Verification"
                                >
                                    AUTO
                                </button>
                                <button
                                    onClick={() => handleVerifyID('manual')}
                                    className="p-1 px-2 text-[8px] bg-white/5 text-slate-300 rounded border border-white/10 hover:bg-white/10 font-bold"
                                    title="Manual Staff Verification"
                                >
                                    MANUAL
                                </button>
                            </div>
                        )}
                    </div>
                    {borrower.verification_notes && (
                        <p className="text-[9px] text-muted-foreground mt-2 truncate italic">"{borrower.verification_notes}"</p>
                    )}
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-muted-foreground">{isIndividual ? 'Income' : 'Revenue'}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">KES {borrower.monthly_income.toLocaleString()}</p>
                </div>
                <div className="glass rounded-xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-2">
                        <FileText className="h-4 w-4 text-blue-500" />
                        <span className="text-xs text-muted-foreground">Active Loans</span>
                    </div>
                    <p className="text-2xl font-bold text-foreground">{activeLoans.filter(l => l.status === 'active').length}</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="glass rounded-xl border border-border overflow-hidden">
                <div className="flex border-b border-border">
                    {['overview', 'documents', 'loans', 'savings', 'collateral', 'communications', 'credit', 'activity'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-6 py-3 text-sm font-medium transition-colors capitalize ${activeTab === tab
                                ? 'text-primary border-b-2 border-primary'
                                : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                <div className="p-6">
                    {activeTab === 'overview' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Basic Info */}
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                        {isIndividual ? <User className="h-5 w-5 text-primary" /> : <Building2 className="h-5 w-5 text-primary" />}
                                        {isIndividual ? 'Personal Information' : 'Entity Information'}
                                    </h3>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Name</dt>
                                            <dd className="text-sm text-foreground">{displayName}</dd>
                                        </div>
                                        {isIndividual ? (
                                            <div>
                                                <dt className="text-xs text-muted-foreground">Date of Birth</dt>
                                                <dd className="text-sm text-foreground">{borrower.date_of_birth ? new Date(borrower.date_of_birth).toLocaleDateString() : 'N/A'}</dd>
                                            </div>
                                        ) : (
                                            <>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Incorporation Date</dt>
                                                    <dd className="text-sm text-foreground">{borrower.incorporation_date ? new Date(borrower.incorporation_date).toLocaleDateString() : 'N/A'}</dd>
                                                </div>
                                                <div>
                                                    <dt className="text-xs text-muted-foreground">Tax ID / KRA PIN</dt>
                                                    <dd className="text-sm text-foreground">{borrower.tax_id}</dd>
                                                </div>
                                            </>
                                        )}
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{isIndividual ? 'ID Type' : 'Reg Type'}</dt>
                                            <dd className="text-sm text-foreground capitalize">{borrower.id_type.replace('_', ' ')}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">{isIndividual ? 'ID Number' : 'Reg Number'}</dt>
                                            <dd className="text-sm text-foreground">{borrower.id_number}</dd>
                                        </div>
                                    </dl>

                                    {!isIndividual && borrower.contacts && borrower.contacts.length > 0 && (
                                        <div className="mt-8">
                                            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                                <User className="h-5 w-5 text-primary" />
                                                Contact Persons
                                            </h3>
                                            <div className="grid grid-cols-1 gap-4">
                                                {borrower.contacts.map((contact) => (
                                                    <div key={contact.id} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                                                        <div className="flex justify-between items-start">
                                                            <div>
                                                                <p className="text-sm font-bold text-foreground">
                                                                    {contact.first_name} {contact.last_name}
                                                                    {contact.is_primary && (
                                                                        <span className="ml-2 px-1.5 py-0.5 rounded bg-primary/20 text-primary text-[8px] font-bold uppercase">Primary</span>
                                                                    )}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{contact.designation || 'Contact'}</p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-xs text-foreground font-mono">{contact.phone_number}</p>
                                                                {contact.email && <p className="text-[10px] text-muted-foreground">{contact.email}</p>}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Contact Info */}
                                <div>
                                    <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                        <Phone className="h-5 w-5 text-primary" />
                                        Contact Information
                                    </h3>
                                    <dl className="space-y-3">
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Phone Number</dt>
                                            <dd className="text-sm text-foreground">{borrower.phone_number}</dd>
                                        </div>
                                        {borrower.additional_phones && borrower.additional_phones.length > 0 && (
                                            <div className="space-y-2 mt-2">
                                                <dt className="text-xs text-muted-foreground italic">Additional Numbers</dt>
                                                {borrower.additional_phones.map((phone) => (
                                                    <dd key={phone.id} className="text-sm text-foreground flex items-center justify-between p-2 rounded bg-muted/20 border border-border/30">
                                                        <span>
                                                            {phone.phone_number}
                                                            {phone.description && <span className="ml-2 text-[10px] text-muted-foreground uppercase">({phone.description})</span>}
                                                        </span>
                                                        {phone.is_mpesa && (
                                                            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[8px] font-bold uppercase">M-Pesa</span>
                                                        )}
                                                    </dd>
                                                ))}
                                            </div>
                                        )}
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Email</dt>
                                            <dd className="text-sm text-foreground">{borrower.email || 'N/A'}</dd>
                                        </div>
                                        <div>
                                            <dt className="text-xs text-muted-foreground">Address</dt>
                                            <dd className="text-sm text-foreground">
                                                {borrower.physical_address}<br />
                                                {borrower.city}, {borrower.county}<br />
                                                {borrower.postal_code} {borrower.country}
                                            </dd>
                                        </div>
                                    </dl>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="space-y-8">
                            <section>
                                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <FileText className="h-5 w-5 text-primary" />
                                    KYC Documents
                                </h3>
                                <div className="glass p-6 rounded-xl border border-border">
                                    <CustomerDocuments borrowerId={params.id as string} />
                                </div>
                            </section>

                            <section>
                                <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
                                    <BarChart3 className="h-5 w-5 text-blue-500" />
                                    Financial Statements (Appraisal Data)
                                </h3>
                                <div className="glass p-6 rounded-xl border border-border">
                                    <FinancialStatements borrowerId={params.id as string} />
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === 'loans' && (
                        <div className="space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold text-foreground">Loan Applications</h3>
                                <button
                                    onClick={() => router.push(`/loans/applications/new?borrower=${params.id}`)}
                                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-bold hover:bg-primary/30 transition-all"
                                >
                                    New Application
                                </button>
                            </div>

                            {loanApplications.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {loanApplications.map((app) => (
                                        <div
                                            key={app.id}
                                            onClick={() => router.push(`/loans/applications/${app.id}`)}
                                            className="glass p-4 rounded-xl border border-border hover:border-primary/50 cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-3">
                                                <p className="text-xs font-mono text-muted-foreground">{app.application_number}</p>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${app.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    app.status === 'disbursed' ? 'bg-primary/10 text-primary' : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                    {app.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <p className="text-sm font-bold text-foreground truncate">{app.product_details?.name}</p>
                                            <div className="mt-4 flex justify-between items-end">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Requested</p>
                                                    <p className="text-lg font-bold text-foreground">KES {parseFloat(app.requested_amount).toLocaleString()}</p>
                                                </div>
                                                <p className="text-[10px] text-muted-foreground">{new Date(app.created_at).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-xl">
                                    No applications found.
                                </div>
                            )}

                            {activeLoans.length > 0 && (
                                <>
                                    <h3 className="text-lg font-semibold text-foreground mt-8 mb-4">Active & Closed Loans</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {activeLoans.map((loan) => (
                                            <div
                                                key={loan.id}
                                                onClick={() => router.push(`/loans/${loan.id}`)}
                                                className="glass p-4 rounded-xl border border-border hover:border-primary/50 cursor-pointer transition-all"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <p className="text-xs font-mono text-muted-foreground">{loan.loan_number}</p>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${loan.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400'
                                                        }`}>
                                                        {loan.status}
                                                    </span>
                                                </div>
                                                <p className="text-sm font-bold text-foreground truncate">{loan.product_name}</p>
                                                <div className="mt-4">
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-muted-foreground">Repayment Progress</span>
                                                        <span className="text-foreground">{Math.round(((loan.principal_amount - loan.outstanding_principal) / loan.principal_amount) * 100)}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full bg-primary transition-all"
                                                            style={{ width: `${Math.round(((loan.principal_amount - loan.outstanding_principal) / loan.principal_amount) * 100)}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="mt-4 flex justify-between items-end">
                                                    <div>
                                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Outstanding</p>
                                                        <p className="text-lg font-bold text-foreground">KES {parseFloat(loan.outstanding_balance).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {activeTab === 'savings' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-foreground">Savings Accounts</h3>
                                <button
                                    onClick={() => router.push(`/savings/new?borrower=${params.id}`)}
                                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-bold hover:bg-primary/30 transition-all"
                                >
                                    Open Savings Account
                                </button>
                            </div>
                            {savings.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {savings.map((acc) => (
                                        <div
                                            key={acc.id}
                                            onClick={() => router.push(`/savings/${acc.id}`)}
                                            className="glass p-4 rounded-xl border border-border hover:border-primary/50 cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-foreground font-bold">{acc.product_name}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{acc.account_number}</p>
                                                </div>
                                                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">{acc.status}</span>
                                            </div>
                                            <p className="text-2xl font-bold text-foreground">KES {parseFloat(acc.current_balance).toLocaleString()}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    No savings accounts found for this borrower.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'collateral' && (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-foreground">Collateral Assets</h3>
                                <button
                                    onClick={() => router.push(`/collateral/new?borrower=${params.id}`)}
                                    className="px-4 py-2 bg-primary/20 text-primary rounded-lg text-sm font-bold hover:bg-primary/30 transition-all"
                                >
                                    Add Collateral
                                </button>
                            </div>
                            {collateral.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {collateral.map((c) => (
                                        <div
                                            key={c.id}
                                            onClick={() => router.push(`/collateral/${c.id}`)}
                                            className="glass p-4 rounded-xl border border-border hover:border-primary/50 cursor-pointer transition-all"
                                        >
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <p className="text-foreground font-bold capitalize">{c.collateral_type?.replace('_', ' ') || 'Other'}</p>
                                                    <p className="text-xs text-muted-foreground font-mono">{c.reg_number || c.lr_number || c.id.substring(0, 8)}</p>
                                                </div>
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${c.status === 'pledged' ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{c.status}</span>
                                            </div>
                                            <div className="flex justify-between items-end mt-4">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Market Value</p>
                                                    <p className="text-lg font-bold text-foreground">KES {parseFloat(c.market_value).toLocaleString()}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">FSV</p>
                                                    <p className="text-sm font-bold text-muted-foreground">KES {parseFloat(c.forced_sale_value).toLocaleString()}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12 text-muted-foreground">
                                    No collateral assets recorded for this borrower.
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'communications' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-foreground">Communication History</h3>
                                <button
                                    onClick={() => setIsMessageModalOpen(true)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-lg text-sm font-bold hover:bg-primary/20 transition-all"
                                >
                                    <Send className="h-4 w-4" />
                                    Compose New
                                </button>
                            </div>

                            <div className="glass rounded-xl border border-border overflow-hidden">
                                <DataTable
                                    columns={[
                                        {
                                            header: 'Date',
                                            accessor: (item: any) => new Date(item.created_at).toLocaleString(),
                                            className: 'whitespace-nowrap'
                                        },
                                        {
                                            header: 'Type',
                                            accessor: (item: any) => (
                                                <div className="flex items-center gap-2">
                                                    {item.message_type === 'sms' ? <Smartphone className="h-4 w-4 text-blue-500" /> : <Mail className="h-4 w-4 text-purple-500" />}
                                                    <span className="capitalize">{item.message_type}</span>
                                                </div>
                                            )
                                        },
                                        {
                                            header: 'Recipient',
                                            accessor: 'recipient'
                                        },
                                        {
                                            header: 'Content',
                                            accessor: (item: any) => (
                                                <div className="max-w-md truncate" title={item.content}>
                                                    {item.content}
                                                </div>
                                            )
                                        },
                                        {
                                            header: 'Status',
                                            accessor: (item: any) => (
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.status === 'sent' || item.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-400' :
                                                    item.status === 'failed' ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'
                                                    }`}>
                                                    {item.status}
                                                </span>
                                            )
                                        }
                                    ]}
                                    data={communications}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === 'credit' && (
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <FileText className="h-12 w-12" />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">External CRB Score</p>
                                    <p className="text-3xl font-bold text-foreground">{borrower.crb_score || 'N/A'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 italic">Weight: 60%</p>
                                </div>
                                <div className="glass rounded-xl p-6 border border-border relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <Briefcase className="h-12 w-12" />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1">Internal Repayment Score</p>
                                    <p className="text-3xl font-bold text-foreground">{borrower.internal_score}</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 italic">Weight: 40%</p>
                                </div>
                                <div className="glass rounded-xl p-6 border border-primary/20 bg-primary/5 relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-4 opacity-10">
                                        <ShieldCheck className="h-12 w-12 text-primary" />
                                    </div>
                                    <p className="text-[10px] text-primary uppercase tracking-widest font-bold mb-1">Hybrid Total Score</p>
                                    <p className="text-3xl font-bold text-foreground">{borrower.hybrid_score || 'Calculating...'}</p>
                                    <p className="text-[10px] text-muted-foreground mt-2 italic">Risk-Based Pricing Basis</p>
                                </div>
                            </div>

                            <div className="glass rounded-xl p-6 border border-border">
                                <h4 className="text-sm font-bold text-foreground mb-6 uppercase tracking-widest">Score Composition</h4>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-muted-foreground">External Context (CRB)</span>
                                            <span className="text-foreground">{borrower.crb_score ? 'Active' : 'Missing'}</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-blue-500 transition-all" style={{ width: borrower.crb_score ? `${(borrower.crb_score / 900) * 100}%` : '0%' }} />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <div className="flex justify-between text-xs font-medium">
                                            <span className="text-muted-foreground">Internal History (Repayments)</span>
                                            <span className="text-foreground">{borrower.internal_score} Points</span>
                                        </div>
                                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.min((borrower.internal_score / 500) * 100, 100)}%` }} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'activity' && (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-foreground">Activity Timeline</h3>
                                    <p className="text-sm text-muted-foreground mt-1">Full history of borrower interactions and system events.</p>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/5 rounded-full border border-primary/10">
                                    <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                    <span className="text-xs font-medium text-primary uppercase tracking-wider">{history.length} Events</span>
                                </div>
                            </div>

                            {history.length > 0 ? (
                                <div className="relative space-y-1 py-2">
                                    {/* Vertical Line */}
                                    <div className="absolute left-[20px] top-4 bottom-4 w-px bg-gradient-to-b from-primary/50 via-border to-transparent" />

                                    {history.map((record, i) => (
                                        <div key={record.id} className="relative flex items-start gap-4 group py-3">
                                            {/* Timeline Icon / Marker */}
                                            <div className="relative z-10 flex items-center justify-center">
                                                <div className={`flex h-10 w-10 items-center justify-center rounded-2xl border bg-background shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-md ${record.type === 'loan_application' ? 'border-blue-100 text-blue-600 dark:border-blue-900/50' :
                                                    record.type === 'document' ? 'border-amber-100 text-amber-600 dark:border-amber-900/50' :
                                                        record.type === 'statement' ? 'border-purple-100 text-purple-600 dark:border-purple-900/50' :
                                                            'border-emerald-100 text-emerald-600 dark:border-emerald-900/50'
                                                    }`}>
                                                    {record.icon === 'file-text' ? <FileText className="h-5 w-5" /> :
                                                        record.icon === 'upload' ? <Download className="h-5 w-5" /> :
                                                            record.icon === 'bar-chart' ? <BarChart3 className="h-5 w-5" /> :
                                                                <User className="h-5 w-5" />}
                                                </div>
                                                {/* Pulsing indicator for very recent items (optional idea) */}
                                                {i === 0 && (
                                                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Content Card */}
                                            <div className="flex-1">
                                                <div className="glass rounded-2xl p-5 border border-border group-hover:border-primary/20 group-hover:bg-white/50 dark:group-hover:bg-slate-900/50 transition-all duration-300 shadow-[0_2px_10px_-4px_rgba(0,0,0,0.05)]">
                                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-tight ${record.type === 'loan_application' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                                record.type === 'document' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                                    record.type === 'statement' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                                                                        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                                }`}>
                                                                {record.display}
                                                            </span>
                                                            <h4 className="text-[15px] font-semibold text-foreground leading-tight">
                                                                {record.description}
                                                            </h4>
                                                        </div>
                                                        <time className="text-xs font-medium text-muted-foreground bg-secondary/30 px-2 py-1 rounded-md whitespace-nowrap">
                                                            {new Date(record.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                        </time>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                                                            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[10px] text-primary border border-primary/10">
                                                                {record.user ? record.user.split(' ').map(n => n[0]).join('') : 'S'}
                                                            </div>
                                                            <span>Action by <span className="text-foreground">{record.user || 'System Automation'}</span></span>
                                                        </div>
                                                        <div className="h-1 w-1 rounded-full bg-border" />
                                                        <span className="text-[10px] uppercase text-muted-foreground/60 font-bold tracking-widest">{record.type}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-20 bg-secondary/5 border-2 border-dashed border-border rounded-3xl">
                                    <div className="flex flex-col items-center gap-3">
                                        <div className="p-4 bg-background rounded-full shadow-sm">
                                            <FileText className="h-8 w-8 text-muted-foreground/40" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-base font-semibold text-foreground">No activities yet</p>
                                            <p className="text-sm text-muted-foreground">When borrower actions occur, they will appear here in real-time.</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <MessageModal
                    isOpen={isMessageModalOpen}
                    onClose={() => setIsMessageModalOpen(false)}
                    recipientPhone={borrower.phone_number}
                    recipientEmail={borrower.email || ''}
                    borrowerId={borrower.id}
                    onSuccess={() => {
                        // Refresh communications
                        api.get(`/notifications/logs/?related_borrower=${params.id}`).then(res => {
                            const data = Array.isArray(res.data?.results) ? res.data.results : (Array.isArray(res.data) ? res.data : []);
                            setCommunications(data);
                        });
                    }}
                />
            </div>
        </div>
    );
}
