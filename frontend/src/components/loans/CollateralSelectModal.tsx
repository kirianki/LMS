'use client';

import { useState, useEffect } from 'react';
import { X, Shield, Plus, Check } from 'lucide-react';
import api from '@/lib/api';

interface CollateralSelectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (collateralId: string) => void;
    borrowerId: string;
    onAddNew: () => void;
}

export default function CollateralSelectModal({ isOpen, onClose, onSelect, borrowerId, onAddNew }: CollateralSelectModalProps) {
    const [collaterals, setCollaterals] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen && borrowerId) {
            fetchCollaterals();
        }
    }, [isOpen, borrowerId]);

    const fetchCollaterals = async () => {
        setIsLoading(true);
        try {
            const response = await api.get(`/collateral/collateral/?borrower=${borrowerId}&status=available`);
            setCollaterals(response.data.results || response.data);
        } catch (error) {
            console.error('Failed to fetch collaterals:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass rounded-3xl border border-border w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between p-6 border-b border-border">
                    <h2 className="text-xl font-bold text-foreground font-heading flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Select Collateral
                    </h2>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
                        <X className="h-5 w-5 text-muted-foreground" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground animate-pulse text-sm">Loading available assets...</div>
                    ) : collaterals.length > 0 ? (
                        collaterals.map((c) => (
                            <div
                                key={c.id}
                                onClick={() => onSelect(c.id)}
                                className="p-4 rounded-xl bg-muted/20 border border-border hover:border-primary/50 cursor-pointer transition-all group"
                            >
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-bold text-sm text-foreground capitalize group-hover:text-primary transition-colors">
                                            {c.collateral_type.replace('_', ' ')}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-mono">
                                            {c.reg_number || c.lr_number || 'ID: ' + c.id.substring(0, 8)}
                                        </p>
                                    </div>
                                    <Check className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                                <div className="mt-3 flex justify-between items-end">
                                    <p className="text-sm font-bold text-foreground">KES {parseFloat(c.market_value).toLocaleString()}</p>
                                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest">FSV: KES {parseFloat(c.forced_sale_value).toLocaleString()}</span>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
                            No available collateral found for this borrower.
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-border bg-muted/10">
                    <button
                        onClick={onAddNew}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 text-primary font-bold hover:bg-primary/20 transition-all border border-primary/20"
                    >
                        <Plus className="h-4 w-4" />
                        Add New Asset
                    </button>
                </div>
            </div>
        </div>
    );
}
