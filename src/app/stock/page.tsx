"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { AlertCircle, MinusCircle, PlusCircle, Plus, Trash2, Edit3, PackageCheck, History, SlidersHorizontal, CheckCircle2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TableSkeleton } from "@/components/ui/skeletons";

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
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const isOwner = user?.role === "OWNER";
  const isGlobalAdmin = user?.role === "ADMIN" || isOwner;
  const isStockKeeper = user?.role === "STOCK_KEEPER";
  const isStockStaff = isGlobalAdmin || isStockKeeper;

  useEffect(() => {
    if (user && !isStockStaff) {
      toast.error("Access Restricted: Stock inventory is only available to Stock Keeper, Admin, and Owner roles.");
      router.replace("/my-profile");
    }
  }, [user, isStockStaff, router]);

  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingItem, setEditingItem] = useState<StockItem | null>(null);

  if (user && !isStockStaff) {
    return null;
  }

  // Quick Filters
  const [filterToday, setFilterToday] = useState(false);
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Manual stock addition modal state
  const [addingItem, setAddingItem] = useState<StockItem | null>(null);
  const [addAmount, setAddAmount] = useState<string>("");
  const [addUnitPrice, setAddUnitPrice] = useState<string>("");
  const [addReason, setAddReason] = useState<string>("");
  const [isAutoConfirm, setIsAutoConfirm] = useState<boolean>(false);

  const openAddStockModal = (item: StockItem) => {
    if (!isGlobalAdmin) return;
    setAddingItem(item);
    setAddAmount("");
    setAddUnitPrice(item.unitPrice != null ? String(item.unitPrice) : "");
    setAddReason("");
    setIsAddLoan(false);
    setAddPaidAmount("");
    setAddSupplierName("");
    setIsAutoConfirm(false);
  };

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
  const [reduceReceivedBy, setReduceReceivedBy] = useState<string>("");

  // Adjustment state for Owner
  const [adjustingItem, setAdjustingItem] = useState<StockItem | null>(null);
  const [adjustTo, setAdjustTo] = useState<string>("");
  const [adjustReason, setAdjustReason] = useState<string>("");
  const [isAdjusting, setIsAdjusting] = useState<boolean>(false);

  const openAdjustStockModal = (item: StockItem) => {
    if (!isOwner) return;
    setAdjustingItem(item);
    setAdjustTo(String(item.currentQuantity));
    setAdjustReason("");
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem || !isOwner) return;
    const newQty = parseFloat(adjustTo);
    if (isNaN(newQty) || newQty < 0) {
      toast.error("Please enter a valid non-negative physical count");
      return;
    }
    if (!adjustReason.trim()) {
      toast.error("Please provide a reason for the adjustment");
      return;
    }
    setIsAdjusting(true);
    try {
      await api.post('/stock-movements', {
        stockItemId: adjustingItem.id,
        quantity: Math.abs(newQty - Number(adjustingItem.currentQuantity)),
        adjustTo: newQty,
        type: 'ADJUSTMENT',
        reason: adjustReason.trim(),
      });
      toast.success(`Inventory successfully adjusted to ${newQty} ${adjustingItem.unitType}`);
      setAdjustingItem(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['stock-items'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-movements'] }),
        queryClient.invalidateQueries({ queryKey: ['stock-summary'] }),
      ]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setIsAdjusting(false);
    }
  };

  const { data: pendingApprovals = [] } = useQuery<any[]>({
    queryKey: ['stock-movements-pending', selectedBranchId],
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'PENDING_CONFIRMATION', limit: '50' });
      if (selectedBranchId) params.append('branchId', selectedBranchId);
      const res = await api.get(`/stock-movements?${params.toString()}`);
      if (Array.isArray(res.data)) return res.data;
      return res.data?.data || [];
    },
    enabled: isStockStaff,
  });

  const { data: stockSummary } = useQuery({
    queryKey: ['stock-summary', selectedBranchId],
    queryFn: async () => {
      const endpoint = selectedBranchId 
        ? `/stock-movements/summary?branchId=${selectedBranchId}` 
        : `/stock-movements/summary`;
      const res = await api.get(endpoint);
      return res.data;
    },
    enabled: isStockStaff,
  });

  const { data: items = [], isLoading } = useQuery<StockItem[]>({
    queryKey: ['stock-items', selectedBranchId],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const endpoint = selectedBranchId 
        ? `/stock-items?branchId=${selectedBranchId}` 
        : `/stock-items`;

      const res = await api.get(endpoint);
      return res.data || [];
    },
    enabled: isStockStaff,
  });

  const { data: dbUsers = [], isLoading: isUsersLoading } = useQuery<{
    id: string;
    fullName: string;
    role: string;
    branchId: string | null;
    isActive: boolean;
    branch?: { name: string } | null;
  }[]>({
    queryKey: ['staff-users', selectedBranchId],
    queryFn: async () => {
      const res = await api.get('/users', {
        params: selectedBranchId ? { branchId: selectedBranchId } : {},
      });
      return res.data || [];
    },
    enabled: isStockStaff,
  });

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
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error saving stock item");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isGlobalAdmin) {
      toast.error("Access Restricted: Only Admin and Owner can add stock");
      return;
    }
    if (!addingItem) return;

    const qty = parseFloat(addAmount);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity");
      return;
    }

    const parsedUnitPrice = addUnitPrice !== "" ? parseFloat(addUnitPrice) : undefined;
    if (parsedUnitPrice !== undefined && (isNaN(parsedUnitPrice) || parsedUnitPrice < 0)) {
      toast.error("Please enter a valid positive unit price");
      return;
    }

    const effectiveAutoConfirm = isOwner ? isAutoConfirm : false;
    setIsSubmitting(true);
    try {
      await api.post(`/stock-items/${addingItem.id}/add`, {
        quantity: qty,
        unitPrice: parsedUnitPrice,
        reason: addReason.trim() || (effectiveAutoConfirm ? "Manual Stock Addition" : "Added by Admin/Owner (Awaiting Stock Keeper Verification)"),
        autoConfirm: effectiveAutoConfirm,
        loanInfo: isAddLoan ? {
          isLoan: true,
          paidAmount: addPaidAmount !== "" ? Number(addPaidAmount) : 0,
          supplierName: addSupplierName.trim() || undefined,
        } : undefined,
      });
      if (effectiveAutoConfirm) {
        toast.success(`Successfully added ${qty} ${addingItem.unitType} to ${addingItem.name}`);
      } else {
        toast.success(`Inward stock entry logged for ${addingItem.name}. Awaiting Stock Keeper physical count & verification.`);
      }
      setAddingItem(null);
      setAddAmount("");
      setAddUnitPrice("");
      setAddReason("");
      setIsAddLoan(false);
      setAddPaidAmount("");
      setAddSupplierName("");
      setIsAutoConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-pending'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-loans'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add stock level");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReduceStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reducingItem) return;

    if (!reduceReceivedBy.trim()) {
      toast.error("Please choose the staff member who took this stock item");
      return;
    }

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
        receivedBy: reduceReceivedBy.trim(),
      });
      toast.success(`Successfully issued ${qty} ${reducingItem.unitType} from ${reducingItem.name}`);
      setReducingItem(null);
      setReduceAmount("");
      setReduceReason("");
      setReduceReceivedBy("");
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
        </div>
        {user?.role === "OWNER" && (
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button onClick={() => setIsAddOpen(true)} size="default" className="flex-1 sm:flex-initial">
              <Plus className="w-4 h-4 shrink-0" />
              <span>{t('stock.newItem')}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Pending Inward Deliveries Callout for Stock Keeper & Admins */}
      {pendingApprovals.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-300 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200 text-amber-900 flex items-center justify-center shrink-0">
              <PackageCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-extrabold text-sm text-[#2C1B10]">
                {pendingApprovals.length} Inward {pendingApprovals.length === 1 ? 'Delivery' : 'Deliveries'} Awaiting Verification
              </h4>
              <p className="text-xs text-[#8C7361]">
                Goods added by Admin/Owner must be physically counted and confirmed by the Stock Keeper before updating warehouse inventory.
              </p>
            </div>
          </div>
          <Link href="/stock-movements?tab=approvals" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-9 px-4 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shrink-0 shadow-xs">
              <CheckCircle2 className="w-4 h-4" />
              <span>Verify & Accept Deliveries</span>
            </Button>
          </Link>
        </div>
      )}

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
              <span>{t('stock.filterAllItems')}</span>
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
              <span>⚠️ {t('stock.lowStockWarningBadge')}</span>
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


      {/* Desktop Table View */}
      <div className="hidden sm:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('stock.colItemName')}</TableHead>
              <TableHead>{t('products.colUnit')}</TableHead>
              {isOwner && <TableHead>{t('stock.colUnitPrice')}</TableHead>}
              <TableHead>{t('stock.colCurrentQty')}</TableHead>
              {isOwner && <TableHead>{t('dashboard.productStockValue')}</TableHead>}
              <TableHead>{t('stock.colMinLevel')}</TableHead>
              <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isOwner ? 7 : 5} className="p-4">
                  <TableSkeleton rows={6} columns={isOwner ? 6 : 4} hasActions={true} />
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={isOwner ? 7 : 5} className="text-center py-8 text-[#8C7361] font-medium">{t('stock.noItems')}</TableCell></TableRow>
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
                          <AlertCircle className="w-3 h-3" /> {t('stock.lowStockWarningBadge')}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell><span className="px-2.5 py-1 rounded-md bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] text-xs font-bold">{item.unitType}</span></TableCell>
                  {isOwner && (
                    <TableCell className="font-bold text-xs text-[#2C1B10]">
                      {price > 0 ? `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}
                    </TableCell>
                  )}
                  <TableCell>
                    <span className={`font-extrabold text-base ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {Number(item.currentQuantity).toFixed(2)}
                    </span>
                  </TableCell>
                  {isOwner && (
                    <TableCell className="font-extrabold text-xs text-amber-900">
                      {totalVal > 0 ? `${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB` : "0.00 ETB"}
                    </TableCell>
                  )}
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
                          {t('stock.viewHistory')}
                        </Button>
                      </Link>

                      {isGlobalAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openAddStockModal(item)}
                          className="h-8 px-2.5 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 flex items-center gap-1 font-semibold"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          {t('stock.addStock')}
                        </Button>
                      )}

                      {isOwner && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => openAdjustStockModal(item)}
                          className="h-8 px-2.5 text-xs text-orange-700 border-orange-300 hover:bg-orange-50 flex items-center gap-1 font-semibold"
                          title="Audit / Adjust Physical Stock Count"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                          <span>Adjust</span>
                        </Button>
                      )}

                      {isStockStaff && (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => {
                            setReducingItem(item);
                            setReduceAmount("");
                            setReduceReceivedBy("");
                            setReduceReason("");
                          }}
                          className="h-8 px-2.5 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 flex items-center gap-1 font-semibold"
                        >
                          <MinusCircle className="w-3.5 h-3.5" />
                          {t('stock.reduceStock')}
                        </Button>
                      )}

                      {isGlobalAdmin && (
                        <>
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
          <TableSkeleton rows={4} columns={3} hasActions={false} />
        ) : filteredItems.length === 0 ? (
          <div className="bg-white p-6 rounded-2xl text-center text-[#8C7361] font-medium border border-[#EDE4D5]">{t('stock.noItems')}</div>
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
                        <AlertCircle className="w-3 h-3" /> {t('stock.lowStockWarningBadge')}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-extrabold font-mono ${isLowStock ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {Number(item.currentQuantity).toFixed(2)}
                  </div>
                  <div className="text-[10px] text-[#8C7361] font-bold uppercase">{t('stock.colCurrentQty')}</div>
                </div>
              </div>

              {isOwner && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                  <div>
                    <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('stock.colUnitPrice')}</span>
                    <span className="font-bold text-[#2C1B10] font-mono">{price > 0 ? `${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('common.currency')}` : `0.00 ${t('common.currency')}`}</span>
                  </div>
                  <div>
                    <span className="text-[#8C7361] block text-[10px] uppercase font-semibold">{t('stock.colStockValue')}</span>
                    <span className="font-bold text-amber-900 font-mono">{totalVal > 0 ? `${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${t('common.currency')}` : `0.00 ${t('common.currency')}`}</span>
                  </div>
                </div>
              )}

              {/* Primary Actions Row */}
              <div className={`grid ${isOwner ? 'grid-cols-4' : (isGlobalAdmin ? 'grid-cols-3' : 'grid-cols-2')} gap-1.5 pt-2 border-t border-zinc-100`}>
                <Link href={`/stock/${item.id}`} className="w-full">
                  <Button variant="outline" size="sm" className="w-full h-9 text-xs text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0] font-bold flex items-center justify-center gap-1 px-1">
                    <History className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{t('stock.viewHistory')}</span>
                  </Button>
                </Link>

                {isGlobalAdmin && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openAddStockModal(item)}
                    className="h-9 px-1 text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-bold flex items-center justify-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('stock.addStock')}</span>
                  </Button>
                )}

                {isOwner && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => openAdjustStockModal(item)}
                    className="h-9 px-1 text-xs text-orange-700 border-orange-300 hover:bg-orange-50 font-bold flex items-center justify-center gap-1"
                    title="Audit / Adjust Stock"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
                    <span>Adjust</span>
                  </Button>
                )}

                {isStockStaff && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      setReducingItem(item);
                      setReduceAmount("");
                      setReduceReceivedBy("");
                      setReduceReason("");
                    }}
                    className="h-9 px-1 text-xs text-amber-700 border-amber-300 hover:bg-amber-50 font-bold flex items-center justify-center gap-1"
                  >
                    <MinusCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{t('stock.reduceStock')}</span>
                  </Button>
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
                    <Edit3 className="w-3 h-3 text-[#8C7361]" /> {t('common.edit')}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setItemToDelete(item)}
                    className="flex-1 h-8 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3 text-rose-500" /> {t('common.delete')}
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
                {editingItem ? t('stock.modalEditTitle') : t('stock.modalCreateTitle')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingItem)}>
              <div className="grid gap-3.5 py-3">
                {isGlobalAdmin && !editingItem && (
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.branch')}</label>
                    <select name="branchId" required defaultValue={selectedBranchId || ""} className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                      <option value="" disabled>{t('common.selectBranch')}</option>
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('stock.colItemName')}</label>
                  <Input name="name" required defaultValue={editingItem?.name || ""} placeholder="e.g. Wheat Flour" className="h-10 rounded-xl border-zinc-200" />
                </div>
                
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('common.unit')}</label>
                  <select name="unitType" required defaultValue={editingItem?.unitType || "KG"} className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]">
                    <option value="KG">Kg (Kilogram)</option>
                    <option value="PIECE">Piece</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('stock.unitPriceLabel')}</label>
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
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('stock.currentAvailableQty')}</label>
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
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">{t('stock.minThresholdAlert')}</label>
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
                      <span className="text-xs font-bold text-purple-900">{t('stock.creditPurchase')}</span>
                    </label>

                    {isCreateLoan && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t('stock.supplierOptional')}</label>
                          <Input 
                            value={createSupplierName} 
                            onChange={(e) => setCreateSupplierName(e.target.value)} 
                            placeholder="e.g. Flour Factory PLC" 
                            className="bg-white rounded-xl border-purple-200 text-xs h-9" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t('stock.downPayment')}</label>
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
                            {t('stock.creditNote')}
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
                  size="lg"
                  loading={isSubmitting}
                  className="w-full sm:w-auto order-1 sm:order-2"
                >
                  {editingItem ? t('common.saveChanges') : t('stock.modalCreateTitle')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  onClick={() => { setIsAddOpen(false); setEditingItem(null); }}
                  className="w-full sm:w-auto order-2 sm:order-1"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Addition Dialog */}
      {addingItem && isGlobalAdmin && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setAddingItem(null); }}>
          <DialogContent className="max-w-md rounded-2xl border-emerald-200 max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <PlusCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                {t('stock.modalAddStockTitle')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddStock}>
              <div className="grid gap-3.5 py-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-xs text-emerald-900">
                  Adding stock to <strong className="font-bold">{addingItem.name}</strong>. Currently available: <span className="font-bold text-emerald-700">{Number(addingItem.currentQuantity).toFixed(2)} {addingItem.unitType}</span>{isOwner && <> (Rate: <span className="font-bold text-emerald-800">{Number(addingItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}/{addingItem.unitType}</span>)</>}.
                </div>

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    {t('stock.quantityToAdd')} ({addingItem.unitType}) *
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

                {isOwner && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold text-[#2C1B10] uppercase">
                          {t('stock.unitPriceLabel') || "Current Unit Price"} ({t('common.currency')}/{addingItem.unitType})
                        </label>
                        {addingItem.unitPrice != null && (
                          <span className="text-[11px] text-[#8C7361]">
                            Current: {Number(addingItem.unitPrice).toFixed(2)} {t('common.currency')}
                          </span>
                        )}
                      </div>
                      <Input 
                        type="number" 
                        step="0.01" 
                        min="0" 
                        value={addUnitPrice} 
                        onChange={(e) => setAddUnitPrice(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        placeholder={addingItem.unitPrice ? String(addingItem.unitPrice) : "0.00"} 
                        className="h-10 rounded-xl border-zinc-200 font-mono" 
                      />
                      <p className="text-[10px] text-[#8C7361] mt-1 font-medium">
                        Prompting current pricing updates this item's latest purchasing rate and stock movement value.
                      </p>
                    </div>

                    {(() => {
                      const qty = parseFloat(addAmount) || 0;
                      const rate = addUnitPrice !== "" ? (parseFloat(addUnitPrice) || 0) : Number(addingItem.unitPrice || 0);
                      if (qty > 0 && rate > 0) {
                        return (
                          <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between text-xs">
                            <span className="font-bold text-emerald-900">Total Purchase Cost:</span>
                            <span className="font-mono font-extrabold text-emerald-800 text-sm">
                              {(qty * rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </>
                )}

                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                    {t('common.notes')}
                  </label>
                  <Input 
                    value={addReason} 
                    onChange={(e) => setAddReason(e.target.value)} 
                    placeholder="e.g. Local Purchase, Restock, Inventory Audit" 
                    className="h-10 rounded-xl border-zinc-200" 
                  />
                                {isGlobalAdmin && (
                  <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isAddLoan} 
                        onChange={(e) => setIsAddLoan(e.target.checked)} 
                        className="rounded border-purple-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                      />
                      <span className="text-xs font-bold text-purple-900">{t('stock.creditPurchase')}</span>
                    </label>

                    {isAddLoan && (
                      <div className="space-y-3 pt-1">
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t('stock.supplierOptional')}</label>
                          <Input 
                            value={addSupplierName} 
                            onChange={(e) => setAddSupplierName(e.target.value)} 
                            placeholder="e.g. Grain Market Supplier" 
                            className="bg-white rounded-xl border-purple-200 text-xs h-9" 
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-purple-900 mb-1 block uppercase">{t('stock.paidAmountLabel')}</label>
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
                            {t('stock.unpaidDebtNote')}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}  </div>

                {isOwner && (
                  <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={isAutoConfirm} 
                        onChange={(e) => setIsAutoConfirm(e.target.checked)} 
                        className="rounded border-zinc-300 text-[#4A2E1B] focus:ring-[#4A2E1B] w-4 h-4"
                      />
                      <span className="text-xs font-bold text-zinc-800">{t('stock.autoConfirmPrompt')}</span>
                    </label>
                    <p className="text-[10px] text-zinc-500 mt-1 pl-6">
                      {isAutoConfirm ? "Stock balance will increment immediately without awaiting physical verification." : "Stock will be pending until Stock Keeper verifies and confirms physical receipt."}
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 sm:h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                >
                  {isSubmitting ? t('common.loading') : t('stock.recordDeliveryBtn')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAddingItem(null)}
                  className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Manual Stock Reduction Dialog */}
      {reducingItem && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setReducingItem(null); }}>
          <DialogContent className="bottom-0 top-auto translate-y-0 sm:top-1/2 sm:bottom-auto sm:-translate-y-1/2 max-w-full sm:max-w-md w-full rounded-t-3xl sm:rounded-2xl rounded-b-none sm:rounded-b-2xl p-4 sm:p-6 border border-amber-200/80 shadow-2xl max-h-[92dvh] sm:max-h-[90vh] flex flex-col gap-0 overflow-hidden bg-white">
            {/* Mobile visual drag handle */}
            <div className="w-12 h-1 bg-zinc-300 rounded-full mx-auto mb-2 sm:hidden shrink-0" />

            <DialogHeader className="shrink-0 pb-3 border-b border-amber-100/70 pr-8">
              <DialogTitle className="text-base sm:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <MinusCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>{t('stock.modalReduceStockTitle')}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleReduceStock} className="flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="flex-1 overflow-y-auto overscroll-contain py-3.5 space-y-3.5 pr-1 -mr-1">
                {/* Item & Available info card */}
                <div className="p-3 bg-amber-50/90 rounded-xl border border-amber-200/70 text-xs text-amber-950 flex flex-col xs:flex-row xs:items-center justify-between gap-2 shadow-2xs">
                  <div>
                    <span className="text-[#8C7361] font-bold block text-[10px] uppercase tracking-wider">
                      {t('stock.itemToIssue')}
                    </span>
                    <strong className="font-extrabold text-sm text-[#2C1B10]">
                      {reducingItem.name}
                    </strong>
                  </div>
                  <div className="flex items-center gap-2 bg-white px-2.5 py-1 rounded-lg border border-amber-200 w-fit self-start xs:self-auto">
                    <span className="font-extrabold text-amber-800 text-xs sm:text-sm">
                      {Number(reducingItem.currentQuantity).toFixed(2)} {reducingItem.unitType}
                    </span>
                    {isOwner && Number(reducingItem.unitPrice || 0) > 0 && (
                      <span className="text-[10px] text-[#8C7361] font-semibold border-l border-amber-200 pl-2">
                        @{Number(reducingItem.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {t('common.currency')}
                      </span>
                    )}
                  </div>
                </div>

                {/* Quantity Input with 1-Tap Use Max Button */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-[#2C1B10] block uppercase tracking-wide">
                      {t('stock.quantityToReduce')} ({reducingItem.unitType}) *
                    </label>
                    <button
                      type="button"
                      onClick={() => setReduceAmount(String(reducingItem.currentQuantity))}
                      className="text-[11px] font-extrabold text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded-md transition-colors flex items-center gap-1 active:scale-95"
                    >
                      {t('stock.useMax')} ({Number(reducingItem.currentQuantity).toFixed(2)})
                    </button>
                  </div>
                  <div className="relative">
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
                      className="h-11 rounded-xl border-zinc-200 font-mono text-base pr-16 bg-white focus:ring-2 focus:ring-[#E87A18]" 
                    />
                    <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#8C7361] pointer-events-none">
                      {reducingItem.unitType}
                    </span>
                  </div>
                </div>

                {/* Taken By Dropdown */}
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase tracking-wide">
                    {t('stock.takenByLabel')} *
                  </label>
                  <select 
                    required
                    value={reduceReceivedBy} 
                    onChange={(e) => setReduceReceivedBy(e.target.value)}
                    className="w-full border border-zinc-200 rounded-xl h-11 px-3 bg-white text-sm sm:text-base focus:ring-2 focus:ring-[#E87A18] focus:border-[#E87A18] outline-none text-[#2C1B10]"
                  >
                    <option value="" disabled>
                      {isUsersLoading ? t('stock.loadingStaff') : t('stock.selectStaffMember')}
                    </option>
                    {dbUsers.filter(u => u.isActive !== false).map((u) => (
                      <option key={u.id} value={u.fullName}>
                        {u.fullName} ({u.role?.replace('_', ' ')}{u.branch?.name ? ` • ${u.branch.name}` : ''})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Notes Input */}
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase tracking-wide">
                    {t('common.notes')}
                  </label>
                  <Input 
                    value={reduceReason} 
                    onChange={(e) => setReduceReason(e.target.value)}
                    placeholder="e.g. Spoilage, Wastage, Production Handover" 
                    className="h-11 rounded-xl border-zinc-200 text-sm sm:text-base bg-white focus:ring-2 focus:ring-[#E87A18]" 
                  />
                </div>
              </div>

              {/* Sticky Action Footer */}
              <DialogFooter className="shrink-0 pt-3 border-t border-zinc-100 flex flex-col sm:flex-row gap-2 w-full mt-auto bg-white">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm flex items-center justify-center gap-1.5"
                >
                  <MinusCircle className="w-4 h-4 shrink-0" />
                  <span>{isSubmitting ? t('common.loading') : t('stock.recordUsageBtn')}</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReducingItem(null)}
                  className="w-full sm:w-auto h-11 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1 font-semibold text-[#8C7361]"
                >
                  {t('common.cancel')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

        {/* Adjustment Modal (Owner Only) */}
        {adjustingItem && (
          <Dialog open={!!adjustingItem} onOpenChange={(open) => !open && setAdjustingItem(null)}>
            <DialogContent className="max-w-md bg-white border-[#EDE4D5] rounded-3xl p-6">
              <DialogHeader>
                <DialogTitle className="text-lg font-black text-[#2C1B10] flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-orange-600 shrink-0" />
                  Adjust Stock Count (Audit)
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAdjustStock}>
                <div className="grid gap-3.5 py-3">
                  <div className="p-3 bg-orange-50 rounded-xl border border-orange-200 text-xs text-orange-900">
                    Adjusting physical inventory count for <strong className="font-bold">{adjustingItem.name}</strong>. Current record: <span className="font-bold font-mono text-orange-800">{Number(adjustingItem.currentQuantity).toFixed(2)} {adjustingItem.unitType}</span>.
                  </div>

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                      New Actual Physical Count ({adjustingItem.unitType}) *
                    </label>
                    <Input 
                      type="number" 
                      step="0.001" 
                      required 
                      min="0"
                      value={adjustTo} 
                      onChange={(e) => setAdjustTo(e.target.value)}
                      onFocus={(e) => e.target.select()}
                      placeholder="e.g. 48.00" 
                      className="h-10 rounded-xl border-zinc-200 font-mono font-bold" 
                    />
                  </div>

                  {(() => {
                    const current = Number(adjustingItem.currentQuantity);
                    const entered = parseFloat(adjustTo);
                    if (!isNaN(entered)) {
                      const delta = entered - current;
                      const isGain = delta > 0;
                      const isLoss = delta < 0;
                      return (
                        <div className={`p-2.5 rounded-xl border text-xs flex items-center justify-between font-bold ${
                          delta === 0 
                            ? 'bg-zinc-50 border-zinc-200 text-zinc-700' 
                            : isLoss 
                              ? 'bg-rose-50 border-rose-200 text-rose-800' 
                              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                        }`}>
                          <span>Inventory Difference:</span>
                          <span className="font-mono text-sm">
                            {delta > 0 ? `+${delta.toFixed(3)}` : delta.toFixed(3)} {adjustingItem.unitType} {isLoss ? '(Shrinkage / Loss)' : isGain ? '(Surplus / Found)' : '(No change)'}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">
                      Reason for Adjustment *
                    </label>
                    <Input 
                      required
                      value={adjustReason} 
                      onChange={(e) => setAdjustReason(e.target.value)} 
                      placeholder="e.g. Damaged bag, spill, physical inventory audit" 
                      className="h-10 rounded-xl border-zinc-200" 
                    />
                  </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2 w-full pt-2">
                  <Button
                    type="submit"
                    disabled={isAdjusting}
                    className="w-full sm:w-auto h-11 sm:h-10 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl order-1 sm:order-2 shadow-sm"
                  >
                    {isAdjusting ? t('common.loading') : "Confirm Adjustment"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setAdjustingItem(null)}
                    className="w-full sm:w-auto h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] order-2 sm:order-1"
                  >
                    {t('common.cancel')}
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
        title={t('stock.deleteModalTitle')}
        description={`${t('stock.deleteModalDesc')} (${itemToDelete?.name})`}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </DashboardLayout>
  );
}
