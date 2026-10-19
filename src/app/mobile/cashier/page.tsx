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
        api.get('/daily-sessions/active').catch(() => ({ data: null })),
        api.get('/products?isActive=true'),
      ]);
      
      setActiveSession(sessRes.data || null);
      setProducts(prodRes.data || []);

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

  const handleSaveLeftovers = async () => {
    setIsSubmitting(true);
    const leftoversPayload = Object.entries(leftoverCounts).map(([productId, quantityRemaining]) => ({
      productId,
      quantityRemaining,
    }));

    try {
      if (activeSession) {
        await api.post(`/daily-sessions/${activeSession.id}/submit-close`, {
          cashLeftoverAmount: cashFloat ? Number(cashFloat) : null,
          leftoverRecords: leftoversPayload,
        });
        toast.success('Day close submitted for approval!');
      } else {
        await api.post('/leftover-records', {
          branchId: user?.branchId,
          date: new Date().toISOString().slice(0, 10),
          records: leftoversPayload,
        });
        toast.success('Leftovers saved successfully!');
      }
      fetchCashierData();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to submit leftovers');
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
            <p className="text-[11px] text-zinc-400">{user?.branch?.name || 'Branch Day'}</p>
          </div>
        </div>

        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase border bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
          {activeSession ? 'Session Open' : 'Day Register Active'}
        </span>
      </div>

      {/* Main Content Area */}
      <div className="p-4 flex-1 space-y-6 overflow-y-auto">
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
      </div>

      {/* Sticky Bottom Action Buttons */}
      <div className="p-4 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800 space-y-2">
        <Button
          onClick={handleSaveLeftovers}
          disabled={isSubmitting}
          className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-base rounded-xl shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2"
        >
          <CheckCircle2 className="w-5 h-5" />
          {isSubmitting ? 'Saving...' : 'Save Cash & Leftovers'}
        </Button>

        {activeSession && (
          <Link
            href={`/daily-sessions/${activeSession.id}/close`}
            className="w-full h-11 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold text-xs rounded-xl flex items-center justify-center gap-2"
          >
            <Lock className="w-4 h-4" /> Open Full Close Form & Submit for Approval
          </Link>
        )}
      </div>
    </div>
  );
}
