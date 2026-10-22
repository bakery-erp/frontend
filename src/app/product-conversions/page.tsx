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
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { Plus, ArrowRightLeft, Edit, Trash2, AlertTriangle, Lock, Clock, User as UserIcon, History } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableSkeleton } from "@/components/ui/skeletons";

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
    const { t } = useLanguage();
    const isGlobalAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

    const queryClient = useQueryClient();

    // Dialog States
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [editingConversion, setEditingConversion] = useState<ProductConversion | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form States
    const [fromProductId, setFromProductId] = useState("");
    const [toProductId, setToProductId] = useState("");
    const [fromQuantity, setFromQuantity] = useState("1");
    const [toQuantity, setToQuantity] = useState("1");

    const { data: pageData, isLoading } = useQuery({
        queryKey: ['product-conversions', selectedBranchId],
        placeholderData: (prev) => prev,
        queryFn: async () => {
            const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
            const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};
            const minimalParam = branchQuery ? `${branchQuery}&minimal=true` : "?minimal=true";

            const [resConversions, resProducts, resSess] = await Promise.all([
                api.get(`/product-conversions${branchQuery}`),
                api.get(`/products${minimalParam}`),
                api.get('/daily-sessions/active', sessionParams).catch(() => ({ data: null })),
            ]);

            let summary: Record<string, { maxAvailable: number; productName: string; unitType: string }> = {};
            if (resSess.data?.id) {
                const sessDetailRes = await api.get(`/daily-sessions/${resSess.data.id}`).catch(() => ({ data: null }));
                if (sessDetailRes?.data?.availableStockSummary) {
                    summary = sessDetailRes.data.availableStockSummary;
                }
            }

            return {
                conversions: (resConversions.data || []) as ProductConversion[],
                products: (resProducts.data || []) as Product[],
                activeSession: (resSess.data || null) as ActiveSession | null,
                sessionStockSummary: summary,
            };
        },
    });

    const conversions = pageData?.conversions || [];
    const products = pageData?.products || [];
    const activeSession = pageData?.activeSession || null;
    const sessionStockSummary = pageData?.sessionStockSummary || {};



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
            queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
            queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
            queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
            queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
            queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
            queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to delete conversion record");
        }
    };

    const [filterTab, setFilterTab] = useState<"RECENT" | "ALL" | "HISTORY">("RECENT");
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

    const ethNow = new Date(Date.now() + 3 * 3600 * 1000);
    const todayYmd = ethNow.toISOString().slice(0, 10);
    const yesterdayYmd = new Date(ethNow.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);

    const isToday = (dateStr: string) => {
        try {
            return (dateStr || "").slice(0, 10) === todayYmd;
        } catch {
            return false;
        }
    };

    const isYesterday = (dateStr: string) => {
        try {
            return (dateStr || "").slice(0, 10) === yesterdayYmd;
        } catch {
            return false;
        }
    };

    const recentConversions = conversions.filter((c) => isToday(c.createdAt) || isYesterday(c.createdAt));
    const historyConversions = conversions.filter((c) => !isToday(c.createdAt) && !isYesterday(c.createdAt));

    const displayedConversions = isGlobalAdmin
        ? (filterTab === "RECENT"
            ? recentConversions
            : filterTab === "HISTORY"
            ? historyConversions
            : conversions)
        : recentConversions;

    const selectedStock = fromProductId ? sessionStockSummary[fromProductId] : undefined;
    const maxAvailableForConversion = selectedStock ? selectedStock.maxAvailable : 0;
    const isExceedingStock = Boolean(fromProductId && selectedStock && Number(fromQuantity) > maxAvailableForConversion);

    const emptyMessage = (isLoading || !pageData)
        ? t('conversions.loading')
        : filterTab === "RECENT"
        ? "No product conversions recorded today or yesterday yet. Click 'New Conversion' to log one."
        : filterTab === "HISTORY"
        ? "No past conversion records found in history."
        : t('conversions.noConversions');

    return (
        <DashboardLayout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
                        <ArrowRightLeft className="w-6 h-6 text-[#E87A18]" />
                        {t('conversions.title')}
                    </h1>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        onClick={handleOpenAdd}
                        disabled={isLoading || !pageData}
                        size="default"
                    >
                        <Plus className="w-4 h-4" /> {t('conversions.btnNewConversion')}
                    </Button>
                </div>
            </div>

            {/* Filter Tabs: Recent, All, History (Admin & Owner only) */}
            {isGlobalAdmin && (
                <div className="relative mb-4 overflow-hidden">
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#FAF7EE] to-transparent z-10 sm:hidden" />
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#FAF7EE] to-transparent z-10 sm:hidden" />

                    <div
                        className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2.5rem] px-0.5"
                        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                        <button
                            ref={(el) => { tabRefs.current["RECENT"] = el; }}
                            onClick={() => setFilterTab("RECENT")}
                            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                                filterTab === "RECENT"
                                    ? "bg-emerald-700 text-white shadow-xs"
                                    : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                            }`}
                        >
                            <Clock className="w-3.5 h-3.5" />
                            Recent Conversions (Today & Yesterday) ({recentConversions.length})
                        </button>
                        <button
                            ref={(el) => { tabRefs.current["ALL"] = el; }}
                            onClick={() => setFilterTab("ALL")}
                            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 ${
                                filterTab === "ALL"
                                    ? "bg-[#2C1B10] text-white shadow-xs"
                                    : "text-[#8C7361] hover:bg-[#FAF6F0] border border-[#EDE4D5]"
                            }`}
                        >
                            {t('conversions.tabAll')} ({conversions.length})
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
                            {t('conversions.tabHistory')} ({historyConversions.length})
                        </button>
                    </div>
                </div>
            )}

            {/* Section Indicator */}
            {isGlobalAdmin ? (
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        {filterTab === "RECENT" ? (
                            <>
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                    Recent Conversions (Today & Yesterday) ({recentConversions.length})
                                </h2>
                            </>
                        ) : filterTab === "HISTORY" ? (
                            <>
                                <History className="w-4 h-4 text-amber-700" />
                                <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                    {t('conversions.tabHistory')} ({historyConversions.length})
                                </h2>
                            </>
                        ) : (
                            <>
                                <ArrowRightLeft className="w-4 h-4 text-[#E87A18]" />
                                <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                                    {t('conversions.tabAll')} ({conversions.length})
                                </h2>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-emerald-700" />
                        <h2 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">
                            Recent Conversions (Today & Yesterday)
                        </h2>
                    </div>
                </div>
            )}

            {/* History: Desktop Table & Mobile Cards */}
            <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
                {isLoading || !pageData ? (
                    <div className="p-4">
                        <TableSkeleton rows={5} columns={6} hasActions={true} />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>{t('conversions.colDate')}</TableHead>
                                <TableHead>{t('conversions.colSource')}</TableHead>
                                <TableHead>{t('conversions.colTarget')}</TableHead>
                                <TableHead>{t('conversions.colRatio')}</TableHead>
                                <TableHead>{t('conversions.colLoggedBy')}</TableHead>
                                <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayedConversions.length === 0 ? (
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
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                                        Today
                                                    </span>
                                                )}
                                                {isYesterday(c.createdAt) && (
                                                    <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                                        Yesterday
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
                                                    <Edit className="w-3.5 h-3.5" /> {t('common.edit')}
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
                )}
            </div>

            {/* Mobile Audit Cards View */}
            <div className="block md:hidden space-y-3">
                {isLoading || !pageData ? (
                    <TableSkeleton rows={4} columns={3} hasActions={false} />
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
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                                            Today
                                        </span>
                                    )}
                                    {isYesterday(c.createdAt) && (
                                        <span className="inline-flex items-center px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full bg-amber-100 text-amber-900 border border-amber-300">
                                            Yesterday
                                        </span>
                                    )}
                                </div>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] shrink-0">
                                    {t('conversions.colRatio')}: {c.fromQuantity} ➔ {c.toQuantity}
                                </span>
                            </div>

                            {/* Product Flow: Consumed & Produced */}
                            <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5]">
                                <div className="space-y-0.5">
                                    <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                                        {t('conversions.colSource')}
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
                                        {t('conversions.colTarget')}
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
                                        <Edit className="w-3.5 h-3.5" /> {t('common.edit')}
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
                    <DialogContent className="max-w-md w-[calc(100%-1.5rem)] rounded-3xl p-4 sm:p-5 max-h-[88vh] overflow-y-auto bg-white border border-[#EDE4D5]">
                        <DialogHeader className="pb-1">
                            <DialogTitle className="text-base sm:text-lg font-black text-[#2C1B10] flex items-center gap-2">
                                <ArrowRightLeft className="w-5 h-5 text-[#E87A18]" />
                                {t('conversions.modalTitle')}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleCreate} className="space-y-3 mt-1">
                            {/* 1. Source Product Card */}
                            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5] space-y-2">
                                <div className="flex items-center justify-between gap-1">
                                    <label className="text-[10px] font-black uppercase text-[#8C7361] tracking-wider block">
                                        {t('conversions.sourceProduct')} (Deduct)
                                    </label>
                                    {fromProductId && selectedStock && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                            <span className="text-[#8C7361]">
                                                Stock: <strong className="text-amber-900 font-extrabold">{maxAvailableForConversion} {selectedStock.unitType}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setFromQuantity(String(maxAvailableForConversion))}
                                                className="px-1.5 py-0.5 bg-[#E87A18] hover:bg-[#D26911] text-white font-black text-[9px] rounded-md active:scale-95 transition-all"
                                            >
                                                Max
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <select
                                            required
                                            value={fromProductId}
                                            onChange={(e) => setFromProductId(e.target.value)}
                                            className="w-full border border-[#EDE4D5] rounded-xl h-9 px-2.5 bg-white text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] outline-none truncate"
                                        >
                                            <option value="" disabled>Select Source Product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.unitType})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <Input
                                            type="number"
                                            required
                                            min="1"
                                            max={selectedStock ? maxAvailableForConversion : undefined}
                                            value={fromQuantity}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setFromQuantity(e.target.value)}
                                            placeholder="Qty"
                                            className="rounded-xl border-[#EDE4D5] h-9 text-xs font-mono font-bold bg-white text-center"
                                        />
                                    </div>
                                </div>

                                {isExceedingStock && (
                                    <div className="p-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Exceeds shop stock ({maxAvailableForConversion} {selectedStock?.unitType}).</span>
                                    </div>
                                )}
                            </div>

                            {/* Transition Indicator */}
                            <div className="flex items-center justify-center gap-1.5 py-0.5">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-[#E87A18]" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#8C7361]">
                                    Converts Into
                                </span>
                            </div>

                            {/* 2. Target Product Card */}
                            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5] space-y-2">
                                <label className="text-[10px] font-black uppercase text-[#8C7361] tracking-wider block">
                                    {t('conversions.targetProduct')} (Produce)
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <select
                                            required
                                            value={toProductId}
                                            onChange={(e) => setToProductId(e.target.value)}
                                            className="w-full border border-[#EDE4D5] rounded-xl h-9 px-2.5 bg-white text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] outline-none truncate"
                                        >
                                            <option value="" disabled>Select Target Product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.unitType})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <Input
                                            type="number"
                                            required
                                            min="1"
                                            value={toQuantity}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setToQuantity(e.target.value)}
                                            placeholder="Qty"
                                            className="rounded-xl border-[#EDE4D5] h-9 text-xs font-mono font-bold bg-white text-center"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2 pt-2 flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setIsAddOpen(false)}
                                    className="rounded-xl h-9 text-xs font-bold flex-1 sm:flex-initial border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    loading={isSubmitting}
                                    disabled={isExceedingStock}
                                    className="rounded-xl h-9 text-xs font-bold flex-1 sm:flex-initial bg-[#E87A18] hover:bg-[#D26911] text-white"
                                >
                                    {isExceedingStock ? "Exceeds Stock" : t('common.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}

            {/* EDIT MODAL */}
            {editingConversion && (
                <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingConversion(null); }}>
                    <DialogContent className="max-w-md w-[calc(100%-1.5rem)] rounded-3xl p-4 sm:p-5 max-h-[88vh] overflow-y-auto bg-white border border-[#EDE4D5]">
                        <DialogHeader className="pb-1">
                            <DialogTitle className="text-base sm:text-lg font-black text-[#2C1B10] flex items-center gap-2">
                                <Edit className="w-5 h-5 text-[#E87A18]" />
                                {t('common.edit')} {t('conversions.title')}
                            </DialogTitle>
                        </DialogHeader>

                        <form onSubmit={handleUpdate} className="space-y-3 mt-1">
                            {/* 1. Source Product Card */}
                            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5] space-y-2">
                                <div className="flex items-center justify-between gap-1">
                                    <label className="text-[10px] font-black uppercase text-[#8C7361] tracking-wider block">
                                        {t('conversions.sourceProduct')} (Deduct)
                                    </label>
                                    {fromProductId && selectedStock && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold">
                                            <span className="text-[#8C7361]">
                                                Stock: <strong className="text-amber-900 font-extrabold">{maxAvailableForConversion} {selectedStock.unitType}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setFromQuantity(String(maxAvailableForConversion))}
                                                className="px-1.5 py-0.5 bg-[#E87A18] hover:bg-[#D26911] text-white font-black text-[9px] rounded-md active:scale-95 transition-all"
                                            >
                                                Max
                                            </button>
                                        </div>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <select
                                            required
                                            value={fromProductId}
                                            onChange={(e) => setFromProductId(e.target.value)}
                                            className="w-full border border-[#EDE4D5] rounded-xl h-9 px-2.5 bg-white text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] outline-none truncate"
                                        >
                                            <option value="" disabled>Select Source Product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.unitType})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <Input
                                            type="number"
                                            required
                                            min="1"
                                            max={selectedStock ? maxAvailableForConversion : undefined}
                                            value={fromQuantity}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setFromQuantity(e.target.value)}
                                            placeholder="Qty"
                                            className="rounded-xl border-[#EDE4D5] h-9 text-xs font-mono font-bold bg-white text-center"
                                        />
                                    </div>
                                </div>

                                {isExceedingStock && (
                                    <div className="p-1.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-[10px] font-bold flex items-center gap-1.5">
                                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                                        <span>Exceeds shop stock ({maxAvailableForConversion} {selectedStock?.unitType}).</span>
                                    </div>
                                )}
                            </div>

                            {/* Transition Indicator */}
                            <div className="flex items-center justify-center gap-1.5 py-0.5">
                                <ArrowRightLeft className="w-3.5 h-3.5 text-[#E87A18]" />
                                <span className="text-[10px] font-black uppercase tracking-wider text-[#8C7361]">
                                    Converts Into
                                </span>
                            </div>

                            {/* 2. Target Product Card */}
                            <div className="bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5] space-y-2">
                                <label className="text-[10px] font-black uppercase text-[#8C7361] tracking-wider block">
                                    {t('conversions.targetProduct')} (Produce)
                                </label>
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <select
                                            required
                                            value={toProductId}
                                            onChange={(e) => setToProductId(e.target.value)}
                                            className="w-full border border-[#EDE4D5] rounded-xl h-9 px-2.5 bg-white text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] outline-none truncate"
                                        >
                                            <option value="" disabled>Select Target Product</option>
                                            {products.map((p) => (
                                                <option key={p.id} value={p.id}>
                                                    {p.name} ({p.unitType})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-24 shrink-0">
                                        <Input
                                            type="number"
                                            required
                                            min="1"
                                            value={toQuantity}
                                            onFocus={(e) => e.target.select()}
                                            onChange={(e) => setToQuantity(e.target.value)}
                                            placeholder="Qty"
                                            className="rounded-xl border-[#EDE4D5] h-9 text-xs font-mono font-bold bg-white text-center"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="gap-2 pt-2 flex-row sm:justify-end">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setEditingConversion(null)}
                                    className="rounded-xl h-9 text-xs font-bold flex-1 sm:flex-initial border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]"
                                >
                                    {t('common.cancel')}
                                </Button>
                                <Button
                                    type="submit"
                                    loading={isSubmitting}
                                    disabled={isExceedingStock}
                                    className="rounded-xl h-9 text-xs font-bold flex-1 sm:flex-initial bg-[#E87A18] hover:bg-[#D26911] text-white"
                                >
                                    {isExceedingStock ? "Exceeds Stock" : t('common.save')}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            )}
        </DashboardLayout>
    );
}
