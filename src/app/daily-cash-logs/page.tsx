'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { useBranch } from '@/context/BranchContext';
import { useLanguage } from '@/context/LanguageContext';
import DashboardLayout from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmModal } from '@/components/ConfirmModal';
import { PaginationControls } from '@/components/ui/PaginationControls';
import { formatEthDate } from '@/lib/ethiopianDate';
import { toast } from 'sonner';
import {
  WalletCards,
  Plus,
  Banknote,
  CreditCard,
  Smartphone,
  RefreshCw,
  Edit3,
  Trash2,
  CalendarDays,
  Info,
  DollarSign,
  TrendingUp,
} from 'lucide-react';

interface DailyCashLog {
  id: string;
  branchId: string;
  date: string;
  cashInDrawer: number | string;
  cbeTransfer: number | string;
  telebirr: number | string;
  tomorrowFloat: number | string;
  notes?: string | null;
  recordedBy?: {
    id: string;
    fullName: string;
    role: string;
  };
  branch?: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface LogSummary {
  totalCashInDrawer: number;
  totalCbe: number;
  totalTelebirr: number;
  totalTomorrowFloat: number;
  totalCollected: number;
}

export default function DailyCashLogsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const isOwner = user?.role === 'OWNER';
  const isAdmin = user?.role === 'ADMIN';
  const canAccess = isOwner || isAdmin;

  useEffect(() => {
    if (user && !canAccess) {
      router.replace('/customer-credits');
    }
  }, [user, canAccess, router]);

  const [page, setPage] = useState(1);
  const [isTodayOnly, setIsTodayOnly] = useState(false);
  const ethTodayYmd = new Date(Date.now() + 3 * 3600 * 1000).toISOString().slice(0, 10);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DailyCashLog | null>(null);
  const [formBranchId, setFormBranchId] = useState('');
  const [formDate, setFormDate] = useState(ethTodayYmd);
  const [cashInDrawer, setCashInDrawer] = useState('');
  const [cbeTransfer, setCbeTransfer] = useState('');
  const [telebirr, setTelebirr] = useState('');
  const [tomorrowFloat, setTomorrowFloat] = useState('');
  const [notes, setNotes] = useState('');

  // Delete State
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Fetch paginated logs
  const { data: logsResponse, isLoading } = useQuery({
    queryKey: ['daily-cash-logs', selectedBranchId, page, isTodayOnly],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: any = { page, limit: 15 };
      if (selectedBranchId) params.branchId = selectedBranchId;
      if (isTodayOnly) {
        params.from = ethTodayYmd;
        params.to = ethTodayYmd;
      }
      const res = await api.get('/daily-cash-logs', { params });
      return res.data;
    },
    enabled: !!user && canAccess,
  });

  const logs: DailyCashLog[] = logsResponse?.data || [];
  const total = logsResponse?.total || 0;
  const totalPages = logsResponse?.totalPages || 1;
  const summary: LogSummary = logsResponse?.summary || {
    totalCashInDrawer: 0,
    totalCbe: 0,
    totalTelebirr: 0,
    totalTomorrowFloat: 0,
    totalCollected: 0,
  };

  const openCreateModal = () => {
    setEditingLog(null);
    setFormBranchId(selectedBranchId || user?.branchId || branches[0]?.id || '');
    setFormDate(ethTodayYmd);
    setCashInDrawer('');
    setCbeTransfer('');
    setTelebirr('');
    setTomorrowFloat('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (log: DailyCashLog) => {
    setEditingLog(log);
    setFormBranchId(log.branchId);
    setFormDate(new Date(log.date).toISOString().slice(0, 10));
    setCashInDrawer(String(Number(log.cashInDrawer || 0)));
    setCbeTransfer(String(Number(log.cbeTransfer || 0)));
    setTelebirr(String(Number(log.telebirr || 0)));
    setTomorrowFloat(String(Number(log.tomorrowFloat || 0)));
    setNotes(log.notes || '');
    setIsModalOpen(true);
  };

  // Upsert Mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (editingLog) {
        return api.patch(`/daily-cash-logs/${editingLog.id}`, payload);
      }
      return api.post('/daily-cash-logs', payload);
    },
    onSuccess: () => {
      toast.success(editingLog ? 'Daily cash log updated successfully' : 'Daily cash log recorded successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-cash-logs'] });
      setIsModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to save daily cash log');
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formBranchId) {
      toast.error('Please select a branch');
      return;
    }
    if (!formDate) {
      toast.error('Please select a date');
      return;
    }

    const payload = {
      branchId: formBranchId,
      date: formDate,
      cashInDrawer: cashInDrawer === '' ? 0 : Number(cashInDrawer),
      cbeTransfer: cbeTransfer === '' ? 0 : Number(cbeTransfer),
      telebirr: telebirr === '' ? 0 : Number(telebirr),
      tomorrowFloat: tomorrowFloat === '' ? 0 : Number(tomorrowFloat),
      notes: notes.trim() || null,
    };

    saveMutation.mutate(payload);
  };

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return api.delete(`/daily-cash-logs/${id}`);
    },
    onSuccess: () => {
      toast.success('Log entry deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['daily-cash-logs'] });
      setDeleteTargetId(null);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || 'Failed to delete log entry');
    },
  });

  const previewTotalDigital = (Number(cbeTransfer) || 0) + (Number(telebirr) || 0);
  const previewTotalCollected = (Number(cashInDrawer) || 0) + previewTotalDigital;

  if (!canAccess) {
    return null;
  }

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight text-[#2C1B10]">
              Daily Cash & Bank Log
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FAF6F0] text-[#8C7361] border border-[#EDE4D5]">
              Daily Journal
            </span>
          </div>
          <p className="text-xs text-[#8C7361] mt-1">
            Store daily paper cash, bank transfers, and digital money. Stored for Owner & Admin reference only.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant={isTodayOnly ? "default" : "outline"}
            onClick={() => {
              setIsTodayOnly(!isTodayOnly);
              setPage(1);
            }}
            className={`rounded-xl text-xs sm:text-sm font-bold h-10 px-3.5 transition-all ${
              isTodayOnly
                ? "bg-[#E87A18] hover:bg-[#D66B0F] text-white shadow-xs"
                : "border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]"
            }`}
          >
            <CalendarDays className="w-4 h-4 mr-1.5" />
            {isTodayOnly ? 'Today Only' : 'All Dates'}
          </Button>

          <Button
            onClick={openCreateModal}
            className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs sm:text-sm h-10 px-4 shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Log Daily Cash
          </Button>
        </div>
      </div>

      {/* Audit Reference Notice */}
      <div className="p-3.5 sm:p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 mb-6 flex items-start gap-3 shadow-xs">
        <Info className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong className="font-extrabold">Physical Drawer & Digital Banking Journal:</strong> This log is a dedicated daily recording sheet for Owner & Admin reference. It records daily paper cash collected, CBE bank transfers, Telebirr digital money, and tomorrow&apos;s drawer float. It does not alter the 48-hour session mathematical reconciliation.
        </div>
      </div>

      {/* Top 5 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-6">
        {/* 1. Cash In Drawer */}
        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8C7361] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Cash in Drawer</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-[#2C1B10]">
              {summary.totalCashInDrawer.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
            <p className="text-[10px] text-[#8C7361] mt-0.5">Physical Paper Cash Collected</p>
          </div>
        </div>

        {/* 2. CBE Bank Transfer */}
        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8C7361] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">CBE Bank Transfer</span>
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-blue-700">
              {summary.totalCbe.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
            <p className="text-[10px] text-[#8C7361] mt-0.5">Direct Bank Transfer Income</p>
          </div>
        </div>

        {/* 3. Telebirr Digital Money */}
        <div className="bg-white p-4 rounded-2xl border border-[#EDE4D5] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#8C7361] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Telebirr Digital</span>
            <Smartphone className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-purple-700">
              {summary.totalTelebirr.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
            <p className="text-[10px] text-[#8C7361] mt-0.5">Telebirr / Mobile Wallet Income</p>
          </div>
        </div>

        {/* 4. Tomorrow's Float */}
        <div className="bg-[#FFFBEB] p-4 rounded-2xl border border-[#FDE68A] shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-[#92400E] mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Tomorrow&apos;s Float</span>
            <RefreshCw className="w-4 h-4 text-amber-600" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-[#92400E]">
              {summary.totalTomorrowFloat.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
            <p className="text-[10px] text-amber-700 mt-0.5">Cash Kept for Tomorrow</p>
          </div>
        </div>

        {/* 5. Total Daily Collections */}
        <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-800 mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Collected</span>
            <TrendingUp className="w-4 h-4 text-emerald-700" />
          </div>
          <div>
            <span className="text-lg sm:text-xl font-extrabold font-mono text-emerald-800">
              {summary.totalCollected.toLocaleString(undefined, { minimumFractionDigits: 2 })} ETB
            </span>
            <p className="text-[10px] text-emerald-700 mt-0.5">Cash + Bank + Telebirr</p>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white border border-[#EDE4D5] rounded-2xl shadow-xs overflow-hidden mb-6">
        <div className="p-4 sm:p-5 border-b border-[#EDE4D5] flex items-center justify-between flex-wrap gap-2">
          <h2 className="font-extrabold text-base text-[#2C1B10] flex items-center gap-2">
            <WalletCards className="w-4 h-4 text-[#E87A18]" />
            Recorded Daily Cash Logs
          </h2>
          <span className="text-xs font-semibold text-[#8C7361]">
            Total Entries: <strong className="text-[#2C1B10]">{total}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#FAF6F0]/60">
              <TableRow className="border-b border-[#EDE4D5]">
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Date</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Branch</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Cash In Drawer</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">CBE Transfer</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Telebirr Digital</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Tomorrow&apos;s Float</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Total Collected</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Notes</TableHead>
                <TableHead className="font-bold text-[#4A2E1B] text-xs">Recorded By</TableHead>
                <TableHead className="text-right font-bold text-[#4A2E1B] text-xs pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-[#8C7361] font-medium text-xs">
                    No daily cash logs found. Click &quot;+ Log Daily Cash&quot; above to record today&apos;s drawer cash and transfers.
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => {
                  const cashVal = Number(log.cashInDrawer || 0);
                  const cbeVal = Number(log.cbeTransfer || 0);
                  const tbVal = Number(log.telebirr || 0);
                  const floatVal = Number(log.tomorrowFloat || 0);
                  const totalCollected = cashVal + cbeVal + tbVal;
                  const formattedDate = formatEthDate(log.date);

                  return (
                    <TableRow key={log.id} className="hover:bg-[#FAF6F0]/40 transition-colors border-b border-[#EDE4D5]">
                      <TableCell className="font-semibold text-xs text-[#2C1B10]">
                        <div className="flex items-center gap-1.5">
                          <CalendarDays className="w-3.5 h-3.5 text-[#8C7361]" />
                          <span>{formattedDate}</span>
                        </div>
                        <span className="text-[10px] text-[#8C7361] font-mono">
                          {new Date(log.date).toISOString().slice(0, 10)}
                        </span>
                      </TableCell>
                      <TableCell className="font-bold text-xs text-[#4A2E1B]">
                        {log.branch?.name || 'Main Branch'}
                      </TableCell>
                      <TableCell className="font-extrabold text-xs font-mono text-[#2C1B10]">
                        {cashVal.toFixed(2)} ETB
                      </TableCell>
                      <TableCell className="font-extrabold text-xs font-mono text-blue-700">
                        {cbeVal.toFixed(2)} ETB
                      </TableCell>
                      <TableCell className="font-extrabold text-xs font-mono text-purple-700">
                        {tbVal.toFixed(2)} ETB
                      </TableCell>
                      <TableCell className="font-extrabold text-xs font-mono text-[#92400E]">
                        {floatVal.toFixed(2)} ETB
                      </TableCell>
                      <TableCell>
                        <span className="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 font-mono">
                          {totalCollected.toFixed(2)} ETB
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-[#8C7361] max-w-[180px] truncate">
                        {log.notes || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-[#8C7361]">
                        <span className="font-semibold text-[#2C1B10] block">{log.recordedBy?.fullName || 'Staff'}</span>
                        <span className="text-[10px] text-[#8C7361] font-medium">{log.recordedBy?.role || 'Admin'}</span>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditModal(log)}
                            className="h-8 px-2.5 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B] font-bold text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5 mr-1" /> Edit
                          </Button>
                          {isOwner && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setDeleteTargetId(log.id)}
                              className="h-8 px-2 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={15}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {/* Log Daily Cash Modal */}
      {isModalOpen && (
        <Dialog open={true} onOpenChange={() => setIsModalOpen(false)}>
          <DialogContent className="max-w-lg bg-white rounded-3xl p-6 border border-[#EDE4D5] shadow-xl">
            <DialogHeader className="border-b border-[#EDE4D5] pb-3 mb-4">
              <DialogTitle className="flex items-center gap-2 text-lg font-extrabold text-[#2C1B10]">
                <WalletCards className="w-5 h-5 text-[#E87A18]" />
                <span>{editingLog ? 'Edit Daily Cash Log' : 'Record Daily Cash & Digital Money'}</span>
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    Branch Location
                  </label>
                  <select
                    value={formBranchId}
                    onChange={(e) => setFormBranchId(e.target.value)}
                    className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-2.5 text-xs font-bold text-[#2C1B10] focus:ring-[#E87A18]"
                    required
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                    Log Date
                  </label>
                  <Input
                    type="date"
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="bg-[#FAF6F0] border-[#EDE4D5] rounded-xl text-xs font-bold text-[#2C1B10]"
                    required
                  />
                </div>
              </div>

              {/* Input Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                {/* 1. Cash In Drawer Today */}
                <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                  <label className="text-xs font-extrabold text-[#2C1B10] flex items-center gap-1.5 mb-1">
                    <Banknote className="w-4 h-4 text-emerald-600" /> Cash In Drawer Today
                  </label>
                  <p className="text-[10px] text-[#8C7361] mb-2">Physical Paper Cash Collected</p>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cashInDrawer}
                    onChange={(e) => setCashInDrawer(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-white border-[#EDE4D5] rounded-xl font-mono font-bold text-base text-[#2C1B10]"
                  />
                </div>

                {/* 2. CBE Bank Transfer */}
                <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                  <label className="text-xs font-extrabold text-[#2C1B10] flex items-center gap-1.5 mb-1">
                    <CreditCard className="w-4 h-4 text-blue-600" /> CBE Bank Transfer
                  </label>
                  <p className="text-[10px] text-[#8C7361] mb-2">Direct Bank Transfer Income</p>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={cbeTransfer}
                    onChange={(e) => setCbeTransfer(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-white border-[#EDE4D5] rounded-xl font-mono font-bold text-base text-blue-700"
                  />
                </div>

                {/* 3. Telebirr Digital Money */}
                <div className="bg-[#FAF6F0] p-3.5 rounded-2xl border border-[#EDE4D5]">
                  <label className="text-xs font-extrabold text-[#2C1B10] flex items-center gap-1.5 mb-1">
                    <Smartphone className="w-4 h-4 text-purple-600" /> Telebirr Digital Money
                  </label>
                  <p className="text-[10px] text-[#8C7361] mb-2">Telebirr / Mobile Wallet Income</p>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={telebirr}
                    onChange={(e) => setTelebirr(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-white border-[#EDE4D5] rounded-xl font-mono font-bold text-base text-purple-700"
                  />
                </div>

                {/* 4. Tomorrow's Float */}
                <div className="bg-[#FFFBEB] p-3.5 rounded-2xl border border-[#FDE68A]">
                  <label className="text-xs font-extrabold text-[#92400E] flex items-center gap-1.5 mb-1">
                    <RefreshCw className="w-4 h-4 text-amber-600" /> Tomorrow&apos;s Float
                  </label>
                  <p className="text-[10px] text-amber-700 mb-2">Cash Kept in Drawer for Tomorrow</p>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={tomorrowFloat}
                    onChange={(e) => setTomorrowFloat(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    className="bg-white border-[#FDE68A] rounded-xl font-mono font-bold text-base text-[#92400E]"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs font-bold text-[#4A2E1B] block mb-1">
                  Notes & Observations (Optional)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Morning cashier shift count, verified by Hamza"
                  className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-2.5 text-xs text-[#2C1B10] focus:ring-[#E87A18]"
                />
              </div>

              {/* Live Preview Summary Bar */}
              <div className="p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Total Digital (Bank + Telebirr)</span>
                  <span className="font-extrabold font-mono text-indigo-700 text-sm">
                    {previewTotalDigital.toFixed(2)} ETB
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-[10px] uppercase font-bold text-[#8C7361] block">Total Collected (Cash + Digital)</span>
                  <span className="font-extrabold font-mono text-emerald-800 text-base">
                    {previewTotalCollected.toFixed(2)} ETB
                  </span>
                </div>
              </div>

              <DialogFooter className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs h-10 px-4"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs h-10 px-5 shadow-sm"
                >
                  {saveMutation.isPending ? 'Saving...' : editingLog ? 'Save Changes' : 'Record Entry'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTargetId && (
        <ConfirmModal
          isOpen={true}
          title="Delete Daily Cash Log Entry"
          description="Are you sure you want to delete this recorded cash entry? This action cannot be undone."
          confirmText="Delete Entry"
          cancelText="Cancel"
          variant="danger"
          onConfirm={() => deleteMutation.mutate(deleteTargetId)}
          onCancel={() => setDeleteTargetId(null)}
          isLoading={deleteMutation.isPending}
        />
      )}
    </DashboardLayout>
  );
}
