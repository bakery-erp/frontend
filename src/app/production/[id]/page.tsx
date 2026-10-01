"use client";

import { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { formatEthDate } from "@/lib/ethiopianDate";
import {
  ArrowLeft,
  Package,
  Wheat,
  CheckCircle2,
  XCircle,
  Clock,
  Printer,
  Edit,
  Search,
  User,
  Calendar,
  Layers,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailSkeleton } from "@/components/ui/skeletons";

interface ProductItem {
  id: string;
  productId?: string;
  quantityProduced: number;
  product: {
    id?: string;
    name: string;
    unitType: string;
    category?: { id?: string; name?: string; type?: string };
  };
}

interface MaterialUsage {
  id: string;
  stockItemId?: string;
  quantityUsed: number;
  stockItem: {
    id?: string;
    name: string;
    unitType: string;
  };
}

interface ProductionBatchDetail {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT" | null;
  status: "PENDING_APPROVAL" | "STARTED" | "COMPLETED" | "REJECTED";
  createdAt: string;
  updatedAt?: string;
  userId?: string;
  user: {
    id: string;
    fullName: string;
    role?: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  items: ProductItem[];
  materialUsages: MaterialUsage[];
}

export default function ProductionBatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const batchId = resolvedParams.id;
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";
  const queryClient = useQueryClient();

  const [productSearch, setProductSearch] = useState("");
  const [materialSearch, setMaterialSearch] = useState("");
  const [isApproving, setIsApproving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  const { data: batch, isLoading, isError } = useQuery<ProductionBatchDetail>({
    queryKey: ["production-batch-detail", batchId],
    queryFn: async () => {
      const res = await api.get(`/production-batches/${batchId}`);
      return res.data;
    },
    enabled: !!batchId,
  });

  const totalProducedUnits = useMemo(() => {
    if (!batch?.items) return 0;
    return batch.items.reduce((sum, item) => sum + Number(item.quantityProduced || 0), 0);
  }, [batch?.items]);

  const totalMaterialsUsed = useMemo(() => {
    if (!batch?.materialUsages) return 0;
    return batch.materialUsages.reduce((sum, mat) => sum + Number(mat.quantityUsed || 0), 0);
  }, [batch?.materialUsages]);

  const filteredProducts = useMemo(() => {
    if (!batch?.items) return [];
    const term = productSearch.trim().toLowerCase();
    if (!term) return batch.items;
    return batch.items.filter(
      (item) =>
        item.product.name.toLowerCase().includes(term) ||
        (item.product.unitType && item.product.unitType.toLowerCase().includes(term)) ||
        (item.product.category?.name && item.product.category.name.toLowerCase().includes(term))
    );
  }, [batch?.items, productSearch]);

  const filteredMaterials = useMemo(() => {
    if (!batch?.materialUsages) return [];
    const term = materialSearch.trim().toLowerCase();
    if (!term) return batch.materialUsages;
    return batch.materialUsages.filter(
      (mat) =>
        mat.stockItem.name.toLowerCase().includes(term) ||
        (mat.stockItem.unitType && mat.stockItem.unitType.toLowerCase().includes(term))
    );
  }, [batch?.materialUsages, materialSearch]);

  const handleApprove = async () => {
    if (!batchId) return;
    try {
      setIsApproving(true);
      await api.post(`/production-batches/${batchId}/approve`);
      toast.success(t("production.batchApprovedToast") || "Production batch approved & inventory stock updated!");
      queryClient.invalidateQueries({ queryKey: ["production-batch-detail", batchId] });
      queryClient.invalidateQueries({ queryKey: ["production-page"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to approve batch");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    if (!batchId) return;
    try {
      setIsRejecting(true);
      await api.post(`/production-batches/${batchId}/reject`);
      toast.success(t("production.batchRejectedToast") || "Production batch rejected");
      queryClient.invalidateQueries({ queryKey: ["production-batch-detail", batchId] });
      queryClient.invalidateQueries({ queryKey: ["production-page"] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to reject batch");
    } finally {
      setIsRejecting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
            <Clock className="w-4 h-4 animate-pulse text-amber-700" /> {t("production.statusPendingApproval")}
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-700" /> {t("production.statusCompleted")}
          </span>
        );
      case "STARTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-900 border border-blue-300 shadow-2xs">
            {t("production.statusStarted")}
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-900 border border-red-300 shadow-2xs">
            <XCircle className="w-4 h-4 text-red-700" /> {t("production.statusRejected")}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800">
            {status}
          </span>
        );
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl mx-auto">
          <DetailSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !batch) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold text-[#2C1B10]">Batch Not Found</h2>
          <p className="text-sm text-[#8C7361]">The requested production batch could not be loaded or has been deleted.</p>
          <Button onClick={() => router.push("/production")} variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Production Log
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6 pb-12 print:p-0 print:max-w-full">
        {/* Navigation & Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EDE4D5] pb-5 print:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/production")}
              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold h-9 px-3 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {t("common.back") || "Back to Batches"}
            </Button>
            <div className="h-5 w-px bg-[#EDE4D5] hidden sm:block" />
            <span className="text-xs font-semibold text-[#8C7361] hidden sm:inline-block">
              {t("production.batchDetailsTitle")}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold h-9 px-3 shadow-2xs"
            >
              <Printer className="w-4 h-4 mr-1.5 text-[#E87A18]" />
              {t("common.print") || "Print Log"}
            </Button>

            {(batch.status === "PENDING_APPROVAL" || isGlobalAdmin) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/production/new?edit=${batch.id}`)}
                className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold h-9 px-3 shadow-2xs"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                {t("common.edit")}
              </Button>
            )}

            {isGlobalAdmin && batch.status === "PENDING_APPROVAL" && (
              <>
                <Button
                  size="sm"
                  loading={isApproving}
                  loadingText={t("common.approving") || "Approving..."}
                  onClick={handleApprove}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold h-9 px-4 shadow-xs"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" />
                  {t("common.approve")}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  loading={isRejecting}
                  loadingText={t("common.rejecting") || "Rejecting..."}
                  onClick={handleReject}
                  className="border-red-300 text-red-700 hover:bg-red-50 rounded-xl font-bold h-9 px-3 shadow-2xs"
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  {t("common.reject")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Main Batch Header Banner */}
        <div className="bg-white rounded-3xl border border-[#EDE4D5] p-5 sm:p-7 shadow-xs relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#4A2E1B] text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Package className="w-7 h-7 text-[#E87A18]" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
                    {formatEthDate(batch.date)}
                  </h1>
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-xl text-xs font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                    {batch.shift === "NIGHT" ? `🌙 ${t("production.nightShiftFull")}` : `☀️ ${t("production.dayShiftFull")}`}
                  </span>
                  <div>{getStatusBadge(batch.status)}</div>
                </div>

                <div className="flex items-center gap-3 text-xs font-semibold text-[#8C7361] flex-wrap pt-0.5">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    <span>{t("production.colLoggedBy")}: <strong className="text-[#2C1B10]">{batch.user.fullName}</strong></span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>System Date: {batch.date}</span>
                  </span>
                  {batch.branch && (
                    <>
                      <span>•</span>
                      <span>Branch: <strong className="text-[#2C1B10]">{batch.branch.name}</strong></span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pending Approval Alert Banner */}
          {batch.status === "PENDING_APPROVAL" && (
            <div className="mt-5 p-3.5 sm:p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="font-semibold">
                  This production batch is currently awaiting management approval. Raw inventory will be deducted once approved.
                </span>
              </div>
              {isGlobalAdmin && (
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    loading={isApproving}
                    onClick={handleApprove}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-lg"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {t("common.approve")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={isRejecting}
                    onClick={handleReject}
                    className="border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs h-8 px-3 rounded-lg"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1" /> {t("common.reject")}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Metric KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6 pt-6 border-t border-[#F4ECE1]">
            <div className="bg-[#FAF6F0]/80 rounded-2xl p-4 border border-[#EDE4D5]/80">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                {t("production.tabProducts")}
              </span>
              <div className="text-2xl font-black text-[#2C1B10] mt-1">
                {batch.items.length}{" "}
                <span className="text-xs font-bold text-[#8C7361]">distinct</span>
              </div>
              <span className="text-xs font-bold text-[#E87A18] mt-0.5 block">
                {totalProducedUnits.toLocaleString()} total units baked
              </span>
            </div>

            <div className="bg-[#FAF6F0]/80 rounded-2xl p-4 border border-[#EDE4D5]/80">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                {t("production.tabMaterials")}
              </span>
              <div className="text-2xl font-black text-[#2C1B10] mt-1">
                {batch.materialUsages.length}{" "}
                <span className="text-xs font-bold text-[#8C7361]">ingredients</span>
              </div>
              <span className="text-xs font-bold text-rose-700 mt-0.5 block">
                -{totalMaterialsUsed.toFixed(2)} total deducted
              </span>
            </div>

            <div className="bg-[#FAF6F0]/80 rounded-2xl p-4 border border-[#EDE4D5]/80">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                {t("production.colShift")}
              </span>
              <div className="text-lg font-black text-[#2C1B10] mt-1 flex items-center gap-1.5">
                {batch.shift === "NIGHT" ? "🌙 Night Shift" : "☀️ Day Shift"}
              </div>
              <span className="text-xs font-semibold text-[#8C7361] mt-0.5 block">
                {batch.user.fullName}
              </span>
            </div>

            <div className="bg-[#FAF6F0]/80 rounded-2xl p-4 border border-[#EDE4D5]/80">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                {t("production.colStatus")}
              </span>
              <div className="mt-1.5">
                {getStatusBadge(batch.status)}
              </div>
              <span className="text-xs font-semibold text-[#8C7361] mt-1 block">
                ID: <span className="font-mono text-[10px]">{batch.id.slice(0, 8)}...</span>
              </span>
            </div>
          </div>
        </div>

        {/* Section 1: Products Baked Table */}
        <div className="bg-white rounded-3xl border border-[#EDE4D5] p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4ECE1]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-[#E87A18] flex items-center justify-center font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#2C1B10]">
                  {t("production.tabProducts")} ({batch.items.length})
                </h2>
                <p className="text-xs text-[#8C7361]">All bakery finished products outputted in this batch</p>
              </div>
            </div>

            {/* Product Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Search products..."
                className="h-9 pl-8 pr-7 text-xs rounded-xl bg-[#FAF6F0] border-[#EDE4D5] focus:border-[#4A2E1B]"
              />
              {productSearch && (
                <button
                  type="button"
                  onClick={() => setProductSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7361] hover:text-[#2C1B10]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#8C7361] bg-[#FAF6F0]/50 rounded-2xl border border-dashed border-[#EDE4D5]">
              {productSearch ? "No products match your search filter." : "No products recorded in this batch."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>{t("production.colProduct")}</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">{t("production.colQuantityProduced")}</TableHead>
                    <TableHead className="text-right">Batch Share</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.map((item, index) => {
                    const sharePercent = totalProducedUnits > 0
                      ? ((Number(item.quantityProduced || 0) / totalProducedUnits) * 100).toFixed(1)
                      : "0";

                    return (
                      <TableRow key={item.id || index} className="hover:bg-[#FAF8F5]/60">
                        <TableCell className="text-center font-bold text-xs text-[#8C7361]">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="font-extrabold text-[#2C1B10] text-sm">{item.product.name}</div>
                          <div className="text-[11px] text-[#8C7361] font-semibold">{item.product.unitType}</div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                            {item.product.category?.name || "General"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center px-3 py-1 rounded-xl text-sm font-black bg-amber-50 text-[#E87A18] border border-amber-200">
                            {Number(item.quantityProduced).toLocaleString()} {item.product.unitType}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-2 rounded-full bg-zinc-100 overflow-hidden hidden sm:block">
                              <div
                                className="h-full bg-[#E87A18] rounded-full"
                                style={{ width: `${Math.min(100, Math.max(0, Number(sharePercent)))}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-[#8C7361]">{sharePercent}%</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        {/* Section 2: Raw Materials Consumed Table */}
        <div className="bg-white rounded-3xl border border-[#EDE4D5] p-5 sm:p-7 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F4ECE1]">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <Wheat className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-[#2C1B10]">
                  {t("production.colRawMaterialsConsumed")} ({batch.materialUsages.length})
                </h2>
                <p className="text-xs text-[#8C7361]">Ingredients deducted from stock upon batch approval</p>
              </div>
            </div>

            {/* Material Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder="Search raw materials..."
                className="h-9 pl-8 pr-7 text-xs rounded-xl bg-[#FAF6F0] border-[#EDE4D5] focus:border-[#4A2E1B]"
              />
              {materialSearch && (
                <button
                  type="button"
                  onClick={() => setMaterialSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7361] hover:text-[#2C1B10]"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {filteredMaterials.length === 0 ? (
            <div className="text-center py-10 text-xs text-[#8C7361] bg-[#FAF6F0]/50 rounded-2xl border border-dashed border-[#EDE4D5]">
              {materialSearch ? "No ingredients match your search filter." : t("production.noMaterialsDeducted")}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-center">#</TableHead>
                    <TableHead>Ingredient / Stock Item</TableHead>
                    <TableHead>Unit Type</TableHead>
                    <TableHead className="text-right">Quantity Deducted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredMaterials.map((mat, index) => (
                    <TableRow key={mat.id || index} className="hover:bg-[#FAF8F5]/60">
                      <TableCell className="text-center font-bold text-xs text-[#8C7361]">
                        {index + 1}
                      </TableCell>
                      <TableCell>
                        <div className="font-extrabold text-[#2C1B10] text-sm">{mat.stockItem.name}</div>
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-semibold bg-zinc-100 text-zinc-700">
                          {mat.stockItem.unitType}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-center px-3 py-1 rounded-xl text-sm font-black bg-rose-50 text-rose-700 border border-rose-200">
                          -{Number(mat.quantityUsed).toFixed(2)} {mat.stockItem.unitType}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
