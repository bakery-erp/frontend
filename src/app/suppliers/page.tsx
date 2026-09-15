'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Truck, Plus, CheckCircle2, DollarSign, PackageCheck, Trash2, Clock, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface Supplier {
  id: string;
  name: string;
  phone?: string;
  type: 'MILK' | 'INJERA' | 'GENERAL';
  branchId: string;
}

interface SupplierDelivery {
  id: string;
  supplierId: string;
  supplier?: { name: string; type: string };
  productId?: string;
  product?: { name: string };
  stockItemId?: string;
  stockItem?: { name: string; unitType: string };
  quantityReceived: number;
  returnedQuantity: number;
  unitBuyPrice: number;
  paymentSource?: 'DAILY_CASH' | 'OWNER';
  isPaid: boolean;
  createdAt: string;
}

interface DeliveryLineItem {
  productId: string;
  quantityReceived: string;
  unitBuyPrice: string;
  unitSellPrice: string;
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isLogDeliveryOpen, setIsLogDeliveryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Multi-item delivery state
  const [deliverySupplierId, setDeliverySupplierId] = useState('');
  const [deliveryPaymentSource, setDeliveryPaymentSource] = useState<'DAILY_CASH' | 'OWNER'>('DAILY_CASH');
  const [deliveryIsPaid, setDeliveryIsPaid] = useState(true);
  const [deliveryItems, setDeliveryItems] = useState<DeliveryLineItem[]>([]);

  useEffect(() => {
    fetchData();
  }, [selectedBranchId]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const [supRes, delRes, prodRes] = await Promise.all([
        api.get('/suppliers', { params }),
        api.get('/supplier-deliveries', { params }),
        api.get('/products'),
      ]);
      setSuppliers(supRes.data);
      setDeliveries(delRes.data);
      const resellOnly = (prodRes.data || []).filter((p: any) => p.category?.type === 'RESELL');
      const filteredProd = resellOnly.length > 0 ? resellOnly : prodRes.data.filter((p: any) => p.category?.type !== 'PRODUCED');
      setProducts(filteredProd);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to fetch supplier data');
    } finally {
      setIsLoading(false);
    }
  };

  const openLogDeliveryModal = () => {
    if (suppliers.length > 0) setDeliverySupplierId(suppliers[0].id);
    setDeliveryPaymentSource('DAILY_CASH');
    if (products.length > 0) {
      setDeliveryItems([
        {
          productId: products[0].id,
          quantityReceived: '',
          unitBuyPrice: String(products[0].buyPrice || ''),
          unitSellPrice: String(products[0].basePrice || ''),
        },
      ]);
    } else {
      setDeliveryItems([]);
    }
    setIsLogDeliveryOpen(true);
  };

  const addDeliveryItemRow = () => {
    const defaultProd = products[0];
    setDeliveryItems((prev) => [
      {
        productId: defaultProd ? defaultProd.id : '',
        quantityReceived: '',
        unitBuyPrice: defaultProd ? String(defaultProd.buyPrice || '') : '',
        unitSellPrice: defaultProd ? String(defaultProd.basePrice || '') : '',
      },
      ...prev,
    ]);
  };

  const removeDeliveryItemRow = (index: number) => {
    setDeliveryItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDeliveryItemRow = (index: number, field: keyof DeliveryLineItem, value: string) => {
    setDeliveryItems((prev) => {
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

  const handleCreateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    
    let rawType = String(formData.get('type') || 'GENERAL').toUpperCase();
    if (!['INJERA', 'MILK', 'GENERAL'].includes(rawType)) {
      if (rawType.includes('MILK')) rawType = 'MILK';
      else if (rawType.includes('INJERA')) rawType = 'INJERA';
      else rawType = 'GENERAL';
    }

    const data = {
      name: formData.get('name'),
      phone: formData.get('phone') || undefined,
      type: rawType,
      branchId: formData.get('branchId') || selectedBranchId || user?.branchId,
    };

    try {
      await api.post('/suppliers', data);
      toast.success('Supplier registered successfully');
      setIsAddSupplierOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to add supplier');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deliverySupplierId) {
      toast.error('Please select a supplier');
      return;
    }

    const validItems = deliveryItems.filter((i) => i.productId && Number(i.quantityReceived) > 0);
    if (validItems.length === 0) {
      toast.error('Please add at least one product with a valid quantity');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/supplier-deliveries', {
        supplierId: deliverySupplierId,
        paymentSource: deliveryPaymentSource,
        isPaid: deliveryIsPaid,
        items: validItems.map((i) => ({
          productId: i.productId,
          quantityReceived: Number(i.quantityReceived),
          unitBuyPrice: Number(i.unitBuyPrice) || 0,
          unitSellPrice: Number(i.unitSellPrice) || 0,
        })),
      });

      toast.success(`Successfully recorded ${validItems.length} delivery item(s)!`);
      setIsLogDeliveryOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to record delivery receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePaymentStatus = async (deliveryId: string, currentPaid: boolean) => {
    try {
      await api.patch(`/supplier-deliveries/${deliveryId}`, { isPaid: !currentPaid });
      toast.success(`Delivery payment status updated to ${!currentPaid ? 'PAID' : 'UNPAID'}`);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to update payment status');
    }
  };

  const totalUnpaidAmount = deliveries
    .filter((d) => !d.isPaid)
    .reduce((sum, d) => sum + Number(d.unitBuyPrice) * d.quantityReceived, 0);

  const totalDeliveriesThisMonth = deliveries.length;

  const totalBatchCost = deliveryItems.reduce(
    (sum, item) => sum + Number(item.quantityReceived || 0) * Number(item.unitBuyPrice || 0),
    0
  );

  const validDeliveryItemsCount = deliveryItems.filter(
    (i) => i.productId && Number(i.quantityReceived) > 0
  ).length;

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#E87A18]" />
            {t('suppliers.title')}
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
            {t('suppliers.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {(user?.role === 'OWNER' || user?.role === 'ADMIN') && (
            <Button onClick={() => setIsAddSupplierOpen(true)} variant="outline" className="border-[#EDE4D5] rounded-xl text-xs font-bold">
              + {t('suppliers.newSupplier')}
            </Button>
          )}
          <Button onClick={openLogDeliveryModal} className="bg-[#E87A18] hover:bg-[#D66B0F] text-white rounded-xl text-xs font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Log Delivery Receipt
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#8C7361] uppercase truncate">Active Suppliers</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{suppliers.length}</h3>
          </div>
          <div className="p-3 bg-[#FAF6F0] rounded-xl shrink-0"><PackageCheck className="w-6 h-6 text-[#E87A18]" /></div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#8C7361] uppercase truncate">Total Receipts</p>
            <h3 className="text-xl sm:text-2xl font-black text-[#2C1B10] mt-1">{totalDeliveriesThisMonth}</h3>
          </div>
          <div className="p-3 bg-[#FAF6F0] rounded-xl shrink-0"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between min-w-0">
          <div className="min-w-0">
            <p className="text-xs font-bold text-[#8C7361] uppercase truncate">Accounts Payable (Unpaid)</p>
            <h3 className="text-xl sm:text-2xl font-black text-amber-700 mt-1 truncate">{totalUnpaidAmount.toFixed(2)} ETB</h3>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl shrink-0"><DollarSign className="w-6 h-6 text-amber-600" /></div>
        </div>
      </div>

      {/* Registered Suppliers Directory: Desktop Table & Mobile Cards */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm mb-6">
        <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex items-center justify-between">
          <h2 className="font-extrabold text-[#2C1B10] text-sm flex items-center gap-2">
            <Truck className="w-4 h-4 text-[#E87A18]" /> {t('suppliers.title')} ({suppliers.length})
          </h2>
          <span className="text-xs text-[#8C7361]">All active suppliers by branch</span>
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
                <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-[#8C7361]">Loading suppliers directory...</TableCell></TableRow>
              ) : suppliers.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-6 text-[#8C7361]">No registered suppliers found. Click "+ Add Supplier" to register one.</TableCell></TableRow>
              ) : suppliers.map((sup: any) => {
                const assignedBranch = branches.find((b) => b.id === sup.branchId)?.name || sup.branch?.name || 'Main Branch';
                return (
                  <TableRow key={sup.id}>
                    <TableCell className="font-bold text-[#2C1B10]">{sup.name}</TableCell>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">{sup.phone || 'N/A'}</TableCell>
                    <TableCell>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                        {sup.type}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-bold text-[#4A2E1B]">🏢 {assignedBranch}</TableCell>
                    <TableCell className="text-right pr-6 font-extrabold text-[#2C1B10]">{sup._count?.deliveries ?? 0}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Suppliers Directory Cards */}
        <div className="block md:hidden p-3 space-y-3">
          {isLoading ? (
            <p className="text-center py-6 text-xs text-[#8C7361]">Loading suppliers directory...</p>
          ) : suppliers.length === 0 ? (
            <p className="text-center py-6 text-xs text-[#8C7361]">No registered suppliers found.</p>
          ) : (
            suppliers.map((sup: any) => {
              const assignedBranch = branches.find((b) => b.id === sup.branchId)?.name || sup.branch?.name || 'Main Branch';
              return (
                <div key={sup.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2">
                    <h3 className="font-extrabold text-[#2C1B10] text-sm">{sup.name}</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                      {sup.type}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#8C7361]">
                    <span>🏢 {assignedBranch}</span>
                    {sup.phone ? (
                      <a href={`tel:${sup.phone}`} className="font-bold text-[#E87A18] hover:underline flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {sup.phone}
                      </a>
                    ) : (
                      <span className="text-zinc-400">No phone</span>
                    )}
                  </div>
                  <div className="text-xs text-[#8C7361] flex items-center justify-between pt-1 border-t border-[#F4ECE1]">
                    <span>Deliveries Received:</span>
                    <span className="font-extrabold text-[#2C1B10] font-mono">{sup._count?.deliveries ?? 0}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Delivery Logs: Desktop Table & Mobile Cards */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm mb-8">
        <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex items-center justify-between">
          <h2 className="font-extrabold text-[#2C1B10] text-sm">Recent Supplier Deliveries</h2>
          <span className="text-xs text-[#8C7361]">Auto-increments stock quantity</span>
        </div>

        {/* Desktop Deliveries Table */}
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Delivery Date</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Stock Material / Item</TableHead>
                <TableHead>Qty Received</TableHead>
                <TableHead>Unit Cost</TableHead>
                <TableHead>Total Cost</TableHead>
                <TableHead>Paid From</TableHead>
                <TableHead className="text-right pr-6">Payment Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-[#8C7361]">Loading delivery logs...</TableCell></TableRow>
              ) : deliveries.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-[#8C7361]">No delivery receipts recorded.</TableCell></TableRow>
              ) : deliveries.map((d) => {
                const totalCost = Number(d.unitBuyPrice) * d.quantityReceived;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">
                      {new Date(d.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="font-bold text-[#2C1B10]">{d.supplier?.name || 'Supplier'}</TableCell>
                    <TableCell className="font-semibold text-[#4A2E1B]">{d.stockItem?.name || d.product?.name || 'Raw Material'}</TableCell>
                    <TableCell className="font-bold text-[#2C1B10]">
                      {d.quantityReceived} <span className="text-xs text-[#8C7361] font-normal">{d.stockItem?.unitType || ''}</span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold text-[#8C7361]">{Number(d.unitBuyPrice).toFixed(2)} ETB</TableCell>
                    <TableCell className="font-extrabold text-[#2C1B10]">{totalCost.toFixed(2)} ETB</TableCell>
                    <TableCell>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        d.paymentSource === 'OWNER'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : 'bg-blue-100 text-blue-800 border-blue-200'
                      }`}>
                        {d.paymentSource === 'OWNER' ? 'Owner' : 'Daily Cash'}
                      </span>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        disabled={!(user?.role === 'OWNER' || user?.role === 'ADMIN')}
                        onClick={() => togglePaymentStatus(d.id, d.isPaid)}
                        className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-xs transition-all ${
                          d.isPaid 
                            ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' 
                            : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
                        } ${!(user?.role === 'OWNER' || user?.role === 'ADMIN') ? 'opacity-80 cursor-not-allowed' : ''}`}
                      >
                        {d.isPaid ? '✓ PAID' : '⚠ UNPAID'}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Deliveries View Cards */}
        <div className="block md:hidden p-3 space-y-3">
          {isLoading ? (
            <p className="text-center py-6 text-xs text-[#8C7361]">Loading delivery logs...</p>
          ) : deliveries.length === 0 ? (
            <p className="text-center py-6 text-xs text-[#8C7361]">No delivery receipts recorded.</p>
          ) : (
            deliveries.map((d) => {
              const totalCost = Number(d.unitBuyPrice) * d.quantityReceived;
              const dateStr = new Date(d.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              const isOwner = d.paymentSource === 'OWNER';

              return (
                <div key={d.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
                  {/* Header: Date and Payment Status Button */}
                  <div className="flex items-center justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                    <div className="flex items-center gap-1.5 text-xs text-[#8C7361]">
                      <Clock className="w-3.5 h-3.5 text-[#8C7361]" />
                      <span className="font-semibold">{dateStr}</span>
                    </div>
                    <button
                      type="button"
                      disabled={!(user?.role === 'OWNER' || user?.role === 'ADMIN')}
                      onClick={() => togglePaymentStatus(d.id, d.isPaid)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-xs transition-all ${
                        d.isPaid 
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-900 border border-amber-300'
                      } ${!(user?.role === 'OWNER' || user?.role === 'ADMIN') ? 'opacity-80 cursor-not-allowed' : ''}`}
                    >
                      {d.isPaid ? '✓ PAID' : '⚠ UNPAID'}
                    </button>
                  </div>

                  {/* Supplier & Item */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#8C7361] block">Supplier</span>
                      <h4 className="font-extrabold text-[#2C1B10] text-sm leading-tight mt-0.5">
                        {d.supplier?.name || 'Supplier'}
                      </h4>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-[#8C7361] block">Stock Item</span>
                      <span className="font-semibold text-xs text-[#4A2E1B] block mt-0.5">
                        {d.stockItem?.name || d.product?.name || 'Raw Material'}
                      </span>
                    </div>
                  </div>

                  {/* Quantity, Unit cost, Total Cost in 3-column box */}
                  <div className="grid grid-cols-3 gap-2 bg-[#FAF6F0] p-2.5 rounded-xl border border-[#EDE4D5] text-xs">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-[#8C7361] block">Qty</span>
                      <span className="font-extrabold text-[#2C1B10] font-mono text-xs">
                        {d.quantityReceived} {d.stockItem?.unitType || ''}
                      </span>
                    </div>
                    <div className="text-center">
                      <span className="text-[10px] font-bold uppercase text-[#8C7361] block">Unit Cost</span>
                      <span className="font-semibold text-[#8C7361] font-mono text-xs">
                        {Number(d.unitBuyPrice).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase text-[#8C7361] block">Total</span>
                      <span className="font-extrabold text-[#2C1B10] font-mono text-xs">
                        {totalCost.toFixed(2)} ETB
                      </span>
                    </div>
                  </div>

                  {/* Paid From */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#F4ECE1]">
                    <span className="text-[#8C7361]">Paid From:</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isOwner
                        ? 'bg-purple-100 text-purple-800 border-purple-200'
                        : 'bg-blue-100 text-blue-800 border-blue-200'
                    }`}>
                      {isOwner ? '👤 Owner' : '💵 Daily Cash'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <Dialog open={true} onOpenChange={() => setIsAddSupplierOpen(false)}>
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold">Register New Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSupplier} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Assigned Branch</label>
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
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Supplier Name</label>
                <Input name="name" required placeholder="e.g. Flour Factory / Milk Dairy" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Phone Number</label>
                <Input name="phone" placeholder="e.g. 0911223344" className="bg-[#FAF6F0] border-[#EDE4D5] h-10 text-xs" />
              </div>
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] mb-1 block">Supplier Type</label>
                <select name="type" required className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl h-10 px-3 text-xs">
                  <option value="GENERAL">GENERAL SUPPLIER</option>
                  <option value="MILK">MILK SUPPLIER</option>
                  <option value="INJERA">INJERA SUPPLIER</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)} className="border-[#EDE4D5] text-xs">Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] text-xs font-bold">
                  {isSubmitting ? 'Registering...' : 'Register Supplier'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Multi-Product Log Delivery Receipt Modal */}
      {isLogDeliveryOpen && (
        <Dialog open={true} onOpenChange={() => setIsLogDeliveryOpen(false)}>
          <DialogContent className="bg-white border-[#EDE4D5] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold text-lg flex items-center gap-2">
                <Truck className="w-5 h-5 text-[#E87A18]" />
                Log Multi-Product Delivery Receipt
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleLogDelivery} className="space-y-4 py-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5]">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Select Supplier</label>
                  <select
                    value={deliverySupplierId}
                    onChange={(e) => setDeliverySupplierId(e.target.value)}
                    className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                  >
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.type})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Paid From</label>
                  <select
                    value={deliveryPaymentSource}
                    onChange={(e) => setDeliveryPaymentSource(e.target.value as 'DAILY_CASH' | 'OWNER')}
                    className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                  >
                    <option value="DAILY_CASH">Daily Money (Cashier Register)</option>
                    <option value="OWNER">Paid by Owner (Out-of-Pocket)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">Payment Status</label>
                  <select
                    value={deliveryIsPaid ? 'true' : 'false'}
                    onChange={(e) => setDeliveryIsPaid(e.target.value === 'true')}
                    className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium"
                  >
                    <option value="true">PAID Immediately</option>
                    <option value="false">UNPAID (Add to Accounts Payable)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-extrabold text-[#4A2E1B] uppercase tracking-wider">
                      Delivery Line Items ({deliveryItems.length})
                    </h4>
                    <span className="text-[11px] text-[#8C7361] hidden sm:inline">
                      Add and adjust quantities and prices for this delivery
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={addDeliveryItemRow}
                    variant="outline"
                    className="border-[#E87A18] text-[#E87A18] hover:bg-amber-50 text-xs font-bold rounded-xl h-8 px-3 flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </Button>
                </div>

                {deliveryItems.length === 0 ? (
                  <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-[#EDE4D5] rounded-2xl bg-[#FAF6F0]/40">
                    No items added yet. Click <span className="font-bold text-[#E87A18]">"+ Add Product"</span> to begin.
                  </div>
                ) : (
                  <>
                    {/* Desktop Column Headers (>= sm) */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-2 bg-[#FAF6F0] rounded-xl text-[11px] font-extrabold text-[#4A2E1B] border border-[#EDE4D5]">
                      <div className="col-span-4">Product Name</div>
                      <div className="col-span-2 text-center">Qty Received</div>
                      <div className="col-span-2 text-center">Unit Buy Price (ETB)</div>
                      <div className="col-span-2 text-center">Unit Sell Price (ETB)</div>
                      <div className="col-span-1 text-right">Subtotal</div>
                      <div className="col-span-1 text-center">Remove</div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                      {deliveryItems.map((item, index) => {
                        const lineSubtotal = Number(item.quantityReceived || 0) * Number(item.unitBuyPrice || 0);
                        return (
                          <div
                            key={index}
                            className="bg-white border border-[#EDE4D5] rounded-2xl p-3.5 sm:p-2 sm:rounded-xl shadow-2xs space-y-3 sm:space-y-0 hover:border-amber-200 transition-colors"
                          >
                            {/* MOBILE VIEW (< sm) */}
                            <div className="block sm:hidden space-y-3">
                              {/* Top Bar: Item Index and Remove Button */}
                              <div className="flex items-center justify-between pb-2 border-b border-[#FAF6F0]">
                                <div className="flex items-center gap-2">
                                  <span className="w-5 h-5 rounded-full bg-[#FAF6F0] border border-[#EDE4D5] text-[#E87A18] text-[11px] font-extrabold flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <span className="text-xs font-bold text-[#4A2E1B]">Product #{index + 1}</span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => removeDeliveryItemRow(index)}
                                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
                                  title="Remove product"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Remove</span>
                                </button>
                              </div>

                              {/* Product Selection */}
                              <div>
                                <label className="text-[11px] font-bold text-[#4A2E1B] block mb-1">Product</label>
                                <select
                                  value={item.productId}
                                  onChange={(e) => updateDeliveryItemRow(index, 'productId', e.target.value)}
                                  className="w-full bg-white border border-[#EDE4D5] rounded-xl h-10 text-xs px-3 font-medium text-[#2C1B10] focus:ring-1 focus:ring-[#E87A18]"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.unitType})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              {/* Qty & Buy Price in 2 Columns */}
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="text-[11px] font-bold text-[#4A2E1B] block mb-1">Qty Received</label>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={item.quantityReceived}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateDeliveryItemRow(index, 'quantityReceived', e.target.value)}
                                    className="bg-white border-[#EDE4D5] h-10 text-xs font-mono font-bold text-center rounded-xl"
                                  />
                                </div>
                                <div>
                                  <label className="text-[11px] font-bold text-[#4A2E1B] block mb-1">Buy Price (ETB)</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={item.unitBuyPrice}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateDeliveryItemRow(index, 'unitBuyPrice', e.target.value)}
                                    className="bg-white border-[#EDE4D5] h-10 text-xs font-mono text-center rounded-xl"
                                  />
                                </div>
                              </div>

                              {/* Sell Price & Subtotal in 2 Columns */}
                              <div className="grid grid-cols-2 gap-2.5 pt-0.5">
                                <div>
                                  <label className="text-[11px] font-bold text-[#4A2E1B] block mb-1">Sell Price (ETB)</label>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    placeholder="0.00"
                                    value={item.unitSellPrice}
                                    onFocus={(e) => e.target.select()}
                                    onChange={(e) => updateDeliveryItemRow(index, 'unitSellPrice', e.target.value)}
                                    className="bg-white border-[#EDE4D5] h-10 text-xs font-mono font-bold text-[#E87A18] text-center rounded-xl"
                                  />
                                </div>
                                <div>
                                  <span className="text-[11px] font-bold text-[#8C7361] block mb-1">Line Subtotal</span>
                                  <div className="h-10 px-3 bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl flex items-center justify-between font-mono font-bold text-xs text-[#2C1B10]">
                                    <span className="text-[10px] text-zinc-400 font-sans">ETB</span>
                                    <span>{lineSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* DESKTOP VIEW (>= sm) */}
                            <div className="hidden sm:grid sm:grid-cols-12 gap-2 items-center">
                              <div className="col-span-4">
                                <select
                                  value={item.productId}
                                  onChange={(e) => updateDeliveryItemRow(index, 'productId', e.target.value)}
                                  className="w-full bg-white border border-[#EDE4D5] rounded-lg h-9 text-xs px-2 font-medium"
                                >
                                  {products.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} ({p.unitType})
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={item.quantityReceived}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateDeliveryItemRow(index, 'quantityReceived', e.target.value)}
                                  className="bg-white border-[#EDE4D5] h-9 text-xs font-mono font-bold text-center"
                                />
                              </div>

                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.unitBuyPrice}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateDeliveryItemRow(index, 'unitBuyPrice', e.target.value)}
                                  className="bg-white border-[#EDE4D5] h-9 text-xs font-mono text-center"
                                />
                              </div>

                              <div className="col-span-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={item.unitSellPrice}
                                  onFocus={(e) => e.target.select()}
                                  onChange={(e) => updateDeliveryItemRow(index, 'unitSellPrice', e.target.value)}
                                  className="bg-white border-[#EDE4D5] h-9 text-xs font-mono font-bold text-[#E87A18] text-center"
                                />
                              </div>

                              <div className="col-span-1 text-right font-mono font-bold text-xs text-[#2C1B10]">
                                {lineSubtotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                              </div>

                              <div className="col-span-1 flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => removeDeliveryItemRow(index)}
                                  className="p-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Remove item"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              {/* Total Batch Summary */}
              <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-3.5 sm:p-4 flex items-center justify-between">
                <div>
                  <span className="text-[11px] font-bold text-[#8C7361] uppercase tracking-wider block">Total Delivery Batch Cost</span>
                  <span className="text-xs text-[#A8988B]">
                    {validDeliveryItemsCount} valid item{validDeliveryItemsCount !== 1 ? 's' : ''} to record & stock
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-lg sm:text-xl font-black text-[#2C1B10] font-mono">
                    {totalBatchCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-[#8C7361] ml-1.5">ETB</span>
                </div>
              </div>

              <DialogFooter className="pt-3 border-t border-[#EDE4D5] flex flex-col sm:flex-row gap-2 w-full">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto min-h-[44px] h-auto py-2.5 px-4 bg-[#4A2E1B] text-white hover:bg-[#3D2314] text-xs sm:text-sm font-bold rounded-xl order-1 sm:order-2 whitespace-normal text-center leading-snug"
                >
                  {isSubmitting ? (
                    'Recording...'
                  ) : (
                    <>
                      <span className="sm:hidden">Record Deliveries</span>
                      <span className="hidden sm:inline">Record All Deliveries & Update Stock</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsLogDeliveryOpen(false)}
                  className="w-full sm:w-auto h-10 border-[#EDE4D5] text-[#8C7361] hover:text-[#4A2E1B] text-xs sm:text-sm font-semibold rounded-xl order-2 sm:order-1"
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
