"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
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
import {
  Plus,
  CreditCard,
  DollarSign,
  Trash2,
  RefreshCw,
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

export default function CustomerCreditsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  // Active Main Tab: "CREDITS" vs "CUSTOMERS"
  const [activeMainTab, setActiveMainTab] = useState<"CREDITS" | "CUSTOMERS">("CREDITS");

  // Data States
  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Credit Filter Pills
  type CreditFilterTab = "ALL" | "OPEN" | "PAID" | "TODAY";
  const [filterTab, setFilterTab] = useState<CreditFilterTab>("ALL");
  const activeFilterRef = useRef<HTMLButtonElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedCreditCards, setExpandedCreditCards] = useState<Record<string, boolean>>({});

  // Customer Filter State
  type CustomerFilterType = "ALL" | "DEBT" | "SETTLED";
  const [customerFilter, setCustomerFilter] = useState<CustomerFilterType>("ALL");
  const [customerSearch, setCustomerSearch] = useState("");

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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const [resCredits, resCustomers] = await Promise.all([
        api.get(`/customers/credits${branchQuery}`).catch(() => api.get(`/loans?type=CUSTOMER${selectedBranchId ? `&branchId=${selectedBranchId}` : ""}`)),
        api.get(`/customers${branchQuery}`),
      ]);

      setCredits(resCredits.data || []);
      setCustomers(resCustomers.data || []);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load customer credit records");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      fetchData();
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
      fetchData();
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
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to create customer");
    } finally {
      setIsSubmittingCust(false);
    }
  };

  // Metrics
  const totalCreditGiven = credits.reduce(
    (acc, c) => acc + Number(c.amount ?? c.totalAmount ?? 0),
    0
  );
  const totalOutstanding = credits.reduce(
    (acc, c) => acc + Number(c.remainingBalance || 0),
    0
  );
  const totalRepaid = Math.max(0, totalCreditGiven - totalOutstanding);

  return (
    <DashboardLayout>
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#E87A18]" />
            {t("credits.title")}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            {t("credits.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t("common.refresh")}
          </Button>

          {canManage && (
            <>
              <Button
                onClick={() => setIsAddCustomerOpen(true)}
                variant="outline"
                size="sm"
                className="border-[#E87A18]/40 text-[#E87A18] hover:bg-amber-50 font-bold rounded-xl text-xs h-9 flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" /> {t("credits.addNewCustomerBtn")}
              </Button>
              <Button
                onClick={() => router.push("/customer-credits/new")}
                className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5 h-9"
              >
                <Plus className="w-4 h-4" /> {t("credits.newCredit")}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
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
          {t("credits.creditsTab")} ({credits.length})
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
          {t("credits.customersTab")} ({customers.length})
        </button>
      </div>

      {/* TAB 1: CREDIT SALES VIEW */}
      {activeMainTab === "CREDITS" && (
        <>
          {/* Filter Bar with Horizontal Auto-Centering Tabs */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {(() => {
              const todayYmd = new Date().toISOString().slice(0, 10);
              const filterPills = [
                { id: "ALL", label: t("credits.filterAll") || "All Credits", count: credits.length },
                {
                  id: "OPEN",
                  label: t("credits.statusOpen") || "Open / Unpaid",
                  count: credits.filter((c) => c.status !== "PAID" && Number(c.remainingBalance) > 0.01).length,
                },
                {
                  id: "PAID",
                  label: t("credits.statusPaid") || "Fully Paid",
                  count: credits.filter((c) => c.status === "PAID" || Number(c.remainingBalance) <= 0.01).length,
                },
                {
                  id: "TODAY",
                  label: `📅 ${t("credits.filterToday") || "Today"}`,
                  count: credits.filter((c) => (c.date || c.createdAt || "").slice(0, 10) === todayYmd).length,
                },
              ];

              return (
                <div className="relative w-full sm:w-auto max-w-full overflow-hidden">
                  <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-white to-transparent z-10 sm:hidden" />
                  <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-white to-transparent z-10 sm:hidden" />

                  <div
                    className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_2rem] py-0.5 max-w-full"
                    style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                  >
                    {filterPills.map((pill) => {
                      const isActive = filterTab === pill.id;
                      return (
                        <button
                          key={pill.id}
                          ref={isActive ? activeFilterRef : null}
                          type="button"
                          onClick={() => setFilterTab(pill.id as CreditFilterTab)}
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

            <Input
              placeholder={t("credits.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 rounded-xl border-zinc-200 text-xs h-9"
            />
          </div>

          {/* Credit Data: Desktop Table & Mobile Cards */}
          {(() => {
            const todayYmd = new Date().toISOString().slice(0, 10);
            const filteredCredits = credits.filter((c) => {
              const isPaid = c.status === "PAID" || Number(c.remainingBalance) <= 0.01;
              const creditDate = (c.date || c.createdAt || "").slice(0, 10);

              if (filterTab === "OPEN" && isPaid) return false;
              if (filterTab === "PAID" && !isPaid) return false;
              if (filterTab === "TODAY" && creditDate !== todayYmd) return false;

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
                <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("common.date")}</TableHead>
                        <TableHead>{t("credits.colCustomer")}</TableHead>
                        <TableHead>{t("credits.colProducts")}</TableHead>
                        <TableHead className="text-right">{t("credits.colTotalAmount")}</TableHead>
                        <TableHead className="text-right">{t("credits.colRemaining")}</TableHead>
                        <TableHead className="text-center">{t("credits.colStatus")}</TableHead>
                        <TableHead>{t("reports.dailyBreakdownTitle")}</TableHead>
                        <TableHead className="text-right pr-6">{t("common.actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">
                            Loading customer product credit accounts...
                          </TableCell>
                        </TableRow>
                      ) : filteredCredits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-8 text-[#8C7361] font-medium">
                            No customer credit sales found matching filter.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCredits.map((c) => {
                          const parsed = parseCustomerCreditDescription(c.description, c.entityId, c.customer);
                          const totalAmt = Number(c.amount ?? c.totalAmount ?? 0);
                          const remAmt = Number(c.remainingBalance || 0);

                          return (
                            <TableRow key={c.id}>
                              <TableCell className="font-bold text-[#2C1B10] text-xs">
                                {c.date ? format(new Date(c.date), "MMM d, yyyy") : format(new Date(c.createdAt), "MMM d, yyyy")}
                              </TableCell>

                              {/* Customer & Contact Column */}
                              <TableCell className="max-w-[200px]">
                                <div className="font-extrabold text-[#2C1B10] text-sm leading-tight">{parsed.name}</div>
                                {parsed.phone && (
                                  <div className="text-xs text-[#8C7361] font-medium mt-0.5 flex items-center gap-1">
                                    📞 {parsed.phone}
                                  </div>
                                )}
                              </TableCell>

                              {/* Products / Items Taken Column */}
                              <TableCell className="max-w-[240px]">
                                {parsed.items.length > 0 ? (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    {(expandedCreditCards[c.id] ? parsed.items : parsed.items.slice(0, 2)).map((itemStr, idx) => (
                                      <span
                                        key={idx}
                                        className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] leading-tight"
                                      >
                                        {itemStr}
                                      </span>
                                    ))}
                                    {parsed.items.length > 2 && (
                                      <button
                                        type="button"
                                        onClick={() => toggleCreditExpand(c.id)}
                                        className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#4A2E1B] text-white hover:bg-[#3D2314] cursor-pointer transition-colors inline-flex items-center gap-0.5"
                                      >
                                        {expandedCreditCards[c.id] ? "Show less" : `+${parsed.items.length - 2} more`}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#8C7361] italic">Bakery Product Credit</span>
                                )}
                                {parsed.notes && (
                                  <p className="text-[11px] text-[#8C7361] italic mt-0.5 font-normal truncate max-w-[220px]">
                                    Note: {parsed.notes}
                                  </p>
                                )}
                              </TableCell>

                              <TableCell className="text-right font-extrabold text-[#2C1B10] font-mono text-xs">
                                {totalAmt.toFixed(2)} ETB
                              </TableCell>

                              <TableCell className="text-right font-extrabold text-rose-700 font-mono text-xs">
                                {remAmt.toFixed(2)} ETB
                              </TableCell>

                              <TableCell className="text-center">
                                {c.status === "PAID" || remAmt <= 0.01 ? (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                    ✓ {t("credits.statusPaid")}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                                    {t("credits.statusOpen")}
                                  </span>
                                )}
                              </TableCell>

                              <TableCell>
                                {c.payments && c.payments.length > 0 ? (
                                  <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                                    {c.payments.map((p) => {
                                      const pAmt = Number(p.amount ?? p.amountPaid ?? 0);
                                      return (
                                        <div key={p.id} className="text-[11px] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#EDE4D5] flex justify-between font-mono">
                                          <span className="text-[#8C7361]">{format(new Date(p.date || p.createdAt), "MMM d")}</span>
                                          <span className="font-bold text-emerald-700">-{pAmt.toFixed(2)} ETB</span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <span className="text-xs text-[#8C7361] italic">No repayments yet</span>
                                )}
                              </TableCell>

                              <TableCell className="text-right pr-6">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => router.push(`/customer-credits/${c.id}`)}
                                    className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                                  >
                                    <Eye className="w-3.5 h-3.5" /> {t("common.details")}
                                  </Button>
                                  {remAmt > 0.01 && canManage && (
                                    <Button
                                      size="sm"
                                      onClick={() => {
                                        setPayingCredit(c);
                                        setAmountPaid(String(remAmt));
                                      }}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                                    >
                                      <DollarSign className="w-3.5 h-3.5" /> {t("credits.btnPay")}
                                    </Button>
                                  )}
                                  {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleDeleteCredit(c.id)}
                                      className="text-rose-600 hover:bg-rose-50 font-bold text-xs h-8 px-2 rounded-lg"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
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

                {/* Mobile Audit Cards View */}
                <div className="block md:hidden space-y-3">
                  {isLoading ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                      Loading customer product credit accounts...
                    </div>
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
                            <h3 className="font-extrabold text-[#2C1B10] text-base leading-tight">{parsed.name}</h3>
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
                              className="flex-1 border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
                            >
                              <Eye className="w-3.5 h-3.5" /> {t("common.details")}
                            </Button>
                            {remAmt > 0.01 && canManage && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  setPayingCredit(c);
                                  setAmountPaid(String(remAmt));
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 rounded-xl flex items-center justify-center gap-1.5"
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
                onClick={() => setCustomerFilter("ALL")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  customerFilter === "ALL"
                    ? "bg-[#4A2E1B] text-white shadow-xs"
                    : "bg-[#FAF6F0] text-[#7A6251] border border-[#EDE4D5]"
                }`}
              >
                {t("credits.allCustomers")} ({customers.length})
              </button>
              <button
                type="button"
                onClick={() => setCustomerFilter("DEBT")}
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
                onClick={() => setCustomerFilter("SETTLED")}
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
              onChange={(e) => setCustomerSearch(e.target.value)}
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
                <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("credits.colCustomer")}</TableHead>
                        <TableHead>{t("credits.phoneNumberLabel")}</TableHead>
                        <TableHead>{t("credits.addressLabel")}</TableHead>
                        <TableHead className="text-center">{t("credits.totalCreditsCount")}</TableHead>
                        <TableHead className="text-right">{t("credits.totalBorrowed")}</TableHead>
                        <TableHead className="text-right">{t("credits.totalRepaid")}</TableHead>
                        <TableHead className="text-right pr-6">{t("credits.outstandingDebt")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                            Loading customer directory...
                          </TableCell>
                        </TableRow>
                      ) : filteredCusts.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                            {t("credits.noCustomersFound")}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCusts.map((c) => {
                          const rem = Number(c.totalRemaining || 0);
                          return (
                            <TableRow key={c.id}>
                              <TableCell>
                                <span className="font-extrabold text-[#2C1B10] text-sm block">{c.fullName}</span>
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
                              <TableCell className="text-right pr-6">
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
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Mobile Customers Cards */}
                <div className="block md:hidden space-y-3">
                  {isLoading ? (
                    <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                      Loading customer directory...
                    </div>
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
                              <h3 className="font-extrabold text-[#2C1B10] text-base leading-tight">{c.fullName}</h3>
                              <a
                                href={`tel:${c.phone}`}
                                className="inline-flex items-center gap-1 text-xs text-[#E87A18] font-bold mt-0.5 hover:underline"
                              >
                                <Phone className="w-3 h-3" /> {c.phone}
                              </a>
                            </div>

                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-black border ${
                                rem > 0.01
                                  ? "bg-rose-100 text-rose-800 border-rose-300"
                                  : "bg-emerald-100 text-emerald-800 border-emerald-300"
                              }`}
                            >
                              {rem > 0.01 ? `${rem.toFixed(2)} ETB Due` : "Settled"}
                            </span>
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
                  className="rounded-xl border-[#EDE4D5]"
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingPay}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl"
                >
                  {isSubmittingPay ? t("common.loading") : t("credits.btnPay")}
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
                className="rounded-xl border-[#EDE4D5]"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isSubmittingCust}
                className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl"
              >
                {isSubmittingCust ? t("common.loading") : t("credits.addNewCustomerBtn")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
