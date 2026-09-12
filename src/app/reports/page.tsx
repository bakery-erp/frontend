'use client';

import React, { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { formatEthDate } from '@/lib/ethiopianDate';
import {
  Coins,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  Package,
  Layers,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  AlertCircle,
  CreditCard,
  Search,
  RefreshCw,
} from 'lucide-react';

type ModalType = 'REVENUE' | 'EXPENSE' | 'NET_INCOME' | 'OWNER' | 'STOCK' | 'PRODUCT' | 'NET_WEALTH' | null;

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number | string;
  unitPrice?: number | string | null;
  minStockLevel?: number | string | null;
}

interface ProductItem {
  id: string;
  name: string;
  unitType: string;
  category?: { name: string; type?: string };
  currentHouseStock: number | string;
  buyPrice?: number | string | null;
  basePrice?: number | string | null;
}

export default function FinancialReportsPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();

  // Date range state (defaulting to current month in YMD)
  const todayYmd = useMemo(() => {
    return new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  }, []);

  const monthStartYmd = useMemo(() => {
    const now = new Date(Date.now() + 3 * 3600 * 1000);
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
  }, []);

  const [from, setFrom] = useState<string>(monthStartYmd);
  const [to, setTo] = useState<string>(todayYmd);
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | 'week' | 'month' | 'custom'>('month');

  // Core Data States
  const [report, setReport] = useState<any>(null);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Active Clicked Modal Detail State
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [searchFilter, setSearchFilter] = useState<string>('');

  useEffect(() => {
    fetchReportData();
  }, [selectedBranchId, from, to]);

  const fetchReportData = async () => {
    setIsLoading(true);
    try {
      const params: any = { from, to };
      if (selectedBranchId) params.branchId = selectedBranchId;

      const [reportRes, stockRes, prodRes] = await Promise.all([
        api.get('/reports/range', { params }).catch(() => ({ data: {} })),
        api.get('/stock-items', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: [] })),
        api.get('/products', { params: selectedBranchId ? { branchId: selectedBranchId } : {} }).catch(() => ({ data: [] })),
      ]);

      setReport(reportRes.data || {});
      setStockItems(Array.isArray(stockRes.data) ? stockRes.data : []);
      setProducts(Array.isArray(prodRes.data) ? prodRes.data : []);
    } catch (e: any) {
      toast.error('Failed to load financial analysis data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreset = (preset: 'today' | 'yesterday' | 'week' | 'month') => {
    setActivePreset(preset);
    const now = new Date(Date.now() + 3 * 3600 * 1000);
    if (preset === 'today') {
      const d = now.toISOString().slice(0, 10);
      setFrom(d);
      setTo(d);
    } else if (preset === 'yesterday') {
      const yest = new Date(now.getTime() - 24 * 3600 * 1000).toISOString().slice(0, 10);
      setFrom(yest);
      setTo(yest);
    } else if (preset === 'week') {
      const weekAgo = new Date(now.getTime() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10);
      setFrom(weekAgo);
      setTo(todayYmd);
    } else if (preset === 'month') {
      const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
      setFrom(firstDay);
      setTo(todayYmd);
    }
  };

  const money = (val: number | string | undefined | null) => {
    const n = Number(val || 0);
    return `${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  };

  // ─────────────────────────────────────────────────────────────
  // CALCULATIONS ACCORDING TO USER REQUIREMENTS
  // ─────────────────────────────────────────────────────────────
  const totals = report?.totals || {};

  // 1. Daily Money Revenue (Sum of daily session revenues + customer credit taken)
  const dailyCashRevenue = Number(totals.dailyTotalRevenue ?? 0);
  const customerCreditTaken = Number(totals.customerCreditSalesTotal ?? report?.customerCreditSalesTotal ?? 0);
  const revenueTotalWithCredit = dailyCashRevenue + customerCreditTaken;

  // 2. Company Daily Expense (Taken from daily money)
  const companyExpenseTotal = Number(totals.companyExpenseTotal ?? report?.companyExpenseTotal ?? 0);

  // 3. Daily Net Income (Change of revenue and expense)
  const dailyNetIncome = revenueTotalWithCredit - companyExpenseTotal;
  const netIncomeMargin = revenueTotalWithCredit > 0 ? (dailyNetIncome / revenueTotalWithCredit) * 100 : 0;

  // 4. Owner Expenses & Debts to Pay
  const ownerCashDrawings = Number(totals.ownerExpenseTotal ?? report?.ownerExpenseTotal ?? 0);
  const unpaidSupplierDeliveriesTotal = Number(report?.unpaidSupplierDeliveriesTotal ?? totals.unpaidSupplierDeliveriesTotal ?? 0);
  const unpaidStockLoansTotal = Number(report?.unpaidStockLoansTotal ?? totals.unpaidStockLoansTotal ?? 0);
  const unpaidPayablesTotal = Number(
    report?.totalPendingOwnerLiabilities ??
      totals.totalPendingOwnerLiabilities ??
      (unpaidSupplierDeliveriesTotal + unpaidStockLoansTotal)
  );
  const ownerExpenseTotalWithLiabilities = ownerCashDrawings + unpaidPayablesTotal;

  // 5. Stock / Raw Material Total Monetary Valuation
  const stockValuation = useMemo(() => {
    return stockItems.reduce((sum, item) => {
      const qty = Number(item.currentQuantity || 0);
      const price = Number(item.unitPrice || 0);
      return sum + qty * price;
    }, 0);
  }, [stockItems]);

  // 6. Products in House Monetary Valuation
  const productValuation = useMemo(() => {
    return products.reduce((sum, p) => {
      const qty = Number(p.currentHouseStock || 0);
      const price = Number(p.buyPrice || p.basePrice || 0);
      return sum + qty * price;
    }, 0);
  }, [products]);

  // 7. Clean Money & Total Net Wealth of Owner
  const totalCashCollected = Number(totals.totalCashCollected ?? totals.salesTotal ?? 0);
  const cleanMoneyInHand = totalCashCollected - companyExpenseTotal - ownerCashDrawings;

  // Total Net Wealth: Clean Money + Customer Credit + Stock Value + Product Value - Debts to Pay
  const totalNetWealth = cleanMoneyInHand + customerCreditTaken + stockValuation + productValuation - unpaidPayablesTotal;

  // Data collections for modal dialogs
  const dailyBreakdown: any[] = Array.isArray(report?.dailyBreakdown) ? report.dailyBreakdown : [];
  const customerLoans: any[] = Array.isArray(report?.customerLoans) ? report.customerLoans : [];
  const companyExpenses: any[] = Array.isArray(report?.companyExpenses) ? report.companyExpenses : [];
  const ownerExpensesList: any[] = Array.isArray(report?.ownerExpenses) ? report.ownerExpenses : [];
  const unpaidDeliveriesList: any[] = Array.isArray(report?.unpaidSupplierDeliveries) ? report.unpaidSupplierDeliveries : [];
  const unpaidStockLoansList: any[] = Array.isArray(report?.unpaidStockLoans) ? report.unpaidStockLoans : [];

  return (
    <DashboardLayout>
      {/* ── Top Header & Executive Controls ── */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-[#2C1B10] tracking-tight font-heading">
              Financial Analysis & Wealth Report
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E87A18]/15 text-[#E87A18] border border-[#E87A18]/30">
              Executive
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-1">
            Comprehensive business revenue, operational expenses, inventory valuations, and grand net wealth.
          </p>
        </div>

        {/* Date Range & Presets Toolbar */}
        <div className="flex flex-wrap items-center gap-2 bg-white p-2 rounded-2xl border border-[#EDE4D5] shadow-xs">
          <div className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5]">
            {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePreset(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all ${
                  activePreset === p
                    ? 'bg-[#4A2E1B] text-white shadow-xs'
                    : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60'
                }`}
              >
                {p === 'week' ? 'Last 7 Days' : p === 'month' ? 'This Month' : p}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset('custom');
              }}
              className="w-32 h-8 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-lg font-mono"
            />
            <span className="text-[#8C7361] font-bold">to</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset('custom');
              }}
              className="w-32 h-8 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-lg font-mono"
            />
          </div>

          <Button
            size="sm"
            onClick={fetchReportData}
            variant="outline"
            className="h-8 border-[#EDE4D5] text-[#4A2E1B] hover:bg-amber-50 rounded-xl px-3 flex items-center gap-1.5 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* ── HERO CARD: Total Net Wealth of the Owner / Business ── */}
      <div className="mb-8">
        <Card
          onClick={() => {
            setActiveModal('NET_WEALTH');
            setSearchFilter('');
          }}
          className="cursor-pointer group relative overflow-hidden rounded-3xl border-2 border-[#E87A18]/40 bg-gradient-to-br from-[#2C1B10] via-[#3E2413] to-[#1E120B] text-white shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-[1.008]"
        >
          <div className="absolute -right-12 -top-12 w-64 h-64 bg-[#E87A18]/15 rounded-full blur-3xl group-hover:bg-[#E87A18]/25 transition-all" />
          <CardHeader className="relative pb-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E87A18] to-[#FF9E40] flex items-center justify-center text-white shadow-lg">
                  <Sparkles className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2 font-heading">
                    Total Net Wealth of the Business
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      Balance Sheet
                    </span>
                  </CardTitle>
                  <CardDescription className="text-xs text-amber-200/80 font-medium">
                    Calculated from Clean Liquid Cash + Customer Credits + Warehouse Stock + Finished Products - Debts to Pay
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-300 group-hover:translate-x-1 transition-transform self-start sm:self-auto bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                <span>View Full Balance Sheet</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative pt-2">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white mb-2">
                  {isLoading ? 'Loading...' : money(totalNetWealth)}
                </div>
                <p className="text-xs text-amber-100/70 max-w-xl">
                  Sum of clean money in hand, customer credit sales, raw ingredients, and shop stock minus pending supplier liabilities.
                </p>
              </div>

              {/* Composition Quick Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-emerald-300">Clean Money in Hand</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">{money(cleanMoneyInHand)}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-sky-300">Customer Credits</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">+{money(customerCreditTaken)}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-amber-300">Stock & Products</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">+{money(stockValuation + productValuation)}</div>
                </div>
                <div className="col-span-2 sm:col-span-3 bg-rose-500/15 backdrop-blur-xs rounded-xl p-2 border border-rose-500/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-200">Pending Debts & Supplier Payables to Pay:</span>
                  <span className="font-mono font-extrabold text-rose-300">-{money(unpaidPayablesTotal)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 6 CORE FINANCIAL CARDS (CLICKABLE WITH DETAIL MODALS) ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-12">
        {/* CARD 1: Daily Money Revenue (In Range) */}
        <Card
          onClick={() => {
            setActiveModal('REVENUE');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-emerald-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-emerald-800 tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                Daily Money Revenue
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Session revenues + customer credit taken
              </CardDescription>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <ArrowUpRight className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] font-mono tracking-tight">
              {isLoading ? '...' : money(revenueTotalWithCredit)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Cash Realized:</span>
                <span className="font-bold text-[#2C1B10] font-mono">{money(dailyCashRevenue)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Customer Taken in Credit:</span>
                <span className="font-bold text-sky-700 font-mono">+{money(customerCreditTaken)}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-emerald-700 flex items-center gap-1 group-hover:underline">
              <span>Click for daily & credit breakdown</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 2: Company Daily Expenses (From Daily Money) */}
        <Card
          onClick={() => {
            setActiveModal('EXPENSE');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-rose-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-rose-800 tracking-wider flex items-center gap-1.5">
                <DollarSign className="w-4 h-4 text-rose-600" />
                Company Daily Expenses
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Paid from cashier daily money
              </CardDescription>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center group-hover:bg-rose-100 transition-colors">
              <ArrowDownRight className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 font-mono tracking-tight">
              {isLoading ? '...' : money(companyExpenseTotal)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Operating Expenses:</span>
                <span className="font-bold text-rose-900 font-mono">{money(companyExpenseTotal)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Source:</span>
                <span className="font-bold text-[#4A2E1B]">Cashier Daily Register</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-rose-700 flex items-center gap-1 group-hover:underline">
              <span>Click for itemized expense logs</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 3: Daily Net Income */}
        <Card
          onClick={() => {
            setActiveModal('NET_INCOME');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-amber-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-amber-900 tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-4 h-4 text-amber-700" />
                Daily Net Income
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Net operational profit (Revenue - Expense)
              </CardDescription>
            </div>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${dailyNetIncome >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {dailyNetIncome >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl sm:text-3xl font-extrabold font-mono tracking-tight ${dailyNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {isLoading ? '...' : money(dailyNetIncome)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Operating Margin:</span>
                <span className="font-bold text-[#2C1B10] font-mono">{netIncomeMargin.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Net Status:</span>
                <span className={`font-bold ${dailyNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {dailyNetIncome >= 0 ? 'Profitable' : 'Deficit'}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-amber-800 flex items-center gap-1 group-hover:underline">
              <span>Click for daily profitability trend</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 4: Owner Expenses & Debts to Pay */}
        <Card
          onClick={() => {
            setActiveModal('OWNER');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-purple-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-purple-900 tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-purple-700" />
                Owner Expenses & Payables
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Drawings + debts owner has to pay
              </CardDescription>
            </div>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center group-hover:bg-purple-100 transition-colors">
              <CreditCard className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-purple-950 font-mono tracking-tight">
              {isLoading ? '...' : money(ownerExpenseTotalWithLiabilities)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Cash Drawn (Already Out):</span>
                <span className="font-bold text-purple-800 font-mono">{money(ownerCashDrawings)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Debts / Credits to Pay (Not Out Yet):</span>
                <span className="font-bold text-rose-700 font-mono">{money(unpaidPayablesTotal)}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-purple-800 flex items-center gap-1 group-hover:underline">
              <span>Click for drawings & unpaid debts</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 5: Stock Total Amount in Money */}
        <Card
          onClick={() => {
            setActiveModal('STOCK');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-amber-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-amber-900 tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-[#E87A18]" />
                Warehouse Stock Valuation
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Total money value of raw ingredients
              </CardDescription>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-[#E87A18] flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Package className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] font-mono tracking-tight">
              {isLoading ? '...' : money(stockValuation)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Tracked Stock Items:</span>
                <span className="font-bold text-[#2C1B10]">{stockItems.length} materials</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Valuation Formula:</span>
                <span className="font-semibold text-[#8C7361]">Qty × Unit Buy Price</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-[#E87A18] flex items-center gap-1 group-hover:underline">
              <span>Click for itemized stock details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>

        {/* CARD 6: Products in the House in Money */}
        <Card
          onClick={() => {
            setActiveModal('PRODUCT');
            setSearchFilter('');
          }}
          className="cursor-pointer group bg-white border-[#EDE4D5] rounded-3xl p-2 shadow-sm hover:shadow-md hover:border-amber-300 transition-all hover:scale-[1.01]"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-xs uppercase font-extrabold text-amber-900 tracking-wider flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-700" />
                Products in House Valuation
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                Bakery goods & resell stock in store
              </CardDescription>
            </div>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center group-hover:bg-amber-100 transition-colors">
              <Layers className="w-5 h-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] font-mono tracking-tight">
              {isLoading ? '...' : money(productValuation)}
            </div>
            <div className="mt-3 flex flex-col gap-1 border-t border-[#EDE4D5]/60 pt-2 text-[11px]">
              <div className="flex justify-between text-[#8C7361]">
                <span>Active Products:</span>
                <span className="font-bold text-[#2C1B10]">{products.length} products</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>Stock Anchoring:</span>
                <span className="font-semibold text-emerald-700">Closed Session Leftovers</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-amber-800 flex items-center gap-1 group-hover:underline">
              <span>Click for house product inventory list</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL DETAIL POPUPS (WHEN CARDS ARE CLICKED)
         ───────────────────────────────────────────────────────────── */}
      {activeModal && (
        <Dialog open={true} onOpenChange={() => setActiveModal(null)}>
          <DialogContent className="bg-white border-[#EDE4D5] sm:max-w-4xl max-h-[88vh] overflow-y-auto p-6 rounded-3xl">
            {/* 1. REVENUE MODAL */}
            {activeModal === 'REVENUE' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                      <Coins className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Daily Money Revenue Breakdown
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Sum of daily revenues in range plus customer credit sales
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Subtotal metric cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Total Combined Revenue</div>
                    <div className="text-xl font-extrabold text-[#2C1B10] font-mono mt-1">{money(revenueTotalWithCredit)}</div>
                  </div>
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                    <div className="text-xs text-emerald-800 font-bold">Cash Realized (Sessions)</div>
                    <div className="text-xl font-extrabold text-emerald-900 font-mono mt-1">{money(dailyCashRevenue)}</div>
                  </div>
                  <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200">
                    <div className="text-xs text-sky-800 font-bold">Customer Credit Taken</div>
                    <div className="text-xl font-extrabold text-sky-900 font-mono mt-1">{money(customerCreditTaken)}</div>
                    <div className="text-[10px] text-sky-700 font-semibold mt-0.5">Uncollected debt receivable</div>
                  </div>
                </div>

                {/* Day by day breakdown table */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    Daily Session Revenue Breakdown
                  </h3>
                  <div className="rounded-2xl border border-[#EDE4D5] overflow-hidden">
                    <Table>
                      <TableHeader className="bg-[#FAF6F0]">
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead className="text-right">Yesterday Leftover</TableHead>
                          <TableHead className="text-right">POS Sales</TableHead>
                          <TableHead className="text-right">Credit Repaid</TableHead>
                          <TableHead className="text-right">Tomorrow Leftover</TableHead>
                          <TableHead className="text-right font-extrabold text-[#2C1B10] pr-4">Daily Revenue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyBreakdown.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-xs text-[#8C7361]">
                              No daily sessions found in this date range.
                            </TableCell>
                          </TableRow>
                        ) : (
                          dailyBreakdown.map((d: any, idx: number) => (
                            <TableRow key={d.date || idx}>
                              <TableCell className="font-bold text-[#2C1B10] text-xs">
                                {formatEthDate(d.date)} <span className="text-[11px] text-[#8C7361] font-mono">({d.date})</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-[#8C7361]">
                                {money(d.yesterdayCashLeftover)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-[#2C1B10]">
                                {money(d.salesTotal)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-emerald-700">
                                +{money(d.creditReceivedFromLoan)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-rose-700">
                                -{money(d.tomorrowCashLeftover)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-extrabold text-emerald-800 pr-4">
                                {money(d.dailyTotalRevenue)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            )}

            {/* 2. COMPANY DAILY EXPENSES MODAL */}
            {activeModal === 'EXPENSE' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center">
                      <DollarSign className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Company Daily Expenses (From Daily Money)
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Operational costs and cashier supplier deliveries paid out of store daily cash
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 mb-6 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-rose-900 font-bold uppercase">Total Company Expenses in Range</div>
                    <div className="text-2xl font-black text-rose-700 font-mono mt-0.5">{money(companyExpenseTotal)}</div>
                  </div>
                  <div className="text-right text-xs text-[#8C7361]">
                    <span className="font-bold text-[#2C1B10]">{companyExpenses.length}</span> individual expense entries
                  </div>
                </div>

                {/* Search / Filter input */}
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search expenses by category, description or payee..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                <div className="rounded-2xl border border-rose-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-rose-50/60">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Description / Payee</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right pr-4">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            No company daily expenses recorded in this period.
                          </TableCell>
                        </TableRow>
                      ) : (
                        companyExpenses
                          .filter((e: any) => {
                            if (!searchFilter) return true;
                            const q = searchFilter.toLowerCase();
                            return (
                              (e.category || '').toLowerCase().includes(q) ||
                              (e.description || '').toLowerCase().includes(q) ||
                              (e.financialCategory?.name || '').toLowerCase().includes(q)
                            );
                          })
                          .map((exp: any, idx: number) => (
                            <TableRow key={exp.id || idx}>
                              <TableCell className="text-xs text-[#8C7361]">
                                {formatEthDate(exp.date || exp.createdAt)}
                              </TableCell>
                              <TableCell className="font-bold text-[#2C1B10] text-xs">
                                {exp.financialCategory?.name || exp.category || 'Operational'}
                              </TableCell>
                              <TableCell className="text-xs text-[#8C7361]">
                                {exp.description || '—'}
                              </TableCell>
                              <TableCell>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  COMPANY
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-extrabold text-rose-700 pr-4">
                                {money(exp.amount)}
                              </TableCell>
                            </TableRow>
                          ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 3. DAILY NET INCOME MODAL */}
            {activeModal === 'NET_INCOME' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Daily Net Income & Profitability
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Net operating results calculated as Company Revenue minus Company Expenses
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className={`p-4 rounded-2xl border ${dailyNetIncome >= 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
                    <div className="text-xs font-bold text-[#8C7361]">Grand Net Income</div>
                    <div className={`text-2xl font-black font-mono mt-0.5 ${dailyNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {money(dailyNetIncome)}
                    </div>
                  </div>
                  <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs font-bold text-[#8C7361]">Operating Margin</div>
                    <div className="text-2xl font-black font-mono text-[#2C1B10] mt-0.5">{netIncomeMargin.toFixed(1)}%</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs font-bold text-[#8C7361]">Days Active</div>
                    <div className="text-2xl font-black font-mono text-[#2C1B10] mt-0.5">{dailyBreakdown.length} days</div>
                  </div>
                </div>

                {/* Day by Day Comparison */}
                <div className="rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Day Revenue</TableHead>
                        <TableHead className="text-right">Company Expense</TableHead>
                        <TableHead className="text-right font-bold pr-4">Net Income</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyBreakdown.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-[#8C7361]">
                            No daily performance logs in this range.
                          </TableCell>
                        </TableRow>
                      ) : (
                        dailyBreakdown.map((d: any, idx: number) => {
                          const net = Number(d.dailyTotalRevenue || 0) - Number(d.companyExpenseTotal || 0);
                          return (
                            <TableRow key={d.date || idx}>
                              <TableCell className="font-bold text-[#2C1B10] text-xs">
                                {formatEthDate(d.date)} <span className="text-[11px] text-[#8C7361] font-mono">({d.date})</span>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-emerald-800 font-semibold">
                                {money(d.dailyTotalRevenue)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-rose-700">
                                -{money(d.companyExpenseTotal)}
                              </TableCell>
                              <TableCell className={`text-right font-mono text-xs font-extrabold pr-4 ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                                {money(net)}
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 4. OWNER EXPENSES & PAYABLES MODAL */}
            {activeModal === 'OWNER' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-800 flex items-center justify-center">
                      <Wallet className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Owner Expenses, Drawings & Pending Payables
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Actual owner cash withdrawals plus debts/supplier credits you still have to pay
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200">
                    <div className="text-xs text-purple-900 font-bold uppercase">Total Owner Sum</div>
                    <div className="text-xl font-black text-purple-950 font-mono mt-1">{money(ownerExpenseTotalWithLiabilities)}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Cash Drawings (Taken Out)</div>
                    <div className="text-xl font-extrabold text-purple-800 font-mono mt-1">{money(ownerCashDrawings)}</div>
                  </div>
                  <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200">
                    <div className="text-xs text-rose-900 font-bold">Credits to Pay (Not Out Yet)</div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono mt-1">{money(unpaidPayablesTotal)}</div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Section A: Owner Cash Drawings */}
                  <div>
                    <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-purple-700" />
                      1. Owner Personal Drawings (Cash Taken Out)
                    </h4>
                    <div className="rounded-2xl border border-purple-200 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-purple-50/60">
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Category / Purpose</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right pr-4">Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ownerExpensesList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-xs text-[#8C7361]">
                                No owner personal cash drawings recorded.
                              </TableCell>
                            </TableRow>
                          ) : (
                            ownerExpensesList.map((exp: any, idx: number) => (
                              <TableRow key={exp.id || idx}>
                                <TableCell className="text-xs text-[#8C7361]">
                                  {formatEthDate(exp.date || exp.createdAt)}
                                </TableCell>
                                <TableCell className="font-bold text-[#2C1B10] text-xs">
                                  {exp.financialCategory?.name || exp.category || 'Owner Drawing'}
                                </TableCell>
                                <TableCell className="text-xs text-[#8C7361]">{exp.description || '—'}</TableCell>
                                <TableCell className="text-right font-mono text-xs font-extrabold text-purple-900 pr-4">
                                  {money(exp.amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Section B: Unpaid Deliveries / Payables (Credits Owner Has to Pay) */}
                  <div>
                    <h4 className="text-xs font-extrabold text-rose-950 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                      2. Unpaid Supplier Bills & Stock Loans (Not Actually Out Yet)
                    </h4>
                    <p className="text-xs text-[#8C7361] mb-2">
                      These are goods and deliveries received on credit that you are obligated to settle with suppliers.
                    </p>
                    <div className="rounded-2xl border border-rose-200 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-rose-50/60">
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Supplier / Creditor</TableHead>
                            <TableHead>Product / Material</TableHead>
                            <TableHead className="text-right">Total Cost</TableHead>
                            <TableHead className="text-center pr-4">Payable Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpaidDeliveriesList.length === 0 && unpaidStockLoansList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-4 text-xs text-[#8C7361]">
                                No pending supplier debts or unpaid stock purchase loans found!
                              </TableCell>
                            </TableRow>
                          ) : (
                            <>
                              {unpaidDeliveriesList.map((d: any, idx: number) => {
                                const cost = Number(d.unitBuyPrice) * Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                                return (
                                  <TableRow key={d.id || idx}>
                                    <TableCell className="text-xs text-[#8C7361]">
                                      {formatEthDate(d.createdAt)}
                                    </TableCell>
                                    <TableCell className="font-bold text-[#2C1B10] text-xs">
                                      {d.supplier?.name || 'Supplier'}
                                    </TableCell>
                                    <TableCell className="text-xs text-[#8C7361]">
                                      {d.product?.name || d.stockItem?.name || 'Resell / Material'} ({d.quantityReceived} pcs)
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-bold text-rose-700">
                                      {money(cost)}
                                    </TableCell>
                                    <TableCell className="text-center pr-4">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                        UNPAID DELIVERY
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                              {unpaidStockLoansList.map((sl: any, idx: number) => (
                                <TableRow key={sl.id || idx}>
                                  <TableCell className="text-xs text-[#8C7361]">
                                    {formatEthDate(sl.createdAt)}
                                  </TableCell>
                                  <TableCell className="font-bold text-[#2C1B10] text-xs">
                                    {sl.supplierName || 'Ingredient Supplier'}
                                  </TableCell>
                                  <TableCell className="text-xs text-[#8C7361]">
                                    {sl.stockMovement?.stockItem?.name || 'Stock Material'}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold text-rose-700">
                                    {money(sl.remainingBalance)}
                                  </TableCell>
                                  <TableCell className="text-center pr-4">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      PURCHASE LOAN
                                    </span>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 5. STOCK TOTAL AMOUNT & DETAIL MODAL */}
            {activeModal === 'STOCK' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-[#E87A18] flex items-center justify-center">
                      <Package className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Warehouse Stock / Raw Materials Valuation
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Current physical quantities of baking ingredients and inventory monetary values
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Total Stock Monetary Valuation</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{money(stockValuation)}</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Tracked Ingredients</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{stockItems.length} items</div>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search raw materials..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                <div className="rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>Material / Stock Item</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead className="text-right">In Stock Quantity</TableHead>
                        <TableHead className="text-right">Unit Price (ETB)</TableHead>
                        <TableHead className="text-right font-extrabold pr-4">Total Monetary Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            No raw materials registered for this branch.
                          </TableCell>
                        </TableRow>
                      ) : (
                        stockItems
                          .filter((i) => !searchFilter || i.name.toLowerCase().includes(searchFilter.toLowerCase()))
                          .map((item) => {
                            const qty = Number(item.currentQuantity || 0);
                            const price = Number(item.unitPrice || 0);
                            const val = qty * price;
                            const isLow = item.minStockLevel != null && qty <= Number(item.minStockLevel);
                            return (
                              <TableRow key={item.id}>
                                <TableCell className="font-bold text-[#2C1B10] text-xs">
                                  {item.name}
                                  {isLow && (
                                    <span className="ml-2 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                      LOW STOCK
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-[#8C7361]">{item.unitType}</TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-[#2C1B10]">
                                  {qty.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[#8C7361]">
                                  {price.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-extrabold text-amber-900 pr-4">
                                  {money(val)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 6. PRODUCTS IN THE HOUSE IN MONEY MODAL */}
            {activeModal === 'PRODUCT' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-extrabold text-[#2C1B10]">
                        Bakery Products In-House Inventory Valuation
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Physical products currently ready in house anchored to closed session counts
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Total Finished Product Valuation</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{money(productValuation)}</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">Bakery Product Types</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{products.length} items</div>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search finished products..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                <div className="rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>Product Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">House Stock</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right font-extrabold pr-4">Total Value</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            No bakery products found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        products
                          .filter((p) => !searchFilter || p.name.toLowerCase().includes(searchFilter.toLowerCase()))
                          .map((p) => {
                            const qty = Number(p.currentHouseStock || 0);
                            const price = Number(p.buyPrice || p.basePrice || 0);
                            const val = qty * price;
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="font-bold text-[#2C1B10] text-xs">
                                  {p.name}
                                </TableCell>
                                <TableCell className="text-xs text-[#8C7361]">
                                  {p.category?.name || 'General'}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-bold text-[#2C1B10]">
                                  {qty.toLocaleString()} {p.unitType}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[#8C7361]">
                                  {price.toFixed(2)} ETB
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-extrabold text-amber-900 pr-4">
                                  {money(val)}
                                </TableCell>
                              </TableRow>
                            );
                          })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {/* 7. COMPLETE NET WEALTH BALANCE SHEET MODAL */}
            {activeModal === 'NET_WEALTH' && (
              <div>
                <DialogHeader className="mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg sm:text-xl font-black text-[#2C1B10] font-heading">
                        Complete Wealth Composition & Clean Cash Audit
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        Financial reconciliation: Cash in hand, customer debts, physical inventories and supplier liabilities
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5] mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase font-extrabold text-amber-900">Grand Total Net Wealth</div>
                      <div className="text-3xl font-black text-[#2C1B10] font-mono mt-0.5">{money(totalNetWealth)}</div>
                    </div>
                    <div className="text-xs text-[#8C7361] max-w-sm">
                      This represents your complete financial position across all cash, receivables, assets, and liabilities.
                    </div>
                  </div>
                </div>

                {/* Wealth Composition Breakdown List */}
                <div className="space-y-3">
                  {/* Item 1: Clean Money */}
                  <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                        1
                      </div>
                      <div>
                        <div className="font-extrabold text-emerald-950 text-sm">Clean Liquid Money in Hand / Bank</div>
                        <div className="text-xs text-emerald-800">
                          Cash collected ({money(totalCashCollected)}) minus daily company expenses ({money(companyExpenseTotal)}) and owner cash drawings ({money(ownerCashDrawings)}).
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-lg text-emerald-800">
                      {money(cleanMoneyInHand)}
                    </div>
                  </div>

                  {/* Item 2: Customer Credits */}
                  <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold">
                        2
                      </div>
                      <div>
                        <div className="font-extrabold text-sky-950 text-sm">Customer Credit Receivables</div>
                        <div className="text-xs text-sky-800">
                          Products sold on credit to customers awaiting debt recovery ({customerLoans.length} active records).
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-lg text-sky-800">
                      +{money(customerCreditTaken)}
                    </div>
                  </div>

                  {/* Item 3: Warehouse Stock Inventory */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#E87A18] text-white flex items-center justify-center font-bold">
                        3
                      </div>
                      <div>
                        <div className="font-extrabold text-amber-950 text-sm">Raw Materials Inventory Asset Value</div>
                        <div className="text-xs text-amber-800">
                          Physical raw ingredients in warehouse ({stockItems.length} items valued at unit purchase cost).
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-lg text-amber-900">
                      +{money(stockValuation)}
                    </div>
                  </div>

                  {/* Item 4: Finished Products */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-amber-700 text-white flex items-center justify-center font-bold">
                        4
                      </div>
                      <div>
                        <div className="font-extrabold text-amber-950 text-sm">In-House Finished Bakery Goods Asset Value</div>
                        <div className="text-xs text-amber-800">
                          Bakery items and resell inventory currently on store shelves ({products.length} product lines).
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-lg text-amber-900">
                      +{money(productValuation)}
                    </div>
                  </div>

                  {/* Item 5: Expenses You Have to Give Yet */}
                  <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold">
                        5
                      </div>
                      <div>
                        <div className="font-extrabold text-rose-950 text-sm">Expenses / Credits You Have to Give Yet (Payables)</div>
                        <div className="text-xs text-rose-800">
                          Unpaid supplier deliveries ({money(unpaidSupplierDeliveriesTotal)}) and unpaid stock loans ({money(unpaidStockLoansTotal)}) awaiting settlement.
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono font-black text-lg text-rose-700">
                      -{money(unpaidPayablesTotal)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-[#EDE4D5]">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] rounded-xl text-xs font-bold px-6"
              >
                Close Breakdown
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}