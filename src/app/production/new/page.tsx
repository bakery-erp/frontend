"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  PackageCheck,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Layers,
  Utensils,
  Boxes,
  Edit3,
  Clock,
  XCircle,
  ChefHat,
  Plus,
  Minus,
} from "lucide-react";
import { formatEthDate } from "@/lib/ethiopianDate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailSkeleton } from "@/components/ui/skeletons";
import ConfirmModal from "@/components/ConfirmModal";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import {
  isCategoryAllowedForRole,
  isProductAllowedForRole,
  getStationMeta,
} from "@/lib/roleProductMapping";

interface ProductCategory {
  id: string;
  name: string;
  type: string;
  parentId?: string | null;
  parent?: { id: string; name: string } | null;
}

interface Product {
  id: string;
  name: string;
  unitType: string;
  categoryId: string;
  category?: ProductCategory;
}

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
}

interface ActiveSession {
  id: string;
  status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED";
}

function ProductionFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBatchId = searchParams.get("edit");
  const isEditMode = Boolean(editBatchId);

  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const queryClient = useQueryClient();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [originalBatchStatus, setOriginalBatchStatus] = useState<string | null>(null);

  // Form Header State
  const [date, setDate] = useState<string>(
    new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [mobileStep, setMobileStep] = useState<1 | 2>(1);

  // Selection & Filter State
  const [selectedParentCatId, setSelectedParentCatId] = useState<string>("ALL");
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>("ALL");
  const [productSearch, setProductSearch] = useState<string>("");
  const [materialSearch, setMaterialSearch] = useState<string>("");

  // Refs for auto-centering active category tabs
  const parentCatTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const subCatTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Multi-selected items & quantities: Map of id -> quantity string
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, string>>({});

  // Auto-scroll active parent category tab to center
  useEffect(() => {
    const el = parentCatTabRefs.current[selectedParentCatId];
    if (el) {
      el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  }, [selectedParentCatId]);

  // Auto-scroll active subcategory tab to center
  useEffect(() => {
    const el = subCatTabRefs.current[selectedSubCatId];
    if (el) {
      el.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  }, [selectedSubCatId]);

  const stationMeta = useMemo(() => getStationMeta(user?.role), [user?.role]);

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['production-new-form', selectedBranchId, editBatchId, user?.role],
    queryFn: async () => {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};

      const [resCat, resProd, resStock, resSess, resBatch] = await Promise.all([
        api.get("/product-categories"),
        api.get(`/products${branchQuery}`),
        api.get(`/stock-items${branchQuery}`),
        api.get("/daily-sessions/active", sessionParams).catch(() => ({ data: null })),
        editBatchId ? api.get(`/production-batches/${editBatchId}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);

      const allCats: ProductCategory[] = resCat.data || [];
      const filteredCats = isGlobalAdmin
        ? allCats
        : allCats.filter((c) => isCategoryAllowedForRole(c, user?.role));

      const allProds: Product[] = resProd.data || [];
      const filteredProds = isGlobalAdmin
        ? allProds
        : allProds.filter((p: Product) => isProductAllowedForRole(p, user?.role));

      return {
        categories: filteredCats,
        products: filteredProds,
        stockItems: (resStock.data || []) as StockItem[],
        activeSession: resSess.data as ActiveSession | null,
        batch: resBatch?.data || null,
      };
    },
  });

  const categories = pageData?.categories || [];
  const products = pageData?.products || [];
  const stockItems = pageData?.stockItems || [];
  const activeSession = pageData?.activeSession || null;

  useEffect(() => {
    if (pageData?.batch && editBatchId) {
      const batch = pageData.batch;
      setOriginalBatchStatus(batch.status);
      if (batch.date) {
        setDate(new Date(batch.date).toISOString().slice(0, 10));
      }
      if (batch.shift) {
        setShift(batch.shift);
      }
      if (Array.isArray(batch.items)) {
        const pMap: Record<string, string> = {};
        batch.items.forEach((item: any) => {
          const pId = item.productId || item.product?.id;
          if (pId) pMap[pId] = String(item.quantityProduced);
        });
        setSelectedProducts(pMap);
      }
      if (Array.isArray(batch.materialUsages)) {
        const mMap: Record<string, string> = {};
        batch.materialUsages.forEach((mat: any) => {
          const sId = mat.stockItemId || mat.stockItem?.id;
          if (sId) mMap[sId] = String(mat.quantityUsed);
        });
        setSelectedMaterials(mMap);
      }
    }
  }, [pageData?.batch, editBatchId]);

  const isSessionOpen = activeSession?.status === "OPEN";

  // Filter Categories: Parent vs Sub-categories
  const parentCategories = useMemo(() => {
    return categories.filter((c) => !c.parentId);
  }, [categories]);

  const subCategories = useMemo(() => {
    if (selectedParentCatId === "ALL") return [];
    return categories.filter((c) => c.parentId === selectedParentCatId);
  }, [categories, selectedParentCatId]);

  // Filtered Products List based on Category, Subcategory & Search
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Parent category match
      if (selectedParentCatId !== "ALL") {
        const cat = p.category;
        const parentId = cat?.parentId || cat?.id;
        if (parentId !== selectedParentCatId) return false;
      }
      // Sub category match
      if (selectedSubCatId !== "ALL") {
        if (p.categoryId !== selectedSubCatId) return false;
      }
      // Text search
      if (productSearch.trim()) {
        const q = productSearch.toLowerCase();
        const matchName = p.name.toLowerCase().includes(q);
        const matchCat = p.category?.name.toLowerCase().includes(q);
        if (!matchName && !matchCat) return false;
      }
      return true;
    });
  }, [products, selectedParentCatId, selectedSubCatId, productSearch]);

  // Filtered Raw Materials List
  const filteredMaterials = useMemo(() => {
    if (!materialSearch.trim()) return stockItems;
    const q = materialSearch.toLowerCase();
    return stockItems.filter((s) => s.name.toLowerCase().includes(q));
  }, [stockItems, materialSearch]);

  // Product Selection Handlers
  const toggleProductSelect = (productId: string) => {
    setSelectedProducts((prev) => {
      const next = { ...prev };
      if (next[productId] !== undefined) {
        delete next[productId];
      } else {
        next[productId] = "10"; // Default initial qty 10 Pcs
      }
      return next;
    });
  };

  const updateProductQty = (productId: string, qty: string) => {
    setSelectedProducts((prev) => ({
      ...prev,
      [productId]: qty,
    }));
  };

  const adjustProductQty = (productId: string, delta: number) => {
    setSelectedProducts((prev) => {
      const current = Number(prev[productId] || 0);
      const updated = Math.max(1, current + delta);
      return { ...prev, [productId]: String(updated) };
    });
  };

  const addProductPreset = (productId: string, amount: number) => {
    setSelectedProducts((prev) => {
      const current = Number(prev[productId] || 0);
      const updated = current + amount;
      return { ...prev, [productId]: String(updated) };
    });
  };

  // Material Selection Handlers
  const toggleMaterialSelect = (stockItemId: string) => {
    setSelectedMaterials((prev) => {
      const next = { ...prev };
      if (next[stockItemId] !== undefined) {
        delete next[stockItemId];
      } else {
        next[stockItemId] = "1"; // Default 1 unit
      }
      return next;
    });
  };

  const updateMaterialQty = (stockItemId: string, qty: string) => {
    setSelectedMaterials((prev) => ({
      ...prev,
      [stockItemId]: qty,
    }));
  };

  const adjustMaterialQty = (stockItemId: string, delta: number) => {
    setSelectedMaterials((prev) => {
      const current = Number(prev[stockItemId] || 0);
      const updated = Math.max(0.1, Number((current + delta).toFixed(2)));
      return { ...prev, [stockItemId]: String(updated) };
    });
  };

  const addMaterialPreset = (stockItemId: string, amount: number) => {
    setSelectedMaterials((prev) => {
      const current = Number(prev[stockItemId] || 0);
      const updated = Number((current + amount).toFixed(2));
      return { ...prev, [stockItemId]: String(updated) };
    });
  };

  // Submit Handler (Create vs Edit)
  const handleSubmitBatch = async (e: React.FormEvent) => {
    e.preventDefault();

    const productEntries = Object.entries(selectedProducts)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => ({ productId, quantityProduced: Number(qty) }));

    if (productEntries.length === 0) {
      toast.error("Please select at least one product and specify quantity produced.");
      return;
    }

    const materialEntries = Object.entries(selectedMaterials)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([stockItemId, qty]) => ({ stockItemId, quantityUsed: Number(qty) }));

    setIsSubmitting(true);
    try {
      const systemDate = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

      if (isEditMode) {
        const payload = {
          date: isGlobalAdmin ? date : undefined,
          shift,
          items: productEntries,
          materialUsages: materialEntries,
        };

        await api.patch(`/production-batches/${editBatchId}`, payload);
        toast.success("Production batch updated successfully!");
      } else {
        const payload = {
          branchId: selectedBranchId || undefined,
          date: isGlobalAdmin ? date : systemDate,
          shift,
          items: productEntries,
          materialUsages: materialEntries,
        };

        const res = await api.post("/production-batches", payload);
        if (res.data.status === "PENDING_APPROVAL") {
          toast.success("Production batch logged! Submitted for Admin/Owner approval.");
        } else {
          toast.success("Production batch created & inventory updated successfully!");
        }
      }
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-page'] }),
        queryClient.invalidateQueries({ queryKey: ['production-history'] }),
        queryClient.invalidateQueries({ queryKey: ['daily-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['stock'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      router.push("/production");
    } catch (err: any) {
      toast.error(
        err.response?.data?.error ||
          (isEditMode ? "Failed to update production batch" : "Failed to log production batch")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProductsSelectedCount = Object.keys(selectedProducts).length;
  const totalMaterialsSelectedCount = Object.keys(selectedMaterials).length;
  const isDirty = totalProductsSelectedCount > 0 || totalMaterialsSelectedCount > 0;
  const { showDiscardModal, guardedAction, confirmDiscard, cancelDiscard } = useUnsavedChanges({ isDirty });

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-6 pb-12">
          <DetailSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-4 xs:space-y-6 pb-28 md:pb-12">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 xs:gap-4 bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs">
          <div className="min-w-0 flex-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => guardedAction(() => router.push("/production"))}
              className="text-[#8C7361] hover:text-[#2C1B10] mb-1.5 p-0 h-auto flex items-center gap-1 font-bold text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Production Log
            </Button>
            <h1 className="text-lg xs:text-xl sm:text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Edit3 className="w-5 h-5 xs:w-6 xs:h-6 text-[#E87A18] shrink-0" /> Edit Production Batch
                </>
              ) : (
                <>
                  <PackageCheck className="w-5 h-5 xs:w-6 xs:h-6 text-[#E87A18] shrink-0" /> Multi-Item Production Batch Entry
                </>
              )}
            </h1>
            <p className="text-xs text-[#8C7361] mt-1 max-w-2xl">
              {isEditMode
                ? "Update products baked, quantities produced, or raw materials consumed for this batch."
                : "Select product categories, sub-categories, baked items, and raw materials consumed during this shift."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {!isGlobalAdmin && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold whitespace-nowrap border shadow-2xs ${stationMeta.badgeColor}`}>
                <ChefHat className="w-3.5 h-3.5 shrink-0" />
                {stationMeta.badge}
              </span>
            )}
            {isEditMode && originalBatchStatus && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border shadow-2xs ${
                  originalBatchStatus === "PENDING_APPROVAL"
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : originalBatchStatus === "COMPLETED"
                    ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                    : originalBatchStatus === "REJECTED"
                    ? "bg-rose-50 text-rose-900 border-rose-300"
                    : "bg-zinc-100 text-zinc-800 border-zinc-200"
                }`}
              >
                {originalBatchStatus === "PENDING_APPROVAL" && <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
                {originalBatchStatus === "COMPLETED" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                {originalBatchStatus === "REJECTED" && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                {originalBatchStatus === "PENDING_APPROVAL"
                  ? "Pending Approval"
                  : originalBatchStatus === "COMPLETED"
                  ? "Approved / Completed"
                  : originalBatchStatus === "REJECTED"
                  ? "Rejected"
                  : originalBatchStatus}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border shadow-2xs ${
                isLoading
                  ? "bg-zinc-100 text-zinc-600 border-zinc-200"
                  : isSessionOpen
                  ? "bg-emerald-50 text-emerald-900 border-emerald-300"
                  : "bg-amber-50 text-amber-900 border-amber-300"
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isLoading
                    ? "bg-zinc-400 animate-pulse"
                    : isSessionOpen ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                }`}
              />
              {isLoading ? "Checking Session..." : isSessionOpen ? "Session Open" : "Session Closed"}
            </span>
          </div>
        </div>

        {/* Warning if no active open session (only for new batches) */}
        {!isLoading && !!pageData && !isSessionOpen && !isEditMode && (
          <div className="p-3.5 xs:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5 xs:gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-sm">Active Session Required</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Daily session is currently paused or closed. You can review categories and select items, but logging new production requires an active open session.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitBatch} className="space-y-4 xs:space-y-6">
          {/* Mobile 2-Step Wizard Indicator (md:hidden) */}
          <div className="md:hidden bg-white p-2.5 rounded-2xl border border-[#EDE4D5] shadow-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileStep(1)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition-all ${
                  mobileStep === 1
                    ? "bg-[#4A2E1B] text-white shadow-xs"
                    : "bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                  mobileStep === 1 ? "bg-white text-[#4A2E1B]" : "bg-[#4A2E1B] text-white"
                }`}>
                  1
                </span>
                <span className="truncate">
                  {user?.role === 'CAKE_WORKER' ? '1. Cakes' : user?.role === 'SAMBUSA_WORKER' ? '1. Sambusa' : '1. Products'} ({totalProductsSelectedCount})
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const hasProductWithQty = Object.entries(selectedProducts).some(([_, qty]) => Number(qty) > 0);
                  if (!hasProductWithQty) {
                    toast.error("Please select at least one baked product first.");
                    return;
                  }
                  setMobileStep(2);
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-extrabold transition-all ${
                  mobileStep === 2
                    ? "bg-[#4A2E1B] text-white shadow-xs"
                    : "bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]"
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 ${
                  mobileStep === 2 ? "bg-white text-[#4A2E1B]" : "bg-[#8C7361] text-white"
                }`}>
                  2
                </span>
                <span className="truncate">2. Ingredients ({totalMaterialsSelectedCount})</span>
              </button>
            </div>
          </div>

          {/* Mobile Compact Shift & Date Bar (< md) */}
          <div className="md:hidden bg-white p-3 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 font-bold text-xs">
                📅
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-[#2C1B10] truncate">
                  {formatEthDate(date)}
                </div>
                <span className="text-[10px] text-[#8C7361] font-semibold">
                  {isGlobalAdmin ? "Admin Log" : "Today's Batch"}
                </span>
              </div>
            </div>

            {/* Shift toggle pill on mobile */}
            <div className="flex items-center bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5] shrink-0">
              <button
                type="button"
                onClick={() => setShift("DAY")}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  shift === "DAY" ? "bg-amber-500 text-zinc-950 shadow-2xs" : "text-[#8C7361] hover:text-[#2C1B10]"
                }`}
              >
                ☀️ Day
              </button>
              <button
                type="button"
                onClick={() => setShift("NIGHT")}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  shift === "NIGHT" ? "bg-indigo-600 text-white shadow-2xs" : "text-[#8C7361] hover:text-[#2C1B10]"
                }`}
              >
                🌙 Night
              </button>
            </div>
          </div>

          {/* Shift & Date Header Configuration (Desktop md+) */}
          <div className="hidden md:grid bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs grid-cols-1 sm:grid-cols-2 gap-3 xs:gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                Production Date {isGlobalAdmin ? "(Ethiopian)" : "(System Logged)"}
              </label>
              <Input
                type="date"
                required
                disabled={!isGlobalAdmin}
                value={isGlobalAdmin ? date : (isEditMode ? date : new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10))}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl font-medium disabled:opacity-75 disabled:cursor-not-allowed text-[#4A2E1B] h-10 xs:h-11"
              />
              {!isGlobalAdmin && (
                <p className="text-[10px] text-[#8C7361] mt-1 font-semibold">
                  🔒 Date is automatically set to today system log time.
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                Work Shift
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 xs:h-11 px-3 text-sm font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="DAY">Day Shift (Pagal / Day)</option>
                <option value="NIGHT">Night Shift (Rati / Night)</option>
              </select>
            </div>
          </div>

          {/* SECTION 1: PRODUCT CATEGORY FILTER & MULTI-PRODUCT SELECTION */}
          <div className={`bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-4 xs:space-y-5 ${mobileStep === 1 ? 'block' : 'hidden md:block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 xs:gap-3 border-b border-[#F4ECE1] pb-3 xs:pb-4">
              <div>
                <h2 className="text-base xs:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Utensils className="w-4 h-4 xs:w-5 xs:h-5 text-[#E87A18]" />
                  {user?.role === 'CAKE_WORKER'
                    ? '1. Select Cakes & Pastries'
                    : user?.role === 'SAMBUSA_WORKER'
                    ? '1. Select Sambusa & Snack Products'
                    : '1. Select Bakery Products & Quantities'}
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {user?.role === 'CAKE_WORKER'
                    ? 'Select cakes and pastries produced in this batch.'
                    : user?.role === 'SAMBUSA_WORKER'
                    ? 'Select sambusa, fetira, or snack items prepared in this batch.'
                    : 'Filter by category / subcategory and check all items baked in this batch.'}
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
                {totalProductsSelectedCount} Products Selected
              </span>
            </div>

            {/* Category & Subcategory Filter Tabs (shown when multiple categories exist) */}
            {parentCategories.length > 1 && (
              <div className="space-y-2.5 bg-[#FAF6F0] p-3 xs:p-4 rounded-xl border border-[#EDE4D5]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B] mb-1">
                  <Layers className="w-4 h-4 text-[#E87A18]" /> Main Product Category:
                </div>
                {/* Main Category Row */}
                <div className="relative w-full overflow-hidden">
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#FAF6F0] to-transparent z-10 sm:hidden" />
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#FAF6F0] to-transparent z-10 sm:hidden" />
                  <div
                    className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] pb-1"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                  >
                    <button
                      ref={(el) => {
                        parentCatTabRefs.current["ALL"] = el;
                      }}
                      type="button"
                      onClick={() => {
                        setSelectedParentCatId("ALL");
                        setSelectedSubCatId("ALL");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap shrink-0 ${
                        selectedParentCatId === "ALL"
                          ? "bg-[#4A2E1B] text-white shadow-xs"
                          : "bg-white text-[#4A2E1B] border border-[#EDE4D5] hover:bg-[#F4ECE1]"
                      }`}
                    >
                      All Categories ({products.length})
                    </button>
                    {parentCategories.map((cat) => {
                      const catCount = products.filter(
                        (p) => p.category?.parentId === cat.id || p.category?.id === cat.id
                      ).length;
                      return (
                        <button
                          key={cat.id}
                          ref={(el) => {
                            parentCatTabRefs.current[cat.id] = el;
                          }}
                          type="button"
                          onClick={() => {
                            setSelectedParentCatId(cat.id);
                            setSelectedSubCatId("ALL");
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap shrink-0 ${
                            selectedParentCatId === cat.id
                              ? "bg-[#4A2E1B] text-white shadow-xs"
                              : "bg-white text-[#4A2E1B] border border-[#EDE4D5] hover:bg-[#F4ECE1]"
                          }`}
                        >
                          {cat.name} ({catCount})
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Sub-Category Filter Row if applicable */}
                {subCategories.length > 0 && (
                  <div className="relative w-full overflow-hidden pt-2.5 border-t border-[#EDE4D5]">
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#FAF6F0] to-transparent z-10 sm:hidden" />
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#FAF6F0] to-transparent z-10 sm:hidden" />
                    <div
                      className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] pb-1"
                      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                    >
                      <span className="text-[11px] font-bold text-[#8C7361] mr-1 whitespace-nowrap shrink-0">Sub-Category:</span>
                      <button
                        ref={(el) => {
                          subCatTabRefs.current["ALL"] = el;
                        }}
                        type="button"
                        onClick={() => setSelectedSubCatId("ALL")}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                          selectedSubCatId === "ALL"
                            ? "bg-[#E87A18] text-white"
                            : "bg-white text-[#8C7361] border border-[#EDE4D5]"
                        }`}
                      >
                        All Sub-categories
                      </button>
                      {subCategories.map((sub) => (
                        <button
                          key={sub.id}
                          ref={(el) => {
                            subCatTabRefs.current[sub.id] = el;
                          }}
                          type="button"
                          onClick={() => setSelectedSubCatId(sub.id)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${
                            selectedSubCatId === sub.id
                              ? "bg-[#E87A18] text-white"
                              : "bg-white text-[#8C7361] border border-[#EDE4D5]"
                          }`}
                        >
                          {sub.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Product Search & Multi-Select Grid */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#8C7361]" />
              <Input
                type="text"
                placeholder="Search products by name or type..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 bg-white border-[#EDE4D5] rounded-xl text-xs"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
                {isGlobalAdmin
                  ? "No products match the selected category filter or search query."
                  : `No products found for ${stationMeta.badge} in this branch or matching search.`}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProducts[p.id] !== undefined;
                  const qtyVal = selectedProducts[p.id] || "";

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                        isSelected
                          ? "bg-amber-50/80 border-[#E87A18] ring-2 ring-[#E87A18]/20 shadow-sm"
                          : "bg-white border-[#EDE4D5] hover:border-zinc-300 shadow-2xs"
                      }`}
                    >
                      <div
                        onClick={() => toggleProductSelect(p.id)}
                        className="flex items-start justify-between gap-2.5 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div
                            className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                              isSelected
                                ? "bg-[#E87A18] text-white shadow-2xs"
                                : "border-2 border-[#EDE4D5] bg-[#FAF6F0]"
                            }`}
                          >
                            {isSelected && <CheckCircle2 className="w-4 h-4" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-extrabold text-sm text-[#2C1B10] truncate">{p.name}</h4>
                            <span className="text-[11px] font-semibold text-[#8C7361] block">
                              {p.category?.name || "Bakery"} • <strong className="text-[#4A2E1B]">{p.unitType}</strong>
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E87A18] text-white shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-amber-200/70 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[11px] font-extrabold uppercase tracking-wide text-[#4A2E1B]">
                              Produced Qty:
                            </span>
                            <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-[#EDE4D5] shadow-2xs">
                              <button
                                type="button"
                                onClick={() => adjustProductQty(p.id, -10)}
                                className="w-8 h-8 rounded-lg bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#4A2E1B] font-black text-sm flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                                title="-10"
                              >
                                -
                              </button>
                              <Input
                                type="number"
                                min="1"
                                value={qtyVal}
                                onChange={(e) => updateProductQty(p.id, e.target.value)}
                                className="w-16 h-8 text-center bg-transparent border-0 font-mono font-black text-sm text-[#2C1B10] p-0 focus-visible:ring-0"
                              />
                              <button
                                type="button"
                                onClick={() => adjustProductQty(p.id, 10)}
                                className="w-8 h-8 rounded-lg bg-[#E87A18] hover:bg-[#d66f13] text-white font-black text-sm flex items-center justify-center active:scale-95 transition-all shadow-2xs cursor-pointer"
                                title="+10"
                              >
                                +
                              </button>
                              <span className="text-[10px] font-bold text-[#8C7361] pr-1.5">{p.unitType}</span>
                            </div>
                          </div>

                          {/* Quick Add Preset Chips */}
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                            <span className="text-[10px] font-bold text-[#8C7361] shrink-0">Quick Add:</span>
                            {[10, 25, 50, 100].map((amt) => (
                              <button
                                key={amt}
                                type="button"
                                onClick={() => addProductPreset(p.id, amt)}
                                className="px-2 py-1 rounded-lg bg-[#FAF6F0] hover:bg-amber-100 border border-amber-200 text-[#4A2E1B] text-[11px] font-extrabold shrink-0 active:scale-95 transition-all shadow-2xs cursor-pointer"
                              >
                                +{amt}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Mobile Next Step Button */}
            <div className="md:hidden pt-3 border-t border-[#F4ECE1]">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  const hasProductWithQty = Object.entries(selectedProducts).some(([_, qty]) => Number(qty) > 0);
                  if (!hasProductWithQty) {
                    toast.error("Please enter a produced quantity for at least one product before proceeding.");
                    return;
                  }
                  setMobileStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full flex items-center justify-center gap-2 bg-[#4A2E1B] hover:bg-[#3D2516] text-white"
              >
                <span>Next: Select Raw Materials</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* SECTION 2: RAW MATERIAL / INGREDIENT SELECTION */}
          <div className={`bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-4 xs:space-y-5 ${mobileStep === 2 ? 'block' : 'hidden md:block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 xs:gap-3 border-b border-[#F4ECE1] pb-3 xs:pb-4">
              <div>
                <h2 className="text-base xs:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Boxes className="w-4 h-4 xs:w-5 xs:h-5 text-indigo-600" /> 2. Select Consumed Raw Materials & Ingredients
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  Multi-select flour, sugar, yeast, oil, and packaging materials consumed for this production.
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
                {totalMaterialsSelectedCount} Ingredients Selected
              </span>
            </div>

            {/* Material Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#8C7361]" />
              <Input
                type="text"
                placeholder="Search raw materials (flour, sugar, yeast, oil...)..."
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="pl-9 bg-white border-[#EDE4D5] rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 xs:gap-3 max-h-[420px] overflow-y-auto pr-1">
              {filteredMaterials.map((mat) => {
                const isSelected = selectedMaterials[mat.id] !== undefined;
                const qtyVal = selectedMaterials[mat.id] || "";

                return (
                  <div
                    key={mat.id}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                      isSelected
                        ? "bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-500/20 shadow-sm"
                        : "bg-white border-[#EDE4D5] hover:border-zinc-300 shadow-2xs"
                    }`}
                  >
                    <div
                      onClick={() => toggleMaterialSelect(mat.id)}
                      className="flex items-start justify-between gap-2.5 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div
                          className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-all ${
                            isSelected
                              ? "bg-indigo-600 text-white shadow-2xs"
                              : "border-2 border-[#EDE4D5] bg-[#FAF6F0]"
                          }`}
                        >
                          {isSelected && <CheckCircle2 className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-[#2C1B10] truncate">{mat.name}</h4>
                          <span className="text-[11px] font-semibold text-[#8C7361] block">
                            In stock: <strong className="text-indigo-900">{mat.currentQuantity} {mat.unitType}</strong>
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white shrink-0">
                          Added
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-indigo-200/70 space-y-2.5" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold uppercase tracking-wide text-indigo-950">
                            Used Amount:
                          </span>
                          <div className="flex items-center gap-1.5 bg-white p-1 rounded-xl border border-indigo-200 shadow-2xs">
                            <button
                              type="button"
                              onClick={() => adjustMaterialQty(mat.id, -1)}
                              className="w-8 h-8 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 font-black text-sm flex items-center justify-center active:scale-95 transition-all cursor-pointer"
                            >
                              -
                            </button>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={qtyVal}
                              onChange={(e) => updateMaterialQty(mat.id, e.target.value)}
                              className="w-16 h-8 text-center bg-transparent border-0 font-mono font-black text-sm text-indigo-950 p-0 focus-visible:ring-0"
                            />
                            <button
                              type="button"
                              onClick={() => adjustMaterialQty(mat.id, 1)}
                              className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm flex items-center justify-center active:scale-95 transition-all shadow-2xs cursor-pointer"
                            >
                              +
                            </button>
                            <span className="text-[10px] font-bold text-zinc-500 pr-1.5">{mat.unitType}</span>
                          </div>
                        </div>

                        {/* Quick Add Preset Chips */}
                        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
                          <span className="text-[10px] font-bold text-[#8C7361] shrink-0">Quick Add:</span>
                          {[1, 5, 10, 25].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => addMaterialPreset(mat.id, amt)}
                              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-900 text-[11px] font-extrabold shrink-0 active:scale-95 transition-all shadow-2xs cursor-pointer"
                            >
                              +{amt}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SUMMARY PANEL & SUBMISSION (Desktop md+) */}
          <div className="hidden md:flex bg-[#FAF6F0] p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 xs:gap-4 shadow-sm">
            <div>
              <h3 className="font-extrabold text-sm text-[#2C1B10]">
                {isEditMode ? "Save changes to this production batch?" : "Ready to submit production batch?"}
              </h3>
              <p className="text-xs text-[#8C7361] mt-0.5">
                Selected <strong className="text-[#4A2E1B]">{totalProductsSelectedCount} products</strong> and{" "}
                <strong className="text-[#4A2E1B]">{totalMaterialsSelectedCount} materials</strong> for shift log.
              </p>
            </div>

            <div className="flex items-center gap-2.5 xs:gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => guardedAction(() => router.push("/production"))}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                loadingText={isEditMode ? "Updating Batch..." : "Submitting..."}
                disabled={
                  totalProductsSelectedCount === 0 ||
                  (!isEditMode && !isSessionOpen)
                }
                className="flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isEditMode
                  ? "Save & Update Batch"
                  : !isSessionOpen
                  ? "Session Closed"
                  : isGlobalAdmin
                  ? "Submit & Approve Batch"
                  : "Submit for Approval"}
              </Button>
            </div>
          </div>

          {/* Mobile Sticky Bottom Action Bar (< md) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EDE4D5] p-3 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {mobileStep === 1 ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <span className="text-xs font-black text-[#2C1B10] block">
                    {totalProductsSelectedCount} Product{totalProductsSelectedCount === 1 ? '' : 's'} Selected
                  </span>
                  <span className="text-[10px] text-[#8C7361] font-semibold truncate block">
                    Step 1 of 2: Products Baked
                  </span>
                </div>
                <Button
                  type="button"
                  size="lg"
                  disabled={totalProductsSelectedCount === 0}
                  onClick={() => {
                    const hasProductWithQty = Object.entries(selectedProducts).some(([_, qty]) => Number(qty) > 0);
                    if (!hasProductWithQty) {
                      toast.error("Please enter a produced quantity for at least one product.");
                      return;
                    }
                    setMobileStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-xs h-11 px-4 rounded-xl flex items-center gap-1.5 shadow-md shrink-0 cursor-pointer"
                >
                  <span>Next: Ingredients</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setMobileStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-11 px-3.5 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Products</span>
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  loadingText={isEditMode ? "Saving..." : "Submitting..."}
                  disabled={totalProductsSelectedCount === 0 || (!isEditMode && !isSessionOpen)}
                  className="flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="truncate">
                    {isEditMode ? "Save Batch" : isGlobalAdmin ? "Approve Batch" : "Submit for Approval"}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showDiscardModal}
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
        title="Discard Production Batch?"
        description="You have selected items and material quantities for this production batch. Are you sure you want to discard your work?"
        confirmText="Discard and Leave"
        cancelText="Continue Editing"
        variant="warning"
      />
    </DashboardLayout>
  );
}

export default function NewProductionPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="max-w-6xl mx-auto py-12 text-center text-sm text-[#8C7361]">
            Loading production form...
          </div>
        </DashboardLayout>
      }
    >
      <ProductionFormContent />
    </Suspense>
  );
}
