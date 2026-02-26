'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Settings, Percent, Wallet, Info } from 'lucide-react';
import DataTable from '@/components/ui/DataTable';
import api from '@/lib/api';
import SavingsProductModal from '@/components/savings/SavingsProductModal';

interface SavingsProduct {
    id: string;
    name: string;
    code: string;
    interest_rate: number;
    minimum_balance: number;
    interest_method: string;
    compounding_period: string;
    is_active: boolean;
}

export default function SavingsProductsPage() {
    const router = useRouter();
    const [products, setProducts] = useState<SavingsProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingProduct, setEditingProduct] = useState<SavingsProduct | null>(null);

    const fetchProducts = async () => {
        try {
            setIsLoading(true);
            const response = await api.get('/savings/products/');
            const data = response?.data;
            setProducts(Array.isArray(data) ? data : data?.results || []);
        } catch (error) {
            console.error('Failed to fetch savings products:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProducts();
    }, []);

    const handleEdit = (prod: SavingsProduct) => {
        setEditingProduct(prod);
        setShowModal(true);
    };

    const handleCloseModal = () => {
        setShowModal(false);
        setEditingProduct(null);
    };

    const columns = [
        {
            header: 'Product Name',
            accessor: (prod: SavingsProduct) => (
                <div>
                    <p className="font-bold text-foreground">{prod.name}</p>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{prod.code}</p>
                </div>
            ),
        },
        {
            header: 'Interest Rate',
            accessor: (prod: SavingsProduct) => (
                <div className="flex items-center gap-2">
                    <Percent className="h-3 w-3 text-emerald-400" />
                    <span className="font-bold text-foreground">{prod.interest_rate}% <span className="text-[10px] text-muted-foreground uppercase">p.a</span></span>
                </div>
            ),
        },
        {
            header: 'Min. Balance',
            accessor: (prod: SavingsProduct) => (
                <span className="text-slate-300">KES {parseFloat(prod.minimum_balance.toString()).toLocaleString()}</span>
            ),
        },
        {
            header: 'Compounding',
            accessor: (prod: SavingsProduct) => (
                <span className="capitalize text-xs px-2 py-1 rounded bg-muted border border-border text-muted-foreground">
                    {prod.compounding_period}
                </span>
            ),
        },
        {
            header: 'Status',
            accessor: (prod: SavingsProduct) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${prod.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'
                    }`}>
                    {prod.is_active ? 'Active' : 'Disabled'}
                </span>
            ),
        },
        {
            header: 'Actions',
            accessor: (prod: SavingsProduct) => (
                <button
                    onClick={() => handleEdit(prod)}
                    className="text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-600 transition-colors"
                >
                    Edit
                </button>
            ),
        }
    ];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div>
                        <h1 className="text-3xl font-bold text-foreground font-heading">Savings Products</h1>
                        <p className="text-muted-foreground mt-1">Configure interest rates and withdrawal rules</p>
                    </div>
                </div>
                <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-all font-bold shadow-lg shadow-primary/20 text-sm"
                >
                    <Plus className="h-4 w-4" />
                    Add Product
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                    <DataTable
                        columns={columns}
                        data={products}
                        isLoading={isLoading}
                    />
                </div>
                <div className="space-y-6">
                    <div className="glass rounded-xl p-6 border border-border bg-primary/5">
                        <div className="flex items-center gap-3 text-primary mb-4">
                            <Settings className="h-5 w-5" />
                            <h3 className="font-bold uppercase tracking-widest text-xs text-foreground">Product Strategy</h3>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Savings products define how interest is calculated (Daily Min vs Avg Daily) and how often it's compounded into the principal balance.
                        </p>
                    </div>
                    <div className="glass rounded-xl p-6 border border-border">
                        <div className="flex items-center gap-3 text-emerald-400 mb-4">
                            <Info className="h-5 w-5" />
                            <h3 className="font-bold uppercase tracking-widest text-xs text-foreground">Guidelines</h3>
                        </div>
                        <ul className="space-y-3">
                            <li className="flex gap-2 text-xs text-muted-foreground">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                Higher rates attract more deposits but increase liabilities.
                            </li>
                            <li className="flex gap-2 text-xs text-muted-foreground">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 flex-shrink-0" />
                                Maintenance fees can be set per product to cover operational costs.
                            </li>
                        </ul>
                    </div>
                </div>
            </div>

            <SavingsProductModal
                isOpen={showModal}
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
