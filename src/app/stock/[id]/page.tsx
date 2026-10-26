"use client";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useBranch } from "@/context/BranchContext";
import { PaginationControls } from "@/components/ui/PaginationControls";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  AlertCircle, 
  MinusCircle, 
  PlusCircle, 
  Edit3, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  UserCheck, 
  Building2, 
  Package, 
  Layers,
  Calendar,
  X,
  Loader2,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSkeleton, KpiCardsSkeleton, TableSkeleton } from "@/components/ui/skeletons";

interface Branch {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unitType: "PIECE" | "KG" | "LITER";
  currentQuantity: number;
  unitPrice?: number;
  minStockLevel?: number;
  branchId: string;
  branch?: Branch;
}

interface StockPurchasePayment {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  note?: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
  };
}

interface StockPurchaseLoan {
  id: string;
  stockMovementId: string;
  stockItemId: string;
  branchId: string;
  supplierName?: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
  updatedAt: string;
  payments?: StockPurchasePayment[];
}

interface StockMovement {
  id: string;
  stockItemId: string;
  userId: string;
  quantity: number | string;
  unitPrice?: number;
  totalValue?: number;
  type: "IN" | "OUT" | "ADJUSTMENT" | "PRODUCTION_USAGE";
  reason?: string;
  receivedBy?: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
  purchaseLoan?: StockPurchaseLoan;
}

interface HistoryData {
  stockItem: StockItem;
  movements: StockMovement[];
  totalIn: number;
  totalOut: number;
  totalValueIn?: number;
  totalValueOut?: number;
  currentValuation?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export default function StockItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;
  const queryClient = useQueryClient();
  const { t } = useLanguage();
  const { selectedBranchId } = useBranch();

  const { user } = useAuth();
  const isOwner = user?.role === "OWNER";
  const isGlobalAdmin = user?.role === "ADMIN" || isOwner;
  const isStockKeeper = user?.role === "STOCK_KEEPER";
  const isStockStaff = isGlobalAdmin || isStockKeeper;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const { data, isLoading, isFetching } = useQuery<HistoryData>({
    queryKey: ['stock-item-history', itemId, currentPage, pageSize, filterType, dateFilter],
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));
      if (filterType !== "ALL") params.append('type', filterType);
      if (dateFilter) params.append('date', dateFilter);
      const res = await api.get(`/stock-items/${itemId}/history?${params.toString()}`);
      return res.data;
    },
    enabled: !!itemId,
  });

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterType, dateFilter]);

  // Tab auto-centering ref like in profile page
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = tabRefs.current[filterType];
      if (btn) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [filterType]);

  // Modals inside detail page
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addUnitPrice, setAddUnitPrice] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");

  // Add stock loan state
  const [isAddLoan, setIsAddLoan] = useState<boolean>(false);
  const [addPaidAmount, setAddPaidAmount] = useState<string>("");
  const [addSupplierName, setAddSupplierName] = useState<string>("");

  // Repayment Modal state
  const [selectedLoan, setSelectedLoan] = useState<StockPurchaseLoan | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);

  const [isReduceOpen, setIsReduceOpen] = useState(false);
  const [reduceAmount, setReduceAmount] = useState<string>("");
  const [reduceReason, setReduceReason] = useState<string>("");
  const [reduceReceivedBy, setReduceReceivedBy] = useState<string>("");

  const { data: dbUsers = [], isLoading: isUsersLoading } = useQuery<{
    id: string;
    fullName: string;
    role: string;
    branchId: string | null;
    isActive: boolean;
    branch?: { name: string } | null;
  }[]>({
    queryKey: ['staff-users', data?.stockItem?.branchId || selectedBranchId],
    queryFn: async () => {
      const bId = data?.stockItem?.branchId || selectedBranchId;
      const res = await api.get('/users', {
        params: bId ? { branchId: bId } : {},
      });
      return res.data || [];
    },
    enabled: isStockStaff,
  });

  const [isEditOpen, setIsEditOpen] = useState(false);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGlobalAdmin) {
      toast.error("Access Restricted: Only Admin and Owner can add stock");
      return;
    }
    if (!data?.stockItem) return;

    const qty = parseFloat(addAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t("stock.toastAddPositiveQty"));
      return;
    }

    const parsedUnitPrice = addUnitPrice !== "" ? parseFloat(addUnitPrice) : undefined;
    if (parsedUnitPrice !== undefined && (isNaN(parsedUnitPrice) || parsedUnitPrice < 0)) {
      toast.error(t("stock.toastPositiveUnitPrice"));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${itemId}/add`, {
        quantity: qty,
        unitPrice: parsedUnitPrice,
        reason: addReason.trim() || "Manual Stock Addition",
        loanInfo: isAddLoan ? {
          isLoan: true,
          paidAmount: addPaidAmount !== "" ? Number(addPaidAmount) : 0,
          supplierName: addSupplierName.trim() || undefined,
        } : undefined,
      });
      toast.success(t("stock.toastAddStockSuccess", { qty, unit: data.stockItem.unitType, name: data.stockItem.name }));
      setIsAddOpen(false);
      setAddAmount("");
      setAddUnitPrice("");
      setAddReason("");
      setIsAddLoan(false);
      setAddPaidAmount("");
      setAddSupplierName("");
      queryClient.invalidateQueries({ queryKey: ['stock-item-history', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error(t("stock.toastPaymentPositiveAmt"));
      return;
    }

    setIsPaying(true);
    try {
      await api.post(`/stock-movements/loans/${selectedLoan.id}/pay`, {
        amount: amt,
        note: payNote.trim() || undefined,
      });
      toast.success(t("stock.toastLoanPaymentSuccess"));
      setSelectedLoan(null);
      setPayAmount("");
      setPayNote("");
      queryClient.invalidateQueries({ queryKey: ['stock-item-history', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-loans'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record loan payment");
    } finally {
      setIsPaying(false);
    }
  };

  const handleReduceStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.stockItem) return;

    if (!reduceReceivedBy.trim()) {
      toast.error("Please choose the staff member who took this stock item");
      return;
    }

    const qty = parseFloat(reduceAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t("stock.toastAddPositiveQty"));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${itemId}/reduce`, {
        quantity: qty,
        reason: reduceReason.trim() || "Manual Stock Reduction",
        receivedBy: reduceReceivedBy.trim(),
      });
      toast.success(t("stock.toastReduceStockSuccess", { qty, unit: data.stockItem.unitType, name: data.stockItem.name }));
      setIsReduceOpen(false);
      setReduceAmount("");
      setReduceReason("");
      setReduceReceivedBy("");
      queryClient.invalidateQueries({ queryKey: ['stock-item-history', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reduce stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data?.stockItem) return;
    if (!isOwner) {
      toast.error("Access Restricted: Only Owner can edit stock items");
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const updatePayload = {
      name: formData.get("name"),
      unitType: formData.get("unitType"),
      currentQuantity: Number(formData.get("currentQuantity")),
      unitPrice: formData.get("unitPrice") ? Number(formData.get("unitPrice")) : 0,
      minStockLevel: formData.get("minStockLevel") ? Number(formData.get("minStockLevel")) : undefined,
    };

    try {
      await api.patch(`/stock-items/${itemId}`, updatePayload);
      toast.success("Stock item updated");
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ['stock-item-history', itemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error updating stock item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const paginatedMovements = data?.movements || [];
  const totalPages = data?.totalPages || 1;
  const totalMovements = data?.total || paginatedMovements.length;

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "IN":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800"><ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> {t("stock.stockInBadge")}</span>;
      case "OUT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800"><ArrowUpRight className="w-3.5 h-3.5 text-red-600" /> {t("stock.stockOutBadge")}</span>;
      case "PRODUCTION_USAGE":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800"><RefreshCw className="w-3.5 h-3.5 text-purple-600" /> {t("stock.tabFilterProduction")}</span>;
      case "ADJUSTMENT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">{t("stock.tabFilterAdjustment")}</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800">{type}</span>;
    }
  };

  if (isLoading && !data) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <div className="flex items-center gap-2">
            <Skeleton className="h-4 w-32" />
          </div>
          <DetailSkeleton />
          <KpiCardsSkeleton count={5} />
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs">
            <div className="flex justify-between items-center mb-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-8 w-64 rounded-xl" />
            </div>
            <TableSkeleton rows={6} columns={7} hasActions={false} />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!data || !data.stockItem) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-zinc-500">
          <p className="text-lg font-bold">{t("stock.stockItemNotFound")}</p>
          <Link href="/stock" className="text-amber-600 underline text-sm mt-2 inline-block">{t("stock.returnToStock")}</Link>
        </div>
      </DashboardLayout>
    );
  }

  const { stockItem, totalIn, totalOut, totalValueIn, totalValueOut, currentValuation } = data;
  const isLowStock = stockItem.minStockLevel != null && Number(stockItem.currentQuantity) <= Number(stockItem.minStockLevel);
  const unitPrice = Number(stockItem.unitPrice || 0);
  const calculatedValuation = currentValuation ?? (Number(stockItem.currentQuantity) * unitPrice);

  return (
    <DashboardLayout>
      {/* Top Header & Action Bar */}
      <div className="mb-6 space-y-4">
        {/* Navigation row with Back & Actions */}
        <div className="flex items-center justify-between gap-2.5 pb-3 border-b border-[#EDE4D5]">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <Link href="/stock" className="inline-flex items-center gap-2 group">
              <Button
                variant="outline"
                size="icon"
                className="border-[#EDE4D5] bg-white text-[#4A2E1B] group-hover:bg-[#FAF6F0] rounded-xl font-extrabold h-9 w-9 shadow-2xs shrink-0 cursor-pointer"
                title={t("stock.backToStockInventory")}
              >
                <ArrowLeft className="w-4 h-4 text-[#E87A18]" />
              </Button>
              <span className="hidden xs:inline sm:hidden text-xs font-bold text-[#8C7361] group-hover:text-[#2C1B10]">
                {t('common.back') || 'Back'}
              </span>
            </Link>
            <div className="h-5 w-px bg-[#EDE4D5] hidden sm:block shrink-0" />
            <div className="hidden sm:block min-w-0">
              <div className="flex items-center gap-1.5 text-xs text-[#8C7361] font-semibold truncate">
                <Link href="/stock" className="hover:text-[#4A2E1B] transition-colors">{t("stock.title")}</Link>
                <span>/</span>
                <span className="text-[#2C1B10] font-bold truncate">{stockItem.name}</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          {isStockStaff && (
            <div className="flex items-center gap-2 shrink-0">
              <Button 
                onClick={() => setIsReduceOpen(true)}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 h-9 sm:h-10 px-3 sm:px-4 shadow-sm active:scale-98 transition-all shrink-0"
              >
                <MinusCircle className="w-4 h-4 shrink-0" />
                <span>{t("stock.btnReduceStockBtn")}</span>
              </Button>
              {isGlobalAdmin && (
                <Button 
                  onClick={() => {
                    setIsAddOpen(true);
                    setAddAmount("");
                    setAddUnitPrice(unitPrice ? String(unitPrice) : "");
                    setAddReason("");
                    setIsAddLoan(false);
                    setAddPaidAmount("");
                    setAddSupplierName("");
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 shadow-sm h-9 sm:h-10 px-3 sm:px-4 active:scale-98 transition-all shrink-0"
                >
                  <PlusCircle className="w-4 h-4 shrink-0" />
                  <span className="truncate hidden xs:inline">{t("stock.btnAddStockBtn")}</span>
                </Button>
              )}
              {isOwner && (
                <Button 
                  onClick={() => setIsEditOpen(true)}
                  variant="outline"
                  className="text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs sm:text-sm flex items-center justify-center gap-1.5 h-9 sm:h-10 px-2.5 sm:px-3 shadow-2xs shrink-0"
                  title={t("stock.btnEditStockBtn")}
                >
                  <Edit3 className="w-4 h-4 shrink-0 text-[#8C7361]" />
                  <span className="truncate hidden sm:inline">{t("stock.btnEditStockBtn")}</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Hero Item Details Card */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-center text-[#E87A18] shrink-0 shadow-2xs">
              <Package className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-[#2C1B10] tracking-tight truncate">
                  {stockItem.name}
                </h1>
                {isLowStock ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs">
                    <AlertCircle className="w-3.5 h-3.5 text-rose-600" /> {t("stock.stockLow")}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    {t("stock.stockOptimalBadge")}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C7361] mt-2 font-medium">
                <span className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#EDE4D5]/80">
                  <Package className="w-3.5 h-3.5 text-[#8C7361]" /> {t("stock.unitTag", { unit: stockItem.unitType })}
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#EDE4D5]/80">
                  <Layers className="w-3.5 h-3.5 text-[#8C7361]" /> {t("stock.minAlertTag", { level: stockItem.minStockLevel != null ? Number(stockItem.minStockLevel).toFixed(2) : t("stock.noneLabel") })}
                </span>
                {!isStockKeeper && (
                  <span className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#EDE4D5]/80">
                    <Building2 className="w-3.5 h-3.5 text-[#8C7361]" /> {t("stock.branchTag", { branch: stockItem.branch?.name || t("stock.globalBranch") })}
                  </span>
                )}
                {isOwner && (
                  <span className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-2.5 py-1 rounded-lg border border-[#EDE4D5]/80">
                    <span>💵 {t("stock.unitPriceTag", { price: unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Dedicated Mobile Current Stock Card (Clean & styled like the header card) */}
        <div className="sm:hidden bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-2xs ${
              isLowStock 
                ? 'bg-rose-50 border border-rose-200 text-rose-600' 
                : 'bg-emerald-50 border border-emerald-200 text-emerald-600'
            }`}>
              <Package className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider block">
                {t("stock.kpiCurrentQty")}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className={`text-2xl font-black font-mono tracking-tight ${
                  isLowStock ? 'text-rose-600' : 'text-emerald-700'
                }`}>
                  {Number(stockItem.currentQuantity).toFixed(2)}
                </span>
                <span className="text-xs font-extrabold text-[#8C7361]">
                  {stockItem.unitType}
                </span>
              </div>
            </div>
          </div>

          <div className="text-right shrink-0">
            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
              isLowStock 
                ? 'bg-rose-50 text-rose-700 border-rose-200' 
                : 'bg-emerald-50 text-emerald-800 border-emerald-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`} />
              {isLowStock ? t("stock.lowStockWarningBadge") : t("stock.stockInShop")}
            </span>
          </div>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className={`hidden sm:grid grid-cols-2 ${isOwner ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-2.5 sm:gap-3.5 mb-6`}>
        {/* Card 1: Current Stock Qty */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider block">{t("stock.kpiCurrentQty")}</span>
          <div className="mt-1">
            <span className={`text-xl sm:text-2xl font-black font-mono block ${isLowStock ? 'text-rose-600' : 'text-emerald-700'}`}>
              {Number(stockItem.currentQuantity).toFixed(2)}
            </span>
            <span className="text-[11px] font-semibold text-[#8C7361]">{t("stock.inInventoryUnit", { unit: stockItem.unitType })}</span>
          </div>
        </div>

        {/* Card 2: Stock Monetary Valuation (Owner only) */}
        {isOwner && (
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
            <span className="text-[11px] sm:text-xs font-bold text-amber-800 uppercase tracking-wider block">{t("stock.kpiStockValuation")}</span>
            <div className="mt-1">
              <span className="text-lg sm:text-2xl font-black text-amber-900 font-mono block truncate">
                {calculatedValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-amber-700">{t("stock.assetValueLabel")}</span>
            </div>
          </div>
        )}

        {/* Card 3: Historical Inflow */}
        <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-bold text-emerald-800 uppercase tracking-wider block">{t("stock.kpiTotalInflow")}</span>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-emerald-700 font-mono block">
              +{Number(totalIn).toFixed(2)} <span className="text-xs font-semibold">{stockItem.unitType}</span>
            </span>
            {isOwner && totalValueIn != null && (
              <span className="text-[10px] sm:text-[11px] font-bold text-emerald-800 block truncate">
                +{totalValueIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </span>
            )}
          </div>
        </div>

        {/* Card 4: Historical Outflow */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <span className="text-[11px] sm:text-xs font-bold text-rose-800 uppercase tracking-wider block">{t("stock.kpiTotalOutflow")}</span>
          <div className="mt-1">
            <span className="text-lg sm:text-xl font-black text-rose-700 font-mono block">
              -{Number(totalOut).toFixed(2)} <span className="text-xs font-semibold">{stockItem.unitType}</span>
            </span>
            {isOwner && totalValueOut != null && (
              <span className="text-[10px] sm:text-[11px] font-bold text-rose-800 block truncate">
                -{totalValueOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </span>
            )}
          </div>
        </div>

        {/* Card 5: Audit Movements */}
        <div className={`${isOwner ? 'col-span-2 lg:col-span-1' : 'col-span-2 lg:col-span-1'} bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between`}>
          <span className="text-[11px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider block">{t("stock.kpiAuditMovements")}</span>
          <div className="mt-1">
            <span className="text-xl sm:text-2xl font-black text-[#2C1B10] font-mono block">
              {data.movements?.length ?? 0}
            </span>
            <span className="text-[11px] font-semibold text-[#8C7361]">{t("stock.totalLogEntries")}</span>
          </div>
        </div>
      </div>

      {/* Movement Audit Trail Section */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3.5 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div className="text-center sm:text-left">
            <h2 className="text-base sm:text-lg font-extrabold text-[#2C1B10] flex items-center justify-center sm:justify-start gap-2">
              <History className="w-5 h-5 text-[#E87A18]" />
              {t("stockMovements.title")}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Filter by Date with Quick Today & Clear */}
            <div className="flex items-center gap-1.5 bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
              {isFetching && !isLoading ? (
                <Loader2 className="w-3.5 h-3.5 text-[#E87A18] animate-spin shrink-0" />
              ) : (
                <Calendar className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
              )}
              <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider hidden sm:inline">{t('stockMovements.date')}:</span>
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="text-xs font-semibold text-[#2C1B10] bg-transparent outline-none cursor-pointer"
              />
              {dateFilter && (
                <button
                  type="button"
                  onClick={() => setDateFilter("")}
                  className="text-[#8C7361] hover:text-[#2C1B10] p-0.5 rounded-full hover:bg-white"
                  title="Clear date filter"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching && !isLoading}
              onClick={() => {
                const todayStr = new Date().toISOString().slice(0, 10);
                setDateFilter(dateFilter === todayStr ? "" : todayStr);
              }}
              className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                dateFilter === new Date().toISOString().slice(0, 10)
                  ? "bg-[#4A2E1B] text-white border-[#4A2E1B]"
                  : "border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE]"
              }`}
            >
              {isFetching && !isLoading && dateFilter === new Date().toISOString().slice(0, 10) && (
                <Loader2 className="w-3 h-3 animate-spin shrink-0" />
              )}
              <span>{t('stockMovements.today')}</span>
            </Button>

            {dateFilter && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isFetching && !isLoading}
                onClick={() => setDateFilter("")}
                className="h-8 px-2 text-xs text-[#8C7361] hover:text-[#2C1B10]"
              >
                {t('stockMovements.showAllDates')}
              </Button>
            )}

            {/* Exactly 3 Tabs: ALL, IN, OUT */}
            <div className="relative overflow-hidden">
              <div 
                className="bg-[#FAF7EE] p-1.5 rounded-2xl border border-[#EDE4D5] flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
              >
                {[
                  { id: "ALL", label: t("stock.tabFilterAll"), count: (data.movements || []).filter(m => (m.type === 'IN' || m.type === 'OUT') && (!dateFilter || new Date(m.createdAt).toISOString().slice(0, 10) === dateFilter)).length },
                  { id: "IN", label: t("stock.tabFilterIn"), count: (data.movements || []).filter(m => m.type === 'IN' && (!dateFilter || new Date(m.createdAt).toISOString().slice(0, 10) === dateFilter)).length },
                  { id: "OUT", label: t("stock.tabFilterOut"), count: (data.movements || []).filter(m => m.type === 'OUT' && (!dateFilter || new Date(m.createdAt).toISOString().slice(0, 10) === dateFilter)).length },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    ref={(el) => { tabRefs.current[tab.id] = el; }}
                    type="button"
                    onClick={() => setFilterType(tab.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none ${
                      filterType === tab.id
                        ? "bg-[#4A2E1B] text-white shadow-sm ring-2 ring-[#4A2E1B]/20"
                        : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60"
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono font-bold ${
                      filterType === tab.id ? "bg-white/20 text-white" : "bg-[#4A2E1B]/10 text-[#4A2E1B]"
                    }`}>
                      {tab.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Loading Indicator for Day / Filter Refetching */}
        {isFetching && !isLoading && (
          <div className="flex items-center justify-center gap-2 py-2 px-3 text-xs font-bold text-[#E87A18] bg-amber-50/70 rounded-xl border border-amber-200/60 mb-3 animate-in fade-in duration-150 shadow-2xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E87A18]" />
            <span>{t('common.loading')}...</span>
          </div>
        )}

        {/* Desktop Audit Trail Table */}
        <div className={`hidden sm:block border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs transition-opacity duration-200 ${isFetching && !isLoading ? "opacity-60" : "opacity-100"}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("stockMovements.colDateTime")}</TableHead>
                <TableHead>{t("stockMovements.colMovementType")}</TableHead>
                {isGlobalAdmin && <TableHead>{t("stock.stockLoansAndCredit")}</TableHead>}
                <TableHead>{t("stockMovements.colQtyDelta")}</TableHead>
                {isOwner && <TableHead>{t("stockMovements.colMonetaryDelta")}</TableHead>}
                <TableHead>{t("stockMovements.colReceivedBy")}</TableHead>
                <TableHead>{t("stockMovements.colRecordedBy")}</TableHead>
                <TableHead className="pr-6">{t("stockMovements.colReason")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5 + (isGlobalAdmin ? 1 : 0) + (isOwner ? 1 : 0)} className="text-center py-8 text-[#8C7361] font-medium">
                    {t("stockMovements.noMovements")}
                  </TableCell>
                </TableRow>
              ) : (
                paginatedMovements.map((m) => {
                  const mPrice = Number(m.unitPrice ?? unitPrice);
                  const mTotalValue = Number(m.totalValue ?? (Number(m.quantity) * mPrice));
                  const isNegative = m.type === "OUT";
                  const loan = m.purchaseLoan;

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-xs text-[#8C7361] whitespace-nowrap">
                        {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                      </TableCell>
                      <TableCell>
                        {getMovementBadge(m.type)}
                      </TableCell>
                      {isGlobalAdmin && (
                        <TableCell>
                          {loan ? (
                            <div className="space-y-1">
                              <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                                loan.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                                loan.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                                'bg-rose-100 text-rose-800 border border-rose-200'
                              }`}>
                                {loan.status === 'PAID' ? t("stockMovements.statusSettled") : loan.status === 'PARTIAL' ? t("stockMovements.statusPartial") : t("stockMovements.statusUnpaid")}
                              </span>
                              <div className="text-[10px] text-[#8C7361]">
                                {t('stockMovements.due')}: <strong className="text-[#2C1B10]">{Number(loan.remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                                {loan.supplierName && <div>{t('stockMovements.supplier')}: {loan.supplierName}</div>}
                              </div>
                              <button 
                                onClick={() => setSelectedLoan(loan)}
                                className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline block"
                              >
                                {loan.remainingBalance > 0 ? t("stock.btnSubmitPayment") : t("common.history")}
                              </button>
                            </div>
                          ) : (
                            <span className="text-xs text-zinc-400 font-medium">—</span>
                          )}
                        </TableCell>
                      )}
                      <TableCell className="font-bold text-sm">
                        <span className={m.type === "IN" ? "text-emerald-700" : "text-rose-700"}>
                          {m.type === "IN" ? "+" : "-"}{Number(m.quantity).toFixed(2)}
                        </span>{" "}
                        <span className="text-xs text-[#8C7361] font-normal">{stockItem.unitType}</span>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="font-extrabold text-xs">
                          <span className={isNegative ? "text-rose-700" : "text-emerald-700"}>
                            {isNegative ? "-" : "+"}{mTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </span>
                          {mPrice > 0 && (
                            <div className="text-[10px] text-[#8C7361] font-normal">
                              @ {mPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{stockItem.unitType}
                            </div>
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {m.receivedBy ? (
                          <div className="flex items-center gap-1.5">
                            <UserCheck className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                            <span className="font-bold text-xs text-[#2C1B10]">{m.receivedBy}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-[#8C7361] font-medium">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span className="font-bold text-xs text-[#2C1B10]">{m.user?.fullName || "System"}</span>
                          <span className="text-[10px] text-[#8C7361] font-bold">({m.user?.role || "SYSTEM"})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[#8C7361] font-medium pr-6">
                        {m.reason || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Audit History Cards */}
        <div className={`grid grid-cols-1 gap-3 sm:hidden transition-opacity duration-200 ${isFetching && !isLoading ? "opacity-60" : "opacity-100"}`}>
          {paginatedMovements.length === 0 ? (
            <div className="bg-[#FAF6F0] p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
              {t("stockMovements.noMovements")}
            </div>
          ) : (
            paginatedMovements.map((m) => {
              const mPrice = Number(m.unitPrice ?? unitPrice);
              const mTotalValue = Number(m.totalValue ?? (Number(m.quantity) * mPrice));
              const isNegative = m.type === "OUT";
              const loan = m.purchaseLoan;

              return (
                <div key={m.id} className="bg-white rounded-2xl p-3.5 border border-[#EDE4D5] shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {getMovementBadge(m.type)}
                        {isGlobalAdmin && loan && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            loan.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            loan.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {loan.status === 'PAID' ? t("stockMovements.statusSettled") : loan.status === 'PARTIAL' ? t("stockMovements.statusPartial") : t("stockMovements.statusUnpaid")}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-semibold text-[#8C7361] block">
                        {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                      </span>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`text-base font-black font-mono ${m.type === "IN" ? "text-emerald-700" : "text-rose-700"}`}>
                        {m.type === "IN" ? "+" : "-"}{Number(m.quantity).toFixed(2)} <span className="text-xs font-semibold">{stockItem.unitType}</span>
                      </div>
                      {isOwner && (
                        <div className={`text-[11px] font-bold font-mono ${isNegative ? "text-rose-700" : "text-emerald-700"}`}>
                          {isNegative ? "-" : "+"}{mTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </div>
                      )}
                    </div>
                  </div>

                  {isGlobalAdmin && loan && (
                    <div className="p-2.5 bg-purple-50/80 rounded-xl border border-purple-100 text-xs flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-purple-950 font-bold text-[11px] truncate">
                          {t('stockMovements.supplier')}: {loan.supplierName || "—"}
                        </div>
                        <div className="text-[#8C7361] text-[10px]">
                          {t('stockMovements.paid')}: {Number(loan.paidAmount).toFixed(2)} | {t('stockMovements.due')}: <strong className="text-purple-900">{Number(loan.remainingBalance).toFixed(2)} ETB</strong>
                        </div>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedLoan(loan)}
                        className="h-7 px-2.5 text-[10px] font-bold text-purple-700 border-purple-300 hover:bg-purple-100 shrink-0"
                      >
                        {loan.remainingBalance > 0 ? t("stock.btnSubmitPayment") : t("common.history")}
                      </Button>
                    </div>
                  )}

                  {/* Recipient / Taken By Information */}
                  {m.receivedBy && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50/70 border border-amber-200/60 text-xs">
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] tracking-wider">{t('stockMovements.colReceivedBy')}:</span>
                      <strong className="text-amber-950 font-extrabold text-xs">{m.receivedBy}</strong>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-[#FAF6F0] text-[#8C7361]">
                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-[10px] text-[#8C7361]">{t('stockMovements.colRecordedBy')}:</span>
                      <UserCheck className="w-3.5 h-3.5 text-[#8C7361]" />
                      <span className="font-semibold text-[#2C1B10]">{m.user?.fullName || "System"}</span>
                    </div>
                    <span className="text-[11px] italic text-[#8C7361] truncate max-w-[150px]">{m.reason || "—"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination Controls */}
        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalMovements}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
          onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
          isLoading={isLoading}
          itemLabel={t("stockMovements.title") || "movements"}
          className="bg-white sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-[#EDE4D5]"
        />
      </div>

      {/* Manual Stock Addition Modal */}
      {isAddOpen && isGlobalAdmin && (
        <Dialog open={true} onOpenChange={(open) => { 
          if (!open) {
            setIsAddOpen(false);
            setIsAddLoan(false);
            setAddPaidAmount("");
            setAddSupplierName("");
          } 
        }}>
          <DialogContent className="max-w-md rounded-2xl border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                {t("stock.modalAddStockLevelTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStock}>
              <div className="grid gap-4 py-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900">
                  {stockItem.name} • {t("stock.currentAvailableQty")}: <span className="font-bold text-emerald-700">{Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}</span>{isOwner ? ` (${unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/${stockItem.unitType})` : ""}
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    {t("stock.amountToAddLabel", { unit: stockItem.unitType })} *
                  </label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    required 
                    min="0.001"
                    value={addAmount} 
                    onChange={(e) => setAddAmount(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    placeholder="e.g. 50.00" 
                    className="rounded-xl border-[#EDE4D5] h-10 font-mono" 
                  />
                </div>

                {isOwner && (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-[#2C1B10] uppercase">
                        {t("stock.unitPriceInputLabel")}
                      </label>
                      <span className="text-[11px] text-[#8C7361]">
                        {unitPrice.toFixed(2)} ETB
                      </span>
                    </div>
                    <Input 
                      type="number" 
                      step="0.01" 
                      min="0"
                      value={addUnitPrice} 
                      onChange={(e) => setAddUnitPrice(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder={unitPrice ? String(unitPrice) : "0.00"} 
                      className="rounded-xl border-[#EDE4D5] h-10 font-mono" 
                    />
                  </div>
                )}

                {(() => {
                  if (!isOwner) return null;
                  const qty = parseFloat(addAmount) || 0;
                  const rate = addUnitPrice !== "" ? (parseFloat(addUnitPrice) || 0) : unitPrice;
                  if (qty > 0 && rate > 0) {
                    return (
                      <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                        <span className="font-bold text-emerald-900">Total Purchase Cost:</span>
                        <span className="font-mono font-extrabold text-emerald-800 text-sm">
                          {(qty * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </span>
                      </div>
                    );
                  }
                  return null;
                })()}

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    {t("stock.stockMovementReasonLabel")}
                  </label>
                  <Input 
                    value={addReason} 
                    onChange={(e) => setAddReason(e.target.value)} 
                    placeholder="e.g. Local Purchase, Restock, Inventory Audit" 
                    className="rounded-xl border-[#EDE4D5] h-10" 
                  />
                </div>

                {isGlobalAdmin && (
                  <div className="p-3 bg-purple-50/80 rounded-xl border border-purple-100 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isAddLoan} 
                        onChange={(e) => setIsAddLoan(e.target.checked)} 
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-purple-900">{t("stock.creditLoanPurchasePrompt")}</span>
                    </label>

                    {isAddLoan && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t("stock.supplierNameOptionalLabel")}</label>
                          <Input 
                            value={addSupplierName} 
                            onChange={(e) => setAddSupplierName(e.target.value)} 
                            placeholder="e.g. Grain Market Supplier" 
                            className="bg-white rounded-xl border-purple-200 text-xs h-10" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t("stock.downPaymentAmountLabel")}</label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={addPaidAmount} 
                            onChange={(e) => setAddPaidAmount(e.target.value)} 
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00" 
                            className="bg-white rounded-xl border-purple-200 text-xs h-10 font-mono" 
                          />
                          <p className="text-[10px] text-purple-700 mt-1 font-medium">
                            {t("stock.unpaidDebtNotice")}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[#EDE4D5] w-full">
                <Button type="submit" variant="success" size="lg" loading={isSubmitting} loadingText={t("stock.savingRecord")} className="w-full sm:w-auto order-1 sm:order-2">
                  {t("stock.btnSubmitAddStock")}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setIsAddOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Loan Repayment & Audit Dialog */}
      {isGlobalAdmin && selectedLoan && (
        <Dialog open={true} onOpenChange={(open) => { 
          if (!open) {
            setSelectedLoan(null);
            setPayAmount("");
            setPayNote("");
          } 
        }}>
          <DialogContent className="max-w-lg rounded-2xl border-purple-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                {t("stock.modalRecordPaymentTitle")}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">{t("stockMovements.loansAndCredit")}</span>
                  <span className="font-extrabold text-purple-950">{selectedLoan.supplierName || "—"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">{t("stockMovements.kpiTotalCredit")}</span>
                  <span className="font-extrabold text-purple-950">{Number(selectedLoan.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">{t("stockMovements.kpiTotalPaid")}</span>
                  <span className="font-extrabold text-emerald-700">{Number(selectedLoan.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-200/60">
                  <span className="font-bold text-purple-900 uppercase">{t("stockMovements.kpiRemainingDebt")}</span>
                  <span className="text-base font-black text-rose-700">{Number(selectedLoan.remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
              </div>

              {selectedLoan.remainingBalance > 0 && (
                <form onSubmit={handleRecordPayment} className="space-y-3 p-3.5 bg-white border border-purple-200 rounded-2xl">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">{t("stock.btnSubmitPayment")}</h4>
                  
                  <div>
                    <label className="text-[11px] font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.paymentAmountLabel")} *</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      max={selectedLoan.remainingBalance} 
                      required 
                      value={payAmount} 
                      onChange={(e) => setPayAmount(e.target.value)} 
                      onFocus={(e) => e.target.select()}
                      placeholder={`Max: ${Number(selectedLoan.remainingBalance).toFixed(2)} ETB`} 
                      className="rounded-xl border-purple-200 text-xs h-10 font-mono" 
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.paymentNotesLabel")}</label>
                    <Input 
                      value={payNote} 
                      onChange={(e) => setPayNote(e.target.value)} 
                      placeholder="e.g. Bank Transfer, Cash Installment, Receipt #1029" 
                      className="rounded-xl border-purple-200 text-xs h-10" 
                    />
                  </div>

                  <Button type="submit" disabled={isPaying} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs h-10 shadow-sm">
                    {isPaying ? t("stock.recordingPayment") : t("stock.btnSubmitPayment")}
                  </Button>
                </form>
              )}

              {/* Repayment History Audit Trail */}
              <div>
                <h4 className="text-xs font-bold text-[#2C1B10] mb-2 uppercase tracking-wider">{t("stock.modalRecordPaymentTitle")}</h4>
                {selectedLoan.payments && selectedLoan.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedLoan.payments.map((p) => (
                      <div key={p.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#2C1B10]">
                            +{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </div>
                          <div className="text-[10px] text-[#8C7361]">
                            By {p.user?.fullName || "Staff"} · {format(new Date(p.createdAt), "MMM d, yyyy · h:mm a")}
                          </div>
                          {p.note && <div className="text-[10px] text-zinc-600 italic mt-0.5">{p.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8C7361] italic text-center py-3 bg-zinc-50 rounded-xl border border-zinc-200">{t("stockMovements.noMovements")}</p>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setSelectedLoan(null)} className="w-full rounded-xl border-[#EDE4D5] h-10">{t("common.close")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Reduction Modal */}
      {isReduceOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsReduceOpen(false); }}>
          <DialogContent className="bottom-0 top-auto translate-y-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 max-w-full sm:max-w-md w-full rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-4 sm:p-6 border border-amber-200/80 shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col gap-0 overflow-hidden bg-white">
            {/* Mobile visual drag handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <DialogHeader className="shrink-0 pb-3 border-b border-amber-100/70 pr-8">
              <DialogTitle className="text-base sm:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>{t("stock.modalReduceStockLevelTitle")}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleReduceStock} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain py-3.5 space-y-3.5 pr-1 -mr-1">
                {/* Item & Available info card */}
                <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/70 text-xs text-amber-950 flex flex-col xs:flex-row xs:items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[#8C7361] font-bold block text-[10px] uppercase tracking-wider">
                      {t('stock.itemToIssue')}
                    </span>
                    <strong className="font-extrabold text-sm text-[#2C1B10]">
                      {stockItem.name}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-amber-200 w-fit self-start xs:self-auto">
                    <span className="font-extrabold text-amber-800 text-xs sm:text-sm">
                      {Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}
                    </span>
                    {isOwner && unitPrice > 0 && (
                      <span className="text-[10px] text-[#8C7361] font-semibold border-l border-amber-200 pl-2">
                        @{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Input with 1-Tap Use Max Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#2C1B10] block uppercase tracking-wide">
                      {t("stock.amountToReduceLabel", { unit: stockItem.unitType })} *
                    </label>
                    <button
                      type="button"
                      onClick={() => setReduceAmount(String(stockItem.currentQuantity))}
                      className="text-[11px] font-extrabold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 active:scale-95"
                    >
                      {t('stock.useMax')} ({Number(stockItem.currentQuantity).toFixed(2)})
                    </button>
                  </div>
                  <div className="relative">
                    <Input 
                      type="number" 
                      step="0.001" 
                      required 
                      min="0.001"
                      max={Number(stockItem.currentQuantity)}
                      value={reduceAmount} 
                      onChange={(e) => setReduceAmount(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder={`Max: ${Number(stockItem.currentQuantity).toFixed(2)}`} 
                      className="h-11 rounded-xl border-zinc-200 font-mono text-base pr-16 bg-white focus:ring-2 focus:ring-[#E87A18]" 
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7361] pointer-events-none">
                      {stockItem.unitType}
                    </span>
                  </div>
                </div>

                {/* Taken By Dropdown */}
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase tracking-wide">
                    {t('stock.takenByLabel')} *
                  </label>
                  <select 
                    required
                    value={reduceReceivedBy} 
                    onChange={(e) => setReduceReceivedBy(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl h-11 px-3 bg-white text-sm sm:text-base focus:ring-2 focus:ring-[#E87A18] focus:border-[#E87A18] outline-none text-[#2C1B10]"
                  >
                    <option value="" disabled>
                      {isUsersLoading ? t('stock.loadingStaff') : t('stock.selectStaffMember')}
                    </option>
                    {dbUsers.filter(u => u.isActive !== false).map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.role?.replace('_', ' ')}{u.branch?.name ? ` • ${u.branch.name}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase tracking-wide">
                    {t("stock.stockMovementReasonLabel")}
                  </label>
                  <Input 
                    value={reduceReason} 
                    onChange={(e) => setReduceReason(e.target.value)} 
                    placeholder="e.g. Spoilage, Wastage, Audit Adjustment" 
                    className="h-11 rounded-xl border-zinc-200 text-sm sm:text-base bg-white focus:ring-2 focus:ring-[#E87A18]" 
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <DialogFooter className="shrink-0 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row gap-2 w-full mt-auto bg-white">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <MinusCircle className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? t('common.loading') : t("stock.btnSubmitReduceStock")}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsReduceOpen(false)}
                  className="w-full sm:w-auto h-11 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1 font-semibold text-[#8C7361]"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Item Definition Modal */}
      {isEditOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsEditOpen(false); }}>
          <DialogContent className="max-w-md rounded-2xl border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                {t("stock.modalEditStockLevelTitle")}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditItem}>
              <div className="grid gap-4 py-4">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.colItemName")}</label>
                  <Input name="name" required defaultValue={stockItem.name} className="rounded-xl border-[#EDE4D5] h-10" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t("production.unit")}</label>
                  <select name="unitType" required defaultValue={stockItem.unitType} className="w-full border border-[#EDE4D5] rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                    <option value="KG">Kg (Kilogram)</option>
                    <option value="PIECE">Piece</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                {isOwner && (
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.unitPriceLabel")}</label>
                    <Input name="unitPrice" type="number" step="0.01" min="0" defaultValue={stockItem.unitPrice ?? ""} onFocus={(e) => e.target.select()} placeholder="0.00" className="rounded-xl border-[#EDE4D5] h-10 font-mono" />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.currentAvailableQty")}</label>
                  <Input name="currentQuantity" type="number" step="0.001" required defaultValue={stockItem.currentQuantity} onFocus={(e) => e.target.select()} className="rounded-xl border-[#EDE4D5] h-10 font-mono" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t("stock.minThresholdAlert")}</label>
                  <Input name="minStockLevel" type="number" step="0.001" defaultValue={stockItem.minStockLevel ?? ""} onFocus={(e) => e.target.select()} placeholder="e.g. 10.00" className="rounded-xl border-[#EDE4D5] h-10 font-mono" />
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[#EDE4D5] w-full">
                <Button type="submit" size="lg" loading={isSubmitting} loadingText={t("stock.savingRecord")} className="w-full sm:w-auto order-1 sm:order-2">
                  {t("common.save")}
                </Button>
                <Button type="button" variant="outline" size="lg" onClick={() => setIsEditOpen(false)} className="w-full sm:w-auto order-2 sm:order-1">
                  {t("common.cancel")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
