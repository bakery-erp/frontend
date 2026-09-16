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
  History,
  Layers,
  Boxes
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

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
  shift?: string | null;
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
  const { t } = useLanguage();
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

  // Strict User/Role-Based Filtering: Non-admin users see ONLY what they logged for themselves
  const filteredRoleRecords = useMemo(() => {
    if (!records) return [];
    return records.filter((r) => {
      if (isGlobalAdmin) return true; // ADMIN & OWNER see all
      if (user?.id && r.userId) {
        return r.userId === user.id;
      }
      if (user?.role && r.userRole) {
        return r.userRole === user.role;
      }
      return true;
    });
  }, [records, user?.id, user?.role, isGlobalAdmin]);

  const uniqueProductsCount = useMemo(() => {
    const set = new Set(filteredRoleRecords.map((r) => r.productName).filter(Boolean));
    return set.size;
  }, [filteredRoleRecords]);

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
            {t('productionHistory.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
            {t('productionHistory.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={fetchHistory}
            className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs"
          >
            {t('productionHistory.refreshLogs')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 xs:gap-4 mb-4 xs:mb-6">
        <div className="bg-white border border-emerald-100 rounded-2xl p-3.5 xs:p-4 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] xs:text-xs font-bold text-emerald-800 uppercase tracking-wider truncate">
              {t('productionHistory.totalQuantityProduced')}
            </p>
            <h3 className="text-xl xs:text-2xl font-extrabold text-emerald-900 font-mono mt-0.5 xs:mt-1">
              {filteredRoleSummary.totalProducedQuantity.toLocaleString()}{" "}
              <span className="text-xs text-emerald-700 font-normal">{t('productionHistory.pcs')}</span>
            </h3>
          </div>
          <div className="p-2.5 xs:p-3 bg-emerald-50 rounded-xl shrink-0">
            <PackageCheck className="w-5 h-5 xs:w-6 xs:h-6 text-emerald-600" />
          </div>
        </div>

        {isGlobalAdmin ? (
          <div className="bg-white border border-amber-100 rounded-2xl p-3.5 xs:p-4 shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] xs:text-xs font-bold text-amber-800 uppercase tracking-wider truncate">
                {t('productionHistory.estValuation')}
              </p>
              <h3 className="text-xl xs:text-2xl font-extrabold text-amber-900 font-mono mt-0.5 xs:mt-1 truncate">
                {filteredRoleSummary.totalValuation.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                <span className="text-xs text-amber-700 font-normal">{t('productionHistory.etb')}</span>
              </h3>
            </div>
            <div className="p-2.5 xs:p-3 bg-amber-50 rounded-xl shrink-0">
              <DollarSign className="w-5 h-5 xs:w-6 xs:h-6 text-amber-600" />
            </div>
          </div>
        ) : (
          <div className="bg-white border border-indigo-100 rounded-2xl p-3.5 xs:p-4 shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0 pr-2">
              <p className="text-[11px] xs:text-xs font-bold text-indigo-800 uppercase tracking-wider truncate">
                {t('productionHistory.varietiesLogged')}
              </p>
              <h3 className="text-xl xs:text-2xl font-extrabold text-indigo-900 font-mono mt-0.5 xs:mt-1">
                {uniqueProductsCount.toLocaleString()}{" "}
                <span className="text-xs text-indigo-700 font-normal">{t('productionHistory.types')}</span>
              </h3>
            </div>
            <div className="p-2.5 xs:p-3 bg-indigo-50 rounded-xl shrink-0">
              <Boxes className="w-5 h-5 xs:w-6 xs:h-6 text-indigo-600" />
            </div>
          </div>
        )}

        <div className="bg-white border border-purple-100 rounded-2xl p-3.5 xs:p-4 shadow-xs flex items-center justify-between min-w-0">
          <div className="min-w-0 pr-2">
            <p className="text-[11px] xs:text-xs font-bold text-purple-800 uppercase tracking-wider truncate">
              {t('productionHistory.batchesLogged')}
            </p>
            <h3 className="text-xl xs:text-2xl font-extrabold text-purple-900 font-mono mt-0.5 xs:mt-1">
              {filteredRoleSummary.count.toLocaleString()}{" "}
              <span className="text-xs text-purple-700 font-normal">{t('productionHistory.batches')}</span>
            </h3>
          </div>
          <div className="p-2.5 xs:p-3 bg-purple-50 rounded-xl shrink-0">
            <Layers className="w-5 h-5 xs:w-6 xs:h-6 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 xs:p-4 mb-4 xs:mb-6 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="space-y-2.5">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
            {/* Quick Actions & Product Select */}
            <div className="flex items-center gap-2 w-full lg:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={handleSetToday}
                className={`h-9 px-3 text-xs font-bold rounded-xl border transition-all shrink-0 ${
                  startDate === format(new Date(), "yyyy-MM-dd") && endDate === format(new Date(), "yyyy-MM-dd")
                    ? "bg-amber-100 border-amber-400 text-amber-900 shadow-xs"
                    : "border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]"
                }`}
              >
                📅 {t('productionHistory.todayOnly')}
              </Button>

              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-9 text-xs px-2.5 font-semibold text-[#2C1B10] focus:outline-none flex-1 lg:flex-initial lg:w-48 truncate"
              >
                <option value="">{t('productionHistory.allProducts')}</option>
                {allProducts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Date Range & Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto">
              {/* Date Range Inputs */}
              <div className="grid grid-cols-2 gap-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-9 px-2 text-xs font-semibold text-[#2C1B10] focus:outline-none w-full sm:w-36"
                  aria-label="Start Date"
                />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-9 px-2 text-xs font-semibold text-[#2C1B10] focus:outline-none w-full sm:w-36"
                  aria-label="End Date"
                />
              </div>

              {/* Search Bar & Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-44">
                  <Search className="w-3.5 h-3.5 text-[#8C7361] absolute left-3 top-2.5 pointer-events-none" />
                  <Input
                    type="text"
                    placeholder={t('common.search') || "Search..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9 text-xs bg-[#FAF6F0] border-[#EDE4D5] rounded-xl w-full"
                  />
                </div>

                <Button
                  type="submit"
                  size="sm"
                  className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] rounded-xl text-xs font-bold h-9 px-4 shrink-0 shadow-xs"
                >
                  {t('common.filter') || "Filter"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* ── Mobile Audit Cards (< md) ── */}
      <div className="space-y-3 block md:hidden mb-6">
        {isLoading ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-[#EDE4D5] text-[#8C7361] font-medium text-xs">
            {t('productionHistory.loading')}
          </div>
        ) : filteredRoleRecords.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-[#EDE4D5] text-[#8C7361] font-medium text-xs">
            {t('productionHistory.noRecords')}
          </div>
        ) : (
          filteredRoleRecords.map((row) => (
            <div
              key={row.id}
              className="bg-white rounded-2xl border border-[#EDE4D5] p-3.5 xs:p-4 shadow-xs space-y-2.5 hover:border-[#E87A18]/30 transition-all"
            >
              <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2">
                <div>
                  <span className="font-extrabold text-sm text-[#2C1B10] block">{row.productName}</span>
                  <span className="text-[11px] text-[#8C7361] font-medium">{t('common.unit')}: {row.unitType}</span>
                </div>
                <span className="px-2.5 py-1 bg-amber-100/70 border border-amber-200 rounded-lg text-xs font-bold text-amber-900 shrink-0">
                  {row.shift === "NIGHT" ? t('production.nightShift') : t('production.dayShift')}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('productionHistory.colProducedQty')}</span>
                  <span className="font-mono text-base font-extrabold text-emerald-800">
                    {row.quantity.toLocaleString()} <span className="text-xs font-normal">{t('productionHistory.pcs')}</span>
                  </span>
                </div>

                {isGlobalAdmin && (
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('common.subtotal')}</span>
                    <span className="font-mono text-xs font-bold text-[#E87A18]">
                      {row.subtotal.toFixed(2)} {t('productionHistory.etb')}
                    </span>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-[#F4ECE1] flex items-center justify-between gap-2 text-[11px] text-[#8C7361]">
                <span>{formatEthDate(row.createdAt, true)}</span>
                <span className="font-semibold text-zinc-800">{row.sourceName}</span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Desktop Main Table (hidden on < md, visible on md+) ── */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs hidden md:block">
        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colDateTime')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colProductName')}</TableHead>
              <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colProducedQty')}</TableHead>
              {isGlobalAdmin ? (
                <>
                  <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colUnitBasePrice')}</TableHead>
                  <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colTotalValue')}</TableHead>
                </>
              ) : (
                <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colWorkShift')}</TableHead>
              )}
              <TableHead className="font-extrabold text-[#2C1B10]">{t('productionHistory.colSourceStation')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={isGlobalAdmin ? 6 : 5} className="text-center py-10 text-[#8C7361]">
                  {t('productionHistory.loading')}
                </TableCell>
              </TableRow>
            ) : filteredRoleRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isGlobalAdmin ? 6 : 5} className="text-center py-10 text-[#8C7361]">
                  {t('productionHistory.noRecords')}
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
                    <span className="text-[10px] text-zinc-400 block font-normal">{t('common.unit')}: {row.unitType}</span>
                  </TableCell>

                  <TableCell className="font-mono text-xs">
                    <div className="font-extrabold text-emerald-800">
                      {row.quantity.toLocaleString()} {t('productionHistory.pcs')}
                    </div>
                  </TableCell>

                  {isGlobalAdmin ? (
                    <>
                      <TableCell className="font-mono text-xs text-zinc-700">
                        {row.basePrice.toFixed(2)} {t('productionHistory.etb')}
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs text-[#E87A18]">
                        {row.subtotal.toFixed(2)} {t('productionHistory.etb')}
                      </TableCell>
                    </>
                  ) : (
                    <TableCell className="font-semibold text-xs text-amber-900">
                      <span className="px-2.5 py-1 bg-amber-100/70 border border-amber-200 rounded-lg">
                        {row.shift === "NIGHT" ? t('production.nightShift') : t('production.dayShift')}
                      </span>
                    </TableCell>
                  )}

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
