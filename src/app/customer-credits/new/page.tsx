"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { ArrowLeft, Plus, CreditCard, ShoppingBag, X, Check, Calculator, AlertTriangle, PackageCheck } from "lucide-react";

interface InShopProduct {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
  categoryName?: string;
  categoryType?: string;
  openingAdariQty: number;
  producedQty: number;
  deliveredQty: number;
  convertedInQty: number;
  soldQty: number;
  convertedOutQty: number;
  creditLentQty: number;
  availableStock: number;
}

interface ProductLineItem {
  productId: string;
  quantity: number | string;
  unitPrice: number | string;
}

export default function NewCustomerCreditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();

  const [products, setProducts] = useState<InShopProduct[]>([]);
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lineItems, setLineItems] = useState<ProductLineItem[]>([]);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [creditDate, setCreditDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const res = await api.get(`/daily-sessions/active/available-products${branchQuery}`);
      const data = res.data;
      if (data && data.hasActiveSession) {
        setHasActiveSession(true);
        setSessionDate(data.sessionDate || "");
        if (data.sessionDate) {
          setCreditDate(data.sessionDate);
        }
        const prods: InShopProduct[] = data.products || [];
        setProducts(prods);
        if (prods.length > 0) {
          const firstInStock = prods.find((p) => p.availableStock > 0) || prods[0];
          setLineItems([{ productId: firstInStock.id, quantity: "", unitPrice: Number(firstInStock.basePrice || 0) }]);
        }
      } else {
        setHasActiveSession(false);
        setProducts([]);
        setLineItems([]);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load in-shop available products");
      setHasActiveSession(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Calculate Auto Total Birr from Product Line Items
  const calculatedBirrTotal = lineItems.reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );

  const effectiveTotalBirr = customTotalAmount !== "" ? Number(customTotalAmount) : calculatedBirrTotal;

  // Stock over-limit check
  const hasOverStockError = lineItems.some((item) => {
    const prod = products.find((p) => p.id === item.productId);
    const qty = Number(item.quantity || 0);
    return prod ? qty > prod.availableStock || qty <= 0 : false;
  });

  const handleAddLineItem = () => {
    const inStockProd = products.find((p) => p.availableStock > 0) || products[0];
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

  const handleSubmit = async (e: React.FormEvent) => {
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
      if (prod && qty > prod.availableStock) {
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
      toast.success("Customer product credit logged successfully!");
      router.push("/customer-credits");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to log customer credit");
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Header & Navigation */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/customer-credits")}
              className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> {t('credits.btnBack')}
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
                <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-[#E87A18]" />
                {t('credits.newCredit')}
              </h1>
              <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
                {t('credits.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* No Active Session Banner */}
        {hasActiveSession === false && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-extrabold text-amber-900">{t('credits.noSessionBanner')}</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t('credits.noSessionHelp')}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => router.push("/daily-sessions")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shrink-0"
            >
              {t('credits.goToSessions')}
            </Button>
          </div>
        )}

        {/* Responsive Form Card */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Details Card */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4A2E1B] border-b border-[#F4ECE1] pb-2">
              1. Customer & Delivery Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                  Customer / Business Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Abyssinia Cafe / Central Hotel"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">Phone Number</label>
                <Input
                  placeholder="e.g. 0911223344"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                  Credit Issue Date <span className="text-rose-500">*</span>
                </label>
                <Input
                  type="date"
                  required
                  value={creditDate}
                  onChange={(e) => setCreditDate(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>
            </div>
          </div>

          {/* Product Line Items Builder */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4A2E1B] flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
                  2. Products Issued on Credit
                </h2>
                <p className="text-[11px] text-[#8C7361] mt-0.5">
                  Stock balances reflect live in-shop inventory for the active session.
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAddLineItem}
                disabled={hasActiveSession === false || products.length === 0}
                size="sm"
                className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Add Product Line
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-6 text-xs text-[#8C7361] font-medium">Checking live in-shop product inventory...</div>
            ) : lineItems.length === 0 ? (
              <div className="text-center py-8 bg-[#FAF6F0] rounded-xl border border-dashed border-[#EDE4D5] text-[#8C7361] text-xs space-y-2">
                <p>No products added to this credit invoice yet.</p>
                <Button
                  type="button"
                  onClick={handleAddLineItem}
                  disabled={hasActiveSession === false || products.length === 0}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-[#E87A18] text-[#E87A18] font-bold text-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add First Product
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Column Header Bar */}
                <div className="hidden md:flex items-center gap-3 px-3 py-2 bg-[#FAF6F0] rounded-xl border border-[#EDE4D5] text-[11px] font-extrabold uppercase text-[#4A2E1B]">
                  <div className="flex-1">Product Item & Live Stock</div>
                  <div className="w-32 text-center">Qty to Lend</div>
                  <div className="w-32 text-center">Unit Price / Amount</div>
                  <div className="w-32 text-right pr-2">Subtotal</div>
                  <div className="w-9"></div>
                </div>

                {lineItems.map((item, idx) => {
                  const selectedProd = products.find((p) => p.id === item.productId);
                  const isOverStock = selectedProd ? Number(item.quantity || 0) > selectedProd.availableStock : false;
                  const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);

                  return (
                    <div
                      key={idx}
                      className={`p-3 sm:p-3.5 rounded-xl border transition-all ${
                        isOverStock
                          ? "bg-rose-50/50 border-rose-300"
                          : "bg-[#FAF6F0]/60 border-[#EDE4D5]"
                      } flex flex-col md:flex-row md:items-center gap-3`}
                    >
                      {/* Product Selector */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361]">
                            Product Item
                          </label>
                          {selectedProd && (
                            <span
                              className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                selectedProd.availableStock > 5
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : selectedProd.availableStock > 0
                                  ? "bg-amber-50 text-amber-700 border border-amber-200"
                                  : "bg-rose-50 text-rose-700 border border-rose-200"
                              }`}
                            >
                              In Shop: {selectedProd.availableStock} {selectedProd.unitType}
                            </span>
                          )}
                        </div>
                        <select
                          value={item.productId}
                          onChange={(e) => handleLineItemChange(idx, "productId", e.target.value)}
                          className="w-full text-xs font-bold border border-zinc-200 rounded-xl h-10 px-3 bg-white text-[#2C1B10]"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.availableStock} {p.unitType} in shop) - {Number(p.basePrice).toFixed(2)} ETB {p.availableStock <= 0 ? " [OUT OF STOCK]" : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 md:flex md:items-center gap-3">
                        {/* Quantity */}
                        <div className="col-span-1 md:w-32">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Qty
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max={selectedProd ? selectedProd.availableStock : undefined}
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                            placeholder="Qty"
                            className={`text-xs h-10 font-bold text-center font-mono rounded-xl bg-white ${
                              isOverStock
                                ? "border-rose-500 ring-2 ring-rose-200 text-rose-700 font-extrabold"
                                : ""
                            }`}
                          />
                          {isOverStock && selectedProd && (
                            <p className="text-[9px] font-extrabold text-rose-600 mt-0.5 text-center leading-tight">
                              Max: {selectedProd.availableStock} {selectedProd.unitType}
                            </p>
                          )}
                        </div>

                        {/* Editable Unit Price / Amount Input */}
                        <div className="col-span-1 md:w-32">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Amount / Price
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                            placeholder="Amount"
                            className="text-xs h-10 font-bold text-center font-mono rounded-xl bg-white"
                          />
                        </div>

                        {/* Line Subtotal */}
                        <div className="col-span-1 md:w-32 text-right flex flex-col justify-center">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Subtotal
                          </label>
                          <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                            = {itemSubtotal.toFixed(2)} ETB
                          </span>
                        </div>
                      </div>

                      {/* Remove Button */}
                      <div className="flex justify-end md:justify-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-50 rounded-xl"
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

          {/* Birr Calculation Summary Card */}
          <div className="bg-gradient-to-r from-[#2C1B10] to-[#4A2E1B] text-white rounded-2xl p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-[#E87A18]" /> 3. Automated Birr Total Summary
                </span>
                <p className="text-xs text-zinc-300">
                  Total Birr calculated automatically based on product quantities and prices.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-black/30 p-3 rounded-xl border border-white/10">
                <div className="text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">Total Credit Amount</span>
                  <span className="text-xl font-extrabold text-amber-400 font-mono">
                    {effectiveTotalBirr.toFixed(2)} ETB
                  </span>
                </div>
                <div className="w-32">
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={customTotalAmount !== "" ? customTotalAmount : (calculatedBirrTotal > 0 ? String(calculatedBirrTotal) : "")}
                    onChange={(e) => setCustomTotalAmount(e.target.value)}
                    placeholder="Birr Total"
                    className="bg-white text-[#2C1B10] font-extrabold text-sm font-mono h-9 text-right rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Additional Details */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-xs font-bold text-[#2C1B10] block uppercase">
              4. Additional Notes / Delivery References
            </label>
            <Input
              placeholder="e.g. Delivered by morning truck shift; signed by storekeeper"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl border-zinc-200 text-xs sm:text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push("/customer-credits")}
              className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs sm:text-sm"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || hasActiveSession === false || hasOverStockError || lineItems.length === 0}
              className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? t('common.loading') : t('credits.newCredit')}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
