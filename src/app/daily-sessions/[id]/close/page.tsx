"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Plus, Trash2, Banknote, Smartphone, CreditCard, DollarSign, PackageCheck, ShoppingCart, Tag, RefreshCw, Eye, Edit3 } from "lucide-react";

interface Product {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
  category?: { type: string };
}

interface Supplier {
  id: string;
  name: string;
  type: string;
}

interface LeftoverItem {
  productId: string;
  product?: Product;
  quantityRemaining: number;
  damagedQuantity: number;
  damageReason: string;
}

interface ExpenseItem {
  id?: string;
  amount: number;
  category: string;
  description: string;
}

interface ProductionSummaryItem {
  productId: string;
  productName: string;
  unitType: string;
  categoryName?: string;
  categoryType?: string;
  totalProduced: number;
}

interface SupplierDeliveryItem {
  id: string;
  supplierId: string;
  supplier: { id: string; name: string };
  productId: string;
  product: { id: string; name: string };
  quantityReceived: number;
  unitBuyPrice: number;
  unitSellPrice: number;
  isPaid: boolean;
  createdAt: string;
}

interface DailySessionDetail {
  id: string;
  branchId: string;
  branch?: { id: string; name: string };
  date: string;
  label?: string | null;
  status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED";
  openingCashFloat?: number | null;
  cashLeftoverAmount?: number | null;
  actualCashAmount?: number | null;
  actualCbeAmount?: number | null;
  actualTelebirrAmount?: number | null;
  notes?: string | null;
  sales?: any[];
  expenses?: any[];
  leftoverRecords?: LeftoverItem[];
  productionSummary?: ProductionSummaryItem[];
  supplierDeliveries?: SupplierDeliveryItem[];
}

const EXPENSE_CATEGORIES = [
  { value: "STAFF_LOAN", label: "Staff Loan / Salary Advance" },
  { value: "RAW_MATERIALS", label: "Raw Materials / Flour / Ingredients" },
  { value: "UTILITIES", label: "Utilities (Water / Power / Gas)" },
  { value: "TRANSPORT", label: "Transport / Fuel / Freight" },
  { value: "LUNCH", label: "Staff Food / Lunch" },
  { value: "RENT", label: "Rent & Facilities" },
  { value: "MISC", label: "Miscellaneous / Other" },
];

export default function SessionClosePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const [session, setSession] = useState<DailySessionDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isViewOnly, setIsViewOnly] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const modeParam = new URLSearchParams(window.location.search).get("mode");
      if (modeParam === "view") {
        setIsViewOnly(true);
      }
    }
  }, []);

  // Form State
  const [sessionLabel, setSessionLabel] = useState<string>("");
  const [actualCash, setActualCash] = useState<string>("");
  const [actualCbe, setActualCbe] = useState<string>("");
  const [actualTelebirr, setActualTelebirr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [leftovers, setLeftovers] = useState<Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }>>({});
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);

  // Resells Log Modal State
  const [isResellModalOpen, setIsResellModalOpen] = useState(false);
  const [resellSupplierId, setResellSupplierId] = useState("");
  const [resellProductId, setResellProductId] = useState("");
  const [resellQty, setResellQty] = useState("1");
  const [resellBuyPrice, setResellBuyPrice] = useState("");
  const [resellSellPrice, setResellSellPrice] = useState("");
  const [resellIsPaid, setResellIsPaid] = useState(true);
  const [isLoggingResell, setIsLoggingResell] = useState(false);

  useEffect(() => {
    fetchSessionAndProducts();
  }, [resolvedParams.id]);

  const fetchSessionAndProducts = async () => {
    setIsLoading(true);
    try {
      const [resSess, resProd] = await Promise.all([
        api.get(`/daily-sessions/${resolvedParams.id}`),
        api.get(`/products?isActive=true`),
      ]);
      const s: DailySessionDetail = resSess.data;
      setSession(s);
      setProducts(resProd.data);

      // Check Midnight & Closed Session Lockout for Cashier
      const ethTodayYmd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
      const sessionYmd = s.date ? new Date(s.date).toISOString().slice(0, 10) : "";
      if (sessionYmd < ethTodayYmd || s.status === "CLOSED" || s.status === "CLOSE_PENDING" || !isAdminOrOwner) {
        if (s.status === "CLOSED" || s.status === "CLOSE_PENDING" || sessionYmd < ethTodayYmd) {
          setIsViewOnly(true);
        }
      }

      setSessionLabel(s.label || `Session - ${new Date(s.date).toISOString().split("T")[0]}`);
      setActualCash(
        s.actualCashAmount != null
          ? String(s.actualCashAmount)
          : s.cashLeftoverAmount != null
          ? String(s.cashLeftoverAmount)
          : ""
      );
      setActualCbe(s.actualCbeAmount != null ? String(s.actualCbeAmount) : "");
      setActualTelebirr(s.actualTelebirrAmount != null ? String(s.actualTelebirrAmount) : "");
      setNotes(s.notes || "");

      // Populate leftovers map
      const initialLeftovers: Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }> = {};
      (resProd.data || []).forEach((p: Product) => {
        const existing = (s.leftoverRecords || []).find((r) => r.productId === p.id);
        initialLeftovers[p.id] = {
          quantityRemaining: existing ? existing.quantityRemaining : 0,
          damagedQuantity: existing ? existing.damagedQuantity : 0,
          damageReason: existing ? existing.damageReason || "" : "",
        };
      });
      setLeftovers(initialLeftovers);

      // Populate expenses list
      const initialExpenses: ExpenseItem[] = (s.expenses || []).map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category || "MISC",
        description: e.description || "",
      }));
      setExpenseList(initialExpenses);

      // Fetch suppliers for resell modal
      if (s.branchId) {
        const suppRes = await api.get(`/suppliers?branchId=${s.branchId}`);
        setSuppliers(suppRes.data);
      }
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load session closing details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpenseRow = () => {
    setExpenseList((prev) => [
      ...prev,
      { amount: 0, category: "STAFF_LOAN", description: "" },
    ]);
  };

  const handleRemoveExpenseRow = (index: number) => {
    setExpenseList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExpenseChange = (index: number, field: keyof ExpenseItem, value: any) => {
    setExpenseList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleLeftoverChange = (productId: string, field: "quantityRemaining" | "damagedQuantity" | "damageReason", value: any) => {
    setLeftovers((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: field === "damageReason" ? value : Math.max(0, Number(value) || 0),
      },
    }));
  };

  const handleLogResellDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellSupplierId || !resellProductId || !resellQty || !resellBuyPrice) {
      toast.error("Supplier, product, quantity, and buy price are required");
      return;
    }
    setIsLoggingResell(true);
    try {
      await api.post("/supplier-deliveries", {
        supplierId: resellSupplierId,
        productId: resellProductId,
        quantityReceived: Number(resellQty),
        unitBuyPrice: Number(resellBuyPrice),
        unitSellPrice: resellSellPrice ? Number(resellSellPrice) : undefined,
        isPaid: resellIsPaid,
        sessionId: resolvedParams.id,
      });
      toast.success("Resell delivery logged for this session!");
      setIsResellModalOpen(false);
      setResellSupplierId("");
      setResellProductId("");
      setResellQty("1");
      setResellBuyPrice("");
      setResellSellPrice("");
      fetchSessionAndProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log resell delivery");
    } finally {
      setIsLoggingResell(false);
    }
  };

  const buildPayload = () => {
    const formattedLeftovers = Object.entries(leftovers).map(([productId, val]) => ({
      productId,
      quantityRemaining: val.quantityRemaining,
      damagedQuantity: val.damagedQuantity,
      damageReason: val.damageReason,
    }));

    // Validate leftover quantities against available stock limits
    const availableStockSummary = (session as any)?.availableStockSummary || {};
    for (const [productId, val] of Object.entries(leftovers)) {
      const stockInfo = availableStockSummary[productId];
      if (stockInfo && val.quantityRemaining > stockInfo.maxAvailable) {
        toast.error(
          `Cannot save leftover of ${val.quantityRemaining} Pcs for ${stockInfo.productName}. Maximum available in this session is ${stockInfo.maxAvailable} Pcs (Produced/Delivered: ${stockInfo.producedQty + stockInfo.deliveredQty}, Sold: ${stockInfo.soldQty}). Please correct it.`
        );
        return null;
      }
    }

    return {
      label: sessionLabel.trim() || null,
      actualCashAmount: actualCash !== "" ? Number(actualCash) : null,
      actualCbeAmount: actualCbe !== "" ? Number(actualCbe) : null,
      actualTelebirrAmount: actualTelebirr !== "" ? Number(actualTelebirr) : null,
      notes: notes.trim() || null,
      leftoverRecords: formattedLeftovers,
      expenses: expenseList.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category,
        description: e.description,
      })),
    };
  };

  const handleSaveEdits = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setIsSubmitting(true);
    try {
      await api.patch(`/daily-sessions/${resolvedParams.id}`, payload);
      toast.success("Session edits saved successfully!");
      fetchSessionAndProducts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to save session edits");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitClose = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      await api.post(`/daily-sessions/${resolvedParams.id}/submit-close`, payload);
      toast.success("Session close request submitted to Admin/Owner for approval");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to submit close request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeApprove = async () => {
    if (!isAdminOrOwner) {
      toast.error("Only Owners and Admins can finalize session approval");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      await api.post(`/daily-sessions/${resolvedParams.id}/finalize`, payload);
      toast.success("Session close request approved and finalized!");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to finalize session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenSession = async () => {
    if (!isAdminOrOwner) {
      toast.error("Only Owners and Admins can reopen a session");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/daily-sessions/${resolvedParams.id}/reopen`);
      toast.success("Session reopened to OPEN status");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to reopen session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseSum = expenseList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalEnteredCash = (Number(actualCash) || 0) + (Number(actualCbe) || 0) + (Number(actualTelebirr) || 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-[#8C7361] font-semibold">Loading session details...</div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-red-600 font-semibold">Session not found.</div>
      </DashboardLayout>
    );
  }

  const productionSummary = session.productionSummary || [];
  const supplierDeliveries = session.supplierDeliveries || [];

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={() => router.push("/daily-sessions")} className="p-2 rounded-xl text-[#8C7361] hover:bg-[#F4ECE1]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-[#E87A18]" />
              <Input
                type="text"
                placeholder="Session Name / Label (e.g. Morning Shift)"
                value={sessionLabel}
                disabled={isViewOnly}
                onChange={(e) => setSessionLabel(e.target.value)}
                className="font-extrabold text-lg text-[#2C1B10] bg-transparent border-b border-[#EDE4D5] rounded-none focus:border-[#E87A18] focus:ring-0 p-0 h-auto w-72 disabled:opacity-90"
              />
            </div>
            <p className="text-xs text-[#8C7361] mt-1">
              Date: <strong className="text-[#2C1B10]">{new Date(session.date).toISOString().split("T")[0]}</strong> | Branch: <strong className="text-[#2C1B10]">{session.branch?.name || "Main Branch"}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5]">
            <Button
              size="sm"
              variant={isViewOnly ? "default" : "ghost"}
              onClick={() => setIsViewOnly(true)}
              className={isViewOnly ? "bg-indigo-700 text-white font-bold text-xs rounded-lg shadow-xs" : "text-[#8C7361] text-xs hover:bg-[#F4ECE1]"}
            >
              <Eye className="w-3.5 h-3.5 mr-1" /> View Mode
            </Button>
            <Button
              size="sm"
              variant={!isViewOnly ? "default" : "ghost"}
              onClick={() => {
                if (session.status === "CLOSED" || session.status === "CLOSE_PENDING") {
                  if (!isAdminOrOwner) {
                    toast.error("Cashiers cannot edit closed or pending-close sessions.");
                    return;
                  }
                }
                setIsViewOnly(false);
              }}
              className={!isViewOnly ? "bg-[#4A2E1B] text-white font-bold text-xs rounded-lg shadow-xs" : "text-[#8C7361] text-xs hover:bg-[#F4ECE1]"}
            >
              <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit Mode
            </Button>
          </div>

          <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
            session.status === "CLOSED"
              ? "bg-zinc-100 text-zinc-800 border-zinc-300"
              : session.status === "CLOSE_PENDING"
              ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
              : "bg-emerald-100 text-emerald-800 border-emerald-300"
          }`}>
            Status: {session.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Approval Status Banner */}
      {session.status === "CLOSE_PENDING" && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-sm">Session Close Pending Approval</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              {isAdminOrOwner
                ? "The cashier has submitted the close report with cash types and expenses. You can review, edit any figures, and approve the closure below."
                : "Your close request has been submitted to the Admin / Owner. Waiting for approval."}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Detailed Daily Production & Resell Breakdown */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <PackageCheck className="w-5 h-5 text-emerald-600" /> Detailed Session Production & Resell Summary
              </h2>
              <p className="text-xs text-[#8C7361] mt-0.5">
                Categorized breakdown of produced items and resale stock logged in this shift.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-3 py-1 bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200">
                {productionSummary.reduce((acc, p) => acc + p.totalProduced, 0)} Pcs Produced
              </span>
              <span className="text-xs font-bold px-3 py-1 bg-indigo-50 text-indigo-800 rounded-full border border-indigo-200">
                {supplierDeliveries.reduce((acc, d) => acc + d.quantityReceived, 0)} Resell Pcs Delivered
              </span>
            </div>
          </div>

          {productionSummary.length === 0 && supplierDeliveries.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
              No production batches or resell deliveries recorded for this session date yet.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Group items by Category */}
              {Object.entries(
                productionSummary.reduce((acc, item) => {
                  const cat = item.categoryName || "General Bakery";
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(item);
                  return acc;
                }, {} as Record<string, ProductionSummaryItem[]>)
              ).map(([catName, catItems]) => (
                <div key={catName} className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5] space-y-3">
                  <div className="flex items-center justify-between border-b border-[#EDE4D5] pb-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-[#4A2E1B] flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[#E87A18]" /> Category: {catName}
                    </span>
                    <span className="text-[11px] font-bold text-[#8C7361] font-mono">
                      {catItems.reduce((s, i) => s + i.totalProduced, 0)} Pcs
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                    {catItems.map((item) => (
                      <div key={item.productId} className="bg-white p-3 rounded-lg border border-[#EDE4D5] flex items-center justify-between shadow-2xs">
                        <div>
                          <h4 className="font-extrabold text-xs text-[#2C1B10]">{item.productName}</h4>
                          <span className="text-[10px] font-semibold text-zinc-400 uppercase">{item.unitType}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-base font-extrabold font-mono text-emerald-700">{item.totalProduced}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 2: Payment Channel Breakdown (Cash, CBE, Telebirr) */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#2C1B10] mb-1 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#E87A18]" /> Payment Methods & Cash Reconciliation
          </h2>
          <p className="text-xs text-[#8C7361] mb-5">
            Break down the actual collected funds into Physical Cash, CBE Transfer, and Telebirr mobile money.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center justify-between gap-1.5 mb-2">
                <span className="flex items-center gap-1.5">
                  <Banknote className="w-4 h-4 text-emerald-600" /> Physical Cash (Normal Cash)
                </span>
                {session?.cashLeftoverAmount != null && (
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                    Cashier Reported Leftover: {Number(session.cashLeftoverAmount).toFixed(2)} ETB
                  </span>
                )}
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualCash}
                disabled={isViewOnly}
                onChange={(e) => setActualCash(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base disabled:opacity-80"
              />
            </div>

            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> CBE Mobile Banking / Transfer
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualCbe}
                disabled={isViewOnly}
                onChange={(e) => setActualCbe(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base disabled:opacity-80"
              />
            </div>

            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5 mb-2">
                <Smartphone className="w-4 h-4 text-purple-600" /> Telebirr Mobile Money
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualTelebirr}
                disabled={isViewOnly}
                onChange={(e) => setActualTelebirr(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base disabled:opacity-80"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#F4ECE1] flex items-center justify-between text-xs text-[#8C7361]">
            <span>Opening Float: <strong className="text-[#2C1B10]">{session.openingCashFloat ?? 0} ETB</strong></span>
            <span>Total Accounted Revenue: <strong className="text-[#E87A18] font-mono text-sm">{totalEnteredCash.toFixed(2)} ETB</strong></span>
          </div>
        </div>

        {/* Section 3: Session Expenses & Loans List */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2C1B10]">Session Expenses & Staff Loans</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">
                List all expenses paid during this shift (including staff loans, transport, raw material purchases, etc.)
              </p>
            </div>
            <Button onClick={handleAddExpenseRow} disabled={isViewOnly} size="sm" className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] text-xs font-bold rounded-xl disabled:opacity-50">
              <Plus className="w-4 h-4 mr-1" /> Add Expense Item
            </Button>
          </div>

          {expenseList.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
              No expenses recorded for this session yet. Click "Add Expense Item" to add staff loans or operational costs.
            </div>
          ) : (
            <div className="space-y-3">
              {expenseList.map((exp, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5]">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Expense Type</label>
                    <select
                      value={exp.category}
                      disabled={isViewOnly}
                      onChange={(e) => handleExpenseChange(idx, "category", e.target.value)}
                      className="w-full bg-white border border-[#EDE4D5] rounded-lg h-9 text-xs px-2 font-medium disabled:opacity-80"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Amount (ETB)</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={exp.amount || ""}
                      disabled={isViewOnly}
                      onChange={(e) => handleExpenseChange(idx, "amount", e.target.value)}
                      className="bg-white border-[#EDE4D5] h-9 text-xs font-mono font-bold disabled:opacity-80"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Description / Person / Reason</label>
                    <Input
                      type="text"
                      placeholder="e.g. Employee advance to Abebe / Flour purchase"
                      value={exp.description || ""}
                      disabled={isViewOnly}
                      onChange={(e) => handleExpenseChange(idx, "description", e.target.value)}
                      className="bg-white border-[#EDE4D5] h-9 text-xs disabled:opacity-80"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isViewOnly}
                      onClick={() => handleRemoveExpenseRow(idx)}
                      className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-50 rounded-lg disabled:opacity-40"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#F4ECE1] text-right">
            <span className="text-xs font-bold text-[#8C7361]">
              Total Session Expenses: <strong className="text-rose-600 font-mono text-sm ml-1">{totalExpenseSum.toFixed(2)} ETB</strong>
            </span>
          </div>
        </div>

        {/* Section 4: Resells & Supplier Purchases (Session-Based) */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" /> Resell Products & Supplier Deliveries
              </h2>
              <p className="text-xs text-[#8C7361] mt-0.5">
                External products purchased for resell (drinks, snacks, milk, water) during this session.
              </p>
            </div>
            <Button onClick={() => setIsResellModalOpen(true)} size="sm" className="bg-indigo-700 text-white hover:bg-indigo-800 text-xs font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Log Resell Delivery
            </Button>
          </div>

          {supplierDeliveries.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
              No resell deliveries logged during this session. Click "Log Resell Delivery" to record supplier purchases.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#EDE4D5] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                  <tr>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Supplier</th>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Resell Product</th>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Qty Received</th>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Buy Price</th>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Sell Price</th>
                    <th className="p-3 font-extrabold text-[#2C1B10]">Payment Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F4ECE1]">
                  {supplierDeliveries.map((del) => (
                    <tr key={del.id}>
                      <td className="p-3 font-bold text-[#2C1B10]">{del.supplier?.name || "Supplier"}</td>
                      <td className="p-3 font-semibold text-zinc-900">{del.product?.name || "Product"}</td>
                      <td className="p-3 font-mono font-bold text-amber-700">{del.quantityReceived} Pcs</td>
                      <td className="p-3 font-mono">{Number(del.unitBuyPrice).toFixed(2)} ETB</td>
                      <td className="p-3 font-mono">{Number(del.unitSellPrice).toFixed(2)} ETB</td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          del.isPaid ? "bg-emerald-100 text-emerald-800" : "bg-rose-100 text-rose-800"
                        }`}>
                          {del.isPaid ? "Paid" : "Credit"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 5: Leftover Product Counts (Adari) & Damage */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#2C1B10] mb-1">Product Leftovers (Adari) & Losses</h2>
          <p className="text-xs text-[#8C7361] mb-4">
            Enter the remaining unsold product quantities and any damaged items. Unsold leftovers cannot exceed total stock available in this session.
          </p>

          <div className="overflow-x-auto border border-[#EDE4D5] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <tr>
                  <th className="p-3 font-extrabold text-[#2C1B10]">Product Name & Session Stock</th>
                  <th className="p-3 font-extrabold text-[#2C1B10] w-48">Unsold Remaining (Pcs)</th>
                  <th className="p-3 font-extrabold text-[#2C1B10] w-36">Damaged (Pcs)</th>
                  <th className="p-3 font-extrabold text-[#2C1B10]">Damage Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4ECE1]">
                {products.map((p) => {
                  const val = leftovers[p.id] || { quantityRemaining: 0, damagedQuantity: 0, damageReason: "" };
                  const availableStockSummary = (session as any)?.availableStockSummary || {};
                  const stockInfo = availableStockSummary[p.id];
                  const maxAvail = stockInfo ? stockInfo.maxAvailable : 999999;
                  const isOverMax = val.quantityRemaining > maxAvail;

                  return (
                    <tr key={p.id} className={isOverMax ? "bg-rose-50/50" : ""}>
                      <td className="p-3">
                        <div className="font-extrabold text-xs text-[#2C1B10]">{p.name}</div>
                        <div className="text-[10px] font-semibold text-[#8C7361] mt-0.5">
                          Max Available Stock: <strong className="text-amber-800 font-mono font-bold">{stockInfo ? stockInfo.maxAvailable : 0} Pcs</strong>
                          {stockInfo && (
                            <span> (Produced/Delivered: {stockInfo.producedQty + stockInfo.deliveredQty}, Sold: {stockInfo.soldQty})</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          max={maxAvail}
                          value={val.quantityRemaining}
                          disabled={isViewOnly}
                          onChange={(e) => handleLeftoverChange(p.id, "quantityRemaining", e.target.value)}
                          className={`h-8 text-xs font-bold font-mono bg-white border-[#EDE4D5] disabled:opacity-80 ${
                            isOverMax ? "border-rose-500 bg-rose-50 text-rose-900 ring-1 ring-rose-500" : ""
                          }`}
                        />
                        {isOverMax && (
                          <span className="text-[10px] font-extrabold text-rose-600 block mt-1">
                            ⚠️ Exceeds max available ({maxAvail} Pcs)
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          value={val.damagedQuantity}
                          disabled={isViewOnly}
                          onChange={(e) => handleLeftoverChange(p.id, "damagedQuantity", e.target.value)}
                          className="h-8 text-xs bg-white border-[#EDE4D5] disabled:opacity-80"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          placeholder="Reason if damaged..."
                          value={val.damageReason}
                          disabled={isViewOnly}
                          onChange={(e) => handleLeftoverChange(p.id, "damageReason", e.target.value)}
                          className="h-8 text-xs bg-white border-[#EDE4D5] disabled:opacity-80"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 6: Notes & Submission Controls */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-[#2C1B10] block mb-1">Session Closing Notes / Remarks</label>
            <textarea
              rows={3}
              placeholder="Add any remarks regarding sales, stock differences, or staff notes..."
              value={notes}
              disabled={isViewOnly}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 text-xs disabled:opacity-80"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#F4ECE1]">
            <Button variant="outline" onClick={() => router.push("/daily-sessions")} className="border-[#EDE4D5] text-[#8C7361] hover:bg-[#F4ECE1]">
              Cancel
            </Button>

            <div className="flex items-center space-x-3">
              {/* Save Edits without changing status */}
              <Button
                onClick={handleSaveEdits}
                disabled={isSubmitting || isViewOnly}
                className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold text-xs sm:text-sm rounded-xl px-5 shadow-sm disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-1.5" /> Save Session Edits
              </Button>

              {/* Cashier Submit Request */}
              {session.status !== "CLOSED" && (
                <Button
                  onClick={handleSubmitClose}
                  disabled={isSubmitting}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs sm:text-sm rounded-xl px-5 shadow-sm"
                >
                  Submit for Admin Approval
                </Button>
              )}

              {/* Admin / Owner Finalize & Approve */}
              {isAdminOrOwner && session.status !== "CLOSED" && (
                <Button
                  onClick={handleFinalizeApprove}
                  disabled={isSubmitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl px-5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve & Finalize Close
                </Button>
              )}

              {isAdminOrOwner && session.status === "CLOSE_PENDING" && (
                <Button
                  onClick={handleReopenSession}
                  disabled={isSubmitting}
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl"
                >
                  Reopen Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log Resell Delivery Modal */}
      <Dialog open={isResellModalOpen} onOpenChange={setIsResellModalOpen}>
        <DialogContent className="sm:max-w-md bg-white border-[#EDE4D5] rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-indigo-600" /> Log Resell Product Delivery
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleLogResellDelivery} className="space-y-4 py-2">
            <div>
              <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Supplier</label>
              <select
                required
                value={resellSupplierId}
                onChange={(e) => setResellSupplierId(e.target.value)}
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
              >
                <option value="">Select Supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Resell Product</label>
              <select
                required
                value={resellProductId}
                onChange={(e) => {
                  setResellProductId(e.target.value);
                  const p = products.find((pr) => pr.id === e.target.value);
                  if (p) setResellSellPrice(String(p.basePrice));
                }}
                className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
              >
                <option value="">Select Product...</option>
                {products
                  .filter((p) => p.category?.type === 'RESELL' || p.category?.type !== 'PRODUCED')
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.unitType}) - {p.basePrice} ETB</option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Quantity Received</label>
                <Input
                  type="number"
                  min="1"
                  required
                  value={resellQty}
                  onChange={(e) => setResellQty(e.target.value)}
                  className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Unit Buy Price (ETB)</label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={resellBuyPrice}
                  onChange={(e) => setResellBuyPrice(e.target.value)}
                  className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Unit Sell Price (ETB)</label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={resellSellPrice}
                  onChange={(e) => setResellSellPrice(e.target.value)}
                  className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono font-bold"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Payment Status</label>
                <select
                  value={resellIsPaid ? "true" : "false"}
                  onChange={(e) => setResellIsPaid(e.target.value === "true")}
                  className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                >
                  <option value="true">Paid Cash / Instant</option>
                  <option value="false">On Credit (Unpaid)</option>
                </select>
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsResellModalOpen(false)} className="border-[#EDE4D5] rounded-xl text-xs">
                Cancel
              </Button>
              <Button type="submit" disabled={isLoggingResell} className="bg-indigo-700 hover:bg-indigo-800 text-white rounded-xl text-xs font-bold">
                {isLoggingResell ? "Logging..." : "Save Resell Delivery"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
