"use client";
import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Save, CheckCircle2, AlertTriangle, Plus, Trash2, Banknote, Smartphone, CreditCard, DollarSign } from "lucide-react";

interface Product {
  id: string;
  name: string;
  unitType: string;
  basePrice: number;
}

interface LeftoverItem {
  productId: string;
  product?: Product;
  quantityRemaining: number;
  damagedQuantity: number;
  damageReason: string;
}

interface ExpenseItem {
  id?: string;
  amount: number;
  category: string;
  description: string;
}

interface DailySessionDetail {
  id: string;
  branchId: string;
  branch?: { id: string; name: string };
  date: string;
  status: "OPEN" | "PAUSED" | "CLOSE_PENDING" | "CLOSED";
  openingCashFloat?: number | null;
  cashLeftoverAmount?: number | null;
  actualCashAmount?: number | null;
  actualCbeAmount?: number | null;
  actualTelebirrAmount?: number | null;
  notes?: string | null;
  sales?: any[];
  expenses?: any[];
  leftoverRecords?: LeftoverItem[];
}

const EXPENSE_CATEGORIES = [
  { value: "STAFF_LOAN", label: "Staff Loan / Salary Advance" },
  { value: "RAW_MATERIALS", label: "Raw Materials / Flour / Ingredients" },
  { value: "UTILITIES", label: "Utilities (Water / Power / Gas)" },
  { value: "TRANSPORT", label: "Transport / Fuel / Freight" },
  { value: "LUNCH", label: "Staff Food / Lunch" },
  { value: "RENT", label: "Rent & Facilities" },
  { value: "MISC", label: "Miscellaneous / Other" },
];

export default function SessionClosePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const isAdminOrOwner = user?.role === "ADMIN" || user?.role === "OWNER";

  const [session, setSession] = useState<DailySessionDetail | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [actualCash, setActualCash] = useState<string>("");
  const [actualCbe, setActualCbe] = useState<string>("");
  const [actualTelebirr, setActualTelebirr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [leftovers, setLeftovers] = useState<Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }>>({});
  const [expenseList, setExpenseList] = useState<ExpenseItem[]>([]);

  useEffect(() => {
    fetchSessionAndProducts();
  }, [resolvedParams.id]);

  const fetchSessionAndProducts = async () => {
    setIsLoading(true);
    try {
      const [resSess, resProd] = await Promise.all([
        api.get(`/daily-sessions/${resolvedParams.id}`),
        api.get(`/products?isActive=true`),
      ]);
      const s: DailySessionDetail = resSess.data;
      setSession(s);
      setProducts(resProd.data);

      setActualCash(s.actualCashAmount != null ? String(s.actualCashAmount) : "");
      setActualCbe(s.actualCbeAmount != null ? String(s.actualCbeAmount) : "");
      setActualTelebirr(s.actualTelebirrAmount != null ? String(s.actualTelebirrAmount) : "");
      setNotes(s.notes || "");

      // Populate leftovers map
      const initialLeftovers: Record<string, { quantityRemaining: number; damagedQuantity: number; damageReason: string }> = {};
      (resProd.data || []).forEach((p: Product) => {
        const existing = (s.leftoverRecords || []).find((r) => r.productId === p.id);
        initialLeftovers[p.id] = {
          quantityRemaining: existing ? existing.quantityRemaining : 0,
          damagedQuantity: existing ? existing.damagedQuantity : 0,
          damageReason: existing ? existing.damageReason || "" : "",
        };
      });
      setLeftovers(initialLeftovers);

      // Populate expenses list
      const initialExpenses: ExpenseItem[] = (s.expenses || []).map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category || "MISC",
        description: e.description || "",
      }));
      setExpenseList(initialExpenses);
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to load session closing details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddExpenseRow = () => {
    setExpenseList((prev) => [
      ...prev,
      { amount: 0, category: "STAFF_LOAN", description: "" },
    ]);
  };

  const handleRemoveExpenseRow = (index: number) => {
    setExpenseList((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExpenseChange = (index: number, field: keyof ExpenseItem, value: any) => {
    setExpenseList((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleLeftoverChange = (productId: string, field: "quantityRemaining" | "damagedQuantity" | "damageReason", value: any) => {
    setLeftovers((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [field]: field === "damageReason" ? value : Math.max(0, Number(value) || 0),
      },
    }));
  };

  const buildPayload = () => {
    const formattedLeftovers = Object.entries(leftovers).map(([productId, val]) => ({
      productId,
      quantityRemaining: val.quantityRemaining,
      damagedQuantity: val.damagedQuantity,
      damageReason: val.damageReason,
    }));

    return {
      actualCashAmount: actualCash !== "" ? Number(actualCash) : null,
      actualCbeAmount: actualCbe !== "" ? Number(actualCbe) : null,
      actualTelebirrAmount: actualTelebirr !== "" ? Number(actualTelebirr) : null,
      notes: notes.trim() || null,
      leftoverRecords: formattedLeftovers,
      expenses: expenseList.map((e) => ({
        id: e.id,
        amount: Number(e.amount),
        category: e.category,
        description: e.description,
      })),
    };
  };

  const handleSubmitClose = async () => {
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      await api.post(`/daily-sessions/${resolvedParams.id}/submit-close`, payload);
      toast.success("Session close request submitted to Admin/Owner for approval");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to submit close request");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinalizeApprove = async () => {
    if (!isAdminOrOwner) {
      toast.error("Only Owners and Admins can finalize session approval");
      return;
    }
    setIsSubmitting(true);
    try {
      const payload = buildPayload();
      await api.post(`/daily-sessions/${resolvedParams.id}/finalize`, payload);
      toast.success("Session close request approved and finalized!");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to finalize session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReopenSession = async () => {
    if (!isAdminOrOwner) {
      toast.error("Only Owners and Admins can reopen a session");
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/daily-sessions/${resolvedParams.id}/reopen`);
      toast.success("Session reopened to OPEN status");
      router.push("/daily-sessions");
    } catch (e: any) {
      toast.error(e.response?.data?.error || "Failed to reopen session");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalExpenseSum = expenseList.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalEnteredCash = (Number(actualCash) || 0) + (Number(actualCbe) || 0) + (Number(actualTelebirr) || 0);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-[#8C7361] font-semibold">Loading session close details...</div>
      </DashboardLayout>
    );
  }

  if (!session) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-red-600 font-semibold">Session not found.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center space-x-3">
          <Button variant="ghost" onClick={() => router.push("/daily-sessions")} className="p-2 rounded-xl text-[#8C7361] hover:bg-[#F4ECE1]">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-extrabold text-[#2C1B10]">
              Close Session: {new Date(session.date).toISOString().split("T")[0]}
            </h1>
            <p className="text-xs text-[#8C7361] mt-0.5">
              Branch: <strong className="text-[#2C1B10]">{session.branch?.name || "Main Branch"}</strong>
            </p>
          </div>
        </div>

        <div>
          <span className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold uppercase tracking-wide border ${
            session.status === "CLOSED"
              ? "bg-zinc-100 text-zinc-800 border-zinc-300"
              : session.status === "CLOSE_PENDING"
              ? "bg-amber-100 text-amber-900 border-amber-300 animate-pulse"
              : "bg-emerald-100 text-emerald-800 border-emerald-300"
          }`}>
            Status: {session.status.replace("_", " ")}
          </span>
        </div>
      </div>

      {/* Approval Status Banner */}
      {session.status === "CLOSE_PENDING" && (
        <div className="mb-6 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start space-x-3 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-extrabold text-sm">Session Close Pending Approval</h4>
            <p className="text-xs text-amber-800 mt-0.5">
              {isAdminOrOwner
                ? "The cashier has submitted the close report with cash types and expenses. You can review, edit any figures, and approve the closure below."
                : "Your close request has been submitted to the Admin / Owner. Waiting for approval."}
            </p>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {/* Section 1: Payment Channel Breakdown (Cash, CBE, Telebirr) */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#2C1B10] mb-1 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#E87A18]" /> Payment Methods & Cash Reconciliation
          </h2>
          <p className="text-xs text-[#8C7361] mb-5">
            Break down the actual collected funds into Physical Cash, CBE Transfer, and Telebirr mobile money.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5 mb-2">
                <Banknote className="w-4 h-4 text-emerald-600" /> Physical Cash (Normal Cash)
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base"
              />
            </div>

            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5 mb-2">
                <CreditCard className="w-4 h-4 text-blue-600" /> CBE Mobile Banking / Transfer
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualCbe}
                onChange={(e) => setActualCbe(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base"
              />
            </div>

            <div className="bg-[#FAF6F0] p-4 rounded-xl border border-[#EDE4D5]">
              <label className="text-xs font-bold text-[#4A2E1B] flex items-center gap-1.5 mb-2">
                <Smartphone className="w-4 h-4 text-purple-600" /> Telebirr Mobile Money
              </label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00 ETB"
                value={actualTelebirr}
                onChange={(e) => setActualTelebirr(e.target.value)}
                className="bg-white border-[#EDE4D5] font-mono font-bold text-base"
              />
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#F4ECE1] flex items-center justify-between text-xs text-[#8C7361]">
            <span>Opening Float: <strong className="text-[#2C1B10]">{session.openingCashFloat ?? 0} ETB</strong></span>
            <span>Total Accounted Revenue: <strong className="text-[#E87A18] font-mono text-sm">{totalEnteredCash.toFixed(2)} ETB</strong></span>
          </div>
        </div>

        {/* Section 2: Session Expenses & Loans List */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-extrabold text-[#2C1B10]">Session Expenses & Staff Loans</h2>
              <p className="text-xs text-[#8C7361] mt-0.5">
                List all expenses paid during this shift (including staff loans, transport, raw material purchases, etc.)
              </p>
            </div>
            <Button onClick={handleAddExpenseRow} size="sm" className="bg-[#4A2E1B] text-white hover:bg-[#3D2314] text-xs font-bold rounded-xl">
              <Plus className="w-4 h-4 mr-1" /> Add Expense Item
            </Button>
          </div>

          {expenseList.length === 0 ? (
            <div className="text-center py-6 border border-dashed border-[#EDE4D5] rounded-xl text-xs text-[#8C7361]">
              No expenses recorded for this session yet. Click "Add Expense Item" to add staff loans or operational costs.
            </div>
          ) : (
            <div className="space-y-3">
              {expenseList.map((exp, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center bg-[#FAF6F0] p-3 rounded-xl border border-[#EDE4D5]">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Expense Type</label>
                    <select
                      value={exp.category}
                      onChange={(e) => handleExpenseChange(idx, "category", e.target.value)}
                      className="w-full bg-white border border-[#EDE4D5] rounded-lg h-9 text-xs px-2 font-medium"
                    >
                      {EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Amount (ETB)</label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={exp.amount || ""}
                      onChange={(e) => handleExpenseChange(idx, "amount", e.target.value)}
                      className="bg-white border-[#EDE4D5] h-9 text-xs font-mono font-bold"
                    />
                  </div>

                  <div className="sm:col-span-5">
                    <label className="text-[10px] font-bold text-[#8C7361] block mb-1">Description / Person / Reason</label>
                    <Input
                      type="text"
                      placeholder="e.g. Employee advance to Abebe / Flour purchase"
                      value={exp.description || ""}
                      onChange={(e) => handleExpenseChange(idx, "description", e.target.value)}
                      className="bg-white border-[#EDE4D5] h-9 text-xs"
                    />
                  </div>

                  <div className="sm:col-span-1 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveExpenseRow(idx)}
                      className="h-9 w-9 p-0 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-3 border-t border-[#F4ECE1] text-right">
            <span className="text-xs font-bold text-[#8C7361]">
              Total Session Expenses: <strong className="text-rose-600 font-mono text-sm ml-1">{totalExpenseSum.toFixed(2)} ETB</strong>
            </span>
          </div>
        </div>

        {/* Section 3: Leftover Product Counts (Adari) & Damage */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-[#2C1B10] mb-1">Product Leftovers (Adari) & Losses</h2>
          <p className="text-xs text-[#8C7361] mb-4">
            Enter the remaining unsold product quantities and any damaged items.
          </p>

          <div className="overflow-x-auto border border-[#EDE4D5] rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF6F0] border-b border-[#EDE4D5]">
                <tr>
                  <th className="p-3 font-extrabold text-[#2C1B10]">Product Name</th>
                  <th className="p-3 font-extrabold text-[#2C1B10] w-36">Unsold Remaining (Pcs)</th>
                  <th className="p-3 font-extrabold text-[#2C1B10] w-36">Damaged (Pcs)</th>
                  <th className="p-3 font-extrabold text-[#2C1B10]">Damage Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F4ECE1]">
                {products.map((p) => {
                  const val = leftovers[p.id] || { quantityRemaining: 0, damagedQuantity: 0, damageReason: "" };
                  return (
                    <tr key={p.id}>
                      <td className="p-3 font-bold text-[#2C1B10]">{p.name}</td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          value={val.quantityRemaining}
                          onChange={(e) => handleLeftoverChange(p.id, "quantityRemaining", e.target.value)}
                          className="h-8 text-xs bg-white border-[#EDE4D5]"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="number"
                          min="0"
                          value={val.damagedQuantity}
                          onChange={(e) => handleLeftoverChange(p.id, "damagedQuantity", e.target.value)}
                          className="h-8 text-xs bg-white border-[#EDE4D5]"
                        />
                      </td>
                      <td className="p-3">
                        <Input
                          type="text"
                          placeholder="Reason if damaged..."
                          value={val.damageReason}
                          onChange={(e) => handleLeftoverChange(p.id, "damageReason", e.target.value)}
                          className="h-8 text-xs bg-white border-[#EDE4D5]"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 4: Notes & Submission Controls */}
        <div className="bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-xs font-bold text-[#2C1B10] block mb-1">Session Closing Notes / Remarks</label>
            <textarea
              rows={3}
              placeholder="Add any remarks regarding sales, stock differences, or staff notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-[#FAF6F0] border border-[#EDE4D5] rounded-xl p-3 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#F4ECE1]">
            <Button variant="outline" onClick={() => router.push("/daily-sessions")} className="border-[#EDE4D5] text-[#8C7361] hover:bg-[#F4ECE1]">
              Cancel
            </Button>

            <div className="flex items-center space-x-3">
              {/* Cashier Submit Request */}
              {session.status !== "CLOSED" && (
                <Button
                  onClick={handleSubmitClose}
                  disabled={isSubmitting}
                  className="bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs sm:text-sm rounded-xl px-5 shadow-sm"
                >
                  <Save className="w-4 h-4 mr-1.5" /> Submit for Admin Approval
                </Button>
              )}

              {/* Admin / Owner Finalize & Approve */}
              {isAdminOrOwner && session.status !== "CLOSED" && (
                <Button
                  onClick={handleFinalizeApprove}
                  disabled={isSubmitting}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-xl px-5 shadow-sm"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve & Finalize Close
                </Button>
              )}

              {isAdminOrOwner && session.status === "CLOSE_PENDING" && (
                <Button
                  onClick={handleReopenSession}
                  disabled={isSubmitting}
                  variant="outline"
                  className="border-rose-300 text-rose-700 hover:bg-rose-50 font-bold text-xs rounded-xl"
                >
                  Reopen Session
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
