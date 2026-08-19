"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { format } from "date-fns";
import { Plus, ArrowRightLeft, Edit, Trash2, RefreshCw } from "lucide-react";

interface Product {
    id: string;
    name: string;
    unitType: string;
    flavor?: string;
}

interface ProductConversion {
    id: string;
    fromProductId: string;
    toProductId: string;
    fromQuantity: number;
    toQuantity: number;
    createdAt: string;
    fromProduct?: Product;
    toProduct?: Product;
    user?: { id: string; fullName: string; role: string };
}

export default function ProductConversionsPage() {
    const { user } = useAuth();
    const { selectedBranchId } = useBranch();

    const [conversions, setConversions] = useState<ProductConversion[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Dialog States
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingConversion, setEditingConversion] = useState<ProductConversion | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [fromProductId, setFromProductId] = useState("");
    const [toProductId, setToProductId] = useState("");
    const [fromQuantity, setFromQuantity] = useState("1");
    const [toQuantity, setToQuantity] = useState("1");

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
            const [resConversions, resProducts] = await Promise.all([
                api.get(`/product-conversions${branchQuery}`),
                api.get(`/products${branchQuery}`),
            ]);
            setConversions(resConversions.data);
            setProducts(resProducts.data);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Error loading product conversions");
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    }, [selectedBranchId]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const resetForm = () => {
        setFromProductId("");
        setToProductId("");
        setFromQuantity("1");
        setToQuantity("1");
    };

    const handleOpenAdd = () => {
        resetForm();
        if (products.length > 0) setFromProductId(products[0].id);
        if (products.length > 1) setToProductId(products[1].id);
        setIsAddOpen(true);
    };

    const handleOpenEdit = (conv: ProductConversion) => {
        setEditingConversion(conv);
        setFromProductId(conv.fromProductId || conv.fromProduct?.id || "");
        setToProductId(conv.toProductId || conv.toProduct?.id || "");
        setFromQuantity(String(conv.fromQuantity));
        setToQuantity(String(conv.toQuantity));
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!fromProductId || !toProductId) {
            toast.error("Please select source and target products");
            return;
        }
        if (fromProductId === toProductId) {
            toast.error("Source and target products must be different");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post("/product-conversions", {
                branchId: selectedBranchId || undefined,
                fromProductId,
                toProductId,
                fromQuantity: Number(fromQuantity),
                toQuantity: Number(toQuantity),
            });
            toast.success("Product conversion recorded successfully");
            setIsAddOpen(false);
            resetForm();
            fetchData();
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to record conversion");
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingConversion) return;
        if (!fromProductId || !toProductId) {
            toast.error("Please select source and target products");
            return;
        }
        if (fromProductId === toProductId) {
            toast.error("Source and target products must be different");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.patch(`/product-conversions/${editingConversion.id}`, {
                fromProductId,
                toProductId,
                fromQuantity: Number(fromQuantity),
                toQuantity: Number(toQuantity),
            });
            toast.success("Product conversion updated successfully");
            setEditingConversion(null);
            resetForm();
            fetchData();
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to update conversion");
            console.error(e);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this conversion record?")) return;
        try {
            await api.delete(`/product-conversions/${id}`);
            toast.success("Conversion record deleted");
            fetchData();
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to delete conversion record");
        }
    };

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
                        <ArrowRightLeft className="w-6 h-6 text-[#E87A18]" />
                        Product Conversions
                    </h1>
                    <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
                        Log and view conversion history (e.g. converting 1 Uncut Bread into 10 Sliced Packages)
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={fetchData}
                        variant="outline"
                        size="sm"
                        className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold rounded-xl"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
                    </Button>
                    <Button
                        onClick={handleOpenAdd}
                        className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> New Conversion
                    </Button>
                </div>
            </div>

            {/* History Table */}
            <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-[#FAF6F0]">
                            <TableHead className="font-bold text-[#2C1B10]">Date & Time</TableHead>
                            <TableHead className="font-bold text-[#2C1B10]">Source (From)</TableHead>
                            <TableHead className="font-bold text-[#2C1B10]">Target (To)</TableHead>
                            <TableHead className="font-bold text-[#2C1B10]">Conversion Ratio</TableHead>
                            <TableHead className="font-bold text-[#2C1B10]">Logged By</TableHead>
                            <TableHead className="font-bold text-[#2C1B10] text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                                    Loading product conversion history...
                                </TableCell>
                            </TableRow>
                        ) : conversions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-zinc-400">
                                    No product conversions logged yet.
                                </TableCell>
                            </TableRow>
                        ) : (
                            conversions.map((c) => (
                                <TableRow key={c.id} className="hover:bg-[#FAF6F0]/40 transition-colors">
                                    <TableCell>
                                        <div className="font-semibold text-[#2C1B10]">
                                            {format(new Date(c.createdAt), "MMM d, yyyy")}
                                        </div>
                                        <div className="text-xs text-zinc-500 mt-0.5">
                                            {format(new Date(c.createdAt), "hh:mm a")}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-red-700">
                                            -{c.fromQuantity} {c.fromProduct?.unitType || "unit"}
                                        </div>
                                        <div className="text-xs text-zinc-600 font-medium">
                                            {c.fromProduct?.name || "Original Item"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-emerald-700">
                                            +{c.toQuantity} {c.toProduct?.unitType || "unit"}
                                        </div>
                                        <div className="text-xs text-zinc-600 font-medium">
                                            {c.toProduct?.name || "Converted Item"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200">
                                            {c.fromQuantity} {c.fromProduct?.unitType || "unit"} ➔ {c.toQuantity} {c.toProduct?.unitType || "unit"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm font-medium text-[#2C1B10]">
                                            {c.user?.fullName || "Staff"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleOpenEdit(c)}
                                                className="border-zinc-300 text-zinc-700 hover:bg-zinc-100 font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                                            >
                                                <Edit className="w-3.5 h-3.5" /> Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(c.id)}
                                                className="text-red-600 hover:bg-red-50 font-bold text-xs h-8 px-2 rounded-lg"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* CREATE MODAL */}
            {isAddOpen && (
                <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-[#E87A18]" />
                                Log Product Conversion
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleCreate} className="space-y-4 mt-2">
                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Product (Original)
                                </label>
                                <select
                                    required
                                    value={fromProductId}
                                    onChange={(e) => setFromProductId(e.target.value)}
                                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                                >
                                    <option value="" disabled>Select Source Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.unitType})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Quantity
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    value={fromQuantity}
                                    onChange={(e) => setFromQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200"
                                />
                            </div>

                            <div className="text-center text-xs text-amber-700 font-bold uppercase tracking-wider py-1">
                                ⬇ Converts Into ⬇
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Target Product (Converted)
                                </label>
                                <select
                                    required
                                    value={toProductId}
                                    onChange={(e) => setToProductId(e.target.value)}
                                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                                >
                                    <option value="" disabled>Select Target Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.unitType})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Target Quantity Output
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    value={toQuantity}
                                    onChange={(e) => setToQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                                    {isSubmitting ? "Saving..." : "Save Conversion"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* EDIT MODAL */}
            {editingConversion && (
                <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingConversion(null); }}>
                    <DialogContent className="max-w-md rounded-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#E87A18]" />
                                Edit Product Conversion
                            </DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleUpdate} className="space-y-4 mt-2">
                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Product (Original)
                                </label>
                                <select
                                    required
                                    value={fromProductId}
                                    onChange={(e) => setFromProductId(e.target.value)}
                                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                                >
                                    <option value="" disabled>Select Source Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.unitType})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Quantity
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    value={fromQuantity}
                                    onChange={(e) => setFromQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200"
                                />
                            </div>

                            <div className="text-center text-xs text-amber-700 font-bold uppercase tracking-wider py-1">
                                ⬇ Converts Into ⬇
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Target Product (Converted)
                                </label>
                                <select
                                    required
                                    value={toProductId}
                                    onChange={(e) => setToProductId(e.target.value)}
                                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                                >
                                    <option value="" disabled>Select Target Product</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} ({p.unitType})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Target Quantity Output
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    value={toQuantity}
                                    onChange={(e) => setToQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setEditingConversion(null)} className="rounded-xl">
                                    Cancel
                                </Button>
                                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                                    {isSubmitting ? "Updating..." : "Update Conversion"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    );
}
