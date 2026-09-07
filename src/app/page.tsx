'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { Users, TrendingUp, AlertTriangle, Boxes, CheckCircle2, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp, Wallet, DollarSign, Receipt, Package, Search, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from '@/context/LanguageContext';

interface DashboardTotals {
  yesterdayLeftoverCash?: number;
  salesTotal: number;
  creditReceivedFromLoans?: number;
  tomorrowLeftoverCash?: number;
  dailyTotalRevenue?: number;
  cashLeftoverTotal: number;
  companyExpenseTotal: number;
  ownerExpenseTotal: number;
  dailyNetIncome?: number;
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
  const { t } = useLanguage();
  const [totals, setTotals] = useState<DashboardTotals | null>(null);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);
  const [productValuation, setProductValuation] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Detail data from the report
  const [sessions, setSessions] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<any[]>([]);
  const [loans, setLoans] = useState<any[]>([]);
  const [customerLoanPayments, setCustomerLoanPayments] = useState<any[]>([]);

  // Expand/collapse states for the two big cards
  const [showGainDetail, setShowGainDetail] = useState(false);
  const [showExpenseDetail, setShowExpenseDetail] = useState(false);

  // Ledger Filter & Search states
  const [ledgerFilter, setLedgerFilter] = useState<'ALL' | 'REVENUE' | 'EXPENSE'>('ALL');
  const [ledgerSearch, setLedgerSearch] = useState('');

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
      if (user.role === 'BAKER' || user.role === 'CAKE_WORKER' || user.role === 'SAMBUSA_WORKER') {
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

      const [reportRes, stockRes, usersRes, prodRes] = await Promise.all([
        api.get('/reports/range', { params }).catch(() => ({ data: {} })),
        api.get('/stock-movements/summary', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: {} })),
        api.get('/users', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: [] })),
        api.get('/products', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: [] })),
      ]);

      const data = reportRes.data || {};
      const t: DashboardTotals = data.totals || {
        yesterdayLeftoverCash: data.yesterdayLeftoverCash ?? 0,
        salesTotal: data.salesTotal ?? 0,
        creditReceivedFromLoans: data.creditReceivedFromLoans ?? 0,
        tomorrowLeftoverCash: data.tomorrowLeftoverCash ?? data.cashLeftoverTotal ?? 0,
        dailyTotalRevenue: data.dailyTotalRevenue ?? data.salesTotal ?? 0,
        cashLeftoverTotal: data.cashLeftoverTotal ?? 0,
        companyExpenseTotal: data.companyExpenseTotal ?? 0,
        ownerExpenseTotal: data.ownerExpenseTotal ?? 0,
        dailyNetIncome: data.dailyNetIncome ?? data.netIncome ?? 0,
        loanTotal: data.loanTotal ?? 0,
        supplierDeliveryCost: data.supplierDeliveryCost ?? 0,
        payrollTotal: data.payrollTotal ?? 0,
        totalExpense: data.companyExpenseTotal ?? 0,
        totalExpenses: data.companyExpenseTotal ?? 0,
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
      setCustomerLoanPayments(data.customerLoanPayments || []);
      setStockSummary(stockRes.data || null);
      setStaffCount(Array.isArray(usersRes.data) ? usersRes.data.length : 0);

      // Calculate Product Inventory Money Valuation
      const prods = Array.isArray(prodRes.data) ? prodRes.data : [];
      const totalVal = prods.reduce((sum: number, p: any) => {
        const qty = Number(p.currentHouseStock || 0);
        const price = Number(p.buyPrice || p.basePrice || 0);
        return sum + (qty * price);
      }, 0);
      setProductValuation(totalVal);
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const isOwner = user?.role === 'OWNER';

  // Exact user formula:
  const yesterdayCash = totals?.yesterdayLeftoverCash ?? 0;
  const salesIncome = totals?.salesTotal ?? 0;
  const creditReceived = totals?.creditReceivedFromLoans ?? 0;
  const tomorrowCash = totals?.tomorrowLeftoverCash ?? totals?.cashLeftoverTotal ?? 0;

  // Daily Total Revenue: Yesterday's Leftover + Total Income from Sell + Credit Received from Loan - Leftover Cash for Tomorrow
  const todayGain = totals?.dailyTotalRevenue != null
    ? totals.dailyTotalRevenue
    : (yesterdayCash + salesIncome + creditReceived - tomorrowCash);

  // Daily Total Expense: Company operating expenses taken from daily money
  const todayExpense = totals?.companyExpenseTotal ?? 0;

  // Daily Net Income: Total Revenue - Total Expense
  const todayNet = totals?.dailyNetIncome != null
    ? totals.dailyNetIncome
    : (todayGain - todayExpense);

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

  // Unified Transactions Ledger (Everything list)
  const unifiedTransactions: Array<{
    id: string;
    date: string;
    title: string;
    category: string;
    type: 'REVENUE' | 'EXPENSE';
    amount: number;
    status: string;
  }> = [];

  // POS Sales
  sessions.forEach((s) => {
    (s.sales || []).forEach((sale: any) => {
      unifiedTransactions.push({
        id: sale.id,
        date: s.date || sale.createdAt,
        title: `POS Product Sale (Session #${s.id.slice(-4)})`,
        category: 'Counter POS Revenue',
        type: 'REVENUE',
        amount: Number(sale.totalAmount || 0),
        status: 'COMPLETED',
      });
    });
  });

  // Expenses
  expenses.forEach((e) => {
    unifiedTransactions.push({
      id: e.id,
      date: e.date,
      title: e.description || `${e.type} Operating Expense`,
      category: e.financialCategory?.name || e.category || 'Operating Expense',
      type: 'EXPENSE',
      amount: Number(e.amount || 0),
      status: 'PAID',
    });
  });

  // Supplier Deliveries
  deliveries.forEach((d) => {
    const cost = Number(d.unitBuyPrice || 0) * Number(d.quantityReceived || 0);
    unifiedTransactions.push({
      id: d.id,
      date: d.createdAt,
      title: `Supplier Purchase (${d.supplier?.name || 'Supplier'})`,
      category: d.product?.name || 'Raw Ingredients / Stock',
      type: 'EXPENSE',
      amount: cost,
      status: 'RECEIVED',
    });
  });

  // Customer Credits / Loans
  loans.forEach((l) => {
    if (l.type === 'CUSTOMER_CREDIT') {
      unifiedTransactions.push({
        id: l.id,
        date: l.date || l.createdAt,
        title: `Customer Credit Sale (${l.entityId || 'Client'})`,
        category: 'Product Credit Receivable',
        type: 'REVENUE',
        amount: Number(l.totalAmount || 0),
        status: l.status === 'PAID' ? 'PAID' : 'OUTSTANDING',
      });
    } else {
      unifiedTransactions.push({
        id: l.id,
        date: l.date || l.createdAt,
        title: `Employee Loan / Advance (${l.user?.fullName || l.entityId || 'Staff'})`,
        category: 'Staff Salary Advance',
        type: 'EXPENSE',
        amount: Number(l.totalAmount || 0),
        status: l.status,
      });
    }
  });

  // Payroll Disbursements
  payrollRecords.forEach((pr) => {
    unifiedTransactions.push({
      id: pr.id,
      date: pr.paymentDate || new Date().toISOString(),
      title: `Payroll Disbursement (${pr.user?.fullName || 'Employee'})`,
      category: 'Staff Salary Payroll',
      type: 'EXPENSE',
      amount: Number(pr.finalAmount || 0),
      status: 'PAID',
    });
  });

  // Sort unified transactions descending by date
  unifiedTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredTransactions = unifiedTransactions.filter((tx) => {
    if (ledgerFilter === 'REVENUE' && tx.type !== 'REVENUE') return false;
    if (ledgerFilter === 'EXPENSE' && tx.type !== 'EXPENSE') return false;
    if (ledgerSearch) {
      const q = ledgerSearch.toLowerCase();
      return (
        tx.title.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.status.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <DashboardLayout>
      {/* ── Header Welcome Section ── */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 md:mb-8 gap-4">
        <div>
          <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-[#E87A18]/10 text-[#E87A18] border border-[#E87A18]/20 mb-2">
            {t('dashboard.badge')}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            {t('dashboard.welcomeBack', { name: user?.fullName || 'Manager' })}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-1">
            {selectedBranchId
              ? t('dashboard.branchOverview', { branch: branches.find(b => b.id === selectedBranchId)?.name || 'Branch' })
              : t('dashboard.allBranchesOverview')}
          </p>
        </div>
        <div className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl px-4 py-2 flex items-center space-x-3 shadow-xs">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-bold text-[#4A2E1B]">{t('dashboard.liveSessionActive')}</span>
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
                  <CardTitle className="text-xs font-extrabold uppercase text-emerald-800 tracking-wider">{t('dashboard.todayRevenueTitle')}</CardTitle>
                  <p className="text-[11px] text-emerald-700/80 font-medium">{t('dashboard.todayRevenueDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {t('dashboard.liveSalesBadge')}
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
                  {showGainDetail ? t('dashboard.clickToHideBreakdown') : t('dashboard.clickToViewBreakdown')}
                </span>
                <span className="text-xs font-semibold text-emerald-600 flex items-center">
                  {t('dashboard.openSessionsCount', { count: sessions.length })} <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* GAIN DETAIL PANEL */}
          {showGainDetail && (
            <Card className="mt-3 border-emerald-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="pb-3 bg-emerald-50/70 border-b border-emerald-100">
                <CardTitle className="text-sm font-extrabold text-emerald-950">{t('dashboard.revenueFormulaTitle')}</CardTitle>
                <CardDescription className="text-xs text-emerald-800">
                  {t('dashboard.revenueFormulaDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 overflow-x-auto">
                {/* 4-Part Formula Grid */}
                <div className="p-4 bg-emerald-50/30 border-b border-emerald-100 space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-emerald-900 block">➕ {t('dashboard.yesterdayLeftoverCash')}</span>
                        <span className="text-[11px] text-[#8C7361]">{t('dashboard.yesterdayLeftoverCashSub')}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-900 text-sm">{money(yesterdayCash)}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-emerald-900 block">➕ {t('dashboard.incomeFromSales')}</span>
                        <span className="text-[11px] text-[#8C7361]">{t('dashboard.incomeFromSalesSub')}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-900 text-sm">{money(salesIncome)}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-emerald-900 block">➕ {t('dashboard.creditReceivedLoans')}</span>
                        <span className="text-[11px] text-[#8C7361]">{t('dashboard.creditReceivedLoansSub')}</span>
                      </div>
                      <span className="font-mono font-bold text-emerald-900 text-sm">{money(creditReceived)}</span>
                    </div>
                    <div className="p-3 bg-white rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between">
                      <div>
                        <span className="font-extrabold text-rose-900 block">➖ {t('dashboard.tomorrowLeftoverCash')}</span>
                        <span className="text-[11px] text-[#8C7361]">{t('dashboard.tomorrowLeftoverCashSub')}</span>
                      </div>
                      <span className="font-mono font-bold text-rose-900 text-sm">{money(tomorrowCash)}</span>
                    </div>
                  </div>
                  <div className="p-3.5 bg-emerald-900 text-white rounded-2xl flex items-center justify-between font-extrabold text-sm shadow-sm">
                    <span className="uppercase tracking-wider text-xs sm:text-sm">🟰 {t('dashboard.totalDailyRevenue')}:</span>
                    <span className="font-mono text-emerald-300 text-base sm:text-lg">{money(todayGain)}</span>
                  </div>
                </div>

                {/* Sales Itemization Table */}
                <div className="p-4 bg-white">
                  <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-2">{t('dashboard.itemizedSalesTitle')}</p>
                  {salesDetailRows.length === 0 ? (
                    <p className="text-xs text-[#8C7361] py-4 text-center font-medium">{t('dashboard.noSalesRecorded')}</p>
                  ) : (
                    <Table>
                      <TableHeader className="bg-emerald-100/50">
                        <TableRow className="border-b border-emerald-200">
                          <TableHead className="text-emerald-950 font-extrabold">{t('dashboard.colProductItem')}</TableHead>
                          <TableHead className="text-right text-emerald-950 font-extrabold">{t('dashboard.colQtySold')}</TableHead>
                          <TableHead className="text-right text-emerald-950 font-extrabold pr-6">{t('dashboard.colSubtotal')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {salesDetailRows.map((row, i) => (
                          <TableRow key={i} className="border-b border-emerald-100/50 hover:bg-emerald-50/40">
                            <TableCell className="font-bold text-[#2C1B10]">{row.product}</TableCell>
                            <TableCell className="text-right font-bold text-[#4A2E1B]">{row.qty}</TableCell>
                            <TableCell className="text-right text-emerald-800 font-extrabold pr-6">{money(row.subtotal)}</TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-emerald-100/60 font-extrabold text-emerald-950">
                          <TableCell className="font-extrabold">{t('dashboard.itemizedSalesTitle')}</TableCell>
                          <TableCell className="text-right font-extrabold">{salesDetailRows.reduce((s, r) => s + r.qty, 0)} {t('common.items')}</TableCell>
                          <TableCell className="text-right text-emerald-900 font-black pr-6">{money(salesIncome)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  )}
                </div>

                {/* Customer Credit Loan Repayments Table */}
                {customerLoanPayments.length > 0 && (
                  <div className="p-4 border-t border-emerald-100 bg-emerald-50/20">
                    <p className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider mb-2">{t('dashboard.customerCreditPaymentsTitle')}</p>
                    <Table>
                      <TableHeader className="bg-emerald-100/40">
                        <TableRow>
                          <TableHead className="text-emerald-950 font-bold">{t('dashboard.colCustomerEntity')}</TableHead>
                          <TableHead className="text-right text-emerald-950 font-bold pr-6">{t('dashboard.colAmountPaid')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {customerLoanPayments.map((cp, idx) => (
                          <TableRow key={cp.id || idx} className="border-b border-emerald-50">
                            <TableCell className="font-bold text-[#2C1B10]">{cp.loan?.entityId || 'Customer Credit'}</TableCell>
                            <TableCell className="text-right font-mono font-bold text-emerald-800 pr-6">{money(cp.amountPaid)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
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
                  <CardTitle className="text-xs font-extrabold uppercase text-rose-800 tracking-wider">{t('dashboard.todayExpenseTitle')}</CardTitle>
                  <p className="text-[11px] text-rose-700/80 font-medium">{t('dashboard.todayExpenseDesc')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
                  {t('dashboard.costsBadge')}
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
                  {showExpenseDetail ? t('dashboard.clickToHideBreakdown') : t('dashboard.clickToViewBreakdown')}
                </span>
                <span className="text-xs font-semibold text-rose-600 flex items-center">
                  {t('dashboard.expenseLogsCount', { count: expenses.length + deliveries.length })} <ChevronDown className="w-3.5 h-3.5 ml-1" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* EXPENSE DETAIL PANEL */}
          {showExpenseDetail && (
            <Card className="mt-3 border-rose-200 bg-white shadow-lg rounded-3xl overflow-hidden animate-in fade-in duration-200">
              <CardHeader className="pb-2 bg-rose-50/50 border-b border-rose-100">
                <CardTitle className="text-sm font-bold text-rose-900">{t('dashboard.expenseBreakdownTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4 overflow-x-auto">
                {/* Summary Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="p-3 bg-rose-50/60 rounded-2xl border border-rose-100">
                    <div className="text-rose-700 font-semibold mb-0.5">{t('dashboard.catCompany')}</div>
                    <div className="font-extrabold text-rose-950 text-sm">{money(totals?.companyExpenseTotal)}</div>
                  </div>
                  <div className="p-3 bg-purple-50/60 rounded-2xl border border-purple-100">
                    <div className="text-purple-700 font-semibold mb-0.5">{t('dashboard.catOwnerWithdrawals')}</div>
                    <div className="font-extrabold text-purple-950 text-sm">{money(totals?.ownerExpenseTotal)}</div>
                  </div>
                  <div className="p-3 bg-amber-50/60 rounded-2xl border border-amber-100">
                    <div className="text-amber-800 font-semibold mb-0.5">{t('dashboard.catSupplierPurchases')}</div>
                    <div className="font-extrabold text-amber-950 text-sm">{money(totals?.supplierDeliveryCost)}</div>
                  </div>
                  <div className="p-3 bg-indigo-50/60 rounded-2xl border border-indigo-100">
                    <div className="text-indigo-700 font-semibold mb-0.5">{t('dashboard.catPayrollPaid')}</div>
                    <div className="font-extrabold text-indigo-950 text-sm">{money(totals?.payrollTotal)}</div>
                  </div>
                </div>

                {/* Expense line items */}
                {expenses.length > 0 && (
                  <div className="rounded-2xl border border-rose-100 overflow-hidden">
                    <p className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider p-2.5 bg-rose-50/40 border-b border-rose-100">{t('dashboard.loggedExpensesTitle')}</p>
                    <Table>
                      <TableHeader className="bg-rose-50/60">
                        <TableRow>
                          <TableHead className="text-rose-950 font-bold">{t('expenses.category')}</TableHead>
                          <TableHead className="text-rose-950 font-bold">{t('expenses.description')}</TableHead>
                          <TableHead className="text-rose-950 font-bold">{t('expenses.expenseType')}</TableHead>
                          <TableHead className="text-right text-rose-950 font-bold pr-6">{t('expenses.amount')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {expenses.map((exp: any, i: number) => (
                          <TableRow key={exp.id || i} className="border-b border-rose-50 hover:bg-rose-50/20">
                            <TableCell className="font-bold text-[#2C1B10]">{exp.financialCategory?.name || exp.category || '—'}</TableCell>
                            <TableCell className="text-xs text-[#8C7361]">{exp.description || '—'}</TableCell>
                            <TableCell>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${exp.type === 'OWNER' ? 'bg-purple-100 text-purple-800 border-purple-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                                {exp.type}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-extrabold text-rose-700 pr-6">{money(exp.amount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* Supplier delivery items */}
                {deliveries.length > 0 && (
                  <div className="rounded-2xl border border-amber-100 overflow-hidden">
                    <p className="text-[11px] font-extrabold text-amber-900 uppercase tracking-wider p-2.5 bg-amber-50/40 border-b border-amber-100">{t('dashboard.supplierDeliveriesTitle')}</p>
                    <Table>
                      <TableHeader className="bg-amber-50/60">
                        <TableRow>
                          <TableHead className="text-amber-950 font-bold">Supplier</TableHead>
                          <TableHead className="text-amber-950 font-bold">Product / Material</TableHead>
                          <TableHead className="text-right text-amber-950 font-bold pr-6">Total Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {deliveries.map((d: any, i: number) => (
                          <TableRow key={d.id || i} className="border-b border-amber-50 hover:bg-amber-50/20">
                            <TableCell className="font-bold text-[#2C1B10]">{d.supplier?.name || '—'}</TableCell>
                            <TableCell className="text-xs font-semibold text-[#8C7361]">{d.product?.name || d.stockItem?.name || '—'}</TableCell>
                            <TableCell className="text-right font-extrabold text-amber-900 pr-6">{money((d.unitBuyPrice || 0) * (d.quantityReceived || 0))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {expenses.length === 0 && deliveries.length === 0 && (
                  <p className="text-xs text-[#8C7361] py-4 text-center">{t('dashboard.noExpensesToday')}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── Secondary KPI Grid Cards (With Product Money Valuation) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {/* Card 1: Net Profit */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('dashboard.netProfitToday')}</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-xl sm:text-2xl font-extrabold tracking-tight font-heading ${todayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isLoading ? '...' : money(todayNet)}
            </div>
            <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {t('dashboard.netProfitSub')}
            </p>
          </CardContent>
        </Card>

        {/* Card 2: Product Inventory Asset Value */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1 bg-amber-50/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-amber-900 tracking-wider">{t('dashboard.productStockValue')}</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-[#E87A18]/10 text-[#E87A18] flex items-center justify-center">
              <Package className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading font-mono">
              {isLoading ? '...' : money(productValuation)}
            </div>
            <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {t('dashboard.productStockValueSub')}
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Loans Today */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('dashboard.staffLoansIssued')}</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading font-mono">
              {isLoading ? '...' : money(totals?.loanTotal)}
            </div>
            <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {t('dashboard.staffLoansSub', { count: loans.length })}
            </p>
          </CardContent>
        </Card>

        {/* Card 4: Stock Health */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('dashboard.rawMaterialHealth')}</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
              <Boxes className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {isLoading ? '...' : `${stockSummary?.healthy || 0} / ${stockSummary?.totalItems || 0}`}
            </div>
            <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {stockSummary?.lowStock ? t('dashboard.itemsLowThreshold', { count: stockSummary.lowStock }) : t('dashboard.allInventoryHealthy')}
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Team & Locations */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('dashboard.activeStaffAndBranches')}</CardTitle>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-700 flex items-center justify-center">
              <Users className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {isLoading ? '...' : `${branches.length} Br, ${staffCount} Staff`}
            </div>
            <p className="text-[11px] text-[#8C7361] font-semibold mt-1">
              {t('dashboard.activeStaffSub', { branches: branches.length, staff: staffCount })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Today's P&L Summary & Inventory Alert Cards ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <Card className="col-span-1 lg:col-span-2 border-[#EDE4D5] bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-[#EDE4D5] bg-[#FFFDF8]">
            <CardTitle className="text-base font-extrabold text-[#2C1B10]">{t('dashboard.pnlStatementTitle')}</CardTitle>
            <CardDescription className="text-xs text-[#8C7361]">{t('dashboard.pnlStatementDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="space-y-3">
              <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">{t('dashboard.plusYesterdayLeftover')}</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 font-mono">+{money(yesterdayCash)}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">{t('dashboard.plusProductSales')}</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 font-mono">+{money(salesIncome)}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">{t('dashboard.plusCreditReceived')}</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 font-mono">+{money(creditReceived)}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1]">
                <span className="text-xs sm:text-sm font-semibold text-rose-800">{t('dashboard.minusTomorrowLeftover')}</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-700 font-mono">-{money(tomorrowCash)}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-emerald-50/80 rounded-xl border border-emerald-200">
                <span className="text-xs sm:text-sm font-black text-emerald-950 uppercase tracking-wider">{t('dashboard.equalsTotalRevenue')}</span>
                <span className="text-sm sm:text-base font-black text-emerald-900 font-mono">{money(todayGain)}</span>
              </div>
              <div className="flex justify-between items-center pb-2.5 border-b border-[#F4ECE1] pt-1">
                <span className="text-xs sm:text-sm font-semibold text-[#4A2E1B]">{t('dashboard.minusCompanyExpenses')}</span>
                <span className="text-xs sm:text-sm font-extrabold text-rose-600 font-mono">-{money(todayExpense)}</span>
              </div>
              {totals?.ownerExpenseTotal ? (
                <div className="flex justify-between items-center pb-2.5 border-b border-purple-100 text-purple-950">
                  <span className="text-xs font-semibold">{t('dashboard.ownerDrawingsNote')}</span>
                  <span className="text-xs font-bold font-mono text-purple-800">{money(totals.ownerExpenseTotal)}</span>
                </div>
              ) : null}
              <div className="flex justify-between items-center p-4 bg-[#F4ECE1] rounded-2xl mt-2">
                <div>
                  <span className="text-sm font-extrabold text-[#2C1B10] block">{t('dashboard.dailyNetIncome')}</span>
                  <span className="text-[11px] text-[#8C7361]">{t('dashboard.dailyNetIncomeSub')}</span>
                </div>
                <span className={`text-base sm:text-xl font-extrabold font-mono ${todayNet >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {money(todayNet)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white shadow-sm rounded-3xl overflow-hidden">
          <CardHeader className="border-b border-[#EDE4D5] bg-[#FFFDF8]">
            <CardTitle className="text-base font-extrabold text-[#2C1B10]">{t('dashboard.inventoryStatusTitle')}</CardTitle>
            <CardDescription className="text-xs text-[#8C7361]">{t('dashboard.inventoryStatusDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center p-4 rounded-2xl bg-[#E87A18]/10 border border-[#E87A18]/20">
              <Package className="w-6 h-6 text-[#E87A18] mr-3 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-[#8C7361]">{t('dashboard.readyProductAssetValue')}</p>
                <p className="text-lg font-extrabold text-[#2C1B10] font-mono">{money(productValuation)}</p>
              </div>
            </div>

            <div className="flex items-center p-4 rounded-2xl bg-emerald-50 text-emerald-900 border border-emerald-200">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mr-3 flex-shrink-0" />
              <div>
                <p className="text-sm font-extrabold">{t('dashboard.healthyStockItems')}</p>
                <p className="text-xs text-emerald-700 font-medium">{t('dashboard.healthyStockSub', { count: stockSummary?.healthy || 0 })}</p>
              </div>
            </div>

            {stockSummary && stockSummary.lowStock > 0 ? (
              <div className="flex items-center p-4 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200">
                <AlertTriangle className="w-6 h-6 text-amber-600 mr-3 flex-shrink-0" />
                <div>
                  <p className="text-sm font-extrabold">{t('dashboard.lowStockThreshold')}</p>
                  <p className="text-xs text-amber-700 font-medium">{t('dashboard.lowStockSub', { count: stockSummary.lowStock })}</p>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#F4ECE1] text-[#4A2E1B] text-xs font-semibold text-center border border-[#EDE4D5]">
                {t('dashboard.noInventoryWarnings')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── EVERYTHING LIST: UNIFIED FINANCIAL TRANSACTIONS LEDGER ── */}
      <Card className="border-[#EDE4D5] bg-white shadow-sm rounded-3xl overflow-hidden mb-8">
        <CardHeader className="border-b border-[#EDE4D5] bg-[#FFFDF8] flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#E87A18]" />
              {t('dashboard.unifiedLedgerTitle')}
            </CardTitle>
            <CardDescription className="text-xs text-[#8C7361]">
              {t('dashboard.unifiedLedgerDesc')}
            </CardDescription>
          </div>

          {/* Controls: Filter Switcher & Search */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-[#F4ECE1] p-1 rounded-xl flex items-center border border-[#EDE4D5]">
              <button
                onClick={() => setLedgerFilter('ALL')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  ledgerFilter === 'ALL' ? 'bg-[#4A2E1B] text-white shadow-xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {t('common.all')} ({unifiedTransactions.length})
              </button>
              <button
                onClick={() => setLedgerFilter('REVENUE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  ledgerFilter === 'REVENUE' ? 'bg-emerald-600 text-white shadow-xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {t('dashboard.filterRevenueOnly')}
              </button>
              <button
                onClick={() => setLedgerFilter('EXPENSE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  ledgerFilter === 'EXPENSE' ? 'bg-rose-600 text-white shadow-xs' : 'text-[#8C7361] hover:text-[#2C1B10]'
                }`}
              >
                {t('dashboard.filterExpensesOnly')}
              </button>
            </div>

            <Input
              type="text"
              placeholder={t('dashboard.searchTransactionsPlaceholder')}
              value={ledgerSearch}
              onChange={(e) => setLedgerSearch(e.target.value)}
              className="w-48 bg-white border-[#EDE4D5] rounded-xl text-xs h-9"
            />
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-10 text-[#8C7361] text-xs font-medium">
              {t('dashboard.noTransactionsFound')}
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-[#FAF6F0]">
                <TableRow>
                  <TableHead className="w-32">{t('common.date')}</TableHead>
                  <TableHead>{t('common.details')}</TableHead>
                  <TableHead>{t('expenses.category')}</TableHead>
                  <TableHead className="text-center">{t('expenses.expenseType')}</TableHead>
                  <TableHead className="text-center">{t('common.status')}</TableHead>
                  <TableHead className="text-right pr-6">{t('expenses.amount')} ({t('common.currency')})</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((tx) => (
                  <TableRow key={tx.id} className="hover:bg-[#FAF6F0]/60">
                    <TableCell className="text-xs font-mono font-semibold text-[#8C7361]">
                      {tx.date ? new Date(tx.date).toLocaleDateString() : '—'}
                    </TableCell>
                    <TableCell className="font-bold text-[#2C1B10]">
                      {tx.title}
                    </TableCell>
                    <TableCell>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                        {tx.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                        tx.type === 'REVENUE' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                      }`}>
                        {tx.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-100 text-zinc-700">
                        {tx.status}
                      </span>
                    </TableCell>
                    <TableCell className={`text-right font-extrabold pr-6 font-mono ${
                      tx.type === 'REVENUE' ? 'text-emerald-700' : 'text-rose-700'
                    }`}>
                      {tx.type === 'REVENUE' ? '+' : '-'}{money(tx.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}
