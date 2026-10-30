'use client';

import React, { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { AppDatePicker } from '@/components/AppDatePicker';
import {
  ArrowLeft,
  ArrowRight,
  Truck,
  Plus,
  Minus,
  Trash2,
  DollarSign,
  AlertCircle,
  Building2,
  Calendar,
  FileText,
  CreditCard,
  Percent,
  CheckCircle2,
  Info,
  Search,
  Layers,
  ShoppingBag,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  type: 'MILK' | 'INJERA' | 'GENERAL';
  branchId: string;
}

interface ProductItem {
  id: string;
  name: string;
  nameLatin?: string | null;
  unitType: string;
  buyPrice?: number;
  basePrice?: number;
  category?: { name?: string; type?: string };
}

interface SelectedDeliveryProduct {
  quantity: string;
  buyPrice: string;
  sellPrice: string;
}

function NewDeliveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSupplierId = searchParams.get('supplierId') || '';

  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t, language, getItemName } = useLanguage();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'OWNER';

  useEffect(() => {
    if (user && user.role === 'STOCK_KEEPER') {
      router.replace('/stock');
    }
  }, [user, router]);

  // 3-step wizard state
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Step 1: Supplier selection
  const [supplierId, setSupplierId] = useState(preselectedSupplierId);
  const [supplierSearch, setSupplierSearch] = useState('');

  // Step 2: Product selection with quantities & rates
  // Map of productId -> { quantity, buyPrice, sellPrice }
  const [productMap, setProductMap] = useState<Record<string, SelectedDeliveryProduct>>({});
  const [productSearch, setProductSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  // Step 3: Payment & Summary
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentSource, setPaymentSource] = useState<'DAILY_CASH' | 'OWNER'>('DAILY_CASH');
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'HALF' | 'ZERO' | 'CUSTOM'>('FULL');
  const [amountPaidNow, setAmountPaidNow] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load base data: Suppliers and Products
  const { data: baseData, isLoading } = useQuery({
    queryKey: ['new-delivery-base', selectedBranchId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const [supRes, prodRes] = await Promise.all([
        api.get('/suppliers', { params }),
        api.get('/products?minimal=true'),
      ]);

      const resellOnly = (prodRes.data || []).filter((p: any) => p.category?.type === 'RESELL');
      const filteredProd = resellOnly.length > 0 ? resellOnly : (prodRes.data || []).filter((p: any) => p.category?.type !== 'PRODUCED');

      return {
        suppliers: (supRes.data || []) as Supplier[],
        products: filteredProd as ProductItem[],
      };
    },
  });

  const suppliers = baseData?.suppliers || [];
  const products = baseData?.products || [];

  // Set default supplier
  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      if (preselectedSupplierId && suppliers.some((s) => s.id === preselectedSupplierId)) {
        setSupplierId(preselectedSupplierId);
      } else {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [suppliers, supplierId, preselectedSupplierId]);

  // Selected supplier object
  const selectedSupplier = suppliers.find((s) => s.id === supplierId);

  // Filtered suppliers
  const filteredSuppliers = useMemo(() => {
    const q = supplierSearch.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.phone && s.phone.includes(q)) || s.type.toLowerCase().includes(q)
    );
  }, [suppliers, supplierSearch]);

  // Product categories
  const productCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.category?.name) set.add(p.category.name);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (categoryFilter !== 'ALL' && p.category?.name !== categoryFilter) {
        return false;
      }
      if (productSearch.trim()) {
        const q = productSearch.trim().toLowerCase();
        const n = p.name.toLowerCase();
        const nl = (p.nameLatin || '').toLowerCase();
        if (!n.includes(q) && !nl.includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [products, categoryFilter, productSearch]);

  // Update product selection
  const updateProductEntry = (productId: string, field: 'quantity' | 'buyPrice' | 'sellPrice', value: string) => {
    const prod = products.find((p) => p.id === productId);
    setProductMap((prev) => {
      const existing = prev[productId] || {
        quantity: '',
        buyPrice: prod ? String(prod.buyPrice || '') : '',
        sellPrice: prod ? String(prod.basePrice || '') : '',
      };
      return {
        ...prev,
        [productId]: {
          ...existing,
          [field]: value,
        },
      };
    });
  };

  const incrementQty = (productId: string) => {
    const curr = parseInt(productMap[productId]?.quantity || '0', 10);
    updateProductEntry(productId, 'quantity', String(curr + 1));
  };

  const decrementQty = (productId: string) => {
    const curr = parseInt(productMap[productId]?.quantity || '0', 10);
    if (curr > 1) {
      updateProductEntry(productId, 'quantity', String(curr - 1));
    } else {
      updateProductEntry(productId, 'quantity', '');
    }
  };

  // Selected delivery items list
  const selectedItemsList = useMemo(() => {
    return Object.entries(productMap)
      .map(([id, entry]) => {
        const prod = products.find((p) => p.id === id);
        const qty = parseFloat(entry.quantity) || 0;
        const buyPrice = parseFloat(entry.buyPrice) || 0;
        const sellPrice = parseFloat(entry.sellPrice) || 0;
        return {
          productId: id,
          product: prod,
          quantity: qty,
          buyPrice,
          sellPrice,
          totalCost: qty * buyPrice,
        };
      })
      .filter((it) => it.quantity > 0 && it.product);
  }, [productMap, products]);

  // Calculations
  const totalCost = useMemo(() => {
    return selectedItemsList.reduce((sum, item) => sum + item.totalCost, 0);
  }, [selectedItemsList]);

  const totalItemsCount = useMemo(() => {
    return selectedItemsList.reduce((sum, item) => sum + item.quantity, 0);
  }, [selectedItemsList]);

  // Payment synchronization
  useEffect(() => {
    if (paymentMode === 'FULL') {
      setAmountPaidNow(totalCost > 0 ? totalCost.toFixed(2) : '0');
    } else if (paymentMode === 'HALF') {
      setAmountPaidNow(totalCost > 0 ? (totalCost / 2).toFixed(2) : '0');
    } else if (paymentMode === 'ZERO') {
      setAmountPaidNow('0');
    }
  }, [paymentMode, totalCost]);

  const numPaidNow = Math.min(totalCost, Math.max(0, parseFloat(amountPaidNow) || 0));
  const remainingBalance = Math.max(0, totalCost - numPaidNow);

  let paymentStatusBadge: 'PAID' | 'PARTIAL' | 'UNPAID' = 'UNPAID';
  if (totalCost > 0) {
    if (numPaidNow >= totalCost) {
      paymentStatusBadge = 'PAID';
    } else if (numPaidNow > 0) {
      paymentStatusBadge = 'PARTIAL';
    }
  }

  // Step 1 Validation
  const canProceedFromStep1 = Boolean(supplierId);

  // Step 2 Validation
  const canProceedFromStep2 = selectedItemsList.length > 0 && totalCost > 0;

  // Form Submission
  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!supplierId) {
      setCurrentStep(1);
      toast.error('Please select a supplier');
      return;
    }

    if (selectedItemsList.length === 0) {
      setCurrentStep(2);
      toast.error('Please add at least one product with a valid quantity and buy price');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/supplier-deliveries', {
        supplierId,
        paymentSource,
        isPaid: numPaidNow >= totalCost && totalCost > 0,
        amountPaidNow: numPaidNow,
        notes: notes.trim() || undefined,
        items: selectedItemsList.map((i) => ({
          productId: i.productId,
          quantityReceived: Number(i.quantity),
          unitBuyPrice: Number(i.buyPrice) || 0,
          unitSellPrice: Number(i.sellPrice) || 0,
        })),
      });

      toast.success(
        language === 'am'
          ? `የርክክብ ደረሰኝ በተሳካ ሁኔታ ተመዝግቧል!`
          : language === 'om'
          ? `Nagaheen dhiyeessii milkaa'inaan galmaa'eera!`
          : `Delivery receipt recorded successfully!`
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['suppliers-page'] }),
        queryClient.invalidateQueries({ queryKey: ['suppliers'] }),
        queryClient.invalidateQueries({ queryKey: ['supplier-detail'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['products'] }),
      ]);

      router.push(`/suppliers/${supplierId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record delivery receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto pb-24 md:pb-12">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={() => router.push(supplierId ? `/suppliers/${supplierId}` : '/suppliers')}
              className="w-10 h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] shrink-0"
            >
              <ArrowLeft className="w-4 h-4 text-[#4A2E1B]" />
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] tracking-tight">
                New Supplier Delivery Receipt
              </h1>
              <p className="text-xs text-[#8C7361] font-medium">
                Step {currentStep} of 3: {currentStep === 1 ? 'Choose Supplier' : currentStep === 2 ? 'Select Delivered Products & Rates' : 'Review & Payment Verification'}
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            onClick={() => router.push(supplierId ? `/suppliers/${supplierId}` : '/suppliers')}
            className="text-xs font-bold text-[#8C7361] hover:text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl h-9 px-3"
          >
            Cancel
          </Button>
        </div>

        {/* 3-Step Wizard Navigation Stepper */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <button
            type="button"
            onClick={() => setCurrentStep(1)}
            className={`p-3 rounded-2xl border text-left transition-all ${
              currentStep === 1
                ? 'bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-sm'
                : canProceedFromStep1
                ? 'bg-white text-[#4A2E1B] border-emerald-300 hover:bg-[#FAF6F0]'
                : 'bg-white/60 text-[#8C7361] border-[#EDE4D5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 1 ? 'bg-[#E87A18] text-white' : canProceedFromStep1 ? 'bg-emerald-100 text-emerald-800' : 'bg-[#EDE4D5] text-[#8C7361]'
              }`}>
                {canProceedFromStep1 && currentStep !== 1 ? '✓' : '1'}
              </span>
              <span className="text-xs font-extrabold truncate">1. Supplier</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (canProceedFromStep1) setCurrentStep(2);
              else toast.error('Please select a supplier first');
            }}
            className={`p-3 rounded-2xl border text-left transition-all ${
              currentStep === 2
                ? 'bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-sm'
                : canProceedFromStep2
                ? 'bg-white text-[#4A2E1B] border-emerald-300 hover:bg-[#FAF6F0]'
                : 'bg-white/60 text-[#8C7361] border-[#EDE4D5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 2 ? 'bg-[#E87A18] text-white' : canProceedFromStep2 ? 'bg-emerald-100 text-emerald-800' : 'bg-[#EDE4D5] text-[#8C7361]'
              }`}>
                {canProceedFromStep2 && currentStep !== 2 ? '✓' : '2'}
              </span>
              <span className="text-xs font-extrabold truncate">2. Products</span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              if (!canProceedFromStep1) {
                toast.error('Please select a supplier first');
              } else if (!canProceedFromStep2) {
                toast.error('Please enter products, quantities, and buy prices');
              } else {
                setCurrentStep(3);
              }
            }}
            className={`p-3 rounded-2xl border text-left transition-all ${
              currentStep === 3
                ? 'bg-[#4A2E1B] text-white border-[#4A2E1B] shadow-sm'
                : 'bg-white/60 text-[#8C7361] border-[#EDE4D5]'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${
                currentStep === 3 ? 'bg-[#E87A18] text-white' : 'bg-[#EDE4D5] text-[#8C7361]'
              }`}>
                3
              </span>
              <span className="text-xs font-extrabold truncate">3. Verification</span>
            </div>
          </button>
        </div>

        {/* STEP 1: CHOOSE SUPPLIER */}
        {currentStep === 1 && (
          <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-3">
              <h3 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#E87A18]" />
                <span>Select Supplier ({suppliers.length})</span>
              </h3>
            </div>

            {/* Supplier Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
              <Input
                placeholder="Search supplier by name, phone, or category..."
                value={supplierSearch}
                onChange={(e) => setSupplierSearch(e.target.value)}
                className="pl-10 h-11 rounded-xl bg-[#FAF6F0]/60 border-[#EDE4D5] text-sm"
              />
            </div>

            {/* Supplier Cards Grid */}
            {isLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-6">
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </div>
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-[#EDE4D5] rounded-2xl text-[#8C7361]">
                <p className="font-bold text-sm">No suppliers found matching &quot;{supplierSearch}&quot;</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[460px] overflow-y-auto pr-1">
                {filteredSuppliers.map((sup) => {
                  const isSelected = supplierId === sup.id;
                  return (
                    <div
                      key={sup.id}
                      onClick={() => setSupplierId(sup.id)}
                      className={`p-4 rounded-2xl border text-left cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? 'bg-amber-50/70 border-[#E87A18] ring-2 ring-[#E87A18]/30 shadow-xs'
                          : 'bg-white hover:bg-[#FAF6F0]/50 border-[#EDE4D5]'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-sm text-[#2C1B10] truncate">{sup.name}</h4>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] shrink-0">
                            {sup.type}
                          </span>
                        </div>
                        {sup.phone && (
                          <p className="text-xs font-mono text-[#8C7361] mt-1">{sup.phone}</p>
                        )}
                      </div>

                      <div className="shrink-0 pt-0.5">
                        {isSelected ? (
                          <span className="w-6 h-6 rounded-full bg-[#E87A18] text-white flex items-center justify-center text-xs font-black shadow-xs">
                            ✓
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-full border border-zinc-200" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Bottom Proceed Button for Step 1 */}
            <div className="flex justify-end pt-3 border-t border-[#F4ECE1]">
              <Button
                type="button"
                size="lg"
                disabled={!canProceedFromStep1}
                onClick={() => {
                  if (canProceedFromStep1) {
                    setCurrentStep(2);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }
                }}
                className="w-full sm:w-auto h-12 px-6 rounded-xl bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <span>Next: Select Products</span>
                <ArrowRight className="w-4 h-4 shrink-0" />
              </Button>
            </div>
          </div>
        )}

        {/* STEP 2: SELECT DELIVERED PRODUCTS, QUANTITIES & PRICES */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-4 sm:p-6 shadow-xs space-y-4">
              {/* Toolbar */}
              <div className="space-y-3 border-b border-[#F4ECE1] pb-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B]">
                    <Layers className="w-4 h-4 text-[#E87A18]" /> Filter by Category:
                  </div>
                  <span className="text-xs font-extrabold text-[#E87A18] font-mono">
                    {selectedItemsList.length} Items Selected ({totalItemsCount} Units)
                  </span>
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setCategoryFilter('ALL')}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                      categoryFilter === 'ALL'
                        ? 'bg-[#4A2E1B] text-white shadow-2xs'
                        : 'bg-[#FAF6F0] text-[#4A2E1B] hover:bg-[#EDE4D5]'
                    }`}
                  >
                    All Resell Products ({products.length})
                  </button>
                  {productCategories.map((cat) => {
                    const count = products.filter((p) => p.category?.name === cat).length;
                    const isSelected = categoryFilter === cat;
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCategoryFilter(cat)}
                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-[#4A2E1B] text-white shadow-2xs'
                            : 'bg-[#FAF6F0] text-[#4A2E1B] hover:bg-[#EDE4D5]'
                        }`}
                      >
                        <span>{cat}</span>
                        <span className={`text-[10px] px-1 rounded-full font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-white text-[#8C7361]'
                        }`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
                  <Input
                    placeholder="Search product name..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="pl-10 h-10 rounded-xl bg-[#FAF6F0]/50 border-[#EDE4D5] text-xs"
                  />
                </div>
              </div>

              {/* Products Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[520px] overflow-y-auto pr-1">
                {filteredProducts.map((prod) => {
                  const entry = productMap[prod.id] || {
                    quantity: '',
                    buyPrice: String(prod.buyPrice || ''),
                    sellPrice: String(prod.basePrice || ''),
                  };
                  const qty = parseFloat(entry.quantity) || 0;
                  const isSelected = qty > 0;
                  const buyRate = parseFloat(entry.buyPrice) || 0;
                  const subTotal = qty * buyRate;

                  return (
                    <div
                      key={prod.id}
                      className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between ${
                        isSelected
                          ? 'bg-amber-50/60 border-[#E87A18] ring-2 ring-[#E87A18]/20 shadow-xs'
                          : 'bg-white hover:bg-[#FAF6F0]/40 border-[#EDE4D5]'
                      }`}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-1 mb-1">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-[#FAF6F0] text-[#4A2E1B] border border-[#EDE4D5] truncate max-w-[130px]">
                            {prod.category?.name || 'Resell Product'}
                          </span>
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white text-[#8C7361] border border-[#EDE4D5]">
                            {prod.unitType}
                          </span>
                        </div>

                        <h4 className="font-extrabold text-sm text-[#2C1B10] leading-tight">
                          {getItemName(prod)}
                        </h4>
                        {prod.nameLatin && (
                          <p className="text-[11px] font-mono text-[#8C7361] mt-0.5">{prod.nameLatin}</p>
                        )}
                      </div>

                      {/* Quantity & Price Inputs */}
                      <div className="mt-3 pt-2.5 border-t border-[#F4ECE1] space-y-2">
                        <div>
                          <label className="text-[10px] font-bold text-[#8C7361] uppercase block mb-1">
                            Quantity Received
                          </label>
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => decrementQty(prod.id)}
                              disabled={qty <= 0}
                              className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] hover:bg-[#FAF6F0]"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </Button>

                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0"
                              value={entry.quantity}
                              onChange={(e) => updateProductEntry(prod.id, 'quantity', e.target.value)}
                              className="h-8 text-center text-xs font-black rounded-lg border-[#EDE4D5] bg-white font-mono"
                            />

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => incrementQty(prod.id)}
                              className="h-8 w-8 p-0 rounded-lg border-[#EDE4D5] hover:bg-[#FAF6F0]"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-bold text-[#8C7361] uppercase block mb-0.5">
                              Buy Price (ETB)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={entry.buyPrice}
                              onChange={(e) => updateProductEntry(prod.id, 'buyPrice', e.target.value)}
                              className="h-8 text-xs font-mono rounded-lg border-[#EDE4D5] bg-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-[#8C7361] uppercase block mb-0.5">
                              Sell Price (ETB)
                            </label>
                            <Input
                              type="number"
                              min="0"
                              step="any"
                              placeholder="0.00"
                              value={entry.sellPrice}
                              onChange={(e) => updateProductEntry(prod.id, 'sellPrice', e.target.value)}
                              className="h-8 text-xs font-mono rounded-lg border-[#EDE4D5] bg-white"
                            />
                          </div>
                        </div>

                        {isSelected && (
                          <div className="text-right text-[11px] font-mono font-bold text-[#2C1B10] pt-1">
                            Cost: <strong className="text-[#E87A18] font-black">{subTotal.toFixed(2)} ETB</strong>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step 2 Bottom Navigation */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  setCurrentStep(1);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="h-12 px-5 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Supplier</span>
              </Button>

              <div className="flex items-center gap-3">
                <div className="hidden sm:block text-right">
                  <span className="text-[10px] text-[#8C7361] font-bold uppercase block">Total Cost</span>
                  <span className="text-base font-black text-[#E87A18] font-mono">{totalCost.toFixed(2)} ETB</span>
                </div>

                <Button
                  type="button"
                  size="lg"
                  disabled={!canProceedFromStep2}
                  onClick={() => {
                    if (canProceedFromStep2) {
                      setCurrentStep(3);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  className="h-12 px-6 rounded-xl bg-[#4A2E1B] hover:bg-[#3D2516] text-white font-extrabold text-sm flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
                >
                  <span>Next: Summary & Payment ({selectedItemsList.length})</span>
                  <ArrowRight className="w-4 h-4 shrink-0" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: VERIFICATION, PAYMENT MODE & SUBMISSION */}
        {currentStep === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Supplier Card */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 shadow-xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100/70 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#8C7361] tracking-wider block">Supplier</span>
                  <h3 className="font-black text-base text-[#2C1B10]">{selectedSupplier?.name}</h3>
                  <p className="text-xs font-mono text-[#8C7361]">
                    {selectedSupplier?.phone || 'No phone'} • Type: <strong className="uppercase">{selectedSupplier?.type}</strong>
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCurrentStep(1)}
                className="h-8 text-xs font-bold border-[#EDE4D5] hover:bg-[#FAF6F0] rounded-xl"
              >
                Change Supplier
              </Button>
            </div>

            {/* Products Table Summary */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-[#F4ECE1] pb-3">
                <h3 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
                  <span>Delivered Products ({selectedItemsList.length})</span>
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentStep(2)}
                  className="h-8 text-xs font-bold border-[#EDE4D5] hover:bg-[#FAF6F0] rounded-xl"
                >
                  Edit Products
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#F4ECE1] text-[#8C7361]">
                      <th className="py-2 font-bold uppercase text-[10px]">Product</th>
                      <th className="py-2 text-center font-bold uppercase text-[10px]">Qty Received</th>
                      <th className="py-2 text-right font-bold uppercase text-[10px]">Buy Rate</th>
                      <th className="py-2 text-right font-bold uppercase text-[10px]">Sell Rate</th>
                      <th className="py-2 text-right font-bold uppercase text-[10px]">Subtotal Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#F4ECE1]">
                    {selectedItemsList.map((it) => (
                      <tr key={it.productId} className="font-medium text-[#2C1B10]">
                        <td className="py-2.5">
                          <span className="font-bold block">{getItemName(it.product)}</span>
                          <span className="text-[10px] text-[#8C7361]">{it.product?.category?.name || 'Resell'}</span>
                        </td>
                        <td className="py-2.5 text-center font-mono font-bold">
                          {it.quantity} {it.product?.unitType}
                        </td>
                        <td className="py-2.5 text-right font-mono text-[#8C7361]">
                          {it.buyPrice.toFixed(2)} ETB
                        </td>
                        <td className="py-2.5 text-right font-mono text-[#8C7361]">
                          {it.sellPrice.toFixed(2)} ETB
                        </td>
                        <td className="py-2.5 text-right font-mono font-black text-[#E87A18]">
                          {it.totalCost.toFixed(2)} ETB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Total Cost Display */}
              <div className="pt-3 border-t border-[#EDE4D5] flex items-center justify-between bg-[#FAF6F0]/80 p-3.5 rounded-2xl">
                <div>
                  <span className="text-xs uppercase font-extrabold text-[#4A2E1B] block">Total Delivery Value</span>
                  <span className="text-[11px] text-[#8C7361]">{totalItemsCount} total units added to shop inventory</span>
                </div>
                <div className="text-right">
                  <span className="text-xl sm:text-2xl font-black text-[#E87A18] font-mono">
                    {totalCost.toFixed(2)} ETB
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Details & Settlement Mode */}
            <div className="bg-white border border-[#EDE4D5] rounded-3xl p-5 shadow-xs space-y-4">
              <h3 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#E87A18]" />
                <span>Payment Settlement Configuration</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                    Delivery Date *
                  </label>
                  <AppDatePicker
                    value={deliveryDate}
                    onChange={(val) => setDeliveryDate(val)}
                    className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                  />
                </div>

                <div>
                  <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                    Payment Source *
                  </label>
                  <div className="grid grid-cols-2 gap-2 h-11">
                    <button
                      type="button"
                      onClick={() => setPaymentSource('DAILY_CASH')}
                      className={`rounded-xl text-xs font-bold transition-all border ${
                        paymentSource === 'DAILY_CASH'
                          ? 'bg-[#4A2E1B] text-white border-[#4A2E1B]'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      💵 Daily Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentSource('OWNER')}
                      className={`rounded-xl text-xs font-bold transition-all border ${
                        paymentSource === 'OWNER'
                          ? 'bg-[#4A2E1B] text-white border-[#4A2E1B]'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      🏦 Owner Direct
                    </button>
                  </div>
                </div>

                <div className="sm:col-span-2 space-y-2">
                  <label className="text-xs font-extrabold text-[#2C1B10] block uppercase">
                    Payment Settlement Mode
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMode('FULL')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMode === 'FULL'
                          ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      Full (100%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('HALF')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMode === 'HALF'
                          ? 'bg-blue-700 text-white border-blue-700 shadow-xs'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      Partial (50%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('ZERO')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMode === 'ZERO'
                          ? 'bg-rose-700 text-white border-rose-700 shadow-xs'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      Credit (0%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMode('CUSTOM')}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                        paymentMode === 'CUSTOM'
                          ? 'bg-purple-700 text-white border-purple-700 shadow-xs'
                          : 'bg-[#FAF6F0]/50 text-[#8C7361] border-[#EDE4D5] hover:bg-[#FAF6F0]'
                      }`}
                    >
                      Custom Amount
                    </button>
                  </div>
                </div>

                {paymentMode === 'CUSTOM' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                      Custom Paid Amount (ETB)
                    </label>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      max={totalCost}
                      value={amountPaidNow}
                      onChange={(e) => setAmountPaidNow(e.target.value)}
                      className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5] font-mono"
                    />
                  </div>
                )}

                {/* Settlement Summary Pill */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[#8C7361] block">Paid Now</span>
                    <strong className="text-emerald-700 font-extrabold font-mono text-sm">
                      {numPaidNow.toFixed(2)} ETB
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="text-[#8C7361] block">Supplier Credit Balance</span>
                    <strong className={`font-mono text-sm ${remainingBalance > 0 ? 'text-rose-700 font-black' : 'text-zinc-500 font-semibold'}`}>
                      {remainingBalance.toFixed(2)} ETB
                    </strong>
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-extrabold text-[#2C1B10] block mb-1.5 uppercase">
                    Delivery Notes / Invoice Number
                  </label>
                  <Input
                    placeholder="e.g. Invoice #9910, Morning bread/milk delivery"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-11 rounded-xl bg-[#FAF6F0]/40 border-[#EDE4D5]"
                  />
                </div>
              </div>
            </div>

            {/* Step 3 Bottom Actions */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={isSubmitting}
                onClick={() => {
                  setCurrentStep(2);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="h-12 px-5 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold text-xs flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Products</span>
              </Button>

              <Button
                type="submit"
                size="lg"
                disabled={isSubmitting || totalCost <= 0}
                loading={isSubmitting}
                className="flex-1 sm:flex-initial h-12 px-8 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-black text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Confirm & Record Delivery Receipt</span>
              </Button>
            </div>
          </form>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function NewDeliveryPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center">
          <p className="text-[#4A2E1B] font-bold text-sm">Loading delivery form...</p>
        </div>
      }
    >
      <NewDeliveryContent />
    </Suspense>
  );
}
