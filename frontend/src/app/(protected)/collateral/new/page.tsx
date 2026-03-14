'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ArrowLeft,
    Save,
    ShieldCheck,
    Sparkles,
    Car,
    Home,
    Layers,
    Info,
    Loader2,
    CheckCircle2,
    Upload
} from 'lucide-react';
import api from '@/lib/api';

function CollateralForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [borrowers, setBorrowers] = useState<any[]>([]);
    const [valuers, setValuers] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const [aiText, setAiText] = useState('');
    const [showAiParser, setShowAiParser] = useState(false);
    const [documentFile, setDocumentFile] = useState<File | null>(null);

    const [formData, setFormData] = useState({
        borrower: searchParams.get('borrower') || '',
        collateral_type: 'motor_vehicle',
        market_value: '',
        forced_sale_value: '',
        valuation_date: new Date().toISOString().split('T')[0],
        valuer: '',
        description: '',
        // Type specific
        reg_number: '',
        make: '',
        model: '',
        year_of_manufacture: '',
        logbook_number: '',
        lr_number: '',
        location: '',
        property_size: '',
        // Insurance & Tracker
        insurance_start_date: '',
        insurance_expiry_date: '',
        tracker_installed: false,
        tracker_company: '',
        tracker_device_id: '',
        tracker_installation_date: '',
        chassis_number: '',
        engine_number: '',
        color: '',
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [borrowersRes, valuersRes] = await Promise.all([
                    api.get('/customers/borrowers/'),
                    api.get('/collateral/valuers/')
                ]);
                setBorrowers(borrowersRes.data.results || borrowersRes.data);
                setValuers(valuersRes.data.results || valuersRes.data);

                // If borrower is in URL but not in the initial list, fetch them specifically
                const borrowerId = searchParams.get('borrower');
                if (borrowerId && !borrowers.find((c: any) => c.id === borrowerId)) {
                    const singleRes = await api.get(`/customers/borrowers/${borrowerId}/`);
                    setBorrowers(prev => [...prev, singleRes.data]);
                    setFormData(prev => ({ ...prev, borrower: borrowerId }));
                }
            } catch (error) {
                console.error('Failed to fetch data:', error);
            }
        };
        fetchData();
    }, [searchParams]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setDocumentFile(e.target.files[0]);
        }
    };

    const [parsedData, setParsedData] = useState<any>(null);

    const handleAiParse = async () => {
        if (!aiText) return;
        setIsParsing(true);
        setParsedData(null);
        try {
            const response = await api.post('/agents/ai/parse-valuation/', { text: aiText });
            const data = response.data;

            if (data.success && data.data) {
                const e = data.data;
                setFormData(prev => ({
                    ...prev,
                    market_value: e.market_value?.toString() || prev.market_value,
                    forced_sale_value: e.forced_sale_value?.toString() || prev.forced_sale_value,
                    valuation_date: e.valuation_date || prev.valuation_date,
                    valuer: valuers.find(v => v.name.toLowerCase().includes(e.valuer_company?.toLowerCase() || ''))?.id || prev.valuer,
                    reg_number: e.reg_number || prev.reg_number,
                    lr_number: e.lr_number || prev.lr_number,
                    make: e.make || prev.make,
                    model: e.model || prev.model,
                    insurance_start_date: e.insurance_start_date || prev.insurance_start_date,
                    insurance_expiry_date: e.insurance_expiry_date || prev.insurance_expiry_date,
                }));
                setParsedData(e);
                // setShowAiParser(false); // Let user see what was parsed first
                setAiText('');
            } else {
                alert('AI could not extract enough information. Please check the text or enter manually.');
            }
        } catch (error) {
            console.error('AI parsing failed:', error);
            alert('AI parsing error. Please check your connection to the Agent service.');
        } finally {
            setIsParsing(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSend = new FormData();

            // Append all form fields
            Object.entries(formData).forEach(([key, value]) => {
                if (value) dataToSend.append(key, value.toString());
            });

            // Append file if exists
            if (documentFile) {
                dataToSend.append('document_upload', documentFile);
            }

            await api.post('/collateral/', dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            router.push('/collateral');
        } catch (error) {
            console.error('Failed to save collateral:', error);
            alert('Failed to save collateral. Please check required fields.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const getBorrowerName = (b: any) => {
        if (b.borrower_type === 'company' || b.borrower_type === 'institution') return b.business_name;
        return `${b.first_name} ${b.last_name}`;
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto pb-12">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading">Add Security Asset</h1>
                        <p className="text-muted-foreground mt-1">Register new collateral for credit scoring</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowAiParser(!showAiParser)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-all font-bold text-sm"
                >
                    <Sparkles className="h-4 w-4" />
                    AI Assistant Parser
                </button>
            </div>

            {showAiParser && (
                <div className="glass rounded-xl p-6 border border-primary/20 bg-primary/[0.02] space-y-4 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-start gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                            <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-foreground font-bold text-sm mb-1 tracking-wide uppercase">AI Valuation Report Parser</h3>
                            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                                Paste the raw text from a valuation report (PDF content, OCR text, etc.). Our Agent will extract the values and asset details automatically.
                            </p>
                            <textarea
                                rows={5}
                                value={aiText}
                                onChange={(e) => setAiText(e.target.value)}
                                placeholder="Paste report text here..."
                                className="w-full bg-background/50 border border-border rounded-lg p-4 text-sm text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary font-mono placeholder:text-slate-700"
                            />

                            {parsedData && (
                                <div className="mt-4 p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20 space-y-2 animate-in fade-in zoom-in-95">
                                    <h4 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                        <CheckCircle2 className="h-3 w-3" /> Information Extracted Successfully
                                    </h4>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(parsedData as Record<string, any>).map(([key, value]) => value ? (
                                            <span key={key} className="px-2 py-1 rounded bg-muted border border-border text-[10px] text-slate-300">
                                                <strong className="text-muted-foreground uppercase mr-1">{key.replace('_', ' ')}:</strong> {String(value)}
                                            </span>
                                        ) : null)}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 mt-4">
                                <button
                                    onClick={() => {
                                        setShowAiParser(false);
                                        setParsedData(null);
                                    }}
                                    className="px-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    Close Assistant
                                </button>
                                <button
                                    onClick={handleAiParse}
                                    disabled={!aiText || isParsing}
                                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white font-bold text-xs shadow-lg shadow-primary/20 disabled:opacity-50"
                                >
                                    {isParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                                    {isParsing ? 'Processing Document...' : 'Analyze & Populate Form'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Identification */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-primary mb-4">
                        <ShieldCheck className="h-5 w-5" />
                        <h2 className="text-lg font-semibold text-foreground">Asset Assignment</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Borrower / Pledger</label>
                            <select
                                name="borrower"
                                required
                                value={formData.borrower}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="">Select a borrower</option>
                                {borrowers.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {getBorrowerName(b)} ({b.borrower_number})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Asset Type</label>
                            <select
                                name="collateral_type"
                                required
                                value={formData.collateral_type}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="motor_vehicle">Motor Vehicle</option>
                                <option value="land_property">Land or Property</option>
                                <option value="business_asset">Business Asset</option>
                                <option value="chattels">Household Chattels</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Specific Details */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-emerald-400 mb-4">
                        <Layers className="h-5 w-5" />
                        <h2 className="text-lg font-semibold text-foreground uppercase tracking-wider text-xs">Technical Identification</h2>
                    </div>

                    {formData.collateral_type === 'motor_vehicle' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Registration No.</label>
                                <input type="text" name="reg_number" required placeholder="KXX 001X" value={formData.reg_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-bold uppercase" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Make</label>
                                <input type="text" name="make" required placeholder="Toyota" value={formData.make} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Model</label>
                                <input type="text" name="model" required placeholder="Fielder" value={formData.model} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Year</label>
                                <input type="number" name="year_of_manufacture" value={formData.year_of_manufacture} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Chassis Number</label>
                                <input type="text" name="chassis_number" placeholder="Enter Chassis No." value={formData.chassis_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Engine Number</label>
                                <input type="text" name="engine_number" placeholder="Enter Engine No." value={formData.engine_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Colour</label>
                                <input type="text" name="color" placeholder="e.g. Silver" value={formData.color} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                            <div className="md:col-span-1">
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Logbook No.</label>
                                <input type="text" name="logbook_number" required value={formData.logbook_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                            </div>
                        </div>
                    )}

                    {formData.collateral_type === 'land_property' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in zoom-in-95">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">LR / Parcel Number</label>
                                <input type="text" name="lr_number" required value={formData.lr_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-bold" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Location / Area</label>
                                <input type="text" name="location" required value={formData.location} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Property Size</label>
                                <input type="text" name="property_size" value={formData.property_size} onChange={handleChange} placeholder="e.g. 0.5 Acres" className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                            </div>
                        </div>
                    )}

                    {['motor_vehicle', 'chattels'].includes(formData.collateral_type) && (
                        <div className="pt-6 border-t border-border animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center gap-2 text-indigo-400 mb-4">
                                <ShieldCheck className="h-4 w-4" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Insurance Cover</h3>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Cover Start Date</label>
                                    <input type="date" name="insurance_start_date" value={formData.insurance_start_date} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Cover Expiry Date</label>
                                    <input type="date" name="insurance_expiry_date" value={formData.insurance_expiry_date} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                            </div>
                        </div>
                    )}

                    {formData.collateral_type === 'motor_vehicle' && (
                        <div className="pt-6 border-t border-border animate-in fade-in slide-in-from-top-4">
                            <div className="flex items-center gap-2 text-cyan-400 mb-4">
                                <Car className="h-4 w-4" />
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Asset Tracking system</h3>
                            </div>

                            <div className="mb-4">
                                <label className="flex items-center gap-3 p-4 rounded-xl border border-border bg-input/50 cursor-pointer hover:bg-input transition-colors">
                                    <input
                                        type="checkbox"
                                        name="tracker_installed"
                                        checked={formData.tracker_installed}
                                        onChange={(e) => setFormData({ ...formData, tracker_installed: e.target.checked })}
                                        className="h-5 w-5 rounded border-gray-600 text-primary focus:ring-primary"
                                    />
                                    <div className="flex-1">
                                        <p className="font-bold text-foreground text-sm">Tracker Installed?</p>
                                        <p className="text-xs text-muted-foreground">Check this if the vehicle allows real-time location tracking.</p>
                                    </div>
                                    <CheckCircle2 className={`h-5 w-5 ${formData.tracker_installed ? 'text-primary' : 'text-muted-foreground/30'}`} />
                                </label>
                            </div>

                            {formData.tracker_installed && (
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in-95">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tracking Company</label>
                                        <input type="text" name="tracker_company" required placeholder="e.g. RiverCross Tracking" value={formData.tracker_company} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Device ID / S/N</label>
                                        <input type="text" name="tracker_device_id" required placeholder="IMEI or Serial Number" value={formData.tracker_device_id} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Installation Date</label>
                                        <input type="date" name="tracker_installation_date" value={formData.tracker_installation_date} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Valuation */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 text-amber-500 mb-4">
                        <Sparkles className="h-5 w-5" />
                        <h2 className="text-lg font-semibold text-foreground uppercase tracking-wider text-xs">Valuation Metrics</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Market Value (KES)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">KES</span>
                                <input type="number" name="market_value" required value={formData.market_value} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-3 pl-14 pr-4 text-foreground font-bold text-xl focus:ring-primary" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Forced Sale Value (KES)</label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">KES</span>
                                <input type="number" name="forced_sale_value" required value={formData.forced_sale_value} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-3 pl-14 pr-4 text-amber-500 font-bold text-xl focus:ring-amber-500" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Valuation Date</label>
                            <input type="date" name="valuation_date" required value={formData.valuation_date} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-3 px-4 text-foreground text-lg" />
                        </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 font-heading">Select Accredited Valuation Company</label>
                        <select
                            name="valuer"
                            required
                            value={formData.valuer}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-medium focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="">Choose a partner...</option>
                            {valuers.map(v => (
                                <option key={v.id} value={v.id}>{v.name}</option>
                            ))}
                        </select>
                        <p className="text-[10px] text-muted-foreground mt-2 italic font-heading">Only accredited valuation partners can verify institutional collateral.</p>
                    </div>

                    <div className="pt-6 border-t border-border">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Upload className="h-3 w-3" /> Ownership Document (Logbook/Title)
                        </label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-input border-border hover:bg-slate-900 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground">
                                        <span className="font-semibold">{documentFile ? documentFile.name : 'Click to upload'}</span>
                                    </p>
                                    <p className="text-xs text-slate-600">PDF, PNG, JPG (MAX. 10MB)</p>
                                </div>
                                <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.png,.jpg,.jpeg" />
                            </label>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4 p-6 glass rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Discard
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Saving Security...' : 'Save Collateral Asset'}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default function NewCollateralPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Loading form...</div>}>
            <CollateralForm />
        </Suspense>
    );
}
