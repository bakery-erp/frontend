"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
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
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Layers,
  Sparkles,
  Utensils,
  Boxes,
  Plus,
  Trash2,
  ChevronRight
} from "lucide-react";

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

export default function NewProductionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Header State
  const [date, setDate] = useState<string>(
    new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)
  );
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");

  // Selection & Filter State
  const [selectedParentCatId, setSelectedParentCatId] = useState<string>("ALL");
  const [selectedSubCatId, setSelectedSubCatId] = useState<string>("ALL");
  const [productSearch, setProductSearch] = useState<string>("");
  const [materialSearch, setMaterialSearch] = useState<string>("");

  // Multi-selected items & quantities: Map of id -> quantity string
  const [selectedProducts, setSelectedProducts] = useState<Record<string, string>>({});
  const [selectedMaterials, setSelectedMaterials] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchInitialData();
  }, [selectedBranchId]);

  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};

      const [resCat, resProd, resStock, resSess] = await Promise.all([
        api.get("/product-categories"),
        api.get(`/products${branchQuery}`),
        api.get(`/stock-items${branchQuery}`),
        api.get("/daily-sessions/active", sessionParams).catch(() => ({ data: null })),
      ]);

      const allCats: ProductCategory[] = resCat.data || [];
      const filteredCats = isGlobalAdmin
        ? allCats
        : allCats.filter((c) => c.type !== "RESELL");
      setCategories(filteredCats);

      const allProds: Product[] = resProd.data || [];
      const filteredProds = isGlobalAdmin
        ? allProds
        : allProds.filter(
            (p: Product) => (p.category ? p.category.type !== "RESELL" : true)
          );
      setProducts(filteredProds);
      setStockItems(resStock.data || []);
      setActiveSession(resSess.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error loading production categories & products");
    } finally {
      setIsLoading(false);
    }
  };

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

  // Submit Handler
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
      router.push("/production");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log production batch");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalProductsSelectedCount = Object.keys(selectedProducts).length;
  const totalMaterialsSelectedCount = Object.keys(selectedMaterials).length;

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-[#EDE4D5] shadow-xs">
          <div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/production")}
              className="text-[#8C7361] hover:text-[#2C1B10] mb-2 p-0 h-auto flex items-center gap-1 font-bold text-xs"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Production Log
            </Button>
            <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
              <PackageCheck className="w-6 h-6 text-[#E87A18]" /> Multi-Item Production Batch Entry
            </h1>
            <p className="text-xs text-[#8C7361] mt-0.5">
              Select product categories, sub-categories, baked items, and raw materials consumed during this shift.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
                isSessionOpen
                  ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                  : "bg-amber-100 text-amber-900 border-amber-300"
              }`}
            >
              Session: {isSessionOpen ? "ACTIVE OPEN" : "INACTIVE / PAUSED"}
            </span>
          </div>
        </div>

        {/* Warning if no active open session */}
        {!isSessionOpen && (
          <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-extrabold text-sm">Active Session Required</h4>
              <p className="text-xs text-amber-800 mt-0.5">
                Daily session is currently paused or closed. You can review categories and select items, but logging production requires an active open session.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmitBatch} className="space-y-6">
          {/* Shift & Date Header Configuration */}
          <div className="bg-white p-6 rounded-2xl border border-[#EDE4D5] shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase tracking-wide">
                Production Date {isGlobalAdmin ? "(Ethiopian)" : "(System Logged)"}
              </label>
              <Input
                type="date"
                required
                disabled={!isGlobalAdmin}
                value={isGlobalAdmin ? date : new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10)}
                onChange={(e) => setDate(e.target.value)}
                className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl font-medium disabled:opacity-75 disabled:cursor-not-allowed text-[#4A2E1B]"
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
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-sm font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="DAY">Day Shift (Pagal / Day)</option>
                <option value="NIGHT">Night Shift (Rati / Night)</option>
              </select>
            </div>
          </div>

          {/* SECTION 1: PRODUCT CATEGORY FILTER & MULTI-PRODUCT SELECTION */}
          <div className="bg-white p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4ECE1] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Utensils className="w-5 h-5 text-[#E87A18]" /> 1. Select Bakery Products & Quantities
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  Filter by category / subcategory and check all items baked in this batch.
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1.5 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
                {totalProductsSelectedCount} Products Selected
              </span>
            </div>

            {/* Category & Subcategory Filter Tabs */}
            <div className="space-y-3 bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B] mb-1">
                <Layers className="w-4 h-4 text-[#E87A18]" /> Main Product Category:
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedParentCatId("ALL");
                    setSelectedSubCatId("ALL");
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
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
                      type="button"
                      onClick={() => {
                        setSelectedParentCatId(cat.id);
                        setSelectedSubCatId("ALL");
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all ${
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

              {/* Sub-Category Filter Row if applicable */}
              {subCategories.length > 0 && (
                <div className="pt-3 border-t border-[#EDE4D5] flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-bold text-[#8C7361] mr-1">Sub-Category:</span>
                  <button
                    type="button"
                    onClick={() => setSelectedSubCatId("ALL")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
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
                      type="button"
                      onClick={() => setSelectedSubCatId(sub.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        selectedSubCatId === sub.id
                          ? "bg-[#E87A18] text-white"
                          : "bg-white text-[#8C7361] border border-[#EDE4D5]"
                      }`}
                    >
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

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
                No products match the selected category filter or search query.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[400px] overflow-y-auto pr-1">
                {filteredProducts.map((p) => {
                  const isSelected = selectedProducts[p.id] !== undefined;
                  const qtyVal = selectedProducts[p.id] || "";

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-amber-50/70 border-[#E87A18] ring-1 ring-[#E87A18] shadow-2xs"
                          : "bg-white border-[#EDE4D5] hover:border-zinc-300"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <label
                          onClick={() => toggleProductSelect(p.id)}
                          className="flex items-start gap-2.5 cursor-pointer flex-1 select-none"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductSelect(p.id)}
                            className="mt-0.5 rounded text-[#E87A18] focus:ring-[#E87A18]"
                          />
                          <div>
                            <h4 className="font-extrabold text-xs text-[#2C1B10] line-clamp-1">{p.name}</h4>
                            <span className="text-[10px] font-semibold text-[#8C7361] block">
                              {p.category?.name || "Bakery"} ({p.unitType})
                            </span>
                          </div>
                        </label>
                      </div>

                      {isSelected && (
                        <div className="pt-2 border-t border-amber-200/60 flex items-center gap-2">
                          <span className="text-[10px] font-extrabold uppercase text-[#4A2E1B]">Produced:</span>
                          <Input
                            type="number"
                            min="1"
                            placeholder="Qty"
                            value={qtyVal}
                            onChange={(e) => updateProductQty(p.id, e.target.value)}
                            className="h-8 bg-white border-[#EDE4D5] font-mono font-bold text-xs rounded-lg text-amber-900"
                          />
                          <span className="text-[10px] font-bold text-zinc-500">{p.unitType}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: RAW MATERIAL / INGREDIENT SELECTION */}
          <div className="bg-white p-6 rounded-2xl border border-[#EDE4D5] shadow-xs space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F4ECE1] pb-4">
              <div>
                <h2 className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-indigo-600" /> 2. Select Consumed Raw Materials & Ingredients
                </h2>
                <p className="text-xs text-[#8C7361] mt-0.5">
                  Multi-select flour, sugar, yeast, oil, and packaging materials consumed for this production.
                </p>
              </div>

              <span className="text-xs font-extrabold px-3 py-1.5 bg-[#FAF6F0] text-[#4A2E1B] rounded-xl border border-[#EDE4D5]">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[350px] overflow-y-auto pr-1">
              {filteredMaterials.map((mat) => {
                const isSelected = selectedMaterials[mat.id] !== undefined;
                const qtyVal = selectedMaterials[mat.id] || "";

                return (
                  <div
                    key={mat.id}
                    className={`p-3.5 rounded-xl border transition-all ${
                      isSelected
                        ? "bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-500 shadow-2xs"
                        : "bg-white border-[#EDE4D5] hover:border-zinc-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <label
                        onClick={() => toggleMaterialSelect(mat.id)}
                        className="flex items-start gap-2.5 cursor-pointer flex-1 select-none"
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleMaterialSelect(mat.id)}
                          className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-600"
                        />
                        <div>
                          <h4 className="font-extrabold text-xs text-[#2C1B10] line-clamp-1">{mat.name}</h4>
                          <span className="text-[10px] font-semibold text-[#8C7361] block">
                            Stock: {mat.currentQuantity} {mat.unitType}
                          </span>
                        </div>
                      </label>
                    </div>

                    {isSelected && (
                      <div className="pt-2 border-t border-indigo-200 flex items-center gap-2">
                        <span className="text-[10px] font-extrabold uppercase text-indigo-900">Used:</span>
                        <Input
                          type="number"
                          step="0.001"
                          min="0.001"
                          placeholder="Qty"
                          value={qtyVal}
                          onChange={(e) => updateMaterialQty(mat.id, e.target.value)}
                          className="h-8 bg-white border-[#EDE4D5] font-mono font-bold text-xs rounded-lg text-indigo-950"
                        />
                        <span className="text-[10px] font-bold text-zinc-500">{mat.unitType}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* SUMMARY PANEL & SUBMISSION */}
          <div className="bg-[#FAF6F0] p-6 rounded-2xl border border-[#EDE4D5] flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="font-extrabold text-sm text-[#2C1B10]">Ready to submit production batch?</h3>
              <p className="text-xs text-[#8C7361] mt-0.5">
                Selected <strong className="text-[#4A2E1B]">{totalProductsSelectedCount} products</strong> and{" "}
                <strong className="text-[#4A2E1B]">{totalMaterialsSelectedCount} materials</strong> for shift log.
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/production")}
                className="border-[#EDE4D5] text-[#8C7361] hover:bg-white rounded-xl text-xs font-bold flex-1 sm:flex-initial"
              >
                Cancel
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting || !isSessionOpen || totalProductsSelectedCount === 0}
                className="bg-[#E87A18] hover:bg-[#d46d13] disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm px-6 py-2.5 shadow-md flex-1 sm:flex-initial"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isSubmitting
                  ? "Submitting..."
                  : !isSessionOpen
                  ? "Session Closed"
                  : isGlobalAdmin
                  ? "Submit & Approve Batch"
                  : "Submit for Approval"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
