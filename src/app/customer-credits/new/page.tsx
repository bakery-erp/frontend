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
import { format } from "date-fns";
import { ArrowLeft, Plus, CreditCard, ShoppingBag, X, Check, Calculator } from "lucide-react";

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

export default function NewCustomerCreditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();

  const [products, setProducts] = useState<Product[]>([]);
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
      const res = await api.get(`/products${branchQuery}`);
      const activeProds = (res.data || []).filter((p: any) => p.isActive !== false);
      setProducts(activeProds);
      if (activeProds.length > 0) {
        setLineItems([{ productId: activeProds[0].id, quantity: 1, unitPrice: Number(activeProds[0].basePrice || 0) }]);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load active products");
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

  const handleSubmit = async (e: React.FormEvent) => {
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
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-[#2C1B10] tracking-tight flex items-center gap-2">
                <CreditCard className="w-6 h-6 sm:w-7 sm:h-7 text-[#E87A18]" />
                Log Customer Product Credit Sale
              </h1>
              <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
                Issue bakery products on credit with automatic line item subtotal and Birr total calculation.
              </p>
            </div>
          </div>
        </div>

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
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4A2E1B] flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
                2. Products Issued on Credit
              </h2>
              <Button
                type="button"
                onClick={handleAddLineItem}
                size="sm"
                className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" /> Add Product Line
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-6 text-xs text-[#8C7361] font-medium">Loading catalog products...</div>
            ) : lineItems.length === 0 ? (
              <div className="text-center py-8 bg-[#FAF6F0] rounded-xl border border-dashed border-[#EDE4D5] text-[#8C7361] text-xs space-y-2">
                <p>No products added to this credit invoice yet.</p>
                <Button
                  type="button"
                  onClick={handleAddLineItem}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-[#E87A18] text-[#E87A18] font-bold text-xs"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add First Product
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {lineItems.map((item, idx) => {
                  const itemSubtotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
                  return (
                    <div
                      key={idx}
                      className="bg-[#FAF6F0]/60 p-3 sm:p-3.5 rounded-xl border border-[#EDE4D5] flex flex-col md:flex-row md:items-center gap-3 transition-all"
                    >
                      {/* Product Selector */}
                      <div className="flex-1">
                        <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                          Product Item
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => handleLineItemChange(idx, "productId", e.target.value)}
                          className="w-full text-xs font-bold border border-zinc-200 rounded-xl h-10 px-3 bg-white text-[#2C1B10]"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unitType}) - {Number(p.basePrice).toFixed(2)} ETB
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-3 md:flex md:items-center gap-3">
                        {/* Quantity */}
                        <div className="col-span-1 md:w-28">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Quantity
                          </label>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                            placeholder="Qty"
                            className="text-xs h-10 font-bold text-center font-mono rounded-xl bg-white"
                          />
                        </div>

                        {/* Unit Price */}
                        <div className="col-span-1 md:w-32">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Unit Price (ETB)
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                            placeholder="Price"
                            className="text-xs h-10 font-bold text-center font-mono rounded-xl bg-white"
                          />
                        </div>

                        {/* Line Subtotal */}
                        <div className="col-span-1 md:w-32 text-right flex flex-col justify-center">
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block md:hidden">
                            Subtotal
                          </label>
                          <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                            {itemSubtotal.toFixed(2)} ETB
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
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? "Submitting Credit..." : "Log Product Credit"}
            </Button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
