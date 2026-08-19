'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingBag, Lock, Plus, Minus, DollarSign, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: string;
  basePrice: number;
}

interface ActiveSession {
  id: string;
  branchId: string;
  date: string;
  status: 'OPEN' | 'CLOSED';
}

export default function MobileCashierStation() {
  const { user } = useAuth();
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [leftoverCounts, setLeftoverCounts] = useState<Record<string, number>>({});
  const [cashFloat, setCashFloat] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCashierData();
  }, [user]);

  const fetchCashierData = async () => {
    setIsLoading(true);
    try {
      const [sessRes, prodRes] = await Promise.all([
        api.get('/daily-sessions'),
        api.get('/products?isActive=true'),
      ]);
      
      const openSess = Array.isArray(sessRes.data) 
        ? sessRes.data.find((s: ActiveSession) => s.status === 'OPEN')
        : null;

      setActiveSession(openSess || null);
      setProducts(prodRes.data);

      const initial: Record<string, number> = {};
      prodRes.data.forEach((p: Product) => {
        initial[p.id] = 0;
      });
      setLeftoverCounts(initial);
    } catch (e: any) {
      toast.error('Failed to load cashier station');
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = (productId: string, delta: number) => {
    setLeftoverCounts((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [productId]: updated };
    });
  };

  const handleFinalizeSession = async () => {
    if (!activeSession) {
      toast.error('No active open session to finalize');
      return;
    }

    setIsSubmitting(true);
    const leftoversPayload = Object.entries(leftoverCounts).map(([productId, quantityRemaining]) => ({
      productId,
      quantityRemaining,
    }));

    try {
      await api.post(`/daily-sessions/${activeSession.id}/finalize`, {
        cashLeftoverAmount: cashFloat ? Number(cashFloat) : null,
        leftoverRecords: leftoversPayload,
      });

      toast.success('Session finalized! Sales calculated & closed.');
      fetchCashierData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to finalize session');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between pb-6">
      {/* Top Mobile Bar */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-zinc-800 text-zinc-300 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center">
              <ShoppingBag className="w-4 h-4 mr-1.5 text-emerald-400" /> Cashier & Leftovers
            </h1>
            <p className="text-[11px] text-zinc-400">{user?.branch?.name || 'Branch Session'}</p>
          </div>
        </div>

        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
          activeSession 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 animate-pulse' 
            : 'bg-zinc-800 text-zinc-400 border-zinc-700'
        }`}>
          {activeSession ? 'Session Open' : 'Session Closed'}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
        {!activeSession ? (
          <div className="my-12 text-center p-8 bg-zinc-900 border border-zinc-800 rounded-2xl space-y-4">
            <Lock className="w-12 h-12 text-zinc-600 mx-auto" />
            <h2 className="text-lg font-bold text-white">No Active Open Session</h2>
            <p className="text-xs text-zinc-400 max-w-xs mx-auto">
              Ask your Branch Admin or Owner to start a new business session for today.
            </p>
          </div>
        ) : (
          <>
            {/* Step 1: Cash Drawer Float Pad */}
            <div className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center">
                <DollarSign className="w-4 h-4 mr-1" /> Remaining Cash Float (ETB)
              </label>
              <input
                type="number"
                placeholder="0.00"
                value={cashFloat}
                onChange={(e) => setCashFloat(e.target.value)}
                className="w-full h-14 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xl font-mono font-bold text-emerald-400 focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Step 2: Touch Leftover Counters */}
            <div className="space-y-3">
              <div className="flex justify-between items-center px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                  Unsold Food Leftovers Counter
                </h3>
                <span className="text-[11px] text-zinc-500">Tap + / - to count</span>
              </div>

              <div className="space-y-2.5">
                {products.map((p) => {
                  const qty = leftoverCounts[p.id] || 0;
                  return (
                    <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-3.5 rounded-2xl flex items-center justify-between">
                      <div>
                        <p className="font-bold text-sm text-white">{p.name}</p>
                        {p.flavor && <p className="text-[11px] text-zinc-400">{p.flavor}</p>}
                        <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{p.basePrice} ETB / {p.unitType}</p>
                      </div>

                      {/* Large Touch Counter Buttons */}
                      <div className="flex items-center space-x-3 bg-zinc-950 border border-zinc-800 p-1.5 rounded-xl">
                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, -1)}
                          className="w-10 h-10 bg-zinc-900 text-zinc-300 rounded-lg flex items-center justify-center font-bold active:scale-90 transition-all border border-zinc-800"
                        >
                          <Minus className="w-4 h-4" />
                        </button>

                        <span className="w-8 text-center text-lg font-extrabold font-mono text-amber-400">
                          {qty}
                        </span>

                        <button
                          type="button"
                          onClick={() => updateQuantity(p.id, 1)}
                          className="w-10 h-10 bg-amber-500 text-zinc-950 rounded-lg flex items-center justify-center font-bold active:scale-90 transition-all shadow-md shadow-amber-500/20"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Action Button */}
      {activeSession && (
        <div className="p-4 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800">
          <Button
            onClick={handleFinalizeSession}
            disabled={isSubmitting}
            className="w-full h-14 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-extrabold text-base rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center"
          >
            {isSubmitting ? 'Calculating & Closing...' : 'Close Session & Compute Sales'}
          </Button>
        </div>
      )}
    </div>
  );
}
