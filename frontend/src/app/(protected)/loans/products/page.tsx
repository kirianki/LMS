'use client';

import { useState, useEffect } from 'react';
import { Package, Plus, Search } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';
import ProductFormModal from '@/components/loans/ProductFormModal';

interface LoanProduct {
    id: string;
    name: string;
    code: string;
    suggested_interest_rate: string | number | null;
    suggested_processing_fee_percent: string | number | null;
    min_amount: string | number;
    max_amount: string | number;
    min_term: number;
    max_term: number;
    term_unit: string;
    min_credit_score: number | null;
    requires_collateral: boolean;
    is_active: boolean;
}

export default function LoanProductsPage() {
    const [products, setProducts] = useState<LoanProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<LoanProduct | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterActive, setFilterActive] = useState<string>('all');

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchProducts();
        }, 500);
        return () => clearTimeout(timer);
    }, [searchTerm, filterActive]);

    const fetchProducts = async () => {
        setIsLoading(true);
        try {
            const params: any = {};
            if (filterActive !== 'all') params.is_active = filterActive === 'active';
            if (searchTerm) params.search = searchTerm;

            const response = await api.get('/loans/products/', { params });
            const data = response?.data;
            if (data) {
                const results = Array.isArray(data.results) ? data.results : (Array.isArray(data) ? data : []);
                setProducts(results);
            }
        } catch (error) {
            console.error('Failed to fetch products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleActive = async (product: LoanProduct) => {
        try {
            await api.patch(`/loans/products/${product.id}/`, {
                is_active: !product.is_active
            });
            fetchProducts();
        } catch (error) {
            console.error('Failed to toggle product status:', error);
            alert('Failed to update product status');
        }
    };

    const handleEdit = (product: LoanProduct) => {
        setEditingProduct(product);
        setShowFormModal(true);
    };

    const handleCloseModal = () => {
        setShowFormModal(false);
        setEditingProduct(null);
    };

    const columns = [
        {
            accessor: (product: LoanProduct) => (
                <div>
                    <p className="font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.code}</p>
                </div>
            ),
            header: 'Product'
        },
        {
            accessor: (product: LoanProduct) => (
                <div>
                    <p className="font-medium text-foreground">{product.suggested_interest_rate || 'N/A'}% p.a.</p>
                    <p className="text-xs text-muted-foreground italic">Suggested</p>
                </div>
            ),
            header: 'Interest'
        },
        {
            accessor: (product: LoanProduct) => (
                <span className="text-sm text-muted-foreground">
                    KES {Number(product.min_amount).toLocaleString()} - {Number(product.max_amount).toLocaleString()}
                </span>
            ),
            header: 'Amount Range'
        },
        {
            accessor: (product: LoanProduct) => (
                <span className="text-sm text-muted-foreground capitalize">
                    {product.min_term} - {product.max_term} {product.term_unit}
                </span>
            ),
            header: 'Term Range'
        },
        {
            accessor: (product: LoanProduct) => (
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.requires_collateral
                    ? 'bg-orange-500/10 text-orange-400'
                    : 'bg-gray-500/10 text-gray-400'
                    }`}>
                    {product.requires_collateral ? 'Required' : 'Optional'}
                </span>
            ),
            header: 'Collateral'
        },
        {
            accessor: (product: LoanProduct) => (
                <button
                    onClick={() => handleToggleActive(product)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${product.is_active
                        ? 'bg-green-500/10 text-green-400 border-green-500/20 hover:bg-green-500/20'
                        : 'bg-gray-500/10 text-gray-400 border-gray-500/20 hover:bg-gray-500/20'
                        }`}
                >
                    {product.is_active ? 'Active' : 'Inactive'}
                </button>
            ),
            header: 'Status'
        },
        {
            accessor: (product: LoanProduct) => (
                <button
                    onClick={() => handleEdit(product)}
                    className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                >
                    Edit
                </button>
            ),
            header: 'Actions'
        }
    ];

    const filteredProducts = products;

    return (
        <div className="space-y-6 pb-12">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-foreground font-heading flex items-center gap-3">
                        <Package className="h-8 w-8 text-primary" />
                        Loan Products
                    </h1>
                    <p className="text-muted-foreground mt-1">Manage your loan product catalog</p>
                </div>
                <button
                    onClick={() => setShowFormModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
                >
                    <Plus className="h-5 w-5" />
                    New Product
                </button>
            </div>

            {/* Filters */}
            <div className="flex gap-2">
                {['all', 'active', 'inactive'].map((filter) => (
                    <button
                        key={filter}
                        onClick={() => setFilterActive(filter)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filterActive === filter
                            ? 'bg-primary text-white'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                            }`}
                    >
                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                    </button>
                ))}
            </div>

            {/* Products Table */}
            <div className="glass rounded-2xl border border-border overflow-hidden">
                <DataTable
                    columns={columns}
                    data={filteredProducts}
                    isLoading={isLoading}
                    onSearch={setSearchTerm}
                    onExport={() => {
                        const headers = ['Name', 'Code', 'Interest', 'Min Amount', 'Max Amount', 'Term Range', 'Status'];
                        const rows = products.map(p => [
                            p.name,
                            p.code,
                            `${p.suggested_interest_rate || 'N/A'}%`,
                            p.min_amount,
                            p.max_amount,
                            `${p.min_term} - ${p.max_term} ${p.term_unit}`,
                            p.is_active ? 'Active' : 'Inactive'
                        ]);
                        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                        const link = document.createElement("a");
                        const url = URL.createObjectURL(blob);
                        link.setAttribute("href", url);
                        link.setAttribute("download", `products_export_${new Date().toISOString().split('T')[0]}.csv`);
                        link.style.visibility = 'hidden';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }}
                />
            </div>

            {/* Product Form Modal */}
            <ProductFormModal
                isOpen={showFormModal}
                onClose={handleCloseModal}
                onSuccess={() => {
                    fetchProducts();
                    handleCloseModal();
                }}
                editingProduct={editingProduct}
            />
        </div>
    );
}
