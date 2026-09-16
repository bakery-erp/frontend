'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
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

  // Auto-center active preset tab smoothly
  const presetTabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});
  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = presetTabRefs.current[activePreset];
      if (btn) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activePreset]);

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

  const cleanCustomerInfo = (raw: string | null | undefined): { name: string; phone: string } => {
    if (!raw) return { name: 'Client / Cafe', phone: '' };
    let namePart = String(raw);
    namePart = namePart.replace(/\[CreditItems:\s*\[.*?\]\s*\]/gi, '').trim();
    namePart = namePart.replace(/\[Products:.*?\]/gi, '').trim();

    let phone = '';
    const phoneMatch = namePart.match(/\((.*?)\)/);
    if (phoneMatch) {
      phone = phoneMatch[1].trim();
      namePart = namePart.replace(/\(.*?\)/, '').trim();
    }

    const parts = namePart.split(/\s+-\s+/);
    if (parts.length > 1) {
      namePart = parts[0].trim();
    }
    namePart = namePart.replace(/^-\s*|\s*-$/g, '').trim();

    return {
      name: namePart || 'Customer / Cafe',
      phone,
    };
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
              {t('reports.title')}
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-[#E87A18]/15 text-[#E87A18] border border-[#E87A18]/30">
              {t('reports.executiveBadge')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#8C7361] font-medium mt-1">
            {t('reports.subtitle')}
          </p>
        </div>

        {/* Date Range & Presets Toolbar */}
        <div className="flex flex-col md:flex-row md:items-center gap-2.5 bg-white p-2.5 rounded-2xl border border-[#EDE4D5] shadow-xs">
          {/* Scrollable preset pills with auto-centering and edge gradient fades */}
          <div className="relative w-full sm:w-auto max-w-full overflow-hidden shrink-0">
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />
            <div
              className="flex items-center gap-1 bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5] overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_1.5rem]"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              {(['today', 'yesterday', 'week', 'month'] as const).map((p) => (
                <button
                  key={p}
                  ref={(el) => { presetTabRefs.current[p] = el; }}
                  onClick={() => handlePreset(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap shrink-0 ${
                    activePreset === p
                      ? 'bg-[#4A2E1B] text-white shadow-xs'
                      : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/60'
                  }`}
                >
                  {p === 'today' ? t('reports.presetToday') : p === 'yesterday' ? t('reports.presetYesterday') : p === 'week' ? t('reports.presetWeek') : t('reports.presetMonth')}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
            <Input
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setActivePreset('custom');
              }}
              className="flex-1 sm:w-32 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl font-mono"
            />
            <span className="text-[#8C7361] font-bold shrink-0">{t('reports.to')}</span>
            <Input
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setActivePreset('custom');
              }}
              className="flex-1 sm:w-32 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl font-mono"
            />
            <Button
              size="sm"
              onClick={fetchReportData}
              variant="outline"
              className="h-9 border-[#EDE4D5] text-[#4A2E1B] hover:bg-amber-50 rounded-xl px-3 flex items-center gap-1.5 text-xs font-bold shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{t('common.refresh')}</span>
            </Button>
          </div>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-2">
              <div className="flex items-start sm:items-center gap-3 min-w-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-[#E87A18] to-[#FF9E40] flex items-center justify-center text-white shadow-lg shrink-0">
                  <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <CardTitle className="text-lg sm:text-2xl font-black tracking-tight text-white font-heading leading-tight">
                      {t('reports.totalNetWealth')}
                    </CardTitle>
                    <span className="text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 whitespace-nowrap">
                      {t('reports.balanceSheet')}
                    </span>
                  </div>
                  <CardDescription className="text-xs text-amber-200/80 font-medium leading-relaxed">
                    {t('reports.netWealthDesc')}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs font-bold text-amber-300 group-hover:translate-x-1 transition-transform self-start sm:self-auto bg-white/10 px-3 py-1.5 rounded-xl backdrop-blur-xs shrink-0 mt-1 sm:mt-0">
                <span>{t('reports.viewFullBalanceSheet')}</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </CardHeader>

          <CardContent className="relative pt-2">
            <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
              <div>
                <div className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white mb-2">
                  {isLoading ? t('common.loading') : money(totalNetWealth)}
                </div>
                <p className="text-xs text-amber-100/70 max-w-xl">
                  {t('reports.netWealthFormulaDesc')}
                </p>
              </div>

              {/* Composition Quick Chips */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-emerald-300">{t('reports.cleanMoneyInHand')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">{money(cleanMoneyInHand)}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-sky-300">{t('reports.customerCredits')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">+{money(customerCreditTaken)}</div>
                </div>
                <div className="bg-white/10 backdrop-blur-xs rounded-xl p-2.5 border border-white/10">
                  <div className="text-[10px] uppercase font-bold text-amber-300">{t('reports.stockAndProducts')}</div>
                  <div className="font-mono font-bold text-white text-sm mt-0.5">+{money(stockValuation + productValuation)}</div>
                </div>
                <div className="col-span-2 sm:col-span-3 bg-rose-500/15 backdrop-blur-xs rounded-xl p-2 border border-rose-500/30 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-rose-200">{t('reports.pendingDebtsToPay')}</span>
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
                {t('reports.cardDailyRevenueTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardDailyRevenueSubtitle')}
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
                <span>{t('reports.cashRealized')}</span>
                <span className="font-bold text-[#2C1B10] font-mono">{money(dailyCashRevenue)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.customerCreditTaken')}</span>
                <span className="font-bold text-sky-700 font-mono">+{money(customerCreditTaken)}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-emerald-700 flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickRevenueBreakdown')}</span>
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
                {t('reports.cardCompanyExpensesTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardCompanyExpensesSubtitle')}
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
                <span>{t('reports.operatingExpenses')}</span>
                <span className="font-bold text-rose-900 font-mono">{money(companyExpenseTotal)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.sourceLabel')}</span>
                <span className="font-bold text-[#4A2E1B]">{t('reports.cashierDailyRegister')}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-rose-700 flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickExpenseLogs')}</span>
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
                {t('reports.cardNetIncomeTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardNetIncomeSubtitle')}
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
                <span>{t('reports.operatingMargin')}</span>
                <span className="font-bold text-[#2C1B10] font-mono">{netIncomeMargin.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.netStatus')}</span>
                <span className={`font-bold ${dailyNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {dailyNetIncome >= 0 ? t('reports.statusProfitable') : t('reports.statusDeficit')}
                </span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-amber-800 flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickNetTrend')}</span>
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
                {t('reports.cardOwnerExpensesTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardOwnerExpensesSubtitle')}
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
                <span>{t('reports.cashDrawnOut')}</span>
                <span className="font-bold text-purple-800 font-mono">{money(ownerCashDrawings)}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.debtsCreditsToPay')}</span>
                <span className="font-bold text-rose-700 font-mono">{money(unpaidPayablesTotal)}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-purple-800 flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickOwnerDrawingsDebts')}</span>
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
                {t('reports.cardStockValuationTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardStockValuationSubtitle')}
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
                <span>{t('reports.trackedStockItems')}</span>
                <span className="font-bold text-[#2C1B10]">{t('reports.materialsCount').replace('{count}', String(stockItems.length))}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.valuationFormula')}</span>
                <span className="font-semibold text-[#8C7361]">{t('reports.qtyTimesPrice')}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-[#E87A18] flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickStockDetails')}</span>
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
                {t('reports.cardProductsValuationTitle')}
              </CardTitle>
              <CardDescription className="text-[11px] text-[#8C7361] mt-0.5">
                {t('reports.cardProductsValuationSubtitle')}
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
                <span>{t('reports.activeProducts')}</span>
                <span className="font-bold text-[#2C1B10]">{t('reports.productsCount').replace('{count}', String(products.length))}</span>
              </div>
              <div className="flex justify-between text-[#8C7361]">
                <span>{t('reports.stockAnchoring')}</span>
                <span className="font-semibold text-emerald-700">{t('reports.closedSessionLeftovers')}</span>
              </div>
            </div>
            <div className="mt-3 text-[11px] font-bold text-amber-800 flex items-center gap-1 group-hover:underline">
              <span>{t('reports.clickProductList')}</span>
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
          <DialogContent className="bg-white border-[#EDE4D5] w-[96vw] max-w-5xl sm:max-w-5xl xl:max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-3xl shadow-2xl">
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
                        {t('reports.cardDailyRevenueTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardDailyRevenueSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                {/* Subtotal metric cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.totalRevenue')}</div>
                    <div className="text-xl font-extrabold text-[#2C1B10] font-mono mt-1">{money(revenueTotalWithCredit)}</div>
                  </div>
                  <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
                    <div className="text-xs text-emerald-800 font-bold">{t('reports.cashRealized')}</div>
                    <div className="text-xl font-extrabold text-emerald-900 font-mono mt-1">{money(dailyCashRevenue)}</div>
                  </div>
                  <div className="bg-sky-50/70 p-3.5 rounded-2xl border border-sky-200">
                    <div className="text-xs text-sky-800 font-bold">{t('reports.customerCreditTaken')}</div>
                    <div className="text-xl font-extrabold text-sky-900 font-mono mt-1">{money(customerCreditTaken)}</div>
                    <div className="text-[10px] text-sky-700 font-semibold mt-0.5">{t('reports.uncollectedDebtReceivable')}</div>
                  </div>
                </div>

                {/* Day by day breakdown */}
                <div className="space-y-4">
                  <h3 className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    {t('reports.dailyBreakdownTitle')}
                  </h3>

                  {/* Mobile Touch Cards for Daily Sessions */}
                  <div className="block md:hidden space-y-2.5">
                    {dailyBreakdown.length === 0 ? (
                      <div className="text-center py-6 text-xs text-[#8C7361] bg-[#FAF6F0] rounded-xl border border-[#EDE4D5]">
                        {t('reports.noSessionsInRange')}
                      </div>
                    ) : (
                      dailyBreakdown.map((d: any, idx: number) => (
                        <div
                          key={d.date || idx}
                          className="bg-[#FAF6F0] rounded-xl p-3 border border-[#EDE4D5] space-y-2 shadow-2xs"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-extrabold text-sm text-[#2C1B10]">
                                {formatEthDate(d.date)}
                              </span>
                              <span className="text-[10px] text-[#8C7361] font-mono block">
                                {d.date}
                              </span>
                            </div>
                            <span className="text-xs font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg font-mono">
                              {money(d.dailyTotalRevenue)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-1.5 text-xs bg-white p-2 rounded-lg border border-[#EDE4D5]">
                            <div>
                              <span className="text-[10px] text-[#8C7361] block">{t('reports.yesterdayLeftoverLabel')}</span>
                              <span className="font-mono text-zinc-700">{money(d.yesterdayCashLeftover)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#8C7361] block">{t('reports.posSalesLabel')}</span>
                              <span className="font-mono font-bold text-[#2C1B10]">{money(d.salesTotal)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#8C7361] block">{t('reports.creditRepaidLabel')}</span>
                              <span className="font-mono font-semibold text-emerald-700">+{money(d.creditReceivedFromLoan)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#8C7361] block">{t('reports.tomorrowLeftoverLabel')}</span>
                              <span className="font-mono text-rose-700">-{money(d.tomorrowCashLeftover)}</span>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Desktop Table for Daily Sessions */}
                  <div className="hidden md:block rounded-2xl border border-[#EDE4D5] overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-[#FAF6F0]">
                        <TableRow>
                          <TableHead className="whitespace-nowrap min-w-[130px]">{t('common.date')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap">{t('reports.colYesterdayLeftover')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap">{t('reports.colSalesIncome')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap">{t('reports.colCreditRepaid')}</TableHead>
                          <TableHead className="text-right whitespace-nowrap">{t('reports.colTomorrowLeftover')}</TableHead>
                          <TableHead className="text-right font-extrabold text-[#2C1B10] pr-4 whitespace-nowrap">{t('reports.colDailyRevenue')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dailyBreakdown.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-6 text-xs text-[#8C7361]">
                              {t('reports.noSessionsInRange')}
                            </TableCell>
                          </TableRow>
                        ) : (
                          dailyBreakdown.map((d: any, idx: number) => (
                            <TableRow key={d.date || idx}>
                              <TableCell className="text-xs py-2">
                                <div className="font-bold text-[#2C1B10] whitespace-nowrap">{formatEthDate(d.date)}</div>
                                <div className="text-[10px] text-[#8C7361] font-mono">{d.date}</div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-[#8C7361] whitespace-nowrap">
                                {money(d.yesterdayCashLeftover)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-[#2C1B10] whitespace-nowrap">
                                {money(d.salesTotal)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-emerald-700 whitespace-nowrap">
                                +{money(d.creditReceivedFromLoan)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs text-rose-700 whitespace-nowrap">
                                -{money(d.tomorrowCashLeftover)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-xs font-extrabold text-emerald-800 pr-4 whitespace-nowrap">
                                {money(d.dailyTotalRevenue)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Customer Credits Given in this Range (Without bulky product details) */}
                  {customerLoans.length > 0 && (
                    <div className="mt-5 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold text-sky-950 uppercase tracking-wider flex items-center gap-1.5">
                          <CreditCard className="w-4 h-4 text-sky-700" />
                          {t('reports.customerCreditsPeriod').replace('{count}', String(customerLoans.length))}
                        </h4>
                        <span className="text-[11px] font-bold text-sky-800">
                          {t('common.total')}: {money(customerCreditTaken)}
                        </span>
                      </div>

                      {/* Mobile Touch Cards for Customer Credits */}
                      <div className="block md:hidden space-y-2">
                        {customerLoans.map((l: any, idx: number) => {
                          const cust = cleanCustomerInfo(l.entityId);
                          return (
                            <div
                              key={l.id || idx}
                              className="bg-sky-50/50 rounded-xl p-3 border border-sky-200 space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-xs text-[#2C1B10]">
                                    {cust.name}
                                  </span>
                                  {cust.phone && (
                                    <span className="block text-[11px] text-[#8C7361]">
                                      {cust.phone}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-[#8C7361] mt-0.5 block">
                                    {formatEthDate(l.date || l.createdAt)}
                                  </span>
                                </div>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                    l.status === 'PAID'
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                      : 'bg-amber-100 text-amber-800 border-amber-300'
                                  }`}
                                >
                                  {l.status}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2 rounded-lg border border-sky-100 font-mono">
                                <div>
                                  <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.creditedLabel')}</span>
                                  <span className="font-bold text-sky-900">{money(l.totalAmount)}</span>
                                </div>
                                <div>
                                  <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.balanceDueLabel')}</span>
                                  <span className="font-bold text-rose-700">{money(l.remainingBalance)}</span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Desktop Table for Customer Credits */}
                      <div className="hidden md:block rounded-2xl border border-sky-200 overflow-hidden">
                        <Table>
                          <TableHeader className="bg-sky-50/60">
                            <TableRow>
                              <TableHead>{t('common.date')}</TableHead>
                              <TableHead>{t('reports.customerNameCol')}</TableHead>
                              <TableHead className="text-right">{t('reports.creditedAmountCol')}</TableHead>
                              <TableHead className="text-right">{t('reports.balanceDueCol')}</TableHead>
                              <TableHead className="text-center pr-4">{t('reports.statusCol')}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {customerLoans.map((l: any, idx: number) => {
                              const cust = cleanCustomerInfo(l.entityId);
                              return (
                                <TableRow key={l.id || idx}>
                                  <TableCell className="text-xs text-[#8C7361]">
                                    {formatEthDate(l.date || l.createdAt)}
                                  </TableCell>
                                  <TableCell className="font-bold text-[#2C1B10] text-xs">
                                    {cust.name}
                                    {cust.phone && (
                                      <span className="ml-1.5 text-[11px] text-[#8C7361] font-normal">
                                        ({cust.phone})
                                      </span>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold text-sky-900">
                                    {money(l.totalAmount)}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs text-rose-700">
                                    {money(l.remainingBalance)}
                                  </TableCell>
                                  <TableCell className="text-center pr-4">
                                    <span
                                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                        l.status === 'PAID'
                                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                          : 'bg-amber-100 text-amber-800 border-amber-300'
                                      }`}
                                    >
                                      {l.status}
                                    </span>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
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
                        {t('reports.cardCompanyExpensesTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardCompanyExpensesSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="bg-rose-50/70 p-4 rounded-2xl border border-rose-200 mb-6 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-rose-900 font-bold uppercase">{t('reports.cardCompanyExpensesTitle')}</div>
                    <div className="text-2xl font-black text-rose-700 font-mono mt-0.5">{money(companyExpenseTotal)}</div>
                  </div>
                  <div className="text-right text-xs text-[#8C7361]">
                    <span className="font-bold text-[#2C1B10]">{t('reports.individualExpenseEntries').replace('{count}', String(companyExpenses.length))}</span>
                  </div>
                </div>

                {/* Search / Filter input */}
                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder={t('reports.searchFilterExpensesPlaceholder')}
                    value={searchFilter}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-10 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                {/* Mobile Touch Cards for Expenses */}
                <div className="block md:hidden space-y-2.5">
                  {companyExpenses
                    .filter((e: any) => {
                      if (!searchFilter) return true;
                      const q = searchFilter.toLowerCase();
                      return (
                        (e.category || '').toLowerCase().includes(q) ||
                        (e.description || '').toLowerCase().includes(q) ||
                        (e.financialCategory?.name || '').toLowerCase().includes(q)
                      );
                    }).length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8C7361] bg-rose-50/40 rounded-xl border border-rose-200">
                      {t('reports.noCompanyExpensesInRange')}
                    </div>
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
                        <div
                          key={exp.id || idx}
                          className="bg-rose-50/40 rounded-xl p-3 border border-rose-200 space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-xs text-[#2C1B10]">
                                {exp.financialCategory?.name || exp.category || t('reports.operatingExpenses')}
                              </span>
                              <span className="text-[10px] text-[#8C7361] block mt-0.5">
                                {formatEthDate(exp.date || exp.createdAt)}
                              </span>
                            </div>
                            <span className="font-mono font-extrabold text-xs text-rose-700 bg-white border border-rose-200 px-2 py-0.5 rounded-lg">
                              {money(exp.amount)}
                            </span>
                          </div>
                          {exp.description && (
                            <p className="text-xs text-zinc-700 bg-white p-2 rounded-lg border border-rose-100">
                              {exp.description}
                            </p>
                          )}
                        </div>
                      ))
                  )}
                </div>

                {/* Desktop Table for Expenses */}
                <div className="hidden md:block rounded-2xl border border-rose-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-rose-50/60">
                      <TableRow>
                        <TableHead>{t('common.date')}</TableHead>
                        <TableHead>{t('expenses.category')}</TableHead>
                        <TableHead>{t('expenses.description')}</TableHead>
                        <TableHead>{t('expenses.colType')}</TableHead>
                        <TableHead className="text-right pr-4">{t('expenses.amount')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companyExpenses.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            {t('reports.noCompanyExpensesInRange')}
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
                                {exp.financialCategory?.name || exp.category || t('reports.operatingExpenses')}
                              </TableCell>
                              <TableCell className="text-xs text-[#8C7361]">
                                {exp.description || '—'}
                              </TableCell>
                              <TableCell>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                  {t('expenses.badgeDaily')}
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
                        {t('reports.cardNetIncomeTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardNetIncomeSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className={`p-4 rounded-2xl border ${dailyNetIncome >= 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-rose-50/70 border-rose-200'}`}>
                    <div className="text-xs font-bold text-[#8C7361]">{t('reports.grandNetIncome')}</div>
                    <div className={`text-2xl font-black font-mono mt-0.5 ${dailyNetIncome >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {money(dailyNetIncome)}
                    </div>
                  </div>
                  <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs font-bold text-[#8C7361]">{t('reports.operatingMargin')}</div>
                    <div className="text-2xl font-black font-mono text-[#2C1B10] mt-0.5">{netIncomeMargin.toFixed(1)}%</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs font-bold text-[#8C7361]">{t('reports.daysActive')}</div>
                    <div className="text-2xl font-black font-mono text-[#2C1B10] mt-0.5">{t('reports.daysCount').replace('{count}', String(dailyBreakdown.length))}</div>
                  </div>
                </div>

                {/* Day by Day Comparison */}
                {/* Mobile Touch Cards for Daily Net Income */}
                <div className="block md:hidden space-y-2.5">
                  {dailyBreakdown.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8C7361] bg-[#FAF6F0] rounded-xl border border-[#EDE4D5]">
                      {t('reports.noDailyPerformanceLogs')}
                    </div>
                  ) : (
                    dailyBreakdown.map((d: any, idx: number) => {
                      const net = Number(d.dailyTotalRevenue || 0) - Number(d.companyExpenseTotal || 0);
                      return (
                        <div
                          key={d.date || idx}
                          className="bg-[#FAF6F0] rounded-xl p-3 border border-[#EDE4D5] space-y-2"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="font-bold text-xs text-[#2C1B10]">
                                {formatEthDate(d.date)}
                              </span>
                              <span className="text-[10px] text-[#8C7361] block font-mono">
                                {d.date}
                              </span>
                            </div>
                            <span
                              className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded-lg border ${
                                net >= 0
                                    ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                  : 'text-rose-700 bg-rose-50 border-rose-200'
                              }`}
                            >
                              {money(net)}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2 rounded-lg border border-[#EDE4D5] font-mono">
                            <div>
                              <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.dayRevenueLabel')}</span>
                              <span className="font-bold text-emerald-800">{money(d.dailyTotalRevenue)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.companyExpenseLabel')}</span>
                              <span className="font-bold text-rose-700">-{money(d.companyExpenseTotal)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Desktop Table for Daily Net Income */}
                <div className="hidden md:block rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>{t('common.date')}</TableHead>
                        <TableHead className="text-right">{t('reports.colDailyRevenue')}</TableHead>
                        <TableHead className="text-right">{t('reports.colCompanyExpenses')}</TableHead>
                        <TableHead className="text-right font-bold pr-4">{t('reports.colDailyNetIncome')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {dailyBreakdown.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-xs text-[#8C7361]">
                            {t('reports.noDailyPerformanceLogs')}
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
                        {t('reports.cardOwnerExpensesTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardOwnerExpensesSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                  <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200">
                    <div className="text-xs text-purple-900 font-bold uppercase">{t('reports.totalOwnerSum')}</div>
                    <div className="text-xl font-black text-purple-950 font-mono mt-1">{money(ownerExpenseTotalWithLiabilities)}</div>
                  </div>
                  <div className="bg-white p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.ownerDrawingsTakenOut')}</div>
                    <div className="text-xl font-extrabold text-purple-800 font-mono mt-1">{money(ownerCashDrawings)}</div>
                  </div>
                  <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200">
                    <div className="text-xs text-rose-900 font-bold">{t('reports.creditsToPayNotOut')}</div>
                    <div className="text-xl font-extrabold text-rose-700 font-mono mt-1">{money(unpaidPayablesTotal)}</div>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Section A: Owner Cash Drawings */}
                  <div>
                    <h4 className="text-xs font-extrabold text-purple-950 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <Wallet className="w-4 h-4 text-purple-700" />
                      {t('reports.ownerPersonalDrawingsTitle')}
                    </h4>

                    {/* Mobile Touch Cards for Drawings */}
                    <div className="block md:hidden space-y-2.5">
                      {ownerExpensesList.length === 0 ? (
                        <div className="text-center py-4 text-xs text-[#8C7361] bg-purple-50/40 rounded-xl border border-purple-200">
                          {t('reports.noOwnerDrawingsRecorded')}
                        </div>
                      ) : (
                        ownerExpensesList.map((exp: any, idx: number) => (
                          <div
                            key={exp.id || idx}
                            className="bg-purple-50/40 rounded-xl p-3 border border-purple-200 space-y-2"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-xs text-[#2C1B10]">
                                  {exp.financialCategory?.name || exp.category || t('reports.colOwnerDrawings')}
                                </span>
                                <span className="text-[10px] text-[#8C7361] block mt-0.5">
                                  {formatEthDate(exp.date || exp.createdAt)}
                                </span>
                              </div>
                              <span className="font-mono font-extrabold text-xs text-purple-900 bg-white border border-purple-200 px-2 py-0.5 rounded-lg">
                                {money(exp.amount)}
                              </span>
                            </div>
                            {exp.description && (
                              <p className="text-xs text-zinc-700 bg-white p-2 rounded-lg border border-purple-100">
                                {exp.description}
                              </p>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {/* Desktop Table for Drawings */}
                    <div className="hidden md:block rounded-2xl border border-purple-200 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-purple-50/60">
                          <TableRow>
                            <TableHead>{t('common.date')}</TableHead>
                            <TableHead>{t('expenses.category')}</TableHead>
                            <TableHead>{t('expenses.description')}</TableHead>
                            <TableHead className="text-right pr-4">{t('expenses.amount')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ownerExpensesList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-4 text-xs text-[#8C7361]">
                                {t('reports.noOwnerDrawingsRecorded')}
                              </TableCell>
                            </TableRow>
                          ) : (
                            ownerExpensesList.map((exp: any, idx: number) => (
                              <TableRow key={exp.id || idx}>
                                <TableCell className="text-xs text-[#8C7361]">
                                  {formatEthDate(exp.date || exp.createdAt)}
                                </TableCell>
                                <TableCell className="font-bold text-[#2C1B10] text-xs">
                                  {exp.financialCategory?.name || exp.category || t('reports.colOwnerDrawings')}
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
                      {t('reports.unpaidBillsTitle')}
                    </h4>
                    <p className="text-xs text-[#8C7361] mb-2">
                      {t('reports.unpaidBillsSubtitle')}
                    </p>

                    {/* Mobile Touch Cards for Payables */}
                    <div className="block md:hidden space-y-2.5">
                      {unpaidDeliveriesList.length === 0 && unpaidStockLoansList.length === 0 ? (
                        <div className="text-center py-4 text-xs text-[#8C7361] bg-rose-50/40 rounded-xl border border-rose-200">
                          {t('reports.noPendingDebtsFound')}
                        </div>
                      ) : (
                        <>
                          {unpaidDeliveriesList.map((d: any, idx: number) => {
                            const cost = Number(d.unitBuyPrice) * Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                            return (
                              <div
                                key={d.id || idx}
                                className="bg-rose-50/40 rounded-xl p-3 border border-rose-200 space-y-2"
                              >
                                <div className="flex justify-between items-start">
                                  <div>
                                    <span className="font-bold text-xs text-[#2C1B10]">
                                      {d.supplier?.name || t('suppliers.title')}
                                    </span>
                                    <span className="text-[10px] text-[#8C7361] block mt-0.5">
                                      {formatEthDate(d.createdAt)}
                                    </span>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                    {t('reports.unpaidDeliveryBadge')}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-rose-100 text-xs">
                                  <span className="text-zinc-700">
                                    {d.product?.name || d.stockItem?.name || 'Item'} ({d.quantityReceived} {t('common.pieces')})
                                  </span>
                                  <span className="font-mono font-extrabold text-rose-700">
                                    {money(cost)}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                          {unpaidStockLoansList.map((sl: any, idx: number) => (
                            <div
                              key={sl.id || idx}
                              className="bg-amber-50/40 rounded-xl p-3 border border-amber-200 space-y-2"
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="font-bold text-xs text-[#2C1B10]">
                                    {sl.supplierName || t('suppliers.title')}
                                  </span>
                                  <span className="text-[10px] text-[#8C7361] block mt-0.5">
                                    {formatEthDate(sl.createdAt)}
                                  </span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                  {t('reports.purchaseLoanBadge')}
                                </span>
                              </div>
                              <div className="flex justify-between items-center bg-white p-2 rounded-lg border border-amber-100 text-xs">
                                <span className="text-zinc-700">
                                  {sl.stockMovement?.stockItem?.name || t('reports.materialStockItemCol')}
                                </span>
                                <span className="font-mono font-extrabold text-rose-700">
                                  {money(sl.remainingBalance)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </>
                      )}
                    </div>

                    {/* Desktop Table for Payables */}
                    <div className="hidden md:block rounded-2xl border border-rose-200 overflow-hidden">
                      <Table>
                        <TableHeader className="bg-rose-50/60">
                          <TableRow>
                            <TableHead>{t('common.date')}</TableHead>
                            <TableHead>{t('reports.supplierCreditorCol')}</TableHead>
                            <TableHead>{t('reports.productMaterialCol')}</TableHead>
                            <TableHead className="text-right">{t('reports.totalCostCol')}</TableHead>
                            <TableHead className="text-center pr-4">{t('reports.payableStatusCol')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {unpaidDeliveriesList.length === 0 && unpaidStockLoansList.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center py-4 text-xs text-[#8C7361]">
                                {t('reports.noPendingDebtsFound')}
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
                                      {d.supplier?.name || t('suppliers.title')}
                                    </TableCell>
                                    <TableCell className="text-xs text-[#8C7361]">
                                      {d.product?.name || d.stockItem?.name || 'Item'} ({d.quantityReceived} {t('common.pieces')})
                                    </TableCell>
                                    <TableCell className="text-right font-mono text-xs font-bold text-rose-700">
                                      {money(cost)}
                                    </TableCell>
                                    <TableCell className="text-center pr-4">
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
                                        {t('reports.unpaidDeliveryBadge')}
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
                                    {sl.supplierName || t('suppliers.title')}
                                  </TableCell>
                                  <TableCell className="text-xs text-[#8C7361]">
                                    {sl.stockMovement?.stockItem?.name || t('reports.materialStockItemCol')}
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-xs font-bold text-rose-700">
                                    {money(sl.remainingBalance)}
                                  </TableCell>
                                  <TableCell className="text-center pr-4">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                      {t('reports.purchaseLoanBadge')}
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
                        {t('reports.cardStockValuationTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardStockValuationSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.totalStockValuationModal')}</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{money(stockValuation)}</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.trackedIngredientsModal')}</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{t('reports.materialsCount').replace('{count}', String(stockItems.length))}</div>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder={t('reports.searchFilterStockPlaceholder')}
                    value={searchFilter}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-10 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                {/* Mobile Touch Cards for Stock */}
                <div className="block md:hidden space-y-2.5">
                  {stockItems
                    .filter((i) => !searchFilter || i.name.toLowerCase().includes(searchFilter.toLowerCase()))
                    .length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8C7361] bg-[#FAF6F0] rounded-xl border border-[#EDE4D5]">
                      {t('reports.noRawMaterialsFound')}
                    </div>
                  ) : (
                    stockItems
                      .filter((i) => !searchFilter || i.name.toLowerCase().includes(searchFilter.toLowerCase()))
                      .map((item) => {
                        const qty = Number(item.currentQuantity || 0);
                        const price = Number(item.unitPrice || 0);
                        const val = qty * price;
                        const isLow = item.minStockLevel != null && qty <= Number(item.minStockLevel);
                        return (
                          <div
                            key={item.id}
                            className="bg-[#FAF6F0] rounded-xl p-3 border border-[#EDE4D5] space-y-2 shadow-2xs"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-xs text-[#2C1B10]">
                                  {item.name}
                                </span>
                                <span className="text-[10px] text-[#8C7361] block">
                                  {t('reports.unitCol')}: {item.unitType}
                                </span>
                              </div>
                              {isLow && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-rose-100 text-rose-700 border border-rose-200">
                                  {t('reports.lowStockBadge')}
                                </span>
                              )}
                            </div>

                            <div className="grid grid-cols-3 gap-1.5 text-xs bg-white p-2 rounded-lg border border-[#EDE4D5] font-mono">
                              <div>
                                <span className="text-[10px] text-[#8C7361] block font-sans">{t('stock.stockQuantity')}:</span>
                                <span className="font-bold text-[#2C1B10]">{qty.toLocaleString()}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#8C7361] block font-sans">{t('stock.unitPrice')}:</span>
                                <span className="text-zinc-700">{price.toFixed(2)}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.totalValueCol')}:</span>
                                <span className="font-extrabold text-amber-900">{money(val)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Desktop Table for Stock */}
                <div className="hidden md:block rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>{t('reports.materialStockItemCol')}</TableHead>
                        <TableHead>{t('reports.unitCol')}</TableHead>
                        <TableHead className="text-right">{t('reports.inStockQtyCol')}</TableHead>
                        <TableHead className="text-right">{t('reports.unitPriceEtbCol')}</TableHead>
                        <TableHead className="text-right font-extrabold pr-4">{t('reports.totalMonetaryValueCol')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stockItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            {t('reports.noRawMaterialsRegistered')}
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
                                      {t('reports.lowStockBadge')}
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
                        {t('reports.totalProductValuationModal')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.cardProductsValuationSubtitle')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.totalProductValuationModal')}</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{money(productValuation)}</div>
                  </div>
                  <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                    <div className="text-xs text-[#8C7361] font-bold">{t('reports.bakeryProductTypesModal')}</div>
                    <div className="text-2xl font-black text-[#2C1B10] font-mono mt-0.5">{t('reports.productsCount').replace('{count}', String(products.length))}</div>
                  </div>
                </div>

                <div className="mb-4 relative">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder={t('reports.searchFilterProductsPlaceholder')}
                    value={searchFilter}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="pl-9 h-10 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl"
                  />
                </div>

                {/* Mobile Touch Cards for Products */}
                <div className="block md:hidden space-y-2.5">
                  {products
                    .filter((p) => !searchFilter || p.name.toLowerCase().includes(searchFilter.toLowerCase()))
                    .length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#8C7361] bg-[#FAF6F0] rounded-xl border border-[#EDE4D5]">
                      {t('reports.noBakeryProductsFound')}
                    </div>
                  ) : (
                    products
                      .filter((p) => !searchFilter || p.name.toLowerCase().includes(searchFilter.toLowerCase()))
                      .map((p) => {
                        const qty = Number(p.currentHouseStock || 0);
                        const price = Number(p.buyPrice || p.basePrice || 0);
                        const val = qty * price;
                        return (
                          <div
                            key={p.id}
                            className="bg-[#FAF6F0] rounded-xl p-3 border border-[#EDE4D5] space-y-2 shadow-2xs"
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-bold text-xs text-[#2C1B10]">
                                  {p.name}
                                </span>
                                <span className="text-[10px] text-[#8C7361] block">
                                  {p.category?.name || 'General'}
                                </span>
                              </div>
                              <span className="font-mono font-extrabold text-xs text-amber-900 bg-white border border-[#EDE4D5] px-2 py-0.5 rounded-lg">
                                {money(val)}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2 rounded-lg border border-[#EDE4D5] font-mono">
                              <div>
                                <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.houseStockLabel')}</span>
                                <span className="font-bold text-[#2C1B10]">{qty.toLocaleString()} {p.unitType}</span>
                              </div>
                              <div>
                                <span className="text-[10px] text-[#8C7361] block font-sans">{t('reports.unitPriceLabel')}</span>
                                <span className="text-zinc-700">{price.toFixed(2)} ETB</span>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>

                {/* Desktop Table for Products */}
                <div className="hidden md:block rounded-2xl border border-[#EDE4D5] overflow-hidden">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead>{t('reports.productNameCol')}</TableHead>
                        <TableHead>{t('expenses.category')}</TableHead>
                        <TableHead className="text-right">{t('reports.houseStockCol')}</TableHead>
                        <TableHead className="text-right">{t('reports.unitPriceLabel')}</TableHead>
                        <TableHead className="text-right font-extrabold pr-4">{t('reports.totalValueCol')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-xs text-[#8C7361]">
                            {t('reports.noBakeryProductsFound')}
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
                        {t('reports.cleanLiquidCashAuditTitle')}
                      </DialogTitle>
                      <DialogDescription className="text-xs text-[#8C7361]">
                        {t('reports.wealthReconciliationDesc')}
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>

                <div className="bg-[#FAF6F0] p-4 rounded-2xl border border-[#EDE4D5] mb-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs uppercase font-extrabold text-amber-900">{t('reports.grandTotalNetWealthTitle')}</div>
                      <div className="text-3xl font-black text-[#2C1B10] font-mono mt-0.5">{money(totalNetWealth)}</div>
                    </div>
                    <div className="text-xs text-[#8C7361] max-w-sm">
                      {t('reports.fullFinancialPositionDesc')}
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
                        <div className="font-extrabold text-emerald-950 text-sm">{t('reports.wealthItem1Title')}</div>
                        <div className="text-xs text-emerald-800">
                          {t('reports.wealthItem1Desc')
                            .replace('{collected}', money(totalCashCollected))
                            .replace('{expenses}', money(companyExpenseTotal))
                            .replace('{drawings}', money(ownerCashDrawings))}
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
                        <div className="font-extrabold text-sky-950 text-sm">{t('reports.wealthItem2Title')}</div>
                        <div className="text-xs text-sky-800">
                          {t('reports.wealthItem2Desc').replace('{count}', String(customerLoans.length))}
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
                        <div className="font-extrabold text-amber-950 text-sm">{t('reports.wealthItem3Title')}</div>
                        <div className="text-xs text-amber-800">
                          {t('reports.wealthItem3Desc').replace('{count}', String(stockItems.length))}
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
                        <div className="font-extrabold text-amber-950 text-sm">{t('reports.wealthItem4Title')}</div>
                        <div className="text-xs text-amber-800">
                          {t('reports.wealthItem4Desc').replace('{count}', String(products.length))}
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
                        <div className="font-extrabold text-rose-950 text-sm">{t('reports.wealthItem5Title')}</div>
                        <div className="text-xs text-rose-800">
                          {t('reports.wealthItem5Desc')
                            .replace('{deliveries}', money(unpaidSupplierDeliveriesTotal))
                            .replace('{loans}', money(unpaidStockLoansTotal))}
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

            <DialogFooter className="flex flex-col sm:flex-row justify-end w-full pt-4 border-t border-[#EDE4D5]">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full sm:w-auto h-11 sm:h-10 bg-[#4A2E1B] text-white hover:bg-[#3D2314] rounded-xl text-xs font-bold px-6"
              >
                {t('reports.closeBreakdown')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}