'use client';

import { useState, useEffect } from 'react';
import {
    X,
    DollarSign,
    Smartphone,
    Building2,
    ShieldCheck,
    AlertCircle,
    Info,
    Upload,
    Zap
} from 'lucide-react';
import api from '@/lib/api';

interface CashAccount {
    id: string;
    name: string;
    account_type: string;
    current_balance: string;
}

interface DisbursementModalProps {
    isOpen: boolean;
    onClose: () => void;
    applicationId: string;
    approvedAmount: number;
    repaymentChannel: string;
    onSuccess: () => void;
    payoffAmount?: number;
    netDisbursement?: number;
}

export default function DisbursementModal({
    isOpen,
    onClose,
    applicationId,
    approvedAmount,
    repaymentChannel,
    onSuccess,
    payoffAmount = 0,
    netDisbursement
}: DisbursementModalProps) {
    const finalDisbursementAmount = netDisbursement ?? (approvedAmount - payoffAmount);
    const [accounts, setAccounts] = useState<CashAccount[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [apiConfigured, setApiConfigured] = useState(false); // Determines mode
    const [isManualMode, setIsManualMode] = useState(false);

    const [formData, setFormData] = useState({
        cash_account_id: '',
        disbursement_method: repaymentChannel || 'mpesa',
        details: {
            phone_number: '',
            bank_name: '',
            account_number: '',
            cheque_number: ''
        },
        disbursement_proof: null as File | null,
        disbursement_reference_manual: ''
    });

    useEffect(() => {
        if (isOpen) {
            fetchAccounts();
            checkAPIConfiguration();
        }
    }, [isOpen]);

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/treasury/accounts/');
            setAccounts(res.data.results || res.data);
            if (res.data.length > 0) {
                setFormData(prev => ({ ...prev, cash_account_id: res.data[0].id }));
            }
        } catch (err) {
            console.error('Failed to fetch cash accounts:', err);
            setError('Could not load source accounts.');
        } finally {
            setLoading(false);
        }
    };

    const checkAPIConfiguration = async () => {
        // TODO: Create an endpoint to check if M-Pesa/Bank APIs are configured
        // For now,assume manual mode is available
        // In production, call: api.get('/accounts/api-config-status/')
        setApiConfigured(false); // Defaulting to manual for now
        setIsManualMode(true);
    };

    const handleDetailChange = (field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            details: { ...prev.details, [field]: value }
        }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFormData(prev => ({ ...prev, disbursement_proof: e.target.files![0] }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!formData.cash_account_id) {
            setError('Please select a source account.');
            return;
        }

        // Manual mode validation
        if (isManualMode) {
            if (!formData.disbursement_proof || !formData.disbursement_reference_manual) {
                setError('Manual disbursement requires both proof (receipt) and transaction reference.');
                return;
            }
        }

        try {
            setSubmitting(true);

            const payload = new FormData();
            payload.append('disbursement_method', formData.disbursement_method);
            payload.append('disbursement_details', JSON.stringify(formData.details));
            payload.append('cash_account_id', formData.cash_account_id);

            if (isManualMode && formData.disbursement_proof) {
                payload.append('disbursement_proof', formData.disbursement_proof);
                payload.append('disbursement_reference_manual', formData.disbursement_reference_manual);
            }

            const response = await api.post(`/loans/applications/${applicationId}/disburse/`, payload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log('Disbursement response:', response.data);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Disbursement failed:', err);
            setError(err.response?.data?.error || 'Disbursement failed. Please check details.');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="bg-slate-900 p-6 flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <ShieldCheck className="h-6 w-6 text-emerald-400" />
                            Final Disbursement
                        </h2>
                        <p className="text-slate-400 text-sm mt-1">
                            {isManualMode ? 'Upload proof of payment' : 'Automated payment processing'}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X className="h-5 w-5 text-slate-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="bg-red-50 border border-red-100 p-4 rounded-xl flex items-start gap-3 text-red-600">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <p className="text-sm font-semibold">{error}</p>
                        </div>
                    )}

                    {/* Mode indicator */}
                    <div className={`border-2 p-4 rounded-2xl flex items-center gap-3 ${isManualMode ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                        {isManualMode ? <Upload className="h-5 w-5 text-amber-600" /> : <Zap className="h-5 w-5 text-emerald-600" />}
                        <div>
                            <p className={`text-sm font-bold ${isManualMode ? 'text-amber-900' : 'text-emerald-900'}`}>
                                {isManualMode ? 'Manual Mode' : 'Automated Mode'}
                            </p>
                            <p className="text-xs text-slate-600">
                                {isManualMode ? 'Upload transaction proof after completing payment' : 'API will process payment automatically'}
                            </p>
                        </div>
                    </div>

                    {/* Amount Summary */}
                    <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="bg-indigo-600/10 p-2 rounded-lg">
                                <DollarSign className="h-5 w-5 text-indigo-600" />
                            </div>
                            <span className="text-sm font-bold text-indigo-900">
                                {payoffAmount > 0 ? 'Net Disbursement' : 'Amount to Disburse'}
                            </span>
                        </div>
                        <div className="text-right">
                            <span className="text-xl font-black text-indigo-600">
                                KES {finalDisbursementAmount.toLocaleString()}
                            </span>
                            {payoffAmount > 0 && (
                                <p className="text-[10px] text-indigo-400 font-bold uppercase mt-1">
                                    Gross: KES {approvedAmount.toLocaleString()} | Payoff: KES {payoffAmount.toLocaleString()}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Source Account */}
                    <div className="space-y-2">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Source Cash/Bank Account
                        </label>
                        <select
                            value={formData.cash_account_id}
                            onChange={(e) => setFormData(prev => ({ ...prev, cash_account_id: e.target.value }))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-slate-900 transition-all"
                            required
                        >
                            <option value="">Select Account</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} (KES {Number(acc.current_balance).toLocaleString()})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Disbursement Details */}
                    <div className="space-y-3">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                            Payment Details (Recipient)
                        </label>

                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, disbursement_method: 'mpesa' }))}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-sm ${formData.disbursement_method === 'mpesa'
                                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                                    }`}
                            >
                                <Smartphone className="h-4 w-4" />
                                M-Pesa
                            </button>
                            <button
                                type="button"
                                onClick={() => setFormData(prev => ({ ...prev, disbursement_method: 'bank_transfer' }))}
                                className={`flex items-center justify-center gap-2 p-3 rounded-xl border-2 transition-all font-bold text-sm ${formData.disbursement_method === 'bank_transfer'
                                    ? 'border-blue-500 bg-blue-50 text-blue-700'
                                    : 'border-slate-100 bg-slate-50 text-slate-400 hover:border-slate-200'
                                    }`}
                            >
                                <Building2 className="h-4 w-4" />
                                Bank
                            </button>
                        </div>

                        {formData.disbursement_method === 'mpesa' && (
                            <div className="animate-in slide-in-from-top-1 duration-200">
                                <input
                                    type="text"
                                    placeholder="Recipient Phone Number (e.g. 07...)"
                                    value={formData.details.phone_number}
                                    onChange={(e) => handleDetailChange('phone_number', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-emerald-500 transition-all font-mono"
                                    required
                                />
                            </div>
                        )}

                        {formData.disbursement_method === 'bank_transfer' && (
                            <div className="space-y-2 animate-in slide-in-from-top-1 duration-200">
                                <input
                                    type="text"
                                    placeholder="Bank Name"
                                    value={formData.details.bank_name}
                                    onChange={(e) => handleDetailChange('bank_name', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all text-uppercase"
                                    required
                                />
                                <input
                                    type="text"
                                    placeholder="Account Number"
                                    value={formData.details.account_number}
                                    onChange={(e) => handleDetailChange('account_number', e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-mono"
                                    required
                                />
                            </div>
                        )}
                    </div>

                    {/* Manual Mode Fields */}
                    {isManualMode && (
                        <div className="space-y-4 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl">
                            <label className="text-xs font-black text-amber-900 uppercase tracking-widest">
                                Manual Verification Required
                            </label>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600">Transaction Reference / Code</label>
                                <input
                                    type="text"
                                    placeholder="e.g., SG45XY7Z8M, CHQ12345"
                                    value={formData.disbursement_reference_manual}
                                    onChange={(e) => setFormData(prev => ({ ...prev, disbursement_reference_manual: e.target.value }))}
                                    className="w-full bg-white border border-amber-300 rounded-xl p-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-amber-500 transition-all font-mono"
                                    required={isManualMode}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-600">Upload Proof (Receipt/Screenshot)</label>
                                <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={handleFileChange}
                                    className="w-full bg-white border border-amber-300 rounded-xl p-3 text-sm font-bold text-slate-700 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-xs file:font-bold file:bg-amber-600 file:text-white hover:file:bg-amber-700"
                                    required={isManualMode}
                                />
                                {formData.disbursement_proof && (
                                    <p className="text-xs text-emerald-600 font-semibold">✓ {formData.disbursement_proof.name}</p>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Footer Info */}
                    <div className="bg-blue-50 rounded-2xl p-4 flex gap-3 text-blue-700 border border-blue-100">
                        <Info className="h-5 w-5 shrink-0" />
                        <p className="text-xs font-semibold leading-relaxed">
                            {isManualMode
                                ? 'Complete the payment externally, then upload proof and reference code here.'
                                : 'Ensure you have verified the account details on the signed checklist before proceeding.'
                            } This action will update the general ledger and treasury logs.
                        </p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 bg-slate-100 text-slate-600 font-black py-4 rounded-2xl hover:bg-slate-200 transition-all uppercase tracking-widest text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || loading}
                            className="flex-[2] bg-emerald-600 text-white font-black py-4 rounded-2xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition-all uppercase tracking-widest text-xs disabled:opacity-50"
                        >
                            {submitting ? 'Processing...' : isManualMode ? 'Upload & Confirm' : 'Process Disbursement'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
