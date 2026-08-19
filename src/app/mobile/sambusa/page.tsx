'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { ArrowLeft, Flame, Plus, Minus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: string;
}

export default function MobileSambusaStation() {
  const { user } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [producedCounts, setProducedCounts] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [user]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const { data } = await api.get('/products?isActive=true');
      setProducts(data);
      const initial: Record<string, number> = {};
      data.forEach((p: Product) => {
        initial[p.id] = 0;
      });
      setProducedCounts(initial);
    } catch (e) {
      toast.error('Failed to load Sambusa station');
    } finally {
      setIsLoading(false);
    }
  };

  const updateCount = (productId: string, delta: number) => {
    setProducedCounts((prev) => {
      const current = prev[productId] || 0;
      const updated = Math.max(0, current + delta);
      return { ...prev, [productId]: updated };
    });
  };

  const handleSubmitSambusaShift = async () => {
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
        items: itemsPayload,
        materials: [], // Sambusa worker output logged directly
      });

      toast.success('Sambusa shift production logged successfully!');
      fetchProducts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to log production');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between pb-6">
      {/* Top Header */}
      <div className="bg-zinc-900/80 backdrop-blur-md border-b border-zinc-800 p-4 sticky top-0 z-20 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Link href="/mobile" className="p-2 rounded-xl bg-zinc-800 text-zinc-300 active:scale-95 transition-all">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center">
              <Flame className="w-4 h-4 mr-1.5 text-rose-500" /> Sambusa Station
            </h1>
            <p className="text-[11px] text-zinc-400">{user?.branch?.name || 'Shift Production'}</p>
          </div>
        </div>
      </div>

      {/* Main Counter Body */}
      <div className="p-4 flex-1 space-y-4 overflow-y-auto">
        <p className="text-xs font-bold uppercase tracking-wider text-rose-400 px-1">
          Tap + / - to Log Sambusa Shift Output
        </p>

        <div className="space-y-3">
          {products.map((p) => {
            const qty = producedCounts[p.id] || 0;
            return (
              <div key={p.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-md">
                <div>
                  <p className="font-bold text-base text-white">{p.name}</p>
                  {p.flavor && <p className="text-xs text-zinc-400">{p.flavor}</p>}
                </div>

                <div className="flex items-center space-x-3 bg-zinc-950 border border-zinc-800 p-2 rounded-xl">
                  <button
                    type="button"
                    onClick={() => updateCount(p.id, -5)}
                    className="w-10 h-10 bg-zinc-900 text-zinc-300 rounded-lg font-bold"
                  >
                    -5
                  </button>
                  <span className="w-10 text-center text-xl font-extrabold font-mono text-rose-400">
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateCount(p.id, 5)}
                    className="w-10 h-10 bg-rose-500 text-white rounded-lg font-bold shadow-md shadow-rose-500/20"
                  >
                    +5
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky Bottom Action */}
      <div className="p-4 bg-zinc-900/90 backdrop-blur-md border-t border-zinc-800">
        <Button
          onClick={handleSubmitSambusaShift}
          disabled={isSubmitting}
          className="w-full h-14 bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-base rounded-xl shadow-lg shadow-rose-500/20"
        >
          {isSubmitting ? 'Logging...' : 'Log Sambusa Shift Production'}
        </Button>
      </div>
    </div>
  );
}
