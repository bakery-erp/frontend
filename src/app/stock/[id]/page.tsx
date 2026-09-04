"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import { 
  ArrowLeft, 
  AlertCircle, 
  MinusCircle, 
  PlusCircle, 
  Edit3, 
  History, 
  ArrowUpRight, 
  ArrowDownLeft, 
  RefreshCw, 
  UserCheck, 
  Building2, 
  Package, 
  Layers
} from "lucide-react";

interface Branch {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unitType: "PIECE" | "KG" | "LITER";
  currentQuantity: number;
  unitPrice?: number;
  minStockLevel?: number;
  branchId: string;
  branch?: Branch;
}

interface StockPurchasePayment {
  id: string;
  loanId: string;
  userId: string;
  amount: number;
  note?: string;
  createdAt: string;
  user?: {
    id: string;
    fullName: string;
  };
}

interface StockPurchaseLoan {
  id: string;
  stockMovementId: string;
  stockItemId: string;
  branchId: string;
  supplierName?: string;
  totalAmount: number;
  paidAmount: number;
  remainingBalance: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
  updatedAt: string;
  payments?: StockPurchasePayment[];
}

interface StockMovement {
  id: string;
  stockItemId: string;
  userId: string;
  quantity: number | string;
  unitPrice?: number;
  totalValue?: number;
  type: "IN" | "OUT" | "ADJUSTMENT" | "PRODUCTION_USAGE";
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
  purchaseLoan?: StockPurchaseLoan;
}

interface HistoryData {
  stockItem: StockItem;
  movements: StockMovement[];
  totalIn: number;
  totalOut: number;
  totalValueIn?: number;
  totalValueOut?: number;
  currentValuation?: number;
}

export default function StockItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const itemId = params.id as string;

  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [data, setData] = useState<HistoryData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>("ALL");

  // Modals inside detail page
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");

  // Add stock loan state
  const [isAddLoan, setIsAddLoan] = useState<boolean>(false);
  const [addPaidAmount, setAddPaidAmount] = useState<string>("");
  const [addSupplierName, setAddSupplierName] = useState<string>("");

  // Repayment Modal state
  const [selectedLoan, setSelectedLoan] = useState<StockPurchaseLoan | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [isPaying, setIsPaying] = useState<boolean>(false);

  const [isReduceOpen, setIsReduceOpen] = useState(false);
  const [reduceAmount, setReduceAmount] = useState<string>("");
  const [reduceReason, setReduceReason] = useState<string>("");

  const [isEditOpen, setIsEditOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!itemId) return;
    setIsLoading(true);
    try {
      const res = await api.get(`/stock-items/${itemId}/history`);
      setData(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error loading stock item detail");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [itemId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.stockItem) return;

    const qty = parseFloat(addAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${itemId}/add`, {
        quantity: qty,
        reason: addReason.trim() || "Manual Stock Addition",
        loanInfo: isAddLoan ? {
          isLoan: true,
          paidAmount: addPaidAmount !== "" ? Number(addPaidAmount) : 0,
          supplierName: addSupplierName.trim() || undefined,
        } : undefined,
      });
      toast.success(`Successfully added ${qty} ${data.stockItem.unitType} to ${data.stockItem.name}`);
      setIsAddOpen(false);
      setAddAmount("");
      setAddReason("");
      setIsAddLoan(false);
      setAddPaidAmount("");
      setAddSupplierName("");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoan) return;

    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    setIsPaying(true);
    try {
      await api.post(`/stock-movements/loans/${selectedLoan.id}/pay`, {
        amount: amt,
        note: payNote.trim() || undefined,
      });
      toast.success("Loan payment recorded successfully");
      setSelectedLoan(null);
      setPayAmount("");
      setPayNote("");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to record loan payment");
    } finally {
      setIsPaying(false);
    }
  };

  const handleReduceStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.stockItem) return;

    const qty = parseFloat(reduceAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${itemId}/reduce`, {
        quantity: qty,
        reason: reduceReason.trim() || "Manual Stock Reduction",
      });
      toast.success(`Successfully reduced ${qty} ${data.stockItem.unitType} from ${data.stockItem.name}`);
      setIsReduceOpen(false);
      setReduceAmount("");
      setReduceReason("");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reduce stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!data?.stockItem) return;
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const updatePayload = {
      name: formData.get("name"),
      unitType: formData.get("unitType"),
      currentQuantity: Number(formData.get("currentQuantity")),
      unitPrice: formData.get("unitPrice") ? Number(formData.get("unitPrice")) : 0,
      minStockLevel: formData.get("minStockLevel") ? Number(formData.get("minStockLevel")) : undefined,
    };

    try {
      await api.patch(`/stock-items/${itemId}`, updatePayload);
      toast.success("Stock item updated");
      setIsEditOpen(false);
      fetchDetail();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error updating stock item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredMovements = useMemo(() => {
    if (!data?.movements) return [];
    if (filterType === "ALL") return data.movements;
    return data.movements.filter(m => m.type === filterType);
  }, [data?.movements, filterType]);

  const getMovementBadge = (type: string) => {
    switch (type) {
      case "IN":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800"><ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> Stock Addition</span>;
      case "OUT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800"><ArrowUpRight className="w-3.5 h-3.5 text-red-600" /> Stock Reduction</span>;
      case "PRODUCTION_USAGE":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800"><RefreshCw className="w-3.5 h-3.5 text-purple-600" /> Production Usage</span>;
      case "ADJUSTMENT":
        return <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Adjustment</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800">{type}</span>;
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-zinc-400 text-sm">Loading item audit history...</div>
      </DashboardLayout>
    );
  }

  if (!data || !data.stockItem) {
    return (
      <DashboardLayout>
        <div className="py-16 text-center text-zinc-500">
          <p className="text-lg font-bold">Stock item not found.</p>
          <Link href="/stock" className="text-amber-600 underline text-sm mt-2 inline-block">Return to Stock Inventory</Link>
        </div>
      </DashboardLayout>
    );
  }

  const { stockItem, totalIn, totalOut, totalValueIn, totalValueOut, currentValuation } = data;
  const isLowStock = stockItem.minStockLevel != null && Number(stockItem.currentQuantity) <= Number(stockItem.minStockLevel);
  const unitPrice = Number(stockItem.unitPrice || 0);
  const calculatedValuation = currentValuation ?? (Number(stockItem.currentQuantity) * unitPrice);

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="mb-6">
        <Link href="/stock" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#8C7361] hover:text-[#2C1B10] transition-colors mb-3">
          <ArrowLeft className="w-4 h-4" />
          Back to Stock Inventory
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-[#2C1B10] tracking-tight">{stockItem.name}</h1>
              {isLowStock ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5" /> Low Stock Warning
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Optimal Stock Level
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs text-[#8C7361] mt-1.5 font-medium">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Branch: <strong className="text-[#2C1B10]">{stockItem.branch?.name || "Global"}</strong></span>
              <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Unit: <strong className="text-[#2C1B10]">{stockItem.unitType}</strong></span>
              <span className="flex items-center gap-1">💵 Unit Price: <strong className="text-emerald-700 font-bold">{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong></span>
              <span className="flex items-center gap-1"><Layers className="w-3.5 h-3.5" /> Min Alert: <strong className="text-[#2C1B10]">{stockItem.minStockLevel != null ? Number(stockItem.minStockLevel).toFixed(2) : "None"}</strong></span>
            </div>
          </div>

          {isGlobalAdmin && (
            <div className="flex items-center gap-2">
              <Button 
                onClick={() => setIsAddOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5 shadow-xs"
              >
                <PlusCircle className="w-4 h-4" />
                Add Stock
              </Button>
              <Button 
                onClick={() => setIsReduceOpen(true)}
                variant="outline"
                className="text-amber-800 border-amber-300 hover:bg-amber-50 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5"
              >
                <MinusCircle className="w-4 h-4" />
                Reduce Stock
              </Button>
              <Button 
                onClick={() => setIsEditOpen(true)}
                variant="outline"
                className="text-zinc-700 border-zinc-300 hover:bg-zinc-100 font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5"
              >
                <Edit3 className="w-4 h-4" />
                Edit Item
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-8">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider block">Current Stock Qty</span>
          <span className={`text-2xl font-black mt-1 block ${isLowStock ? 'text-red-600' : 'text-emerald-700'}`}>
            {Number(stockItem.currentQuantity).toFixed(2)} <span className="text-sm font-semibold text-zinc-500">{stockItem.unitType}</span>
          </span>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-amber-800 uppercase tracking-wider block">Stock Monetary Valuation</span>
          <span className="text-2xl font-black text-amber-900 mt-1 block">
            {calculatedValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs font-bold text-amber-700">ETB</span>
          </span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Historical Inflow</span>
          <span className="text-xl font-black text-emerald-700 mt-1 block">
            +{Number(totalIn).toFixed(2)} <span className="text-xs font-semibold text-emerald-600">{stockItem.unitType}</span>
          </span>
          {totalValueIn != null && (
            <span className="text-xs font-bold text-emerald-800 block mt-0.5">
              (+{totalValueIn.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB)
            </span>
          )}
        </div>

        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">Historical Outflow</span>
          <span className="text-xl font-black text-red-700 mt-1 block">
            -{Number(totalOut).toFixed(2)} <span className="text-xs font-semibold text-red-600">{stockItem.unitType}</span>
          </span>
          {totalValueOut != null && (
            <span className="text-xs font-bold text-red-800 block mt-0.5">
              (-{totalValueOut.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB)
            </span>
          )}
        </div>

        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Audit Movements</span>
          <span className="text-2xl font-black text-indigo-700 mt-1 block">
            {data.movements.length} <span className="text-sm font-semibold text-indigo-600">records</span>
          </span>
        </div>
      </div>

      {/* Movement Audit Trail Section */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
              <History className="w-5 h-5 text-indigo-600" />
              Full Item Audit History
            </h2>
            <p className="text-xs text-[#8C7361] mt-0.5">Chronological record of every stock creation, addition, reduction, edit, and production usage</p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 p-1 rounded-xl">
            {["ALL", "IN", "OUT", "PRODUCTION_USAGE", "ADJUSTMENT"].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilterType(tab)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  filterType === tab 
                    ? "bg-white text-[#2C1B10] shadow-xs" 
                    : "text-zinc-600 hover:text-zinc-900"
                }`}
              >
                {tab === "PRODUCTION_USAGE" ? "PRODUCTION" : tab}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop Audit Trail Table */}
        <div className="hidden sm:block border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Movement Type</TableHead>
                <TableHead>Credit / Loan Status</TableHead>
                <TableHead>Quantity Delta</TableHead>
                <TableHead>Monetary Delta (ETB)</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead className="pr-6">Audit Trail Note / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">
                    No movement records matching filter &apos;{filterType}&apos;.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((m) => {
                  const mPrice = Number(m.unitPrice ?? unitPrice);
                  const mTotalValue = Number(m.totalValue ?? (Number(m.quantity) * mPrice));
                  const isNegative = m.type === "OUT" || m.type === "PRODUCTION_USAGE";
                  const loan = m.purchaseLoan;

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-semibold text-xs text-[#8C7361] whitespace-nowrap">
                        {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                      </TableCell>
                      <TableCell>
                        {getMovementBadge(m.type)}
                      </TableCell>
                      <TableCell>
                        {loan ? (
                          <div className="space-y-1">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                              loan.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                              loan.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                              'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              Credit: {loan.status}
                            </span>
                            <div className="text-[10px] text-[#8C7361]">
                              Due: <strong className="text-[#2C1B10]">{Number(loan.remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</strong>
                              {loan.supplierName && <div>Supplier: {loan.supplierName}</div>}
                            </div>
                            {isGlobalAdmin && (
                              <button 
                                onClick={() => setSelectedLoan(loan)}
                                className="text-[10px] font-bold text-purple-700 hover:text-purple-900 underline block"
                              >
                                {loan.remainingBalance > 0 ? "Record Payment" : "Payment History"}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400 font-medium">—</span>
                        )}
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        <span className={m.type === "IN" ? "text-emerald-700" : "text-rose-700"}>
                          {m.type === "IN" ? "+" : "-"}{Number(m.quantity).toFixed(2)}
                        </span>{" "}
                        <span className="text-xs text-[#8C7361] font-normal">{stockItem.unitType}</span>
                      </TableCell>
                      <TableCell className="font-extrabold text-xs">
                        <span className={isNegative ? "text-rose-700" : "text-emerald-700"}>
                          {isNegative ? "-" : "+"}{mTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </span>
                        {mPrice > 0 && (
                          <div className="text-[10px] text-[#8C7361] font-normal">
                            @ {mPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{stockItem.unitType}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <UserCheck className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span className="font-bold text-xs text-[#2C1B10]">{m.user?.fullName || "System"}</span>
                          <span className="text-[10px] text-[#8C7361] font-bold">({m.user?.role || "SYSTEM"})</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-[#8C7361] font-medium pr-6">
                        {m.reason || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Audit History Cards */}
        <div className="grid grid-cols-1 gap-3 sm:hidden">
          {filteredMovements.length === 0 ? (
            <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">
              No movement records matching filter &apos;{filterType}&apos;.
            </div>
          ) : (
            filteredMovements.map((m) => {
              const mPrice = Number(m.unitPrice ?? unitPrice);
              const mTotalValue = Number(m.totalValue ?? (Number(m.quantity) * mPrice));
              const isNegative = m.type === "OUT" || m.type === "PRODUCTION_USAGE";
              const loan = m.purchaseLoan;

              return (
                <div key={m.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {getMovementBadge(m.type)}
                        {loan && (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                            loan.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            loan.status === 'PARTIAL' ? 'bg-amber-100 text-amber-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            Credit: {loan.status}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[#8C7361]">
                        {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className={`text-base font-extrabold ${m.type === "IN" ? "text-emerald-700" : "text-rose-700"}`}>
                        {m.type === "IN" ? "+" : "-"}{Number(m.quantity).toFixed(2)} {stockItem.unitType}
                      </div>
                      <div className={`text-xs font-bold ${isNegative ? "text-rose-700" : "text-emerald-700"}`}>
                        {isNegative ? "-" : "+"}{mTotalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </div>
                    </div>
                  </div>

                  {loan && (
                    <div className="p-2.5 bg-purple-50 rounded-xl border border-purple-100 text-xs flex items-center justify-between">
                      <div>
                        <div className="text-purple-900 font-bold text-[11px]">
                          Supplier: {loan.supplierName || "—"}
                        </div>
                        <div className="text-[#8C7361] text-[10px]">
                          Paid: {Number(loan.paidAmount).toFixed(2)} ETB | Remaining: <strong className="text-purple-900">{Number(loan.remainingBalance).toFixed(2)} ETB</strong>
                        </div>
                      </div>
                      {isGlobalAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setSelectedLoan(loan)}
                          className="h-7 text-[11px] font-bold text-purple-700 border-purple-300 hover:bg-purple-100"
                        >
                          {loan.remainingBalance > 0 ? "Pay Loan" : "History"}
                        </Button>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 text-[#8C7361]">
                    <div className="flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{m.user?.fullName || "System"}</span>
                    </div>
                    <span>{m.reason || "No note"}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Manual Stock Addition Modal */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { 
          if (!open) {
            setIsAddOpen(false);
            setIsAddLoan(false);
            setAddPaidAmount("");
            setAddSupplierName("");
          } 
        }}>
          <DialogContent className="max-w-md rounded-2xl border-emerald-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600" />
                Manual Stock Addition (Restock)
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStock}>
              <div className="grid gap-4 py-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900">
                  Adding stock to <strong className="font-bold">{stockItem.name}</strong>. Currently available: <span className="font-bold text-emerald-700">{Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}</span> (Rate: <span className="font-bold text-emerald-800">{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{stockItem.unitType}</span>).
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Quantity to Add ({stockItem.unitType}) *
                  </label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    required 
                    min="0.001"
                    value={addAmount} 
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="e.g. 50.00" 
                    className="rounded-xl border-zinc-200" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Reason / Note (Optional)
                  </label>
                  <Input 
                    value={addReason} 
                    onChange={(e) => setAddReason(e.target.value)}
                    placeholder="e.g. Local Purchase, Restock, Inventory Audit" 
                    className="rounded-xl border-zinc-200" 
                  />
                </div>

                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={isAddLoan} 
                      onChange={(e) => setIsAddLoan(e.target.checked)} 
                      className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                    />
                    <span className="text-xs font-bold text-purple-900">Purchased on Credit / Loan?</span>
                  </label>

                  {isAddLoan && (
                    <div className="space-y-3 pt-1">
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Supplier / Vendor Name (Optional)</label>
                        <Input 
                          value={addSupplierName} 
                          onChange={(e) => setAddSupplierName(e.target.value)} 
                          placeholder="e.g. Grain Market Supplier" 
                          className="bg-white rounded-xl border-purple-200 text-xs" 
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Amount Paid Upfront (Down Payment)</label>
                        <Input 
                          type="number" 
                          step="0.01" 
                          min="0" 
                          value={addPaidAmount} 
                          onChange={(e) => setAddPaidAmount(e.target.value)} 
                          placeholder="0.00 (leave 0 if full credit)" 
                          className="bg-white rounded-xl border-purple-200 text-xs" 
                        />
                        <p className="text-[10px] text-purple-700 mt-1 font-medium">
                          Total purchase value: {((parseFloat(addAmount) || 0) * unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Confirm Addition"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Loan Repayment & Audit Dialog */}
      {selectedLoan && (
        <Dialog open={true} onOpenChange={(open) => { 
          if (!open) {
            setSelectedLoan(null);
            setPayAmount("");
            setPayNote("");
          } 
        }}>
          <DialogContent className="max-w-lg rounded-2xl border-purple-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Building2 className="w-5 h-5 text-purple-600" />
                Stock Purchase Loan & Repayment History
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="p-4 bg-purple-50 rounded-2xl border border-purple-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">Supplier</span>
                  <span className="font-extrabold text-purple-950">{selectedLoan.supplierName || "Unspecified Supplier"}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">Total Loan Amount</span>
                  <span className="font-extrabold text-purple-950">{Number(selectedLoan.totalAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-purple-800 font-semibold uppercase">Amount Paid So Far</span>
                  <span className="font-extrabold text-emerald-700">{Number(selectedLoan.paidAmount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-purple-200/60">
                  <span className="font-bold text-purple-900 uppercase">Remaining Balance</span>
                  <span className="text-base font-black text-rose-700">{Number(selectedLoan.remainingBalance).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB</span>
                </div>
              </div>

              {selectedLoan.remainingBalance > 0 && (
                <form onSubmit={handleRecordPayment} className="space-y-3 p-3.5 bg-white border border-purple-200 rounded-2xl">
                  <h4 className="text-xs font-bold text-purple-900 uppercase tracking-wider">Record Installment Payment</h4>
                  
                  <div>
                    <label className="text-[11px] font-bold text-[#2C1B10] mb-1 block uppercase">Payment Amount (ETB) *</label>
                    <Input 
                      type="number" 
                      step="0.01" 
                      max={selectedLoan.remainingBalance}
                      required 
                      value={payAmount} 
                      onChange={(e) => setPayAmount(e.target.value)} 
                      placeholder={`Max: ${Number(selectedLoan.remainingBalance).toFixed(2)} ETB`} 
                      className="rounded-xl border-purple-200 text-xs" 
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-[#2C1B10] mb-1 block uppercase">Payment Note / Receipt (Optional)</label>
                    <Input 
                      value={payNote} 
                      onChange={(e) => setPayNote(e.target.value)} 
                      placeholder="e.g. Bank Transfer, Cash Installment, Receipt #1029" 
                      className="rounded-xl border-purple-200 text-xs" 
                    />
                  </div>

                  <Button type="submit" disabled={isPaying} className="w-full bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs h-9">
                    {isPaying ? "Recording..." : "Record Payment"}
                  </Button>
                </form>
              )}

              {/* Repayment History Audit Trail */}
              <div>
                <h4 className="text-xs font-bold text-[#2C1B10] mb-2 uppercase tracking-wider">Payment History Audit</h4>
                {selectedLoan.payments && selectedLoan.payments.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {selectedLoan.payments.map((p) => (
                      <div key={p.id} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs flex items-center justify-between">
                        <div>
                          <div className="font-bold text-[#2C1B10]">
                            +{Number(p.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                          </div>
                          <div className="text-[10px] text-[#8C7361]">
                            By {p.user?.fullName || "Staff"} · {format(new Date(p.createdAt), "MMM d, yyyy · h:mm a")}
                          </div>
                          {p.note && <div className="text-[10px] text-zinc-600 italic mt-0.5">{p.note}</div>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#8C7361] italic text-center py-3 bg-zinc-50 rounded-xl border border-zinc-200">No repayment installments recorded yet.</p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSelectedLoan(null)} className="w-full rounded-xl">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Reduction Modal */}
      {isReduceOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsReduceOpen(false); }}>
          <DialogContent className="max-w-md rounded-2xl border-amber-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-600" />
                Manual Stock Reduction
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReduceStock}>
              <div className="grid gap-4 py-3">
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-900">
                  Reducing stock for <strong className="font-bold">{stockItem.name}</strong>. Currently available: <span className="font-bold text-amber-700">{Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}</span> (Rate: <span className="font-bold text-amber-800">{unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{stockItem.unitType}</span>).
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Quantity to Reduce ({stockItem.unitType}) *
                  </label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    required 
                    min="0.001"
                    max={Number(stockItem.currentQuantity)}
                    value={reduceAmount} 
                    onChange={(e) => setReduceAmount(e.target.value)}
                    placeholder={`Max: ${Number(stockItem.currentQuantity).toFixed(2)}`} 
                    className="rounded-xl border-zinc-200" 
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Reason / Note (Optional)
                  </label>
                  <Input 
                    value={reduceReason} 
                    onChange={(e) => setReduceReason(e.target.value)}
                    placeholder="e.g. Spoilage, Wastage, Audit Adjustment" 
                    className="rounded-xl border-zinc-200" 
                  />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsReduceOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Confirm Reduction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Item Definition Modal */}
      {isEditOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsEditOpen(false); }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                Edit Stock Item Settings
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditItem}>
              <div className="grid gap-4 py-4">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Item Name</label>
                  <Input name="name" required defaultValue={stockItem.name} className="rounded-xl border-zinc-200" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Unit Type</label>
                  <select name="unitType" required defaultValue={stockItem.unitType} className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                    <option value="KG">Kg (Kilogram)</option>
                    <option value="PIECE">Piece</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Unit Cost / Price (ETB per unit)</label>
                  <Input name="unitPrice" type="number" step="0.01" min="0" defaultValue={stockItem.unitPrice ?? ""} placeholder="0.00" className="rounded-xl border-zinc-200" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Current Available Quantity</label>
                  <Input name="currentQuantity" type="number" step="0.001" required defaultValue={stockItem.currentQuantity} className="rounded-xl border-zinc-200" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Minimum Stock Threshold (Alert level)</label>
                  <Input name="minStockLevel" type="number" step="0.001" defaultValue={stockItem.minStockLevel ?? ""} placeholder="e.g. 10.00" className="rounded-xl border-zinc-200" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
