'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Building2, Mail, Phone, Layers, CheckCircle2 } from 'lucide-react';
import api from '@/lib/api';

const VALUATION_TYPES = [
    { id: 'motor_vehicle', label: 'Motor Vehicle' },
    { id: 'land_property', label: 'Land/Property' },
    { id: 'business_asset', label: 'Business Asset' },
    { id: 'chattels', label: 'Household/Office Chattels' },
    { id: 'shares', label: 'Shares/Stocks' },
    { id: 'fixed_deposit', label: 'Fixed Deposit' },
];

export default function NewValuerPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        valuation_types: [] as string[],
        is_active: true,
    });

    const toggleType = (typeId: string) => {
        setFormData(prev => ({
            ...prev,
            valuation_types: prev.valuation_types.includes(typeId)
                ? prev.valuation_types.filter(id => id !== typeId)
                : [...prev.valuation_types, typeId]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (formData.valuation_types.length === 0) {
            alert('Please select at least one specialization.');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/collateral/valuers/', formData);
            router.push('/collateral/valuers');
        } catch (error) {
            console.error('Failed to onboard valuer:', error);
            alert('Failed to onboard valuer. Please check the data.');
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
                    <h1 className="text-3xl font-bold text-foreground font-heading">Onboard Valuer</h1>
                    <p className="text-muted-foreground mt-1">Register a new external valuation partner</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-8 border border-border space-y-8">
                    {/* Basic Info */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-primary opacity-70">
                            <Building2 className="h-4 w-4" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Company Identity</h3>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Company / Valuer Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g. Aurum Valuations Ltd"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Email Address</label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="contact@valuer.com"
                                        className="w-full bg-input border border-border rounded-lg py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Phone Number</label>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                    <input
                                        type="tel"
                                        required
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+254..."
                                        className="w-full bg-input border border-border rounded-lg py-2.5 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Specializations */}
                    <div className="space-y-6">
                        <div className="flex items-center gap-2 text-emerald-400 opacity-70">
                            <Layers className="h-4 w-4" />
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Asset Specializations</h3>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            {VALUATION_TYPES.map(type => (
                                <button
                                    key={type.id}
                                    type="button"
                                    onClick={() => toggleType(type.id)}
                                    className={`flex items-center justify-between p-3 rounded-lg border transition-all text-left ${formData.valuation_types.includes(type.id)
                                            ? 'bg-primary/10 border-primary text-foreground'
                                            : 'bg-muted border-white/10 text-muted-foreground hover:border-white/20'
                                        }`}
                                >
                                    <span className="text-xs font-medium">{type.label}</span>
                                    {formData.valuation_types.includes(type.id) && <CheckCircle2 className="h-4 w-4 text-primary" />}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Onboarding...' : 'Onboard Valuer'}
                    </button>
                </div>
            </form>
        </div>
    );
}
