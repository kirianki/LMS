'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import {
    ArrowLeft,
    TrendingUp,
    Save,
    Upload,
    Loader2
} from 'lucide-react';
import api from '@/lib/api';

export default function NewValuationReportPage() {
    const router = useRouter();
    const params = useParams();
    const [valuers, setValuers] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reportFile, setReportFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        collateral: params.id as string,
        market_value: '',
        forced_sale_value: '',
        valuation_date: new Date().toISOString().split('T')[0],
        valuer: '',
        notes: '',
    });

    useEffect(() => {
        const fetchValuers = async () => {
            try {
                const res = await api.get('/collateral/valuers/');
                setValuers(res.data.results || res.data);
            } catch (error) {
                console.error('Failed to fetch valuers:', error);
            }
        };
        fetchValuers();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setReportFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSend = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (value) dataToSend.append(key, value.toString());
            });

            if (reportFile) {
                dataToSend.append('report_file', reportFile);
            }

            await api.post('/collateral/valuation-reports/', dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            router.push(`/collateral/${params.id}`);
        } catch (error) {
            console.error('Failed to save valuation report:', error);
            alert('Failed to save valuation report. Please check required fields.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto pb-12">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <TrendingUp className="h-6 w-6 text-primary" />
                        Log New Valuation
                    </h1>
                    <p className="text-muted-foreground mt-1">Submit an accredited valuation report to update asset values.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="glass p-8 rounded-2xl border border-border space-y-6">
                    <h2 className="text-foreground font-bold text-sm uppercase tracking-wider mb-6 flex items-center gap-2">
                        Valuation Details
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Market Value (KES) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                name="market_value"
                                required
                                min="0"
                                step="0.01"
                                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground font-mono"
                                value={formData.market_value}
                                onChange={handleChange}
                                placeholder="e.g 1500000"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-amber-500/70 uppercase tracking-widest">Forced Sale Value (KES) <span className="text-red-500">*</span></label>
                            <input
                                type="number"
                                name="forced_sale_value"
                                required
                                min="0"
                                step="0.01"
                                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground font-mono"
                                value={formData.forced_sale_value}
                                onChange={handleChange}
                                placeholder="e.g 1000000"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Date of Valuation <span className="text-red-500">*</span></label>
                            <input
                                type="date"
                                name="valuation_date"
                                required
                                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground"
                                value={formData.valuation_date}
                                onChange={handleChange}
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Accredited Valuer</label>
                            <select
                                name="valuer"
                                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground"
                                value={formData.valuer}
                                onChange={handleChange}
                            >
                                <option value="">Select a Valuer...</option>
                                {valuers.map(v => (
                                    <option key={v.id} value={v.id}>{v.name} ({v.registration_number})</option>
                                ))}
                            </select>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Upload Report Document</label>
                            <div className="relative group cursor-pointer">
                                <input
                                    type="file"
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                    onChange={handleFileChange}
                                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                                />
                                <div className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl transition-all ${reportFile ? 'border-primary/50 bg-primary/5' : 'border-border hover:border-primary/30 hover:bg-muted/50'
                                    }`}>
                                    <Upload className={`h-6 w-6 ${reportFile ? 'text-primary' : 'text-muted-foreground'}`} />
                                    <div>
                                        <p className="text-foreground font-bold text-sm">
                                            {reportFile ? reportFile.name : 'Click to upload valuation report'}
                                        </p>
                                        <p className="text-xs text-muted-foreground mt-1">PDF, Document, or Image files</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="col-span-1 md:col-span-2 space-y-2">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Notes / Conditions</label>
                            <textarea
                                name="notes"
                                rows={3}
                                className="w-full bg-input border border-border rounded-xl px-4 py-3 text-foreground resize-none"
                                value={formData.notes}
                                onChange={handleChange}
                                placeholder="Any specific conditions or observations mentioned in the report..."
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                        {isSubmitting ? 'Saving Report...' : 'Save Valuation Report'}
                    </button>
                </div>
            </form>
        </div>
    );
}
