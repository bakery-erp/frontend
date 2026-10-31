"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, Edit3, DollarSign, Image as ImageIcon, Save, Store } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DetailSkeleton } from "@/components/ui/skeletons";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import { ConfirmModal } from "@/components/ConfirmModal";
import { useLanguage } from "@/context/LanguageContext";

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
  nameLatin?: string | null;
  flavor?: string;
  categoryId: string;
  unitType: string;
  basePrice: number;
  buyPrice?: number;
  financialCategoryId?: string;
  imageUrl?: string;
  isActive: boolean;
  branchIds?: string[];
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { user } = useAuth();
  const { branches } = useBranch();
  const { t, getItemName } = useLanguage();
  const queryClient = useQueryClient();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFormChanged, setIsFormChanged] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedBranchIds, setSelectedBranchIds] = useState<string[]>([]);
  const [isAllBranches, setIsAllBranches] = useState<boolean>(true);

  useEffect(() => {
    if (user && user.role !== 'OWNER') {
      toast.error(t("products.toastRestrictedOwnerEdit"));
      router.replace('/production/history');
    }
  }, [user, router, t]);

  const { showPrompt, setShowPrompt, confirmAction, guardedAction } = useUnsavedChanges(isFormChanged);

  const { data, isLoading, error } = useQuery({
    queryKey: ['product-edit', productId],
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    enabled: !!productId && !!user && user.role === 'OWNER',
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
  });

  const product = data?.product;
  const categories = data?.categories || [];
  const financialCategories = data?.financialCategories || [];

  useEffect(() => {
    if (product) {
      if (!selectedCategoryId && product.categoryId) {
        setSelectedCategoryId(product.categoryId);
      }
      if (Array.isArray(product.branchIds)) {
        setSelectedBranchIds(product.branchIds);
        setIsAllBranches(product.branchIds.length === 0);
      }
    }
  }, [product, selectedCategoryId]);

  const effectiveCategoryId = selectedCategoryId || product?.categoryId || '';
  const selectedCategory = categories.find((c) => c.id === effectiveCategoryId);
  const isResell = selectedCategory?.type === "RESELL";

  const formatCategoryLabel = (cat: ProductCategory) => {
    const parentLabel = cat.parent ? getItemName(cat.parent) : null;
    const catLabel = getItemName(cat);
    return parentLabel ? `${parentLabel} / ${catLabel}` : catLabel;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!product) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const data = {
        name: formData.get("name"),
        nameLatin: formData.get("nameLatin") || undefined,
        categoryId: formData.get("categoryId"),
        financialCategoryId: formData.get("financialCategoryId") || undefined,
        flavor: formData.get("flavor") || undefined,
        unitType: formData.get("unitType"),
        basePrice: Number(formData.get("basePrice")),
        // Buying cost is available only for RESELL products, cleared to null for PRODUCED
        buyPrice: isResell && formData.get("buyPrice") ? Number(formData.get("buyPrice")) : null,
        imageUrl: null,
        isActive: formData.get("isActive") === "true",
        branchIds: isAllBranches ? [] : selectedBranchIds,
      };

      await api.patch(`/products/${product.id}`, data);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['products'] }),
        queryClient.invalidateQueries({ queryKey: ['product-edit', productId] }),
        queryClient.invalidateQueries({ queryKey: ['daily-sessions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['product-conversions'] }),
      ]);
      setIsFormChanged(false);
      toast.success(t("products.toastProductUpdated"));
      router.push("/products");
    } catch (err: any) {
      toast.error(err.response?.data?.error || t("products.toastFailedUpdate"));
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
          <p className="text-sm font-bold text-rose-600">{t("products.productNotFound")}</p>
          <Link href="/products">
            <Button variant="outline" className="rounded-xl border-[#EDE4D5]">
              <ArrowLeft className="w-4 h-4 mr-2" /> {t("products.returnToProducts")}
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
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => guardedAction(() => router.push("/products"))}
            className="w-10 h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
              {t("products.editProductTitle")}: {product.name}
            </h1>
            <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
              {t("products.productSubtitleEdit")}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} onChange={() => setIsFormChanged(true)} className="space-y-6">
          {/* Section 1: Basic Information */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#E87A18] flex items-center justify-center">
                <Edit3 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t("products.sectionBasicInfo")}</h2>
                <p className="text-xs text-[#8C7361]">{t("products.sectionBasicInfoDesc")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t("products.productNameReq")} (በግዕዝ ፊደል) <span className="text-rose-600">*</span>
                </label>
                <Input
                  name="name"
                  defaultValue={product.name}
                  placeholder="ምሳሌ፡ መደበኛ ዳቦ ባለ 15"
                  required
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  የምርት ስም በእንግሊዝኛ ፊደላት (Latin Transliteration)
                </label>
                <Input
                  name="nameLatin"
                  defaultValue={product.nameLatin || ''}
                  placeholder="e.g. Medebegna Dabo Bale 15"
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t("products.categorySelect")} <span className="text-rose-600">*</span>
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
                  {t("products.unitTypeLabel")} <span className="text-rose-600">*</span>
                </label>
                <select
                  name="unitType"
                  required
                  defaultValue={product.unitType}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="PIECE">{t("products.unitTypePiece")}</option>
                  <option value="KG">{t("products.unitTypeKg")}</option>
                  <option value="GRAM">{t("products.unitTypeGram")}</option>
                  <option value="LITER">{t("products.unitTypeLiter")}</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t("products.flavorVariant")}
                </label>
                <Input
                  name="flavor"
                  defaultValue={product.flavor || ""}
                  placeholder={t("products.flavorPlaceholder")}
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
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t("products.sectionPricing")}</h2>
                <p className="text-xs text-[#8C7361]">{t("products.sectionPricingDesc")}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t("products.basePriceLabel")} <span className="text-rose-600">*</span>
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
                    {t("products.buyingCostLabel")} <span className="text-[#8C7361] font-normal">{t("products.optionalTag")}</span>
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
                  <p className="mt-1 text-[11px] text-zinc-500">{t("products.buyingCostHelp")}</p>
                </div>
              ) : (
                <div className="flex flex-col justify-center rounded-xl border border-dashed border-[#EDE4D5] bg-[#FAF6F0] p-3 text-xs text-[#8C7361]">
                  <span className="font-bold text-[#2C1B10] block mb-0.5">{t("products.inHouseProducedTitle")}</span>
                  <span>{t("products.inHouseProducedDesc")}</span>
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t("products.revenueCategoryLabel")}
                </label>
                <select
                  name="financialCategoryId"
                  defaultValue={product.financialCategoryId || ""}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="">{t("products.revenueCategoryNone")}</option>
                  {financialCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Branch Availability (Option 1) */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EDE4D5] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-extrabold text-[#2C1B10]">{t("products.sectionBranchAvailability")}</h2>
                  <p className="text-xs text-[#8C7361]">{t("products.sectionBranchAvailabilityDesc")}</p>
                </div>
              </div>

              <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-xs font-extrabold text-[#4A2E1B] cursor-pointer hover:bg-[#F4ECE1] transition-all select-none">
                <input
                  type="checkbox"
                  checked={isAllBranches}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsAllBranches(checked);
                    if (checked) {
                      setSelectedBranchIds(branches.map((b) => b.id));
                    } else {
                      setSelectedBranchIds([]);
                    }
                    setIsFormChanged(true);
                  }}
                  className="rounded text-[#E87A18] focus:ring-[#E87A18]"
                />
                <span>🌐 {t("products.allBranchesCheckbox")}</span>
              </label>
            </div>

            {branches.length === 0 ? (
              <p className="text-xs text-[#8C7361] py-2">{t("products.noBranchesFound")}</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {branches.map((b) => {
                  const isChecked = isAllBranches || selectedBranchIds.includes(b.id);
                  return (
                    <label
                      key={b.id}
                      className={`flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all select-none ${
                        isChecked
                          ? "bg-amber-50/70 border-[#E87A18] ring-1 ring-[#E87A18]/30 shadow-2xs"
                          : "bg-white border-[#EDE4D5] text-[#8C7361] hover:border-zinc-300"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isAllBranches) {
                            setIsAllBranches(false);
                            setSelectedBranchIds(branches.filter((item) => item.id !== b.id).map((item) => item.id));
                          } else {
                            const next = selectedBranchIds.includes(b.id)
                              ? selectedBranchIds.filter((id) => id !== b.id)
                              : [...selectedBranchIds, b.id];
                            setSelectedBranchIds(next);
                            if (next.length === branches.length) {
                              setIsAllBranches(true);
                            }
                          }
                          setIsFormChanged(true);
                        }}
                        className="mt-0.5 rounded text-[#E87A18] focus:ring-[#E87A18]"
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-extrabold text-[#2C1B10] block truncate">📍 {b.name}</span>
                        <span className="text-[10px] text-[#8C7361] block">
                          {isChecked ? t("products.availableAtBranch") : t("products.disabledAtBranch")}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 4: Availability & Status */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div>
              <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                {t("products.colActive")}
              </label>
              <select
                name="isActive"
                defaultValue={product.isActive ? "true" : "false"}
                className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
              >
                <option value="true">{t("products.activeLabel")} ({t("products.statusAvailableForSale")})</option>
                <option value="false">{t("products.inactiveLabel")}</option>
              </select>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              loading={isSubmitting}
              loadingText={t("products.savingProductBtn")}
              size="lg"
              className="order-1 sm:order-2 flex-1"
            >
              <Save className="w-4 h-4" />
              {t("products.saveChangesBtn")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => guardedAction(() => router.push("/products"))}
              className="w-full sm:w-auto order-2 sm:order-1 sm:flex-initial"
            >
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showPrompt}
        title={t("products.unsavedModalTitle")}
        description={t("products.unsavedModalDesc")}
        confirmText={t("products.discardChangesBtn")}
        cancelText={t("products.keepEditingBtn")}
        variant="warning"
        onConfirm={confirmAction}
        onCancel={() => setShowPrompt(false)}
      />
    </DashboardLayout>
  );
}
