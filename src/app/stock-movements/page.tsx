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
import { format } from "date-fns";

interface Branch {
  id: string;
  name: string;
}

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
}

interface StockMovement {
  id: string;
  stockItemId: string;
  userId: string;
  quantity: number | string;
  type: "IN" | "OUT" | "ADJUSTMENT" | "PRODUCTION_USAGE";
  reason?: string;
  createdAt: string;
  stockItem: {
    id: string;
    name: string;
    unitType: string;
  };
  user: {
    id: string;
    fullName: string;
  };
}

export default function StockMovementsPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // New Movement Form State
  const [movementType, setMovementType] = useState<"IN" | "OUT" | "ADJUSTMENT">("IN");
  const [selectedStockItem, setSelectedStockItem] = useState<string>("");

  const fetchBranches = useCallback(async () => {
    if (!isGlobalAdmin) return;
    try {
      const res = await api.get("/branches");
      setBranches(res.data);
      if (res.data.length > 0 && !selectedBranchId) {
        setSelectedBranchId(res.data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  }, [isGlobalAdmin, selectedBranchId]);

  const fetchItems = useCallback(async () => {
    try {
      const endpoint = (isGlobalAdmin && selectedBranchId) 
        ? `/stock-items?branchId=${selectedBranchId}` 
        : `/stock-items`;
      if (isGlobalAdmin && !selectedBranchId) return;
      const res = await api.get(endpoint);
      setStockItems(res.data);
    } catch (e) {
      console.error(e);
    }
  }, [isGlobalAdmin, selectedBranchId]);

  const fetchMovements = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = (isGlobalAdmin && selectedBranchId) 
        ? `/stock-movements?branchId=${selectedBranchId}` 
        : `/stock-movements`;
        
      if (isGlobalAdmin && !selectedBranchId) {
         setMovements([]);
         setIsLoading(false);
         return;
      }
      const res = await api.get(endpoint);
      setMovements(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching stock movements");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isGlobalAdmin, selectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

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
          {isGlobalAdmin && (
            <select 
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="border rounded-md h-10 px-3 bg-white text-sm"
            >
              <option value="" disabled>Select Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}
          <Button onClick={() => setIsAddOpen(true)}>Record Movement</Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Recorded By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-400">Loading...</TableCell></TableRow>
            ) : movements.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-400">No movements recorded yet.</TableCell></TableRow>
            ) : movements.map(mov => (
              <TableRow key={mov.id}>
                <TableCell className="text-zinc-600">
                  {format(new Date(mov.createdAt), "MMM d, yyyy HH:mm")}
                </TableCell>
                <TableCell className="font-medium">{mov.stockItem?.name}</TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getMovementColor(mov.type)}`}>
                    {mov.type.replace('_', ' ')}
                  </span>
                </TableCell>
                <TableCell className="font-semibold">
                  {mov.type === "OUT" || mov.type === "PRODUCTION_USAGE" ? "-" : "+"}
                  {Number(mov.quantity).toFixed(2)} <span className="text-xs text-zinc-400 font-normal">{mov.stockItem?.unitType}</span>
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-zinc-600" title={mov.reason || "-"}>
                  {mov.reason || "-"}
                </TableCell>
                <TableCell>{mov.user?.fullName}</TableCell>
              </TableRow>
            ))}
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
