'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, User, Phone, MapPin, Briefcase, Save, Building2 } from 'lucide-react';
import api from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';

export default function BorrowerEditPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useAuthStore();
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formData, setFormData] = useState({
        borrower_type: 'individual',
        first_name: '',
        last_name: '',
        business_name: '',
        contacts: [
            { first_name: '', last_name: '', phone_number: '', email: '', designation: '', is_primary: true }
        ],
        email: '',
        phone_number: '',
        id_type: 'national_id',
        id_number: '',
        tax_id: '',
        date_of_birth: '',
        incorporation_date: '',
        physical_address: '',
        city: '',
        postal_code: '',
        county: '',
        country: 'Kenya',
        employment_status: 'employed',
        monthly_income: '',
        additional_phones: [] as any[],
    });

    useEffect(() => {
        if (!params.id) return;

        const fetchBorrower = async () => {
            try {
                const response = await api.get(`/customers/borrowers/${params.id}/`);
                const data = response.data;
                setFormData({
                    ...data,
                    monthly_income: data.monthly_income?.toString() || '',
                    date_of_birth: data.date_of_birth || '',
                    incorporation_date: data.incorporation_date || '',
                    contacts: data.contacts?.length > 0 ? data.contacts : [{ first_name: '', last_name: '', phone_number: '', email: '', designation: '', is_primary: true }],
                    additional_phones: data.additional_phones || [],
                });
            } catch (error) {
                console.error('Failed to fetch borrower:', error);
                alert('Failed to fetch borrower details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchBorrower();
    }, [params.id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            // Clean the data: convert empty strings to null only for specific optional fields
            // For most fields, empty string is better than null to avoid database constraint issues
            const readOnlyFields = [
                'is_verified', 'verification_status', 'verification_notes',
                'verified_by', 'verified_at', 'created_by', 'created_at',
                'updated_at', 'borrower_number', 'crb_score', 'internal_score', 'hybrid_score', 'last_crb_check'
            ];

            const nullableFields = ['email', 'tax_id', 'date_of_birth', 'incorporation_date', 'monthly_income'];

            const sanitizedData = Object.entries(formData).reduce((acc, [key, value]) => {
                // Skip read-only fields
                if (readOnlyFields.includes(key)) return acc;

                if (nullableFields.includes(key)) {
                    acc[key] = value === '' ? null : value;
                } else if (value === '' && !['contacts', 'additional_phones'].includes(key)) {
                    // For non-nullable strings, keep as empty string rather than converting to null
                    acc[key] = '';
                } else {
                    acc[key] = value;
                }
                return acc;
            }, {} as any);

            // Special handling for contacts to ensure they are also cleaned
            if (sanitizedData.contacts) {
                sanitizedData.contacts = sanitizedData.contacts.map((contact: any) => {
                    const cleanedContact = { ...contact };
                    // For contacts, we can be more aggressive with nulling optional fields if the backend allows
                    ['email', 'designation'].forEach(key => {
                        if (cleanedContact[key] === '') cleanedContact[key] = null;
                    });
                    return cleanedContact;
                });
            }

            if (sanitizedData.additional_phones) {
                sanitizedData.additional_phones = sanitizedData.additional_phones.filter((p: any) => p.phone_number).map((phone: any) => {
                    const cleanedPhone = { ...phone };
                    if (cleanedPhone.description === '') cleanedPhone.description = null;
                    return cleanedPhone;
                });
            }

            await api.patch(`/customers/borrowers/${params.id}/`, sanitizedData);
            router.push(`/borrowers/${params.id}`);
        } catch (error) {
            console.error('Failed to update borrower:', error);
            alert('Failed to update borrower. Please check the form.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        if (name === 'borrower_type') {
            if (value === 'company' || value === 'institution') {
                setFormData(prev => ({ ...prev, [name]: value, id_type: 'registration_cert', employment_status: 'operational' }));
            } else {
                setFormData(prev => ({ ...prev, [name]: value, id_type: 'national_id', employment_status: 'employed' }));
            }
        }
    };

    const handleContactChange = (index: number, field: string, value: any) => {
        const newContacts = [...formData.contacts];
        newContacts[index] = { ...newContacts[index], [field]: value };
        if (field === 'is_primary' && value === true) {
            newContacts.forEach((c, i) => { if (i !== index) c.is_primary = false; });
        }
        setFormData(prev => ({ ...prev, contacts: newContacts }));
    };

    const addContact = () => {
        setFormData(prev => ({
            ...prev,
            contacts: [...prev.contacts, { first_name: '', last_name: '', phone_number: '', email: '', designation: '', is_primary: false }]
        }));
    };

    const removeContact = (index: number) => {
        if (formData.contacts.length <= 1) return;
        const newContacts = formData.contacts.filter((_, i) => i !== index);
        if (!newContacts.some(c => c.is_primary)) newContacts[0].is_primary = true;
        setFormData(prev => ({ ...prev, contacts: newContacts }));
    };

    const handlePhoneChange = (index: number, field: string, value: any) => {
        const newPhones = [...formData.additional_phones];
        newPhones[index] = { ...newPhones[index], [field]: value };
        if (field === 'is_mpesa' && value === true) {
            newPhones.forEach((p, i) => { if (i !== index) p.is_mpesa = false; });
        }
        setFormData(prev => ({ ...prev, additional_phones: newPhones }));
    };

    const addPhone = () => {
        setFormData(prev => ({
            ...prev,
            additional_phones: [...prev.additional_phones, { phone_number: '', description: '', is_mpesa: false }]
        }));
    };

    const removePhone = (index: number) => {
        const newPhones = formData.additional_phones.filter((_, i) => i !== index);
        setFormData(prev => ({ ...prev, additional_phones: newPhones }));
    };

    const isIndividual = formData.borrower_type === 'individual';

    if (isLoading) return <div className="p-8">Loading borrower data...</div>;

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex items-center gap-4">
                <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                    <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading">Edit Borrower</h1>
                    <p className="text-muted-foreground mt-1">Update borrower information</p>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <User className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Borrower Type</h2>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-300 mb-2">Type of Borrower</label>
                        <select
                            name="borrower_type"
                            value={formData.borrower_type}
                            onChange={handleChange}
                            className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="individual">Individual</option>
                            <option value="company">Company</option>
                            <option value="institution">Institution</option>
                            <option value="group">Group</option>
                        </select>
                    </div>
                </div>

                {isIndividual ? (
                    <div className="glass rounded-xl p-6 border border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <User className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Personal Information</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">First Name</label>
                                <input type="text" name="first_name" required={isIndividual} value={formData.first_name || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Last Name</label>
                                <input type="text" name="last_name" required={isIndividual} value={formData.last_name || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Date of Birth</label>
                                <input type="date" name="date_of_birth" required={isIndividual} value={formData.date_of_birth} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Email (Optional)</label>
                                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="glass rounded-xl p-6 border border-border">
                        <div className="flex items-center gap-2 mb-4">
                            <Building2 className="h-5 w-5 text-primary" />
                            <h2 className="text-lg font-semibold text-foreground">Entity Information</h2>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-slate-300 mb-2">Business/Entity Name</label>
                                <input type="text" name="business_name" required={!isIndividual} value={formData.business_name || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Date of Incorporation</label>
                                <input type="date" name="incorporation_date" required={!isIndividual} value={formData.incorporation_date} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Tax ID / KRA PIN</label>
                                <input type="text" name="tax_id" required={!isIndividual} value={formData.tax_id || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Entity Email (Optional)</label>
                                <input type="email" name="email" value={formData.email || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                            </div>
                        </div>

                        <div className="mt-8 space-y-4">
                            <div className="flex items-center justify-between border-t border-border pt-6">
                                <h3 className="text-md font-semibold text-foreground">Contact Persons</h3>
                                <button type="button" onClick={addContact} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">+ Add Another Contact</button>
                            </div>
                            <div className="space-y-6">
                                {formData.contacts.map((contact, index) => (
                                    <div key={index} className="p-4 rounded-xl bg-muted/30 border border-border/50 relative group">
                                        {formData.contacts.length > 1 && (
                                            <button type="button" onClick={() => removeContact(index)} className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        )}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">First Name</label>
                                                <input type="text" required value={contact.first_name || ''} onChange={(e) => handleContactChange(index, 'first_name', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Last Name</label>
                                                <input type="text" required value={contact.last_name || ''} onChange={(e) => handleContactChange(index, 'last_name', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Designation</label>
                                                <input type="text" placeholder="e.g. Director" value={contact.designation || ''} onChange={(e) => handleContactChange(index, 'designation', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                                                <input type="tel" required value={contact.phone_number || ''} onChange={(e) => handleContactChange(index, 'phone_number', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                                                <input type="email" value={contact.email || ''} onChange={(e) => handleContactChange(index, 'email', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                                            </div>
                                            <div className="flex items-end pb-1.5">
                                                <label className="flex items-center gap-2 cursor-pointer group/primary">
                                                    <input type="checkbox" checked={contact.is_primary} onChange={(e) => handleContactChange(index, 'is_primary', e.target.checked)} className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-primary" />
                                                    <span className="text-xs font-medium text-slate-400 group-hover/primary:text-foreground transition-colors">Primary Contact</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Phone className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Contact & Address</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Main Phone Number</label>
                            <input type="tel" name="phone_number" required placeholder="+254712345678" value={formData.phone_number || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        {isIndividual && (
                            <div className="md:col-span-2 mt-4 space-y-4">
                                <div className="flex items-center justify-between border-t border-border pt-6">
                                    <h3 className="text-md font-semibold text-foreground">Additional Phone Numbers</h3>
                                    <button type="button" onClick={addPhone} className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">+ Add Another Number</button>
                                </div>
                                <div className="grid grid-cols-1 gap-4">
                                    {formData.additional_phones.map((phone, index) => (
                                        <div key={index} className="p-4 rounded-xl bg-muted/30 border border-border/50 relative group">
                                            <button type="button" onClick={() => removePhone(index)} className="absolute top-2 right-2 p-1.5 rounded-full hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-400 mb-1">Phone Number</label>
                                                    <input type="tel" value={phone.phone_number || ''} onChange={(e) => handlePhoneChange(index, 'phone_number', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="+254..." />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-slate-400 mb-1">Description</label>
                                                    <input type="text" value={phone.description || ''} onChange={(e) => handlePhoneChange(index, 'description', e.target.value)} className="w-full bg-input border border-border rounded-lg py-1.5 px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="e.g. Work" />
                                                </div>
                                                <div className="flex items-end pb-1.5">
                                                    <label className="flex items-center gap-2 cursor-pointer group/mpesa">
                                                        <input type="checkbox" checked={phone.is_mpesa} onChange={(e) => handlePhoneChange(index, 'is_mpesa', e.target.checked)} className="h-4 w-4 rounded border-border bg-input text-primary focus:ring-primary" />
                                                        <span className="text-xs font-medium text-slate-400 group-hover/mpesa:text-foreground transition-colors">M-Pesa Number</span>
                                                    </label>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Physical Address</label>
                            <input type="text" name="physical_address" required value={formData.physical_address || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" placeholder="Street, Building, etc." />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">City</label>
                            <input type="text" name="city" required value={formData.city || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">County</label>
                            <input type="text" name="county" required value={formData.county || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Postal Code</label>
                            <input type="text" name="postal_code" value={formData.postal_code || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Country</label>
                            <input type="text" name="country" required value={formData.country || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <MapPin className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">Identification</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">ID/Reg Type</label>
                            <select name="id_type" value={formData.id_type || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                                <option value="national_id">National ID</option>
                                <option value="passport">Passport</option>
                                <option value="driving_license">Driving License</option>
                                <option value="alien_id">Alien ID</option>
                                <option value="registration_cert">Registration Certificate</option>
                                <option value="incorporation_cert">Certificate of Incorporation</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">ID/Reg Number</label>
                            <input type="text" name="id_number" required value={formData.id_number || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                </div>

                <div className="glass rounded-xl p-6 border border-border">
                    <div className="flex items-center gap-2 mb-4">
                        <Briefcase className="h-5 w-5 text-primary" />
                        <h2 className="text-lg font-semibold text-foreground">{isIndividual ? 'Employment' : 'Financial'} Information</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">Status</label>
                            <select name="employment_status" value={formData.employment_status || ''} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary">
                                {isIndividual ? (
                                    <>
                                        <option value="employed">Employed</option>
                                        <option value="self_employed">Self-Employed</option>
                                        <option value="unemployed">Unemployed</option>
                                        <option value="retired">Retired</option>
                                        <option value="student">Student</option>
                                        <option value="business_owner">Business Owner</option>
                                    </>
                                ) : (
                                    <option value="operational">Operational</option>
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-300 mb-2">{isIndividual ? 'Monthly Income' : 'Monthly Revenue'} (KES)</label>
                            <input type="number" name="monthly_income" required value={formData.monthly_income} onChange={handleChange} className="w-full bg-input border border-border rounded-lg py-2.5 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-4">
                    <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-lg bg-input border border-border text-slate-300 hover:text-foreground transition-colors">Cancel</button>
                    <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 font-semibold shadow-lg shadow-primary/20">
                        <Save className="h-4 w-4" />
                        {isSubmitting ? 'Updating...' : 'Update Borrower'}
                    </button>
                </div>
            </form>
        </div>
    );
}
