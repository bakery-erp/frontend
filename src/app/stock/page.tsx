"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { AlertCircle, MinusCircle, PlusCircle, Plus, Trash2, Edit3, PackageCheck, History } from "lucide-react";

import ConfirmModal from "@/components/ConfirmModal";

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
  const { selectedBranchId, branches } = useBranch();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  // Quick Filters
  const [filterToday, setFilterToday] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Manual stock addition modal state
  const [addingItem, setAddingItem] = useState<StockItem | null>(null);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");

  // Manual stock reduction modal state
  const [reducingItem, setReducingItem] = useState<StockItem | null>(null);
  const [reduceAmount, setReduceAmount] = useState<string>("");
  const [reduceReason, setReduceReason] = useState<string>("");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedBranchId 
        ? `/stock-items?branchId=${selectedBranchId}` 
        : `/stock-items`;

      const res = await api.get(endpoint);
      setItems(res.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching stock");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

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
        toast.success("Stock item created & movement logged");
      }
      setIsAddOpen(false);
      setEditingItem(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error saving stock item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingItem) return;

    const qty = parseFloat(addAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${addingItem.id}/add`, {
        quantity: qty,
        reason: addReason.trim() || "Manual Stock Addition",
      });
      toast.success(`Successfully added ${qty} ${addingItem.unitType} to ${addingItem.name}`);
      setAddingItem(null);
      setAddAmount("");
      setAddReason("");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReduceStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reducingItem) return;

    const qty = parseFloat(reduceAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${reducingItem.id}/reduce`, {
        quantity: qty,
        reason: reduceReason.trim() || "Manual Stock Reduction",
      });
      toast.success(`Successfully reduced ${qty} ${reducingItem.unitType} from ${reducingItem.name}`);
      setReducingItem(null);
      setReduceAmount("");
      setReduceReason("");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reduce stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await api.delete(`/stock-items/${itemToDelete.id}`);
      toast.success("Stock item deleted");
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete item");
    } finally {
      setItemToDelete(null);
    }
  };

  const filteredItems = items.filter((item) => {
    if (filterLowStock) {
      const isLow = item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel);
      if (!isLow) return false;
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!item.name.toLowerCase().includes(q) && !item.unitType.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight">Stock & Inventory</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">Manage raw materials, ingredient stock levels, and item audit history</p>
        </div>
        {isGlobalAdmin && (
          <div className="flex items-center gap-3">
            <Button onClick={() => setIsAddOpen(true)} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Create Stock Item
            </Button>
          </div>
        )}
      </div>

      {/* Filter Bar with Today Button */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={filterToday ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterToday(!filterToday)}
            className={`rounded-xl text-xs font-bold ${filterToday ? 'bg-[#4A2E1B] text-white' : 'border-[#EDE4D5] text-[#4A2E1B]'}`}
          >
            📅 Daily Stock Today
          </Button>

          <Button
            type="button"
            variant={filterLowStock ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`rounded-xl text-xs font-bold ${filterLowStock ? 'bg-rose-600 text-white' : 'border-rose-200 text-rose-700'}`}
          >
            ⚠️ Low Stock Alert
          </Button>
        </div>

        <Input
          placeholder="Search stock items..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64 rounded-xl border-zinc-200 text-xs h-9"
        />
      </div>

      {!isGlobalAdmin && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-center gap-3">
          <PackageCheck className="w-5 h-5 text-amber-600 shrink-0" />
          <span>
            <strong>Staff Stock View:</strong> Material levels are view-only. To log ingredients used in production, navigate to the <strong>Production page</strong> to submit your usage report.
          </span>
        </div>
      )}

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock Material Item</TableHead>
              <TableHead>Unit Type</TableHead>
              <TableHead>Available On-Hand Qty</TableHead>
              <TableHead>Min Alert Level</TableHead>
              <TableHead className="text-right pr-6">Detail History & Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#8C7361] font-medium">Loading stock inventory...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-[#8C7361] font-medium">No matching stock items found.</TableCell></TableRow>
            ) : filteredItems.map(item => {
              const isLowStock = item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel);
              return (
                <TableRow key={item.id}>
                  <TableCell className="font-bold text-[#2C1B10]">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/stock/${item.id}`} 
                        className="hover:text-[#E87A18] hover:underline font-bold transition-colors"
                      >
                        {item.name}
                      </Link>
                      {isLowStock && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                          <AlertCircle className="w-3 h-3" /> Low Stock
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><span className="px-2.5 py-1 rounded-md bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] text-xs font-bold">{item.unitType}</span></TableCell>
                  <TableCell>
                    <span className={`font-extrabold text-base ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {Number(item.currentQuantity).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-[#8C7361]">{item.minStockLevel != null ? Number(item.minStockLevel).toFixed(2) : "—"}</TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-1.5">
                      <Link href={`/stock/${item.id}`}>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-8 px-2.5 text-xs text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] hover:text-[#E87A18] flex items-center gap-1 font-bold"
                        >
                          <History className="w-3.5 h-3.5" />
                          View History
                        </Button>
                      </Link>

                      {isGlobalAdmin && (
                        <>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setAddingItem(item);
                              setAddAmount("");
                              setAddReason("");
                            }}
                            className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 font-semibold"
                          >
                            <PlusCircle className="w-3.5 h-3.5" />
                            Add
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                              setReducingItem(item);
                              setReduceAmount("");
                              setReduceReason("");
                            }}
                            className="h-8 px-2.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1 font-semibold"
                          >
                            <MinusCircle className="w-3.5 h-3.5" />
                            Reduce
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setEditingItem(item)}
                            className="h-8 px-2 text-zinc-600 hover:text-zinc-900"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => setItemToDelete(item)}
                            className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Add / Edit Item Definition Dialog */}
      {(isAddOpen || editingItem) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingItem(null);
          }
        }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                {editingItem ? "Edit Stock Item" : "Create New Stock Item"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingItem)}>
              <div className="grid gap-4 py-4">
                {isGlobalAdmin && !editingItem && (
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Branch</label>
                    <select name="branchId" required defaultValue={selectedBranchId || ""} className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                      <option value="" disabled>Select Branch</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Item Name</label>
                  <Input name="name" required defaultValue={editingItem?.name || ""} placeholder="e.g. Wheat Flour" className="rounded-xl border-zinc-200" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Unit Type</label>
                  <select name="unitType" required defaultValue={editingItem?.unitType || "KG"} className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                    <option value="KG">Kg (Kilogram)</option>
                    <option value="PIECE">Piece</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Current Available Quantity</label>
                  <Input name="currentQuantity" type="number" step="0.001" required defaultValue={editingItem?.currentQuantity ?? ""} placeholder="0.00" className="rounded-xl border-zinc-200" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Minimum Stock Threshold (Alert level)</label>
                  <Input name="minStockLevel" type="number" step="0.001" defaultValue={editingItem?.minStockLevel ?? ""} placeholder="e.g. 10.00" className="rounded-xl border-zinc-200" />
                </div>
              </div>
              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditingItem(null); }} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Saving..." : (editingItem ? "Save Changes" : "Create Item")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Addition Dialog */}
      {addingItem && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setAddingItem(null); }}>
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
                  Adding stock to <strong className="font-bold">{addingItem.name}</strong>. Currently available: <span className="font-bold text-emerald-700">{Number(addingItem.currentQuantity).toFixed(2)} {addingItem.unitType}</span>.
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Quantity to Add ({addingItem.unitType}) *
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
                <Button type="button" variant="outline" onClick={() => setAddingItem(null)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Confirm Addition"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Reduction Dialog */}
      {reducingItem && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setReducingItem(null); }}>
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
                  Reducing stock for <strong className="font-bold">{reducingItem.name}</strong>. Currently available: <span className="font-bold text-amber-700">{Number(reducingItem.currentQuantity).toFixed(2)} {reducingItem.unitType}</span>.
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    Quantity to Reduce ({reducingItem.unitType}) *
                  </label>
                  <Input 
                    type="number" 
                    step="0.001" 
                    required 
                    min="0.001"
                    max={Number(reducingItem.currentQuantity)}
                    value={reduceAmount} 
                    onChange={(e) => setReduceAmount(e.target.value)}
                    placeholder={`Max: ${Number(reducingItem.currentQuantity).toFixed(2)}`} 
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
                <Button type="button" variant="outline" onClick={() => setReducingItem(null)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Confirm Reduction"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Delete Stock Item"
        description={`Are you sure you want to delete '${itemToDelete?.name}'? This action cannot be undone.`}
        confirmText="Delete Item"
        variant="danger"
      />
    </DashboardLayout>
  );
}
