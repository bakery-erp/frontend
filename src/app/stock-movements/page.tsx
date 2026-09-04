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

interface Branch {
  id: string;
  name: string;
}

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

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (user && !isGlobalAdmin) {
    return null;
  }

  // New Movement Form State
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [selectedStockItem, setSelectedStockItem] = useState<string>("");

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
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchItems();
    fetchMovements();
  }, [fetchItems, fetchMovements]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    // For ADJUSTMENT, we send "adjustTo" explicitly and qty as dummy if needed based on the current logic
    const data: Record<string, any> = {
      stockItemId: selectedStockItem,
      type: movementType,
      reason: formData.get("reason"),
    };

    if (movementType === "ADJUSTMENT") {
      data.adjustTo = Number(formData.get("quantity"));
      data.quantity = 0; // The backend uses adjustTo
      data.type = "ADJUSTMENT";
    } else {
      data.quantity = Number(formData.get("quantity"));
    }

    try {
      await api.post("/stock-movements", data);
      toast.success("Stock movement recorded");
      setIsAddOpen(false);
      setMovementType("IN");
      setSelectedStockItem("");
      fetchMovements();
      fetchItems(); // Refresh current quantities 
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMovementColor = (type: string) => {
    switch (type) {
      case "IN": return "text-green-600 bg-green-50";
      case "OUT": return "text-red-600 bg-red-50";
      case "ADJUSTMENT": return "text-orange-600 bg-orange-50";
      case "PRODUCTION_USAGE": return "text-blue-600 bg-blue-50";
      default: return "text-zinc-600 bg-zinc-50";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stock Movements</h1>
          <p className="text-sm text-zinc-500 mt-1">Track IN, OUT, and ADJUSTMENTS for your inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={() => setIsAddOpen(true)}>Record Movement</Button>
        </div>
      </div>

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Time</TableHead>
              <TableHead>Stock Material Item</TableHead>
              <TableHead>Movement Type</TableHead>
              <TableHead>Quantity Delta</TableHead>
              <TableHead>Monetary Delta (ETB)</TableHead>
              <TableHead>Reason / Notes</TableHead>
              <TableHead className="pr-6">Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
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
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${getMovementColor(mov.type)}`}>
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
                  <TableCell className="max-w-[220px] truncate text-xs text-[#8C7361]" title={mov.reason ? mov.reason.replace(/Production batch\s+[a-z0-9]+/gi, 'Production Usage') : "—"}>
                    {mov.reason ? mov.reason.replace(/Production batch\s+[a-z0-9]+/gi, 'Production Usage') : "—"}
                  </TableCell>
                  <TableCell className="text-xs font-bold text-[#2C1B10] pr-6">{mov.user?.fullName || "System"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Record Stock Movement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Movement Type</label>
                  <select 
                    value={movementType} 
                    onChange={(e) => setMovementType(e.target.value as any)}
                    className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                  >
                    <option value="IN">IN (Add Stock)</option>
                    <option value="OUT">OUT (Remove Stock)</option>
                    <option value="ADJUSTMENT">ADJUSTMENT (Set Exact Quantity)</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Stock Item</label>
                  <select 
                    required 
                    value={selectedStockItem}
                    onChange={(e) => setSelectedStockItem(e.target.value)}
                    className="w-full border rounded-md h-10 px-3 bg-background text-sm"
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
                  <label className="text-sm font-medium mb-1 block">
                    {movementType === "ADJUSTMENT" ? "New Total Quantity" : "Quantity to Transfer"}
                  </label>
                  <Input 
                    name="quantity" 
                    type="number" 
                    step="0.001" 
                    min="0"
                    required 
                    placeholder={movementType === "ADJUSTMENT" ? "e.g. 50" : "e.g. 10"} 
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Reason / Reference (Optional)</label>
                  <Input name="reason" placeholder="e.g. Supplier delivery, Spilled, Recount" />
                </div>

              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Record Movement"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
