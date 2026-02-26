'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, Plus, Clock, CheckCircle, XCircle, Eye } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';
import NewApplicationModal from '@/components/loans/NewApplicationModal';
import ApplicationApprovalModal from '@/components/loans/ApplicationApprovalModal';
import { useAuthStore } from '@/store/useAuthStore';

interface Application {
    id: string;
    application_number: string;
    borrower_details?: {
        name: string;
        phone_number: string;
    };
    product_details?: {
        name: string;
    };
    requested_amount: string | number;
    requested_term: number;
    status: string;
    created_at: string;
}

export default function LoanApplicationsPage() {
    const router = useRouter();
    const { user } = useAuthStore();
    const [applications, setApplications] = useState<Application[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeTab, setActiveTab] = useState('all');
    const [filters, setFilters] = useState({
        product: '',
        risk_category: ''
    });
    const [products, setProducts] = useState<any[]>([]);
    const [showNewModal, setShowNewModal] = useState(false);
    const [selectedApplication, setSelectedApplication] = useState<any>(null);
    const [showApprovalModal, setShowApprovalModal] = useState(false);

    useEffect(() => {
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const response = await api.get('/loans/products/');
            console.log('fetchProducts response:', response);
            const data = response?.data;
            if (data) {
                setProducts(data.results || data);
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchApplications();
        }, 500);
        return () => clearTimeout(timer);
    }, [activeTab, searchQuery, filters]);

    const fetchApplications = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (activeTab !== 'all') params.status = activeTab;
            if (searchQuery) params.search = searchQuery;
            if (filters.product) params.product = filters.product;
            if (filters.risk_category) params.risk_category = filters.risk_category;

            const response = await api.get('/loans/applications/', { params });
            const data = response?.data;
            if (data) {
                const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                setApplications(results);
            }
        } catch (error) {
            console.error('Failed to fetch applications:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const columns = [
        {
            accessor: (app: any) => (
                <span className="font-medium text-primary">{app.application_number}</span>
            ),
            header: 'App #'
        },
        {
            accessor: (app: any) => (
                <div>
                    <p className="font-medium text-foreground">{app.borrower_details?.name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{app.borrower_details?.phone_number || ''}</p>
                </div>
            ),
            header: 'Borrower'
        },
        {
            accessor: (app: any) => <span className="text-sm">{app.product_details?.name || 'N/A'}</span>,
            header: 'Product'
        },
        {
            accessor: (app: any) => (
                <span className="font-semibold text-foreground">
                    KES {Number(app.requested_amount).toLocaleString()}
                </span>
            ),
            header: 'Amount Requested'
        },
        {
            accessor: (app: any) => (
                <span className="text-sm text-muted-foreground">{app.requested_term} months</span>
            ),
            header: 'Term'
        },
        {
            accessor: (app: any) => {
                const statusConfig: any = {
                    draft: { color: 'bg-gray-500/10 text-gray-400 border-gray-500/20', icon: Clock },
                    submitted: { color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', icon: Clock },
                    under_review: { color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: Eye },
                    approved: { color: 'bg-sky-500/10 text-sky-400 border-sky-500/20', icon: CheckCircle },
                    offer_sent: { color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', icon: FileText },
                    offer_accepted: { color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20', icon: CheckCircle },
                    rejected: { color: 'bg-red-500/10 text-red-400 border-red-500/20', icon: XCircle },
                    disbursed: { color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', icon: CheckCircle },
                    cancelled: { color: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: XCircle }
                };
                const config = statusConfig[app.status] || statusConfig.draft;
                const Icon = config.icon;
                return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${config.color}`}>
                        <Icon className="h-3 w-3" />
                        {app.status?.replace('_', ' ').toUpperCase()}
                    </span>
                );
            },
            header: 'Status'
        },
        {
            accessor: (app: any) => (
                <span className="text-sm text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString()}
                </span>
            ),
            header: 'Created'
        },
        {
            accessor: (app: any) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => handleViewApplication(app)}
                        className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                    >
                        View
                    </button>
                    {app.status === 'submitted' && (user?.is_superuser || user?.permissions?.includes('loans.change_loanapplication')) && (
                        <button
                            onClick={() => handleReviewApplication(app)}
                            className="px-3 py-1.5 rounded-lg bg-green-500/10 text-green-400 text-xs font-medium hover:bg-green-500/20 transition-colors"
                        >
                            Review
                        </button>
                    )}
                    {app.status === 'approved' && (user?.is_superuser || user?.permissions?.includes('loans.disburse_loan')) && (
                        <button
                            onClick={() => handleDisburseApplication(app)}
                            className="px-3 py-1.5 rounded-lg bg-purple-500/10 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-colors"
                        >
                            Disburse
                        </button>
                    )}
                </div>
            ),
            header: 'Actions'
        }
    ];

    const handleViewApplication = (app: any) => {
        router.push(`/loans/applications/${app.id}`);
    };

    const handleReviewApplication = (app: any) => {
        setSelectedApplication(app);
        setShowApprovalModal(true);
    };

    const handleDisburseApplication = async (app: any) => {
        if (!confirm('Are you sure you want to disburse this loan?')) return;

        try {
            await api.post(`/loans/applications/${app.id}/disburse/`, {
                disbursement_method: 'mpesa'
            });
            alert('Loan disbursed successfully!');
            fetchApplications();
        } catch (error) {
            console.error('Failed to disburse loan:', error);
            alert('Failed to disburse loan. Please try again.');
        }
    };

    const tabs = [
        { key: 'all', label: 'All', count: applications.length },
        { key: 'draft', label: 'Drafts', count: applications.filter(a => a.status === 'draft').length },
        { key: 'submitted', label: 'Pending Review', count: applications.filter(a => a.status === 'submitted').length },
        { key: 'under_review', label: 'Under Review', count: applications.filter(a => a.status === 'under_review').length },
        { key: 'approved', label: 'Approved', count: applications.filter(a => a.status === 'approved').length },
        { key: 'offer_sent', label: 'Offers Sent', count: applications.filter(a => a.status === 'offer_sent').length },
        { key: 'offer_accepted', label: 'Offers Accepted', count: applications.filter(a => a.status === 'offer_accepted').length },
        { key: 'rejected', label: 'Rejected', count: applications.filter(a => a.status === 'rejected').length },
        { key: 'disbursed', label: 'Disbursed', count: applications.filter(a => a.status === 'disbursed').length },
    ];

    const filteredApplications = applications;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <FileText className="h-8 w-8 text-primary" />
                        Loan Applications
                    </h1>
                    <p className="text-muted-foreground mt-1">Review and manage customer loan applications</p>
                </div>
                {(user?.is_superuser || user?.permissions?.includes('loans.add_loanapplication')) && (
                    <button
                        onClick={() => setShowNewModal(true)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                    >
                        <Plus className="h-5 w-5" />
                        New Application
                    </button>
                )}
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border overflow-x-auto">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-3 text-sm font-medium transition-colors relative ${activeTab === tab.key
                            ? 'text-primary'
                            : 'text-muted-foreground hover:text-foreground'
                            }`}
                    >
                        {tab.label}
                        {tab.count > 0 && (
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${activeTab === tab.key
                                ? 'bg-primary text-white'
                                : 'bg-muted text-muted-foreground'
                                }`}>
                                {tab.count}
                            </span>
                        )}
                        {activeTab === tab.key && (
                            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                        )}
                    </button>
                ))}
            </div>

            {/* Applications Table */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
                <DataTable
                    columns={columns}
                    data={filteredApplications}
                    isLoading={isLoading}
                    onSearch={setSearchQuery}
                    onExport={() => {
                        const headers = ['App #', 'Borrower', 'Product', 'Amount', 'Term', 'Status', 'Created'];
                        const rows = applications.map(app => [
                            app.application_number,
                            app.borrower_details?.name || 'N/A',
                            app.product_details?.name || 'N/A',
                            app.requested_amount,
                            `${app.requested_term} months`,
                            app.status,
                            new Date(app.created_at).toLocaleDateString()
                        ]);
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `applications_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                    filterContent={
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Loan Product</label>
                                <select
                                    value={filters.product}
                                    onChange={(e) => setFilters(prev => ({ ...prev, product: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                                >
                                    <option value="">All Products</option>
                                    {products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Risk Category</label>
                                <select
                                    value={filters.risk_category}
                                    onChange={(e) => setFilters(prev => ({ ...prev, risk_category: e.target.value }))}
                                    className="w-full bg-input border border-border rounded-lg p-2.5 text-sm outline-none focus:ring-2 focus:ring-primary transition-all"
                                >
                                    <option value="">All Risks</option>
                                    <option value="low">Low Risk</option>
                                    <option value="medium">Medium Risk</option>
                                    <option value="high">High Risk</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => setFilters({ product: '', risk_category: '' })}
                                    className="w-full py-2.5 px-4 bg-muted hover:bg-muted/80 text-muted-foreground font-bold text-xs rounded-lg transition-all uppercase tracking-widest border border-border"
                                >
                                    Reset Filters
                                </button>
                            </div>
                        </div>
                    }
                />
            </div>

            <NewApplicationModal
                isOpen={showNewModal}
                onClose={() => setShowNewModal(false)}
                onSuccess={fetchApplications}
            />

            <ApplicationApprovalModal
                isOpen={showApprovalModal}
                onClose={() => {
                    setShowApprovalModal(false);
                    setSelectedApplication(null);
                }}
                onSuccess={fetchApplications}
                application={selectedApplication}
            />
        </div>
    );
}
