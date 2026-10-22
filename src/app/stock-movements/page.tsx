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
import { formatEthDate } from "@/lib/ethiopianDate";
import { 
  CreditCard, Coins, CheckCircle2, AlertCircle, History, 
  Search, ArrowRightLeft, DollarSign, Package, Calendar, Clock, Receipt, UserCheck,
  MinusCircle, ShieldCheck, Check, X, ChevronLeft, ChevronRight, Loader2
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton, KpiCardsSkeleton } from "@/components/ui/skeletons";
import { PaginationControls } from "@/components/ui/PaginationControls";

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
  unitPrice?: number;
}

interface StockMovement {
  id: string;
  stockItemId: string;
  userId: string;
  quantity: number | string;
  unitPrice?: number;
  totalValue?: number;
  type: "IN" | "OUT" | "ADJUSTMENT" | "PRODUCTION_USAGE";
  status: "PENDING_CONFIRMATION" | "CONFIRMED" | "REJECTED";
  reason?: string;
  receivedBy?: string;
  confirmedAt?: string;
  confirmedById?: string;
  confirmedBy?: {
    id: string;
    fullName: string;
    role?: string;
  };
  createdAt: string;
  stockItem: {
    id: string;
    name: string;
    unitType: string;
    unitPrice?: number;
  };
  user: {
    id: string;
    fullName: string;
    role?: string;
  };
}

interface LoanPayment {
  id: string;
  loanId: string;
  userId: string;
  amount: number | string;
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
  totalAmount: number | string;
  paidAmount: number | string;
  remainingBalance: number | string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
  updatedAt: string;
  stockMovement?: {
    id: string;
    quantity: number | string;
    unitPrice?: number | string;
    totalValue?: number | string;
    reason?: string;
    stockItem?: {
      id: string;
      name: string;
      unitType: string;
    };
    user?: {
      id: string;
      fullName: string;
    };
  };
  payments?: LoanPayment[];
}

export default function StockMovementsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const isOwner = user?.role === "OWNER";
  const isGlobalAdmin = user?.role === "ADMIN" || isOwner;
  const isStockKeeper = user?.role === "STOCK_KEEPER";
  const isStockStaff = isGlobalAdmin || isStockKeeper;
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && !isStockStaff) {
      toast.error("Access Restricted: Stock movements are only available to Stock Keeper, Admin, and Owner roles.");
      router.replace("/my-profile");
    }
  }, [user, isStockStaff, router]);

  const [activeTab, setActiveTab] = useState<"movements" | "approvals" | "loans">("movements");

  // Tab auto-centering ref like in profile page
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = tabRefs.current[activeTab];
      if (btn) {
        btn.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Filter state for loans
  const [loanStatusFilter, setLoanStatusFilter] = useState<string>("ALL");
  const [loanSearch, setLoanSearch] = useState<string>("");

  const loanStatusTabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = loanStatusTabRefs.current[loanStatusFilter];
      if (btn) {
        btn.scrollIntoView({
          behavior: "smooth",
          inline: "center",
          block: "nearest",
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [loanStatusFilter]);

  // Payment Modal State
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<StockPurchaseLoan | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [isSubmittingPay, setIsSubmittingPay] = useState<boolean>(false);

  // History Log Modal State
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<StockPurchaseLoan | null>(null);

  // Movements ledger state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Loans ledger state
  const [loansPage, setLoansPage] = useState(1);
  const [loansPageSize, setLoansPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranchId, dateFilter, searchQuery]);

  useEffect(() => {
    setLoansPage(1);
  }, [selectedBranchId, loanStatusFilter, loanSearch]);

  const { data: movementsResponse, isLoading: isLoadingMovements } = useQuery<{
    data: StockMovement[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>({
    queryKey: ['stock-movements', selectedBranchId, currentPage, pageSize, dateFilter, searchQuery],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      params.append('page', String(currentPage));
      params.append('limit', String(pageSize));
      if (dateFilter) {
        params.append('from', dateFilter);
        params.append('to', dateFilter);
      }
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }
      const res = await api.get(`/stock-movements?${params.toString()}`);
      if (Array.isArray(res.data)) {
        return {
          data: res.data,
          total: res.data.length,
          page: 1,
          limit: pageSize,
          totalPages: 1,
        };
      }
      return res.data;
    },
  });

  const movements: StockMovement[] = movementsResponse?.data || [];
  const totalMovements: number = movementsResponse?.total || 0;
  const totalPages: number = movementsResponse?.totalPages || 1;
  const paginatedMovements = movements;

  useEffect(() => {
    if (!isGlobalAdmin && activeTab === "loans") {
      setActiveTab("movements");
    }
  }, [isGlobalAdmin, activeTab]);

  const { data: loansResponse, isLoading: isLoadingLoans } = useQuery<{
    data: StockPurchaseLoan[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: {
      totalCredit: number;
      totalPaid: number;
      totalRemaining: number;
      activeLoansCount: number;
    };
  }>({
    queryKey: ['stock-loans', selectedBranchId, loanStatusFilter, loansPage, loansPageSize, loanSearch],
    placeholderData: (prev) => prev,
    enabled: isGlobalAdmin,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      if (loanStatusFilter !== "ALL") params.append('status', loanStatusFilter);
      params.append('page', String(loansPage));
      params.append('limit', String(loansPageSize));
      if (loanSearch.trim()) params.append('search', loanSearch.trim());
      const res = await api.get(`/stock-movements/loans/list?${params.toString()}`);
      if (Array.isArray(res.data)) {
        return {
          data: res.data,
          total: res.data.length,
          page: 1,
          limit: loansPageSize,
          totalPages: 1,
        };
      }
      return res.data;
    },
  });

  const loans: StockPurchaseLoan[] = loansResponse?.data || [];
  const totalLoans: number = loansResponse?.total || 0;
  const totalLoansPages: number = loansResponse?.totalPages || 1;
  const filteredLoans = loans;

  // Pending approvals list from server
  const { 
    data: pendingApprovals = [], 
    isFetching: isFetchingPending, 
    refetch: refetchPending 
  } = useQuery<StockMovement[]>({
    queryKey: ['stock-movements-pending', selectedBranchId],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'PENDING_CONFIRMATION', limit: '100' });
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const res = await api.get(`/stock-movements?${params.toString()}`);
      if (Array.isArray(res.data)) return res.data;
      return res.data?.data || [];
    },
  });

  // Calculations for Loans summary cards (from server-provided aggregate stats, fallback to current loans)
  const loanStats = useMemo(() => {
    if (loansResponse?.stats) {
      return loansResponse.stats;
    }
    let totalCredit = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let activeLoansCount = 0;

    loans.forEach(loan => {
      const tot = Number(loan.totalAmount || 0);
      const pd = Number(loan.paidAmount || 0);
      const rem = Number(loan.remainingBalance || 0);

      totalCredit += tot;
      totalPaid += pd;
      totalRemaining += rem;

      if (loan.status !== "PAID") {
        activeLoansCount++;
      }
    });

    return { totalCredit, totalPaid, totalRemaining, activeLoansCount };
  }, [loansResponse, loans]);

  // Approval handlers
  const [isConfirmingId, setIsConfirmingId] = useState<string | null>(null);

  const handleConfirmMovement = async (movementId: string) => {
    setIsConfirmingId(movementId);
    try {
      await api.post(`/stock-movements/${movementId}/confirm`);
      toast.success(t('stockMovements.toastApproveSuccess') || "Stock intake approved & added to inventory");

      // Optimistically remove card from UI immediately
      queryClient.setQueryData<StockMovement[]>(['stock-movements-pending', selectedBranchId], (old) => {
        return (old || []).filter((m) => m.id !== movementId);
      });

      // Force refresh of pending cards and related stock tables
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-movements-pending'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
      ]);
      await refetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to confirm stock intake");
    } finally {
      setIsConfirmingId(null);
    }
  };

  const handleRejectMovement = async (movementId: string) => {
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    try {
      await api.post(`/stock-movements/${movementId}/reject`, { reason });
      toast.success(t('stockMovements.toastRejectSuccess') || "Stock intake rejected");

      // Optimistically remove card from UI immediately
      queryClient.setQueryData<StockMovement[]>(['stock-movements-pending', selectedBranchId], (old) => {
        return (old || []).filter((m) => m.id !== movementId);
      });

      // Force refresh
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-movements-pending'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
      ]);
      await refetchPending();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reject stock intake");
    }
  };



  const handlePayLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForPay) return;

    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    setIsSubmittingPay(true);
    try {
      await api.post(`/stock-movements/loans/${selectedLoanForPay.id}/pay`, {
        amount,
        note: payNote.trim() || undefined,
      });

      toast.success(`Payment of ${amount.toFixed(2)} ETB recorded successfully!`);
      setSelectedLoanForPay(null);
      setPayAmount("");
      setPayNote("");
      queryClient.invalidateQueries({ queryKey: ['stock-loans'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error processing loan payment");
      console.error(error);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "IN": return "text-green-600 bg-green-50 border-green-200";
      case "OUT": return "text-red-600 bg-red-50 border-red-200";
      case "ADJUSTMENT": return "text-orange-600 bg-orange-50 border-orange-200";
      case "PRODUCTION_USAGE": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-zinc-600 bg-zinc-50 border-zinc-200";
    }
  };

  const getMovementTypeLabel = (type: string) => {
    switch (type) {
      case "IN": return t('stockMovements.typeIn');
      case "OUT": return t('stockMovements.typeOut');
      case "ADJUSTMENT": return t('stockMovements.typeAdjustment');
      case "PRODUCTION_USAGE": return t('stockMovements.typeProductionUsage');
      default: return type.replace('_', ' ');
    }
  };

  const getLoanStatusBadge = (status: string) => {
    switch (status) {
      case "UNPAID":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5" /> {t('stockMovements.statusUnpaid')}</span>;
      case "PARTIAL":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit"><Coins className="w-3.5 h-3.5" /> {t('stockMovements.statusPartial')}</span>;
      case "PAID":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3.5 h-3.5" /> {t('stockMovements.statusSettled')}</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700">{status}</span>;
    }
  };

  const getMovementStatusBadge = (mov: StockMovement) => {
    switch (mov.status) {
      case "PENDING_CONFIRMATION":
        return (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1">
              ⏳ {t('stockMovements.statusPending')}
            </span>
            {isStockStaff && (
              <Button
                size="sm"
                onClick={() => handleConfirmMovement(mov.id)}
                disabled={isConfirmingId === mov.id}
                className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold shadow-2xs"
              >
                {isConfirmingId === mov.id ? "..." : (t('stockMovements.btnApprove') || "Accept")}
              </Button>
            )}
          </div>
        );
      case "CONFIRMED":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            {t('stockMovements.statusConfirmed')}
          </span>
        );
      case "REJECTED":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-50 text-rose-800 border border-rose-200">
            {t('stockMovements.statusRejected')}
          </span>
        );
      default:
        return null;
    }
  };

  if (user && !isStockStaff) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10]">{t('stockMovements.title')}</h1>
        </div>
      </div>

      {/* Main Mode Tabs with Auto-Centering & Edge Fade Hints */}
      <div className="relative w-full sm:w-fit mb-6 overflow-hidden">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#FAF7EE] to-transparent z-10 sm:hidden" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-[#FAF7EE] to-transparent z-10 sm:hidden" />

        <div 
          className="flex items-center gap-2 p-1.5 bg-[#FAF7EE] rounded-2xl w-full sm:w-fit border border-[#EDE4D5] overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem]"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <button
            ref={(el) => { tabRefs.current["movements"] = el; }}
            onClick={() => setActiveTab("movements")}
            className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap outline-none ${
              activeTab === "movements"
                ? "bg-[#4A2E1B] text-white shadow-sm ring-2 ring-[#4A2E1B]/20"
                : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60"
            }`}
          >
            <ArrowRightLeft className={`w-4 h-4 shrink-0 ${activeTab === "movements" ? "text-amber-300" : "text-[#E87A18]"}`} />
            <span>{t('stockMovements.movementsLedger')} ({movements.length})</span>
          </button>

          <button
            ref={(el) => { tabRefs.current["approvals"] = el; }}
            onClick={() => setActiveTab("approvals")}
            className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap outline-none ${
              activeTab === "approvals"
                ? "bg-[#4A2E1B] text-white shadow-sm ring-2 ring-[#4A2E1B]/20"
                : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60"
            }`}
          >
            <ShieldCheck className={`w-4 h-4 shrink-0 ${activeTab === "approvals" ? "text-amber-300" : "text-amber-600"}`} />
            <span>{t('stockMovements.pendingApprovalsTab')}</span>
            {pendingApprovals.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold animate-pulse">
                {pendingApprovals.length}
              </span>
            )}
          </button>

          {isGlobalAdmin && (
            <button
              ref={(el) => { tabRefs.current["loans"] = el; }}
              onClick={() => setActiveTab("loans")}
              className={`shrink-0 flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap outline-none ${
                activeTab === "loans"
                  ? "bg-[#4A2E1B] text-white shadow-sm ring-2 ring-[#4A2E1B]/20"
                  : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60"
              }`}
            >
              <CreditCard className={`w-4 h-4 shrink-0 ${activeTab === "loans" ? "text-purple-300" : "text-purple-600"}`} />
              <span>{t('stockMovements.loansAndCredit')} ({loans.length})</span>
              {loanStats.activeLoansCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-rose-500 text-white font-bold">
                  {loanStats.activeLoansCount}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: STOCK MOVEMENTS LEDGER */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Filter Toolbar: Date Filter + Today Quick Action + Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-[#EDE4D5] shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-2.5 py-1.5 text-xs">
                <Calendar className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider">{t('stockMovements.date')}:</span>
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
                    title="Clear date"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const todayStr = new Date().toISOString().slice(0, 10);
                  setDateFilter(dateFilter === todayStr ? "" : todayStr);
                }}
                className={`h-8 px-2.5 rounded-xl text-xs font-bold ${
                  dateFilter === new Date().toISOString().slice(0, 10)
                    ? "bg-[#4A2E1B] text-white border-[#4A2E1B]"
                    : "border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE]"
                }`}
              >
                {t('stockMovements.today')}
              </Button>

              {dateFilter && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateFilter("")}
                  className="h-8 px-2 text-xs text-[#8C7361] hover:text-[#2C1B10]"
                >
                  {t('stockMovements.showAllDates')}
                </Button>
              )}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                placeholder={t('stockMovements.searchMovementsPlaceholder')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pl-8 text-xs rounded-xl border-[#EDE4D5] bg-[#FAF7EE]/50"
              />
            </div>
          </div>

          {/* Desktop Table View */}
          {isLoadingMovements ? (
            <div className="hidden sm:block">
              <TableSkeleton rows={8} columns={7} hasActions={false} />
            </div>
          ) : (
            <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAF7EE]/50">
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colDateTime')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colMaterial')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colMovementType')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colQtyDelta')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colStatus')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colReceivedBy')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colReason')}</TableHead>
                    <TableHead className="pr-6 font-extrabold text-[#2C1B10]">{t('stockMovements.colRecordedBy')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMovements.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-[#8C7361]">{t('stockMovements.noMovements')}</TableCell></TableRow>
                  ) : paginatedMovements.map(mov => {
                    const price = Number(mov.unitPrice ?? mov.stockItem?.unitPrice ?? 0);
                    const val = Number(mov.totalValue ?? (Number(mov.quantity) * price));
                    const isNegative = mov.type === "OUT" || mov.type === "PRODUCTION_USAGE";

                    return (
                      <TableRow key={mov.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">
                          {formatEthDate(mov.createdAt, true)}
                        </TableCell>
                        <TableCell className="font-bold text-[#2C1B10]">{mov.stockItem?.name}</TableCell>
                        <TableCell>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getMovementColor(mov.type)}`}>
                            {getMovementTypeLabel(mov.type)}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-sm">
                          <span className={isNegative ? "text-rose-600" : "text-emerald-700"}>
                            {isNegative ? "-" : "+"}
                            {Number(mov.quantity).toFixed(2)}
                          </span>{" "}
                          <span className="text-xs text-[#8C7361] font-semibold">{mov.stockItem?.unitType}</span>
                        </TableCell>
                        <TableCell>
                          {getMovementStatusBadge(mov)}
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-[#2C1B10]">
                          {mov.receivedBy || "—"}
                        </TableCell>
                        <TableCell className="max-w-[220px] truncate text-xs text-[#8C7361]" title={mov.reason || "—"}>
                          {mov.reason ? mov.reason.replace(/Production batch\s+[a-z0-9]+/gi, t('stockMovements.typeProductionUsage')) : "—"}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-[#2C1B10] pr-6">{mov.user?.fullName || "System"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Cards View */}
          {isLoadingMovements ? (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-20 rounded-md" />
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-zinc-100">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-20" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {paginatedMovements.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-[#EDE4D5] text-center text-[#8C7361] font-medium">
                  {t('stockMovements.noMovements')}
                </div>
              ) : (
                paginatedMovements.map(mov => {
                  const price = Number(mov.unitPrice ?? mov.stockItem?.unitPrice ?? 0);
                  const val = Number(mov.totalValue ?? (Number(mov.quantity) * price));
                  const isNegative = mov.type === "OUT" || mov.type === "PRODUCTION_USAGE";

                  return (
                    <div key={mov.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-2.5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-extrabold text-[#2C1B10] text-base">{mov.stockItem?.name || "Unknown Item"}</div>
                          <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(mov.createdAt, true)}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getMovementColor(mov.type)}`}>
                          {getMovementTypeLabel(mov.type)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div>
                          <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('stockMovements.colQtyDelta')}</span>
                          <span className={`font-bold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>
                            {isNegative ? "-" : "+"}{Number(mov.quantity).toFixed(2)} {mov.stockItem?.unitType}
                          </span>
                        </div>
                        {isOwner && (
                          <div className="text-right">
                            <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('stockMovements.colTotalValue')}</span>
                            <span className={`font-extrabold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>
                              {isNegative ? "-" : "+"}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                            </span>
                          </div>
                        )}
                      </div>

                      {mov.receivedBy && (
                        <div className="flex items-center gap-1.5 text-xs bg-amber-50/80 text-amber-900 border border-amber-200/60 rounded-lg px-2 py-1 w-fit">
                          <span className="text-[10px] uppercase font-bold text-[#8C7361]">{t('stockMovements.colReceivedBy')}:</span>
                          <span className="font-extrabold text-[#2C1B10]">{mov.receivedBy}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 text-[#8C7361]">
                        <span>{t('stockMovements.colRecordedBy')}: <strong className="text-[#2C1B10]">{mov.user?.fullName || "System"}</strong></span>
                        <span className="truncate max-w-[150px]">{mov.reason || "—"}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalMovements}
              pageSize={pageSize}
              onPageChange={(p) => setCurrentPage(p)}
              onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }}
              isLoading={isLoadingMovements}
              itemLabel={t('stockMovements.title') || "movements"}
              className="bg-white sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-[#EDE4D5]"
            />
          )}
        </div>
      )}

      {/* TAB 2: COMPANY STOCK CREDIT LOANS & PURCHASES */}
      {isGlobalAdmin && activeTab === "loans" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          {isLoadingLoans ? (
            <KpiCardsSkeleton count={4} />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider">{t('stockMovements.kpiTotalCredit')}</span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] mt-1.5 sm:mt-2 font-mono truncate">
                  {loanStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                </p>
                <span className="text-[10px] sm:text-[11px] text-[#8C7361] block mt-0.5">{t('stockMovements.kpiTotalCreditDesc')}</span>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider">{t('stockMovements.kpiTotalPaid')}</span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                    <Coins className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-base sm:text-xl font-extrabold text-emerald-700 mt-1.5 sm:mt-2 font-mono truncate">
                  {loanStats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                </p>
                <span className="text-[10px] sm:text-[11px] text-[#8C7361] block mt-0.5">{t('stockMovements.kpiTotalPaidDesc')}</span>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider">{t('stockMovements.kpiRemainingDebt')}</span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-base sm:text-xl font-extrabold text-rose-600 mt-1.5 sm:mt-2 font-mono truncate">
                  {loanStats.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                </p>
                <span className="text-[10px] sm:text-[11px] text-[#8C7361] block mt-0.5">{t('stockMovements.kpiRemainingDebtDesc')}</span>
              </div>

              <div className="bg-white p-3.5 sm:p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider">{t('stockMovements.kpiActiveLoans')}</span>
                  <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                </div>
                <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] mt-1.5 sm:mt-2 font-mono truncate">
                  {loanStats.activeLoansCount} <span className="text-xs font-normal text-[#8C7361]">{t('stockMovements.unsettled')}</span>
                </p>
                <span className="text-[10px] sm:text-[11px] text-[#8C7361] block mt-0.5">{t('stockMovements.kpiActiveLoansDesc')}</span>
              </div>
            </div>
          )}

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#EDE4D5]">
            {/* Status Tabs with Auto-Centering and Edge Fade */}
            <div className="relative w-full sm:w-auto max-w-full overflow-hidden">
              <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />
              <div
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] py-0.5"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                {["ALL", "UNPAID", "PARTIAL", "PAID"].map(st => (
                  <button
                    key={st}
                    ref={(el) => { loanStatusTabRefs.current[st] = el; }}
                    onClick={() => setLoanStatusFilter(st)}
                    className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      loanStatusFilter === st
                        ? "bg-[#2C1B10] text-white shadow-xs"
                        : "bg-[#FAF7EE] text-[#8C7361] hover:text-[#2C1B10]"
                    }`}
                  >
                    {st === "ALL" 
                      ? t('stockMovements.filterAllCredit') 
                      : (st === "UNPAID" 
                          ? t('stockMovements.statusUnpaid') 
                          : (st === "PARTIAL" 
                              ? t('stockMovements.statusPartial') 
                              : t('stockMovements.statusSettled')))}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C7361]" />
              <Input
                placeholder={t('stockMovements.searchPlaceholder')}
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                className="pl-9 text-xs rounded-xl bg-[#FAF7EE] border-[#EDE4D5] h-9 w-full"
              />
            </div>
          </div>

          {/* Desktop Loans Table View */}
          {isLoadingLoans ? (
            <div className="hidden sm:block">
              <TableSkeleton rows={6} columns={7} hasActions={true} />
            </div>
          ) : (
            <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#FAF7EE]/50">
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colDateSupplier')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colStockItemPurchased')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colTotalValue')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colPaidAmount')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('stockMovements.colRemainingBalance')}</TableHead>
                    <TableHead className="font-extrabold text-[#2C1B10]">{t('common.status')}</TableHead>
                    <TableHead className="pr-6 font-extrabold text-[#2C1B10] text-right">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLoans.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">{t('stockMovements.noLoansFound')}</TableCell></TableRow>
                  ) : filteredLoans.map(loan => {
                    const item = loan.stockMovement?.stockItem;
                    const qty = Number(loan.stockMovement?.quantity || 0);
                    const tot = Number(loan.totalAmount || 0);
                    const paid = Number(loan.paidAmount || 0);
                    const rem = Number(loan.remainingBalance || 0);

                    return (
                      <TableRow key={loan.id}>
                        <TableCell>
                          <div className="font-bold text-[#2C1B10]">{loan.supplierName || t('stockMovements.unspecifiedSupplier')}</div>
                          <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(loan.createdAt, true)}</div>
                        </TableCell>
                        <TableCell>
                          <div className="font-bold text-[#2C1B10]">{item?.name || t('stockMovements.colMaterial')}</div>
                          <div className="text-xs text-[#8C7361]">
                            {t('stock.colCurrentQty')}: <strong className="text-[#2C1B10]">{qty.toFixed(2)} {item?.unitType}</strong>
                          </div>
                        </TableCell>
                        <TableCell className="font-extrabold text-xs text-[#2C1B10]">
                          {tot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                        </TableCell>
                        <TableCell className="font-bold text-xs text-emerald-700">
                          {paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                        </TableCell>
                        <TableCell className="font-extrabold text-xs text-rose-600">
                          {rem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                        </TableCell>
                        <TableCell>{getLoanStatusBadge(loan.status)}</TableCell>
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-2">
                            {loan.status !== "PAID" && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setSelectedLoanForPay(loan);
                                  setPayAmount(rem > 0 ? String(rem) : "");
                                  setPayNote("");
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 px-3"
                              >
                                <Coins className="w-3.5 h-3.5 mr-1" /> {t('stockMovements.payLoanBtn')}
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedLoanForHistory(loan)}
                              className="text-xs font-bold rounded-xl h-8 px-2.5 border-[#EDE4D5]"
                              title={t('stockMovements.historyModalTitle')}
                            >
                              <History className="w-3.5 h-3.5 text-[#8C7361]" />
                              {loan.payments && loan.payments.length > 0 && (
                                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                                  {loan.payments.length}
                                </span>
                              )}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Mobile Loans Card View */}
          {isLoadingLoans ? (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-20 rounded-full" />
                  </div>
                  <Skeleton className="h-10 w-full rounded-xl" />
                  <Skeleton className="h-14 w-full rounded-xl" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:hidden">
              {filteredLoans.map(loan => {
              const item = loan.stockMovement?.stockItem;
              const qty = Number(loan.stockMovement?.quantity || 0);
              const tot = Number(loan.totalAmount || 0);
              const paid = Number(loan.paidAmount || 0);
              const rem = Number(loan.remainingBalance || 0);

              return (
                <div key={loan.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-[#2C1B10] text-base">{loan.supplierName || t('stockMovements.unspecifiedSupplier')}</div>
                      <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(loan.createdAt, true)}</div>
                    </div>
                    {getLoanStatusBadge(loan.status)}
                  </div>

                  <div className="p-3 bg-[#FAF7EE] rounded-xl text-xs space-y-1">
                    <div className="font-bold text-[#2C1B10]">{t('stockMovements.colMaterial')}: {item?.name}</div>
                    <div className="text-[#8C7361]">{t('stock.colCurrentQty')}: <strong className="text-[#2C1B10]">{qty.toFixed(2)} {item?.unitType}</strong></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('common.total')}</span>
                      <span className="font-bold text-[#2C1B10] font-mono">{tot.toLocaleString()} {t('common.currency')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('stockMovements.colPaidAmount')}</span>
                      <span className="font-bold text-emerald-700 font-mono">{paid.toLocaleString()} {t('common.currency')}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('stockMovements.colRemainingBalance')}</span>
                      <span className="font-extrabold text-rose-600 font-mono">{rem.toLocaleString()} {t('common.currency')}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                    {loan.status !== "PAID" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLoanForPay(loan);
                          setPayAmount(rem > 0 ? String(rem) : "");
                          setPayNote("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-9 px-3 flex-1 shadow-sm"
                      >
                        <Coins className="w-3.5 h-3.5 mr-1" /> {t('stockMovements.payInstallmentBtn')}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLoanForHistory(loan)}
                      className="text-xs font-bold rounded-xl h-9 px-3 border-[#EDE4D5] hover:bg-[#FAF6F0]"
                    >
                      <History className="w-3.5 h-3.5 mr-1 text-[#8C7361]" /> {t('stockMovements.historyBtn')} ({loan.payments?.length || 0})
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <PaginationControls
          currentPage={loansPage}
          totalPages={totalLoansPages}
          totalItems={totalLoans}
          pageSize={loansPageSize}
          onPageChange={(p) => setLoansPage(p)}
          onPageSizeChange={(size) => { setLoansPageSize(size); setLoansPage(1); }}
          isLoading={isLoadingLoans}
          itemLabel={t('stockMovements.creditPurchasesTab') || "loans"}
          className="bg-white sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-[#EDE4D5]"
        />
      </div>
    )}



      {/* RECORD LOAN PAYMENT MODAL */}
      {isGlobalAdmin && selectedLoanForPay && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedLoanForPay(null); }}>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600 shrink-0" />
                {t('stockMovements.payModalTitle')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handlePayLoanSubmit} className="space-y-4 py-2">
              <div className="bg-[#FAF7EE] p-3.5 sm:p-4 rounded-2xl border border-[#EDE4D5] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">{t('stockMovements.colSupplier')}:</span>
                  <span className="font-extrabold text-[#2C1B10]">{selectedLoanForPay.supplierName || t('stockMovements.unspecifiedSupplier')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">{t('stockMovements.colStockItemPurchased')}:</span>
                  <span className="font-bold text-[#2C1B10]">
                    {selectedLoanForPay.stockMovement?.stockItem?.name} ({Number(selectedLoanForPay.stockMovement?.quantity || 0)} {selectedLoanForPay.stockMovement?.stockItem?.unitType})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">{t('stockMovements.colTotalValue')}:</span>
                  <span className="font-bold text-[#2C1B10] font-mono">{Number(selectedLoanForPay.totalAmount).toLocaleString()} {t('common.currency')}</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#EDE4D5]">
                  <span className="text-[#8C7361] font-semibold">{t('stockMovements.colPaidAmount')}:</span>
                  <span className="font-bold text-emerald-700 font-mono">{Number(selectedLoanForPay.paidAmount).toLocaleString()} {t('common.currency')}</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-[#EDE4D5]">
                  <span className="font-bold text-rose-700">{t('stockMovements.colRemainingBalance')}:</span>
                  <span className="font-extrabold text-rose-600 font-mono">{Number(selectedLoanForPay.remainingBalance).toLocaleString()} {t('common.currency')}</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-[#2C1B10] uppercase">{t('stockMovements.payAmountLabel')}</label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(Number(selectedLoanForPay.remainingBalance)))}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    {t('stockMovements.payFullBalance')} ({Number(selectedLoanForPay.remainingBalance).toLocaleString()} {t('common.currency')})
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedLoanForPay.remainingBalance)}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  onFocus={(e) => e.target.select()}
                  placeholder="0.00"
                  className="h-10 rounded-xl font-mono font-bold text-base"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">{t('stockMovements.payNoteLabel')}</label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Bank transfer, Cash installment #2, Receipt #1024"
                  className="h-10 rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmittingPay ? t('common.loading') : t('stockMovements.confirmPayment')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedLoanForPay(null)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* VIEW PAYMENT HISTORY MODAL */}
      {isGlobalAdmin && selectedLoanForHistory && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedLoanForHistory(null); }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-[#2C1B10] flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                {t('stockMovements.historyModalTitle')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-[#FAF7EE] p-3.5 rounded-2xl border border-[#EDE4D5] text-xs flex items-center justify-between">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-bold">{t('stockMovements.colSupplier')}</span>
                  <span className="font-extrabold text-[#2C1B10] text-sm">{selectedLoanForHistory.supplierName || t('stockMovements.unspecifiedSupplier')}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#8C7361] block text-[10px] uppercase font-bold">{t('stockMovements.colRemainingBalance')}</span>
                  <span className="font-extrabold text-rose-600 text-sm">
                    {Number(selectedLoanForHistory.remainingBalance).toLocaleString()} {t('common.currency')}
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {!selectedLoanForHistory.payments || selectedLoanForHistory.payments.length === 0 ? (
                  <div className="text-center py-6 text-[#8C7361] text-xs">
                    {t('stockMovements.noPaymentsLogged')}
                  </div>
                ) : (
                  selectedLoanForHistory.payments.map((pmt, idx) => (
                    <div key={pmt.id || idx} className="p-3 bg-white rounded-xl border border-[#EDE4D5] text-xs flex items-center justify-between space-y-1">
                      <div>
                        <div className="font-extrabold text-emerald-700 text-sm">+ {Number(pmt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} {t('common.currency')}</div>
                        <div className="text-[11px] text-[#8C7361]">{formatEthDate(pmt.createdAt, true)}</div>
                        {pmt.note && <div className="text-[11px] text-zinc-600 italic mt-0.5">&quot;{pmt.note}&quot;</div>}
                      </div>
                      <div className="text-right text-[11px] text-[#8C7361]">
                        {t('stockMovements.colRecordedBy')}:<br />
                        <strong className="text-[#2C1B10]">{pmt.user?.fullName || "Staff"}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setSelectedLoanForHistory(null)} className="w-full rounded-xl">{t('common.close')}</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* TAB 2: PENDING APPROVALS */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          {isFetchingPending && pendingApprovals.length === 0 ? (
            <div className="bg-white border border-[#EDE4D5] rounded-2xl p-12 text-center shadow-xs">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-600 mb-2" />
              <p className="text-xs text-[#8C7361]">{t('common.loading') || 'Loading approvals...'}</p>
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="bg-white border border-[#EDE4D5] rounded-2xl p-12 text-center shadow-xs">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-extrabold text-[#2C1B10] text-base">{t('stockMovements.allInwardApprovedTitle')}</h3>
              <p className="text-xs text-[#8C7361] mt-1 max-w-md mx-auto">
                {t('stockMovements.allInwardApprovedDesc')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingApprovals.map((mov) => {
                const price = Number(mov.unitPrice ?? mov.stockItem?.unitPrice ?? 0);
                const totalVal = Number(mov.totalValue ?? (Number(mov.quantity) * price));

                return (
                  <div key={mov.id} className="bg-white border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between space-y-4">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                            {t('stockMovements.awaitingAcceptance')}
                          </span>
                          <h3 className="font-extrabold text-lg text-[#2C1B10] mt-1">{mov.stockItem?.name}</h3>
                          <p className="text-xs text-[#8C7361]">{formatEthDate(mov.createdAt, true)}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-xl font-black text-emerald-700 font-mono">
                            +{Number(mov.quantity).toFixed(2)}
                          </span>
                          <span className="text-xs text-[#8C7361] font-bold block">{mov.stockItem?.unitType}</span>
                        </div>
                      </div>

                      <div className="mt-3 p-3 bg-[#FAF7EE] rounded-xl border border-[#EDE4D5] text-xs space-y-1.5">
                        <div className="flex justify-between">
                          <span className="text-[#8C7361]">{t('stockMovements.addedBy')}:</span>
                          <span className="font-bold text-[#2C1B10]">{mov.user?.fullName} ({mov.user?.role})</span>
                        </div>
                        {isOwner && price > 0 && (
                          <div className="flex justify-between">
                            <span className="text-[#8C7361]">{t('stockMovements.totalValue')}:</span>
                            <span className="font-bold text-[#2C1B10] font-mono">{totalVal.toLocaleString(undefined, { minimumFractionDigits: 2 })} {t('common.currency')}</span>
                          </div>
                        )}
                        {mov.reason && (
                          <div className="flex justify-between pt-1 border-t border-[#EDE4D5]">
                            <span className="text-[#8C7361]">{t('common.notes')}:</span>
                            <span className="font-semibold text-zinc-700 italic">{mov.reason}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
                      <Button
                        onClick={() => handleConfirmMovement(mov.id)}
                        disabled={isConfirmingId === mov.id}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 text-xs flex items-center justify-center gap-1.5 shadow-xs"
                      >
                        <Check className="w-4 h-4 shrink-0" />
                        <span>{isConfirmingId === mov.id ? t('stockMovements.confirming') : t('stockMovements.confirmReceiptBtn')}</span>
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleRejectMovement(mov.id)}
                        className="px-3 rounded-xl h-10 border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold"
                      >
                        <X className="w-4 h-4 mr-1 shrink-0" />
                        {t('stockMovements.btnReject')}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </DashboardLayout>
  );
}
