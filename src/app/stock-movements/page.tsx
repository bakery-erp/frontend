"use client";
import { useEffect, useState, useCallback, useMemo } from "react";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { formatEthDate } from "@/lib/ethiopianDate";
import { 
  CreditCard, Coins, CheckCircle2, AlertCircle, History, 
  Search, ArrowRightLeft, DollarSign, Package, Calendar, Clock, Receipt, UserCheck 
} from "lucide-react";

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
  unitPrice?: number;
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
  stockItem: {
    id: string;
    name: string;
    unitType: string;
    unitPrice?: number;
  };
  user: {
    id: string;
    fullName: string;
  };
}

interface LoanPayment {
  id: string;
  loanId: string;
  userId: string;
  amount: number | string;
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
  totalAmount: number | string;
  paidAmount: number | string;
  remainingBalance: number | string;
  status: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
  updatedAt: string;
  stockMovement?: {
    id: string;
    quantity: number | string;
    unitPrice?: number | string;
    totalValue?: number | string;
    reason?: string;
    stockItem?: {
      id: string;
      name: string;
      unitType: string;
    };
    user?: {
      id: string;
      fullName: string;
    };
  };
  payments?: LoanPayment[];
}

export default function StockMovementsPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    if (user && !isGlobalAdmin) {
      toast.error("Access Restricted: Stock movements are only available to Admin and Owner roles.");
      window.location.href = "/my-profile";
    }
  }, [user, isGlobalAdmin]);

  const [activeTab, setActiveTab] = useState<"movements" | "loans">("movements");
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [loans, setLoans] = useState<StockPurchaseLoan[]>([]);

  const [isLoadingMovements, setIsLoadingMovements] = useState(true);
  const [isLoadingLoans, setIsLoadingLoans] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter state for loans
  const [loanStatusFilter, setLoanStatusFilter] = useState<string>("ALL");
  const [loanSearch, setLoanSearch] = useState<string>("");

  // Payment Modal State
  const [selectedLoanForPay, setSelectedLoanForPay] = useState<StockPurchaseLoan | null>(null);
  const [payAmount, setPayAmount] = useState<string>("");
  const [payNote, setPayNote] = useState<string>("");
  const [isSubmittingPay, setIsSubmittingPay] = useState<boolean>(false);

  // History Log Modal State
  const [selectedLoanForHistory, setSelectedLoanForHistory] = useState<StockPurchaseLoan | null>(null);

  // New Movement Form State
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [selectedStockItem, setSelectedStockItem] = useState<string>("");
  const [isLoan, setIsLoan] = useState<boolean>(false);
  const [paidAmount, setPaidAmount] = useState<string>("");
  const [supplierName, setSupplierName] = useState<string>("");

  const fetchItems = useCallback(async () => {
    try {
      const endpoint = selectedBranchId 
        ? `/stock-items?branchId=${selectedBranchId}` 
        : `/stock-items`;
      const res = await api.get(endpoint);
      setStockItems(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [selectedBranchId]);

  const fetchMovements = useCallback(async () => {
    setIsLoadingMovements(true);
    try {
      const endpoint = selectedBranchId 
        ? `/stock-movements?branchId=${selectedBranchId}` 
        : `/stock-movements`;
        
      const res = await api.get(endpoint);
      setMovements(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching stock movements");
      console.error(e);
    } finally {
      setIsLoadingMovements(false);
    }
  }, [selectedBranchId]);

  const fetchLoans = useCallback(async () => {
    setIsLoadingLoans(true);
    try {
      let endpoint = `/stock-movements/loans/list?`;
      if (selectedBranchId) endpoint += `branchId=${selectedBranchId}&`;
      if (loanStatusFilter !== "ALL") endpoint += `status=${loanStatusFilter}&`;

      const res = await api.get(endpoint);
      setLoans(res.data);
    } catch (e: any) {
      console.error(e);
      toast.error(e.response?.data?.error || "Error fetching stock loans");
    } finally {
      setIsLoadingLoans(false);
    }
  }, [selectedBranchId, loanStatusFilter]);

  useEffect(() => {
    fetchItems();
    fetchMovements();
    fetchLoans();
  }, [fetchItems, fetchMovements, fetchLoans]);

  // Calculations for Loans summary cards
  const loanStats = useMemo(() => {
    let totalCredit = 0;
    let totalPaid = 0;
    let totalRemaining = 0;
    let activeLoansCount = 0;

    loans.forEach(loan => {
      const tot = Number(loan.totalAmount || 0);
      const pd = Number(loan.paidAmount || 0);
      const rem = Number(loan.remainingBalance || 0);

      totalCredit += tot;
      totalPaid += pd;
      totalRemaining += rem;

      if (loan.status !== "PAID") {
        activeLoansCount++;
      }
    });

    return { totalCredit, totalPaid, totalRemaining, activeLoansCount };
  }, [loans]);

  // Filtered loans list based on search
  const filteredLoans = useMemo(() => {
    return loans.filter(loan => {
      const supp = (loan.supplierName || "").toLowerCase();
      const itemName = (loan.stockMovement?.stockItem?.name || "").toLowerCase();
      const query = loanSearch.toLowerCase().trim();
      if (!query) return true;
      return supp.includes(query) || itemName.includes(query);
    });
  }, [loans, loanSearch]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    const data: Record<string, any> = {
      stockItemId: selectedStockItem,
      type: movementType,
      reason: formData.get("reason"),
    };

    if (movementType === "ADJUSTMENT") {
      data.adjustTo = Number(formData.get("quantity"));
      data.quantity = 0;
      data.type = "ADJUSTMENT";
    } else {
      data.quantity = Number(formData.get("quantity"));
    }

    if (movementType === "IN" && isLoan) {
      data.loanInfo = {
        isLoan: true,
        paidAmount: paidAmount !== "" ? Number(paidAmount) : 0,
        supplierName: supplierName.trim() || undefined,
      };
    }

    try {
      await api.post("/stock-movements", data);
      toast.success("Stock movement recorded");
      setIsAddOpen(false);
      setMovementType("IN");
      setSelectedStockItem("");
      setIsLoan(false);
      setPaidAmount("");
      setSupplierName("");
      fetchMovements();
      fetchLoans();
      fetchItems();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error recording movement");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayLoanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoanForPay) return;

    const amount = Number(payAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive payment amount");
      return;
    }

    setIsSubmittingPay(true);
    try {
      await api.post(`/stock-movements/loans/${selectedLoanForPay.id}/pay`, {
        amount,
        note: payNote.trim() || undefined,
      });

      toast.success(`Payment of ${amount.toFixed(2)} ETB recorded successfully!`);
      setSelectedLoanForPay(null);
      setPayAmount("");
      setPayNote("");
      fetchLoans();
      fetchMovements();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error processing loan payment");
      console.error(error);
    } finally {
      setIsSubmittingPay(false);
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "IN": return "text-green-600 bg-green-50 border-green-200";
      case "OUT": return "text-red-600 bg-red-50 border-red-200";
      case "ADJUSTMENT": return "text-orange-600 bg-orange-50 border-orange-200";
      case "PRODUCTION_USAGE": return "text-blue-600 bg-blue-50 border-blue-200";
      default: return "text-zinc-600 bg-zinc-50 border-zinc-200";
    }
  };

  const getLoanStatusBadge = (status: string) => {
    switch (status) {
      case "UNPAID":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 flex items-center gap-1 w-fit"><AlertCircle className="w-3.5 h-3.5" /> Unpaid</span>;
      case "PARTIAL":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit"><Coins className="w-3.5 h-3.5" /> Partial</span>;
      case "PAID":
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit"><CheckCircle2 className="w-3.5 h-3.5" /> Settled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700">{status}</span>;
    }
  };

  if (user && !isGlobalAdmin) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10]">Stock Movements & Credit Purchases</h1>
          <p className="text-sm text-[#8C7361] mt-1">Track material inventory entries, usage, and stock loans acquired from suppliers</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsAddOpen(true)} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md">
            + Record Movement
          </Button>
        </div>
      </div>

      {/* Main Mode Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-[#F4ECE1] rounded-2xl w-fit mb-6 border border-[#EDE4D5]">
        <button
          onClick={() => setActiveTab("movements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "movements"
              ? "bg-white text-[#2C1B10] shadow-sm"
              : "text-[#8C7361] hover:text-[#2C1B10]"
          }`}
        >
          <ArrowRightLeft className="w-4 h-4 text-[#E87A18]" />
          Stock Movements Ledger ({movements.length})
        </button>

        <button
          onClick={() => setActiveTab("loans")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-extrabold transition-all ${
            activeTab === "loans"
              ? "bg-white text-[#2C1B10] shadow-sm"
              : "text-[#8C7361] hover:text-[#2C1B10]"
          }`}
        >
          <CreditCard className="w-4 h-4 text-purple-600" />
          Company Stock Loans & Credit ({loans.length})
          {loanStats.activeLoansCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-red-500 text-white font-bold">
              {loanStats.activeLoansCount}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: STOCK MOVEMENTS LEDGER */}
      {activeTab === "movements" && (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF7EE]/50">
                  <TableHead className="font-extrabold text-[#2C1B10]">Date & Time</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Stock Material Item</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Movement Type</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Quantity Delta</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Monetary Delta (ETB)</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Reason / Notes</TableHead>
                  <TableHead className="pr-6 font-extrabold text-[#2C1B10]">Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingMovements ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">Loading stock movements...</TableCell></TableRow>
                ) : movements.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">No movements recorded yet.</TableCell></TableRow>
                ) : movements.map(mov => {
                  const price = Number(mov.unitPrice ?? mov.stockItem?.unitPrice ?? 0);
                  const val = Number(mov.totalValue ?? (Number(mov.quantity) * price));
                  const isNegative = mov.type === "OUT" || mov.type === "PRODUCTION_USAGE";

                  return (
                    <TableRow key={mov.id}>
                      <TableCell className="text-xs font-semibold text-[#8C7361]">
                        {formatEthDate(mov.createdAt, true)}
                      </TableCell>
                      <TableCell className="font-bold text-[#2C1B10]">{mov.stockItem?.name}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${getMovementColor(mov.type)}`}>
                          {mov.type.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-sm">
                        <span className={isNegative ? "text-rose-600" : "text-emerald-700"}>
                          {isNegative ? "-" : "+"}
                          {Number(mov.quantity).toFixed(2)}
                        </span>{" "}
                        <span className="text-xs text-[#8C7361] font-semibold">{mov.stockItem?.unitType}</span>
                      </TableCell>
                      <TableCell className="font-extrabold text-xs">
                        <span className={isNegative ? "text-rose-600" : "text-emerald-700"}>
                          {isNegative ? "-" : "+"}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate text-xs text-[#8C7361]" title={mov.reason || "—"}>
                        {mov.reason ? mov.reason.replace(/Production batch\s+[a-z0-9]+/gi, 'Production Usage') : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-bold text-[#2C1B10] pr-6">{mov.user?.fullName || "System"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {isLoadingMovements ? (
              <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">Loading stock movements...</div>
            ) : movements.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">No movements recorded yet.</div>
            ) : movements.map(mov => {
              const price = Number(mov.unitPrice ?? mov.stockItem?.unitPrice ?? 0);
              const val = Number(mov.totalValue ?? (Number(mov.quantity) * price));
              const isNegative = mov.type === "OUT" || mov.type === "PRODUCTION_USAGE";

              return (
                <div key={mov.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-2.5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-[#2C1B10] text-base">{mov.stockItem?.name || "Unknown Item"}</div>
                      <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(mov.createdAt, true)}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${getMovementColor(mov.type)}`}>
                      {mov.type.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <div>
                      <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Quantity Delta</span>
                      <span className={`font-bold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>
                        {isNegative ? "-" : "+"}{Number(mov.quantity).toFixed(2)} {mov.stockItem?.unitType}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Monetary Value</span>
                      <span className={`font-extrabold ${isNegative ? "text-rose-600" : "text-emerald-700"}`}>
                        {isNegative ? "-" : "+"}{val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-zinc-100 text-[#8C7361]">
                    <span>By: <strong className="text-[#2C1B10]">{mov.user?.fullName || "System"}</strong></span>
                    <span className="truncate max-w-[150px]">{mov.reason || "No note"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COMPANY STOCK CREDIT LOANS & PURCHASES */}
      {activeTab === "loans" && (
        <div className="space-y-6">
          {/* Summary KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">Total Credit Purchased</span>
                <div className="w-9 h-9 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
                  <CreditCard className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-[#2C1B10] mt-2">
                {loanStats.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </p>
              <span className="text-[11px] text-[#8C7361]">Total stock bought on credit</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">Total Paid Amount</span>
                <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                  <Coins className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-emerald-700 mt-2">
                {loanStats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </p>
              <span className="text-[11px] text-[#8C7361]">Paid to suppliers so far</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">Outstanding Debt</span>
                <div className="w-9 h-9 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600">
                  <AlertCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-rose-600 mt-2">
                {loanStats.totalRemaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
              </p>
              <span className="text-[11px] text-[#8C7361]">Remaining balance due</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-[#EDE4D5] shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">Active Loans</span>
                <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                  <Clock className="w-5 h-5" />
                </div>
              </div>
              <p className="text-xl font-extrabold text-[#2C1B10] mt-2">
                {loanStats.activeLoansCount} <span className="text-xs font-normal text-[#8C7361]">unsettled</span>
              </p>
              <span className="text-[11px] text-[#8C7361]">Pending full payment</span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-[#EDE4D5]">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {["ALL", "UNPAID", "PARTIAL", "PAID"].map(st => (
                <button
                  key={st}
                  onClick={() => setLoanStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    loanStatusFilter === st
                      ? "bg-[#2C1B10] text-white shadow-xs"
                      : "bg-[#FAF7EE] text-[#8C7361] hover:text-[#2C1B10]"
                  }`}
                >
                  {st === "ALL" ? "All Credit Purchases" : st}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#8C7361]" />
              <Input
                placeholder="Search supplier or item..."
                value={loanSearch}
                onChange={(e) => setLoanSearch(e.target.value)}
                className="pl-9 text-xs rounded-xl bg-[#FAF7EE] border-[#EDE4D5]"
              />
            </div>
          </div>

          {/* Desktop Loans Table View */}
          <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-[#FAF7EE]/50">
                  <TableHead className="font-extrabold text-[#2C1B10]">Date & Supplier</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Stock Item Purchased</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Total Value (ETB)</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Paid Amount</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Remaining Balance</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">Status</TableHead>
                  <TableHead className="pr-6 font-extrabold text-[#2C1B10] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLoans ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">Loading stock loan records...</TableCell></TableRow>
                ) : filteredLoans.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">No stock credit loans found matching criteria.</TableCell></TableRow>
                ) : filteredLoans.map(loan => {
                  const item = loan.stockMovement?.stockItem;
                  const qty = Number(loan.stockMovement?.quantity || 0);
                  const tot = Number(loan.totalAmount || 0);
                  const paid = Number(loan.paidAmount || 0);
                  const rem = Number(loan.remainingBalance || 0);

                  return (
                    <TableRow key={loan.id}>
                      <TableCell>
                        <div className="font-bold text-[#2C1B10]">{loan.supplierName || "Unspecified Supplier"}</div>
                        <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(loan.createdAt, true)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-bold text-[#2C1B10]">{item?.name || "Stock Item"}</div>
                        <div className="text-xs text-[#8C7361]">
                          Quantity: <strong className="text-[#2C1B10]">{qty.toFixed(2)} {item?.unitType}</strong>
                        </div>
                      </TableCell>
                      <TableCell className="font-extrabold text-xs text-[#2C1B10]">
                        {tot.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </TableCell>
                      <TableCell className="font-bold text-xs text-emerald-700">
                        {paid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </TableCell>
                      <TableCell className="font-extrabold text-xs text-rose-600">
                        {rem.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                      </TableCell>
                      <TableCell>{getLoanStatusBadge(loan.status)}</TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-2">
                          {loan.status !== "PAID" && (
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedLoanForPay(loan);
                                setPayAmount(rem > 0 ? String(rem) : "");
                                setPayNote("");
                              }}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 px-3"
                            >
                              <Coins className="w-3.5 h-3.5 mr-1" /> Pay Loan
                            </Button>
                          )}

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLoanForHistory(loan)}
                            className="text-xs font-bold rounded-xl h-8 px-2.5 border-[#EDE4D5]"
                            title="View Installment Payment Logs"
                          >
                            <History className="w-3.5 h-3.5 text-[#8C7361]" />
                            {loan.payments && loan.payments.length > 0 && (
                              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-700 font-bold">
                                {loan.payments.length}
                              </span>
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Loans Card View */}
          <div className="grid grid-cols-1 gap-3 sm:hidden">
            {isLoadingLoans ? (
              <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">Loading stock loan records...</div>
            ) : filteredLoans.length === 0 ? (
              <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">No stock credit loans found matching criteria.</div>
            ) : filteredLoans.map(loan => {
              const item = loan.stockMovement?.stockItem;
              const qty = Number(loan.stockMovement?.quantity || 0);
              const tot = Number(loan.totalAmount || 0);
              const paid = Number(loan.paidAmount || 0);
              const rem = Number(loan.remainingBalance || 0);

              return (
                <div key={loan.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-[#2C1B10] text-base">{loan.supplierName || "Unspecified Supplier"}</div>
                      <div className="text-[11px] font-semibold text-[#8C7361]">{formatEthDate(loan.createdAt, true)}</div>
                    </div>
                    {getLoanStatusBadge(loan.status)}
                  </div>

                  <div className="p-3 bg-[#FAF7EE] rounded-xl text-xs space-y-1">
                    <div className="font-bold text-[#2C1B10]">Stock Item: {item?.name}</div>
                    <div className="text-[#8C7361]">Quantity: <strong className="text-[#2C1B10]">{qty.toFixed(2)} {item?.unitType}</strong></div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-zinc-50 p-2.5 rounded-xl border border-zinc-100">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Total</span>
                      <span className="font-bold text-[#2C1B10]">{tot.toLocaleString()} ETB</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Paid</span>
                      <span className="font-bold text-emerald-700">{paid.toLocaleString()} ETB</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Remaining</span>
                      <span className="font-extrabold text-rose-600">{rem.toLocaleString()} ETB</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100">
                    {loan.status !== "PAID" && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedLoanForPay(loan);
                          setPayAmount(rem > 0 ? String(rem) : "");
                          setPayNote("");
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl h-8 px-3 flex-1"
                      >
                        <Coins className="w-3.5 h-3.5 mr-1" /> Pay Installment
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedLoanForHistory(loan)}
                      className="text-xs font-bold rounded-xl h-8 px-3 border-[#EDE4D5]"
                    >
                      <History className="w-3.5 h-3.5 mr-1" /> Payment History ({loan.payments?.length || 0})
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* RECORD MOVEMENT MODAL */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setIsLoan(false);
            setPaidAmount("");
            setSupplierName("");
          }
        }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">Record Stock Movement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                
                <div>
                  <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">Movement Type</label>
                  <select 
                    value={movementType} 
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full border rounded-xl h-10 px-3 bg-background text-sm font-semibold"
                  >
                    <option value="IN">IN (Add Stock Purchased/Delivered)</option>
                    <option value="OUT">OUT (Manual Stock Removal)</option>
                    <option value="ADJUSTMENT">ADJUSTMENT (Set Exact Quantity Count)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">Stock Material Item</label>
                  <select 
                    required 
                    value={selectedStockItem}
                    onChange={(e) => setSelectedStockItem(e.target.value)}
                    className="w-full border rounded-xl h-10 px-3 bg-background text-sm font-semibold"
                  >
                    <option value="" disabled>Select Item</option>
                    {stockItems.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} (Current: {Number(item.currentQuantity).toFixed(2)} {item.unitType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">
                    {movementType === "ADJUSTMENT" ? "New Total Quantity" : "Quantity to Transfer"}
                  </label>
                  <Input 
                    name="quantity" 
                    type="number" 
                    step="0.001" 
                    min="0"
                    required 
                    placeholder={movementType === "ADJUSTMENT" ? "e.g. 50" : "e.g. 10"} 
                    className="rounded-xl"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">Reason / Reference Notes (Optional)</label>
                  <Input name="reason" placeholder="e.g. Supplier delivery, Recount, Spilled" className="rounded-xl text-xs" />
                </div>

                {movementType === "IN" && (
                  <div className="p-4 bg-purple-50/80 rounded-2xl border border-purple-200 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isLoan} 
                        onChange={(e) => setIsLoan(e.target.checked)} 
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="text-xs font-extrabold text-purple-950">Stock Acquired on Credit / Loan from Supplier?</span>
                    </label>

                    {isLoan && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Supplier / Vendor Name</label>
                          <Input 
                            value={supplierName} 
                            onChange={(e) => setSupplierName(e.target.value)} 
                            placeholder="e.g. National Flour Mills" 
                            className="bg-white rounded-xl border-purple-200 text-xs" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Amount Paid Upfront / Down Payment (ETB)</label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={paidAmount} 
                            onChange={(e) => setPaidAmount(e.target.value)} 
                            placeholder="0.00 (leave 0 if 100% credit)" 
                            className="bg-white rounded-xl border-purple-200 text-xs font-semibold" 
                          />
                          <p className="text-[10px] text-purple-700 mt-1">The remaining amount will be logged under company credit loans.</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Saving..." : "Record Movement"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* RECORD LOAN PAYMENT MODAL */}
      {selectedLoanForPay && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedLoanForPay(null); }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Coins className="w-5 h-5 text-emerald-600" />
                Record Stock Loan Payment
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handlePayLoanSubmit} className="space-y-4 py-2">
              <div className="bg-[#FAF7EE] p-4 rounded-2xl border border-[#EDE4D5] space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">Supplier Name:</span>
                  <span className="font-extrabold text-[#2C1B10]">{selectedLoanForPay.supplierName || "Unspecified"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">Stock Purchased:</span>
                  <span className="font-bold text-[#2C1B10]">
                    {selectedLoanForPay.stockMovement?.stockItem?.name} ({Number(selectedLoanForPay.stockMovement?.quantity || 0)} {selectedLoanForPay.stockMovement?.stockItem?.unitType})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361] font-semibold">Total Purchase Value:</span>
                  <span className="font-bold text-[#2C1B10]">{Number(selectedLoanForPay.totalAmount).toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between pt-1 border-t border-[#EDE4D5]">
                  <span className="text-[#8C7361] font-semibold">Paid to Date:</span>
                  <span className="font-bold text-emerald-700">{Number(selectedLoanForPay.paidAmount).toLocaleString()} ETB</span>
                </div>
                <div className="flex justify-between text-sm pt-1 border-t border-[#EDE4D5]">
                  <span className="font-bold text-rose-700">Remaining Balance:</span>
                  <span className="font-extrabold text-rose-600">{Number(selectedLoanForPay.remainingBalance).toLocaleString()} ETB</span>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-extrabold text-[#2C1B10] uppercase">Payment Amount (ETB)</label>
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(Number(selectedLoanForPay.remainingBalance)))}
                    className="text-[11px] font-bold text-emerald-700 hover:underline"
                  >
                    Pay Full Balance ({Number(selectedLoanForPay.remainingBalance).toLocaleString()} ETB)
                  </button>
                </div>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  max={Number(selectedLoanForPay.remainingBalance)}
                  required
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  placeholder="Enter amount to pay"
                  className="rounded-xl font-bold text-base"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#8C7361] uppercase mb-1 block">Payment Note / Reference (Optional)</label>
                <Input
                  value={payNote}
                  onChange={(e) => setPayNote(e.target.value)}
                  placeholder="e.g. Bank transfer, Cash installment #2, Receipt #1024"
                  className="rounded-xl text-xs"
                />
              </div>

              <DialogFooter className="gap-2 sm:gap-0 pt-2">
                <Button type="button" variant="outline" onClick={() => setSelectedLoanForPay(null)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmittingPay} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                  {isSubmittingPay ? "Saving..." : "Confirm Payment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* VIEW PAYMENT HISTORY MODAL */}
      {selectedLoanForHistory && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setSelectedLoanForHistory(null); }}>
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-extrabold text-[#2C1B10] flex items-center gap-2">
                <History className="w-5 h-5 text-purple-600" />
                Loan Installments Log
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div className="bg-[#FAF7EE] p-3.5 rounded-2xl border border-[#EDE4D5] text-xs flex items-center justify-between">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-bold">Supplier</span>
                  <span className="font-extrabold text-[#2C1B10] text-sm">{selectedLoanForHistory.supplierName || "Unspecified"}</span>
                </div>
                <div className="text-right">
                  <span className="text-[#8C7361] block text-[10px] uppercase font-bold">Remaining Due</span>
                  <span className="font-extrabold text-rose-600 text-sm">
                    {Number(selectedLoanForHistory.remainingBalance).toLocaleString()} ETB
                  </span>
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {!selectedLoanForHistory.payments || selectedLoanForHistory.payments.length === 0 ? (
                  <div className="text-center py-6 text-[#8C7361] text-xs">
                    No installment payments recorded yet.
                  </div>
                ) : (
                  selectedLoanForHistory.payments.map((pmt, idx) => (
                    <div key={pmt.id || idx} className="p-3 bg-white rounded-xl border border-[#EDE4D5] text-xs flex items-center justify-between space-y-1">
                      <div>
                        <div className="font-extrabold text-emerald-700 text-sm">+ {Number(pmt.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB</div>
                        <div className="text-[11px] text-[#8C7361]">{formatEthDate(pmt.createdAt, true)}</div>
                        {pmt.note && <div className="text-[11px] text-zinc-600 italic mt-0.5">&quot;{pmt.note}&quot;</div>}
                      </div>
                      <div className="text-right text-[11px] text-[#8C7361]">
                        Recorded by:<br />
                        <strong className="text-[#2C1B10]">{pmt.user?.fullName || "Staff"}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <DialogFooter>
                <Button onClick={() => setSelectedLoanForHistory(null)} className="w-full rounded-xl">Close</Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </DashboardLayout>
  );
}
