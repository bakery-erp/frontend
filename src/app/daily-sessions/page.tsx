'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { api } from '@/lib/axios';
import { toast } from 'sonner';
import { CalendarDays, Plus, Lock, Utensils, RefreshCw, AlertTriangle, PauseCircle, PlayCircle, Edit3, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useLanguage } from '@/context/LanguageContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { TableSkeleton, CardGridSkeleton } from '@/components/ui/skeletons';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { ConfirmModal } from '@/components/ConfirmModal';

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
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [isTodayOnly, setIsTodayOnly] = useState(false);
  
  const canManageSessions = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const { data: sessionData, isLoading } = useQuery<{ sessions: DailySession[]; products: Product[] }>({
    queryKey: ['daily-sessions', selectedBranchId],
    queryFn: async () => {
      const params: any = {};
      if (selectedBranchId) params.branchId = selectedBranchId;
      const [sessRes, prodRes] = await Promise.all([
        api.get('/daily-sessions', { params }),
        api.get('/products?isActive=true'),
      ]);
      return { sessions: sessRes.data, products: prodRes.data };
    },
  });

  const sessions = sessionData?.sessions || [];
  const products = sessionData?.products || [];

  // Compute today's session in Ethiopian timezone (UTC+3)
  const ethTodayYmd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);
  const currentBranchFilter = selectedBranchId || user?.branchId;
  const todaySession = sessions.find((s) => {
    const sDate = s.date ? new Date(s.date).toISOString().slice(0, 10) : '';
    if (sDate !== ethTodayYmd) return false;
    if (currentBranchFilter) return s.branchId === currentBranchFilter;
    return true;
  });

  const branchSessionsToday = branches.map((b) => {
    const sess = sessions.find((s) => {
      const sDate = s.date ? new Date(s.date).toISOString().slice(0, 10) : '';
      return sDate === ethTodayYmd && s.branchId === b.id;
    });
    return { branch: b, session: sess };
  });

  const hasAnyClosedToday = branchSessionsToday.some((bs) => bs.session?.status === 'CLOSED');
  const hasAnyUnopenedToday = branchSessionsToday.some((bs) => !bs.session);

  const displayedSessions = isTodayOnly
    ? sessions.filter((s) => {
        const sDate = s.date ? new Date(s.date).toISOString().slice(0, 10) : '';
        return sDate === ethTodayYmd;
      })
    : sessions;

  // Distinct history sessions (excludes today's active session already highlighted in top banner)
  const historySessions = displayedSessions.filter((s) => s.id !== todaySession?.id);

  // Branch Selection Modal State (when all branches are selected)
  const [isBranchSelectModalOpen, setIsBranchSelectModalOpen] = useState(false);

  // Finalize Session Modal State
  const [activeSession, setActiveSession] = useState<DailySession | null>(null);
  const [cashFloat, setCashFloat] = useState<string>('');
  const [leftoverCounts, setLeftoverCounts] = useState<Record<string, { quantityRemaining: number | string; damagedQuantity: number | string; damageReason: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isFinalizeDirty = Boolean(activeSession) && (
    Boolean(cashFloat && cashFloat !== String(activeSession?.cashLeftoverAmount || '')) ||
    Object.values(leftoverCounts).some(
      (c) => (c.quantityRemaining !== '' && Number(c.quantityRemaining) > 0) ||
             (c.damagedQuantity !== '' && Number(c.damagedQuantity) > 0)
    )
  );

  const {
    showPrompt: showDiscardFinalizePrompt,
    setShowPrompt: setShowDiscardFinalizePrompt,
    confirmAction: confirmDiscardFinalize,
    guardedAction: guardedCloseFinalize,
  } = useUnsavedChanges(isFinalizeDirty);

  const handleCloseFinalizeModal = () => {
    guardedCloseFinalize(() => {
      setActiveSession(null);
    });
  };

  // Conversion Modal State
  const [isConversionOpen, setIsConversionOpen] = useState(false);
  const [fromProductId, setFromProductId] = useState('');
  const [toProductId, setToProductId] = useState('');
  const [conversionQty, setConversionQty] = useState('1');
  const [isConverting, setIsConverting] = useState(false);

  const handleOpenNewSession = async (overrideBranchId?: string) => {
    if (!canManageSessions) {
      toast.error('Only Owners and Admins can start business sessions');
      return;
    }
    const targetBranch = overrideBranchId || selectedBranchId || user?.branchId;
    if (!targetBranch) {
      if (branches.length > 0) {
        setIsBranchSelectModalOpen(true);
        return;
      }
      toast.error('Please select a specific branch to open a daily session');
      return;
    }
    try {
      await api.post('/daily-sessions', {
        branchId: targetBranch,
        date: ethTodayYmd,
      });
      toast.success('Daily session opened successfully');
      setIsBranchSelectModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to open session');
    }
  };

  const handlePauseSession = async (session: DailySession) => {
    if (!canManageSessions) return;
    try {
      await api.post(`/daily-sessions/${session.id}/pause`);
      toast.success('Business session paused');
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to pause session');
    }
  };

  const handleReopenSession = async (session: DailySession) => {
    if (!canManageSessions) return;
    try {
      await api.post(`/daily-sessions/${session.id}/reopen`);
      toast.success('Business session reopened for editing');
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
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
    const initial: Record<string, { quantityRemaining: number | string; damagedQuantity: number | string; damageReason: string }> = {};
    products.forEach((p) => {
      initial[p.id] = { quantityRemaining: '', damagedQuantity: '', damageReason: '' };
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
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
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
      queryClient.invalidateQueries({ queryKey: ['daily-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-conversions'] });
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to convert product');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">{t('sessions.title')}</h1>
          <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">{t('sessions.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant={isTodayOnly ? "default" : "outline"}
            onClick={() => setIsTodayOnly(!isTodayOnly)}
            className={`rounded-xl text-xs sm:text-sm font-bold h-10 px-3.5 transition-all ${
              isTodayOnly
                ? "bg-[#E87A18] hover:bg-[#D66B0F] text-white shadow-xs"
                : "border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]"
            }`}
          >
            <CalendarDays className="w-4 h-4 mr-1.5" />
            {isTodayOnly ? `${t('common.date')} (Today Active)` : t('common.date')}
          </Button>

          {!isLoading && sessionData && canManageSessions && (
            selectedBranchId ? (
              !todaySession ? (
                <Button
                  onClick={() => handleOpenNewSession()}
                  className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-sm animate-in fade-in duration-150"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> {t('sessions.startNewSession')}
                </Button>
              ) : todaySession.status === 'CLOSED' ? (
                <Button
                  onClick={() => handleReopenSession(todaySession)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-sm animate-in fade-in duration-150"
                >
                  <RotateCcw className="w-4 h-4 mr-1.5" /> {t('sessions.reopen') || "Reopen Today's Session"}
                </Button>
              ) : null
            ) : (
              (hasAnyUnopenedToday || hasAnyClosedToday) ? (
                <Button
                  onClick={() => setIsBranchSelectModalOpen(true)}
                  className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-sm animate-in fade-in duration-150"
                >
                  <Plus className="w-4 h-4 mr-1.5" /> {hasAnyUnopenedToday ? t('sessions.startNewSession') : "Reopen / Start Session"}
                </Button>
              ) : null
            )
          )}
        </div>
      </div>

      {/* Active Session Status Banner */}
      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-2xl mb-6" />
      ) : todaySession ? (
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 mb-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5 min-w-0">
              <div className={`p-3 rounded-2xl shrink-0 ${
                todaySession.status === 'OPEN'
                  ? 'bg-emerald-50 text-emerald-600'
                  : todaySession.status === 'PAUSED'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-zinc-100 text-zinc-600'
              }`}>
                {todaySession.status === 'OPEN' ? (
                  <PlayCircle className="w-6 h-6" />
                ) : todaySession.status === 'PAUSED' ? (
                  <PauseCircle className="w-6 h-6" />
                ) : (
                  <Lock className="w-6 h-6" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-extrabold text-base text-[#2C1B10]">
                    {todaySession.label || `Today's Session`}
                  </h3>
                  {todaySession.status === 'OPEN' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> {t('sessions.liveSessionOpen')}
                    </span>
                  )}
                  {todaySession.status === 'PAUSED' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      <PauseCircle className="w-3.5 h-3.5 text-amber-600" /> {t('sessions.statusPaused')}
                    </span>
                  )}
                  {todaySession.status === 'CLOSE_PENDING' && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 text-purple-600" /> {t('sessions.statusPending')}
                    </span>
                  )}
                  {todaySession.status === 'CLOSED' && (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                      {t('sessions.statusClosed')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2.5 text-xs text-[#8C7361] mt-1 flex-wrap font-medium">
                  <span>📅 {new Date(todaySession.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                  <span>•</span>
                  <span>🏢 {branches.find((b) => b.id === todaySession.branchId)?.name || 'Main Branch'}</span>
                  <span>•</span>
                  <span>🛍️ {todaySession._count?.sales || 0} {t('sessions.itemsSold')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap sm:flex-nowrap">
              {todaySession.status === 'OPEN' && (
                <>
                  {canManageSessions && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePauseSession(todaySession)}
                      className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold rounded-xl text-xs h-9 flex-1 sm:flex-initial"
                    >
                      <PauseCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.pause')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => router.push(`/daily-sessions/${todaySession.id}/close?mode=edit`)}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs h-9 shadow-xs flex-1 sm:flex-initial"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                  </Button>
                </>
              )}
              {todaySession.status === 'PAUSED' && (
                <>
                  {canManageSessions && (
                    <Button
                      size="sm"
                      onClick={() => handleReopenSession(todaySession)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-9 shadow-xs flex-1 sm:flex-initial"
                    >
                      <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen')}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => router.push(`/daily-sessions/${todaySession.id}/close?mode=edit`)}
                    className="bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs h-9 shadow-xs flex-1 sm:flex-initial"
                  >
                    <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                  </Button>
                </>
              )}
              {todaySession.status === 'CLOSE_PENDING' && (
                <Button
                  size="sm"
                  onClick={() => router.push(`/daily-sessions/${todaySession.id}/close?mode=edit`)}
                  className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-9 shadow-xs w-full sm:w-auto"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {canManageSessions ? t('sessions.reviewApproveClose') : t('sessions.viewCloseReport')}
                </Button>
              )}
              {todaySession.status === 'CLOSED' && (
                <>
                  {canManageSessions && (
                    <Button
                      size="sm"
                      onClick={() => handleReopenSession(todaySession)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-9 shadow-xs flex-1 sm:flex-initial"
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen') || 'Reopen Session'}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => router.push(`/daily-sessions/${todaySession.id}/close?mode=view`)}
                    className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs h-9 w-full sm:w-auto"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1" /> {t('sessions.viewCloseReport')}
                  </Button>
                </>
              )}
            </div>
          </div>
        ) : !selectedBranchId && branches.length > 1 ? (
          /* Multi-branch status overview when viewing all branches */
          <div className="bg-white border border-[#EDE4D5] rounded-2xl p-4 sm:p-5 mb-6 shadow-xs">
            <div className="flex items-center justify-between mb-3 border-b border-[#EDE4D5] pb-2.5">
              <h3 className="font-extrabold text-sm text-[#2C1B10] flex items-center gap-2">
                <Utensils className="w-4 h-4 text-[#E87A18]" />
                Today's Branch Business Sessions
              </h3>
              <span className="text-xs text-[#8C7361] font-semibold">
                📅 {ethTodayYmd}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {branchSessionsToday.map(({ branch, session: bSess }) => (
                <div
                  key={branch.id}
                  className="p-3.5 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#2C1B10]">{branch.name}</span>
                      {bSess?.status === 'OPEN' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                          Live
                        </span>
                      )}
                      {bSess?.status === 'PAUSED' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                          Paused
                        </span>
                      )}
                      {bSess?.status === 'CLOSE_PENDING' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300">
                          Pending
                        </span>
                      )}
                      {bSess?.status === 'CLOSED' && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-zinc-200 text-zinc-700">
                          Closed
                        </span>
                      )}
                      {!bSess && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                          Not Started
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#8C7361] mt-1">
                      {bSess ? `${bSess._count?.sales || 0} sales recorded` : 'No active session running'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!bSess && canManageSessions && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenNewSession(branch.id)}
                        className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Open Session
                      </Button>
                    )}
                    {bSess?.status === 'CLOSED' && canManageSessions && (
                      <Button
                        size="sm"
                        onClick={() => handleReopenSession(bSess)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                      </Button>
                    )}
                    {bSess?.status === 'OPEN' && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/daily-sessions/${bSess.id}/close?mode=edit`)}
                        className="bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" /> Finalize
                      </Button>
                    )}
                    {bSess?.status === 'PAUSED' && canManageSessions && (
                      <Button
                        size="sm"
                        onClick={() => handleReopenSession(bSess)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <PlayCircle className="w-3.5 h-3.5 mr-1" /> Reopen
                      </Button>
                    )}
                    {bSess?.status === 'CLOSE_PENDING' && (
                      <Button
                        size="sm"
                        onClick={() => router.push(`/daily-sessions/${bSess.id}/close?mode=edit`)}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Review
                      </Button>
                    )}
                    {bSess?.status === 'CLOSED' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/daily-sessions/${bSess.id}/close?mode=view`)}
                        className="border-[#EDE4D5] text-[#4A2E1B] font-bold rounded-xl text-xs h-8 px-2.5"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-100 text-amber-800 rounded-xl shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-amber-950">{t('sessions.noActiveSession')}</h3>
                <p className="text-xs text-amber-800 mt-0.5">
                  {t('sessions.noActiveSessionDesc')}
                </p>
              </div>
            </div>
            {canManageSessions && (
              <Button
                onClick={() => handleOpenNewSession()}
                className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs h-9 px-4 shrink-0 shadow-sm w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-1.5" /> {t('sessions.startTodaysSession')}
              </Button>
            )}
          </div>
        )}

      {/* ── Session History Section Header ── */}
      <div className="flex items-center justify-between gap-3 mb-4 pt-1">
        <div>
          <h2 className="text-base sm:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-[#E87A18]" />
            {t('sessions.sessionHistory')}
          </h2>
          <p className="text-xs text-[#8C7361] mt-0.5">
            {t('sessions.sessionHistorySubtitle').replace('{count}', String(historySessions.length))}
          </p>
        </div>
      </div>

      {/* ── Mobile Session Cards (< md) ── */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-8 w-24 rounded-xl" />
            </div>
          ))
        ) : historySessions.length === 0 ? (
          <div className="text-center py-8 bg-white rounded-2xl border border-[#EDE4D5] text-[#8C7361] font-medium text-xs">
            {isTodayOnly ? "No past session recorded for today." : "No past sessions found in history. Active session is running above."}
          </div>
        ) : (
          historySessions.map((sess) => {
            const branchName = branches.find((b) => b.id === sess.branchId)?.name || 'Branch';
            const formattedDate = new Date(sess.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
            return (
              <div
                key={sess.id}
                className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3 hover:border-[#E87A18]/30 transition-all"
              >
                <div className="flex items-start justify-between gap-2 border-b border-[#F4ECE1] pb-2.5">
                  <div>
                    <h3 className="font-extrabold text-sm text-[#2C1B10]">
                      {sess.label || `Session - ${formattedDate}`}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-[#8C7361] mt-0.5 font-medium">
                      <CalendarDays className="w-3.5 h-3.5" />
                      <span>{formattedDate}</span>
                      <span>•</span>
                      <span className="font-bold text-[#4A2E1B]">{branchName}</span>
                    </div>
                  </div>

                  <div>
                    {sess.status === 'OPEN' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" /> {t('sessions.statusOpen')}
                      </span>
                    )}
                    {sess.status === 'PAUSED' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                        <PauseCircle className="w-3 h-3 text-amber-600" /> {t('sessions.statusPaused')}
                      </span>
                    )}
                    {sess.status === 'CLOSE_PENDING' && (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-900 border border-purple-300 animate-pulse">
                        <AlertTriangle className="w-3 h-3 text-purple-700" /> {t('sessions.statusPending')}
                      </span>
                    )}
                    {sess.status === 'CLOSED' && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {t('sessions.statusClosed')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-[#FAF6F0] p-2.5 rounded-xl">
                  <div>
                    <span className="text-[10px] font-bold text-[#8C7361] uppercase block">{t('sessions.colTomorrowLeftover')}</span>
                    <span className="font-mono font-bold text-[#2C1B10]">
                      {sess.cashLeftoverAmount != null ? `${Number(sess.cashLeftoverAmount).toFixed(2)} ${t('common.currency')}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-[#8C7361] uppercase block">{t('sessions.colSalesVolume')}</span>
                    <span className="font-bold text-[#2C1B10]">
                      {sess._count?.sales || 0} {t('common.items')}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2 flex-wrap">
                  {sess.status === 'OPEN' && (
                    <>
                      {canManageSessions && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePauseSession(sess)}
                          className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold rounded-xl text-xs h-8 flex-1"
                        >
                          <PauseCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.pause')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                        className="bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs h-8 shadow-xs flex-1"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                      </Button>
                    </>
                  )}

                  {sess.status === 'PAUSED' && (
                    <>
                      {canManageSessions && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReopenSession(sess)}
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl text-xs h-8 flex-1"
                        >
                          <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen')}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                        className="bg-rose-700 hover:bg-rose-800 text-white font-bold rounded-xl text-xs h-8 shadow-xs flex-1"
                      >
                        <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                      </Button>
                    </>
                  )}

                  {sess.status === 'CLOSE_PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                      className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl text-xs h-8 shadow-xs w-full"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {canManageSessions ? t('sessions.reviewApproveClose') : t('sessions.viewCloseReport')}
                    </Button>
                  )}

                  {sess.status === 'CLOSED' && (
                    <div className="flex items-center gap-1.5 w-full">
                      {canManageSessions && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReopenSession(sess)}
                          className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl text-xs h-8 flex-1"
                        >
                          <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen') || "Reopen"}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=view`)}
                        className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#F4ECE1] font-bold rounded-xl text-xs h-8 flex-1"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1" /> {t('common.view')}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Desktop Main Table (hidden on < md, visible on md+) ── */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl overflow-x-auto shadow-sm hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('sessions.colSessionName')}</TableHead>
              <TableHead>{t('sessions.colSessionDate')}</TableHead>
              <TableHead>{t('sessions.colBranchLocation')}</TableHead>
              <TableHead>{t('sessions.colSessionStatus')}</TableHead>
              <TableHead>{t('sessions.colTomorrowLeftover')}</TableHead>
              <TableHead>{t('sessions.colSalesVolume')}</TableHead>
              <TableHead className="w-[240px] text-right pr-6">{t('sessions.colActions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 rounded-xl ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : historySessions.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-[#8C7361] font-medium">{isTodayOnly ? "No past session recorded for today." : "No past sessions found in history. Active session is running above."}</TableCell></TableRow>
            ) : historySessions.map((sess) => {
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
                        <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span> {t('sessions.statusOpen')}
                      </span>
                    )}
                    {sess.status === 'PAUSED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 inline-flex items-center gap-1.5 shadow-xs">
                        <PauseCircle className="w-3.5 h-3.5 text-amber-600" /> {t('sessions.statusPaused')}
                      </span>
                    )}
                    {sess.status === 'CLOSE_PENDING' && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-900 border border-purple-300 inline-flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-3.5 h-3.5 text-purple-700" /> {t('sessions.statusPending')}
                      </span>
                    )}
                    {sess.status === 'CLOSED' && (
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 text-zinc-700 border border-zinc-200">
                        {t('sessions.statusClosed')}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="font-extrabold text-[#2C1B10]">
                    {sess.cashLeftoverAmount != null ? `${Number(sess.cashLeftoverAmount).toFixed(2)} ${t('common.currency')}` : '—'}
                  </TableCell>
                  <TableCell className="font-semibold text-[#8C7361]">
                    <span className="font-bold text-[#2C1B10]">{sess._count?.sales || 0}</span> {t('common.items')}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {sess.status === 'OPEN' && (
                        <>
                          {canManageSessions && (
                            <Button size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-50 font-bold rounded-xl text-xs" onClick={() => handlePauseSession(sess)}>
                              <PauseCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.pause')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-rose-700 text-white hover:bg-rose-800 font-bold rounded-xl text-xs shadow-xs"
                            onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                          >
                            <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                          </Button>
                        </>
                      )}

                      {sess.status === 'PAUSED' && (
                        <>
                          {canManageSessions && (
                            <Button size="sm" variant="outline" className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl text-xs" onClick={() => handleReopenSession(sess)}>
                              <PlayCircle className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen')}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            className="bg-rose-700 text-white hover:bg-rose-800 font-bold rounded-xl text-xs shadow-xs"
                            onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                          >
                            <Lock className="w-3.5 h-3.5 mr-1" /> {t('sessions.finalize')}
                          </Button>
                        </>
                      )}

                      {sess.status === 'CLOSE_PENDING' && (
                        <Button
                          size="sm"
                          className="bg-amber-600 text-white hover:bg-amber-700 font-bold rounded-xl text-xs shadow-xs"
                          onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=edit`)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {canManageSessions ? t('sessions.reviewApproveClose') : t('sessions.viewCloseReport')}
                        </Button>
                      )}

                      {sess.status === 'CLOSED' && (
                        <>
                          {canManageSessions && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 font-bold rounded-xl text-xs"
                              onClick={() => handleReopenSession(sess)}
                            >
                              <RotateCcw className="w-3.5 h-3.5 mr-1" /> {t('sessions.reopen') || "Reopen"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#F4ECE1] font-bold rounded-xl text-xs"
                            onClick={() => router.push(`/daily-sessions/${sess.id}/close?mode=view`)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> {t('common.view')}
                          </Button>
                        </>
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
        <Dialog open={true} onOpenChange={(open) => { if (!open) handleCloseFinalizeModal(); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-emerald-600" />
                <span>{t('sessions.finalizeModalTitle').replace('{date}', new Date(activeSession.date).toISOString().slice(0, 10))}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleFinalizeSubmit} className="space-y-6 py-2">
              {/* Step 1: Cash Drawer Float */}
              <div className="p-4 bg-amber-50/60 border border-amber-200 rounded-xl space-y-1">
                <label className="text-sm font-extrabold text-amber-950 block">{t('sessions.stepCashFloat')}</label>
                <p className="text-xs text-amber-800">
                  {t('sessions.stepCashFloatHelp')}
                </p>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 500.00"
                  value={cashFloat}
                  onChange={(e) => setCashFloat(e.target.value)}
                  className="bg-white border-amber-300 font-mono font-bold"
                />
              </div>

              {/* Step 2: Fresh Leftovers (Adari) vs Damaged Stock */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 mb-1 flex items-center">
                  <Utensils className="w-4 h-4 mr-1.5 text-zinc-500" /> {t('sessions.stepLeftoversTitle')}
                </h3>
                <p className="text-xs text-zinc-500 mb-3">
                  {t('sessions.stepLeftoversHelp')}
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
                            <label className="text-[11px] font-medium text-emerald-700 block mb-0.5">{t('sessions.freshAdariLabel')}</label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={current.quantityRemaining === 0 || current.quantityRemaining === '' ? '' : current.quantityRemaining}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value;
                                const parsed = val === '' ? '' : parseInt(val, 10);
                                setLeftoverCounts({
                                  ...leftoverCounts,
                                  [p.id]: { ...current, quantityRemaining: parsed === '' || isNaN(parsed as number) ? '' : Math.max(0, parsed as number) }
                                });
                              }}
                              className="h-8 text-sm"
                            />
                          </div>

                          <div>
                            <label className="text-[11px] font-medium text-rose-700 block mb-0.5 flex items-center">
                              <AlertTriangle className="w-3 h-3 mr-1 text-rose-500" /> {t('sessions.spoiledRottenLabel')}
                            </label>
                            <Input
                              type="number"
                              min="0"
                              placeholder="0"
                              value={current.damagedQuantity === 0 || current.damagedQuantity === '' ? '' : current.damagedQuantity}
                              onFocus={(e) => e.target.select()}
                              onChange={(e) => {
                                const val = e.target.value;
                                const parsed = val === '' ? '' : parseInt(val, 10);
                                setLeftoverCounts({
                                  ...leftoverCounts,
                                  [p.id]: { ...current, damagedQuantity: parsed === '' || isNaN(parsed as number) ? '' : Math.max(0, parsed as number) }
                                });
                              }}
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
                <Button type="button" variant="outline" onClick={handleCloseFinalizeModal}>{t('common.cancel')}</Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 text-white hover:bg-emerald-700">
                  {isSubmitting ? t('sessions.finalizingInProgress') : t('sessions.executeFinalizeButton')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmModal
        isOpen={showDiscardFinalizePrompt}
        title={t('common.unsavedChanges') || 'Unsaved Changes'}
        description="You have entered leftover counts or cash drawer amounts. Are you sure you want to discard them?"
        confirmText={t('common.discardChanges') || 'Discard Changes'}
        cancelText={t('common.keepEditing') || 'Keep Editing'}
        variant="warning"
        onConfirm={() => {
          confirmDiscardFinalize();
          setActiveSession(null);
        }}
        onCancel={() => setShowDiscardFinalizePrompt(false)}
      />

      {/* Branch Selection Modal for Starting / Reopening Sessions */}
      {isBranchSelectModalOpen && (
        <Dialog open={true} onOpenChange={() => setIsBranchSelectModalOpen(false)}>
          <DialogContent className="max-w-md bg-white rounded-2xl p-6 border border-[#EDE4D5]">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#E87A18]" />
                Select Branch for Daily Session
              </DialogTitle>
            </DialogHeader>

            <p className="text-xs text-[#8C7361] -mt-2">
              Choose which bakery branch to start or reopen for today ({ethTodayYmd}):
            </p>

            <div className="space-y-3 py-3">
              {branchSessionsToday.map(({ branch, session: bSess }) => (
                <div
                  key={branch.id}
                  className="p-3.5 rounded-xl border border-[#EDE4D5] bg-[#FAF6F0]/50 flex items-center justify-between gap-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#2C1B10]">{branch.name}</span>
                      {bSess?.status === 'OPEN' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          Live
                        </span>
                      )}
                      {bSess?.status === 'CLOSED' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-200 text-zinc-700">
                          Closed
                        </span>
                      )}
                      {!bSess && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                          Not Started
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-[#8C7361]">
                      {bSess ? `${bSess._count?.sales || 0} sales recorded` : 'Ready to start'}
                    </span>
                  </div>

                  <div>
                    {!bSess ? (
                      <Button
                        size="sm"
                        onClick={() => handleOpenNewSession(branch.id)}
                        className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" /> Open
                      </Button>
                    ) : bSess.status === 'CLOSED' ? (
                      <Button
                        size="sm"
                        onClick={() => {
                          handleReopenSession(bSess);
                          setIsBranchSelectModalOpen(false);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs h-8 px-3"
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reopen
                      </Button>
                    ) : (
                      <span className="text-xs font-bold text-emerald-700 px-2 py-1">Active</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter className="pt-2 border-t border-[#EDE4D5]">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsBranchSelectModalOpen(false)}
                className="rounded-xl"
              >
                {t('common.cancel')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
