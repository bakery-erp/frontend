'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Truck, Plus, CheckCircle2, DollarSign, PackageCheck, AlertCircle } from 'lucide-react';
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
  isPaid: boolean;
  createdAt: string;
}

interface StockItem {
  id: string;
  name: string;
  unitType: string;
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [deliveries, setDeliveries] = useState<SupplierDelivery[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [isLogDeliveryOpen, setIsLogDeliveryOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      setProducts(resellOnly.length > 0 ? resellOnly : prodRes.data.filter((p: any) => p.category?.type !== 'PRODUCED'));
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to fetch supplier data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSupplier = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      phone: formData.get('phone') || undefined,
      type: formData.get('type'),
      branchId: selectedBranchId || user?.branchId,
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

  const handleLogDelivery = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(e.currentTarget);
    const data = {
      supplierId: formData.get('supplierId'),
      productId: formData.get('productId'),
      quantityReceived: Number(formData.get('quantityReceived')),
      returnedQuantity: formData.get('returnedQuantity') ? Number(formData.get('returnedQuantity')) : 0,
      unitBuyPrice: Number(formData.get('unitBuyPrice')),
      isPaid: formData.get('isPaid') === 'true',
    };

    try {
      await api.post('/supplier-deliveries', data);
      toast.success('Delivery recorded successfully!');
      setIsLogDeliveryOpen(false);
      fetchData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to record delivery');
    } finally {
      setIsSubmitting(false);
    }
  };

  const togglePaymentStatus = async (id: string, currentPaid: boolean) => {
    try {
      await api.patch(`/supplier-deliveries/${id}`, { isPaid: !currentPaid });
      toast.success(`Delivery payment status updated to ${!currentPaid ? 'PAID' : 'UNPAID'}`);
      fetchData();
    } catch (e: any) {
      toast.error('Failed to update payment status');
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">Suppliers & Material Deliveries</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">Manage supplier directory, log raw material/resell deliveries, and track accounts payable</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setIsAddSupplierOpen(true)} className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs sm:text-sm">
            <Plus className="w-4 h-4 mr-2" /> Add Supplier
          </Button>
          <Button onClick={() => setIsLogDeliveryOpen(true)} className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md">
            <PackageCheck className="w-4 h-4 mr-2" /> Log Delivery Receipt
          </Button>
        </div>
      </div>

      {/* Supplier Registry Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {suppliers.map((s) => (
          <div key={s.id} className="p-4 bg-white border border-[#EDE4D5] rounded-2xl shadow-sm flex justify-between items-center">
            <div>
              <p className="font-bold text-[#2C1B10] text-sm">{s.name}</p>
              <p className="text-xs text-[#8C7361]">{s.phone || 'No phone'}</p>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-[#F4ECE1] text-[#4A2E1B] border border-[#E0D5C3]">
              {s.type}
            </span>
          </div>
        ))}
      </div>

      {/* Delivery Logs Table */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
        <div className="px-6 py-4 border-b border-[#EDE4D5] flex items-center justify-between">
          <h3 className="font-extrabold text-[#2C1B10]">Recent Supplier Delivery Receipts</h3>
          <span className="text-xs font-semibold text-[#8C7361]">Auto-increments stock upon entry</span>
        </div>

        <Table>
          <TableHeader className="bg-zinc-50">
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Stock Item / Material</TableHead>
              <TableHead>Qty Received</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead>Payment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-zinc-400">Loading delivery logs...</TableCell></TableRow>
            ) : deliveries.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-6 text-zinc-400">No delivery receipts recorded.</TableCell></TableRow>
            ) : deliveries.map((d) => {
              const totalCost = Number(d.unitBuyPrice) * d.quantityReceived;
              return (
                <TableRow key={d.id}>
                  <TableCell className="font-medium text-zinc-900">{new Date(d.createdAt).toISOString().slice(0, 10)}</TableCell>
                  <TableCell>{d.supplier?.name || 'Supplier'}</TableCell>
                  <TableCell>{d.stockItem?.name || d.product?.name || 'Raw Material'}</TableCell>
                  <TableCell className="font-semibold">{d.quantityReceived} {d.stockItem?.unitType || ''}</TableCell>
                  <TableCell>{Number(d.unitBuyPrice).toFixed(2)} ETB</TableCell>
                  <TableCell className="font-bold text-zinc-900">{totalCost.toFixed(2)} ETB</TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => togglePaymentStatus(d.id, d.isPaid)}
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        d.isPaid 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' 
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                      }`}
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

      {/* Add Supplier Modal */}
      {isAddSupplierOpen && (
        <Dialog open={true} onOpenChange={() => setIsAddSupplierOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Register New Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSupplier} className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier Name</label>
                <Input name="name" required placeholder="e.g. Flour Factory / Milk Dairy" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Phone Number</label>
                <Input name="phone" placeholder="e.g. 0911223344" />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Supplier Type</label>
                <select name="type" required className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                  <option value="GENERAL">GENERAL</option>
                  <option value="MILK">MILK</option>
                  <option value="INJERA">INJERA</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddSupplierOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Registering...' : 'Register Supplier'}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Log Delivery Receipt Modal */}
      {isLogDeliveryOpen && (
        <Dialog open={true} onOpenChange={() => setIsLogDeliveryOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log Supplier Delivery Receipt</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLogDelivery} className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-1 block">Select Supplier</label>
                <select name="supplierId" required className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                  <option value="" disabled>Choose Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.type})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Resell Product (e.g. Injera, Soft Drink, Milk)</label>
                <select name="productId" required className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                  <option value="" disabled>Choose Product</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.flavor ? `(${p.flavor})` : ''}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Qty Received</label>
                  <Input name="quantityReceived" type="number" step="0.01" required placeholder="e.g. 50" />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Unit Buy Price (ETB)</label>
                  <Input name="unitBuyPrice" type="number" step="0.01" required placeholder="e.g. 120" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-1 block">Payment Status</label>
                <select name="isPaid" required className="w-full border rounded-md h-10 px-3 border-input bg-background text-sm">
                  <option value="true">PAID Immediately</option>
                  <option value="false">UNPAID (Add to Accounts Payable)</option>
                </select>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsLogDeliveryOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-zinc-900 text-white hover:bg-zinc-800">
                  {isSubmitting ? 'Recording...' : 'Record Delivery & Update Stock'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
