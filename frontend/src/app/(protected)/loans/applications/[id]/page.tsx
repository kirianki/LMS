'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    User,
    Briefcase,
    DollarSign,
    Clock,
    FileText,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Percent,
    Shield,
    Calendar,
    Stamp,
    Send,
    Eye,
    Download,
    ChevronDown,
    MoreVertical,
    RefreshCw
} from 'lucide-react';
import api from '@/lib/api';
import ApplicationApprovalModal from '@/components/loans/ApplicationApprovalModal';
import CollateralSelectModal from '@/components/loans/CollateralSelectModal';
import GuarantorEntryModal from '@/components/loans/GuarantorEntryModal';
import RepaymentScheduleEditor from '@/components/loans/RepaymentScheduleEditor';
import DisbursementModal from '@/components/loans/DisbursementModal';

interface Application {
    id: string;
    application_number: string;
    borrower_details: {
        id: string;
        first_name?: string;
        last_name?: string;
        business_name?: string;
        borrower_type: string;
        name?: string; // Fallback helper or from serializer
        borrower_number: string;
        phone_number: string;
        email: string;
        id_number: string;
        tax_id?: string;
        hybrid_score: number | null;
        internal_score: number;
    };
    product_details: {
        id: string;
        name: string;
        code: string;
        suggested_interest_rate: number | null;
        min_amount: number;
        max_amount: number;
        requires_collateral: boolean;
        requires_guarantor: boolean;
        suggested_interest_period: string;
    };
    requested_amount: string;
    requested_term: number;
    purpose: string;
    status: string;
    status_display: string;
    approved_amount: string | null;
    approved_term: number | null;
    approved_interest_rate: string | null;
    approved_interest_method: string | null;
    approved_interest_period: string | null;
    processing_fee: string | null;
    risk_category: string | null;
    created_at: string;
    submitted_at: string | null;
    approved_at: string | null;
    offer_expires_at: string | null;
    offer_letter_file: string | null;
    signed_offer_letter: string | null;
    disbursement_letter_file: string | null;
    signed_disbursement_letter: string | null;
    repayment_channel?: string;
    review_notes: string;
    collateral: any | null;
    collateral_details: {
        id: string;
        collateral_type: string;
        reg_number?: string;
        lr_number?: string;
        market_value: string | number;
    } | null;
    collaterals: string[];
    collateral_items: any[];
    guarantors: any[];
    refinances_loan: string | null;
    refinances_loan_details: {
        loan_number: string;
        outstanding_balance: string | number;
        outstanding_principal: string | number;
        outstanding_interest: string | number;
        outstanding_penalties: string | number;
    } | null;
    payoff_amount: string | null;
    net_disbursement: string | null;
}

export default function ApplicationDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [application, setApplication] = useState<Application | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showApprovalModal, setShowApprovalModal] = useState(false);
    const [showCollateralModal, setShowCollateralModal] = useState(false);
    const [showGuarantorModal, setShowGuarantorModal] = useState(false);
    const [showDisbursementModal, setShowDisbursementModal] = useState(false);
    const [showActionsDropdown, setShowActionsDropdown] = useState(false);
    const [showOfferDialog, setShowOfferDialog] = useState(false);
    const [sendToBorrower, setSendToBorrower] = useState(false);
    const [isSendingOffer, setIsSendingOffer] = useState(false);

    useEffect(() => {
        fetchApplication();
    }, [params.id]);

    const fetchApplication = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/loans/applications/${params.id}/`);
            const data = response.data;
            if (data.borrower_details) {
                const b = data.borrower_details;
                if (!b.name) {
                    b.name = (b.borrower_type === 'company' || b.borrower_type === 'institution') ? b.business_name : `${b.first_name} ${b.last_name}`;
                }
            }
            setApplication(data);
        } catch (error) {
            console.error('Failed to fetch application:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendOffer = async () => {
        setIsSendingOffer(true);
        try {
            await api.post(`/loans/applications/${params.id}/send_offer_letter/`, {
                send_to_borrower: sendToBorrower
            });
            fetchApplication();
            setShowOfferDialog(false);
            alert(sendToBorrower ? 'Offer letter generated and emailed to borrower!' : 'Offer letter generated successfully!');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to generate offer letter');
        } finally {
            setIsSendingOffer(false);
        }
    };

    const handleAction = async (action: string) => {
        try {
            if (action === 'submit') {
                await api.post(`/loans/applications/${params.id}/submit/`);
            } else if (action === 'start_review') {
                await api.post(`/loans/applications/${params.id}/start_review/`);
            } else if (action === 'send_offer') {
                setShowOfferDialog(true);
                return; // Don't show generic success — the dialog handles it
            } else if (action === 'disburse') {
                const method = prompt('Enter disbursement method (mpesa/cash/bank):', 'mpesa');
                if (!method) return;
                await api.post(`/loans/applications/${params.id}/disburse/`, { disbursement_method: method.toLowerCase() });
            } else if (action === 'cancel') {
                if (!confirm('Are you sure you want to cancel this application?')) return;
                await api.post(`/loans/applications/${params.id}/cancel/`);
            }
            fetchApplication();
            alert('Action completed successfully!');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Action failed');
        }
    };

    const handleUploadOffer = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('signed_offer', file);

            const channel = prompt('Please select the preferred Repayment Channel (mpesa/bank transfer/cash):', application?.repayment_channel || 'mpesa');
            if (channel) {
                formData.append('repayment_channel', channel.toUpperCase());
            }

            try {
                await api.post(`/loans/applications/${params.id}/accept_offer/`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                fetchApplication();
                alert('Signed offer uploaded and repayment channel set successfully!');
            } catch (error: any) {
                alert(error.response?.data?.error || 'Upload failed');
            }
        };
        input.click();
    };

    const handleUploadDisbursement = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/pdf';
        input.onchange = async (e: any) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('signed_disbursement', file);

            try {
                await api.post(`/loans/applications/${params.id}/upload_disbursement_authorization/`, formData, {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                });
                fetchApplication();
                alert('Signed disbursement checklist uploaded successfully!');
            } catch (error: any) {
                alert(error.response?.data?.error || 'Upload failed');
            }
        };
        input.click();
    };

    const handleDownload = async (type: 'offer' | 'advice') => {
        const endpoint = type === 'offer' ? 'download_offer_letter' : 'download_disbursement_letter';
        const filename = type === 'offer' ? `Offer_${application?.application_number}.pdf` : `Disbursement_Checklist_${application?.application_number}.pdf`;

        try {
            const response = await api.get(`/loans/applications/${params.id}/${endpoint}/`, {
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error: any) {
            console.error('Download failed:', error);
            alert('Failed to download document. It may not be generated yet.');
        }
    };

    const handleSelectCollateral = async (collateralId: string) => {
        try {
            const currentCollaterals = application?.collaterals || [];
            if (currentCollaterals.includes(collateralId)) {
                alert('This collateral is already attached.');
                return;
            }

            const newCollaterals = [...currentCollaterals, collateralId];
            await api.patch(`/loans/applications/${params.id}/`, { collaterals: newCollaterals });
            setShowCollateralModal(false);
            fetchApplication();
            alert('Collateral attached successfully!');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to attach collateral');
        }
    };

    const handleDetachCollateral = async (collateralId: string) => {
        if (!confirm('Are you sure you want to detach this collateral?')) return;
        try {
            const newCollaterals = (application?.collaterals || []).filter(id => id !== collateralId);
            await api.patch(`/loans/applications/${params.id}/`, { collaterals: newCollaterals });
            fetchApplication();
            alert('Collateral detached successfully!');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to detach collateral');
        }
    };

    const handleRemoveGuarantor = async (guarantorId: string) => {
        if (!confirm('Are you sure you want to remove this guarantor?')) return;
        try {
            await api.delete(`/loans/guarantors/${guarantorId}/`);
            fetchApplication();
            alert('Guarantor removed successfully!');
        } catch (error: any) {
            alert(error.response?.data?.error || 'Failed to remove guarantor');
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="text-muted-foreground animate-pulse">Loading application details...</div>
            </div>
        );
    }

    if (!application) {
        return (
            <div className="flex h-[400px] items-center justify-center">
                <div className="text-red-400">Application not found</div>
            </div>
        );
    }

    const statusColors: any = {
        draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        submitted: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        under_review: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        offer_sent: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        offer_accepted: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
        rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
        disbursed: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        cancelled: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    };

    return (
        <div className="space-y-6 pb-20">
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
                                {application.application_number}
                            </h1>
                            <span className={`px-3 py-1 rounded-full text-xs font-bold border uppercase tracking-wider ${statusColors[application.status]}`}>
                                {application.status_display}
                            </span>
                        </div>
                        <p className="text-muted-foreground mt-1">Submitted on {application.submitted_at ? new Date(application.submitted_at).toLocaleDateString() : 'N/A'}</p>
                        {application.status === 'offer_sent' && application.offer_expires_at && (
                            <p className="text-xs text-orange-400 font-bold mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Offer expires on {new Date(application.offer_expires_at).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 relative">
                    {application.offer_letter_file && (
                        <button
                            onClick={() => handleDownload('offer')}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/10 text-emerald-400 border border-emerald-500/20 font-bold hover:bg-emerald-600/20 transition-all"
                        >
                            <Download className="h-4 w-4" />
                            Offer Letter
                        </button>
                    )}

                    <div className="relative">
                        <button
                            onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-white font-bold hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
                        >
                            Actions
                            <ChevronDown className={`h-4 w-4 transition-transform ${showActionsDropdown ? 'rotate-180' : ''}`} />
                        </button>

                        {showActionsDropdown && (
                            <>
                                <div
                                    className="fixed inset-0 z-10"
                                    onClick={() => setShowActionsDropdown(false)}
                                />
                                <div className="absolute right-0 mt-2 w-56 rounded-2xl glass border border-border shadow-2xl z-20 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    {application.status === 'draft' && (
                                        <button
                                            onClick={() => { handleAction('submit'); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors"
                                        >
                                            <Send className="h-4 w-4" />
                                            Submit For Review
                                        </button>
                                    )}

                                    {application.status === 'submitted' && (
                                        <button
                                            onClick={() => { handleAction('start_review'); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-orange-400 hover:bg-orange-500/10 transition-colors"
                                        >
                                            <Eye className="h-4 w-4" />
                                            Start Review
                                        </button>
                                    )}

                                    {(application.status === 'under_review' || application.status === 'approved' || application.status === 'offer_sent') && (
                                        <button
                                            onClick={() => { setShowApprovalModal(true); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            {application.status === 'approved' || application.status === 'offer_sent' ? 'Revise Terms' : 'Approve Application'}
                                        </button>
                                    )}

                                    {application.status === 'under_review' && (
                                        <button
                                            onClick={() => setShowActionsDropdown(false)}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Reject Application
                                        </button>
                                    )}

                                    {(application.status === 'approved' || application.status === 'offer_sent') && (
                                        <button
                                            onClick={() => { handleAction('send_offer'); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-indigo-400 hover:bg-indigo-500/10 transition-colors"
                                        >
                                            <Stamp className="h-4 w-4" />
                                            {application.status === 'offer_sent' ? 'Regenerate Offer' : 'Send Offer Letter'}
                                        </button>
                                    )}

                                    {application.status === 'offer_sent' && (
                                        <button
                                            onClick={() => { handleUploadOffer(); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-teal-400 hover:bg-teal-500/10 transition-colors"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Upload Signed Offer
                                        </button>
                                    )}

                                    {application.status === 'offer_accepted' && (
                                        <button
                                            onClick={() => { handleUploadDisbursement(); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-pink-400 hover:bg-pink-500/10 transition-colors"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Upload Signed Checklist
                                        </button>
                                    )}

                                    {application.status === 'offer_accepted' && (
                                        <button
                                            onClick={() => { setShowDisbursementModal(true); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-primary hover:bg-primary/10 transition-colors"
                                        >
                                            <DollarSign className="h-4 w-4" />
                                            Disburse Funds
                                        </button>
                                    )}

                                    {application.status !== 'disbursed' && application.status !== 'cancelled' && (
                                        <button
                                            onClick={() => { handleAction('cancel'); setShowActionsDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-slate-400 hover:bg-slate-500/10 transition-colors border-t border-border mt-2"
                                        >
                                            <XCircle className="h-4 w-4" />
                                            Cancel Application
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Application Details */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Customer & Product Summary */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass rounded-2xl p-6 border border-border">
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <User className="h-4 w-4 text-primary" />
                                Borrower
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-lg font-bold text-foreground cursor-pointer hover:text-primary transition-colors" onClick={() => router.push(`/borrowers/${application.borrower_details.id}`)}>
                                        {application.borrower_details.name}
                                    </p>
                                    <p className="text-sm text-muted-foreground">{application.borrower_details.borrower_number}</p>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">Phone</p>
                                        <p className="text-sm text-foreground">{application.borrower_details.phone_number}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold">ID / Tax ID</p>
                                        <p className="text-sm text-foreground">{application.borrower_details.id_number || application.borrower_details.tax_id}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="glass rounded-2xl p-6 border border-border">
                            <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-primary" />
                                Loan Product
                            </h3>
                            <div className="space-y-3">
                                <div>
                                    <p className="text-lg font-bold text-foreground">{application.product_details.name}</p>
                                    <p className="text-sm text-muted-foreground">{application.product_details.code}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Template Rate</p>
                                    <p className="text-sm text-foreground">
                                        {application.product_details.suggested_interest_rate || 'Flexible'}%
                                        {application.product_details.suggested_interest_period === 'per_month' ? ' pm' :
                                            application.product_details.suggested_interest_period === 'per_day' ? ' pd' : ' p.a.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Request Details */}
                    <div className="glass rounded-2xl p-6 border border-border">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" />
                            Application Request
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Requested Amount</p>
                                <p className="text-2xl font-bold text-foreground">KES {Number(application.requested_amount).toLocaleString()}</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Requested Term</p>
                                <p className="text-2xl font-bold text-foreground">{application.requested_term} Months</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-xs text-muted-foreground">Purpose</p>
                                <p className="text-sm text-foreground italic">"{application.purpose}"</p>
                            </div>
                        </div>

                        {/* Approved Terms (if approved) */}
                        {application.status === 'approved' || application.status === 'disbursed' ? (
                            <div className="pt-6 border-t border-border mt-6">
                                <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Approved Terms</h4>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase">Amount</p>
                                        <p className="text-lg font-bold text-foreground">KES {Number(application.approved_amount).toLocaleString()}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase">Rate</p>
                                        <p className="text-lg font-bold text-foreground">
                                            {application.approved_interest_rate}%
                                            {application.approved_interest_period === 'per_month' ? ' pm' :
                                                application.approved_interest_period === 'per_day' ? ' pd' : ' p.a.'}
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase">Term</p>
                                        <p className="text-lg font-bold text-foreground">{application.approved_term} Months</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-[10px] text-muted-foreground uppercase">Fee</p>
                                        <p className="text-lg font-bold text-foreground">KES {Number(application.processing_fee).toLocaleString()}</p>
                                    </div>
                                </div>
                            </div>
                        ) : null}

                        {/* Refinancing Details */}
                        {application.refinances_loan_details && (
                            <div className="pt-6 border-t border-border mt-6">
                                <h4 className="text-xs font-bold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <RefreshCw className="h-3.5 w-3.5" /> Refinancing / Buyoff
                                </h4>
                                <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Refinancing Loan</p>
                                            <p className="text-sm font-bold text-foreground cursor-pointer hover:text-primary" onClick={() => router.push(`/loans/${application.refinances_loan}`)}>
                                                {application.refinances_loan_details.loan_number}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Outstanding Balance</p>
                                            <p className="text-sm font-bold text-orange-400">KES {Number(application.refinances_loan_details.outstanding_balance).toLocaleString()}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[10px] text-muted-foreground uppercase font-bold">Net Disbursement</p>
                                            <p className="text-sm font-bold text-emerald-400">
                                                KES {application.net_disbursement ? Number(application.net_disbursement).toLocaleString() :
                                                    (Number(application.approved_amount || application.requested_amount) - Number(application.refinances_loan_details.outstanding_balance)).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-3 italic">
                                        * This application will automatically close {application.refinances_loan_details.loan_number} upon disbursement.
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Collateral & Guarantors */}
                        <div className="pt-6 border-t border-border mt-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Collateral */}
                                <div>
                                    <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center justify-between">
                                        Collateral
                                        {application.product_details.requires_collateral && (!application.collateral_items || application.collateral_items.length === 0) && (
                                            <span className="text-[10px] text-red-400 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Required
                                            </span>
                                        )}
                                    </h4>
                                    <div className="space-y-3">
                                        {application.collateral_items?.map((c: any) => (
                                            <div key={c.id} className="p-4 rounded-xl bg-muted/20 border border-border group relative">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="font-bold text-sm text-foreground capitalize">{c.collateral_type?.replace('_', ' ') || 'Other'}</p>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setShowCollateralModal(true)} className="text-[10px] text-primary hover:underline font-bold">Change</button>
                                                        <button onClick={() => handleDetachCollateral(c.id)} className="text-[10px] text-red-500 hover:underline font-bold">Detach</button>
                                                    </div>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{c.reg_number || c.lr_number || 'No Registration #'}</p>
                                                <div className="mt-3 flex justify-between items-end">
                                                    <span className="text-xs font-bold text-foreground">
                                                        KES {c.market_value ? Number(c.market_value).toLocaleString() : '0'}
                                                    </span>
                                                    <button onClick={() => router.push(`/collateral/${c.id}`)} className="text-[10px] text-muted-foreground hover:text-primary transition-colors">Details →</button>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            className="w-full py-3 border border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2"
                                            onClick={() => setShowCollateralModal(true)}
                                        >
                                            <Shield className="h-4 w-4" />
                                            + Attach Asset
                                        </button>
                                    </div>
                                </div>

                                {/* Guarantors */}
                                <div>
                                    <h4 className="text-sm font-bold text-foreground uppercase tracking-widest mb-4 flex items-center justify-between">
                                        Guarantors
                                        {application.product_details.requires_guarantor && application.guarantors.length === 0 && (
                                            <span className="text-[10px] text-red-500 flex items-center gap-1">
                                                <AlertCircle className="h-3 w-3" /> Required
                                            </span>
                                        )}
                                    </h4>
                                    <div className="space-y-3">
                                        {application.guarantors.map((g: any) => (
                                            <div key={g.id} className="p-3 rounded-xl bg-muted/20 border border-border group relative">
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <p className="font-bold text-xs text-foreground">{g.name}</p>
                                                            {g.borrower_details && (
                                                                <span
                                                                    className="text-[8px] font-black bg-emerald-500/10 text-emerald-500 px-1.5 py-0.5 rounded uppercase tracking-tighter cursor-pointer hover:bg-emerald-500/20 transition-colors"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        router.push(`/customers/${g.borrower_details.id}`);
                                                                    }}
                                                                >
                                                                    Linked: {g.borrower_details.borrower_number}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-[10px] text-muted-foreground">{g.relationship} • {g.phone_number}</p>
                                                        <p className="text-[10px] text-muted-foreground mt-1">ID: {g.id_number}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs font-bold text-primary">KES {parseFloat(g.amount_guaranteed).toLocaleString()}</p>
                                                        <button
                                                            onClick={() => handleRemoveGuarantor(g.id)}
                                                            className="text-[10px] text-red-500 opacity-0 group-hover:opacity-100 transition-opacity font-bold mt-2"
                                                        >
                                                            Remove
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        <button
                                            onClick={() => setShowGuarantorModal(true)}
                                            className="w-full py-3 border border-dashed border-border rounded-xl text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/50 transition-all flex items-center justify-center gap-2"
                                        >
                                            + Add Guarantor
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Risk & Documents */}
                <div className="space-y-6">
                    {/* Documents Card */}
                    {(application.offer_letter_file || application.disbursement_letter_file ||
                        application.signed_offer_letter || application.signed_disbursement_letter ||
                        application.status?.toLowerCase() === 'offer_accepted' ||
                        application.status?.toLowerCase() === 'offer_sent') && (
                            <div className="glass rounded-2xl p-6 border border-border">
                                <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-primary" />
                                    Documents
                                </h3>
                                <div className="space-y-3">
                                    {application.offer_letter_file && (
                                        <button
                                            onClick={() => handleDownload('offer')}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-indigo-400" />
                                                <span className="text-xs font-semibold">Offer Letter</span>
                                            </div>
                                            <Calendar className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    )}
                                    {(application.disbursement_letter_file || application.status === 'offer_accepted') && (
                                        <button
                                            onClick={() => handleDownload('advice')}
                                            className="w-full flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border hover:bg-muted/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-emerald-400" />
                                                <span className="text-xs font-semibold">
                                                    Disbursement Checklist
                                                </span>
                                            </div>
                                            <CheckCircle2 className="h-3 w-3 text-muted-foreground" />
                                        </button>
                                    )}
                                    {application.signed_offer_letter && (
                                        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-indigo-400" />
                                                <span className="text-xs font-semibold">Signed Offer Letter</span>
                                            </div>
                                            <a
                                                href={application.signed_offer_letter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 hover:bg-indigo-500/10 rounded transition-colors"
                                            >
                                                <Download className="h-3 w-3 text-indigo-400" />
                                            </a>
                                        </div>
                                    )}
                                    {application.signed_disbursement_letter && (
                                        <div className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10">
                                            <div className="flex items-center gap-3">
                                                <FileText className="h-4 w-4 text-emerald-400" />
                                                <span className="text-xs font-semibold">Signed Checklist</span>
                                            </div>
                                            <a
                                                href={application.signed_disbursement_letter}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="p-1 hover:bg-emerald-500/10 rounded transition-colors"
                                            >
                                                <Download className="h-3 w-3 text-emerald-400" />
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                    {/* Repayment Schedule */}
                    <RepaymentScheduleEditor
                        applicationId={application.id}
                        approvedAmount={Number(application.approved_amount)}
                        approvedTerm={application.approved_term || application.requested_term}
                        frequency={application.approved_interest_period || application.product_details.suggested_interest_period}
                        isEditable={['approved', 'offer_sent', 'offer_accepted'].includes(application.status)}
                    />

                    {/* Risk Scoring */}
                    <div className="glass rounded-2xl p-6 border border-border overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Shield className="h-12 w-12" />
                        </div>
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Risk Profile</h3>
                        <div className="space-y-6">
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Credit Score</p>
                                    <p className="text-3xl font-bold text-primary">{application.borrower_details.hybrid_score || application.borrower_details.internal_score || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Category</p>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${application.risk_category === 'low' ? 'bg-emerald-500/10 text-emerald-400' :
                                        application.risk_category === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                                            'bg-red-500/10 text-red-400'
                                        }`}>
                                        {application.risk_category || 'TBD'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                                    <span>Score Strength</span>
                                    <span>{application.borrower_details.hybrid_score ? 'High' : 'Moderate'}</span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary transition-all"
                                        style={{ width: `${(Number(application.borrower_details.hybrid_score || application.borrower_details.internal_score || 0) / 900) * 100}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Timeline */}
                    <div className="glass rounded-2xl p-6 border border-border">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4">Lifecycle</h3>
                        <div className="space-y-4">
                            <div className="flex gap-3">
                                <div className="mt-1">
                                    <div className="h-2 w-2 rounded-full bg-primary" />
                                    <div className="w-0.5 h-10 bg-border mx-auto" />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-foreground">Created</p>
                                    <p className="text-[10px] text-muted-foreground">{new Date(application.created_at).toLocaleString()}</p>
                                </div>
                            </div>
                            {application.submitted_at && (
                                <div className="flex gap-3">
                                    <div className="mt-1">
                                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                                        {application.approved_at && <div className="w-0.5 h-10 bg-border mx-auto" />}
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground">Submitted for Review</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(application.submitted_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                            {application.approved_at && (
                                <div className="flex gap-3">
                                    <div className="mt-1">
                                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold text-foreground">Approved</p>
                                        <p className="text-[10px] text-muted-foreground">{new Date(application.approved_at).toLocaleString()}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <ApplicationApprovalModal
                isOpen={showApprovalModal}
                onClose={() => setShowApprovalModal(false)}
                onSuccess={() => {
                    fetchApplication();
                    setShowApprovalModal(false);
                }}
                application={{
                    ...application,
                    customer: application.borrower_details,
                    product: application.product_details
                }}
            />

            <CollateralSelectModal
                isOpen={showCollateralModal}
                onClose={() => setShowCollateralModal(false)}
                borrowerId={application.borrower_details.id}
                onSelect={handleSelectCollateral}
                onAddNew={() => router.push(`/collateral/new?application=${application.id}&borrower=${application.borrower_details.id}`)}
                refinanceLoanId={application.refinances_loan}
            />

            <GuarantorEntryModal
                isOpen={showGuarantorModal}
                onClose={() => setShowGuarantorModal(false)}
                applicationId={application.id}
                onSuccess={fetchApplication}
            />

            <DisbursementModal
                isOpen={showDisbursementModal}
                onClose={() => setShowDisbursementModal(false)}
                applicationId={application.id}
                approvedAmount={Number(application.approved_amount)}
                repaymentChannel={application.repayment_channel || 'mpesa'}
                payoffAmount={Number(application.payoff_amount || 0)}
                netDisbursement={Number(application.net_disbursement || 0) || undefined}
                onSuccess={fetchApplication}
            />

            {/* Send Offer Letter Confirmation Dialog */}
            {showOfferDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-500/10 rounded-xl">
                                <FileText className="h-5 w-5 text-indigo-400" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">
                                    {application.status === 'offer_sent' ? 'Regenerate Offer Letter' : 'Generate Offer Letter'}
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    This will generate the official offer letter PDF
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="p-4 rounded-xl bg-muted/30 border border-border">
                                <p className="text-sm text-foreground mb-1">
                                    <span className="font-bold">Borrower:</span> {application.borrower_details.name}
                                </p>
                                <p className="text-sm text-foreground mb-1">
                                    <span className="font-bold">Amount:</span> KES {Number(application.approved_amount || application.requested_amount).toLocaleString()}
                                </p>
                                {application.borrower_details.email && (
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-bold">Email:</span> {application.borrower_details.email}
                                    </p>
                                )}
                            </div>

                            {application.borrower_details.email && (
                                <label className="flex items-start gap-3 p-4 rounded-xl border border-border hover:bg-muted/20 transition-colors cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        checked={sendToBorrower}
                                        onChange={(e) => setSendToBorrower(e.target.checked)}
                                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary/20"
                                    />
                                    <div>
                                        <p className="text-sm font-bold text-foreground flex items-center gap-2">
                                            <Send className="h-3.5 w-3.5 text-primary" />
                                            Email offer letter to borrower
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            The offer letter will be sent to {application.borrower_details.email}
                                        </p>
                                    </div>
                                </label>
                            )}

                            {!application.borrower_details.email && (
                                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <p className="text-xs text-amber-500 flex items-center gap-2">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Borrower does not have an email address on file. The offer letter will not be emailed.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setShowOfferDialog(false); setSendToBorrower(false); }}
                                className="px-4 py-2 text-sm font-medium rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                                disabled={isSendingOffer}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendOffer}
                                disabled={isSendingOffer}
                                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-lg shadow-indigo-600/20"
                            >
                                {isSendingOffer ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <Stamp className="h-4 w-4" />
                                        Generate {sendToBorrower ? '& Send' : 'Offer'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
