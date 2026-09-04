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
import { AlertCircle, MinusCircle, PlusCircle, Plus, Trash2, Edit3, PackageCheck, History, CreditCard } from "lucide-react";

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
  unitPrice?: number;
  minStockLevel?: number;
  branchId: string;
  branch?: Branch;
}

export default function StockPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  useEffect(() => {
    if (user && !isGlobalAdmin) {
      toast.error("Access Restricted: Stock inventory is only available to Admin and Owner roles.");
      window.location.href = "/my-profile";
    }
  }, [user, isGlobalAdmin]);

  const [items, setItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  if (user && !isGlobalAdmin) {
    return null;
  }

  // Quick Filters
  const [filterToday, setFilterToday] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Manual stock addition modal state
  const [addingItem, setAddingItem] = useState<StockItem | null>(null);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");

  // Loan state for Creation
  const [isCreateLoan, setIsCreateLoan] = useState<boolean>(false);
  const [createPaidAmount, setCreatePaidAmount] = useState<string>("");
  const [createSupplierName, setCreateSupplierName] = useState<string>("");

  // Loan state for Restock / Addition
  const [isAddLoan, setIsAddLoan] = useState<boolean>(false);
  const [addPaidAmount, setAddPaidAmount] = useState<string>("");
  const [addSupplierName, setAddSupplierName] = useState<string>("");

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
      branchId: (formData.get("branchId") as string) || selectedBranchId || user?.branchId || undefined,
      name: formData.get("name"),
      unitType: formData.get("unitType"),
      currentQuantity: Number(formData.get("currentQuantity")),
      unitPrice: formData.get("unitPrice") ? Number(formData.get("unitPrice")) : 0,
      minStockLevel: formData.get("minStockLevel") ? Number(formData.get("minStockLevel")) : undefined,
      loanInfo: !isEdit && isCreateLoan ? {
        isLoan: true,
        paidAmount: createPaidAmount !== "" ? Number(createPaidAmount) : 0,
        supplierName: createSupplierName.trim() || undefined,
      } : undefined,
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
      setIsCreateLoan(false);
      setCreatePaidAmount("");
      setCreateSupplierName("");
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
        loanInfo: isAddLoan ? {
          isLoan: true,
          paidAmount: addPaidAmount !== "" ? Number(addPaidAmount) : 0,
          supplierName: addSupplierName.trim() || undefined,
        } : undefined,
      });
      toast.success(`Successfully added ${qty} ${addingItem.unitType} to ${addingItem.name}`);
      setAddingItem(null);
      setAddAmount("");
      setAddReason("");
      setIsAddLoan(false);
      setAddPaidAmount("");
      setAddSupplierName("");
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
        <div className="flex items-center gap-3">
          <Link href="/stock-movements">
            <Button variant="outline" className="rounded-xl border-purple-200 text-purple-900 bg-purple-50 hover:bg-purple-100 font-bold text-xs sm:text-sm flex items-center gap-1.5">
              <CreditCard className="w-4 h-4 text-purple-600" />
              Stock Loans & Credit
            </Button>
          </Link>
          {user?.role === "OWNER" && (
            <Button onClick={() => setIsAddOpen(true)} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              Create Stock Item
            </Button>
          )}
        </div>
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

      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Stock Material Item</TableHead>
              <TableHead>Unit Type</TableHead>
              <TableHead>Unit Price (ETB)</TableHead>
              <TableHead>Available On-Hand Qty</TableHead>
              <TableHead>Total Valuation (ETB)</TableHead>
              <TableHead>Min Alert Level</TableHead>
              <TableHead className="text-right pr-6">Detail History & Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">Loading stock inventory...</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">No matching stock items found.</TableCell></TableRow>
            ) : filteredItems.map(item => {
              const isLowStock = item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel);
              const price = Number(item.unitPrice || 0);
              const totalVal = Number(item.currentQuantity) * price;
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
                  <TableCell className="font-bold text-xs text-[#2C1B10]">
                    {price > 0 ? `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}
                  </TableCell>
                  <TableCell>
                    <span className={`font-extrabold text-base ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {Number(item.currentQuantity).toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="font-extrabold text-xs text-amber-900">
                    {totalVal > 0 ? `${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}
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
                              setIsAddLoan(false);
                              setAddPaidAmount("");
                              setAddSupplierName("");
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

      {/* Mobile Cards View */}
      <div className="grid grid-cols-1 gap-3 sm:hidden">
        {isLoading ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">Loading stock inventory...</div>
        ) : filteredItems.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">No matching stock items found.</div>
        ) : filteredItems.map(item => {
          const isLowStock = item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel);
          const price = Number(item.unitPrice || 0);
          const totalVal = Number(item.currentQuantity) * price;
          return (
            <div key={item.id} className="bg-white rounded-2xl p-4 border border-[#EDE4D5] shadow-xs space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <Link href={`/stock/${item.id}`} className="font-extrabold text-[#2C1B10] hover:text-[#E87A18] text-base block">
                    {item.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded-md bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] text-[11px] font-bold">
                      {item.unitType}
                    </span>
                    {isLowStock && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">
                        <AlertCircle className="w-3 h-3" /> Low Stock
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-extrabold ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {Number(item.currentQuantity).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8C7361] font-bold uppercase">On-Hand Qty</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Unit Rate</span>
                  <span className="font-bold text-[#2C1B10]">{price > 0 ? `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}</span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Total Valuation</span>
                  <span className="font-bold text-amber-900">{totalVal > 0 ? `${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-1.5 pt-2 border-t border-zinc-100">
                <Link href={`/stock/${item.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full h-8 text-xs text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] font-bold flex items-center justify-center gap-1">
                    <History className="w-3.5 h-3.5" /> History
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
                        setIsAddLoan(false);
                        setAddPaidAmount("");
                        setAddSupplierName("");
                      }}
                      className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold flex items-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Add
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setReducingItem(item);
                        setReduceAmount("");
                        setReduceReason("");
                      }}
                      className="h-8 px-2.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 font-bold flex items-center gap-1"
                    >
                      <MinusCircle className="w-3.5 h-3.5" /> Reduce
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Item Definition Dialog */}
      {(isAddOpen || editingItem) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingItem(null);
            setIsCreateLoan(false);
            setCreatePaidAmount("");
            setCreateSupplierName("");
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
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Unit Cost / Price (ETB per unit)</label>
                  <Input name="unitPrice" type="number" step="0.01" min="0" defaultValue={editingItem?.unitPrice ?? ""} placeholder="0.00" className="rounded-xl border-zinc-200" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Current Available Quantity</label>
                  <Input name="currentQuantity" type="number" step="0.001" required defaultValue={editingItem?.currentQuantity ?? ""} placeholder="0.00" className="rounded-xl border-zinc-200" />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Minimum Stock Threshold (Alert level)</label>
                  <Input name="minStockLevel" type="number" step="0.001" defaultValue={editingItem?.minStockLevel ?? ""} placeholder="e.g. 10.00" className="rounded-xl border-zinc-200" />
                </div>

                {!editingItem && (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isCreateLoan} 
                        onChange={(e) => setIsCreateLoan(e.target.checked)} 
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-purple-900">Purchased on Credit / Loan?</span>
                    </label>

                    {isCreateLoan && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Supplier / Vendor Name (Optional)</label>
                          <Input 
                            value={createSupplierName} 
                            onChange={(e) => setCreateSupplierName(e.target.value)} 
                            placeholder="e.g. Flour Factory PLC" 
                            className="bg-white rounded-xl border-purple-200 text-xs" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">Amount Paid Upfront (Down Payment)</label>
                          <Input 
                            type="number" 
                            step="0.01" 
                            min="0" 
                            value={createPaidAmount} 
                            onChange={(e) => setCreatePaidAmount(e.target.value)} 
                            placeholder="0.00 (leave 0 if full credit)" 
                            className="bg-white rounded-xl border-purple-200 text-xs" 
                          />
                          <p className="text-[10px] text-purple-700 mt-1 font-medium">
                            If unpaid or partial, the remaining balance will be tracked as a credit purchase loan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
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
                  Adding stock to <strong className="font-bold">{addingItem.name}</strong>. Currently available: <span className="font-bold text-emerald-700">{Number(addingItem.currentQuantity).toFixed(2)} {addingItem.unitType}</span> (Rate: <span className="font-bold text-emerald-800">{Number(addingItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{addingItem.unitType}</span>).
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
                          Total purchase value: {((parseFloat(addAmount) || 0) * Number(addingItem.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </p>
                      </div>
                    </div>
                  )}
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
                  Reducing stock for <strong className="font-bold">{reducingItem.name}</strong>. Currently available: <span className="font-bold text-amber-700">{Number(reducingItem.currentQuantity).toFixed(2)} {reducingItem.unitType}</span> (Rate: <span className="font-bold text-amber-800">{Number(reducingItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB/{reducingItem.unitType}</span>).
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
