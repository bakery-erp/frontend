"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/context/AuthContext";
import { format } from "date-fns";
import {
  ArrowLeft,
  CreditCard,
  DollarSign,
  Printer,
  Calendar,
  Phone,
  User,
  ShoppingBag,
  CheckCircle2,
  Clock,
  FileText,
} from "lucide-react";

interface LoanPayment {
  id: string;
  amountPaid: number;
  date: string;
  createdAt: string;
}

interface CustomerCredit {
  id: string;
  branchId: string;
  type: string;
  entityId: string | null;
  totalAmount: number;
  remainingBalance: number;
  status: "OPEN" | "PAID";
  date: string;
  createdAt: string;
  payments: LoanPayment[];
}

function parseCustomerCreditEntity(raw: string) {
  if (!raw) return { name: "Client / Cafe", phone: "", items: [], notes: "" };

  let namePart = raw;
  let productsPart = "";
  let notesPart = "";

  const prodMatch = raw.match(/\[Products:\s*(.*?)\]/);
  if (prodMatch) {
    productsPart = prodMatch[1];
    namePart = raw.replace(/\[Products:.*?\]/, "").trim();
  }

  const parts = namePart.split(/\s+-\s+/);
  if (parts.length > 1) {
    namePart = parts[0].trim();
    notesPart = parts.slice(1).join(" - ").trim();
  }

  namePart = namePart.replace(/^-\s*|\s*-$/g, "").trim();

  let phone = "";
  const phoneMatch = namePart.match(/\((.*?)\)/);
  if (phoneMatch) {
    phone = phoneMatch[1];
    namePart = namePart.replace(/\(.*?\)/, "").trim();
  }

  const items = productsPart
    ? productsPart.split(/,\s*/).map((itemStr) => {
        const cleaned = itemStr.trim();
        // Extract quantity, name, unitPrice, lineTotal if formatted as: "19x Bomboloni @ 15 ETB (285.00 ETB)"
        const itemMatch = cleaned.match(/^(?:(\d+(?:\.\d+)?)x\s+)?(.*?)(?:\s+@\s+(\d+(?:\.\d+)?)\s*ETB)?(?:\s*\(([\d\.]+)\s*ETB\))?$/);
        if (itemMatch) {
          return {
            raw: cleaned,
            qty: itemMatch[1] || "1",
            name: itemMatch[2] || cleaned,
            unitPrice: itemMatch[3] ? `${itemMatch[3]} ETB` : "-",
            total: itemMatch[4] ? `${itemMatch[4]} ETB` : "-",
          };
        }
        return { raw: cleaned, qty: "1", name: cleaned, unitPrice: "-", total: "-" };
      })
    : [];

  return {
    name: namePart || "Customer / Cafe",
    phone,
    items,
    notes: notesPart,
  };
}

export default function CustomerCreditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const canManage = user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "CASHIER";

  const [credit, setCredit] = useState<CustomerCredit | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCreditDetail();
  }, [resolvedParams.id]);

  const fetchCreditDetail = async () => {
    setIsLoading(true);
    try {
      const res = await api.get(`/loans/${resolvedParams.id}`);
      setCredit(res.data);
      setAmountPaid("");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load customer credit details");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credit || !amountPaid) return;

    const payNum = Number(amountPaid);
    if (payNum <= 0) {
      toast.error("Payment amount must be greater than zero");
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(`/loans/${credit.id}/pay`, {
        amountPaid: payNum,
        date: paymentDate,
      });
      toast.success("Repayment recorded successfully");
      setIsPayModalOpen(false);
      fetchCreditDetail();
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to record payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-[#8C7361] font-semibold">Loading customer credit statement...</div>
      </DashboardLayout>
    );
  }

  if (!credit) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-red-600 font-semibold space-y-3">
          <p>Customer credit record not found.</p>
          <Button onClick={() => router.push("/customer-credits")} variant="outline" className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back to Customer Credits
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const parsed = parseCustomerCreditEntity(credit.entityId || "");
  const totalAmount = Number(credit.totalAmount || 0);
  const remainingBalance = Number(credit.remainingBalance || 0);
  const totalPaid = Math.max(0, totalAmount - remainingBalance);
  const isSettled = credit.status === "PAID" || remainingBalance <= 0.01;

  // Compute running balances for payment ledger
  let runningBalance = totalAmount;
  const paymentsSorted = [...(credit.payments || [])].sort(
    (a, b) => new Date(a.date || a.createdAt).getTime() - new Date(b.date || b.createdAt).getTime()
  );
  const paymentLedger = paymentsSorted.map((p) => {
    const paidAmt = Number(p.amountPaid || 0);
    runningBalance = Math.max(0, runningBalance - paidAmt);
    return { ...p, paidAmt, balanceAfter: runningBalance };
  });

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 print:hidden">
          <Button
            variant="ghost"
            onClick={() => router.push("/customer-credits")}
            className="text-[#8C7361] hover:bg-[#F4ECE1] rounded-xl w-fit flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Customer Credits
          </Button>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={() => window.print()}
              className="border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] font-bold rounded-xl text-xs sm:text-sm flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" /> Print Statement
            </Button>

            {!isSettled && canManage && (
              <Button
                onClick={() => setIsPayModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs sm:text-sm shadow-md flex items-center gap-1.5"
              >
                <DollarSign className="w-4 h-4" /> Record Settlement / Payment
              </Button>
            )}
          </div>
        </div>

        {/* Printable Customer Credit Statement Card */}
        <div className="bg-white border border-[#EDE4D5] rounded-3xl p-6 sm:p-8 shadow-sm space-y-6 print:border-none print:shadow-none">
          {/* Header & Status Banner */}
          <div className="flex flex-col sm:flex-row justify-between items-start border-b border-[#EDE4D5] pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <CreditCard className="w-6 h-6 text-[#E87A18]" />
                <h1 className="text-2xl font-black text-[#2C1B10] tracking-tight">
                  Customer Product Credit Statement
                </h1>
              </div>
              <p className="text-xs text-[#8C7361]">
                Record Reference ID: <strong className="font-mono text-[#2C1B10]">{credit.id}</strong>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span
                className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider border ${
                  isSettled
                    ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                    : "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
                }`}
              >
                {isSettled ? "✓ FULLY SETTLED" : "OUTSTANDING CREDIT"}
              </span>
            </div>
          </div>

          {/* Customer & Credit Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-[#FAF6F0] p-5 rounded-2xl border border-[#EDE4D5]">
            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#8C7361] block">
                Customer Details
              </span>
              <div className="flex items-center gap-2 text-[#2C1B10] font-extrabold text-lg">
                <User className="w-5 h-5 text-[#E87A18]" />
                {parsed.name}
              </div>
              {parsed.phone && (
                <div className="flex items-center gap-2 text-xs font-bold text-[#4A2E1B]">
                  <Phone className="w-4 h-4 text-[#8C7361]" />
                  {parsed.phone}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-[#8C7361] block">
                Issue Date & Notes
              </span>
              <div className="flex items-center gap-2 text-[#2C1B10] font-bold text-sm">
                <Calendar className="w-4 h-4 text-[#E87A18]" />
                Issued Date: {credit.date ? format(new Date(credit.date), "MMMM d, yyyy") : format(new Date(credit.createdAt), "MMMM d, yyyy")}
              </div>
              {parsed.notes && (
                <div className="flex items-start gap-2 text-xs text-[#8C7361] italic">
                  <FileText className="w-4 h-4 text-[#8C7361] flex-shrink-0 mt-0.5" />
                  Note: {parsed.notes}
                </div>
              )}
            </div>
          </div>

          {/* 3 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-[#FAF6F0] border border-[#EDE4D5] rounded-2xl p-4">
              <span className="text-xs font-bold uppercase text-[#8C7361] block">Total Product Credit</span>
              <span className="text-2xl font-extrabold text-[#2C1B10] mt-1 block font-mono">
                {totalAmount.toFixed(2)} ETB
              </span>
            </div>

            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-4">
              <span className="text-xs font-bold uppercase text-emerald-800 block">Total Settlement Paid</span>
              <span className="text-2xl font-extrabold text-emerald-700 mt-1 block font-mono">
                {totalPaid.toFixed(2)} ETB
              </span>
            </div>

            <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-4">
              <span className="text-xs font-bold uppercase text-rose-800 block">Remaining Balance Due</span>
              <span className="text-2xl font-extrabold text-rose-700 mt-1 block font-mono">
                {remainingBalance.toFixed(2)} ETB
              </span>
            </div>
          </div>

          {/* Product Items Table Breakdown */}
          <div className="space-y-3">
            <h3 className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-[#E87A18]" />
              Products Taken on Credit
            </h3>

            {parsed.items.length > 0 ? (
              <div className="border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]">
                    <TableRow>
                      <TableHead className="font-extrabold text-[#4A2E1B]">Product Item</TableHead>
                      <TableHead className="text-center font-extrabold text-[#4A2E1B]">Quantity</TableHead>
                      <TableHead className="text-right font-extrabold text-[#4A2E1B]">Unit Price</TableHead>
                      <TableHead className="text-right font-extrabold text-[#4A2E1B]">Line Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.items.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-[#2C1B10]">{item.name}</TableCell>
                        <TableCell className="text-center font-mono font-bold">{item.qty}</TableCell>
                        <TableCell className="text-right font-mono text-[#8C7361]">{item.unitPrice}</TableCell>
                        <TableCell className="text-right font-mono font-extrabold text-[#2C1B10]">{item.total}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="bg-[#FAF6F0] p-4 rounded-xl text-xs text-[#8C7361] italic text-center border border-[#EDE4D5]">
                General Bakery Product Credit Total: {totalAmount.toFixed(2)} ETB
              </div>
            )}
          </div>

          {/* Repayment History Ledger */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-extrabold text-[#2C1B10] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-600" />
              Repayment Settlement History Ledger
            </h3>

            {paymentLedger.length > 0 ? (
              <div className="border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
                <Table>
                  <TableHeader className="bg-[#FAF6F0]">
                    <TableRow>
                      <TableHead className="font-extrabold text-[#4A2E1B]">Payment Date</TableHead>
                      <TableHead className="text-right font-extrabold text-emerald-800">Amount Paid</TableHead>
                      <TableHead className="text-right font-extrabold text-[#4A2E1B]">Remaining Balance After</TableHead>
                      <TableHead className="text-center font-extrabold text-[#4A2E1B]">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentLedger.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-bold text-[#2C1B10] text-xs">
                          {format(new Date(p.date || p.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right font-mono font-extrabold text-emerald-700">
                          -{p.paidAmt.toFixed(2)} ETB
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-[#4A2E1B]">
                          {p.balanceAfter.toFixed(2)} ETB
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full border border-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> RECEIVED
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="bg-[#FAF6F0] p-4 rounded-xl text-xs text-[#8C7361] italic text-center border border-[#EDE4D5]">
                No repayment payments logged yet for this credit account.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RECORD PAYMENT MODAL */}
      {isPayModalOpen && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setIsPayModalOpen(false); }}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-lg font-extrabold text-[#2C1B10] flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Record Credit Settlement / Payment
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handlePay} className="space-y-3.5 mt-2">
              <div className="bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5] text-xs space-y-1">
                <div className="font-extrabold text-[#2C1B10] text-sm">{parsed.name}</div>
                {parsed.phone && <div className="text-[#8C7361] text-xs">📞 {parsed.phone}</div>}
                <div className="flex justify-between text-[#8C7361] font-mono pt-1 border-t border-[#EDE4D5] mt-1">
                  <span>Total Loan: {totalAmount.toFixed(2)} ETB</span>
                  <span className="font-bold text-rose-700">Remaining: {remainingBalance.toFixed(2)} ETB</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Payment Amount (ETB)</label>
                <Input
                  type="number"
                  step="any"
                  required
                  min="0.01"
                  max={remainingBalance}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  placeholder="Enter amount..."
                  className="rounded-xl border-zinc-200 font-mono font-bold text-base h-11"
                />
                <p className="text-[11px] text-[#8C7361] mt-1">Enter any integer or decimal amount (e.g. 30 or 40.98)</p>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] mb-1 block uppercase">Payment Date</label>
                <Input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="rounded-xl border-zinc-200"
                />
              </div>

              <DialogFooter className="gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsPayModalOpen(false)} className="rounded-xl">
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl">
                  {isSubmitting ? "Processing..." : "Record Settlement"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </DashboardLayout>
  );
}
