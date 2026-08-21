'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { CalendarDays, Plus, Lock, Utensils, RefreshCw, AlertTriangle, PauseCircle, PlayCircle, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface DailySession {
  id: string;
  branchId: string;
  date: string;
  label?: string | null;
  status: 'OPEN' | 'PAUSED' | 'CLOSE_PENDING' | 'CLOSED';
  cashLeftoverAmount?: number | null;
  createdAt: string;
  _count?: {
    sales: number;
    leftoverRecords: number;
  };
}

interface Product {
  id: string;
  name: string;
  flavor?: string;
  unitType: string;
  basePrice: number;
}

export default function DailySessionsPage() {
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const [sessions, setSessions] = useState<DailySession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const canManageSessions = user?.role === 'OWNER' || user?.role === 'ADMIN';

  // Finalize Session Modal State
  const [activeSession, setActiveSession] = useState<DailySession | null>(null);
  const [cashFloat, setCashFloat] = useState<string>('');
  const [leftoverCounts, setLeftoverCounts] = useState<Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Conversion Modal State
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [fromProductId, setFromProductId] = useState('');
  const [toProductId, setToProductId] = useState('');
  const [conversionQty, setConversionQty] = useState('1');
  const [isConverting, setIsConverting] = useState(false);

  useEffect(() => {
    fetchSessions();
  }, [selectedBranchId]);

  const fetchSessions = async () => {
    setIsLoading(true);
    try {
      const params: any = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const [sessRes, prodRes] = await Promise.all([
        api.get('/daily-sessions', { params }),
        api.get('/products?isActive=true'),
      ]);
      setSessions(sessRes.data);
      setProducts(prodRes.data);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to fetch sessions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenNewSession = async () => {
    if (!canManageSessions) {
      toast.error('Only Owners and Admins can start business sessions');
      return;
    }
    const targetBranch = selectedBranchId || user?.branchId;
    if (!targetBranch) {
      toast.error('Please select a specific branch to open a daily session');
      return;
    }
    const todayYmd = new Date().toISOString().slice(0, 10);
    try {
      await api.post('/daily-sessions', {
        branchId: targetBranch,
        date: todayYmd,
      });
      toast.success('Daily session opened successfully');
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to open session');
    }
  };

  const handlePauseSession = async (session: DailySession) => {
    if (!canManageSessions) return;
    try {
      await api.post(`/daily-sessions/${session.id}/pause`);
      toast.success('Business session paused');
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to pause session');
    }
  };

  const handleReopenSession = async (session: DailySession) => {
    if (!canManageSessions) return;
    try {
      await api.post(`/daily-sessions/${session.id}/reopen`);
      toast.success('Business session reopened for editing');
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to reopen session');
    }
  };

  const openFinalizeModal = (session: DailySession) => {
    if (!canManageSessions) {
      toast.error('Only Owners and Admins can finalize daily sessions');
      return;
    }
    setActiveSession(session);
    setCashFloat(session.cashLeftoverAmount ? String(session.cashLeftoverAmount) : '');
    const initial: Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }> = {};
    products.forEach((p) => {
      initial[p.id] = { quantityRemaining: 0, damagedQuantity: 0, damageReason: '' };
    });
    setLeftoverCounts(initial);
  };

  const handleFinalizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSession || !canManageSessions) return;
    setIsSubmitting(true);

    const leftoversPayload = Object.entries(leftoverCounts).map(([productId, val]) => ({
      productId,
      quantityRemaining: Number(val.quantityRemaining) || 0,
      damagedQuantity: Number(val.damagedQuantity) || 0,
      damageReason: val.damageReason || undefined,
    }));

    try {
      await api.post(`/daily-sessions/${activeSession.id}/finalize`, {
        cashLeftoverAmount: cashFloat ? Number(cashFloat) : null,
        leftoverRecords: leftoversPayload,
      });
      toast.success('Daily session finalized & closed successfully');
      setActiveSession(null);
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to finalize session');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConversionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBranch = selectedBranchId || user?.branchId || branches[0]?.id;
    if (!fromProductId || !toProductId) {
      toast.error('Please select both source and target products');
      return;
    }
    const qty = parseInt(conversionQty, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Please enter a valid conversion quantity');
      return;
    }
    setIsConverting(true);
    try {
      await api.post('/production/conversions', {
        branchId: targetBranch,
        fromProductId,
        toProductId,
        fromQuantity: qty,
        toQuantity: qty,
      });
      toast.success('Product conversion logged successfully');
      setIsConversionOpen(false);
      setConversionQty('1');
      setFromProductId('');
      setToProductId('');
      fetchSessions();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to convert product');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">Daily Business Sessions</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">Opening float, product conversions, pause/reopen controls, and end-of-day leftover reconciliation</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => setIsConversionOpen(true)} className="border-[#EDE4D5] rounded-xl hover:bg-[#F4ECE1] text-[#4A2E1B] font-bold text-xs sm:text-sm">
            <RefreshCw className="w-4 h-4 mr-2 text-[#E87A18]" /> Convert Product (e.g. Bomboloni ➔ Donut)
          </Button>
          {canManageSessions && (
            <Button onClick={handleOpenNewSession} className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Start Business Session Today
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Session Name</TableHead>
              <TableHead>Session Date</TableHead>
              <TableHead>Branch Location</TableHead>
              <TableHead>Session Status</TableHead>
              <TableHead>Cash Leftover</TableHead>
              <TableHead>Sales Volume</TableHead>
              <TableHead className="w-[240px] text-right pr-6">Management Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">Loading daily sessions...</TableCell></TableRow>
            ) : sessions.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">No sessions recorded yet for active scope.</TableCell></TableRow>
            ) : sessions.map((sess) => {
              const branchName = branches.find((b) => b.id === sess.branchId)?.name || 'Branch';
              const formattedDate = new Date(sess.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
              return (
                <TableRow key={sess.id}>
                  <TableCell className="font-bold text-[#2C1B10]">
                    {sess.label || `Session - ${formattedDate}`}
                  </TableCell>
                  <TableCell className="font-semibold text-xs text-[#8C7361]">
                    <div className="flex items-center">
                      <CalendarDays className="w-4 h-4 mr-2 text-[#8C7361]" />
                      {formattedDate}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-[#4A2E1B]">{branchName}</TableCell>
                  <TableCell>
                    {sess.status === 'OPEN' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 inline-flex items-center gap-1.5 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> OPEN FOR SALES
                      </span>
                    )}
                    {sess.status === 'PAUSED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5 shadow-xs">
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" /> PAUSED
                      </span>
                    )}
                    {sess.status === 'CLOSE_PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-purple-700" /> PENDING APPROVAL
                      </span>
                    )}
                    {sess.status === 'CLOSED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        CLOSED & FINALIZED
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-extrabold text-[#2C1B10]">
                    {sess.cashLeftoverAmount != null ? `${Number(sess.cashLeftoverAmount).toFixed(2)} ETB` : '—'}
                  </TableCell>
                  <TableCell className="font-semibold text-[#8C7361]">
                    <span className="font-bold text-[#2C1B10]">{sess._count?.sales || 0}</span> sales
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {sess.status === 'OPEN' && (
                        <>
                          {canManageSessions && (
                            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold rounded-xl text-xs" onClick={() => handlePauseSession(sess)}>
                              <PauseCircle className="w-3.5 h-3.5 mr-1" /> Pause
                            </Button>
                          )}
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs" onClick={() => window.location.href = `/daily-sessions/${sess.id}/close`}>
                            <Lock className="w-3.5 h-3.5 mr-1" /> Close Session
                          </Button>
                        </>
                      )}
                      {sess.status === 'PAUSED' && (
                        <>
                          {canManageSessions && (
                            <Button size="sm" variant="outline" className="border-blue-300 text-blue-800 hover:bg-blue-50 font-bold rounded-xl text-xs" onClick={() => handleReopenSession(sess)}>
                              <PlayCircle className="w-3.5 h-3.5 mr-1" /> Resume
                            </Button>
                          )}
                          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs" onClick={() => window.location.href = `/daily-sessions/${sess.id}/close`}>
                            <Lock className="w-3.5 h-3.5 mr-1" /> Close Session
                          </Button>
                        </>
                      )}
                      {sess.status === 'CLOSE_PENDING' && (
                        <Button size="sm" className="bg-purple-700 hover:bg-purple-800 text-white font-bold rounded-xl text-xs" onClick={() => window.location.href = `/daily-sessions/${sess.id}/close`}>
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> {canManageSessions ? 'Review & Approve' : 'View Close Report'}
                        </Button>
                      )}
                      {sess.status === 'CLOSED' && (
                        <Button size="sm" variant="outline" className="border-zinc-300 text-zinc-700 hover:bg-zinc-50 font-bold rounded-xl text-xs" onClick={() => window.location.href = `/daily-sessions/${sess.id}/close`}>
                          <Edit3 className="w-3.5 h-3.5 mr-1" /> View / Edit Session
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* On-Demand Conversion Modal */}
      {isConversionOpen && (
        <Dialog open={true} onOpenChange={() => setIsConversionOpen(false)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <RefreshCw className="w-5 h-5 text-indigo-600" />
                <span>Product Conversion (e.g., Bomboloni ➔ Donut)</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleConversionSubmit} className="space-y-4 py-2">
              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Source Product (Convert From)</label>
                <select
                  value={fromProductId}
                  onChange={(e) => setFromProductId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-md p-2 text-sm"
                  required
                >
                  <option value="">Select source product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.flavor ? `(${p.flavor})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Target Product (Convert To)</label>
                <select
                  value={toProductId}
                  onChange={(e) => setToProductId(e.target.value)}
                  className="w-full bg-zinc-50 border border-zinc-300 rounded-md p-2 text-sm"
                  required
                >
                  <option value="">Select target product...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{p.name} {p.flavor ? `(${p.flavor})` : ''}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-700 block mb-1">Quantity</label>
                <Input
                  type="number"
                  min="1"
                  value={conversionQty}
                  onChange={(e) => setConversionQty(e.target.value)}
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button type="button" variant="outline" onClick={() => setIsConversionOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={isConverting} className="bg-indigo-600 text-white hover:bg-indigo-700">
                  {isConverting ? 'Converting...' : 'Execute Conversion'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Finalize Session Dialog */}
      {activeSession && (
        <Dialog open={true} onOpenChange={() => setActiveSession(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-emerald-600" />
                <span>Finalize Business Session ({new Date(activeSession.date).toISOString().slice(0, 10)})</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFinalizeSubmit} className="space-y-6 py-2">
              {/* Step 1: Cash Drawer Float */}
              <div className="p-4 bg-zinc-50 border border-zinc-200 rounded-lg">
                <label className="text-sm font-semibold text-zinc-900 block mb-1">Ending Cash Drawer Float (ETB)</label>
                <p className="text-xs text-zinc-500 mb-2">Remaining physical cash left in drawer for next day's float</p>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 2000.00"
                  value={cashFloat}
                  onChange={(e) => setCashFloat(e.target.value)}
                />
              </div>

              {/* Step 2: Fresh Leftovers (Adari) vs Damaged Stock */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-1 flex items-center">
                  <Utensils className="w-4 h-4 mr-1.5 text-zinc-500" /> End-of-Day Food Leftovers & Spoilage
                </h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Log <strong>Fresh Adari</strong> (carried over for tomorrow) vs <strong>Spoiled / Rotten Stock</strong> (losses).
                </p>

                <div className="space-y-3 max-h-72 overflow-y-auto border border-zinc-200 rounded-md p-3">
                  {products.map((p) => {
                    const current = leftoverCounts[p.id] || { quantityRemaining: 0, damagedQuantity: 0, damageReason: '' };
                    return (
                      <div key={p.id} className="pb-3 border-b border-zinc-100 last:border-0 last:pb-0 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-zinc-900">{p.name}</span>
                          <span className="text-xs text-zinc-400 font-mono">{p.unitType}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[11px] font-medium text-emerald-700 block mb-0.5">Fresh Leftover (Adari)</label>
                            <Input
                              type="number"
                              min="0"
                              value={current.quantityRemaining}
                              onChange={(e) => setLeftoverCounts({
                                ...leftoverCounts,
                                [p.id]: { ...current, quantityRemaining: parseInt(e.target.value, 10) || 0 }
                              })}
                              className="h-8 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-rose-700 block mb-0.5 flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1 text-rose-500" /> Spoiled / Rotten
                            </label>
                            <Input
                              type="number"
                              min="0"
                              value={current.damagedQuantity}
                              onChange={(e) => setLeftoverCounts({
                                ...leftoverCounts,
                                [p.id]: { ...current, damagedQuantity: parseInt(e.target.value, 10) || 0 }
                              })}
                              className="h-8 text-sm"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="pt-4 border-t border-zinc-100">
                <Button type="button" variant="outline" onClick={() => setActiveSession(null)}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {isSubmitting ? 'Finalizing...' : 'Calculate Sales & Close Session'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
