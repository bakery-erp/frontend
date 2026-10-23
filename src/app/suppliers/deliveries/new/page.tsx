'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Truck,
  Plus,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
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
  unitType: string;
  buyPrice?: number;
  basePrice?: number;
  category?: { type: string };
}

interface DeliveryLineItem {
  productId: string;
  quantityReceived: string;
  unitBuyPrice: string;
  unitSellPrice: string;
}

function NewDeliveryContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedSupplierId = searchParams.get('supplierId') || '';

  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'OWNER';

  useEffect(() => {
    if (user && user.role === 'STOCK_KEEPER') {
      router.replace('/stock');
    }
  }, [user, router]);

  const [supplierId, setSupplierId] = useState(preselectedSupplierId);
  const [deliveryDate, setDeliveryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [paymentSource, setPaymentSource] = useState<'DAILY_CASH' | 'OWNER'>('DAILY_CASH');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DeliveryLineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Partial Payment State
  const [amountPaidNow, setAmountPaidNow] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'FULL' | 'HALF' | 'ZERO' | 'CUSTOM'>('FULL');

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

  // Set default supplier and initial row when base data loads
  useEffect(() => {
    if (suppliers.length > 0 && !supplierId) {
      if (preselectedSupplierId && suppliers.some((s) => s.id === preselectedSupplierId)) {
        setSupplierId(preselectedSupplierId);
      } else {
        setSupplierId(suppliers[0].id);
      }
    }
  }, [suppliers, supplierId, preselectedSupplierId]);

  useEffect(() => {
    if (products.length > 0 && items.length === 0) {
      const defaultProd = products[0];
      setItems([
        {
          productId: defaultProd.id,
          quantityReceived: '',
          unitBuyPrice: String(defaultProd.buyPrice || ''),
          unitSellPrice: String(defaultProd.basePrice || ''),
        },
      ]);
    }
  }, [products, items.length]);

  // Calculations
  const totalCost = items.reduce((sum, item) => {
    const qty = parseFloat(item.quantityReceived) || 0;
    const price = parseFloat(item.unitBuyPrice) || 0;
    return sum + qty * price;
  }, 0);

  // Sync amountPaidNow when paymentMode changes
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

  // Row manipulations
  const addRow = () => {
    const defaultProd = products[0];
    setItems((prev) => [
      ...prev,
      {
        productId: defaultProd ? defaultProd.id : '',
        quantityReceived: '',
        unitBuyPrice: defaultProd ? String(defaultProd.buyPrice || '') : '',
        unitSellPrice: defaultProd ? String(defaultProd.basePrice || '') : '',
      },
    ]);
  };

  const removeRow = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateRow = (index: number, field: keyof DeliveryLineItem, value: string) => {
    setItems((prev) => {
      const updated = [...prev];
      const item = { ...updated[index], [field]: value };
      if (field === 'productId') {
        const sel = products.find((p) => p.id === value);
        if (sel) {
          item.unitSellPrice = String(sel.basePrice || '');
          item.unitBuyPrice = String(sel.buyPrice || '');
        }
      }
      updated[index] = item;
      return updated;
    });
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }

    const validItems = items.filter((i) => i.productId && Number(i.quantityReceived) > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product with a valid quantity');
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
        items: validItems.map((i) => ({
          productId: i.productId,
          quantityReceived: Number(i.quantityReceived),
          unitBuyPrice: Number(i.unitBuyPrice) || 0,
          unitSellPrice: Number(i.unitSellPrice) || 0,
        })),
      });

      toast.success(
        language === 'am'
          ? `የርክክብ ደረሰኝ በተሳካ ሁኔታ ተመዝግቧል!`
          : language === 'om'
          ? `Nagaheen dhiyeessii milkaa'inaan galmaa'eera!`
          : `Delivery receipt recorded successfully!`
      );

      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['supplier-detail'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });

      router.push(`/suppliers/${supplierId}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record delivery receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isDirty = items.some((i) => i.quantityReceived && Number(i.quantityReceived) > 0) || Boolean(notes);
  const {
    showPrompt: showDiscardConfirm,
    setShowPrompt: setShowDiscardConfirm,
    confirmAction: confirmDiscard,
    guardedAction: guardedNavigate,
  } = useUnsavedChanges(isDirty);

  const handleCancel = () => {
    guardedNavigate(() => {
      router.push('/suppliers');
    });
  };

  if (user && user.role === 'STOCK_KEEPER') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-12">
        {/* Navigation Top Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancel}
              className="p-2 bg-white rounded-xl border border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#2C1B10] transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5 text-[#8C7361]" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">
                  {t('suppliers.title')}
                </span>
                <span className="text-[#8C7361]">/</span>
                <span className="text-xs font-semibold text-[#E87A18]">
                  {language === 'am' ? 'አዲስ ርክክብ' : language === 'om' ? 'Dhiyeessii Haaraa' : 'New Receipt'}
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10] flex items-center gap-2">
                <Truck className="w-6 h-6 text-[#E87A18]" />
                {t('suppliers.modalMultiDeliveryTitle')}
              </h1>
            </div>
          </div>

          <Button type="button" variant="outline" onClick={handleCancel} className="hidden sm:inline-flex">
            {t('common.cancel')}
          </Button>
        </div>

        {/* Main Delivery Receipt Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Card 1: Supplier & Receipt Metadata */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#2C1B10] flex items-center gap-2 border-b border-[#FAF6F0] pb-3">
              <Building2 className="w-4 h-4 text-[#E87A18]" />
              {language === 'am' ? 'የአቅራቢና የርክክብ መረጃ' : language === 'om' ? 'Oodeeffannoo Dhiyeessaa fi Nagahee' : 'Supplier & Delivery Information'}
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Supplier Selection */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                  {t('suppliers.colSupplierName')} <span className="text-red-500">*</span>
                </label>
                {isLoading ? (
                  <Skeleton className="h-10 w-full rounded-xl" />
                ) : (
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    required
                    className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-bold text-[#2C1B10] focus:ring-1 focus:ring-[#E87A18] focus:bg-white"
                  >
                    {suppliers.length === 0 && <option value="">No suppliers registered</option>}
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type}) {s.phone ? `— ${s.phone}` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Delivery Date */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                  {t('suppliers.colDeliveryDate')}
                </label>
                <div className="relative">
                  <Input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => setDeliveryDate(e.target.value)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-semibold pl-9 rounded-xl focus:bg-white"
                  />
                  <Calendar className="w-4 h-4 text-[#8C7361] absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              {/* Payment Source */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                  {t('suppliers.colPaidFrom')}
                </label>
                <div className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 flex items-center justify-between text-xs font-bold text-[#2C1B10]">
                  <span className="flex items-center gap-1.5">💵 {t('suppliers.paidSourceDailyCash')}</span>
                  <span className="text-[10px] font-normal text-[#8C7361]">
                    ({language === 'am' ? 'የቀን መዝገብ ገንዘብ' : language === 'om' ? 'Qarshii Guyyaa' : 'Daily Cash Drawer'})
                  </span>
                </div>
              </div>
            </div>

            {/* Notes / Reference */}
            <div>
              <label className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                {language === 'am' ? 'ተጨማሪ ማስታወሻ / የደረሰኝ ቁጥር' : language === 'om' ? 'Yaadannoo / Lakkoofsa Nagahee' : 'Notes / Invoice Reference'}
              </label>
              <Input
                placeholder="e.g., Invoice #INV-8821, Morning batch delivery"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs rounded-xl focus:bg-white"
              />
            </div>
          </div>

          {/* Card 2: Line Items Received */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#FAF6F0] pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-[#E87A18]" />
                  {t('suppliers.deliveryLineItems')} ({items.length})
                </h2>
                <p className="text-[11px] text-[#8C7361] mt-0.5">
                  {language === 'am' ? 'የተረከቧቸውን እቃዎችና ዋጋ ያስገቡ' : language === 'om' ? 'Meeshaalee fudhatanii fi gatii isaanii galchaa' : 'Enter received materials, quantities, and purchase costs'}
                </p>
              </div>

              <Button
                type="button"
                onClick={addRow}
                variant="outline"
                size="sm"
                className="border-[#E87A18] text-[#E87A18] hover:bg-amber-50 text-xs font-bold rounded-xl h-9 px-3 flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> {t('suppliers.btnAddProduct')}
              </Button>
            </div>

            {/* Desktop Table Header */}
            {isOwner ? (
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-[#FAF6F0] rounded-xl text-[11px] font-extrabold text-[#4A2E1B] border border-[#EDE4D5]">
                <div className="col-span-4">{t('common.product')}</div>
                <div className="col-span-2 text-center">{t('suppliers.colQtyReceived')}</div>
                <div className="col-span-2 text-center">{t('suppliers.colUnitCost')} ({t('common.currency')})</div>
                <div className="col-span-2 text-center">{t('stock.unitPriceLabel')}</div>
                <div className="col-span-1 text-right">{t('common.total')}</div>
                <div className="col-span-1 text-center">{t('common.delete')}</div>
              </div>
            ) : (
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-[#FAF6F0] rounded-xl text-[11px] font-extrabold text-[#4A2E1B] border border-[#EDE4D5]">
                <div className="col-span-5">{t('common.product')}</div>
                <div className="col-span-2 text-center">{t('suppliers.colQtyReceived')}</div>
                <div className="col-span-3 text-center">{t('suppliers.colUnitCost')} ({t('common.currency')})</div>
                <div className="col-span-1 text-right">{t('common.total')}</div>
                <div className="col-span-1 text-center">{t('common.delete')}</div>
              </div>
            )}

            {/* Line Items List */}
            <div className="space-y-3">
              {items.map((item, index) => {
                const lineSubtotal = (parseFloat(item.quantityReceived) || 0) * (parseFloat(item.unitBuyPrice) || 0);

                return (
                  <div
                    key={index}
                    className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-2 sm:rounded-xl shadow-2xs space-y-3 sm:space-y-0 hover:border-amber-300 transition-colors"
                  >
                    {/* Mobile Row Header */}
                    <div className="flex sm:hidden items-center justify-between pb-2 border-b border-[#FAF6F0]">
                      <span className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5">
                        <span className="w-5 h-5 rounded-full bg-[#FAF6F0] border border-[#EDE4D5] text-[#E87A18] text-[10px] font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        {t('common.product')} #{index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t('common.delete')}</span>
                      </button>
                    </div>

                    {/* Desktop & Mobile Responsive Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:items-center">
                      {/* Product Selector */}
                      <div className={isOwner ? "sm:col-span-4" : "sm:col-span-5"}>
                        <label className="text-[10px] font-bold text-[#8C7361] uppercase block sm:hidden mb-1">
                          {t('common.product')}
                        </label>
                        <select
                          value={item.productId}
                          onChange={(e) => updateRow(index, 'productId', e.target.value)}
                          className="w-full bg-[#FAF6F0] sm:bg-white border border-[#EDE4D5] rounded-xl sm:rounded-lg h-10 sm:h-9 text-xs px-2.5 font-medium text-[#2C1B10] focus:ring-1 focus:ring-[#E87A18]"
                        >
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.unitType})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Qty Received */}
                      <div className="sm:col-span-2">
                        <label className="text-[10px] font-bold text-[#8C7361] uppercase block sm:hidden mb-1">
                          {t('suppliers.colQtyReceived')}
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={item.quantityReceived}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateRow(index, 'quantityReceived', e.target.value)}
                          className="bg-[#FAF6F0] sm:bg-white border-[#EDE4D5] h-10 sm:h-9 text-xs font-mono font-bold text-center rounded-xl sm:rounded-md"
                        />
                      </div>

                      {/* Unit Buy Price */}
                      <div className={isOwner ? "sm:col-span-2" : "sm:col-span-3"}>
                        <label className="text-[10px] font-bold text-[#8C7361] uppercase block sm:hidden mb-1">
                          {t('suppliers.colUnitCost')} ({t('common.currency')})
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={item.unitBuyPrice}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => updateRow(index, 'unitBuyPrice', e.target.value)}
                          className="bg-[#FAF6F0] sm:bg-white border-[#EDE4D5] h-10 sm:h-9 text-xs font-mono text-center rounded-xl sm:rounded-md"
                        />
                      </div>

                      {/* Unit Sell Price (Owner only) */}
                      {isOwner && (
                        <div className="sm:col-span-2">
                          <label className="text-[10px] font-bold text-[#8C7361] uppercase block sm:hidden mb-1">
                            {t('stock.unitPriceLabel')}
                          </label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            value={item.unitSellPrice}
                            onFocus={(e) => e.target.select()}
                            onChange={(e) => updateRow(index, 'unitSellPrice', e.target.value)}
                            className="bg-[#FAF6F0] sm:bg-white border-[#EDE4D5] h-10 sm:h-9 text-xs font-mono font-bold text-[#E87A18] text-center rounded-xl sm:rounded-md"
                          />
                        </div>
                      )}

                      {/* Subtotal */}
                      <div className="sm:col-span-1 text-left sm:text-right">
                        <div className="flex sm:block items-center justify-between bg-[#FAF6F0] sm:bg-transparent p-2 sm:p-0 rounded-xl sm:rounded-none">
                          <span className="text-[10px] font-bold text-[#8C7361] uppercase block sm:hidden">
                            {t('common.total')}
                          </span>
                          <span className="font-mono font-black text-xs text-[#2C1B10]">
                            {lineSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Delete Action (Desktop) */}
                      <div className="hidden sm:flex col-span-1 items-center justify-center">
                        <button
                          type="button"
                          onClick={() => removeRow(index)}
                          className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                          title={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Card 3: Settlement & Flexible Partial Payment Terms */}
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-extrabold text-[#2C1B10] flex items-center gap-2 border-b border-[#FAF6F0] pb-3">
              <CreditCard className="w-4 h-4 text-[#E87A18]" />
              {language === 'am' ? 'የክፍያና የሂሳብ አከፋፈል ሁኔታ' : language === 'om' ? 'Haala Kaffaltii fi Qulqulleessaa' : 'Settlement & Payment Terms'}
            </h2>

            {/* Total Batch Cost Banner */}
            <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider block">
                  {t('suppliers.totalDeliveryBatchCost')}
                </span>
                <span className="text-xs text-[#8C7361]">
                  {items.filter((i) => i.productId && Number(i.quantityReceived) > 0).length} {t('common.items')}
                </span>
              </div>
              <div className="text-left sm:text-right">
                <span className="text-2xl sm:text-3xl font-black text-[#2C1B10] font-mono">
                  {totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-xs font-bold text-[#8C7361] ml-2">{t('common.currency')}</span>
              </div>
            </div>

            {/* Quick Payment Preset Buttons */}
            <div>
              <label className="text-xs font-bold text-[#4A2E1B] block mb-2">
                {language === 'am' ? 'የክፍያ አማራጭ ይምረጡ' : language === 'om' ? 'Filannoo Kaffaltii Filadhu' : 'Select Payment Option'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode('FULL')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'FULL'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/25'
                      : 'bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{t('suppliers.payFull')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('HALF')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'HALF'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-sm shadow-amber-600/25'
                      : 'bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <Percent className="w-3.5 h-3.5" />
                  <span>{t('suppliers.payHalf')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('ZERO')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'ZERO'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-sm shadow-rose-600/25'
                      : 'bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] hover:bg-rose-50 hover:border-rose-300'
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{t('suppliers.payLater')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMode('CUSTOM')}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 ${
                    paymentMode === 'CUSTOM'
                      ? 'bg-[#E87A18] text-white border-[#E87A18] shadow-sm shadow-[#E87A18]/25'
                      : 'bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] hover:bg-amber-50 hover:border-amber-300'
                  }`}
                >
                  <DollarSign className="w-3.5 h-3.5" />
                  <span>{language === 'am' ? 'ብጁ መጠን' : language === 'om' ? 'Hanga Ofii' : 'Custom Amount'}</span>
                </button>
              </div>
            </div>

            {/* Amount Paid Now & Remaining Balance in 2 Columns */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                  {t('suppliers.amountPaidNow')} ({t('common.currency')})
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalCost}
                    value={amountPaidNow}
                    onFocus={(e) => {
                      setPaymentMode('CUSTOM');
                      e.target.select();
                    }}
                    onChange={(e) => {
                      setPaymentMode('CUSTOM');
                      setAmountPaidNow(e.target.value);
                    }}
                    className="bg-white border-[#EDE4D5] h-11 text-base font-mono font-bold pl-9 rounded-xl focus:border-[#E87A18]"
                  />
                  <DollarSign className="w-4 h-4 text-[#8C7361] absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <span className="text-xs font-bold text-[#4A2E1B] block mb-1.5">
                  {t('suppliers.colRemainingBalance')} ({t('common.currency')})
                </span>
                <div className="h-11 px-4 bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8C7361]">{t('common.currency')}</span>
                  <span className={`text-base font-mono font-black ${
                    remainingBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                  }`}>
                    {remainingBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Live Payment Status Banner */}
            <div className="p-3.5 rounded-xl border flex items-center justify-between gap-3 text-xs bg-[#FAF6F0] border-[#EDE4D5]">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-[#8C7361] shrink-0" />
                <span className="font-semibold text-[#4A2E1B]">
                  {language === 'am' ? 'የክፍያ ሁኔታ ውጤት:' : language === 'om' ? "Bu'aa Haala Kaffaltii:" : 'Resulting Payment Status:'}
                </span>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black tracking-wide border shadow-2xs ${
                paymentStatusBadge === 'PAID'
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                  : paymentStatusBadge === 'PARTIAL'
                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                  : 'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {paymentStatusBadge === 'PAID'
                  ? `✓ ${t('suppliers.paidBadge')}`
                  : paymentStatusBadge === 'PARTIAL'
                  ? `⏳ ${t('suppliers.partialBadge')}`
                  : `⚠ ${t('suppliers.unpaidBadge')}`}
              </span>
            </div>
          </div>

          {/* Form Actions Footer */}
          <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={handleCancel}
              className="w-full sm:w-auto order-2 sm:order-1 h-12 px-6 rounded-xl font-bold"
            >
              {t('common.cancel')}
            </Button>
            <Button
              type="submit"
              variant="brand"
              size="lg"
              loading={isSubmitting}
              className="w-full sm:w-auto order-1 sm:order-2 h-12 px-8 rounded-xl font-black text-sm shadow-md shadow-[#E87A18]/20"
            >
              <Truck className="w-4 h-4 mr-2" />
              {t('suppliers.btnRecordDeliveries')}
            </Button>
          </div>
        </form>
      </div>

      <ConfirmModal
        isOpen={showDiscardConfirm}
        title={t('common.unsavedChanges') || 'Unsaved Changes'}
        description="You have entered delivery details. Are you sure you want to discard this delivery receipt?"
        confirmText={t('common.discardChanges') || 'Discard Changes'}
        cancelText={t('common.keepEditing') || 'Keep Editing'}
        variant="warning"
        onConfirm={() => {
          confirmDiscard();
          router.push('/suppliers');
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />
    </DashboardLayout>
  );
}

export default function NewDeliveryPage() {
  return (
    <Suspense
      fallback={
        <DashboardLayout>
          <div className="max-w-4xl mx-auto p-6 space-y-4">
            <Skeleton className="h-8 w-48 rounded-lg" />
            <Skeleton className="h-64 w-full rounded-2xl" />
          </div>
        </DashboardLayout>
      }
    >
      <NewDeliveryContent />
    </Suspense>
  );
}
