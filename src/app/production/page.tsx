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
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

interface Branch { id: string; name: string; }
interface Product { id: string; name: string; unitType: string; category?: { type: string } }
interface StockItem { id: string; name: string; unitType: string; currentQuantity: number; }

interface ProductionBatch {
  id: string;
  date: string;
  shift: "DAY" | "NIGHT" | null;
  status: "STARTED" | "COMPLETED" | "CANCELLED";
  createdAt: string;
  user: { id: string; fullName: string };
  items: { id: string; quantityProduced: number; product: { name: string; unitType: string } }[];
  materialUsages: { id: string; quantityUsed: number; stockItem: { name: string; unitType: string } }[];
}

export default function ProductionPage() {
  const { user } = useAuth();
  const isGlobalAdmin = user?.role === "ADMIN" || user?.role === "OWNER";

  const [batches, setBatches] = useState<ProductionBatch[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [shift, setShift] = useState<"DAY" | "NIGHT">("DAY");
  const [items, setItems] = useState<{ productId: string; quantityProduced: string }[]>([]);
  const [materials, setMaterials] = useState<{ stockItemId: string; quantityUsed: string }[]>([]);

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
      const branchQuery = (isGlobalAdmin && selectedBranchId) ? `?branchId=${selectedBranchId}` : "";
      if (isGlobalAdmin && !selectedBranchId) {
        setBatches([]);
        setIsLoading(false);
        return;
      }

      const [resBatches, resProd, resStock] = await Promise.all([
        api.get(`/production-batches${branchQuery}`),
        api.get(`/products${branchQuery}`),
        api.get(`/stock-items${branchQuery}`)
      ]);
      
      setBatches(resBatches.data);
      // Optional: Filter to only products meant to be "PRODUCED" if utilizing the category type
      setProducts(resProd.data.filter((p: Product) => p.category?.type === "PRODUCED" || !p.category)); 
      setStockItems(resStock.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Error fetching data");
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("You must add at least one produced product");
      return;
    }

    setIsSubmitting(true);
    const data = {
      branchId: isGlobalAdmin ? selectedBranchId : undefined,
      date,
      shift,
      items: items.map(i => ({ productId: i.productId, quantityProduced: Number(i.quantityProduced) })),
      materialUsages: materials.map(m => ({ stockItemId: m.stockItemId, quantityUsed: Number(m.quantityUsed) })),
    };

    try {
      await api.post("/production-batches", data);
      toast.success("Production batch created successfully");
      setIsAddOpen(false);
      setItems([]);
      setMaterials([]);
      fetchData(); // Refresh list to get updated items & subtract material usages
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error creating batch");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateBatchStatus = async (batchId: string, status: string) => {
    try {
      await api.patch(`/production-batches/${batchId}`, { status });
      toast.success(`Batch marked as ${status}`);
      fetchData();
    } catch (e: any) {
      toast.error("Failed to update status");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "STARTED": return "bg-blue-100 text-blue-800";
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-zinc-100 text-zinc-800";
    }
  };

  return (
    <DashboardLayout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Production Batches</h1>
          <p className="text-sm text-zinc-500 mt-1">Manage daily/nightly baking operations</p>
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
          <Button onClick={() => setIsAddOpen(true)}>Create Batch</Button>
        </div>
      </div>

      <div className="bg-white border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date & Shift</TableHead>
              <TableHead>Products Baked</TableHead>
              <TableHead>Materials Used</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Logged By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-400">Loading...</TableCell></TableRow>
            ) : batches.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-zinc-400">No production batches found.</TableCell></TableRow>
            ) : batches.map(batch => (
              <TableRow key={batch.id}>
                <TableCell>
                  <div className="font-semibold">{format(new Date(batch.date), "MMM d, yyyy")}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{batch.shift} Shift</div>
                </TableCell>
                <TableCell>
                  <ul className="text-sm space-y-1">
                    {batch.items.map(item => (
                      <li key={item.id}>
                        {item.product.name}: <span className="font-medium">{item.quantityProduced} {item.product.unitType}</span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  <ul className="text-sm space-y-1 text-zinc-600">
                    {batch.materialUsages.length === 0 ? <span className="text-red-400 italic">None logged</span> : null}
                    {batch.materialUsages.map(mat => (
                      <li key={mat.id}>
                        {mat.stockItem.name}: <span className="font-medium text-red-600">-{Number(mat.quantityUsed).toFixed(2)} {mat.stockItem.unitType}</span>
                      </li>
                    ))}
                  </ul>
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${getStatusBadge(batch.status)}`}>
                    {batch.status}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{batch.user.fullName}</span>
                </TableCell>
                <TableCell className="text-right">
                  {batch.status === "STARTED" && (
                    <Button variant="outline" size="sm" onClick={() => updateBatchStatus(batch.id, "COMPLETED")}>
                      Complete
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* CREATE BATCH DIALOG */}
      {isAddOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsAddOpen(false); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Production Batch</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="mt-4">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="text-sm font-medium mb-1 block">Production Date</label>
                  <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Shift</label>
                  <select 
                    value={shift} onChange={(e) => setShift(e.target.value as any)}
                    className="w-full border rounded-md h-10 px-3 bg-background text-sm"
                  >
                    <option value="DAY">Day Shift</option>
                    <option value="NIGHT">Night Shift</option>
                  </select>
                </div>
              </div>

              {/* PRODUCTS PRODUCED */}
              <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-sm font-medium block">Products Baked <span className="text-red-500">*</span></label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setItems([...items, { productId: "", quantityProduced: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Product
                  </Button>
                </div>
                {items.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-md text-center">No products added yet. Click 'Add Product'.</div>}
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
                        className="flex-1 border rounded-md h-9 px-3 bg-background text-sm"
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
                        className="w-24 h-9"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => {
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
                  <label className="text-sm font-medium block">Raw Materials Consumed (Optional)</label>
                  <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMaterials([...materials, { stockItemId: "", quantityUsed: "" }])}>
                    <Plus className="w-3 h-3 mr-1" /> Add Material
                  </Button>
                </div>
                {materials.length === 0 && <div className="text-xs text-zinc-500 italic p-3 border border-dashed rounded-md text-center bg-zinc-50">Log materials used to automatically deduct from stock.</div>}
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
                        className="flex-1 border rounded-md h-9 px-3 bg-background text-sm"
                      >
                        <option value="" disabled>Select Material</option>
                        {stockItems.map(s => <option key={s.id} value={s.id}>{s.name} (Available: {Number(s.currentQuantity).toFixed(2)} {s.unitType})</option>)}
                      </select>
                      <Input 
                        type="number" step="0.001" required placeholder="Qty (e.g. 5.5)" min="0.001" 
                        value={mat.quantityUsed}
                        onChange={(e) => {
                          const newMats = [...materials];
                          newMats[index].quantityUsed = e.target.value;
                          setMaterials(newMats);
                        }}
                        className="w-32 h-9"
                      />
                      <Button type="button" variant="ghost" size="icon" className="h-9 w-9 text-red-500 hover:bg-red-50" onClick={() => {
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

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Creating..." : "Create Batch"}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}