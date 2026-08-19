'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { ChefHat, ShoppingBag, Flame, Store, LogOut, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function MobileWorkspaceSelector() {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center font-medium">
        Loading Mobile Workspace...
      </div>
    );
  }

  // Auto-route based on staff role
  const handleAutoRoute = () => {
    if (user.role === 'CASHIER') router.push('/mobile/cashier');
    else if (user.role === 'BAKER') router.push('/mobile/baker');
    else if (user.role === 'SAMBUSA_WORKER') router.push('/mobile/sambusa');
    else router.push('/mobile/cashier');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between p-6">
      {/* Top Header */}
      <div className="flex justify-between items-center pt-2">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center text-zinc-950 font-bold shadow-lg shadow-amber-500/20">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight">Bakery Mobile</h1>
            <p className="text-xs text-zinc-400">{user.fullName} ({user.role})</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={logout} className="text-zinc-400 hover:text-white hover:bg-zinc-900">
          <LogOut className="w-5 h-5" />
        </Button>
      </div>

      {/* Role Selection Cards */}
      <div className="my-auto space-y-4 py-8">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-400 text-center mb-2">
          Select Your Mobile Station
        </p>

        {/* Cashier Station Card */}
        <button
          onClick={() => router.push('/mobile/cashier')}
          className="w-full bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-98 shadow-md"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-xl flex items-center justify-center border border-emerald-500/20">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Cashier & Leftovers Station</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Session close, cash drawer float, leftover counting</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-500" />
        </button>

        {/* Baker Station Card */}
        <button
          onClick={() => router.push('/mobile/baker')}
          className="w-full bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-98 shadow-md"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-amber-500/10 text-amber-400 rounded-xl flex items-center justify-center border border-amber-500/20">
              <ChefHat className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Baker Station</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Quick batch entry, stock deduct, item conversions</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-500" />
        </button>

        {/* Sambusa Station Card */}
        <button
          onClick={() => router.push('/mobile/sambusa')}
          className="w-full bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 p-5 rounded-2xl flex items-center justify-between text-left transition-all active:scale-98 shadow-md"
        >
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-rose-500/10 text-rose-400 rounded-xl flex items-center justify-center border border-rose-500/20">
              <Flame className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Sambusa Station</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Shift output entry for Sambusa & fried items</p>
            </div>
          </div>
          <ArrowRight className="w-5 h-5 text-zinc-500" />
        </button>
      </div>

      {/* Auto Launch Button */}
      <div className="pb-4">
        <Button onClick={handleAutoRoute} className="w-full h-14 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-base rounded-xl shadow-lg shadow-amber-500/20">
          Launch My Station ({user.role})
        </Button>
      </div>
    </div>
  );
}
