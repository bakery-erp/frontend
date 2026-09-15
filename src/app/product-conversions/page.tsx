"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
import { Plus, ArrowRightLeft, Edit, Trash2, RefreshCw, AlertTriangle, Lock, Clock, User as UserIcon, History } from "lucide-react";

interface Product {
    id: string;
    name: string;
    unitType: string;
    flavor?: string;
}

interface ActiveSession {
    id: string;
    status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED";
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

    const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
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

    const [sessionStockSummary, setSessionStockSummary] = useState<Record<string, { maxAvailable: number; productName: string; unitType: string }>>({});

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
            const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};

            const [resConversions, resProducts, resSess] = await Promise.all([
                api.get(`/product-conversions${branchQuery}`),
                api.get(`/products${branchQuery}`),
                api.get('/daily-sessions/active', sessionParams).catch(() => ({ data: null })),
            ]);

            setConversions(resConversions.data);
            setProducts(resProducts.data);
            setActiveSession(resSess.data);

            if (resSess.data?.id) {
                const sessDetailRes = await api.get(`/daily-sessions/${resSess.data.id}`);
                if (sessDetailRes.data?.availableStockSummary) {
                    setSessionStockSummary(sessDetailRes.data.availableStockSummary);
                }
            }
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

    const isSessionOpen = activeSession?.status === "OPEN";
    const sessionStatusLabel = !activeSession
        ? "CLOSED"
        : activeSession.status === "PAUSED"
        ? "PAUSED"
        : activeSession.status === "CLOSE_PENDING"
        ? "CLOSING"
        : "OPEN";

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

        const selectedProduct = products.find((p: any) => p.id === fromProductId);
        const availStock = (selectedProduct as any)?.currentStock ?? (selectedProduct as any)?.quantityRemaining;
        if (availStock !== undefined && Number(fromQuantity) > Number(availStock)) {
            toast.error(`Source quantity (${fromQuantity}) cannot exceed current available shop stock (${availStock}).`);
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

    const [filterTab, setFilterTab] = useState<"ALL" | "TODAY" | "HISTORY">("ALL");
    const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

    useEffect(() => {
        const timer = setTimeout(() => {
            const btn = tabRefs.current[filterTab];
            if (btn) {
                btn.scrollIntoView({
                    behavior: "smooth",
                    inline: "center",
                    block: "nearest",
                });
            }
        }, 50);
        return () => clearTimeout(timer);
    }, [filterTab]);

    const todayStr = format(new Date(), "yyyy-MM-dd");
    const isToday = (dateStr: string) => {
        try {
            return format(new Date(dateStr), "yyyy-MM-dd") === todayStr;
        } catch {
            return false;
        }
    };

    const todayConversions = conversions.filter((c) => isToday(c.createdAt));
    const historyConversions = conversions.filter((c) => !isToday(c.createdAt));

    const displayedConversions =
        filterTab === "TODAY"
            ? todayConversions
            : filterTab === "HISTORY"
            ? historyConversions
            : conversions;

    const selectedStock = fromProductId ? sessionStockSummary[fromProductId] : undefined;
    const maxAvailableForConversion = selectedStock ? selectedStock.maxAvailable : 0;
    const isExceedingStock = Boolean(fromProductId && selectedStock && Number(fromQuantity) > maxAvailableForConversion);

    const emptyMessage = isLoading
        ? "Loading product conversion history..."
        : filterTab === "TODAY"
        ? "No product conversions recorded today yet. Click 'New Conversion' to log one."
        : filterTab === "HISTORY"
        ? "No past conversion records found in history."
        : "No product conversions logged yet.";

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
                        disabled={!isSessionOpen}
                        className="bg-[#E87A18] hover:bg-[#d46d13] disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" /> New Conversion
                    </Button>
                </div>
            </div>

            {!isSessionOpen && (
                <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
                    <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                        Daily business session is currently <strong>{sessionStatusLabel}</strong>. Creating product conversions is disabled until the session is reopened.
                    </span>
                </div>
            )}

            {/* Filter Tabs: All, Today, History */}
            <div className="relative mb-4">
                <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-3 bg-gradient-to-r from-[#FAF7EE] to-transparent z-10 sm:hidden" />
                <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-3 bg-gradient-to-l from-[#FAF7EE] to-transparent z-10 sm:hidden" />

                <div className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2.5rem] px-0.5">
                    <button
                        ref={(el) => { tabRefs.current["ALL"] = el; }}
                        onClick={() => setFilterTab("ALL")}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                            filterTab === "ALL"
                                ? "bg-[#2C1B10] text-white shadow-xs"
                                : "text-[#8C7361] hover:bg-[#FAF6F0] border border-[#EDE4D5]"
                        }`}
                    >
                        All Conversions ({conversions.length})
                    </button>
                    <button
                        ref={(el) => { tabRefs.current["TODAY"] = el; }}
                        onClick={() => setFilterTab("TODAY")}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            filterTab === "TODAY"
                                ? "bg-emerald-700 text-white shadow-xs"
                                : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                        }`}
                    >
                        <Clock className="w-3.5 h-3.5" />
                        Today ({todayConversions.length})
                    </button>
                    <button
                        ref={(el) => { tabRefs.current["HISTORY"] = el; }}
                        onClick={() => setFilterTab("HISTORY")}
                        className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                            filterTab === "HISTORY"
                                ? "bg-amber-700 text-white shadow-xs"
                                : "text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                        }`}
                    >
                        <History className="w-3.5 h-3.5" />
                        History ({historyConversions.length})
                    </button>
                </div>
            </div>

            {/* Section Indicator */}
            <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                    {filterTab === "TODAY" ? (
                        <>
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                            <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                Today&apos;s Conversions ({todayConversions.length})
                            </h2>
                        </>
                    ) : filterTab === "HISTORY" ? (
                        <>
                            <History className="w-4 h-4 text-amber-700" />
                            <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                Conversion History ({historyConversions.length})
                            </h2>
                        </>
                    ) : (
                        <>
                            <ArrowRightLeft className="w-4 h-4 text-[#E87A18]" />
                            <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                All Conversions ({conversions.length})
                            </h2>
                        </>
                    )}
                </div>
                <span className="text-[11px] font-semibold text-[#8C7361]">
                    Showing {displayedConversions.length} record{displayedConversions.length === 1 ? "" : "s"}
                </span>
            </div>

            {/* History: Desktop Table & Mobile Cards */}
            <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Conversion Date & Time</TableHead>
                            <TableHead>Source Item (Consumed)</TableHead>
                            <TableHead>Target Item (Produced)</TableHead>
                            <TableHead>Conversion Ratio</TableHead>
                            <TableHead>Logged By</TableHead>
                            <TableHead className="text-right pr-6">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : displayedConversions.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
                                    {emptyMessage}
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayedConversions.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-[#2C1B10]">
                                                {format(new Date(c.createdAt), "MMM d, yyyy")}
                                            </span>
                                            {isToday(c.createdAt) && (
                                                <span className="px-1.5 py-0.2 text-[9px] font-black uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs text-[#8C7361] font-semibold mt-0.5">
                                            {format(new Date(c.createdAt), "hh:mm a")}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-rose-700">
                                            -{c.fromQuantity} {c.fromProduct?.unitType || "unit"}
                                        </div>
                                        <div className="text-xs text-[#8C7361] font-semibold">
                                            {c.fromProduct?.name || "Original Item"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="font-bold text-emerald-700">
                                            +{c.toQuantity} {c.toProduct?.unitType || "unit"}
                                        </div>
                                        <div className="text-xs text-[#8C7361] font-semibold">
                                            {c.toProduct?.name || "Converted Item"}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                                            {c.fromQuantity} {c.fromProduct?.unitType || "unit"} ➔ {c.toQuantity} {c.toProduct?.unitType || "unit"}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-xs font-bold text-[#2C1B10]">
                                            {c.user?.fullName || "Staff"}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => handleOpenEdit(c)}
                                                className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                                            >
                                                <Edit className="w-3.5 h-3.5" /> Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => handleDelete(c.id)}
                                                className="text-rose-600 hover:bg-rose-50 font-bold text-xs h-8 px-2 rounded-lg"
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

            {/* Mobile Audit Cards View */}
            <div className="block md:hidden space-y-3">
                {isLoading ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                        {emptyMessage}
                    </div>
                ) : displayedConversions.length === 0 ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                        {emptyMessage}
                    </div>
                ) : (
                    displayedConversions.map((c) => (
                        <div
                            key={c.id}
                            className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3"
                        >
                            {/* Header: Date and Conversion Ratio Badge */}
                            <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                                <div className="flex items-center gap-1.5 text-xs text-[#8C7361] flex-wrap">
                                    <Clock className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                                    <span className="font-semibold">
                                        {format(new Date(c.createdAt), "MMM d, yyyy · hh:mm a")}
                                    </span>
                                    {isToday(c.createdAt) && (
                                        <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            Today
                                        </span>
                                    )}
                                </div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] shrink-0">
                                    Ratio: {c.fromQuantity} ➔ {c.toQuantity}
                                </span>
                            </div>

                            {/* Product Flow: Consumed & Produced */}
                            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5]">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                                        Source (Consumed)
                                    </span>
                                    <div className="font-extrabold text-sm text-rose-700 font-mono">
                                        -{c.fromQuantity} {c.fromProduct?.unitType || "unit"}
                                    </div>
                                    <div className="text-xs font-semibold text-[#2C1B10] truncate">
                                        {c.fromProduct?.name || "Original Item"}
                                    </div>
                                </div>
                                <div className="space-y-0.5 text-right border-l border-[#EDE4D5] pl-2">
                                    <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                                        Target (Produced)
                                    </span>
                                    <div className="font-extrabold text-sm text-emerald-700 font-mono">
                                        +{c.toQuantity} {c.toProduct?.unitType || "unit"}
                                    </div>
                                    <div className="text-xs font-semibold text-[#2C1B10] truncate">
                                        {c.toProduct?.name || "Converted Item"}
                                    </div>
                                </div>
                            </div>

                            {/* Footer: User & Action Buttons */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F4ECE1]">
                                <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                                    <UserIcon className="w-3.5 h-3.5 text-[#8C7361]" />
                                    <span className="font-medium text-[#4A2E1B]">{c.user?.fullName || "Staff"}</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleOpenEdit(c)}
                                        className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1"
                                    >
                                        <Edit className="w-3.5 h-3.5" /> Edit
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDelete(c.id)}
                                        className="text-rose-600 hover:bg-rose-50 font-bold text-xs h-8 w-8 p-0 rounded-xl"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
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

                                {fromProductId && selectedStock && (
                                    <div className="mt-2 flex items-center justify-between text-xs bg-amber-50 border border-amber-200 p-2.5 rounded-xl shadow-xs">
                                        <span className="text-amber-950 font-semibold">
                                            🛍️ Shop Available: <strong className="font-extrabold text-amber-900 text-sm">{maxAvailableForConversion} {selectedStock.unitType}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setFromQuantity(String(maxAvailableForConversion))}
                                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] rounded-lg shadow-xs active:scale-95 transition-all"
                                        >
                                            Set Max ({maxAvailableForConversion})
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Quantity
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    max={selectedStock ? maxAvailableForConversion : undefined}
                                    value={fromQuantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setFromQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200 font-mono font-bold"
                                />
                                {isExceedingStock && (
                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>Source quantity ({fromQuantity}) exceeds shop stock ({maxAvailableForConversion} {selectedStock?.unitType}).</span>
                                    </div>
                                )}
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
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setToQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200 font-mono font-bold"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || !isSessionOpen || isExceedingStock}
                                    className="bg-[#E87A18] hover:bg-[#d46d13] disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                >
                                    {isSubmitting ? "Saving..." : !isSessionOpen ? `Disabled (${sessionStatusLabel})` : isExceedingStock ? "Exceeds Shop Stock" : "Save Conversion"}
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

                                {fromProductId && selectedStock && (
                                    <div className="mt-2 flex items-center justify-between text-xs bg-amber-50 border border-amber-200 p-2.5 rounded-xl shadow-xs">
                                        <span className="text-amber-950 font-semibold">
                                            🛍️ Shop Available: <strong className="font-extrabold text-amber-900 text-sm">{maxAvailableForConversion} {selectedStock.unitType}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setFromQuantity(String(maxAvailableForConversion))}
                                            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[11px] rounded-lg shadow-xs active:scale-95 transition-all"
                                        >
                                            Set Max ({maxAvailableForConversion})
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                                    Source Quantity
                                </label>
                                <Input
                                    type="number"
                                    required
                                    min="1"
                                    max={selectedStock ? maxAvailableForConversion : undefined}
                                    value={fromQuantity}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setFromQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200 font-mono font-bold"
                                />
                                {isExceedingStock && (
                                    <div className="mt-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                                        <span>Source quantity ({fromQuantity}) exceeds shop stock ({maxAvailableForConversion} {selectedStock?.unitType}).</span>
                                    </div>
                                )}
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
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => setToQuantity(e.target.value)}
                                    className="rounded-xl border-zinc-200 font-mono font-bold"
                                />
                            </div>

                            <DialogFooter className="gap-2 pt-2">
                                <Button type="button" variant="outline" onClick={() => setEditingConversion(null)} className="rounded-xl">
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={isSubmitting || isExceedingStock}
                                    className="bg-[#E87A18] hover:bg-[#d46d13] disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-xl"
                                >
                                    {isSubmitting ? "Updating..." : isExceedingStock ? "Exceeds Shop Stock" : "Update Conversion"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    );
}
