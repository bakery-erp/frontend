"use client";

import { useEffect, useState, useCallback } from "react";
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
import { Plus, CreditCard, DollarSign, Trash2, RefreshCw, ShoppingBag, X, Eye, AlertTriangle } from "lucide-react";

interface LoanPayment {
  id: string;
  amountPaid: number;
  date: string;
  createdAt: string;
}

interface CustomerCredit {
  id: string;
  branchId: string;
  type: string;
  entityId: string | null;
  totalAmount: number;
  remainingBalance: number;
  status: "OPEN" | "PAID";
  date: string;
  createdAt: string;
  payments: LoanPayment[];
}

interface Product {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
  availableStock?: number;
}

interface ProductLineItem {
  productId: string;
  quantity: number | string;
  unitPrice: number;
}

function parseCustomerCreditEntity(raw: string) {
  if (!raw) return { name: "Client / Cafe", phone: "", items: [], notes: "" };

  let namePart = raw;
  // Clean out structured [CreditItems: [...]]
  namePart = namePart.replace(/\[CreditItems:\s*\[.*?\]\s*\]/g, "").trim();

  let productsPart = "";
  let notesPart = "";

  const prodMatch = namePart.match(/\[Products:\s*(.*?)\]/);
  if (prodMatch) {
    productsPart = prodMatch[1];
    namePart = namePart.replace(/\[Products:.*?\]/, "").trim();
  }

  const parts = namePart.split(/\s+-\s+/);
  if (parts.length > 1) {
    namePart = parts[0].trim();
    notesPart = parts.slice(1).join(" - ").trim();
  }

  namePart = namePart.replace(/^-\s*|\s*-$/g, "").trim();

  let phone = "";
  const phoneMatch = namePart.match(/\((.*?)\)/);
  if (phoneMatch) {
    phone = phoneMatch[1];
    namePart = namePart.replace(/\(.*?\)/, "").trim();
  }

  const items = productsPart
    ? productsPart.split(/,\s*/).map((itemStr) => itemStr.trim()).filter(Boolean)
    : [];

  return {
    name: namePart || "Customer / Cafe",
    phone,
    items,
    notes: notesPart,
  };
}

export default function CustomerCreditsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Quick Filter States
  const [filterTodayOnly, setFilterTodayOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [payingCredit, setPayingCredit] = useState<CustomerCredit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lineItems, setLineItems] = useState<ProductLineItem[]>([]);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [creditDate, setCreditDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Pay Form State
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `&branchId=${selectedBranchId}` : "";
      const branchParam = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const [resCredits, resProducts] = await Promise.all([
        api.get(`/loans?type=CUSTOMER${branchQuery}`),
        api.get(`/daily-sessions/active/available-products${branchParam}`),
      ]);
      setCredits(resCredits.data);
      const availData = resProducts.data;
      if (availData && availData.hasActiveSession) {
        setHasActiveSession(true);
        setProducts(availData.products || []);
      } else {
        setHasActiveSession(false);
        setProducts(availData?.products || []);
      }
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

  // Calculate Auto Total Birr from Product Line Items
  const calculatedBirrTotal = lineItems.reduce(
    (sum, item) => sum + (Number(item.quantity || 0) * Number(item.unitPrice || 0)),
    0
  );

  const effectiveTotalBirr = customTotalAmount !== "" ? Number(customTotalAmount) : calculatedBirrTotal;

  // Stock over-limit check
  const hasOverStockError = lineItems.some((item) => {
    const prod = products.find((p) => p.id === item.productId);
    const qty = Number(item.quantity || 0);
    return prod && prod.availableStock != null ? qty > prod.availableStock || qty <= 0 : false;
  });

  const resetAddForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setLineItems([]);
    setCustomTotalAmount("");
    setNotes("");
    setCreditDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleAddLineItem = () => {
    const inStockProd = products.find((p) => (p.availableStock ?? 0) > 0) || products[0];
    if (!inStockProd) {
      toast.error("No products available to select.");
      return;
    }
    setLineItems((prev) => [
      ...prev,
      { productId: inStockProd.id, quantity: "", unitPrice: Number(inStockProd.basePrice || 0) },
    ]);
  };

  const handleRemoveLineItem = (index: number) => {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleLineItemChange = (index: number, field: keyof ProductLineItem, value: any) => {
    setLineItems((prev) => {
      const updated = [...prev];
      if (field === "productId") {
        const prod = products.find((p) => p.id === value);
        updated[index] = {
          ...updated[index],
          productId: value,
          unitPrice: prod ? Number(prod.basePrice || 0) : updated[index].unitPrice,
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value,
        };
      }
      return updated;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (hasActiveSession === false) {
      toast.error("Cannot log credit: No active daily session is open for this branch. Please open a session first.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Customer or Business name is required");
      return;
    }
    if (lineItems.length === 0) {
      toast.error("Please add at least one product item to lend on credit");
      return;
    }

    // Validate quantities against in-shop stock
    for (const item of lineItems) {
      const prod = products.find((p) => p.id === item.productId);
      const qty = Number(item.quantity || 0);
      if (qty <= 0) {
        toast.error(`Please enter a valid quantity greater than 0 for ${prod?.name || "all items"}`);
        return;
      }
      if (prod && prod.availableStock != null && qty > prod.availableStock) {
        toast.error(`Cannot lend ${qty} of "${prod.name}". Only ${prod.availableStock} ${prod.unitType} available in shop.`);
        return;
      }
    }

    if (effectiveTotalBirr <= 0) {
      toast.error("Total credit amount in Birr must be greater than zero");
      return;
    }

    // Build Product Summary String for notes
    let productSummary = "";
    if (lineItems.length > 0) {
      const itemSummaries = lineItems.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const name = prod ? prod.name : "Product";
        const itemTotal = Number(item.quantity) * Number(item.unitPrice);
        return `${item.quantity}x ${name} @ ${item.unitPrice} ETB (${itemTotal.toFixed(2)} ETB)`;
      });
      productSummary = `[Products: ${itemSummaries.join(", ")}]`;
    }

    const finalNotes = [productSummary, notes.trim()].filter(Boolean).join(" - ");

    const itemsPayload = lineItems.map((item) => {
      const prod = products.find((p) => p.id === item.productId);
      return {
        productId: item.productId,
        productName: prod ? prod.name : "Product",
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
      };
    });

    setIsSubmitting(true);
    try {
      await api.post("/loans", {
        type: "CUSTOMER_CREDIT",
        branchId: selectedBranchId || undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        notes: finalNotes || undefined,
        totalAmount: effectiveTotalBirr,
        date: creditDate,
        items: itemsPayload,
      });
      toast.success("Customer credit logged successfully");
      setIsAddOpen(false);
      resetAddForm();
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to log customer credit");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingCredit || !amountPaid) return;

    const payNum = Number(amountPaid);
    if (payNum <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/loans/${payingCredit.id}/pay`, {
        amountPaid: payNum,
        date: paymentDate,
      });
      toast.success("Repayment recorded successfully");
      setPayingCredit(null);
      setAmountPaid("");
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to record payment");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this customer credit record?")) return;
    try {
      await api.delete(`/loans/${id}`);
      toast.success("Customer credit record deleted");
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to delete credit record");
    }
  };

  // Metrics
  const totalCreditGiven = credits.reduce((acc, c) => acc + Number(c.totalAmount || 0), 0);
  const totalOutstanding = credits.reduce((acc, c) => acc + Number(c.remainingBalance || 0), 0);
  const totalRepaid = totalCreditGiven - totalOutstanding;

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
            <CreditCard className="w-7 h-7 text-[#E87A18]" />
            {t('credits.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            {t('credits.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> {t('common.refresh')}
          </Button>
          {canManage && (
            <Button
              onClick={() => router.push("/customer-credits/new")}
              className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> {t('credits.newCredit')}
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-[#8C7361] block">{t('credits.colTotalAmount')}</span>
          <span className="text-2xl font-extrabold text-[#2C1B10] mt-1 block font-mono">
            {totalCreditGiven.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
          </span>
        </div>
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm bg-emerald-50/30">
          <span className="text-xs font-bold uppercase text-emerald-800 block">{t('dashboard.creditReceivedLoans')}</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
            {totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
          </span>
        </div>
        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm bg-rose-50/30">
          <span className="text-xs font-bold uppercase text-rose-800 block">{t('credits.colRemaining')}</span>
          <span className="text-2xl font-extrabold text-rose-700 mt-1 block font-mono">
            {totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
          </span>
        </div>
      </div>

      {/* Filter Bar with Today Button */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={filterTodayOnly ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterTodayOnly(!filterTodayOnly)}
            className={`rounded-xl text-xs font-bold ${
              filterTodayOnly ? "bg-[#4A2E1B] text-white" : "border-[#EDE4D5] text-[#4A2E1B]"
            }`}
          >
            📅 {filterTodayOnly ? t('credits.filterToday') : t('credits.filterAll')}
          </Button>
        </div>

        <Input
          placeholder={t('credits.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:w-64 rounded-xl border-zinc-200 text-xs h-9"
        />
      </div>

      {/* Credit Table */}
      {(() => {
        const todayYmd = new Date().toISOString().slice(0, 10);
        const filteredCredits = credits.filter((c) => {
          if (filterTodayOnly) {
            const creditDate = (c.date || c.createdAt || "").slice(0, 10);
            if (creditDate !== todayYmd) return false;
          }
          if (searchQuery) {
            const q = searchQuery.toLowerCase();
            if (!(c.entityId || "").toLowerCase().includes(q)) return false;
          }
          return true;
        });

        return (
          <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('common.date')}</TableHead>
                  <TableHead>{t('credits.colCustomer')}</TableHead>
                  <TableHead>{t('credits.colProducts')}</TableHead>
                  <TableHead className="text-right">{t('credits.colTotalAmount')}</TableHead>
                  <TableHead className="text-right">{t('credits.colRemaining')}</TableHead>
                  <TableHead className="text-center">{t('credits.colStatus')}</TableHead>
                  <TableHead>{t('reports.dailyBreakdownTitle')}</TableHead>
                  <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
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
                    const parsed = parseCustomerCreditEntity(c.entityId || "");
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
                              {parsed.items.slice(0, 2).map((itemStr, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] leading-tight"
                                >
                                  {itemStr}
                                </span>
                              ))}
                              {parsed.items.length > 2 && (
                                <span className="px-1.5 py-0.5 rounded-md text-[10px] font-extrabold bg-[#4A2E1B] text-white">
                                  +{parsed.items.length - 2} more
                                </span>
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
                          {Number(c.totalAmount).toFixed(2)} ETB
                        </TableCell>

                        <TableCell className="text-right font-extrabold text-rose-700 font-mono text-xs">
                          {Number(c.remainingBalance).toFixed(2)} ETB
                        </TableCell>

                        <TableCell className="text-center">
                          {c.status === "PAID" || Number(c.remainingBalance) <= 0.01 ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ {t('credits.statusPaid')}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                              {t('credits.statusOpen')}
                            </span>
                          )}
                        </TableCell>

                        <TableCell>
                          {c.payments && c.payments.length > 0 ? (
                            <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                              {c.payments.map((p) => (
                                <div key={p.id} className="text-[11px] bg-[#FAF6F0] px-2 py-0.5 rounded border border-[#EDE4D5] flex justify-between font-mono">
                                  <span className="text-[#8C7361]">{format(new Date(p.date || p.createdAt), "MMM d")}</span>
                                  <span className="font-bold text-emerald-700">-{Number(p.amountPaid).toFixed(2)} ETB</span>
                                </div>
                              ))}
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
                              <Eye className="w-3.5 h-3.5" /> {t('common.details')}
                            </Button>
                            {Number(c.remainingBalance) > 0.01 && canManage && (
                              <Button
                                size="sm"
                                onClick={() => { setPayingCredit(c); setAmountPaid(String(c.remainingBalance)); }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                              >
                                <DollarSign className="w-3.5 h-3.5" /> {t('credits.btnPay')}
                              </Button>
                            )}
                            {user?.role === "OWNER" || user?.role === "ADMIN" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(c.id)}
                                className="text-rose-600 hover:bg-rose-50 font-bold text-xs h-8 px-2 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            ) : null}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        );
      })()}

      {/* CREATE PRODUCT CREDIT MODAL */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
          <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#E87A18]" />
                Issue Product Credit to Customer / Cafe
              </DialogTitle>
            </DialogHeader>

            {hasActiveSession === false && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 flex items-start gap-2.5 text-xs text-amber-900 mt-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-extrabold block">No Active Daily Session Open</span>
                  <span className="text-amber-700 text-[11px]">
                    Products cannot be lent on credit without an open daily session. Please open a daily session for this branch first.
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Customer / Cafe Name</label>
                  <Input
                    required
                    placeholder="e.g. Abyssinia Cafe / Central Hotel"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="rounded-xl border-zinc-200"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Phone Number</label>
                  <Input
                    placeholder="e.g. 0911223344"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="rounded-xl border-zinc-200"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Credit Date</label>
                <Input
                  type="date"
                  required
                  value={creditDate}
                  onChange={(e) => setCreditDate(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>

              {/* PRODUCTS LIST SELECTION */}
              <div className="border border-[#EDE4D5] rounded-xl p-3.5 bg-[#FAF6F0]/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-[#4A2E1B] flex items-center gap-1.5">
                    <ShoppingBag className="w-4 h-4 text-[#E87A18]" /> Products Taken on Credit
                  </span>
                  <Button
                    type="button"
                    onClick={handleAddLineItem}
                    disabled={hasActiveSession === false || products.length === 0}
                    size="sm"
                    className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white text-xs font-bold h-7 px-2.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product Line
                  </Button>
                </div>

                {lineItems.length === 0 ? (
                  <p className="text-xs text-[#8C7361] italic text-center py-2">
                    No products added yet. Click &quot;Add Product Line&quot; to select items taken on credit.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {lineItems.map((item, idx) => {
                      const selectedProd = products.find((p) => p.id === item.productId);
                      const isOverStock = selectedProd && selectedProd.availableStock != null
                        ? Number(item.quantity || 0) > selectedProd.availableStock
                        : false;
                      const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);

                      return (
                        <div
                          key={idx}
                          className={`p-2 rounded-xl border transition-all ${
                            isOverStock
                              ? "bg-rose-50 border-rose-300"
                              : "bg-white border-[#EDE4D5]"
                          } flex flex-col sm:flex-row sm:items-center gap-2`}
                        >
                          <div className="flex-1">
                            <select
                              value={item.productId}
                              onChange={(e) => handleLineItemChange(idx, "productId", e.target.value)}
                              className="w-full text-xs font-bold border border-zinc-200 rounded-lg h-9 px-2 bg-white text-[#2C1B10]"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name} ({p.availableStock ?? 0} {p.unitType} in shop) - {Number(p.basePrice).toFixed(2)} ETB {p.availableStock != null && p.availableStock <= 0 ? " [OUT OF STOCK]" : ""}
                                </option>
                              ))}
                            </select>
                            {selectedProd && (
                              <div className="flex items-center gap-1.5 mt-1 px-1">
                                <span className="text-[10px] font-bold text-[#8C7361]">In Shop:</span>
                                <span
                                  className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-md ${
                                    (selectedProd.availableStock ?? 0) > 5
                                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                      : (selectedProd.availableStock ?? 0) > 0
                                      ? "bg-amber-50 text-amber-700 border border-amber-200"
                                      : "bg-rose-50 text-rose-700 border border-rose-200"
                                  }`}
                                >
                                  {selectedProd.availableStock ?? 0} {selectedProd.unitType}
                                </span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <div className="w-20">
                              <Input
                                type="number"
                                min="1"
                                max={selectedProd?.availableStock ?? undefined}
                                value={item.quantity}
                                onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                                placeholder="Qty"
                                className={`text-xs h-9 font-bold text-center font-mono ${
                                  isOverStock ? "border-rose-500 ring-2 ring-rose-200 text-rose-700" : ""
                                }`}
                              />
                              {isOverStock && selectedProd && (
                                <p className="text-[9px] font-extrabold text-rose-600 mt-0.5 text-center leading-tight">
                                  Max: {selectedProd.availableStock}
                                </p>
                              )}
                            </div>

                            {/* Editable Unit Price / Amount Input */}
                            <div className="w-24">
                              <Input
                                type="number"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                                placeholder="Amount"
                                className="text-xs h-9 font-bold text-center font-mono"
                              />
                            </div>

                            <div className="text-xs font-extrabold text-[#E87A18] font-mono w-24 text-right pr-1">
                              = {itemSubtotal.toFixed(2)} ETB
                            </div>

                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveLineItem(idx)}
                              className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50 rounded-lg"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BIRR TOTAL CALCULATION DISPLAY */}
              <div className="bg-[#4A2E1B] text-white p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-amber-200 block uppercase">Calculated Total Credit (Birr)</span>
                  <span className="text-[11px] text-zinc-300">
                    Sum of products: {calculatedBirrTotal.toFixed(2)} ETB
                  </span>
                </div>
                <div className="w-36">
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={customTotalAmount !== "" ? customTotalAmount : (calculatedBirrTotal > 0 ? String(calculatedBirrTotal) : "")}
                    onChange={(e) => setCustomTotalAmount(e.target.value)}
                    placeholder="Total Birr"
                    className="bg-white text-[#2C1B10] font-extrabold text-base font-mono h-10 text-right rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Additional Notes / Delivery Details</label>
                <Input
                  placeholder="e.g. Delivered by morning truck shift"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || hasActiveSession === false || hasOverStockError || lineItems.length === 0}
                  className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Log Product Credit"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* PAY / SETTLEMENT MODAL */}
      {payingCredit && (() => {
        const parsedModal = parseCustomerCreditEntity(payingCredit.entityId || "");
        return (
          <Dialog open={true} onOpenChange={(open) => { if (!open) setPayingCredit(null); }}>
            <DialogContent className="max-w-md rounded-2xl">
              <DialogHeader>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                  {t('credits.modalPayTitle')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handlePay} className="space-y-3.5 mt-2">
                <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] text-xs space-y-1">
                  <div className="font-extrabold text-[#2C1B10] text-sm">{parsedModal.name}</div>
                  {parsedModal.phone && (
                    <div className="text-[#8C7361] font-medium text-xs">📞 {parsedModal.phone}</div>
                  )}
                  <div className="flex justify-between text-[#8C7361] font-mono pt-1 border-t border-[#EDE4D5] mt-1">
                    <span>{t('credits.colTotalAmount')}: {Number(payingCredit.totalAmount).toFixed(2)} ETB</span>
                    <span className="font-bold text-rose-700">{t('credits.colRemaining')}: {Number(payingCredit.remainingBalance).toFixed(2)} ETB</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('credits.amountPaidLabel')}</label>
                  <Input
                    type="number"
                    step="any"
                    required
                    min="0.01"
                    max={Number(payingCredit.remainingBalance)}
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder="Enter amount..."
                    className="rounded-xl border-zinc-200 font-mono font-bold text-base h-11"
                  />
                  <p className="text-[11px] text-[#8C7361] mt-1">Enter any integer or decimal amount (e.g. 30 or 40.98)</p>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('credits.paymentDateLabel')}</label>
                  <Input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="rounded-xl border-zinc-200"
                  />
                </div>

                <DialogFooter className="gap-2 pt-2">
                  <Button type="button" variant="outline" onClick={() => setPayingCredit(null)} className="rounded-xl">
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                    {isSubmitting ? t('common.loading') : t('credits.btnPay')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        );
      })()}
    </DashboardLayout>
  );
}
