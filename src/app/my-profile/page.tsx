'use client';

import React, { useEffect, useState, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { getImageUrl } from '@/lib/utils';
import {
  User,
  Building2,
  Calendar,
  Clock,
  Banknote,
  Wallet,
  AlertTriangle,
  Receipt,
  CheckCircle2,
  Phone,
  Lock,
  Camera,
  Check,
  X,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { formatEthDate, getEthMonthName } from '@/lib/ethiopianDate';
import { toast } from 'sonner';

interface DashboardData {
  user: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
    salary: number | null;
    startDate: string | null;
    lastPaidDate: string | null;
    shift: string | null;
    filesUrl: string | null;
    branch?: {
      id: string;
      name: string;
    } | null;
  };
  payrollRecords: Array<{
    id: string;
    month: number;
    year: number;
    baseSalary: number;
    loanDeductions: number;
    penaltyDeductions: number;
    bonus: number;
    finalAmount: number;
    status: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    paymentDate: string | null;
    createdAt: string;
  }>;
  loans: Array<{
    id: string;
    totalAmount: number;
    remainingBalance: number;
    status: 'PENDING_APPROVAL' | 'OPEN' | 'PAID' | 'REJECTED';
    type: string;
    date: string;
    createdAt: string;
    payments?: Array<{
      id: string;
      amount: number;
      createdAt: string;
    }>;
  }>;
  penalties: Array<{
    id: string;
    amount: number;
    reason: string;
    status?: 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
    date: string;
    isDeducted: boolean;
    createdAt: string;
  }>;
}

function money(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export default function MyProfilePage() {
  const { user: authUser, updateUser } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payroll' | 'loans' | 'penalties' | 'pending' | 'settings'>('payroll');

  // Tab auto-centering ref
  const tabRefs = useRef<{ [key: string]: HTMLButtonElement | null }>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      const btn = tabRefs.current[activeTab];
      if (btn) {
        btn.scrollIntoView({
          behavior: 'smooth',
          inline: 'center',
          block: 'nearest',
        });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [heroAvatarError, setHeroAvatarError] = useState(false);

  useEffect(() => {
    fetchMyDashboard();
  }, []);

  const fetchMyDashboard = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/me/dashboard');
      setData(res.data);
    } catch (err: any) {
      console.error('Failed to load employee portal details:', err);
      toast.error(err.response?.data?.error || 'Failed to load your profile details');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error(t('profile.enterBothPasswords'));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t('profile.passwordsDoNotMatch'));
      return;
    }
    setIsChangingPass(true);
    try {
      await api.post('/users/me/change-password', { currentPassword, newPassword });
      toast.success(t('profile.passwordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleAvatarUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error(t('profile.selectFilePrompt'));
      return;
    }
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/users/me/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(t('profile.avatarSuccess'));
      setSelectedFile(null);
      setIsAvatarModalOpen(false);
      if (res.data?.filesUrl && updateUser) {
        setHeroAvatarError(false);
        updateUser({ filesUrl: res.data.filesUrl });
      }
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload profile picture');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleApproveLoan = async (id: string) => {
    try {
      await api.post(`/loans/${id}/approve`);
      toast.success(t('profile.loanApprovedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve loan');
    }
  };

  const handleRejectLoan = async (id: string) => {
    try {
      await api.post(`/loans/${id}/reject`);
      toast.success(t('profile.loanRejectedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject loan');
    }
  };

  const handleApprovePenalty = async (id: string) => {
    try {
      await api.post(`/penalties/${id}/approve`);
      toast.success(t('profile.penaltyApprovedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve penalty');
    }
  };

  const handleRejectPenalty = async (id: string) => {
    try {
      await api.post(`/penalties/${id}/reject`);
      toast.success(t('profile.penaltyRejectedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject penalty');
    }
  };

  const handleApprovePayroll = async (id: string) => {
    try {
      await api.post(`/payroll/${id}/approve`);
      toast.success(t('profile.payrollApprovedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve payroll');
    }
  };

  const handleRejectPayroll = async (id: string) => {
    try {
      await api.post(`/payroll/${id}/reject`);
      toast.success(t('profile.payrollRejectedToast'));
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject payroll');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#E87A18] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#8C7361]">{t('profile.loadingProfileText')}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const u = data?.user || authUser;
  const payrolls = data?.payrollRecords || [];
  const loans = data?.loans || [];
  const penalties = data?.penalties || [];

  const pendingLoans = loans.filter((l) => l.status === 'PENDING_APPROVAL');
  const pendingPenalties = penalties.filter((p) => p.status === 'PENDING_APPROVAL');
  const pendingPayrolls = payrolls.filter((pr) => pr.status === 'PENDING_APPROVAL');
  const pendingCount = pendingLoans.length + pendingPenalties.length + pendingPayrolls.length;

  // Totals calculations (only open/approved loans & penalties)
  const totalLoanBalance = loans
    .filter((l) => l.status === 'OPEN')
    .reduce((acc, l) => acc + Number(l.remainingBalance || 0), 0);
  const totalPenaltyAmount = penalties
    .filter((p) => p.status !== 'REJECTED')
    .reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const totalPayrollPaid = payrolls.reduce((acc, pr) => acc + Number(pr.finalAmount || 0), 0);

  return (
    <DashboardLayout>
      {/* ── Page Header & Profile Card ── */}
      <div className="mb-5 xs:mb-8">
        <div className="bg-gradient-to-r from-[#2C1B10] via-[#4A2E1B] to-[#5A3A23] rounded-2xl xs:rounded-3xl p-3.5 xs:p-5 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
            <User className="w-96 h-96 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 xs:gap-6">
            <div className="flex items-center space-x-3 xs:space-x-5 min-w-0 w-full md:w-auto">
              <button
                type="button"
                onClick={() => setIsAvatarModalOpen(true)}
                className="relative group cursor-pointer rounded-2xl overflow-hidden focus:outline-none focus:ring-2 focus:ring-[#E87A18] shrink-0"
                title={t('profile.clickToUpdateAvatar')}
              >
                {u?.filesUrl && !heroAvatarError ? (
                  <img
                    src={getImageUrl(u.filesUrl)!}
                    alt={u.fullName}
                    onError={() => setHeroAvatarError(true)}
                    className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <div className="w-14 h-14 xs:w-16 xs:h-16 sm:w-20 sm:h-20 rounded-2xl bg-[#E87A18] text-white flex items-center justify-center font-extrabold text-xl xs:text-2xl sm:text-3xl shadow-lg border-2 border-white/20 group-hover:scale-105 transition-transform">
                    {u?.fullName ? u.fullName.charAt(0).toUpperCase() : 'E'}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[9px] xs:text-[10px] font-bold">
                  <Camera className="w-4 h-4 xs:w-5 xs:h-5 mb-0.5" />
                  <span>{t('profile.changeAvatarLabel')}</span>
                </div>
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5 xs:gap-2 mb-1">
                  <Badge className="bg-[#E87A18] text-white text-[10px] xs:text-xs px-2 xs:px-3 py-0.5 uppercase tracking-wider font-extrabold border-none">
                    {u?.role?.replace('_', ' ') || t('common.employee')}
                  </Badge>
                  <span className="text-[10px] xs:text-xs font-semibold text-amber-200/90 flex items-center bg-white/10 px-2 xs:px-2.5 py-0.5 rounded-full truncate max-w-[150px] xs:max-w-none">
                    <Building2 className="w-3 h-3 mr-1 shrink-0" />
                    <span className="truncate">
                      {u?.branch?.name && u.branch.name.trim() !== '.' && u.branch.name.trim() !== '' ? u.branch.name : t('common.mainBakery')}
                    </span>
                  </span>
                </div>
                <h1 className="text-lg xs:text-2xl md:text-3xl font-extrabold tracking-tight truncate">{u?.fullName}</h1>
                <p className="text-[11px] xs:text-xs md:text-sm text-amber-100/70 font-medium flex items-center mt-0.5 xs:mt-1 truncate">
                  <Phone className="w-3 h-3 xs:w-3.5 xs:h-3.5 mr-1 xs:mr-1.5 shrink-0" /> <span className="truncate">{u?.phone}</span>
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 xs:gap-3 w-full md:w-auto bg-white/10 p-2.5 xs:p-4 rounded-xl xs:rounded-2xl backdrop-blur-md border border-white/10">
              <div>
                <span className="text-[9px] xs:text-[10px] uppercase font-bold text-amber-200/80 block">{t('profile.baseSalary')}</span>
                <span className="text-xs xs:text-sm font-extrabold truncate block">{money(u?.salary)}</span>
              </div>
              <div>
                <span className="text-[9px] xs:text-[10px] uppercase font-bold text-amber-200/80 block">{t('profile.shiftLabel')}</span>
                <span className="text-xs xs:text-sm font-extrabold flex items-center truncate">
                  <Clock className="w-3 h-3 mr-1 text-amber-300 shrink-0" />
                  <span className="truncate">{u?.shift || t('common.standard')}</span>
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[9px] xs:text-[10px] uppercase font-bold text-amber-200/80 block">{t('profile.startDateLabel')}</span>
                <span className="text-xs xs:text-sm font-extrabold flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-amber-300 shrink-0" />
                  <span>{u?.startDate ? formatEthDate(u.startDate) : t('common.na')}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Summary Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-5 xs:mb-8">
        <Card className="border-[#EDE4D5] bg-white rounded-2xl shadow-xs hover:border-[#E87A18]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-4 pt-3.5">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('profile.baseSalary')}</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
              <Banknote className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3.5 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight">{money(u?.salary)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">{t('profile.monthlyBaseRate')}</p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-2xl shadow-xs hover:border-[#E87A18]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-4 pt-3.5">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('profile.loanBalance')}</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center shrink-0">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3.5 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight">{money(totalLoanBalance)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {t('profile.activeLoansCount', { count: loans.filter((l) => l.status === 'OPEN').length })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-2xl shadow-xs hover:border-[#E87A18]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-4 pt-3.5">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('profile.penaltiesTotal')}</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-700 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">{money(totalPenaltyAmount)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">{t('profile.loggedPenaltiesCount', { count: penalties.length })}</p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-2xl shadow-xs hover:border-[#E87A18]/40 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 px-4 pt-3.5">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">{t('profile.pendingApprovals')}</CardTitle>
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-3.5 pt-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">{pendingCount}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">{t('profile.requiresYourReview')}</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Navigation Tabs ── */}
      <div className="bg-white rounded-2xl xs:rounded-3xl border border-[#EDE4D5] shadow-xs overflow-hidden mb-6 xs:mb-8">
        {/* Sleek Segmented Pill Tabs with Auto-Centering & Edge Fade Hints */}
        <div className="relative">
          {/* Subtle scroll edge gradient hints on mobile to indicate scrollability */}
          <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-4 bg-gradient-to-r from-[#FAF7EE] to-transparent z-10 sm:hidden" />
          <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-4 bg-gradient-to-l from-[#FAF7EE] to-transparent z-10 sm:hidden" />

          <div className="bg-[#FAF7EE] px-2 py-1.5 xs:py-2 border-b border-[#EDE4D5] flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth [scroll-padding:0_3rem]">
            <button
              ref={(el) => { tabRefs.current['payroll'] = el; }}
              type="button"
              onClick={() => setActiveTab('payroll')}
              className={`px-3 py-2 rounded-xl text-xs xs:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E87A18] ${
                activeTab === 'payroll'
                  ? 'bg-white text-[#E87A18] shadow-xs ring-1 ring-[#E87A18]/25'
                  : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50'
              }`}
            >
              <Receipt className="w-3.5 h-3.5 xs:w-4 xs:h-4 shrink-0" />
              <span>{t('profile.tabPayslips', { count: payrolls.length })}</span>
            </button>

            <button
              ref={(el) => { tabRefs.current['loans'] = el; }}
              type="button"
              onClick={() => setActiveTab('loans')}
              className={`px-3 py-2 rounded-xl text-xs xs:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E87A18] ${
                activeTab === 'loans'
                  ? 'bg-white text-[#E87A18] shadow-xs ring-1 ring-[#E87A18]/25'
                  : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50'
              }`}
            >
              <Wallet className="w-3.5 h-3.5 xs:w-4 xs:h-4 shrink-0" />
              <span>{t('profile.tabLoans', { count: loans.length })}</span>
            </button>

            <button
              ref={(el) => { tabRefs.current['penalties'] = el; }}
              type="button"
              onClick={() => setActiveTab('penalties')}
              className={`px-3 py-2 rounded-xl text-xs xs:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E87A18] ${
                activeTab === 'penalties'
                  ? 'bg-white text-[#E87A18] shadow-xs ring-1 ring-[#E87A18]/25'
                  : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 xs:w-4 xs:h-4 shrink-0" />
              <span>{t('profile.tabPenalties', { count: penalties.length })}</span>
            </button>

            <button
              ref={(el) => { tabRefs.current['pending'] = el; }}
              type="button"
              onClick={() => setActiveTab('pending')}
              className={`px-3 py-2 rounded-xl text-xs xs:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E87A18] ${
                activeTab === 'pending'
                  ? 'bg-white text-[#E87A18] shadow-xs ring-1 ring-[#E87A18]/25'
                  : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5 xs:w-4 xs:h-4 shrink-0" />
              <span>{t('profile.tabApprovals')}</span>
              {pendingCount > 0 && (
                <span className="bg-amber-600 text-white px-1.5 py-0.5 text-[9px] xs:text-[10px] rounded-full font-bold leading-none">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              ref={(el) => { tabRefs.current['settings'] = el; }}
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`px-3 py-2 rounded-xl text-xs xs:text-sm font-extrabold transition-all duration-200 flex items-center gap-1.5 whitespace-nowrap shrink-0 outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E87A18] ${
                activeTab === 'settings'
                  ? 'bg-white text-[#E87A18] shadow-xs ring-1 ring-[#E87A18]/25'
                  : 'text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50'
              }`}
            >
              <Lock className="w-3.5 h-3.5 xs:w-4 xs:h-4 shrink-0" />
              <span>{t('profile.tabSecurity')}</span>
            </button>
          </div>
        </div>

        <div className="p-3.5 xs:p-5 sm:p-6">
          {/* TAB 1: PAYROLL */}
          {activeTab === 'payroll' && (
            <div>
              <h3 className="text-sm xs:text-base font-extrabold text-[#2C1B10] mb-3 xs:mb-4">{t('profile.payslipsHistoryTitle')}</h3>
              {payrolls.length === 0 ? (
                <div className="py-10 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <p className="text-sm font-bold text-[#4A2E1B]">{t('profile.noPayslipsFound')}</p>
                </div>
              ) : (
                <>
                  {/* Mobile Receipt Cards (< md) */}
                  <div className="space-y-3 md:hidden">
                    {payrolls.map((pr) => {
                      const isApproved = pr.status === 'APPROVED';
                      const isRejected = pr.status === 'REJECTED';
                      const statusLabel = isApproved ? t('common.approved') : isRejected ? t('common.rejected') : t('common.pendingReview');
                      const statusBadgeClass = isApproved
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isRejected
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300';

                      return (
                        <div key={pr.id} className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-3.5 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-[#EDE4D5]/70 pb-2 gap-2">
                            <div className="font-extrabold text-sm text-[#2C1B10] whitespace-nowrap">
                              {getEthMonthName(pr.month)} {pr.year}
                            </div>
                            <Badge className={`font-bold text-[10px] px-2 py-0.5 shrink-0 ${statusBadgeClass}`}>
                              {statusLabel}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.colBaseSalary')}</span>
                              <span className="font-bold text-[#2C1B10]">{money(pr.baseSalary)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.colBonusPlus')}</span>
                              <span className="font-bold text-emerald-600">{Number(pr.bonus) > 0 ? `+${money(pr.bonus)}` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.colLoanDeductionMinus')}</span>
                              <span className="font-bold text-rose-600">{Number(pr.loanDeductions) > 0 ? `-${money(pr.loanDeductions)}` : '-'}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.colPenaltyDeductionMinus')}</span>
                              <span className="font-bold text-rose-600">{Number(pr.penaltyDeductions) > 0 ? `-${money(pr.penaltyDeductions)}` : '-'}</span>
                            </div>
                          </div>
                          <div className="pt-2 border-t border-[#EDE4D5]/70 flex items-center justify-between bg-emerald-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
                            <span className="text-[11px] xs:text-xs font-extrabold text-emerald-900 uppercase tracking-wide">{t('profile.colFinalNetPaid')}</span>
                            <span className="text-sm font-black text-emerald-700">{money(pr.finalAmount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Full Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('profile.colPeriod')}</TableHead>
                          <TableHead className="text-right">{t('profile.colBaseSalary')}</TableHead>
                          <TableHead className="text-right">{t('profile.colBonusPlus')}</TableHead>
                          <TableHead className="text-right">{t('profile.colLoanDeductionMinus')}</TableHead>
                          <TableHead className="text-right">{t('profile.colPenaltyDeductionMinus')}</TableHead>
                          <TableHead className="text-right">{t('profile.colFinalNetPaid')}</TableHead>
                          <TableHead className="text-center">{t('profile.colStatus')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrolls.map((pr) => {
                          const isApproved = pr.status === 'APPROVED';
                          const isRejected = pr.status === 'REJECTED';
                          const statusLabel = isApproved ? t('common.approved') : isRejected ? t('common.rejected') : t('common.pendingReview');
                          const statusBadgeClass = isApproved
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300';

                          return (
                            <TableRow key={pr.id}>
                              <TableCell className="font-bold">{getEthMonthName(pr.month)} {pr.year}</TableCell>
                              <TableCell className="text-right">{money(pr.baseSalary)}</TableCell>
                              <TableCell className="text-right text-emerald-600">{Number(pr.bonus) > 0 ? `+${money(pr.bonus)}` : '-'}</TableCell>
                              <TableCell className="text-right text-rose-600">{Number(pr.loanDeductions) > 0 ? `-${money(pr.loanDeductions)}` : '-'}</TableCell>
                              <TableCell className="text-right text-rose-600">{Number(pr.penaltyDeductions) > 0 ? `-${money(pr.penaltyDeductions)}` : '-'}</TableCell>
                              <TableCell className="text-right font-extrabold text-emerald-700">{money(pr.finalAmount)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-bold text-[10px] ${statusBadgeClass}`}>
                                  {statusLabel}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: LOANS */}
          {activeTab === 'loans' && (
            <div>
              <h3 className="text-sm xs:text-base font-extrabold text-[#2C1B10] mb-3 xs:mb-4">{t('profile.loansAdvancesTitle')}</h3>
              {loans.length === 0 ? (
                <div className="py-10 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <p className="text-sm font-bold text-[#4A2E1B]">{t('profile.noLoansLogged')}</p>
                </div>
              ) : (
                <>
                  {/* Mobile Loan Cards (< md) */}
                  <div className="space-y-3 md:hidden">
                    {loans.map((l) => {
                      const total = Number(l.totalAmount || 0);
                      const balance = Number(l.remainingBalance || 0);
                      const paid = Math.max(0, total - balance);
                      const percentPaid = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 100;
                      const isPaid = l.status === 'PAID';
                      const isPending = l.status === 'PENDING_APPROVAL';
                      const isRejected = l.status === 'REJECTED';
                      const statusLabel = isPaid ? t('common.paidInFull') : isPending ? t('common.pendingApproval') : isRejected ? t('common.rejected') : t('common.active');
                      const statusBadgeClass = isPaid
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isPending
                        ? 'bg-amber-100 text-amber-800 border-amber-300'
                        : isRejected
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-indigo-100 text-indigo-800 border-indigo-300';

                      return (
                        <div key={l.id} className="bg-[#FFFDF8] border border-[#EDE4D5] rounded-2xl p-3.5 shadow-xs space-y-2.5">
                          <div className="flex items-center justify-between border-b border-[#EDE4D5]/70 pb-2 gap-2">
                            <div className="font-extrabold text-xs text-[#2C1B10] flex items-center gap-1.5 whitespace-nowrap">
                              <Calendar className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                              <span>{formatEthDate(l.createdAt)}</span>
                            </div>
                            <Badge className={`font-bold text-[10px] px-2 py-0.5 shrink-0 ${statusBadgeClass}`}>
                              {statusLabel}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.totalAdvance')}</span>
                              <span className="font-bold text-[#2C1B10]">{money(l.totalAmount)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.remainingBalance')}</span>
                              <span className="font-black text-indigo-700">{money(l.remainingBalance)}</span>
                            </div>
                          </div>
                          <div className="pt-1">
                            <div className="flex justify-between text-[10px] font-bold text-[#8C7361] mb-1">
                              <span>{t('profile.repaidPercent', { percent: percentPaid })}</span>
                              <span>{t('profile.paidAmountText', { amount: money(paid) })}</span>
                            </div>
                            <div className="w-full bg-[#EDE4D5] rounded-full h-1.5 overflow-hidden">
                              <div className="bg-[#E87A18] h-1.5 rounded-full transition-all duration-300" style={{ width: `${percentPaid}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('common.date')}</TableHead>
                          <TableHead className="text-right">{t('profile.colOriginalAmount')}</TableHead>
                          <TableHead className="text-right">{t('profile.remainingBalance')}</TableHead>
                          <TableHead className="text-center">{t('profile.colStatus')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loans.map((l) => {
                          const isPaid = l.status === 'PAID';
                          const isPending = l.status === 'PENDING_APPROVAL';
                          const isRejected = l.status === 'REJECTED';
                          const statusLabel = isPaid ? t('common.paidInFull') : isPending ? t('common.pendingApproval') : isRejected ? t('common.rejected') : t('common.active');
                          const statusBadgeClass = isPaid
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isPending
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-indigo-100 text-indigo-800 border-indigo-300';

                          return (
                            <TableRow key={l.id}>
                              <TableCell className="font-bold">{formatEthDate(l.createdAt)}</TableCell>
                              <TableCell className="text-right">{money(l.totalAmount)}</TableCell>
                              <TableCell className="text-right font-extrabold text-indigo-700">{money(l.remainingBalance)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-bold text-[10px] ${statusBadgeClass}`}>
                                  {statusLabel}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: PENALTIES */}
          {activeTab === 'penalties' && (
            <div>
              <h3 className="text-sm xs:text-base font-extrabold text-[#2C1B10] mb-3 xs:mb-4">{t('profile.penaltiesTitle')}</h3>
              {penalties.length === 0 ? (
                <div className="py-10 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#4A2E1B]">{t('profile.noPenaltiesClean')}</p>
                  <p className="text-xs text-[#8C7361] mt-1">{t('profile.noPenaltiesDesc')}</p>
                </div>
              ) : (
                <>
                  {/* Mobile Penalty Cards (< md) */}
                  <div className="space-y-3 md:hidden">
                    {penalties.map((p) => {
                      const isApproved = p.status === 'APPROVED';
                      const isRejected = p.status === 'REJECTED';
                      const statusLabel = isApproved ? t('common.approved') : isRejected ? t('common.rejected') : t('common.pendingApproval');
                      const statusBadgeClass = isApproved
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        : isRejected
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-amber-100 text-amber-800 border-amber-300';

                      return (
                        <div key={p.id} className="bg-[#FFFDF8] border border-rose-200/70 rounded-2xl p-3.5 shadow-xs space-y-3">
                          {/* Header: Date on left, Single status badge on right */}
                          <div className="flex items-center justify-between border-b border-[#EDE4D5]/70 pb-2.5 gap-2">
                            <div className="font-extrabold text-xs text-[#2C1B10] flex items-center gap-1.5 whitespace-nowrap">
                              <Calendar className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
                              <span>{formatEthDate(p.createdAt)}</span>
                            </div>
                            <Badge className={`font-bold text-[10px] px-2 py-0.5 shrink-0 ${statusBadgeClass}`}>
                              {statusLabel}
                            </Badge>
                          </div>

                          {/* Reason */}
                          <div>
                            <span className="text-[10px] uppercase font-bold text-[#8C7361] block">{t('profile.reasonNoticeLabel')}</span>
                            <p className="text-xs font-bold text-[#2C1B10] mt-0.5 break-words">{p.reason || t('profile.noReasonProvided')}</p>
                          </div>

                          {/* Deduction Status Row */}
                          <div className="flex items-center justify-between text-xs pt-1">
                            <span className="text-[10px] uppercase font-bold text-[#8C7361]">{t('profile.salaryDeductionLabel')}</span>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                              p.isDeducted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {p.isDeducted ? t('profile.deductedFromSalary') : t('profile.pendingNextPayroll')}
                            </span>
                          </div>

                          {/* Amount Highlight Footer */}
                          <div className="pt-2 border-t border-[#EDE4D5]/70 flex items-center justify-between bg-rose-50/70 -mx-3.5 -mb-3.5 p-3 rounded-b-2xl">
                            <span className="text-[11px] xs:text-xs font-bold text-rose-900 uppercase tracking-wide">{t('profile.penaltyAmountLabel')}</span>
                            <span className="text-sm font-black text-rose-700">{money(p.amount)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop Table (>= md) */}
                  <div className="hidden md:block overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t('profile.colDateLogged')}</TableHead>
                          <TableHead>{t('common.reason')}</TableHead>
                          <TableHead className="text-right">{t('common.amount')}</TableHead>
                          <TableHead className="text-center">{t('profile.colApprovalStatus')}</TableHead>
                          <TableHead className="text-center">{t('profile.colDeductionStatus')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {penalties.map((p) => {
                          const isApproved = p.status === 'APPROVED';
                          const isRejected = p.status === 'REJECTED';
                          const statusLabel = isApproved ? t('common.approved') : isRejected ? t('common.rejected') : t('common.pendingApproval');
                          const statusBadgeClass = isApproved
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : isRejected
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300';

                          return (
                            <TableRow key={p.id}>
                              <TableCell className="font-bold">{formatEthDate(p.createdAt)}</TableCell>
                              <TableCell>{p.reason}</TableCell>
                              <TableCell className="text-right font-bold text-rose-700">{money(p.amount)}</TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-bold text-[10px] ${statusBadgeClass}`}>
                                  {statusLabel}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-center">
                                <Badge className={`font-bold text-[10px] ${p.isDeducted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                  {p.isDeducted ? t('common.deducted') : t('common.pendingSalary')}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: PENDING APPROVALS */}
          {activeTab === 'pending' && (
            <div className="space-y-5 xs:space-y-6">
              <div>
                <h3 className="text-sm xs:text-base font-extrabold text-[#2C1B10] mb-1.5 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 xs:w-5 xs:h-5 text-amber-600 shrink-0" />
                  {t('profile.pendingApprovalsTitle')}
                </h3>
                <p className="text-[11px] xs:text-xs text-[#8C7361] mb-4">
                  {t('profile.pendingApprovalsDesc')}
                </p>

                {pendingCount === 0 ? (
                  <div className="py-10 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                    <CheckCircle2 className="w-9 h-9 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#4A2E1B]">{t('profile.noPendingApprovals')}</p>
                    <p className="text-xs text-[#8C7361] mt-1">{t('profile.allReviewedDesc')}</p>
                  </div>
                ) : (
                  <div className="space-y-4 xs:space-y-6">
                    {/* Pending Payrolls */}
                    {pendingPayrolls.length > 0 && (
                      <div className="border border-indigo-200 rounded-2xl p-3 xs:p-4 bg-indigo-50/50">
                        <h4 className="text-xs xs:text-sm font-bold text-indigo-900 mb-3 flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-indigo-600 shrink-0" /> {t('profile.pendingPayslipsTitle')}
                        </h4>
                        <div className="space-y-2.5">
                          {pendingPayrolls.map((pr) => (
                            <div key={pr.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3.5 xs:p-4 rounded-xl border border-indigo-200 gap-3">
                              <div className="min-w-0">
                                <div className="font-extrabold text-sm xs:text-base text-[#2C1B10] flex flex-wrap items-center gap-2">
                                  <span>{getEthMonthName(pr.month)} {pr.year}</span>
                                  <span className="font-mono text-emerald-700 font-black">{money(pr.finalAmount)}</span>
                                </div>
                                <div className="text-[11px] xs:text-xs text-[#8C7361] mt-1 flex flex-wrap gap-x-2.5 gap-y-0.5">
                                  <span>{t('profile.colBaseSalary')}: {money(pr.baseSalary)}</span>
                                  {Number(pr.bonus) > 0 && <span className="text-emerald-700 font-semibold">{t('common.bonus')}: +{money(pr.bonus)}</span>}
                                  {Number(pr.loanDeductions) > 0 && <span className="text-rose-600 font-semibold">{t('profile.colLoanDeductionMinus')}: -{money(pr.loanDeductions)}</span>}
                                  {Number(pr.penaltyDeductions) > 0 && <span className="text-rose-600 font-semibold">{t('profile.colPenaltyDeductionMinus')}: -{money(pr.penaltyDeductions)}</span>}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-1 md:mt-0 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePayroll(pr.id)}
                                  className="min-h-[44px] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 shadow-xs px-3"
                                >
                                  <Check className="w-4 h-4 shrink-0" /> {t('profile.acceptPayslip')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectPayroll(pr.id)}
                                  className="min-h-[44px] h-11 border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center justify-center gap-1 px-3"
                                >
                                  <X className="w-4 h-4 shrink-0" /> {t('profile.rejectBtn')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending Loans */}
                    {pendingLoans.length > 0 && (
                      <div className="border border-amber-200 rounded-2xl p-3 xs:p-4 bg-amber-50/50">
                        <h4 className="text-xs xs:text-sm font-bold text-amber-900 mb-3">{t('profile.pendingLoansTitle')}</h4>
                        <div className="space-y-2.5">
                          {pendingLoans.map((l) => (
                            <div key={l.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3.5 xs:p-4 rounded-xl border border-amber-200 gap-3">
                              <div>
                                <div className="font-extrabold text-sm xs:text-base text-[#2C1B10]">{money(l.totalAmount)}</div>
                                <div className="text-xs text-[#8C7361] mt-0.5">{t('common.date')}: {formatEthDate(l.createdAt)}</div>
                              </div>
                              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-1 md:mt-0 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveLoan(l.id)}
                                  className="min-h-[44px] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 px-3"
                                >
                                  <Check className="w-4 h-4 shrink-0" /> {t('profile.acceptLoan')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectLoan(l.id)}
                                  className="min-h-[44px] h-11 border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center justify-center gap-1 px-3"
                                >
                                  <X className="w-4 h-4 shrink-0" /> {t('profile.rejectBtn')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending Penalties */}
                    {pendingPenalties.length > 0 && (
                      <div className="border border-rose-200 rounded-2xl p-3 xs:p-4 bg-rose-50/50">
                        <h4 className="text-xs xs:text-sm font-bold text-rose-900 mb-3">{t('profile.pendingPenaltiesTitle')}</h4>
                        <div className="space-y-2.5">
                          {pendingPenalties.map((p) => (
                            <div key={p.id} className="flex flex-col md:flex-row md:items-center justify-between bg-white p-3.5 xs:p-4 rounded-xl border border-rose-200 gap-3">
                              <div>
                                <div className="font-extrabold text-sm xs:text-base text-rose-700">{money(p.amount)}</div>
                                <div className="text-xs font-semibold text-[#2C1B10] mt-0.5">{t('common.reason')}: {p.reason}</div>
                                <div className="text-[11px] text-[#8C7361] mt-0.5">{t('common.date')}: {formatEthDate(p.createdAt)}</div>
                              </div>
                              <div className="grid grid-cols-1 xs:grid-cols-2 gap-2 mt-1 md:mt-0 shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePenalty(p.id)}
                                  className="min-h-[44px] h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1 px-3"
                                >
                                  <Check className="w-4 h-4 shrink-0" /> {t('profile.acknowledgeFine')}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectPenalty(p.id)}
                                  className="min-h-[44px] h-11 border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center justify-center gap-1 px-3"
                                >
                                  <X className="w-4 h-4 shrink-0" /> {t('profile.rejectBtn')}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: SECURITY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="max-w-xl">
              <div className="bg-[#FAF7EE] border border-[#EDE4D5] rounded-2xl p-4 xs:p-6 shadow-xs">
                <h4 className="text-sm xs:text-base font-extrabold text-[#2C1B10] mb-1 flex items-center gap-2">
                  <Lock className="w-4 h-4 xs:w-5 xs:h-5 text-[#E87A18]" /> {t('profile.changePasswordTitle')}
                </h4>
                <p className="text-[11px] xs:text-xs text-[#8C7361] mb-4 xs:mb-5">{t('profile.changePasswordDesc')}</p>

                <form onSubmit={handlePasswordChange} className="space-y-3.5 xs:space-y-4">
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">{t('profile.currentPasswordLabel')}</label>
                    <Input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-11 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">{t('profile.newPasswordLabel')}</label>
                    <Input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-11 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">{t('profile.confirmNewPasswordLabel')}</label>
                    <Input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-11 text-sm"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isChangingPass}
                    className="min-h-[44px] h-11 w-full xs:w-auto bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs px-6 mt-2"
                  >
                    {isChangingPass ? t('profile.updatingPasswordBtn') : t('profile.updatePasswordBtn')}
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PROFILE PICTURE POPUP DIALOG ── */}
      <Dialog open={isAvatarModalOpen} onOpenChange={setIsAvatarModalOpen}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md rounded-2xl p-4 xs:p-6 bg-white border-[#EDE4D5]">
          <DialogHeader>
            <DialogTitle className="text-base xs:text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
              <Camera className="w-5 h-5 text-[#E87A18]" /> {t('profile.changeProfilePicTitle')}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAvatarUpload} className="space-y-4 py-2">
            <p className="text-xs text-[#8C7361]">
              {t('profile.changeProfilePicDesc')}
            </p>

            <div className="flex flex-col items-center justify-center p-3 xs:p-4 bg-[#FAF7EE] border border-dashed border-[#EDE4D5] rounded-2xl">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-[#2C1B10] file:mr-2.5 file:py-2 file:px-3 xs:file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#E87A18] file:text-white hover:file:bg-[#d46d13]"
              />
            </div>

            <DialogFooter className="flex-col xs:flex-row gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAvatarModalOpen(false)}
                className="min-h-[44px] h-11 rounded-xl border-[#EDE4D5] text-xs font-bold text-[#4A2E1B] w-full xs:w-auto"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                disabled={isUploadingAvatar || !selectedFile}
                className="min-h-[44px] h-11 bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs w-full xs:w-auto"
              >
                {isUploadingAvatar ? t('profile.uploadingAvatarBtn') : t('profile.saveAvatarPictureBtn')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
