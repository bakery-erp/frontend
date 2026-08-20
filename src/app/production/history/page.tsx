"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/axios";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import { 
  PackageCheck, 
  ShoppingCart, 
  DollarSign, 
  Search, 
  CalendarDays, 
  Filter, 
  History,
  TrendingUp,
  Store,
  Layers
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

export default function DailyProductHistoryPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();

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

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchHistory();
  };

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
    </DashboardLayout>
  );
}
