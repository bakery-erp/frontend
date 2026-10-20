"use client";

import { useState, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
  Flag,
  Check,
  ChefHat,
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

interface ItemChange {
  name: string;
  oldQty: number;
  newQty: number;
  diff: number;
  unit: string;
}

interface EditRevision {
  editedAt: string;
  editorId: string;
  editorName: string;
  editorRole: string;
  itemChanges: ItemChange[];
  materialChanges: ItemChange[];
}

interface ProductionBatchDetail {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT" | null;
  status: "PENDING_APPROVAL" | "STARTED" | "COMPLETED" | "REJECTED";
  createdAt: string;
  updatedAt?: string;
  userId?: string;
  isEdited?: boolean;
  editedAt?: string | null;
  editHistory?: EditRevision[] | null;
  adminSeenAt?: string | null;
  ownerSeenAt?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  flaggedBy?: string | null;
  flaggedAt?: string | null;
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
  const [isMarkingSeen, setIsMarkingSeen] = useState(false);
  const [isFlagNoteExpanded, setIsFlagNoteExpanded] = useState(false);

  // Flag modal state
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagReasonInput, setFlagReasonInput] = useState("");
  const [isFlagSubmitting, setIsFlagSubmitting] = useState(false);

  const { data: batch, isLoading, isError } = useQuery<ProductionBatchDetail>({
    queryKey: ["production-batch-detail", batchId],
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const res = await api.get(`/production-batches/${batchId}`);
      return res.data;
    },
    enabled: !!batchId,
  });

  const isBatchSeenByMe = (b?: ProductionBatchDetail | null) => {
    if (!b) return true;
    if (user?.role === "OWNER") return !!b.ownerSeenAt;
    if (user?.role === "ADMIN") return !!b.adminSeenAt;
    return true;
  };

  const handleMarkSeen = async () => {
    if (!batchId) return;
    try {
      setIsMarkingSeen(true);
      await api.post(`/production-batches/${batchId}/seen`);
      toast.success(t("production.markedSeenSuccess") || "Marked as reviewed");
      queryClient.invalidateQueries({ queryKey: ["production-batch-detail", batchId] });
      queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to mark as seen");
    } finally {
      setIsMarkingSeen(false);
    }
  };

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

  const handleToggleFlag = async (isFlagged: boolean, reason?: string) => {
    if (!batchId) return;
    setIsFlagSubmitting(true);
    try {
      await api.post(`/production-batches/${batchId}/flag`, {
        isFlagged,
        reason: reason?.trim() || undefined,
      });
      if (isFlagged) {
        toast.success(t("production.flagAppliedSuccess") || "Batch flagged with question sign");
      } else {
        toast.success(t("production.flagClearedSuccess") || "Flag cleared successfully");
      }
      setIsFlagModalOpen(false);
      setFlagReasonInput("");
      queryClient.invalidateQueries({ queryKey: ["production-batch-detail", batchId] });
      queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to update flag");
    } finally {
      setIsFlagSubmitting(false);
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
          <h2 className="text-xl font-extrabold text-[#2C1B10]">{t("production.batchNotFoundTitle")}</h2>
          <p className="text-sm text-[#8C7361]">{t("production.batchNotFoundDesc")}</p>
          <Button onClick={() => router.push("/production")} variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("production.backToProductionLog")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const todayYmd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const batchDateYmd = (batch?.date || batch?.createdAt || "").slice(0, 10);
  const canEditBatch = isGlobalAdmin || ((user?.id === batch?.userId || user?.id === batch?.user?.id) && batchDateYmd === todayYmd);

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-5 pb-12 print:p-0 print:max-w-full">
        {/* Navigation & Header Actions */}
        <div className="flex items-center justify-between gap-3 border-b border-[#EDE4D5] pb-3 print:hidden">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/production")}
              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold h-9 px-3 shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4 mr-1.5" />
              {t("common.back") || "Back"}
            </Button>
            <div className="h-5 w-px bg-[#EDE4D5] hidden sm:block" />
            <span className="text-xs font-semibold text-[#8C7361] hidden sm:inline-block">
              {t("production.batchDetailsTitle")}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Mark as seen quick action if unseen for current manager */}
            {isGlobalAdmin && !isBatchSeenByMe(batch) && (
              <Button
                variant="outline"
                size="sm"
                disabled={isMarkingSeen}
                onClick={handleMarkSeen}
                className="border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 rounded-xl font-bold h-9 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
                title={t('production.markAsSeen')}
              >
                <Check className="w-4 h-4 text-sky-600" />
                <span>{t('production.markAsSeen')}</span>
              </Button>
            )}

            {/* Flag / Resolve action: visible if unseen or if flagged */}
            {isGlobalAdmin && (!isBatchSeenByMe(batch) || batch.isFlagged) && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (batch.isFlagged) {
                    handleToggleFlag(false);
                  } else {
                    setFlagReasonInput("");
                    setIsFlagModalOpen(true);
                  }
                }}
                className={`rounded-xl font-bold h-9 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5 ${
                  batch.isFlagged
                    ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                    : "border-zinc-200 text-[#8C7361] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                }`}
                title={batch.isFlagged ? t('production.clearFlag') : t('production.flagBatch')}
              >
                <span className="text-sm">🚩</span>
                <span>{batch.isFlagged ? (t('production.clearFlag') || 'Resolve') : (t('production.flagBatch') || 'Flag')}</span>
              </Button>
            )}

            {canEditBatch && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/production/new?edit=${batch.id}`)}
                className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold h-9 px-3 shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <Edit className="w-4 h-4 mr-1.5" />
                {t("common.edit")}
              </Button>
            )}
          </div>
        </div>

        {/* Main Batch Header Banner */}
        <div className="bg-gradient-to-br from-[#2C1B10] via-[#4A2E1B] to-[#5A3A23] rounded-3xl p-5 sm:p-7 text-white shadow-lg relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 opacity-10 pointer-events-none">
            <ChefHat className="w-72 h-72 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2.5 min-w-0">
              {/* Badges Row: Branch, Shift, Status, Edit, Flag */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-[#E87A18] text-white shadow-xs">
                  <span>🏢</span>
                  <span>{batch.branch?.name || t("common.mainBakery") || "Main Bakery"}</span>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white/15 text-amber-200 border border-white/20">
                  {batch.shift === "NIGHT" ? `🌙 ${t("production.nightShift") || "Night Shift"}` : `☀️ ${t("production.dayShift") || "Day Shift"}`}
                </span>
                {batch.status === "COMPLETED" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("production.statusCompleted") || "Completed"}</span>
                  </span>
                )}
                {batch.status === "PENDING_APPROVAL" && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-400/30">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t("production.statusPendingApproval") || "Pending Approval"}</span>
                  </span>
                )}
                {batch.isEdited && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-400/20 text-amber-200 border border-amber-300/30">
                    ✏️ {t("production.edited") || "Edited"}
                  </span>
                )}
                {batch.isFlagged && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-500/30 text-rose-200 border border-rose-400/40">
                    🚩 {t("production.flagged") || "Flagged"}
                  </span>
                )}
              </div>

              {/* Title & Date */}
              <div>
                <h1 className="text-xl sm:text-3xl font-black text-white tracking-tight">
                  {formatEthDate(batch.date)}
                </h1>
                <p className="text-xs sm:text-sm text-amber-200/80 font-medium mt-0.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                  <span>{format(new Date(batch.createdAt), "hh:mm a")} • {format(new Date(batch.createdAt), "MMMM dd, yyyy")}</span>
                </p>
              </div>

              {/* Baker / Employee Information */}
              <div className="flex items-center gap-2 pt-1 text-xs sm:text-sm text-amber-100/90 font-medium flex-wrap">
                <span className="flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded-xl border border-white/15">
                  <User className="w-4 h-4 text-amber-300 shrink-0" />
                  <span>
                    <span className="text-amber-300 font-bold">{t("production.colLoggedBy") || "Logged by"}:</span>{" "}
                    <strong className="text-white font-extrabold">{batch.user.fullName}</strong>
                  </span>
                </span>
                <span className="text-amber-200/70 text-xs font-semibold px-1">
                  ({batch.user.role === 'BAKER' ? (t('users.roleBaker') || "Baker") : (batch.user.role ? (batch.user.role.replace('_', ' ')) : (t('common.worker') || "Worker"))})
                </span>
              </div>
            </div>

            {/* Quick KPI stats */}
            <div className="flex sm:flex-col gap-2.5 shrink-0 pt-2 sm:pt-0">
              <div className="bg-white/10 rounded-2xl p-3 border border-white/15 text-center min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-amber-200/70 block">
                  {t("production.tabProducts") || "Products"}
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  {totalProducedUnits.toLocaleString()} <span className="text-xs font-semibold text-amber-300">Pcs</span>
                </span>
              </div>
              <div className="bg-white/10 rounded-2xl p-3 border border-white/15 text-center min-w-[120px]">
                <span className="text-[10px] uppercase font-bold text-amber-200/70 block">
                  {t("production.colRawMaterialsConsumed") || "Ingredients"}
                </span>
                <span className="text-lg sm:text-xl font-black text-white">
                  {batch.materialUsages.length} <span className="text-xs font-semibold text-amber-300">{t("common.items") || "items"}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

          {/* Flagged Clarification Notice Banner (Collapsible) */}
          {batch.isFlagged && (
            <div className="mt-4 p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-950 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-base">🚩</span>
                  <span className="font-extrabold text-rose-900">
                    {t('production.flaggedNotice', { name: batch.flaggedBy || "Management" })}
                  </span>
                  {batch.flagReason && (
                    <button
                      type="button"
                      onClick={() => setIsFlagNoteExpanded(!isFlagNoteExpanded)}
                      className="text-rose-700 hover:text-rose-900 underline font-black text-xs ml-1 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isFlagNoteExpanded ? (t('production.hideNote') || 'Hide note') : (t('production.viewNote') || 'Note...')}</span>
                    </button>
                  )}
                </div>
                {isGlobalAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleFlag(false)}
                    className="border-rose-300 bg-white text-rose-700 hover:bg-rose-100 font-bold text-xs h-7 px-2.5 rounded-lg shrink-0 cursor-pointer"
                  >
                    {t('production.clearFlag') || 'Resolve'}
                  </Button>
                )}
              </div>
              {batch.flagReason && isFlagNoteExpanded && (
                <div className="mt-1 p-3 bg-white/90 rounded-xl border border-rose-200 text-rose-900 font-medium leading-relaxed animate-in fade-in duration-150">
                  <div className="text-[10px] uppercase tracking-wider font-bold text-rose-600 mb-0.5">Note:</div>
                  <p>{batch.flagReason}</p>
                  {batch.flaggedAt && (
                    <div className="text-[10px] text-rose-500 mt-1.5 font-medium">
                      {formatEthDate(batch.flaggedAt)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Owner-Only Admin Audit Review Status Card */}
          {user?.role === "OWNER" && (
            <div className="mt-4 pt-3.5 border-t border-[#F4ECE1] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#8C7361] uppercase tracking-wider">{t('production.adminReviewStatus')}:</span>
                  <span className={`inline-flex items-center gap-1 font-extrabold px-2.5 py-1 rounded-lg ${
                    batch.adminSeenAt
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}>
                    {batch.adminSeenAt ? `✓ ${t('production.reviewedAt', { date: formatEthDate(batch.adminSeenAt) })}` : `⏳ ${t('production.notReviewedYet')}`}
                  </span>
                </div>
              </div>
              <div className="text-[11px] font-semibold text-[#8C7361]">
                {batch.isFlagged ? (
                  <span className="text-rose-700 font-bold flex items-center gap-1">🚩 {t('production.flaggedBatches')}</span>
                ) : (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">✓ {t('production.noActiveFlags') || "No active flags"}</span>
                )}
              </div>
            </div>
          )}

        {/* ── Edit History Audit Section ── */}
        {batch.isEdited && (
          <div className="bg-amber-50/60 border border-amber-200/90 rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-lg">✏️</span>
                <div>
                  <h3 className="text-sm font-extrabold text-amber-950">
                    {t("production.editHistoryTitle") || "Batch Edit History"}
                  </h3>
                  <p className="text-[11px] font-medium text-amber-800/80">
                    {batch.editedAt ? `${t("production.lastEdited") || "Last modified"}: ${formatEthDate(batch.editedAt)}` : ""}
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-amber-200/70 text-amber-900 border border-amber-300">
                {Array.isArray(batch.editHistory) && batch.editHistory.length > 0
                  ? (t('production.revisionCount', { count: batch.editHistory.length }) || `${batch.editHistory.length} Revision(s)`)
                  : (t("production.edited") || "Edited")}
              </span>
            </div>

            {Array.isArray(batch.editHistory) && batch.editHistory.length > 0 ? (
              <div className="space-y-3">
                {batch.editHistory.slice().reverse().map((rev, revIdx) => (
                  <div
                    key={revIdx}
                    className="bg-white/95 rounded-2xl p-4 border border-amber-200/80 shadow-2xs space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span className="font-extrabold text-[#2C1B10]">{rev.editorName}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-900">
                          {rev.editorRole}
                        </span>
                      </div>
                      <span className="text-[11px] font-medium text-[#8C7361]">
                        {formatEthDate(rev.editedAt)}
                      </span>
                    </div>

                    {/* Changed Items */}
                    {rev.itemChanges && rev.itemChanges.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                          {t("production.productsModified") || "Products Modified"}:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rev.itemChanges.map((ic, iIdx) => (
                            <div
                              key={iIdx}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-semibold"
                            >
                              <span className="text-[#2C1B10] truncate">{ic.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-[#8C7361] line-through text-[11px]">
                                  {ic.oldQty}
                                </span>
                                <span className="text-[#8C7361]">➔</span>
                                <span className="font-bold text-[#2C1B10]">
                                  {ic.newQty} {ic.unit}
                                </span>
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                    ic.diff > 0
                                      ? "bg-emerald-100 text-emerald-800"
                                      : "bg-rose-100 text-rose-800"
                                  }`}
                                >
                                  {ic.diff > 0 ? `+${ic.diff}` : ic.diff}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Changed Materials */}
                    {rev.materialChanges && rev.materialChanges.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C7361] block">
                          {t("production.materialsModified") || "Raw Materials Modified"}:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rev.materialChanges.map((mc, mIdx) => (
                            <div
                              key={mIdx}
                              className="flex items-center justify-between gap-2 p-2 rounded-xl bg-rose-50/60 border border-rose-100 text-xs font-semibold"
                            >
                              <span className="text-rose-950 truncate">{mc.name}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-rose-600/70 line-through text-[11px]">
                                  {mc.oldQty}
                                </span>
                                <span className="text-rose-500">➔</span>
                                <span className="font-bold text-rose-950">
                                  {mc.newQty} {mc.unit}
                                </span>
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-md ${
                                    mc.diff > 0
                                      ? "bg-rose-100 text-rose-800"
                                      : "bg-emerald-100 text-emerald-800"
                                  }`}
                                >
                                  {mc.diff > 0 ? `+${mc.diff}` : mc.diff}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

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
                <p className="text-xs text-[#8C7361]">{t("production.allFinishedProductsSub")}</p>
              </div>
            </div>

            {/* Product Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                placeholder={t("production.searchProductsTable")}
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
              {t("production.noItemsMatchSearch")}
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredProducts.map((item, index) => {
                  const sharePercent = totalProducedUnits > 0
                    ? ((Number(item.quantityProduced || 0) / totalProducedUnits) * 100).toFixed(1)
                    : "0";

                  return (
                    <div key={item.id || index} className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#EDE4D5] space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-extrabold text-sm text-[#2C1B10] block truncate">{item.product.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-white text-[#4A2E1B] border border-[#EDE4D5]">
                              {item.product.category?.name || t('production.generalCategory') || "General"}
                            </span>
                            <span className="text-[11px] text-[#8C7361] font-semibold">{item.product.unitType}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-amber-100 text-[#E87A18] border border-amber-300">
                            {Number(item.quantityProduced).toLocaleString()} {item.product.unitType}
                          </span>
                          <span className="text-[10px] font-bold text-[#8C7361] block mt-0.5">
                            {t('production.batchSharePercent', { percent: sharePercent }) || `${sharePercent}% share`}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table (md+) */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>{t("production.colProduct")}</TableHead>
                      <TableHead>{t("products.category")}</TableHead>
                      <TableHead className="text-right">{t("production.colQuantityProduced")}</TableHead>
                      <TableHead className="text-right">{t("production.batchShare") || "Batch Share"}</TableHead>
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
                              {item.product.category?.name || t('production.generalCategory') || "General"}
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
            </>
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
                <p className="text-xs text-[#8C7361]">{t("production.allRawMaterialsSub")}</p>
              </div>
            </div>

            {/* Material Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                value={materialSearch}
                onChange={(e) => setMaterialSearch(e.target.value)}
                placeholder={t("production.searchIngredientsTable")}
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
              {materialSearch ? t("production.noItemsMatchSearch") : t("production.noMaterialsDeducted")}
            </div>
          ) : (
            <>
              {/* Mobile Cards View (< md) */}
              <div className="md:hidden space-y-2.5">
                {filteredMaterials.map((mat, index) => (
                  <div key={mat.id || index} className="p-3.5 rounded-2xl bg-rose-50/50 border border-rose-200/70 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="font-extrabold text-sm text-rose-950 block truncate">{mat.stockItem.name}</span>
                      <span className="text-[11px] text-rose-800/80 font-semibold">{mat.stockItem.unitType}</span>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-black bg-rose-100 text-rose-800 border border-rose-300 shrink-0">
                      -{Number(mat.quantityUsed).toFixed(2)} {mat.stockItem.unitType}
                    </span>
                  </div>
                ))}
              </div>

              {/* Desktop Table (md+) */}
              <div className="overflow-x-auto hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12 text-center">#</TableHead>
                      <TableHead>{t("stock.colItemName")}</TableHead>
                      <TableHead>{t("production.unit")}</TableHead>
                      <TableHead className="text-right">{t("production.usedQtyInputLabel")}</TableHead>
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
            </>
          )}
        </div>

        {/* FLAG CLARIFICATION DIALOG */}
        <Dialog open={isFlagModalOpen} onOpenChange={setIsFlagModalOpen}>
          <DialogContent className="max-w-md bg-white rounded-3xl p-6 border border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
                <span className="text-xl">🚩</span>
                {t('production.flagBatchTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <p className="text-xs text-[#8C7361] leading-relaxed">
                {t('production.flagBatchDesc')}
              </p>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('production.flagClarificationReason') || "Clarification Reason / Question"}
                </label>
                <textarea
                  value={flagReasonInput}
                  onChange={(e) => setFlagReasonInput(e.target.value)}
                  placeholder={t('production.flagReasonPlaceholder')}
                  rows={3}
                  className="w-full text-xs rounded-xl border border-[#EDE4D5] bg-[#FAF6F0] p-3 text-[#2C1B10] focus:outline-none focus:border-[#4A2E1B] resize-none"
                />
              </div>
            </div>
            <DialogFooter className="mt-4 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsFlagModalOpen(false)}
                className="rounded-xl border-[#EDE4D5] font-bold text-xs"
              >
                {t('common.cancel') || "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={() => handleToggleFlag(true, flagReasonInput)}
                disabled={isFlagSubmitting}
                className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
              >
                <Flag className="w-3.5 h-3.5 mr-1" />
                {t('production.flagSubmitBtn')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
