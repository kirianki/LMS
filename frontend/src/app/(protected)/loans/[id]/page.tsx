'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
    ArrowLeft, Wallet, Calendar, TrendingUp, AlertCircle,
    User, FileText, Shield, ShieldCheck, DollarSign, Clock, CheckCircle2,
    CreditCard, RefreshCw, MessageSquare, Edit3, Save, X, Upload, Send
} from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import MpesaPaymentButton from '@/components/loans/MpesaPaymentButton';
import LoanDocumentUploadModal from '@/components/loans/LoanDocumentUploadModal';
import RecordPaymentModal from '@/components/loans/RecordPaymentModal';
import LoanCommentsSection from '@/components/loans/LoanCommentsSection';
import RestructureLoanModal from '@/components/loans/RestructureLoanModal';
import EditPaymentModal from '@/components/loans/EditPaymentModal';

interface LoanDocument {
    id: string;
    document_name: string;
    file: string;
    description: string;
    uploaded_at: string;
    uploaded_by_name: string;
}

interface Loan {
    id: string;
    loan_number: string;
    borrower_name: string;
    borrower_details?: {
        id: string;
        name: string;
        phone_number: string;
        email: string;
        borrower_number: string;
    };
    status: string;
    status_display: string;
    days_in_arrears: number;
    arrears_category_display?: string;
    principal_amount: number;
    total_interest: number;
    total_fees?: number;
    outstanding_balance: number;
    outstanding_principal: number;
    outstanding_interest: number;
    outstanding_penalties: number;
    disbursement_date: string;
    disbursement_method?: string;
    disbursement_reference?: string;
    disbursement_status?: string;
    disbursed_amount?: number;
    maturity_date: string;
    term: number;
    repayment_frequency: string;
    repayment_channel: string;
    product_name?: string;
    product_details?: {
        name: string;
        code: string;
        interest_type: string;
        term_unit: string;
    };
    collateral_details?: {
        id: string;
        asset_type: string;
        description: string;
        estimated_value: number;
    };
    collateral_items?: any[];
    ltv_ratio?: number;
    interest_rate: number;
    interest_method?: string;
    interest_method_display?: string;
    interest_period?: string;
    interest_period_display?: string;
    penalty_type?: string;
    penalty_value?: number;
    penalty_grace_period?: number;
    application_details?: {
        purpose: string;
        application_number: string;
        processing_fee: number;
        insurance_fee: number;
        legal_fee: number;
        offer_letter_file: string | null;
        signed_offer_letter: string | null;
        disbursement_letter_file: string | null;
        signed_disbursement_letter: string | null;
    };
    is_refinanced?: boolean;
    refinanced_at?: string;
    refinanced_by_loan?: {
        id: string;
        loan_number: string;
    } | null;
    refinances_loan_details?: {
        id: string;
        loan_number: string;
    } | null;
    fees?: any[];
}

interface Installment {
    id: string;
    installment_number: number;
    due_date: string;
    principal_due: number;
    interest_due: number;
    fees_due: number;
    total_due: number;
    status: string;
    status_display: string;
}

interface Repayment {
    id: string;
    payment_date: string;
    payment_method: string;
    reference_number: string;
    amount: number;
    principal_paid: number;
    interest_paid: number;
    penalty_paid: number;
    received_by_name: string;
    notes?: string;
    cash_account_id?: string;
}

interface LogEntry {
    id: string;
    action: string;
    description: string;
    timestamp: string;
    user_name: string;
    module: string;
}

export default function LoanDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [schedule, setSchedule] = useState<Installment[]>([]);
    const [repayments, setRepayments] = useState<Repayment[]>([]);
    const [historyLogs, setHistoryLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('schedule');
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [selectedInstallment, setSelectedInstallment] = useState<any>(null);
    const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
    const [loanDocuments, setLoanDocuments] = useState<LoanDocument[]>([]);
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showStatementDialog, setShowStatementDialog] = useState(false);
    const [sendToBorrower, setSendToBorrower] = useState(false);
    const [showRestructureModal, setShowRestructureModal] = useState(false);
    const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
    const [selectedPayment, setSelectedPayment] = useState<Repayment | null>(null);

    const { user } = useAuthStore();
    const [isEditingSchedule, setIsEditingSchedule] = useState(false);
    const [editedSchedule, setEditedSchedule] = useState<Installment[]>([]);
    const [isSavingSchedule, setIsSavingSchedule] = useState(false);
    const canEditSchedule = !!user; // Any authenticated staff may correct payments; backend enforces tenant isolation
    const canRestructure = user?.is_superuser || (user?.role && ['Admin', 'Company Administrator', 'System Administrator', 'Branch Manager', 'Loan Officer'].includes(user.role.name)) || user?.permissions?.includes('loans.change_loan');


    useEffect(() => {
        if (params.id) {
            fetchLoanDetails();
        }
    }, [params.id]);

    const fetchLoanDetails = async () => {
        setIsLoading(true);
        try {
            const [loanRes, scheduleRes, paymentsRes, historyRes] = await Promise.all([
                api.get(`/loans/${params.id}/`),
                api.get(`/loans/${params.id}/schedule/`),
                api.get(`/loans/${params.id}/repayments/`),
                api.get(`/loans/${params.id}/history/`)
            ]);

            setLoan(loanRes.data);
            setSchedule(Array.isArray(scheduleRes.data) ? scheduleRes.data : []);
            setRepayments(Array.isArray(paymentsRes.data.results) ? paymentsRes.data.results : (Array.isArray(paymentsRes.data) ? paymentsRes.data : []));
            setHistoryLogs(Array.isArray(historyRes.data) ? historyRes.data : []);

            // Fetch documents using the loan ID
            const docsRes = await api.get(`/loans/documents/?loan=${params.id}`);
            setLoanDocuments(Array.isArray(docsRes.data.results) ? docsRes.data.results : (Array.isArray(docsRes.data) ? docsRes.data : []));
        } catch (error) {
            console.error('Failed to fetch loan details:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleEditSchedule = () => {
        setEditedSchedule(schedule.map(item => ({ ...item })));
        setIsEditingSchedule(true);
    };

    const handleCancelEdit = () => {
        setIsEditingSchedule(false);
        setEditedSchedule([]);
    };

    const handleDateChange = (index: number, newDate: string) => {
        const newSchedule = [...editedSchedule];
        newSchedule[index].due_date = newDate;
        setEditedSchedule(newSchedule);
    };

    const handleSaveSchedule = async () => {
        setIsSavingSchedule(true);
        try {
            await api.post(`/loans/${params.id}/update_schedule/`, {
                schedule: editedSchedule.map((item: any) => ({
                    id: item.id,
                    due_date: item.due_date
                }))
            });
            await fetchLoanDetails();
            setIsEditingSchedule(false);
            setEditedSchedule([]);
        } catch (error) {
            console.error('Failed to update schedule:', error);
            alert('Failed to update schedule dates. Please check permissions and input.');
        } finally {
            setIsSavingSchedule(false);
        }
    };

    const generateStatement = async () => {
        setIsGeneratingStatement(true);
        try {
            // First, trigger the backend logic (optionally sends email)
            const res = await api.post(`/loans/${params.id}/statement/`, {
                send_to_borrower: sendToBorrower
            });

            // Then, trigger the browser download as before
            const response = await api.get(`/loans/${params.id}/statement/`, {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `statement_${loan?.loan_number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setShowStatementDialog(false);
            if (sendToBorrower) {
                alert('Statement generated and emailed to borrower!');
            }
        } catch (error) {
            console.error('Failed to generate statement:', error);
            alert('Failed to generate statement. Please try again.');
        } finally {
            setIsGeneratingStatement(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                    <p className="text-muted-foreground animate-pulse">Loading loan dossier...</p>
                </div>
            </div>
        );
    }

    if (!loan) {
        return (
            <div className="text-center py-20 bg-muted/20 rounded-3xl border border-dashed border-border mx-auto max-w-lg mt-10">
                <AlertCircle className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <h2 className="text-xl font-bold">Loan Dossier Not Found</h2>
                <p className="text-muted-foreground mt-2 px-6">We couldn&apos;t locate this loan in our central registry. It may have been moved or deleted.</p>
                <button onClick={() => router.back()} className="mt-6 px-6 py-2 bg-primary text-white rounded-xl">Go Back</button>
            </div>
        );
    }

    const progressPercentage = ((Number(loan.principal_amount) - Number(loan.outstanding_principal)) / Number(loan.principal_amount)) * 100;

    return (
        <div className="max-w-[1400px] mx-auto space-y-8 pb-12 px-4 transition-all duration-500">
            {/* Navigation & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <button
                    onClick={() => router.back()}
                    className="group flex items-center gap-2 text-muted-foreground hover:text-foreground transition-all px-3 py-2 rounded-xl hover:bg-muted"
                >
                    <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-semibold">Registry Dashboard</span>
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowStatementDialog(true)}
                        disabled={isGeneratingStatement}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-muted/50 border border-border text-foreground text-sm font-bold hover:bg-muted transition-all disabled:opacity-50"
                    >
                        {isGeneratingStatement ? 'Generating...' : <><FileText className="h-4 w-4" /> Statement</>}
                    </button>
                    {canRestructure && (loan.status === 'active' || loan.status === 'overdue' || loan.status === 'defaulted') && (
                        <button
                            onClick={() => setShowRestructureModal(true)}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500/10 text-orange-600 border border-orange-500/20 text-sm font-bold hover:bg-orange-500/20 transition-all dark:bg-orange-500/20 dark:text-orange-400"
                        >
                            <RefreshCw className="h-4 w-4" /> Restructure
                        </button>
                    )}
                    <div className="flex items-center gap-2">
                        <MpesaPaymentButton loan={loan} onSuccess={fetchLoanDetails} />
                        <button
                            onClick={() => {
                                setSelectedInstallment(null);
                                setShowPaymentModal(true);
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                        >
                            <DollarSign className="h-4 w-4" /> Record Payment
                        </button>
                    </div>
                </div>
            </div>

            {/* Header / Hero Section */}
            <div className="relative overflow-hidden rounded-[2.5rem] bg-white text-slate-900 dark:bg-slate-900 dark:text-white p-8 sm:p-12 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none transition-all duration-300">
                {/* Background Patterns */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 dark:bg-primary/20 rounded-full blur-[100px] -mr-48 -mt-48" />
                <div className="absolute bottom-0 left-0 w-72 h-72 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[80px] -ml-36 -mb-36" />

                <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                    <div className="space-y-6">
                        <div className="space-y-2">
                            <div className="flex items-center gap-3">
                                <div className="px-3 py-1 bg-slate-100 dark:bg-white/10 backdrop-blur-md rounded-full border border-slate-200 dark:border-white/20 text-[10px] font-black uppercase tracking-[0.2em] text-slate-600 dark:text-white/70">
                                    {loan.product_name || 'LOAN FACILITY'}
                                </div>
                                {loan.is_refinanced && (
                                    <div className="px-3 py-1 bg-orange-500/10 text-orange-600 border border-orange-500/20 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em]">
                                        Refinanced
                                    </div>
                                )}
                                <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border ${loan.status === 'active' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30' :
                                    loan.status === 'paid_off' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30' :
                                        'bg-rose-500/10 text-rose-600 border-rose-500/20 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                                    }`}>
                                    {loan.status_display || loan.status?.replace('_', ' ')}
                                </div>
                            </div>
                            <h1 className="text-4xl sm:text-5xl font-black font-heading tracking-tight text-slate-900 dark:text-white">
                                {loan.loan_number}
                            </h1>
                            <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-slate-600 dark:text-slate-400">
                                <button
                                    onClick={() => router.push(`/borrowers/${loan.borrower_details?.id}`)}
                                    className="group/borrower flex items-center gap-2 hover:text-primary transition-colors text-xl font-medium"
                                >
                                    <User className="h-5 w-5 text-primary group-hover/borrower:scale-110 transition-transform" />
                                    {loan.borrower_name}
                                </button>
                                <div className="hidden sm:block h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700" />
                                <div className="flex items-center gap-2 text-sm font-bold">
                                    <Clock className="h-4 w-4 text-slate-400" />
                                    {loan.borrower_details?.phone_number || 'No Phone'}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 pt-4">
                            <div className="space-y-1">
                                <p className="text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Facility Limit</p>
                                <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">KES</span>
                                    {Number(loan.principal_amount).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Live Balance</p>
                                <p className="text-2xl font-bold tracking-tight text-primary">
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500 mr-1">KES</span>
                                    {Number(loan.outstanding_balance).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1 hidden sm:block">
                                <p className="text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase tracking-widest">Arrears Age</p>
                                <p className={`text-2xl font-bold tracking-tight ${loan.days_in_arrears > 0 ? 'text-rose-500 dark:text-rose-400' : 'text-slate-400 dark:text-slate-300'}`}>
                                    {loan.days_in_arrears} <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Days</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Chart Visualization */}
                    <div className="lg:pl-12">
                        <div className="bg-white dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200 dark:border-white/5 space-y-4 shadow-sm dark:shadow-none">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">Repayment Progress</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white">{progressPercentage.toFixed(1)}%</p>
                                </div>
                                <TrendingUp className="h-8 w-8 text-primary/50" />
                            </div>
                            <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-300/30 dark:border-white/5">
                                <div
                                    className="h-full bg-gradient-to-r from-primary via-blue-400 to-primary rounded-full shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(59,130,246,0.5)] transition-all duration-1000 ease-out"
                                    style={{ width: `${progressPercentage}%` }}
                                />
                            </div>
                            <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                <span>Recovered: KES {(Number(loan.principal_amount) - Number(loan.outstanding_principal)).toLocaleString()}</span>
                                <span>Principal Goal: KES {Number(loan.principal_amount).toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Tabs Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                {/* Lateral Summary (4 cols) */}
                <div className="xl:col-span-4 space-y-6">
                    {/* Financial DNA */}
                    <div className="glass rounded-[2rem] p-8 border border-border shadow-sm space-y-6 hover:shadow-md transition-all">
                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Financial Snapshot
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/20 transition-all">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">Unpaid Principal</p>
                                    <p className="font-black text-foreground">KES {Number(loan.outstanding_principal).toLocaleString()}</p>
                                </div>
                                <Shield className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-muted/30 border border-border/50 group hover:border-primary/20 transition-all">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">Unpaid Interest</p>
                                    <p className="font-black text-foreground">KES {Number(loan.outstanding_interest).toLocaleString()}</p>
                                </div>
                                <Clock className="h-5 w-5 text-muted-foreground/30 group-hover:text-primary/50 transition-colors" />
                            </div>
                            <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-500/5 border border-rose-500/20 group hover:border-rose-500/40 transition-all">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-widest font-black">Penalties Due</p>
                                    <p className="font-black text-rose-700 dark:text-rose-400">KES {Number(loan.outstanding_penalties || 0).toLocaleString()}</p>
                                </div>
                                <AlertCircle className="h-5 w-5 text-rose-500/30 group-hover:text-rose-500 transition-colors" />
                            </div>
                            <div className="pt-2">
                                <div className="flex items-center justify-between px-2 mb-2">
                                    <span className="text-[10px] font-black text-muted-foreground uppercase">Revenue Distribution</span>
                                </div>
                                <div className="flex h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                    <div
                                        className="h-full bg-indigo-500"
                                        style={{ width: `${(Number(loan.principal_amount) / (Number(loan.principal_amount) + Number(loan.total_interest))) * 100}%` }}
                                        title="Principal"
                                    />
                                    <div
                                        className="h-full bg-emerald-500"
                                        style={{ width: `${(Number(loan.total_interest) / (Number(loan.principal_amount) + Number(loan.total_interest))) * 100}%` }}
                                        title="Interest"
                                    />
                                </div>
                                <div className="flex justify-between mt-2 px-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Principal</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="text-[8px] font-bold text-muted-foreground uppercase">Interest</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Meta Info */}
                    <div className="glass rounded-[2rem] p-8 border border-border shadow-sm space-y-6 h-fit">
                        <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">Registry Metadata</h3>
                        <div className="space-y-5">
                            <div className="flex gap-4">
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                    <Calendar className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-foreground uppercase tracking-widest">Origination</p>
                                    <p className="text-sm font-bold text-foreground">
                                        {new Date(loan.disbursement_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-4">
                                <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                    <Clock className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-foreground uppercase tracking-widest">Expiry / Maturity</p>
                                    <p className="text-sm font-bold text-foreground">
                                        {new Date(loan.maturity_date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            {(loan.collateral_details || (loan.collateral_items && loan.collateral_items.length > 0)) && (
                                <div className="flex flex-col gap-4">
                                    <div className="flex gap-4">
                                        <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/5 flex items-center justify-center border border-primary/10">
                                            <Shield className="h-5 w-5 text-primary" />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-foreground uppercase tracking-widest">Security / Collateral</p>
                                            {loan.collateral_items && loan.collateral_items.length > 0 ? (
                                                <div className="space-y-1">
                                                    {loan.collateral_items.map((coll, idx) => (
                                                        <p
                                                            key={coll.id || idx}
                                                            onClick={() => coll.id && router.push(`/collateral/${coll.id}`)}
                                                            className="text-sm font-bold text-foreground cursor-pointer hover:text-primary transition-colors"
                                                        >
                                                            {coll.collateral_type?.replace('_', ' ').toUpperCase()} - {coll.reg_number || coll.lr_number || coll.description}
                                                        </p>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-sm font-bold text-foreground">{loan.collateral_details?.asset_type}</p>
                                            )}
                                            <div className="mt-1 flex items-center gap-1.5">
                                                <div className="h-1 text-xs px-1.5 py-0.5 rounded-full bg-primary/10 text-[8px] text-primary font-black uppercase">LTV: {loan.ltv_ratio}%</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Refinancing Links */}
                    {(loan.is_refinanced || loan.refinances_loan_details) && (
                        <div className="glass rounded-[2rem] p-8 border border-border shadow-sm space-y-6">
                            <h3 className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <RefreshCw className="h-4 w-4 text-primary" /> Refinancing Linkages
                            </h3>
                            <div className="space-y-4">
                                {loan.is_refinanced && loan.refinanced_by_loan && (
                                    <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20">
                                        <p className="text-[10px] font-black text-orange-600/70 uppercase tracking-widest mb-1">Paid Off By New Loan</p>
                                        <button
                                            onClick={() => router.push(`/loans/${loan.refinanced_by_loan?.id}`)}
                                            className="text-sm font-bold text-foreground hover:text-primary flex items-center gap-2 text-left"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            {loan.refinanced_by_loan.loan_number}
                                        </button>
                                        <p className="text-[10px] text-muted-foreground mt-2">Closed on {loan.refinanced_at ? new Date(loan.refinanced_at).toLocaleDateString() : 'Refinancing'}</p>
                                    </div>
                                )}
                                {loan.refinances_loan_details && (
                                    <div className="p-4 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                                        <p className="text-[10px] font-black text-emerald-600/70 uppercase tracking-widest mb-1">Refinanced Previous Loan</p>
                                        <button
                                            onClick={() => router.push(`/loans/${loan.refinances_loan_details?.id}`)}
                                            className="text-sm font-bold text-foreground hover:text-primary flex items-center gap-2 text-left"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            {loan.refinances_loan_details.loan_number}
                                        </button>
                                        <p className="text-[10px] text-muted-foreground mt-2">Balance was consolidated into this facility.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Tabs Area (8 cols) */}
                <div className="xl:col-span-8 flex flex-col space-y-6">
                    <div className="glass rounded-[2rem] border border-border shadow-sm h-full flex flex-col overflow-hidden">
                        {/* Tab Headers */}
                        <div className="flex p-2 bg-muted/30 border-b border-border overflow-x-auto no-scrollbar scroll-smooth">
                            {[
                                { id: 'schedule', label: 'Repayment Schedule', icon: Calendar },
                                { id: 'payments', label: 'Payment History', icon: DollarSign },
                                { id: 'config', label: 'Configuration', icon: Shield },
                                { id: 'disbursement', label: 'Disbursement', icon: Wallet },
                                { id: 'supporting_docs', label: 'Docs', icon: FileText },
                                { id: 'collateral', label: 'Collateral', icon: Shield },
                                { id: 'history', label: 'Audit Trail', icon: FileText },
                                { id: 'comments', label: 'Comments', icon: MessageSquare },
                            ].map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-shrink-0 flex items-center justify-center gap-2 px-6 py-3.5 rounded-2xl text-[10px] font-bold transition-all ${activeTab === tab.id
                                        ? 'bg-background shadow-lg shadow-black/[0.03] text-primary border border-border'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-white/50'
                                        }`}
                                >
                                    <tab.icon className={`h-3 w-3 ${activeTab === tab.id ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <span className="uppercase tracking-widest whitespace-nowrap">{tab.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Tab Content */}
                        <div className="p-8 flex-1">
                            {activeTab === 'schedule' && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-sm font-black text-muted-foreground uppercase tracking-wider">Repayment Installments</h4>
                                        {canEditSchedule && loan.status === 'active' && (
                                            <div className="flex items-center gap-2">
                                                {!isEditingSchedule ? (
                                                    <button
                                                        onClick={handleEditSchedule}
                                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all"
                                                    >
                                                        <Edit3 className="h-3.5 w-3.5" />
                                                        Edit Schedule
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-bold hover:bg-muted/80 transition-all"
                                                        >
                                                            <X className="h-3.5 w-3.5" />
                                                            Cancel
                                                        </button>
                                                        <button
                                                            onClick={handleSaveSchedule}
                                                            disabled={isSavingSchedule}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-all disabled:opacity-50"
                                                        >
                                                            {isSavingSchedule ? 'Saving...' : <><Save className="h-3.5 w-3.5" /> Save Changes</>}
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    {(isEditingSchedule ? editedSchedule : schedule).length > 0 ? (isEditingSchedule ? editedSchedule : schedule).map((installment, index) => (
                                        <div
                                            key={index}
                                            className="group relative flex items-center justify-between p-5 rounded-2xl bg-background border border-border hover:border-primary/20 hover:shadow-md transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className={`flex items-center justify-center w-12 h-12 rounded-xl text-lg font-black border transition-colors ${installment.status === 'paid' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                                                    installment.status === 'overdue' ? 'bg-rose-50 text-rose-600 border-rose-100' :
                                                        'bg-muted/50 text-muted-foreground border-border'
                                                    }`}>
                                                    {installment.installment_number}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-black text-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
                                                        <span>Due Date:</span>
                                                        {isEditingSchedule && installment.status !== 'paid' ? (
                                                            <input
                                                                type="date"
                                                                value={installment.due_date}
                                                                onChange={(e) => handleDateChange(index, e.target.value)}
                                                                className="bg-muted px-2 py-0.5 rounded border border-border focus:outline-none focus:ring-1 focus:ring-primary text-[10px] font-bold"
                                                            />
                                                        ) : (
                                                            <span className="text-foreground">
                                                                {new Date(installment.due_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <p className="text-sm font-bold text-foreground">
                                                            P: KES {Number(installment.principal_due).toLocaleString()}
                                                        </p>
                                                        <div className="h-1 w-1 rounded-full bg-border" />
                                                        <p className="text-sm font-bold text-foreground">
                                                            I: KES {Number(installment.interest_due).toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                <div className="text-right">
                                                    <p className="text-xl font-black text-foreground tabular-nums">
                                                        KES {Number(installment.total_due).toLocaleString()}
                                                    </p>
                                                    <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${installment.status === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                        installment.status === 'partial' ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' :
                                                            installment.status === 'overdue' ? 'bg-rose-500/10 text-rose-600 border-rose-500/20' :
                                                                'bg-muted text-muted-foreground border-border'
                                                        }`}>
                                                        {installment.status === 'paid' && <CheckCircle2 className="h-3 w-3" />}
                                                        {installment.status_display || installment.status}
                                                    </span>
                                                </div>
                                                {installment.status !== 'paid' && (
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <MpesaPaymentButton
                                                            loan={loan}
                                                            installment={installment}
                                                            onSuccess={fetchLoanDetails}
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                setSelectedInstallment(installment);
                                                                setShowPaymentModal(true);
                                                            }}
                                                            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-bold hover:bg-primary hover:text-white transition-all"
                                                        >
                                                            Record Manual
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-12 border-2 border-dashed border-border rounded-3xl">
                                            <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                            <p className="text-sm font-bold text-foreground">No schedule generated yet</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'payments' && (
                                <div className="space-y-4">
                                    {repayments.length > 0 ? repayments.map((payment, index) => (
                                        <div
                                            key={index}
                                            className="group relative flex items-center justify-between p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 hover:border-emerald-500/30 transition-all duration-300"
                                        >
                                            <div className="flex items-center gap-5">
                                                <div className="h-12 w-12 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-600 border border-emerald-500/20">
                                                    <CheckCircle2 className="h-6 w-6" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-black text-emerald-600/70 uppercase tracking-[0.15em] mb-1">
                                                        Successfully Recorded • {new Date(payment.payment_date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                                        <CreditCard className="h-3 w-3" /> {payment.payment_method} | <FileText className="h-3 w-3" /> {payment.reference_number || 'TRX-N/A'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-2xl font-black text-emerald-600 tabular-nums">
                                                        KES {Number(payment.amount).toLocaleString()}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-foreground mt-1 uppercase tracking-tighter">
                                                        By: {payment.received_by_name || 'System'}
                                                    </p>
                                                </div>
                                                {canEditSchedule && (
                                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => {
                                                                setSelectedPayment(payment);
                                                                setShowEditPaymentModal(true);
                                                            }}
                                                            className="p-2 rounded-xl bg-white border border-border text-muted-foreground hover:text-primary transition-all hover:shadow-lg"
                                                            title="Edit Payment"
                                                        >
                                                            <Edit3 className="h-4 w-4" />
                                                        </button>
                                                        <button
                                                            onClick={async () => {
                                                                if (confirm('Are you sure you want to delete this payment? This will trigger a full loan reconciliation.')) {
                                                                    try {
                                                                        await api.delete(`/loans/${params.id}/repayments/`, { data: { repayment_id: payment.id } });
                                                                        fetchLoanDetails();
                                                                    } catch (e) { alert('Failed to delete payment'); }
                                                                }
                                                            }}
                                                            className="p-2 rounded-xl bg-white border border-border text-muted-foreground hover:text-rose-500 transition-all hover:shadow-lg"
                                                            title="Delete Payment"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="text-center py-20 border-2 border-dashed border-border rounded-3xl">
                                            <DollarSign className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                            <h4 className="text-lg font-bold">No Payments Recorded</h4>
                                            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">This loan hasn&apos;t received any repayments yet. Once recorded, they will appear here in chronological order.</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeTab === 'comments' && (
                                <LoanCommentsSection loanId={params.id as string} />
                            )}

                            {activeTab === 'config' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-2xl bg-muted/20 border border-border space-y-4">
                                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Interest Configuration</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Annual Rate</p>
                                                    <p className="text-sm font-black">{loan.interest_rate}% {loan.interest_period_display || 'p.a'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Calculation Method</p>
                                                    <p className="text-sm font-black uppercase">{loan.interest_method_display || loan.interest_method?.replace('_', ' ')}</p>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-muted/20 border border-border space-y-4">
                                            <h4 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em]">Repayment Terms</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Loan Term</p>
                                                    <p className="text-sm font-black">{loan.term} {loan.product_details?.term_unit || 'Months'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Repayment Frequency</p>
                                                    <p className="text-sm font-black uppercase">{loan.repayment_frequency}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/10 space-y-4">
                                            <h4 className="text-[10px] font-black text-rose-600 uppercase tracking-[0.2em]">Late Payment Penalties</h4>
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Penalty Type</p>
                                                    <p className="text-sm font-black uppercase">{loan.penalty_type}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Penalty Value</p>
                                                    <p className="text-sm font-black">{loan.penalty_type === 'percentage' ? `${loan.penalty_value}%` : `KES ${Number(loan.penalty_value).toLocaleString()}`}</p>
                                                </div>
                                                <div className="col-span-2">
                                                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Grace Period</p>
                                                    <p className="text-sm font-black">{loan.penalty_grace_period} Days</p>
                                                </div>
                                            </div>
                                        </div>
                                        {loan.application_details?.purpose && (
                                            <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                                                <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">Loan Purpose</h4>
                                                <p className="text-sm text-foreground italic">&ldquo;{loan.application_details.purpose}&rdquo;</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'disbursement' && (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Disbursed Net</p>
                                            <p className="text-2xl font-black text-foreground tabular-nums">KES {Number(loan.disbursed_amount).toLocaleString()}</p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-muted/30 border border-border">
                                            <p className="text-[10px] font-black text-foreground uppercase tracking-widest mb-1">Payment Method</p>
                                            <p className="text-xl font-bold text-foreground flex items-center gap-2">
                                                <Wallet className="h-4 w-4 text-primary" /> {loan.disbursement_method?.replace('_', ' ').toUpperCase()}
                                            </p>
                                        </div>
                                        <div className="p-6 rounded-2xl bg-muted/30 border border-border">
                                            <p className="text-[10px] font-black text-foreground uppercase tracking-widest mb-1">Transaction Ref</p>
                                            <p className="text-lg font-black text-foreground">{loan.disbursement_reference || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-8 rounded-[2rem] border border-border space-y-6">
                                            <h4 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-primary" /> Legal & Compliance Documents
                                            </h4>
                                            <div className="space-y-3">
                                                {loan.application_details?.offer_letter_file && (
                                                    <a
                                                        href={loan.application_details.offer_letter_file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-primary/30 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-red-50 to-rose-100 flex items-center justify-center text-red-500">
                                                                <FileText className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-sm font-bold">Signed Offer Letter</span>
                                                        </div>
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                    </a>
                                                )}
                                                {loan.application_details?.disbursement_letter_file && (
                                                    <a
                                                        href={loan.application_details.disbursement_letter_file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex items-center justify-between p-4 rounded-xl bg-background border border-border hover:border-primary/30 transition-all group"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                                                                <FileText className="h-4 w-4" />
                                                            </div>
                                                            <span className="text-sm font-bold">Disbursement Checklist</span>
                                                        </div>
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                                    </a>
                                                )}
                                                {!loan.application_details?.offer_letter_file && !loan.application_details?.disbursement_letter_file && (
                                                    <p className="text-sm text-muted-foreground italic text-center py-4">No documents found for this facility.</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="p-8 rounded-[2rem] border border-border space-y-4">
                                            <h4 className="text-xs font-black text-foreground uppercase tracking-widest">Fees Breakdown</h4>
                                            <div className="space-y-3">
                                                {loan.fees && loan.fees.length > 0 ? loan.fees.map((fee: any) => (
                                                    <div key={fee.id} className="flex justify-between items-center text-sm">
                                                        <span className="text-muted-foreground">{fee.description || (fee.fee_type?.charAt(0).toUpperCase() + fee.fee_type?.slice(1) + ' Fee')}</span>
                                                        <span className="font-bold">KES {Number(fee.amount).toLocaleString()}</span>
                                                    </div>
                                                )) : (
                                                    <>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-muted-foreground">Processing Fee</span>
                                                            <span className="font-bold">KES {Number(loan.application_details?.processing_fee || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-muted-foreground">Insurance Fee</span>
                                                            <span className="font-bold">KES {Number(loan.application_details?.insurance_fee || 0).toLocaleString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center text-sm">
                                                            <span className="text-muted-foreground">Legal Fee</span>
                                                            <span className="font-bold">KES {Number(loan.application_details?.legal_fee || 0).toLocaleString()}</span>
                                                        </div>
                                                    </>
                                                )}
                                                <div className="pt-3 border-t border-border flex justify-between items-center">
                                                    <span className="text-sm font-black uppercase tracking-widest">Total Withheld</span>
                                                    <span className="text-lg font-black text-primary">KES {Number(loan.total_fees || 0).toLocaleString()}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'supporting_docs' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-muted-foreground uppercase tracking-wider">Supporting Documents</h4>
                                        <button
                                            onClick={() => setShowUploadModal(true)}
                                            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
                                        >
                                            <Upload className="h-4 w-4" /> Upload New
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Core Documents */}
                                        {(loan.application_details?.offer_letter_file || loan.application_details?.signed_offer_letter) && (
                                            <div className="group relative flex items-center justify-between p-5 rounded-2xl bg-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-md transition-all duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center border border-red-200">
                                                        <Shield className="h-5 w-5 text-red-600" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-foreground truncate">
                                                            {loan.application_details?.signed_offer_letter ? 'Signed Offer Letter' : 'Offer Letter'}
                                                        </p>
                                                        <p className="text-[10px] text-red-600 font-black uppercase tracking-widest">Core Document</p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={loan.application_details?.signed_offer_letter || loan.application_details?.offer_letter_file || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg bg-white border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </a>
                                            </div>
                                        )}
                                        {(loan.application_details?.disbursement_letter_file || loan.application_details?.signed_disbursement_letter) && (
                                            <div className="group relative flex items-center justify-between p-5 rounded-2xl bg-primary/5 border border-primary/20 hover:border-primary/40 hover:shadow-md transition-all duration-300">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-blue-100 flex items-center justify-center border border-blue-200">
                                                        <Wallet className="h-5 w-5 text-blue-600" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-foreground truncate">
                                                            {loan.application_details?.signed_disbursement_letter ? 'Signed Disbursement Checklist' : 'Disbursement Checklist'}
                                                        </p>
                                                        <p className="text-[10px] text-blue-600 font-black uppercase tracking-widest">Core Document</p>
                                                    </div>
                                                </div>
                                                <a
                                                    href={loan.application_details?.signed_disbursement_letter || loan.application_details?.disbursement_letter_file || '#'}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="p-2 rounded-lg bg-white border border-border text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                                                >
                                                    <FileText className="h-4 w-4" />
                                                </a>
                                            </div>
                                        )}

                                        {/* Supporting Documents */}
                                        {loanDocuments.length > 0 ? loanDocuments.map((doc) => (
                                            <div
                                                key={doc.id}
                                                className="group relative flex items-center justify-between p-5 rounded-2xl bg-background border border-border hover:border-primary/20 hover:shadow-md transition-all duration-300"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center border border-border">
                                                        <FileText className="h-5 w-5 text-muted-foreground" />
                                                    </div>
                                                    <div className="overflow-hidden">
                                                        <p className="text-sm font-bold text-foreground truncate max-w-[150px]">{doc.document_name}</p>
                                                        <p className="text-[10px] text-muted-foreground uppercase tracking-widest truncate">
                                                            {new Date(doc.uploaded_at).toLocaleDateString()} • {doc.uploaded_by_name}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={doc.file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="p-2 rounded-lg bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-all"
                                                        title="View Document"
                                                    >
                                                        <FileText className="h-4 w-4" />
                                                    </a>
                                                </div>
                                            </div>
                                        )) : (
                                            (!loan.application_details?.offer_letter_file && !loan.application_details?.disbursement_letter_file) && (
                                                <div className="col-span-full text-center py-20 border-2 border-dashed border-border rounded-3xl">
                                                    <Upload className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
                                                    <h4 className="text-lg font-bold">No Documents Available</h4>
                                                    <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Neither core documents nor supporting uploads were found for this facility.</p>
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'collateral' && (
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-muted-foreground uppercase tracking-wider">Pledged Collaterals</h4>
                                        <div className="flex items-center gap-2">
                                            <div className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-[10px] font-black uppercase tracking-widest border border-primary/20">
                                                LTV Ratio: {loan.ltv_ratio?.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-4">
                                        {loan.collateral_items && loan.collateral_items.length > 0 ? loan.collateral_items.map((item: any) => (
                                            <div
                                                key={item.id}
                                                onClick={() => router.push(`/collateral/${item.id}`)}
                                                className="group relative flex flex-col md:flex-row md:items-center justify-between p-6 rounded-3xl bg-background border border-border hover:border-primary/20 hover:shadow-xl transition-all duration-500 overflow-hidden cursor-pointer"
                                            >
                                                <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                                                    <Shield className="h-24 w-24 text-primary" />
                                                </div>

                                                <div className="flex items-start gap-6 relative z-10">
                                                    <div className="h-14 w-14 rounded-2xl bg-primary/5 flex items-center justify-center text-primary border border-primary/10 group-hover:bg-primary group-hover:text-white transition-all duration-500">
                                                        <Shield className="h-7 w-7" />
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-3 mb-1">
                                                            <h5 className="text-lg font-black text-foreground">{item.asset_type?.replace('_', ' ').toUpperCase()}</h5>
                                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border ${item.status === 'in_custody' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' :
                                                                item.status === 'discharged' ? 'bg-blue-500/10 text-blue-600 border-blue-500/20' :
                                                                    'bg-amber-500/10 text-amber-600 border-amber-500/20'
                                                                }`}>
                                                                {item.status?.replace('_', ' ')}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-muted-foreground line-clamp-2 max-w-md">{item.description}</p>
                                                        <div className="flex items-center gap-4 mt-3">
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Market Value</span>
                                                                <span className="text-sm font-black text-foreground">KES {Number(item.market_value || 0).toLocaleString()}</span>
                                                            </div>
                                                            <div className="h-8 w-px bg-border mx-1" />
                                                            <div className="flex flex-col">
                                                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">FSV (75%)</span>
                                                                <span className="text-sm font-black text-primary">KES {Number(item.forced_sale_value || 0).toLocaleString()}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="mt-6 md:mt-0 flex items-center gap-3 relative z-10">
                                                    {item.status !== 'in_custody' && (
                                                        <button
                                                            className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:shadow-lg hover:shadow-primary/30 transition-all flex items-center gap-2"
                                                            onClick={(e) => { e.stopPropagation(); /* handle port to custody */ }}
                                                        >
                                                            <ShieldCheck className="h-4 w-4" /> Port to Custody
                                                        </button>
                                                    )}
                                                    {item.status === 'in_custody' && (
                                                        <button
                                                            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 transition-all flex items-center gap-2"
                                                            onClick={(e) => { e.stopPropagation(); /* handle discharge */ }}
                                                        >
                                                            <RefreshCw className="h-4 w-4" /> Initiate Discharge
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )) : (
                                            <div className="text-center py-20 border-2 border-dashed border-border rounded-[2.5rem] bg-muted/10">
                                                <Shield className="h-16 w-16 text-muted-foreground/20 mx-auto mb-4" />
                                                <h4 className="text-xl font-black text-foreground">No Collateral Pledged</h4>
                                                <p className="text-sm text-muted-foreground mt-2 max-w-xs mx-auto">This facility is currently unsecured. Collateral items can be added during the application or appraisal stage.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-primary/20 before:via-border before:to-transparent">
                                    {historyLogs.length > 0 ? historyLogs.map((log) => (
                                        <div key={log.id} className="relative flex items-start gap-6 group">
                                            {/* Timeline Icon */}
                                            <div className="z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background shadow-sm group-hover:scale-110 transition-transform">
                                                {log.action === 'repay' ? <DollarSign className="h-5 w-5 text-emerald-500" /> :
                                                    log.action === 'approve' ? <CheckCircle2 className="h-5 w-5 text-blue-500" /> :
                                                        log.action === 'disburse' ? <Wallet className="h-5 w-5 text-primary" /> :
                                                            <FileText className="h-5 w-5 text-muted-foreground" />}
                                            </div>

                                            {/* Log Content */}
                                            <div className="flex-1 pb-6">
                                                <div className="p-5 rounded-2xl border border-border bg-muted/20 group-hover:bg-background group-hover:shadow-md transition-all duration-300">
                                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                                                        <h4 className="text-sm font-black text-foreground uppercase tracking-tight">
                                                            {log.description}
                                                        </h4>
                                                        <time className="text-[10px] font-bold text-foreground uppercase tracking-widest whitespace-nowrap">
                                                            {new Date(log.timestamp).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                                        </time>
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                                                            {log.user_name ? log.user_name.split(' ').map(n => n[0]).join('') : 'SY'}
                                                        </div>
                                                        <span className="text-[10px] font-bold text-foreground uppercase tracking-widest leading-none mt-0.5">
                                                            By <span className="text-foreground">{log.user_name || 'System System'}</span>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="ml-12 text-muted-foreground text-sm font-medium py-8 italic bg-muted/10 rounded-2xl text-center border border-dashed border-border">
                                            No automated audit trails found for this facility.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Upload Modal */}
            {
                loan && (
                    <LoanDocumentUploadModal
                        applicationId={(loan as any).application}
                        loanId={loan.id}
                        isOpen={showUploadModal}
                        onClose={() => setShowUploadModal(false)}
                        onSuccess={fetchLoanDetails}
                    />
                )
            }

            {/* Statement Confirmation Dialog */}
            {showStatementDialog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass rounded-2xl border border-border shadow-2xl p-6 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-primary/10 rounded-xl">
                                <FileText className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground font-heading">
                                    Generate Loan Statement
                                </h3>
                                <p className="text-xs text-muted-foreground">
                                    This will generate the latest statement PDF for this loan
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="p-4 rounded-xl bg-muted/30 border border-border">
                                <p className="text-sm text-foreground mb-1">
                                    <span className="font-bold">Facility:</span> {loan.loan_number}
                                </p>
                                <p className="text-sm text-foreground mb-1">
                                    <span className="font-bold">Borrower:</span> {loan.borrower_name}
                                </p>
                                {loan.borrower_details?.email && (
                                    <p className="text-sm text-muted-foreground">
                                        <span className="font-bold">Email:</span> {loan.borrower_details.email}
                                    </p>
                                )}
                            </div>

                            {loan.borrower_details?.email ? (
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
                                            Email statement to borrower
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                            The statement will be sent to {loan.borrower_details.email}
                                        </p>
                                    </div>
                                </label>
                            ) : (
                                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
                                    <p className="text-xs text-amber-500 flex items-center gap-2 font-bold">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Borrower does not have an email address on file.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-end gap-3">
                            <button
                                onClick={() => { setShowStatementDialog(false); setSendToBorrower(false); }}
                                className="px-4 py-2 text-sm font-bold rounded-xl hover:bg-muted transition-colors text-muted-foreground"
                                disabled={isGeneratingStatement}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={generateStatement}
                                disabled={isGeneratingStatement}
                                className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-bold hover:shadow-lg hover:shadow-primary/20 transition-all disabled:opacity-50"
                            >
                                {isGeneratingStatement ? (
                                    <>
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <FileText className="h-4 w-4" />
                                        Generate {sendToBorrower ? '& Send' : 'Statement'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {
                loan && (
                    <RecordPaymentModal
                        loan={loan}
                        isOpen={showPaymentModal}
                        onClose={() => {
                            setShowPaymentModal(false);
                            setSelectedInstallment(null);
                        }}
                        onSuccess={fetchLoanDetails}
                        installment={selectedInstallment}
                    />
                )
            }

            {/* Restructure Modal */}
            {
                loan && (
                    <RestructureLoanModal
                        loan={loan}
                        isOpen={showRestructureModal}
                        onClose={() => setShowRestructureModal(false)}
                        onSuccess={() => {
                            setShowRestructureModal(false);
                            fetchLoanDetails();
                        }}
                    />
                )
            }

            {/* Edit Payment Modal */}
            <EditPaymentModal
                loanId={params.id as string}
                payment={selectedPayment}
                isOpen={showEditPaymentModal}
                onClose={() => {
                    setShowEditPaymentModal(false);
                    setSelectedPayment(null);
                }}
                onSuccess={fetchLoanDetails}
            />
        </div >
    );
}
