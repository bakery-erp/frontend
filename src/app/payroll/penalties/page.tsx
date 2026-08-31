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

  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<Penalty | null>(null);
  const [isEditPenaltyOpen, setIsEditPenaltyOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchPenalties();
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

  const fetchPenalties = async () => {
    try {
      setIsLoading(true);
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/penalties", { params });
      setPenalties(data);
    } catch {
      toast.error("Failed to load penalties");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddPenalty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/penalties", {
        userId: fd.get("userId"),
        amount: fd.get("amount"),
        reason: fd.get("reason"),
        date: fd.get("date"),
      });
      toast.success("Penalty logged successfully. Awaiting employee review.");
      setIsPenaltyOpen(false);
      fetchPenalties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add penalty");
    } finally {
      setIsSubmitting(false);
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
      toast.success("Penalty updated successfully");
      setIsEditPenaltyOpen(false);
      setEditingPenalty(null);
      fetchPenalties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update penalty");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getApprovalBadge = (status?: string) => {
    switch (status) {
      case "APPROVED":
        return (
          <Badge className="bg-emerald-100 text-emerald-900 border-emerald-300 font-extrabold text-xs inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> ACKNOWLEDGED / APPROVED
          </Badge>
        );
      case "REJECTED":
        return (
          <Badge className="bg-rose-100 text-rose-900 border-rose-300 font-extrabold text-xs inline-flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-rose-600" /> REJECTED BY STAFF
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
            Workforce Penalties & Fines
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Log infraction fines, salary deductions, and employee approval responses
          </p>
        </div>
        <PayrollNav />
      </div>

      <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
          <div>
            <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Workforce Penalties</h2>
            <p className="text-xs text-[#8C7361] mt-0.5">View and edit administrative infraction fines and employee response status</p>
          </div>
          <Button onClick={() => setIsPenaltyOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs shadow-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Log Penalty
          </Button>
        </div>
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">Date Filed (Eth)</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Employee</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Violation Reason</TableHead>
              <TableHead className="font-extrabold text-rose-700">Penalty Fine</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Employee Approval Status</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Deduction Status</TableHead>
              {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  Loading workforce penalties...
                </TableCell>
              </TableRow>
            ) : penalties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-[#8C7361] font-medium">
                  No active penalties logged.
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
                  <TableCell className="font-extrabold text-rose-700">
                    -{p.amount} ETB
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
                      {p.isDeducted ? "✓ DEDUCTED / SETTLED" : "⚠ PENDING DEDUCTION"}
                    </Badge>
                  </TableCell>
                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                    <TableCell className="text-right pr-6">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingPenalty(p);
                          setIsEditPenaltyOpen(true);
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

      {/* CREATE PENALTY DIALOG */}
      <Dialog open={isPenaltyOpen} onOpenChange={setIsPenaltyOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleAddPenalty}>
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">Log Penalty Fine</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Penalized Employee</label>
                <select name="userId" required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                  <option value="">Select Employee...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Fine Amount (ETB)</label>
                <Input name="amount" type="number" step="0.01" min="1" required placeholder="e.g. 200" className="rounded-xl border-zinc-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Infraction Reason</label>
                <Input name="reason" required placeholder="e.g. Late arrival, Broken inventory item" className="rounded-xl border-zinc-200" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Infraction Date</label>
                <Input name="date" type="date" required defaultValue={new Date().toISOString().split("T")[0]} className="rounded-xl border-zinc-200" />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setIsPenaltyOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                {isSubmitting ? "Logging..." : "Log Penalty"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PENALTY DIALOG */}
      {isEditPenaltyOpen && editingPenalty && (
        <Dialog open={true} onOpenChange={(open) => !open && setIsEditPenaltyOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl">
            <form onSubmit={handleUpdatePenalty}>
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">Edit Penalty Record</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Fine Amount (ETB)</label>
                  <Input name="amount" type="number" step="0.01" defaultValue={editingPenalty.amount} required className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Reason</label>
                  <Input name="reason" defaultValue={editingPenalty.reason} required className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Date</label>
                  <Input name="date" type="date" defaultValue={editingPenalty.date.split("T")[0]} required className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Employee Approval Status</label>
                  <select name="status" defaultValue={editingPenalty.status || "PENDING_APPROVAL"} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="PENDING_APPROVAL">⏳ PENDING_APPROVAL (Awaiting Employee Review)</option>
                    <option value="APPROVED">✓ APPROVED (Employee Acknowledged)</option>
                    <option value="REJECTED">✕ REJECTED (Rejected by Staff Member)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Deduction Status</label>
                  <select name="isDeducted" defaultValue={editingPenalty.isDeducted ? "true" : "false"} required className="w-full h-10 border border-zinc-200 rounded-xl px-3 text-sm bg-white">
                    <option value="false">⚠ PENDING DEDUCTION</option>
                    <option value="true">✓ DEDUCTED / SETTLED</option>
                  </select>
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditPenaltyOpen(false)} className="rounded-xl">Cancel</Button>
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
