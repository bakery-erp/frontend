"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  PackageCheck, 
  ShoppingCart, 
  DollarSign, 
  Search, 
  CalendarDays, 
  History,
  Layers,
  Plus,
  Trash2,
  Truck
} from "lucide-react";

interface ProductHistoryRecord {
  id: string;
  date: string;
  createdAt: string;
  type: "PRODUCED" | "RESELL";
  productId: string;
  productName: string;
  unitType: string;
  basePrice: number;
  unitBuyPrice?: number;
  quantity: number;
  subtotal: number;
  sourceName: string;
  sessionId?: string | null;
  branchName?: string;
  notes?: string;
}

interface SummaryData {
  totalProducedQuantity: number;
  totalResellQuantity: number;
  totalValuation: number;
  count: number;
}

interface Supplier {
  id: string;
  name: string;
  type: string;
}

interface ProductItem {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
  buyPrice?: number;
  category?: { type: string };
}

interface ResellLineItem {
  productId: string;
  quantityReceived: string;
  unitBuyPrice: string;
  unitSellPrice: string;
}

export default function DailyProductHistoryPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();

  const [records, setRecords] = useState<ProductHistoryRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalProducedQuantity: 0,
    totalResellQuantity: 0,
    totalValuation: 0,
    count: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PRODUCED" | "RESELL">("ALL");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return format(d, "yyyy-MM-dd");
  });
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Resell Modal States (Multi-Product Line Items)
  const [isResellModalOpen, setIsResellModalOpen] = useState(false);
  const [isLoggingResell, setIsLoggingResell] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [resellSupplierId, setResellSupplierId] = useState("");
  const [resellIsPaid, setResellIsPaid] = useState(true);
  const [resellItems, setResellItems] = useState<ResellLineItem[]>([]);

  useEffect(() => {
    fetchHistory();
  }, [selectedBranchId, startDate, endDate, typeFilter]);

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const branchId = selectedBranchId || user?.branchId;
      const params = new URLSearchParams();
      if (branchId) params.append("branchId", branchId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      if (typeFilter) params.append("type", typeFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await api.get(`/production-batches/daily-product-history/all?${params.toString()}`);
      setRecords(res.data.records || []);
      setSummary(res.data.summary || {
        totalProducedQuantity: 0,
        totalResellQuantity: 0,
        totalValuation: 0,
        count: 0,
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load product daily history");
    } finally {
      setIsLoading(false);
    }
  };

  const openResellModal = async () => {
    try {
      const branchId = selectedBranchId || user?.branchId;
      const branchQuery = branchId ? `?branchId=${branchId}` : "";
      
      const [suppRes, prodRes] = await Promise.all([
        api.get(`/suppliers${branchQuery}`),
        api.get(`/products${branchQuery}`)
      ]);

      setSuppliers(suppRes.data || []);
      const resellOnly = (prodRes.data || []).filter((p: any) => p.category?.type === 'RESELL');
      const filteredProdList = resellOnly.length > 0 ? resellOnly : (prodRes.data || []).filter((p: any) => p.category?.type !== 'PRODUCED');
      setProducts(filteredProdList);

      if (suppRes.data?.length > 0) setResellSupplierId(suppRes.data[0].id);

      if (filteredProdList.length > 0) {
        setResellItems([
          {
            productId: filteredProdList[0].id,
            quantityReceived: "",
            unitBuyPrice: String(filteredProdList[0].buyPrice || ""),
            unitSellPrice: String(filteredProdList[0].basePrice || ""),
          },
        ]);
      } else {
        setResellItems([]);
      }

      setIsResellModalOpen(true);
    } catch (e: any) {
      toast.error("Failed to load suppliers or products");
    }
  };

  const addItemRow = () => {
    const defaultProd = products[0];
    setResellItems((prev) => [
      ...prev,
      {
        productId: defaultProd ? defaultProd.id : "",
        quantityReceived: "",
        unitBuyPrice: defaultProd ? String(defaultProd.buyPrice || "") : "",
        unitSellPrice: defaultProd ? String(defaultProd.basePrice || "") : "",
      },
    ]);
  };

  const removeItemRow = (index: number) => {
    setResellItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItemRow = (index: number, field: keyof ResellLineItem, value: string) => {
    setResellItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };

      if (field === "productId") {
        const sel = products.find((p) => p.id === value);
        if (sel) {
          item.unitSellPrice = String(sel.basePrice || "");
          item.unitBuyPrice = String(sel.buyPrice || "");
        }
      }
      updated[index] = item;
      return updated;
    });
  };

  const handleCreateResellDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resellSupplierId) {
      toast.error("Please select a supplier");
      return;
    }

    const validItems = resellItems.filter((i) => i.productId && Number(i.quantityReceived) > 0);
    if (validItems.length === 0) {
      toast.error("Please add at least one product with a valid quantity");
      return;
    }

    setIsLoggingResell(true);
    try {
      await api.post("/supplier-deliveries", {
        supplierId: resellSupplierId,
        isPaid: resellIsPaid,
        items: validItems.map((i) => ({
          productId: i.productId,
          quantityReceived: Number(i.quantityReceived),
          unitBuyPrice: Number(i.unitBuyPrice) || 0,
          unitSellPrice: Number(i.unitSellPrice) || 0,
        })),
      });

      toast.success(`Successfully logged ${validItems.length} resell product(s)!`);
      setIsResellModalOpen(false);
      fetchHistory();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to log resell delivery");
    } finally {
      setIsLoggingResell(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  const totalModalValuation = resellItems.reduce((sum, item) => {
    const qty = Number(item.quantityReceived) || 0;
    const price = Number(item.unitSellPrice) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
            <History className="w-7 h-7 text-[#E87A18]" />
            Daily Product Production & Resells History
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
            Complete daily audit log of bakery-produced items and external supplier resell purchases.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={openResellModal}
            className="bg-blue-700 hover:bg-blue-800 text-white font-bold rounded-xl shadow-sm text-xs flex items-center gap-1.5"
          >
            <ShoppingCart className="w-4 h-4" /> + Log Resell Purchase
          </Button>
          <Button
            variant="outline"
            onClick={fetchHistory}
            className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs"
          >
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Produced (Bakery)</p>
            <h3 className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">
              {summary.totalProducedQuantity.toLocaleString()} <span className="text-xs text-emerald-700 font-normal">Pcs</span>
            </h3>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl">
            <PackageCheck className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-blue-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wider">Total Resell Purchased</p>
            <h3 className="text-2xl font-extrabold text-blue-900 font-mono mt-1">
              {summary.totalResellQuantity.toLocaleString()} <span className="text-xs text-blue-700 font-normal">Pcs</span>
            </h3>
          </div>
          <div className="p-3 bg-blue-50 rounded-xl">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Est. Total Valuation</p>
            <h3 className="text-2xl font-extrabold text-amber-900 font-mono mt-1">
              {summary.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-amber-700 font-normal">ETB</span>
            </h3>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl">
            <DollarSign className="w-6 h-6 text-amber-600" />
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Total Log Entries</p>
            <h3 className="text-2xl font-extrabold text-purple-900 font-mono mt-1">
              {summary.count.toLocaleString()} <span className="text-xs text-purple-700 font-normal">Records</span>
            </h3>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl">
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 mb-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Type Filter Buttons */}
          <div className="flex items-center gap-1 bg-[#FAF6F0] p-1.5 rounded-xl border border-[#EDE4D5]">
            <button
              onClick={() => setTypeFilter("ALL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                typeFilter === "ALL"
                  ? "bg-[#4A2E1B] text-white shadow-sm"
                  : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              All Types
            </button>
            <button
              onClick={() => setTypeFilter("PRODUCED")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                typeFilter === "PRODUCED"
                  ? "bg-emerald-700 text-white shadow-sm"
                  : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              🍞 Produced Only
            </button>
            <button
              onClick={() => setTypeFilter("RESELL")}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
                typeFilter === "RESELL"
                  ? "bg-blue-700 text-white shadow-sm"
                  : "text-[#8C7361] hover:text-[#2C1B10]"
              }`}
            >
              🛒 Resells Only
            </button>
          </div>

          {/* Date Range & Search */}
          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-[#FAF6F0] px-3 py-1.5 rounded-xl border border-[#EDE4D5]">
              <CalendarDays className="w-4 h-4 text-[#8C7361]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#2C1B10] focus:outline-none"
              />
              <span className="text-xs text-[#8C7361]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#2C1B10] focus:outline-none"
              />
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#8C7361] absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search product or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl w-52"
              />
            </div>

            <Button type="submit" size="sm" className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] rounded-xl text-xs font-bold h-9">
              Filter
            </Button>
          </form>
        </div>
      </div>

      {/* Main Product History Table */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">Date & Time</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Product Name</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Category Type</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Quantity (Pcs)</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Unit Sell Price</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Est. Total Value</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Source / Logged By</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Notes / Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-[#8C7361]">
                  Loading daily product production & resell history...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-[#8C7361]">
                  No daily history records found for the selected scope.
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow key={row.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="font-semibold text-xs text-zinc-900">
                    <div>{format(new Date(row.createdAt), "yyyy-MM-dd")}</div>
                    <div className="text-[10px] text-zinc-400 font-normal">
                      {format(new Date(row.createdAt), "HH:mm")}
                    </div>
                  </TableCell>

                  <TableCell className="font-bold text-sm text-[#2C1B10]">
                    {row.productName}
                    <span className="text-[10px] text-zinc-400 block font-normal">Unit: {row.unitType}</span>
                  </TableCell>

                  <TableCell>
                    {row.type === "PRODUCED" ? (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1">
                        <PackageCheck className="w-3 h-3 text-emerald-600" /> BAKERY PRODUCED
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800 border border-blue-300 inline-flex items-center gap-1">
                        <ShoppingCart className="w-3 h-3 text-blue-600" /> SUPPLIER RESELL
                      </span>
                    )}
                  </TableCell>

                  <TableCell className="font-extrabold font-mono text-sm text-[#2C1B10]">
                    {row.quantity.toLocaleString()} <span className="text-[10px] text-zinc-400 font-normal">Pcs</span>
                  </TableCell>

                  <TableCell className="font-mono text-xs text-zinc-700">
                    {row.basePrice.toFixed(2)} ETB
                  </TableCell>

                  <TableCell className="font-mono font-bold text-xs text-[#E87A18]">
                    {row.subtotal.toFixed(2)} ETB
                  </TableCell>

                  <TableCell className="font-semibold text-xs text-zinc-800">
                    {row.sourceName}
                  </TableCell>

                  <TableCell className="text-xs text-zinc-500">
                    {row.notes || "-"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Multi-Product Resell Purchase Dialog Modal */}
      <Dialog open={isResellModalOpen} onOpenChange={setIsResellModalOpen}>
        <DialogContent className="bg-white border-[#EDE4D5] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#2C1B10] font-extrabold text-lg flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-700" />
                Log Multi-Product Supplier Resells
              </span>
              <span className="text-xs font-mono font-normal text-zinc-500">
                Total: <strong className="text-blue-700 font-bold">{totalModalValuation.toFixed(2)} ETB</strong>
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateResellDelivery} className="space-y-4 py-2">
            {/* Top Config Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5]">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Select Supplier</label>
                <select
                  value={resellSupplierId}
                  onChange={(e) => setResellSupplierId(e.target.value)}
                  className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Payment Status</label>
                <select
                  value={resellIsPaid ? "true" : "false"}
                  onChange={(e) => setResellIsPaid(e.target.value === "true")}
                  className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                >
                  <option value="true">Paid Cash / Instant</option>
                  <option value="false">On Credit (Unpaid)</option>
                </select>
              </div>
            </div>

            {/* Product Line Items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-extrabold text-[#4A2E1B] uppercase tracking-wider">
                  Resell Line Items ({resellItems.length})
                </h4>
                <Button
                  type="button"
                  onClick={addItemRow}
                  variant="outline"
                  className="border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold rounded-xl h-8 flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Product
                </Button>
              </div>

              {resellItems.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 border border-dashed rounded-xl">
                  No products added yet. Click "+ Add Product" to start.
                </div>
              ) : (
                resellItems.map((item, index) => {
                  const lineTotal = (Number(item.quantityReceived) || 0) * (Number(item.unitSellPrice) || 0);
                  return (
                    <div key={index} className="grid grid-cols-12 gap-2 items-center bg-zinc-50/80 p-2.5 rounded-xl border border-zinc-200">
                      {/* Product Selector */}
                      <div className="col-span-12 sm:col-span-4">
                        <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 sm:hidden">Product</label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateItemRow(index, "productId", e.target.value)}
                          className="w-full bg-white border border-zinc-300 rounded-lg h-9 text-xs px-2 font-medium"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unitType})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 sm:hidden">Qty Pcs</label>
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantityReceived}
                          onChange={(e) => updateItemRow(index, "quantityReceived", e.target.value)}
                          className="bg-white border-zinc-300 h-9 text-xs font-mono font-bold text-center"
                        />
                      </div>

                      {/* Buy Price */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 sm:hidden">Buy ETB</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Buy Price"
                          value={item.unitBuyPrice}
                          onChange={(e) => updateItemRow(index, "unitBuyPrice", e.target.value)}
                          className="bg-white border-zinc-300 h-9 text-xs font-mono"
                        />
                      </div>

                      {/* Sell Price */}
                      <div className="col-span-3 sm:col-span-2">
                        <label className="text-[10px] font-bold text-zinc-500 block mb-0.5 sm:hidden">Sell ETB</label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Sell Price"
                          value={item.unitSellPrice}
                          onChange={(e) => updateItemRow(index, "unitSellPrice", e.target.value)}
                          className="bg-white border-zinc-300 h-9 text-xs font-mono font-bold text-blue-800"
                        />
                      </div>

                      {/* Actions & Subtotal */}
                      <div className="col-span-1 sm:col-span-2 flex items-center justify-between gap-1 pl-1">
                        <span className="text-[11px] font-mono font-extrabold text-amber-700 hidden sm:inline">
                          {lineTotal.toFixed(0)} ETB
                        </span>
                        <button
                          type="button"
                          onClick={() => removeItemRow(index)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <DialogFooter className="pt-3 border-t border-[#EDE4D5] flex flex-row items-center justify-between">
              <div className="text-xs font-extrabold text-[#2C1B10]">
                Total: <span className="font-mono text-blue-700">{totalModalValuation.toFixed(2)} ETB</span>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setIsResellModalOpen(false)} className="border-[#EDE4D5] rounded-xl text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isLoggingResell} className="bg-blue-700 hover:bg-blue-800 text-white rounded-xl text-xs font-bold">
                  {isLoggingResell ? "Logging..." : "Save All Resell Purchases"}
                </Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
