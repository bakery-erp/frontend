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
  const { t } = useLanguage();
  
  const isManagement = user?.role === "OWNER" || user?.role === "ADMIN";
  const canAccess = isManagement || user?.role === "CASHIER";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [activeSession, setActiveSession] = useState<DailySession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Ethiopian local date helper (UTC+3)
  const getEthTodayStr = () => new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

  // Filter state
  const [filterMode, setFilterMode] = useState<"DAILY" | "RANGE">("DAILY");
  const [dailyDate, setDailyDate] = useState(getEthTodayStr());
  const [filterFrom, setFilterFrom] = useState(getEthTodayStr());
  const [filterTo, setFilterTo] = useState(getEthTodayStr());
  const [typeFilter, setTypeFilter] = useState<"ALL" | "COMPANY" | "OWNER">("ALL");
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

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
      toast.error("Expense reason name is required");
      return;
    }
    setIsSavingCategory(true);
    try {
      await api.post("/financial-categories", {
        name: newCatName.trim(),
        type: "EXPENSE",
      });
      toast.success("Expense reason added successfully");
      setNewCatName("");
      loadCategories();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to add expense reason");
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleUpdateCategory = async (id: string) => {
    if (!editingCatName.trim()) {
      toast.error("Expense reason name cannot be empty");
      return;
    }
    try {
      await api.patch(`/financial-categories/${id}`, {
        name: editingCatName.trim(),
      });
      toast.success("Expense reason updated");
      setEditingCatId(null);
      loadCategories();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to update expense reason");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense reason?")) return;
    try {
      await api.delete(`/financial-categories/${id}`);
      toast.success("Expense reason deleted");
      loadCategories();
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

  useEffect(() => {
    if (canAccess) {
      loadExpenses();
    }
  }, [selectedBranchId, filterFrom, filterTo, typeFilter]);

  useEffect(() => {
    if (canAccess) {
      loadCategories();
      loadActiveSession();
    }
  }, [selectedBranchId, user?.role, user?.branchId]);

  const loadCategories = async () => {
    try {
      const res = await api.get("/financial-categories", { params: { type: "EXPENSE" } });
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Non-critical
    }
  };

  const loadActiveSession = async () => {
    setIsLoadingSession(true);
    try {
      const branchId = selectedBranchId || user?.branchId;
      if (!branchId) {
        setActiveSession(null);
        return;
      }
      const res = await api.get("/daily-sessions", { params: { branchId } });
      const list = Array.isArray(res.data) ? res.data : (res.data?.sessions || []);
      const openSess = list.find((s: any) => s.status === "OPEN");
      setActiveSession(openSess || null);
    } catch {
      setActiveSession(null);
    } finally {
      setIsLoadingSession(false);
    }
  };

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const params: any = { from: filterFrom, to: filterTo };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (typeFilter !== "ALL") params.type = typeFilter;
      const res = await api.get("/expenses", { params });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load expenses");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormType("COMPANY");
    setFormAmount("");
    setSelectedCategoryValue("");
    setCustomCategoryName("");
    setFormCategory("");
    setFormFinancialCategoryId("");
    setFormDescription("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setShowForm(false);
  };

  const openCreateForm = () => {
    if (!activeSession) {
      toast.error("No active open session found for this branch. Please open a daily session before recording expenses.");
      return;
    }
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
    setFormType(expense.type || "COMPANY");
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
    setFormDate(expense.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
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

  const handleSubmit = async () => {
    if (!editingId && !activeSession) {
      toast.error("No active open daily session found for this branch. Expenses can only be recorded during an active open session.");
      return;
    }

    if (!formAmount || parseFloat(formAmount) <= 0) {
      toast.error("Valid expense amount is required");
      return;
    }

    if (!formCategory.trim()) {
      toast.error("Please select or specify an expense category");
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        type: formType,
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
        toast.success("Expense updated successfully");
      } else {
        await api.post("/expenses", payload);
        toast.success("Expense recorded against current daily session");
      }
      resetForm();
      loadExpenses();
      loadActiveSession();
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
      toast.success("Expense deleted");
      loadExpenses();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete expense");
    } finally {
      setExpenseToDelete(null);
    }
  };

  // Summaries
  const companyTotal = expenses.filter((e) => e.type === "COMPANY").reduce((s, e) => s + Number(e.amount), 0);
  const ownerTotal = expenses.filter((e) => e.type === "OWNER").reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = companyTotal + ownerTotal;

  const displayExpenses = expenses.filter((e) => typeFilter === "ALL" || e.type === typeFilter);

  if (!canAccess) {
    return (
      <DashboardLayout>
        <div className="bg-white border rounded-xl p-8 text-center text-zinc-600 shadow-sm">
          Expenses management is available for Owner, Admin, and Cashier users.
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
          <p className="text-sm text-[#8C7361] mt-1">
            {t('expenses.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {isManagement && (
            <Button
              onClick={() => setIsManageCategoriesOpen(true)}
              variant="outline"
              className="flex items-center gap-1.5 border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-full h-9 sm:h-10 px-3.5 sm:px-4 text-xs shadow-2xs"
            >
              <Settings className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
              <span className="hidden xs:inline">{t('expenses.btnManageCategories')}</span>
              <span className="xs:hidden">Categories</span>
            </Button>
          )}
          <Button
            onClick={openCreateForm}
            disabled={!activeSession}
            className="flex items-center gap-1.5 bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-full h-9 sm:h-10 px-3.5 sm:px-4 shadow-sm disabled:opacity-50 text-xs"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="hidden xs:inline">{t('expenses.btnNewExpense')}</span>
            <span className="xs:hidden">New Expense</span>
          </Button>
        </div>
      </div>

      {/* Mandatory Active Daily Session Status Banner */}
      {!isLoadingSession && (
        activeSession ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-100 rounded-xl text-emerald-700">
                <Wallet className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-emerald-950">{t('sessions.statusOpen')}</span>
                  <span className="bg-emerald-200 text-emerald-800 text-[10px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full">
                    {t('dashboard.liveSessionActive')}
                  </span>
                </div>
                <p className="text-xs text-emerald-700 mt-0.5">
                  All recorded expenses will be attached to session <span className="font-mono font-bold">#{activeSession.id.slice(-6)}</span>
                </p>
              </div>
            </div>
            <div className="text-xs font-semibold text-emerald-800 bg-emerald-100/60 px-3 py-1.5 rounded-xl border border-emerald-200/60">
              Opened: {new Date(activeSession.createdAt || (activeSession as any).openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-4 mb-6 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-xl text-amber-700">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-bold text-sm text-amber-950">No Active Daily Session Open</h4>
                <p className="text-xs text-amber-800 mt-0.5">
                  Expenses cannot be recorded without an active open session. Please open a session first.
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => router.push("/daily-sessions")}
              className="bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-xl text-xs px-4"
            >
              <CalendarDays className="w-3.5 h-3.5 mr-1.5" /> {t('nav.dailySessions')}
            </Button>
          </div>
        )
      )}

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
                  {t('expenses.modalRecordDesc')} <span className="font-mono font-bold text-emerald-700">#{activeSession?.id.slice(-6)}</span>
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm} className="rounded-xl">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            <CardContent className="pt-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Requirement 1: Expense Type Choice (Company vs Owner) */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    {t('expenses.expenseType')} <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl px-3 py-2 text-xs font-semibold text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#4A2E1B]"
                  >
                    <option value="COMPANY">🏢 {t('expenses.typeCompanyOption')}</option>
                    <option value="OWNER">👤 {t('expenses.typeOwnerOption')}</option>
                  </select>
                </div>

                {/* Amount Input with Auto-Focus and Selection */}
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    {t('expenses.fieldAmount')} <span className="text-rose-500">*</span>
                  </label>
                  <Input
                    ref={amountInputRef}
                    autoFocus
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
                  onClick={handleSubmit}
                  disabled={isSaving}
                  className="w-full sm:w-auto h-11 bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-xs sm:text-sm px-6 shadow-sm"
                >
                  {isSaving ? t('common.loading') : editingId ? t('common.update') : t('expenses.saveExpenseButton')}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="w-full sm:w-auto h-10 border-[#EDE4D5] rounded-xl text-xs sm:text-sm font-semibold text-[#8C7361] hover:text-[#4A2E1B]"
                >
                  {t('common.cancel')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50/80 to-white shadow-xs rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-extrabold uppercase text-blue-700 tracking-wider">
              {t('expenses.tabCompany')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-blue-900">{money(companyTotal)}</div>
            <p className="text-[11px] text-blue-600 mt-1 font-medium">Daily operational costs from session cash</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-gradient-to-br from-purple-50/80 to-white shadow-xs rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-extrabold uppercase text-purple-700 tracking-wider">
              {t('expenses.tabOwner')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-purple-900">{money(ownerTotal)}</div>
            <p className="text-[11px] text-purple-600 mt-1 font-medium">Owner withdrawals & non-operating draws</p>
          </CardContent>
        </Card>

        <Card className="border-rose-200 bg-gradient-to-br from-rose-50/80 to-white shadow-xs rounded-2xl">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-extrabold uppercase text-rose-700 tracking-wider">
              {t('common.total')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-rose-900">{money(grandTotal)}</div>
            <p className="text-[11px] text-rose-600 mt-1 font-medium">Total recorded expenses for date range</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters: Daily vs Range Mode */}
      <Card className="mb-6 border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
        <div className="bg-[#FAF6F0] px-4 py-3 border-b border-[#EDE4D5] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-extrabold uppercase text-[#8C7361] tracking-wider">Mode:</span>
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
                <CalendarDays className="w-3.5 h-3.5" /> 📅 Daily Expenses
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
                <Tag className="w-3.5 h-3.5" /> 📆 Date Range
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
                Today {isTodayActive && "✓"}
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
                Last 7 Days
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleQuickRange(30)}
                className="h-8 border-[#EDE4D5] bg-white text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs"
              >
                Last 30 Days
              </Button>
            </div>
          )}
        </div>

        <CardContent className="flex flex-wrap items-end gap-4 pt-4 pb-4">
          {filterMode === "DAILY" ? (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs font-bold text-[#8C7361] block mb-1">Select Day</label>
                <Input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => handleDailyDateChange(e.target.value)}
                  className="w-48 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                />
              </div>
              <Button
                onClick={loadExpenses}
                variant="outline"
                className="border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B] font-bold rounded-xl text-xs h-10"
              >
                Refresh Day Expenses
              </Button>
            </div>
          ) : (
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="text-xs font-bold text-[#8C7361] block mb-1">From Date</label>
                <Input
                  type="date"
                  value={filterFrom}
                  onChange={(e) => setFilterFrom(e.target.value)}
                  className="w-44 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#8C7361] block mb-1">To Date</label>
                <Input
                  type="date"
                  value={filterTo}
                  onChange={(e) => setFilterTo(e.target.value)}
                  className="w-44 bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-semibold text-[#2C1B10]"
                />
              </div>
              <Button
                onClick={loadExpenses}
                variant="outline"
                className="border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B] font-bold rounded-xl text-xs h-10"
              >
                Filter Range
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expense View Mode Filter Tabs with Auto-Centering & Edge Fade Hints */}
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

      {/* Expenses Content Card */}
      <Card className="border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
        <CardHeader className="bg-[#FAF6F0]/60 border-b border-[#EDE4D5] py-4">
          <CardTitle className="text-base font-extrabold text-[#2C1B10]">{t('expenses.title')}</CardTitle>
          <CardDescription className="text-xs text-[#8C7361]">
            Showing {displayExpenses.length} record(s)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-center text-[#8C7361] py-8 font-medium">{t('common.loading')}</p>
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
                            {expense.type === "OWNER" ? "👤 OWNER" : "💵 DAILY"}
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
                              <Button variant="ghost" size="sm" onClick={() => openEditForm(expense)} className="rounded-xl h-8 w-8 p-0">
                                <Pencil className="w-3.5 h-3.5 text-zinc-600" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="rounded-xl h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
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
                          {isOwner ? "👤 OWNER" : "💵 DAILY"}
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
                          <span className="text-[10px] font-bold uppercase text-[#8C7361] block mb-0.5">Note:</span>
                          <p className="leading-relaxed">{expense.description}</p>
                        </div>
                      )}

                      {/* Footer: Logged By & Management Actions */}
                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-[#F4ECE1]">
                        <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                          <UserIcon className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span className="font-medium text-[#4A2E1B]">{expense.user?.fullName || "Staff"}</span>
                        </div>

                        {isManagement && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditForm(expense)}
                              className="h-8 px-2.5 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] hover:bg-[#FAF6F0] flex items-center gap-1"
                            >
                              <Pencil className="w-3.5 h-3.5" /> Edit
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
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense Record"
        description="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmText="Delete Expense"
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
                    placeholder="e.g. Electricity / Utilities"
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
              <Button onClick={() => setIsManageCategoriesOpen(false)} className="bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-xs">
                {t('common.close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
