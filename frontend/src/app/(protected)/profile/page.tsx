'use client';

import { useState, useEffect } from 'react';
import { User, Mail, Shield, Phone, MapPin, Briefcase, Info, Save, Loader2, Camera, Lock } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import api from '@/lib/api';

export default function ProfilePage() {
    const { user, login } = useAuthStore();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    const [isPasswordSaving, setIsPasswordSaving] = useState(false);

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        profile: {
            phone_number: '',
            bio: '',
            job_title: '',
            location: '',
        }
    });

    useEffect(() => {
        if (user) {
            setFormData({
                first_name: user.first_name || '',
                last_name: user.last_name || '',
                profile: {
                    phone_number: user.profile?.phone_number || '',
                    bio: user.profile?.bio || '',
                    job_title: user.profile?.job_title || user.role?.name || '',
                    location: user.profile?.location || '',
                }
            });
        }
    }, [user]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const response = await api.patch(`/users/${user?.id}/`, formData);
            // Update the local storage/store with the new user data
            login(response.data, useAuthStore.getState().token!, useAuthStore.getState().refreshToken!);
            alert('Profile updated successfully!');
        } catch (error) {
            console.error('Failed to update profile:', error);
            alert('Failed to update profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            alert("New passwords do not match!");
            return;
        }

        if (passwordData.newPassword.length < 8) {
            alert("Password must be at least 8 characters long.");
            return;
        }

        setIsPasswordSaving(true);
        try {
            await api.post(`/users/${user?.id}/change_password/`, {
                old_password: passwordData.currentPassword,
                new_password: passwordData.newPassword
            });
            alert('Password changed successfully!');
            setPasswordData({
                currentPassword: '',
                newPassword: '',
                confirmPassword: ''
            });
        } catch (error: any) {
            console.error('Failed to change password:', error);
            const message = error.response?.data?.error || 'Failed to change password. Please check your current password and try again.';
            alert(typeof message === 'object' ? JSON.stringify(message) : message);
        } finally {
            setIsPasswordSaving(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('profile.avatar', file);

        try {
            setIsLoading(true);
            const response = await api.patch(`/users/${user?.id}/`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            login(response.data, useAuthStore.getState().token!, useAuthStore.getState().refreshToken!);
            alert('Avatar updated successfully!');
        } catch (error) {
            console.error('Failed to upload avatar:', error);
            alert('Failed to upload avatar. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            {/* Header / Banner */}
            <div className="relative h-48 rounded-3xl bg-gradient-to-r from-primary to-secondary shadow-lg">
                <div className="absolute inset-0 opacity-10 bg-grid-white/[0.2] rounded-3xl"></div>
                <div className="absolute -bottom-16 left-8 flex items-end gap-6 z-20">
                    <div className="relative group">
                        <div className="h-32 w-32 rounded-3xl bg-card border-4 border-background flex items-center justify-center shadow-xl overflow-hidden relative">
                            {isLoading ? (
                                <div className="absolute inset-0 bg-background/50 flex items-center justify-center z-10">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : null}
                            {user?.profile?.avatar ? (
                                <img
                                    src={user.profile.avatar.startsWith('http')
                                        ? user.profile.avatar.replace(/:8000/, ':9090')
                                        : user.profile.avatar}
                                    alt="Avatar"
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <User className="h-16 w-16 text-primary/40" />
                            )}
                        </div>
                        <label className="absolute bottom-2 right-2 p-2 rounded-xl bg-primary text-white shadow-lg hover:scale-110 transition-transform opacity-0 group-hover:opacity-100 cursor-pointer transition-all">
                            <Camera className="h-4 w-4" />
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleAvatarChange}
                            />
                        </label>
                    </div>
                    <div className="mb-4">
                        <h1 className="text-3xl font-bold text-white font-heading">{user?.first_name} {user?.last_name}</h1>
                        <p className="text-white/80 font-medium">{user?.role?.name || 'User'}</p>
                    </div>
                </div>
            </div>

            <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8 pt-8">
                {/* Information Cards */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="glass rounded-3xl p-6 border border-border shadow-sm">
                        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
                            <Info className="h-4 w-4" /> Quick Info
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-primary" />
                                <div className="min-w-0">
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="text-sm font-medium text-foreground truncate">{user?.email}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Shield className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Workspace Role</p>
                                    <p className="text-sm font-medium text-foreground">{user?.role?.name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <MapPin className="h-4 w-4 text-primary" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Location</p>
                                    <p className="text-sm font-medium text-foreground">{user?.profile?.location || 'Remote / Headquarters'}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="glass rounded-3xl p-6 border border-border bg-primary/5 shadow-sm">
                        <h3 className="text-sm font-bold text-primary uppercase tracking-widest mb-4">Security Tip</h3>
                        <p className="text-xs text-muted-foreground leading-relaxed italic">
                            Keep your workspace secure by updating your password every 90 days and using a strong, unique pass-phrase.
                        </p>
                    </div>
                </div>

                {/* Edit Form */}
                <div className="lg:col-span-2 space-y-8">
                    <form onSubmit={handleSubmit} className="glass rounded-3xl p-8 border border-border shadow-sm space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold text-foreground font-heading">Edit Profile</h2>
                            <p className="text-xs text-muted-foreground">Updated {new Date(user?.date_joined || '').toLocaleDateString()}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">First Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    value={formData.first_name}
                                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Last Name</label>
                                <input
                                    type="text"
                                    className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    value={formData.last_name}
                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Job Title / Designation</label>
                            <div className="relative">
                                <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    value={formData.profile.job_title}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        profile: { ...formData.profile, job_title: e.target.value }
                                    })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Phone Number</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="tel"
                                    className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    value={formData.profile.phone_number}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        profile: { ...formData.profile, phone_number: e.target.value }
                                    })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Location</label>
                            <div className="relative">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="text"
                                    className="w-full bg-input border border-border rounded-xl py-3 pl-10 pr-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="e.g. Nairobi, Kenya"
                                    value={formData.profile.location}
                                    onChange={(e) => setFormData({
                                        ...formData,
                                        profile: { ...formData.profile, location: e.target.value }
                                    })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground ml-1">Biography</label>
                            <textarea
                                rows={4}
                                className="w-full bg-input border border-border rounded-2xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all resize-none"
                                placeholder="Tell us about yourself..."
                                value={formData.profile.bio}
                                onChange={(e) => setFormData({
                                    ...formData,
                                    profile: { ...formData.profile, bio: e.target.value }
                                })}
                            ></textarea>
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 active:scale-95 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Saving Changes...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-5 w-5" />
                                        Update Profile
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Password Change Form */}
                    <form onSubmit={handlePasswordChange} className="glass rounded-3xl p-8 border border-border shadow-sm space-y-6">
                        <div className="flex items-center justify-between mb-2">
                            <h2 className="text-xl font-bold text-foreground font-heading flex items-center gap-2">
                                <Lock className="h-5 w-5 text-primary" />
                                Change Password
                            </h2>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-muted-foreground ml-1">Current Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                    value={passwordData.currentPassword}
                                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">New Password</label>
                                    <input
                                        type="password"
                                        className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                        value={passwordData.newPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                        required
                                        minLength={8}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-muted-foreground ml-1">Confirm New Password</label>
                                    <input
                                        type="password"
                                        className="w-full bg-input border border-border rounded-xl py-3 px-4 text-foreground focus:outline-none focus:ring-2 focus:ring-primary transition-all"
                                        value={passwordData.confirmPassword}
                                        onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                        required
                                        minLength={8}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={isPasswordSaving}
                                className="w-full flex items-center justify-center gap-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 py-4 font-bold shadow-lg transition-all hover:bg-destructive/20 active:scale-95 disabled:opacity-50"
                            >
                                {isPasswordSaving ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Updating Password...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="h-5 w-5" />
                                        Update Password
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
