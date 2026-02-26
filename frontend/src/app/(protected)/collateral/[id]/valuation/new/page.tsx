'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, FileText, Upload, Calendar, TrendingUp, TrendingDown } from 'lucide-react';
import api from '@/lib/api';

export default function NewValuationReportPage() {
    const router = useRouter();
    const params = useParams();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reportFile, setReportFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        valuer_company: '',
        market_value: '',
        forced_sale_value: '',
        valuation_date: new Date().toISOString().split('T')[0],
        notes: '',
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
            dataToSend.append('collateral', params.id as string);
            dataToSend.append('valuer_company', formData.valuer_company);
            dataToSend.append('market_value', formData.market_value);
            dataToSend.append('forced_sale_value', formData.forced_sale_value);
            dataToSend.append('valuation_date', formData.valuation_date);
            dataToSend.append('notes', formData.notes);

            if (reportFile) {
                dataToSend.append('report_file', reportFile);
            }

            await api.post('/collateral/valuation-reports/', dataToSend, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Return to collateral detail
            router.push(`/collateral/${params.id}`);
        } catch (error) {
            console.error('Failed to submit report:', error);
            alert('Failed to submit valuation report. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 max-w-2xl mx-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Submit Valuation Report</h1>
                    <p className="text-muted-foreground mt-1">Record a new valuation from an accredited partner</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-primary opacity-70 mb-4">
                        <FileText className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Report Details</h3>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Valuation Company Name</label>
                        <input
                            type="text"
                            name="valuer_company"
                            required
                            value={formData.valuer_company}
                            onChange={handleChange}
                            placeholder="e.g. Aurum Valuations Ltd"
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                <TrendingUp className="h-3 w-3" /> Market Value (KES)
                            </label>
                            <input
                                type="number"
                                name="market_value"
                                required
                                value={formData.market_value}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-3 px-4 text-foreground font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                                <TrendingDown className="h-3 w-3" /> Forced Sale Value (KES)
                            </label>
                            <input
                                type="number"
                                name="forced_sale_value"
                                required
                                value={formData.forced_sale_value}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-3 px-4 text-amber-500 font-bold text-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Calendar className="h-3 w-3" /> Valuation Date
                        </label>
                        <input
                            type="date"
                            name="valuation_date"
                            required
                            value={formData.valuation_date}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Notes / Observations</label>
                        <textarea
                            name="notes"
                            rows={3}
                            value={formData.notes}
                            onChange={handleChange}
                            placeholder="Any key findings from the report..."
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>
                </div>

                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-primary opacity-70 mb-4">
                        <Upload className="h-4 w-4" />
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Attachment</h3>
                    </div>

                    <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-input border-border hover:bg-slate-900 transition-all group">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                <Upload className="w-8 h-8 mb-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                <p className="mb-2 text-sm text-muted-foreground">
                                    <span className="font-semibold">{reportFile ? reportFile.name : 'Upload Official Report PDF'}</span>
                                </p>
                                <p className="text-xs text-slate-600">PDF, PNG, JPG (MAX. 10MB)</p>
                            </div>
                            <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                        </label>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 p-6 glass rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Submitting...' : 'Submit & Update Asset'}
                    </button>
                </div>
            </form>
        </div>
    );
}
