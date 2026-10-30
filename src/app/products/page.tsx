"use client";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { List, Plus, PackageCheck, TrendingUp, ShoppingBag, ShieldAlert, Boxes, Truck, AlertTriangle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { TableSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

interface ProductCategory {
  id: string;
  name: string;
  nameLatin?: string | null;
  type: "PRODUCED" | "RESELL";
  parentId?: string | null;
  parent?: { id: string; name: string; nameLatin?: string | null; type: "PRODUCED" | "RESELL" } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
}

interface Product {
  id: string;
  name: string;
  nameLatin?: string | null;
  flavor?: string;
  unitType: "PIECE" | "KG" | "LITER";
  basePrice: number;
  buyPrice?: number;
  imageUrl?: string | null;
  isActive: boolean;
  categoryId: string;
  category?: ProductCategory;
  financialCategoryId?: string;
  financialCategory?: FinancialCategory;
  currentHouseStock?: number;
  totalProduced?: number;
  totalDelivered?: number;
  totalSold?: number;
  totalDamaged?: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t, language, getItemName } = useLanguage();
  const isOwner = user?.role === 'OWNER';

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'OWNER') {
      router.push('/production/history');
      toast.error('Unauthorized access to Products.');
    }
  }, [user, router]);

  const [selectedMainCategory, setSelectedMainCategory] = useState<string>('ALL');
  const [selectedSubCategory, setSelectedSubCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const formatCategoryLabel = (category: ProductCategory) => {
    const parentLabel = category.parent ? getItemName(category.parent) : null;
    const catLabel = getItemName(category);
    return parentLabel ? `${parentLabel} / ${catLabel}` : catLabel;
  };

  const { data: pageData, isLoading } = useQuery({
    queryKey: ['products', selectedBranchId],
    placeholderData: (prev) => prev,
    enabled: !!user && user.role === 'OWNER',
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedBranchId) params.branchId = selectedBranchId;

      const [resProd, resCat, resFinCat] = await Promise.all([
        api.get("/products", { params }),
        api.get("/product-categories"),
        api.get("/financial-categories?type=REVENUE"),
      ]);
      return {
        products: (resProd.data || []) as Product[],
        categories: (resCat.data || []) as ProductCategory[],
        financialCategories: (resFinCat.data || []) as FinancialCategory[],
      };
    },
  });

  const products = pageData?.products || [];
  const categories = pageData?.categories || [];
  const financialCategories = pageData?.financialCategories || [];

  const mainCategories = categories.filter((c) => !c.parentId);
  const activeSubCategories = selectedMainCategory === 'ALL'
    ? []
    : categories.filter((c) => c.parentId === selectedMainCategory);

  const filteredProducts = products.filter((p) => {
    // 1. Category filter
    if (selectedMainCategory !== 'ALL') {
      if (selectedSubCategory !== 'ALL') {
        if (p.categoryId !== selectedSubCategory) return false;
      } else {
        const subCatIds = categories.filter((c) => c.parentId === selectedMainCategory).map((c) => c.id);
        const validCategoryIds = [selectedMainCategory, ...subCatIds];
        if (!validCategoryIds.includes(p.categoryId)) return false;
      }
    }

    // 2. Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const nameStr = (p.name || '').toLowerCase();
      const nameLatinStr = (p.nameLatin || '').toLowerCase();
      const flavorStr = (p.flavor || '').toLowerCase();
      const catName = (p.category?.name || '').toLowerCase();
      const catNameLatin = (p.category?.nameLatin || '').toLowerCase();
      if (!nameStr.includes(q) && !nameLatinStr.includes(q) && !flavorStr.includes(q) && !catName.includes(q) && !catNameLatin.includes(q)) {
        return false;
      }
    }

    return true;
  });

  const totalHouseStock = products.reduce((sum, p) => sum + (p.currentHouseStock || 0), 0);
  const totalDeliveredItems = products.reduce((sum, p) => sum + (p.totalDelivered || 0), 0);
  const totalProducedItems = products.reduce((sum, p) => sum + (p.totalProduced || 0), 0);
  const totalSoldItems = products.reduce((sum, p) => sum + (p.totalSold || 0), 0);
  const totalDamagedItems = products.reduce((sum, p) => sum + (p.totalDamaged || 0), 0);

  return (
    <DashboardLayout>
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">{t('products.title')}</h1>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {isOwner && (
            <Link href="/products/new">
              <Button className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md h-10 px-4">
                <Plus className="w-4 h-4 mr-1.5" /> {t('products.newProduct')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* House Stock Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">{t('products.colStockStatus')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
              <PackageCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-base sm:text-xl font-black text-[#2C1B10] font-mono">
                {totalHouseStock.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.pcs')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">{t('products.totalDelivered')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-50 text-[#E87A18] flex items-center justify-center shrink-0">
              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-base sm:text-xl font-black text-[#E87A18] font-mono">
                {totalDeliveredItems.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.pcs')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">{t('products.totalProduced')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-base sm:text-xl font-black text-[#2C1B10] font-mono">
                {totalProducedItems.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.pcs')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">{t('products.colSold')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-20" />
            ) : (
              <p className="text-base sm:text-xl font-black text-[#2C1B10] font-mono">
                {totalSoldItems.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.pcs')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-rose-700 uppercase tracking-wider leading-tight">{t('products.totalDamaged')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-base sm:text-xl font-black text-rose-600 font-mono">
                {totalDamagedItems.toLocaleString()} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.pcs')}</span>
              </p>
            )}
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <p className="text-[10px] sm:text-xs font-bold text-[#8C7361] uppercase tracking-wider leading-tight">{t('products.totalVarieties')}</p>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center shrink-0">
              <Boxes className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </div>
          </div>
          <div>
            {isLoading ? (
              <Skeleton className="h-6 w-16" />
            ) : (
              <p className="text-base sm:text-xl font-black text-[#2C1B10] font-mono">
                {products.length} <span className="text-[10px] sm:text-xs font-semibold text-[#8C7361]">{t('common.items')}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Category Filter Pills & Search */}
      <div className="mb-6 space-y-3">
        {/* Main Categories Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => {
              setSelectedMainCategory('ALL');
              setSelectedSubCategory('ALL');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              selectedMainCategory === 'ALL'
                ? 'bg-[#E87A18] text-white shadow-xs'
                : 'bg-white border border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]'
            }`}
          >
            <span>{language === 'en' ? 'All Products' : 'ሁሉም ምርቶች'}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
              selectedMainCategory === 'ALL' ? 'bg-white/20 text-white' : 'bg-[#EDE4D5] text-[#4A2E1B]'
            }`}>
              {products.length}
            </span>
          </button>

          {mainCategories.map((cat) => {
            const subCatIds = categories.filter((c) => c.parentId === cat.id).map((c) => c.id);
            const validIds = [cat.id, ...subCatIds];
            const count = products.filter((p) => validIds.includes(p.categoryId)).length;
            const isSelected = selectedMainCategory === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setSelectedMainCategory(cat.id);
                  setSelectedSubCategory('ALL');
                }}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-[#E87A18] text-white shadow-xs'
                    : 'bg-white border border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0]'
                }`}
              >
                <span>{getItemName(cat)}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                  isSelected ? 'bg-white/20 text-white' : 'bg-[#EDE4D5] text-[#4A2E1B]'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Subcategories (if any for selected main category) */}
        {activeSubCategories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pl-2 scrollbar-none border-l-2 border-[#E87A18]/40">
            <button
              type="button"
              onClick={() => setSelectedSubCategory('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 ${
                selectedSubCategory === 'ALL'
                  ? 'bg-[#4A2E1B] text-white shadow-2xs'
                  : 'bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#EDE4D5]'
              }`}
            >
              {language === 'en' ? 'All Subcategories' : 'ሁሉም ንዑስ ምድቦች'}
            </button>
            {activeSubCategories.map((sub) => {
              const count = products.filter((p) => p.categoryId === sub.id).length;
              const isSelected = selectedSubCategory === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubCategory(sub.id)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all shrink-0 flex items-center gap-1 ${
                    isSelected
                      ? 'bg-[#4A2E1B] text-white shadow-2xs'
                      : 'bg-[#F4ECE1] text-[#4A2E1B] hover:bg-[#EDE4D5]'
                  }`}
                >
                  <span>{getItemName(sub)}</span>
                  <span className={`text-[9px] px-1 rounded-full font-mono ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-white/80 text-[#8C7361]'
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Filter / Search Bar */}
        <div className="pt-1">
          <Input
            type="text"
            placeholder={t('products.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full sm:max-w-md bg-white border-[#EDE4D5] rounded-xl text-sm"
          />
        </div>
      </div>

      {/* Content Rendering: List / Table View Only */}
      {isLoading ? (
        <TableSkeleton rows={8} columns={10} hasActions={true} />
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#EDE4D5] rounded-2xl text-[#8C7361]">
          {t('products.noProductsFound')}
        </div>
      ) : (
        <div>
          {/* Mobile Touch Cards View (md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredProducts.map((prod) => {
              const stockQty = prod.currentHouseStock ?? 0;
              return (
                <div key={prod.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="font-extrabold text-sm text-[#2C1B10] truncate">{getItemName(prod)}</h4>
                          {prod.flavor && <p className="text-xs text-[#8C7361]">{prod.flavor}</p>}
                        </div>
                        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          prod.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {prod.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                          {prod.category ? formatCategoryLabel(prod.category) : "Uncategorized"}
                        </span>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                          stockQty > 20 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : stockQty > 0 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {stockQty} {prod.unitType}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Stock and Price Row */}
                  <div className="mt-3 pt-2.5 border-t border-[#F4ECE1] flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Price</span>
                      <span className="font-extrabold text-sm text-[#E87A18] font-mono">{Number(prod.basePrice).toFixed(2)} ETB</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#8C7361] block text-right">House Stock</span>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-extrabold border ${
                        stockQty > 20 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : stockQty > 0 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                      }`}>
                        {stockQty} {prod.unitType}
                      </span>
                    </div>
                  </div>

                  {/* Operational Metrics */}
                  <div className="mt-2.5 bg-[#FAF6F0] rounded-xl p-2 grid grid-cols-4 gap-1 text-center text-xs">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">{t('products.colProduced')}</span>
                      <strong className="text-[#2C1B10] font-mono">{prod.totalProduced || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">{t('products.colDelivered')}</span>
                      <strong className="text-[#E87A18] font-mono font-black">{prod.totalDelivered || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">{t('products.colSold')}</span>
                      <strong className="text-[#2C1B10] font-mono">{prod.totalSold || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-rose-600">{t('products.colDamaged')}</span>
                      <strong className={`font-mono font-black ${(prod.totalDamaged || 0) > 0 ? 'text-rose-600' : 'text-zinc-400'}`}>
                        {prod.totalDamaged || 0}
                      </strong>
                    </div>
                  </div>

                  {isOwner && (
                    <div className="mt-3 pt-2 border-t border-[#F4ECE1]">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full h-9 font-bold text-xs text-[#4A2E1B] border-[#EDE4D5] hover:bg-[#FAF6F0]"
                        onClick={() => router.push(`/products/${prod.id}/edit`)}
                      >
                        Edit Product Details
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (hidden md:block) - Cleanly fitted without horizontal scroll */}
          <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden">
            <Table className="w-full">
              <TableHeader className="bg-[#FAF6F0]/70">
                <TableRow className="border-[#EDE4D5]">
                  <TableHead className="py-3 px-3.5 text-xs font-bold text-[#4A2E1B]">{t('products.colName')}</TableHead>
                  <TableHead className="py-3 px-3 text-xs font-bold text-[#4A2E1B]">{t('products.colCategory')}</TableHead>
                  <TableHead className="py-3 px-3 text-xs font-bold text-[#4A2E1B]">{t('stock.title')}</TableHead>
                  <TableHead className="py-3 px-3 text-xs font-bold text-[#4A2E1B]">{t('products.colPrice')}</TableHead>
                  <TableHead className="py-3 px-2 text-center text-xs font-bold text-[#4A2E1B]">{t('products.colProduced')}</TableHead>
                  <TableHead className="py-3 px-2 text-center text-xs font-bold text-[#4A2E1B]">{t('products.colDelivered')}</TableHead>
                  <TableHead className="py-3 px-2 text-center text-xs font-bold text-[#4A2E1B]">{t('products.colSold')}</TableHead>
                  <TableHead className="py-3 px-2 text-center text-xs font-bold text-rose-700">{t('products.colDamaged')}</TableHead>
                  <TableHead className="py-3 px-3 text-xs font-bold text-[#4A2E1B]">{t('products.colActive')}</TableHead>
                  {isOwner && <TableHead className="py-3 px-3 text-right text-xs font-bold text-[#4A2E1B] pr-4">{t('common.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((prod) => {
                  const stockQty = prod.currentHouseStock ?? 0;
                  return (
                    <TableRow key={prod.id} className="border-[#EDE4D5] hover:bg-[#FAF6F0]/40 transition-colors">
                      <TableCell className="py-3 px-3.5 font-bold text-[#2C1B10]">
                        <div className="font-extrabold text-sm">{getItemName(prod)}</div>
                        {prod.flavor && <span className="text-[11px] font-normal text-[#8C7361] block">({prod.flavor})</span>}
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                          {prod.category ? formatCategoryLabel(prod.category) : "Uncategorized"}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-extrabold border ${
                          stockQty > 20 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : stockQty > 0 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {stockQty} {prod.unitType}
                        </span>
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <div className="font-extrabold text-[#E87A18] text-xs font-mono">{Number(prod.basePrice).toFixed(2)} ETB</div>
                        {prod.category?.type === 'RESELL' && prod.buyPrice != null && (
                          <div className="text-[10px] font-mono text-zinc-500 font-medium">Cost: {Number(prod.buyPrice).toFixed(2)} ETB</div>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-2 text-center font-bold text-[#2C1B10] text-xs font-mono">{prod.totalProduced || 0}</TableCell>
                      <TableCell className="py-3 px-2 text-center font-extrabold text-[#E87A18] text-xs font-mono">{prod.totalDelivered || 0}</TableCell>
                      <TableCell className="py-3 px-2 text-center font-bold text-[#2C1B10] text-xs font-mono">{prod.totalSold || 0}</TableCell>
                      <TableCell className="py-3 px-2 text-center font-bold text-xs font-mono">
                        {(prod.totalDamaged || 0) > 0 ? (
                          <span className="text-rose-600 font-extrabold bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-100">
                            {prod.totalDamaged}
                          </span>
                        ) : (
                          <span className="text-zinc-400">0</span>
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold border ${prod.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                          {prod.isActive ? `✓ Active` : 'Inactive'}
                        </span>
                      </TableCell>
                      {isOwner && (
                        <TableCell className="py-3 px-3 text-right pr-4">
                          <Button variant="ghost" size="sm" className="h-8 px-2.5 font-bold text-xs text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0] rounded-lg" onClick={() => router.push(`/products/${prod.id}/edit`)}>
                            {t('common.edit')}
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
