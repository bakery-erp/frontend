'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  ChefHat,
  Plus,
  Minus,
  PackageCheck,
  AlertTriangle,
  Lock,
  Sun,
  Moon,
  Clock,
  CheckCircle2,
  Hourglass,
  History,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: string;
  category?: { name: string; type: string };
}

interface StockItem {
  id: string;
  name: string;
  unitType: string;
  currentQuantity: number;
}

interface ActiveSession {
  id: string;
  status: 'OPEN' | 'PAUSED' | 'CLOSE_PENDING' | 'CLOSED';
}

interface ProductionBatchItem {
  id: string;
  productId: string;
  product?: { name: string; unitType: string };
  quantityProduced: number;
}

interface MaterialUsage {
  id: string;
  stockItemId: string;
  stockItem?: { name: string; unitType: string };
  quantityUsed: number;
}

interface ProductionBatch {
  id: string;
  shift: 'DAY' | 'NIGHT';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user?: { fullName: string; role: string };
  items: ProductionBatchItem[];
  materialUsages: MaterialUsage[];
}

export default function MobileBakerStation() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeTab, setActiveTab] = useState<'NEW_BATCH' | 'SHIFT_HISTORY'>('NEW_BATCH');
  
  // Shift state (DAY or NIGHT) - auto detect
  const currentHour = new Date().getHours();
  const defaultShift: 'DAY' | 'NIGHT' = currentHour >= 6 && currentHour < 18 ? 'DAY' : 'NIGHT';
  const [selectedShift, setSelectedShift] = useState<'DAY' | 'NIGHT'>(defaultShift);

  const [products, setProducts] = useState<Product[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [historyBatches, setHistoryBatches] = useState<ProductionBatch[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Batch Form State
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [producedQty, setProducedQty] = useState<number>(100);
  const [materialsUsed, setMaterialsUsed] = useState<Record<string, number>>({});

  useEffect(() => {
    fetchBakerData();
  }, [user, selectedShift, activeTab]);

  const fetchBakerData = async () => {
    setIsLoading(true);
    try {
      const branchParam = user?.branchId ? { branchId: user.branchId } : {};
      const [prodRes, stockRes, sessRes] = await Promise.all([
        api.get('/products?isActive=true'),
        api.get('/stock-items'),
        api.get('/daily-sessions/active', { params: branchParam }).catch(() => ({ data: null })),
      ]);

      // Filter products for Bakery output (exclude resell drinks/water)
      const bakeryProducts = (prodRes.data || []).filter(
        (p: Product) => p.category?.type !== 'RESELL'
      );
      setProducts(bakeryProducts.length > 0 ? bakeryProducts : prodRes.data);
      setStockItems(stockRes.data || []);
      setActiveSession(sessRes.data);

      if (bakeryProducts.length > 0) {
        setSelectedProductId(bakeryProducts[0].id);
      }

      // Initialize materials map
      const initialMat: Record<string, number> = {};
      (stockRes.data || []).forEach((s: StockItem) => {
        initialMat[s.id] = 0;
      });
      setMaterialsUsed(initialMat);

      // Fetch personalized shift history for this user & shift
      if (user?.branchId) {
        const histRes = await api.get('/production-batches', {
          params: {
            branchId: user.branchId,
            shift: selectedShift,
            userId: isGlobalAdmin ? undefined : user.id,
          },
        });
        setHistoryBatches(histRes.data || []);
      }
    } catch (e) {
      toast.error('Failed to load baker station data');
    } finally {
      setIsLoading(false);
    }
  };

  const isSessionOpen = activeSession?.status === 'OPEN';
  const sessionStatusLabel = !activeSession
    ? 'CLOSED'
    : activeSession.status === 'PAUSED'
    ? 'PAUSED'
    : activeSession.status === 'CLOSE_PENDING'
    ? 'CLOSING'
    : 'OPEN';

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

    if (!isSessionOpen) {
      toast.error(`Daily session is ${sessionStatusLabel}. Cannot log production.`);
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
        shift: selectedShift,
        items: [{ productId: selectedProductId, quantityProduced: Number(producedQty) }],
        materials: materialsPayload,
      });

      toast.success(`${selectedShift} Shift production batch logged successfully!`);
      // Reset raw material inputs
      const resetMat: Record<string, number> = {};
      stockItems.forEach((s) => (resetMat[s.id] = 0));
      setMaterialsUsed(resetMat);
      
      fetchBakerData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Batch creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate shift totals
  const totalShiftProduced = historyBatches.reduce((acc, b) => {
    return acc + b.items.reduce((iAcc, item) => iAcc + item.quantityProduced, 0);
  }, 0);

  const isGlobalAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between pb-6 font-sans">
      {/* Top Mobile Header */}
      <div className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-20 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-zinc-800 text-zinc-300 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-amber-400" /> Baker Station
            </h1>
            <p className="text-[11px] text-zinc-400">{user?.fullName || 'Baker'} • {user?.role}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
              isSessionOpen
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
                : activeSession?.status === 'PAUSED'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
            }`}
          >
            {sessionStatusLabel}
          </span>
        </div>
      </div>

      {/* Shift Toggle & Tab Selector Bar */}
      <div className="p-4 bg-zinc-900 border-b border-zinc-800 space-y-3">
        {/* Shift Picker (Day / Night) - Visible only for Admin/Owner */}
        {isGlobalAdmin && (
          <div className="bg-zinc-950 p-1 rounded-xl border border-zinc-800 flex items-center">
            <button
              type="button"
              onClick={() => setSelectedShift('DAY')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                selectedShift === 'DAY'
                  ? 'bg-amber-500 text-zinc-950 shadow-md font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Sun className="w-3.5 h-3.5" /> Day Shift (ቀን)
            </button>

            <button
              type="button"
              onClick={() => setSelectedShift('NIGHT')}
              className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${
                selectedShift === 'NIGHT'
                  ? 'bg-indigo-600 text-white shadow-md font-extrabold'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Moon className="w-3.5 h-3.5" /> Night Shift (ማታ)
            </button>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('NEW_BATCH')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'NEW_BATCH'
                ? 'bg-zinc-100 text-zinc-950 font-extrabold shadow'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <Plus className="w-4 h-4 text-amber-500" /> New Production Batch
          </button>

          <button
            onClick={() => setActiveTab('SHIFT_HISTORY')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'SHIFT_HISTORY'
                ? 'bg-zinc-100 text-zinc-950 font-extrabold shadow'
                : 'bg-zinc-950 text-zinc-400 hover:text-white border border-zinc-800'
            }`}
          >
            <History className="w-4 h-4 text-indigo-400" /> Shift History ({historyBatches.length})
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 space-y-5 overflow-y-auto">
        {!isSessionOpen && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-300 text-xs font-semibold">
            {activeSession?.status === 'PAUSED' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>
              Daily session is <strong>{sessionStatusLabel}</strong>. Batch logging is disabled until session is opened.
            </span>
          </div>
        )}

        {/* TAB 1: NEW BATCH FORM */}
        {activeTab === 'NEW_BATCH' && (
          <form onSubmit={handleCreateBatch} className="space-y-5">
            {/* 1. Select Bread / Bakery Product */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-md">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 block">
                1. Select Produced Bread / Bakery Item
              </label>

              <select
                disabled={!isSessionOpen}
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-sm font-bold text-white focus:outline-none focus:border-amber-500 disabled:opacity-50"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.unitType})
                  </option>
                ))}
              </select>

              <div className="pt-2">
                <label className="text-xs text-zinc-400 block mb-1">Quantity Produced (Pcs)</label>
                <div className="flex items-center space-x-3 bg-zinc-950 border border-zinc-800 p-2 rounded-xl">
                  <button
                    type="button"
                    disabled={!isSessionOpen}
                    onClick={() => setProducedQty(Math.max(1, producedQty - 10))}
                    className="w-11 h-11 bg-zinc-900 text-zinc-300 disabled:opacity-40 rounded-xl font-extrabold text-base active:scale-95"
                  >
                    -10
                  </button>
                  <input
                    type="number"
                    disabled={!isSessionOpen}
                    value={producedQty}
                    onChange={(e) => setProducedQty(Number(e.target.value))}
                    className="flex-1 bg-transparent text-center text-2xl font-mono font-extrabold text-amber-400 focus:outline-none disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={!isSessionOpen}
                    onClick={() => setProducedQty(producedQty + 10)}
                    className="w-11 h-11 bg-amber-500 text-zinc-950 disabled:opacity-40 rounded-xl font-extrabold text-base active:scale-95 shadow-md shadow-amber-500/20"
                  >
                    +10
                  </button>
                </div>
              </div>
            </div>

            {/* 2. Select Raw Materials Consumed */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  2. Raw Materials Consumed (Flour, Yeast, Sugar, Oil)
                </label>
              </div>

              <div className="space-y-2.5">
                {stockItems.map((st) => {
                  const qty = materialsUsed[st.id] || 0;
                  return (
                    <div key={st.id} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl flex items-center justify-between shadow-sm">
                      <div>
                        <p className="font-extrabold text-sm text-white">{st.name}</p>
                        <p className="text-[11px] text-zinc-400">In Stock: <strong className="text-zinc-200">{st.currentQuantity} {st.unitType}</strong></p>
                      </div>

                      <div className="flex items-center space-x-2 bg-zinc-950 border border-zinc-800 p-1.5 rounded-xl">
                        <button
                          type="button"
                          disabled={!isSessionOpen}
                          onClick={() => updateMaterialQty(st.id, -1)}
                          className="w-9 h-9 bg-zinc-900 text-zinc-300 disabled:opacity-40 rounded-lg font-bold"
                        >
                          -1
                        </button>
                        <span className="w-8 text-center text-sm font-extrabold font-mono text-amber-400">
                          {qty}
                        </span>
                        <button
                          type="button"
                          disabled={!isSessionOpen}
                          onClick={() => updateMaterialQty(st.id, 1)}
                          className="w-9 h-9 bg-amber-500 text-zinc-950 disabled:opacity-40 rounded-lg font-bold"
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
              disabled={isSubmitting || !isSessionOpen}
              className="w-full h-14 bg-amber-500 hover:bg-amber-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-zinc-950 font-extrabold text-base rounded-xl shadow-lg shadow-amber-500/20"
            >
              {isSubmitting
                ? 'Logging Batch...'
                : !isSessionOpen
                ? `Logging Disabled (${sessionStatusLabel})`
                : `Submit ${selectedShift} Shift Batch`}
            </Button>
          </form>
        )}

        {/* TAB 2: PERSONALIZED SHIFT HISTORY */}
        {activeTab === 'SHIFT_HISTORY' && (
          <div className="space-y-4">
            {/* Shift Summary Banner */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                  {selectedShift} SHIFT PRODUCTION SUMMARY ({user?.role})
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  {totalShiftProduced.toLocaleString()} <span className="text-xs font-normal text-zinc-400">Total Items Produced</span>
                </h2>
              </div>
              <div className={`p-3 rounded-xl ${selectedShift === 'DAY' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {selectedShift === 'DAY' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </div>
            </div>

            {historyBatches.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl space-y-2">
                <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">No production batches logged for this {selectedShift} shift yet.</p>
                <p className="text-[11px] text-zinc-500">Switch to "New Production Batch" to record your shift output.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyBatches.map((b) => (
                  <div key={b.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-3 shadow-md">
                    <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2.5">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                          b.shift === 'DAY' ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'
                        }`}>
                          {b.shift} Shift
                        </span>
                        <span className="text-xs font-bold text-zinc-300">
                          {b.user?.fullName || 'Baker'}
                        </span>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 ${
                        b.status === 'APPROVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      }`}>
                        {b.status === 'APPROVED' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" /> Approved
                          </>
                        ) : (
                          <>
                            <Hourglass className="w-3 h-3" /> Pending
                          </>
                        )}
                      </span>
                    </div>

                    {/* Produced Products */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-zinc-400 block uppercase">Produced Output:</span>
                      {b.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs font-bold text-white bg-zinc-950 p-2 rounded-xl">
                          <span>{it.product?.name || 'Bread Product'}</span>
                          <span className="font-mono text-amber-400 font-extrabold">{it.quantityProduced} {it.product?.unitType || 'Pcs'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Materials Used */}
                    {b.materialUsages.length > 0 && (
                      <div className="pt-1">
                        <span className="text-[10px] font-bold text-zinc-500 block mb-1 uppercase">Raw Materials Deducted:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {b.materialUsages.map((m) => (
                            <span key={m.id} className="px-2 py-1 bg-zinc-950 border border-zinc-800 text-[10px] text-zinc-300 rounded-lg font-mono">
                              {m.stockItem?.name}: <strong>{m.quantityUsed} {m.stockItem?.unitType}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="text-[10px] text-zinc-500 text-right font-mono">
                      Logged: {new Date(b.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
