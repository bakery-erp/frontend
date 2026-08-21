'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
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
import { format } from 'date-fns';
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payroll' | 'loans' | 'penalties' | 'pending' | 'settings'>('payroll');

  // Settings State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

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
      toast.error('Please enter current and new password');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setIsChangingPass(true);
    try {
      await api.post('/users/me/change-password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
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
      toast.error('Please select an image file first');
      return;
    }
    setIsUploadingAvatar(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const res = await api.post('/users/me/profile-picture', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Profile picture updated successfully!');
      setSelectedFile(null);
      if (res.data?.filesUrl && updateUser) {
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
      toast.success('Loan approved!');
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve loan');
    }
  };

  const handleRejectLoan = async (id: string) => {
    try {
      await api.post(`/loans/${id}/reject`);
      toast.success('Loan rejected');
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject loan');
    }
  };

  const handleApprovePenalty = async (id: string) => {
    try {
      await api.post(`/penalties/${id}/approve`);
      toast.success('Penalty acknowledged and approved');
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to approve penalty');
    }
  };

  const handleRejectPenalty = async (id: string) => {
    try {
      await api.post(`/penalties/${id}/reject`);
      toast.success('Penalty rejected');
      fetchMyDashboard();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to reject penalty');
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-[#E87A18] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-semibold text-[#8C7361]">Loading your portal profile...</p>
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
  const pendingCount = pendingLoans.length + pendingPenalties.length;

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
      <div className="mb-8">
        <div className="bg-gradient-to-r from-[#2C1B10] via-[#4A2E1B] to-[#5A3A23] rounded-3xl p-6 md:p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 opacity-10 pointer-events-none">
            <User className="w-96 h-96 text-white" />
          </div>

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center space-x-5">
              {u?.filesUrl ? (
                <img
                  src={getImageUrl(u.filesUrl)!}
                  alt={u.fullName}
                  className="w-20 h-20 rounded-2xl object-cover border-2 border-white/40 shadow-lg"
                />
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-[#E87A18] text-white flex items-center justify-center font-extrabold text-3xl shadow-lg border-2 border-white/20">
                  {u?.fullName ? u.fullName.charAt(0).toUpperCase() : 'E'}
                </div>
              )}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-[#E87A18] text-white text-xs px-3 py-0.5 uppercase tracking-wider font-extrabold border-none">
                    {u?.role?.replace('_', ' ') || 'EMPLOYEE'}
                  </Badge>
                  <span className="text-xs font-semibold text-amber-200/90 flex items-center bg-white/10 px-2.5 py-0.5 rounded-full">
                    <Building2 className="w-3 h-3 mr-1" />
                    {u?.branch?.name || 'Global Staff'}
                  </span>
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">{u?.fullName}</h1>
                <p className="text-xs md:text-sm text-amber-100/70 font-medium flex items-center mt-1">
                  <Phone className="w-3.5 h-3.5 mr-1.5" /> {u?.phone}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full md:w-auto bg-white/10 p-4 rounded-2xl backdrop-blur-md border border-white/10">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-200/80 block">Base Salary</span>
                <span className="text-sm font-extrabold">{money(u?.salary)}</span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-200/80 block">Shift</span>
                <span className="text-sm font-extrabold flex items-center">
                  <Clock className="w-3 h-3 mr-1 text-amber-300" />
                  {u?.shift || 'Standard'}
                </span>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-amber-200/80 block">Start Date</span>
                <span className="text-sm font-extrabold flex items-center">
                  <Calendar className="w-3 h-3 mr-1 text-amber-300" />
                  {u?.startDate ? format(new Date(u.startDate), 'MMM d, yyyy') : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Metrics Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Base Monthly Salary</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight">{money(u?.salary)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">Agreed monthly base rate</p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Active Loan Balance</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight">{money(totalLoanBalance)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {loans.filter((l) => l.status === 'OPEN').length} active loan(s)
            </p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Total Penalties</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight">{money(totalPenaltyAmount)}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">{penalties.length} logged record(s)</p>
          </CardContent>
        </Card>

        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Pending Approvals</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">{pendingCount}</div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">Requires your approval</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Navigation Tabs ── */}
      <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-sm overflow-hidden mb-8">
        <div className="flex border-b border-[#EDE4D5] bg-[#FFFDF8] px-6 pt-3 gap-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'payroll' ? 'border-[#E87A18] text-[#E87A18]' : 'border-transparent text-[#8C7361]'
            }`}
          >
            <Receipt className="w-4 h-4" /> Payslips ({payrolls.length})
          </button>

          <button
            onClick={() => setActiveTab('loans')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'loans' ? 'border-[#E87A18] text-[#E87A18]' : 'border-transparent text-[#8C7361]'
            }`}
          >
            <Wallet className="w-4 h-4" /> My Loans ({loans.length})
          </button>

          <button
            onClick={() => setActiveTab('penalties')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'penalties' ? 'border-[#E87A18] text-[#E87A18]' : 'border-transparent text-[#8C7361]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" /> My Penalties ({penalties.length})
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap relative ${
              activeTab === 'pending' ? 'border-[#E87A18] text-[#E87A18]' : 'border-transparent text-[#8C7361]'
            }`}
          >
            <ShieldCheck className="w-4 h-4" /> Pending Approvals
            {pendingCount > 0 && (
              <span className="bg-amber-600 text-white px-2 py-0.5 text-[10px] rounded-full font-bold">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'settings' ? 'border-[#E87A18] text-[#E87A18]' : 'border-transparent text-[#8C7361]'
            }`}
          >
            <Lock className="w-4 h-4" /> Profile & Security Settings
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: PAYROLL */}
          {activeTab === 'payroll' && (
            <div>
              <h3 className="text-base font-extrabold text-[#2C1B10] mb-4">Salary Payslips & History</h3>
              {payrolls.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <p className="text-sm font-bold text-[#4A2E1B]">No Payroll Records Found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-right">Base Salary</TableHead>
                      <TableHead className="text-right">Bonus (+)</TableHead>
                      <TableHead className="text-right">Loan Deduction (-)</TableHead>
                      <TableHead className="text-right">Penalty Deduction (-)</TableHead>
                      <TableHead className="text-right">Final Amount Paid</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payrolls.map((pr) => (
                      <TableRow key={pr.id}>
                        <TableCell className="font-bold">{MONTH_NAMES[(pr.month || 1) - 1]} {pr.year}</TableCell>
                        <TableCell className="text-right">{money(pr.baseSalary)}</TableCell>
                        <TableCell className="text-right text-emerald-600">{Number(pr.bonus) > 0 ? `+${money(pr.bonus)}` : '-'}</TableCell>
                        <TableCell className="text-right text-rose-600">{Number(pr.loanDeductions) > 0 ? `-${money(pr.loanDeductions)}` : '-'}</TableCell>
                        <TableCell className="text-right text-rose-600">{Number(pr.penaltyDeductions) > 0 ? `-${money(pr.penaltyDeductions)}` : '-'}</TableCell>
                        <TableCell className="text-right font-extrabold text-emerald-700">{money(pr.finalAmount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">PAID</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 2: LOANS */}
          {activeTab === 'loans' && (
            <div>
              <h3 className="text-base font-extrabold text-[#2C1B10] mb-4">My Loans & Advances</h3>
              {loans.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <p className="text-sm font-bold text-[#4A2E1B]">No Loans Logged</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Original Amount</TableHead>
                      <TableHead className="text-right">Remaining Balance</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loans.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-bold">{format(new Date(l.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-right">{money(l.totalAmount)}</TableCell>
                        <TableCell className="text-right font-extrabold text-indigo-700">{money(l.remainingBalance)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`font-bold text-[10px] ${
                            l.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' :
                            l.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-800' :
                            l.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                          }`}>
                            {l.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 3: PENALTIES */}
          {activeTab === 'penalties' && (
            <div>
              <h3 className="text-base font-extrabold text-[#2C1B10] mb-4">My Penalties & Fine Records</h3>
              {penalties.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <p className="text-sm font-bold text-[#4A2E1B]">Clean Record — No Penalties!</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date Logged</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-center">Approval Status</TableHead>
                      <TableHead className="text-center">Deduction Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {penalties.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold">{format(new Date(p.createdAt), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{p.reason}</TableCell>
                        <TableCell className="text-right font-bold text-rose-700">{money(p.amount)}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={`font-bold text-[10px] ${
                            p.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'REJECTED' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {p.status || 'PENDING'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge className={`font-bold text-[10px] ${p.isDeducted ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                            {p.isDeducted ? 'DEDUCTED' : 'PENDING SALARY'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          )}

          {/* TAB 4: PENDING APPROVALS */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-extrabold text-[#2C1B10] mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-amber-600" />
                  Pending Loans & Penalties Requiring Your Action
                </h3>
                <p className="text-xs text-[#8C7361] mb-4">
                  Loans or penalties issued by management remain in pending status until you approve or reject them.
                </p>

                {pendingCount === 0 ? (
                  <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                    <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                    <p className="text-sm font-bold text-[#4A2E1B]">No Pending Approvals</p>
                    <p className="text-xs text-[#8C7361] mt-1">You have reviewed all assigned loans and penalties.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Pending Loans */}
                    {pendingLoans.length > 0 && (
                      <div className="border border-amber-200 rounded-2xl p-4 bg-amber-50/50">
                        <h4 className="text-sm font-bold text-amber-900 mb-3">Pending Salary Advances / Loans</h4>
                        <div className="space-y-2">
                          {pendingLoans.map((l) => (
                            <div key={l.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3.5 rounded-xl border border-amber-200 gap-3">
                              <div>
                                <div className="font-extrabold text-[#2C1B10]">{money(l.totalAmount)}</div>
                                <div className="text-xs text-[#8C7361]">Issued: {format(new Date(l.createdAt), 'MMM d, yyyy')}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveLoan(l.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                                >
                                  <Check className="w-4 h-4" /> Accept & Approve Loan
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectLoan(l.id)}
                                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center gap-1"
                                >
                                  <X className="w-4 h-4" /> Reject
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Pending Penalties */}
                    {pendingPenalties.length > 0 && (
                      <div className="border border-rose-200 rounded-2xl p-4 bg-rose-50/50">
                        <h4 className="text-sm font-bold text-rose-900 mb-3">Pending Penalties / Fines</h4>
                        <div className="space-y-2">
                          {pendingPenalties.map((p) => (
                            <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-white p-3.5 rounded-xl border border-rose-200 gap-3">
                              <div>
                                <div className="font-extrabold text-rose-700">{money(p.amount)}</div>
                                <div className="text-xs font-semibold text-[#2C1B10]">Reason: {p.reason}</div>
                                <div className="text-[11px] text-[#8C7361]">Logged: {format(new Date(p.createdAt), 'MMM d, yyyy')}</div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleApprovePenalty(p.id)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1"
                                >
                                  <Check className="w-4 h-4" /> Acknowledge & Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleRejectPenalty(p.id)}
                                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl flex items-center gap-1"
                                >
                                  <X className="w-4 h-4" /> Reject Fine
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

          {/* TAB 5: PROFILE & SECURITY SETTINGS */}
          {activeTab === 'settings' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Profile Picture Upload */}
              <div className="bg-[#FAF7EE] border border-[#EDE4D5] rounded-2xl p-5">
                <h4 className="text-sm font-extrabold text-[#2C1B10] mb-2 flex items-center gap-2">
                  <Camera className="w-4 h-4 text-[#E87A18]" /> Profile Avatar Picture
                </h4>
                <p className="text-xs text-[#8C7361] mb-4">Upload a new photo for your profile avatar across the ERP system.</p>

                <form onSubmit={handleAvatarUpload} className="space-y-4">
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      className="w-full text-xs text-[#2C1B10] file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-[#E87A18] file:text-white hover:file:bg-[#d46d13]"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isUploadingAvatar || !selectedFile}
                    className="bg-[#E87A18] hover:bg-[#d46d13] text-white font-bold rounded-xl text-xs"
                  >
                    {isUploadingAvatar ? 'Uploading...' : 'Save Avatar Picture'}
                  </Button>
                </form>
              </div>

              {/* Password Change Form */}
              <div className="bg-[#FAF7EE] border border-[#EDE4D5] rounded-2xl p-5">
                <h4 className="text-sm font-extrabold text-[#2C1B10] mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#E87A18]" /> Change Account Password
                </h4>
                <p className="text-xs text-[#8C7361] mb-4">Update your secure login password.</p>

                <form onSubmit={handlePasswordChange} className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">Current Password</label>
                    <Input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">New Password</label>
                    <Input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-[#2C1B10] mb-1 block">Confirm New Password</label>
                    <Input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="bg-white border-zinc-200 rounded-xl h-9 text-xs"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isChangingPass}
                    className="bg-[#4A2E1B] hover:bg-[#3D2314] text-white font-bold rounded-xl text-xs mt-2"
                  >
                    {isChangingPass ? 'Updating...' : 'Update Password'}
                  </Button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
