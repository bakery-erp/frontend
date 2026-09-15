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
import { useLanguage } from "@/context/LanguageContext";
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
  const { t } = useLanguage();
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

  const lowStockCount = items.filter(
    (item) => item.minStockLevel != null && Number(item.currentQuantity) <= Number(item.minStockLevel)
  ).length;

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight">{t('stock.title')}</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">{t('stock.subtitle')}</p>
        </div>
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <Link href="/stock-movements" className="flex-1 sm:flex-initial">
            <Button variant="outline" className="w-full h-10 rounded-xl border-purple-200 text-purple-900 bg-purple-50 hover:bg-purple-100 font-bold text-xs sm:text-sm flex items-center justify-center gap-1.5">
              <CreditCard className="w-4 h-4 text-purple-600 shrink-0" />
              <span>Stock Loans & Credit</span>
            </Button>
          </Link>
          {user?.role === "OWNER" && (
            <Button onClick={() => setIsAddOpen(true)} className="flex-1 sm:flex-initial h-10 bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl shadow-sm text-xs sm:text-sm flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t('stock.newItem')}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Filter Bar with Centered Segmented Control */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 mb-6 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="w-full sm:max-w-md mx-auto sm:mx-0">
          <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EDE4D5]/70 rounded-2xl w-full shadow-2xs">
            <button
              type="button"
              onClick={() => {
                setFilterLowStock(false);
                setFilterToday(false);
              }}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                !filterLowStock
                  ? "bg-[#4A2E1B] text-white shadow-md ring-2 ring-[#4A2E1B]/20"
                  : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50"
              }`}
            >
              <span>Daily Stock Today</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                !filterLowStock ? "bg-white/20 text-white" : "bg-[#4A2E1B]/10 text-[#4A2E1B]"
              }`}>
                {items.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterLowStock(true)}
              className={`py-2 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                filterLowStock
                  ? "bg-rose-600 text-white shadow-md ring-2 ring-rose-500/20"
                  : "text-[#8C7361] hover:text-rose-700 hover:bg-rose-50/50"
              }`}
            >
              <span>⚠️ Low Stock</span>
              {lowStockCount > 0 ? (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  filterLowStock ? "bg-white text-rose-700 font-extrabold" : "bg-rose-600 text-white"
                }`}>
                  {lowStockCount}
                </span>
              ) : (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  filterLowStock ? "bg-white/20 text-white" : "bg-zinc-200 text-zinc-600"
                }`}>
                  0
                </span>
              )}
            </button>
          </div>
        </div>

        <Input
          placeholder={t('common.search')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:w-64 rounded-xl border-[#EDE4D5] text-xs h-10 bg-[#FAF6F0]/40"
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
              <TableHead>{t('stock.colItemName')}</TableHead>
              <TableHead>{t('products.colUnit')}</TableHead>
              <TableHead>{t('stock.colUnitPrice')}</TableHead>
              <TableHead>{t('stock.colCurrentQty')}</TableHead>
              <TableHead>{t('dashboard.productStockValue')}</TableHead>
              <TableHead>{t('stock.colMinLevel')}</TableHead>
              <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
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
                  <div className={`text-lg font-extrabold font-mono ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {Number(item.currentQuantity).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8C7361] font-bold uppercase">On-Hand Qty</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Unit Rate</span>
                  <span className="font-bold text-[#2C1B10] font-mono">{price > 0 ? `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}</span>
                </div>
                <div>
                  <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">Total Valuation</span>
                  <span className="font-bold text-amber-900 font-mono">{totalVal > 0 ? `${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}</span>
                </div>
              </div>

              {/* Primary Actions Row */}
              <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-zinc-100">
                <Link href={`/stock/${item.id}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full h-9 text-xs text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] font-bold flex items-center justify-center gap-1 px-1">
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span>History</span>
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
                      className="h-9 px-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold flex items-center justify-center gap-1"
                    >
                      <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Add</span>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        setReducingItem(item);
                        setReduceAmount("");
                        setReduceReason("");
                      }}
                      className="h-9 px-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 font-bold flex items-center justify-center gap-1"
                    >
                      <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Reduce</span>
                    </Button>
                  </>
                )}
              </div>

              {/* Admin Manage Row (Edit / Delete) */}
              {isGlobalAdmin && (
                <div className="flex items-center gap-2 pt-1 border-t border-dashed border-zinc-150">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingItem(item)}
                    className="flex-1 h-8 text-xs font-bold text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-[#8C7361]" /> Edit Item
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemToDelete(item)}
                    className="flex-1 h-8 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> Delete
                  </Button>
                </div>
              )}
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
          <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                {editingItem ? "Edit Stock Item" : "Create New Stock Item"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingItem)}>
              <div className="grid gap-3.5 py-3">
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
                  <Input name="name" required defaultValue={editingItem?.name || ""} placeholder="e.g. Wheat Flour" className="h-10 rounded-xl border-zinc-200" />
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
                  <Input
                    name="unitPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={editingItem?.unitPrice ?? ""}
                    placeholder="0.00"
                    onFocus={(e) => e.target.select()}
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Current Available Quantity</label>
                  <Input
                    name="currentQuantity"
                    type="number"
                    step="0.001"
                    required
                    defaultValue={editingItem?.currentQuantity ?? ""}
                    placeholder="0.00"
                    onFocus={(e) => e.target.select()}
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Minimum Stock Threshold (Alert level)</label>
                  <Input
                    name="minStockLevel"
                    type="number"
                    step="0.001"
                    defaultValue={editingItem?.minStockLevel ?? ""}
                    placeholder="e.g. 10.00"
                    onFocus={(e) => e.target.select()}
                    className="h-10 rounded-xl border-zinc-200 font-mono"
                  />
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
                            className="bg-white rounded-xl border-purple-200 text-xs h-9" 
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
                            onFocus={(e) => e.target.select()}
                            placeholder="0.00 (leave 0 if full credit)" 
                            className="bg-white rounded-xl border-purple-200 text-xs h-9 font-mono" 
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
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-3">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? "Saving..." : (editingItem ? "Save Changes" : "Create Item")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsAddOpen(false); setEditingItem(null); }}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Addition Dialog */}
      {addingItem && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setAddingItem(null); }}>
          <DialogContent className="max-w-md rounded-2xl border-emerald-200 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                Manual Stock Addition (Restock)
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStock}>
              <div className="grid gap-3.5 py-3">
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
                    onFocus={(e) => e.target.select()}
                    placeholder="e.g. 50.00" 
                    className="h-10 rounded-xl border-zinc-200 font-mono" 
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
                    className="h-10 rounded-xl border-zinc-200" 
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
                          className="bg-white rounded-xl border-purple-200 text-xs h-9" 
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
                          onFocus={(e) => e.target.select()}
                          placeholder="0.00 (leave 0 if full credit)" 
                          className="bg-white rounded-xl border-purple-200 text-xs h-9 font-mono" 
                        />
                        <p className="text-[10px] text-purple-700 mt-1 font-medium">
                          Total purchase value: {((parseFloat(addAmount) || 0) * Number(addingItem.unitPrice || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? "Processing..." : "Confirm Addition"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddingItem(null)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Reduction Dialog */}
      {reducingItem && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setReducingItem(null); }}>
          <DialogContent className="max-w-md rounded-2xl border-amber-200 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-600 shrink-0" />
                Manual Stock Reduction
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReduceStock}>
              <div className="grid gap-3.5 py-3">
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
                    onFocus={(e) => e.target.select()}
                    placeholder={`Max: ${Number(reducingItem.currentQuantity).toFixed(2)}`} 
                    className="h-10 rounded-xl border-zinc-200 font-mono" 
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
                    className="h-10 rounded-xl border-zinc-200" 
                  />
                </div>
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? "Processing..." : "Confirm Reduction"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReducingItem(null)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  Cancel
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
