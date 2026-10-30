"use client";

import { useEffect, useState, useCallback, Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { format } from "date-fns";
import { AppDatePicker } from "@/components/AppDatePicker";
import {
  ArrowLeft,
  ArrowRight,
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
  Pencil,
  CheckCircle2,
  Calendar,
  FileText,
  Minus,
  Layers,
  Utensils,
} from "lucide-react";
import UnsavedChangesDialog from "@/components/UnsavedChangesDialog";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface InShopProduct {
  id: string;
  name: string;
  nameLatin?: string | null;
  unitType: string;
  basePrice: number;
  categoryName?: string;
  categoryType?: string;
  availableStock: number;
}

interface CustomerRecord {
  id: string;
  fullName: string;
  phone: string;
  address?: string | null;
  totalRemaining: number;
  totalCredits: number;
}

function extractCleanNotes(rawDesc?: string | null): string {
  if (!rawDesc) return "";
  let clean = rawDesc;
  clean = clean.replace(/\[Products:\s*.*?\]/gi, "").trim();
  clean = clean.replace(/\[CreditItems:\s*\[.*?\]\s*\]/gi, "").trim();
  clean = clean.replace(/^[\s\-–—]+|[\s\-–—]+$/g, "").trim();
  clean = clean.replace(/^[^|]+(?:\s*\|\s*[^|]+)?\s*\|\s*/, "").trim();
  return clean;
}

function NewCustomerCreditFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const customerIdFromQuery = searchParams.get("customerId");
  const editCreditId = searchParams.get("edit");
  const isEditMode = Boolean(editCreditId);

  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t, getItemName } = useLanguage();
  const queryClient = useQueryClient();

  // 3-step wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [products, setProducts] = useState<InShopProduct[]>([]);
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Step 1: Customer Selection State
  const [customerMode, setCustomerMode] = useState<"EXISTING" | "NEW">("EXISTING");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");

  // Step 2: Categorized Product Multi-selection State (Map of productId -> string quantity)
  const [selectedProductQuantities, setSelectedProductQuantities] = useState<Record<string, string>>({});
  const [productCategoryFilter, setProductCategoryFilter] = useState<string>("ALL");
  const [productSearch, setProductSearch] = useState<string>("");

  // Step 3: Summary & Notes State
  const [creditDate, setCreditDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [sellingPriceInput, setSellingPriceInput] = useState<string>("");
  const [notes, setNotes] = useState("");
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
      let custList: CustomerRecord[] = Array.isArray(custRes.data) ? custRes.data : (custRes.data?.data || []);
      if (customerIdFromQuery) {
        const found = custList.find((c: CustomerRecord) => c.id === customerIdFromQuery);
        if (found) {
          setSelectedCustomerId(customerIdFromQuery);
          setCustomerMode("EXISTING");
        } else {
          try {
            const singleCustRes = await api.get(`/customers/${customerIdFromQuery}`);
            if (singleCustRes.data) {
              custList = [singleCustRes.data, ...custList];
              setSelectedCustomerId(customerIdFromQuery);
              setCustomerMode("EXISTING");
            }
          } catch {
            if (custList.length > 0) {
              setSelectedCustomerId(custList[0].id);
              setCustomerMode("EXISTING");
            }
          }
        }
      } else if (custList.length > 0) {
        setSelectedCustomerId(custList[0].id);
        setCustomerMode("EXISTING");
      } else {
        setCustomerMode("NEW");
      }
      setCustomers(custList);

      // Products & In-shop inventory
      const data = sessionRes.data;
      let prods: InShopProduct[] = (data?.products || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        nameLatin: p.nameLatin,
        unitType: p.unitType,
        basePrice: Number(p.basePrice || 0),
        categoryName: p.categoryName || p.category?.name || "Bakery",
        categoryType: p.categoryType || p.category?.type,
        availableStock: p.availableStock != null ? Number(p.availableStock) : (p.currentStock != null ? Number(p.currentStock) : 0),
      }));

      if (prods.length === 0) {
        try {
          const fallbackProdsRes = await api.get(`/products${branchQuery ? `${branchQuery}&minimal=true` : '?minimal=true'}`);
          prods = (fallbackProdsRes.data || []).map((p: any) => ({
            id: p.id,
            name: p.name,
            nameLatin: p.nameLatin,
            unitType: p.unitType,
            basePrice: Number(p.basePrice || 0),
            categoryName: p.category?.name || "Bakery",
            categoryType: p.category?.type,
            availableStock: p.currentStock != null ? Number(p.currentStock) : 100,
          }));
        } catch {}
      }

      if (data?.sessionDate) {
        setCreditDate(data.sessionDate);
      }
      setProducts(prods);

      // If in edit mode, populate state from existing transaction
      if (editCreditId) {
        try {
          const editRes = await api.get(`/customers/credits/${editCreditId}`);
          const cData = editRes.data;
          if (cData) {
            if (cData.customer) {
              if (!custList.some((c) => c.id === cData.customer.id)) {
                custList = [cData.customer, ...custList];
                setCustomers(custList);
              }
              setSelectedCustomerId(cData.customer.id);
              setCustomerMode("EXISTING");
            } else if (cData.customerId) {
              setSelectedCustomerId(cData.customerId);
              setCustomerMode("EXISTING");
            }

            if (cData.date) {
              setCreditDate(format(new Date(cData.date), "yyyy-MM-dd"));
            }
            if (cData.amount != null) {
              setSellingPriceInput(String(Number(cData.amount)));
            }
            setNotes(extractCleanNotes(cData.description));

            const creditItemsMatch = (cData.description || "").match(/\[CreditItems:\s*(\[.*?\])\s*\]/);
            if (creditItemsMatch) {
              try {
                const parsed = JSON.parse(creditItemsMatch[1]);
                if (Array.isArray(parsed) && parsed.length > 0) {
                  const qMap: Record<string, string> = {};
                  parsed.forEach((it: any) => {
                    qMap[it.productId] = String(it.quantity);
                  });
                  setSelectedProductQuantities(qMap);
                }
              } catch {}
            }
          }
        } catch {
          toast.error("Failed to load credit details for editing");
        }
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load initial data");
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId, customerIdFromQuery, editCreditId]);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // Unique product categories
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set);
  }, [products]);

  // Selected customer object
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

  // Filtered customer list
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.fullName.toLowerCase().includes(q) || c.phone.includes(q) || (c.address && c.address.toLowerCase().includes(q))
    );
  }, [customers, customerSearch]);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (productCategoryFilter !== "ALL" && p.categoryName !== productCategoryFilter) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        const n = p.name.toLowerCase();
        const nl = (p.nameLatin || "").toLowerCase();
        const c = (p.categoryName || "").toLowerCase();
        if (!n.includes(q) && !nl.includes(q) && !c.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [products, productCategoryFilter, productSearch]);

  // Quantity updates
  const setProductQty = (productId: string, val: string | number) => {
    setSelectedProductQuantities((prev) => {
      const next = { ...prev };
      if (val === "" || val === null || val === undefined) {
        delete next[productId];
      } else {
        const num = Number(val);
        if (num <= 0) {
          delete next[productId];
        } else {
          next[productId] = String(num);
        }
      }
      return next;
    });
  };

  const incrementQty = (productId: string) => {
    const curr = parseInt(selectedProductQuantities[productId] || "0", 10);
    const prod = products.find((p) => p.id === productId);
    const max = prod ? prod.availableStock : 9999;
    if (curr < max) {
      setProductQty(productId, curr + 1);
    }
  };

  const decrementQty = (productId: string) => {
    const curr = parseInt(selectedProductQuantities[productId] || "0", 10);
    if (curr > 1) {
      setProductQty(productId, curr - 1);
    } else {
      setProductQty(productId, "");
    }
  };

  // Selected items breakdown list
  const selectedItemsList = useMemo(() => {
    return Object.entries(selectedProductQuantities)
      .map(([id, qtyStr]) => {
        const prod = products.find((p) => p.id === id);
        const qty = parseInt(qtyStr, 10) || 0;
        return {
          productId: id,
          product: prod,
          quantity: qty,
          unitPrice: prod ? prod.basePrice : 0,
          totalPrice: prod ? qty * prod.basePrice : 0,
          overStock: prod ? qty > prod.availableStock : false,
        };
      })
      .filter((it) => it.quantity > 0 && it.product);
  }, [selectedProductQuantities, products]);

  const totalCalculatedBirr = useMemo(() => {
    return selectedItemsList.reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [selectedItemsList]);

  // Customizable selling price / agreed total amount (supporting bulk discounts)
  const effectiveCreditAmount = useMemo(() => {
    if (sellingPriceInput.trim() !== "") {
      const parsed = parseFloat(sellingPriceInput);
      if (!isNaN(parsed) && parsed >= 0) return parsed;
    }
    return totalCalculatedBirr;
  }, [sellingPriceInput, totalCalculatedBirr]);

  const totalSelectedUnits = useMemo(() => {
    return selectedItemsList.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [selectedItemsList]);

  const hasAnyOverstock = selectedItemsList.some((it) => it.overStock);

  // Form dirty check
  const isFormDirty =
    (customerMode === "NEW" && (newCustomerName.trim() !== "" || newCustomerPhone.trim() !== "")) ||
    selectedItemsList.length > 0 ||
    sellingPriceInput.trim() !== "" ||
    notes.trim() !== "";

  const handleCancelClick = () => {
    if (isFormDirty) {
      setShowUnsavedDialog(true);
    } else {
      router.push("/customer-credits");
    }
  };

  // Step 1 Validation
  const canProceedFromStep1 = useMemo(() => {
    if (customerMode === "EXISTING") {
      return Boolean(selectedCustomerId);
    }
    return newCustomerName.trim().length >= 2 && newCustomerPhone.trim().length >= 4;
  }, [customerMode, selectedCustomerId, newCustomerName, newCustomerPhone]);

  // Step 2 Validation
  const canProceedFromStep2 = useMemo(() => {
    return selectedItemsList.length > 0 && !hasAnyOverstock;
  }, [selectedItemsList.length, hasAnyOverstock]);

  // Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!canProceedFromStep1) {
      setCurrentStep(1);
      toast.error("Please select or enter customer details.");
      return;
    }

    if (!canProceedFromStep2) {
      setCurrentStep(2);
      toast.error("Please select products and valid quantities before submitting.");
      return;
    }

    if (effectiveCreditAmount <= 0) {
      toast.error("Total credit amount must be greater than zero.");
      return;
    }

    const itemsPayload = selectedItemsList.map((item) => ({
      productId: item.productId,
      productName: item.product?.name || "Product",
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    setIsSubmitting(true);
    try {
      if (isEditMode) {
        await api.patch(`/customers/credits/${editCreditId}`, {
          customerId: customerMode === "EXISTING" ? selectedCustomerId : undefined,
          amount: effectiveCreditAmount,
          date: creditDate,
          description: notes.trim() || undefined,
          items: itemsPayload,
        });
        toast.success(t("credits.creditUpdatedSuccess") || "Customer credit updated successfully");
      } else {
        await api.post("/customers/credits", {
          branchId: selectedBranchId || undefined,
          customerId: customerMode === "EXISTING" ? selectedCustomerId : undefined,
          newCustomer:
            customerMode === "NEW"
              ? {
                  fullName: newCustomerName.trim(),
                  phone: newCustomerPhone.trim(),
                  address: newCustomerAddress.trim() || undefined,
                  notes: notes.trim() || undefined,
                }
              : undefined,
          amount: effectiveCreditAmount,
          date: creditDate,
          description: notes.trim() || undefined,
          items: itemsPayload,
        });
        toast.success(t("credits.creditCreatedSuccess") || "Customer credit recorded successfully");
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["customer-credits"] }),
        queryClient.invalidateQueries({ queryKey: ["customers"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
      ]);

      router.push("/customer-credits");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to save customer credit transaction");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24 md:pb-12">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancelClick}
              className="w-10 h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-[#4A2E1B]" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
                {isEditMode ? "Edit Customer Credit" : "New Customer Credit Sale"}
              </h1>
              <p className="text-xs text-[#8C7361] font-medium">
                Step {currentStep} of 3: {currentStep === 1 ? "Choose Customer" : currentStep === 2 ? "Select In-Shop Products" : "Review & Verification"}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={handleCancelClick}
            className="text-xs font-bold text-[#8C7361] hover:text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl h-9 px-3"
          >
            Cancel
          </Button>
        </div>

        {/* Production-Style Step Navigation Header */}
        <div className="bg-white p-3.5 sm:p-4 rounded-3xl border border-[#EDE4D5] shadow-xs space-y-3 mb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-7 h-7 rounded-full bg-[#E87A18] text-white flex items-center justify-center text-xs font-black shrink-0 shadow-xs">
                {currentStep}
              </span>
              <div className="min-w-0">
                <span className="text-[10px] uppercase font-extrabold text-[#8C7361] tracking-wider block">
                  Step {currentStep} of 3
                </span>
                <h2 className="text-xs sm:text-sm font-black text-[#2C1B10] truncate">
                  {currentStep === 1 && "Step 1: Choose Customer"}
                  {currentStep === 2 && "Step 2: Select In-Shop Products"}
                  {currentStep === 3 && "Step 3: Review & Summary"}
                </h2>
              </div>
            </div>

            {/* Step Status Chip / Back Navigation */}
            <div className="flex items-center gap-2 shrink-0">
              {currentStep > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setCurrentStep((prev) => (prev === 3 ? 2 : 1));
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#E87A18] hover:text-[#4A2E1B] transition-colors cursor-pointer px-2 py-1 rounded-lg bg-[#FAF6F0] border border-[#EDE4D5]"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span className="hidden xs:inline">Back</span>
                </button>
              )}
              {currentStep === 1 && selectedCustomer && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-200 truncate max-w-[140px]">
                  {selectedCustomer.fullName}
                </span>
              )}
              {currentStep === 2 && (
                <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-900 border-amber-200">
                  {selectedItemsList.length} Selected ({totalSelectedUnits} Units)
                </span>
              )}
              {currentStep === 3 && (
                <span className="text-[11px] font-black px-2.5 py-0.5 rounded-full border bg-emerald-50 text-emerald-900 border-emerald-200 font-mono">
                  {effectiveCreditAmount.toFixed(2)} ETB
                </span>
              )}
            </div>
          </div>

          {/* Visual Step Progress Bar */}
          <div className="w-full bg-[#FAF6F0] h-1.5 rounded-full overflow-hidden border border-[#EDE4D5]">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                currentStep === 1
                  ? "w-1/3 bg-[#E87A18]"
                  : currentStep === 2
                  ? "w-2/3 bg-[#E87A18]"
                  : "w-full bg-emerald-600"
              }`}
            />
          </div>
        </div>

        {/* STEP 1: CHOOSE CUSTOMER */}
        {currentStep === 1 && (
          <div className="space-y-4">
            {/* Mode Switcher: Existing vs New */}
            <div className="bg-[#FAF6F0] p-1.5 rounded-2xl border border-[#EDE4D5] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCustomerMode("EXISTING")}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                  customerMode === "EXISTING"
                    ? "bg-[#4A2E1B] text-white shadow-sm"
                    : "text-[#8C7361] hover:text-[#2C1B10]"
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Existing Customer ({customers.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setCustomerMode("NEW")}
                className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 ${
                  customerMode === "NEW"
                    ? "bg-[#4A2E1B] text-white shadow-sm"
                    : "text-[#8C7361] hover:text-[#2C1B10]"
                }`}
              >
                <UserPlus className="w-4 h-4" />
                <span>Register New Customer</span>
              </button>
            </div>

            {customerMode === "EXISTING" ? (
              <div className="bg-white border border-[#EDE4D5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
                {/* Search Bar */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
                  <Input
                    placeholder="Search by customer name or phone number..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="pl-10 h-11 rounded-xl bg-[#FAF6F0]/60 border-[#EDE4D5] text-sm"
                  />
                </div>

                {/* Customer Cards Grid */}
                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
                    <Skeleton className="h-24 rounded-2xl" />
                    <Skeleton className="h-24 rounded-2xl" />
                  </div>
                ) : filteredCustomers.length === 0 ? (
                  <div className="text-center py-10 border border-dashed border-[#EDE4D5] rounded-2xl">
                    <p className="text-sm font-bold text-[#8C7361]">No customers found matching &quot;{customerSearch}&quot;</p>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setCustomerMode("NEW");
                        setNewCustomerName(customerSearch);
                      }}
                      className="mt-3 text-xs font-bold border-[#EDE4D5] hover:bg-[#FAF6F0]"
                    >
                      <UserPlus className="w-3.5 h-3.5 mr-1.5" /> Add as new customer
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                    {filteredCustomers.map((cust) => {
                      const isSelected = selectedCustomerId === cust.id;
                      return (
                        <div
                          key={cust.id}
                          onClick={() => setSelectedCustomerId(cust.id)}
                          className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? "bg-amber-50/70 border-[#E87A18] ring-2 ring-[#E87A18]/30 shadow-xs"
                              : "bg-white hover:bg-[#FAF6F0]/50 border-[#EDE4D5]"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <h4 className="font-black text-sm text-[#2C1B10] truncate">{cust.fullName}</h4>
                              <p className="text-xs font-mono text-[#8C7361] mt-0.5">{cust.phone}</p>
                              {cust.address && (
                                <p className="text-[11px] text-[#A48F7F] mt-1 flex items-center gap-1 truncate">
                                  <MapPin className="w-3 h-3 shrink-0" /> {cust.address}
                                </p>
                              )}
                            </div>
                            <div className="shrink-0">
                              {isSelected ? (
                                <span className="w-6 h-6 rounded-full bg-[#E87A18] text-white flex items-center justify-center text-xs font-black shadow-xs">
                                  ✓
                                </span>
                              ) : (
                                <span className="w-6 h-6 rounded-full border border-zinc-200" />
                              )}
                            </div>
                          </div>

                          <div className="mt-3 pt-2 border-t border-[#F4ECE1] flex items-center justify-between text-xs">
                            <span className="text-[#8C7361] text-[10px] uppercase font-bold">Unpaid Credit</span>
                            <span className={`font-mono font-extrabold ${cust.totalRemaining > 0 ? "text-rose-700" : "text-emerald-700"}`}>
                              {Number(cust.totalRemaining || 0).toLocaleString()} ETB
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
                <h3 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#E87A18]" />
                  <span>Customer Information</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                      Full Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. Abebe Bikila"
                      value={newCustomerName}
                      onChange={(e) => setNewCustomerName(e.target.value)}
                      className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <Input
                      placeholder="e.g. 0911223344"
                      value={newCustomerPhone}
                      onChange={(e) => setNewCustomerPhone(e.target.value)}
                      className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5] font-mono"
                      required
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                      Address / Business Location (Optional)
                    </label>
                    <Input
                      placeholder="e.g. Shop #14, Main Market Road"
                      value={newCustomerAddress}
                      onChange={(e) => setNewCustomerAddress(e.target.value)}
                      className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Proceed Button for Step 1 */}
            <div className="flex justify-end pt-2">
              <Button
                type="button"
                size="lg"
                disabled={!canProceedFromStep1}
                onClick={() => {
                  if (canProceedFromStep1) {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }
                }}
                className="w-full sm:w-auto h-12 px-6 rounded-xl bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <span>Next: Select Products</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: CATEGORIZED PRODUCT SELECTION */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
              {/* Category Pills & Search Toolbar */}
              <div className="space-y-3 border-b border-[#F4ECE1] pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B]">
                    <Layers className="w-4 h-4 text-[#E87A18]" /> Filter by Category:
                  </div>
                  <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                    {selectedItemsList.length} Selected ({totalSelectedUnits} Units)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setProductCategoryFilter("ALL")}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      productCategoryFilter === "ALL"
                        ? "bg-[#4A2E1B] text-white shadow-2xs"
                        : "bg-[#FAF6F0] text-[#4A2E1B] hover:bg-[#EDE4D5]"
                    }`}
                  >
                    All Products ({products.length})
                  </button>
                  {productCategories.map((cat) => {
                    const count = products.filter((p) => p.categoryName === cat).length;
                    const isSelected = productCategoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setProductCategoryFilter(cat)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? "bg-[#4A2E1B] text-white shadow-2xs"
                            : "bg-[#FAF6F0] text-[#4A2E1B] hover:bg-[#EDE4D5]"
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1 rounded-full font-mono ${
                          isSelected ? "bg-white/20 text-white" : "bg-white text-[#8C7361]"
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Product Search */}
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
                  <Input
                    placeholder="Search product name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10 h-10 rounded-xl bg-[#FAF6F0]/50 border-[#EDE4D5] text-xs"
                  />
                </div>
              </div>

              {/* Product Selection Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[500px] overflow-y-auto pr-1">
                {filteredProducts.map((prod) => {
                  const qtyStr = selectedProductQuantities[prod.id] || "";
                  const qty = parseInt(qtyStr, 10) || 0;
                  const isSelected = qty > 0;
                  const isOverStock = qty > prod.availableStock;
                  const subTotal = qty * prod.basePrice;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isOverStock
                          ? "bg-rose-50/70 border-rose-300 ring-2 ring-rose-300"
                          : isSelected
                          ? "bg-amber-50/60 border-[#E87A18] ring-2 ring-[#E87A18]/20 shadow-xs"
                          : "bg-white hover:bg-[#FAF6F0]/40 border-[#EDE4D5]"
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1.5">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] truncate max-w-[130px]">
                            {prod.categoryName || "Bakery"}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${
                            prod.availableStock > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
                          }`}>
                            {prod.availableStock} {prod.unitType} in shop
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-[#2C1B10] leading-tight">
                          {getItemName(prod)}
                        </h4>
                        {prod.nameLatin && (
                          <p className="text-[11px] font-mono text-[#8C7361] mt-0.5">{prod.nameLatin}</p>
                        )}

                        <div className="mt-2 text-xs font-bold text-[#E87A18] font-mono">
                          {Number(prod.basePrice).toFixed(2)} ETB <span className="text-[10px] text-[#8C7361] font-normal">/ {prod.unitType}</span>
                        </div>
                      </div>

                      {/* Quantity Selector Controls */}
                      <div className="mt-3 pt-2.5 border-t border-[#F4ECE1]">
                        <div className="flex items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => decrementQty(prod.id)}
                            disabled={qty <= 0}
                            className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] hover:bg-[#FAF6F0]"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </Button>

                          <Input
                            type="number"
                            min="0"
                            max={prod.availableStock}
                            placeholder="0"
                            value={qtyStr}
                            onChange={(e) => setProductQty(prod.id, e.target.value)}
                            className={`h-8 text-center text-xs font-black rounded-lg border font-mono ${
                              isOverStock ? "border-rose-400 bg-rose-50 text-rose-900" : "border-[#EDE4D5] bg-white"
                            }`}
                          />

                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => incrementQty(prod.id)}
                            disabled={prod.availableStock <= 0 || qty >= prod.availableStock}
                            className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] hover:bg-[#FAF6F0]"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </Button>
                        </div>

                        {/* Subtotal / Warning indicator */}
                        {isOverStock ? (
                          <p className="text-[10px] text-rose-700 font-extrabold mt-1 text-center">
                            Exceeds shop stock ({prod.availableStock} max)
                          </p>
                        ) : isSelected ? (
                          <p className="text-[11px] text-[#2C1B10] font-bold mt-1 text-right font-mono">
                            Subtotal: <strong className="text-[#E87A18] font-black">{subTotal.toFixed(2)} ETB</strong>
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2 Bottom Sticky Navigation */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setCurrentStep(1);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="h-12 px-5 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Customer</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] text-[#8C7361] font-bold uppercase block">Total Credit</span>
                  <span className="text-base font-black text-[#E87A18] font-mono">{totalCalculatedBirr.toFixed(2)} ETB</span>
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={!canProceedFromStep2}
                  onClick={() => {
                    if (canProceedFromStep2) {
                      setCurrentStep(3);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  className="h-12 px-6 rounded-xl bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-sm flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <span>Next: Review & Summary ({selectedItemsList.length})</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION, SUMMARY & ADDITIONAL NOTES */}
        {currentStep === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Customer Summary Card */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#8C7361] tracking-wider block">Customer</span>
                  <h3 className="font-black text-base text-[#2C1B10]">
                    {customerMode === "EXISTING" ? selectedCustomer?.fullName : newCustomerName}
                  </h3>
                  <p className="text-xs font-mono text-[#8C7361]">
                    {customerMode === "EXISTING" ? selectedCustomer?.phone : newCustomerPhone}
                    {(customerMode === "EXISTING" ? selectedCustomer?.address : newCustomerAddress) && ` • ${(customerMode === "EXISTING" ? selectedCustomer?.address : newCustomerAddress)}`}
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="h-8 text-xs font-bold border-[#EDE4D5] hover:bg-[#FAF6F0] rounded-xl self-end sm:self-center"
              >
                Change Customer
              </Button>
            </div>

            {/* Redesigned Selected Products Summary Card */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-[#F4ECE1] pb-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-[#E87A18]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-black text-sm sm:text-base text-[#2C1B10]">
                      Selected Products
                    </h3>
                    <p className="text-[11px] text-[#8C7361] font-semibold">
                      {selectedItemsList.length} distinct item{selectedItemsList.length === 1 ? "" : "s"} ({totalSelectedUnits} total units)
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="h-8 px-3 text-xs font-bold border-[#EDE4D5] hover:bg-[#FAF6F0] rounded-xl text-[#4A2E1B] flex items-center gap-1.5 cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5 text-[#E87A18]" />
                  <span>Edit Products</span>
                </Button>
              </div>

              {/* Items Table with modern styled rows */}
              <div className="overflow-x-auto rounded-2xl border border-[#F4ECE1]">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#FAF6F0]/70 text-[#8C7361] border-b border-[#F4ECE1]">
                      <th className="py-2.5 px-3 font-extrabold uppercase text-[10px]">Product</th>
                      <th className="py-2.5 px-3 text-center font-extrabold uppercase text-[10px]">Quantity</th>
                      <th className="py-2.5 px-3 text-right font-extrabold uppercase text-[10px]">Catalog Rate</th>
                      <th className="py-2.5 px-3 text-right font-extrabold uppercase text-[10px]">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4ECE1]">
                    {selectedItemsList.map((it) => (
                      <tr key={it.productId} className="hover:bg-[#FAF6F0]/40 transition-colors">
                        <td className="py-3 px-3">
                          <span className="font-black text-sm text-[#2C1B10] block">{getItemName(it.product)}</span>
                          <span className="text-[10px] text-[#8C7361] font-medium">{it.product?.categoryName || "Bakery"}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="inline-block px-2.5 py-1 rounded-lg bg-[#FAF6F0] text-[#2C1B10] font-mono font-black text-xs border border-[#EDE4D5]">
                            {it.quantity} {it.product?.unitType}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs text-[#8C7361] font-bold">
                          {it.unitPrice.toFixed(2)} ETB
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-black text-sm text-[#E87A18]">
                          {it.totalPrice.toFixed(2)} ETB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Calculation & Customizable Selling Price (Bulk Discount) */}
              <div className="bg-gradient-to-br from-[#FAF6F0] to-[#F5ECE1] border border-[#EDE4D5] p-4 sm:p-5 rounded-2xl space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#EDE4D5]">
                  <div>
                    <span className="text-[10px] uppercase font-black text-[#8C7361] tracking-wider block">Standard Catalog Value</span>
                    <span className="text-sm font-bold text-[#4A2E1B]">{totalSelectedUnits} total items from shop inventory</span>
                  </div>
                  <div className="text-left sm:text-right">
                    <span className="text-lg font-black text-[#8C7361] font-mono line-through mr-2">
                      {sellingPriceInput && parseFloat(sellingPriceInput) !== totalCalculatedBirr ? `${totalCalculatedBirr.toFixed(2)} ETB` : ""}
                    </span>
                    <span className="text-xl sm:text-2xl font-black text-[#2C1B10] font-mono">
                      {totalCalculatedBirr.toFixed(2)} ETB
                    </span>
                  </div>
                </div>

                {/* Selling Price Input for Custom / Bulk Discount */}
                <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-[#EDE4D5] shadow-xs space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-black text-[#2C1B10] uppercase flex items-center gap-1.5">
                      <span>Selling Price / Total Credit Amount (ETB) *</span>
                      <span className="text-emerald-700 text-[10px] font-extrabold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Discount Allowed
                      </span>
                    </label>
                    {sellingPriceInput.trim() !== "" && parseFloat(sellingPriceInput) !== totalCalculatedBirr && (
                      <button
                        type="button"
                        onClick={() => setSellingPriceInput("")}
                        className="text-[11px] font-extrabold text-[#E87A18] hover:underline self-start sm:self-auto cursor-pointer"
                      >
                        Reset to standard ({totalCalculatedBirr.toFixed(2)} ETB)
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-[#8C7361] font-medium">
                    Cashiers can adjust this input if customer gets a wholesale or bulk discount.
                  </p>

                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder={totalCalculatedBirr.toFixed(2)}
                      value={sellingPriceInput}
                      onChange={(e) => setSellingPriceInput(e.target.value)}
                      className="h-12 text-lg sm:text-xl font-black font-mono rounded-xl bg-[#FAF6F0]/60 border-2 border-[#E87A18]/40 focus:border-[#E87A18] text-[#2C1B10] pr-16"
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-black text-[#8C7361]">
                      ETB
                    </span>
                  </div>

                  {/* Bulk discount savings banner */}
                  {effectiveCreditAmount < totalCalculatedBirr && (
                    <div className="flex items-center justify-between text-xs font-extrabold text-emerald-800 bg-emerald-50 px-3 py-2 rounded-xl border border-emerald-200">
                      <span className="flex items-center gap-1.5">
                        <span>🏷️</span>
                        <span>Bulk Discount Applied</span>
                      </span>
                      <span className="font-mono">
                        -{(totalCalculatedBirr - effectiveCreditAmount).toFixed(2)} ETB ({Math.round(((totalCalculatedBirr - effectiveCreditAmount) / (totalCalculatedBirr || 1)) * 100)}% off)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Transaction Date & Notes Configuration (Due Date removed per instructions) */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#E87A18]" />
                <span>Transaction Date & Notes</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                    Credit Date *
                  </label>
                  <AppDatePicker
                    value={creditDate}
                    onChange={(val) => setCreditDate(val)}
                    className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                    Additional Notes / Reference (Optional)
                  </label>
                  <Input
                    placeholder="e.g. Special order pickup, negotiated bulk discount"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                  />
                </div>
              </div>
            </div>

            {/* Redesigned Step 3 Bottom Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSubmitting}
                onClick={() => {
                  setCurrentStep(2);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full sm:w-auto h-12 px-6 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer order-2 sm:order-1"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Back to Products</span>
              </Button>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || effectiveCreditAmount <= 0}
                className="w-full sm:w-auto h-12 px-8 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 order-1 sm:order-2 shrink-0"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isSubmitting
                    ? "Recording Credit..."
                    : isEditMode
                    ? `Save & Update Credit (${effectiveCreditAmount.toFixed(2)} ETB)`
                    : `Confirm & Record Credit (${effectiveCreditAmount.toFixed(2)} ETB)`}
                </span>
              </Button>
            </div>
          </form>
        )}

        {/* Unsaved Changes Confirmation Modal */}
        <UnsavedChangesDialog
          isOpen={showUnsavedDialog}
          onStay={() => setShowUnsavedDialog(false)}
          onOpenChange={(open) => setShowUnsavedDialog(open)}
          onConfirmDiscard={() => {
            setShowUnsavedDialog(false);
            router.push("/customer-credits");
          }}
        />
      </div>
    </DashboardLayout>
  );
}

export default function NewCustomerCreditPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
          <p className="text-[#4A2E1B] font-bold text-sm">Loading Customer Credit...</p>
        </div>
      }
    >
      <NewCustomerCreditFormContent />
    </Suspense>
  );
}
