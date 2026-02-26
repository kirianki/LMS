'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft,
    AlertCircle,
    User,
    DollarSign,
    Calendar,
    Clock,
    PhoneCall,
    MessageSquare,
    CheckCircle2,
    Scale,
    TrendingUp
} from 'lucide-react';
import api from '@/lib/api';
import Link from 'next/link';
import LogInteractionModal from '@/components/collections/LogInteractionModal';
import PromiseToPayModal from '@/components/collections/PromiseToPayModal';
import RecoveryActionModal from '@/components/collections/RecoveryActionModal';
import MessageModal from '@/components/common/MessageModal';

interface CollectionCaseDetailProps {
    params: { id: string };
}

export default function CollectionCaseDetailPage({ params }: CollectionCaseDetailProps) {
    const router = useRouter();
    const [caseData, setCaseData] = useState<any>(null);
    const [notes, setNotes] = useState<any[]>([]);
    const [promises, setPromises] = useState<any[]>([]);
    const [recoveryActions, setRecoveryActions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'timeline' | 'promises' | 'recovery'>('timeline');

    // Modal states
    const [showLogInteraction, setShowLogInteraction] = useState(false);
    const [showPromiseToPay, setShowPromiseToPay] = useState(false);
    const [showRecoveryAction, setShowRecoveryAction] = useState(false);
    const [showSendMessage, setShowSendMessage] = useState(false);

    useEffect(() => {
        fetchCaseData();
    }, [params.id]);

    const fetchCaseData = async () => {
        setIsLoading(true);
        try {
            const [caseRes, notesRes, promisesRes, recoveryRes] = await Promise.all([
                api.get(`/loans/collection-cases/${params.id}/`),
                api.get(`/loans/collection-notes/?case=${params.id}`),
                api.get(`/loans/promises-to-pay/?case=${params.id}`),
                api.get(`/loans/recovery-actions/?loan=${params.id}`) // Note: recovery actions are linked to loan, not case
            ]);

            setCaseData(caseRes.data);
            setNotes(notesRes.data.results || notesRes.data || []);
            setPromises(promisesRes.data.results || promisesRes.data || []);
            setRecoveryActions(recoveryRes.data.results || recoveryRes.data || []);
        } catch (error) {
            console.error('Failed to fetch case data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !caseData) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    const priorityColors: any = {
        critical: 'bg-red-500/10 text-red-400 border-red-500/20',
        high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        low: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    };

    const statusColors: any = {
        active: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        resolved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        escalated: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        written_off: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    };

    const promiseStatusColors: any = {
        pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        kept: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        broken: 'bg-red-500/10 text-red-400 border-red-500/20'
    };

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="flex-1">
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <AlertCircle className="h-8 w-8 text-orange-400" />
                        Collection Case
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Managing overdue loan: {caseData.loan?.loan_number}
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowSendMessage(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <MessageSquare className="h-4 w-4" />
                        Send Message
                    </button>
                    <button
                        onClick={() => setShowLogInteraction(true)}
                        className="px-4 py-2 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                        <PhoneCall className="h-4 w-4" />
                        Log Interaction
                    </button>
                    <button
                        onClick={() => setShowPromiseToPay(true)}
                        className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-2"
                    >
                        <CheckCircle2 className="h-4 w-4" />
                        Record Promise
                    </button>
                    <button
                        onClick={() => setShowRecoveryAction(true)}
                        className="px-4 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors flex items-center gap-2"
                    >
                        <Scale className="h-4 w-4" />
                        Recovery Action
                    </button>
                </div>
            </div>

            {/* Case Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[caseData.status]}`}>
                        {caseData.status?.toUpperCase()}
                    </span>
                </div>

                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Priority</p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${priorityColors[caseData.priority]}`}>
                        {caseData.priority?.toUpperCase()}
                    </span>
                </div>

                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Days Overdue</p>
                        <Clock className="h-5 w-5 text-red-400" />
                    </div>
                    <p className="text-2xl font-bold text-red-400">{caseData.days_overdue} days</p>
                </div>

                <div className="glass rounded-2xl p-6 border border-border">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Overdue Amount</p>
                        <DollarSign className="h-5 w-5 text-red-400" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                        KES {Number(caseData.overdue_amount).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Borrower & Loan Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="glass rounded-2xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-primary" />
                        Borrower Information
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Name:</span>
                            <span className="font-semibold text-foreground">{caseData.borrower_name || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Phone:</span>
                            <span className="font-semibold text-foreground">{caseData.loan?.borrower_phone || 'N/A'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Assigned To:</span>
                            <span className="font-semibold text-foreground">
                                {caseData.assigned_to
                                    ? `${caseData.assigned_to.first_name} ${caseData.assigned_to.last_name}`
                                    : 'Unassigned'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="glass rounded-2xl p-6 border border-border">
                    <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
                        <Calendar className="h-5 w-5 text-primary" />
                        Case Timeline
                    </h3>
                    <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Opened:</span>
                            <span className="font-semibold text-foreground">
                                {new Date(caseData.opened_at).toLocaleDateString()}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Next Follow-up:</span>
                            <span className="font-semibold text-foreground">
                                {caseData.next_follow_up
                                    ? new Date(caseData.next_follow_up).toLocaleDateString()
                                    : 'Not scheduled'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Loan Number:</span>
                            <Link
                                href={`/loans/${caseData.loan?.id}`}
                                className="font-semibold text-primary hover:underline"
                            >
                                {caseData.loan?.loan_number}
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border">
                <button
                    onClick={() => setActiveTab('timeline')}
                    className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'timeline'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Activity Timeline ({notes.length})
                </button>
                <button
                    onClick={() => setActiveTab('promises')}
                    className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'promises'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Promises to Pay ({promises.length})
                </button>
                <button
                    onClick={() => setActiveTab('recovery')}
                    className={`px-4 py-2 font-semibold transition-colors ${activeTab === 'recovery'
                        ? 'text-primary border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    Recovery Actions ({recoveryActions.length})
                </button>
            </div>

            {/* Tab Content */}
            <div className="glass rounded-2xl border border-border p-6">
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        {notes.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No collection activities logged yet</p>
                        ) : (
                            notes.map((note: any) => (
                                <div key={note.id} className="border-l-4 border-primary pl-4 py-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-semibold rounded">
                                                {note.contact_method?.toUpperCase()}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {new Date(note.created_at).toLocaleString()}
                                            </span>
                                        </div>
                                        <span className="text-xs text-muted-foreground">
                                            by {note.created_by?.first_name} {note.created_by?.last_name}
                                        </span>
                                    </div>
                                    <p className="text-sm text-foreground mb-2">{note.note}</p>
                                    {note.customer_response && (
                                        <div className="bg-muted/50 rounded-lg p-3 mt-2">
                                            <p className="text-xs font-semibold text-muted-foreground mb-1">Borrower Response:</p>
                                            <p className="text-sm text-foreground">{note.customer_response}</p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'promises' && (
                    <div className="space-y-4">
                        {promises.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No payment promises recorded</p>
                        ) : (
                            promises.map((promise: any) => (
                                <div key={promise.id} className="border border-border rounded-xl p-4">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <p className="text-lg font-bold text-foreground">
                                                KES {Number(promise.promised_amount).toLocaleString()}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                Promised by {new Date(promise.promised_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${promiseStatusColors[promise.status]}`}>
                                            {promise.status?.toUpperCase()}
                                        </span>
                                    </div>
                                    {promise.notes && (
                                        <p className="text-sm text-muted-foreground">{promise.notes}</p>
                                    )}
                                    {promise.actual_amount && (
                                        <div className="mt-2 pt-2 border-t border-border">
                                            <p className="text-xs text-emerald-400">
                                                Paid: KES {Number(promise.actual_amount).toLocaleString()} on{' '}
                                                {new Date(promise.actual_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'recovery' && (
                    <div className="space-y-4">
                        {recoveryActions.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">No recovery actions taken</p>
                        ) : (
                            recoveryActions.map((action: any) => (
                                <div key={action.id} className="border-l-4 border-red-500 pl-4 py-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-foreground">{action.action_type?.replace('_', ' ').toUpperCase()}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(action.action_date).toLocaleDateString()}
                                            </p>
                                        </div>
                                        {action.cost_incurred > 0 && (
                                            <span className="text-sm font-semibold text-red-400">
                                                Cost: KES {Number(action.cost_incurred).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-foreground">{action.details}</p>
                                    {action.document && (
                                        <a
                                            href={action.document}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-xs text-primary hover:underline mt-2 inline-block"
                                        >
                                            View Document →
                                        </a>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>

            {/* Modals */}
            <LogInteractionModal
                isOpen={showLogInteraction}
                onClose={() => setShowLogInteraction(false)}
                caseId={params.id}
                onSuccess={fetchCaseData}
            />
            <PromiseToPayModal
                isOpen={showPromiseToPay}
                onClose={() => setShowPromiseToPay(false)}
                caseId={params.id}
                onSuccess={fetchCaseData}
            />
            <RecoveryActionModal
                isOpen={showRecoveryAction}
                onClose={() => setShowRecoveryAction(false)}
                loanId={caseData.loan?.id}
                onSuccess={fetchCaseData}
            />
            <MessageModal
                isOpen={showSendMessage}
                onClose={() => setShowSendMessage(false)}
                recipientPhone={caseData.loan?.borrower_phone || ''}
                borrowerId={caseData.loan?.borrower_id}
                loanId={caseData.loan?.id}
                onSuccess={fetchCaseData}
            />
        </div>
    );
}
