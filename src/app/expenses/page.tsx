"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, X, AlertTriangle, CalendarDays, Wallet, Tag, Check, Settings, User as UserIcon, Clock } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { PaginationControls } from "@/components/ui/PaginationControls";

interface Expense {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  branchId: string;
  sessionId?: string | null;
  financialCategory?: { id: string; name: string; type: string } | null;
  user?: { id: string; fullName: string } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: string;
}

interface DailySession {
  id: string;
  status: string;
  openedAt?: string;
  createdAt?: string;
}

function money(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export default function ExpensesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t, language } = useLanguage();
  
  const isManagement = user?.role === "OWNER" || user?.role === "ADMIN";
  const isCashier = user?.role === "CASHIER";
  const canAccess = isManagement || isCashier;
  const queryClient = useQueryClient();

  // Ethiopian local date helper (UTC+3)
  const getEthTodayStr = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const getEthYesterdayStr = () => new Date(Date.now() + 3 * 3600 * 1000 - 24 * 3600 * 1000).toISOString().slice(0, 10);

  // Cashier Date Tab state ("TODAY" | "YESTERDAY")
  const [cashierDateTab, setCashierDateTab] = useState<"TODAY" | "YESTERDAY">("TODAY");

  // Confirmation Modal state for Recording/Updating Expense
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Filter state
  const [filterMode, setFilterMode] = useState<"DAILY" | "RANGE">("DAILY");
  const [dailyDate, setDailyDate] = useState(getEthTodayStr());
  const [filterFrom, setFilterFrom] = useState(getEthTodayStr());
  const [filterTo, setFilterTo] = useState(getEthTodayStr());
  const [typeFilter, setTypeFilter] = useState<"ALL" | "COMPANY" | "OWNER">("ALL");
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  const activeFrom = isCashier
    ? (cashierDateTab === "TODAY" ? getEthTodayStr() : getEthYesterdayStr())
    : filterFrom;

  const activeTo = isCashier
    ? (cashierDateTab === "TODAY" ? getEthTodayStr() : getEthYesterdayStr())
    : filterTo;

  const activeType = isCashier ? "COMPANY" : typeFilter;

  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = tabRefs.current[typeFilter];
      if (btn) {
        btn.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [typeFilter]);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<string>("COMPANY");
  const [formAmount, setFormAmount] = useState("");
  const [selectedCategoryValue, setSelectedCategoryValue] = useState<string>("");
  const [customCategoryName, setCustomCategoryName] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("");
  const [formFinancialCategoryId, setFormFinancialCategoryId] = useState<string>("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(getEthTodayStr());
  const [isSaving, setIsSaving] = useState(false);

  // Auto-focus and scroll ref for Record New Expense
  const formCardRef = useRef<HTMLDivElement | null>(null);
  const amountInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (showForm) {
      const timer = setTimeout(() => {
        formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        amountInputRef.current?.focus();
        amountInputRef.current?.select();
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [showForm, editingId]);

  // Category Management Modal State
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editingCatName, setEditingCatName] = useState("");
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) {
      toast.error(t('expenses.reasonNameRequired'));
      return;
    }
    setIsSavingCategory(true);
    try {
      await api.post("/financial-categories", {
        name: newCatName.trim(),
        type: "EXPENSE",
      });
      toast.success(t('expenses.reasonAdded'));
      setNewCatName("");
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add expense reason");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCatName.trim()) {
      toast.error(t('expenses.reasonNameEmpty'));
      return;
    }
    try {
      await api.patch(`/financial-categories/${id}`, {
        name: editingCatName.trim(),
      });
      toast.success(t('expenses.reasonUpdated'));
      setEditingCatId(null);
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to update expense reason");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm(t('expenses.deleteReasonConfirm'))) return;
    try {
      await api.delete(`/financial-categories/${id}`);
      toast.success(t('expenses.reasonDeleted'));
      queryClient.invalidateQueries({ queryKey: ["financial-categories"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete expense reason");
    }
  };

  const todayStr = getEthTodayStr();
  const isTodayActive = filterMode === "DAILY" && filterFrom === todayStr && filterTo === todayStr;

  const handleSelectDailyMode = () => {
    setFilterMode("DAILY");
    setFilterFrom(dailyDate);
    setFilterTo(dailyDate);
  };

  const handleDailyDateChange = (d: string) => {
    setDailyDate(d);
    setFilterFrom(d);
    setFilterTo(d);
  };

  const handleSetToday = () => {
    setFilterMode("DAILY");
    setDailyDate(todayStr);
    setFilterFrom(todayStr);
    setFilterTo(todayStr);
  };

  const handleSelectRangeMode = () => {
    setFilterMode("RANGE");
    if (filterFrom === filterTo) {
      // expand to last 7 days by default when switching to range mode
      const d = new Date(Date.now() + 3 * 3600 * 1000);
      d.setDate(d.getDate() - 7);
      setFilterFrom(d.toISOString().slice(0, 10));
      setFilterTo(todayStr);
    }
  };

  const handleQuickRange = (days: number) => {
    setFilterMode("RANGE");
    const d = new Date(Date.now() + 3 * 3600 * 1000);
    d.setDate(d.getDate() - days);
    setFilterFrom(d.toISOString().slice(0, 10));
    setFilterTo(todayStr);
  };

  const branchId = selectedBranchId || user?.branchId;

  // React Query: Categories
  const { data: categories = [] } = useQuery<FinancialCategory[]>({
    queryKey: ["financial-categories", "EXPENSE"],
    queryFn: async () => {
      const res = await api.get("/financial-categories", { params: { type: "EXPENSE" } });
      return Array.isArray(res.data) ? res.data : [];
    },
    enabled: !!canAccess,
  });

  // React Query: Active Session
  const { data: activeSession = null, isLoading: isLoadingSession } = useQuery<DailySession | null>({
    queryKey: ["expenses-active-session", branchId],
    queryFn: async () => {
      if (!branchId) return null;
      try {
        const res = await api.get("/daily-sessions/active", { params: { branchId } });
        return res.data || null;
      } catch {
        return null;
      }
    },
    enabled: !!canAccess && !!branchId,
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranchId, activeFrom, activeTo, activeType]);

  // React Query: Expenses
  const { data: expensesResponse, isLoading } = useQuery<{
    data: Expense[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats?: {
      totalAmount: number;
      companyTotal: number;
      ownerTotal: number;
      count: number;
    };
  }>({
    queryKey: ["expenses", selectedBranchId, activeFrom, activeTo, activeType, currentPage, pageSize],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: any = {
        from: activeFrom,
        to: activeTo,
        page: currentPage,
        limit: pageSize,
      };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (activeType !== "ALL") params.type = activeType;
      const res = await api.get("/expenses", { params });
      if (Array.isArray(res.data)) {
        return {
          data: res.data,
          total: res.data.length,
          page: 1,
          limit: pageSize,
          totalPages: 1,
        };
      }
      return res.data;
    },
    enabled: !!canAccess,
  });

  // React Query: Cashier Today & Yesterday Counts
  const { data: cashierTodayCount = 0 } = useQuery<number>({
    queryKey: ["expenses-cashier-count", selectedBranchId, getEthTodayStr()],
    queryFn: async () => {
      const res = await api.get("/expenses", {
        params: {
          from: getEthTodayStr(),
          to: getEthTodayStr(),
          type: "COMPANY",
          limit: 1,
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        },
      });
      return res.data?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
    },
    enabled: isCashier,
  });

  const { data: cashierYesterdayCount = 0 } = useQuery<number>({
    queryKey: ["expenses-cashier-count", selectedBranchId, getEthYesterdayStr()],
    queryFn: async () => {
      const res = await api.get("/expenses", {
        params: {
          from: getEthYesterdayStr(),
          to: getEthYesterdayStr(),
          type: "COMPANY",
          limit: 1,
          ...(selectedBranchId ? { branchId: selectedBranchId } : {}),
        },
      });
      return res.data?.total ?? (Array.isArray(res.data) ? res.data.length : 0);
    },
    enabled: isCashier,
  });

  const expenses: Expense[] = expensesResponse?.data || [];
  const totalExpenses: number = expensesResponse?.total || 0;
  const totalPages: number = expensesResponse?.totalPages || 1;
  const displayExpenses = expenses;

  const resetForm = () => {
    setEditingId(null);
    setFormType("COMPANY");
    setFormAmount("");
    setSelectedCategoryValue("");
    setCustomCategoryName("");
    setFormCategory("");
    setFormFinancialCategoryId("");
    setFormDescription("");
    setFormDate(getEthTodayStr());
    setShowForm(false);
    setIsConfirmModalOpen(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
    setFormType(isCashier ? "COMPANY" : (expense.type || "COMPANY"));
    setFormAmount(String(expense.amount));
    
    // Map category to dropdown selection
    if (expense.financialCategory?.id) {
      setSelectedCategoryValue(expense.financialCategory.id);
      setFormFinancialCategoryId(expense.financialCategory.id);
      setFormCategory(expense.financialCategory.name);
      setCustomCategoryName("");
    } else {
      setSelectedCategoryValue("OTHER");
      setFormFinancialCategoryId("");
      setFormCategory(expense.category || "OTHER");
      setCustomCategoryName(expense.category !== "OTHER" ? expense.category : "");
    }

    setFormDescription(expense.description || "");
    setFormDate(expense.date ? new Date(expense.date).toISOString().slice(0, 10) : getEthTodayStr());
    setShowForm(true);
  };

  const handleCategorySelect = (val: string) => {
    setSelectedCategoryValue(val);
    if (val === "OTHER") {
      setFormFinancialCategoryId("");
      setFormCategory(customCategoryName.trim() || "OTHER");
    } else if (val) {
      const match = categories.find((c) => c.id === val);
      if (match) {
        setFormFinancialCategoryId(match.id);
        setFormCategory(match.name);
      }
    } else {
      setFormFinancialCategoryId("");
      setFormCategory("");
    }
  };

  const handleCustomCategoryChange = (val: string) => {
    setCustomCategoryName(val);
    if (selectedCategoryValue === "OTHER") {
      setFormCategory(val.trim() || "OTHER");
    }
  };

  const handleOpenConfirm = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error(t('expenses.amountRequiredError'));
      return;
    }

    if (!formCategory.trim()) {
      toast.error(t('expenses.categoryRequiredError'));
      return;
    }

    setIsConfirmModalOpen(true);
  };

  const handleConfirmedSubmit = async () => {
    setIsSaving(true);
    try {
      const payload: any = {
        type: isCashier ? "COMPANY" : formType,
        amount: parseFloat(formAmount),
        category: formCategory.trim(),
        description: formDescription.trim() || null,
        date: formDate,
        financialCategoryId: formFinancialCategoryId || null,
      };

      if (!editingId && selectedBranchId) {
        payload.branchId = selectedBranchId;
      }

      if (editingId) {
        await api.patch(`/expenses/${editingId}`, payload);
        toast.success(t('expenses.expenseUpdated'));
      } else {
        await api.post("/expenses", payload);
        toast.success(t('expenses.expenseRecorded'));
      }
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-cashier-count"] });
      queryClient.invalidateQueries({ queryKey: ["expenses-active-session"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sessions"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save expense");
    } finally {
      setIsSaving(false);
    }
  };

  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await api.delete(`/expenses/${expenseToDelete}`);
      toast.success(t('expenses.expenseDeleted'));
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["daily-sessions"] });
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete expense");
    } finally {
      setExpenseToDelete(null);
    }
  };

  // Summaries
  const companyTotal = expensesResponse?.stats?.companyTotal ?? expenses.filter((e) => e.type === "COMPANY").reduce((s, e) => s + Number(e.amount), 0);
  const ownerTotal = expensesResponse?.stats?.ownerTotal ?? expenses.filter((e) => e.type === "OWNER").reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = expensesResponse?.stats?.totalAmount ?? (companyTotal + ownerTotal);

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="bg-white border rounded-xl p-8 text-center text-zinc-600 shadow-sm">
          {t('expenses.accessRestricted')}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
            {t('expenses.title')}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {isManagement && (
            <Button
              onClick={() => setIsManageCategoriesOpen(true)}
              variant="outline"
              size="default"
            >
              <Settings className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
              <span className="hidden xs:inline">{t('expenses.btnManageCategories')}</span>
              <span className="xs:hidden">{t('expenses.category')}</span>
            </Button>
          )}
          <Button
            onClick={openCreateForm}
            size="default"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">{t('expenses.btnNewExpense')}</span>
            <span className="xs:hidden">{t('expenses.btnNewExpense')}</span>
          </Button>
        </div>
      </div>

      {/* Create / Edit Form Modal/Card - Positioned on Top for Immediate Focus */}
      {showForm && (
        <div ref={formCardRef} className="scroll-mt-6">
          <Card className="mb-6 border-2 border-[#4A2E1B]/30 rounded-2xl shadow-md bg-white animate-in fade-in-50 duration-200">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <CardTitle className="text-base font-extrabold text-[#2C1B10]">
                  {editingId ? t('expenses.editExpenseRecord') : t('expenses.recordNewExpense')}
                </CardTitle>
                <CardDescription className="text-xs text-zinc-500 mt-0.5">
                  {t('expenses.modalRecordDesc')}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Expense Type: Locked for Cashier to Company Operating Expense from Daily Cash */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    {t('expenses.expenseType')} <span className="text-rose-500">*</span>
                  </label>
                  {isCashier ? (
                    <div>
                      <div className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl px-3 py-2 flex items-center justify-between">
                        <span className="text-xs font-black text-[#2C1B10] flex items-center gap-1.5">
                          🏢 {t('expenses.typeCompanyOption')}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💵 {language === 'am' ? 'ከዕለቱ ካሽ' : language === 'om' ? 'Kashii Guyyaa' : 'Daily Cash'}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8C7361] mt-1 font-medium">
                        {language === 'am' ? 'ይህ ወጪ ከዕለቱ የካሽ መመዝገቢያ ይቀነሳል' : language === 'om' ? 'Baasiin kun kashii guyyaa irraa hir\'ifama' : 'Deducted directly from daily register cash'}
                      </p>
                    </div>
                  ) : (
                    <select
                      value={formType}
                      onChange={(e) => setFormType(e.target.value)}
                      className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl px-3 py-2 text-xs font-semibold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]"
                    >
                      <option value="COMPANY">🏢 {t('expenses.typeCompanyOption')}</option>
                      <option value="OWNER">👤 {t('expenses.typeOwnerOption')}</option>
                    </select>
                  )}
                </div>

                {/* Amount Input with Auto-Focus and Selection */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    {t('expenses.fieldAmount')} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    ref={amountInputRef}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={formAmount}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10] focus:ring-2 focus:ring-[#4A2E1B]"
                  />
                </div>

                {/* Requirement 2: Category Dropdown & Others Option */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    {t('expenses.category')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={selectedCategoryValue}
                    onChange={(e) => handleCategorySelect(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl px-3 py-2 text-xs font-semibold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]"
                  >
                    <option value="">{t('expenses.selectCategory')}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                    <option value="OTHER">{t('expenses.othersCategory')}</option>
                  </select>

                  {selectedCategoryValue === "OTHER" && (
                    <div className="mt-2">
                      <Input
                        placeholder={t('expenses.customCategoryPlaceholder')}
                        value={customCategoryName}
                        onChange={(e) => handleCustomCategoryChange(e.target.value)}
                        className="bg-white border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                      />
                    </div>
                  )}
                </div>

                {/* Date Input */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">{t('expenses.fieldDate')}</label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                  />
                </div>

                {/* Description Input */}
                <div className="md:col-span-2">
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">{t('expenses.description')}</label>
                  <Input
                    placeholder={t('expenses.fieldDescription')}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                  />
                </div>
              </div>

              <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <Button
                  onClick={handleOpenConfirm}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  {editingId ? t('common.update') : t('expenses.saveExpenseButton')}
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={resetForm}
                  className="w-full sm:w-auto"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Cards (Only for Admin & Owner, hidden for Cashier) */}
      {user?.role !== 'CASHIER' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-xs rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold uppercase text-blue-700 tracking-wider">
                {t('expenses.tabCompany')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32 rounded-lg" />
              ) : (
                <div className="text-2xl font-black text-blue-900">{money(companyTotal)}</div>
              )}
              <p className="text-[11px] text-blue-600 mt-1 font-medium">{t('expenses.companySubtitle')}</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 to-white shadow-xs rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold uppercase text-purple-700 tracking-wider">
                {t('expenses.tabOwner')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32 rounded-lg" />
              ) : (
                <div className="text-2xl font-black text-purple-900">{money(ownerTotal)}</div>
              )}
              <p className="text-[11px] text-purple-600 mt-1 font-medium">{t('expenses.ownerSubtitle')}</p>
            </CardContent>
          </Card>

          <Card className="border-rose-200 bg-gradient-to-br from-rose-50/80 to-white shadow-xs rounded-2xl">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-extrabold uppercase text-rose-700 tracking-wider">
                {t('common.total')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-32 rounded-lg" />
              ) : (
                <div className="text-2xl font-black text-rose-900">{money(grandTotal)}</div>
              )}
              <p className="text-[11px] text-rose-600 mt-1 font-medium">{t('expenses.totalSubtitle')}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Date Filters: Daily vs Range Mode (Only for Admin & Owner, hidden for Cashier) */}
      {!isCashier && (
        <Card className="mb-6 border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
          <div className="bg-[#FAF6F0] px-4 py-3 border-b border-[#EDE4D5] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-extrabold uppercase text-[#8C7361] tracking-wider">{t('expenses.modeLabel')}</span>
              <div className="flex items-center bg-white p-1 rounded-xl border border-[#EDE4D5] shadow-2xs">
                <button
                  type="button"
                  onClick={handleSelectDailyMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    filterMode === "DAILY"
                      ? "bg-[#4A2E1B] text-white shadow-xs"
                      : "text-[#8C7361] hover:text-[#4A2E1B]"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> 📅 {t('expenses.filterDailyMode')}
                </button>
                <button
                  type="button"
                  onClick={handleSelectRangeMode}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1.5 ${
                    filterMode === "RANGE"
                      ? "bg-[#4A2E1B] text-white shadow-xs"
                      : "text-[#8C7361] hover:text-[#4A2E1B]"
                  }`}
                >
                  <Tag className="w-3.5 h-3.5" /> 📆 {t('expenses.filterRangeMode')}
                </button>
              </div>
            </div>

            {filterMode === "DAILY" ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleSetToday}
                  className={`h-8 border-[#EDE4D5] font-bold rounded-xl text-xs flex items-center gap-1 ${
                    isTodayActive
                      ? "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-600"
                      : "bg-white text-[#4A2E1B] hover:bg-[#FAF6F0]"
                  }`}
                >
                  {t('expenses.filterToday')} {isTodayActive && "✓"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickRange(7)}
                  className="h-8 border-[#EDE4D5] bg-white text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs"
                >
                  {t('expenses.last7Days')}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleQuickRange(30)}
                  className="h-8 border-[#EDE4D5] bg-white text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs"
                >
                  {t('expenses.last30Days')}
                </Button>
              </div>
            )}
          </div>

          <CardContent className="flex flex-wrap items-end gap-4 pt-4 pb-4">
            {filterMode === "DAILY" ? (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs font-bold text-[#8C7361] block mb-1">{t('expenses.selectDay')}</label>
                  <Input
                    type="date"
                    value={dailyDate}
                    onChange={(e) => handleDailyDateChange(e.target.value)}
                    className="w-48 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                  />
                </div>
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })}
                  variant="outline"
                  className="border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B] font-bold rounded-xl text-xs h-10"
                >
                  {t('expenses.refreshDayExpenses')}
                </Button>
              </div>
            ) : (
              <div className="flex items-end gap-3 flex-wrap">
                <div>
                  <label className="text-xs font-bold text-[#8C7361] block mb-1">{t('expenses.fromDate')}</label>
                  <Input
                    type="date"
                    value={filterFrom}
                    onChange={(e) => setFilterFrom(e.target.value)}
                    className="w-44 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#8C7361] block mb-1">{t('expenses.toDate')}</label>
                  <Input
                    type="date"
                    value={filterTo}
                    onChange={(e) => setFilterTo(e.target.value)}
                    className="w-44 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                  />
                </div>
                <Button
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["expenses"] })}
                  variant="outline"
                  className="border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B] font-bold rounded-xl text-xs h-10"
                >
                  {t('expenses.filterRange')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* View Tabs: For Cashier (Today vs Yesterday) | For Owner/Admin (All, Company, Owner) */}
      {isCashier ? (
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-none pb-1">
          <div className="inline-flex items-center gap-1.5 p-1 bg-[#F4ECE1] rounded-xl border border-[#EDE4D5]">
            <button
              type="button"
              onClick={() => {
                setCashierDateTab("TODAY");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                cashierDateTab === "TODAY"
                  ? "bg-[#E87A18] text-white shadow-xs"
                  : "text-[#8C7361] hover:text-[#4A2E1B] hover:bg-white/50"
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{language === 'am' ? 'የዛሬ ወጪዎች' : language === 'om' ? 'Baasii Har\'aa' : 'Today'}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                  cashierDateTab === "TODAY" ? "bg-white/20 text-white" : "bg-[#E0D5C3] text-[#4A2E1B]"
                }`}
              >
                {cashierTodayCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCashierDateTab("YESTERDAY");
                setCurrentPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 shrink-0 ${
                cashierDateTab === "YESTERDAY"
                  ? "bg-[#E87A18] text-white shadow-xs"
                  : "text-[#8C7361] hover:text-[#4A2E1B] hover:bg-white/50"
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span>{language === 'am' ? 'የትናንት ወጪዎች' : language === 'om' ? 'Baasii Kaleessaa' : 'Yesterday'}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono font-extrabold ${
                  cashierDateTab === "YESTERDAY" ? "bg-white/20 text-white" : "bg-[#E0D5C3] text-[#4A2E1B]"
                }`}
              >
                {cashierYesterdayCount}
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div className="relative w-full max-w-full overflow-hidden mb-4">
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />

          <div 
            className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] py-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {[
              { id: "ALL", label: t('common.all'), count: expenses.length, color: "bg-[#4A2E1B] text-white" },
              { id: "COMPANY", label: `💵 ${t('expenses.tabCompany')}`, count: expenses.filter((e) => e.type === "COMPANY").length, color: "bg-blue-600 text-white" },
              { id: "OWNER", label: `👤 ${t('expenses.tabOwner')}`, count: expenses.filter((e) => e.type === "OWNER").length, color: "bg-purple-600 text-white" },
            ].map((tab) => {
              const isActive = typeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => { tabRefs.current[tab.id] = el; }}
                  type="button"
                  onClick={() => setTypeFilter(tab.id as "ALL" | "COMPANY" | "OWNER")}
                  className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 outline-none ${
                    isActive
                      ? `${tab.color} shadow-xs ring-2 ring-[#4A2E1B]/20`
                      : "bg-[#FAF6F0] text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#F3ECE1] border border-[#EDE4D5]"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                      isActive ? "bg-white/20 text-white" : "bg-black/5 text-[#8C7361]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Expenses Content Card */}
      <Card className="border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-[#FAF6F0]/60 border-b border-[#EDE4D5] py-4">
          <CardTitle className="text-base font-extrabold text-[#2C1B10]">{t('expenses.title')}</CardTitle>
          <CardDescription className="text-xs text-[#8C7361]">
            {t('expenses.showingRecords').replace('{count}', String(displayExpenses.length))}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4">
              <TableSkeleton rows={5} columns={isManagement ? 8 : 7} />
            </div>
          ) : displayExpenses.length === 0 ? (
            <div className="text-center py-10 text-[#8C7361]">
              <p className="font-bold text-sm text-[#2C1B10]">{t('dashboard.noExpensesToday')}</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('expenses.expenseType')}</TableHead>
                      <TableHead>{t('expenses.category')}</TableHead>
                      <TableHead>{t('expenses.description')}</TableHead>
                      <TableHead>{t('nav.dailySessions')}</TableHead>
                      <TableHead>{t('expenses.loggedBy')}</TableHead>
                      <TableHead className="text-right">{t('expenses.amount')}</TableHead>
                      {isManagement && <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayExpenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="text-xs font-semibold text-[#8C7361]">
                          {expense.date ? new Date(expense.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold border ${
                            expense.type === "OWNER"
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}>
                            {expense.type === "OWNER" ? `👤 ${t('expenses.badgeOwner')}` : `💵 ${t('expenses.badgeDaily')}`}
                          </span>
                        </TableCell>
                        <TableCell className="font-bold text-[#2C1B10]">{expense.financialCategory?.name || expense.category}</TableCell>
                        <TableCell className="text-xs text-[#8C7361] max-w-[220px] truncate">
                          {expense.description || "-"}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-emerald-700 font-semibold">
                          {expense.sessionId ? `#${expense.sessionId.slice(-6)}` : "-"}
                        </TableCell>
                        <TableCell className="text-xs font-medium text-[#2C1B10]">
                          {expense.user?.fullName || "-"}
                        </TableCell>
                        <TableCell className="text-right font-extrabold text-sm text-rose-700 font-mono">
                          {money(expense.amount)}
                        </TableCell>
                        {isManagement && (
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon-sm" onClick={() => openEditForm(expense)}>
                                <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-rose-600 hover:text-rose-700"
                                onClick={() => setExpenseToDelete(expense.id)}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Audit Cards View */}
              <div className="block md:hidden p-3 space-y-3">
                {displayExpenses.map((expense) => {
                  const isOwner = expense.type === "OWNER";
                  const dateFormatted = expense.date
                    ? new Date(expense.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                    : "—";

                  return (
                    <div
                      key={expense.id}
                      className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3"
                    >
                      {/* Top Header: Date, Session, Type badge */}
                      <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                        <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                          <Clock className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span className="font-semibold">{dateFormatted}</span>
                          {expense.sessionId && (
                            <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded-md text-[10px] font-bold">
                              #{expense.sessionId.slice(-6)}
                            </span>
                          )}
                        </div>
                        <span
                          className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold border ${
                            isOwner
                              ? "bg-purple-100 text-purple-800 border-purple-200"
                              : "bg-blue-100 text-blue-800 border-blue-200"
                          }`}
                        >
                          {isOwner ? `👤 ${t('expenses.badgeOwner')}` : `💵 ${t('expenses.badgeDaily')}`}
                        </span>
                      </div>

                      {/* Category and Amount */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                            {t('expenses.category')}
                          </span>
                          <h4 className="font-extrabold text-[#2C1B10] text-base leading-tight mt-0.5 truncate">
                            {expense.financialCategory?.name || expense.category}
                          </h4>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                            {t('expenses.amount')}
                          </span>
                          <span className="text-base font-extrabold text-rose-700 font-mono block mt-0.5">
                            {money(expense.amount)}
                          </span>
                        </div>
                      </div>

                      {/* Description if present */}
                      {expense.description && (
                        <div className="bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-xs text-[#4A2E1B]">
                          <span className="text-[10px] font-bold uppercase text-[#8C7361] block mb-0.5">{t('expenses.description')}:</span>
                          <p className="leading-relaxed">{expense.description}</p>
                        </div>
                      )}

                      {/* Footer: Logged By & Management Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F4ECE1]">
                        <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                          <UserIcon className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span className="font-medium text-[#4A2E1B]">{expense.user?.fullName || t('expenses.staff')}</span>
                        </div>

                        {isManagement && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditForm(expense)}
                              className="h-8 px-2.5 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] hover:bg-[#FAF6F0] flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> {t('common.edit')}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpenseToDelete(expense.id)}
                              className="h-8 w-8 p-0 rounded-xl text-rose-600 hover:bg-rose-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalExpenses}
                pageSize={pageSize}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(s) => { setPageSize(s); setCurrentPage(1); }}
                isLoading={isLoading}
                itemLabel={t('expenses.title') || "expenses"}
                className="bg-white sm:bg-transparent p-3 sm:p-0 rounded-2xl border sm:border-0 border-[#EDE4D5]"
              />
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title={t('expenses.deleteTitle')}
        description={t('expenses.deleteConfirm')}
        confirmText={t('expenses.deleteBtn')}
        variant="danger"
      />

      {/* MANAGE PREDEFINED EXPENSE REASONS MODAL (FOR OWNER / ADMIN) */}
      {isManageCategoriesOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsManageCategoriesOpen(false); }}>
          <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Tag className="w-5 h-5 text-[#E87A18]" />
                {t('expenses.managePredefinedReasons')}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <p className="text-xs text-[#8C7361]">
                {t('expenses.subtitle')}
              </p>

              {/* Add New Expense Reason Form */}
              <div className="bg-[#FAF6F0] p-3.5 rounded-xl border border-[#EDE4D5] space-y-2">
                <label className="text-xs font-bold text-[#4A2E1B] block uppercase">{t('expenses.addNewExpenseReason')}</label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder={t('expenses.placeholderReason')}
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCreateCategory(); } }}
                    className="bg-white rounded-xl border-zinc-200 text-xs"
                  />
                  <Button
                    onClick={handleCreateCategory}
                    disabled={isSavingCategory}
                    className="bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold text-xs h-9 px-3 rounded-xl flex-shrink-0"
                  >
                    <Plus className="w-4 h-4 mr-1" /> {t('expenses.addReasonBtn')}
                  </Button>
                </div>
              </div>

              {/* Pre-defined Expense Reasons List */}
              <div className="space-y-2">
                <span className="text-xs font-extrabold uppercase text-[#2C1B10] block">{t('expenses.existingReasons')} ({categories.length})</span>
                {categories.length === 0 ? (
                  <p className="text-xs text-[#8C7361] italic text-center py-4 bg-zinc-50 rounded-xl border border-zinc-200">
                    {t('expenses.noPredefinedReasons')}
                  </p>
                ) : (
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {categories.map((cat) => (
                      <div key={cat.id} className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-[#EDE4D5] text-xs">
                        {editingCatId === cat.id ? (
                          <div className="flex items-center gap-2 w-full">
                            <Input
                              value={editingCatName}
                              onChange={(e) => setEditingCatName(e.target.value)}
                              className="text-xs h-8 rounded-lg"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleUpdateCategory(cat.id)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-8 px-2.5 rounded-lg"
                            >
                              <Check className="w-3.5 h-3.5" /> {t('common.save')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingCatId(null)}
                              className="h-8 px-2 rounded-lg"
                            >
                              {t('common.cancel')}
                            </Button>
                          </div>
                        ) : (
                          <>
                            <span className="font-bold text-[#2C1B10]">{cat.name}</span>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => { setEditingCatId(cat.id); setEditingCatName(cat.name); }}
                                className="h-7 w-7 p-0 text-zinc-600 hover:bg-zinc-100 rounded-lg"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="h-7 w-7 p-0 text-rose-600 hover:bg-rose-50 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button onClick={() => setIsManageCategoriesOpen(false)} variant="outline">
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Confirmation Modal for Record / Update Expense */}
      <Dialog open={isConfirmModalOpen} onOpenChange={setIsConfirmModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <Wallet className="w-5 h-5 text-[#E87A18]" />
              <span>
                {editingId
                  ? (language === 'am' ? 'የወጪ ማሻሻያ ማረጋገጫ' : language === 'om' ? 'Mirkaneessa Fooyya\'iinsa Baasii' : 'Confirm Expense Update')
                  : (language === 'am' ? 'የወጪ መዝገብ ማረጋገጫ' : language === 'om' ? 'Mirkaneessa Galmee Baasii' : 'Confirm Expense Record')}
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Amount Box */}
            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5] text-center">
              <span className="text-xs uppercase font-extrabold text-[#8C7361] tracking-wider block">
                {t('expenses.fieldAmount')}
              </span>
              <p className="text-3xl font-black text-rose-700 mt-1 font-mono">
                {parseFloat(formAmount || "0").toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                <span className="text-sm font-bold text-[#8C7361]">ETB</span>
              </p>
            </div>

            {/* Summary Details */}
            <div className="bg-white rounded-xl border border-[#EDE4D5] p-3.5 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                <span className="font-bold text-[#8C7361]">{t('expenses.category')}</span>
                <span className="font-extrabold text-[#2C1B10]">{formCategory}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                <span className="font-bold text-[#8C7361]">{t('expenses.expenseType')}</span>
                <span className="font-bold text-[#2C1B10]">
                  {formType === 'COMPANY'
                    ? `🏢 ${t('expenses.typeCompanyOption')}`
                    : `👤 ${t('expenses.typeOwnerOption')}`}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                <span className="font-bold text-[#8C7361]">
                  {language === 'am' ? 'የክፍያ ምንጭ' : language === 'om' ? 'Maddi Kaffaltii' : 'Payment Source'}
                </span>
                <span className="font-extrabold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                  💵 {language === 'am' ? 'ከዕለቱ ካሽ መመዝገቢያ' : language === 'om' ? 'Kashii Guyyaa Irraa' : 'Daily Cash Register'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                <span className="font-bold text-[#8C7361]">{t('expenses.fieldDate')}</span>
                <span className="font-mono font-semibold text-[#2C1B10]">{formDate}</span>
              </div>

              {formDescription && (
                <div className="pt-1">
                  <span className="font-bold text-[#8C7361] block mb-0.5">{t('expenses.description')}</span>
                  <p className="text-[#2C1B10] bg-[#FAF6F0] p-2 rounded-lg italic">{formDescription}</p>
                </div>
              )}
            </div>

            {/* Warning / Deduct Notice */}
            <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                {language === 'am'
                  ? 'ይህ ወጪ ሲመዘገብ በቀጥታ ከዕለቱ የሽያጭ ካሽ ሂሳብ ይቀነሳል። እባክዎ መጠኑና ምክንያቱ ትክክል መሆኑን ያረጋግጡ።'
                  : language === 'om'
                  ? 'Baasiin kun yeroo galmaa\'u kaffaltii kashii guyyaa irraa hir\'ifama. Maaloo lakkoofsa fi sababa isaa mirkaneeffadhaa.'
                  : 'This expense will be deducted from the active daily register cash reconciliation. Please confirm the amount and details are correct.'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isSaving}
              className="rounded-xl w-full sm:w-auto font-bold"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="button"
              variant="brand"
              onClick={handleConfirmedSubmit}
              loading={isSaving}
              className="rounded-xl w-full sm:w-auto font-bold"
            >
              <Check className="w-4 h-4 mr-1.5" />
              {language === 'am' ? 'አረጋግጥና መዝግብ' : language === 'om' ? 'Mirkaneessi & Galmeessi' : 'Confirm & Save Expense'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
