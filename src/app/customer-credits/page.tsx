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
import { format } from "date-fns";
import { Plus, CreditCard, DollarSign, Trash2, RefreshCw, ShoppingBag, X } from "lucide-react";

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
}

interface ProductLineItem {
  productId: string;
  quantity: number;
  unitPrice: number;
}

export default function CustomerCreditsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  const [credits, setCredits] = useState<CustomerCredit[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
      const [resCredits, resProducts] = await Promise.all([
        api.get(`/loans?type=CUSTOMER${branchQuery}`),
        api.get(`/products${selectedBranchId ? '?branchId=' + selectedBranchId : ''}`),
      ]);
      setCredits(resCredits.data);
      setProducts(resProducts.data || []);
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

  const resetAddForm = () => {
    setCustomerName("");
    setCustomerPhone("");
    setLineItems([]);
    setCustomTotalAmount("");
    setNotes("");
    setCreditDate(format(new Date(), "yyyy-MM-dd"));
  };

  const handleAddLineItem = () => {
    const firstProd = products[0];
    if (!firstProd) {
      toast.error("No products available to select.");
      return;
    }
    setLineItems((prev) => [
      ...prev,
      { productId: firstProd.id, quantity: 1, unitPrice: Number(firstProd.basePrice || 0) },
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
          [field]: Number(value),
        };
      }
      return updated;
    });
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      toast.error("Customer or Business name is required");
      return;
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
            Customer Product Credit Sales & Receivables
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
            Log bakery products (bread, pastries) issued on credit with automated Birr total calculation and partial repayment settlement.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1" /> Refresh
          </Button>
          {canManage && (
            <Button
              onClick={() => router.push("/customer-credits/new")}
              className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> New Customer Product Credit
            </Button>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm">
          <span className="text-xs font-bold uppercase text-[#8C7361] block">Total Product Credit Issued</span>
          <span className="text-2xl font-extrabold text-[#2C1B10] mt-1 block font-mono">
            {totalCreditGiven.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
          </span>
        </div>
        <div className="bg-white border border-emerald-200 rounded-2xl p-4 shadow-sm bg-emerald-50/30">
          <span className="text-xs font-bold uppercase text-emerald-800 block">Total Settlement Repaid</span>
          <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
            {totalRepaid.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
          </span>
        </div>
        <div className="bg-white border border-rose-200 rounded-2xl p-4 shadow-sm bg-rose-50/30">
          <span className="text-xs font-bold uppercase text-rose-800 block">Outstanding Receivable</span>
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
            📅 Daily Credits Today
          </Button>
        </div>

        <Input
          placeholder="Search client or business name..."
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
                  <TableHead>Issued Date</TableHead>
                  <TableHead>Customer / Business Name</TableHead>
                  <TableHead className="text-right">Total Birr Amount</TableHead>
                  <TableHead className="text-right">Remaining Balance</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Repayment History</TableHead>
                  <TableHead className="text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                      Loading customer product credit accounts...
                    </TableCell>
                  </TableRow>
                ) : filteredCredits.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                      No customer credit sales found matching filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCredits.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-bold text-[#2C1B10]">
                    {c.date ? format(new Date(c.date), "MMM d, yyyy") : format(new Date(c.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    <div className="font-bold text-[#2C1B10]">{c.entityId || "Client / Cafe"}</div>
                  </TableCell>
                  <TableCell className="text-right font-extrabold text-[#2C1B10] font-mono">
                    {Number(c.totalAmount).toFixed(2)} ETB
                  </TableCell>
                  <TableCell className="text-right font-extrabold text-rose-700 font-mono">
                    {Number(c.remainingBalance).toFixed(2)} ETB
                  </TableCell>
                  <TableCell className="text-center">
                    {c.status === "PAID" || Number(c.remainingBalance) <= 0.01 ? (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ✓ SETTLED
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        UNPAID
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
                      {Number(c.remainingBalance) > 0.01 && canManage && (
                        <Button
                          size="sm"
                          onClick={() => { setPayingCredit(c); setAmountPaid(String(c.remainingBalance)); }}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                        >
                          <DollarSign className="w-3.5 h-3.5" /> Pay
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
              ))
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
                    size="sm"
                    className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white text-xs font-bold h-7 px-2.5 rounded-lg flex items-center gap-1"
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
                      const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                      return (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-[#EDE4D5]">
                          <select
                            value={item.productId}
                            onChange={(e) => handleLineItemChange(idx, "productId", e.target.value)}
                            className="flex-1 text-xs font-bold border border-zinc-200 rounded-lg h-9 px-2 bg-white text-[#2C1B10]"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.unitType}) - {Number(p.basePrice).toFixed(2)} ETB
                              </option>
                            ))}
                          </select>

                          <div className="w-20">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                              placeholder="Qty"
                              className="text-xs h-9 font-bold text-center font-mono"
                            />
                          </div>

                          <div className="w-24">
                            <Input
                              type="number"
                              step="0.01"
                              value={item.unitPrice}
                              onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                              placeholder="Price"
                              className="text-xs h-9 font-bold text-center font-mono"
                            />
                          </div>

                          <div className="text-xs font-extrabold text-[#E87A18] font-mono w-24 text-right pr-1">
                            {itemSubtotal.toFixed(2)} ETB
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
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Saving..." : "Log Product Credit"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* PAY / SETTLEMENT MODAL */}
      {payingCredit && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setPayingCredit(null); }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Record Credit Settlement / Payment
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePay} className="space-y-3.5 mt-2">
              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] text-xs space-y-1">
                <div className="font-bold text-[#2C1B10]">{payingCredit.entityId}</div>
                <div className="flex justify-between text-[#8C7361] font-mono">
                  <span>Total Loan: {Number(payingCredit.totalAmount).toFixed(2)} ETB</span>
                  <span className="font-bold text-rose-700">Remaining: {Number(payingCredit.remainingBalance).toFixed(2)} ETB</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Payment Amount (ETB)</label>
                <Input
                  type="number"
                  required
                  min="0.01"
                  max={Number(payingCredit.remainingBalance)}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="rounded-xl border-zinc-200 font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Payment Date</label>
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
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Record Settlement"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
