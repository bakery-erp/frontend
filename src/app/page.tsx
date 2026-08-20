'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { Users, TrendingUp, AlertTriangle, Boxes, CheckCircle2, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface DashboardTotals {
  salesTotal: number;
  cashLeftoverTotal: number;
  companyExpenseTotal: number;
  ownerExpenseTotal: number;
  loanTotal: number;
  supplierDeliveryCost: number;
  payrollTotal: number;
  totalExpense: number;
  totalExpenses: number;
  grossProfit: number;
  netIncome: number;
  openingLeftoverQuantity: number;
}

interface StockSummary {
  totalItems: number;
  outOfStock: number;
  lowStock: number;
  healthy: number;
}

function money(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export default function Dashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Detail data from the report
  const [sessions, setSessions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);

  // Expand/collapse states for the two big cards
  const [showGainDetail, setShowGainDetail] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  useEffect(() => {
    if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
      if (user.role === 'EMPLOYEE') {
        router.push('/my-profile');
        return;
      }
      if (user.role === 'CASHIER') {
        router.push('/daily-sessions');
        return;
      }
      if (user.role === 'BAKER' || user.role === 'SAMBUSA_WORKER') {
        router.push('/production');
        return;
      }
    }
    fetchDashboardData();
  }, [selectedBranchId, user, router]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const todayYmd = new Date().toISOString().slice(0, 10);
      const params: any = { from: todayYmd, to: todayYmd };
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }

      const [reportRes, stockRes, usersRes] = await Promise.all([
        api.get('/reports/range', { params }).catch(() => ({ data: {} })),
        api.get('/stock-movements/summary', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: {} })),
        api.get('/users', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: [] })),
      ]);

      const data = reportRes.data || {};
      const t: DashboardTotals = data.totals || {
        salesTotal: data.salesTotal ?? 0,
        cashLeftoverTotal: data.cashLeftoverTotal ?? 0,
        companyExpenseTotal: data.companyExpenseTotal ?? 0,
        ownerExpenseTotal: data.ownerExpenseTotal ?? 0,
        loanTotal: data.loanTotal ?? 0,
        supplierDeliveryCost: data.supplierDeliveryCost ?? 0,
        payrollTotal: data.payrollTotal ?? 0,
        totalExpense: data.totalExpenses ?? data.totalExpense ?? 0,
        totalExpenses: data.totalExpenses ?? 0,
        grossProfit: data.grossProfit ?? 0,
        netIncome: data.netIncome ?? 0,
        openingLeftoverQuantity: 0,
      };
      setTotals(t);
      setSessions(data.sessions || []);
      setExpenses(data.expenses || []);
      setDeliveries(data.supplierDeliveries || []);
      setPayrollRecords(data.payrollRecords || []);
      setLoans(data.loans || []);
      setStockSummary(stockRes.data || null);
      setStaffCount(Array.isArray(usersRes.data) ? usersRes.data.length : 0);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const isOwner = user?.role === 'OWNER';

  const todayGain = totals?.salesTotal ?? 0;
  const todayExpense = (totals?.companyExpenseTotal ?? 0) + (totals?.ownerExpenseTotal ?? 0) + (totals?.supplierDeliveryCost ?? 0) + (totals?.payrollTotal ?? 0);
  const todayNet = todayGain - todayExpense;

  // Build sales detail rows from sessions
  const salesDetailRows: Array<{ product: string; qty: number; subtotal: number }> = [];
  for (const session of sessions) {
    for (const sale of session.sales || []) {
      for (const item of sale.items || []) {
        const name = item.product?.flavor
          ? `${item.product.name} (${item.product.flavor})`
          : item.product?.name || 'Product';
        salesDetailRows.push({ product: name, qty: item.quantity, subtotal: Number(item.subtotal || 0) });
      }
    }
  }

  return (
    <DashboardLayout>
      {/* ── Header Welcome Section ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 mb-2">
            ✨ Bakery Operations & Management
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            Welcome back, {user?.fullName || 'Manager'} 👋
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-1">
            {selectedBranchId
              ? `Real-time operational dashboard for ${branches.find(b => b.id === selectedBranchId)?.name || 'Branch'}`
              : 'Combined performance overview across all bakery branches.'}
          </p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl px-4 py-2 flex items-center space-x-3 shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-[#4A2E1B]">Live Session Active</span>
        </div>
      </div>

      {/* ── Hero Cards: Today's Revenue (Gain) & Today's Expense ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">

        {/* TODAY'S REVENUE (GAIN) */}
        <div>
          <Card
            className="border-emerald-200/80 bg-gradient-to-br from-emerald-500/10 via-emerald-50/50 to-white shadow-[0_8px_30px_rgba(16,185,129,0.06)] rounded-3xl cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            onClick={() => setShowGainDetail(!showGainDetail)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30">
                  <ArrowUpRight className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xs font-extrabold uppercase text-emerald-800 tracking-wider">Today&apos;s Revenue (Gain)</CardTitle>
                  <p className="text-[11px] text-emerald-700/80 font-medium">Sales collected across counter</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  + Live Sales
                </span>
                <Button variant="ghost" size="sm" className="text-emerald-800 hover:bg-emerald-100/50 p-1 h-auto rounded-xl">
                  {showGainDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-emerald-950 tracking-tight font-heading">
                {isLoading ? '...' : money(todayGain)}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-emerald-100">
                <span className="text-xs font-bold text-emerald-700">
                  Click to {showGainDetail ? 'hide' : 'view'} itemized breakdown
                </span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  {sessions.length} open session(s) <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* GAIN DETAIL PANEL */}
          {showGainDetail && (
            <Card className="mt-3 border-emerald-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="pb-2 bg-emerald-50/50 border-b border-emerald-100">
                <CardTitle className="text-sm font-bold text-emerald-900">Sales Itemization — Today</CardTitle>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {salesDetailRows.length === 0 ? (
                  <p className="text-sm text-[#8C7361] py-6 text-center">No product sales logged in current session</p>
                ) : (
                  <Table>
                    <TableHeader className="bg-emerald-50/30">
                      <TableRow className="border-b border-emerald-100">
                        <TableHead className="text-emerald-900 font-bold">Product Item</TableHead>
                        <TableHead className="text-right text-emerald-900 font-bold">Qty Sold</TableHead>
                        <TableHead className="text-right text-emerald-900 font-bold">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {salesDetailRows.map((row, i) => (
                        <TableRow key={i} className="border-b border-emerald-50 hover:bg-emerald-50/30">
                          <TableCell className="font-semibold text-[#2C1B10]">{row.product}</TableCell>
                          <TableCell className="text-right font-medium text-[#4A2E1B]">{row.qty}</TableCell>
                          <TableCell className="text-right text-emerald-700 font-bold">{money(row.subtotal)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-emerald-100/50 font-bold text-emerald-950">
                        <TableCell>Total Collected</TableCell>
                        <TableCell className="text-right">{salesDetailRows.reduce((s, r) => s + r.qty, 0)} items</TableCell>
                        <TableCell className="text-right text-emerald-800">{money(todayGain)}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* TODAY'S EXPENSE (COSTS) */}
        <div>
          <Card
            className="border-rose-200/80 bg-gradient-to-br from-rose-500/10 via-rose-50/50 to-white shadow-[0_8px_30px_rgba(244,63,94,0.06)] rounded-3xl cursor-pointer hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 relative overflow-hidden"
            onClick={() => setShowExpenseDetail(!showExpenseDetail)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/30">
                  <ArrowDownRight className="h-6 w-6" />
                </div>
                <div>
                  <CardTitle className="text-xs font-extrabold uppercase text-rose-800 tracking-wider">Today&apos;s Expense (Costs)</CardTitle>
                  <p className="text-[11px] text-rose-700/80 font-medium">Purchases, payroll & branch expenses</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                  Costs & Payables
                </span>
                <Button variant="ghost" size="sm" className="text-rose-800 hover:bg-rose-100/50 p-1 h-auto rounded-xl">
                  {showExpenseDetail ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              <div className="text-3xl sm:text-4xl font-extrabold text-rose-950 tracking-tight font-heading">
                {isLoading ? '...' : money(todayExpense)}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-rose-100">
                <span className="text-xs font-bold text-rose-700">
                  Click to {showExpenseDetail ? 'hide' : 'view'} cost breakdown
                </span>
                <span className="text-xs font-semibold text-rose-600 flex items-center">
                  {expenses.length + deliveries.length} expense log(s) <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* EXPENSE DETAIL PANEL */}
          {showExpenseDetail && (
            <Card className="mt-3 border-rose-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="pb-2 bg-rose-50/50 border-b border-rose-100">
                <CardTitle className="text-sm font-bold text-rose-900">Expense Breakdown — Today</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 overflow-x-auto">
                {/* Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100">
                    <div className="text-rose-700 font-semibold mb-0.5">Company</div>
                    <div className="font-extrabold text-rose-950 text-sm">{money(totals?.companyExpenseTotal)}</div>
                  </div>
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100">
                    <div className="text-purple-700 font-semibold mb-0.5">Owner Withdrawals</div>
                    <div className="font-extrabold text-purple-950 text-sm">{money(totals?.ownerExpenseTotal)}</div>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
                    <div className="text-amber-800 font-semibold mb-0.5">Supplier Purchases</div>
                    <div className="font-extrabold text-amber-950 text-sm">{money(totals?.supplierDeliveryCost)}</div>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                    <div className="text-indigo-700 font-semibold mb-0.5">Payroll Paid</div>
                    <div className="font-extrabold text-indigo-950 text-sm">{money(totals?.payrollTotal)}</div>
                  </div>
                </div>

                {/* Expense line items */}
                {expenses.length > 0 && (
                  <div>
                    <p className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider mb-2">Logged Operational Expenses</p>
                    <Table>
                      <TableHeader className="bg-rose-50/30">
                        <TableRow>
                          <TableHead className="text-rose-900 font-bold">Category</TableHead>
                          <TableHead className="text-rose-900 font-bold">Description</TableHead>
                          <TableHead className="text-rose-900 font-bold">Type</TableHead>
                          <TableHead className="text-right text-rose-900 font-bold">Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((exp: any, i: number) => (
                          <TableRow key={exp.id || i} className="border-b border-rose-50">
                            <TableCell className="font-semibold text-[#2C1B10]">{exp.financialCategory?.name || exp.category || '-'}</TableCell>
                            <TableCell className="text-[#8C7361]">{exp.description || '-'}</TableCell>
                            <TableCell>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${exp.type === 'OWNER' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                {exp.type}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-bold text-rose-700">{money(exp.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Supplier delivery items */}
                {deliveries.length > 0 && (
                  <div>
                    <p className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider mb-2">Supplier Deliveries Received</p>
                    <Table>
                      <TableHeader className="bg-amber-50/30">
                        <TableRow>
                          <TableHead className="text-amber-900 font-bold">Supplier</TableHead>
                          <TableHead className="text-amber-900 font-bold">Product Item</TableHead>
                          <TableHead className="text-right text-amber-900 font-bold">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveries.map((d: any, i: number) => (
                          <TableRow key={d.id || i} className="border-b border-amber-50">
                            <TableCell className="font-semibold text-[#2C1B10]">{d.supplier?.name || '-'}</TableCell>
                            <TableCell className="text-[#8C7361]">{d.product?.name || d.stockItem?.name || '-'}</TableCell>
                            <TableCell className="text-right font-bold text-amber-800">{money((d.unitBuyPrice || 0) * (d.quantityReceived || 0))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {expenses.length === 0 && deliveries.length === 0 && (
                  <p className="text-xs text-[#8C7361] py-4 text-center">No expense logs or supplier receipts for today</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Secondary KPI Grid Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Card 1: Net Profit */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Net Profit Today</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-heading ${todayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isLoading ? '...' : money(todayNet)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1 flex items-center">
              Revenue minus operational costs
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Loans Today */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Staff Loans Issued</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {isLoading ? '...' : money(totals?.loanTotal)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {loans.length} salary advance/loan record(s)
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Stock Health */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Raw Material Health</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
              <Boxes className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {isLoading ? '...' : `${stockSummary?.healthy || 0} / ${stockSummary?.totalItems || 0}`}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {stockSummary?.lowStock ? `${stockSummary.lowStock} items at low threshold` : 'All inventory levels healthy'}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Team & Locations */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Active Staff & Branches</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-700 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {isLoading ? '...' : `${branches.length} Branches, ${staffCount} Staff`}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              Active personnel in platform
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's P&L Summary & Inventory Alert Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-1 lg:col-span-2 border-[#EDE4D5] bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-[#EDE4D5] bg-[#FFFDF8]">
            <CardTitle className="text-base font-extrabold text-[#2C1B10]">Today&apos;s P&amp;L Summary</CardTitle>
            <CardDescription className="text-xs text-[#8C7361]">Comprehensive revenue vs cost breakdown for active session</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3.5">
              <div className="flex justify-between items-center pb-3 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">Total Sales Revenue</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-600">+{money(totals?.salesTotal)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">Raw Material / Resell Costs</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-600">-{money(totals?.supplierDeliveryCost)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">Company Operational Expenses</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-600">-{money(totals?.companyExpenseTotal)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">Owner Expense Withdrawals</span>
                <span className="text-xs sm:text-sm font-extrabold text-purple-600">-{money(totals?.ownerExpenseTotal)}</span>
              </div>
              <div className="flex justify-between items-center pb-3 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">Payroll Disbursed</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-600">-{money(totals?.payrollTotal)}</span>
              </div>
              <div className="flex justify-between items-center p-4 bg-[#F4ECE1] rounded-2xl mt-4">
                <span className="text-sm font-extrabold text-[#2C1B10]">Calculated Net Profit</span>
                <span className={`text-base sm:text-lg font-extrabold ${todayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {money(todayNet)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-[#EDE4D5] bg-[#FFFDF8]">
            <CardTitle className="text-base font-extrabold text-[#2C1B10]">Inventory Status</CardTitle>
            <CardDescription className="text-xs text-[#8C7361]">Stock levels & threshold monitoring</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-extrabold">Healthy Stock Items</p>
                <p className="text-xs text-emerald-700 font-medium">{stockSummary?.healthy || 0} items at normal levels</p>
              </div>
            </div>
            {stockSummary && stockSummary.lowStock > 0 ? (
              <div className="flex items-center p-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200">
                <AlertTriangle className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold">Low Stock Threshold</p>
                  <p className="text-xs text-amber-700 font-medium">{stockSummary.lowStock} item(s) need replenishment</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#F4ECE1] text-[#4A2E1B] text-xs font-semibold text-center border border-[#EDE4D5]">
                ✓ No inventory replenishment warnings active today
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
