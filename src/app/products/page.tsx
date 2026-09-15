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
import { LayoutGrid, List, Plus, PackageCheck, TrendingUp, ShoppingBag, ShieldAlert, Image as ImageIcon, Truck } from "lucide-react";

interface ProductCategory {
  id: string;
  name: string;
  type: "PRODUCED" | "RESELL";
  parentId?: string | null;
  parent?: { id: string; name: string; type: "PRODUCED" | "RESELL" } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: "REVENUE" | "EXPENSE";
}

interface Product {
  id: string;
  name: string;
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

// Preset high quality fallback images for bakery items
const PRODUCT_PRESET_IMAGES: { label: string; url: string }[] = [
  { label: 'Fresh Bread / Loaf', url: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=600&q=80' },
  { label: 'Croissant / Pastry', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bomboloni / Donut', url: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80' },
  { label: 'Sambusa / Snack', url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cake / Dessert', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cookies / Biscuit', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80' },
];

export default function ProductsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');

  const formatCategoryLabel = (category: ProductCategory) =>
    category.parent ? `${category.parent.name} / ${category.name}` : category.name;

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: Record<string, string> = {};
      if (selectedBranchId) params.branchId = selectedBranchId;

      const [resProd, resCat, resFinCat] = await Promise.all([
        api.get("/products", { params }),
        api.get("/product-categories"),
        api.get("/financial-categories?type=REVENUE")
      ]);
      setProducts(resProd.data);
      setCategories(resCat.data);
      setFinancialCategories(resFinCat.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load products");
    } finally {
      setIsLoading(false);
    }
  };

  const getProductImage = (product: Product): string => {
    if (product.imageUrl) return product.imageUrl;
    const nameLower = product.name.toLowerCase();
    if (nameLower.includes('sambusa')) return PRODUCT_PRESET_IMAGES[3].url;
    if (nameLower.includes('bomboloni') || nameLower.includes('donut')) return PRODUCT_PRESET_IMAGES[2].url;
    if (nameLower.includes('croissant')) return PRODUCT_PRESET_IMAGES[1].url;
    if (nameLower.includes('cake')) return PRODUCT_PRESET_IMAGES[4].url;
    if (nameLower.includes('cookie') || nameLower.includes('biscuit')) return PRODUCT_PRESET_IMAGES[5].url;
    return PRODUCT_PRESET_IMAGES[0].url;
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.flavor && p.flavor.toLowerCase().includes(q));
  });

  const totalHouseStock = products.reduce((sum, p) => sum + (p.currentHouseStock || 0), 0);
  const totalDeliveredItems = products.reduce((sum, p) => sum + (p.totalDelivered || 0), 0);
  const totalProducedItems = products.reduce((sum, p) => sum + (p.totalProduced || 0), 0);
  const totalSoldItems = products.reduce((sum, p) => sum + (p.totalSold || 0), 0);

  return (
    <DashboardLayout>
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">{t('products.title')}</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">{t('products.subtitle')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {/* View Switcher */}
          <div className="bg-[#F4ECE1] p-1 rounded-xl flex items-center border border-[#EDE4D5]">
            <button
              onClick={() => setViewMode('GRID')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'GRID' ? 'bg-[#4A2E1B] text-white shadow-sm' : 'text-[#8C7361] hover:text-[#2C1B10]'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" /> Visual Cards
            </button>
            <button
              onClick={() => setViewMode('TABLE')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'TABLE' ? 'bg-[#4A2E1B] text-white shadow-sm' : 'text-[#8C7361] hover:text-[#2C1B10]'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Table List
            </button>
          </div>

          {isAdminOrOwner && (
            <Link href="/products/new">
              <Button className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md h-10 px-4">
                <Plus className="w-4 h-4 mr-1.5" /> {t('products.newProduct')}
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* House Stock Summary Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5 mb-6">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl bg-amber-50 text-amber-700 shrink-0">
            <PackageCheck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-[#8C7361] truncate">House Stock</p>
            <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] font-mono truncate">{totalHouseStock.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl bg-orange-50 text-[#E87A18] shrink-0">
            <Truck className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-[#8C7361] truncate">Delivered</p>
            <p className="text-base sm:text-xl font-extrabold text-[#E87A18] font-mono truncate">{totalDeliveredItems.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
            <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-[#8C7361] truncate">Produced</p>
            <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] font-mono truncate">{totalProducedItems.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl bg-blue-50 text-blue-700 shrink-0">
            <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-[#8C7361] truncate">Sold at POS</p>
            <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] font-mono truncate">{totalSoldItems.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white border border-[#EDE4D5] rounded-2xl p-3 sm:p-4 shadow-xs flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-3 rounded-xl bg-purple-50 text-purple-700 shrink-0">
            <ImageIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs font-semibold text-[#8C7361] truncate">Catalog</p>
            <p className="text-base sm:text-xl font-extrabold text-[#2C1B10] font-mono truncate">{products.length} Items</p>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search products by name or flavor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full sm:max-w-md bg-white border-[#EDE4D5] rounded-xl text-sm"
        />
      </div>

      {/* Content Rendering: Visual Grid View vs Table View */}
      {isLoading ? (
        <div className="text-center py-12 text-[#8C7361] font-medium">Loading product house inventory...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-white border border-[#EDE4D5] rounded-2xl text-[#8C7361]">
          No products match your search.
        </div>
      ) : viewMode === 'GRID' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {filteredProducts.map((prod) => {
            const imgUrl = getProductImage(prod);
            const stockQty = prod.currentHouseStock ?? 0;
            return (
              <div key={prod.id} className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="relative h-40 sm:h-44 bg-zinc-100 overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 right-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-xs ${
                      stockQty > 20
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : stockQty > 0
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : 'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {stockQty} {prod.unitType} in House
                    </span>
                  </div>
                  {prod.category && (
                    <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-md max-w-[80%] truncate">
                      {prod.category.name}
                    </div>
                  )}
                </div>

                <div className="p-3.5 sm:p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-[#2C1B10] tracking-tight">
                      {prod.name} {prod.flavor && <span className="text-xs font-normal text-[#8C7361]">({prod.flavor})</span>}
                    </h3>
                    <p className="text-xs text-[#8C7361] mt-0.5 font-medium">Selling Price: <strong className="text-[#E87A18]">{Number(prod.basePrice).toFixed(2)} ETB</strong></p>
                  </div>

                  <div className="mt-3.5 pt-3 border-t border-[#F4ECE1] grid grid-cols-3 gap-1 text-center text-xs text-[#8C7361]">
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-[#8C7361]">Produced</span>
                      <strong className="text-[#2C1B10]">{prod.totalProduced || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-[#8C7361]">Delivered</span>
                      <strong className="text-[#E87A18] font-black">{prod.totalDelivered || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-[#8C7361]">Sold</span>
                      <strong className="text-[#2C1B10]">{prod.totalSold || 0}</strong>
                    </div>
                  </div>
                  {isAdminOrOwner && (
                    <div className="mt-3 pt-2 border-t border-[#FAF6F0] flex justify-end">
                      <Button size="sm" variant="ghost" className="h-8 text-xs font-bold text-[#4A2E1B] hover:bg-[#F4ECE1] px-3" onClick={() => router.push(`/products/${prod.id}/edit`)}>
                        Edit Product
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div>
          {/* Mobile Touch Cards View (md:hidden) */}
          <div className="block md:hidden space-y-3">
            {filteredProducts.map((prod) => {
              const imgUrl = getProductImage(prod);
              const stockQty = prod.currentHouseStock ?? 0;
              return (
                <div key={prod.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs">
                  <div className="flex items-start gap-3">
                    <img
                      src={imgUrl}
                      alt={prod.name}
                      className="w-16 h-16 rounded-xl object-cover border border-[#EDE4D5] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <div>
                          <h4 className="font-extrabold text-sm text-[#2C1B10] truncate">{prod.name}</h4>
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
                        <span className="text-[10px] font-semibold text-[#8C7361]">({prod.unitType})</span>
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
                  <div className="mt-2.5 bg-[#FAF6F0] rounded-xl p-2 grid grid-cols-3 gap-1 text-center text-xs">
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">Produced</span>
                      <strong className="text-[#2C1B10] font-mono">{prod.totalProduced || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">Delivered</span>
                      <strong className="text-[#E87A18] font-mono font-black">{prod.totalDelivered || 0}</strong>
                    </div>
                    <div>
                      <span className="block text-[9px] uppercase font-bold text-[#8C7361]">Sold</span>
                      <strong className="text-[#2C1B10] font-mono">{prod.totalSold || 0}</strong>
                    </div>
                  </div>

                  {isAdminOrOwner && (
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

          {/* Desktop Table View (hidden md:block) */}
          <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Preview</TableHead>
                  <TableHead>{t('products.colName')}</TableHead>
                  <TableHead>{t('products.colCategory')}</TableHead>
                  <TableHead>{t('stock.title')}</TableHead>
                  <TableHead>{t('products.colUnit')}</TableHead>
                  <TableHead>{t('products.colPrice')}</TableHead>
                  <TableHead className="text-center">{t('production.title')}</TableHead>
                  <TableHead className="text-center">🚚 Delivered</TableHead>
                  <TableHead className="text-center">{t('dashboard.incomeFromSales')}</TableHead>
                  <TableHead>{t('products.colActive')}</TableHead>
                  {isAdminOrOwner && <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((prod) => {
                  const imgUrl = getProductImage(prod);
                  const stockQty = prod.currentHouseStock ?? 0;
                  return (
                    <TableRow key={prod.id}>
                      <TableCell>
                        <img src={imgUrl} alt={prod.name} className="w-11 h-11 rounded-xl object-cover border border-[#EDE4D5] shadow-xs" />
                      </TableCell>
                      <TableCell className="font-bold text-[#2C1B10]">
                        <div>{prod.name}</div>
                        {prod.flavor && <span className="text-xs font-normal text-[#8C7361]">({prod.flavor})</span>}
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5]">
                          {prod.category ? formatCategoryLabel(prod.category) : "Uncategorized"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold border ${
                          stockQty > 20 ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : stockQty > 0 ? 'bg-amber-100 text-amber-900 border-amber-200' : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {stockQty} {prod.unitType}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#8C7361]">{prod.unitType}</TableCell>
                      <TableCell className="font-extrabold text-[#E87A18] text-sm">{Number(prod.basePrice).toFixed(2)} ETB</TableCell>
                      <TableCell className="text-center font-bold text-[#2C1B10]">{prod.totalProduced || 0}</TableCell>
                      <TableCell className="text-center font-extrabold text-[#E87A18]">{prod.totalDelivered || 0}</TableCell>
                      <TableCell className="text-center font-bold text-[#2C1B10]">{prod.totalSold || 0}</TableCell>
                      <TableCell>
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${prod.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                          {prod.isActive ? `✓ ${t('products.activeLabel')}` : t('products.inactiveLabel')}
                        </span>
                      </TableCell>
                      {isAdminOrOwner && (
                        <TableCell className="text-right pr-6">
                          <Button variant="ghost" size="sm" className="font-bold text-xs text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]" onClick={() => router.push(`/products/${prod.id}/edit`)}>{t('common.edit')}</Button>
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
