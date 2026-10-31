'use client';

import React, { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { formatEthDate } from '@/lib/ethiopianDate';
import {
  ArrowLeft,
  Truck,
  Plus,
  Phone,
  Building2,
  DollarSign,
  Clock,
  Calendar,
  Pencil,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  CreditCard,
  History,
  MapPin,
  User as UserIcon,
  FileText,
  Percent,
  Coins,
  ChevronRight,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';

interface SupplierPayment {
  id: string;
  amount: number | string;
  paymentSource: 'DAILY_CASH' | 'OWNER';
  notes?: string | null;
  createdAt: string;
}

interface DeliveryItem {
  id: string;
  supplierId: string;
  productId: string;
  product?: { id: string; name: string; nameLatin?: string | null; unitType: string };
  stockItemId?: string;
  stockItem?: { name: string; nameLatin?: string | null; unitType: string };
  quantityReceived: number;
  returnedQuantity: number;
  unitBuyPrice: number | string;
  unitSellPrice: number | string;
  paidAmount: number | string;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
  isPaid: boolean;
  paymentSource: 'DAILY_CASH' | 'OWNER';
  notes?: string | null;
  createdAt: string;
  payments?: SupplierPayment[];
}

interface SupplierDetail {
  id: string;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  notes?: string | null;
  type: 'MILK' | 'INJERA' | 'GENERAL';
  branchId: string;
  branch?: { id: string; name: string };
  createdAt: string;
  deliveries: DeliveryItem[];
  stats: {
    totalDeliveries: number;
    totalPurchases: number;
    totalPaid: number;
    totalBalanceDue: number;
    paidCount: number;
    partialCount: number;
    pendingCount: number;
  };
}

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const { branches } = useBranch();
  const { t, language, getItemName } = useLanguage();
  const queryClient = useQueryClient();
  const isOwner = user?.role === 'OWNER';

  // Status Filter State
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIAL' | 'PAID'>('ALL');

  // Modals State
  const [isEditSupplierOpen, setIsEditSupplierOpen] = useState(false);
  const [isDeleteSupplierOpen, setIsDeleteSupplierOpen] = useState(false);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // Delivery Edit Modal
  const [editingDelivery, setEditingDelivery] = useState<DeliveryItem | null>(null);
  const [isSubmittingDeliveryEdit, setIsSubmittingDeliveryEdit] = useState(false);

  // Delivery Delete Modal
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false);

  // Payment Recording Modal
  const [paymentDelivery, setPaymentDelivery] = useState<DeliveryItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState<'DAILY_CASH' | 'OWNER'>('DAILY_CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // View Payments History Modal
  const [historyDelivery, setHistoryDelivery] = useState<DeliveryItem | null>(null);

  // Fetch Supplier Detail
  const { data: supplier, isLoading, error } = useQuery<SupplierDetail>({
    queryKey: ['supplier-detail', id],
    queryFn: async () => {
      const res = await api.get(`/suppliers/${id}`);
      return res.data;
    },
  });

  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'CASHIER';

  // Filter deliveries
  const filteredDeliveries = useMemo(() => {
    if (!supplier?.deliveries) return [];
    if (statusFilter === 'ALL') return supplier.deliveries;
    if (statusFilter === 'PAID') {
      return supplier.deliveries.filter((d) => {
        const net = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
        const cost = net * Number(d.unitBuyPrice);
        const paid = Number(d.paidAmount || 0);
        return d.paymentStatus === 'PAID' || (cost - paid) <= 0.001;
      });
    }
    if (statusFilter === 'PARTIAL') {
      return supplier.deliveries.filter((d) => {
        const net = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
        const cost = net * Number(d.unitBuyPrice);
        const paid = Number(d.paidAmount || 0);
        return paid > 0 && (cost - paid) > 0.001;
      });
    }
    if (statusFilter === 'UNPAID') {
      return supplier.deliveries.filter((d) => {
        const net = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
        const cost = net * Number(d.unitBuyPrice);
        const paid = Number(d.paidAmount || 0);
        return (cost - paid) > 0.001;
      });
    }
    return supplier.deliveries;
  }, [supplier?.deliveries, statusFilter]);

  // Edit Supplier Form Handler
  const handleUpdateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim() || null,
      contactPerson: String(formData.get('contactPerson') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      notes: String(formData.get('notes') || '').trim() || null,
      type: String(formData.get('type') || supplier?.type || 'GENERAL').toUpperCase(),
    };

    try {
      await api.patch(`/suppliers/${id}`, data);
      toast.success('Supplier profile updated successfully');
      setIsEditSupplierOpen(false);
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update supplier');
    }
  };

  // Delete Supplier Handler
  const handleDeleteSupplier = async () => {
    setIsDeletingSupplier(true);
    try {
      await api.delete(`/suppliers/${id}`);
      toast.success('Supplier removed successfully');
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      router.push('/suppliers');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete supplier');
    } finally {
      setIsDeletingSupplier(false);
      setIsDeleteSupplierOpen(false);
    }
  };

  // Edit Delivery Handler
  const handleUpdateDelivery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDelivery) return;

    setIsSubmittingDeliveryEdit(true);
    const formData = new FormData(e.currentTarget);

    const payload: any = {
      quantityReceived: Number(formData.get('quantityReceived')),
      returnedQuantity: Number(formData.get('returnedQuantity') || 0),
      unitBuyPrice: Number(formData.get('unitBuyPrice')),
      paidAmount: Number(formData.get('paidAmount') || 0),
      paymentSource: formData.get('paymentSource'),
      notes: String(formData.get('notes') || '').trim() || null,
    };
    if (isOwner && formData.get('unitSellPrice') !== null) {
      payload.unitSellPrice = Number(formData.get('unitSellPrice') || 0);
    }

    try {
      await api.patch(`/supplier-deliveries/${editingDelivery.id}`, payload);
      toast.success('Delivery receipt updated successfully');
      setEditingDelivery(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update delivery');
    } finally {
      setIsSubmittingDeliveryEdit(false);
    }
  };

  // Delete Delivery Handler
  const handleDeleteDelivery = async () => {
    if (!deletingDeliveryId) return;
    setIsDeletingDelivery(true);
    try {
      await api.delete(`/supplier-deliveries/${deletingDeliveryId}`);
      toast.success('Delivery receipt deleted successfully');
      setDeletingDeliveryId(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete delivery receipt');
    } finally {
      setIsDeletingDelivery(false);
    }
  };

  // Record Payment Handler
  const handleOpenRecordPayment = (delivery: DeliveryItem) => {
    const netQty = Math.max(0, delivery.quantityReceived - delivery.returnedQuantity);
    const cost = Number((netQty * Number(delivery.unitBuyPrice)).toFixed(2));
    const paid = Number(Number(delivery.paidAmount || 0).toFixed(2));
    const rem = Math.max(0, Number((cost - paid).toFixed(2)));

    setPaymentDelivery(delivery);
    setPaymentAmount(rem.toFixed(2));
    setPaymentSource('DAILY_CASH');
    setPaymentNotes('');
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDelivery) return;

    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid payment amount greater than 0');
      return;
    }

    const netQty = Math.max(0, paymentDelivery.quantityReceived - paymentDelivery.returnedQuantity);
    const cost = Number((netQty * Number(paymentDelivery.unitBuyPrice)).toFixed(2));
    const paid = Number(Number(paymentDelivery.paidAmount || 0).toFixed(2));
    const rem = Math.max(0, Number((cost - paid).toFixed(2)));
    const finalAmount = Math.min(amountNum, rem);

    setIsRecordingPayment(true);
    try {
      await api.post(`/supplier-deliveries/${paymentDelivery.id}/payments`, {
        amount: finalAmount,
        paymentSource,
        notes: paymentNotes.trim() || undefined,
      });

      toast.success('Payment recorded successfully!');
      setPaymentDelivery(null);
      queryClient.invalidateQueries({ queryKey: ['supplier-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-60 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !supplier) {
    return (
      <DashboardLayout>
        <div className="text-center py-16 space-y-4">
          <p className="text-rose-600 font-bold">Supplier record not found or inaccessible.</p>
          <Link href="/suppliers">
            <Button variant="outline">Back to Suppliers</Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  const assignedBranch = branches.find((b) => b.id === supplier.branchId)?.name || supplier.branch?.name || 'Main Branch';
  const stats = supplier.stats || {
    totalDeliveries: supplier.deliveries.length,
    totalPurchases: 0,
    totalPaid: 0,
    totalBalanceDue: 0,
    paidCount: 0,
    partialCount: 0,
    pendingCount: 0,
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-12">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href="/suppliers"
              className="p-2 bg-white rounded-xl border border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#2C1B10] transition-colors shadow-2xs"
            >
              <ArrowLeft className="w-5 h-5 text-[#8C7361]" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#8C7361] uppercase tracking-wider">
                  {t('suppliers.title')}
                </span>
                <span className="text-[#8C7361]">/</span>
                <span className="text-xs font-semibold text-[#E87A18]">
                  {t('suppliers.supplierDetails')}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <h1 className="text-xl sm:text-2xl font-black text-[#2C1B10]">{supplier.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                  {supplier.type}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {canManage && (
              <>
                <Button
                  onClick={() => setIsEditSupplierOpen(true)}
                  variant="outline"
                  size="default"
                  className="rounded-xl font-bold flex items-center gap-1.5"
                >
                  <Pencil className="w-4 h-4 text-[#8C7361]" />
                  <span>{t('suppliers.editSupplier')}</span>
                </Button>

                <Button
                  onClick={() => setIsDeleteSupplierOpen(true)}
                  variant="outline"
                  size="default"
                  className="rounded-xl font-bold text-red-600 border-red-200 hover:bg-red-50 flex items-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>{t('suppliers.deleteSupplier')}</span>
                </Button>
              </>
            )}

            <Link href={`/suppliers/deliveries/new?supplierId=${supplier.id}`}>
              <Button size="default" variant="brand" className="rounded-xl font-bold flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                <span>{t('suppliers.logDeliveryReceipt')}</span>
              </Button>
            </Link>
          </div>
        </div>

        {/* Profile Card & Financial Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Supplier Info Overview Box */}
          <div className="lg:col-span-1 bg-white border border-[#EDE4D5] rounded-2xl p-5 shadow-xs space-y-3.5">
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#8C7361] border-b border-[#FAF6F0] pb-2">
              {language === 'am' ? 'የአቅራቢ መረጃ' : language === 'om' ? 'Oodeeffannoo Dhiyeessaa' : 'Supplier Profile'}
            </h2>

            <div className="space-y-2.5 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-[#B09987] block">{t('suppliers.colPhone')}</span>
                {supplier.phone ? (
                  <a href={`tel:${supplier.phone}`} className="font-bold text-[#E87A18] hover:underline inline-flex items-center gap-1 mt-0.5">
                    <Phone className="w-3.5 h-3.5" /> {supplier.phone}
                  </a>
                ) : (
                  <span className="text-zinc-400 mt-0.5 block">—</span>
                )}
              </div>

              {supplier.contactPerson && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#B09987] block">
                    {language === 'am' ? 'ተጠሪ ሰው' : language === 'om' ? 'Nama Quunnamtii' : 'Contact Person'}
                  </span>
                  <span className="font-semibold text-[#2C1B10] inline-flex items-center gap-1 mt-0.5">
                    <UserIcon className="w-3.5 h-3.5 text-[#8C7361]" /> {supplier.contactPerson}
                  </span>
                </div>
              )}

              {supplier.address && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#B09987] block">
                    {language === 'am' ? 'አድራሻ' : language === 'om' ? 'Teessoo' : 'Address'}
                  </span>
                  <span className="font-semibold text-[#4A2E1B] inline-flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-[#8C7361]" /> {supplier.address}
                  </span>
                </div>
              )}

              <div>
                <span className="text-[10px] uppercase font-bold text-[#B09987] block">{t('branches.title')}</span>
                <span className="font-semibold text-[#4A2E1B] inline-flex items-center gap-1 mt-0.5">
                  <Building2 className="w-3.5 h-3.5 text-[#8C7361]" /> {assignedBranch}
                </span>
              </div>

              {supplier.notes && (
                <div className="pt-2 border-t border-[#FAF6F0]">
                  <span className="text-[10px] uppercase font-bold text-[#B09987] block">
                    {language === 'am' ? 'ማስታወሻ' : language === 'om' ? 'Yaadannoo' : 'Notes'}
                  </span>
                  <p className="text-[#8C7361] mt-0.5 italic">{supplier.notes}</p>
                </div>
              )}

              {/* Compact Mobile Financial Summary (hidden on desktop, shown on mobile for clarity) */}
              <div className="md:hidden pt-3 border-t border-[#EDE4D5] space-y-2">
                <span className="text-[10px] uppercase font-bold text-[#8C7361] tracking-wider block">
                  {language === 'am' ? 'የክፍያና ርክክብ ማጠቃለያ' : language === 'om' ? 'Cuunfaa Kaffaltii' : 'Financial Summary'}
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#FAF6F0] p-2 rounded-xl border border-[#EDE4D5]">
                    <span className="text-[9px] font-bold text-[#8C7361] uppercase block truncate">{t('suppliers.totalReceipts')}</span>
                    <p className="text-base font-black text-[#2C1B10] mt-0.5">{stats.totalDeliveries}</p>
                    <span className="text-[9px] text-[#8C7361] font-semibold block">{stats.paidCount} {t('suppliers.paidBadge').toLowerCase()}</span>
                  </div>

                  <div className="bg-emerald-50/70 p-2 rounded-xl border border-emerald-200">
                    <span className="text-[9px] font-bold text-emerald-800 uppercase block truncate">{t('suppliers.colPaidAmount')}</span>
                    <p className="text-sm font-black text-emerald-700 mt-0.5 truncate">
                      {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                    </p>
                    <span className="text-[9px] text-emerald-600 font-semibold block">{t('common.currency')}</span>
                  </div>

                  <div className={`p-2 rounded-xl border ${stats.totalBalanceDue > 0 ? 'bg-amber-50 border-amber-300' : 'bg-[#FAF6F0] border-[#EDE4D5]'}`}>
                    <span className={`text-[9px] font-bold uppercase block truncate ${stats.totalBalanceDue > 0 ? 'text-amber-800' : 'text-[#8C7361]'}`}>
                      {language === 'am' ? 'ቀሪ' : language === 'om' ? 'Haftee' : 'Balance'}
                    </span>
                    <p className={`text-sm font-black mt-0.5 truncate ${stats.totalBalanceDue > 0 ? 'text-amber-800' : 'text-[#2C1B10]'}`}>
                      {stats.totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 1 })}
                    </p>
                    <span className={`text-[9px] font-bold block ${stats.totalBalanceDue > 0 ? 'text-amber-700' : 'text-[#8C7361]'}`}>
                      {stats.totalBalanceDue > 0 ? `${stats.pendingCount + stats.partialCount} due` : 'Settled ✓'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3 Financial KPI Cards (Visible on desktop, hidden on mobile) */}
          <div className="hidden md:grid lg:col-span-3 grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Total Receipts */}
            <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#8C7361] uppercase truncate">{t('suppliers.totalReceipts')}</p>
                <h3 className="text-2xl font-black text-[#2C1B10] mt-1">{stats.totalDeliveries}</h3>
                <span className="text-[11px] font-semibold text-[#8C7361] mt-0.5 block">
                  {stats.paidCount} {t('suppliers.paidBadge').toLowerCase()}
                </span>
              </div>
              <div className="p-3 bg-[#FAF6F0] rounded-xl"><Truck className="w-6 h-6 text-[#E87A18]" /></div>
            </div>

            {/* Total Paid Amount */}
            <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-[#8C7361] uppercase truncate">{t('suppliers.colPaidAmount')}</p>
                <h3 className="text-xl sm:text-2xl font-black text-emerald-700 mt-1">
                  {stats.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[11px] font-semibold text-[#8C7361] mt-0.5 block">
                  {t('common.currency')}
                </span>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
            </div>

            {/* Outstanding Balance Due */}
            <div className={`p-4 rounded-2xl border shadow-xs flex items-center justify-between ${
              stats.totalBalanceDue > 0
                ? 'bg-amber-50/60 border-amber-200'
                : 'bg-white border-[#EDE4D5]'
            }`}>
              <div>
                <p className="text-xs font-bold text-amber-800 uppercase truncate">
                  {language === 'am' ? 'የሚከፈል ቀሪ ሂሳብ' : language === 'om' ? 'Haftee Kaffalamu' : 'Outstanding Balance Due'}
                </p>
                <h3 className={`text-xl sm:text-2xl font-black mt-1 ${
                  stats.totalBalanceDue > 0 ? 'text-amber-800' : 'text-[#2C1B10]'
                }`}>
                  {stats.totalBalanceDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h3>
                <span className="text-[11px] font-bold text-amber-700 mt-0.5 block">
                  {stats.totalBalanceDue > 0
                    ? `${stats.pendingCount + stats.partialCount} unsettled delivery(s)`
                    : 'All settled! ✓'}
                </span>
              </div>
              <div className="p-3 bg-amber-100 rounded-xl">
                <DollarSign className="w-6 h-6 text-amber-700" />
              </div>
            </div>
          </div>
        </div>

        {/* Deliveries Ledger & Filter Section */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
          {/* Header with Filter Pills */}
          <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-extrabold text-[#2C1B10] text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E87A18]" />
              {language === 'am' ? 'የርክክብና የክፍያ ታሪክ' : language === 'om' ? 'Seenaa Dhiyeessii fi Kaffaltii' : 'Delivery Receipts & Ledger'} ({filteredDeliveries.length})
            </h2>

            {/* Status Filter Tabs */}
            <div className="w-full sm:w-auto overflow-x-auto scrollbar-none pb-0.5 sm:pb-0">
              <div className="inline-flex items-center gap-1.5 bg-[#F4ECE1] p-1 rounded-xl border border-[#EDE4D5] min-w-max">
                {(['ALL', 'UNPAID', 'PARTIAL', 'PAID'] as const).map((tab) => {
                  const count =
                    tab === 'ALL'
                      ? supplier.deliveries.length
                      : tab === 'UNPAID'
                      ? stats.pendingCount
                      : tab === 'PARTIAL'
                      ? stats.partialCount
                      : stats.paidCount;

                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 whitespace-nowrap ${
                        statusFilter === tab
                          ? 'bg-[#E87A18] text-white shadow-2xs'
                          : 'text-[#8C7361] hover:text-[#4A2E1B]'
                      }`}
                    >
                      <span>
                        {tab === 'ALL'
                          ? t('common.all') || 'All'
                          : tab === 'UNPAID'
                          ? t('suppliers.unpaidBadge')
                          : tab === 'PARTIAL'
                          ? t('suppliers.partialBadge')
                          : t('suppliers.paidBadge')}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                        statusFilter === tab ? 'bg-white/25 text-white' : 'bg-[#E0D5C3] text-[#4A2E1B]'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Desktop Deliveries Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('suppliers.colDeliveryDate')}</TableHead>
                  <TableHead>{t('stockMovements.colMaterial')}</TableHead>
                  <TableHead className="text-center">{t('suppliers.colQtyReceived')}</TableHead>
                  <TableHead className="text-right">{t('suppliers.colUnitCost')}</TableHead>
                  <TableHead className="text-right">{t('suppliers.colTotalCost')}</TableHead>
                  <TableHead className="text-right">{t('suppliers.colPaidAmount')}</TableHead>
                  <TableHead className="text-right">{t('suppliers.colRemainingBalance')}</TableHead>
                  <TableHead>{t('suppliers.colPaidFrom')}</TableHead>
                  <TableHead className="text-center">{t('suppliers.colPaymentStatus')}</TableHead>
                  <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDeliveries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-10 text-[#8C7361]">
                      {language === 'am' ? 'ምንም ርክክቦች አልተገኙም' : language === 'om' ? 'Dhiyeessiin hin argamne' : 'No delivery records match this filter.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDeliveries.map((d) => {
                    const netQty = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                    const totalCost = Number((netQty * Number(d.unitBuyPrice)).toFixed(2));
                    const paid = Number(Number(d.paidAmount || 0).toFixed(2));
                    const remBalance = Math.max(0, Number((totalCost - paid).toFixed(2)));
                    const isFullyPaid = remBalance <= 0.001 || d.paymentStatus === 'PAID';
                    const isPartial = !isFullyPaid && paid > 0;

                    return (
                      <TableRow key={d.id} className="hover:bg-[#FAF6F0]/40">
                        {/* Date */}
                        <TableCell className="text-xs font-semibold text-[#8C7361]">
                          {formatEthDate(d.createdAt)}
                        </TableCell>

                        {/* Product */}
                        <TableCell className="font-extrabold text-[#2C1B10]">
                          {getItemName(d.product) || getItemName(d.stockItem) || 'Raw Material'}
                          {d.notes && <span className="block text-[11px] font-normal text-[#8C7361]">{d.notes}</span>}
                        </TableCell>

                        {/* Qty */}
                        <TableCell className="text-center font-bold text-[#2C1B10]">
                          {d.quantityReceived}
                          {d.returnedQuantity > 0 && (
                            <span className="text-[10px] text-red-600 block">(-{d.returnedQuantity} ret)</span>
                          )}
                        </TableCell>

                        {/* Unit Cost */}
                        <TableCell className="text-right text-xs font-mono font-semibold text-[#8C7361]">
                          {Number(d.unitBuyPrice).toFixed(2)}
                        </TableCell>

                        {/* Total Cost */}
                        <TableCell className="text-right font-black font-mono text-[#2C1B10]">
                          {totalCost.toFixed(2)}
                        </TableCell>

                        {/* Paid Amount */}
                        <TableCell className="text-right font-black font-mono text-emerald-700">
                          {paid.toFixed(2)}
                        </TableCell>

                        {/* Remaining Balance */}
                        <TableCell className={`text-right font-black font-mono ${
                          remBalance > 0 ? 'text-rose-700' : 'text-emerald-700'
                        }`}>
                          {remBalance.toFixed(2)}
                        </TableCell>

                        {/* Paid From */}
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            d.paymentSource === 'OWNER'
                              ? 'bg-purple-100 text-purple-800 border-purple-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}>
                            {d.paymentSource === 'OWNER' ? t('suppliers.paidSourceOwner') : t('suppliers.paidSourceDailyCash')}
                          </span>
                        </TableCell>

                        {/* Payment Status Badge */}
                        <TableCell className="text-center">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                            isFullyPaid
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isPartial
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-rose-100 text-rose-800 border-rose-300'
                          }`}>
                            {isFullyPaid
                              ? `✓ ${t('suppliers.paidBadge')}`
                              : isPartial
                              ? `⏳ ${t('suppliers.partialBadge')}`
                              : `⚠ ${t('suppliers.unpaidBadge')}`}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className="text-right pr-6">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Pay Installment Button */}
                            {remBalance > 0 && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenRecordPayment(d)}
                                className="h-8 px-2.5 rounded-lg text-xs font-bold border-[#E87A18] text-[#E87A18] hover:bg-amber-50"
                              >
                                <DollarSign className="w-3.5 h-3.5 mr-1" />
                                {t('suppliers.recordPayment')}
                              </Button>
                            )}

                            {/* View Payments History */}
                            {d.payments && d.payments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setHistoryDelivery(d)}
                                className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg transition-colors"
                                title="View payment history"
                              >
                                <History className="w-4 h-4" />
                              </button>
                            )}

                            {/* Edit Delivery */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setEditingDelivery(d)}
                                className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg transition-colors"
                                title={t('suppliers.editDelivery')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                            )}

                            {/* Delete Delivery */}
                            {canManage && (
                              <button
                                type="button"
                                onClick={() => setDeletingDeliveryId(d.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('suppliers.deleteDelivery')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Deliveries Cards View */}
          <div className="block md:hidden p-3 space-y-3">
            {filteredDeliveries.length === 0 ? (
              <p className="text-center py-8 text-xs text-[#8C7361]">
                {language === 'am' ? 'ምንም ርክክቦች አልተገኙም' : language === 'om' ? 'Dhiyeessiin hin argamne' : 'No delivery records match this filter.'}
              </p>
            ) : (
              filteredDeliveries.map((d) => {
                const netQty = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                const totalCost = netQty * Number(d.unitBuyPrice);
                const paid = d.isPaid && Number(d.paidAmount) === 0 ? totalCost : Number(d.paidAmount);
                const remBalance = Math.max(0, totalCost - paid);
                const isFullyPaid = d.paymentStatus === 'PAID' || d.isPaid;
                const isPartial = d.paymentStatus === 'PARTIAL' || (!isFullyPaid && paid > 0);

                return (
                  <div
                    key={d.id}
                    className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3 hover:border-amber-300 transition-colors"
                  >
                    {/* Top Row: Date, Status Badge */}
                    <div className="flex items-center justify-between pb-2.5 border-b border-[#FAF6F0]">
                      <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                        <Clock className="w-3.5 h-3.5 text-[#E87A18]" />
                        <span className="font-bold text-[#4A2E1B]">
                          {formatEthDate(d.createdAt)}
                        </span>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shadow-2xs ${
                        isFullyPaid
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : isPartial
                          ? 'bg-amber-100 text-amber-800 border-amber-300'
                          : 'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {isFullyPaid
                          ? `✓ ${t('suppliers.paidBadge')}`
                          : isPartial
                          ? `⏳ ${t('suppliers.partialBadge')}`
                          : `⚠ ${t('suppliers.unpaidBadge')}`}
                      </span>
                    </div>

                    {/* Product & Notes */}
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8C7361]">{t('stockMovements.colMaterial')}</span>
                        <h4 className="font-extrabold text-[#2C1B10] text-sm">
                          {getItemName(d.product) || getItemName(d.stockItem) || 'Raw Material'}
                        </h4>
                        {d.notes && <p className="text-xs text-[#8C7361] mt-0.5">{d.notes}</p>}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                        d.paymentSource === 'OWNER'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}>
                        {d.paymentSource === 'OWNER' ? t('suppliers.paidSourceOwner') : t('suppliers.paidSourceDailyCash')}
                      </span>
                    </div>

                    {/* Numbers: Qty, Unit Cost, Total Cost */}
                    <div className="grid grid-cols-3 gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t('suppliers.colQtyReceived')}</span>
                        <span className="font-extrabold text-[#2C1B10] font-mono text-xs block mt-0.5">
                          {d.quantityReceived} {d.product?.unitType || ''}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t('suppliers.colUnitCost')}</span>
                        <span className="font-semibold text-[#8C7361] font-mono text-xs block mt-0.5">
                          {Number(d.unitBuyPrice).toFixed(2)}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t('suppliers.colTotalCost')}</span>
                        <span className="font-black text-[#2C1B10] font-mono text-xs block mt-0.5">
                          {totalCost.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Paid vs Remaining Breakdown */}
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#FAF6F0]">
                      <div>
                        <span className="text-[10px] text-[#8C7361] block uppercase font-bold">{t('suppliers.colPaidAmount')}</span>
                        <span className="font-black text-emerald-700 font-mono">{paid.toFixed(2)} {t('common.currency')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#8C7361] block uppercase font-bold">{t('suppliers.colRemainingBalance')}</span>
                        <span className={`font-black font-mono ${remBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {remBalance.toFixed(2)} {t('common.currency')}
                        </span>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-[#FAF6F0] gap-2">
                      <div className="flex items-center gap-1">
                        {d.payments && d.payments.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setHistoryDelivery(d)}
                            className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg text-xs font-semibold flex items-center gap-1"
                          >
                            <History className="w-3.5 h-3.5" />
                            <span>{d.payments.length} pay</span>
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setEditingDelivery(d)}
                            className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg"
                            title={t('suppliers.editDelivery')}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={() => setDeletingDeliveryId(d.id)}
                            className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title={t('suppliers.deleteDelivery')}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {remBalance > 0 && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenRecordPayment(d)}
                          className="h-8 px-3 rounded-lg text-xs font-bold bg-[#E87A18] hover:bg-[#D06B10] text-white"
                        >
                          <DollarSign className="w-3.5 h-3.5 mr-1" />
                          {t('suppliers.recordPayment')}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Edit Supplier Modal */}
      {isEditSupplierOpen && (
        <Dialog open={true} onOpenChange={() => setIsEditSupplierOpen(false)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold">{t('suppliers.editSupplier')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateSupplier} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colSupplierName')}</label>
                <Input name="name" defaultValue={supplier.name} required className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colPhone')}</label>
                <Input name="phone" defaultValue={supplier.phone || ''} placeholder="0911223344" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'ተጠሪ ሰው' : language === 'om' ? 'Nama Quunnamtii' : 'Contact Person'}
                </label>
                <Input name="contactPerson" defaultValue={supplier.contactPerson || ''} placeholder="e.g., Ato Kebede" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'አድራሻ' : language === 'om' ? 'Teessoo' : 'Address'}
                </label>
                <Input name="address" defaultValue={supplier.address || ''} placeholder="e.g., Bole, Addis Ababa" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colType')}</label>
                <select name="type" defaultValue={supplier.type} className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs">
                  <option value="GENERAL">GENERAL SUPPLIER</option>
                  <option value="MILK">MILK SUPPLIER</option>
                  <option value="INJERA">INJERA SUPPLIER</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'ማስታወሻ' : language === 'om' ? 'Yaadannoo' : 'Notes'}
                </label>
                <Input name="notes" defaultValue={supplier.notes || ''} placeholder="Optional notes" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditSupplierOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="brand">
                  {t('common.saveChanges') || 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Supplier Confirm Modal */}
      <ConfirmModal
        isOpen={isDeleteSupplierOpen}
        title={t('suppliers.deleteSupplier')}
        description={`Are you sure you want to delete "${supplier.name}"? This action cannot be undone.`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={isDeletingSupplier}
        onConfirm={handleDeleteSupplier}
        onCancel={() => setIsDeleteSupplierOpen(false)}
      />

      {/* Delete Delivery Confirm Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingDeliveryId)}
        title={t('suppliers.deleteDelivery')}
        description="Are you sure you want to delete this delivery receipt? Any linked payment history will also be removed."
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={isDeletingDelivery}
        onConfirm={handleDeleteDelivery}
        onCancel={() => setDeletingDeliveryId(null)}
      />

      {/* Edit Delivery Receipt Modal */}
      {editingDelivery && (
        <Dialog open={true} onOpenChange={() => setEditingDelivery(null)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#E87A18]" />
                {t('suppliers.editDelivery')}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateDelivery} className="space-y-3.5 py-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colQtyReceived')}</label>
                  <Input
                    name="quantityReceived"
                    type="number"
                    required
                    defaultValue={editingDelivery.quantityReceived}
                    className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Returned Qty</label>
                  <Input
                    name="returnedQuantity"
                    type="number"
                    defaultValue={editingDelivery.returnedQuantity}
                    className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono"
                  />
                </div>
              </div>

              <div className={isOwner ? "grid grid-cols-2 gap-3" : ""}>
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colUnitCost')}</label>
                  <Input
                    name="unitBuyPrice"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={Number(editingDelivery.unitBuyPrice)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono"
                  />
                </div>
                {isOwner && (
                  <div>
                    <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('stock.unitPriceLabel')}</label>
                    <Input
                      name="unitSellPrice"
                      type="number"
                      step="0.01"
                      defaultValue={Number(editingDelivery.unitSellPrice || 0)}
                      className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono text-[#E87A18]"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colPaidAmount')}</label>
                  <Input
                    name="paidAmount"
                    type="number"
                    step="0.01"
                    defaultValue={Number(editingDelivery.paidAmount)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs font-mono font-bold text-emerald-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colPaidFrom')}</label>
                  <div className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 flex items-center text-xs font-bold text-[#2C1B10]">
                    💵 {t('suppliers.paidSourceDailyCash')}
                  </div>
                  <input type="hidden" name="paymentSource" value="DAILY_CASH" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Notes</label>
                <Input
                  name="notes"
                  defaultValue={editingDelivery.notes || ''}
                  placeholder="Optional delivery notes"
                  className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingDelivery(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="brand" loading={isSubmittingDeliveryEdit}>
                  {t('common.saveChanges') || 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Record Payment Installment Modal */}
      {paymentDelivery && (
        <Dialog open={true} onOpenChange={() => setPaymentDelivery(null)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#E87A18]" />
                {t('suppliers.recordPayment')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmitPayment} className="space-y-4 py-2">
              <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-[#8C7361]">{t('stockMovements.colMaterial')}:</span>
                  <span className="font-bold text-[#2C1B10]">{paymentDelivery.product?.name || 'Raw Material'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361]">{t('suppliers.colTotalCost')}:</span>
                  <span className="font-mono font-bold text-[#2C1B10]">
                    {(Math.max(0, paymentDelivery.quantityReceived - paymentDelivery.returnedQuantity) * Number(paymentDelivery.unitBuyPrice)).toFixed(2)} {t('common.currency')}
                  </span>
                </div>
                <div className="flex justify-between border-t border-[#EDE4D5] pt-1">
                  <span className="text-[#8C7361]">{t('suppliers.colRemainingBalance')}:</span>
                  <span className="font-mono font-black text-rose-700">
                    {(Math.max(0, paymentDelivery.quantityReceived - paymentDelivery.returnedQuantity) * Number(paymentDelivery.unitBuyPrice) - Number(paymentDelivery.paidAmount)).toFixed(2)} {t('common.currency')}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1.5 block">
                  {language === 'am' ? 'የሚከፈል የገንዘብ መጠን' : language === 'om' ? 'Hanga Kaffaltii' : 'Payment Amount'} ({t('common.currency')})
                </label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    className="bg-white border-[#EDE4D5] h-11 text-base font-mono font-bold pl-9 rounded-xl focus:border-[#E87A18]"
                  />
                  <DollarSign className="w-4 h-4 text-[#8C7361] absolute left-3 top-3.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1.5 block">{t('suppliers.colPaidFrom')}</label>
                <div className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 flex items-center text-xs font-bold text-[#2C1B10]">
                  💵 {t('suppliers.paidSourceDailyCash')}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1.5 block">
                  {language === 'am' ? 'ማስታወሻ' : language === 'om' ? 'Yaadannoo' : 'Payment Note'}
                </label>
                <Input
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="e.g., Paid via Telebirr or Cash installment"
                  className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs rounded-xl"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setPaymentDelivery(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="brand" loading={isRecordingPayment}>
                  {t('suppliers.recordPayment')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Payment History Dialog */}
      {historyDelivery && (
        <Dialog open={true} onOpenChange={() => setHistoryDelivery(null)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold flex items-center gap-2">
                <History className="w-5 h-5 text-[#E87A18]" />
                {language === 'am' ? 'የክፍያ ክፍተቶች ታሪክ' : language === 'om' ? 'Seenaa Kaffaltii' : 'Payment Installment History'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-2 max-h-80 overflow-y-auto">
              {!historyDelivery.payments || historyDelivery.payments.length === 0 ? (
                <p className="text-xs text-[#8C7361] text-center py-6">No payment history recorded.</p>
              ) : (
                historyDelivery.payments.map((p, idx) => (
                  <div key={p.id || idx} className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-extrabold text-[#2C1B10] block font-mono text-sm">
                        {Number(p.amount).toFixed(2)} {t('common.currency')}
                      </span>
                      <span className="text-[11px] text-[#8C7361] mt-0.5 block">
                        {formatEthDate(p.createdAt, true)}
                      </span>
                      {p.notes && <span className="text-[11px] text-[#4A2E1B] block mt-0.5 italic">{p.notes}</span>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      p.paymentSource === 'OWNER'
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {p.paymentSource === 'OWNER' ? t('suppliers.paidSourceOwner') : t('suppliers.paidSourceDailyCash')}
                    </span>
                  </div>
                ))
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setHistoryDelivery(null)}>
                {t('common.close') || 'Close'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
