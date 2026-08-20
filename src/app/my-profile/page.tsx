'use client';

import React, { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { api } from '@/lib/axios';
import { useAuth } from '@/context/AuthContext';
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
  ShieldAlert,
  FileText,
  Phone,
  Briefcase
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
    status: 'OPEN' | 'PAID';
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
  const { user: authUser } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payroll' | 'loans' | 'penalties'>('payroll');

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

  // Totals calculations
  const totalLoanBalance = loans.reduce((acc, l) => acc + Number(l.remainingBalance || 0), 0);
  const totalPenaltyAmount = penalties.reduce((acc, p) => acc + Number(p.amount || 0), 0);
  const pendingPenalties = penalties.filter(p => !p.isDeducted).reduce((acc, p) => acc + Number(p.amount || 0), 0);
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
              <div className="w-20 h-20 rounded-2xl bg-[#E87A18] text-white flex items-center justify-center font-extrabold text-3xl shadow-lg border-2 border-white/20">
                {u?.fullName ? u.fullName.charAt(0).toUpperCase() : 'E'}
              </div>
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
        {/* Base Monthly Salary */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Base Monthly Salary</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center">
              <Banknote className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {money(u?.salary)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              Agreed monthly base rate
            </p>
          </CardContent>
        </Card>

        {/* Loan Balance */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Active Loan Balance</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-700 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {money(totalLoanBalance)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {loans.filter(l => l.status === 'OPEN').length} active salary advance(s)
            </p>
          </CardContent>
        </Card>

        {/* Penalties & Deductions */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Total Penalties Logged</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-rose-500/10 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-rose-700 tracking-tight font-heading">
              {money(totalPenaltyAmount)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              {pendingPenalties > 0 ? `${money(pendingPenalties)} pending deduction` : 'All penalties deducted'}
            </p>
          </CardContent>
        </Card>

        {/* Payroll Received */}
        <Card className="border-[#EDE4D5] bg-white rounded-3xl shadow-sm hover:shadow-md transition-all p-1">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-bold uppercase text-[#8C7361] tracking-wider">Total Salary Received</CardTitle>
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
              <Receipt className="h-5 w-5" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl sm:text-3xl font-extrabold text-[#2C1B10] tracking-tight font-heading">
              {money(totalPayrollPaid)}
            </div>
            <p className="text-xs text-[#8C7361] font-semibold mt-1">
              Across {payrolls.length} payslip cycle(s)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Records Tabs ── */}
      <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-sm overflow-hidden mb-8">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#EDE4D5] bg-[#FFFDF8] px-6 pt-3 gap-6">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'payroll'
                ? 'border-[#E87A18] text-[#E87A18]'
                : 'border-transparent text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            <Receipt className="w-4 h-4" />
            Salary & Payslips ({payrolls.length})
          </button>
          <button
            onClick={() => setActiveTab('loans')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'loans'
                ? 'border-[#E87A18] text-[#E87A18]'
                : 'border-transparent text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            <Wallet className="w-4 h-4" />
            My Loans & Advances ({loans.length})
          </button>
          <button
            onClick={() => setActiveTab('penalties')}
            className={`pb-4 text-sm font-extrabold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'penalties'
                ? 'border-[#E87A18] text-[#E87A18]'
                : 'border-transparent text-[#8C7361] hover:text-[#2C1B10]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            My Penalties & Deductions ({penalties.length})
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: PAYROLL / SALARY HISTORY */}
          {activeTab === 'payroll' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#2C1B10]">Payroll & Monthly Salary Payslips</h3>
                  <p className="text-xs text-[#8C7361]">History of processed monthly salaries, bonuses, and deductions.</p>
                </div>
              </div>

              {payrolls.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <Receipt className="w-10 h-10 text-[#8C7361] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-[#4A2E1B]">No Payroll Records Found</p>
                  <p className="text-xs text-[#8C7361] mt-1">Your monthly salary processing records will appear here once disbursed by management.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#FFFDF8]">
                      <TableRow className="border-b border-[#EDE4D5]">
                        <TableHead className="font-extrabold text-[#2C1B10]">Period (Month/Year)</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Base Salary</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Bonus (+)</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Loan Deduction (-)</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Penalty Deduction (-)</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Final Amount Paid</TableHead>
                        <TableHead className="text-center font-extrabold text-[#2C1B10]">Payment Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrolls.map((pr) => (
                        <TableRow key={pr.id} className="border-b border-[#EDE4D5] hover:bg-[#FAF7EE]/50">
                          <TableCell className="font-bold text-[#2C1B10]">
                            {MONTH_NAMES[(pr.month || 1) - 1]} {pr.year}
                          </TableCell>
                          <TableCell className="text-right font-medium text-[#4A2E1B]">{money(pr.baseSalary)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">
                            {Number(pr.bonus) > 0 ? `+${money(pr.bonus)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-rose-600">
                            {Number(pr.loanDeductions) > 0 ? `-${money(pr.loanDeductions)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-rose-600">
                            {Number(pr.penaltyDeductions) > 0 ? `-${money(pr.penaltyDeductions)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-extrabold text-emerald-700 text-base">
                            {money(pr.finalAmount)}
                          </TableCell>
                          <TableCell className="text-center">
                            {pr.paymentDate ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                                PAID ({format(new Date(pr.paymentDate), 'MMM d, yyyy')})
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-amber-800 border-amber-300 bg-amber-50 font-bold text-[10px]">
                                PROCESSED
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOANS & ADVANCES */}
          {activeTab === 'loans' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#2C1B10]">My Salary Advances & Loans</h3>
                  <p className="text-xs text-[#8C7361]">Tracking of active loans, repayment installments, and remaining balances.</p>
                </div>
              </div>

              {loans.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <Wallet className="w-10 h-10 text-[#8C7361] mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-bold text-[#4A2E1B]">No Salary Loans Logged</p>
                  <p className="text-xs text-[#8C7361] mt-1">You have no recorded salary advance or loan records on file.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#FFFDF8]">
                      <TableRow className="border-b border-[#EDE4D5]">
                        <TableHead className="font-extrabold text-[#2C1B10]">Borrowed Date</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Original Loan Amount</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Remaining Balance</TableHead>
                        <TableHead className="text-center font-extrabold text-[#2C1B10]">Status</TableHead>
                        <TableHead className="font-extrabold text-[#2C1B10]">Payment Repayments</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loans.map((l) => (
                        <TableRow key={l.id} className="border-b border-[#EDE4D5] hover:bg-[#FAF7EE]/50">
                          <TableCell className="font-bold text-[#2C1B10]">
                            {l.date ? format(new Date(l.date), 'MMM d, yyyy') : format(new Date(l.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right font-bold text-[#2C1B10]">{money(l.totalAmount)}</TableCell>
                          <TableCell className="text-right font-extrabold text-indigo-700">
                            {money(l.remainingBalance)}
                          </TableCell>
                          <TableCell className="text-center">
                            {l.status === 'PAID' || Number(l.remainingBalance) === 0 ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                                FULLY REPAID
                              </Badge>
                            ) : (
                              <Badge className="bg-indigo-100 text-indigo-800 border-indigo-300 font-bold text-[10px]">
                                OPEN ({money(l.remainingBalance)} left)
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {l.payments && l.payments.length > 0 ? (
                              <div className="text-xs space-y-1">
                                {l.payments.map((p, idx) => (
                                  <div key={p.id || idx} className="flex justify-between items-center bg-[#FAF7EE] px-2 py-1 rounded text-[11px]">
                                    <span className="text-[#8C7361]">{format(new Date(p.createdAt), 'MMM d, yyyy')}</span>
                                    <span className="font-bold text-emerald-700">-{money(p.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-[#8C7361] italic">No repayments recorded yet</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PENALTIES & DEDUCTIONS */}
          {activeTab === 'penalties' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-base font-extrabold text-[#2C1B10]">My Penalties & Fine Records</h3>
                  <p className="text-xs text-[#8C7361]">Detailed list of administrative fines and payroll deduction statuses.</p>
                </div>
              </div>

              {penalties.length === 0 ? (
                <div className="py-12 text-center bg-[#FAF7EE] rounded-2xl border border-dashed border-[#EDE4D5]">
                  <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto mb-2" />
                  <p className="text-sm font-bold text-[#4A2E1B]">Clean Record — No Penalties!</p>
                  <p className="text-xs text-[#8C7361] mt-1">You have zero penalty or fine records registered.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-[#FFFDF8]">
                      <TableRow className="border-b border-[#EDE4D5]">
                        <TableHead className="font-extrabold text-[#2C1B10]">Date Logged</TableHead>
                        <TableHead className="font-extrabold text-[#2C1B10]">Reason / Incident</TableHead>
                        <TableHead className="text-right font-extrabold text-[#2C1B10]">Penalty Amount</TableHead>
                        <TableHead className="text-center font-extrabold text-[#2C1B10]">Deduction Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {penalties.map((p) => (
                        <TableRow key={p.id} className="border-b border-[#EDE4D5] hover:bg-[#FAF7EE]/50">
                          <TableCell className="font-bold text-[#2C1B10]">
                            {p.date ? format(new Date(p.date), 'MMM d, yyyy') : format(new Date(p.createdAt), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="font-medium text-[#4A2E1B]">{p.reason}</TableCell>
                          <TableCell className="text-right font-extrabold text-rose-700">{money(p.amount)}</TableCell>
                          <TableCell className="text-center">
                            {p.isDeducted ? (
                              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-bold text-[10px]">
                                DEDUCTED FROM SALARY
                              </Badge>
                            ) : (
                              <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-bold text-[10px]">
                                PENDING NEXT SALARY
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
