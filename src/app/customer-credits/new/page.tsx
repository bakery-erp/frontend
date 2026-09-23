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
import {
  ArrowLeft,
  Plus,
  CreditCard,
  ShoppingBag,
  X,
  Check,
  Calculator,
  AlertTriangle,
  UserCheck,
  UserPlus,
  MapPin,
  Phone,
  Search,
} from "lucide-react";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";

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

interface CustomerRecord {
  id: string;
  fullName: string;
  phone: string;
  address?: string | null;
  totalRemaining: number;
  totalCredits: number;
}

export default function NewCustomerCreditPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();

  const [products, setProducts] = useState<InShopProduct[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [hasActiveSession, setHasActiveSession] = useState<boolean | null>(null);
  const [sessionDate, setSessionDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Customer Mode: "EXISTING" vs "NEW"
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");

  // New Customer Form State
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  // Credit Line Items and Metadata
  const [lineItems, setLineItems] = useState<ProductLineItem[]>([]);
  const [customTotalAmount, setCustomTotalAmount] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [creditDate, setCreditDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Unsaved changes warning
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const [sessionRes, custRes] = await Promise.all([
        api.get(`/daily-sessions/active/available-products${branchQuery}`),
        api.get(`/customers${branchQuery}`),
      ]);

      // Customers
      const custList = custRes.data || [];
      setCustomers(custList);
      if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
        setCustomerMode("EXISTING");
      } else {
        setCustomerMode("NEW");
      }

      // Products & Session
      const data = sessionRes.data;
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
      toast.error(e.response?.data?.error || "Failed to load initial data");
      setHasActiveSession(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Selected existing customer object
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Filtered customer list for quick search
  const filteredCustomers = customers.filter(
    (c) =>
      c.fullName.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  // Form dirty check
  const isFormDirty =
    (customerMode === "NEW" && (newCustomerName.trim() !== "" || newCustomerPhone.trim() !== "")) ||
    lineItems.some((it) => it.quantity !== "" && Number(it.quantity) > 0) ||
    notes.trim() !== "";

  const handleCancelClick = () => {
    if (isFormDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push("/customer-credits");
    }
  };

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
      } else if (field === "quantity") {
        let cleanVal = value;
        if (value === "" || value === null || value === undefined) {
          cleanVal = "";
        } else {
          const parsed = parseInt(String(value), 10);
          cleanVal = isNaN(parsed) ? "" : Math.max(0, parsed);
        }
        updated[index] = {
          ...updated[index],
          quantity: cleanVal,
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

    if (customerMode === "EXISTING") {
      if (!selectedCustomerId) {
        toast.error("Please select an existing customer or switch to add a new customer.");
        return;
      }
    } else {
      if (!newCustomerName.trim()) {
        toast.error(t("credits.toastEnterCustomerName"));
        return;
      }
      if (!newCustomerPhone.trim()) {
        toast.error("Customer phone number is required.");
        return;
      }
    }

    if (lineItems.length === 0) {
      toast.error(t("credits.toastAddProduct"));
      return;
    }

    // Validate quantities against in-shop stock
    for (const item of lineItems) {
      const prod = products.find((p) => p.id === item.productId);
      const qty = Number(item.quantity || 0);
      if (qty <= 0) {
        toast.error(t("credits.toastValidQuantity").replace("{name}", prod?.name || ""));
        return;
      }
      if (prod && qty > prod.availableStock) {
        toast.error(t("credits.toastOverStock"));
        return;
      }
    }

    if (effectiveTotalBirr <= 0) {
      toast.error("Total credit amount must be greater than zero.");
      return;
    }

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
      await api.post("/customers/credits", {
        customerId: customerMode === "EXISTING" ? selectedCustomerId : undefined,
        newCustomer:
          customerMode === "NEW"
            ? {
                fullName: newCustomerName.trim(),
                phone: newCustomerPhone.trim(),
                address: newCustomerAddress.trim() || undefined,
              }
            : undefined,
        branchId: selectedBranchId || undefined,
        amount: effectiveTotalBirr,
        date: creditDate,
        items: itemsPayload,
        description: notes.trim() || undefined,
      });

      toast.success(t("credits.toastCreditLogged"));
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
        <div className="space-y-2">
          <Button
            variant="ghost"
            onClick={handleCancelClick}
            className="text-[#8C7361] hover:bg-[#F4ECE1] rounded-xl w-fit flex items-center gap-1.5 -ml-2 h-9 px-2.5 font-bold"
          >
            <ArrowLeft className="w-4 h-4" /> {t("credits.btnBack")}
          </Button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-amber-100 flex items-center justify-center text-[#E87A18] shrink-0 border border-amber-200">
              <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
                {t("credits.newCredit")}
              </h1>
              <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
                {t("credits.subtitle")}
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
                <h3 className="text-sm font-extrabold text-amber-900">{t("credits.noSessionBanner")}</h3>
                <p className="text-xs text-amber-700 mt-0.5">
                  {t("credits.noSessionHelp")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => router.push("/daily-sessions")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shrink-0"
            >
              {t("credits.goToSessions")}
            </Button>
          </div>
        )}

        {/* Responsive Form Card */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Customer Selection / Registration Card */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#F4ECE1] pb-3">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4A2E1B]">
                  {t("credits.customerDeliveryInfo")}
                </h2>
                <p className="text-[11px] text-[#8C7361] mt-0.5">
                  Choose a recurring customer or register a new client profile.
                </p>
              </div>

              {/* Mode Toggle Pills */}
              <div className="flex items-center gap-1.5 p-1 bg-[#FAF6F0] rounded-xl border border-[#EDE4D5] self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setCustomerMode("EXISTING")}
                  disabled={customers.length === 0}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    customerMode === "EXISTING"
                      ? "bg-white text-[#4A2E1B] shadow-xs"
                      : "text-[#8C7361] hover:text-[#2C1B10] disabled:opacity-40"
                  }`}
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {t("credits.existingCustomerToggle")} ({customers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerMode("NEW")}
                  className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                    customerMode === "NEW"
                      ? "bg-[#E87A18] text-white shadow-xs"
                      : "text-[#8C7361] hover:text-[#2C1B10]"
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  {t("credits.newCustomerToggle")}
                </button>
              </div>
            </div>

            {/* Mode 1: Existing Customer */}
            {customerMode === "EXISTING" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                      {t("credits.selectCustomer")} <span className="text-rose-500">*</span>
                    </label>
                    <select
                      value={selectedCustomerId}
                      onChange={(e) => setSelectedCustomerId(e.target.value)}
                      className="w-full text-xs font-bold border border-zinc-200 rounded-xl h-10 px-3 bg-white text-[#2C1B10] focus:ring-2 focus:ring-amber-500/20"
                    >
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.fullName} ({c.phone}) - Debt: {Number(c.totalRemaining || 0).toFixed(2)} ETB
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                      {t("credits.creditIssueDateLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="date"
                      required
                      value={creditDate}
                      onChange={(e) => setCreditDate(e.target.value)}
                      className="rounded-xl border-zinc-200 text-xs font-bold"
                    />
                  </div>
                </div>

                {/* Selected Customer Profile Summary Card */}
                {selectedCustomer && (
                  <div className="p-3.5 bg-gradient-to-r from-[#FAF6F0] to-[#F4ECE1] rounded-xl border border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#2C1B10] text-sm">{selectedCustomer.fullName}</span>
                        <span className="text-[11px] font-mono text-[#8C7361] flex items-center gap-1">
                          <Phone className="w-3 h-3 text-[#E87A18]" /> {selectedCustomer.phone}
                        </span>
                      </div>
                      {selectedCustomer.address && (
                        <p className="text-[11px] text-[#8C7361] flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-[#8C7361]" /> {selectedCustomer.address}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] block">
                          {t("credits.outstandingDebt")}
                        </span>
                        <span
                          className={`font-mono font-black text-sm ${
                            Number(selectedCustomer.totalRemaining || 0) > 0
                              ? "text-rose-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {Number(selectedCustomer.totalRemaining || 0).toFixed(2)} ETB
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* Mode 2: Register New Customer On-The-Fly */
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                      {t("credits.customerNameLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      required
                      placeholder={t("credits.customerNamePlaceholder")}
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="rounded-xl border-zinc-200 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                      {t("credits.phoneNumberLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      required
                      placeholder={t("credits.phonePlaceholder")}
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="rounded-xl border-zinc-200 text-xs font-bold"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                      {t("credits.creditIssueDateLabel")} <span className="text-rose-500">*</span>
                    </label>
                    <Input
                      type="date"
                      required
                      value={creditDate}
                      onChange={(e) => setCreditDate(e.target.value)}
                      className="rounded-xl border-zinc-200 text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1.5 block uppercase">
                    {t("credits.addressLabel")}
                  </label>
                  <Input
                    placeholder={t("credits.addressPlaceholder")}
                    value={newCustomerAddress}
                    onChange={(e) => setNewCustomerAddress(e.target.value)}
                    className="rounded-xl border-zinc-200 text-xs"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Product Line Items Builder */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#4A2E1B] flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
                  {t("credits.productsIssuedOnCredit")}
                </h2>
                <p className="text-[11px] text-[#8C7361] mt-0.5">
                  {t("credits.stockBalancesHelp")}
                </p>
              </div>
              <Button
                type="button"
                onClick={handleAddLineItem}
                disabled={hasActiveSession === false || products.length === 0}
                size="sm"
                className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> {t("credits.addProductLine")}
              </Button>
            </div>

            {isLoading ? (
              <div className="text-center py-6 text-xs text-[#8C7361] font-medium">
                {t("credits.checkingInventory")}
              </div>
            ) : lineItems.length === 0 ? (
              <div className="text-center py-8 bg-[#FAF6F0] rounded-xl border border-dashed border-[#EDE4D5] text-[#8C7361] text-xs space-y-2">
                <p>{t("credits.noProductsAdded")}</p>
                <Button
                  type="button"
                  onClick={handleAddLineItem}
                  disabled={hasActiveSession === false || products.length === 0}
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-[#E87A18] text-[#E87A18] font-bold text-xs disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> {t("credits.addFirstProduct")}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Desktop Column Header Bar */}
                <div className="hidden md:flex items-center gap-3 px-3 py-2 bg-[#FAF6F0] rounded-xl border border-[#EDE4D5] text-[11px] font-extrabold uppercase text-[#4A2E1B]">
                  <div className="flex-1">{t("credits.colProductStock")}</div>
                  <div className="w-32 text-center">{t("credits.colQtyToLend")}</div>
                  <div className="w-32 text-center">{t("credits.colUnitPriceAmount")}</div>
                  <div className="w-32 text-right pr-2">{t("credits.subtotal")}</div>
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
                            {t("credits.productItemLabel")}
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
                              {t("credits.inShopCountBadge")
                                .replace("{count}", String(selectedProd.availableStock))
                                .replace("{unit}", selectedProd.unitType)}
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
                              {p.name} ({p.availableStock} {p.unitType} {t("credits.inShopOption")}) - {Number(p.basePrice).toFixed(2)} ETB {p.availableStock <= 0 ? ` [${t("credits.outOfStock")}]` : ""}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Mobile Row for Qty and Price */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:hidden">
                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block">
                            {t("credits.qtyLabel")}
                          </label>
                          <Input
                            type="number"
                            min="1"
                            max={selectedProd ? selectedProd.availableStock : undefined}
                            value={item.quantity === 0 || item.quantity === "" ? "" : item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                            placeholder="0"
                            className={`text-xs h-10 font-bold text-center font-mono rounded-xl bg-white ${
                              isOverStock
                                ? "border-rose-500 ring-2 ring-rose-200 text-rose-700 font-extrabold"
                                : ""
                            }`}
                          />
                          {isOverStock && selectedProd && (
                            <p className="text-[9px] font-extrabold text-rose-600 mt-0.5 text-center leading-tight">
                              {t("credits.maxLimit")
                                .replace("{max}", String(selectedProd.availableStock))
                                .replace("{unit}", selectedProd.unitType)}
                            </p>
                          )}
                        </div>

                        <div>
                          <label className="text-[10px] font-bold uppercase text-[#8C7361] mb-1 block">
                            {t("credits.pricePerUnit")}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                            placeholder="0.00"
                            className="text-xs h-10 font-bold text-center font-mono rounded-xl bg-white"
                          />
                        </div>
                      </div>

                      {/* Mobile Subtotal and Delete Row */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#EDE4D5]/60 md:hidden">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold uppercase text-[#8C7361]">{t("credits.subtotal")}:</span>
                          <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                            {itemSubtotal.toFixed(2)} ETB
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="h-8 px-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" /> {t("credits.remove")}
                        </Button>
                      </div>

                      {/* Desktop Inline Layout */}
                      <div className="hidden md:flex md:items-center gap-3">
                        <div className="w-32">
                          <Input
                            type="number"
                            min="1"
                            max={selectedProd ? selectedProd.availableStock : undefined}
                            value={item.quantity === 0 || item.quantity === "" ? "" : item.quantity}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleLineItemChange(idx, "quantity", e.target.value)}
                            placeholder="0"
                            className={`text-xs h-10 font-bold text-center font-mono rounded-xl bg-white ${
                              isOverStock
                                ? "border-rose-500 ring-2 ring-rose-200 text-rose-700 font-extrabold"
                                : ""
                            }`}
                          />
                          {isOverStock && selectedProd && (
                            <p className="text-[9px] font-extrabold text-rose-600 mt-0.5 text-center leading-tight">
                              {t("credits.maxLimit")
                                .replace("{max}", String(selectedProd.availableStock))
                                .replace("{unit}", selectedProd.unitType)}
                            </p>
                          )}
                        </div>

                        <div className="w-32">
                          <Input
                            type="number"
                            step="0.01"
                            value={item.unitPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => handleLineItemChange(idx, "unitPrice", e.target.value)}
                            placeholder="0.00"
                            className="text-xs h-10 font-bold text-center font-mono rounded-xl bg-white"
                          />
                        </div>

                        <div className="w-32 text-right pr-2">
                          <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                            = {itemSubtotal.toFixed(2)} ETB
                          </span>
                        </div>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveLineItem(idx)}
                          className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-50 rounded-xl shrink-0"
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
          <div className="bg-gradient-to-r from-[#2C1B10] to-[#4A2E1B] text-white rounded-2xl p-4 sm:p-5 shadow-md space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
              <div className="space-y-1">
                <span className="text-xs font-extrabold uppercase text-amber-200 tracking-wider flex items-center gap-1.5">
                  <Calculator className="w-4 h-4 text-[#E87A18]" /> {t("credits.summaryCardTitle")}
                </span>
                <p className="text-xs text-zinc-300">
                  {t("credits.summaryCardDesc")}
                </p>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 bg-black/30 p-3 rounded-xl border border-white/10">
                <div className="text-left sm:text-right">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase block">{t("credits.totalCreditAmount")}</span>
                  <span className="text-lg sm:text-xl font-extrabold text-amber-400 font-mono">
                    {effectiveTotalBirr.toFixed(2)} ETB
                  </span>
                </div>
                <div className="w-28 sm:w-32">
                  <Input
                    type="number"
                    step="0.01"
                    required
                    value={customTotalAmount !== "" ? customTotalAmount : (calculatedBirrTotal > 0 ? String(calculatedBirrTotal) : "")}
                    onFocus={(e) => e.target.select()}
                    onChange={(e) => setCustomTotalAmount(e.target.value)}
                    placeholder="0.00"
                    className="bg-white text-[#2C1B10] font-extrabold text-sm font-mono h-9 text-right rounded-lg"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Additional Details */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-sm space-y-3">
            <label className="text-xs font-bold text-[#2C1B10] block uppercase">
              {t("credits.notesCardTitle")}
            </label>
            <Input
              placeholder={t("credits.notesPlaceholder")}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="rounded-xl border-zinc-200 text-xs sm:text-sm"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 sm:gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelClick}
              className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs sm:text-sm h-11 sm:h-10 w-full sm:w-auto"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || hasActiveSession === false || hasOverStockError || lineItems.length === 0}
              className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs sm:text-sm h-11 sm:h-10 w-full sm:w-auto shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {isSubmitting ? t("common.loading") : t("credits.newCredit")}
            </Button>
          </div>
        </form>
      </div>

      <UnsavedChangesDialog
        isOpen={showUnsavedDialog}
        onStay={() => setShowUnsavedDialog(false)}
        onLeave={() => {
          setShowUnsavedDialog(false);
          router.push("/customer-credits");
        }}
      />
    </DashboardLayout>
  );
}
