"use client";

import React, { useState, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    CardDescription
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem
} from "@/components/ui/select";
import { FileIcon, UploadCloud, Eye, Trash2, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

// Types
interface CustomerDocument {
    id: string;
    document_type: string;
    file: string;
    description: string;
    is_verified: boolean;
    uploaded_at: string;
    uploaded_by_name: string;
}

interface CustomerDocumentsProps {
    borrowerId: string;
}

export function CustomerDocuments({ borrowerId }: CustomerDocumentsProps) {
    const [documents, setDocuments] = useState<CustomerDocument[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const { toast } = useToast();

    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [docType, setDocType] = useState("");
    const [description, setDescription] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    useEffect(() => {
        fetchDocuments();
    }, [borrowerId]);

    const fetchDocuments = async () => {
        try {
            const res = await api.get(`/customers/documents/?borrower=${borrowerId}`);
            setDocuments(res.data.results || res.data);
        } catch (error) {
            console.error("Failed to fetch documents", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !docType) {
            toast({
                title: "Missing Information",
                description: "Please select a file and document type.",
                variant: "destructive"
            });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("borrower", borrowerId);
        formData.append("document_type", docType);
        formData.append("file", file);
        formData.append("description", description);

        try {
            await api.post("/customers/documents/", formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                },
            });

            toast({
                title: "Success",
                description: "Document uploaded successfully.",
            });
            setIsUploadOpen(false);
            setFile(null);
            setDocType("");
            setDescription("");
            fetchDocuments(); // Refresh list
        } catch (error: any) {
            toast({
                title: "Upload Failed",
                description: error.response?.data ? JSON.stringify(error.response.data) : "An unexpected error occurred.",
                variant: "destructive"
            });
        } finally {
            setIsUploading(false);
        }
    };

    const getDocTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            'national_id': 'National ID',
            'passport': 'Passport',
            'kra_pin': 'KRA PIN',
            'passport_photo': 'Passport Photo',
            'driving_license': 'Driving License',
            'other': 'Other'
        };
        return types[type] || type;
    };

    const handleVerify = async (docId: string) => {
        if (!confirm("Are you sure you want to verify this document?")) return;
        try {
            await api.post(`/customers/documents/${docId}/verify/`);
            toast({ title: "Verified", description: "Document marked as verified." });
            setDocuments(prev => prev.map(d => d.id === docId ? { ...d, is_verified: true } : d));
        } catch (error) {
            toast({ title: "Error", description: "Failed to verify document.", variant: "destructive" });
        }
    };

    const handleDelete = async (docId: string) => {
        if (!confirm("Are you sure you want to delete this document?")) return;
        try {
            await api.delete(`/customers/documents/${docId}/`);
            toast({ title: "Deleted", description: "Document removed." });
            setDocuments(prev => prev.filter(d => d.id !== docId));
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete document.", variant: "destructive" });
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">KYC Documents</h3>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload Document
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload KYC Document</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label>Document Type</Label>
                                <Select value={docType} onValueChange={setDocType}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="national_id">National ID</SelectItem>
                                        <SelectItem value="passport">Passport</SelectItem>
                                        <SelectItem value="kra_pin">KRA PIN</SelectItem>
                                        <SelectItem value="passport_photo">Passport Photo</SelectItem>
                                        <SelectItem value="driving_license">Driving License</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label>File</Label>
                                <Input
                                    type="file"
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label>Description (Optional)</Label>
                                <Input
                                    value={description}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDescription(e.target.value)}
                                    placeholder="e.g. Front side of ID"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                            <Button onClick={handleUpload} disabled={isUploading}>
                                {isUploading ? "Uploading..." : "Upload"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {isLoading ? (
                    <div>Loading documents...</div>
                ) : documents.length === 0 ? (
                    <div className="col-span-3 text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        No documents uploaded yet.
                    </div>
                ) : docType === 'grid' ? ( // Placeholder for potential grid view toggle
                    documents.map(doc => (
                        <div key={doc.id}></div>
                    ))
                ) : (
                    // List view default for now
                    documents.map((doc) => (
                        <Card key={doc.id} className="overflow-hidden">
                            <div className="p-4 flex items-start gap-4">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium truncate">{getDocTypeLabel(doc.document_type)}</p>
                                    <p className="text-xs text-muted-foreground">
                                        Uploaded by {doc.uploaded_by_name} on {new Date(doc.uploaded_at).toLocaleDateString()}
                                    </p>
                                    {doc.description && (
                                        <p className="text-xs text-muted-foreground mt-1 truncate">{doc.description}</p>
                                    )}
                                </div>
                            </div>
                            <div className="bg-muted/40 p-2 flex justify-between items-center text-xs px-4">
                                <div className="flex items-center gap-2">
                                    {doc.is_verified ? (
                                        <span className="flex items-center text-green-600 gap-1"><CheckCircle className="h-3 w-3" /> Verified</span>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="flex items-center text-amber-600 gap-1"><XCircle className="h-3 w-3" /> Unverified</span>
                                            <Button variant="ghost" size="sm" className="h-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handleVerify(doc.id)}>
                                                Verify
                                            </Button>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="ghost" size="sm" className="h-6" asChild>
                                        <a href={doc.file} target="_blank" rel="noopener noreferrer"><Eye className="h-3 w-3 mr-1" /> View</a>
                                    </Button>
                                    <Button variant="ghost" size="sm" className="h-6 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(doc.id)}>
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
