"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Plus, Edit2, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PayrollNav } from "../PayrollNav";
import { formatEthDate } from "@/lib/ethiopianDate";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationControls } from "@/components/ui/PaginationControls";

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
}

interface Penalty {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  date: string;
  isDeducted: boolean;
  status?: string;
  user?: User;
}

export default function PayrollPenaltiesPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<Penalty | null>(null);
  const [isEditPenaltyOpen, setIsEditPenaltyOpen] = useState(false);
  const [penaltyToSign, setPenaltyToSign] = useState<Penalty | null>(null);
  const [isSigning, setIsSigning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranchId]);

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["payroll-penalties-users", selectedBranchId],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/users", { params });
      return (data || []).filter((u: User) => u.role !== "OWNER");
    },
  });

  const { data: penaltiesResult, isLoading } = useQuery<{ items: Penalty[]; meta?: any }>({
    queryKey: ["payroll-penalties", selectedBranchId, currentPage],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: any = {
        page: currentPage,
        limit: pageSize,
      };
      if (selectedBranchId) params.branchId = selectedBranchId;
      const { data } = await api.get("/penalties", { params });
      return data;
    },
  });

  const penalties: Penalty[] = penaltiesResult?.items || (Array.isArray(penaltiesResult) ? penaltiesResult : []);
  const meta = penaltiesResult?.meta;

  const handleAddPenalty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    const isSigned = fd.get("isSigned") === "on";
    try {
      await api.post("/penalties", {
        userId: fd.get("userId"),
        amount: fd.get("amount"),
        reason: fd.get("reason"),
        date: fd.get("date"),
        isSigned,
      });
      toast.success(isSigned ? (t('payroll.markedSignedSuccess') || "Penalty recorded as signed") : t('common.success'));
      setIsPenaltyOpen(false);
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprovePenalty = async (id: string) => {
    try {
      await api.post(`/penalties/${id}/approve`);
      toast.success(t('payroll.markedSignedSuccess') || "Marked as signed successfully");
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || t('common.error'));
    }
  };

  const handleUpdatePenalty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPenalty) return;
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.patch(`/penalties/${editingPenalty.id}`, {
        amount: fd.get("amount"),
        reason: fd.get("reason"),
        date: fd.get("date"),
        isDeducted: fd.get("isDeducted") === "true",
        status: fd.get("status"),
      });
      toast.success(t('common.success'));
      setIsEditPenaltyOpen(false);
      setEditingPenalty(null);
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-penalties"] });
      queryClient.invalidateQueries({ queryKey: ["payroll"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('common.error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden sm:inline">✍️ {t('payroll.signedOnPaper')}</span>
            <span className="sm:hidden">✍️ {t('common.approved')}</span>
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
      case "PENDING_APPROVAL":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-[10px] sm:text-xs inline-flex items-center gap-1 shrink-0 px-2 sm:px-2.5 py-0.5">
            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
            <span className="hidden sm:inline">⏳ {t('payroll.pendingPaperSignature')}</span>
            <span className="sm:hidden">⏳ {t('common.pending')}</span>
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            {t('payroll.penaltiesTitle')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            {t('payroll.penaltiesSubtitle')}
          </p>
        </div>
        <PayrollNav />
      </div>

      {/* Mobile Cards View (block md:hidden) */}
      <div className="block md:hidden space-y-3">
        <div className="p-3 bg-[#FAF6F0] rounded-2xl border border-[#EDE4D5] flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-xs text-[#2C1B10] uppercase tracking-wider">{t('payroll.penaltiesTitle')}</h2>
            <p className="text-[11px] text-[#8C7361]">{t('payroll.allRecordedPenalties', { count: penalties.length })}</p>
          </div>
          <Button onClick={() => setIsPenaltyOpen(true)} size="sm">
            <Plus className="w-3.5 h-3.5 mr-1" /> {t('payroll.logPenalty')}
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
                <div className="flex justify-between items-center pb-2 border-b border-[#F4ECE1]">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : penalties.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
            {t('payroll.emptyPenalties')}
          </div>
        ) : (
          penalties.map((p) => (
            <div key={p.id} className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#EDE4D5] shadow-xs space-y-3 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[#2C1B10] text-sm sm:text-base truncate">{p.user?.fullName}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-[#8C7361]">{formatEthDate(p.date)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="font-extrabold text-rose-600 text-sm sm:text-base font-mono">-{p.amount} {t('common.currency')}</span>
                </div>
              </div>

              <div className="p-2.5 bg-[#FAF6F0] rounded-xl text-xs">
                <span className="text-[#8C7361] block text-[10px] uppercase font-bold">{t('common.reason')}</span>
                <p className="font-semibold text-[#2C1B10] mt-0.5">{p.reason}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2 border-t border-zinc-100">
                <div className="flex flex-wrap items-center gap-1">
                  {getApprovalBadge(p.status)}
                  <Badge
                    className={`font-bold text-[10px] ${
                      p.isDeducted
                        ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                        : "bg-rose-100 text-rose-800 border-rose-300"
                    }`}
                  >
                    {p.isDeducted ? `✓ ${t('common.deducted')}` : `⚠ ${t('common.pendingSalary')}`}
                  </Badge>
                </div>

                {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                  <div className="flex items-center gap-2">
                    {p.status === "PENDING_APPROVAL" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPenaltyToSign(p)}
                        className="h-8 px-2.5 text-xs font-bold bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100"
                      >
                        ✍️ {t('payroll.markAsSigned')}
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingPenalty(p);
                        setIsEditPenaltyOpen(true);
                      }}
                      className="h-8 px-2.5 text-xs font-bold text-blue-700 border-blue-200 hover:bg-blue-50"
                    >
                      <Edit2 className="w-3 h-3 mr-1" /> {t('common.edit')}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
          <div>
            <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">{t('payroll.penaltiesTitle')}</h2>
            <p className="text-xs text-[#8C7361] mt-0.5">{t('payroll.penaltiesSubtitle')}</p>
          </div>
          <Button onClick={() => setIsPenaltyOpen(true)} size="sm">
            <Plus className="w-4 h-4 mr-1.5" /> {t('payroll.logPenalty')}
          </Button>
        </div>
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('common.date')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('payroll.colStaffMember')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('common.reason')}</TableHead>
              <TableHead className="font-extrabold text-rose-700">{t('payroll.colPenaltyAmount')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('common.status')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('profile.deductions')}</TableHead>
              {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, idx) => (
                <TableRow key={idx}>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto rounded-xl" /></TableCell>
                  )}
                </TableRow>
              ))
            ) : penalties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  {t('payroll.emptyPenalties')}
                </TableCell>
              </TableRow>
            ) : (
              penalties.map((p) => (
                <TableRow key={p.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="text-xs font-semibold text-[#8C7361]">
                    {formatEthDate(p.date)}
                  </TableCell>
                  <TableCell className="font-bold text-[#2C1B10]">
                    {p.user?.fullName}
                  </TableCell>
                  <TableCell className="text-xs text-[#8C7361] max-w-[220px] truncate" title={p.reason}>
                    {p.reason}
                  </TableCell>
                  <TableCell className="font-extrabold text-rose-700 font-mono">
                    -{p.amount} {t('common.currency')}
                  </TableCell>
                  <TableCell>
                    {getApprovalBadge(p.status)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={`font-bold text-xs ${
                        p.isDeducted
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}
                    >
                      {p.isDeducted ? `✓ ${t('common.deducted')}` : `⚠ ${t('common.pendingSalary')}`}
                    </Badge>
                  </TableCell>
                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                    <TableCell className="text-right pr-6 space-x-2 whitespace-nowrap">
                      {p.status === "PENDING_APPROVAL" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPenaltyToSign(p)}
                          className="font-bold text-xs bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100 shadow-2xs"
                        >
                          ✍️ {t('payroll.markAsSigned')}
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPenalty(p);
                          setIsEditPenaltyOpen(true);
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

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex justify-end">
          <PaginationControls
            currentPage={currentPage}
            totalPages={meta.totalPages}
            totalItems={meta.totalItems}
            pageSize={meta.limit}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* CREATE PENALTY DIALOG */}
      <Dialog open={isPenaltyOpen} onOpenChange={setIsPenaltyOpen}>
        <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleAddPenalty}>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">{t('payroll.logPenalty')}</DialogTitle>
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
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.colPenaltyAmount')} ({t('common.currency')})</label>
                <Input
                  name="amount"
                  type="number"
                  step="0.01"
                  min="1"
                  required
                  placeholder="e.g. 200"
                  onFocus={(e) => e.target.select()}
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.reason')}</label>
                <Input name="reason" required placeholder="e.g. Late arrival, Broken inventory item" className="h-10 rounded-xl border-zinc-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.date')}</label>
                <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="h-10 rounded-xl border-zinc-200" />
              </div>
              <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/70 border border-amber-200/60">
                <input
                  type="checkbox"
                  name="isSigned"
                  id="penaltyIsSigned"
                  defaultChecked
                  className="mt-0.5 w-4 h-4 rounded text-[#4A2E1B] focus:ring-[#4A2E1B] border-zinc-300"
                />
                <label htmlFor="penaltyIsSigned" className="text-xs text-[#2C1B10] cursor-pointer">
                  <span className="font-bold block">✍️ {t('payroll.signedCheckboxLabel')}</span>
                  <span className="text-[#8C7361] text-[11px] block">{t('payroll.signedCheckboxDesc')}</span>
                </label>
              </div>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <Button
                type="submit"
                size="lg"
                loading={isSubmitting}
                className="w-full sm:w-auto order-1 sm:order-2"
              >
                {t('payroll.logPenalty')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setIsPenaltyOpen(false)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PENALTY DIALOG */}
      {isEditPenaltyOpen && editingPenalty && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsEditPenaltyOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleUpdatePenalty}>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">{t('payroll.editPenalty')}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3.5 py-3">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('payroll.colPenaltyAmount')} ({t('common.currency')})</label>
                  <Input
                    name="amount"
                    type="number"
                    step="0.01"
                    defaultValue={editingPenalty.amount}
                    onFocus={(e) => e.target.select()}
                    required
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.reason')}</label>
                  <Input name="reason" defaultValue={editingPenalty.reason} required className="h-10 rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.date')}</label>
                  <Input name="date" type="date" defaultValue={editingPenalty.date.split("T")[0]} required className="h-10 rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.status')}</label>
                  <select name="status" defaultValue={editingPenalty.status || "PENDING_APPROVAL"} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="PENDING_APPROVAL">⏳ {t('payroll.pendingPaperSignature')}</option>
                    <option value="APPROVED">✍️ {t('payroll.signedOnPaper')}</option>
                    <option value="REJECTED">✕ {t('payroll.rejectedByStaff')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('profile.deductions')}</label>
                  <select name="isDeducted" defaultValue={editingPenalty.isDeducted ? "true" : "false"} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="false">⚠ {t('common.pendingSalary')}</option>
                    <option value="true">✓ {t('common.deducted')}</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  size="lg"
                  loading={isSubmitting}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {t('common.save')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => setIsEditPenaltyOpen(false)}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* CONFIRM PHYSICAL SIGNATURE DIALOG */}
      {penaltyToSign && (
        <Dialog open={true} onOpenChange={(open) => !open && setPenaltyToSign(null)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                ✍️ {t('payroll.confirmSignTitle')}
              </DialogTitle>
            </DialogHeader>
            <div className="py-3 text-sm text-[#4A2E1B] space-y-3">
              <p className="leading-relaxed">
                {t('payroll.confirmSignDesc').replace('{name}', penaltyToSign.user?.fullName || 'the employee')}
              </p>
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#EDE4D5] text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8C7361]">{t('payroll.colStaffMember')}:</span>
                  <strong className="text-[#2C1B10]">{penaltyToSign.user?.fullName}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361]">{t('common.reason')}:</span>
                  <strong className="text-[#2C1B10]">{penaltyToSign.reason}</strong>
                </div>
                <div className="flex justify-between border-t border-[#EDE4D5]/70 pt-1">
                  <span className="text-[#8C7361]">{t('payroll.colPenaltyAmount')}:</span>
                  <strong className="text-rose-700 font-mono font-black">-{penaltyToSign.amount} {t('common.currency')}</strong>
                </div>
              </div>
              <p className="text-xs text-[#8C7361]">
                Please ensure you have physically collected the signed paper infraction notice before confirming.
              </p>
            </div>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
              <Button
                type="button"
                size="lg"
                loading={isSigning}
                onClick={async () => {
                  if (!penaltyToSign) return;
                  setIsSigning(true);
                  try {
                    await api.post(`/penalties/${penaltyToSign.id}/approve`);
                    toast.success(t('payroll.markedSignedSuccess') || "Marked as signed successfully");
                    setPenaltyToSign(null);
                    queryClient.invalidateQueries({ queryKey: ["payroll-penalties-page"] });
                    queryClient.invalidateQueries({ queryKey: ["payroll-penalties"] });
                    queryClient.invalidateQueries({ queryKey: ["payroll"] });
                    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
                  } catch (err: any) {
                    toast.error(err.response?.data?.error || t('common.error'));
                  } finally {
                    setIsSigning(false);
                  }
                }}
                className="w-full sm:w-auto order-1 sm:order-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold"
              >
                ✍️ {t('payroll.confirmSignBtn')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSigning}
                onClick={() => setPenaltyToSign(null)}
                className="w-full sm:w-auto order-2 sm:order-1"
              >
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
