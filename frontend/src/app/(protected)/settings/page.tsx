'use client';

import { useState, useEffect } from 'react';
import {
    Building2,
    Palette,
    Smartphone,
    Settings,
    Save,
    Upload,
    Loader2,
    CheckCircle2,
    FileText
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';
import { useSettingsStore } from '@/store/useSettingsStore';

export default function SettingsPage() {
    const { settings, setSettings } = useSettingsStore();
    const [activeTab, setActiveTab] = useState('general');
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    const [formData, setFormData] = useState<any>({
        // General
        company_name: '',
        company_tagline: '',
        company_email: '',
        company_phone: '',
        company_address: '',
        website: '',
        registration_number: '',
        tax_identification: '',

        // Branding
        primary_color: '#2EAD8F',
        secondary_color: '#3B82F6',

        // Integrations
        mpesa_environment: 'sandbox',
        mpesa_shortcode: '',
        mpesa_consumer_key: '',
        mpesa_consumer_secret: '',
        mpesa_passkey: '',
        mpesa_initiator_name: '',
        mpesa_initiator_password: '',
        mpesa_security_credential: '',
        sms_provider: 'africas_talking',
        sms_sender_id: '',
        sms_api_key: '',
        sms_api_secret: '',

        // Email (SMTP)
        smtp_host: '',
        smtp_port: '587',
        smtp_use_tls: true,
        smtp_username: '',
        smtp_password: '',
        smtp_from_email: '',

        // Verification
        crb_enabled: false,
        crb_provider: 'metropol',
        crb_api_key: '',
        identity_enabled: false,
        identity_provider: 'smile_identity',
        identity_api_key: '',

        // Preferences
        is_ai_enabled: false,
        is_automation_enabled: false,
        is_branches_enabled: true,
        max_branches_limit: 10,

        // More Company Info
        company_postal_address: '',
        company_city: '',
        company_country: '',
        report_footer_text: '',
    });

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const response = await api.get('/settings/site/');
            const s = response.data;

            setFormData({
                ...s,
            });

            if (s.logo) {
                setLogoPreview(s.logo);
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox'
            ? (e.target as HTMLInputElement).checked
            : e.target.value;

        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = new FormData();

            // Add all form fields to FormData
            Object.keys(formData).forEach(key => {
                const value = formData[key];
                if (value !== null && value !== undefined && key !== 'logo') {
                    if (typeof value === 'boolean') {
                        payload.append(key, value ? 'true' : 'false');
                    } else {
                        payload.append(key, value);
                    }
                }
            });

            // 1. Add Logo if changed
            if (logoFile) {
                payload.append('logo', logoFile);
            }

            // 2. Update Settings
            const res = await api.patch(`/settings/${formData.id}/`, payload, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // 3. Update Global Store
            setSettings(res.data);

            alert('Settings saved successfully!');
        } catch (error: any) {
            console.error('Failed to save settings:', error);
            if (error.response?.status === 413) {
                alert('File too large! Please upload a logo smaller than 10MB.');
            } else if (error.response?.data) {
                const msg = typeof error.response.data === 'string'
                    ? error.response.data
                    : JSON.stringify(error.response.data);
                alert(`Failed to save: ${msg}`);
            } else {
                alert('Failed to save settings. Please try again.');
            }
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading settings...</div>;

    return (
        <div className="space-y-6 max-w-5xl mx-auto pb-12">
            <div>
                <h1 className="text-3xl font-bold text-foreground font-heading">Workspace Settings</h1>
                <p className="text-muted-foreground mt-1">Configure your organization profile, branding, and integrations.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Link href="/settings/branches" className="glass p-6 rounded-2xl border border-white/5 hover:border-primary/50 transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary border border-primary/20">
                            <Building2 className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground group-hover:text-primary transition-colors">Manage Branches</h3>
                            <p className="text-xs text-muted-foreground">Setup and monitor physical service centers.</p>
                        </div>
                    </div>
                </Link>
                <Link href="/settings/documents" className="glass p-6 rounded-2xl border border-white/5 hover:border-emerald-500/50 transition-all group">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                            <FileText className="h-6 w-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-foreground group-hover:text-emerald-400 transition-colors">Document Blueprints</h3>
                            <p className="text-xs text-muted-foreground">Customize HTML templates for loans and offers.</p>
                        </div>
                    </div>
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Sidebar Navigation */}
                <div className="lg:w-64 flex-shrink-0 space-y-2">
                    {[
                        { id: 'general', label: 'General Profile', icon: Building2 },
                        { id: 'branding', label: 'Branding & Look', icon: Palette },
                        { id: 'integrations', label: 'Integrations', icon: Smartphone },
                        { id: 'preferences', label: 'System Preferences', icon: Settings },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-sm ${activeTab === tab.id
                                ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 space-y-6">
                    {activeTab === 'general' && (
                        <div className="glass rounded-xl p-8 border border-border space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h2 className="text-lg font-bold text-foreground mb-4">Organization Profile</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Company Name</label>
                                    <input type="text" name="company_name" value={formData.company_name} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tagline / Slogan</label>
                                    <input type="text" name="company_tagline" value={formData.company_tagline} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Registration No.</label>
                                    <input type="text" name="registration_number" value={formData.registration_number} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Tax ID / KRA PIN</label>
                                    <input type="text" name="tax_identification" value={formData.tax_identification} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Email</label>
                                    <input type="email" name="company_email" value={formData.company_email} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Phone</label>
                                    <input type="text" name="company_phone" value={formData.company_phone} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div className="col-span-2 md:col-span-1">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Postal Address</label>
                                    <input type="text" name="company_postal_address" value={formData.company_postal_address} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" placeholder="P.O. Box 12345" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">City</label>
                                    <input type="text" name="company_city" value={formData.company_city} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Country</label>
                                    <input type="text" name="company_country" value={formData.company_country} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Physical Address</label>
                                    <textarea name="company_address" rows={2} value={formData.company_address} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Report Footer Text</label>
                                    <textarea name="report_footer_text" rows={2} value={formData.report_footer_text} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" placeholder="Standard text appearing at the bottom of all generated reports." />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'branding' && (
                        <div className="glass rounded-xl p-8 border border-border space-y-8 animate-in fade-in slide-in-from-right-4">
                            <div>
                                <h2 className="text-lg font-bold text-foreground mb-4">Logo & Identity</h2>
                                <div className="flex items-start gap-6">
                                    <div className="h-24 w-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center overflow-hidden bg-muted relative group">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview.startsWith('http')
                                                    ? logoPreview.replace(/localhost(?!:)/, 'localhost:9090')
                                                    : logoPreview}
                                                alt="Logo Preview"
                                                className="h-full w-full object-contain"
                                            />
                                        ) : (
                                            <span className="text-xs text-muted-foreground">No Logo</span>
                                        )}
                                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <Upload className="h-6 w-6 text-foreground" />
                                        </div>
                                        <input type="file" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-sm font-bold text-foreground">Company Logo</h3>
                                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                                            Upload your official logo. Recommended size: 400x400px. PNG or JPG.
                                            This will appear on the sidebar and generated PDF reports.
                                        </p>
                                        <button className="relative px-4 py-2 bg-muted hover:bg-white/10 text-foreground text-xs font-bold rounded-lg transition-colors">
                                            Choose File
                                            <input type="file" onChange={handleLogoChange} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-8 border-t border-border">
                                <h2 className="text-lg font-bold text-foreground mb-4">Theme Colors</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Primary Color</label>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg border border-white/10 shadow-lg" style={{ backgroundColor: formData.primary_color }}></div>
                                            <input type="text" name="primary_color" value={formData.primary_color} onChange={handleChange} className="flex-1 bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            <input type="color" name="primary_color" value={formData.primary_color} onChange={handleChange} className="h-10 w-10 bg-transparent border-0 cursor-pointer" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2">Used for buttons, active states, and highlights.</p>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Secondary Color</label>
                                        <div className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-lg border border-white/10 shadow-lg" style={{ backgroundColor: formData.secondary_color }}></div>
                                            <input type="text" name="secondary_color" value={formData.secondary_color} onChange={handleChange} className="flex-1 bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            <input type="color" name="secondary_color" value={formData.secondary_color} onChange={handleChange} className="h-10 w-10 bg-transparent border-0 cursor-pointer" />
                                        </div>
                                        <p className="text-[10px] text-muted-foreground mt-2">Used for accents and gradients.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}


                    {activeTab === 'integrations' && (
                        <div className="glass rounded-xl p-8 border border-border space-y-8 animate-in fade-in slide-in-from-right-4">
                            {/* M-PESA */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-emerald-400">M-Pesa Configuration</h2>
                                    <span className="px-2 py-1 rounded bg-slate-800 text-[10px] uppercase font-bold text-muted-foreground border border-border">Daraja API</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Environment</label>
                                        <select name="mpesa_environment" value={formData.mpesa_environment} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground">
                                            <option value="sandbox">Sandbox (Testing)</option>
                                            <option value="production">Production (Live)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Shortcode / Paybill</label>
                                        <input type="text" name="mpesa_shortcode" value={formData.mpesa_shortcode} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Consumer Key</label>
                                        <input type="text" name="mpesa_consumer_key" value={formData.mpesa_consumer_key} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono opacity-50 focus:opacity-100 transition-opacity" placeholder="••••••••••••••••" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Consumer Secret</label>
                                        <input type="password" name="mpesa_consumer_secret" value={formData.mpesa_consumer_secret} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono opacity-50 focus:opacity-100 transition-opacity" placeholder="••••••••••••••••" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Passkey (Lipa na M-Pesa Online)</label>
                                        <input type="password" name="mpesa_passkey" value={formData.mpesa_passkey} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono opacity-50 focus:opacity-100 transition-opacity" placeholder="••••••••••••••••" />
                                    </div>

                                    <div className="col-span-2 pt-4 border-t border-white/5">
                                        <h3 className="text-sm font-bold text-foreground mb-3 italic">B2C / Disbursements Configuration</h3>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Initiator Name</label>
                                                <input type="text" name="mpesa_initiator_name" value={formData.mpesa_initiator_name} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Initiator Password</label>
                                                <input type="password" name="mpesa_initiator_password" value={formData.mpesa_initiator_password} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            </div>
                                            <div className="col-span-2">
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Security Credential</label>
                                                <textarea name="mpesa_security_credential" rows={3} value={formData.mpesa_security_credential} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono text-xs" placeholder="Paste your Daraja security credential here..." />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SMS GATEWAY */}
                            <div className="pt-8 border-t border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-amber-400">SMS Gateway Configuration</h2>
                                    <span className="px-2 py-1 rounded bg-slate-800 text-[10px] uppercase font-bold text-muted-foreground border border-border">Communication</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">SMS Provider</label>
                                        <select name="sms_provider" value={formData.sms_provider} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground">
                                            <option value="africas_talking">Africa's Talking (Kenya)</option>
                                            <option value="advanta">Advanta SMS (Kenya)</option>
                                            <option value="celecom">Celecom (Kenya)</option>
                                            <option value="infobip">Infobip</option>
                                            <option value="other">Other (Gateway)</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Sender ID / Shortcode</label>
                                        <input type="text" name="sms_sender_id" value={formData.sms_sender_id} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" placeholder="AURUMFIN" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">API Key</label>
                                        <input type="password" name="sms_api_key" value={formData.sms_api_key} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                    </div>
                                    {['africas_talking', 'infobip'].includes(formData.sms_provider) && (
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">API Secret / App Username</label>
                                            <input type="text" name="sms_api_secret" value={formData.sms_api_secret} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EMAIL (SMTP) */}
                            <div className="pt-8 border-t border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-blue-400">Email Server (SMTP)</h2>
                                    <span className="px-2 py-1 rounded bg-slate-800 text-[10px] uppercase font-bold text-muted-foreground border border-border">Communication</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">SMTP Host</label>
                                        <input type="text" name="smtp_host" value={formData.smtp_host} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" placeholder="smtp.gmail.com" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Port</label>
                                        <input type="number" name="smtp_port" value={formData.smtp_port} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" placeholder="587" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Use TLS</label>
                                        <select name="smtp_use_tls" value={formData.smtp_use_tls ? 'true' : 'false'} onChange={(e) => setFormData({ ...formData, smtp_use_tls: e.target.value === 'true' })} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground">
                                            <option value="true">Yes (Secure)</option>
                                            <option value="false">No</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Username</label>
                                        <input type="text" name="smtp_username" value={formData.smtp_username} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Password</label>
                                        <input type="password" name="smtp_password" value={formData.smtp_password} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono opacity-50 focus:opacity-100 transition-opacity" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">From Email Address</label>
                                        <input type="email" name="smtp_from_email" value={formData.smtp_from_email} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" placeholder="no-reply@company.com" />
                                    </div>
                                </div>
                            </div>

                            {/* VERIFICATION SERVICES */}
                            <div className="pt-8 border-t border-border">
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-lg font-bold text-purple-400">KYC & Credit Checks</h2>
                                    <span className="px-2 py-1 rounded bg-slate-800 text-[10px] uppercase font-bold text-muted-foreground border border-border">Verification</span>
                                </div>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-slate-800">
                                        <div>
                                            <h3 className="text-foreground font-bold text-sm">Credit Reference Bureau (CRB)</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Enable automated credit checks for new customers.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="crb_enabled" checked={formData.crb_enabled} onChange={handleChange} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    {formData.crb_enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Provider</label>
                                                <select name="crb_provider" value={formData.crb_provider} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground">
                                                    <option value="metropol">Metropol (Kenya)</option>
                                                    <option value="transunion">TransUnion (Kenya)</option>
                                                    <option value="creditinfo">Creditinfo (Kenya)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">API Key</label>
                                                <input type="password" name="crb_api_key" value={formData.crb_api_key} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-slate-800">
                                        <div>
                                            <h3 className="text-foreground font-bold text-sm">Identity Verification</h3>
                                            <p className="text-xs text-muted-foreground mt-1">Verify National IDs using biometric integration.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="identity_enabled" checked={formData.identity_enabled} onChange={handleChange} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-500/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                                        </label>
                                    </div>

                                    {formData.identity_enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Provider</label>
                                                <select name="identity_provider" value={formData.identity_provider} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground">
                                                    <option value="smile_identity">Smile Identity (Kenya/Global)</option>
                                                    <option value="metamap">Metamap (Global)</option>
                                                    <option value="other">Other</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">API Key</label>
                                                <input type="password" name="identity_api_key" value={formData.identity_api_key} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground font-mono" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'preferences' && (
                        <div className="glass rounded-xl p-8 border border-border space-y-6 animate-in fade-in slide-in-from-right-4">
                            <h2 className="text-lg font-bold text-foreground mb-4">System Intelligence</h2>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-slate-800">
                                <div>
                                    <h3 className="text-foreground font-bold text-sm">AI Agent Automation</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Allow AI to parse valuation reports and suggest categorizations automatically.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="is_ai_enabled" checked={formData.is_ai_enabled} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-slate-800">
                                <div>
                                    <h3 className="text-foreground font-bold text-sm">Automated Workflows</h3>
                                    <p className="text-xs text-muted-foreground mt-1">Enable auto-triggering of valuation requests and reminder emails.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" name="is_automation_enabled" checked={formData.is_automation_enabled} onChange={handleChange} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                </label>
                            </div>

                            <div className="pt-6 border-t border-border">
                                <h3 className="text-lg font-bold text-foreground mb-4">Branch Management</h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-4 rounded-xl bg-input border border-slate-800">
                                        <div>
                                            <h4 className="text-foreground font-bold text-sm">Enable Branches</h4>
                                            <p className="text-xs text-muted-foreground mt-1">Allows you to categorize users and data into different physical branches.</p>
                                        </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input type="checkbox" name="is_branches_enabled" checked={formData.is_branches_enabled} onChange={handleChange} className="sr-only peer" />
                                            <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                        </label>
                                    </div>

                                    {formData.is_branches_enabled && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Maximum Branches Limit</label>
                                                <input type="number" name="max_branches_limit" value={formData.max_branches_limit} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground" min="1" max="100" />
                                                <p className="text-[10px] text-muted-foreground mt-2">Maximum number of branches allowed under your current plan.</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="flex items-center gap-2 px-10 py-3 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 hover:translate-y-[-1px] transition-all active:scale-95 disabled:opacity-50"
                        >
                            {isSaving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {isSaving ? 'Saving Changes...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
