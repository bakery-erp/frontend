"use client";
import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";

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

export default function StockPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [items, setItems] = useState<StockItem[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

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

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = (isGlobalAdmin && selectedBranchId) 
        ? `/stock-items?branchId=${selectedBranchId}` 
        : `/stock-items`;
        
      if (isGlobalAdmin && !selectedBranchId) {
         setItems([]);
         setIsLoading(false);
         return; // wait for branch selection
      }

      const res = await api.get(endpoint);
      setItems(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching stock");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isGlobalAdmin, selectedBranchId]);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, isEdit: boolean) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      branchId: isGlobalAdmin ? formData.get("branchId") : undefined,
      name: formData.get("name"),
      unitType: formData.get("unitType"),
      currentQuantity: Number(formData.get("currentQuantity")),
      minStockLevel: formData.get("minStockLevel") ? Number(formData.get("minStockLevel")) : undefined,
    };

    try {
      if (isEdit && editingItem) {
        await api.patch(`/stock-items/${editingItem.id}`, data);
        toast.success("Stock item updated");
      } else {
        await api.post("/stock-items", data);
        toast.success("Stock item created");
      }
      setIsAddOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Stock & Inventory</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage raw materials and stock levels</p>
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
          <Button onClick={() => setIsAddOpen(true)}>Add Stock Item</Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item Name</TableHead>
              <TableHead>Unit Type</TableHead>
              <TableHead>Current Qty</TableHead>
              <TableHead>Min Stock Level</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-zinc-400">Loading...</TableCell></TableRow>
            ) : items.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-zinc-400">No stock items found.</TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.unitType}</TableCell>
                <TableCell>
                  <span className={`font-semibold ${
                    item.minStockLevel && Number(item.currentQuantity) <= Number(item.minStockLevel) 
                      ? 'text-red-600' : ''
                  }`}>
                    {Number(item.currentQuantity).toFixed(2)}
                  </span>
                </TableCell>
                <TableCell>{item.minStockLevel != null ? Number(item.minStockLevel).toFixed(2) : "-"}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => setEditingItem(item)}>Edit</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Dialogs */}
      {(isAddOpen || editingItem) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingItem(null);
          }
        }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Stock Item" : "Add New Stock Item"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingItem)}>
              <div className="grid gap-4 py-4">
                {isGlobalAdmin && !editingItem && (
                  <div>
                    <label className="text-sm font-medium mb-1 block">Branch</label>
                    <select name="branchId" required defaultValue={selectedBranchId} className="w-full border rounded-md h-10 px-3 bg-background text-sm">
                      <option value="" disabled>Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-sm font-medium mb-1 block">Item Name</label>
                  <Input name="name" required defaultValue={editingItem?.name || ""} placeholder="e.g. Flour" />
                </div>
                
                <div>
                  <label className="text-sm font-medium mb-1 block">Unit</label>
                  <select name="unitType" required defaultValue={editingItem?.unitType || "KG"} className="w-full border rounded-md h-10 px-3 bg-background text-sm">
                    <option value="KG">Kg</option>
                    <option value="PIECE">Piece</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Current Quantity</label>
                  <Input name="currentQuantity" type="number" step="0.001" required defaultValue={editingItem?.currentQuantity ?? ""} />
                </div>

                <div>
                  <label className="text-sm font-medium mb-1 block">Minimum Stock Level (Optional)</label>
                  <Input name="minStockLevel" type="number" step="0.001" defaultValue={editingItem?.minStockLevel ?? ""} placeholder="Alert threshold" />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditingItem(null); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : (editingItem ? "Save Changes" : "Create Item")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
