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
import { format } from "date-fns";
import { formatEthDate } from "@/lib/ethiopianDate";
import { Plus, Trash2, CheckCircle2, XCircle, Clock, AlertTriangle, History } from "lucide-react";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; unitType: string; category?: { type: string } }
interface StockItem { id: string; name: string; unitType: string; currentQuantity: number; }
interface ActiveSession { id: string; status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED" }

interface ProductionBatch {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT" | null;
  status: "PENDING_APPROVAL" | "STARTED" | "COMPLETED" | "REJECTED";
  createdAt: string;
  user: { id: string; fullName: string };
  items: { id: string; productId?: string; quantityProduced: number; product: { id?: string; name: string; unitType: string } }[];
  materialUsages: { id: string; stockItemId?: string; quantityUsed: number; stockItem: { id?: string; name: string; unitType: string } }[];
}

export default function ProductionPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [filterTab, setFilterTab] = useState<"ALL" | "TODAY" | "PENDING">("ALL");

  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionBatchId, setActionBatchId] = useState<string | null>(null);

  // Form State
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [items, setItems] = useState<{ productId: string; quantityProduced: string }[]>([]);
  const [materials, setMaterials] = useState<{ stockItemId: string; quantityUsed: string }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const branchQuery = selectedBranchId ? `?branchId=${selectedBranchId}` : "";
      const sessionParams = selectedBranchId ? { params: { branchId: selectedBranchId } } : {};

      const [resBatches, resProd, resStock, resSess] = await Promise.all([
        api.get(`/production-batches${branchQuery}`),
        api.get(`/products${branchQuery}`),
        api.get(`/stock-items${branchQuery}`),
        api.get('/daily-sessions/active', sessionParams).catch(() => ({ data: null }))
      ]);

      setBatches(resBatches.data);
      setProducts(resProd.data.filter((p: Product) => p.category?.type === "PRODUCED" || !p.category));
      setStockItems(resStock.data);
      setActiveSession(resSess.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching data");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isSessionOpen = activeSession?.status === "OPEN";
  const sessionStatusLabel = !activeSession
    ? "CLOSED"
    : activeSession.status === "PAUSED"
    ? "PAUSED"
    : activeSession.status === "CLOSE_PENDING"
    ? "CLOSING"
    : "OPEN";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("You must add at least one produced product");
      return;
    }

    setIsSubmitting(true);
    const data = {
      branchId: selectedBranchId || undefined,
      date,
      shift,
      items: items.map(i => ({ productId: i.productId, quantityProduced: Number(i.quantityProduced) })),
      materialUsages: materials.map(m => ({ stockItemId: m.stockItemId, quantityUsed: Number(m.quantityUsed) })),
    };

    try {
      const res = await api.post("/production-batches", data);
      if (res.data.status === "PENDING_APPROVAL") {
        toast.success("Production report submitted for approval by Admin/Owner");
      } else {
        toast.success("Production batch created & stock updated");
      }
      setIsAddOpen(false);
      setItems([]);
      setMaterials([]);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error creating batch");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApprove = async (batchId: string) => {
    setActionBatchId(batchId);
    try {
      await api.post(`/production-batches/${batchId}/approve`);
      toast.success("Batch approved & stock levels updated!");
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to approve batch");
    } finally {
      setActionBatchId(null);
    }
  };

  const handleReject = async (batchId: string) => {
    setActionBatchId(batchId);
    try {
      await api.post(`/production-batches/${batchId}/reject`);
      toast.success("Batch rejected");
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to reject batch");
    } finally {
      setActionBatchId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 animate-pulse text-amber-600" /> Pending Approval
          </span>
        );
      case "COMPLETED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Completed
          </span>
        );
      case "STARTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
            Started
          </span>
        );
      case "REJECTED":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-300">
            <XCircle className="w-3.5 h-3.5 text-red-600" /> Rejected
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-800">
            {status}
          </span>
        );
    }
  };

  // Edit Batch State
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);

  const openEditModal = (batch: ProductionBatch) => {
    setEditingBatchId(batch.id);
    setDate(format(new Date(batch.date), "yyyy-MM-dd"));
    setShift(batch.shift || "DAY");
    setItems(batch.items.map(i => ({ productId: i.product.id || (i as any).productId, quantityProduced: String(i.quantityProduced) })));
    setMaterials(batch.materialUsages.map(m => ({ stockItemId: m.stockItem.id || (m as any).stockItemId, quantityUsed: String(m.quantityUsed) })));
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingBatchId) return;
    if (items.length === 0) {
      toast.error("You must add at least one produced product");
      return;
    }

    setIsSubmitting(true);
    const data = {
      date,
      shift,
      items: items.map(i => ({ productId: i.productId, quantityProduced: Number(i.quantityProduced) })),
      materialUsages: materials.map(m => ({ stockItemId: m.stockItemId, quantityUsed: Number(m.quantityUsed) })),
    };

    try {
      await api.patch(`/production-batches/${editingBatchId}`, data);
      toast.success("Production batch updated successfully");
      setEditingBatchId(null);
      setItems([]);
      setMaterials([]);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error updating batch");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const [shiftFilter, setShiftFilter] = useState<"ALL" | "DAY" | "NIGHT">("ALL");

  const todayYmd = new Date().toISOString().slice(0, 10);

  const roleBatches = useMemo(() => {
    return batches.filter((b) => {
      if (!isGlobalAdmin && user?.id) {
        return (b as any).userId === user.id;
      }
      return true;
    });
  }, [batches, isGlobalAdmin, user?.id]);

  const pendingCount = roleBatches.filter((b) => b.status === "PENDING_APPROVAL").length;
  const todayCount = roleBatches.filter((b) => (b.date || b.createdAt || "").startsWith(todayYmd)).length;

  const filteredBatches = roleBatches
    .filter((b) => {
      if (filterTab === "PENDING") return b.status === "PENDING_APPROVAL";
      if (filterTab === "TODAY") return (b.date || b.createdAt || "").startsWith(todayYmd);
      return true;
    })
    .filter((b) => {
      if (shiftFilter !== "ALL") return b.shift === shiftFilter;
      return true;
    });

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] tracking-tight">Production Batches</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">Manage daily & nightly baking schedules, material usage, and approval requests</p>
        </div>
        <div className="flex items-center gap-3">
          {isGlobalAdmin && (
            <Button onClick={() => window.location.href = '/production/history'} variant="outline" className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs sm:text-sm flex items-center gap-1.5">
              <History className="w-4 h-4 text-[#E87A18]" /> View Product History Table
            </Button>
          )}
          <Button
            onClick={() => window.location.href = '/production/new'}
            disabled={!isSessionOpen}
            className="bg-[#E87A18] hover:bg-[#d46d13] disabled:bg-zinc-300 disabled:text-zinc-500 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md text-xs sm:text-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Log Multi-Category Production Entry
          </Button>
        </div>
      </div>

      {!isSessionOpen && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 text-xs font-semibold flex items-center gap-2.5 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
          <span>
            Daily business session is currently <strong>{sessionStatusLabel}</strong>. Logging new production batches is disabled until the session is reopened.
          </span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 border-b border-zinc-200 pb-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setFilterTab("ALL")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${filterTab === "ALL"
                ? "bg-[#2C1B10] text-white shadow-sm"
                : "text-zinc-600 hover:bg-zinc-100"
              }`}
          >
            All Batches ({roleBatches.length})
          </button>
          <button
            onClick={() => setFilterTab("TODAY")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${filterTab === "TODAY"
                ? "bg-emerald-700 text-white shadow-sm"
                : "text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200"
              }`}
          >
            📅 Today ({todayCount})
          </button>
          <button
            onClick={() => setFilterTab("PENDING")}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${filterTab === "PENDING"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200"
              }`}
          >
            <Clock className="w-3.5 h-3.5" />
            Pending Approvals
            {pendingCount > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${filterTab === "PENDING" ? "bg-white text-amber-800" : "bg-amber-600 text-white"
                }`}>
                {pendingCount}
              </span>
            )}
          </button>
        </div>

        {/* Shift Filter Pill Group (Only visible for Owner & Admin) */}
        {isGlobalAdmin && (
          <div className="flex items-center bg-[#FAF6F0] p-1 rounded-xl border border-[#EDE4D5]">
            <button
              onClick={() => setShiftFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                shiftFilter === "ALL" ? "bg-[#4A2E1B] text-white shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              All Shifts
            </button>
            <button
              onClick={() => setShiftFilter("DAY")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                shiftFilter === "DAY" ? "bg-amber-500 text-zinc-950 shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              ☀️ Day Shift
            </button>
            <button
              onClick={() => setShiftFilter("NIGHT")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                shiftFilter === "NIGHT" ? "bg-indigo-600 text-white shadow-xs" : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              🌙 Night Shift
            </button>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Shift</TableHead>
              <TableHead>Products Baked & Quantity</TableHead>
              <TableHead>Raw Materials Consumed</TableHead>
              <TableHead>Batch Status</TableHead>
              <TableHead>Logged By</TableHead>
              <TableHead className="text-right pr-6">Batch Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">Loading production logs...</TableCell></TableRow>
            ) : filteredBatches.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-[#8C7361] font-medium">
                  {filterTab === "PENDING" ? "No pending batch approvals found." : "No production batches recorded."}
                </TableCell>
              </TableRow>
            ) : filteredBatches.map(batch => (
              <TableRow key={batch.id}>
                <TableCell>
                  <div className="font-bold text-[#2C1B10]">{formatEthDate(batch.date)}</div>
                  <div className="text-xs font-semibold text-[#8C7361] mt-0.5">{batch.shift} Shift</div>
                </TableCell>
                <TableCell>
                  <ul className="text-sm space-y-1">
                    {batch.items.map(item => (
                      <li key={item.id} className="font-semibold text-[#2C1B10]">
                        {item.product.name}
                        <span className="font-bold text-[#E87A18]">
                          : {item.quantityProduced} {item.product.unitType}
                        </span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  <ul className="text-sm space-y-1 text-[#8C7361]">
                    {batch.materialUsages.length === 0 ? <span className="text-zinc-400 italic text-xs">No materials deducted</span> : null}
                    {batch.materialUsages.map(mat => (
                      <li key={mat.id}>
                        {mat.stockItem.name}: <span className="font-bold text-rose-700">-{Number(mat.quantityUsed).toFixed(2)} {mat.stockItem.unitType}</span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  {getStatusBadge(batch.status)}
                </TableCell>
                <TableCell>
                  <span className="text-xs font-bold text-[#2C1B10]">{batch.user.fullName}</span>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex items-center justify-end gap-2">
                    {(batch.status === "PENDING_APPROVAL" || isGlobalAdmin) && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openEditModal(batch)}
                        className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs h-8 px-2.5 rounded-lg flex items-center gap-1"
                      >
                        Edit
                      </Button>
                    )}
                    {isGlobalAdmin && batch.status === "PENDING_APPROVAL" && (
                      <>
                        <Button
                          size="sm"
                          disabled={actionBatchId === batch.id}
                          onClick={() => handleApprove(batch.id)}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1 shadow-sm"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={actionBatchId === batch.id}
                          onClick={() => handleReject(batch.id)}
                          className="border-red-300 text-red-700 hover:bg-red-50 font-bold text-xs h-8 px-3 rounded-lg flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CREATE BATCH DIALOG */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                Log Production & Material Usage
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-2">
              {!isGlobalAdmin && (
                <div className="mb-4 p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Your report will be sent to Admin/Owner for stock approval before inventory is deducted.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Production Date</label>
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Shift</label>
                  <select
                    value={shift} onChange={(e) => setShift(e.target.value as any)}
                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                  >
                    <option value="DAY">Day Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTS PRODUCED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Products Baked <span className="text-red-500">*</span></label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setItems([...items, { productId: "", quantityProduced: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Product
                  </Button>
                </div>
                {items.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">No products added yet. Click 'Add Product'.</div>}
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].productId = e.target.value;
                          setItems(newItems);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Input
                        type="number" required placeholder="Qty" min="1"
                        value={item.quantityProduced}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantityProduced = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-24 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newItems = [...items];
                        newItems.splice(index, 1);
                        setItems(newItems);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAW MATERIALS USED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Raw Materials Consumed</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setMaterials([...materials, { stockItemId: "", quantityUsed: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Material
                  </Button>
                </div>
                {materials.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">Log ingredients used so stock levels can be updated upon approval.</div>}
                <div className="space-y-2">
                  {materials.map((mat, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={mat.stockItemId}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].stockItemId = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Material</option>
                        {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unitType})</option>)}
                      </select>
                      <Input
                        type="number" step="0.001" required placeholder="Qty" min="0.001"
                        value={mat.quantityUsed}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].quantityUsed = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="w-32 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newMats = [...materials];
                        newMats.splice(index, 1);
                        setMaterials(newMats);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting || !isSessionOpen} className="bg-[#E87A18] hover:bg-[#d46d13] disabled:bg-zinc-300 text-white font-bold rounded-xl">
                  {isSubmitting ? "Submitting..." : !isSessionOpen ? `Disabled (${sessionStatusLabel})` : (isGlobalAdmin ? "Submit & Approve" : "Submit for Approval")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* EDIT BATCH DIALOG */}
      {editingBatchId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingBatchId(null); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                Edit Production Batch
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdate} className="mt-2">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Production Date</label>
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border-zinc-200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Shift</label>
                  <select
                    value={shift} onChange={(e) => setShift(e.target.value as any)}
                    className="w-full border border-zinc-200 rounded-xl h-10 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                  >
                    <option value="DAY">Day Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTS PRODUCED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Products Baked <span className="text-red-500">*</span></label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setItems([...items, { productId: "", quantityProduced: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Product
                  </Button>
                </div>
                {items.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">No products added yet. Click 'Add Product'.</div>}
                <div className="space-y-2">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={item.productId}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].productId = e.target.value;
                          setItems(newItems);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Product</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <Input
                        type="number" required placeholder="Qty" min="1"
                        value={item.quantityProduced}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantityProduced = e.target.value;
                          setItems(newItems);
                        }}
                        className="w-24 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newItems = [...items];
                        newItems.splice(index, 1);
                        setItems(newItems);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              {/* RAW MATERIALS USED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-xs font-bold text-[#2C1B10] uppercase">Raw Materials Consumed</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs rounded-lg border-zinc-300" onClick={() => setMaterials([...materials, { stockItemId: "", quantityUsed: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Material
                  </Button>
                </div>
                {materials.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-xl text-center bg-zinc-50">Log ingredients used so stock levels can be updated upon approval.</div>}
                <div className="space-y-2">
                  {materials.map((mat, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        required
                        value={mat.stockItemId}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].stockItemId = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="flex-1 border border-zinc-200 rounded-xl h-9 px-3 bg-white text-sm focus:ring-2 focus:ring-[#E87A18]"
                      >
                        <option value="" disabled>Select Material</option>
                        {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} ({s.unitType})</option>)}
                      </select>
                      <Input
                        type="number" step="0.001" required placeholder="Qty" min="0.001"
                        value={mat.quantityUsed}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].quantityUsed = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="w-32 h-9 rounded-xl border-zinc-200"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => {
                        const newMats = [...materials];
                        newMats.splice(index, 1);
                        setMaterials(newMats);
                      }}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button type="button" variant="outline" onClick={() => setEditingBatchId(null)} className="rounded-xl">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl">
                  {isSubmitting ? "Updating..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}