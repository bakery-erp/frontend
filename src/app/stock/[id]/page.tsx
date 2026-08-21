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
  minStockLevel?: number;
  branchId: string;
  branch?: Branch;
}

interface StockMovement {
  id: string;
  stockItemId: string;
  userId: string;
  quantity: number | string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "PRODUCTION_USAGE";
  reason?: string;
  createdAt: string;
  user: {
    id: string;
    fullName: string;
    role: string;
  };
}

interface HistoryData {
  stockItem: StockItem;
  movements: StockMovement[];
  totalIn: number;
  totalOut: number;
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
      });
      toast.success(`Successfully added ${qty} ${data.stockItem.unitType} to ${data.stockItem.name}`);
      setIsAddOpen(false);
      setAddAmount("");
      setAddReason("");
      fetchDetail();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add stock level");
    } finally {
      setIsSubmitting(false);
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

  const { stockItem, totalIn, totalOut } = data;
  const isLowStock = stockItem.minStockLevel != null && Number(stockItem.currentQuantity) <= Number(stockItem.minStockLevel);

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
            <div className="flex items-center gap-4 text-xs text-[#8C7361] mt-1.5 font-medium">
              <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Branch: <strong className="text-[#2C1B10]">{stockItem.branch?.name || "Global"}</strong></span>
              <span className="flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Unit: <strong className="text-[#2C1B10]">{stockItem.unitType}</strong></span>
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
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider block">Current Available Stock</span>
          <span className={`text-2xl font-black mt-1 block ${isLowStock ? 'text-red-600' : 'text-emerald-700'}`}>
            {Number(stockItem.currentQuantity).toFixed(2)} <span className="text-sm font-semibold text-zinc-500">{stockItem.unitType}</span>
          </span>
        </div>

        <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">Total Historical Inflow</span>
          <span className="text-2xl font-black text-emerald-700 mt-1 block">
            +{Number(totalIn).toFixed(2)} <span className="text-sm font-semibold text-emerald-600">{stockItem.unitType}</span>
          </span>
        </div>

        <div className="bg-red-50/70 border border-red-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-red-800 uppercase tracking-wider block">Total Historical Outflow</span>
          <span className="text-2xl font-black text-red-700 mt-1 block">
            -{Number(totalOut).toFixed(2)} <span className="text-sm font-semibold text-red-600">{stockItem.unitType}</span>
          </span>
        </div>

        <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-4 shadow-xs">
          <span className="text-xs font-bold text-indigo-800 uppercase tracking-wider block">Total Audit Movements</span>
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

        <div className="border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date & Time</TableHead>
                <TableHead>Movement Type</TableHead>
                <TableHead>Quantity Delta</TableHead>
                <TableHead>Performed By</TableHead>
                <TableHead className="pr-6">Audit Trail Note / Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredMovements.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-[#8C7361] font-medium">
                    No movement records matching filter &apos;{filterType}&apos;.
                  </TableCell>
                </TableRow>
              ) : (
                filteredMovements.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="font-semibold text-xs text-[#8C7361] whitespace-nowrap">
                      {format(new Date(m.createdAt), "MMM d, yyyy · h:mm a")}
                    </TableCell>
                    <TableCell>
                      {getMovementBadge(m.type)}
                    </TableCell>
                    <TableCell className="font-bold text-sm">
                      <span className={m.type === "IN" ? "text-emerald-700" : "text-rose-700"}>
                        {m.type === "IN" ? "+" : "-"}{Number(m.quantity).toFixed(2)}
                      </span>{" "}
                      <span className="text-xs text-[#8C7361] font-normal">{stockItem.unitType}</span>
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
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Manual Stock Addition Modal */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
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
                  Adding stock to <strong className="font-bold">{stockItem.name}</strong>. Currently available: <span className="font-bold text-emerald-700">{Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}</span>.
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
                  Reducing stock for <strong className="font-bold">{stockItem.name}</strong>. Currently available: <span className="font-bold text-amber-700">{Number(stockItem.currentQuantity).toFixed(2)} {stockItem.unitType}</span>.
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
