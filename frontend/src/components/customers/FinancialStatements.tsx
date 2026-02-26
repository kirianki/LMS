"use client";

import React, { useState, useEffect } from "react";
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";
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
import {
    Table,
    TableHeader,
    TableHead,
    TableBody,
    TableRow,
    TableCell
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { FileText, BarChart3, UploadCloud, RefreshCw, Lock, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface FinancialStatement {
    id: string;
    statement_type: string;
    file: string;
    period_start: string;
    period_end: string;
    extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
    analysis_results: any;
    uploaded_at: string;
    password?: string;
}

interface FinancialStatementsProps {
    borrowerId: string;
}

export function FinancialStatements({ borrowerId }: FinancialStatementsProps) {
    const [statements, setStatements] = useState<FinancialStatement[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isUploading, setIsUploading] = useState(false);
    const [analyzingId, setAnalyzingId] = useState<string | null>(null);

    // Upload State
    const [file, setFile] = useState<File | null>(null);
    const [type, setType] = useState("");
    const [password, setPassword] = useState("");
    const [periodStart, setPeriodStart] = useState("");
    const [periodEnd, setPeriodEnd] = useState("");
    const [isUploadOpen, setIsUploadOpen] = useState(false);

    // Insight Modal
    const [selectedStatement, setSelectedStatement] = useState<FinancialStatement | null>(null);

    const { toast } = useToast();

    useEffect(() => {
        fetchStatements();
    }, [borrowerId]);

    // Polling for processing statements
    useEffect(() => {
        const hasProcessing = statements.some(s => s.extraction_status === 'processing');
        if (!hasProcessing) return;

        const interval = setInterval(() => {
            fetchStatements();
        }, 5000);

        return () => clearInterval(interval);
    }, [statements]);

    const fetchStatements = async () => {
        try {
            const res = await api.get(`/customers/statements/?borrower=${borrowerId}`);
            setStatements(res.data.results || res.data);
        } catch (error) {
            console.error("Failed to fetch statements", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleUpload = async () => {
        if (!file || !type || !periodStart || !periodEnd) {
            toast({ title: "Validation Error", description: "All fields marked * are required.", variant: "destructive" });
            return;
        }

        setIsUploading(true);
        const formData = new FormData();
        formData.append("borrower", borrowerId);
        formData.append("statement_type", type);
        formData.append("file", file);
        formData.append("period_start", periodStart);
        formData.append("period_end", periodEnd);
        if (password) formData.append("password", password);

        try {
            const token = localStorage.getItem("accessToken");
            const res = await fetch("http://localhost:8000/api/customers/statements/", {
                method: "POST",
                headers: { "Authorization": `Bearer ${token}` },
                body: formData
            });

            if (res.ok) {
                toast({ title: "Success", description: "Statement uploaded successfully." });
                setIsUploadOpen(false);
                setFile(null); setType(""); setPassword("");
                fetchStatements();
            } else {
                toast({ title: "Failed", description: "Upload failed.", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Error", description: "Network error.", variant: "destructive" });
        } finally {
            setIsUploading(false);
        }
    };

    const handleAnalyze = async (statement: FinancialStatement) => {
        setAnalyzingId(statement.id);
        try {
            const res = await api.post(`/customers/statements/${statement.id}/analyze/`);
            toast({ title: "Analysis Queued", description: "Statement is being processed in background." });

            // Update local state to reflect changes
            setStatements(prev => prev.map(s => s.id === statement.id ? { ...s, extraction_status: 'processing' } : s));
        } catch (error: any) {
            toast({ title: "Analysis Failed", description: "Could not queue analysis.", variant: "destructive" });
        } finally {
            setAnalyzingId(null);
        }
    };

    const handleDelete = async (stmtId: string) => {
        if (!confirm("Are you sure you want to delete this statement?")) return;
        try {
            await api.delete(`/customers/statements/${stmtId}/`);
            toast({ title: "Deleted", description: "Statement removed." });
            setStatements(prev => prev.filter(s => s.id !== stmtId));
        } catch (error) {
            toast({ title: "Error", description: "Failed to delete statement.", variant: "destructive" });
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed': return <Badge className="bg-green-500">Completed</Badge>;
            case 'processing': return <Badge className="bg-blue-500">Processing</Badge>;
            case 'failed': return <Badge variant="destructive">Failed</Badge>;
            default: return <Badge variant="secondary">Pending</Badge>;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Financial Statements</h3>
                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogTrigger asChild>
                        <Button>
                            <UploadCloud className="mr-2 h-4 w-4" />
                            Upload Statement
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Upload Financial Statement</DialogTitle>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Statement Type *</Label>
                                    <Select value={type} onValueChange={setType}>
                                        <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="mpesa">M-Pesa Statement</SelectItem>
                                            <SelectItem value="bank">Bank Statement</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>File (PDF) *</Label>
                                    <Input type="file" accept=".pdf,.csv" onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFile(e.target.files?.[0] || null)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Period Start *</Label>
                                    <Input type="date" value={periodStart} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodStart(e.target.value)} />
                                </div>
                                <div className="space-y-2">
                                    <Label>Period End *</Label>
                                    <Input type="date" value={periodEnd} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPeriodEnd(e.target.value)} />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Password (if encrypted)</Label>
                                <Input type="password" value={password} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)} placeholder="Required for some bank PDFs" />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>Cancel</Button>
                            <Button onClick={handleUpload} disabled={isUploading}>{isUploading ? 'Uploading...' : 'Upload'}</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="grid gap-4">
                {isLoading ? <div>Loading statements...</div> : statements.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                        No financial statements uploaded yet.
                    </div>
                ) : (
                    statements.map(stmt => (
                        <Card key={stmt.id}>
                            <div className="flex items-center p-4 gap-4">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <FileText className="h-6 w-6 text-blue-600" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="font-medium flex items-center gap-2">
                                        {stmt.statement_type === 'mpesa' ? 'M-Pesa Statement' : 'Bank Statement'}
                                        {stmt.password && <Lock className="h-3 w-3 text-muted-foreground" />}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                        {stmt.period_start} to {stmt.period_end} • Uploaded on {new Date(stmt.uploaded_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    {getStatusBadge(stmt.extraction_status)}

                                    {stmt.extraction_status === 'completed' ? (
                                        <Button variant="outline" size="sm" onClick={() => setSelectedStatement(stmt)}>
                                            <BarChart3 className="mr-2 h-3 w-3" />
                                            Insights
                                        </Button>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            disabled={stmt.extraction_status === 'processing' || analyzingId === stmt.id}
                                            onClick={() => handleAnalyze(stmt)}
                                        >
                                            {stmt.extraction_status === 'processing' || analyzingId === stmt.id ? (
                                                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                                            ) : (
                                                <RefreshCw className="mr-2 h-3 w-3" />
                                            )}
                                            Analyze
                                        </Button>
                                    )}
                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(stmt.id)}>
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Insights Dialog */}
            <Dialog open={!!selectedStatement} onOpenChange={(open: boolean) => !open && setSelectedStatement(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Analysis Insights</DialogTitle>
                    </DialogHeader>
                    {selectedStatement && selectedStatement.analysis_results && (
                        <div className="grid grid-cols-2 gap-4 py-4">
                            <Card>
                                <CardHeader className="py-2"><CardTitle className="text-sm">Total Turnover</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold">KES {selectedStatement.analysis_results.total_turnover?.toLocaleString()}</div></CardContent>
                            </Card>
                            <Card>
                                <CardHeader className="py-2"><CardTitle className="text-sm">Avg Daily Balance</CardTitle></CardHeader>
                                <CardContent><div className="text-2xl font-bold">KES {selectedStatement.analysis_results.average_daily_balance?.toLocaleString()}</div></CardContent>
                            </Card>

                            <div className="col-span-2 space-y-2 mt-2">
                                <Label>Detailed Metrics</Label>
                                <div className="bg-muted p-4 rounded-lg text-sm space-y-1">
                                    <div className="flex justify-between"><span>Highest Balance:</span> <span className="font-mono">KES {selectedStatement.analysis_results.highest_balance?.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Lowest Balance:</span> <span className="font-mono text-red-500">KES {selectedStatement.analysis_results.lowest_balance?.toLocaleString()}</span></div>
                                    <div className="flex justify-between"><span>Salary Detected:</span> <span className="font-mono">{selectedStatement.analysis_results.salary_detected ? 'Yes' : 'No'}</span></div>
                                </div>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
