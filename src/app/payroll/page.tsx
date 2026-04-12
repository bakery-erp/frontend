"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { DollarSign, FileText, FileWarning, Wallet, Search, Plus, Calendar, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";

type Tab = "RUN" | "HISTORY" | "LOANS" | "PENALTIES";

interface User { id: string; fullName: string; phone: string; role: string; salary?: number; }
interface Penalty { id: string; userId: string; amount: number; reason: string; date: string; isDeducted: boolean; user?: User; }
interface Loan { id: string; userId: string; totalAmount: number; remainingBalance: number; status: string; createdAt: string; user?: User; }
interface PayrollRecord { id: string; userId: string; month: number; year: number; baseSalary: number; loanDeductions: number; penaltyDeductions: number; bonus: number; finalAmount: number; paymentDate: string; user?: User; }

interface CalcResult {
  baseSalary: number;
  proratedBase: number;
  loanDeductions: number;
  penaltyDeductions: number;
  suggestedFinalAmount: number;
  undeductedPenalties: Penalty[];
  openLoans: Loan[];
}

export default function PayrollPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("RUN");
  const [users, setUsers] = useState<User[]>([]);

  // RUN PAYROLL STATE
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [calcData, setCalcData] = useState<CalcResult | null>(null);
  const [bonus, setBonus] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // HISTORY STATE
  const [history, setHistory] = useState<PayrollRecord[]>([]);

  // LOAN STATE
  const [loans, setLoans] = useState<Loan[]>([]);
  const [isLoanOpen, setIsLoanOpen] = useState(false);

  // PENALTY STATE
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isPenaltyOpen, setIsPenaltyOpen] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (activeTab === "HISTORY") fetchHistory();
    if (activeTab === "LOANS") fetchLoans();
    if (activeTab === "PENALTIES") fetchPenalties();
  }, [activeTab]);

  const fetchUsers = async () => {
    try { const { data } = await api.get("/users"); setUsers(data); } catch { }
  };
  const fetchHistory = async () => {
    try { const { data } = await api.get("/payroll"); setHistory(data); } catch { }
  };
  const fetchLoans = async () => {
    try { const { data } = await api.get("/loans?type=EMPLOYEE"); setLoans(data); } catch { }
  };
  const fetchPenalties = async () => {
    try { const { data } = await api.get("/penalties"); setPenalties(data); } catch { }
  };

  const handleCalculate = async () => {
    if (!selectedUser) { toast.error("Select employee first"); return; }
    try {
      const { data } = await api.get(`/payroll/calculate/${selectedUser}?month=${selectedMonth}&year=${selectedYear}`);
      setCalcData(data);
      setBonus(0);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to calculate");
      setCalcData(null);
    }
  };

  const handleProcessPayroll = async (settleDeductions: boolean) => {
    if (!calcData) return;
    try {
      setIsProcessing(true);
      // Create payroll record
      await api.post("/payroll", {
        userId: selectedUser,
        month: selectedMonth,
        year: selectedYear,
        baseSalary: calcData.proratedBase,
        loanDeductions: calcData.loanDeductions,
        penaltyDeductions: calcData.penaltyDeductions,
        bonus: bonus,
        paymentDate: new Date().toISOString()
      });

      // Optionally settle debts
      if (settleDeductions) {
        for (const p of calcData.undeductedPenalties) {
          await api.patch(`/penalties/${p.id}`, { isDeducted: true });
        }
        for (const l of calcData.openLoans) {
          await api.post(`/loans/${l.id}/pay`, { amountPaid: l.remainingBalance });
        }
      }

      toast.success("Payroll recorded successfully");
      setCalcData(null);
      setSelectedUser("");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Error processing payroll");
    } finally {
      setIsProcessing(false);
    }
  };

  // Generic Submit Loan 
  const handleAddLoan = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/loans", { type: "EMPLOYEE", userId: fd.get("userId"), totalAmount: fd.get("amount") });
      toast.success("Loan recorded");
      setIsLoanOpen(false);
      fetchLoans();
    } catch (error) { toast.error("Failed to add loan"); }
  };

  // Generic Submit Penalty
  const handleAddPenalty = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.post("/penalties", { userId: fd.get("userId"), amount: fd.get("amount"), reason: fd.get("reason"), date: fd.get("date") });
      toast.success("Penalty added");
      setIsPenaltyOpen(false);
      fetchPenalties();
    } catch (error) { toast.error("Failed to add penalty"); }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll & Finance</h1>
          <p className="text-zinc-500 mt-1">Manage personnel salaries, deductions, and payment records.</p>
        </div>
        <div className="flex bg-white/50 p-1 rounded-lg border border-zinc-200">
          <Button variant={activeTab === "RUN" ? "default" : "ghost"} onClick={() => setActiveTab("RUN")} className={activeTab === "RUN" ? "bg-black text-white" : ""}>
            <Wallet className="w-4 h-4 mr-2" /> Calculator
          </Button>
          <Button variant={activeTab === "HISTORY" ? "default" : "ghost"} onClick={() => setActiveTab("HISTORY")} className={activeTab === "HISTORY" ? "bg-black text-white" : ""}>
            <FileText className="w-4 h-4 mr-2" /> History
          </Button>
          <Button variant={activeTab === "LOANS" ? "default" : "ghost"} onClick={() => setActiveTab("LOANS")} className={activeTab === "LOANS" ? "bg-black text-white" : ""}>
            <DollarSign className="w-4 h-4 mr-2" /> Loans
          </Button>
          <Button variant={activeTab === "PENALTIES" ? "default" : "ghost"} onClick={() => setActiveTab("PENALTIES")} className={activeTab === "PENALTIES" ? "bg-black text-white" : ""}>
            <FileWarning className="w-4 h-4 mr-2" /> Penalties
          </Button>
        </div>
      </div>

      {activeTab === "RUN" && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* Settings Picker */}
          <div className="col-span-1 bg-white p-5 rounded-xl border border-zinc-200 shadow-sm self-start">
            <h2 className="font-semibold mb-4 border-b pb-2 flex items-center"><Calendar className="w-4 h-4 mr-2" /> Term Details</h2>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Employee</label>
                <select className="w-full h-10 border rounded-md px-3 text-sm" value={selectedUser} onChange={(e) => { setSelectedUser(e.target.value); setCalcData(null); }}>
                  <option value="">Select Employee...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName} - {u.role}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Month</label>
                  <select className="w-full h-10 border rounded-md px-3 text-sm" value={selectedMonth} onChange={(e) => { setSelectedMonth(Number(e.target.value)); setCalcData(null); }}>
                    {Array.from({length: 12}, (_, i) => i + 1).map(m => <option key={m} value={m}>{format(new Date(2000, m - 1, 1), "MMMM")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Year</label>
                  <input type="number" className="w-full h-10 border rounded-md px-3 text-sm" value={selectedYear} onChange={(e) => { setSelectedYear(Number(e.target.value)); setCalcData(null); }} />
                </div>
              </div>
              <Button onClick={handleCalculate} className="w-full mt-4 bg-zinc-900 text-white" disabled={!selectedUser}>Preview Draft</Button>
            </div>
          </div>

          {/* Calculator Output */}
          <div className="col-span-2">
            {!calcData ? (
              <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-zinc-400 bg-zinc-50 border border-dashed rounded-xl border-zinc-200">
                <Wallet className="w-10 h-10 mb-2 opacity-50" />
                <p>Select an employee and term to preview draft</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
                <div className="bg-black text-white p-4">
                  <h3 className="font-semibold text-lg">Payroll Drafting Phase</h3>
                  <p className="text-zinc-300 text-sm">Review compensations and automatic system deductions.</p>
                </div>
                
                <div className="p-6 space-y-6">
                  {/* Earnings */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-zinc-500 mb-3 tracking-wide">Base Earnings</h4>
                    <div className="flex justify-between items-center py-2 border-b">
                      <span>Monthly Base Salary</span>
                      <span className="font-semibold">{calcData.baseSalary.toFixed(2)} ETB</span>
                    </div>
                    {calcData.baseSalary !== calcData.proratedBase && (
                      <div className="flex justify-between items-center py-2 border-b bg-yellow-50/50 text-yellow-800 px-2 rounded -mx-2 mt-1">
                        <span className="flex items-center"><AlertCircle className="w-4 h-4 mr-2" /> Prorated Base (Not full month)</span>
                        <span className="font-semibold">{calcData.proratedBase.toFixed(2)} ETB</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center py-3">
                      <span className="font-medium text-sm">Add Additional Bonus</span>
                      <Input type="number" className="w-32 text-right" value={bonus} onChange={(e) => setBonus(Number(e.target.value) || 0)} min={0} />
                    </div>
                  </div>

                  {/* Deductions */}
                  <div>
                    <h4 className="text-sm font-semibold uppercase text-zinc-500 mb-3 tracking-wide">System Deductions</h4>
                    <div className="flex justify-between items-center py-2 border-b text-red-600">
                      <span className="flex items-center"><FileWarning className="w-4 h-4 mr-2"/> Defaulted Penalties ({calcData.undeductedPenalties.length})</span>
                      <span className="font-semibold">- {calcData.penaltyDeductions.toFixed(2)} ETB</span>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b text-orange-600">
                      <span className="flex items-center"><DollarSign className="w-4 h-4 mr-2"/> Active Loan Deductions ({calcData.openLoans.length})</span>
                      <span className="font-semibold">- {calcData.loanDeductions.toFixed(2)} ETB</span>
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-200">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Final Net Payout</span>
                      <span className="text-emerald-600">{(calcData.suggestedFinalAmount + bonus).toFixed(2)} ETB</span>
                    </div>
                  </div>

                  {/* Submit Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <Button variant="outline" className="w-full border-zinc-300" onClick={() => handleProcessPayroll(false)} disabled={isProcessing}>
                      Log Payroll Only
                    </Button>
                    <Button className="w-full bg-black text-white hover:bg-zinc-800" onClick={() => handleProcessPayroll(true)} disabled={isProcessing}>
                      Fund & Settle Debts
                    </Button>
                  </div>
                  <p className="text-xs text-center text-zinc-400 mt-2">"Fund & Settle Debts" will automatically mark all pending penalties as paid and subtract loans dynamically from system balances during this run.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* HISTORY TAB */}
      {activeTab === "HISTORY" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-zinc-50/50">
                <TableHead>Term</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Base / Prorated</TableHead>
                <TableHead className="text-red-500">Deductions</TableHead>
                <TableHead className="text-emerald-600">Final Payout</TableHead>
                <TableHead>Execution Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8">No records yet.</TableCell></TableRow> : 
                history.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{format(new Date(r.year, r.month - 1), "MMM yyyy")}</TableCell>
                    <TableCell>
                      {r.user?.fullName} <span className="text-zinc-400 text-xs">({r.user?.role})</span>
                    </TableCell>
                    <TableCell>{r.baseSalary} ETB {r.bonus > 0 && <Badge variant="secondary" className="ml-1 shrink-0 text-[10px]">+{r.bonus}</Badge>}</TableCell>
                    <TableCell className="text-red-500">-{Number(r.loanDeductions) + Number(r.penaltyDeductions)} ETB</TableCell>
                    <TableCell className="font-bold text-emerald-600">{r.finalAmount} ETB</TableCell>
                    <TableCell className="text-zinc-500 text-sm">{r.paymentDate ? format(new Date(r.paymentDate), "MMM dd, yyyy HH:mm") : "N/A"}</TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
      )}

      {/* LOANS TAB */}
      {activeTab === "LOANS" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-zinc-50/50">
            <h2 className="font-semibold">Active Employee Loans</h2>
            <Button onClick={() => setIsLoanOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2" /> Dispatch Loan</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Issued</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Original Amount</TableHead>
                <TableHead>Remaining Balance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loans.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center">No employee loans attached.</TableCell></TableRow> :
                loans.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-zinc-500 text-sm">{format(new Date(l.createdAt), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{l.user?.fullName}</TableCell>
                    <TableCell>{l.totalAmount} ETB</TableCell>
                    <TableCell className="font-bold">{l.remainingBalance} ETB</TableCell>
                    <TableCell>
                      <Badge className={l.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-orange-100 text-orange-800'}>
                        {l.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
      )}

      {/* PENALTIES TAB */}
      {activeTab === "PENALTIES" && (
        <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-zinc-50/50">
            <h2 className="font-semibold">Workforce Penalties</h2>
            <Button onClick={() => setIsPenaltyOpen(true)} size="sm"><Plus className="w-4 h-4 mr-2" /> Log Penalty</Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date Filed</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-red-500">Fine</TableHead>
                <TableHead>Settlement</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {penalties.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center">No active penalties found.</TableCell></TableRow> :
                penalties.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="text-zinc-500 text-sm">{format(new Date(p.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="font-medium">{p.user?.fullName}</TableCell>
                    <TableCell className="text-zinc-600">{p.reason}</TableCell>
                    <TableCell className="font-bold text-red-500">-{p.amount} ETB</TableCell>
                    <TableCell>
                      <Badge className={p.isDeducted ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}>
                        {p.isDeducted ? 'Extracted' : 'Pending Return'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              }
            </TableBody>
          </Table>
        </div>
      )}

      {/* MODALS */}
      <Dialog open={isLoanOpen} onOpenChange={setIsLoanOpen}>
        <DialogContent>
          <form onSubmit={handleAddLoan}>
            <DialogHeader><DialogTitle>Dispatch Micro-Loan</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Receiving Employee</label>
                <select name="userId" required className="w-full h-10 border rounded-md px-3 text-sm">
                  <option value="">Select Target...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Loan Package Amount (ETB)</label>
                <Input name="amount" type="number" min="0" step="0.01" required />
              </div>
            </div>
            <DialogFooter><Button type="submit">Vault & Disperse</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isPenaltyOpen} onOpenChange={setIsPenaltyOpen}>
        <DialogContent>
          <form onSubmit={handleAddPenalty}>
            <DialogHeader><DialogTitle>Enforce Administrative Penalty</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Infracting Employee</label>
                <select name="userId" required className="w-full h-10 border rounded-md px-3 text-sm">
                  <option value="">Select Target...</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.fullName}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Fine Evaluation (ETB)</label>
                <Input name="amount" type="number" min="0" step="0.01" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Rule Broken / Reason</label>
                <Input name="reason" placeholder="e.g. Broken hardware" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Date of Offense</label>
                <Input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} required />
              </div>
            </div>
            <DialogFooter><Button type="submit" variant="destructive">Submit Fine</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
