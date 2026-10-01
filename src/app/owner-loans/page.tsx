"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatEthDate } from "@/lib/ethiopianDate";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  HandCoins,
  Plus,
  Search,
  RotateCcw,
  CheckCircle2,
  Clock,
  Trash2,
  CreditCard,
  Building2,
  ArrowDownRight,
  AlertCircle,
  FileText,
  DollarSign,
  ShieldAlert,
  User,
  Landmark,
  MoreVertical,
  ChevronRight,
  Eye,
} from "lucide-react";
import ConfirmModal from "@/components/ConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

interface Payment {
  id: string;
  amountPaid: number | string;
  date: string;
  createdAt: string;
}

interface OwnerLoan {
  id: string;
  branchId: string;
  branch?: {
    id: string;
    name: string;
  };
  userId?: string | null;
  user?: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
  } | null;
  type: string;
  entityId?: string | null; // Stores structured { lender, reason, notes } or raw string
  totalAmount: number | string;
  remainingBalance: number | string;
  status: "OPEN" | "PAID";
  date: string;
  createdAt: string;
  updatedAt: string;
  payments: Payment[];
}

interface ParsedOwnerLoanInfo {
  lender: string;
  reason: string;
  notes: string;
}

function parseOwnerLoanEntity(raw?: string | null): ParsedOwnerLoanInfo {
  if (!raw) return { lender: "External Lender", reason: "", notes: "" };
  try {
    if (raw.startsWith("{") && raw.endsWith("}")) {
      const parsed = JSON.parse(raw);
      return {
        lender: parsed.lender || parsed.name || "External Lender",
        reason: parsed.reason || "",
        notes: parsed.notes || "",
      };
    }
  } catch {}

  const bracketMatch = raw.match(/\[Lender:\s*(.*?)\]\s*(.*)/i);
  if (bracketMatch) {
    return {
      lender: bracketMatch[1].trim(),
      reason: bracketMatch[2].trim(),
      notes: "",
    };
  }

  return {
    lender: raw,
    reason: "",
    notes: "",
  };
}

export default function OwnerLoansPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { branches } = useBranch();
  const { t } = useLanguage();
  const router = useRouter();

  const queryClient = useQueryClient();

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "PAID">("ALL");
  const [branchFilter, setBranchFilter] = useState("ALL");

  // Log New Loan Modal State
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isSubmittingLog, setIsSubmittingLog] = useState(false);
  const [logLender, setLogLender] = useState("");
  const [logAmount, setLogAmount] = useState("");
  const [logDate, setLogDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [logBranchId, setLogBranchId] = useState("");
  const [logReason, setLogReason] = useState("");
  const [logNotes, setLogNotes] = useState("");

  // Pay Modal State
  const [payingLoan, setPayingLoan] = useState<OwnerLoan | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // History Modal State
  const [historyLoan, setHistoryLoan] = useState<OwnerLoan | null>(null);

  // Actions Dropdown & Delete State
  const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);
  const [deleteLoanId, setDeleteLoanId] = useState<string | null>(null);
  const [isDeletingLoan, setIsDeletingLoan] = useState(false);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-actions-menu]")) {
        setOpenActionDropdownId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  // Redirect if not Owner
  useEffect(() => {
    if (!isAuthLoading && user && user.role !== "OWNER") {
      toast.error("Access restricted to Owner only");
      router.replace("/");
    }
  }, [user, isAuthLoading, router]);

  // Set default branch for modal
  useEffect(() => {
    if (branches && branches.length > 0 && !logBranchId) {
      setLogBranchId(branches[0].id);
    }
  }, [branches, logBranchId]);

  // React Query for instant cached navigation and background updates
  const { data: loans = [], isLoading } = useQuery<OwnerLoan[]>({
    queryKey: ["owner-loans"],
    queryFn: async () => {
      const { data } = await api.get("/loans", {
        params: {
          type: "OWNER_LOAN",
          branchId: "ALL",
        },
      });
      return data || [];
    },
    enabled: user?.role === "OWNER",
  });

  // Summary Metrics
  const summary = useMemo(() => {
    let totalBorrowed = 0;
    let totalRepaid = 0;
    let totalRemaining = 0;
    let openCount = 0;
    let paidCount = 0;

    loans.forEach((loan) => {
      const orig = Number(loan.totalAmount) || 0;
      const rem = Number(loan.remainingBalance) || 0;
      const paid = loan.payments?.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0) || (orig - rem);

      totalBorrowed += orig;
      totalRemaining += rem;
      totalRepaid += paid;

      if (loan.status === "OPEN" && rem > 0) {
        openCount++;
      } else {
        paidCount++;
      }
    });

    return {
      totalBorrowed,
      totalRepaid,
      totalRemaining,
      openCount,
      paidCount,
      totalCount: loans.length,
    };
  }, [loans]);

  // Filtered Loans
  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      if (statusFilter !== "ALL") {
        if (statusFilter === "OPEN" && (l.status !== "OPEN" || Number(l.remainingBalance) <= 0)) {
          return false;
        }
        if (statusFilter === "PAID" && l.status !== "PAID" && Number(l.remainingBalance) > 0) {
          return false;
        }
      }

      if (branchFilter !== "ALL" && l.branchId !== branchFilter) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const info = parseOwnerLoanEntity(l.entityId);
        const lenderMatch = info.lender.toLowerCase().includes(q);
        const reasonMatch = info.reason.toLowerCase().includes(q);
        const notesMatch = info.notes.toLowerCase().includes(q);
        const branchMatch = l.branch?.name?.toLowerCase().includes(q);
        const idMatch = l.id.toLowerCase().includes(q);
        const amountMatch = String(l.totalAmount).includes(q);
        if (!lenderMatch && !reasonMatch && !notesMatch && !branchMatch && !idMatch && !amountMatch) {
          return false;
        }
      }

      return true;
    });
  }, [loans, statusFilter, branchFilter, searchTerm]);

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL" || branchFilter !== "ALL";

  // Handle Log Loan
  const handleLogLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(logAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid loan amount greater than 0");
      return;
    }

    if (!logLender.trim()) {
      toast.error("Please enter the name of the person or company you lent from");
      return;
    }

    if (!logBranchId) {
      toast.error("Please select a branch");
      return;
    }

    setIsSubmittingLog(true);
    try {
      await api.post("/loans", {
        type: "OWNER_LOAN",
        branchId: logBranchId,
        totalAmount: amountNum,
        date: logDate,
        lenderName: logLender.trim(),
        reason: logReason.trim(),
        notes: logNotes.trim(),
      });

      toast.success(t("ownerLoans.toastLoanLogged"));
      setIsLogModalOpen(false);
      setLogLender("");
      setLogAmount("");
      setLogReason("");
      setLogNotes("");
      queryClient.invalidateQueries({ queryKey: ["owner-loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to log personal loan");
    } finally {
      setIsSubmittingLog(false);
    }
  };

  // Handle Repay Loan
  const handlePayLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingLoan) return;

    const amountNum = Number(payAmount);
    const remainingNum = Number(payingLoan.remainingBalance);

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid repayment amount");
      return;
    }

    if (amountNum > remainingNum) {
      toast.error(`Payment cannot exceed the remaining balance of ${remainingNum.toLocaleString()} ETB`);
      return;
    }

    setIsSubmittingPay(true);
    try {
      await api.post(`/loans/${payingLoan.id}/pay`, {
        amountPaid: amountNum,
        date: payDate,
      });

      toast.success(t("ownerLoans.toastLoanPaid"));
      setPayingLoan(null);
      setPayAmount("");
      queryClient.invalidateQueries({ queryKey: ["owner-loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to record loan payment");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Handle Delete Loan with ConfirmModal
  const handleConfirmDeleteLoan = async () => {
    if (!deleteLoanId) return;
    setIsDeletingLoan(true);
    try {
      await api.delete(`/loans/${deleteLoanId}`);
      toast.success(t("ownerLoans.toastLoanDeleted"));
      queryClient.invalidateQueries({ queryKey: ["owner-loans"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to delete loan record");
    } finally {
      setIsDeletingLoan(false);
      setDeleteLoanId(null);
    }
  };

  if (!isAuthLoading && user && user.role !== "OWNER") {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
          <ShieldAlert className="w-16 h-16 text-rose-500 mb-4 animate-pulse" />
          <h2 className="text-2xl font-black text-[#2C1B10]">Access Restricted</h2>
          <p className="text-sm text-[#8C7361] mt-1 max-w-md">
            This module is reserved exclusively for the bakery business owner to track personal borrowings and repayments.
          </p>
          <Button onClick={() => router.push("/")} size="lg" className="mt-6">
            Return to Dashboard
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] border border-[#EDE4D5] rounded-3xl p-5 sm:p-6 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[#E87A18]/10 text-[#E87A18] flex items-center justify-center shrink-0 border border-[#E87A18]/20 shadow-xs">
              <HandCoins className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#2C1B10]">
                  {t("ownerLoans.title")}
                </h1>
                <Badge className="bg-[#2C1B10] text-[#E87A18] border-none font-bold text-[10px] tracking-wider px-2 py-0.5 uppercase">
                  OWNER ONLY
                </Badge>
              </div>
              <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
                {t("ownerLoans.subtitle")}
              </p>
            </div>
          </div>

          <Button
            onClick={() => setIsLogModalOpen(true)}
            size="lg"
            className="shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{t("ownerLoans.logNewLoan")}</span>
          </Button>
        </div>

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
          {/* Card 1: Total Borrowed */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
              <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">
                {t("ownerLoans.totalBorrowed")}
              </p>
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-50 text-[#E87A18] flex items-center justify-center shrink-0 border border-orange-100">
                <ArrowDownRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <h3 className="text-base sm:text-2xl font-black text-[#2C1B10] font-mono tracking-tight break-words">
                  {summary.totalBorrowed.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t("common.currency")}</span>
                </h3>
              )}
            </div>
          </div>

          {/* Card 2: Total Repaid */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
              <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">
                {t("ownerLoans.totalRepaid")}
              </p>
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <h3 className="text-base sm:text-2xl font-black text-emerald-700 font-mono tracking-tight break-words">
                  {summary.totalRepaid.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-emerald-600">{t("common.currency")}</span>
                </h3>
              )}
            </div>
          </div>

          {/* Card 3: Outstanding Balance */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
              <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">
                {t("ownerLoans.outstandingBalance")}
              </p>
              <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 border ${
                summary.totalRemaining > 0
                  ? "bg-rose-50 text-rose-600 border-rose-100"
                  : "bg-emerald-50 text-emerald-600 border-emerald-100"
              }`}>
                <AlertCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : (
                <h3 className={`text-base sm:text-2xl font-black font-mono tracking-tight break-words ${
                  summary.totalRemaining > 0 ? "text-rose-600" : "text-emerald-700"
                }`}>
                  {summary.totalRemaining.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t("common.currency")}</span>
                </h3>
              )}
            </div>
          </div>

          {/* Card 4: Active vs Settled Count */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between gap-1.5 mb-1.5 sm:mb-2">
              <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">
                {t("ownerLoans.activeLoans")}
              </p>
              <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center shrink-0 border border-purple-100">
                <CreditCard className="w-3.5 h-3.5 sm:w-5 sm:h-5 stroke-[2.5]" />
              </div>
            </div>
            <div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 mt-1" />
              ) : (
                <div className="flex items-baseline gap-1.5 flex-wrap">
                  <span className="text-base sm:text-2xl font-black text-[#2C1B10] font-mono">
                    {summary.openCount}
                  </span>
                  <span className="text-[10px] sm:text-xs font-bold text-[#8C7361]">
                    ({summary.paidCount} {t("ownerLoans.settledLoans").toLowerCase()})
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-3" />
            <Input
              type="text"
              placeholder="Search by person/company, purpose, branch, amount or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 rounded-xl border-[#EDE4D5] bg-[#FAF6F0]/40 text-xs sm:text-sm font-medium focus:bg-white transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-10 px-3 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/60 text-xs sm:text-sm font-bold text-[#2C1B10] focus:ring-1 focus:ring-[#E87A18] focus:bg-white"
            >
              <option value="ALL">{t("common.all")} Statuses</option>
              <option value="OPEN">{t("ownerLoans.statusOpen")}</option>
              <option value="PAID">{t("ownerLoans.statusPaid")}</option>
            </select>

            {/* Branch Filter */}
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="h-10 px-3 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/60 text-xs sm:text-sm font-bold text-[#2C1B10] focus:ring-1 focus:ring-[#E87A18] focus:bg-white"
            >
              <option value="ALL">{t("common.allBranches")}</option>
              {branches?.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Reset Filter Button */}
            {hasActiveFilters && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchTerm("");
                  setStatusFilter("ALL");
                  setBranchFilter("ALL");
                }}
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </Button>
            )}
          </div>
        </div>

        {/* Content Table / Card View */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={7} hasActions={true} />
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[#FAF6F0] text-[#8C7361] flex items-center justify-center mx-auto mb-3 border border-[#EDE4D5]">
                <HandCoins className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-base text-[#2C1B10]">
                {hasActiveFilters ? t("ownerLoans.noLoansMatch") : t("ownerLoans.noLoansFound")}
              </h3>
              <p className="text-xs text-[#8C7361] mt-1 max-w-sm mx-auto">
                {hasActiveFilters
                  ? "Try resetting search terms or status filters to view records."
                  : "Click '+ Log Personal Loan' above to record money borrowed from a person or company."}
              </p>
              {!hasActiveFilters && (
                <Button
                  onClick={() => setIsLogModalOpen(true)}
                  size="sm"
                  className="mt-4"
                >
                  <Plus className="w-4 h-4 mr-1" /> {t("ownerLoans.logNewLoan")}
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* DESKTOP TABLE VIEW */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]">
                    <TableRow className="border-[#EDE4D5]">
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs whitespace-nowrap">{t("ownerLoans.colDate")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs whitespace-nowrap">{t("ownerLoans.colLender")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs whitespace-nowrap">{t("ownerLoans.colReason")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs whitespace-nowrap">{t("ownerLoans.colBranch")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs text-right whitespace-nowrap">{t("ownerLoans.colTotalAmount")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs text-center whitespace-nowrap">{t("ownerLoans.colRepaid")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs text-right whitespace-nowrap">{t("ownerLoans.colRemainingBalance")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs text-center whitespace-nowrap">{t("ownerLoans.colStatus")}</TableHead>
                      <TableHead className="px-3 py-2.5 font-extrabold text-[#4A2E1B] text-xs text-right pr-4 whitespace-nowrap">{t("ownerLoans.colActions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLoans.map((loan) => {
                      const totalNum = Number(loan.totalAmount) || 0;
                      const remNum = Number(loan.remainingBalance) || 0;
                      const paidNum = loan.payments?.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0) || (totalNum - remNum);
                      const percentPaid = totalNum > 0 ? Math.min(100, Math.round((paidNum / totalNum) * 100)) : 100;
                      const isPaid = loan.status === "PAID" || remNum <= 0;
                      const loanInfo = parseOwnerLoanEntity(loan.entityId);

                      return (
                        <TableRow
                          key={loan.id}
                          onClick={() => setHistoryLoan(loan)}
                          className="border-[#EDE4D5] hover:bg-[#FAF6F0]/70 transition-colors cursor-pointer"
                        >
                          {/* Date */}
                          <TableCell className="px-3 py-2.5 text-xs whitespace-nowrap">
                            <div className="font-bold text-[#2C1B10] text-xs leading-tight">
                              {formatEthDate(loan.date || loan.createdAt)}
                            </div>
                            <div className="text-[10px] text-[#8C7361] mt-0.5">
                              {format(new Date(loan.date || loan.createdAt), "MMM d, yyyy")}
                            </div>
                          </TableCell>

                          {/* Lender Name (Person or Company) */}
                          <TableCell className="px-3 py-2.5 max-w-[150px]">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-md bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-center shrink-0 text-[#E87A18]">
                                <Landmark className="w-3 h-3" />
                              </div>
                              <span className="font-extrabold text-xs sm:text-sm text-[#2C1B10] truncate" title={loanInfo.lender}>
                                {loanInfo.lender}
                              </span>
                            </div>
                          </TableCell>

                          {/* Reason / Purpose (Manual) */}
                          <TableCell className="px-3 py-2.5 max-w-[140px]">
                            <div className="font-semibold text-xs text-[#4A2E1B] truncate" title={loanInfo.reason || "No specific reason"}>
                              {loanInfo.reason || <span className="text-[#8C7361] italic text-[11px]">No specific reason</span>}
                            </div>
                            {loanInfo.notes && (
                              <div className="text-[10px] text-[#8C7361] truncate mt-0.5" title={loanInfo.notes}>
                                Note: {loanInfo.notes}
                              </div>
                            )}
                          </TableCell>

                          {/* Branch */}
                          <TableCell className="px-3 py-2.5 text-xs font-semibold text-[#4A2E1B] whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FAF6F0] border border-[#EDE4D5] text-[11px]">
                              <Building2 className="w-3 h-3 text-[#E87A18] shrink-0" />
                              <span className="truncate max-w-[90px]">{loan.branch?.name || "Main Branch"}</span>
                            </span>
                          </TableCell>

                          {/* Total Amount */}
                          <TableCell className="px-3 py-2.5 text-right font-black text-xs text-[#2C1B10] font-mono whitespace-nowrap">
                            {totalNum.toLocaleString()} <span className="text-[10px] font-semibold text-[#8C7361]">{t("common.currency")}</span>
                          </TableCell>

                          {/* Repaid Progress */}
                          <TableCell className="px-3 py-2.5 text-center whitespace-nowrap">
                            <div className="inline-flex flex-col items-center gap-0.5">
                              <span className="text-xs font-bold font-mono text-emerald-700">
                                {paidNum.toLocaleString()} <span className="text-[10px]">({percentPaid}%)</span>
                              </span>
                              <div className="w-16 bg-zinc-100 rounded-full h-1 overflow-hidden border border-zinc-200">
                                <div
                                  className="bg-emerald-500 h-1 rounded-full transition-all duration-300"
                                  style={{ width: `${percentPaid}%` }}
                                />
                              </div>
                            </div>
                          </TableCell>

                          {/* Remaining Due */}
                          <TableCell className="px-3 py-2.5 text-right font-mono whitespace-nowrap">
                            <span className={`font-black text-xs sm:text-sm ${isPaid ? "text-emerald-700" : "text-rose-600"}`}>
                              {remNum.toLocaleString()}
                            </span>
                            <span className="text-[10px] font-semibold text-[#8C7361] ml-0.5">{t("common.currency")}</span>
                          </TableCell>

                          {/* Status Badge */}
                          <TableCell className="px-3 py-2.5 text-center whitespace-nowrap">
                            {isPaid ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px] px-2 py-0.5">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-1 text-emerald-600" />
                                {t("ownerLoans.statusPaid")}
                              </Badge>
                            ) : (
                              <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] px-2 py-0.5">
                                <Clock className="w-2.5 h-2.5 mr-1 text-amber-600 animate-pulse" />
                                {t("ownerLoans.statusOpen")}
                              </Badge>
                            )}
                          </TableCell>

                          {/* Actions */}
                          <TableCell className="px-3 py-2.5 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5 relative" data-actions-menu>
                              {!isPaid ? (
                                <Button
                                  size="sm"
                                  variant="success"
                                  onClick={() => {
                                    setPayingLoan(loan);
                                    setPayAmount(String(remNum));
                                    setPayDate(format(new Date(), "yyyy-MM-dd"));
                                  }}
                                  className="h-8 px-2.5 rounded-xl font-bold text-xs shadow-2xs shrink-0 flex items-center gap-1"
                                >
                                  <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                                  <span>{t("ownerLoans.repayBtn")}</span>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setHistoryLoan(loan)}
                                  className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl flex items-center gap-1 shadow-2xs shrink-0"
                                >
                                  <FileText className="w-3.5 h-3.5 text-[#E87A18]" />
                                  <span>History ({loan.payments?.length || 0})</span>
                                </Button>
                              )}

                              {/* Compact Actions Dropdown Menu */}
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => setOpenActionDropdownId(openActionDropdownId === loan.id ? null : loan.id)}
                                  className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                    openActionDropdownId === loan.id
                                      ? "bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-xs"
                                      : "bg-white text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0]"
                                  }`}
                                  title="More Actions"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </button>

                                {openActionDropdownId === loan.id && (
                                  <div className="absolute right-0 top-full mt-1.5 w-48 z-50 rounded-2xl bg-white border border-[#EDE4D5] shadow-xl p-1.5 space-y-1 text-left animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionDropdownId(null);
                                        setHistoryLoan(loan);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl transition-colors cursor-pointer text-left"
                                    >
                                      <FileText className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                                      <span>Payment History ({loan.payments?.length || 0})</span>
                                    </button>

                                    {!isPaid && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenActionDropdownId(null);
                                          setPayingLoan(loan);
                                          setPayAmount(String(remNum));
                                          setPayDate(format(new Date(), "yyyy-MM-dd"));
                                        }}
                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer text-left"
                                      >
                                        <DollarSign className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                        <span>{t("ownerLoans.repayBtn")}</span>
                                      </button>
                                    )}

                                    <div className="my-1 border-t border-[#F4ECE1]" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionDropdownId(null);
                                        setDeleteLoanId(loan.id);
                                      }}
                                      className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                      <span>{t("common.delete")} Record</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* MOBILE CARDS VIEW */}
              <div className="block md:hidden divide-y divide-[#EDE4D5]">
                {filteredLoans.map((loan) => {
                  const totalNum = Number(loan.totalAmount) || 0;
                  const remNum = Number(loan.remainingBalance) || 0;
                  const paidNum = loan.payments?.reduce((s, p) => s + (Number(p.amountPaid) || 0), 0) || (totalNum - remNum);
                  const percentPaid = totalNum > 0 ? Math.min(100, Math.round((paidNum / totalNum) * 100)) : 100;
                  const isPaid = loan.status === "PAID" || remNum <= 0;
                  const loanInfo = parseOwnerLoanEntity(loan.entityId);

                  return (
                    <div key={loan.id} className="p-4 space-y-3">
                      {/* Top Bar */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <Landmark className="w-4 h-4 text-[#E87A18]" />
                            <h4 className="font-black text-sm text-[#2C1B10]">
                              {loanInfo.lender}
                            </h4>
                          </div>
                          {loanInfo.reason && (
                            <p className="text-xs font-semibold text-[#4A2E1B] mt-0.5">
                              {loanInfo.reason}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-1 text-[11px] text-[#8C7361] font-semibold">
                            <span>{formatEthDate(loan.date || loan.createdAt)}</span>
                            <span>•</span>
                            <span>{loan.branch?.name || "Main Branch"}</span>
                          </div>
                        </div>

                        {isPaid ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-extrabold text-[10px] px-2 py-0.5 shrink-0">
                            {t("ownerLoans.statusPaid")}
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] px-2 py-0.5 shrink-0">
                            {t("ownerLoans.statusOpen")}
                          </Badge>
                        )}
                      </div>

                      {/* Financial Amounts Breakdown */}
                      <div className="bg-[#FAF6F0] rounded-xl p-3 grid grid-cols-3 gap-2 text-center text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Borrowed</span>
                          <strong className="text-[#2C1B10] font-mono text-sm block mt-0.5">{totalNum.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Repaid</span>
                          <strong className="text-emerald-700 font-mono text-sm block mt-0.5">{paidNum.toLocaleString()}</strong>
                        </div>
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Remaining</span>
                          <strong className={`font-mono text-sm block mt-0.5 ${isPaid ? "text-emerald-700" : "text-rose-600 font-black"}`}>
                            {remNum.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold text-[#8C7361]">
                          <span>Repayment Progress</span>
                          <span className="font-bold text-emerald-700">{percentPaid}%</span>
                        </div>
                        <div className="w-full bg-zinc-100 rounded-full h-1.5 overflow-hidden border border-zinc-200">
                          <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${percentPaid}%` }} />
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-2 pt-1">
                        {!isPaid && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setPayingLoan(loan);
                              setPayAmount(String(remNum));
                              setPayDate(format(new Date(), "yyyy-MM-dd"));
                            }}
                            className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                          >
                            <DollarSign className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>{t("ownerLoans.repayBtn")}</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setHistoryLoan(loan)}
                          className="h-9 px-3 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs flex items-center gap-1"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span>History ({loan.payments?.length || 0})</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteLoanId(loan.id)}
                          className="h-9 w-9 p-0 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ======================= LOG NEW LOAN MODAL ======================= */}
      <Dialog open={isLogModalOpen} onOpenChange={setIsLogModalOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-[#EDE4D5]">
          <form onSubmit={handleLogLoan}>
            <DialogHeader className="pb-3 border-b border-[#EDE4D5]">
              <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
                <div className="p-2 rounded-xl bg-[#E87A18]/10 text-[#E87A18]">
                  <HandCoins className="w-5 h-5" />
                </div>
                <span>{t("ownerLoans.modalLogTitle")}</span>
              </DialogTitle>
              <p className="text-xs text-[#8C7361] mt-1">{t("ownerLoans.modalLogDesc")}</p>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Lent From (Person or Company) */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                  {t("ownerLoans.fieldLender")} *
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    required
                    placeholder={t("ownerLoans.fieldLenderPlaceholder")}
                    value={logLender}
                    onChange={(e) => setLogLender(e.target.value)}
                    className="h-11 rounded-xl border-[#EDE4D5] text-sm font-bold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] pl-9"
                  />
                  <Landmark className="w-4 h-4 text-[#8C7361] absolute left-3 top-3.5" />
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                  {t("ownerLoans.fieldAmount")} *
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 25000"
                    value={logAmount}
                    onChange={(e) => setLogAmount(e.target.value)}
                    className="h-11 rounded-xl border-[#EDE4D5] font-mono text-base font-black text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] pr-12"
                  />
                  <span className="absolute right-3.5 top-3 text-xs font-bold text-[#8C7361]">ETB</span>
                </div>
              </div>

              {/* Branch and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                    {t("ownerLoans.fieldBranch")} *
                  </label>
                  <select
                    required
                    value={logBranchId}
                    onChange={(e) => setLogBranchId(e.target.value)}
                    className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-xs sm:text-sm font-semibold text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18]"
                  >
                    {branches?.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                    {t("ownerLoans.fieldDate")} *
                  </label>
                  <Input
                    type="date"
                    required
                    value={logDate}
                    onChange={(e) => setLogDate(e.target.value)}
                    className="h-11 rounded-xl border-[#EDE4D5] text-xs sm:text-sm font-semibold"
                  />
                </div>
              </div>

              {/* Purpose / Reason (Manual text input, no presets) */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                  {t("ownerLoans.fieldReason")}
                </label>
                <Input
                  type="text"
                  placeholder={t("ownerLoans.fieldReasonPlaceholder")}
                  value={logReason}
                  onChange={(e) => setLogReason(e.target.value)}
                  className="h-11 rounded-xl border-[#EDE4D5] text-xs sm:text-sm font-medium"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                  {t("ownerLoans.fieldNotes")}
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional details, terms, repayment schedule..."
                  value={logNotes}
                  onChange={(e) => setLogNotes(e.target.value)}
                  className="w-full rounded-xl border border-[#EDE4D5] p-2.5 text-xs text-[#2C1B10] focus:ring-2 focus:ring-[#E87A18] focus:outline-none"
                />
              </div>
            </div>

            <DialogFooter className="pt-3 border-t border-[#EDE4D5] flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLogModalOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={isSubmittingLog}
                loadingText="Recording..."
              >
                {t("common.save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ======================= REPAY LOAN MODAL ======================= */}
      <Dialog open={!!payingLoan} onOpenChange={(open) => !open && setPayingLoan(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-[#EDE4D5]">
          {payingLoan && (() => {
            const info = parseOwnerLoanEntity(payingLoan.entityId);
            return (
              <form onSubmit={handlePayLoan}>
                <DialogHeader className="pb-3 border-b border-[#EDE4D5]">
                  <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
                      <DollarSign className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <span>{t("ownerLoans.modalPayTitle")}</span>
                  </DialogTitle>
                  <p className="text-xs text-[#8C7361] mt-1">{t("ownerLoans.modalPayDesc")}</p>
                </DialogHeader>

                {/* Loan Context Card */}
                <div className="bg-[#FAF6F0] rounded-2xl p-4 my-4 border border-[#EDE4D5] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#8C7361]">Lent From:</span>
                    <span className="font-extrabold text-[#2C1B10] truncate max-w-[200px]">
                      {info.lender}
                    </span>
                  </div>
                  {info.reason && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#8C7361]">Reason:</span>
                      <span className="font-semibold text-[#4A2E1B] truncate max-w-[200px]">
                        {info.reason}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#8C7361]">Original Loan:</span>
                    <span className="font-mono font-bold text-[#2C1B10]">
                      {Number(payingLoan.totalAmount).toLocaleString()} ETB
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-[#EDE4D5]/80">
                    <span className="font-black text-rose-700">Current Balance Due:</span>
                    <span className="font-mono font-black text-base text-rose-700">
                      {Number(payingLoan.remainingBalance).toLocaleString()} ETB
                    </span>
                  </div>
                </div>

                <div className="space-y-4 py-1">
                  {/* Repayment Amount */}
                  <div>
                    <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                      {t("ownerLoans.fieldPayAmount")} *
                    </label>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="1"
                        max={Number(payingLoan.remainingBalance)}
                        required
                        placeholder="e.g. 5000"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        className="h-11 rounded-xl border-[#EDE4D5] font-mono text-base font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500 pr-12"
                      />
                      <span className="absolute right-3.5 top-3 text-xs font-bold text-[#8C7361]">ETB</span>
                    </div>

                    {/* Quick Shortcut Buttons */}
                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setPayAmount(String(payingLoan.remainingBalance))}
                        className="flex-1 py-1 px-2.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold hover:bg-emerald-100 transition-colors"
                      >
                        {t("ownerLoans.quickPayFull", { amount: Number(payingLoan.remainingBalance).toLocaleString() })}
                      </button>
                      {Number(payingLoan.remainingBalance) > 100 && (
                        <button
                          type="button"
                          onClick={() => setPayAmount(String(Math.round(Number(payingLoan.remainingBalance) / 2)))}
                          className="py-1 px-2.5 rounded-lg bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] text-xs font-bold hover:bg-[#F4ECE1] transition-colors"
                        >
                          {t("ownerLoans.quickPayHalf", { amount: Math.round(Number(payingLoan.remainingBalance) / 2).toLocaleString() })}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Payment Date */}
                  <div>
                    <label className="text-xs font-bold text-[#4A2E1B] block mb-1 uppercase tracking-wider">
                      {t("ownerLoans.fieldPayDate")} *
                    </label>
                    <Input
                      type="date"
                      required
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="h-11 rounded-xl border-[#EDE4D5] text-xs sm:text-sm font-semibold"
                    />
                  </div>
                </div>

                <DialogFooter className="pt-4 border-t border-[#EDE4D5] flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setPayingLoan(null)}
                  >
                    {t("common.cancel")}
                  </Button>
                  <Button
                    type="submit"
                    variant="success"
                    loading={isSubmittingPay}
                    loadingText="Saving..."
                  >
                    Confirm Repayment
                  </Button>
                </DialogFooter>
              </form>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ======================= PAYMENT HISTORY MODAL ======================= */}
      <Dialog open={!!historyLoan} onOpenChange={(open) => !open && setHistoryLoan(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6 bg-white border border-[#EDE4D5]">
          {historyLoan && (() => {
            const info = parseOwnerLoanEntity(historyLoan.entityId);
            return (
              <div>
                <DialogHeader className="pb-3 border-b border-[#EDE4D5]">
                  <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
                    <div className="p-2 rounded-xl bg-[#FAF6F0] text-[#E87A18]">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span>{t("ownerLoans.modalHistoryTitle")}</span>
                  </DialogTitle>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-[#8C7361]">
                    <span className="font-bold text-[#2C1B10]">{info.lender}</span>
                    {info.reason && <span>• {info.reason}</span>}
                  </div>
                </DialogHeader>

                <div className="my-4 max-h-[50vh] overflow-y-auto space-y-2">
                  {(!historyLoan.payments || historyLoan.payments.length === 0) ? (
                    <div className="text-center py-8 text-[#8C7361]">
                      <Clock className="w-8 h-8 mx-auto mb-2 text-[#CBB29F]" />
                      <p className="text-xs font-semibold">No payments recorded yet against this loan.</p>
                    </div>
                  ) : (
                    historyLoan.payments.map((p, idx) => (
                      <div
                        key={p.id || idx}
                        className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-black">
                            #{idx + 1}
                          </div>
                          <div>
                            <p className="font-bold text-xs text-[#2C1B10]">
                              {formatEthDate(p.date || p.createdAt)}
                            </p>
                            <p className="text-[10px] text-[#8C7361]">
                              {format(new Date(p.date || p.createdAt), "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="font-mono font-black text-sm text-emerald-700">
                            +{Number(p.amountPaid).toLocaleString()} ETB
                          </span>
                          <span className="block text-[10px] font-bold text-[#8C7361] uppercase">PAID</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Summary Bottom Bar */}
                <div className="pt-3 border-t border-[#EDE4D5] flex items-center justify-between text-xs">
                  <span className="font-bold text-[#8C7361]">Remaining Due:</span>
                  <span className="font-mono font-black text-sm text-rose-600">
                    {Number(historyLoan.remainingBalance).toLocaleString()} ETB
                  </span>
                </div>

                <div className="pt-3 text-right">
                  <Button
                    onClick={() => setHistoryLoan(null)}
                    variant="brand"
                    size="sm"
                  >
                    {t("common.close")}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteLoanId}
        onClose={() => setDeleteLoanId(null)}
        onConfirm={handleConfirmDeleteLoan}
        title={t("ownerLoans.modalDeleteTitle") || "Delete Loan Record?"}
        description={t("ownerLoans.confirmDelete") || "Are you sure you want to delete this personal loan record? This action cannot be undone."}
        confirmText={t("common.delete") || "Delete"}
        isLoading={isDeletingLoan}
        variant="danger"
      />
    </DashboardLayout>
  );
}
