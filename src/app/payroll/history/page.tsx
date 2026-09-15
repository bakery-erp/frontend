"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Edit2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { PayrollNav } from "../PayrollNav";
import { formatEthDate, getEthMonthName } from "@/lib/ethiopianDate";

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
}

interface PayrollRecord {
  id: string;
  userId: string;
  month: number;
  year: number;
  baseSalary: number;
  loanDeductions: number;
  penaltyDeductions: number;
  bonus: number;
  finalAmount: number;
  paymentDate: string | null;
  status?: string;
  user?: User;
}

export default function PayrollHistoryPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, [selectedBranchId]);

  const fetchHistory = async () => {
    try {
      setIsLoading(true);
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/payroll", { params });
      setHistory(data);
    } catch {
      toast.error("Failed to load payroll execution history");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePayroll = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingPayroll) return;
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.patch(`/payroll/${editingPayroll.id}`, {
        baseSalary: fd.get("baseSalary"),
        bonus: fd.get("bonus"),
        loanDeductions: fd.get("loanDeductions"),
        penaltyDeductions: fd.get("penaltyDeductions"),
        finalAmount: fd.get("finalAmount"),
        paymentDate: fd.get("paymentDate") || null,
      });
      toast.success("Payroll record updated successfully");
      setIsEditOpen(false);
      setEditingPayroll(null);
      fetchHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update payroll record");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            Payroll Execution History
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Audit history of all processed monthly salary payouts & payslips
          </p>
        </div>
        <PayrollNav />
      </div>

      {/* Mobile Cards View (block md:hidden) */}
      <div className="block md:hidden space-y-3">
        {isLoading ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
            Loading payroll history...
          </div>
        ) : history.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
            No payroll execution records found.
          </div>
        ) : (
          history.map((r) => (
            <div key={r.id} className="bg-white rounded-2xl p-3.5 sm:p-4 border border-[#EDE4D5] shadow-xs space-y-3 overflow-hidden">
              <div className="flex items-start justify-between gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-[#2C1B10] text-sm sm:text-base truncate">{r.user?.fullName}</h3>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-[#8C7361] font-medium">{r.user?.role}</span>
                    <span className="text-xs text-[#8C7361]">•</span>
                    <span className="text-xs font-bold text-[#E87A18]">
                      {getEthMonthName(r.month)} {r.year}
                    </span>
                  </div>
                </div>
                <Badge className={`text-[10px] font-bold shrink-0 px-2 py-0.5 ${
                  r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                  r.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                  'bg-amber-100 text-amber-800 border-amber-300'
                }`}>
                  {r.status === 'APPROVED' ? 'APPROVED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Base Salary</span>
                  <span className="font-bold text-[#2C1B10] font-mono">{r.baseSalary} ETB</span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Bonus</span>
                  <span className="font-bold text-emerald-700 font-mono">
                    {r.bonus > 0 ? `+${r.bonus} ETB` : "0.00 ETB"}
                  </span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Total Deductions</span>
                  <span className="font-bold text-rose-700 font-mono">
                    -{Number(r.loanDeductions) + Number(r.penaltyDeductions)} ETB
                  </span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Final Net Paid</span>
                  <span className="font-extrabold text-emerald-700 text-sm font-mono">{r.finalAmount} ETB</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-zinc-100 text-xs text-[#8C7361]">
                <span className="text-[11px] sm:text-xs">Paid: {formatEthDate(r.paymentDate, true)}</span>
                {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingPayroll(r);
                      setIsEditOpen(true);
                    }}
                    className="h-8 px-3 text-xs font-bold text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0]"
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (hidden md:block) */}
      <div className="hidden md:block bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">Payroll Term (Ethiopian)</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Employee</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Base Salary</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Bonus</TableHead>
              <TableHead className="font-extrabold text-rose-700">Deductions</TableHead>
              <TableHead className="font-extrabold text-emerald-700">Final Net Paid</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Payment Date (Eth)</TableHead>
              <TableHead className="font-extrabold text-center text-[#2C1B10]">Worker Approval</TableHead>
              {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-[#8C7361] font-medium">
                  Loading payroll history...
                </TableCell>
              </TableRow>
            ) : history.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-[#8C7361] font-medium">
                  No payroll execution records found.
                </TableCell>
              </TableRow>
            ) : (
              history.map((r) => (
                <TableRow key={r.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="font-extrabold text-[#2C1B10]">
                    {getEthMonthName(r.month)} {r.year}
                  </TableCell>
                  <TableCell>
                    <span className="font-bold text-[#2C1B10]">{r.user?.fullName}</span>{" "}
                    <span className="text-xs text-[#8C7361] font-semibold">({r.user?.role})</span>
                  </TableCell>
                  <TableCell className="font-semibold text-[#2C1B10]">
                    {r.baseSalary} ETB
                  </TableCell>
                  <TableCell className="text-emerald-700 font-bold">
                    {r.bonus > 0 ? (
                      <Badge variant="secondary" className="shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-800 border-emerald-200">
                        +{r.bonus} ETB
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="text-rose-700 font-bold">
                    -{Number(r.loanDeductions) + Number(r.penaltyDeductions)} ETB
                  </TableCell>
                  <TableCell className="font-extrabold text-emerald-700 text-sm font-mono">
                    {r.finalAmount} ETB
                  </TableCell>
                  <TableCell className="text-xs font-semibold text-[#8C7361]">
                    {formatEthDate(r.paymentDate, true)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className={`text-[10px] font-bold ${
                      r.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      r.status === 'REJECTED' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                      'bg-amber-100 text-amber-800 border-amber-300'
                    }`}>
                      {r.status === 'APPROVED' ? 'APPROVED' : r.status === 'REJECTED' ? 'REJECTED' : 'PENDING'}
                    </Badge>
                  </TableCell>
                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPayroll(r);
                          setIsEditOpen(true);
                        }}
                        className="font-bold text-xs text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                      >
                        <Edit2 className="w-3.5 h-3.5 mr-1" /> Edit
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Payroll Modal */}
      {isEditOpen && editingPayroll && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsEditOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">Edit Payroll Execution Record</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdatePayroll} className="space-y-3.5 py-2">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1">Base Salary (ETB)</label>
                <Input
                  name="baseSalary"
                  type="number"
                  step="0.01"
                  defaultValue={editingPayroll.baseSalary}
                  onFocus={(e) => e.target.select()}
                  required
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1">Bonus (ETB)</label>
                <Input
                  name="bonus"
                  type="number"
                  step="0.01"
                  defaultValue={editingPayroll.bonus}
                  onFocus={(e) => e.target.select()}
                  required
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1">Loan Deductions (ETB)</label>
                <Input
                  name="loanDeductions"
                  type="number"
                  step="0.01"
                  defaultValue={editingPayroll.loanDeductions}
                  onFocus={(e) => e.target.select()}
                  required
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1">Penalty Deductions (ETB)</label>
                <Input
                  name="penaltyDeductions"
                  type="number"
                  step="0.01"
                  defaultValue={editingPayroll.penaltyDeductions}
                  onFocus={(e) => e.target.select()}
                  required
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1">Final Net Payout (ETB)</label>
                <Input
                  name="finalAmount"
                  type="number"
                  step="0.01"
                  defaultValue={editingPayroll.finalAmount}
                  onFocus={(e) => e.target.select()}
                  required
                  className="h-10 rounded-xl border-zinc-200 font-mono"
                />
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
