'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
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

export default function EditCollateralPage() {
    const router = useRouter();
    const params = useParams();
    const collateralId = params.id;

    const [borrowers, setBorrowers] = useState<any[]>([]);
    const [valuers, setValuers] = useState<any[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [documentFile, setDocumentFile] = useState<File | null>(null);
    const [existingDocument, setExistingDocument] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        borrower: '',
        collateral_type: 'motor_vehicle',
        market_value: '',
        forced_sale_value: '',
        valuation_date: '',
        valuer: '',
        description: '',
        reg_number: '',
        make: '',
        model: '',
        year_of_manufacture: '',
        logbook_number: '',
        lr_number: '',
        location: '',
        property_size: '',
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
                const [borrowersRes, valuersRes, collateralRes] = await Promise.all([
                    api.get('/customers/borrowers/'),
                    api.get('/collateral/valuers/'),
                    api.get(`/collateral/collateral/${collateralId}/`)
                ]);

                setBorrowers(borrowersRes.data.results || borrowersRes.data);
                setValuers(valuersRes.data.results || valuersRes.data);

                const c = collateralRes.data;
                setExistingDocument(c.document_upload || null);

                setFormData({
                    borrower: c.borrower?.toString() || '',
                    collateral_type: c.collateral_type || 'motor_vehicle',
                    market_value: c.market_value?.toString() || '',
                    forced_sale_value: c.forced_sale_value?.toString() || '',
                    valuation_date: c.valuation_date || '',
                    valuer: c.valuer?.toString() || '',
                    description: c.description || '',
                    reg_number: c.reg_number || '',
                    make: c.make || '',
                    model: c.model || '',
                    year_of_manufacture: c.year_of_manufacture?.toString() || '',
                    logbook_number: c.logbook_number || '',
                    lr_number: c.lr_number || '',
                    location: c.location || '',
                    property_size: c.property_size || '',
                    insurance_start_date: c.insurance_start_date || '',
                    insurance_expiry_date: c.insurance_expiry_date || '',
                    tracker_installed: c.tracker_installed || false,
                    tracker_company: c.tracker_company || '',
                    tracker_device_id: c.tracker_device_id || '',
                    tracker_installation_date: c.tracker_installation_date || '',
                    chassis_number: c.chassis_number || '',
                    engine_number: c.engine_number || '',
                    color: c.color || '',
                });
            } catch (error) {
                console.error('Failed to fetch data:', error);
                alert('Failed to load collateral data.');
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, [collateralId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setDocumentFile(e.target.files[0]);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const dataToSend = new FormData();

            Object.entries(formData).forEach(([key, value]) => {
                if (value !== '' && value !== null && value !== undefined) {
                    dataToSend.append(key, value.toString());
                }
            });

            if (documentFile) {
                dataToSend.append('document_upload', documentFile);
            }

            await api.patch(`/collateral/collateral/${collateralId}/`, dataToSend, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            router.push(`/collateral/${collateralId}`);
        } catch (error: any) {
            console.error('Failed to update collateral:', error);
            const detail = error.response?.data;
            if (detail && typeof detail === 'object') {
                const msgs = Object.entries(detail).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n');
                alert(`Validation errors:\n${msgs}`);
            } else {
                alert('Failed to update collateral. Please check required fields.');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const getBorrowerName = (b: any) => {
        if (b.borrower_type === 'company' || b.borrower_type === 'institution') return b.business_name;
        return `${b.first_name} ${b.last_name}`;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading collateral data...</p>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-3xl font-bold text-foreground font-heading">Edit Collateral</h1>
                        <p className="text-muted-foreground mt-1">Update security asset details</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
                {/* Asset Assignment */}
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

                {/* Technical Identification */}
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
                                <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Asset Tracking System</h3>
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
                    </div>

                    <div className="pt-6 border-t border-border">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Description / Notes</label>
                        <textarea
                            name="description"
                            rows={3}
                            value={formData.description}
                            onChange={handleChange}
                            placeholder="Additional notes about this collateral..."
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    <div className="pt-6 border-t border-border">
                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-2">
                            <Upload className="h-3 w-3" /> Ownership Document (Logbook/Title)
                        </label>
                        {existingDocument && !documentFile && (
                            <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                <span className="text-sm text-emerald-400">Document already uploaded</span>
                                <a href={existingDocument} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline ml-auto">View</a>
                            </div>
                        )}
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-input border-border hover:bg-slate-900 transition-all">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <Upload className="w-8 h-8 mb-4 text-muted-foreground" />
                                    <p className="mb-2 text-sm text-muted-foreground">
                                        <span className="font-semibold">{documentFile ? documentFile.name : 'Click to upload new document'}</span>
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
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Saving Changes...' : 'Update Collateral'}
                    </button>
                </div>
            </form>
        </div>
    );
}
