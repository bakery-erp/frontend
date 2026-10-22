'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import {
  Truck,
  Plus,
  CheckCircle2,
  DollarSign,
  PackageCheck,
  Trash2,
  Clock,
  Phone,
  Pencil,
  ChevronRight,
  CreditCard,
  Building2,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PaginationControls } from '@/components/ui/PaginationControls';

interface SupplierStats {
  totalDeliveries: number;
  totalPurchases: number;
  totalPaid: number;
  totalBalanceDue: number;
  unpaidCount: number;
}

interface Supplier {
  id: string;
  name: string;
  phone?: string | null;
  contactPerson?: string | null;
  address?: string | null;
  notes?: string | null;
  type: 'MILK' | 'INJERA' | 'GENERAL';
  branchId: string;
  branch?: { id: string; name: string };
  _count?: { deliveries: number };
  stats?: SupplierStats;
}

interface SupplierDelivery {
  id: string;
  supplierId: string;
  supplier?: { id: string; name: string; type: string };
  productId?: string;
  product?: { name: string; unitType?: string };
  stockItemId?: string;
  stockItem?: { name: string; unitType?: string };
  quantityReceived: number;
  returnedQuantity: number;
  unitBuyPrice: number | string;
  unitSellPrice: number | string;
  paidAmount: number | string;
  paymentStatus: 'PENDING' | 'PARTIAL' | 'PAID';
  paymentSource: 'DAILY_CASH' | 'OWNER';
  isPaid: boolean;
  notes?: string | null;
  createdAt: string;
}

export default function SuppliersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (user && user.role === 'STOCK_KEEPER') {
      router.replace('/stock');
    }
  }, [user, router]);

  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'CASHIER';

  // Tabs
  const [activeTab, setActiveTab] = useState<'deliveries' | 'suppliers'>('deliveries');
  const [deliveryPage, setDeliveryPage] = useState(1);

  // Add Supplier Modal
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isSubmittingSupplier, setIsSubmittingSupplier] = useState(false);

  // Edit Supplier Modal
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isUpdatingSupplier, setIsUpdatingSupplier] = useState(false);

  // Delete Supplier Confirm
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);
  const [isDeletingSupplier, setIsDeletingSupplier] = useState(false);

  // Edit Delivery Modal
  const [editingDelivery, setEditingDelivery] = useState<SupplierDelivery | null>(null);
  const [isUpdatingDelivery, setIsUpdatingDelivery] = useState(false);

  // Delete Delivery Confirm
  const [deletingDeliveryId, setDeletingDeliveryId] = useState<string | null>(null);
  const [isDeletingDelivery, setIsDeletingDelivery] = useState(false);

  // Record Payment Modal
  const [paymentDelivery, setPaymentDelivery] = useState<SupplierDelivery | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentSource, setPaymentSource] = useState<'DAILY_CASH' | 'OWNER'>('DAILY_CASH');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [isRecordingPayment, setIsRecordingPayment] = useState(false);

  // Base Data: Suppliers
  const { data: baseData, isLoading: isLoadingBase } = useQuery({
    queryKey: ['suppliers-page', 'base', selectedBranchId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const res = await api.get('/suppliers', { params });
      return {
        suppliers: (res.data || []) as Supplier[],
      };
    },
  });

  // Deliveries List
  const { data: deliveriesData, isLoading: isLoadingDeliveries } = useQuery({
    queryKey: ['suppliers-page', 'deliveries', selectedBranchId, deliveryPage],
    queryFn: async () => {
      const params: any = {
        page: deliveryPage,
        limit: 15,
      };
      if (selectedBranchId) params.branchId = selectedBranchId;
      const res = await api.get('/supplier-deliveries', { params });
      return res.data;
    },
  });

  const suppliers = baseData?.suppliers || [];
  const rawDeliveries = Array.isArray(deliveriesData) ? deliveriesData : (deliveriesData?.data || []);
  const deliveries = rawDeliveries as SupplierDelivery[];
  const deliveryTotal = deliveriesData?.total ?? deliveries.length;
  const deliveryTotalPages = deliveriesData?.totalPages ?? 1;
  const deliveryStats = deliveriesData?.stats;

  const isLoading = isLoadingBase || isLoadingDeliveries;

  // Add Supplier
  const handleCreateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmittingSupplier(true);
    const formData = new FormData(e.currentTarget);

    let rawType = String(formData.get('type') || 'GENERAL').toUpperCase();
    if (!['INJERA', 'MILK', 'GENERAL'].includes(rawType)) {
      if (rawType.includes('MILK')) rawType = 'MILK';
      else if (rawType.includes('INJERA')) rawType = 'INJERA';
      else rawType = 'GENERAL';
    }

    const data = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim() || undefined,
      contactPerson: String(formData.get('contactPerson') || '').trim() || undefined,
      address: String(formData.get('address') || '').trim() || undefined,
      notes: String(formData.get('notes') || '').trim() || undefined,
      type: rawType,
      branchId: formData.get('branchId') || selectedBranchId || user?.branchId,
    };

    try {
      await api.post('/suppliers', data);
      toast.success(t('suppliers.modalRegisterTitle') + ' successful');
      setIsAddSupplierOpen(false);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add supplier');
    } finally {
      setIsSubmittingSupplier(false);
    }
  };

  // Edit Supplier
  const handleUpdateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setIsUpdatingSupplier(true);
    const formData = new FormData(e.currentTarget);

    const data = {
      name: String(formData.get('name') || '').trim(),
      phone: String(formData.get('phone') || '').trim() || null,
      contactPerson: String(formData.get('contactPerson') || '').trim() || null,
      address: String(formData.get('address') || '').trim() || null,
      notes: String(formData.get('notes') || '').trim() || null,
      type: String(formData.get('type') || editingSupplier.type).toUpperCase(),
    };

    try {
      await api.patch(`/suppliers/${editingSupplier.id}`, data);
      toast.success('Supplier profile updated');
      setEditingSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update supplier');
    } finally {
      setIsUpdatingSupplier(false);
    }
  };

  // Delete Supplier
  const handleDeleteSupplier = async () => {
    if (!deletingSupplier) return;
    setIsDeletingSupplier(true);
    try {
      await api.delete(`/suppliers/${deletingSupplier.id}`);
      toast.success('Supplier deleted successfully');
      setDeletingSupplier(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete supplier');
    } finally {
      setIsDeletingSupplier(false);
    }
  };

  // Edit Delivery
  const handleUpdateDelivery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingDelivery) return;
    setIsUpdatingDelivery(true);
    const formData = new FormData(e.currentTarget);

    const payload = {
      quantityReceived: Number(formData.get('quantityReceived')),
      returnedQuantity: Number(formData.get('returnedQuantity') || 0),
      unitBuyPrice: Number(formData.get('unitBuyPrice')),
      unitSellPrice: Number(formData.get('unitSellPrice') || 0),
      paidAmount: Number(formData.get('paidAmount') || 0),
      paymentSource: formData.get('paymentSource'),
      notes: String(formData.get('notes') || '').trim() || null,
    };

    try {
      await api.patch(`/supplier-deliveries/${editingDelivery.id}`, payload);
      toast.success('Delivery receipt updated');
      setEditingDelivery(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update delivery');
    } finally {
      setIsUpdatingDelivery(false);
    }
  };

  // Delete Delivery
  const handleDeleteDelivery = async () => {
    if (!deletingDeliveryId) return;
    setIsDeletingDelivery(true);
    try {
      await api.delete(`/supplier-deliveries/${deletingDeliveryId}`);
      toast.success('Delivery receipt deleted');
      setDeletingDeliveryId(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete delivery');
    } finally {
      setIsDeletingDelivery(false);
    }
  };

  // Open Record Payment
  const handleOpenRecordPayment = (delivery: SupplierDelivery) => {
    const netQty = Math.max(0, delivery.quantityReceived - delivery.returnedQuantity);
    const cost = netQty * Number(delivery.unitBuyPrice);
    const paid = delivery.isPaid && Number(delivery.paidAmount) === 0 ? cost : Number(delivery.paidAmount);
    const rem = Math.max(0, cost - paid);

    setPaymentDelivery(delivery);
    setPaymentAmount(rem.toFixed(2));
    setPaymentSource('DAILY_CASH');
    setPaymentNotes('');
  };

  // Submit Payment
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentDelivery) return;

    const amountNum = parseFloat(paymentAmount);
    if (!amountNum || amountNum <= 0) {
      toast.error('Please enter a valid amount greater than 0');
      return;
    }

    setIsRecordingPayment(true);
    try {
      await api.post(`/supplier-deliveries/${paymentDelivery.id}/payments`, {
        amount: amountNum,
        paymentSource,
        notes: paymentNotes.trim() || undefined,
      });

      toast.success('Payment recorded successfully!');
      setPaymentDelivery(null);
      queryClient.invalidateQueries({ queryKey: ['suppliers-page'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setIsRecordingPayment(false);
    }
  };

  // Aggregated unpaid amounts
  const totalUnpaidAmount =
    deliveryStats?.totalUnpaidAmount ??
    deliveries.reduce((sum, d) => {
      const net = Math.max(0, d.quantityReceived - d.returnedQuantity);
      const cost = net * Number(d.unitBuyPrice);
      const paid = d.isPaid && Number(d.paidAmount) === 0 ? cost : Number(d.paidAmount);
      return sum + Math.max(0, cost - paid);
    }, 0);

  const totalDeliveriesCount = deliveryStats?.totalDeliveries ?? deliveryTotal;

  if (user && user.role === 'STOCK_KEEPER') {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#E87A18]" />
            {t('suppliers.title')}
          </h1>
          <p className="text-xs text-[#8C7361] mt-0.5">{t('suppliers.subtitle')}</p>
        </div>

        {/* Action Buttons: Dedicated page navigation (NO popup!) */}
        <div className="flex flex-wrap items-center gap-2">
          {canManage && (
            <Button onClick={() => setIsAddSupplierOpen(true)} variant="outline" size="default" className="rounded-xl font-bold">
              + {t('suppliers.newSupplier')}
            </Button>
          )}

          <Link href="/suppliers/deliveries/new">
            <Button size="default" variant="brand" className="rounded-xl font-bold shadow-sm shadow-[#E87A18]/25 flex items-center gap-1.5">
              <Plus className="w-4 h-4" />
              <span>{t('suppliers.logDeliveryReceipt')}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* KPI Cards (Hidden for Cashier) */}
      {user?.role !== 'CASHIER' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#8C7361] uppercase truncate">{t('suppliers.activeSuppliers')}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1 rounded-lg" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{suppliers.length}</h3>
              )}
            </div>
            <div className="p-3 bg-[#FAF6F0] rounded-xl shrink-0"><PackageCheck className="w-6 h-6 text-[#E87A18]" /></div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#8C7361] uppercase truncate">{t('suppliers.totalReceipts')}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-16 mt-1 rounded-lg" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{totalDeliveriesCount}</h3>
              )}
            </div>
            <div className="p-3 bg-[#FAF6F0] rounded-xl shrink-0"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
          </div>

          <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex items-center justify-between min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#8C7361] uppercase truncate">{t('suppliers.accountsPayable')}</p>
              {isLoading ? (
                <Skeleton className="h-8 w-28 mt-1 rounded-lg" />
              ) : (
                <h3 className="text-xl sm:text-2xl font-black text-amber-700 mt-1 truncate">
                  {totalUnpaidAmount.toFixed(2)} {t('common.currency')}
                </h3>
              )}
            </div>
            <div className="p-3 bg-amber-50 rounded-xl shrink-0"><DollarSign className="w-6 h-6 text-amber-600" /></div>
          </div>
        </div>
      )}

      {/* Feature Tabs: Deliveries vs Suppliers */}
      <div className="flex items-center gap-1.5 p-1 bg-[#F4ECE1] rounded-xl border border-[#EDE4D5] mb-5 max-w-md">
        <button
          type="button"
          onClick={() => setActiveTab('deliveries')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 h-10 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'deliveries'
              ? 'bg-[#E87A18] text-white shadow-sm shadow-[#E87A18]/25'
              : 'text-[#8C7361] hover:text-[#4A2E1B] hover:bg-white/50'
          }`}
        >
          <Clock className="w-4 h-4 shrink-0" />
          <span className="font-extrabold truncate">
            {language === 'am' ? 'ርክክቦች' : language === 'om' ? 'Dhiyeessii' : 'Deliveries'}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono shrink-0 ${
            activeTab === 'deliveries' ? 'bg-white/20 text-white' : 'bg-[#E0D5C3] text-[#4A2E1B]'
          }`}>
            {deliveryTotal}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 h-10 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'suppliers'
              ? 'bg-[#E87A18] text-white shadow-sm shadow-[#E87A18]/25'
              : 'text-[#8C7361] hover:text-[#4A2E1B] hover:bg-white/50'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          <span className="font-extrabold truncate">
            {language === 'am' ? 'አቅራቢዎች' : language === 'om' ? 'Dhiyeessitoota' : 'Suppliers'}
          </span>
          <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black font-mono shrink-0 ${
            activeTab === 'suppliers' ? 'bg-white/20 text-white' : 'bg-[#E0D5C3] text-[#4A2E1B]'
          }`}>
            {suppliers.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Registered Suppliers Directory */}
      {activeTab === 'suppliers' && (
        <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs mb-6 animate-in fade-in-50 duration-200">
          <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex items-center justify-between">
            <h2 className="font-extrabold text-[#2C1B10] text-sm flex items-center gap-2">
              <Truck className="w-4 h-4 text-[#E87A18]" /> {t('suppliers.title')} ({suppliers.length})
            </h2>
          </div>

          {/* Desktop Suppliers Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('suppliers.colSupplierName')}</TableHead>
                  <TableHead>{t('suppliers.colPhone')}</TableHead>
                  <TableHead>{t('suppliers.colType')}</TableHead>
                  <TableHead>{t('branches.title')}</TableHead>
                  <TableHead className="text-center">{t('suppliers.totalReceipts')}</TableHead>
                  <TableHead className="text-right">{language === 'am' ? 'ቀሪ ሂሳብ' : language === 'om' ? 'Haftee' : 'Balance Due'}</TableHead>
                  <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 4 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-12 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : suppliers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">{t('suppliers.noSuppliers')}</TableCell></TableRow>
                ) : suppliers.map((sup) => {
                  const assignedBranch = branches.find((b) => b.id === sup.branchId)?.name || sup.branch?.name || 'Main Branch';
                  const bal = sup.stats?.totalBalanceDue ?? 0;

                  return (
                    <TableRow key={sup.id} className="hover:bg-[#FAF6F0]/40">
                      <TableCell className="font-bold text-[#2C1B10]">
                        <Link href={`/suppliers/${sup.id}`} className="hover:text-[#E87A18] hover:underline flex items-center gap-1.5 font-extrabold">
                          {sup.name}
                          <ChevronRight className="w-3.5 h-3.5 text-[#8C7361]" />
                        </Link>
                        {sup.contactPerson && (
                          <span className="text-[11px] font-normal text-[#8C7361] block">{sup.contactPerson}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#8C7361]">{sup.phone || '—'}</TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                          {sup.type}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs font-bold text-[#4A2E1B]">🏢 {assignedBranch}</TableCell>
                      <TableCell className="text-center font-extrabold text-[#2C1B10]">
                        {sup.stats?.totalDeliveries ?? sup._count?.deliveries ?? 0}
                      </TableCell>
                      <TableCell className={`text-right font-black font-mono text-xs ${bal > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {bal.toFixed(2)} {t('common.currency')}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link href={`/suppliers/${sup.id}`}>
                            <Button size="sm" variant="outline" className="h-8 px-2.5 rounded-lg text-xs font-bold border-[#EDE4D5]">
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              <span>{language === 'am' ? 'ዝርዝር' : language === 'om' ? 'Ilaali' : 'View'}</span>
                            </Button>
                          </Link>

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingSupplier(sup)}
                                className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg transition-colors"
                                title={t('suppliers.editSupplier')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingSupplier(sup)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('suppliers.deleteSupplier')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Suppliers Cards */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-2.5">
                    <Skeleton className="h-5 w-28" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            ) : suppliers.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#8C7361]">{t('suppliers.noSuppliers')}</p>
            ) : (
              suppliers.map((sup) => {
                const assignedBranch = branches.find((b) => b.id === sup.branchId)?.name || sup.branch?.name || 'Main Branch';
                const bal = sup.stats?.totalBalanceDue ?? 0;

                return (
                  <div key={sup.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3 hover:border-[#E87A18]/40 transition-colors">
                    <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                      <Link href={`/suppliers/${sup.id}`} className="flex items-center gap-2 min-w-0 group">
                        <div className="w-8 h-8 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-center text-[#E87A18] shrink-0 font-extrabold text-xs">
                          🏢
                        </div>
                        <h3 className="font-extrabold text-[#2C1B10] text-sm truncate group-hover:text-[#E87A18]">{sup.name}</h3>
                      </Link>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
                        {sup.type}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-[#B09987] block">{t('suppliers.colPhone')}</span>
                        {sup.phone ? (
                          <a href={`tel:${sup.phone}`} className="font-bold text-[#E87A18] hover:underline inline-flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {sup.phone}
                          </a>
                        ) : (
                          <span className="text-zinc-400 mt-0.5 block">—</span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-[#B09987] block">{language === 'am' ? 'ቀሪ ሂሳብ' : language === 'om' ? 'Haftee' : 'Balance Due'}</span>
                        <span className={`font-black font-mono text-xs block mt-0.5 ${bal > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                          {bal.toFixed(2)} {t('common.currency')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2.5 border-t border-[#F4ECE1]">
                      <span className="text-xs text-[#8C7361] font-medium">
                        {t('suppliers.totalReceipts')}: <strong className="text-[#2C1B10]">{sup.stats?.totalDeliveries ?? sup._count?.deliveries ?? 0}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <Link href={`/suppliers/${sup.id}`}>
                          <Button size="sm" variant="outline" className="h-7 px-2.5 rounded-lg text-xs font-bold border-[#EDE4D5]">
                            <Eye className="w-3 h-3 mr-1" />
                            <span>{language === 'am' ? 'ዝርዝር' : language === 'om' ? 'Ilaali' : 'View'}</span>
                          </Button>
                        </Link>

                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingSupplier(sup)}
                              className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg"
                              title={t('suppliers.editSupplier')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingSupplier(sup)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title={t('suppliers.deleteSupplier')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Delivery Receipts Log */}
      {activeTab === 'deliveries' && (
        <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs mb-8 animate-in fade-in-50 duration-200">
          <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex items-center justify-between">
            <h2 className="font-extrabold text-[#2C1B10] text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#E87A18]" /> {t('suppliers.recentDeliveries')} ({deliveries.length})
            </h2>
          </div>

          {/* Desktop Deliveries Table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('suppliers.colDeliveryDate')}</TableHead>
                  <TableHead>{t('suppliers.colSupplierName')}</TableHead>
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
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 mx-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20 ml-auto" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20 mx-auto rounded-full" /></TableCell>
                      <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto" /></TableCell>
                    </TableRow>
                  ))
                ) : deliveries.length === 0 ? (
                  <TableRow><TableCell colSpan={11} className="text-center py-8 text-[#8C7361]">{t('stockMovements.noMovements')}</TableCell></TableRow>
                ) : deliveries.map((d) => {
                  const netQty = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                  const totalCost = netQty * Number(d.unitBuyPrice);
                  const paid = d.isPaid && Number(d.paidAmount) === 0 ? totalCost : Number(d.paidAmount);
                  const remBalance = Math.max(0, totalCost - paid);
                  const isFullyPaid = d.paymentStatus === 'PAID' || d.isPaid;
                  const isPartial = d.paymentStatus === 'PARTIAL' || (!isFullyPaid && paid > 0);

                  return (
                    <TableRow key={d.id} className="hover:bg-[#FAF6F0]/40">
                      <TableCell className="text-xs font-semibold text-[#8C7361]">
                        {new Date(d.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </TableCell>
                      <TableCell className="font-extrabold text-[#2C1B10]">
                        <Link href={`/suppliers/${d.supplierId}`} className="hover:text-[#E87A18] hover:underline flex items-center gap-1">
                          {d.supplier?.name || t('stockMovements.unspecifiedSupplier')}
                          <ChevronRight className="w-3.5 h-3.5 text-[#8C7361]" />
                        </Link>
                      </TableCell>
                      <TableCell className="font-semibold text-[#4A2E1B]">
                        {d.stockItem?.name || d.product?.name || t('stockMovements.colMaterial')}
                      </TableCell>
                      <TableCell className="text-center font-bold text-[#2C1B10]">
                        {d.quantityReceived}
                        {d.returnedQuantity > 0 && <span className="text-[10px] text-red-600 block">(-{d.returnedQuantity})</span>}
                      </TableCell>
                      <TableCell className="text-right text-xs font-semibold text-[#8C7361] font-mono">
                        {Number(d.unitBuyPrice).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-black text-[#2C1B10] font-mono">
                        {totalCost.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-700 font-mono">
                        {paid.toFixed(2)}
                      </TableCell>
                      <TableCell className={`text-right font-black font-mono ${remBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {remBalance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          d.paymentSource === 'OWNER'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}>
                          {d.paymentSource === 'OWNER' ? t('suppliers.paidSourceOwner') : t('suppliers.paidSourceDailyCash')}
                        </span>
                      </TableCell>
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
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
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

                          {canManage && (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingDelivery(d)}
                                className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg transition-colors"
                                title={t('suppliers.editDelivery')}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => setDeletingDeliveryId(d.id)}
                                className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('suppliers.deleteDelivery')}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Deliveries Cards */}
          <div className="block md:hidden p-3 space-y-3">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ))}
              </div>
            ) : deliveries.length === 0 ? (
              <p className="text-center py-6 text-xs text-[#8C7361]">{t('stockMovements.noMovements')}</p>
            ) : (
              deliveries.map((d) => {
                const netQty = Math.max(0, d.quantityReceived - (d.returnedQuantity || 0));
                const totalCost = netQty * Number(d.unitBuyPrice);
                const paid = d.isPaid && Number(d.paidAmount) === 0 ? totalCost : Number(d.paidAmount);
                const remBalance = Math.max(0, totalCost - paid);
                const isFullyPaid = d.paymentStatus === 'PAID' || d.isPaid;
                const isPartial = d.paymentStatus === 'PARTIAL' || (!isFullyPaid && paid > 0);

                return (
                  <div key={d.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3 hover:border-[#E87A18]/40 transition-colors">
                    <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                        <Clock className="w-3.5 h-3.5 text-[#E87A18]" />
                        <span className="font-bold text-[#4A2E1B]">
                          {new Date(d.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
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

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] tracking-wider block">{t('suppliers.colSupplierName')}</span>
                        <Link href={`/suppliers/${d.supplierId}`} className="font-extrabold text-[#2C1B10] text-sm leading-snug mt-0.5 truncate hover:text-[#E87A18] flex items-center gap-1">
                          {d.supplier?.name || t('stockMovements.unspecifiedSupplier')}
                          <ChevronRight className="w-3.5 h-3.5 text-[#8C7361]" />
                        </Link>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] tracking-wider block">{t('stockMovements.colMaterial')}</span>
                        <span className="font-bold text-xs text-[#E87A18] block mt-0.5 bg-[#FAF6F0] px-2 py-0.5 rounded-md border border-[#EDE4D5]">
                          {d.stockItem?.name || d.product?.name || t('stockMovements.colMaterial')}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-xs">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-[#8C7361] block">{t('suppliers.colQtyReceived')}</span>
                        <span className="font-extrabold text-[#2C1B10] font-mono text-xs block mt-0.5">
                          {d.quantityReceived}
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

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F4ECE1]">
                      <div>
                        <span className="text-[10px] text-[#8C7361] block font-bold uppercase">{t('suppliers.colPaidAmount')}</span>
                        <span className="font-black text-emerald-700 font-mono">{paid.toFixed(2)} {t('common.currency')}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-[#8C7361] block font-bold uppercase">{t('suppliers.colRemainingBalance')}</span>
                        <span className={`font-black font-mono ${remBalance > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {remBalance.toFixed(2)} {t('common.currency')}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F4ECE1] gap-2">
                      <div className="flex items-center gap-1.5">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              onClick={() => setEditingDelivery(d)}
                              className="p-1.5 text-[#8C7361] hover:text-[#2C1B10] hover:bg-zinc-100 rounded-lg"
                              title={t('suppliers.editDelivery')}
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingDeliveryId(d.id)}
                              className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title={t('suppliers.deleteDelivery')}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
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

          {/* Deliveries Pagination */}
          <div className="p-4 bg-[#FAF6F0] border-t border-[#EDE4D5]">
            <PaginationControls
              currentPage={deliveryPage}
              totalPages={deliveryTotalPages}
              totalItems={deliveryTotal}
              pageSize={15}
              onPageChange={setDeliveryPage}
              isLoading={isLoadingDeliveries}
            />
          </div>
        </div>
      )}

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <Dialog open={true} onOpenChange={() => setIsAddSupplierOpen(false)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold">{t('suppliers.modalRegisterTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSupplier} className="space-y-3.5 py-2">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('common.branch')}</label>
                <select
                  name="branchId"
                  defaultValue={selectedBranchId || user?.branchId || (branches[0]?.id ?? '')}
                  className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs font-medium"
                >
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      🏢 {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {t('suppliers.colSupplierName')} <span className="text-red-500">*</span>
                </label>
                <Input name="name" required placeholder="e.g. Flour Factory / Milk Dairy" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colPhone')}</label>
                  <Input name="phone" placeholder="0911223344" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                    {language === 'am' ? 'ተጠሪ ሰው' : language === 'om' ? 'Nama Quunnamtii' : 'Contact Person'}
                  </label>
                  <Input name="contactPerson" placeholder="Ato Kebede" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'አድራሻ' : language === 'om' ? 'Teessoo' : 'Address'}
                </label>
                <Input name="address" placeholder="e.g., Addis Ababa, Bole" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colType')}</label>
                <select name="type" required className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs">
                  <option value="GENERAL">GENERAL SUPPLIER</option>
                  <option value="MILK">MILK SUPPLIER</option>
                  <option value="INJERA">INJERA SUPPLIER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'ማስታወሻ' : language === 'om' ? 'Yaadannoo' : 'Notes'}
                </label>
                <Input name="notes" placeholder="Optional notes" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="brand" loading={isSubmittingSupplier}>
                  {t('suppliers.btnRegister')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Supplier Modal */}
      {editingSupplier && (
        <Dialog open={true} onOpenChange={() => setEditingSupplier(null)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold">{t('suppliers.editSupplier')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleUpdateSupplier} className="space-y-3.5 py-2">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colSupplierName')}</label>
                <Input name="name" defaultValue={editingSupplier.name} required className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colPhone')}</label>
                  <Input name="phone" defaultValue={editingSupplier.phone || ''} placeholder="0911223344" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                    {language === 'am' ? 'ተጠሪ ሰው' : language === 'om' ? 'Nama Quunnamtii' : 'Contact Person'}
                  </label>
                  <Input name="contactPerson" defaultValue={editingSupplier.contactPerson || ''} className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'አድራሻ' : language === 'om' ? 'Teessoo' : 'Address'}
                </label>
                <Input name="address" defaultValue={editingSupplier.address || ''} className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">{t('suppliers.colType')}</label>
                <select name="type" defaultValue={editingSupplier.type} className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs">
                  <option value="GENERAL">GENERAL SUPPLIER</option>
                  <option value="MILK">MILK SUPPLIER</option>
                  <option value="INJERA">INJERA SUPPLIER</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">
                  {language === 'am' ? 'ማስታወሻ' : language === 'om' ? 'Yaadannoo' : 'Notes'}
                </label>
                <Input name="notes" defaultValue={editingSupplier.notes || ''} className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setEditingSupplier(null)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" variant="brand" loading={isUpdatingSupplier}>
                  {t('common.saveChanges') || 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Supplier Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingSupplier)}
        title={t('suppliers.deleteSupplier')}
        description={`Are you sure you want to delete supplier "${deletingSupplier?.name}"?`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={isDeletingSupplier}
        onConfirm={handleDeleteSupplier}
        onCancel={() => setDeletingSupplier(null)}
      />

      {/* Edit Delivery Modal */}
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

              <div className="grid grid-cols-2 gap-3">
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
                  <select
                    name="paymentSource"
                    defaultValue={editingDelivery.paymentSource}
                    className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs"
                  >
                    <option value="DAILY_CASH">{t('suppliers.paidSourceDailyCash')}</option>
                    <option value="OWNER">{t('suppliers.paidSourceOwner')}</option>
                  </select>
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
                <Button type="submit" variant="brand" loading={isUpdatingDelivery}>
                  {t('common.saveChanges') || 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Delivery Modal */}
      <ConfirmModal
        isOpen={Boolean(deletingDeliveryId)}
        title={t('suppliers.deleteDelivery')}
        description="Are you sure you want to delete this delivery receipt? This action cannot be undone."
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        isLoading={isDeletingDelivery}
        onConfirm={handleDeleteDelivery}
        onCancel={() => setDeletingDeliveryId(null)}
      />

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
                  <span className="text-[#8C7361]">{t('suppliers.colSupplierName')}:</span>
                  <span className="font-bold text-[#2C1B10]">{paymentDelivery.supplier?.name || 'Supplier'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#8C7361]">{t('stockMovements.colMaterial')}:</span>
                  <span className="font-bold text-[#2C1B10]">{paymentDelivery.product?.name || 'Raw Material'}</span>
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
                <select
                  value={paymentSource}
                  onChange={(e) => setPaymentSource(e.target.value as 'DAILY_CASH' | 'OWNER')}
                  className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs font-semibold"
                >
                  <option value="DAILY_CASH">💵 {t('suppliers.paidSourceDailyCash')}</option>
                  <option value="OWNER">👤 {t('suppliers.paidSourceOwner')}</option>
                </select>
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
    </DashboardLayout>
  );
}
