'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, User, Building2, Mail, Phone, MapPin, Landmark } from 'lucide-react';
import api from '@/lib/api';

export default function NewInvestorPage() {
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        investor_type: 'individual',
        email: '',
        phone: '',
        address: '',
        id_number: '',
        kra_pin: '',
        bank_name: '',
        bank_account: '',
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post('/investors/investors/', formData);
            router.push('/investors');
        } catch (error) {
            console.error('Failed to create investor:', error);
            alert('Failed to create investor. Please check the data.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">New Investor</h1>
                    <p className="text-muted-foreground mt-1">Onboard a new capital provider</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Information */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Basic Information</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Full Name / Entity Name</label>
                            <input
                                type="text"
                                name="name"
                                required
                                value={formData.name}
                                onChange={handleChange}
                                placeholder="e.g., John Doe or Aurum Holdings Ltd"
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Investor Type</label>
                            <select
                                name="investor_type"
                                required
                                value={formData.investor_type}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            >
                                <option value="individual">Individual</option>
                                <option value="company">Company</option>
                                <option value="institution">Institution</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">National ID / Reg No.</label>
                            <input
                                type="text"
                                name="id_number"
                                required
                                value={formData.id_number}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Mail className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Contact Details</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                            <div className="relative">
                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="email"
                                    name="email"
                                    required
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="tel"
                                    name="phone"
                                    required
                                    value={formData.phone}
                                    onChange={handleChange}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Physical Address</label>
                            <div className="relative">
                                <MapPin className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
                                <textarea
                                    name="address"
                                    rows={3}
                                    value={formData.address}
                                    onChange={handleChange}
                                    className="w-full bg-input border border-border rounded-lg py-2.5 pl-11 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Financial Details */}
                <div className="glass rounded-xl p-8 border border-border space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Landmark className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Financial & Settlement</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">KRA PIN</label>
                            <input
                                type="text"
                                name="kra_pin"
                                value={formData.kra_pin}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary uppercase font-mono"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Bank Name</label>
                            <input
                                type="text"
                                name="bank_name"
                                value={formData.bank_name}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-300 mb-2">Bank Account Number</label>
                            <input
                                type="text"
                                name="bank_account"
                                value={formData.bank_account}
                                onChange={handleChange}
                                className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                            />
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-4">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-10 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 disabled:opacity-50"
                    >
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Creating...' : 'Create Investor'}
                    </button>
                </div>
            </form>
        </div>
    );
}
