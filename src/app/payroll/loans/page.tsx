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

  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-xs inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> APPROVED BY STAFF
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-900 border-rose-300 font-extrabold text-xs inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> REJECTED BY STAFF
          </Badge>
        );
      case "PAID":
        return (
          <Badge className="bg-blue-100 text-blue-900 border-blue-300 font-extrabold text-xs inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" /> FULLY PAID
          </Badge>
        );
      case "PENDING_APPROVAL":
      default:
        return (
          <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-extrabold text-xs inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-amber-600" /> PENDING STAFF REVIEW
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            Loans & Advances
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Track multi-month staff loans, salary advances, and employee approval status
          </p>
        </div>
        <PayrollNav />
      </div>

      <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
          <div>
            <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Loans</h2>
            <p className="text-xs text-[#8C7361] mt-0.5">Track and edit staff micro-loans, advances, and employee approval status</p>
          </div>
          <Button onClick={() => setIsLoanOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Dispatch Loan
          </Button>
        </div>
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">Date Issued (Eth)</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Employee</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Loan Type</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Original Amount</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Remaining Balance</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Employee Approval Status</TableHead>
              {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  Loading employee loans...
                </TableCell>
              </TableRow>
            ) : loans.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  No employee loans currently recorded.
                </TableCell>
              </TableRow>
            ) : (
              loans.map((l) => (
                <TableRow key={l.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="text-xs font-semibold text-[#8C7361]">
                    {formatEthDate(l.createdAt)}
                  </TableCell>
                  <TableCell className="font-bold text-[#2C1B10]">
                    {l.user?.fullName}
                  </TableCell>
                  <TableCell>
                    <Badge className={`font-bold text-xs ${l.type === "STAFF_LOAN" ? "bg-blue-100 text-blue-800 border-blue-200" : "bg-amber-100 text-amber-900 border-amber-200"}`}>
                      {l.type === "STAFF_LOAN" ? "Multi-Month Staff Loan" : "Salary Advance"}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-semibold text-[#8C7361]">{l.totalAmount} ETB</TableCell>
                  <TableCell className="font-extrabold text-[#2C1B10]">
                    {l.remainingBalance} ETB
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

      {/* CREATE LOAN DIALOG */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleAddLoan}>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">Dispatch Micro-Loan / Advance</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Receiving Employee</label>
                <select name="userId" required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                  <option value="">Select Target Employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Loan Classification</label>
                <select name="type" required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                  <option value="STAFF_LOAN">Staff Loan (Multi-Month Installment)</option>
                  <option value="SALARY_ADVANCE">Salary Advance</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Total Dispatched Amount (ETB)</label>
                <Input name="amount" type="number" step="0.01" min="1" required placeholder="e.g. 1500" className="rounded-xl border-zinc-200" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsLoanOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                {isSubmitting ? "Dispatching..." : "Dispatch Loan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT LOAN DIALOG */}
      {isEditLoanOpen && editingLoan && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsEditLoanOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl">
            <form onSubmit={handleUpdateLoan}>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">Edit Loan Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Total Original Amount (ETB)</label>
                  <Input name="totalAmount" type="number" step="0.01" defaultValue={editingLoan.totalAmount} required className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Remaining Unpaid Balance (ETB)</label>
                  <Input name="remainingBalance" type="number" step="0.01" defaultValue={editingLoan.remainingBalance} required className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Loan Approval & Settlement Status</label>
                  <select name="status" defaultValue={editingLoan.status} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="PENDING_APPROVAL">⏳ PENDING_APPROVAL (Awaiting Employee Review)</option>
                    <option value="OPEN">✓ OPEN / APPROVED (Active Monthly Deduction)</option>
                    <option value="REJECTED">✕ REJECTED (Rejected by Staff Member)</option>
                    <option value="PAID">✓ PAID (Fully Settled)</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditLoanOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
