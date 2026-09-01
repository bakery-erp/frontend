"use client";
import { useEffect, useState, useMemo } from "react";
import { api } from "@/lib/axios";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { formatEthDate } from "@/lib/ethiopianDate";
import { 
  PackageCheck, 
  DollarSign, 
  Search, 
  CalendarDays, 
  History,
  Layers
} from "lucide-react";

interface ProductHistoryRecord {
  id: string;
  rawId?: string;
  date: string;
  createdAt: string;
  type: "PRODUCED" | "RESELL";
  productId: string;
  productName: string;
  unitType: string;
  basePrice: number;
  quantity: number;
  returnedQuantity?: number;
  netQuantity?: number;
  subtotal: number;
  sourceName: string;
  userRole?: string;
  userId?: string;
  sessionId?: string | null;
  branchName?: string;
  notes?: string;
  categoryType?: string;
}

interface SummaryData {
  totalProducedQuantity: number;
  totalValuation: number;
  count: number;
}

interface ProductItem {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
  category?: { type: string };
}

export default function DailyProductHistoryPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const isGlobalAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

  const [records, setRecords] = useState<ProductHistoryRecord[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    totalProducedQuantity: 0,
    totalValuation: 0,
    count: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [allProducts, setAllProducts] = useState<ProductItem[]>([]);

  const [startDate, setStartDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(new Date(), "yyyy-MM-dd"));

  // Fetch product list for filter options
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const branchId = selectedBranchId || user?.branchId;
        const branchQuery = branchId ? `?branchId=${branchId}` : "";
        const prodRes = await api.get(`/products${branchQuery}`);
        setAllProducts(prodRes.data || []);
      } catch (e) {
        console.error("Failed to load filter metadata:", e);
      }
    };
    fetchFilterOptions();
  }, [selectedBranchId, user?.branchId]);

  useEffect(() => {
    fetchHistory();
  }, [selectedBranchId, startDate, endDate, productFilter]);

  const handleSetToday = () => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    if (startDate === todayStr && endDate === todayStr) {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setStartDate(format(d, "yyyy-MM-dd"));
      setEndDate(todayStr);
    } else {
      setStartDate(todayStr);
      setEndDate(todayStr);
    }
  };

  const fetchHistory = async () => {
    setIsLoading(true);
    try {
      const branchId = selectedBranchId || user?.branchId;
      const params = new URLSearchParams();
      if (branchId) params.append("branchId", branchId);
      if (startDate) params.append("startDate", startDate);
      if (endDate) params.append("endDate", endDate);
      params.append("type", "PRODUCED"); // Strict: Produced items only
      if (productFilter) params.append("productId", productFilter);
      if (search.trim()) params.append("search", search.trim());

      const res = await api.get(`/production-batches/daily-product-history/all?${params.toString()}`);
      
      // Filter out any resell items completely
      const rawRecords: ProductHistoryRecord[] = (res.data.records || []).filter(
        (r: ProductHistoryRecord) => r.type === "PRODUCED"
      );

      setRecords(rawRecords);

      const totalQty = rawRecords.reduce((acc, r) => acc + (r.netQuantity || r.quantity), 0);
      const totalVal = rawRecords.reduce((acc, r) => acc + r.subtotal, 0);

      setSummary({
        totalProducedQuantity: totalQty,
        totalValuation: totalVal,
        count: rawRecords.length,
      });
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load product daily history");
    } finally {
      setIsLoading(false);
    }
  };

  // Strict Role-Based Filtering
  const filteredRoleRecords = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (isGlobalAdmin) return true; // ADMIN & OWNER see all
      if (user?.role) {
        if (r.userRole) {
          return r.userRole === user.role;
        }
        const pName = (r.productName || "").toLowerCase();
        const catType = (r.categoryType || "").toUpperCase();
        if (user.role === "SAMBUSA_WORKER") {
          return catType === "SAMBUSA" || pName.includes("sambusa");
        }
        if (user.role === "CAKE_WORKER") {
          return catType === "CAKE" || pName.includes("cake") || pName.includes("bomboloni") || pName.includes("donut");
        }
        if (user.role === "BAKER") {
          return catType === "BAKERY" || pName.includes("bread");
        }
      }
      return true;
    });
  }, [records, user?.role, isGlobalAdmin]);

  const filteredRoleSummary = useMemo(() => {
    const totalQty = filteredRoleRecords.reduce((acc, r) => acc + (r.netQuantity || r.quantity), 0);
    const totalVal = filteredRoleRecords.reduce((acc, r) => acc + r.subtotal, 0);
    return {
      totalProducedQuantity: totalQty,
      totalValuation: totalVal,
      count: filteredRoleRecords.length,
    };
  }, [filteredRoleRecords]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

  return (
    <DashboardLayout>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
            <History className="w-7 h-7 text-[#E87A18]" />
            Daily Production History
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
            Production audit records formatted by role and timestamp.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchHistory}
            className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs"
          >
            Refresh Logs
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-emerald-100 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-emerald-800 uppercase tracking-wider">Total Quantity Produced</p>
            {isGlobalAdmin ? (
              <h3 className="text-2xl font-extrabold text-emerald-900 font-mono mt-1">
                {filteredRoleSummary.totalProducedQuantity.toLocaleString()} <span className="text-xs text-emerald-700 font-normal">Pcs</span>
              </h3>
            ) : (
              <h3 className="text-lg font-extrabold text-emerald-900 mt-1">✓ Logged Output</h3>
            )}
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl">
            <PackageCheck className="w-6 h-6 text-emerald-600" />
          </div>
        </div>

        <div className="bg-white border border-amber-100 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-amber-800 uppercase tracking-wider">Est. Production Valuation</p>
            {isGlobalAdmin ? (
              <h3 className="text-2xl font-extrabold text-amber-900 font-mono mt-1">
                {filteredRoleSummary.totalValuation.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-xs text-amber-700 font-normal">ETB</span>
              </h3>
            ) : (
              <h3 className="text-lg font-extrabold text-amber-900 mt-1">🔒 Confidential</h3>
            )}
          </div>
          <div className="p-3 bg-amber-50 rounded-xl">
            <DollarSign className="w-6 h-6 text-amber-600" />
          </div>
        </div>

        <div className="bg-white border border-purple-100 rounded-2xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Production Batches Logged</p>
            <h3 className="text-2xl font-extrabold text-purple-900 font-mono mt-1">
              {filteredRoleSummary.count.toLocaleString()} <span className="text-xs text-purple-700 font-normal">Batches</span>
            </h3>
          </div>
          <div className="p-3 bg-purple-50 rounded-xl">
            <Layers className="w-6 h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 mb-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={handleSetToday}
            className={`h-[38px] px-3 text-xs font-bold rounded-xl border transition-all ${
              startDate === format(new Date(), "yyyy-MM-dd") && endDate === format(new Date(), "yyyy-MM-dd")
                ? "bg-amber-100 border-amber-400 text-amber-900 shadow-xs"
                : "border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]"
            }`}
          >
            📅 Today Only
          </Button>

          <form onSubmit={handleSearchSubmit} className="flex flex-wrap items-center gap-2">
            {/* Product Dropdown */}
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-9 text-xs px-3 font-semibold text-[#2C1B10] focus:outline-none max-w-[170px]"
            >
              <option value="">All Products</option>
              {allProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            {/* Date Range Inputs */}
            <div className="flex items-center gap-1 bg-[#FAF6F0] px-2.5 py-1.5 rounded-xl border border-[#EDE4D5] h-9">
              <CalendarDays className="w-3.5 h-3.5 text-[#8C7361]" />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#2C1B10] focus:outline-none"
              />
              <span className="text-[11px] text-[#8C7361]">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#2C1B10] focus:outline-none"
              />
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8C7361] absolute left-3 top-2.5" />
              <Input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl w-36 sm:w-44"
              />
            </div>

            <Button type="submit" size="sm" className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] rounded-xl text-xs font-bold h-9 px-3">
              Filter
            </Button>
          </form>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">Date & Time (Eth Calendar)</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Product Name</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{isGlobalAdmin ? "Produced Qty" : "Status"}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Unit Base Price</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Total Value</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">Source / Station</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-[#8C7361]">
                  Loading daily production history...
                </TableCell>
              </TableRow>
            ) : filteredRoleRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-[#8C7361]">
                  No daily production history records found.
                </TableCell>
              </TableRow>
            ) : (
              filteredRoleRecords.map((row) => (
                <TableRow key={row.id} className="hover:bg-[#FAF6F0]/50 transition-colors">
                  <TableCell className="font-semibold text-xs text-zinc-900">
                    <div>{formatEthDate(row.createdAt, true)}</div>
                  </TableCell>

                  <TableCell className="font-bold text-sm text-[#2C1B10]">
                    {row.productName}
                    <span className="text-[10px] text-zinc-400 block font-normal">Unit: {row.unitType}</span>
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    {isGlobalAdmin ? (
                      <div className="font-extrabold text-emerald-800">
                        {row.quantity.toLocaleString()} Pcs
                      </div>
                    ) : (
                      <div className="font-bold text-emerald-700">✓ Logged</div>
                    )}
                  </TableCell>

                  <TableCell className="font-mono text-xs text-zinc-700">
                    {isGlobalAdmin ? `${row.basePrice.toFixed(2)} ETB` : "🔒 Confidential"}
                  </TableCell>

                  <TableCell className="font-mono font-bold text-xs text-[#E87A18]">
                    {isGlobalAdmin ? `${row.subtotal.toFixed(2)} ETB` : "🔒 Confidential"}
                  </TableCell>

                  <TableCell className="font-semibold text-xs text-zinc-800">
                    {row.sourceName}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </DashboardLayout>
  );
}
