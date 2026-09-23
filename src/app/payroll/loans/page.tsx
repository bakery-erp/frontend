"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Plus, Edit2, CheckCircle2, XCircle, Clock, Search, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PayrollNav } from "../PayrollNav";
import { formatEthDate } from "@/lib/ethiopianDate";
import { useLanguage } from "@/context/LanguageContext";

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
}

interface Loan {
  id: string;
  userId: string;
  totalAmount: number;
  remainingBalance: number;
  type: string;
  status: string;
  createdAt: string;
  user?: User;
}

export default function PayrollLoansPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();

  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");

  const filteredLoans = loans.filter((l) => {
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchName = l.user?.fullName?.toLowerCase().includes(q);
      const matchPhone = l.user?.phone?.includes(q);
      if (!matchName && !matchPhone) return false;
    }
    if (statusFilter !== "ALL" && l.status !== statusFilter) {
      return false;
    }
    if (typeFilter !== "ALL" && l.type !== typeFilter) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = searchTerm.trim() !== "" || statusFilter !== "ALL" || typeFilter !== "ALL";

  useEffect(() => {
    fetchLoans();
    fetchUsers();
  }, [selectedBranchId]);

  const fetchUsers = async () => {
    try {
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/users", { params });
      setUsers(data.filter((u: User) => u.role !== "OWNER"));
    } catch {
      console.error("Failed to load users");
    }
  };

  const fetchLoans = async () => {
    try {
      setIsLoading(true);
      const params: any = { type: "STAFF" };
      if (selectedBranchId) params.branchId = selectedBranchId;
      const { data } = await api.get("/loans", { params });
      setLoans(data);
    } catch {
      toast.error("Failed to load loans");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/loans", {
        type: fd.get("type") || "STAFF_LOAN",
        userId: fd.get("userId"),
        totalAmount: fd.get("amount"),
      });
      toast.success("Loan recorded successfully. Awaiting employee approval.");
      setIsLoanOpen(false);
      fetchLoans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add loan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingLoan) return;
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.patch(`/loans/${editingLoan.id}`, {
        totalAmount: fd.get("totalAmount"),
        remainingBalance: fd.get("remainingBalance"),
        status: fd.get("status"),
      });
      toast.success("Loan updated successfully");
      setIsEditLoanOpen(false);
      setEditingLoan(null);
      fetchLoans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update loan");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">{t('payroll.approvedByStaff')}</span>
            <span className="sm:hidden">{t('common.approved')}</span>
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-900 border-rose-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span className="hidden sm:inline">{t('payroll.rejectedByStaff')}</span>
            <span className="sm:hidden">{t('common.rejected')}</span>
          </Badge>
        );
      case "PAID":
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="hidden sm:inline">{t('common.paidInFull')}</span>
            <span className="sm:hidden">{t('common.paid')}</span>
          </Badge>
        );
      case "PENDING_APPROVAL":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">{t('payroll.pendingReview')}</span>
            <span className="sm:hidden">{t('common.pending')}</span>
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            {t('payroll.loansTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            {t('payroll.loansSubtitle')}
          </p>
        </div>
        <PayrollNav />
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#8C7361]" />
            <Input
              placeholder="Search by staff name or phone..."
              className="pl-9 h-10 rounded-xl border-[#EDE4D5] bg-[#FAF6F0]/50 text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-10 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/50 px-3 text-xs sm:text-sm font-semibold text-[#2C1B10] focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open (Approved)</option>
              <option value="PENDING_APPROVAL">Pending Review</option>
              <option value="PAID">Fully Repaid</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Type Filter */}
          <div className="w-full sm:w-44">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-10 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/50 px-3 text-xs sm:text-sm font-semibold text-[#2C1B10] focus:outline-none"
            >
              <option value="ALL">All Types</option>
              <option value="STAFF_LOAN">Staff Loan</option>
              <option value="SALARY_ADVANCE">Salary Advance</option>
            </select>
          </div>

          {/* Reset Filters */}
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchTerm("");
                setStatusFilter("ALL");
                setTypeFilter("ALL");
              }}
              className="h-10 px-3 border-[#EDE4D5] text-[#8C7361] hover:text-[#4A2E1B] rounded-xl text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Cards View (block md:hidden) */}
      <div className="block md:hidden space-y-3">
        <div className="p-3 bg-[#FAF6F0] rounded-2xl border border-[#EDE4D5] flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-xs text-[#2C1B10] uppercase tracking-wider">{t('payroll.loansTitle')}</h2>
            <p className="text-[11px] text-[#8C7361]">{t('payroll.allRecordedLoans', { count: loans.length })}</p>
          </div>
          <Button onClick={() => setIsLoanOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs h-8 px-3 shadow-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('payroll.dispatchLoan')}
          </Button>
        </div>

        {isLoading ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
            {t('payroll.loadingLoans')}
          </div>
        ) : filteredLoans.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
            {loans.length === 0 ? t('payroll.emptyLoans') : "No loans match the selected filters."}
          </div>
        ) : (
          filteredLoans.map((l) => (
            <div key={l.id} className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#EDE4D5] shadow-xs space-y-3 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[#2C1B10] text-sm sm:text-base truncate">{l.user?.fullName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <Badge className={`font-bold text-[10px] shrink-0 ${l.type === "STAFF_LOAN" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-amber-100 text-amber-900 border-amber-200"}`}>
                      {l.type === "STAFF_LOAN" ? t('payroll.staffLoan') : t('payroll.salaryAdvance')}
                    </Badge>
                    <span className="text-[11px] text-[#8C7361] whitespace-nowrap">• {formatEthDate(l.createdAt)}</span>
                  </div>
                </div>
                {getApprovalBadge(l.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs bg-[#FAF6F0] rounded-xl p-2.5">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('payroll.colLoanAmount')}</span>
                  <span className="font-bold text-[#2C1B10] font-mono">{l.totalAmount} {t('common.currency')}</span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('payroll.colRemainingBalance')}</span>
                  <span className="font-extrabold text-rose-600 text-sm font-mono">{l.remainingBalance} {t('common.currency')}</span>
                </div>
              </div>

              {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                <div className="pt-2 border-t border-zinc-100 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingLoan(l);
                      setIsEditLoanOpen(true);
                    }}
                    className="w-full h-8 text-xs font-bold text-blue-700 border-blue-200 hover:bg-blue-50"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> {t('payroll.editLoan')}
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
          <div>
            <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">{t('payroll.loansTitle')}</h2>
            <p className="text-xs text-[#8C7361] mt-0.5">{t('payroll.loansSubtitle')}</p>
          </div>
          <Button onClick={() => setIsLoanOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" /> {t('payroll.dispatchLoan')}
          </Button>
        </div>
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('common.date')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('payroll.colStaffMember')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('profile.type')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('payroll.colLoanAmount')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('payroll.colRemainingBalance')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('common.status')}</TableHead>
              {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  {t('payroll.loadingLoans')}
                </TableCell>
              </TableRow>
            ) : filteredLoans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  {loans.length === 0 ? t('payroll.emptyLoans') : "No loans match the selected filters."}
                </TableCell>
              </TableRow>
            ) : (
              filteredLoans.map((l) => (
                <TableRow key={l.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="text-xs font-semibold text-[#8C7361]">
                    {formatEthDate(l.createdAt)}
                  </TableCell>
                  <TableCell className="font-bold text-[#2C1B10]">
                    {l.user?.fullName}
                  </TableCell>
                  <TableCell>
                    <Badge className={`font-bold text-xs ${l.type === "STAFF_LOAN" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-amber-100 text-amber-900 border-amber-200"}`}>
                      {l.type === "STAFF_LOAN" ? t('payroll.staffLoan') : t('payroll.salaryAdvance')}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-[#8C7361] font-mono">{l.totalAmount} {t('common.currency')}</TableCell>
                  <TableCell className="font-extrabold text-[#2C1B10] font-mono">
                    {l.remainingBalance} {t('common.currency')}
                  </TableCell>
                  <TableCell>
                    {getApprovalBadge(l.status)}
                  </TableCell>
                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingLoan(l);
                          setIsEditLoanOpen(true);
                        }}
                        className="font-bold text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> {t('common.edit')}
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* CREATE LOAN DIALOG */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAddLoan}>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">{t('payroll.dispatchLoan')}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3.5 py-3">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.targetEmployee')}</label>
                <select name="userId" required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                  <option value="">{t('payroll.selectEmployeePlaceholder')}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('profile.type')}</label>
                <select name="type" required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                  <option value="STAFF_LOAN">{t('payroll.staffLoan')}</option>
                  <option value="SALARY_ADVANCE">{t('payroll.salaryAdvance')}</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.colLoanAmount')} ({t('common.currency')})</label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="e.g. 1500"
                  onFocus={(e) => e.target.select()}
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto h-11 sm:h-10 bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
              >
                {isSubmitting ? t('common.loading') : t('payroll.dispatchLoan')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsLoanOpen(false)}
                className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
              >
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT LOAN DIALOG */}
      {isEditLoanOpen && editingLoan && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsEditLoanOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleUpdateLoan}>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">{t('payroll.editLoan')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3.5 py-3">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.colLoanAmount')} ({t('common.currency')})</label>
                  <Input
                    name="totalAmount"
                    type="number"
                    step="0.01"
                    defaultValue={editingLoan.totalAmount}
                    onFocus={(e) => e.target.select()}
                    required
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.colRemainingBalance')} ({t('common.currency')})</label>
                  <Input
                    name="remainingBalance"
                    type="number"
                    step="0.01"
                    defaultValue={editingLoan.remainingBalance}
                    onFocus={(e) => e.target.select()}
                    required
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.status')}</label>
                  <select name="status" defaultValue={editingLoan.status} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="PENDING_APPROVAL">⏳ {t('payroll.pendingReview')}</option>
                    <option value="OPEN">✓ {t('payroll.approvedByStaff')}</option>
                    <option value="REJECTED">✕ {t('payroll.rejectedByStaff')}</option>
                    <option value="PAID">✓ {t('common.paidInFull')}</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? t('common.loading') : t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditLoanOpen(false)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
