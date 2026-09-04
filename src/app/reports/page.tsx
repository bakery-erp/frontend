"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type ReportMode = "summary" | "period";
type Period = "daily" | "weekly" | "monthly" | "quarterly" | "semester" | "yearly";

type ReportResponse = {
  period?: string;
  branchId?: string;
  from?: string;
  to?: string;
  date?: string;
  salesTotal?: number;
  cashLeftoverTotal?: number;
  companyExpenseTotal?: number;
  ownerExpenseTotal?: number;
  loanTotal?: number;
  supplierDeliveryCost?: number;
  stockLoanPaymentTotal?: number;
  payrollTotal?: number;
  totalOperatingExpenses?: number;
  totalExpenses?: number;
  totalExpense?: number;
  grossProfit?: number;
  operatingNetIncome?: number;
  netIncome?: number;
  netIncomeAfterOwnerDrawings?: number;
  totals?: {
    openingLeftoverQuantity: number;
    salesTotal: number;
    cashLeftoverTotal: number;
    companyExpenseTotal: number;
    ownerExpenseTotal: number;
    loanTotal: number;
    supplierDeliveryCost: number;
    stockLoanPaymentTotal?: number;
    payrollTotal: number;
    totalOperatingExpenses?: number;
    totalExpense: number;
    totalExpenses: number;
    grossProfit?: number;
    operatingNetIncome?: number;
    netIncome: number;
    netIncomeAfterOwnerDrawings?: number;
  };
  dailyBreakdown: Array<{
    date: string;
    openingLeftoverQuantity: number;
    salesTotal: number;
    cashLeftoverTotal: number;
    companyExpenseTotal: number;
    ownerExpenseTotal: number;
    loanTotal: number;
    supplierDeliveryCost: number;
    stockLoanPaymentTotal?: number;
    payrollTotal: number;
    operatingNetIncome?: number;
    netIncome?: number;
  }>;
  sessions: Array<{
    id: string;
    date: string;
    status: string;
    cashLeftoverAmount?: number | null;
    openingLeftoverRecords?: Array<{
      product: { name: string; flavor?: string | null };
      quantityRemaining: number;
    }>;
    openingLeftoverQuantity?: number;
    sales: Array<{
      id: string;
      totalAmount: number;
      items: Array<{
        product: { name: string; flavor?: string | null };
        quantity: number;
        subtotal: number;
      }>;
    }>;
    leftoverRecords: Array<{
      product: { name: string; flavor?: string | null };
      quantityRemaining: number;
    }>;
  }>;
  productionBatches: Array<{
    id: string;
    date: string;
    user?: { fullName: string };
    items: Array<{
      product: { name: string; flavor?: string | null };
      quantityProduced: number;
    }>;
    materialUsages: Array<{
      stockItem: { name: string };
      quantityUsed: number;
    }>;
  }>;
  expenses: Array<{
    id: string;
    date: string;
    amount: number;
    category: string;
    description?: string | null;
    type: string;
    financialCategory?: { name: string } | null;
    user?: { fullName: string } | null;
  }>;
  companyExpenses?: Array<{
    id: string;
    date: string;
    amount: number;
    category: string;
    description?: string | null;
    type: string;
    financialCategory?: { name: string } | null;
    user?: { fullName: string } | null;
  }>;
  ownerExpenses?: Array<{
    id: string;
    date: string;
    amount: number;
    category: string;
    description?: string | null;
    type: string;
    financialCategory?: { name: string } | null;
    user?: { fullName: string } | null;
  }>;
  loans: Array<{
    id: string;
    date: string;
    type: string;
    totalAmount: number;
    remainingBalance: number;
    status: string;
    entityId?: string | null;
    user?: { fullName: string } | null;
  }>;
  supplierDeliveries: Array<{
    id: string;
    createdAt: string;
    quantityReceived: number;
    returnedQuantity: number;
    unitBuyPrice: number;
    unitSellPrice: number;
    supplier: { name: string };
    product: { name: string };
  }>;
  stockPurchasePayments?: Array<{
    id: string;
    createdAt: string;
    amount: number;
    note?: string | null;
    user?: { fullName: string } | null;
    loan?: {
      supplierName: string;
      stockMovement?: { stockItem?: { name: string } } | null;
    } | null;
  }>;
  payrollRecords: Array<{
    id: string;
    paymentDate?: string | null;
    finalAmount: number;
    user: { fullName: string };
  }>;
};

function money(value: number | undefined | null) {
  return `ETB ${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const [mode, setMode] = useState<ReportMode>("summary");
  const [period, setPeriod] = useState<Period>("monthly");
  const [branchId, setBranchId] = useState<string>("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [quarter, setQuarter] = useState(String(Math.ceil((new Date().getMonth() + 1) / 3)));
  const [semester, setSemester] = useState(String(new Date().getMonth() < 6 ? 1 : 2));
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<ReportResponse | null>(null);

  // Expense Filter state for the report audit table
  const [reportExpenseFilter, setReportExpenseFilter] = useState<"ALL" | "COMPANY" | "OWNER">("ALL");

  const allowed = user?.role === "OWNER";

  useEffect(() => {
    if (selectedBranchId !== undefined) {
      setBranchId(selectedBranchId || "");
    }
  }, [selectedBranchId]);

  const buildUrl = () => {
    const activeBranch = branchId || selectedBranchId;
    const branchQuery = activeBranch ? `branchId=${activeBranch}&` : "";
    if (mode === "summary") {
      return `/reports/range?${branchQuery}from=${from}&to=${to}`;
    }
    const params = new URLSearchParams();
    if (activeBranch) params.set("branchId", activeBranch);
    if (period === "daily") params.set("date", date);
    if (period === "weekly") params.set("endDate", date);
    if (period === "monthly") {
      params.set("year", year);
      params.set("month", month);
    }
    if (period === "quarterly") {
      params.set("year", year);
      params.set("quarter", quarter);
    }
    if (period === "semester") {
      params.set("year", year);
      params.set("semester", semester);
    }
    if (period === "yearly") params.set("year", year);
    return `/reports/period/${period}?${params.toString()}`;
  };

  const loadReport = async () => {
    setIsLoading(true);
    try {
      const res = await api.get<ReportResponse>(buildUrl());
      setReport(res.data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Could not load report");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (allowed) {
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, selectedBranchId]);

  const salesRows = useMemo(() => {
    const rows: Array<{ label: string; quantity: number; total: number; date: string }> = [];
    const sessionsList = Array.isArray(report?.sessions) ? report.sessions : [];
    for (const session of sessionsList) {
      for (const sale of session.sales || []) {
        for (const item of sale.items || []) {
          rows.push({
            label: item.product?.flavor ? `${item.product.name} (${item.product.flavor})` : item.product?.name || "Product",
            quantity: item.quantity,
            total: item.subtotal,
            date: session.date,
          });
        }
      }
    }
    return rows;
  }, [report]);

  const openingLeftoverRows = useMemo(() => {
    const rows: Array<{ key: string; sessionDate: string; productName: string; quantity: number }> = [];
    const sessionsList = Array.isArray(report?.sessions) ? report.sessions : [];
    for (const session of sessionsList) {
      for (const [index, row] of (session.openingLeftoverRecords || []).entries()) {
        rows.push({
          key: `${session.id}-${index}`,
          sessionDate: session.date,
          productName: row.product?.flavor ? `${row.product.name} (${row.product.flavor})` : row.product?.name || "Product",
          quantity: row.quantityRemaining,
        });
      }
    }
    return rows;
  }, [report]);

  const filteredReportExpenses = useMemo(() => {
    const list = report?.expenses || [];
    if (reportExpenseFilter === "COMPANY") return list.filter(e => e.type === "COMPANY");
    if (reportExpenseFilter === "OWNER") return list.filter(e => e.type === "OWNER");
    return list;
  }, [report, reportExpenseFilter]);

  const totals = report?.totals || {
    openingLeftoverQuantity: 0,
    salesTotal: report?.salesTotal ?? 0,
    cashLeftoverTotal: report?.cashLeftoverTotal ?? 0,
    companyExpenseTotal: report?.companyExpenseTotal ?? 0,
    ownerExpenseTotal: report?.ownerExpenseTotal ?? 0,
    loanTotal: report?.loanTotal ?? 0,
    supplierDeliveryCost: report?.supplierDeliveryCost ?? 0,
    stockLoanPaymentTotal: report?.stockLoanPaymentTotal ?? 0,
    payrollTotal: report?.payrollTotal ?? 0,
    totalExpense: report?.totalExpenses ?? report?.totalExpense ?? 0,
    operatingNetIncome: report?.operatingNetIncome ?? report?.netIncome ?? 0,
    netIncome: report?.operatingNetIncome ?? report?.netIncome ?? 0,
    netIncomeAfterOwnerDrawings: report?.netIncomeAfterOwnerDrawings ?? 0,
  };

  const visualTotals = [
    { label: "Sales Revenue", value: totals.salesTotal ?? 0, tone: "bg-emerald-500", display: money },
    { label: "Company Operating Costs", value: (totals.companyExpenseTotal ?? 0) + (totals.payrollTotal ?? 0) + (totals.stockLoanPaymentTotal ?? 0), tone: "bg-blue-500", display: money },
    { label: "Raw Material Costs", value: totals.supplierDeliveryCost ?? 0, tone: "bg-amber-500", display: money },
    { label: "Operating Net Income", value: totals.operatingNetIncome ?? totals.netIncome ?? 0, tone: "bg-sky-500", display: money },
    { label: "Owner Drawings", value: totals.ownerExpenseTotal ?? 0, tone: "bg-purple-500", display: money },
  ];
  const maxVisual = Math.max(...visualTotals.map((item) => item.value), 1);

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-3xl text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-xl font-bold">
            🔒
          </div>
          <h2 className="text-xl font-extrabold text-[#2C1B10]">Owner Financial Access Restricted</h2>
          <p className="text-xs sm:text-sm text-[#8C7361]">
            Financial analysis, detailed P&amp;L reports, and revenue/expense audits are strictly reserved for the <strong>Business Owner</strong> account.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
            📊 Owner Financial & Performance Reports
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Detailed revenue, operational expense, raw material cost, supplier credit loans, and owner drawings analysis.
          </p>
        </div>

        <Button
          onClick={handlePrint}
          className="bg-[#2C1B10] hover:bg-[#4A2E1B] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-2"
        >
          🖨️ Print Financial Statement
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Report Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Branch</label>
            <select
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm"
            >
              <option value="">Select a branch</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Mode</label>
            <select value={mode} onChange={(e) => setMode(e.target.value as ReportMode)} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
              <option value="summary">Date Range Summary</option>
              <option value="period">Preset Period</option>
            </select>
          </div>

          {mode === "summary" ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Start Date</label>
                <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">End Date</label>
                  <button
                    type="button"
                    onClick={() => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      if (from === todayStr && to === todayStr) {
                        const d = new Date();
                        d.setDate(d.getDate() - 30);
                        setFrom(d.toISOString().slice(0, 10));
                        setTo(todayStr);
                      } else {
                        setFrom(todayStr);
                        setTo(todayStr);
                      }
                    }}
                    className={`text-xs px-2 py-0.5 rounded font-bold transition-colors ${
                      from === new Date().toISOString().slice(0, 10) && to === new Date().toISOString().slice(0, 10)
                        ? "bg-[#4A2E1B] text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    📅 Today Only
                  </button>
                </div>
                <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Period</label>
                <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="semester">Semester</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              {(period === "daily" || period === "weekly") && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
              )}

              {period === "monthly" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Year</label>
                    <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Month</label>
                    <Input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} />
                  </div>
                </>
              )}

              {period === "quarterly" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Year</label>
                    <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Quarter</label>
                    <select value={quarter} onChange={(e) => setQuarter(e.target.value)} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                      <option value="1">Q1</option>
                      <option value="2">Q2</option>
                      <option value="3">Q3</option>
                      <option value="4">Q4</option>
                    </select>
                  </div>
                </>
              )}

              {period === "semester" && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Year</label>
                    <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Semester</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                      <option value="1">Semester 1</option>
                      <option value="2">Semester 2</option>
                    </select>
                  </div>
                </>
              )}

              {period === "yearly" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Year</label>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
              )}
            </>
          )}

          <div className="md:col-span-2 flex gap-2">
            <Button onClick={loadReport} disabled={isLoading}>{isLoading ? "Loading..." : "Load Report"}</Button>
          </div>
        </CardContent>
      </Card>

      {report && (
        <>
          <Card className="mb-6 border-zinc-200 bg-gradient-to-br from-white to-zinc-50">
            <CardHeader>
              <CardTitle>Visual Financial Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visualTotals.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">{item.label}</span>
                    <span className="text-zinc-500 font-bold">{item.display(item.value)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.tone}`}
                      style={{ width: `${Math.max(8, Math.round((item.value / maxVisual) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Primary Financial Summary KPI Cards */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <Card className="border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-emerald-800 tracking-wider">Total Sales Revenue</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-emerald-950">{money(totals.salesTotal)}</div><p className="text-[11px] text-emerald-700 mt-1 font-medium">Counter sales from daily sessions</p></CardContent>
            </Card>

            <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-blue-800 tracking-wider">Company Operating Expenses</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-blue-950">{money(totals.companyExpenseTotal)}</div><p className="text-[11px] text-blue-700 mt-1 font-medium">Daily operational business costs</p></CardContent>
            </Card>

            <Card className="border-amber-200 bg-gradient-to-br from-amber-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-amber-800 tracking-wider">Raw Material Buy Costs</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-amber-950">{money(totals.supplierDeliveryCost)}</div><p className="text-[11px] text-amber-700 mt-1 font-medium">Supplier ingredient purchases</p></CardContent>
            </Card>

            <Card className="border-sky-200 bg-gradient-to-br from-sky-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-sky-800 tracking-wider">Operating Net Income</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-sky-950">{money(totals.operatingNetIncome ?? totals.netIncome)}</div><p className="text-[11px] text-sky-700 mt-1 font-medium">Sales - (Company Operating Costs + Materials)</p></CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-purple-800 tracking-wider">Owner Personal Drawings</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-purple-950">{money(totals.ownerExpenseTotal)}</div><p className="text-[11px] text-purple-700 mt-1 font-medium">Owner withdrawals (Range calculation)</p></CardContent>
            </Card>

            <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-indigo-800 tracking-wider">Net Cash After Owner Drawings</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-indigo-950">{money(totals.netIncomeAfterOwnerDrawings ?? ((totals.operatingNetIncome ?? totals.netIncome ?? 0) - (totals.ownerExpenseTotal ?? 0)))}</div><p className="text-[11px] text-indigo-700 mt-1 font-medium">Net Income after Owner Withdrawals</p></CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-zinc-700 tracking-wider">Stock Credit Payments</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-zinc-900">{money(totals.stockLoanPaymentTotal ?? 0)}</div><p className="text-[11px] text-zinc-600 mt-1 font-medium">Supplier credit loan repayments</p></CardContent>
            </Card>

            <Card className="border-zinc-200 bg-white">
              <CardHeader className="pb-1"><CardTitle className="text-xs uppercase font-extrabold text-zinc-700 tracking-wider">Staff Payroll Paid</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-black text-zinc-900">{money(totals.payrollTotal)}</div><p className="text-[11px] text-zinc-600 mt-1 font-medium">Total payroll payouts to staff</p></CardContent>
            </Card>
          </div>

          {/* Daily Financial Breakdown Table */}
          <Card className="mb-6 rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
            <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
              <CardTitle className="text-base font-extrabold text-[#2C1B10]">Daily Financial Breakdown</CardTitle>
              <CardDescription className="text-xs text-[#8C7361]">
                Comprehensive day-by-day statement of operational revenues, company costs, daily operating net income, and separate owner drawings.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Opening Leftovers</TableHead>
                    <TableHead className="text-right text-emerald-800">Sales Revenue</TableHead>
                    <TableHead className="text-right text-blue-800">Company Expenses</TableHead>
                    <TableHead className="text-right text-amber-800">Material Costs</TableHead>
                    <TableHead className="text-right text-zinc-700">Payroll & Credit</TableHead>
                    <TableHead className="text-right font-bold text-sky-900">Daily Operating Net</TableHead>
                    <TableHead className="text-right pr-6 text-purple-800">Owner Drawings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.dailyBreakdown || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">No financial entries in this date range.</TableCell></TableRow>
                  ) : (report.dailyBreakdown || []).map((row) => {
                    const dailyOpNet = row.operatingNetIncome ?? (row.salesTotal - (row.companyExpenseTotal + row.supplierDeliveryCost + row.payrollTotal + (row.stockLoanPaymentTotal || 0)));
                    return (
                      <TableRow key={row.date}>
                        <TableCell className="font-bold text-[#2C1B10]">{row.date}</TableCell>
                        <TableCell className="text-center font-semibold text-[#8C7361]">{row.openingLeftoverQuantity}</TableCell>
                        <TableCell className="text-right font-bold text-emerald-700">{money(row.salesTotal)}</TableCell>
                        <TableCell className="text-right font-bold text-blue-700">{money(row.companyExpenseTotal)}</TableCell>
                        <TableCell className="text-right font-semibold text-amber-800">{money(row.supplierDeliveryCost)}</TableCell>
                        <TableCell className="text-right font-semibold text-zinc-700">{money(row.payrollTotal + (row.stockLoanPaymentTotal || 0))}</TableCell>
                        <TableCell className={`text-right font-extrabold ${dailyOpNet >= 0 ? 'text-emerald-700 bg-emerald-50/50' : 'text-rose-700 bg-rose-50/50'}`}>
                          {money(dailyOpNet)}
                        </TableCell>
                        <TableCell className="text-right font-bold text-purple-700 pr-6">
                          {row.ownerExpenseTotal > 0 ? (
                            <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full text-xs font-bold">
                              {money(row.ownerExpenseTotal)}
                            </span>
                          ) : (
                            "0.00 ETB"
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Itemized Sales Table */}
          <Card className="mb-6 rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
            <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
              <CardTitle className="text-base font-extrabold text-[#2C1B10]">Itemized Counter Sales Log</CardTitle>
              <CardDescription className="text-xs text-[#8C7361]">Breakdown of every item sold across all daily sessions in this period</CardDescription>
            </CardHeader>
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product Name & Variant</TableHead>
                    <TableHead className="text-center">Quantity Sold</TableHead>
                    <TableHead className="text-right pr-6">Line Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesRows.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-8 text-[#8C7361] font-medium">No sales recorded for this date range.</TableCell></TableRow>
                  ) : salesRows.map((row, index) => (
                    <TableRow key={`${row.date}-${index}`}>
                      <TableCell className="font-semibold text-xs text-[#8C7361]">{row.date}</TableCell>
                      <TableCell className="font-bold text-[#2C1B10]">{row.label}</TableCell>
                      <TableCell className="text-center font-bold text-[#2C1B10]">{row.quantity}</TableCell>
                      <TableCell className="text-right font-extrabold text-emerald-700 pr-6">{money(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Itemized Expenses Breakdown with Filter Tabs */}
          <Card className="mb-6 rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
            <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-extrabold text-[#2C1B10]">Itemized Expense Records</CardTitle>
                <CardDescription className="text-xs text-[#8C7361]">Detailed list of all logged expenses with type classification</CardDescription>
              </div>

              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#EDE4D5]">
                <button
                  onClick={() => setReportExpenseFilter("ALL")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportExpenseFilter === "ALL"
                      ? "bg-[#4A2E1B] text-white shadow-xs"
                      : "text-[#8C7361] hover:text-[#2C1B10]"
                  }`}
                >
                  All ({report.expenses?.length || 0})
                </button>
                <button
                  onClick={() => setReportExpenseFilter("COMPANY")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportExpenseFilter === "COMPANY"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-[#8C7361] hover:text-blue-700"
                  }`}
                >
                  🏢 Company ({report.expenses?.filter(e => e.type === "COMPANY").length || 0})
                </button>
                <button
                  onClick={() => setReportExpenseFilter("OWNER")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    reportExpenseFilter === "OWNER"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-[#8C7361] hover:text-purple-700"
                  }`}
                >
                  👑 Owner ({report.expenses?.filter(e => e.type === "OWNER").length || 0})
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Category / Reason</TableHead>
                    <TableHead>Note / Purpose</TableHead>
                    <TableHead>Logged By</TableHead>
                    <TableHead className="text-right pr-6">Expense Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReportExpenses.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-6 text-[#8C7361] font-medium">No expense records matching this filter.</TableCell></TableRow>
                  ) : filteredReportExpenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell className="text-xs font-semibold text-[#8C7361]">{expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '—'}</TableCell>
                      <TableCell>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                          expense.type === "OWNER"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}>
                          {expense.type === "OWNER" ? "👤 OWNER" : "🏢 COMPANY"}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-[#2C1B10] text-xs">{expense.financialCategory?.name || expense.category}</TableCell>
                      <TableCell className="text-xs text-[#8C7361] max-w-[200px] truncate">{expense.description || expense.category || '—'}</TableCell>
                      <TableCell className="text-xs font-medium text-[#2C1B10]">{expense.user?.fullName || '—'}</TableCell>
                      <TableCell className={`text-right font-extrabold pr-6 ${expense.type === 'OWNER' ? 'text-purple-700' : 'text-rose-700'}`}>
                        {money(expense.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Itemized Stock Credit Loan Repayments */}
          {(report.stockPurchasePayments || []).length > 0 && (
            <Card className="mb-6 rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <CardTitle className="text-base font-extrabold text-[#2C1B10]">Stock Credit Loan Repayments</CardTitle>
                <CardDescription className="text-xs text-[#8C7361]">Repayments made towards supplier credit loans in this date range</CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Date</TableHead>
                      <TableHead>Supplier / Item</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead>Recorded By</TableHead>
                      <TableHead className="text-right pr-6">Amount Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.stockPurchasePayments || []).map((payment: any) => (
                      <TableRow key={payment.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">
                          {payment.createdAt ? new Date(payment.createdAt).toISOString().slice(0, 10) : "—"}
                        </TableCell>
                        <TableCell className="font-bold text-[#2C1B10] text-xs">
                          {payment.loan?.supplierName || payment.loan?.stockMovement?.stockItem?.name || "Supplier Loan"}
                        </TableCell>
                        <TableCell className="text-xs text-[#8C7361]">{payment.note || "Repayment"}</TableCell>
                        <TableCell className="text-xs font-medium text-[#2C1B10]">{payment.user?.fullName || "—"}</TableCell>
                        <TableCell className="text-right font-extrabold text-[#4A2E1B] pr-6">{money(payment.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 xl:grid-cols-2 mb-6">
            {/* Opening Leftovers */}
            <Card className="rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <CardTitle className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">Opening Leftovers Carried</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session Date</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead className="text-right pr-6">Leftover Quantity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openingLeftoverRows.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-[#8C7361] font-medium">No opening leftovers recorded in this range.</TableCell></TableRow>
                    ) : openingLeftoverRows.map((entry) => (
                      <TableRow key={entry.key}>
                        <TableCell className="font-semibold text-xs text-[#8C7361]">{entry.sessionDate}</TableCell>
                        <TableCell className="font-bold text-[#2C1B10]">{entry.productName}</TableCell>
                        <TableCell className="text-right font-bold text-[#4A2E1B] pr-6">{entry.quantity}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Supplier Raw Material Deliveries */}
            <Card className="rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <CardTitle className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">Supplier Material Purchases</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Material / Item</TableHead>
                      <TableHead className="text-right pr-6">Net Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.supplierDeliveries || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center py-6 text-[#8C7361] font-medium">No supplier deliveries in this period.</TableCell></TableRow>
                    ) : (report.supplierDeliveries || []).map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">{delivery.createdAt ? new Date(delivery.createdAt).toISOString().slice(0, 10) : '—'}</TableCell>
                        <TableCell className="font-bold text-[#2C1B10] text-xs">{delivery.supplier?.name || '—'}</TableCell>
                        <TableCell className="font-semibold text-[#4A2E1B] text-xs">{delivery.product?.name || '—'}</TableCell>
                        <TableCell className="text-right font-extrabold text-[#2C1B10] pr-6">{money((delivery.unitBuyPrice || 0) * ((delivery.quantityReceived || 0) - (delivery.returnedQuantity || 0)))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 xl:grid-cols-2 mb-6">
            {/* Production Batches */}
            <Card className="rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <CardTitle className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">Production Batches Logged</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Baker</TableHead>
                      <TableHead className="pr-6">Products Baked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.productionBatches || []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-[#8C7361] font-medium">No production batches in this period.</TableCell></TableRow>
                    ) : (report.productionBatches || []).map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">{batch.date ? new Date(batch.date).toISOString().slice(0, 10) : '—'}</TableCell>
                        <TableCell className="font-bold text-[#2C1B10] text-xs">{batch.user?.fullName || '—'}</TableCell>
                        <TableCell className="text-xs text-[#4A2E1B] font-medium pr-6">{(batch.items || []).map((item) => `${item.product?.name || 'Product'}${item.product?.flavor ? ` (${item.product.flavor})` : ''} x${item.quantityProduced}`).join(', ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Staff Payroll Records */}
            <Card className="rounded-2xl border-[#EDE4D5] shadow-xs overflow-hidden">
              <CardHeader className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <CardTitle className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider">Staff Payroll Payouts</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payout Date</TableHead>
                      <TableHead>Employee Name</TableHead>
                      <TableHead className="text-right pr-6">Final Amount Paid</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.payrollRecords || []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-[#8C7361] font-medium">No payroll payouts in this period.</TableCell></TableRow>
                    ) : (report.payrollRecords || []).map((payroll) => (
                      <TableRow key={payroll.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">{payroll.paymentDate ? new Date(payroll.paymentDate).toISOString().slice(0, 10) : '—'}</TableCell>
                        <TableCell className="font-bold text-[#2C1B10] text-xs">{payroll.user?.fullName || '—'}</TableCell>
                        <TableCell className="text-right font-extrabold text-[#2C1B10] pr-6">{money(payroll.finalAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
