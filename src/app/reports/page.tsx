"use client";

import { useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  payrollTotal?: number;
  totalExpenses?: number;
  totalExpense?: number;
  netIncome?: number;
  totals?: {
    openingLeftoverQuantity: number;
    salesTotal: number;
    cashLeftoverTotal: number;
    companyExpenseTotal: number;
    ownerExpenseTotal: number;
    loanTotal: number;
    supplierDeliveryCost: number;
    payrollTotal: number;
    totalExpense: number;
    netIncome: number;
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
    payrollTotal: number;
    netIncome: number;
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
  payrollRecords: Array<{
    id: string;
    paymentDate?: string | null;
    finalAmount: number;
    user: { fullName: string };
  }>;
};

type BranchOption = {
  id: string;
  name: string;
  address?: string | null;
  isActive: boolean;
};

function money(value: number | undefined | null) {
  return `ETB ${Number(value ?? 0).toFixed(2)}`;
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

  const allowed = user?.role === "OWNER" || user?.role === "ADMIN";

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

  const totals = report?.totals || {
    openingLeftoverQuantity: 0,
    salesTotal: report?.salesTotal ?? 0,
    cashLeftoverTotal: report?.cashLeftoverTotal ?? 0,
    companyExpenseTotal: report?.companyExpenseTotal ?? 0,
    ownerExpenseTotal: report?.ownerExpenseTotal ?? 0,
    loanTotal: report?.loanTotal ?? 0,
    supplierDeliveryCost: report?.supplierDeliveryCost ?? 0,
    payrollTotal: report?.payrollTotal ?? 0,
    totalExpense: report?.totalExpenses ?? report?.totalExpense ?? 0,
    netIncome: report?.netIncome ?? 0,
  };

  const visualTotals = [
    { label: "Opening Leftovers", value: totals.openingLeftoverQuantity ?? 0, tone: "bg-violet-500", display: (value: number) => String(value) },
    { label: "Sales", value: totals.salesTotal ?? 0, tone: "bg-emerald-500", display: money },
    { label: "Net Income", value: totals.netIncome ?? 0, tone: "bg-sky-500", display: money },
    { label: "Expenses", value: totals.totalExpense ?? 0, tone: "bg-rose-500", display: money },
    { label: "Loans", value: totals.loanTotal ?? 0, tone: "bg-amber-500", display: money },
  ];
  const maxVisual = Math.max(...visualTotals.map((item) => item.value), 1);

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="bg-white border rounded-lg p-6">Reports are available for owner and admin users only.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Reports</h1>
          <p className="text-zinc-500 mt-1">View income, expenses, loans, leftovers, and production details by date range or period.</p>
        </div>
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
                <label className="text-sm font-medium">End Date</label>
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
              <CardTitle>Visual Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {visualTotals.map((item) => (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700">{item.label}</span>
                    <span className="text-zinc-500">{item.display(item.value)}</span>
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

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <Card><CardHeader><CardTitle className="text-sm">Opening Leftovers</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{totals.openingLeftoverQuantity}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Sales</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.salesTotal)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Cash Leftover</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.cashLeftoverTotal)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Total Expense</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.totalExpense)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Net Income</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{money(totals.netIncome)}</CardContent></Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4 mb-6">
            <Card><CardHeader><CardTitle className="text-sm">Company Expense</CardTitle></CardHeader><CardContent>{money(totals.companyExpenseTotal)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Owner Expense</CardTitle></CardHeader><CardContent>{money(totals.ownerExpenseTotal)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Loans</CardTitle></CardHeader><CardContent>{money(totals.loanTotal)}</CardContent></Card>
            <Card><CardHeader><CardTitle className="text-sm">Supplier Cost</CardTitle></CardHeader><CardContent>{money(totals.supplierDeliveryCost)}</CardContent></Card>
          </div>

          <Card className="mb-6">
            <CardHeader><CardTitle>Daily Breakdown</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Opening Leftovers</TableHead>
                    <TableHead>Sales</TableHead>
                    <TableHead>Cash Leftover</TableHead>
                    <TableHead>Expenses</TableHead>
                    <TableHead>Loans</TableHead>
                    <TableHead>Supplier Cost</TableHead>
                    <TableHead>Net Income</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(report.dailyBreakdown || []).length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-zinc-400">No entries in this range</TableCell></TableRow>
                  ) : (report.dailyBreakdown || []).map((row) => (
                    <TableRow key={row.date}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.openingLeftoverQuantity}</TableCell>
                      <TableCell>{money(row.salesTotal)}</TableCell>
                      <TableCell>{money(row.cashLeftoverTotal)}</TableCell>
                      <TableCell>{money(row.companyExpenseTotal + row.ownerExpenseTotal + row.payrollTotal)}</TableCell>
                      <TableCell>{money(row.loanTotal)}</TableCell>
                      <TableCell>{money(row.supplierDeliveryCost)}</TableCell>
                      <TableCell>{money(row.netIncome)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader><CardTitle>Sales Details</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Subtotal</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {salesRows.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">No sales rows</TableCell></TableRow>
                  ) : salesRows.map((row, index) => (
                    <TableRow key={`${row.date}-${index}`}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>{row.quantity}</TableCell>
                      <TableCell>{money(row.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader><CardTitle>Opening Leftovers Carried Forward</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openingLeftoverRows.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-zinc-400">No opening leftovers in this range</TableCell></TableRow>
                  ) : openingLeftoverRows.map((entry) => (
                    <TableRow key={entry.key}>
                      <TableCell>{entry.sessionDate}</TableCell>
                      <TableCell>{entry.productName}</TableCell>
                      <TableCell>{entry.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2 mb-6">
            <Card>
              <CardHeader><CardTitle>Expenses</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.expenses || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">No expenses</TableCell></TableRow>
                    ) : (report.expenses || []).map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell>{expense.date ? new Date(expense.date).toISOString().slice(0, 10) : '-'}</TableCell>
                        <TableCell>{expense.financialCategory?.name || expense.category}</TableCell>
                        <TableCell>{expense.description || expense.category}</TableCell>
                        <TableCell>{money(expense.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Loans</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Borrower</TableHead>
                      <TableHead>Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.loans || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">No loans</TableCell></TableRow>
                    ) : (report.loans || []).map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell>{loan.date ? new Date(loan.date).toISOString().slice(0, 10) : '-'}</TableCell>
                        <TableCell>{loan.type}</TableCell>
                        <TableCell>{loan.user?.fullName || loan.entityId || '-'}</TableCell>
                        <TableCell>{money(loan.totalAmount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2 mb-6">
            <Card>
              <CardHeader><CardTitle>Production Batches</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>By</TableHead>
                      <TableHead>Products</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.productionBatches || []).length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center text-zinc-400">No production batches</TableCell></TableRow>
                    ) : (report.productionBatches || []).map((batch) => (
                      <TableRow key={batch.id}>
                        <TableCell>{batch.date ? new Date(batch.date).toISOString().slice(0, 10) : '-'}</TableCell>
                        <TableCell>{batch.user?.fullName || '-'}</TableCell>
                        <TableCell>{(batch.items || []).map((item) => `${item.product?.name || 'Product'}${item.product?.flavor ? ` (${item.product.flavor})` : ''} x${item.quantityProduced}`).join(', ')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Supplier Deliveries</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(report.supplierDeliveries || []).length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-zinc-400">No supplier deliveries</TableCell></TableRow>
                    ) : (report.supplierDeliveries || []).map((delivery) => (
                      <TableRow key={delivery.id}>
                        <TableCell>{delivery.createdAt ? new Date(delivery.createdAt).toISOString().slice(0, 10) : '-'}</TableCell>
                        <TableCell>{delivery.supplier?.name || '-'}</TableCell>
                        <TableCell>{delivery.product?.name || '-'}</TableCell>
                        <TableCell>{money((delivery.unitBuyPrice || 0) * ((delivery.quantityReceived || 0) - (delivery.returnedQuantity || 0)))}</TableCell>
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
