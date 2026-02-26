'use client';

import React, { useState } from 'react';
import { X, Upload, FileText, AlertCircle } from 'lucide-react';
import api from '@/lib/api';

interface LoanDocumentUploadModalProps {
    applicationId: string;
    loanId?: string;
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const LoanDocumentUploadModal: React.FC<LoanDocumentUploadModalProps> = ({
    applicationId,
    loanId,
    isOpen,
    onClose,
    onSuccess,
}) => {
    const [formData, setFormData] = useState({
        document_name: '',
        description: '',
    });
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);

            // Auto-fill document name if empty
            if (!formData.document_name) {
                const fileName = selectedFile.name.split('.').slice(0, -1).join('.');
                setFormData(prev => ({ ...prev, document_name: fileName }));
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file) {
            setError('Please select a file to upload');
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const payload = new FormData();
            payload.append('application', applicationId);
            if (loanId) {
                payload.append('loan', loanId);
            }
            payload.append('document_name', formData.document_name);
            payload.append('description', formData.description);
            payload.append('file', file);

            await api.post('/loans/documents/', payload, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('File upload failed:', err);
            setError(err.response?.data?.error || 'Failed to upload document. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity duration-300">
            <div className="relative w-full max-w-md bg-background border border-border rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
                <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
                    <h3 className="text-xl font-bold text-foreground">Upload Document</h3>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-muted transition-colors duration-200"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {error && (
                        <div className="flex items-center gap-3 p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">
                                Document Name
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.document_name}
                                onChange={(e) => setFormData({ ...formData, document_name: e.target.value })}
                                placeholder="e.g. Identity Proof"
                                className="w-full px-4 py-3 rounded-2xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 outline-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">
                                Description (Optional)
                            </label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                placeholder="Provide context about this document..."
                                rows={3}
                                className="w-full px-4 py-3 rounded-2xl bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 outline-none resize-none"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground">
                                Select File
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    id="file-upload"
                                    onChange={handleFileChange}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="file-upload"
                                    className="flex flex-col items-center justify-center w-full min-h-[120px] p-6 rounded-2xl bg-muted/20 border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 cursor-pointer transition-all duration-300"
                                >
                                    {file ? (
                                        <div className="flex items-center gap-3 text-primary font-medium">
                                            <FileText className="w-8 h-8" />
                                            <span className="truncate max-w-[200px]">{file.name}</span>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
                                            <span className="text-sm text-muted-foreground">Click to browse or drag and drop</span>
                                            <span className="text-xs text-muted-foreground/60 mt-1">PDF, Image, or Word Document</span>
                                        </>
                                    )}
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-2xl bg-muted text-foreground font-semibold hover:bg-muted/80 transition-all duration-300"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving || !file}
                            className="flex-1 px-6 py-3 rounded-2xl bg-primary text-primary-foreground font-bold hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 disabled:shadow-none transition-all duration-300 flex items-center justify-center gap-2"
                        >
                            {isSaving ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <Upload className="w-5 h-5" />
                                    <span>Save Document</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoanDocumentUploadModal;
