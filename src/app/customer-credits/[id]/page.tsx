"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
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
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  Printer,
  Calendar,
  Phone,
  User,
  ShoppingBag,
  CheckCircle2,
  Clock,
  FileText,
  MapPin,
} from "lucide-react";

interface CreditPayment {
  id: string;
  amount?: number | string;
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
  type?: string;
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

function parseCustomerCreditStatement(
  rawDesc?: string | null,
  rawEntity?: string | null,
  customerObj?: CustomerInfo | null
) {
  const customerName = customerObj?.fullName || "";
  const customerPhone = customerObj?.phone || "";
  const customerAddress = customerObj?.address || "";

  let remaining = rawDesc || rawEntity || "";
  let itemsFromStructured: Array<{ raw: string; qty: string; name: string; unitPrice: string; total: string }> = [];

  // 1. Extract [CreditItems: [...]] if present
  const creditItemsMatch = remaining.match(/\[CreditItems:\s*(\[.*?\])\s*\]/);
  if (creditItemsMatch) {
    try {
      const parsedList = JSON.parse(creditItemsMatch[1]);
      if (Array.isArray(parsedList)) {
        itemsFromStructured = parsedList.map((it: any) => {
          const qty = it.quantity != null ? String(it.quantity) : "1";
          const pName = it.productName || "Product";
          const uPrice = it.unitPrice != null ? Number(it.unitPrice).toFixed(2) : "-";
          const totalVal = (Number(qty) * Number(it.unitPrice || 0)).toFixed(2);
          return {
            raw: `${qty}x ${pName}`,
            qty,
            name: pName,
            unitPrice: uPrice !== "-" ? `${uPrice} ETB` : "-",
            total: `${totalVal} ETB`,
          };
        });
      }
    } catch {}
    remaining = remaining.replace(/\[CreditItems:\s*\[.*?\]\s*\]/g, "").trim();
  }

  // 2. Extract [Products: ...] if present
  let productsPart = "";
  const prodMatch = remaining.match(/\[Products:\s*(.*?)\]/);
  if (prodMatch) {
    productsPart = prodMatch[1];
    remaining = remaining.replace(/\[Products:.*?\]/g, "").trim();
  }

  // 3. Extract human notes: split by " - "
  let notesPart = "";
  const parts = remaining.split(/\s+-\s+/);
  let namePart = customerName || parts[0] || "";
  if (parts.length > 1) {
    notesPart = parts.slice(1).join(" - ").trim();
  }

  notesPart = notesPart
    .replace(/\[CreditItems:.*?\]/g, "")
    .replace(/\[Products:.*?\]/g, "")
    .replace(/^-\s*|\s*-$/g, "")
    .trim();

  namePart = namePart.replace(/^-\s*|\s*-$/g, "").trim();

  let phone = customerPhone;
  const phoneMatch = namePart.match(/\((.*?)\)/);
  if (phoneMatch && !phone) {
    phone = phoneMatch[1].trim();
    namePart = namePart.replace(/\(.*?\)/, "").trim();
  }

  const items =
    itemsFromStructured.length > 0
      ? itemsFromStructured
      : productsPart
      ? productsPart.split(/,\s*/).map((itemStr) => {
          const cleaned = itemStr.trim();
          const itemMatch = cleaned.match(
            /^(?:(\d+(?:\.\d+)?)x\s+)?(.*?)(?:\s+@\s+(\d+(?:\.\d+)?)\s*ETB)?(?:\s*\(([\d\.]+)\s*ETB\))?$/
          );
          if (itemMatch) {
            return {
              raw: cleaned,
              qty: itemMatch[1] || "1",
              name: itemMatch[2] || cleaned,
              unitPrice: itemMatch[3] ? `${itemMatch[3]} ETB` : "-",
              total: itemMatch[4] ? `${itemMatch[4]} ETB` : "-",
            };
          }
          return { raw: cleaned, qty: "1", name: cleaned, unitPrice: "-", total: "-" };
        })
      : [];

  return {
    name: customerName || namePart || "Customer / Cafe",
    phone,
    address: customerAddress,
    items,
    notes: notesPart,
  };
}

export default function CustomerCreditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  const [credit, setCredit] = useState<CustomerCredit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCreditDetail();
  }, [resolvedParams.id]);

  const fetchCreditDetail = async () => {
    setIsLoading(true);
    try {
      try {
        const res = await api.get(`/customers/credits/${resolvedParams.id}`);
        setCredit(res.data);
      } catch {
        const res = await api.get(`/loans/${resolvedParams.id}`);
        setCredit(res.data);
      }
      setAmountPaid("");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load customer credit details");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credit || !amountPaid) return;

    const payNum = Number(amountPaid);
    if (payNum <= 0) {
      toast.error(t("credits.toastEnterValidPayment"));
      return;
    }

    setIsSubmitting(true);
    try {
      try {
        await api.post(`/customers/credits/${credit.id}/pay`, {
          amount: payNum,
          date: paymentDate,
        });
      } catch {
        await api.post(`/loans/${credit.id}/pay`, {
          amountPaid: payNum,
          date: paymentDate,
        });
      }

      toast.success(t("credits.toastPaymentSuccess"));
      setIsPayModalOpen(false);
      fetchCreditDetail();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-[#8C7361] font-semibold">
          {t("credits.loadingStatement")}
        </div>
      </DashboardLayout>
    );
  }

  if (!credit) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-red-600 font-semibold space-y-3">
          <p>{t("credits.creditNotFound")}</p>
          <Button onClick={() => router.push("/customer-credits")} variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> {t("credits.backToCredits")}
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const parsed = parseCustomerCreditStatement(credit.description, credit.entityId, credit.customer);
  const totalAmount = Number(credit.amount ?? credit.totalAmount ?? 0);
  const remainingBalance = Number(credit.remainingBalance || 0);
  const totalPaid = Math.max(0, totalAmount - remainingBalance);
  const isSettled = credit.status === "PAID" || remainingBalance <= 0.01;

  // Compute running balances for payment ledger
  let runningBalance = totalAmount;
  const paymentsSorted = [...(credit.payments || [])].sort(
    (a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()
  );
  const paymentLedger = paymentsSorted.map((p) => {
    const paidAmt = Number(p.amount ?? p.amountPaid ?? 0);
    runningBalance = Math.max(0, runningBalance - paidAmt);
    return { ...p, paidAmt, balanceAfter: runningBalance };
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-5 sm:space-y-6 min-w-0">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 print:hidden">
          <Button
            variant="ghost"
            onClick={() => router.push("/customer-credits")}
            className="text-[#8C7361] hover:bg-[#F4ECE1] rounded-xl w-fit flex items-center gap-1.5 -ml-2 h-9 px-2.5 font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> {t("credits.backToCredits")}
          </Button>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs sm:text-sm h-10 sm:h-9 flex items-center justify-center gap-1.5 w-full sm:w-auto"
            >
              <Printer className="w-4 h-4" /> {t("credits.printStatement")}
            </Button>

            {!isSettled && canManage && (
              <Button
                onClick={() => setIsPayModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm h-10 sm:h-9 shadow-xs flex items-center justify-center gap-1.5 w-full sm:w-auto whitespace-nowrap"
              >
                <DollarSign className="w-4 h-4" /> {t("credits.recordPaymentBtn")}
              </Button>
            )}
          </div>
        </div>

        {/* Printable Customer Credit Statement Card */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl sm:rounded-3xl p-4 sm:p-8 shadow-sm space-y-5 sm:space-y-6 print:border-none print:shadow-none overflow-hidden max-w-full">
          {/* Header & Status Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#EDE4D5] pb-4 sm:pb-6 gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-[#E87A18] shrink-0" />
                <h1 className="text-lg sm:text-2xl font-black text-[#2C1B10] tracking-tight">
                  {t("credits.statementTitle")}
                </h1>
              </div>
              <p className="text-xs text-[#8C7361] break-all">
                {t("credits.recordReferenceId")} <strong className="font-mono text-[#2C1B10]">{credit.id}</strong>
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <span
                className={`px-3.5 py-1.5 rounded-full text-xs font-black tracking-wider border ${
                  isSettled
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-900 border-amber-300"
                }`}
              >
                {isSettled ? t("credits.badgeFullySettled") : t("credits.badgeOutstanding")}
              </span>
            </div>
          </div>

          {/* Customer & Credit Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 bg-[#FAF6F0] p-4 sm:p-5 rounded-2xl border border-[#EDE4D5] overflow-hidden min-w-0">
            <div className="space-y-1.5 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#8C7361] block">
                {t("credits.customerDetails")}
              </span>
              <div className="flex items-center gap-2 text-[#2C1B10] font-extrabold text-base sm:text-lg min-w-0">
                <User className="w-4 h-4 sm:w-5 sm:h-5 text-[#E87A18] shrink-0" />
                <span className="truncate">{parsed.name}</span>
              </div>
              {parsed.phone && (
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B]">
                  <Phone className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                  <a href={`tel:${parsed.phone}`} className="hover:underline text-[#E87A18]">
                    {parsed.phone}
                  </a>
                </div>
              )}
              {parsed.address && (
                <div className="flex items-center gap-2 text-xs font-medium text-[#8C7361]">
                  <MapPin className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                  <span>{parsed.address}</span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-[#8C7361] block">
                {t("credits.issueDateAndNotes")}
              </span>
              <div className="flex items-center gap-2 text-[#2C1B10] font-bold text-xs sm:text-sm">
                <Calendar className="w-4 h-4 text-[#E87A18] shrink-0" />
                <span>
                  {t("credits.issuedDateLabel")}{" "}
                  {credit.date
                    ? format(new Date(credit.date), "MMMM d, yyyy")
                    : format(new Date(credit.createdAt), "MMMM d, yyyy")}
                </span>
              </div>
              {parsed.notes && (
                <div className="flex items-start gap-2 text-xs text-[#8C7361] italic min-w-0 max-w-full overflow-hidden">
                  <FileText className="w-3.5 h-3.5 text-[#8C7361] shrink-0 mt-0.5" />
                  <span className="break-all break-words [overflow-wrap:anywhere] min-w-0">
                    {t("credits.noteLabel")} {parsed.notes}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-4">
              <span className="text-[11px] sm:text-xs font-bold uppercase text-[#8C7361] block">
                {t("credits.totalProductCredit")}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] mt-1 block font-mono">
                {totalAmount.toFixed(2)} ETB
              </span>
            </div>

            <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4">
              <span className="text-[11px] sm:text-xs font-bold uppercase text-emerald-800 block">
                {t("credits.totalSettlementPaid")}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
                {totalPaid.toFixed(2)} ETB
              </span>
            </div>

            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4">
              <span className="text-[11px] sm:text-xs font-bold uppercase text-rose-800 block">
                {t("credits.remainingBalanceDue")}
              </span>
              <span className="text-xl sm:text-2xl font-extrabold text-rose-700 mt-1 block font-mono">
                {remainingBalance.toFixed(2)} ETB
              </span>
            </div>
          </div>

          {/* Product Items Breakdown */}
          <div className="space-y-3">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
              <span>{t("credits.productsTakenOnCredit")}</span>
            </h3>

            {parsed.items.length > 0 ? (
              <>
                {/* Mobile Touch Cards (< md) */}
                <div className="space-y-2 block md:hidden">
                  {parsed.items.map((item, idx) => (
                    <div key={idx} className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] space-y-1.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-extrabold text-xs text-[#2C1B10]">{item.name}</span>
                        <span className="font-mono font-extrabold text-xs text-[#2C1B10]">{item.total}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#8C7361] pt-1 border-t border-[#EDE4D5]/60">
                        <span>
                          {t("common.quantity")}: <strong className="font-mono text-[#4A2E1B]">{item.qty}</strong>
                        </span>
                        <span>
                          {t("common.price")}: <span className="font-mono text-[#4A2E1B]">{item.unitPrice}</span>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead className="font-extrabold text-[#4A2E1B]">{t("credits.colProductItem")}</TableHead>
                        <TableHead className="text-center font-extrabold text-[#4A2E1B]">{t("common.quantity")}</TableHead>
                        <TableHead className="text-right font-extrabold text-[#4A2E1B]">{t("common.price")}</TableHead>
                        <TableHead className="text-right font-extrabold text-[#4A2E1B]">{t("credits.colLineTotal")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.items.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-bold text-[#2C1B10]">{item.name}</TableCell>
                          <TableCell className="text-center font-mono font-bold">{item.qty}</TableCell>
                          <TableCell className="text-right font-mono text-[#8C7361]">{item.unitPrice}</TableCell>
                          <TableCell className="text-right font-mono font-extrabold text-[#2C1B10]">{item.total}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="bg-[#FAF6F0] p-4 rounded-xl text-xs text-[#8C7361] italic text-center border border-[#EDE4D5]">
                {t("credits.generalCreditTotal").replace("{total}", totalAmount.toFixed(2))}
              </div>
            )}
          </div>

          {/* Repayment Settlement History Ledger */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs sm:text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              <span>{t("credits.repaymentLedgerTitle")}</span>
            </h3>

            {paymentLedger.length > 0 ? (
              <>
                {/* Mobile Touch Cards (< md) */}
                <div className="space-y-2 block md:hidden">
                  {paymentLedger.map((p) => (
                    <div key={p.id} className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[#2C1B10]">
                          {format(new Date(p.date || p.createdAt), "MMM d, yyyy")}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" /> {t("credits.badgeReceived")}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#EDE4D5]">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-[#8C7361] block">
                            {t("credits.paidAmountCol")}
                          </span>
                          <span className="font-mono font-extrabold text-emerald-700">-{p.paidAmt.toFixed(2)} ETB</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] uppercase font-bold text-[#8C7361] block">
                            {t("credits.remainingBalanceAfter")}
                          </span>
                          <span className="font-mono font-bold text-[#4A2E1B]">{p.balanceAfter.toFixed(2)} ETB</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table (>= md) */}
                <div className="hidden md:block border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
                  <Table>
                    <TableHeader className="bg-[#FAF6F0]">
                      <TableRow>
                        <TableHead className="font-extrabold text-[#4A2E1B]">{t("credits.paymentDateCol")}</TableHead>
                        <TableHead className="text-right font-extrabold text-emerald-800">
                          {t("credits.paidAmountCol")}
                        </TableHead>
                        <TableHead className="text-right font-extrabold text-[#4A2E1B]">
                          {t("credits.remainingBalanceAfter")}
                        </TableHead>
                        <TableHead className="text-center font-extrabold text-[#4A2E1B]">{t("common.status")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentLedger.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-bold text-[#2C1B10] text-xs">
                            {format(new Date(p.date || p.createdAt), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-right font-mono font-extrabold text-emerald-700">
                            -{p.paidAmt.toFixed(2)} ETB
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-[#4A2E1B]">
                            {p.balanceAfter.toFixed(2)} ETB
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                              <CheckCircle2 className="w-3 h-3" /> {t("credits.badgeReceived")}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="bg-[#FAF6F0] p-4 rounded-xl text-xs text-[#8C7361] italic text-center border border-[#EDE4D5]">
                {t("credits.noPaymentsLogged")}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isPayModalOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsPayModalOpen(false); }}>
          <DialogContent className="max-w-md rounded-2xl p-5 sm:p-6">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>{t("credits.recordPaymentBtn")}</span>
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePay} className="space-y-4 mt-2">
              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] text-xs space-y-1">
                <div className="font-extrabold text-[#2C1B10] text-sm">{parsed.name}</div>
                {parsed.phone && <div className="text-[#8C7361] text-xs">📞 {parsed.phone}</div>}
                <div className="flex justify-between text-[#8C7361] font-mono pt-1 border-t border-[#EDE4D5] mt-1">
                  <span>{t("credits.totalLoanLabel")} {totalAmount.toFixed(2)} ETB</span>
                  <span className="font-bold text-rose-700">{t("credits.remainingLabel")} {remainingBalance.toFixed(2)} ETB</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">{t("credits.amountPaidLabel")}</label>
                <Input
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  max={remainingBalance}
                  value={amountPaid}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="0.00"
                  className="rounded-xl border-[#EDE4D5] font-mono font-bold text-base h-11"
                />
                <p className="text-[11px] text-[#8C7361] mt-1">
                  {t("credits.enterPaymentHelp").replace("{max}", remainingBalance.toFixed(2))}
                </p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">{t("credits.paymentDateLabel")}</label>
                <Input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="rounded-xl border-[#EDE4D5] h-10"
                />
              </div>

              <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)} className="rounded-xl h-10 w-full sm:w-auto font-bold border-[#EDE4D5]">
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 w-full sm:w-auto">
                  {isSubmitting ? t("credits.processing") : t("credits.recordSettlementBtn")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
