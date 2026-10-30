"use client";

import { useState, use, useMemo } from "react";
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
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { formatEthDate } from "@/lib/ethiopianDate";
import { AppDatePicker } from "@/components/AppDatePicker";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSkeleton, KpiCardsSkeleton } from "@/components/ui/skeletons";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  CreditCard,
  Calendar,
  DollarSign,
  Plus,
  Pencil,
  Eye,
  Printer,
  Clock,
  CheckCircle2,
  AlertTriangle,
  FileText,
  Copy,
  ChevronRight,
  TrendingDown,
  ShoppingBag,
  History,
  Building2,
} from "lucide-react";

interface CreditPayment {
  id: string;
  amount?: number | string;
  amountPaid?: number | string;
  date: string;
  createdAt: string;
  note?: string | null;
  description?: string | null;
  creditId?: string;
}

interface CustomerCreditItem {
  id: string;
  date: string;
  dueDate?: string | null;
  createdAt: string;
  amount: number;
  paidAmount: number;
  remainingBalance: number;
  status: "OPEN" | "PAID";
  description?: string | null;
  branch?: { id: string; name: string } | null;
  payments: CreditPayment[];
}

interface CustomerDetail {
  id: string;
  fullName: string;
  phone: string;
  address?: string | null;
  notes?: string | null;
  createdAt: string;
  branch?: { id: string; name: string } | null;
  credits: CustomerCreditItem[];
  totalCredits: number;
  totalBorrowed: number;
  totalPaid: number;
  totalRemaining: number;
}

function parseCreditDescription(rawDesc?: string | null) {
  if (!rawDesc) return { items: [], notes: "" };
  let remaining = rawDesc;
  let itemsList: Array<{ qty: string; name: string; unitPrice: string; total: string }> = [];

  const creditItemsMatch = remaining.match(/\[CreditItems:\s*(\[.*?\])\s*\]/);
  if (creditItemsMatch) {
    try {
      const parsedList = JSON.parse(creditItemsMatch[1]);
      if (Array.isArray(parsedList)) {
        itemsList = parsedList.map((it: any) => {
          const qty = it.quantity != null ? String(it.quantity) : "1";
          const pName = it.productName || "Product";
          const uPrice = it.unitPrice != null ? Number(it.unitPrice).toFixed(2) : "-";
          const totalVal = (Number(qty) * Number(it.unitPrice || 0)).toFixed(2);
          return { qty, name: pName, unitPrice: uPrice, total: totalVal };
        });
      }
    } catch {}
    remaining = remaining.replace(/\[CreditItems:\s*\[.*?\]\s*\]/g, "").trim();
  }

  // Strip [Products: ...]
  remaining = remaining.replace(/\[Products:\s*.*?\]/gi, "").trim();
  // Strip phone/address prefix if stored as Legacy format
  remaining = remaining.replace(/^[^|]+(?:\s*\|\s*[^|]+)?\s*\|\s*/, "").trim();
  // Clean up any remaining dashes, colons or pipes
  remaining = remaining.replace(/^[\s\-\–\|\:]+/, "").replace(/[\s\-\–\|\:]+$/, "").trim();
  return { items: itemsList, notes: remaining };
}

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"CREDITS" | "PAYMENTS">("CREDITS");

  // Modals state
  const [payingCredit, setPayingCredit] = useState<CustomerCreditItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [isSubmittingPay, setIsSubmittingPay] = useState<boolean>(false);

  // Edit Customer Modal State
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editCustomerAddress, setEditCustomerAddress] = useState("");
  const [editCustomerNotes, setEditCustomerNotes] = useState("");
  const [isSubmittingCustomerEdit, setIsSubmittingCustomerEdit] = useState(false);

  // Edit Credit Modal State
  const [editingCredit, setEditingCredit] = useState<CustomerCreditItem | null>(null);
  const [editCreditAmount, setEditCreditAmount] = useState("");
  const [editCreditDate, setEditCreditDate] = useState("");
  const [editCreditDueDate, setEditCreditDueDate] = useState("");
  const [editCreditDescription, setEditCreditDescription] = useState("");
  const [isSubmittingEditCredit, setIsSubmittingEditCredit] = useState(false);

  // Fetch Customer Details
  const {
    data: customer,
    isLoading,
    isError,
    error,
  } = useQuery<CustomerDetail>({
    queryKey: ["customer-detail", resolvedParams.id],
    queryFn: async () => {
      const res = await api.get(`/customers/${resolvedParams.id}`);
      return res.data;
    },
  });

  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  // Reconstructed flat payments ledger
  const allPayments = useMemo(() => {
    if (!customer?.credits) return [];
    const list: Array<CreditPayment & { creditDate: string; creditTotal: number; creditId: string }> = [];
    customer.credits.forEach((cr) => {
      (cr.payments || []).forEach((p) => {
        list.push({
          ...p,
          creditId: cr.id,
          creditDate: cr.date,
          creditTotal: cr.amount,
        });
      });
    });
    // Sort descending by payment date / createdAt
    return list.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
  }, [customer?.credits]);

  const openPayModal = (credit: CustomerCreditItem) => {
    setPayingCredit(credit);
    setPaymentAmount(Number(credit.remainingBalance).toFixed(2));
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCredit) return;
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error(t("credits.toastEnterValidPayment") || "Please enter a valid payment amount");
      return;
    }
    if (amt > Number(payingCredit.remainingBalance) + 0.01) {
      toast.error("Payment amount cannot exceed the remaining balance");
      return;
    }

    setIsSubmittingPay(true);
    try {
      await api.post(`/customers/credits/${payingCredit.id}/pay`, {
        amount: amt,
        date: paymentDate,
      });
      toast.success(t("credits.toastPaymentSuccess") || "Payment logged successfully");
      setPayingCredit(null);
      queryClient.invalidateQueries({ queryKey: ["customer-detail", resolvedParams.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-credits"] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-customers"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record payment");
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const openEditCustomerModal = () => {
    if (!customer) return;
    setEditCustomerName(customer.fullName || "");
    setEditCustomerPhone(customer.phone || "");
    setEditCustomerAddress(customer.address || "");
    setEditCustomerNotes(customer.notes || "");
    setIsEditingCustomer(true);
  };

  const handleCustomerEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (!editCustomerName.trim() || !editCustomerPhone.trim()) {
      toast.error(t("credits.toastCustomerNamePhoneRequired") || "Customer name and phone are required");
      return;
    }

    setIsSubmittingCustomerEdit(true);
    try {
      await api.patch(`/customers/${customer.id}`, {
        fullName: editCustomerName.trim(),
        phone: editCustomerPhone.trim(),
        address: editCustomerAddress.trim() || null,
        notes: editCustomerNotes.trim() || null,
      });
      toast.success(t("credits.toastCustomerUpdated") || "Customer profile updated");
      setIsEditingCustomer(false);
      queryClient.invalidateQueries({ queryKey: ["customer-detail", resolvedParams.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-customers"] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-credits"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update customer");
    } finally {
      setIsSubmittingCustomerEdit(false);
    }
  };

  const openEditCreditModal = (credit: CustomerCreditItem) => {
    setEditingCredit(credit);
    setEditCreditAmount(Number(credit.amount).toFixed(2));
    setEditCreditDate(credit.date ? format(new Date(credit.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
    setEditCreditDueDate(credit.dueDate ? format(new Date(credit.dueDate), "yyyy-MM-dd") : "");
    const parsed = parseCreditDescription(credit.description);
    setEditCreditDescription(parsed.notes || "");
  };

  const handleCreditEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCredit) return;
    const amt = Number(editCreditAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid credit amount");
      return;
    }

    setIsSubmittingEditCredit(true);
    try {
      let finalDescription = editCreditDescription.trim();
      const creditItemsMatch = (editingCredit.description || "").match(/\[CreditItems:\s*(\[.*?\])\s*\]/);
      const productsMatch = (editingCredit.description || "").match(/\[Products:\s*.*?\]/);
      const preservedTags = [productsMatch?.[0], creditItemsMatch?.[0]].filter(Boolean).join(" ");
      if (preservedTags) {
        finalDescription = finalDescription ? `${preservedTags} - ${finalDescription}` : preservedTags;
      }

      await api.patch(`/customers/credits/${editingCredit.id}`, {
        amount: amt,
        date: editCreditDate,
        dueDate: editCreditDueDate || null,
        description: finalDescription || null,
      });

      toast.success(t("credits.toastCreditUpdated") || "Credit updated successfully");
      setEditingCredit(null);
      queryClient.invalidateQueries({ queryKey: ["customer-detail", resolvedParams.id] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-credits"] });
      queryClient.invalidateQueries({ queryKey: ["customer-credits-page-customers"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update credit");
    } finally {
      setIsSubmittingEditCredit(false);
    }
  };

  const copyPhoneNumber = (phone: string) => {
    navigator.clipboard.writeText(phone);
    toast.success("Phone number copied to clipboard");
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-6xl mx-auto py-2">
          <Skeleton className="h-8 w-48 rounded-xl" />
          <DetailSkeleton />
          <KpiCardsSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (isError || !customer) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto text-center py-16 space-y-4">
          <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-black text-[#2C1B10]">Customer Not Found</h2>
          <p className="text-sm text-[#8C7361]">
            {(error as any)?.response?.data?.error || "The requested customer profile could not be located."}
          </p>
          <Button onClick={() => router.push("/customer-credits")} variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Credit Sales
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const isFullySettled = (customer.totalRemaining || 0) <= 0.01;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Top Navigation & Breadcrumbs */}
        <div className="flex items-center justify-between gap-2.5 print:hidden">
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/customer-credits")}
              className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] shrink-0 h-8 px-2.5 text-xs font-bold"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1" />
              {t("common.back") || "Back"}
            </Button>
            <div className="flex items-center text-xs text-[#8C7361] gap-1.5 min-w-0 truncate">
              <Link href="/customer-credits" className="hover:underline shrink-0 hidden sm:inline">
                {t("credits.title") || "Customer Credits"}
              </Link>
              <ChevronRight className="w-3.5 h-3.5 shrink-0 hidden sm:inline" />
              <span className="font-bold text-[#2C1B10] truncate">{customer.fullName}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
              className="hidden sm:inline-flex rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] h-8 text-xs font-bold px-2.5"
            >
              <Printer className="w-3.5 h-3.5 mr-1.5 text-[#E87A18]" />
              {t("credits.printBtn") || "Print"}
            </Button>

            {canManage && (
              <Button
                variant="outline"
                size="sm"
                onClick={openEditCustomerModal}
                className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] h-8 text-xs font-bold px-2.5"
              >
                <Pencil className="w-3.5 h-3.5 mr-1 text-[#E87A18]" />
                {t("common.edit") || "Edit"}
              </Button>
            )}

            <Button
              size="sm"
              onClick={() => router.push(`/customer-credits/new?customerId=${customer.id}`)}
              className="rounded-xl bg-[#E87A18] hover:bg-[#D26911] text-white shadow-sm h-8 text-xs font-bold px-2.5 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              {t("credits.newCredit") || "Log Credit"}
            </Button>
          </div>
        </div>

        {/* Mobile Compact Customer Banner (md:hidden) */}
        <div className="md:hidden bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-base font-black text-[#2C1B10] truncate">{customer.fullName}</h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C7361] mt-1">
                <a href={`tel:${customer.phone}`} className="inline-flex items-center gap-1 font-bold text-[#4A2E1B] hover:underline">
                  <Phone className="w-3 h-3 text-[#E87A18]" />
                  {customer.phone}
                </a>
                {customer.branch?.name && (
                  <span className="text-[10px] bg-[#FAF6F0] px-2 py-0.5 rounded-md border border-[#EDE4D5]">
                    {customer.branch.name}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#8C7361] block">Outstanding</span>
              <span className={`text-base font-mono font-black ${isFullySettled ? "text-emerald-700" : "text-rose-700"}`}>
                {Number(customer.totalRemaining || 0).toFixed(2)}
                <span className="text-[10px] font-sans font-bold text-[#8C7361] ml-0.5">ETB</span>
              </span>
            </div>
          </div>

          {(customer.address || customer.notes) && (
            <div className="pt-2 border-t border-[#F4ECE1] text-[11px] text-[#8C7361] space-y-1">
              {customer.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[#8C7361] shrink-0" />
                  <span className="truncate">{customer.address}</span>
                </div>
              )}
              {customer.notes && (
                <p className="italic line-clamp-2">
                  <span className="font-bold text-[#4A2E1B] not-italic mr-1">Note:</span>
                  {customer.notes}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Desktop Hero Customer Profile Card (hidden md:block) */}
        <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-3xl p-6 sm:p-7 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-[#FAF6F0] to-[#EDE4D5] border border-[#DFCBB5] flex items-center justify-center text-[#E87A18] font-black text-2xl shrink-0 shadow-inner">
                {customer.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#2C1B10] tracking-tight">{customer.fullName}</h1>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black border ${
                      isFullySettled
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                        : "bg-rose-50 text-rose-800 border-rose-300"
                    }`}
                  >
                    {isFullySettled ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        All Credits Settled
                      </>
                    ) : (
                      <>
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                        Balance Due: {Number(customer.totalRemaining).toFixed(2)} ETB
                      </>
                    )}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-[#4A2E1B] pt-0.5">
                  <div className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1 rounded-xl border border-[#EDE4D5]">
                    <Phone className="w-3.5 h-3.5 text-[#E87A18]" />
                    <a href={`tel:${customer.phone}`} className="hover:underline text-[#2C1B10]">
                      {customer.phone}
                    </a>
                    <button
                      onClick={() => copyPhoneNumber(customer.phone)}
                      title="Copy phone"
                      className="text-[#8C7361] hover:text-[#2C1B10] ml-1"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {customer.address && (
                    <div className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1 rounded-xl border border-[#EDE4D5]">
                      <MapPin className="w-3.5 h-3.5 text-[#8C7361]" />
                      <span>{customer.address}</span>
                    </div>
                  )}

                  {customer.branch?.name && (
                    <div className="inline-flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1 rounded-xl border border-[#EDE4D5]">
                      <Building2 className="w-3.5 h-3.5 text-[#8C7361]" />
                      <span>{customer.branch.name}</span>
                    </div>
                  )}
                </div>

                {customer.notes && (
                  <p className="text-xs text-[#8C7361] pt-1 italic max-w-2xl bg-[#FAF6F0]/60 px-3 py-1.5 rounded-xl border border-[#EDE4D5]/60">
                    <span className="font-bold text-[#4A2E1B] not-italic mr-1.5">Note:</span>
                    {customer.notes}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Balance Spotlight */}
            <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 lg:min-w-[240px] text-center lg:text-right shrink-0">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#8C7361] block">
                Outstanding Balance
              </span>
              <div
                className={`text-2xl sm:text-3xl font-mono font-black mt-1 ${
                  isFullySettled ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {Number(customer.totalRemaining || 0).toFixed(2)}
                <span className="text-xs font-sans font-bold text-[#8C7361] ml-1">ETB</span>
              </div>
              <span className="text-[10px] text-[#8C7361] font-semibold mt-1 block">
                {isFullySettled ? "No pending debt" : "Total across all open credits"}
              </span>
            </div>
          </div>
        </div>

        {/* 4 Financial KPIs - Hidden on mobile */}
        <div className="hidden md:grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">{t("credits.totalCreditsCount") || "Total Credits"}</span>
              <FileText className="w-4 h-4 text-[#E87A18]" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-black text-[#2C1B10]">
              {customer.totalCredits}
            </div>
            <span className="text-[11px] text-[#8C7361] font-medium mt-1 block">Credit sales recorded</span>
          </div>

          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">{t("credits.totalBorrowed") || "Total Borrowed"}</span>
              <DollarSign className="w-4 h-4 text-[#E87A18]" />
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-[#2C1B10]">
              {Number(customer.totalBorrowed || 0).toFixed(2)}
              <span className="text-xs font-sans font-bold text-[#8C7361] ml-1">ETB</span>
            </div>
            <span className="text-[11px] text-[#8C7361] font-medium mt-1 block">Cumulative credit value</span>
          </div>

          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-emerald-800 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">{t("credits.totalPaid") || "Total Repaid"}</span>
              <TrendingDown className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-xl sm:text-2xl font-mono font-black text-emerald-700">
              {Number(customer.totalPaid || 0).toFixed(2)}
              <span className="text-xs font-sans font-bold text-[#8C7361] ml-1">ETB</span>
            </div>
            <span className="text-[11px] text-emerald-700/80 font-medium mt-1 block">Successfully collected</span>
          </div>

          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between text-[#8C7361] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">{t("credits.remainingBalance") || "Remaining Due"}</span>
              <CreditCard className="w-4 h-4 text-rose-600" />
            </div>
            <div
              className={`text-xl sm:text-2xl font-mono font-black ${
                isFullySettled ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {Number(customer.totalRemaining || 0).toFixed(2)}
              <span className="text-xs font-sans font-bold text-[#8C7361] ml-1">ETB</span>
            </div>
            <span className="text-[11px] text-[#8C7361] font-medium mt-1 block">Current outstanding</span>
          </div>
        </div>

        {/* Tab Switcher: Credit Sales vs Repayment History */}
        <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-2">
          <Button
            variant={activeTab === "CREDITS" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("CREDITS")}
            className={`rounded-xl font-bold text-xs h-9 px-4 transition-all ${
              activeTab === "CREDITS"
                ? "bg-[#2C1B10] text-white shadow-sm"
                : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF6F0]"
            }`}
          >
            <CreditCard className="w-3.5 h-3.5 mr-1.5" />
            Credit Invoices ({customer.credits?.length || 0})
          </Button>

          <Button
            variant={activeTab === "PAYMENTS" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("PAYMENTS")}
            className={`rounded-xl font-bold text-xs h-9 px-4 transition-all ${
              activeTab === "PAYMENTS"
                ? "bg-[#2C1B10] text-white shadow-sm"
                : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#FAF6F0]"
            }`}
          >
            <History className="w-3.5 h-3.5 mr-1.5" />
            Repayment History ({allPayments.length})
          </Button>
        </div>

        {/* TAB 1: CREDIT INVOICES LEDGER */}
        {activeTab === "CREDITS" && (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-3xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-[#FAF6F0]">
                  <TableRow className="border-b border-[#EDE4D5]">
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">{t("common.date") || "Date"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">Due Date</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">{t("credits.colItems") || "Items / Description"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right">{t("credits.colTotalAmount") || "Total (ETB)"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right">{t("credits.colPaidAmount") || "Paid (ETB)"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right">{t("credits.colRemaining") || "Remaining"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-center">{t("common.status") || "Status"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right pr-6">{t("common.actions") || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.credits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-[#8C7361] font-medium">
                        No credit sales recorded for this customer yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    customer.credits.map((cr) => {
                      const parsed = parseCreditDescription(cr.description);
                      const isPaid = cr.status === "PAID" || cr.remainingBalance <= 0.01;
                      return (
                        <TableRow key={cr.id} className="border-b border-[#EDE4D5]/60 hover:bg-[#FAF6F0]/50 transition-colors">
                          <TableCell className="font-mono text-xs font-bold text-[#2C1B10]">
                            {cr.date ? formatEthDate(cr.date) : "-"}
                          </TableCell>
                          <TableCell className="font-mono text-xs text-[#8C7361]">
                            {cr.dueDate ? formatEthDate(cr.dueDate) : "-"}
                          </TableCell>
                          <TableCell className="max-w-[260px]">
                            {parsed.items.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {parsed.items.map((it, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1 bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] px-2 py-0.5 rounded-lg text-[11px] font-medium"
                                  >
                                    <span className="font-bold text-[#E87A18]">{it.qty}x</span> {it.name}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[#8C7361] italic">{parsed.notes || "Standard Credit Sale"}</span>
                            )}
                            {parsed.items.length > 0 && parsed.notes && (
                              <span className="text-[10px] text-[#8C7361] italic block truncate mt-0.5">{parsed.notes}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-[#2C1B10]">
                            {Number(cr.amount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">
                            {Number(cr.paidAmount).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono font-black ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                  : "bg-rose-100 text-rose-800 border border-rose-300"
                              }`}
                            >
                              {Number(cr.remainingBalance).toFixed(2)} ETB
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                isPaid
                                  ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  : "bg-amber-100 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {isPaid ? "PAID" : "OPEN"}
                            </span>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isPaid && (
                                <Button
                                  size="sm"
                                  onClick={() => openPayModal(cr)}
                                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs h-8 px-2.5 rounded-xl shadow-2xs"
                                >
                                  <DollarSign className="w-3.5 h-3.5 mr-0.5" />
                                  {t("credits.payBtn") || "Settle"}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/customer-credits/${cr.id}`)}
                                className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2 rounded-xl"
                                title="View Credit Details"
                              >
                                <Eye className="w-3.5 h-3.5 text-[#E87A18]" />
                              </Button>
                              {canManage && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => router.push(`/customer-credits/new?edit=${cr.id}`)}
                                  className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2 rounded-xl"
                                  title="Edit Credit"
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

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {customer.credits.length === 0 ? (
                <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                  No credit sales recorded for this customer yet.
                </div>
              ) : (
                customer.credits.map((cr) => {
                  const parsed = parseCreditDescription(cr.description);
                  const isPaid = cr.status === "PAID" || cr.remainingBalance <= 0.01;
                  return (
                    <div key={cr.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2">
                        <div>
                          <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C1B10]">
                            <Calendar className="w-3.5 h-3.5 text-[#E87A18]" />
                            {cr.date ? formatEthDate(cr.date) : "-"}
                          </div>
                          {cr.dueDate && (
                            <span className="text-[10px] text-[#8C7361] block mt-0.5">
                              Due: {formatEthDate(cr.dueDate)}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              isPaid
                                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                                : "bg-amber-100 text-amber-800 border border-amber-200"
                            }`}
                          >
                            {isPaid ? "PAID" : "OPEN"}
                          </span>
                        </div>
                      </div>

                      {/* Products / Notes */}
                      {parsed.items.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {parsed.items.map((it, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] px-2 py-0.5 rounded-lg text-[10px] font-medium"
                            >
                              <span className="font-bold text-[#E87A18]">{it.qty}x</span> {it.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-[#8C7361] italic">{parsed.notes || "Standard Credit Sale"}</p>
                      )}

                      {/* Amounts Breakdown */}
                      <div className="grid grid-cols-3 gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-center">
                        <div>
                          <span className="text-[9px] font-bold uppercase text-[#8C7361] block">Total</span>
                          <span className="text-xs font-mono font-extrabold text-[#2C1B10]">
                            {Number(cr.amount).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-[#8C7361] block">Paid</span>
                          <span className="text-xs font-mono font-extrabold text-emerald-700">
                            {Number(cr.paidAmount).toFixed(2)}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold uppercase text-[#8C7361] block">Remaining</span>
                          <span
                            className={`text-xs font-mono font-extrabold ${
                              isPaid ? "text-emerald-700" : "text-rose-700"
                            }`}
                          >
                            {Number(cr.remainingBalance).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* Mobile Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#F4ECE1]">
                        {!isPaid && (
                          <Button
                            size="sm"
                            onClick={() => openPayModal(cr)}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs h-8 px-3 rounded-xl shadow-2xs"
                          >
                            <DollarSign className="w-3.5 h-3.5 mr-1" />
                            {t("credits.payBtn") || "Settle"}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/customer-credits/${cr.id}`)}
                          className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1 text-[#E87A18]" />
                          View
                        </Button>
                        {canManage && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/customer-credits/new?edit=${cr.id}`)}
                            className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-xl"
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1 text-[#8C7361]" />
                            {t("common.edit") || "Edit"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: REPAYMENT HISTORY LEDGER */}
        {activeTab === "PAYMENTS" && (
          <div className="space-y-4">
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-3xl overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-[#FAF6F0]">
                  <TableRow className="border-b border-[#EDE4D5]">
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">{t("common.date") || "Date"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">Related Invoice</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right">{t("credits.colPaidAmount") || "Amount Paid (ETB)"}</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B]">Notes / Reference</TableHead>
                    <TableHead className="font-bold text-xs text-[#4A2E1B] text-right pr-6">{t("common.actions") || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allPayments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12 text-[#8C7361] font-medium">
                        No repayments recorded yet for this customer.
                      </TableCell>
                    </TableRow>
                  ) : (
                    allPayments.map((p) => {
                      const payVal = Number(p.amount ?? p.amountPaid ?? 0);
                      return (
                        <TableRow key={p.id} className="border-b border-[#EDE4D5]/60 hover:bg-[#FAF6F0]/50 transition-colors">
                          <TableCell className="font-mono text-xs font-bold text-[#2C1B10]">
                            {formatEthDate(p.date || p.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs">
                            <span className="font-semibold text-[#4A2E1B]">Credit of {formatEthDate(p.creditDate)}</span>
                            <span className="text-[10px] text-[#8C7361] block font-mono">Total: {Number(p.creditTotal).toFixed(2)} ETB</span>
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-xs text-emerald-700">
                            +{payVal.toFixed(2)} ETB
                          </TableCell>
                          <TableCell className="text-xs text-[#8C7361]">
                            {p.note || p.description || "Direct Payment"}
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => router.push(`/customer-credits/${p.creditId}`)}
                              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-7 px-2.5 rounded-xl"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1 text-[#E87A18]" />
                              Invoice
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-3">
              {allPayments.length === 0 ? (
                <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 text-center text-[#8C7361] text-xs font-medium">
                  No repayments recorded yet for this customer.
                </div>
              ) : (
                allPayments.map((p) => {
                  const payVal = Number(p.amount ?? p.amountPaid ?? 0);
                  return (
                    <div key={p.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm space-y-2.5">
                      <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-[#2C1B10]">
                          <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                          {formatEthDate(p.date || p.createdAt)}
                        </div>
                        <span className="font-mono font-black text-sm text-emerald-700">
                          +{payVal.toFixed(2)} ETB
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#8C7361]">
                          Credit on {formatEthDate(p.creditDate)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/customer-credits/${p.creditId}`)}
                          className="h-7 text-xs px-2 rounded-lg border-[#EDE4D5] text-[#4A2E1B]"
                        >
                          <Eye className="w-3 h-3 mr-1 text-[#E87A18]" />
                          Invoice
                        </Button>
                      </div>

                      {(p.note || p.description) && (
                        <p className="text-[11px] text-[#8C7361] italic bg-[#FAF6F0] p-2 rounded-lg">
                          {p.note || p.description}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* MODAL 1: PAY CREDIT */}
        <Dialog open={!!payingCredit} onOpenChange={(open) => !open && setPayingCredit(null)}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-[#2C1B10] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                {t("credits.recordPaymentModalTitle") || "Settle / Record Credit Payment"}
              </DialogTitle>
            </DialogHeader>

            {payingCredit && (
              <form onSubmit={handlePaySubmit} className="space-y-4 pt-2">
                <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5] space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#8C7361] font-medium">Customer:</span>
                    <span className="font-bold text-[#2C1B10]">{customer.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C7361] font-medium">Credit Date:</span>
                    <span className="font-bold text-[#2C1B10]">{formatEthDate(payingCredit.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#8C7361] font-medium">Total Credit Value:</span>
                    <span className="font-mono font-bold text-[#2C1B10]">{Number(payingCredit.amount).toFixed(2)} ETB</span>
                  </div>
                  <div className="flex justify-between border-t border-[#EDE4D5] pt-1 mt-1">
                    <span className="text-[#8C7361] font-bold uppercase">Remaining Due:</span>
                    <span className="font-mono font-black text-rose-700 text-sm">
                      {Number(payingCredit.remainingBalance).toFixed(2)} ETB
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#2C1B10] uppercase">
                      {t("credits.paymentAmountLabel") || "Amount to Pay"} (ETB) <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setPaymentAmount(Number(payingCredit.remainingBalance).toFixed(2))}
                      className="text-[11px] font-bold text-[#E87A18] hover:underline"
                    >
                      Pay Full Balance
                    </button>
                  </div>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={Number(payingCredit.remainingBalance) + 0.01}
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="rounded-xl text-sm font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] uppercase block mb-1">
                    {t("common.date") || "Payment Date"} <span className="text-rose-500">*</span>
                  </label>
                  <AppDatePicker
                    required
                    value={paymentDate}
                    onChange={(val) => setPaymentDate(val)}
                    className="rounded-xl text-xs font-bold"
                  />
                </div>

                <DialogFooter className="pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setPayingCredit(null)}>
                    {t("common.cancel") || "Cancel"}
                  </Button>
                  <Button type="submit" loading={isSubmittingPay} className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold">
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Confirm Payment
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>

        {/* MODAL 2: EDIT CUSTOMER */}
        <Dialog open={isEditingCustomer} onOpenChange={(open) => !open && setIsEditingCustomer(false)}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-[#2C1B10] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#E87A18]" />
                {t("credits.editCustomerModalTitle") || "Edit Customer Profile"}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleCustomerEditSubmit} className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.fullNameLabel") || "Full Name"} <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  className="rounded-xl text-xs font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.phoneLabel") || "Phone Number"} <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="rounded-xl text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.addressLabel") || "Address / Cafe Location"}
                </label>
                <Input
                  value={editCustomerAddress}
                  onChange={(e) => setEditCustomerAddress(e.target.value)}
                  className="rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                  {t("credits.notesCardTitle") || "Notes / Terms"}
                </label>
                <textarea
                  rows={3}
                  value={editCustomerNotes}
                  onChange={(e) => setEditCustomerNotes(e.target.value)}
                  className="w-full border border-zinc-200 rounded-xl p-2.5 text-xs text-[#2C1B10] outline-none focus:ring-2 focus:ring-[#E87A18]/30 resize-none"
                />
              </div>

              <DialogFooter className="pt-2 gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditingCustomer(false)}>
                  {t("common.cancel") || "Cancel"}
                </Button>
                <Button type="submit" loading={isSubmittingCustomerEdit}>
                  {t("common.save") || "Save Profile"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* MODAL 3: EDIT CREDIT */}
        <Dialog open={!!editingCredit} onOpenChange={(open) => !open && setEditingCredit(null)}>
          <DialogContent className="sm:max-w-md bg-white rounded-3xl p-6">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-[#2C1B10] flex items-center gap-2">
                <Pencil className="w-5 h-5 text-[#E87A18]" />
                {t("credits.editCreditModalTitle") || "Edit Credit Transaction"}
              </DialogTitle>
            </DialogHeader>

            {editingCredit && (
              <form onSubmit={handleCreditEditSubmit} className="space-y-4 pt-2">
                <div className="p-3 bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl flex items-center justify-between gap-2">
                  <div className="text-xs text-[#4A2E1B]">
                    <span className="font-bold block">Need to edit items or quantities?</span>
                    <span className="text-[11px] text-[#8C7361]">Use the full credit editor to change products.</span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const cid = editingCredit.id;
                      setEditingCredit(null);
                      router.push(`/customer-credits/new?edit=${cid}`);
                    }}
                    className="border-[#DFCBB5] text-[#E87A18] hover:bg-white text-xs font-bold rounded-xl shrink-0"
                  >
                    Full Edit &rarr;
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                      {t("credits.colTotalAmount") || "Total Amount"} (ETB) <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      min={Math.max(0.01, Number(editingCredit.paidAmount))}
                      required
                      value={editCreditAmount}
                      onChange={(e) => setEditCreditAmount(e.target.value)}
                      className="rounded-xl text-xs font-mono font-bold"
                    />
                    {Number(editingCredit.paidAmount) > 0 && (
                      <span className="text-[10px] text-amber-700 block mt-0.5">
                        Min: {Number(editingCredit.paidAmount).toFixed(2)} ETB (already paid)
                      </span>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                      {t("common.date") || "Issue Date"} <span className="text-rose-500">*</span>
                    </label>
                    <AppDatePicker
                      required
                      value={editCreditDate}
                      onChange={(val) => setEditCreditDate(val)}
                      className="rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                    {t("credits.dueDateLabel") || "Due Date"}
                  </label>
                  <AppDatePicker
                    value={editCreditDueDate}
                    onChange={(val) => setEditCreditDueDate(val)}
                    className="rounded-xl text-xs font-bold"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] block uppercase mb-1">
                    {t("credits.notesCardTitle") || "Notes / Description"}
                  </label>
                  <textarea
                    rows={3}
                    value={editCreditDescription}
                    onChange={(e) => setEditCreditDescription(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl p-2.5 text-xs text-[#2C1B10] outline-none focus:ring-2 focus:ring-[#E87A18]/30 resize-none"
                  />
                </div>

                <DialogFooter className="pt-2 gap-2">
                  <Button type="button" variant="outline" onClick={() => setEditingCredit(null)}>
                    {t("common.cancel") || "Cancel"}
                  </Button>
                  <Button type="submit" loading={isSubmittingEditCredit}>
                    {t("common.save") || "Save Credit"}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
