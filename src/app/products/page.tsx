"use client";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { LayoutGrid, List, Plus, PackageCheck, TrendingUp, ShoppingBag, ShieldAlert, Image as ImageIcon } from "lucide-react";

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
  totalSold?: number;
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
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === 'ADMIN' || user?.role === 'OWNER';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [financialCategories, setFinancialCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'GRID' | 'TABLE'>('GRID');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add / Edit Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');

  const formatCategoryLabel = (category: ProductCategory) =>
    category.parent ? `${category.parent.name} / ${category.name}` : category.name;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resProd, resCat, resFinCat] = await Promise.all([
        api.get("/products"),
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

  const openAddDialog = () => {
    setEditingProduct(null);
    setSelectedImageUrl(PRODUCT_PRESET_IMAGES[0].url);
    setIsAddOpen(true);
  };

  const openEditDialog = (product: Product) => {
    setEditingProduct(product);
    setSelectedImageUrl(product.imageUrl || getProductImage(product));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>, isEdit: boolean) => {
    e.preventDefault();
    if (!isAdminOrOwner) {
      toast.error('Only Owners and Admins can create or edit products');
      return;
    }
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      categoryId: formData.get("categoryId"),
      financialCategoryId: formData.get("financialCategoryId") || undefined,
      name: formData.get("name"),
      flavor: formData.get("flavor") || undefined,
      unitType: formData.get("unitType"),
      basePrice: Number(formData.get("basePrice")),
      buyPrice: formData.get("buyPrice") ? Number(formData.get("buyPrice")) : undefined,
      imageUrl: selectedImageUrl || undefined,
      isActive: formData.get("isActive") === "true"
    };

    try {
      if (isEdit && editingProduct) {
        await api.patch(`/products/${editingProduct.id}`, data);
        toast.success("Product updated successfully");
      } else {
        await api.post("/products", data);
        toast.success("Product created successfully");
      }
      setIsAddOpen(false);
      setEditingProduct(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Operation failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.flavor && p.flavor.toLowerCase().includes(q));
  });

  const totalHouseStock = products.reduce((sum, p) => sum + (p.currentHouseStock || 0), 0);
  const totalProducedItems = products.reduce((sum, p) => sum + (p.totalProduced || 0), 0);
  const totalSoldItems = products.reduce((sum, p) => sum + (p.totalSold || 0), 0);

  return (
    <DashboardLayout>
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">Product House Inventory</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">Real-time house stock calculated dynamically from production batches, sales, and conversions</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
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
            <Button onClick={openAddDialog} className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md">
              <Plus className="w-4 h-4 mr-1.5" /> Add New Product
            </Button>
          )}
        </div>
      </div>

      {/* House Stock Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-amber-50 text-amber-700">
            <PackageCheck className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#8C7361]">Available House Stock</p>
            <p className="text-xl font-extrabold text-[#2C1B10] font-mono">{totalHouseStock.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-700">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#8C7361]">Total Baked / Produced</p>
            <p className="text-xl font-extrabold text-[#2C1B10] font-mono">{totalProducedItems.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-700">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#8C7361]">Total Sold at POS</p>
            <p className="text-xl font-extrabold text-[#2C1B10] font-mono">{totalSoldItems.toLocaleString()} Pcs</p>
          </div>
        </div>

        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-sm flex items-center space-x-3">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-700">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-[#8C7361]">Active Product Catalog</p>
            <p className="text-xl font-extrabold text-[#2C1B10] font-mono">{products.length} Items</p>
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
          className="max-w-md bg-white border-[#EDE4D5] rounded-xl text-sm"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredProducts.map((prod) => {
            const imgUrl = getProductImage(prod);
            const stockQty = prod.currentHouseStock ?? 0;
            return (
              <div key={prod.id} className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between group">
                <div className="relative h-44 bg-zinc-100 overflow-hidden">
                  <img
                    src={imgUrl}
                    alt={prod.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2.5 right-2.5">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shadow-sm ${
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
                    <div className="absolute bottom-2.5 left-2.5 bg-black/60 backdrop-blur-md text-white text-[11px] font-semibold px-2.5 py-0.5 rounded-md">
                      {prod.category.name}
                    </div>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="font-extrabold text-base text-[#2C1B10] tracking-tight">
                      {prod.name} {prod.flavor && <span className="text-xs font-normal text-[#8C7361]">({prod.flavor})</span>}
                    </h3>
                    <p className="text-xs text-[#8C7361] mt-0.5 font-medium">Selling Price: <strong className="text-[#E87A18]">{Number(prod.basePrice).toFixed(2)} ETB</strong></p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[#F4ECE1] flex items-center justify-between text-xs text-[#8C7361]">
                    <span>Produced: <strong className="text-[#2C1B10]">{prod.totalProduced || 0}</strong></span>
                    <span>Sold: <strong className="text-[#2C1B10]">{prod.totalSold || 0}</strong></span>
                    {isAdminOrOwner && (
                      <Button size="sm" variant="ghost" className="h-7 text-xs font-bold text-[#4A2E1B] hover:bg-[#F4ECE1]" onClick={() => openEditDialog(prod)}>
                        Edit
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-xs">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Preview</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>House Stock (Available)</TableHead>
                <TableHead>Unit Type</TableHead>
                <TableHead>Selling Price</TableHead>
                <TableHead className="text-center">Produced</TableHead>
                <TableHead className="text-center">Sold</TableHead>
                <TableHead>Catalog Status</TableHead>
                {isAdminOrOwner && <TableHead className="text-right pr-6">Action</TableHead>}
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
                    <TableCell className="text-center font-bold text-[#2C1B10]">{prod.totalSold || 0}</TableCell>
                    <TableCell>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${prod.isActive ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-rose-100 text-rose-800 border-rose-200'}`}>
                        {prod.isActive ? '✓ Active' : 'Inactive'}
                      </span>
                    </TableCell>
                    {isAdminOrOwner && (
                      <TableCell className="text-right pr-6">
                        <Button variant="ghost" size="sm" className="font-bold text-xs text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]" onClick={() => openEditDialog(prod)}>Edit</Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add / Edit Dialog Wrapper */}
      {(isAddOpen || editingProduct) && (
        <Dialog open={true} onOpenChange={(open) => {
          if (!open) {
            setIsAddOpen(false);
            setEditingProduct(null);
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                {editingProduct ? "Edit Product Details & Image" : "Add New Product"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={(e) => handleSubmit(e, !!editingProduct)} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-zinc-700 block mb-1">Product Image Selection</label>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  {PRODUCT_PRESET_IMAGES.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedImageUrl(preset.url)}
                      className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all ${
                        selectedImageUrl === preset.url ? 'border-[#E87A18] ring-2 ring-[#E87A18]/20' : 'border-zinc-200 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                      <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] truncate px-1 py-0.5 text-center">
                        {preset.label.split('/')[0]}
                      </span>
                    </button>
                  ))}
                </div>

                <label className="text-[11px] text-zinc-500 block mb-1">Custom Image URL (Optional)</label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={selectedImageUrl}
                  onChange={(e) => setSelectedImageUrl(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Product Name</label>
                  <Input name="name" required defaultValue={editingProduct?.name || ""} placeholder="e.g. Special White Bread" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Flavor / Variant (Optional)</label>
                  <Input name="flavor" defaultValue={editingProduct?.flavor || ""} placeholder="e.g. Chocolate / Sesame" />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Category</label>
                  <select name="categoryId" required defaultValue={editingProduct?.categoryId || ""} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="" disabled>Select Category</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.id}>{formatCategoryLabel(c)} ({c.type})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Unit Type</label>
                  <select name="unitType" required defaultValue={editingProduct?.unitType || "PIECE"} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="PIECE">Piece</option>
                    <option value="KG">Kg</option>
                    <option value="LITER">Liter</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Selling Price (ETB)</label>
                  <Input name="basePrice" type="number" step="0.01" required defaultValue={editingProduct?.basePrice ?? ""} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Cost Price (ETB) - Optional</label>
                  <Input name="buyPrice" type="number" step="0.01" defaultValue={editingProduct?.buyPrice ?? ""} />
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-zinc-700 block mb-1">Financial Category (Revenue)</label>
                  <select name="financialCategoryId" defaultValue={editingProduct?.financialCategoryId || ""} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                    <option value="">None (No financial tracking)</option>
                    {financialCategories.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {editingProduct && (
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-zinc-700 block mb-1">Status</label>
                    <select name="isActive" required defaultValue={editingProduct.isActive ? "true" : "false"} className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => { setIsAddOpen(false); setEditingProduct(null); }}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#4A2E1B] text-white hover:bg-[#3D2314]">
                  {isSubmitting ? (editingProduct ? "Saving..." : "Creating...") : (editingProduct ? "Save Changes" : "Create Product")}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
