"use client";
import { EthDatePicker } from "@/components/EthDatePicker";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import {
  DollarSign,
  FileText,
  FileWarning,
  Wallet,
  Search,
  Plus,
  Calendar,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

import { EthDateTime } from "ethiopian-calendar-date-converter";

const ETH_MONTHS = [
  "Meskerem",
  "Tikimt",
  "Hidar",
  "Tahsas",
  "Tir",
  "Yakatit",
  "Maggabit",
  "Miyazya",
  "Ginbot",
  "Sene",
  "Hamle",
  "Nehase",
  "Pagume",
];

type Tab = "RUN" | "HISTORY" | "LOANS" | "PENALTIES";
type MonthEth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  salary?: number;
  createdAt?: string;
}
interface Penalty {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  date: string;
  isDeducted: boolean;
  user?: User;
}
interface Loan {
  id: string;
  userId: string;
  totalAmount: number;
  remainingBalance: number;
  status: string;
  createdAt: string;
  user?: User;
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
  paymentDate: string;
  user?: User;
}

interface CalcResult {
  baseSalary: number;
  proratedBase: number;
  loanDeductions: number;
  penaltyDeductions: number;
  suggestedFinalAmount: number;
  undeductedPenalties: Penalty[];
  openLoans: Loan[];
}

export default function PayrollPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const [activeTab, setActiveTab] = useState<Tab>("RUN");
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [isLoadingPenalties, setIsLoadingPenalties] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // RUN PAYROLL STATE
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<MonthEth>(
    () => EthDateTime.fromEuropeanDate(new Date()).month as MonthEth,
  );
  const [selectedYear, setSelectedYear] = useState(
    () => EthDateTime.fromEuropeanDate(new Date()).year,
  );
  const [calcData, setCalcData] = useState<CalcResult | null>(null);
  const [deductLoans, setDeductLoans] = useState(true);
  const [deductPenalties, setDeductPenalties] = useState(true);
  const [bonus, setBonus] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // HISTORY STATE
  const [history, setHistory] = useState<PayrollRecord[]>([]);

  // LOAN STATE
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoanOpen, setIsLoanOpen] = useState(false);

  // PENALTY STATE
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (activeTab === "HISTORY" || activeTab === "RUN") fetchHistory();
    if (activeTab === "LOANS") fetchLoans();
    if (activeTab === "PENALTIES") fetchPenalties();
  }, [activeTab, selectedBranchId]);

  const fetchUsers = async () => {
    try {
      setIsLoadingUsers(true);
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/users", { params });
      setUsers(data.filter((u: User) => u.role !== "OWNER"));
    } catch {
    } finally {
      setIsLoadingUsers(false);
    }
  };
  const fetchHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/payroll", { params });
      setHistory(data);
    } catch {
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const fetchLoans = async () => {
    try {
      setIsLoadingLoans(true);
      const params: any = { type: "EMPLOYEE" };
      if (selectedBranchId) params.branchId = selectedBranchId;
      const { data } = await api.get("/loans", { params });
      setLoans(data);
    } catch {
    } finally {
      setIsLoadingLoans(false);
    }
  };
  const fetchPenalties = async () => {
    try {
      setIsLoadingPenalties(true);
      const params = selectedBranchId ? { branchId: selectedBranchId } : {};
      const { data } = await api.get("/penalties", { params });
      setPenalties(data);
    } catch {
    } finally {
      setIsLoadingPenalties(false);
    }
  };

  const handleCalculate = async () => {
    if (!selectedUser) {
      toast.error("Select employee first");
      return;
    }
    try {
      const { data } = await api.get(
        `/payroll/calculate/${selectedUser}?month=${selectedMonth}&year=${selectedYear}`,
      );
      setCalcData(data);
      setBonus(0);
      setDeductLoans(true);
      setDeductPenalties(true);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to calculate");
      setCalcData(null);
    }
  };

  const handleProcessPayroll = async (settleDeductions: boolean) => {
    if (!calcData) return;
    try {
      setIsProcessing(true);
      // Create payroll record
      await api.post("/payroll", {
        userId: selectedUser,
        month: selectedMonth,
        year: selectedYear,
        baseSalary: calcData.proratedBase,
        loanDeductions: deductLoans ? calcData.loanDeductions : 0,
        penaltyDeductions: deductPenalties ? calcData.penaltyDeductions : 0,
        bonus: bonus,
        paymentDate: new Date().toISOString(),
      });

      // Optionally settle debts
      if (settleDeductions) {
        if (deductPenalties) {
          for (const p of calcData.undeductedPenalties) {
            await api.patch(`/penalties/${p.id}`, { isDeducted: true });
          }
        }
        if (deductLoans) {
          for (const l of calcData.openLoans) {
            await api.post(`/loans/${l.id}/pay`, {
              amountPaid: l.remainingBalance,
            });
          }
        }
      }

      toast.success("Payroll recorded successfully");
      setCalcData(null);
      setSelectedUser("");
      fetchHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error processing payroll");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generic Submit Loan
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
      toast.success("Loan recorded");
      setIsLoanOpen(false);
      fetchLoans();
    } catch (error) {
      toast.error("Failed to add loan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generic Submit Penalty
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
      toast.success("Penalty added");
      setIsPenaltyOpen(false);
      fetchPenalties();
    } catch (error) {
      toast.error("Failed to add penalty");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            Payroll & Staff Loans
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Manage personnel salaries, salary advance loans, attendance penalties, and payout distribution
          </p>
        </div>
        <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-[#EDE4D5] shadow-xs gap-1 w-full lg:w-auto">
          <Button
            variant={activeTab === "RUN" ? "default" : "ghost"}
            onClick={() => setActiveTab("RUN")}
            className={activeTab === "RUN" ? "bg-[#4A2E1B] text-white font-bold rounded-xl" : "text-[#4A2E1B] font-semibold hover:bg-[#F4ECE1] rounded-xl"}
          >
            <Wallet className="w-4 h-4 mr-2" /> Calculator
          </Button>
          <Button
            variant={activeTab === "HISTORY" ? "default" : "ghost"}
            onClick={() => setActiveTab("HISTORY")}
            className={activeTab === "HISTORY" ? "bg-black text-white" : ""}
          >
            <FileText className="w-4 h-4 mr-2" /> History
          </Button>
          <Button
            variant={activeTab === "LOANS" ? "default" : "ghost"}
            onClick={() => setActiveTab("LOANS")}
            className={activeTab === "LOANS" ? "bg-black text-white" : ""}
          >
            <DollarSign className="w-4 h-4 mr-2" /> Loans
          </Button>
          <Button
            variant={activeTab === "PENALTIES" ? "default" : "ghost"}
            onClick={() => setActiveTab("PENALTIES")}
            className={activeTab === "PENALTIES" ? "bg-black text-white" : ""}
          >
            <FileWarning className="w-4 h-4 mr-2" /> Penalties
          </Button>
        </div>
      </div>

      {activeTab === "RUN" && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Settings Picker */}
          <div className="col-span-1 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm self-start">
            <h2 className="font-semibold mb-4 border-b pb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" /> Term Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Employee
                </label>
                <select
                  disabled={isLoadingUsers}
                  className="w-full h-10 border rounded-md px-3 text-sm disabled:opacity-50"
                  value={selectedUser}
                  onChange={(e) => {
                    const userId = e.target.value;
                    setSelectedUser(userId);
                    setCalcData(null);
                    if (userId) {
                      const uInfo = users.find((u) => u.id === userId);
                      const rDate = uInfo?.createdAt
                        ? new Date(uInfo.createdAt)
                        : new Date();
                      const ethRDate = EthDateTime.fromEuropeanDate(rDate);
                      const mYear = ethRDate.year;
                      const mMonth = ethRDate.month;

                      if (selectedYear < mYear) {
                        setSelectedYear(mYear);
                        setSelectedMonth(mMonth as MonthEth);
                      } else if (
                        selectedYear === mYear &&
                        selectedMonth < mMonth
                      ) {
                        setSelectedMonth(mMonth as MonthEth);
                      }
                    }
                  }}
                >
                  <option value="">
                    {isLoadingUsers
                      ? "Loading Employees..."
                      : "Select Employee..."}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} - {u.role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Month
                  </label>
                  <select
                    disabled={isLoadingUsers || !selectedUser}
                    className="w-full h-10 border rounded-md px-3 text-sm disabled:opacity-50"
                    value={selectedMonth}
                    onChange={(e) => {
                      setSelectedMonth(Number(e.target.value) as MonthEth);
                      setCalcData(null);
                    }}
                  >
                    {Array.from({ length: 13 }, (_, i) => i + 1).map((m) => {
                      const selectedUserInfo = users.find(
                        (u) => u.id === selectedUser,
                      );
                      const regDate = selectedUserInfo?.createdAt
                        ? new Date(selectedUserInfo.createdAt)
                        : new Date();
                      const ethRegDate = EthDateTime.fromEuropeanDate(regDate);
                      const minYear = ethRegDate.year;
                      const minMonth = ethRegDate.month;
                      const isPaid = history.some(
                        (r) =>
                          r.userId === selectedUser &&
                          r.year === selectedYear &&
                          r.month === m,
                      );
                      const isDisabled =
                        selectedYear < minYear ||
                        (selectedYear === minYear && m < minMonth) ||
                        isPaid;
                      return (
                        <option key={m} value={m} disabled={isDisabled}>
                          {ETH_MONTHS[m - 1]}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <select
                    disabled={isLoadingUsers || !selectedUser}
                    className="w-full h-10 border rounded-md px-3 text-sm disabled:opacity-50"
                    value={selectedYear}
                    onChange={(e) => {
                      const newYear = Number(e.target.value);
                      setSelectedYear(newYear);
                      const selectedUserInfo = users.find(
                        (u) => u.id === selectedUser,
                      );
                      const regDate = selectedUserInfo?.createdAt
                        ? new Date(selectedUserInfo.createdAt)
                        : new Date();
                      const ethRegDate = EthDateTime.fromEuropeanDate(regDate);
                      const minYear = ethRegDate.year;
                      const minMonth = ethRegDate.month;
                      if (newYear === minYear && selectedMonth < minMonth) {
                        setSelectedMonth(minMonth as MonthEth);
                      }
                      setCalcData(null);
                    }}
                  >
                    {(() => {
                      const selectedUserInfo = users.find(
                        (u) => u.id === selectedUser,
                      );
                      const regDate = selectedUserInfo?.createdAt
                        ? new Date(selectedUserInfo.createdAt)
                        : new Date();
                      const ethRegDate = EthDateTime.fromEuropeanDate(regDate);
                      const minYear = ethRegDate.year;
                      const maxYear = EthDateTime.fromEuropeanDate(
                        new Date(),
                      ).year;
                      return Array.from(
                        { length: Math.max(1, maxYear - minYear + 1) },
                        (_, i) => minYear + i,
                      ).map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ));
                    })()}
                  </select>
                </div>
              </div>
              <Button
                onClick={handleCalculate}
                className="w-full mt-4 bg-zinc-900 text-white"
                disabled={!selectedUser}
              >
                Preview Draft
              </Button>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="col-span-2">
            {!calcData ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 border border-dashed rounded-xl border-zinc-200">
                <Wallet className="w-10 h-10 mb-2 opacity-50" />
                <p>Select an employee and term to preview draft</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="bg-black text-white p-4">
                  <h3 className="font-semibold text-lg">
                    Payroll Drafting Phase
                  </h3>
                  <p className="text-zinc-300 text-sm">
                    Review compensations and automatic system deductions.
                  </p>
                </div>

                <div className="p-6 space-y-6">
                  {/* Earnings */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-zinc-500 mb-3 tracking-wide">
                      Base Earnings
                    </h4>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Monthly Base Salary</span>
                      <span className="font-semibold">
                        {calcData.baseSalary.toFixed(2)} ETB
                      </span>
                    </div>
                    {calcData.baseSalary !== calcData.proratedBase && (
                      <div className="flex justify-between items-center py-2 border-b bg-yellow-50/50 text-yellow-800 px-2 rounded -mx-2 mt-1">
                        <span className="flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" /> Prorated Base
                          (Not full month)
                        </span>
                        <span className="font-semibold">
                          {calcData.proratedBase.toFixed(2)} ETB
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3">
                      <span className="font-medium text-sm">
                        Add Additional Bonus
                      </span>
                      <Input
                        type="number"
                        className="w-32 text-right"
                        value={bonus}
                        onChange={(e) => setBonus(Number(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-zinc-500 mb-3 tracking-wide">
                      System Deductions
                    </h4>
                    <div
                      className={`flex justify-between items-center py-2 border-b transition-colors ${deductPenalties ? "text-red-600" : "text-zinc-400"}`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deductPenalties}
                          onChange={(e) => setDeductPenalties(e.target.checked)}
                          className="mr-3 w-4 h-4 accent-black rounded border-zinc-300"
                        />
                        <FileWarning className="w-4 h-4 mr-2" /> Defaulted
                        Penalties ({calcData.undeductedPenalties.length})
                      </label>
                      <span className="font-semibold">
                        - {calcData.penaltyDeductions.toFixed(2)} ETB
                      </span>
                    </div>
                    <div
                      className={`flex justify-between items-center py-2 border-b transition-colors ${deductLoans ? "text-orange-600" : "text-zinc-400"}`}
                    >
                      <label className="flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={deductLoans}
                          onChange={(e) => setDeductLoans(e.target.checked)}
                          className="mr-3 w-4 h-4 accent-black rounded border-zinc-300"
                        />
                        <DollarSign className="w-4 h-4 mr-2" /> Active Loan
                        Deductions ({calcData.openLoans.length})
                      </label>
                      <span className="font-semibold">
                        - {calcData.loanDeductions.toFixed(2)} ETB
                      </span>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Final Net Payout</span>
                      <span className="text-emerald-600">
                        {(
                          calcData.proratedBase +
                          bonus -
                          (deductLoans ? calcData.loanDeductions : 0) -
                          (deductPenalties ? calcData.penaltyDeductions : 0)
                        ).toFixed(2)}{" "}
                        ETB
                      </span>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button
                      variant="outline"
                      className="w-full border-zinc-300"
                      onClick={() => handleProcessPayroll(false)}
                      disabled={isProcessing}
                    >
                      Log Payroll Only
                    </Button>
                    <Button
                      className="w-full bg-black text-white hover:bg-zinc-800"
                      onClick={() => handleProcessPayroll(true)}
                      disabled={isProcessing}
                    >
                      Fund & Settle Debts
                    </Button>
                  </div>
                  <p className="text-xs text-center text-zinc-400 mt-2">
                    "Fund & Settle Debts" will automatically mark all pending
                    penalties as paid and subtract loans dynamically from system
                    balances during this run.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Payroll Term</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Base / Prorated</TableHead>
                <TableHead className="text-rose-700">Deductions</TableHead>
                <TableHead className="text-emerald-700">Final Net Payout</TableHead>
                <TableHead className="text-right pr-6">Payment Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center py-8 text-[#8C7361] font-medium"
                  >
                    Loading payroll history...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
                    No payroll execution records found.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-extrabold text-[#2C1B10]">
                      {ETH_MONTHS[r.month - 1]} {r.year}
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-[#2C1B10]">{r.user?.fullName}</span>{" "}
                      <span className="text-xs text-[#8C7361] font-semibold">
                        ({r.user?.role})
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-[#2C1B10]">
                      {r.baseSalary} ETB{" "}
                      {r.bonus > 0 && (
                        <Badge
                          variant="secondary"
                          className="ml-1 shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-800 border-emerald-200"
                        >
                          +{r.bonus} ETB
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-rose-700 font-bold">
                      -{Number(r.loanDeductions) + Number(r.penaltyDeductions)}{" "}
                      ETB
                    </TableCell>
                    <TableCell className="font-extrabold text-emerald-700 text-sm">
                      {r.finalAmount} ETB
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#8C7361] text-right pr-6">
                      {r.paymentDate
                        ? format(new Date(r.paymentDate), "MMM dd, yyyy · HH:mm")
                        : "N/A"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* LOANS TAB */}
      {activeTab === "LOANS" && (
        <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
            <div>
              <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Active Employee Loans</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">Disbursed salary advances and current remaining balances</p>
            </div>
            <Button onClick={() => setIsLoanOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs shadow-xs">
              <Plus className="w-4 h-4 mr-1.5" /> Dispatch Loan
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Issued</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Original Amount</TableHead>
                <TableHead>Remaining Balance</TableHead>
                <TableHead className="text-right pr-6">Loan Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLoans ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#8C7361]">
                    Loading employee loans...
                  </TableCell>
                </TableRow>
              ) : loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#8C7361] font-medium">
                    No employee loans currently recorded.
                  </TableCell>
                </TableRow>
              ) : (
                loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">
                      {format(new Date(l.createdAt), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-bold text-[#2C1B10]">
                      {l.user?.fullName}
                    </TableCell>
                    <TableCell className="font-semibold text-[#8C7361]">{l.totalAmount} ETB</TableCell>
                    <TableCell className="font-extrabold text-[#2C1B10]">
                      {l.remainingBalance} ETB
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        className={`font-bold text-xs ${
                          l.status === "PAID"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-amber-100 text-amber-900 border-amber-300"
                        }`}
                      >
                        {l.status === "PAID" ? "✓ FULLY PAID" : "⏳ OPEN BALANCE"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* PENALTIES TAB */}
      {activeTab === "PENALTIES" && (
        <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
            <div>
              <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Workforce Penalties</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">Recorded policy infractions and penalty deductions</p>
            </div>
            <Button onClick={() => setIsPenaltyOpen(true)} size="sm" className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs shadow-xs">
              <Plus className="w-4 h-4 mr-1.5" /> Log Penalty
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Filed</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Violation Reason</TableHead>
                <TableHead className="text-rose-700">Penalty Fine</TableHead>
                <TableHead className="text-right pr-6">Deduction Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPenalties ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#8C7361]">
                    Loading workforce penalties...
                  </TableCell>
                </TableRow>
              ) : penalties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#8C7361] font-medium">
                    No active penalties logged.
                  </TableCell>
                </TableRow>
              ) : (
                penalties.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">
                      {format(new Date(p.date), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell className="font-bold text-[#2C1B10]">
                      {p.user?.fullName}
                    </TableCell>
                    <TableCell className="text-xs text-[#8C7361] max-w-[220px] truncate" title={p.reason}>{p.reason}</TableCell>
                    <TableCell className="font-extrabold text-rose-700">
                      -{p.amount} ETB
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Badge
                        className={`font-bold text-xs ${
                          p.isDeducted
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                            : "bg-rose-100 text-rose-800 border-rose-300"
                        }`}
                      >
                        {p.isDeducted ? "✓ DEDUCTED" : "⚠ PENDING DEDUCTION"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* MODALS */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent>
          <form onSubmit={handleAddLoan}>
            <DialogHeader>
              <DialogTitle>Dispatch Micro-Loan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Receiving Employee
                </label>
                <select
                  name="userId"
                  required
                  className="w-full h-10 border rounded-md px-3 text-sm"
                >
                  <option value="">Select Target...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Loan Classification / Type
                </label>
                <select
                  name="type"
                  required
                  className="w-full h-10 border rounded-md px-3 text-sm"
                >
                  <option value="STAFF_LOAN">Staff Loan (Multi-Month Installment)</option>
                  <option value="SALARY_ADVANCE">Salary Advance (Pre-payment of current month salary)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Loan Package Amount (ETB)
                </label>
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Dispersing..." : "Vault & Disperse"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPenaltyOpen} onOpenChange={setIsPenaltyOpen}>
        <DialogContent>
          <form onSubmit={handleAddPenalty}>
            <DialogHeader>
              <DialogTitle>Enforce Administrative Penalty</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Infracting Employee
                </label>
                <select
                  name="userId"
                  required
                  className="w-full h-10 border rounded-md px-3 text-sm"
                >
                  <option value="">Select Target...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Fine Evaluation (ETB)
                </label>
                <Input
                  name="amount"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Rule Broken / Reason
                </label>
                <Input
                  name="reason"
                  placeholder="e.g. Broken hardware"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">
                  Date of Offense
                </label>
                <EthDatePicker name="date" />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Fine"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
