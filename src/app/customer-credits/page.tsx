"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/skeletons";
import { PaginationControls } from "@/components/ui/PaginationControls";
import {
  Plus,
  CreditCard,
  DollarSign,
  Trash2,
  ShoppingBag,
  Eye,
  AlertTriangle,
  Phone,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Users,
  MapPin,
  Search,
  FileText,
  UserPlus,
  MoreVertical,
  ChevronRight,
  Calendar,
  Loader2,
  X,
  Pencil,
} from "lucide-react";

interface CreditPayment {
  id: string;
  amount: number | string;
  amountPaid?: number | string;
  date: string;
  createdAt: string;
}

interface CustomerInfo {
  id: string;
  fullName: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
}

interface CustomerCredit {
  id: string;
  branchId?: string;
  amount?: number | string;
  totalAmount?: number | string;
  paidAmount?: number | string;
  remainingBalance: number | string;
  status: "OPEN" | "PAID";
  date: string;
  createdAt: string;
  description?: string | null;
  entityId?: string | null;
  customer?: CustomerInfo | null;
  payments: CreditPayment[];
}

interface CustomerSummary {
  id: string;
  fullName: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  totalCredits: number;
  totalBorrowed: number;
  totalPaid: number;
  totalRemaining: number;
  lastCreditDate?: string | null;
}

function parseCustomerCreditDescription(rawDesc?: string | null, rawEntity?: string | null, customerObj?: CustomerInfo | null) {
  const customerName = customerObj?.fullName || "";
  const customerPhone = customerObj?.phone || "";

  const textToParse = rawDesc || rawEntity || "";
  if (!textToParse) {
    return {
      name: customerName || "Customer / Cafe",
      phone: customerPhone,
      items: [],
      notes: "",
    };
  }

  let remaining = textToParse;
  let itemsList: string[] = [];

  // 1. Try structured JSON: [CreditItems:[...]]
  const creditItemsMatch = remaining.match(/\[CreditItems:\s*(\[.*?\])\s*\]/);
  if (creditItemsMatch) {
    try {
      const parsedList = JSON.parse(creditItemsMatch[1]);
      if (Array.isArray(parsedList)) {
        itemsList = parsedList.map((it: any) => {
          const qty = it.quantity != null ? String(it.quantity) : "1";
          const pName = it.productName || "Product";
          return `${qty}x ${pName}`;
        });
      }
    } catch {}
    remaining = remaining.replace(/\[CreditItems:\s*\[.*?\]\s*\]/g, "").trim();
  }

  // 2. Try [Products: ...]
  const prodMatch = remaining.match(/\[Products:\s*(.*?)\s*\]/);
  if (prodMatch) {
    if (itemsList.length === 0) {
      itemsList = prodMatch[1].split(/,\s*/).map((s) => s.trim()).filter(Boolean);
    }
    remaining = remaining.replace(/\[Products:.*?\]/g, "").trim();
  }

  // 3. Fallback name and notes
  let notesPart = "";
  const parts = remaining.split(/\s+-\s+/);
  let namePart = customerName || parts[0] || "";
  if (parts.length > 1) {
    notesPart = parts.slice(1).join(" - ").trim();
  }

  let phone = customerPhone;
  const phoneMatch = namePart.match(/\((.*?)\)/);
  if (phoneMatch && !phone) {
    phone = phoneMatch[1];
    namePart = namePart.replace(/\(.*?\)/, "").trim();
  }

  return {
    name: customerName || namePart || "Customer / Cafe",
    phone,
    items: itemsList,
    notes: notesPart.replace(/^-\s*|\s*-$/g, "").trim(),
  };
}

function extractCleanNotes(rawDesc?: string | null): string {
  if (!rawDesc) return "";
  let cleaned = rawDesc;
  cleaned = cleaned.replace(/\[CreditItems:\s*\[.*?\]\s*\]/gi, "");
  cleaned = cleaned.replace(/\[Products:\s*.*?\]/gi, "");
  cleaned = cleaned.replace(/^[^|]+(?:\s*\|\s*[^|]+)?\s*\|\s*/, "");
  cleaned = cleaned.replace(/^[\s\-\–\|\:]+/, "").replace(/[\s\-\–\|\:]+$/, "").trim();
  return cleaned;
}

export default function CustomerCreditsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";
  const isAdminOrOwner = user?.role === "OWNER" || user?.role === "ADMIN";

  // Active Main Tab: "CREDITS" vs "CUSTOMERS"
  const [activeMainTab, setActiveMainTab] = useState<"CREDITS" | "CUSTOMERS">("CREDITS");

  // Credit Filter Pills & Date Filter
  type CreditFilterTab = "ALL" | "OPEN" | "PAID";
  const [filterTab, setFilterTab] = useState<CreditFilterTab>("ALL");
  const [dateFilter, setDateFilter] = useState<string>("");
  const activeFilterRef = useRef<HTMLButtonElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [creditPage, setCreditPage] = useState(1);
  const [expandedCreditCards, setExpandedCreditCards] = useState<Record<string, boolean>>({});

  // Action dropdown state
  const [openActionDropdownId, setOpenActionDropdownId] = useState<string | null>(null);

  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-actions-menu]')) {
        setOpenActionDropdownId(null);
      }
    };
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, []);

  // Customer Filter State
  type CustomerFilterType = "ALL" | "DEBT" | "SETTLED";
  const [customerFilter, setCustomerFilter] = useState<CustomerFilterType>("ALL");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerPage, setCustomerPage] = useState(1);

  // Modals
  const [payingCredit, setPayingCredit] = useState<CustomerCredit | null>(null);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Add Customer Modal
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [newCustName, setNewCustName] = useState("");
  const [newCustPhone, setNewCustPhone] = useState("");
  const [newCustAddress, setNewCustAddress] = useState("");
  const [newCustNotes, setNewCustNotes] = useState("");
  const [isSubmittingCust, setIsSubmittingCust] = useState(false);

  // Edit Customer Modal
  const [editingCustomer, setEditingCustomer] = useState<CustomerSummary | null>(null);
  const [editCustName, setEditCustName] = useState("");
  const [editCustPhone, setEditCustPhone] = useState("");
  const [editCustAddress, setEditCustAddress] = useState("");
  const [editCustNotes, setEditCustNotes] = useState("");
  const [isSubmittingEditCust, setIsSubmittingEditCust] = useState(false);

  const openEditCustomer = (c: CustomerSummary) => {
    setEditingCustomer(c);
    setEditCustName(c.fullName || "");
    setEditCustPhone(c.phone || "");
    setEditCustAddress(c.address || "");
    setEditCustNotes(c.notes || "");
  };

  // Edit Customer Credit Modal
  const [editingCredit, setEditingCredit] = useState<CustomerCredit | null>(null);
  const [editCreditCustomerId, setEditCreditCustomerId] = useState("");
  const [editCreditAmount, setEditCreditAmount] = useState("");
  const [editCreditDate, setEditCreditDate] = useState("");
  const [editCreditDueDate, setEditCreditDueDate] = useState("");
  const [editCreditDescription, setEditCreditDescription] = useState("");
  const [isSubmittingEditCredit, setIsSubmittingEditCredit] = useState(false);

  const openEditCredit = (c: CustomerCredit) => {
    setEditingCredit(c);
    setEditCreditCustomerId(c.customer?.id || (c as any).customerId || "");
    setEditCreditAmount(String(c.amount ?? c.totalAmount ?? ""));
    setEditCreditDate((c.date || c.createdAt || "").slice(0, 10));
    setEditCreditDueDate((c as any).dueDate ? String((c as any).dueDate).slice(0, 10) : "");
    setEditCreditDescription(extractCleanNotes(c.description));
  };

  const toggleCreditExpand = (id: string) => {
    setExpandedCreditCards((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  useEffect(() => {
    if (activeFilterRef.current) {
      activeFilterRef.current.scrollIntoView({ inline: "center", behavior: "smooth", block: "nearest" });
    }
  }, [filterTab]);

  const { data: creditsResponse, isLoading: isLoadingCredits, isFetching: isFetchingCredits } = useQuery({
    queryKey: ['customer-credits-page-credits', selectedBranchId, filterTab, dateFilter, searchQuery, creditPage],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: any = {
        page: creditPage,
        limit: 15,
      };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (filterTab === 'OPEN') params.status = 'OPEN';
      if (filterTab === 'PAID') params.status = 'PAID';
      if (dateFilter) {
        params.date = dateFilter;
      }
      if (searchQuery.trim()) params.search = searchQuery.trim();

      const res = await api.get('/customers/credits', { params }).catch(() =>
        api.get(`/loans?type=CUSTOMER${selectedBranchId ? `&branchId=${selectedBranchId}` : ''}`)
      );
      return res.data;
    },
  });

  const { data: customersResponse, isLoading: isLoadingCustomers } = useQuery({
    queryKey: ['customer-credits-page-customers', selectedBranchId, customerSearch, customerPage],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: any = {
        page: customerPage,
        limit: 15,
      };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (customerSearch.trim()) params.search = customerSearch.trim();

      const res = await api.get('/customers', { params });
      return res.data;
    },
  });

  const rawCredits = Array.isArray(creditsResponse) ? creditsResponse : (creditsResponse?.data || []);
  const credits = rawCredits as CustomerCredit[];
  const creditTotal = creditsResponse?.total ?? credits.length;
  const creditTotalPages = creditsResponse?.totalPages ?? 1;
  const stats = creditsResponse?.stats;

  const rawCustomers = Array.isArray(customersResponse) ? customersResponse : (customersResponse?.data || []);
  const customers = rawCustomers as CustomerSummary[];
  const customerTotal = customersResponse?.total ?? customers.length;
  const customerTotalPages = customersResponse?.totalPages ?? 1;
  const isLoading = isLoadingCredits || isLoadingCustomers;

  // Payment Handler
  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCredit || !amountPaid) return;

    const payNum = Number(amountPaid);
    if (payNum <= 0) {
      toast.error(t("credits.toastEnterValidPayment"));
      return;
    }

    setIsSubmittingPay(true);
    try {
      try {
        await api.post(`/customers/credits/${payingCredit.id}/pay`, {
          amount: payNum,
          date: paymentDate,
        });
      } catch {
        // Fallback for legacy loan record if needed
        await api.post(`/loans/${payingCredit.id}/pay`, {
          amountPaid: payNum,
          date: paymentDate,
        });
      }

      toast.success(t("credits.toastPaymentSuccess"));
      setPayingCredit(null);
      setAmountPaid("");
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-credits'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to record payment");
      console.error(e);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Delete Credit
  const handleDeleteCredit = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer credit record?")) return;
    try {
      try {
        await api.delete(`/customers/credits/${id}`);
      } catch {
        await api.delete(`/loans/${id}`);
      }
      toast.success("Customer credit record deleted");
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-credits'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to delete credit record");
    }
  };

  // Create Customer Quick Modal
  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustName.trim() || !newCustPhone.trim()) {
      toast.error("Customer name and phone number are required.");
      return;
    }

    setIsSubmittingCust(true);
    try {
      await api.post("/customers", {
        fullName: newCustName.trim(),
        phone: newCustPhone.trim(),
        address: newCustAddress.trim() || undefined,
        notes: newCustNotes.trim() || undefined,
        branchId: selectedBranchId || undefined,
      });

      toast.success(t("credits.toastCustomerCreated"));
      setIsAddCustomerOpen(false);
      setNewCustName("");
      setNewCustPhone("");
      setNewCustAddress("");
      setNewCustNotes("");
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-credits'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to create customer");
    } finally {
      setIsSubmittingCust(false);
    }
  };

  // Update Customer Handler
  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    if (!editCustName.trim() || !editCustPhone.trim()) {
      toast.error("Customer full name and phone number are required.");
      return;
    }

    setIsSubmittingEditCust(true);
    try {
      await api.patch(`/customers/${editingCustomer.id}`, {
        fullName: editCustName.trim(),
        phone: editCustPhone.trim(),
        address: editCustAddress.trim() || null,
        notes: editCustNotes.trim() || null,
      });

      toast.success(t("credits.toastCustomerUpdated") || "Customer updated successfully!");
      setEditingCustomer(null);
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-credits'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to update customer");
    } finally {
      setIsSubmittingEditCust(false);
    }
  };

  // Update Customer Credit Handler
  const handleUpdateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredit) return;
    const amtNum = Number(editCreditAmount);
    if (isNaN(amtNum) || amtNum <= 0) {
      toast.error("Please enter a valid total credit amount greater than 0.");
      return;
    }

    const totalPaid = (editingCredit.payments || []).reduce(
      (sum, p) => sum + Number(p.amount ?? p.amountPaid ?? 0),
      0
    );
    if (amtNum < totalPaid) {
      toast.error(
        `Credit amount (${amtNum.toFixed(2)} ETB) cannot be less than already recorded repayments (${totalPaid.toFixed(2)} ETB).`
      );
      return;
    }

    setIsSubmittingEditCredit(true);
    try {
      let finalDescription = editCreditDescription.trim();
      const prodMatch = (editingCredit.description || "").match(/\[Products:\s*.*?\]/);
      const itemsMatch = (editingCredit.description || "").match(/\[CreditItems:\s*\[.*?\]\s*\]/);
      const tags = [prodMatch?.[0], itemsMatch?.[0]].filter(Boolean).join(" ");
      if (tags) {
        finalDescription = finalDescription ? `${tags} - ${finalDescription}` : tags;
      }

      await api.patch(`/customers/credits/${editingCredit.id}`, {
        customerId: editCreditCustomerId || undefined,
        amount: amtNum,
        date: editCreditDate || undefined,
        dueDate: editCreditDueDate || null,
        description: finalDescription || null,
      });

      toast.success(t("credits.toastCreditUpdated") || "Customer credit updated successfully!");
      setEditingCredit(null);
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-credits'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits-page-customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer-credits'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to update credit record");
    } finally {
      setIsSubmittingEditCredit(false);
    }
  };

  // Metrics
  const totalCreditGiven = stats?.totalCreditGiven ?? credits.reduce(
    (acc, c) => acc + Number(c.amount ?? c.totalAmount ?? 0),
    0
  );
  const totalOutstanding = stats?.totalOutstanding ?? credits.reduce(
    (acc, c) => acc + Number(c.remainingBalance || 0),
    0
  );
  const totalRepaid = stats?.totalRepaid ?? Math.max(0, totalCreditGiven - totalOutstanding);

  return (
    <DashboardLayout>
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#E87A18]" />
            {t("credits.title")}
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {canManage && (
            <>
              <Button
                onClick={() => setIsAddCustomerOpen(true)}
                variant="outline"
                size="sm"
                className="border-[#E87A18]/40 text-[#E87A18] hover:bg-amber-50"
              >
                <UserPlus className="w-4 h-4" /> {t("credits.addNewCustomerBtn")}
              </Button>
              <Button
                onClick={() => router.push("/customer-credits/new")}
                size="sm"
              >
                <Plus className="w-4 h-4" /> {t("credits.newCredit")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards (Visible only to Admin and Owner, hidden from Cashiers) */}
      {isAdminOrOwner && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 mb-6">
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm min-w-0">
            <span className="text-xs font-bold uppercase text-[#8C7361] block truncate">{t("credits.colTotalAmount")}</span>
            <span className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] mt-1 block font-mono truncate">
              {totalCreditGiven.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
          </div>
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm bg-emerald-50/30 min-w-0">
            <span className="text-xs font-bold uppercase text-emerald-800 block truncate">{t("dashboard.creditReceivedLoans")}</span>
            <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1 block font-mono truncate">
              {totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
          </div>
          <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm bg-rose-50/30 min-w-0 sm:col-span-2 md:col-span-1">
            <span className="text-xs font-bold uppercase text-rose-800 block truncate">{t("credits.colRemaining")}</span>
            <span className="text-xl sm:text-2xl font-extrabold text-rose-700 mt-1 block font-mono truncate">
              {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
          </div>
        </div>
      )}

      {/* Main Feature Tabs: Credit Sales vs Customer Directory */}
      <div className="flex items-center gap-2 p-1.5 bg-[#F4ECE1] rounded-2xl border border-[#EDE4D5] mb-6 w-fit">
        <button
          type="button"
          onClick={() => setActiveMainTab("CREDITS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeMainTab === "CREDITS"
              ? "bg-[#2C1B10] text-white shadow-sm"
              : "text-[#7A6251] hover:text-[#2C1B10]"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          {t("credits.creditsTab")} ({creditTotal})
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab("CUSTOMERS")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold transition-all ${
            activeMainTab === "CUSTOMERS"
              ? "bg-[#2C1B10] text-white shadow-sm"
              : "text-[#7A6251] hover:text-[#2C1B10]"
          }`}
        >
          <Users className="w-4 h-4" />
          {t("credits.customersTab")} ({customerTotal})
        </button>
      </div>

      {/* TAB 1: CREDIT SALES VIEW */}
      {activeMainTab === "CREDITS" && (
        <>
          {/* Filter Bar with Status Tabs, Calendar Date Filter, and Search */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 mb-6 shadow-xs flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-wrap">
              {/* Status Pills */}
              {(() => {
                const filterPills = [
                  { id: "ALL", label: t("credits.filterAll") || "All Credits", count: stats?.counts?.all ?? creditTotal },
                  {
                    id: "OPEN",
                    label: t("credits.statusOpen") || "Open / Unpaid",
                    count: stats?.counts?.open ?? credits.filter((c) => c.status !== "PAID" && Number(c.remainingBalance) > 0.01).length,
                  },
                  {
                    id: "PAID",
                    label: t("credits.statusPaid") || "Fully Paid",
                    count: stats?.counts?.paid ?? credits.filter((c) => c.status === "PAID" || Number(c.remainingBalance) <= 0.01).length,
                  },
                ];

                return (
                  <div className="relative w-full sm:w-auto max-w-full overflow-hidden">
                    <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />

                    <div
                      className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 max-w-full"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      {filterPills.map((pill) => {
                        const isActive = filterTab === pill.id;
                        return (
                          <button
                            key={pill.id}
                            ref={isActive ? activeFilterRef : null}
                            type="button"
                            onClick={() => {
                              setFilterTab(pill.id as CreditFilterTab);
                              setCreditPage(1);
                            }}
                            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 outline-none ${
                              isActive
                                ? "bg-[#4A2E1B] text-white shadow-xs ring-2 ring-[#4A2E1B]/20"
                                : "bg-[#FAF6F0] text-[#7A6251] hover:bg-[#F3ECE1] hover:text-[#4A2E1B] border border-[#EDE4D5]"
                            }`}
                          >
                            <span>{pill.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-extrabold ${
                                isActive ? "bg-white/20 text-white" : "bg-black/5 text-[#8C7361]"
                              }`}
                            >
                              {pill.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Date Filter & Quick Today */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <div className="flex items-center gap-1.5 bg-[#FAF7EE] border border-[#EDE4D5] rounded-xl px-2.5 py-1.5 text-xs shadow-2xs">
                  {isFetchingCredits && !isLoadingCredits ? (
                    <Loader2 className="w-3.5 h-3.5 text-[#E87A18] animate-spin shrink-0" />
                  ) : (
                    <Calendar className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                  )}
                  <span className="text-[10px] font-bold text-[#8C7361] uppercase tracking-wider hidden sm:inline">
                    {t('stockMovements.date') || "Date"}:
                  </span>
                  <input
                    type="date"
                    value={dateFilter}
                    onChange={(e) => {
                      setDateFilter(e.target.value);
                      setCreditPage(1);
                    }}
                    className="text-xs font-semibold text-[#2C1B10] bg-transparent outline-none cursor-pointer"
                  />
                  {dateFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setDateFilter("");
                        setCreditPage(1);
                      }}
                      className="text-[#8C7361] hover:text-[#2C1B10] p-0.5 rounded-full hover:bg-white"
                      title="Clear date filter"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetchingCredits && !isLoadingCredits}
                  onClick={() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    setDateFilter(dateFilter === todayStr ? "" : todayStr);
                    setCreditPage(1);
                  }}
                  className={`h-8 px-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    dateFilter === new Date().toISOString().slice(0, 10)
                      ? "bg-[#4A2E1B] text-white border-[#4A2E1B]"
                      : "border-[#EDE4D5] text-[#2C1B10] hover:bg-[#FAF7EE]"
                  }`}
                >
                  {isFetchingCredits && !isLoadingCredits && dateFilter === new Date().toISOString().slice(0, 10) && (
                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  )}
                  <span>{t('stockMovements.today') || "Today"}</span>
                </Button>

                {dateFilter && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isFetchingCredits && !isLoadingCredits}
                    onClick={() => {
                      setDateFilter("");
                      setCreditPage(1);
                    }}
                    className="h-8 px-2 text-xs text-[#8C7361] hover:text-[#2C1B10]"
                  >
                    {t('stockMovements.showAllDates') || "Show All Dates"}
                  </Button>
                )}
              </div>
            </div>

            <Input
              placeholder={t("credits.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCreditPage(1);
              }}
              className="w-full lg:w-64 rounded-xl border-zinc-200 text-xs h-9 shrink-0"
            />
          </div>

          {/* Credit Data: Desktop Table & Mobile Cards */}
          {(() => {
            const filteredCredits = credits.filter((c) => {
              const isPaid = c.status === "PAID" || Number(c.remainingBalance) <= 0.01;
              const creditDate = (c.date || c.createdAt || "").slice(0, 10);

              if (filterTab === "OPEN" && isPaid) return false;
              if (filterTab === "PAID" && !isPaid) return false;
              if (dateFilter && creditDate !== dateFilter) return false;

              if (searchQuery) {
                const q = searchQuery.toLowerCase();
                const parsed = parseCustomerCreditDescription(c.description, c.entityId, c.customer);
                const matches =
                  parsed.name.toLowerCase().includes(q) ||
                  parsed.phone.includes(q) ||
                  parsed.notes.toLowerCase().includes(q) ||
                  (c.description || "").toLowerCase().includes(q) ||
                  (c.entityId || "").toLowerCase().includes(q);
                if (!matches) return false;
              }
              return true;
            });

            return (
              <>
                {/* Desktop Table View */}
                <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead>{t("credits.colCustomer")}</TableHead>
                        <TableHead>{t("credits.colProducts")}</TableHead>
                        <TableHead className="text-right">{t("credits.colTotalAmount")}</TableHead>
                        <TableHead className="text-right">{t("credits.colRemaining")}</TableHead>
                        <TableHead className="text-center">{t("credits.colStatus")}</TableHead>
                        <TableHead>{t("credits.colRepayments") || "Repayments"}</TableHead>
                        <TableHead className="text-right pr-6">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-5 w-16 rounded-full mx-auto" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 rounded-xl ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredCredits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">
                            No customer credit sales found matching filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCredits.map((c, idx) => {
                          const parsed = parseCustomerCreditDescription(c.description, c.entityId, c.customer);
                          const totalAmt = Number(c.amount ?? c.totalAmount ?? 0);
                          const remAmt = Number(c.remainingBalance || 0);

                          return (
                            <TableRow
                              key={c.id}
                              onClick={() => router.push(`/customer-credits/${c.id}`)}
                              className="hover:bg-[#FAF8F5]/80 transition-colors cursor-pointer"
                            >
                              <TableCell className="font-bold text-[#2C1B10] text-xs whitespace-nowrap">
                                {c.date ? format(new Date(c.date), "MMM d, yyyy") : format(new Date(c.createdAt), "MMM d, yyyy")}
                              </TableCell>

                              {/* Customer & Contact Column */}
                              <TableCell className="max-w-[170px]">
                                {c.customer?.id ? (
                                  <Link
                                    href={`/customers/${c.customer.id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-extrabold text-[#2C1B10] text-sm leading-tight truncate hover:text-[#E87A18] hover:underline block"
                                    title="View Customer Profile & Ledger"
                                  >
                                    {parsed.name}
                                  </Link>
                                ) : (
                                  <div className="font-extrabold text-[#2C1B10] text-sm leading-tight truncate">{parsed.name}</div>
                                )}
                                {parsed.phone && (
                                  <div className="text-xs text-[#8C7361] font-medium mt-0.5 flex items-center gap-1">
                                    📞 {parsed.phone}
                                  </div>
                                )}
                              </TableCell>

                              {/* Products / Items Taken Column */}
                              <TableCell className="max-w-[180px]">
                                {parsed.items.length > 0 ? (
                                  <div className="space-y-1">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] leading-tight truncate max-w-full">
                                      {parsed.items[0]}
                                    </span>
                                    {parsed.items.length > 1 && (
                                      <div>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            router.push(`/customer-credits/${c.id}`);
                                          }}
                                          className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#FAF6F0] hover:bg-[#F3ECE1] text-[#4A2E1B] border border-[#EDE4D5] cursor-pointer transition-colors inline-flex items-center gap-0.5"
                                        >
                                          <span className="text-[#E87A18] font-black">+{parsed.items.length - 1}</span>
                                          <span>more</span>
                                          <ChevronRight className="w-2.5 h-2.5 text-[#8C7361]" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#8C7361] italic">Bakery Product Credit</span>
                                )}
                                {parsed.notes && (
                                  <p className="text-[11px] text-[#8C7361] italic mt-0.5 font-normal truncate max-w-[170px]">
                                    Note: {parsed.notes}
                                  </p>
                                )}
                              </TableCell>

                              <TableCell className="text-right font-extrabold text-[#2C1B10] font-mono text-xs whitespace-nowrap">
                                {totalAmt.toFixed(2)} ETB
                              </TableCell>

                              <TableCell className="text-right font-extrabold text-rose-700 font-mono text-xs whitespace-nowrap">
                                {remAmt.toFixed(2)} ETB
                              </TableCell>

                              <TableCell className="text-center whitespace-nowrap">
                                {c.status === "PAID" || remAmt <= 0.01 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    ✓ {t("credits.statusPaid")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    {t("credits.statusOpen")}
                                  </span>
                                )}
                              </TableCell>

                              {/* Repayments Column */}
                              <TableCell className="max-w-[150px]">
                                {c.payments && c.payments.length > 0 ? (
                                  <div className="space-y-1">
                                    <div className="text-[11px] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#EDE4D5] flex items-center justify-between font-mono">
                                      <span className="text-[#8C7361]">{format(new Date(c.payments[c.payments.length - 1].date || c.payments[c.payments.length - 1].createdAt), "MMM d")}</span>
                                      <span className="font-bold text-emerald-700">-{Number(c.payments[c.payments.length - 1].amount ?? c.payments[c.payments.length - 1].amountPaid ?? 0).toFixed(0)} ETB</span>
                                    </div>
                                    {c.payments.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          router.push(`/customer-credits/${c.id}`);
                                        }}
                                        className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-800 hover:text-emerald-950 hover:underline cursor-pointer"
                                      >
                                        <span>+{c.payments.length - 1} more payment{c.payments.length > 2 ? 's' : ''}</span>
                                        <ChevronRight className="w-2.5 h-2.5" />
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#8C7361] italic">No repayments</span>
                                )}
                              </TableCell>

                              {/* Actions Column */}
                              <TableCell className="text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1.5 relative" data-actions-menu>
                                  {remAmt > 0.01 && canManage && (
                                    <Button
                                      size="sm"
                                      variant="success"
                                      onClick={() => {
                                        setPayingCredit(c);
                                        setAmountPaid(String(remAmt));
                                      }}
                                      className="h-8 px-2.5 rounded-xl font-bold text-xs shadow-2xs shrink-0 flex items-center gap-1"
                                    >
                                      <DollarSign className="w-3.5 h-3.5" /> {t("credits.btnPay")}
                                    </Button>
                                  )}

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/customer-credits/${c.id}`)}
                                    className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2 rounded-xl flex items-center gap-1 shadow-2xs shrink-0"
                                    title={t("common.details") || "Credit Details"}
                                  >
                                    <Eye className="w-3.5 h-3.5 text-[#E87A18]" />
                                  </Button>

                                  {canManage && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => router.push(`/customer-credits/new?edit=${c.id}`)}
                                      className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2 rounded-xl shadow-2xs shrink-0"
                                      title={t("credits.editCreditBtn") || "Edit Credit & Products"}
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#8C7361]" />
                                    </Button>
                                  )}

                                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                                    <div className="relative">
                                      <button
                                        type="button"
                                        onClick={() => setOpenActionDropdownId(openActionDropdownId === c.id ? null : c.id)}
                                        className={`h-8 w-8 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                                          openActionDropdownId === c.id
                                            ? "bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-xs"
                                            : "bg-white text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0]"
                                        }`}
                                        title="More Actions"
                                      >
                                        <MoreVertical className="w-4 h-4" />
                                      </button>

                                      {openActionDropdownId === c.id && (
                                        <div
                                          className={`absolute right-0 ${
                                            idx >= filteredCredits.length - 2 || filteredCredits.length <= 3
                                              ? "bottom-full mb-1.5"
                                              : "top-full mt-1.5"
                                          } w-44 z-50 rounded-2xl bg-white border border-[#EDE4D5] shadow-xl p-1.5 space-y-1 text-left animate-in fade-in zoom-in-95 duration-100`}
                                        >
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setOpenActionDropdownId(null);
                                              handleDeleteCredit(c.id);
                                            }}
                                            className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 rounded-xl transition-colors cursor-pointer text-left"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                            {t("common.delete") || "Delete Credit"}
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Audit Cards View */}
                <div className="md:hidden space-y-3">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-5 w-36" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-10 w-full rounded-xl" />
                        <div className="flex justify-between items-center pt-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-8 w-24 rounded-xl" />
                        </div>
                      </div>
                    ))
                  ) : filteredCredits.length === 0 ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                      No customer credit sales found matching filter.
                    </div>
                  ) : (
                    filteredCredits.map((c) => {
                      const parsed = parseCustomerCreditDescription(c.description, c.entityId, c.customer);
                      const totalAmt = Number(c.amount ?? c.totalAmount ?? 0);
                      const remAmt = Number(c.remainingBalance || 0);
                      const isPaid = c.status === "PAID" || remAmt <= 0.01;
                      const formattedDate = c.date
                        ? format(new Date(c.date), "MMM d, yyyy")
                        : format(new Date(c.createdAt), "MMM d, yyyy");

                      return (
                        <div
                          key={c.id}
                          className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-3"
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                            <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                              <Clock className="w-3.5 h-3.5 text-[#8C7361]" />
                              <span className="font-semibold">{formattedDate}</span>
                            </div>
                            {isPaid ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                <CheckCircle2 className="w-3 h-3" /> {t("credits.statusPaid")}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                <AlertTriangle className="w-3 h-3" /> {t("credits.statusOpen")}
                              </span>
                            )}
                          </div>

                          <div>
                            {c.customer?.id ? (
                              <Link
                                href={`/customers/${c.customer.id}`}
                                className="font-extrabold text-[#2C1B10] text-base leading-tight hover:text-[#E87A18] hover:underline block"
                                title="View Customer Profile & Ledger"
                              >
                                {parsed.name}
                              </Link>
                            ) : (
                              <h3 className="font-extrabold text-[#2C1B10] text-base leading-tight">{parsed.name}</h3>
                            )}
                            {parsed.phone && (
                              <a
                                href={`tel:${parsed.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-[#E87A18] font-bold mt-1 hover:underline"
                              >
                                <Phone className="w-3 h-3" /> {parsed.phone}
                              </a>
                            )}
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#8C7361]">
                                {t("credits.colProducts")}
                              </span>
                              {parsed.items.length > 2 && (
                                <button
                                  type="button"
                                  onClick={() => toggleCreditExpand(c.id)}
                                  className="text-[11px] font-bold text-[#E87A18] hover:text-[#d46d13] flex items-center gap-1 transition-colors px-1 py-0.5 rounded hover:bg-amber-50"
                                >
                                  {expandedCreditCards[c.id] ? (
                                    <>
                                      Show Less <ChevronUp className="w-3.5 h-3.5" />
                                    </>
                                  ) : (
                                    <>
                                      +{parsed.items.length - 2} more <ChevronDown className="w-3.5 h-3.5" />
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                            {parsed.items.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 items-center">
                                {(expandedCreditCards[c.id] ? parsed.items : parsed.items.slice(0, 2)).map((itemStr, idx) => (
                                  <span
                                    key={idx}
                                    className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]"
                                  >
                                    {itemStr}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[#8C7361] italic">Bakery Product Credit</span>
                            )}
                            {parsed.notes && (
                              <p className="text-xs text-[#8C7361] italic mt-1.5 bg-[#FAF6F0]/60 p-2 rounded-lg border border-[#EDE4D5]">
                                Note: {parsed.notes}
                              </p>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5]">
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t("credits.colTotalAmount")}</span>
                              <span className="text-sm font-extrabold text-[#2C1B10] font-mono block mt-0.5">
                                {totalAmt.toFixed(2)} ETB
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t("credits.colRemaining")}</span>
                              <span className="text-sm font-extrabold text-rose-700 font-mono block mt-0.5">
                                {remAmt.toFixed(2)} ETB
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 pt-1 border-t border-[#F4ECE1]">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/customer-credits/${c.id}`)}
                              className="flex-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> {t("common.details")}
                            </Button>
                            {canManage && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/customer-credits/new?edit=${c.id}`)}
                                className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] px-3 shrink-0"
                                title="Edit Credit & Products"
                              >
                                <Pencil className="w-3.5 h-3.5 text-[#E87A18]" />
                              </Button>
                            )}
                            {remAmt > 0.01 && canManage && (
                              <Button
                                size="sm"
                                variant="success"
                                onClick={() => {
                                  setPayingCredit(c);
                                  setAmountPaid(String(remAmt));
                                }}
                                className="flex-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" /> {t("credits.btnPay")}
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <PaginationControls
                  currentPage={creditPage}
                  totalPages={creditTotalPages}
                  totalItems={creditTotal}
                  pageSize={15}
                  onPageChange={setCreditPage}
                  isLoading={isLoadingCredits}
                />
              </>
            );
          })()}
        </>
      )}

      {/* TAB 2: CUSTOMERS DIRECTORY (CRM) */}
      {activeMainTab === "CUSTOMERS" && (
        <div className="space-y-4">
          {/* Customer Search & Filter Bar */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setCustomerFilter("ALL");
                  setCustomerPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  customerFilter === "ALL"
                    ? "bg-[#4A2E1B] text-white shadow-xs"
                    : "bg-[#FAF6F0] text-[#7A6251] border border-[#EDE4D5]"
                }`}
              >
                {t("credits.allCustomers")} ({customerTotal})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerFilter("DEBT");
                  setCustomerPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  customerFilter === "DEBT"
                    ? "bg-rose-700 text-white shadow-xs"
                    : "bg-[#FAF6F0] text-rose-700 border border-[#EDE4D5]"
                }`}
              >
                {t("credits.activeDebt")} ({customers.filter((c) => Number(c.totalRemaining || 0) > 0.01).length})
              </button>
              <button
                type="button"
                onClick={() => {
                  setCustomerFilter("SETTLED");
                  setCustomerPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  customerFilter === "SETTLED"
                    ? "bg-emerald-700 text-white shadow-xs"
                    : "bg-[#FAF6F0] text-emerald-700 border border-[#EDE4D5]"
                }`}
              >
                {t("credits.settledOnly")} ({customers.filter((c) => Number(c.totalRemaining || 0) <= 0.01).length})
              </button>
            </div>

            <Input
              placeholder={t("credits.searchCustomerPlaceholder")}
              value={customerSearch}
              onChange={(e) => {
                setCustomerSearch(e.target.value);
                setCustomerPage(1);
              }}
              className="w-full sm:w-64 rounded-xl border-zinc-200 text-xs h-9"
            />
          </div>

          {/* Filtered Customer List */}
          {(() => {
            const filteredCusts = customers.filter((c) => {
              const rem = Number(c.totalRemaining || 0);
              if (customerFilter === "DEBT" && rem <= 0.01) return false;
              if (customerFilter === "SETTLED" && rem > 0.01) return false;

              if (customerSearch) {
                const q = customerSearch.toLowerCase();
                if (!c.fullName.toLowerCase().includes(q) && !c.phone.includes(q)) return false;
              }
              return true;
            });

            return (
              <>
                {/* Desktop Customers Table */}
                <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("credits.colCustomer")}</TableHead>
                        <TableHead>{t("credits.phoneNumberLabel")}</TableHead>
                        <TableHead>{t("credits.addressLabel")}</TableHead>
                        <TableHead className="text-center">{t("credits.totalCreditsCount")}</TableHead>
                        <TableHead className="text-right">{t("credits.totalBorrowed")}</TableHead>
                        <TableHead className="text-right">{t("credits.totalRepaid")}</TableHead>
                        <TableHead className="text-right">{t("credits.outstandingDebt")}</TableHead>
                        <TableHead className="text-right pr-6">{t("common.actions") || "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                          <TableRow key={i}>
                            <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                            <TableCell className="text-center"><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell className="text-right"><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                            <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 rounded-xl ml-auto" /></TableCell>
                          </TableRow>
                        ))
                      ) : filteredCusts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">
                            {t("credits.noCustomersFound")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCusts.map((c) => {
                          const rem = Number(c.totalRemaining || 0);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>
                                <Link
                                  href={`/customers/${c.id}`}
                                  className="font-extrabold text-[#2C1B10] text-sm block hover:text-[#E87A18] hover:underline"
                                  title="View Customer Profile & Ledger"
                                >
                                  {c.fullName}
                                </Link>
                                {c.notes && (
                                  <span className="text-[11px] text-[#8C7361] italic block truncate max-w-[200px]">
                                    {c.notes}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-[#4A2E1B] font-bold">
                                {c.phone}
                              </TableCell>
                              <TableCell className="text-xs text-[#8C7361]">
                                {c.address || "-"}
                              </TableCell>
                              <TableCell className="text-center font-bold text-xs">
                                <span className="px-2 py-0.5 bg-[#FAF6F0] rounded-full border border-[#EDE4D5] font-mono">
                                  {c.totalCredits}
                                </span>
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs text-[#2C1B10]">
                                {Number(c.totalBorrowed || 0).toFixed(2)} ETB
                              </TableCell>
                              <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">
                                {Number(c.totalPaid || 0).toFixed(2)} ETB
                              </TableCell>
                              <TableCell className="text-right">
                                <span
                                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-black ${
                                    rem > 0.01
                                      ? "bg-rose-100 text-rose-800 border border-rose-300"
                                      : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  }`}
                                >
                                  {rem.toFixed(2)} ETB
                                </span>
                              </TableCell>
                              <TableCell className="text-right pr-4">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/customers/${c.id}`)}
                                    className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl shadow-2xs"
                                    title="View Customer Profile & Ledger"
                                  >
                                    <Eye className="w-3.5 h-3.5 mr-1 text-[#E87A18]" />
                                    Ledger
                                  </Button>
                                  {canManage && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openEditCustomer(c)}
                                      className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2 rounded-xl shadow-2xs"
                                      title="Edit Customer"
                                    >
                                      <Pencil className="w-3.5 h-3.5 text-[#8C7361]" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Customers Cards */}
                <div className="md:hidden space-y-3">
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex justify-between items-center">
                          <Skeleton className="h-5 w-36" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-12 w-full rounded-xl" />
                      </div>
                    ))
                  ) : filteredCusts.length === 0 ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                      {t("credits.noCustomersFound")}
                    </div>
                  ) : (
                    filteredCusts.map((c) => {
                      const rem = Number(c.totalRemaining || 0);
                      return (
                        <div key={c.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-3">
                          <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2">
                            <div>
                              <Link
                                href={`/customers/${c.id}`}
                                className="font-extrabold text-[#2C1B10] text-base leading-tight hover:text-[#E87A18] hover:underline block"
                                title="View Customer Profile & Ledger"
                              >
                                {c.fullName}
                              </Link>
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-[#E87A18] font-bold mt-0.5 hover:underline"
                              >
                                <Phone className="w-3 h-3" /> {c.phone}
                              </a>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-black border ${
                                  rem > 0.01
                                    ? "bg-rose-100 text-rose-800 border-rose-300"
                                    : "bg-emerald-100 text-emerald-800 border-emerald-300"
                                }`}
                              >
                                {rem > 0.01 ? `${rem.toFixed(2)} ETB` : "Settled"}
                              </span>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/customers/${c.id}`)}
                                className="h-7 w-7 p-0 rounded-lg border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]"
                                title="View Customer Profile & Ledger"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#E87A18]" />
                              </Button>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => openEditCustomer(c)}
                                  className="h-7 w-7 p-0 rounded-lg border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]"
                                  title="Edit Customer"
                                >
                                  <Pencil className="w-3.5 h-3.5 text-[#8C7361]" />
                                </Button>
                              )}
                            </div>
                          </div>

                          {c.address && (
                            <p className="text-xs text-[#8C7361] flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[#8C7361] shrink-0" /> {c.address}
                            </p>
                          )}

                          <div className="grid grid-cols-3 gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-center">
                            <div>
                              <span className="text-[9px] font-bold uppercase text-[#8C7361] block">{t("credits.totalCreditsCount")}</span>
                              <span className="text-xs font-mono font-extrabold text-[#2C1B10]">{c.totalCredits}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase text-[#8C7361] block">{t("credits.totalBorrowed")}</span>
                              <span className="text-xs font-mono font-extrabold text-[#2C1B10]">{Number(c.totalBorrowed || 0).toFixed(0)}</span>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase text-emerald-800 block">{t("credits.totalRepaid")}</span>
                              <span className="text-xs font-mono font-extrabold text-emerald-700">{Number(c.totalPaid || 0).toFixed(0)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <PaginationControls
                  currentPage={customerPage}
                  totalPages={customerTotalPages}
                  totalItems={customerTotal}
                  pageSize={15}
                  onPageChange={setCustomerPage}
                  isLoading={isLoadingCustomers}
                />
              </>
            );
          })()}
        </div>
      )}

      {/* MODAL: Settle Credit Repayment */}
      <Dialog open={!!payingCredit} onOpenChange={(open) => !open && setPayingCredit(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-600" />
              {t("credits.modalPayTitle")}
            </DialogTitle>
          </DialogHeader>

          {payingCredit && (
            <form onSubmit={handlePay} className="space-y-4 pt-2">
              <div className="p-3 bg-[#FAF6F0] rounded-xl border border-[#EDE4D5] space-y-1">
                <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t("credits.colCustomer")}</span>
                <span className="font-extrabold text-sm text-[#2C1B10] block">
                  {payingCredit.customer?.fullName || parseCustomerCreditDescription(payingCredit.description, payingCredit.entityId).name}
                </span>
                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#EDE4D5]/60 mt-1">
                  <span className="text-[#8C7361]">{t("credits.colRemaining")}:</span>
                  <span className="font-mono font-extrabold text-rose-700">
                    {Number(payingCredit.remainingBalance).toFixed(2)} ETB
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.amountPaidLabel")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  max={Number(payingCredit.remainingBalance)}
                  required
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl font-mono font-bold text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.paymentDateLabel")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="rounded-xl text-xs font-bold"
                />
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPayingCredit(null)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  loading={isSubmittingPay}
                  variant="success"
                >
                  {t("credits.btnPay")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* MODAL: Quick Add Customer Profile */}
      <Dialog open={isAddCustomerOpen} onOpenChange={setIsAddCustomerOpen}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-[#E87A18]" />
              {t("credits.addNewCustomerBtn")}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateCustomer} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.customerNameLabel")} <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder={t("credits.customerNamePlaceholder")}
                value={newCustName}
                onChange={(e) => setNewCustName(e.target.value)}
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.phoneNumberLabel")} <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder={t("credits.phonePlaceholder")}
                value={newCustPhone}
                onChange={(e) => setNewCustPhone(e.target.value)}
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.addressLabel")}
              </label>
              <Input
                placeholder={t("credits.addressPlaceholder")}
                value={newCustAddress}
                onChange={(e) => setNewCustAddress(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.noteLabel")}
              </label>
              <Input
                placeholder="Optional notes or references"
                value={newCustNotes}
                onChange={(e) => setNewCustNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddCustomerOpen(false)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={isSubmittingCust}
              >
                {t("credits.addNewCustomerBtn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Edit Customer Profile */}
      <Dialog open={!!editingCustomer} onOpenChange={(open) => !open && setEditingCustomer(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#E87A18]" />
              {t("credits.editCustomerModalTitle") || "Edit Customer Profile"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateCustomer} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.customerNameLabel")} <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder={t("credits.customerNamePlaceholder")}
                value={editCustName}
                onChange={(e) => setEditCustName(e.target.value)}
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.phoneNumberLabel")} <span className="text-rose-500">*</span>
              </label>
              <Input
                required
                placeholder={t("credits.phonePlaceholder")}
                value={editCustPhone}
                onChange={(e) => setEditCustPhone(e.target.value)}
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.addressLabel")}
              </label>
              <Input
                placeholder={t("credits.addressPlaceholder")}
                value={editCustAddress}
                onChange={(e) => setEditCustAddress(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.noteLabel")}
              </label>
              <Input
                placeholder="Optional notes or references"
                value={editCustNotes}
                onChange={(e) => setEditCustNotes(e.target.value)}
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCustomer(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={isSubmittingEditCust}
              >
                {t("common.save") || "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* MODAL: Edit Customer Credit Record */}
      <Dialog open={!!editingCredit} onOpenChange={(open) => !open && setEditingCredit(null)}>
        <DialogContent className="max-w-md bg-white rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
              <Pencil className="w-5 h-5 text-[#E87A18]" />
              {t("credits.editCreditModalTitle") || "Edit Customer Credit Record"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateCredit} className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.colCustomer")} <span className="text-rose-500">*</span>
              </label>
              <select
                value={editCreditCustomerId}
                onChange={(e) => setEditCreditCustomerId(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl px-3 py-2 text-xs font-bold text-[#2C1B10] bg-white outline-none focus:ring-2 focus:ring-[#E87A18]/30 cursor-pointer"
              >
                {customers.map((cust) => (
                  <option key={cust.id} value={cust.id}>
                    {cust.fullName} ({cust.phone})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.colTotalAmount")} (ETB) <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={editCreditAmount}
                  onChange={(e) => setEditCreditAmount(e.target.value)}
                  className="rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("common.date")} <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={editCreditDate}
                  onChange={(e) => setEditCreditDate(e.target.value)}
                  className="rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.dueDateLabel") || "Due Date"}
              </label>
              <Input
                type="date"
                value={editCreditDueDate}
                onChange={(e) => setEditCreditDueDate(e.target.value)}
                className="rounded-xl text-xs font-bold"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                {t("credits.notesCardTitle") || "Notes / Description"}
              </label>
              <textarea
                rows={3}
                placeholder="Custom delivery references or notes (leave empty if none)..."
                value={editCreditDescription}
                onChange={(e) => setEditCreditDescription(e.target.value)}
                className="w-full border border-zinc-200 rounded-xl p-2.5 text-xs text-[#2C1B10] outline-none focus:ring-2 focus:ring-[#E87A18]/30 resize-none"
              />
            </div>

            <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#8C7361]">
                Need to change products, quantities, or unit prices?
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (editingCredit) {
                    const targetId = editingCredit.id;
                    setEditingCredit(null);
                    router.push(`/customer-credits/new?edit=${targetId}`);
                  }
                }}
                className="h-7 text-xs px-2.5 font-bold border-[#E87A18]/40 text-[#E87A18] hover:bg-[#FAF6F0]"
              >
                <ShoppingBag className="w-3 h-3 mr-1" />
                Edit Products →
              </Button>
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingCredit(null)}
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                loading={isSubmittingEditCredit}
              >
                {t("common.save") || "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
