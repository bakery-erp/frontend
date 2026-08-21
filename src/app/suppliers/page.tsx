'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { Truck, Plus, CheckCircle2, DollarSign, PackageCheck, Trash2 } from 'lucide-react';
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

interface DeliveryLineItem {
  productId: string;
  quantityReceived: string;
  unitBuyPrice: string;
  unitSellPrice: string;
}

export default function SuppliersPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
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
      ...prev,
      {
        productId: defaultProd ? defaultProd.id : '',
        quantityReceived: '',
        unitBuyPrice: defaultProd ? String(defaultProd.buyPrice || '') : '',
        unitSellPrice: defaultProd ? String(defaultProd.basePrice || '') : '',
      },
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

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-[#2C1B10] flex items-center gap-2">
            <Truck className="w-7 h-7 text-[#E87A18]" />
            Suppliers & Material Deliveries
          </h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
            Manage supplier directory, log raw material/resell deliveries, and track accounts payable.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setIsAddSupplierOpen(true)} variant="outline" className="border-[#EDE4D5] rounded-xl text-xs font-bold">
            + Add Supplier
          </Button>
          <Button onClick={openLogDeliveryModal} className="bg-[#E87A18] hover:bg-[#D66B0F] text-white rounded-xl text-xs font-bold flex items-center gap-1">
            <Plus className="w-4 h-4" /> Log Delivery Receipt
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#8C7361] uppercase">Active Suppliers</p>
            <h3 className="text-2xl font-black text-[#2C1B10] mt-1">{suppliers.length}</h3>
          </div>
          <div className="p-3 bg-[#FAF6F0] rounded-xl"><PackageCheck className="w-6 h-6 text-[#E87A18]" /></div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#8C7361] uppercase">Total Receipts</p>
            <h3 className="text-2xl font-black text-[#2C1B10] mt-1">{totalDeliveriesThisMonth}</h3>
          </div>
          <div className="p-3 bg-[#FAF6F0] rounded-xl"><CheckCircle2 className="w-6 h-6 text-emerald-600" /></div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-[#8C7361] uppercase">Accounts Payable (Unpaid)</p>
            <h3 className="text-2xl font-black text-amber-700 mt-1">{totalUnpaidAmount.toFixed(2)} ETB</h3>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl"><DollarSign className="w-6 h-6 text-amber-600" /></div>
        </div>
      </div>

      {/* Delivery Logs Table */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-sm mb-8">
        <div className="p-4 bg-[#FAF6F0] border-b border-[#EDE4D5] flex items-center justify-between">
          <h2 className="font-extrabold text-[#2C1B10] text-sm">Recent Supplier Deliveries</h2>
          <span className="text-xs text-[#8C7361]">Auto-increments stock quantity</span>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Delivery Date</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Stock Material / Item</TableHead>
              <TableHead>Qty Received</TableHead>
              <TableHead>Unit Cost</TableHead>
              <TableHead>Total Cost</TableHead>
              <TableHead className="text-right pr-6">Payment Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">Loading delivery logs...</TableCell></TableRow>
            ) : deliveries.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361]">No delivery receipts recorded.</TableCell></TableRow>
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
                  <TableCell className="text-right pr-6">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => togglePaymentStatus(d.id, d.isPaid)}
                      className={`px-3 py-1 rounded-full text-xs font-extrabold shadow-xs transition-all ${
                        d.isPaid 
                          ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300' 
                          : 'bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300'
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
          <DialogContent className="max-w-md bg-white border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-[#2C1B10] font-extrabold">Register New Supplier</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateSupplier} className="space-y-4 py-2">
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
                  <option value="GENERAL">GENERAL</option>
                  <option value="MILK">MILK</option>
                  <option value="INJERA">INJERA</option>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#FAF6F0] p-3 rounded-2xl border border-[#EDE4D5]">
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
                  <h4 className="text-xs font-extrabold text-[#4A2E1B] uppercase tracking-wider">
                    Delivery Line Items ({deliveryItems.length})
                  </h4>
                  <Button
                    type="button"
                    onClick={addDeliveryItemRow}
                    variant="outline"
                    className="border-[#E87A18] text-[#E87A18] hover:bg-amber-50 text-xs font-bold rounded-xl h-8 flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Product
                  </Button>
                </div>

                {deliveryItems.length === 0 ? (
                  <div className="text-center py-6 text-xs text-zinc-400 border border-dashed rounded-xl">
                    No items added. Click "+ Add Product" to begin.
                  </div>
                ) : (
                  <>
                    {/* Column Headers */}
                    <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1.5 bg-[#FAF6F0] rounded-xl text-[11px] font-extrabold text-[#4A2E1B] border border-[#EDE4D5]">
                      <div className="col-span-5">Product Name</div>
                      <div className="col-span-2 text-center">Qty Received</div>
                      <div className="col-span-2">Unit Buy Price (ETB)</div>
                      <div className="col-span-2">Unit Sell Price (ETB)</div>
                      <div className="col-span-1 text-center">Remove</div>
                    </div>

                    {deliveryItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-12 gap-2 items-center bg-zinc-50 p-2.5 rounded-xl border border-zinc-200">
                        <div className="col-span-12 sm:col-span-5">
                          <label className="text-[10px] font-bold text-[#4A2E1B] block mb-0.5 sm:hidden">Product Name</label>
                          <select
                            value={item.productId}
                            onChange={(e) => updateDeliveryItemRow(index, 'productId', e.target.value)}
                            className="w-full bg-white border border-zinc-300 rounded-lg h-9 text-xs px-2 font-medium"
                          >
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.unitType})
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[10px] font-bold text-[#4A2E1B] block mb-0.5 sm:hidden">Qty Received</label>
                          <Input
                            type="number"
                            placeholder="Qty"
                            title="Quantity Received"
                            value={item.quantityReceived}
                            onChange={(e) => updateDeliveryItemRow(index, 'quantityReceived', e.target.value)}
                            className="bg-white border-zinc-300 h-9 text-xs font-mono font-bold text-center"
                          />
                        </div>

                        <div className="col-span-4 sm:col-span-2">
                          <label className="text-[10px] font-bold text-[#4A2E1B] block mb-0.5 sm:hidden">Unit Buy Price (ETB)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Buy Price"
                            title="Unit Buy Price (ETB)"
                            value={item.unitBuyPrice}
                            onChange={(e) => updateDeliveryItemRow(index, 'unitBuyPrice', e.target.value)}
                            className="bg-white border-zinc-300 h-9 text-xs font-mono"
                          />
                        </div>

                        <div className="col-span-3 sm:col-span-2">
                          <label className="text-[10px] font-bold text-[#4A2E1B] block mb-0.5 sm:hidden">Unit Sell Price (ETB)</label>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Sell Price"
                            title="Unit Sell Price (ETB)"
                            value={item.unitSellPrice}
                            onChange={(e) => updateDeliveryItemRow(index, 'unitSellPrice', e.target.value)}
                            className="bg-white border-zinc-300 h-9 text-xs font-mono font-bold text-[#E87A18]"
                          />
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
                    ))}
                  </>
                )}
              </div>

              <DialogFooter className="pt-3 border-t border-[#EDE4D5]">
                <Button type="button" variant="outline" onClick={() => setIsLogDeliveryOpen(false)} className="border-[#EDE4D5] text-xs">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] text-xs font-bold">
                  {isSubmitting ? 'Recording...' : 'Record All Deliveries & Update Stock'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
