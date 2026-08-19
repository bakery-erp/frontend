'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, ChefHat, Plus, Minus, ArrowRightLeft, PackageCheck, AlertCircle, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: string;
}

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
}

export default function MobileBakerStation() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'BATCH' | 'CONVERT' | 'DELIVERY'>('BATCH');
  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [producedQty, setProducedQty] = useState<number>(100);
  const [materialsUsed, setMaterialsUsed] = useState<Record<string, number>>({});

  // Conversion Form State
  const [sourceProductId, setSourceProductId] = useState<string>('');
  const [targetProductId, setTargetProductId] = useState<string>('');
  const [sourceQty, setSourceQty] = useState<number>(1);
  const [targetQty, setTargetQty] = useState<number>(8);

  useEffect(() => {
    fetchBakerData();
  }, [user]);

  const fetchBakerData = async () => {
    setIsLoading(true);
    try {
      const [prodRes, stockRes] = await Promise.all([
        api.get('/products?isActive=true'),
        api.get('/stock-items'),
      ]);
      setProducts(prodRes.data);
      setStockItems(stockRes.data);
      if (prodRes.data.length > 0) {
        setSelectedProductId(prodRes.data[0].id);
        setSourceProductId(prodRes.data[0].id);
      }
      if (prodRes.data.length > 1) {
        setTargetProductId(prodRes.data[1].id);
      }

      const initialMat: Record<string, number> = {};
      stockRes.data.forEach((s: StockItem) => {
        initialMat[s.id] = 0;
      });
      setMaterialsUsed(initialMat);
    } catch (e) {
      toast.error('Failed to load baker station');
    } finally {
      setIsLoading(false);
    }
  };

  const updateMaterialQty = (stockItemId: string, delta: number) => {
    setMaterialsUsed((prev) => {
      const current = prev[stockItemId] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [stockItemId]: updated };
    });
  };

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductId) {
      toast.error('Please select a product');
      return;
    }

    setIsSubmitting(true);
    const materialsPayload = Object.entries(materialsUsed)
      .filter(([_, qty]) => qty > 0)
      .map(([stockItemId, quantityUsed]) => ({
        stockItemId,
        quantityUsed,
      }));

    try {
      await api.post('/production-batches', {
        branchId: user?.branchId,
        items: [{ productId: selectedProductId, quantityProduced: Number(producedQty) }],
        materials: materialsPayload,
      });

      toast.success('Production Batch created! Stock deducted atomically.');
      fetchBakerData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Batch creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateConversion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceProductId || !targetProductId) {
      toast.error('Please select source and target products');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/product-conversions', {
        branchId: user?.branchId,
        sourceProductId,
        targetProductId,
        sourceQuantity: Number(sourceQty),
        targetQuantity: Number(targetQty),
      });

      toast.success('Product conversion complete!');
      fetchBakerData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Conversion failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between pb-6">
      {/* Top Mobile Header */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-zinc-800 text-zinc-300 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center">
              <ChefHat className="w-4 h-4 mr-1.5 text-amber-400" /> Baker Station
            </h1>
            <p className="text-[11px] text-zinc-400">{user?.branch?.name || 'Main Branch'}</p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 flex space-x-2">
        <button
          onClick={() => setActiveTab('BATCH')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'BATCH'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-950 text-zinc-400 hover:text-white'
          }`}
        >
          🥣 New Batch
        </button>
        <button
          onClick={() => setActiveTab('CONVERT')}
          className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all ${
            activeTab === 'CONVERT'
              ? 'bg-amber-500 text-zinc-950 shadow-md shadow-amber-500/20'
              : 'bg-zinc-950 text-zinc-400 hover:text-white'
          }`}
        >
          🔄 Conversion
        </button>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        {activeTab === 'BATCH' && (
          <form onSubmit={handleCreateBatch} className="space-y-6">
            {/* Select Target Output Product */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                1. Select Produced Bread / Item
              </label>

              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm font-semibold text-white focus:outline-none focus:border-amber-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unitType})
                  </option>
                ))}
              </select>

              <div className="pt-2">
                <label className="text-xs text-zinc-400 block mb-1">Quantity Produced</label>
                <div className="flex items-center space-x-3 bg-zinc-950 border border-zinc-800 p-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setProducedQty(Math.max(1, producedQty - 10))}
                    className="w-10 h-10 bg-zinc-900 text-zinc-300 rounded-lg font-bold"
                  >
                    -10
                  </button>
                  <input
                    type="number"
                    value={producedQty}
                    onChange={(e) => setProducedQty(Number(e.target.value))}
                    className="flex-1 bg-transparent text-center text-xl font-mono font-bold text-amber-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setProducedQty(producedQty + 10)}
                    className="w-10 h-10 bg-amber-500 text-zinc-950 rounded-lg font-bold"
                  >
                    +10
                  </button>
                </div>
              </div>
            </div>

            {/* Select Raw Materials Consumed */}
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 block px-1">
                2. Raw Materials Consumed (Flour, Yeast, Butter)
              </label>

              <div className="space-y-2.5">
                {stockItems.map((st) => {
                  const qty = materialsUsed[st.id] || 0;
                  return (
                    <div key={st.id} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-white">{st.name}</p>
                        <p className="text-[11px] text-zinc-400">Available: {st.currentQuantity} {st.unitType}</p>
                      </div>

                      <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-800 p-1.5 rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateMaterialQty(st.id, -1)}
                          className="w-9 h-9 bg-zinc-900 text-zinc-300 rounded-lg font-bold"
                        >
                          -1
                        </button>
                        <span className="w-8 text-center text-sm font-extrabold font-mono text-amber-400">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateMaterialQty(st.id, 1)}
                          className="w-9 h-9 bg-amber-500 text-zinc-950 rounded-lg font-bold"
                        >
                          +1
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-base rounded-xl shadow-lg shadow-amber-500/20"
            >
              {isSubmitting ? 'Creating Batch...' : 'Submit Batch & Deduct Stock'}
            </Button>
          </form>
        )}

        {activeTab === 'CONVERT' && (
          <form onSubmit={handleCreateConversion} className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Product Item Conversion
              </h3>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Source Product (Original)</label>
                <select
                  value={sourceProductId}
                  onChange={(e) => setSourceProductId(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Source Quantity"
                  value={sourceQty}
                  onChange={(e) => setSourceQty(Number(e.target.value))}
                  className="w-full h-12 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-white font-mono font-bold"
                />
              </div>

              <div className="text-center text-zinc-500 text-xs font-mono">⬇ Converts Into ⬇</div>

              <div>
                <label className="text-xs text-zinc-400 block mb-1">Target Product (Converted)</label>
                <select
                  value={targetProductId}
                  onChange={(e) => setTargetProductId(e.target.value)}
                  className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-white"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Target Quantity"
                  value={targetQty}
                  onChange={(e) => setTargetQty(Number(e.target.value))}
                  className="w-full h-12 mt-2 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm text-white font-mono font-bold"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-base rounded-xl"
            >
              {isSubmitting ? 'Converting...' : 'Confirm Conversion'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
