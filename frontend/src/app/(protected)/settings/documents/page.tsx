'use client';

import { useState, useEffect } from 'react';
import {
    FileText,
    Save,
    ArrowLeft,
    Info,
    Eye,
    Code,
    CheckCircle2,
    Loader2,
    Settings,
    Plus,
    Trash2,
    RotateCcw,
    X,
    Clock
} from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/api';

interface Template {
    id: string;
    name: string;
    description: string;
    template_type: string;
    content: string;
    is_active: boolean;
}

export default function DocumentTemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [viewMode, setViewMode] = useState<'editor' | 'preview'>('editor');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [placeholders, setPlaceholders] = useState<{ key: string, desc: string }[]>([]);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isResetting, setIsResetting] = useState(false);

    const [editData, setEditData] = useState({
        name: '',
        description: '',
        content: '',
        is_active: true,
        template_type: 'offer_letter'
    });

    const [newData, setNewData] = useState({
        name: '',
        description: '',
        template_type: 'offer_letter',
        content: '<html><body><h1>New Template</h1></body></html>',
        is_active: true
    });

    useEffect(() => {
        fetchTemplates();
        fetchPlaceholders();
    }, []);

    const fetchPlaceholders = async () => {
        try {
            const response = await api.get('/document-templates/placeholders/');
            setPlaceholders(response.data);
        } catch (error) {
            console.error('Failed to fetch placeholders:', error);
        }
    };

    const fetchTemplates = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/document-templates/');
            const data = Array.isArray(response.data) ? response.data : response.data.results || [];
            setTemplates(data);
            if (data.length > 0) {
                handleSelectTemplate(data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch templates:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelectTemplate = (template: Template) => {
        setSelectedTemplate(template);
        setEditData({
            name: template.name,
            description: template.description || '',
            content: template.content,
            is_active: template.is_active,
            template_type: template.template_type
        });
    };

    const handleSave = async () => {
        if (!selectedTemplate) return;
        setIsSaving(true);
        try {
            await api.patch(`/document-templates/${selectedTemplate.id}/`, editData);
            setTemplates(templates.map(t => t.id === selectedTemplate.id ? { ...t, ...editData } : t));
            alert('Template saved successfully!');
        } catch (error) {
            console.error('Failed to save template:', error);
            alert('Failed to save template. Please check your HTML syntax.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            const response = await api.post('/document-templates/', newData);
            setTemplates([...templates, response.data]);
            handleSelectTemplate(response.data);
            setIsCreateModalOpen(false);
            setNewData({
                name: '',
                description: '',
                template_type: 'offer_letter',
                content: '<html><body><h1>New Template</h1></body></html>',
                is_active: true
            });
        } catch (error) {
            console.error('Failed to create template:', error);
            alert('Failed to create template.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedTemplate) return;
        if (!confirm('Are you sure you want to delete this template? This action cannot be undone.')) return;

        setIsDeleting(true);
        try {
            await api.delete(`/document-templates/${selectedTemplate.id}/`);
            const remaining = templates.filter(t => t.id !== selectedTemplate.id);
            setTemplates(remaining);
            if (remaining.length > 0) {
                handleSelectTemplate(remaining[0]);
            } else {
                setSelectedTemplate(null);
            }
            alert('Template deleted.');
        } catch (error) {
            console.error('Failed to delete template:', error);
            alert('Failed to delete template.');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReset = async () => {
        if (!selectedTemplate) return;
        if (!confirm('Reset to factory default? Your current customizations will be LOST.')) return;

        setIsResetting(true);
        try {
            const response = await api.post(`/document-templates/${selectedTemplate.id}/reset_to_default/`);
            const updated = response.data;
            setTemplates(templates.map(t => t.id === updated.id ? updated : t));
            handleSelectTemplate(updated);
            alert('Template reset to default.');
        } catch (error) {
            console.error('Failed to reset template:', error);
            alert('Failed to reset template. No default might be defined for this type.');
        } finally {
            setIsResetting(false);
        }
    };


    if (isLoading) return <div className="p-12 text-center text-muted-foreground">Loading templates...</div>;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/settings" className="p-2 hover:bg-muted rounded-full transition-colors">
                        <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading">Document Blueprints</h1>
                        <p className="text-muted-foreground mt-1">Customize the HTML templates for your official documents.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex bg-muted p-1 rounded-lg border border-border">
                        <button
                            onClick={() => setViewMode('editor')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'editor' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Code className="h-3.5 w-3.5" />
                            Editor
                        </button>
                        <button
                            onClick={() => setViewMode('preview')}
                            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Eye className="h-3.5 w-3.5" />
                            Live Preview
                        </button>
                    </div>
                    <button
                        onClick={handleSave}
                        disabled={isSaving || !selectedTemplate}
                        className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save Template
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                {/* Sidebar: Template List */}
                <div className="lg:col-span-1 space-y-4">
                    <div className="glass rounded-xl border border-white/5 overflow-hidden">
                        <div className="p-4 bg-white/5 border-b border-white/5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            <button
                                onClick={() => setIsCreateModalOpen(true)}
                                className="p-1 hover:bg-white/10 rounded-md text-primary transition-colors"
                                title="New Template"
                            >
                                <Plus className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="divide-y divide-white/5">
                            {templates.map((template) => (
                                <div
                                    key={template.id}
                                    onClick={() => handleSelectTemplate(template)}
                                    className={`w-full p-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors text-left cursor-pointer ${selectedTemplate?.id === template.id ? 'bg-primary/5 border-l-4 border-primary' : 'border-l-4 border-transparent'}`}
                                >
                                    <div className={`mt-1 p-2 rounded-lg ${selectedTemplate?.id === template.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                        <FileText className="h-4 w-4" />
                                    </div>
                                    <div className="flex-1">
                                        <p className={`text-sm font-bold ${selectedTemplate?.id === template.id ? 'text-primary' : 'text-foreground'}`}>{template.name}</p>
                                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 capitalize">{template.template_type.replace(/_/g, ' ')}</p>
                                    </div>
                                    {selectedTemplate?.id === template.id && (
                                        <div className="flex items-center gap-1 opacity-60 hover:opacity-100">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleReset(); }}
                                                className="p-1 hover:text-orange-400"
                                                title="Reset to Default"
                                            >
                                                <RotateCcw className="h-3 w-3" />
                                            </button>
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                                                className="p-1 hover:text-red-400"
                                                title="Delete Template"
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="glass rounded-xl border border-white/5 p-4 space-y-4">
                        <div className="flex items-center gap-2 text-primary">
                            <Info className="h-4 w-4" />
                            <span className="text-xs font-bold uppercase tracking-wider">Placeholder Guide</span>
                        </div>
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {placeholders.map((p) => (
                                <div key={p.key} className="space-y-1">
                                    <code className="text-[10px] bg-slate-800 text-emerald-400 px-1.5 py-0.5 rounded block w-fit font-mono">{p.key}</code>
                                    <p className="text-[10px] text-muted-foreground italic leading-tight">{p.desc}</p>
                                </div>
                            ))}
                        </div>
                        <div className="pt-2 border-t border-white/5">
                            <p className="text-[9px] text-muted-foreground text-center">Templates use Jinja2/Django syntax.</p>
                        </div>
                    </div>
                </div>

                {/* Main: Content Editor / Preview */}
                <div className="lg:col-span-3">
                    {!selectedTemplate ? (
                        <div className="h-full min-h-[500px] flex flex-col items-center justify-center glass rounded-2xl border border-white/5 text-muted-foreground italic">
                            <Settings className="h-12 w-12 mb-4 opacity-20" />
                            Select a template to start editing
                        </div>
                    ) : (
                        <div className="h-full flex flex-col glass rounded-2xl border border-white/5 overflow-hidden">
                            <div className="p-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Selected:</span>
                                    <span className="text-sm font-bold text-primary">{selectedTemplate.name}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-3">
                                        <label className="text-xs text-muted-foreground">Active</label>
                                        <input
                                            type="checkbox"
                                            checked={editData.is_active}
                                            onChange={(e) => setEditData({ ...editData, is_active: e.target.checked })}
                                            className="rounded border-white/10 bg-slate-800 text-primary focus:ring-primary"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex-1 min-h-[600px] relative">
                                {viewMode === 'editor' ? (
                                    <textarea
                                        value={editData.content}
                                        onChange={(e) => setEditData({ ...editData, content: e.target.value })}
                                        className="w-full h-full p-6 bg-slate-900/50 text-foreground font-mono text-sm outline-none resize-none border-none selection:bg-primary/30"
                                        placeholder="Enter HTML template content here..."
                                        spellCheck={false}
                                    />
                                ) : (
                                    <div className="w-full h-full bg-slate-50 overflow-auto">
                                        <div
                                            className="mx-auto my-8 max-w-[800px] bg-white shadow-2xl p-12 min-h-[10in] border border-gray-200 text-slate-900 prose prose-slate"
                                            dangerouslySetInnerHTML={{
                                                // Simple placeholder replacement for preview
                                                __html: editData.content
                                                    .replace(/\{\{\s*borrower_name\s*\}\}/g, '<strong>[Borrower Name]</strong>')
                                                    .replace(/\{\{\s*borrower_id\s*\}\}/g, '<strong>[ID: 12345]</strong>')
                                                    .replace(/\{\{\s*company_name\s*\}\}/g, '<strong>[Your Organization]</strong>')
                                                    .replace(/\{\{\s*date_letter\s*\}\}/g, new Date().toLocaleDateString())
                                                    .replace(/\{\{\s*approved_principal\s*\}\}/g, '<strong>100,000.00</strong>')
                                                    .replace(/\{\{\s*product_name\s*\}\}/g, '<strong>Business Loan</strong>')
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Create Template Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
                    <div className="w-full max-w-lg glass rounded-2xl border border-white/10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                            <h2 className="text-xl font-bold font-heading">New Document Blueprint</h2>
                            <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                                <X className="h-5 w-5 text-muted-foreground" />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="p-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Template Name</label>
                                <input
                                    type="text"
                                    required
                                    value={newData.name}
                                    onChange={(e) => setNewData({ ...newData, name: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary outline-none transition-colors"
                                    placeholder="e.g. Premium Offer Letter"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Description</label>
                                <textarea
                                    value={newData.description}
                                    onChange={(e) => setNewData({ ...newData, description: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary outline-none transition-colors"
                                    placeholder="What is this template for?"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-semibold">Template Type</label>
                                <select
                                    value={newData.template_type}
                                    onChange={(e) => setNewData({ ...newData, template_type: e.target.value })}
                                    className="w-full px-4 py-2 rounded-lg bg-white/5 border border-white/10 focus:border-primary outline-none transition-colors appearance-none"
                                >
                                    <option value="offer_letter">Offer Letter</option>
                                    <option value="disbursement_letter">Disbursement Letter</option>
                                    <option value="loan_statement">Loan Statement</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsCreateModalOpen(false)}
                                    className="flex-1 px-4 py-2.5 rounded-lg border border-white/10 font-bold hover:bg-white/5 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-transform"
                                >
                                    Create Blueprint
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
