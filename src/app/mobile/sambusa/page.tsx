'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Flame,
  Plus,
  Minus,
  Check,
  Lock,
  AlertTriangle,
  Sun,
  Moon,
  History,
  Clock,
  CheckCircle2,
  Hourglass,
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

interface ProductionBatch {
  id: string;
  shift: 'DAY' | 'NIGHT';
  status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  user?: { fullName: string; role: string };
  items: ProductionBatchItem[];
}

export default function MobileSambusaStation() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [activeTab, setActiveTab] = useState<'NEW_BATCH' | 'SHIFT_HISTORY'>('NEW_BATCH');

  // Auto detect current shift
  const currentHour = new Date().getHours();
  const defaultShift: 'DAY' | 'NIGHT' = currentHour >= 6 && currentHour < 18 ? 'DAY' : 'NIGHT';
  const [selectedShift, setSelectedShift] = useState<'DAY' | 'NIGHT'>(defaultShift);

  const [products, setProducts] = useState<Product[]>([]);
  const [producedCounts, setProducedCounts] = useState<Record<string, number>>({});
  const [historyBatches, setHistoryBatches] = useState<ProductionBatch[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchSambusaData();
  }, [user, selectedShift, activeTab]);

  const fetchSambusaData = async () => {
    setIsLoading(true);
    try {
      const branchParam = user?.branchId ? { branchId: user.branchId } : {};
      const [prodRes, sessRes] = await Promise.all([
        api.get('/products?isActive=true'),
        api.get('/daily-sessions/active', { params: branchParam }).catch(() => ({ data: null })),
      ]);

      setProducts(prodRes.data || []);
      setActiveSession(sessRes.data);

      const initial: Record<string, number> = {};
      (prodRes.data || []).forEach((p: Product) => {
        initial[p.id] = 0;
      });
      setProducedCounts(initial);

      // Fetch shift history for Sambusa role
      if (user?.branchId) {
        const histRes = await api.get('/production-batches', {
          params: {
            branchId: user.branchId,
            shift: selectedShift,
            role: user.role,
          },
        });
        setHistoryBatches(histRes.data || []);
      }
    } catch (e) {
      toast.error('Failed to load Sambusa station');
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

  const updateCount = (productId: string, delta: number) => {
    if (!isSessionOpen) return;
    setProducedCounts((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [productId]: updated };
    });
  };

  const handleSubmitSambusaShift = async () => {
    if (!isSessionOpen) {
      toast.error(`Cannot log production: Daily session is ${sessionStatusLabel}`);
      return;
    }

    setIsSubmitting(true);
    const itemsPayload = Object.entries(producedCounts)
      .filter(([_, qty]) => qty > 0)
      .map(([productId, quantityProduced]) => ({
        productId,
        quantityProduced,
      }));

    if (itemsPayload.length === 0) {
      toast.error('Please enter at least one produced item quantity');
      setIsSubmitting(false);
      return;
    }

    try {
      await api.post('/production-batches', {
        branchId: user?.branchId,
        shift: selectedShift,
        items: itemsPayload,
        materials: [],
      });

      toast.success(`${selectedShift} Shift Sambusa production logged!`);
      // Reset counters
      const resetCounts: Record<string, number> = {};
      products.forEach((p) => (resetCounts[p.id] = 0));
      setProducedCounts(resetCounts);

      fetchSambusaData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to log production');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalShiftProduced = historyBatches.reduce((acc, b) => {
    return acc + b.items.reduce((iAcc, item) => iAcc + item.quantityProduced, 0);
  }, 0);

  const isGlobalAdmin = user?.role === 'OWNER' || user?.role === 'ADMIN';

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between pb-6 font-sans">
      {/* Top Header */}
      <div className="bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-20 flex items-center justify-between shadow-lg">
        <div className="flex items-center space-x-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-zinc-800 text-zinc-300 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-rose-500" /> Sambusa Station
            </h1>
            <p className="text-[11px] text-zinc-400">{user?.fullName || 'Worker'} • {user?.role}</p>
          </div>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wider uppercase border ${
          isSessionOpen
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse'
            : activeSession?.status === 'PAUSED'
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
        }`}>
          Session {sessionStatusLabel}
        </span>
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
            <Plus className="w-4 h-4 text-rose-500" /> Log Sambusa Output
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
      <div className="p-4 flex-1 space-y-4 overflow-y-auto">
        {!isSessionOpen && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-300 text-xs font-semibold">
            {activeSession?.status === 'PAUSED' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Lock className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span>
              Daily session is <strong>{sessionStatusLabel}</strong>. Production logging is disabled until session is opened.
            </span>
          </div>
        )}

        {/* TAB 1: LOG SAMBUSA */}
        {activeTab === 'NEW_BATCH' && (
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-rose-400 px-1">
              Tap + / - to Log {selectedShift} Shift Sambusa Output
            </p>

            <div className="space-y-3">
              {products.map((p) => {
                const qty = producedCounts[p.id] || 0;
                return (
                  <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-md">
                    <div>
                      <p className="font-extrabold text-base text-white">{p.name}</p>
                      {p.flavor && <p className="text-xs text-zinc-400">{p.flavor}</p>}
                    </div>

                    <div className="flex items-center space-x-3 bg-zinc-950 border border-zinc-800 p-2 rounded-xl">
                      <button
                        type="button"
                        disabled={!isSessionOpen}
                        onClick={() => updateCount(p.id, -5)}
                        className="w-10 h-10 bg-zinc-900 text-zinc-300 disabled:opacity-40 rounded-lg font-bold"
                      >
                        -5
                      </button>
                      <span className="w-10 text-center text-xl font-extrabold font-mono text-rose-400">
                        {qty}
                      </span>
                      <button
                        type="button"
                        disabled={!isSessionOpen}
                        onClick={() => updateCount(p.id, 5)}
                        className="w-10 h-10 bg-rose-500 text-white disabled:opacity-40 rounded-lg font-bold shadow-md shadow-rose-500/20"
                      >
                        +5
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={handleSubmitSambusaShift}
              disabled={isSubmitting || !isSessionOpen}
              className="w-full h-14 bg-rose-500 hover:bg-rose-400 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-extrabold text-base rounded-xl shadow-lg shadow-rose-500/20"
            >
              {isSubmitting
                ? 'Logging...'
                : !isSessionOpen
                ? `Logging Disabled (${sessionStatusLabel})`
                : `Submit ${selectedShift} Shift Sambusa Production`}
            </Button>
          </div>
        )}

        {/* TAB 2: SHIFT HISTORY */}
        {activeTab === 'SHIFT_HISTORY' && (
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-400 block">
                  {selectedShift} SHIFT SAMBUSA SUMMARY ({user?.role})
                </span>
                {isGlobalAdmin ? (
                  <h2 className="text-xl font-extrabold text-white mt-0.5">
                    {totalShiftProduced.toLocaleString()} <span className="text-xs font-normal text-zinc-400">Total Sambusa Produced</span>
                  </h2>
                ) : (
                  <h2 className="text-base font-extrabold text-emerald-400 mt-0.5 flex items-center gap-1.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" /> Output Batches Logged
                  </h2>
                )}
              </div>
              <div className={`p-3 rounded-xl ${selectedShift === 'DAY' ? 'bg-amber-500/10 text-amber-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                {selectedShift === 'DAY' ? <Sun className="w-6 h-6" /> : <Moon className="w-6 h-6" />}
              </div>
            </div>

            {historyBatches.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl space-y-2">
                <Clock className="w-8 h-8 text-zinc-600 mx-auto" />
                <p className="text-xs font-bold text-zinc-400">No Sambusa production logged for this {selectedShift} shift yet.</p>
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
                          {b.user?.fullName || 'Worker'}
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

                    <div className="space-y-1">
                      {b.items.map((it) => (
                        <div key={it.id} className="flex items-center justify-between text-xs font-bold text-white bg-zinc-950 p-2 rounded-xl">
                          <span>{it.product?.name || 'Sambusa'}</span>
                          {isGlobalAdmin ? (
                            <span className="font-mono text-rose-400 font-extrabold">{it.quantityProduced} Pcs</span>
                          ) : (
                            <span className="text-[11px] font-semibold text-emerald-400">✓ Recorded</span>
                          )}
                        </div>
                      ))}
                    </div>

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
