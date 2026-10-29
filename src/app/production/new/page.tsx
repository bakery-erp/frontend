"use client";

import { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
} from "lucide-react";
import { formatEthDate } from "@/lib/ethiopianDate";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailSkeleton } from "@/components/ui/skeletons";
import ConfirmModal from "@/components/ConfirmModal";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { useLanguage } from "@/context/LanguageContext";
import {
  isCategoryAllowedForRole,
  isProductAllowedForRole,
  getStationMeta,
} from "@/lib/roleProductMapping";

interface ProductCategory {
  id: string;
  name: string;
  type: string;
  productionRole?: string | null;
  parentId?: string | null;
  parent?: { id: string; name: string; type?: string; productionRole?: string | null } | null;
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

function ProductionFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBatchId = searchParams.get("edit");
  const isEditMode = Boolean(editBatchId);

  const { user } = useAuth();
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [formBranchId, setFormBranchId] = useState<string>(selectedBranchId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showModalBreakdown, setShowModalBreakdown] = useState(false);

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

  // Initial loaded state for edit mode to prevent false positive dirty discard modals
  const initialBatchStateRef = useRef<{
    date: string;
    shift: string;
    products: Record<string, string>;
    materials: Record<string, string>;
  } | null>(null);

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

  // Synchronize branch id from context
  useEffect(() => {
    if (selectedBranchId && !formBranchId) {
      setFormBranchId(selectedBranchId);
    }
  }, [selectedBranchId, formBranchId]);

  const stationMeta = useMemo(() => getStationMeta(user?.role), [user?.role]);

  const formatUnit = (unit?: string | null): string => {
    if (!unit) return "";
    const u = unit.toUpperCase();
    if (u === "PIECE" || u === "PCS") return t("common.units.piece") || "Piece";
    if (u === "KG" || u === "KILOGRAM") return t("common.units.kg") || "Kg";
    if (u === "LITER" || u === "LITRE" || u === "L") return t("common.units.liter") || "Liter";
    return unit;
  };

  const stationBadgeLabel = useMemo(() => {
    switch (user?.role) {
      case "BAKER":
        return t("production.stationBaker") || "Baker Station";
      case "CAKE_WORKER":
        return t("production.stationCake") || "Cake Station";
      case "SAMBUSA_WORKER":
        return t("production.stationSambusa") || "Sambusa Station";
      default:
        return t("production.stationAll") || "All Stations";
    }
  }, [user?.role, t]);

  const activeBranchId = formBranchId || selectedBranchId;

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['production-new-form', activeBranchId, editBatchId, user?.role],
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const branchQuery = activeBranchId ? `?branchId=${activeBranchId}` : "";
      const minimalParam = branchQuery ? `${branchQuery}&minimal=true` : "?minimal=true";

      let batchData = null;
      let batchError: string | null = null;
      if (editBatchId) {
        try {
          const resBatch = await api.get(`/production-batches/${editBatchId}`);
          batchData = resBatch.data;
        } catch (err: any) {
          batchError = err.response?.data?.error || "Production batch not found or cannot be edited.";
        }
      }

      const [resCat, resProd, resStock] = await Promise.all([
        api.get("/product-categories"),
        api.get(`/products${minimalParam}`),
        api.get(`/stock-items${branchQuery}`),
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
        batch: batchData,
        batchError,
      };
    },
  });

  const categories = pageData?.categories || [];
  const products = pageData?.products || [];
  const stockItems = pageData?.stockItems || [];

  // Redirect and alert if batch could not be fetched in edit mode
  useEffect(() => {
    if (editBatchId && pageData?.batchError) {
      toast.error(pageData.batchError);
      router.push("/production");
    }
  }, [editBatchId, pageData?.batchError, router]);

  useEffect(() => {
    if (pageData?.batch && editBatchId) {
      const batch = pageData.batch;
      // Guard: Non-admin workers can only edit today's batches
      const todayYmd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
      const batchDateYmd = batch.date ? new Date(batch.date).toISOString().slice(0, 10) : "";
      if (!isGlobalAdmin && batchDateYmd && batchDateYmd !== todayYmd) {
        toast.error(t("production.cantEditPastBatches") || "Bakers can only edit batches created today. Past batches cannot be modified.");
        router.push("/production");
        return;
      }

      const bDate = batch.date ? new Date(batch.date).toISOString().slice(0, 10) : date;
      const bShift = batch.shift || "DAY";
      if (batch.date) {
        setDate(bDate);
      }
      if (batch.shift) {
        setShift(bShift);
      }
      if (batch.branchId && !formBranchId) {
        setFormBranchId(batch.branchId);
      }

      const pMap: Record<string, string> = {};
      if (Array.isArray(batch.items)) {
        batch.items.forEach((item: any) => {
          const pId = item.productId || item.product?.id;
          if (pId) pMap[pId] = String(item.quantityProduced);
        });
        setSelectedProducts(pMap);
      }

      const mMap: Record<string, string> = {};
      if (Array.isArray(batch.materialUsages)) {
        batch.materialUsages.forEach((mat: any) => {
          const sId = mat.stockItemId || mat.stockItem?.id;
          if (sId) mMap[sId] = String(mat.quantityUsed);
        });
        setSelectedMaterials(mMap);
      }

      // Record pristine initial state for accurate dirty-checking
      initialBatchStateRef.current = {
        date: bDate,
        shift: bShift,
        products: { ...pMap },
        materials: { ...mMap },
      };
    }
  }, [pageData?.batch, editBatchId, isGlobalAdmin, router]);

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
        next[productId] = "0"; // Default initial qty 0
      }
      return next;
    });
  };

  // Helper to format quantity inputs cleanly without stripping legitimate numbers like 10, 20, 50
  const formatQtyInput = (rawVal: string): string => {
    if (rawVal === "") return "";
    // Disallow negative values
    if (rawVal.startsWith("-")) return "";
    // If user typed "00", keep as single "0"
    if (rawVal === "00") return "0";
    // If input starts with "0" followed by digits (e.g., "02" -> "2", "050" -> "50", but keep "0." / "0.5")
    if (/^0\d+/.test(rawVal) && !rawVal.startsWith("0.")) {
      return rawVal.replace(/^0+/, "") || "0";
    }
    return rawVal;
  };

  const updateProductQty = (productId: string, qty: string) => {
    setSelectedProducts((prev) => {
      const formatted = formatQtyInput(qty);
      return {
        ...prev,
        [productId]: formatted,
      };
    });
  };

  // Material Selection Handlers
  const toggleMaterialSelect = (stockItemId: string) => {
    setSelectedMaterials((prev) => {
      const next = { ...prev };
      if (next[stockItemId] !== undefined) {
        delete next[stockItemId];
      } else {
        next[stockItemId] = "0"; // Default initial qty 0
      }
      return next;
    });
  };

  const updateMaterialQty = (stockItemId: string, qty: string) => {
    setSelectedMaterials((prev) => {
      const formatted = formatQtyInput(qty);
      return {
        ...prev,
        [stockItemId]: formatted,
      };
    });
  };

  // Selected items summary lists for modal and submit
  const selectedProductList = useMemo(() => {
    return Object.entries(selectedProducts)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([productId, qty]) => {
        const prod = products.find((p) => p.id === productId);
        return {
          product: prod || { id: productId, name: "Product", unitType: "unit" },
          qty: Number(qty),
        };
      });
  }, [selectedProducts, products]);

  const selectedMaterialList = useMemo(() => {
    return Object.entries(selectedMaterials)
      .filter(([_, qty]) => Number(qty) > 0)
      .map(([stockItemId, qty]) => {
        const mat = stockItems.find((s) => s.id === stockItemId);
        return {
          stockItem: mat || { id: stockItemId, name: "Raw Material", unitType: "unit" },
          qty: Number(qty),
        };
      });
  }, [selectedMaterials, stockItems]);

  const totalProducedUnits = useMemo(() => {
    return selectedProductList.reduce((acc, curr) => acc + curr.qty, 0);
  }, [selectedProductList]);

  // Submit Request Handler (Opens Confirmation Modal)
  const handleRequestSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!isEditMode && user?.role === "OWNER" && !activeBranchId) {
      toast.error(t("production.selectBranchRequired") || "Please select a branch before saving the production batch.");
      return;
    }

    // On mobile (< 768px), if the user is in Step 1, pressing Go/Enter should proceed to Step 2 (Ingredients)
    // and NEVER jump directly to the confirmation modal without selecting raw materials
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    if (isMobile && mobileStep === 1) {
      const hasProductWithQty = Object.entries(selectedProducts).some(([_, qty]) => Number(qty) > 0);
      if (!hasProductWithQty) {
        toast.error(t("production.toastSpecifyAtLeastOne"));
        return;
      }
      setMobileStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    const productEntries = Object.entries(selectedProducts)
      .filter(([_, qty]) => Number(qty) > 0);

    if (productEntries.length === 0) {
      toast.error(t("production.toastSpecifyAtLeastOne"));
      return;
    }

    setShowModalBreakdown(false);
    setShowSubmitModal(true);
  };

  // Execution Handler after Modal Confirmation
  const executeSubmitBatch = async () => {
    const productEntries = selectedProductList.map((item) => ({
      productId: item.product.id!,
      quantityProduced: item.qty,
    }));

    const materialEntries = selectedMaterialList.map((item) => ({
      stockItemId: item.stockItem.id!,
      quantityUsed: item.qty,
    }));

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
        toast.success(t("production.toastBatchUpdatedSuccess"));
      } else {
        const branchToUse = activeBranchId || user?.branchId;
        if (!branchToUse) {
          toast.error(t("production.selectBranchRequired") || "Please select a branch before saving the production batch.");
          setIsSubmitting(false);
          return;
        }

        const payload = {
          branchId: branchToUse,
          date: isGlobalAdmin ? date : systemDate,
          shift,
          items: productEntries,
          materialUsages: materialEntries,
        };

        await api.post("/production-batches", payload);
        toast.success(t("production.toastBatchCreatedSuccess") || "Production batch created successfully");
      }

      setShowSubmitModal(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['production-page'] }),
        queryClient.invalidateQueries({ queryKey: ['production-page-batches'] }),
        queryClient.invalidateQueries({ queryKey: ['production-worker-counts'] }),
        queryClient.invalidateQueries({ queryKey: ['production-batch-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['production-history'] }),
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
          (isEditMode ? t("production.toastBatchUpdateFailed") : t("production.toastBatchCreateFailed"))
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProductsSelectedCount = Object.keys(selectedProducts).length;
  const totalMaterialsSelectedCount = Object.keys(selectedMaterials).length;

  const isDirty = useMemo(() => {
    if (isSubmitting) return false;
    if (isEditMode) {
      const init = initialBatchStateRef.current;
      if (!init) return false;
      if (date !== init.date) return true;
      if (shift !== init.shift) return true;
      const currPKeys = Object.keys(selectedProducts);
      const initPKeys = Object.keys(init.products || {});
      if (currPKeys.length !== initPKeys.length) return true;
      for (const k of currPKeys) {
        if (selectedProducts[k] !== init.products?.[k]) return true;
      }
      const currMKeys = Object.keys(selectedMaterials);
      const initMKeys = Object.keys(init.materials || {});
      if (currMKeys.length !== initMKeys.length) return true;
      for (const k of currMKeys) {
        if (selectedMaterials[k] !== init.materials?.[k]) return true;
      }
      return false;
    }
    return totalProductsSelectedCount > 0 || totalMaterialsSelectedCount > 0;
  }, [
    isSubmitting,
    isEditMode,
    date,
    shift,
    selectedProducts,
    selectedMaterials,
    totalProductsSelectedCount,
    totalMaterialsSelectedCount,
  ]);
  const { showDiscardModal, guardedAction, confirmDiscard, cancelDiscard } = useUnsavedChanges({
    isDirty,
    fallbackUrl: "/production",
  });

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
      <div className="w-full max-w-6xl mx-auto space-y-4 xs:space-y-6 pb-28 md:pb-12 min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between gap-3 bg-white px-4 py-3 xs:px-5 xs:py-3.5 rounded-2xl border border-[#EDE4D5] shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <Button
              variant="outline"
              size="icon"
              onClick={() => guardedAction(() => router.push("/production"))}
              className="border-[#EDE4D5] bg-white text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-extrabold h-9 w-9 shadow-2xs cursor-pointer shrink-0"
              title={t("production.backToProductionLog")}
            >
              <ArrowLeft className="w-4 h-4 text-[#E87A18]" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-black text-[#2C1B10] tracking-tight truncate flex items-center gap-2">
                {isEditMode ? (
                  <>
                    <Edit3 className="w-4 h-4 text-[#E87A18] shrink-0" />
                    <span>{t("production.editBatchTitleModal")}</span>
                  </>
                ) : (
                  <>
                    <PackageCheck className="w-4 h-4 text-[#E87A18] shrink-0" />
                    <span>{t("production.multiItemBatchTitle")}</span>
                  </>
                )}
              </h1>
            </div>
          </div>
        </div>


        <form onSubmit={handleRequestSubmit} className="space-y-4 xs:space-y-6">
          {/* Mobile Step Header (Option 1: Focused Step 1 / Step 2 Banner) */}
          <div className="md:hidden bg-white p-3.5 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-2.5">
            {mobileStep === 1 ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-[#E87A18] text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    1
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#2C1B10]">
                    {t("production.step1Title") || "Step 1: Products Baked"}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-200 shrink-0">
                  {totalProductsSelectedCount} {t("common.selected") || "Selected"}
                </span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileStep(1);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-1.5 text-[#E87A18] hover:text-[#4A2E1B] font-extrabold text-xs transition-colors cursor-pointer py-0.5 -ml-0.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t("production.btnBackToProducts") || "Back to Products"}</span>
                  </button>
                  <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-indigo-50 text-indigo-900 border-indigo-200 shrink-0">
                    {totalMaterialsSelectedCount} {t("common.selected") || "Selected"}
                  </span>
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-black shrink-0">
                    2
                  </span>
                  <span className="text-xs sm:text-sm font-extrabold text-[#2C1B10]">
                    {t("production.step2Title") || "Step 2: Raw Materials"}
                  </span>
                </div>
              </div>
            )}

            {/* Visual Step Progress Bar (50% on Step 1, 100% on Step 2) */}
            <div className="w-full bg-[#FAF6F0] h-1.5 rounded-full overflow-hidden border border-[#EDE4D5]">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  mobileStep === 1 ? "w-1/2 bg-[#E87A18]" : "w-full bg-emerald-600"
                }`}
              />
            </div>
          </div>

          {/* Owner Branch Selection Banner on Mobile if branch unselected */}
          {user?.role === "OWNER" && !isEditMode && (
            <div className="md:hidden bg-white p-3.5 rounded-2xl border border-amber-300 shadow-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#2C1B10]">
                  {t("branches.title") || "Production Branch"}
                </label>
                <span className="text-[10px] text-red-600 font-extrabold uppercase">* Required</span>
              </div>
              <select
                value={formBranchId || selectedBranchId || ""}
                onChange={(e) => {
                  setFormBranchId(e.target.value);
                  if (!selectedBranchId) {
                    setSelectedBranchId(e.target.value);
                  }
                }}
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="" disabled>-- {t("production.selectBranchPrompt") || "Select Branch"} --</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Mobile Compact Shift & Date Bar (< md) */}
          <div className="md:hidden bg-white p-3 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 relative">
              <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0 font-bold text-xs">
                📅
              </div>
              <div className="min-w-0 relative">
                {isGlobalAdmin ? (
                  <div className="relative cursor-pointer">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      aria-label="Change batch date"
                    />
                    <div className="text-xs font-black text-[#2C1B10] truncate flex items-center gap-1 underline decoration-amber-500 underline-offset-2">
                      <span>{formatEthDate(date)}</span>
                      <Edit3 className="w-2.5 h-2.5 text-amber-600 inline shrink-0" />
                    </div>
                    <span className="text-[10px] text-amber-700 font-bold block">
                      Admin (Tap to edit)
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="text-xs font-black text-[#2C1B10] truncate">
                      {formatEthDate(date)}
                    </div>
                    <span className="text-[10px] text-[#8C7361] font-semibold">
                      {t("production.todayBatches")}
                    </span>
                  </>
                )}
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
                ☀️ {t("production.dayShift")}
              </button>
              <button
                type="button"
                onClick={() => setShift("NIGHT")}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                  shift === "NIGHT" ? "bg-indigo-600 text-white shadow-2xs" : "text-[#8C7361] hover:text-[#2C1B10]"
                }`}
              >
                🌙 {t("production.nightShift")}
              </button>
            </div>
          </div>

          {/* Shift & Date Header Configuration (Desktop md+) */}
          <div className={`hidden md:grid bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs grid-cols-1 ${user?.role === "OWNER" && !isEditMode ? "sm:grid-cols-3" : "sm:grid-cols-2"} gap-3 xs:gap-4`}>
            {user?.role === "OWNER" && !isEditMode && (
              <div>
                <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                  {t("branches.title") || "Branch"} <span className="text-red-500">*</span>
                </label>
                <select
                  value={formBranchId || selectedBranchId || ""}
                  onChange={(e) => {
                    setFormBranchId(e.target.value);
                    if (!selectedBranchId) {
                      setSelectedBranchId(e.target.value);
                    }
                  }}
                  className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 xs:h-11 px-3 text-sm font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                  required
                >
                  <option value="" disabled>-- {t("production.selectBranchPrompt") || "Select Branch"} --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                {t("common.date")} {isGlobalAdmin ? "(Ethiopian)" : "(System Logged)"}
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
                  🔒 {t("production.systemDateLabel", { date: formatEthDate(new Date()) })}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                {t("production.colShift")}
              </label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 xs:h-11 px-3 text-sm font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="DAY">{t("production.dayShiftFull")}</option>
                <option value="NIGHT">{t("production.nightShiftFull")}</option>
              </select>
            </div>
          </div>

          {/* SECTION 1: PRODUCT CATEGORY FILTER & MULTI-PRODUCT SELECTION */}
          <div className={`bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-4 xs:space-y-5 ${mobileStep === 1 ? 'block' : 'hidden md:block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 xs:gap-3 border-b border-[#F4ECE1] pb-3 xs:pb-4">
              <div>
                <h2 className="text-base xs:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Utensils className="w-4 h-4 xs:w-5 xs:h-5 text-[#E87A18]" />
                  {t("production.tabStepProducts")}
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {t("production.stepProductsSubtitle") || "Select products and enter produced quantities."}
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
                {totalProductsSelectedCount} {t("production.tabProducts")}
              </span>
            </div>

            {/* Category & Subcategory Filter Tabs (shown when multiple categories exist) */}
            {parentCategories.length > 1 && (
              <div className="space-y-2.5 bg-[#FAF6F0] p-3 xs:p-4 rounded-xl border border-[#EDE4D5]">
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B] mb-1">
                  <Layers className="w-4 h-4 text-[#E87A18]" /> {t("products.colCategory")}:
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
                      {t("production.filterParentCatAll")} ({products.length})
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
                      <span className="text-[11px] font-bold text-[#8C7361] mr-1 whitespace-nowrap shrink-0">{t("categories.colSubcategories")}:</span>
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
                        {t("production.filterSubCatAll")}
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
                placeholder={t("production.searchProductsInput")}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-9 bg-white border-[#EDE4D5] rounded-xl text-xs"
              />
            </div>

            {filteredProducts.length === 0 ? (
              <div className="text-center py-8 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
                {t("production.noProductsMatchCategory")}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
                              {p.category?.name || "Bakery"} • <strong className="text-[#4A2E1B]">{formatUnit(p.unitType)}</strong>
                            </span>
                          </div>
                        </div>

                        {isSelected && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-[#E87A18] text-white shrink-0">
                            {t("common.selected") || "Selected"}
                          </span>
                        )}
                      </div>

                      {isSelected && (
                        <div className="mt-3 pt-3 border-t border-amber-200/70 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                          <span className="text-xs font-bold text-[#4A2E1B]">
                            {t("production.producedQtyInputLabel")}:
                          </span>
                          <div className="flex items-center gap-1.5">
                            <Input
                              type="number"
                              inputMode="numeric"
                              data-product-qty="true"
                              min="0"
                              placeholder="0"
                              value={qtyVal}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => updateProductQty(p.id, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  const qtyInputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[data-product-qty="true"]'));
                                  const idx = qtyInputs.indexOf(e.currentTarget);
                                  if (idx >= 0 && idx < qtyInputs.length - 1) {
                                    qtyInputs[idx + 1].focus();
                                    qtyInputs[idx + 1].select();
                                  } else {
                                    e.currentTarget.blur();
                                  }
                                }
                              }}
                              onBlur={(e) => {
                                if (e.target.value === "") updateProductQty(p.id, "0");
                              }}
                              className="w-24 h-9 bg-white border-[#EDE4D5] font-bold text-sm text-[#2C1B10] text-right rounded-xl focus:border-[#E87A18]"
                            />
                            <span className="text-xs font-bold text-[#8C7361] min-w-[3rem]">{formatUnit(p.unitType)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: RAW MATERIAL / INGREDIENT SELECTION */}
          <div className={`bg-white p-4 xs:p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-4 xs:space-y-5 ${mobileStep === 2 ? 'block' : 'hidden md:block'}`}>
            <div className="flex flex-wrap items-center justify-between gap-2.5 xs:gap-3 border-b border-[#F4ECE1] pb-3 xs:pb-4">
              <div>
                <h2 className="text-base xs:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Boxes className="w-4 h-4 xs:w-5 xs:h-5 text-indigo-600" /> {t("production.tabStepMaterials")}
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  {t("production.stepMaterialsSubtitle") || "Review and adjust raw materials used."}
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
                {totalMaterialsSelectedCount} {t("production.ingredientsCount")}
              </span>
            </div>

            {/* Material Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-3 text-[#8C7361]" />
              <Input
                type="text"
                placeholder={t("production.searchMaterialsInput")}
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                className="pl-9 bg-white border-[#EDE4D5] rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 xs:gap-3">
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
                            {t("production.unit")}: <strong className="text-indigo-950">{formatUnit(mat.unitType)}</strong>
                          </span>
                        </div>
                      </div>

                      {isSelected && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-600 text-white shrink-0">
                          {t("common.selected") || "Selected"}
                        </span>
                      )}
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-indigo-200/70 flex items-center justify-between gap-3" onClick={(e) => e.stopPropagation()}>
                        <span className="text-xs font-bold text-indigo-950">
                          {t("production.usedQtyInputLabel")}:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <Input
                            type="number"
                            inputMode="decimal"
                            step="0.01"
                            min="0"
                            placeholder="0"
                            value={qtyVal}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateMaterialQty(mat.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                (e.target as HTMLElement).blur();
                              }
                            }}
                            onBlur={(e) => {
                              if (e.target.value === "") updateMaterialQty(mat.id, "0");
                            }}
                            className="w-24 h-9 bg-white border-indigo-200 font-bold text-sm text-indigo-950 text-right rounded-xl focus:border-indigo-600"
                          />
                          <span className="text-xs font-bold text-[#8C7361] min-w-[3rem]">{formatUnit(mat.unitType)}</span>
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
                {isEditMode ? t("production.btnSubmitChanges") : t("production.btnReviewSubmitBatch")}
              </h3>
              <p className="text-xs text-[#8C7361] mt-0.5">
                {t("production.colProductsBaked")}: <strong className="text-[#4A2E1B]">{totalProductsSelectedCount}</strong> •{" "}
                {t("production.colRawMaterialsConsumed")}: <strong className="text-[#4A2E1B]">{totalMaterialsSelectedCount}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2.5 xs:gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => guardedAction(() => router.push("/production"))}
              >
                {t("common.cancel")}
              </Button>

              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                loadingText={isEditMode ? (t("production.submittingBatch") || "Updating Batch...") : (t("production.submittingBatch") || "Submitting...")}
                disabled={totalProductsSelectedCount === 0}
                className="flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="w-4 h-4" />
                {isEditMode
                  ? (t("production.btnSubmitChanges") || "Save & Update Batch")
                  : (t("production.btnConfirmSubmitBatch") || "Submit for Approval")}
              </Button>
            </div>
          </div>

          {/* Mobile Sticky Bottom Action Bar (< md) */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-[#EDE4D5] p-3 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {mobileStep === 1 ? (
              <Button
                type="button"
                size="lg"
                disabled={totalProductsSelectedCount === 0}
                onClick={() => {
                  const hasProductWithQty = Object.entries(selectedProducts).some(([_, qty]) => Number(qty) > 0);
                  if (!hasProductWithQty) {
                    toast.error(t("production.toastSpecifyAtLeastOne"));
                    return;
                  }
                  setMobileStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="w-full bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-sm h-12 rounded-xl flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <span>
                  {totalProductsSelectedCount > 0
                    ? `${t("production.btnNextMaterials") || "Next: Raw Materials"} (${totalProductsSelectedCount})`
                    : (t("production.selectProductsPrompt") || "Select products above")}
                </span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            ) : (
              <div className="flex items-center gap-2 w-full">
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => {
                    setMobileStep(1);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="h-12 px-3.5 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-extrabold text-xs shrink-0 cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{t("common.back") || "Back"}</span>
                </Button>
                <Button
                  type="button"
                  onClick={() => handleRequestSubmit()}
                  disabled={totalProductsSelectedCount === 0}
                  className="flex-1 h-12 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span className="truncate">
                    {isEditMode ? (t("production.btnSubmitChanges") || "Save Changes") : (t("production.btnSaveBatch") || "Save Production Batch")}
                  </span>
                </Button>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitModal} onOpenChange={(open) => { if (!isSubmitting) setShowSubmitModal(open); }}>
        <DialogContent className="w-[calc(100%-1.5rem)] sm:max-w-lg bg-white rounded-3xl border border-[#EDE4D5] p-5 sm:p-7 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              {isEditMode ? t("production.editBatchTitleModal") : t("production.confirmModalBatchTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3.5 my-2 text-xs">
            {/* Shift & Date Info */}
            <div className="p-2.5 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-between text-[#4A2E1B] font-bold">
              <span>📅 {formatEthDate(date)}</span>
              <span>{shift === "NIGHT" ? `🌙 ${t("production.nightShiftFull")}` : `☀️ ${t("production.dayShiftFull")}`}</span>
            </div>

            {/* High-Level Overview Stats - Short, punchy, and zero truncation */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-200/80 text-center flex flex-col justify-center min-w-0">
                <span className="text-[11px] uppercase font-black text-amber-900 tracking-wide block">
                  {t("production.modalProductsLabel") || "Products"}
                </span>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-base sm:text-lg font-black text-[#2C1B10]">
                    {selectedProductList.length}
                  </span>
                  <span className="text-xs font-bold text-[#8C7361]">
                    {t("production.modalItemsCount") || "items"}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-[#E87A18] block mt-0.5">
                  {totalProducedUnits} {t("production.modalTotalUnits") || "total pcs"}
                </span>
              </div>

              <div className="p-3 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 text-center flex flex-col justify-center min-w-0">
                <span className="text-[11px] uppercase font-black text-indigo-900 tracking-wide block">
                  {t("production.modalMaterialsLabel") || "Raw Materials"}
                </span>
                <div className="mt-1 flex items-baseline justify-center gap-1">
                  <span className="text-base sm:text-lg font-black text-indigo-950">
                    {selectedMaterialList.length}
                  </span>
                  <span className="text-xs font-bold text-indigo-700">
                    {t("production.modalItemsCount") || "items"}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-indigo-600 block mt-0.5">
                  {t("production.modalToDeduct") || "to deduct"}
                </span>
              </div>
            </div>

            {/* Optional Collapsible Detailed Breakdown */}
            <div className="pt-0.5">
              <button
                type="button"
                onClick={() => setShowModalBreakdown((prev) => !prev)}
                className="w-full py-2 px-3 rounded-xl bg-[#FAF7EE] hover:bg-[#F3ECE1] border border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs flex items-center justify-between transition-colors cursor-pointer"
              >
                <span>{showModalBreakdown ? t("production.showLess") : t("production.tabAll")}</span>
                <span className="text-[11px] text-[#8C7361] font-semibold">
                  {showModalBreakdown ? "▲" : `▼ (${selectedProductList.length + selectedMaterialList.length})`}
                </span>
              </button>

              {showModalBreakdown && (
                <div className="mt-2.5 space-y-2.5 border-t border-[#EDE4D5] pt-2">
                  {/* Products Baked Summary */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#8C7361] tracking-wider block mb-1">
                      {t("production.colProductsBaked")} ({selectedProductList.length}):
                    </span>
                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {selectedProductList.map((item) => (
                        <div
                          key={item.product.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 font-bold"
                        >
                          <span className="text-[#2C1B10] truncate mr-2">{item.product.name}</span>
                          <span className="text-[#E87A18] whitespace-nowrap">
                            {item.qty} {formatUnit(item.product.unitType)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Ingredients Consumed Summary */}
                  <div>
                    <span className="text-[10px] font-extrabold uppercase text-[#8C7361] tracking-wider block mb-1">
                      {t("production.colRawMaterialsConsumed")} ({selectedMaterialList.length}):
                    </span>
                    {selectedMaterialList.length === 0 ? (
                      <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-500 italic">
                        {t("production.noMaterialsDeducted")}
                      </div>
                    ) : (
                      <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                        {selectedMaterialList.map((mat) => (
                          <div
                            key={mat.stockItem.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-indigo-50/70 border border-indigo-200/60 font-bold text-indigo-950"
                          >
                            <span className="truncate mr-2">{mat.stockItem.name}</span>
                            <span className="whitespace-nowrap">
                              {mat.qty} {formatUnit(mat.stockItem.unitType)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2 border-t border-[#F4ECE1]">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => setShowSubmitModal(false)}
              className="w-full sm:w-auto h-11 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold cursor-pointer"
            >
              {t("production.btnKeepEditingBatch")}
            </Button>
            <Button
              type="button"
              loading={isSubmitting}
              disabled={isSubmitting}
              onClick={executeSubmitBatch}
              className="w-full sm:flex-1 h-11 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black cursor-pointer flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{isEditMode ? t("production.btnSubmitChanges") : t("production.btnConfirmSubmitBatch")}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmModal
        isOpen={showDiscardModal}
        onClose={cancelDiscard}
        onConfirm={confirmDiscard}
        title={t("products.unsavedModalTitle")}
        description={t("products.unsavedModalDesc")}
        confirmText={t("products.discardChangesBtn")}
        cancelText={t("products.keepEditingBtn")}
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
