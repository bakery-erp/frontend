"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
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
import { formatEthDate } from "@/lib/ethiopianDate";
import { Plus, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, History, Eye, Package, Wheat, Search, ChevronRight, X, Edit, MoreVertical, Flag, Check } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { isProductAllowedForRole, getStationMeta } from "@/lib/roleProductMapping";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; unitType: string; category?: { type: string } }
interface StockItem { id: string; name: string; unitType: string; currentQuantity: number; }
interface ActiveSession { id: string; status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED" }

interface ProductionBatch {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT" | null;
  status: "PENDING_APPROVAL" | "STARTED" | "COMPLETED" | "REJECTED";
  createdAt: string;
  userId?: string;
  isEdited?: boolean;
  editedAt?: string | null;
  editHistory?: any;
  adminSeenAt?: string | null;
  ownerSeenAt?: string | null;
  isFlagged?: boolean;
  flagReason?: string | null;
  flaggedBy?: string | null;
  flaggedAt?: string | null;
  user: { id: string; fullName: string };
  items: { id: string; productId?: string; quantityProduced: number; product: { id?: string; name: string; unitType: string } }[];
  materialUsages: { id: string; stockItemId?: string; quantityUsed: number; stockItem: { id?: string; name: string; unitType: string } }[];
}

export default function ProductionPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";
  const queryClient = useQueryClient();

  const [filterTab, setFilterTab] = useState<"ALL" | "TODAY" | "UNSEEN" | "FLAGGED">("ALL");
  const [workerTab, setWorkerTab] = useState<"TODAY" | "YESTERDAY">("TODAY");
  const [shiftFilter, setShiftFilter] = useState<"ALL" | "DAY" | "NIGHT">("ALL");
  const [page, setPage] = useState<number>(1);
  const [accumulatedBatches, setAccumulatedBatches] = useState<ProductionBatch[]>([]);

  const ethNow = useMemo(() => new Date(Date.now() + 3 * 3600 * 1000), []);
  const todayYmd = useMemo(() => ethNow.toISOString().slice(0, 10), [ethNow]);
  const yesterdayYmd = useMemo(() => {
    return new Date(ethNow.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  }, [ethNow]);

  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});
  const [expandedMaterialsBatches, setExpandedMaterialsBatches] = useState<Record<string, boolean>>({});
  const [expandedFlagNotes, setExpandedFlagNotes] = useState<Record<string, boolean>>({});

  const toggleExpandFlagNote = (batchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setExpandedFlagNotes((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const toggleExpandBatch = (batchId: string) => {
    setExpandedBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  const toggleExpandMaterials = (batchId: string) => {
    setExpandedMaterialsBatches((prev) => ({ ...prev, [batchId]: !prev[batchId] }));
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = tabRefs.current[filterTab];
      if (btn) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [filterTab]);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionBatchId, setActionBatchId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [items, setItems] = useState<{ productId: string; quantityProduced: string }[]>([]);
  const [materials, setMaterials] = useState<{ stockItemId: string; quantityUsed: string }[]>([]);

  // Query Params for Backend Pagination
  const queryParams = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedBranchId) params.append("branchId", selectedBranchId);
    params.append("page", String(page));
    params.append("limit", "10");

    if (isGlobalAdmin) {
      if (filterTab === "TODAY") params.append("date", todayYmd);
      else if (filterTab === "UNSEEN") params.append("seenFilter", "UNSEEN");
      else if (filterTab === "FLAGGED") params.append("seenFilter", "FLAGGED");
      if (shiftFilter !== "ALL") params.append("shift", shiftFilter);
    } else {
      params.append("date", workerTab === "TODAY" ? todayYmd : yesterdayYmd);
    }
    return params.toString();
  }, [selectedBranchId, page, isGlobalAdmin, filterTab, shiftFilter, workerTab, todayYmd, yesterdayYmd]);

  // 1. Primary backend-paginated query
  const { data: pageData, isLoading, isFetching } = useQuery({
    queryKey: [
      "production-page-batches",
      selectedBranchId,
      isGlobalAdmin ? filterTab : workerTab,
      isGlobalAdmin ? shiftFilter : null,
      page,
    ],
    refetchOnMount: "always",
    staleTime: 0,
    queryFn: async () => {
      const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};
      const [resBatches, resSess] = await Promise.all([
        api.get(`/production-batches?${queryParams}`),
        api.get('/daily-sessions/active', sessionParams).catch(() => ({ data: null })),
      ]);

      const resData = resBatches.data;
      const batchesList = Array.isArray(resData) ? resData : (resData?.batches || []);
      const totalCount = resData?.total ?? batchesList.length;
      const hasMoreBatches = resData?.hasMore ?? false;

      return {
        batches: batchesList as ProductionBatch[],
        total: totalCount as number,
        hasMore: hasMoreBatches as boolean,
        activeSession: (resSess.data || null) as ActiveSession | null,
      };
    },
  });

  // Accumulate pages when user clicks "Show More"
  useEffect(() => {
    if (!pageData?.batches) return;
    if (page === 1) {
      setAccumulatedBatches(pageData.batches);
    } else {
      setAccumulatedBatches((prev) => {
        const existingIds = new Set(prev.map((b) => b.id));
        const newOnes = pageData.batches.filter((b) => !existingIds.has(b.id));
        return [...prev, ...newOnes];
      });
    }
  }, [pageData?.batches, page]);

  // Worker tab counts for Today & Yesterday
  const { data: workerCounts } = useQuery({
    queryKey: ["production-worker-counts", selectedBranchId, user?.id],
    enabled: !isGlobalAdmin,
    refetchOnMount: "always",
    queryFn: async () => {
      const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const [resToday, resYesterday] = await Promise.all([
        api.get(`/production-batches?date=${todayYmd}&limit=1${branchParam}`),
        api.get(`/production-batches?date=${yesterdayYmd}&limit=1${branchParam}`),
      ]);
      const todayTotal = resToday.data?.total ?? (Array.isArray(resToday.data) ? resToday.data.length : 0);
      const yesterdayTotal = resYesterday.data?.total ?? (Array.isArray(resYesterday.data) ? resYesterday.data.length : 0);
      return { today: todayTotal, yesterday: yesterdayTotal };
    },
  });

  // Admin tab counts
  const { data: adminCounts } = useQuery({
    queryKey: ["production-admin-counts", selectedBranchId],
    enabled: isGlobalAdmin,
    refetchOnMount: "always",
    queryFn: async () => {
      const branchParam = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const [resAll, resToday, resUnseen, resFlagged] = await Promise.all([
        api.get(`/production-batches?limit=1${branchParam}`),
        api.get(`/production-batches?date=${todayYmd}&limit=1${branchParam}`),
        api.get(`/production-batches?seenFilter=UNSEEN&limit=1${branchParam}`),
        api.get(`/production-batches?seenFilter=FLAGGED&limit=1${branchParam}`),
      ]);
      return {
        all: resAll.data?.total ?? 0,
        today: resToday.data?.total ?? 0,
        unseen: resUnseen.data?.total ?? 0,
        flagged: resFlagged.data?.total ?? 0,
      };
    },
  });

  // 2. Lightweight modal data (products and stock items) with minimal=true
  const { data: modalData } = useQuery({
    queryKey: ["production-modal-data", selectedBranchId, user?.role],
    queryFn: async () => {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const minimalParam = branchQuery ? `${branchQuery}&minimal=true` : "?minimal=true";

      const [resProd, resStock] = await Promise.all([
        api.get(`/products${minimalParam}`),
        api.get(`/stock-items${branchQuery}`),
      ]);

      const filteredProds = isGlobalAdmin
        ? (resProd.data || [])
        : (resProd.data || []).filter((p: Product) => isProductAllowedForRole(p, user?.role));

      return {
        products: filteredProds as Product[],
        stockItems: (resStock.data || []) as StockItem[],
      };
    },
    staleTime: 60 * 1000,
  });

  const batches = accumulatedBatches;
  const activeSession = pageData?.activeSession || null;
  const products = modalData?.products || [];
  const stockItems = modalData?.stockItems || [];



  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("You must add at least one produced product");
      return;
    }

    setIsSubmitting(true);
    const systemDate = format(new Date(), "yyyy-MM-dd");
    const data = {
      branchId: selectedBranchId || undefined,
      date: isGlobalAdmin ? date : systemDate,
      shift,
      items: items.map(i => ({ productId: i.productId, quantityProduced: Number(i.quantityProduced) })),
      materialUsages: materials.map(m => ({ stockItemId: m.stockItemId, quantityUsed: Number(m.quantityUsed) })),
    };

    try {
      await api.post("/production-batches", data);
      toast.success("Production batch created & stock updated");
      setIsAddOpen(false);
      setItems([]);
      setMaterials([]);
      queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
      queryClient.invalidateQueries({ queryKey: ["production-modal-data"] });
      queryClient.invalidateQueries({ queryKey: ["production-history"] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error creating batch");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Seen & Flag States & Actions
  const [flaggingBatch, setFlaggingBatch] = useState<ProductionBatch | null>(null);
  const [flagReasonInput, setFlagReasonInput] = useState("");
  const [isFlagSubmitting, setIsFlagSubmitting] = useState(false);
  const [markingSeenId, setMarkingSeenId] = useState<string | null>(null);

  const isBatchSeenByMe = useCallback((b: ProductionBatch) => {
    if (user?.role === "OWNER") return !!b.ownerSeenAt;
    if (user?.role === "ADMIN") return !!b.adminSeenAt;
    return true;
  }, [user?.role]);

  const handleMarkSeen = async (batchId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setMarkingSeenId(batchId);
    try {
      await api.post(`/production-batches/${batchId}/seen`);
      toast.success(t('production.markedAsSeenSuccess') || "Marked as seen successfully");
      queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to mark as seen");
    } finally {
      setMarkingSeenId(null);
    }
  };

  const handleToggleFlag = async (batch: ProductionBatch, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (batch.isFlagged) {
      try {
        await api.post(`/production-batches/${batch.id}/flag`, { isFlagged: false });
        toast.success(t('production.flagClearedSuccess') || "Flag resolved successfully");
        queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
      } catch (err: any) {
        toast.error(err.response?.data?.error || "Failed to resolve flag");
      }
    } else {
      setFlaggingBatch(batch);
      setFlagReasonInput("");
    }
  };

  const handleConfirmFlag = async () => {
    if (!flaggingBatch) return;
    setIsFlagSubmitting(true);
    try {
      await api.post(`/production-batches/${flaggingBatch.id}/flag`, {
        isFlagged: true,
        reason: flagReasonInput.trim() || undefined,
      });
      toast.success(t('production.flagAppliedSuccess') || "Batch flagged with question sign");
      setFlaggingBatch(null);
      setFlagReasonInput("");
      queryClient.invalidateQueries({ queryKey: ["production-page-batches"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to flag batch");
    } finally {
      setIsFlagSubmitting(false);
    }
  };


  const todayCount = isGlobalAdmin ? (adminCounts?.today ?? 0) : (workerCounts?.today ?? 0);
  const unseenCount = adminCounts?.unseen ?? 0;
  const flaggedCount = adminCounts?.flagged ?? 0;
  const allCount = adminCounts?.all ?? 0;

  const filteredBatches = accumulatedBatches;



  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 xs:mb-6">
        <div>
          <h1 className="text-xl xs:text-2xl font-extrabold text-[#2C1B10] tracking-tight">{t('production.title')}</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">{t('production.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 xs:gap-3 w-full sm:w-auto min-w-0">
          {isGlobalAdmin && (
            <Button
              onClick={() => router.push('/production/history')}
              variant="outline"
              size="lg"
              className="flex-1 sm:flex-initial min-w-0 px-2.5 xs:px-4"
            >
              <History className="w-4 h-4 text-[#E87A18] shrink-0" />
              <span className="truncate">
                <span className="hidden xs:inline">Daily </span>History
              </span>
            </Button>
          )}
          <Button
            onClick={() => router.push('/production/new')}
            disabled={isLoading}
            size="lg"
            className="flex-1 sm:flex-initial min-w-0 px-2.5 xs:px-4"
          >
            <Plus className="w-4 h-4 shrink-0" />
            <span className="truncate">
              <span className="hidden xs:inline">Record </span>New Batch
            </span>
          </Button>
        </div>
      </div>



      {/* Worker Tabs (Strictly Today & Yesterday for Non-Admins) */}
      {!isGlobalAdmin && (
        <div className="flex items-center gap-2 mb-4 border-b border-[#EDE4D5] pb-3">
          <button
            type="button"
            onClick={() => {
              if (workerTab !== "TODAY") {
                setWorkerTab("TODAY");
                setPage(1);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              workerTab === "TODAY"
                ? "bg-emerald-700 text-white shadow-xs"
                : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
            }`}
          >
            <span>📅 {t("common.today") || "Today"}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                workerTab === "TODAY" ? "bg-white text-emerald-800" : "bg-emerald-600 text-white"
              }`}
            >
              {workerCounts?.today ?? 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (workerTab !== "YESTERDAY") {
                setWorkerTab("YESTERDAY");
                setPage(1);
              }
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center gap-1.5 cursor-pointer ${
              workerTab === "YESTERDAY"
                ? "bg-[#4A2E1B] text-white shadow-xs"
                : "text-[#4A2E1B] bg-amber-50 hover:bg-amber-100 border border-amber-200"
            }`}
          >
            <span>📅 {t("common.yesterday") || "Yesterday"}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                workerTab === "YESTERDAY" ? "bg-white text-[#4A2E1B]" : "bg-[#4A2E1B] text-white"
              }`}
            >
              {workerCounts?.yesterday ?? 0}
            </span>
          </button>
        </div>
      )}

      {/* Filter Tabs & Shift Selector (Only for Admin & Owner) */}
      {isGlobalAdmin && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 border-b border-[#EDE4D5] pb-3 max-w-full overflow-hidden">
          <div className="relative overflow-hidden flex-1 max-w-full">
            {/* Edge gradient hints on small screens */}
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#FAF7EE] to-transparent z-10 sm:hidden" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#FAF7EE] to-transparent z-10 sm:hidden" />

            <div
              className="flex items-center gap-1.5 xs:gap-2 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2.5rem] px-0.5"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <button
                ref={(el) => { tabRefs.current["ALL"] = el; }}
                onClick={() => { setFilterTab("ALL"); setPage(1); }}
                className={`px-3 xs:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  filterTab === "ALL"
                    ? "bg-[#2C1B10] text-white shadow-xs"
                    : "text-[#8C7361] hover:bg-[#FAF6F0] border border-[#EDE4D5]"
                }`}
              >
                {t('production.allBatches')} ({allCount})
              </button>
              <button
                ref={(el) => { tabRefs.current["TODAY"] = el; }}
                onClick={() => { setFilterTab("TODAY"); setPage(1); }}
                className={`px-3 xs:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  filterTab === "TODAY"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
                }`}
              >
                📅 {t('production.todayBatches')} ({todayCount})
              </button>
              <button
                ref={(el) => { tabRefs.current["UNSEEN"] = el; }}
                onClick={() => { setFilterTab("UNSEEN"); setPage(1); }}
                className={`px-3 xs:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  filterTab === "UNSEEN"
                    ? "bg-sky-700 text-white shadow-xs"
                    : "text-sky-800 bg-sky-50 hover:bg-sky-100 border border-sky-200"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                {t('production.unseenBatches')}
                {unseenCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    filterTab === "UNSEEN" ? "bg-white text-sky-800" : "bg-sky-600 text-white"
                  }`}>
                    {unseenCount}
                  </span>
                )}
              </button>
              <button
                ref={(el) => { tabRefs.current["FLAGGED"] = el; }}
                onClick={() => { setFilterTab("FLAGGED"); setPage(1); }}
                className={`px-3 xs:px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                  filterTab === "FLAGGED"
                    ? "bg-rose-700 text-white shadow-xs"
                    : "text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200"
                }`}
              >
                <Flag className="w-3.5 h-3.5" />
                {t('production.flaggedBatches')}
                {flaggedCount > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                    filterTab === "FLAGGED" ? "bg-white text-rose-800" : "bg-rose-600 text-white"
                  }`}>
                    {flaggedCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Shift Filter Pill Group */}
          <div className="flex items-center bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5] shrink-0 self-start sm:self-auto max-w-full overflow-x-auto no-scrollbar">
            <button
              onClick={() => { setShiftFilter("ALL"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === "ALL" ? "bg-[#4A2E1B] text-white shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              {t('production.allShifts')}
            </button>
            <button
              onClick={() => { setShiftFilter("DAY"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === "DAY" ? "bg-amber-500 text-zinc-950 shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              ☀️ {t('production.dayShift')}
            </button>
            <button
              onClick={() => { setShiftFilter("NIGHT"); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                shiftFilter === "NIGHT" ? "bg-indigo-600 text-white shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              🌙 {t('production.nightShift')}
            </button>
          </div>
        </div>
      )}

      {/* ── Mobile Card List (block on < md) ── */}
      <div className="space-y-3 block md:hidden mb-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#EDE4D5] p-4 space-y-3 shadow-xs">
                <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1]">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-6 w-24 rounded-full" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredBatches.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-[#EDE4D5] text-[#8C7361] font-medium text-xs">
            {filterTab === "UNSEEN"
              ? "All batches have been reviewed by you! 🎉"
              : filterTab === "FLAGGED"
              ? "No batches are flagged for questions."
              : t('production.noBatches')}
          </div>
        ) : (
          filteredBatches.map((batch) => {
            const batchDateYmd = (batch.date || batch.createdAt || "").slice(0, 10);
            const isToday = batchDateYmd === todayYmd;
            const canEditBatch = isGlobalAdmin || ((user?.id === batch.user?.id || user?.id === batch.userId) && isToday);

            return (
              <div
                key={batch.id}
                className={`bg-white rounded-2xl border p-3.5 xs:p-4 shadow-xs space-y-3 overflow-hidden ${
                  isGlobalAdmin && !isBatchSeenByMe(batch)
                    ? "border-sky-300 ring-1 ring-sky-100"
                    : batch.isFlagged
                    ? "border-rose-300 ring-1 ring-rose-100"
                    : "border-[#EDE4D5]"
                }`}
              >
              {/* Card Header: Date, Shift, Seen Status, Flag Badge */}
              <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-extrabold text-sm text-[#2C1B10]">{formatEthDate(batch.date)}</span>
                    {((batch.date || batch.createdAt || "").slice(0, 10) === todayYmd) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        {t('common.today') || "Today"}
                      </span>
                    )}
                    {((batch.date || batch.createdAt || "").slice(0, 10) === yesterdayYmd) && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        {t('common.yesterday') || "Yesterday"}
                      </span>
                    )}
                    {batch.isEdited && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        ✏️ {t('production.edited') || "Edited"}
                      </span>
                    )}
                    {isGlobalAdmin && !isBatchSeenByMe(batch) && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                        🔵 {t('production.unseenForMe')}
                      </span>
                    )}
                    {batch.isFlagged && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                        🚩 {t('production.flaggedBatches')}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#8C7361] mt-0.5">
                    {batch.shift === "NIGHT" ? `🌙 ${t('production.nightShiftFull')}` : `☀️ ${t('production.dayShiftFull')}`}
                  </span>
                </div>

                {/* Owner-Only Admin Checked Indicator (Tiny pill at the top right) */}
                {user?.role === "OWNER" && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold border shrink-0 ${
                    batch.adminSeenAt
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-amber-50 text-amber-800 border-amber-200"
                  }`}>
                    {batch.adminSeenAt ? `✓ ${t('production.adminChecked') || 'Admin: Checked'}` : `⏳ ${t('production.adminUnchecked') || 'Admin: Unchecked'}`}
                  </span>
                )}
              </div>

              {/* Collapsible Flagged Clarification Notice */}
              {batch.isFlagged && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => toggleExpandFlagNote(batch.id, e)}
                      className="flex items-center gap-1.5 text-left font-bold text-rose-900 truncate hover:text-rose-950 flex-1 min-w-0"
                    >
                      <span className="text-sm shrink-0">🚩</span>
                      <span className="truncate">{batch.flagReason || "Attention needed"}</span>
                      <span className="text-[10px] text-rose-600 font-extrabold shrink-0 underline ml-0.5">
                        {expandedFlagNotes[batch.id] ? "▲" : "..."}
                      </span>
                    </button>
                    {isGlobalAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleToggleFlag(batch, e)}
                        className="border-rose-300 text-rose-700 bg-white hover:bg-rose-100 font-bold text-[10px] h-6 px-2 rounded-lg shrink-0"
                      >
                        {t('production.clearFlag')}
                      </Button>
                    )}
                  </div>
                  {expandedFlagNotes[batch.id] && (
                    <div className="mt-2 pt-2 border-t border-rose-200/80 text-[11px] text-rose-800 space-y-1">
                      <p className="font-semibold leading-relaxed whitespace-pre-wrap">{batch.flagReason}</p>
                      <div className="text-[10px] text-rose-600 flex items-center justify-between pt-0.5">
                        <span>{t('production.flaggedNotice', { name: batch.flaggedBy || 'Management' })}</span>
                        {batch.flaggedAt && <span>{formatEthDate(batch.flaggedAt)}</span>}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Items Produced */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7361] block mb-1.5">
                  {t('production.colProductsBaked')} ({batch.items.length})
                </span>
                {batch.items.length === 0 ? (
                  <span className="text-xs text-zinc-400 italic">No products</span>
                ) : (
                  <div className="space-y-1.5">
                    <div className="inline-flex max-w-full items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-bold text-[#2C1B10]">
                      <span className="truncate">{batch.items[0].product.name}</span>
                      <span className="text-[#E87A18] font-black shrink-0">
                        × {batch.items[0].quantityProduced} {batch.items[0].product.unitType}
                      </span>
                    </div>
                    {batch.items.length > 1 && (
                      <div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/production/${batch.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#FAF6F0] hover:bg-[#F3ECE1] border border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] transition-all cursor-pointer group shadow-2xs"
                        >
                          <span className="text-[#E87A18] font-black">+{batch.items.length - 1}</span>
                          <span className="font-semibold text-[#8C7361] group-hover:text-[#4A2E1B]">
                            {t('production.moreProductsBadge')}
                          </span>
                          <ChevronRight className="w-3 h-3 text-[#8C7361] group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Raw Materials Deducted */}
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#8C7361] block mb-1">
                  {t('production.colRawMaterialsConsumed')}{batch.materialUsages.length > 0 ? ` (${batch.materialUsages.length})` : ""}
                </span>
                {batch.materialUsages.length === 0 ? (
                  <span className="text-xs text-zinc-400 italic">{t('production.noMaterialsDeducted')}</span>
                ) : (
                  <div className="space-y-1.5">
                    <span className="inline-flex max-w-full items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 border border-rose-100 text-[11px] font-semibold text-rose-800">
                      <span className="truncate">{batch.materialUsages[0].stockItem.name}:</span>
                      <span className="shrink-0">-{Number(batch.materialUsages[0].quantityUsed).toFixed(2)} {batch.materialUsages[0].stockItem.unitType}</span>
                    </span>
                    {batch.materialUsages.length > 1 && (
                      <div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/production/${batch.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-xs font-bold text-rose-800 transition-all cursor-pointer group shadow-2xs"
                        >
                          <span className="text-rose-600 font-black">+{batch.materialUsages.length - 1}</span>
                          <span className="font-semibold text-rose-700">
                            {t('production.moreMaterialsBadge')}
                          </span>
                          <ChevronRight className="w-3 h-3 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>


              {/* Card Footer: Logged by & Direct Action Buttons */}
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[#F4ECE1]">
                {isGlobalAdmin ? (
                  <span className="text-[11px] text-[#8C7361] font-semibold truncate">
                    {t('production.colLoggedBy')}: <strong className="text-[#2C1B10]">{batch.user.fullName}</strong>
                  </span>
                ) : (
                  <span />
                )}

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end" onClick={(e) => e.stopPropagation()}>
                  {isGlobalAdmin && !isBatchSeenByMe(batch) && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markingSeenId === batch.id}
                        onClick={(e) => handleMarkSeen(batch.id, e)}
                        className="border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1 shadow-2xs"
                        title={t('production.markAsSeen')}
                      >
                        <Check className="w-3.5 h-3.5 text-sky-600" />
                        <span>{t('production.markAsSeen')}</span>
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleToggleFlag(batch, e)}
                        className="border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs h-8 w-8 p-0 rounded-xl flex items-center justify-center shadow-2xs"
                        title={t('production.flagBatch')}
                      >
                        <span className="text-xs">🚩</span>
                      </Button>
                    </>
                  )}

                  {isGlobalAdmin && batch.isFlagged && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => handleToggleFlag(batch, e)}
                      className="border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold text-xs h-8 px-2 rounded-xl flex items-center gap-1 shadow-2xs"
                      title={t('production.clearFlag')}
                    >
                      <span className="text-xs">🚩</span>
                      <span>{t('production.clearFlag')}</span>
                    </Button>
                  )}

                  {/* Dedicated mobile View button */}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/production/${batch.id}`)}
                    className="border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
                    title={t('common.view') || "View"}
                  >
                    <Eye className="w-3.5 h-3.5 text-[#E87A18]" />
                    <span>{t('common.view') || "View"}</span>
                  </Button>

                  {canEditBatch && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/production/new?edit=${batch.id}`)}
                      className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1 shadow-2xs cursor-pointer"
                      title={t('common.edit') || "Edit"}
                    >
                      <Edit className="w-3.5 h-3.5 text-[#8C7361]" />
                      <span>{t('common.edit') || "Edit"}</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Table (hidden on < md, visible on md+) ── */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl shadow-xs hidden md:block overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">{t('production.colDateShift')}</TableHead>
              <TableHead>{t('production.colProductsBaked')}</TableHead>
              <TableHead>{t('production.colRawMaterialsConsumed')}</TableHead>
              {isGlobalAdmin && <TableHead className="w-32">{t('production.colLoggedBy')}</TableHead>}
              {user?.role === 'OWNER' && <TableHead className="w-36">{t('production.adminReviewStatus')}</TableHead>}
              <TableHead className="text-right pr-6 w-36">{t('production.colBatchActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell className="w-40">
                    <Skeleton className="h-4 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-16" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-20" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-28" />
                  </TableCell>
                  {isGlobalAdmin && (
                    <TableCell className="w-32">
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                  )}
                  {user?.role === 'OWNER' && (
                    <TableCell className="w-36">
                      <Skeleton className="h-4 w-20" />
                    </TableCell>
                  )}
                  <TableCell className="text-right pr-6 w-36">
                    <Skeleton className="h-8 w-24 ml-auto rounded-xl" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isGlobalAdmin ? (user?.role === 'OWNER' ? 6 : 5) : 4} className="text-center py-8 text-[#8C7361] font-medium">
                  {filterTab === "UNSEEN"
                    ? "All batches have been reviewed by you! 🎉"
                    : filterTab === "FLAGGED"
                    ? "No batches are flagged for questions."
                    : t('production.noBatches')}
                </TableCell>
              </TableRow>
            ) : filteredBatches.map(batch => {
              const batchDateYmd = (batch.date || batch.createdAt || "").slice(0, 10);
              const isToday = batchDateYmd === todayYmd;
              const canEditBatch = isGlobalAdmin || ((user?.id === batch.user?.id || user?.id === batch.userId) && isToday);

              return (
              <TableRow
                key={batch.id}
                onClick={() => router.push(`/production/${batch.id}`)}
                className={`hover:bg-[#FAF8F5]/80 transition-colors cursor-pointer ${
                  isGlobalAdmin && !isBatchSeenByMe(batch)
                    ? "bg-sky-50/40"
                    : batch.isFlagged
                    ? "bg-rose-50/30"
                    : ""
                }`}
              >
                <TableCell>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[#2C1B10]">{formatEthDate(batch.date)}</span>
                    {((batch.date || batch.createdAt || "").slice(0, 10) === todayYmd) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        {t('common.today') || "Today"}
                      </span>
                    )}
                    {((batch.date || batch.createdAt || "").slice(0, 10) === yesterdayYmd) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 shadow-2xs">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                        {t('common.yesterday') || "Yesterday"}
                      </span>
                    )}
                    {batch.isEdited && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                        ✏️ {t('production.edited') || "Edited"}
                      </span>
                    )}
                    {isGlobalAdmin && !isBatchSeenByMe(batch) && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-sky-100 text-sky-800 border border-sky-300">
                        🔵 {t('production.unseenForMe')}
                      </span>
                    )}
                    {batch.isFlagged && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                        <span>🚩</span>
                        <span>{t('production.flagged') || 'Flagged'}</span>
                        {batch.flagReason && (
                          <button
                            type="button"
                            onClick={(e) => toggleExpandFlagNote(batch.id, e)}
                            className="text-rose-700 hover:text-rose-900 underline font-black ml-0.5 cursor-pointer text-[10px]"
                            title={expandedFlagNotes[batch.id] ? (t('production.hideNote') || 'Hide note') : (t('production.viewNote') || 'View note')}
                          >
                            {expandedFlagNotes[batch.id] ? (t('production.hideNote') || '▲') : '...'}
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <div className="text-xs font-semibold text-[#8C7361] mt-0.5">{batch.shift === "NIGHT" ? t('production.nightShiftFull') : t('production.dayShiftFull')}</div>
                  {batch.isFlagged && batch.flagReason && expandedFlagNotes[batch.id] && (
                    <div className="mt-1.5 text-xs font-medium text-rose-900 bg-rose-50/90 p-2 rounded-lg border border-rose-200 max-w-xs shadow-xs animate-in fade-in duration-150">
                      <div className="text-[10px] uppercase tracking-wider font-bold text-rose-600 mb-0.5">Note:</div>
                      {batch.flagReason}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {batch.items.length === 0 ? (
                    <span className="text-zinc-400 italic text-xs">No products</span>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="font-bold text-[#2C1B10] text-sm">
                        {batch.items[0].product.name}
                        <span className="font-extrabold text-[#E87A18]">
                          : {batch.items[0].quantityProduced} {batch.items[0].product.unitType}
                        </span>
                      </div>
                      {batch.items.length > 1 && (
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/production/${batch.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#4A2E1B] border border-[#EDE4D5] hover:border-[#4A2E1B]/30 transition-all cursor-pointer group shadow-2xs"
                            title="View all products in batch"
                          >
                            <span className="text-[#E87A18] font-black">+{batch.items.length - 1}</span>
                            <span className="font-semibold text-[#8C7361] group-hover:text-[#4A2E1B]">
                              {t('production.moreProductsBadge')}
                            </span>
                            <ChevronRight className="w-3 h-3 text-[#8C7361] group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {batch.materialUsages.length === 0 ? (
                    <span className="text-zinc-400 italic text-xs">{t('production.noMaterialsDeducted')}</span>
                  ) : (
                    <div className="space-y-1.5">
                      <div className="text-sm font-medium text-[#2C1B10]">
                        {batch.materialUsages[0].stockItem.name}: <span className="font-bold text-rose-700">-{Number(batch.materialUsages[0].quantityUsed).toFixed(2)} {batch.materialUsages[0].stockItem.unitType}</span>
                      </div>
                      {batch.materialUsages.length > 1 && (
                        <div>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/production/${batch.id}`);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 hover:border-rose-300 transition-all cursor-pointer group shadow-2xs"
                            title="View all raw materials in batch"
                          >
                            <span className="text-rose-600 font-black">+{batch.materialUsages.length - 1}</span>
                            <span className="font-semibold text-rose-700">
                              {t('production.moreMaterialsBadge')}
                            </span>
                            <ChevronRight className="w-3 h-3 text-rose-500 group-hover:translate-x-0.5 transition-transform" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
                {isGlobalAdmin && (
                  <TableCell className="w-32">
                    <span className="text-xs font-bold text-[#2C1B10] block">{batch.user.fullName}</span>
                  </TableCell>
                )}
                {user?.role === 'OWNER' && (
                  <TableCell className="w-36">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                      batch.adminSeenAt
                        ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                        : "bg-amber-50 text-amber-800 border-amber-200"
                    }`}>
                      {batch.adminSeenAt ? `✓ ${t('production.adminChecked') || 'Admin: Checked'}` : `⏳ ${t('production.adminUnchecked') || 'Admin: Unchecked'}`}
                    </span>
                  </TableCell>
                )}
                <TableCell className="text-right pr-6 w-36 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-end gap-1.5">
                    {isGlobalAdmin && !isBatchSeenByMe(batch) && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={markingSeenId === batch.id}
                        onClick={(e) => handleMarkSeen(batch.id, e)}
                        className="border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 font-bold text-xs h-8 px-2 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer"
                        title={t('production.markAsSeen')}
                      >
                        <Check className="w-3.5 h-3.5 text-sky-600" />
                        <span>{t('production.markAsSeen')}</span>
                      </Button>
                    )}

                    {isGlobalAdmin && (!isBatchSeenByMe(batch) || batch.isFlagged) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleToggleFlag(batch, e)}
                        className={`font-bold text-xs h-8 px-2 rounded-xl shadow-2xs flex items-center gap-1 cursor-pointer ${
                          batch.isFlagged
                            ? "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                            : "border-zinc-200 text-[#8C7361] hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200"
                        }`}
                        title={batch.isFlagged ? t('production.clearFlag') : t('production.flagBatch')}
                      >
                        <span className="text-xs">🚩</span>
                        <span>{batch.isFlagged ? (t('production.clearFlag') || 'Resolve') : (t('production.flagBatch') || 'Flag')}</span>
                      </Button>
                    )}

                    {canEditBatch && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/production/new?edit=${batch.id}`);
                        }}
                        className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1 shadow-2xs shrink-0 cursor-pointer"
                        title={t('common.edit') || "Edit"}
                      >
                        <Edit className="w-3.5 h-3.5 text-[#8C7361]" />
                        <span>{t('common.edit') || "Edit"}</span>
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Show More Pagination Button */}
      {pageData?.hasMore && (
        <div className="flex justify-center pt-5 pb-3">
          <Button
            type="button"
            variant="outline"
            disabled={isFetching}
            loading={isFetching && page > 1}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-2xl border border-[#EDE4D5] bg-white hover:bg-[#FAF6F0] text-[#4A2E1B] font-extrabold text-sm px-8 py-2.5 shadow-sm hover:shadow cursor-pointer transition-all flex items-center gap-2"
          >
            <span>{t('common.showMore') || "Show More"}</span>
          </Button>
        </div>
      )}

      {/* CREATE BATCH DIALOG */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                Log Production & Material Usage
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-2">
              {!isGlobalAdmin && (
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Your report will be sent to Admin/Owner for stock approval before inventory is deducted.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Production Date {isGlobalAdmin ? "" : "(System Logged)"}
                  </label>
                  <Input
                    type="date"
                    required
                    disabled={!isGlobalAdmin}
                    value={isGlobalAdmin ? date : format(new Date(), "yyyy-MM-dd")}
                    onChange={(e) => setDate(e.target.value)}
                    className="rounded-xl border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-600 disabled:cursor-not-allowed"
                  />
                  {!isGlobalAdmin && (
                    <span className="text-[10px] text-zinc-500 mt-0.5 block font-medium">
                      🔒 Logged automatically on current date
                    </span>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Shift</label>
                  <select
                    value={shift} onChange={(e) => setShift(e.target.value as any)}
                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                  >
                    <option value="DAY">Day Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTS PRODUCED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Products Baked <span className="text-red-500">*</span></label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setItems([...items, { productId: "", quantityProduced: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Product
                  </Button>
                </div>
                {items.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">No products added yet. Click 'Add Product'.</div>}
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].productId = e.target.value;
                          setItems(newItems);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Input
                        type="number" required placeholder="Qty" min="1"
                        value={item.quantityProduced}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantityProduced = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-24 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newItems = [...items];
                        newItems.splice(index, 1);
                        setItems(newItems);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAW MATERIALS USED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Raw Materials Consumed</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setMaterials([...materials, { stockItemId: "", quantityUsed: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Material
                  </Button>
                </div>
                {materials.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">Log ingredients used so stock levels can be updated upon approval.</div>}
                <div className="space-y-2">
                  {materials.map((mat, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={mat.stockItemId}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].stockItemId = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Material</option>
                        {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unitType})</option>)}
                      </select>
                      <Input
                        type="number" step="0.001" required placeholder="Qty" min="0.001"
                        value={mat.quantityUsed}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].quantityUsed = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="w-32 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newMats = [...materials];
                        newMats.splice(index, 1);
                        setMaterials(newMats);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" loading={isSubmitting} loadingText="Submitting...">
                  {isGlobalAdmin ? "Submit & Approve" : "Submit for Approval"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* FLAG CLARIFICATION DIALOG */}
      <Dialog open={!!flaggingBatch} onOpenChange={(open) => !open && setFlaggingBatch(null)}>
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
                Clarification Reason / Question
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
              onClick={() => setFlaggingBatch(null)}
              className="rounded-xl border-[#EDE4D5] font-bold text-xs"
            >
              {t('common.cancel') || "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmFlag}
              disabled={isFlagSubmitting}
              className="bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs"
            >
              <Flag className="w-3.5 h-3.5 mr-1" />
              {t('production.flagSubmitBtn')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}