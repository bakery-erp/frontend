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
  Plus,
  Calendar,
  Edit2,
  CheckCircle2,
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
  type: string;
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
  paymentDate: string | null;
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
  const [customBaseSalary, setCustomBaseSalary] = useState<string>("");
  const [customLoanDeduction, setCustomLoanDeduction] = useState<string>("");
  const [customPenaltyDeduction, setCustomPenaltyDeduction] = useState<string>("");
  const [customFinalAmount, setCustomFinalAmount] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // HISTORY STATE
  const [history, setHistory] = useState<PayrollRecord[]>([]);
  const [editingPayroll, setEditingPayroll] = useState<PayrollRecord | null>(null);
  const [isEditPayrollOpen, setIsEditPayrollOpen] = useState(false);

  // LOAN STATE
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoanOpen, setIsLoanOpen] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [isEditLoanOpen, setIsEditLoanOpen] = useState(false);

  // PENALTY STATE
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);
  const [editingPenalty, setEditingPenalty] = useState<Penalty | null>(null);
  const [isEditPenaltyOpen, setIsEditPenaltyOpen] = useState(false);

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
      const params: any = { type: "STAFF" };
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
      const hasLoans = data.openLoans && data.openLoans.length > 0;
      const hasPenalties = data.undeductedPenalties && data.undeductedPenalties.length > 0;
      setDeductLoans(hasLoans);
      setDeductPenalties(hasPenalties);
      setCustomBaseSalary(String(data.proratedBase || 0));
      setCustomLoanDeduction(hasLoans ? String(data.loanDeductions || 0) : "0");
      setCustomPenaltyDeduction(hasPenalties ? String(data.penaltyDeductions || 0) : "0");
      setCustomFinalAmount("");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to calculate");
      setCalcData(null);
    }
  };

  // Process Draft Payroll
  const handleProcessPayroll = async () => {
    if (!calcData) return;
    try {
      setIsProcessing(true);
      const baseToUse = customBaseSalary !== "" ? parseFloat(customBaseSalary) || 0 : calcData.proratedBase;
      const lDeductions = deductLoans ? (customLoanDeduction !== "" ? parseFloat(customLoanDeduction) || 0 : calcData.loanDeductions) : 0;
      const pDeductions = deductPenalties ? (customPenaltyDeduction !== "" ? parseFloat(customPenaltyDeduction) || 0 : calcData.penaltyDeductions) : 0;
      const calculatedNet = baseToUse + bonus - lDeductions - pDeductions;
      const finalToUse = customFinalAmount !== "" ? parseFloat(customFinalAmount) || 0 : calculatedNet;

      await api.post("/payroll", {
        userId: selectedUser,
        month: selectedMonth,
        year: selectedYear,
        baseSalary: baseToUse,
        loanDeductions: lDeductions,
        penaltyDeductions: pDeductions,
        bonus: bonus,
        finalAmount: finalToUse,
        paymentDate: new Date().toISOString(),
      });

      toast.success("Payroll processed and recorded successfully");
      setCalcData(null);
      setSelectedUser("");
      fetchHistory();
      fetchLoans();
      fetchPenalties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error processing payroll");
    } finally {
      setIsProcessing(false);
    }
  };

  // Add Loan
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
      toast.success("Loan recorded successfully");
      setIsLoanOpen(false);
      fetchLoans();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add loan");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Loan
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

  // Add Penalty
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
      toast.success("Penalty added successfully");
      setIsPenaltyOpen(false);
      fetchPenalties();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to add penalty");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit Penalty
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

  // Edit Payroll Record
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
      setIsEditPayrollOpen(false);
      setEditingPayroll(null);
      fetchHistory();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update payroll record");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate live preview net
  const parsedBase = customBaseSalary !== "" ? parseFloat(customBaseSalary) || 0 : (calcData?.proratedBase || 0);
  const parsedLoanDeduction = deductLoans ? (customLoanDeduction !== "" ? parseFloat(customLoanDeduction) || 0 : (calcData?.loanDeductions || 0)) : 0;
  const parsedPenaltyDeduction = deductPenalties ? (customPenaltyDeduction !== "" ? parseFloat(customPenaltyDeduction) || 0 : (calcData?.penaltyDeductions || 0)) : 0;
  const calculatedNetPayout = parsedBase + bonus - parsedLoanDeduction - parsedPenaltyDeduction;

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            Payroll & Staff Loans
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Manage personnel salaries, multi-month loans, attendance penalties, and payout distribution
          </p>
        </div>
        <div className="flex flex-wrap bg-white p-1.5 rounded-2xl border border-[#EDE4D5] shadow-xs gap-1 w-full lg:w-auto">
          <Button
            variant={activeTab === "RUN" ? "default" : "ghost"}
            onClick={() => setActiveTab("RUN")}
            className={
              activeTab === "RUN"
                ? "bg-[#4A2E1B] text-white font-bold rounded-xl"
                : "text-[#4A2E1B] font-semibold hover:bg-[#F4ECE1] rounded-xl"
            }
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

      {/* CALCULATOR / DRAFT TAB */}
      {activeTab === "RUN" && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Settings Picker */}
          <div className="col-span-1 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm self-start">
            <h2 className="font-semibold mb-4 border-b pb-2 flex items-center">
              <Calendar className="w-4 h-4 mr-2" /> Term Details
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Employee</label>
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
                      const rDate = uInfo?.createdAt ? new Date(uInfo.createdAt) : new Date();
                      const ethRDate = EthDateTime.fromEuropeanDate(rDate);
                      const mYear = ethRDate.year;
                      const mMonth = ethRDate.month;

                      if (selectedYear < mYear) {
                        setSelectedYear(mYear);
                        setSelectedMonth(mMonth as MonthEth);
                      } else if (selectedYear === mYear && selectedMonth < mMonth) {
                        setSelectedMonth(mMonth as MonthEth);
                      }
                    }
                  }}
                >
                  <option value="">
                    {isLoadingUsers ? "Loading Employees..." : "Select Employee..."}
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
                  <label className="text-sm font-medium mb-1 block">Month</label>
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
                      const selectedUserInfo = users.find((u) => u.id === selectedUser);
                      const regDate = selectedUserInfo?.createdAt ? new Date(selectedUserInfo.createdAt) : new Date();
                      const ethRegDate = EthDateTime.fromEuropeanDate(regDate);
                      const minYear = ethRegDate.year;
                      const minMonth = ethRegDate.month;
                      const isPaid = history.some(
                        (r) => r.userId === selectedUser && r.year === selectedYear && r.month === m,
                      );
                      const isDisabled = selectedYear < minYear || (selectedYear === minYear && m < minMonth) || isPaid;
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
                      const selectedUserInfo = users.find((u) => u.id === selectedUser);
                      const regDate = selectedUserInfo?.createdAt ? new Date(selectedUserInfo.createdAt) : new Date();
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
                      const selectedUserInfo = users.find((u) => u.id === selectedUser);
                      const regDate = selectedUserInfo?.createdAt ? new Date(selectedUserInfo.createdAt) : new Date();
                      const ethRegDate = EthDateTime.fromEuropeanDate(regDate);
                      const currentEthYear = EthDateTime.fromEuropeanDate(new Date()).year;
                      const minYear = Math.min(ethRegDate.year, currentEthYear);
                      const maxYear = currentEthYear + 20;
                      return Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).map((y) => (
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
                <div className="bg-[#2C1B10] text-white p-4 flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-lg">Payroll Drafting Phase</h3>
                    <p className="text-zinc-300 text-xs mt-0.5">
                      Adjust monthly long-term loan deductions, bonuses, and base salary.
                    </p>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  {/* Base Salary & Bonus */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-zinc-500 tracking-wide">
                      Base Earnings & Adjustments
                    </h4>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="text-sm font-medium">Original Agreement Salary</span>
                      <span className="font-semibold text-zinc-800">{calcData.baseSalary.toFixed(2)} ETB</span>
                    </div>

                    <div className="flex justify-between items-center py-2 border-b">
                      <div>
                        <span className="text-sm font-medium block">Editable Base Salary (For this run)</span>
                        <span className="text-xs text-zinc-500">Defaults to calculated prorated amount</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        className="w-36 text-right font-bold"
                        value={customBaseSalary}
                        onChange={(e) => setCustomBaseSalary(e.target.value)}
                      />
                    </div>

                    <div className="flex justify-between items-center py-2 border-b">
                      <span className="font-medium text-sm">Add Additional Bonus (ETB)</span>
                      <Input
                        type="number"
                        className="w-36 text-right font-bold text-emerald-700"
                        value={bonus}
                        onChange={(e) => setBonus(Number(e.target.value) || 0)}
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Active Monthly Loans Breakdown */}
                  <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-amber-200/80 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-950 flex items-center">
                          <DollarSign className="w-4 h-4 mr-1 text-amber-700" /> Active Employee Loans ({calcData.openLoans.length})
                        </h4>
                        <p className="text-xs text-amber-800 mt-0.5">
                          Multi-month long-term loans & salary advances
                        </p>
                      </div>
                      <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-full border border-amber-300">
                        Total Balance: {calcData.loanDeductions.toFixed(2)} ETB
                      </span>
                    </div>

                    {calcData.openLoans.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No active loans for this employee.</p>
                    ) : (
                      <div className="space-y-2">
                        {calcData.openLoans.map((loan) => (
                          <div key={loan.id} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-amber-200">
                            <div>
                              <span className="font-semibold text-zinc-800">
                                {loan.type === "STAFF_LOAN"
                                  ? "Staff Loan (Multi-Month Installment)"
                                  : loan.type === "SALARY_ADVANCE"
                                  ? "Salary Advance"
                                  : "Employee Loan"}
                              </span>
                              <span className="text-zinc-500 block text-[11px] mt-0.5">
                                Unpaid Balance: <strong className="text-amber-800">{loan.remainingBalance} ETB</strong> (Original: {loan.totalAmount} ETB)
                              </span>
                            </div>
                            <Badge className={loan.type === "STAFF_LOAN" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}>
                              {loan.type === "STAFF_LOAN" ? "Long-Term Monthly Loan" : "Salary Advance"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-center border-t border-amber-200/80">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="deductLoansCheck"
                          disabled={!calcData.openLoans || calcData.openLoans.length === 0}
                          checked={deductLoans && calcData.openLoans && calcData.openLoans.length > 0}
                          onChange={(e) => setDeductLoans(e.target.checked)}
                          className="mr-2 w-4 h-4 accent-amber-800 rounded border-amber-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <label
                          htmlFor="deductLoansCheck"
                          className={`text-sm font-semibold cursor-pointer ${
                            calcData.openLoans && calcData.openLoans.length > 0
                              ? "text-amber-950"
                              : "text-zinc-400 cursor-not-allowed"
                          }`}
                        >
                          Monthly Loan Deduction for This Run (ETB)
                        </label>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={!deductLoans || !calcData.openLoans || calcData.openLoans.length === 0}
                        placeholder="0.00"
                        className="w-36 text-right font-bold text-amber-900 bg-white border-amber-300 disabled:opacity-40 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                        value={calcData.openLoans && calcData.openLoans.length > 0 ? customLoanDeduction : "0"}
                        onChange={(e) => setCustomLoanDeduction(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Active Penalties Section */}
                  <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-200 space-y-3">
                    <div className="flex justify-between items-center border-b border-rose-200/80 pb-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-rose-950 flex items-center">
                          <FileWarning className="w-4 h-4 mr-1 text-rose-700" /> Pending Penalties ({calcData.undeductedPenalties.length})
                        </h4>
                        <p className="text-xs text-rose-800 mt-0.5">
                          Fines for broken rules or attendance infractions
                        </p>
                      </div>
                      <span className="text-xs font-bold text-rose-900 bg-rose-100 px-2.5 py-1 rounded-full border border-rose-300">
                        Total Fines: {calcData.penaltyDeductions.toFixed(2)} ETB
                      </span>
                    </div>

                    {calcData.undeductedPenalties.length === 0 ? (
                      <p className="text-xs text-zinc-500 italic">No pending penalties.</p>
                    ) : (
                      <div className="space-y-2">
                        {calcData.undeductedPenalties.map((p) => (
                          <div key={p.id} className="flex justify-between items-center text-xs bg-white p-2.5 rounded-lg border border-rose-200">
                            <div>
                              <span className="font-semibold text-zinc-800">{p.reason}</span>
                              <span className="text-rose-700 font-bold block text-[11px] mt-0.5">
                                Fine: -{p.amount} ETB
                              </span>
                            </div>
                            <span className="text-[11px] text-zinc-500">
                              {p.date ? format(new Date(p.date), "MMM dd, yyyy") : ""}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 flex justify-between items-center border-t border-rose-200/80">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          id="deductPenaltiesCheck"
                          disabled={!calcData.undeductedPenalties || calcData.undeductedPenalties.length === 0}
                          checked={deductPenalties && calcData.undeductedPenalties && calcData.undeductedPenalties.length > 0}
                          onChange={(e) => setDeductPenalties(e.target.checked)}
                          className="mr-2 w-4 h-4 accent-rose-800 rounded border-rose-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        />
                        <label
                          htmlFor="deductPenaltiesCheck"
                          className={`text-sm font-semibold cursor-pointer ${
                            calcData.undeductedPenalties && calcData.undeductedPenalties.length > 0
                              ? "text-rose-950"
                              : "text-zinc-400 cursor-not-allowed"
                          }`}
                        >
                          Deduct Penalty Fines for This Run (ETB)
                        </label>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        disabled={!deductPenalties || !calcData.undeductedPenalties || calcData.undeductedPenalties.length === 0}
                        placeholder="0.00"
                        className="w-36 text-right font-bold text-rose-900 bg-white border-rose-300 disabled:opacity-40 disabled:bg-zinc-100 disabled:cursor-not-allowed"
                        value={calcData.undeductedPenalties && calcData.undeductedPenalties.length > 0 ? customPenaltyDeduction : "0"}
                        onChange={(e) => setCustomPenaltyDeduction(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Totals & Manual Final Net Payout Override */}
                  <div className="bg-[#FAF7EE] p-4 rounded-xl border border-[#EDE4D5] space-y-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="text-sm font-bold text-[#2C1B10] block">Calculated Net Payout</span>
                        <span className="text-xs text-[#8C7361]">Base + Bonus - Monthly Loan - Penalty</span>
                      </div>
                      <span className="text-lg font-extrabold text-[#4A2E1B]">
                        {calculatedNetPayout.toFixed(2)} ETB
                      </span>
                    </div>

                    <div className="pt-2 border-t border-[#EDE4D5] flex justify-between items-center">
                      <div>
                        <label className="text-sm font-bold text-emerald-950 block">Final Net Payout (Override)</label>
                        <span className="text-xs text-emerald-800 font-medium">Leave empty to use calculated net payout</span>
                      </div>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Auto"
                        className="w-40 text-right font-extrabold text-emerald-700 bg-white border-emerald-300 text-base"
                        value={customFinalAmount}
                        onChange={(e) => setCustomFinalAmount(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Submit Action */}
                  <Button
                    className="w-full bg-[#4A2E1B] text-white hover:bg-[#382314] h-11 text-base font-bold rounded-xl"
                    onClick={handleProcessPayroll}
                    disabled={isProcessing}
                  >
                    {isProcessing ? "Processing & Deducting..." : "Confirm & Save Payroll Run"}
                  </Button>
                  <p className="text-xs text-center text-zinc-400">
                    Saving will record the payslip and automatically subtract the monthly loan deduction from open loan balances.
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
                <TableHead>Base Salary</TableHead>
                <TableHead>Bonus</TableHead>
                <TableHead className="text-rose-700">Deductions</TableHead>
                <TableHead className="text-emerald-700">Final Salary Paid</TableHead>
                <TableHead>Execution Date</TableHead>
                {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHistory ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-8 text-[#8C7361] font-medium"
                  >
                    Loading payroll history...
                  </TableCell>
                </TableRow>
              ) : history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">
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
                      {r.baseSalary} ETB
                    </TableCell>
                    <TableCell className="text-emerald-700 font-bold">
                      {r.bonus > 0 ? (
                        <Badge
                          variant="secondary"
                          className="shrink-0 text-[10px] font-bold bg-emerald-100 text-emerald-800 border-emerald-200"
                        >
                          +{r.bonus} ETB
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-rose-700 font-bold">
                      -{Number(r.loanDeductions) + Number(r.penaltyDeductions)}{" "}
                      ETB
                    </TableCell>
                    <TableCell className="font-extrabold text-emerald-700 text-sm">
                      {r.finalAmount} ETB
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">
                      {r.paymentDate
                        ? format(new Date(r.paymentDate), "MMM dd, yyyy · HH:mm")
                        : "N/A"}
                    </TableCell>
                    {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                      <TableCell className="text-right pr-6">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPayroll(r);
                            setIsEditPayrollOpen(true);
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
      )}

      {/* LOANS TAB */}
      {activeTab === "LOANS" && (
        <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
            <div>
              <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Active Employee Loans</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">Track and edit staff micro-loans and salary advances</p>
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
                <TableHead>Loan Type</TableHead>
                <TableHead>Original Amount</TableHead>
                <TableHead>Remaining Balance</TableHead>
                <TableHead>Loan Status</TableHead>
                {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingLoans ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                    Loading employee loans...
                  </TableCell>
                </TableRow>
              ) : loans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
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
      )}

      {/* PENALTIES TAB */}
      {activeTab === "PENALTIES" && (
        <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-[#EDE4D5] flex justify-between items-center bg-[#FAF6F0]">
            <div>
              <h2 className="font-extrabold text-sm text-[#2C1B10] uppercase tracking-wider">Workforce Penalties</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">View and edit administrative infraction fines and deductions</p>
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
                <TableHead>Deduction Status</TableHead>
                {(user?.role === "OWNER" || user?.role === "ADMIN") && <TableHead className="text-right pr-6">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingPenalties ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
                    Loading workforce penalties...
                  </TableCell>
                </TableRow>
              ) : penalties.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
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
      )}

      {/* CREATE LOAN DIALOG */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent>
          <form onSubmit={handleAddLoan}>
            <DialogHeader>
              <DialogTitle>Dispatch Micro-Loan</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Receiving Employee</label>
                <select name="userId" required className="w-full h-10 border rounded-md px-3 text-sm">
                  <option value="">Select Target...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Loan Classification / Type</label>
                <select name="type" required className="w-full h-10 border rounded-md px-3 text-sm">
                  <option value="STAFF_LOAN">Staff Loan (Multi-Month Installment)</option>
                  <option value="SALARY_ADVANCE">Salary Advance (Pre-payment of current month salary)</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Loan Package Amount (ETB)</label>
                <Input name="amount" type="number" min="0" step="0.01" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsLoanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                {isSubmitting ? "Dispersing..." : "Vault & Disperse"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT LOAN DIALOG */}
      <Dialog open={isEditLoanOpen} onOpenChange={setIsEditLoanOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateLoan}>
            <DialogHeader>
              <DialogTitle>Edit Employee Loan Record</DialogTitle>
              <DialogDescription>Modify loan amount, remaining balance, or status for this loan.</DialogDescription>
            </DialogHeader>
            {editingLoan && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-zinc-50 rounded-xl text-xs space-y-1 border">
                  <p><strong>Employee:</strong> {editingLoan.user?.fullName}</p>
                  <p><strong>Issued:</strong> {format(new Date(editingLoan.createdAt), "PPP")}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Total Original Loan Amount (ETB)</label>
                  <Input name="totalAmount" type="number" step="0.01" defaultValue={editingLoan.totalAmount} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Remaining Unpaid Balance (ETB)</label>
                  <Input name="remainingBalance" type="number" step="0.01" defaultValue={editingLoan.remainingBalance} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Loan Status</label>
                  <select name="status" defaultValue={editingLoan.status} className="w-full h-10 border rounded-md px-3 text-sm">
                    <option value="OPEN">OPEN (Active Unpaid Loan)</option>
                    <option value="PAID">PAID (Fully Settled)</option>
                  </select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditLoanOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                {isSubmitting ? "Saving..." : "Save Loan Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* CREATE PENALTY DIALOG */}
      <Dialog open={isPenaltyOpen} onOpenChange={setIsPenaltyOpen}>
        <DialogContent>
          <form onSubmit={handleAddPenalty}>
            <DialogHeader>
              <DialogTitle>Enforce Administrative Penalty</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Infracting Employee</label>
                <select name="userId" required className="w-full h-10 border rounded-md px-3 text-sm">
                  <option value="">Select Target...</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fine Evaluation (ETB)</label>
                <Input name="amount" type="number" min="0" step="0.01" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Rule Broken / Reason</label>
                <Input name="reason" placeholder="e.g. Broken hardware or unexcused absence" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date of Offense</label>
                <EthDatePicker name="date" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPenaltyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={isSubmitting}>
                {isSubmitting ? "Submitting..." : "Submit Fine"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PENALTY DIALOG */}
      <Dialog open={isEditPenaltyOpen} onOpenChange={setIsEditPenaltyOpen}>
        <DialogContent>
          <form onSubmit={handleUpdatePenalty}>
            <DialogHeader>
              <DialogTitle>Edit Workforce Penalty</DialogTitle>
              <DialogDescription>Adjust penalty amount, reason, or settlement status.</DialogDescription>
            </DialogHeader>
            {editingPenalty && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-zinc-50 rounded-xl text-xs space-y-1 border">
                  <p><strong>Employee:</strong> {editingPenalty.user?.fullName}</p>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Fine Amount (ETB)</label>
                  <Input name="amount" type="number" step="0.01" defaultValue={editingPenalty.amount} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Reason / Infraction Description</label>
                  <Input name="reason" defaultValue={editingPenalty.reason} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Date of Offense</label>
                  <EthDatePicker name="date" defaultValue={editingPenalty.date ? editingPenalty.date.split("T")[0] : ""} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Settlement Status</label>
                  <select name="isDeducted" defaultValue={editingPenalty.isDeducted ? "true" : "false"} className="w-full h-10 border rounded-md px-3 text-sm">
                    <option value="false">Pending (Not yet deducted from salary)</option>
                    <option value="true">Deducted / Settled</option>
                  </select>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditPenaltyOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                {isSubmitting ? "Saving..." : "Save Penalty Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT PAYROLL RECORD DIALOG */}
      <Dialog open={isEditPayrollOpen} onOpenChange={setIsEditPayrollOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleUpdatePayroll}>
            <DialogHeader>
              <DialogTitle>Edit Payroll Record & Final Salary</DialogTitle>
              <DialogDescription>
                Modify base salary, bonuses, deductions, or override final payout amount directly.
              </DialogDescription>
            </DialogHeader>
            {editingPayroll && (
              <div className="grid gap-4 py-4">
                <div className="p-3 bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl text-xs space-y-1">
                  <p className="font-bold text-[#2C1B10]">
                    {editingPayroll.user?.fullName} — {ETH_MONTHS[editingPayroll.month - 1]} {editingPayroll.year}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-zinc-700 mb-1 block">Base Salary (ETB)</label>
                    <Input name="baseSalary" type="number" step="0.01" defaultValue={editingPayroll.baseSalary} required />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-emerald-700 mb-1 block">Bonus (+ ETB)</label>
                    <Input name="bonus" type="number" step="0.01" defaultValue={editingPayroll.bonus} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-rose-700 mb-1 block">Loan Deductions (- ETB)</label>
                    <Input name="loanDeductions" type="number" step="0.01" defaultValue={editingPayroll.loanDeductions} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-rose-700 mb-1 block">Penalty Deductions (- ETB)</label>
                    <Input name="penaltyDeductions" type="number" step="0.01" defaultValue={editingPayroll.penaltyDeductions} />
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                  <label className="text-xs font-extrabold text-emerald-950 block">
                    Final Net Salary Payout (ETB)
                  </label>
                  <Input
                    name="finalAmount"
                    type="number"
                    step="0.01"
                    defaultValue={editingPayroll.finalAmount}
                    className="font-extrabold text-emerald-800 text-lg bg-white border-emerald-300"
                    required
                  />
                  <p className="text-[11px] text-emerald-700">
                    Directly overrides the stored payout amount for this payslip.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 mb-1 block">Payment Date</label>
                  <EthDatePicker
                    name="paymentDate"
                    defaultValue={editingPayroll.paymentDate ? editingPayroll.paymentDate.split("T")[0] : ""}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditPayrollOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-black text-white hover:bg-zinc-800">
                {isSubmitting ? "Saving..." : "Save Payroll Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
