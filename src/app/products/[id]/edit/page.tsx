"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Edit3, DollarSign, Image as ImageIcon, Save } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailSkeleton } from "@/components/ui/skeletons";

interface ProductCategory {
  id: string;
  name: string;
  type: string;
  parent?: { name: string } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
}

interface ProductData {
  id: string;
  name: string;
  flavor?: string;
  categoryId: string;
  unitType: string;
  basePrice: number;
  buyPrice?: number;
  financialCategoryId?: string;
  imageUrl?: string;
  isActive: boolean;
}

const PRODUCT_PRESET_IMAGES = [
  { label: 'French Bread', url: 'https://www.melskitchencafe.com/wp-content/uploads/french-bread1.webp' },
  { label: 'Loaf Bread', url: 'https://www.thespruceeats.com/thmb/j4mujy24lcmnyW_a7VS1sVP4Mw4=/750x0/filters:no_upscale():max_bytes(150000):strip_icc():format(webp)/loaf-of-bread-182835505-58a7008c5f9b58a3c91c9a14.jpg' },
  { label: 'Barley Bread', url: 'https://live.staticflickr.com/2835/8764387785_85b54dae35_z.jpg' },
  { label: 'Croissant / Pastry', url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=600&q=80' },
  { label: 'Bomboloni / Donut', url: 'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?auto=format&fit=crop&w=600&q=80' },
  { label: 'Sambusa / Snack', url: 'https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cake / Dessert', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=600&q=80' },
  { label: 'Cookies / Biscuit', url: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?auto=format&fit=crop&w=600&q=80' },
];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-edit', productId],
    queryFn: async () => {
      const [prodRes, catRes, finCatRes] = await Promise.all([
        api.get(`/products/${productId}`).catch(async () => {
          const allRes = await api.get('/products');
          const found = allRes.data.find((p: ProductData) => p.id === productId);
          return { data: found };
        }),
        api.get('/product-categories'),
        api.get('/financial-categories?type=REVENUE').catch(() => ({ data: [] })),
      ]);

      if (!prodRes.data) {
        throw new Error("Product not found");
      }

      return {
        product: prodRes.data as ProductData,
        categories: (Array.isArray(catRes.data) ? catRes.data : []) as ProductCategory[],
        financialCategories: (Array.isArray(finCatRes.data) ? finCatRes.data : []) as FinancialCategory[],
      };
    },
    enabled: !!productId,
  });

  const product = data?.product;
  const categories = data?.categories || [];
  const financialCategories = data?.financialCategories || [];

  useEffect(() => {
    if (product) {
      if (!selectedImageUrl && product.imageUrl) {
        setSelectedImageUrl(product.imageUrl);
      } else if (!selectedImageUrl) {
        setSelectedImageUrl(PRODUCT_PRESET_IMAGES[0].url);
      }
      if (!selectedCategoryId && product.categoryId) {
        setSelectedCategoryId(product.categoryId);
      }
    }
  }, [product, selectedImageUrl, selectedCategoryId]);

  const effectiveCategoryId = selectedCategoryId || product?.categoryId || '';
  const selectedCategory = categories.find((c) => c.id === effectiveCategoryId);
  const isResell = selectedCategory?.type === "RESELL";

  const formatCategoryLabel = (cat: ProductCategory) =>
    cat.parent ? `${cat.parent.name} / ${cat.name}` : cat.name;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name"),
        categoryId: formData.get("categoryId"),
        financialCategoryId: formData.get("financialCategoryId") || undefined,
        flavor: formData.get("flavor") || undefined,
        unitType: formData.get("unitType"),
        basePrice: Number(formData.get("basePrice")),
        // Buying cost is available only for RESELL products, cleared to null for PRODUCED
        buyPrice: isResell && formData.get("buyPrice") ? Number(formData.get("buyPrice")) : null,
        imageUrl: selectedImageUrl || undefined,
        isActive: formData.get("isActive") === "true",
      };

      await api.patch(`/products/${product.id}`, data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product-edit', productId] }),
        queryClient.invalidateQueries({ queryKey: ['daily-sessions'] }),
      ]);
      toast.success("Product updated successfully");
      router.push("/products");
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update product");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto pb-12">
          <DetailSkeleton />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !product) {
    return (
      <DashboardLayout>
        <div className="max-w-3xl mx-auto pb-12 text-center py-16 space-y-4">
          <p className="text-sm font-bold text-rose-600">Product not found or failed to load.</p>
          <Link href="/products">
            <Button variant="outline" className="rounded-xl border-[#EDE4D5]">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Products
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto pb-12">
        {/* Top Header with Back Button */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/products">
            <Button variant="outline" size="icon" className="w-10 h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
              Edit Product: {product.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
              Modify catalog details, image selection, unit price, and availability
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#E87A18] flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">Product Information</h2>
                <p className="text-xs text-[#8C7361]">Item identity, flavor, and classification</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Product Name <span className="text-rose-600">*</span>
                </label>
                <Input
                  name="name"
                  defaultValue={product.name}
                  placeholder="e.g. Special White Bread"
                  required
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Category <span className="text-rose-600">*</span>
                </label>
                <select
                  name="categoryId"
                  required
                  value={selectedCategoryId}
                  onChange={(e) => setSelectedCategoryId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {formatCategoryLabel(c)} ({c.type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Unit Type <span className="text-rose-600">*</span>
                </label>
                <select
                  name="unitType"
                  required
                  defaultValue={product.unitType}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="PIECE">Piece (Item)</option>
                  <option value="KG">Kilogram (Kg)</option>
                  <option value="LITER">Liter (L)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Flavor / Variant (Optional)
                </label>
                <Input
                  name="flavor"
                  defaultValue={product.flavor || ""}
                  placeholder="e.g. Chocolate / Sesame / Whole Wheat"
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Pricing & Finance */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">Pricing & Revenue Category</h2>
                <p className="text-xs text-[#8C7361]">Customer selling price and wholesale purchase cost</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Selling Base Price (ETB) <span className="text-rose-600">*</span>
                </label>
                <Input
                  name="basePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  defaultValue={product.basePrice}
                  onFocus={(e) => e.target.select()}
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm font-mono font-bold text-[#4A2E1B]"
                />
              </div>

              {isResell ? (
                <div>
                  <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                    Buying Cost / Unit Buy Price (ETB) <span className="text-[#8C7361] font-normal">(Optional)</span>
                  </label>
                  <Input
                    name="buyPrice"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={product.buyPrice ?? ""}
                    placeholder="0.00"
                    onFocus={(e) => e.target.select()}
                    className="h-11 rounded-xl border-[#EDE4D5] text-sm font-mono"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">Wholesale cost paid to supplier for this resell item.</p>
                </div>
              ) : (
                <div className="flex flex-col justify-center rounded-xl border border-dashed border-[#EDE4D5] bg-[#FAF6F0] p-3 text-xs text-[#8C7361]">
                  <span className="font-bold text-[#2C1B10] block mb-0.5">In-House Produced Item</span>
                  <span>Buying cost applies only to external RESELL items. Produced goods are manufactured from raw ingredients.</span>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Financial Revenue Category (P&L Tracking)
                </label>
                <select
                  name="financialCategoryId"
                  defaultValue={product.financialCategoryId || ""}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="">None (Standard sales tracking)</option>
                  {financialCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Product Visuals */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">Product Visuals & Image</h2>
                <p className="text-xs text-[#8C7361]">Select a preset icon image or specify a custom URL</p>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-[#2C1B10] block mb-2">
                Choose from Bakery Presets:
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {PRODUCT_PRESET_IMAGES.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImageUrl(preset.url)}
                    className={`relative h-20 rounded-xl overflow-hidden border-2 transition-all group ${
                      selectedImageUrl === preset.url
                        ? 'border-[#E87A18] ring-2 ring-[#E87A18]/30 scale-[1.02]'
                        : 'border-zinc-200 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={preset.url} alt={preset.label} className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-white text-[9px] truncate px-1 py-0.5 text-center font-bold">
                      {preset.label.split('/')[0]}
                    </span>
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  Custom Image URL
                </label>
                <Input
                  type="url"
                  placeholder="https://..."
                  value={selectedImageUrl}
                  onChange={(e) => setSelectedImageUrl(e.target.value)}
                  className="h-11 rounded-xl border-[#EDE4D5] text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Availability & Status */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                Product Status
              </label>
              <select
                name="isActive"
                defaultValue={product.isActive ? "true" : "false"}
                className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="true">Active (Visible in POS & Production)</option>
                <option value="false">Inactive (Archived / Hidden)</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              loading={isSubmitting}
              loadingText="Saving Changes..."
              size="lg"
              className="order-1 sm:order-2 flex-1"
            >
              <Save className="w-4 h-4" />
              Save Product Changes
            </Button>
            <Link href="/products" className="order-2 sm:order-1 sm:flex-initial">
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full sm:w-auto"
              >
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
