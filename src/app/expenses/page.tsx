"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import ConfirmModal from "@/components/ConfirmModal";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, X, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";

interface Expense {
  id: string;
  type: string;
  amount: number;
  category: string;
  description: string | null;
  date: string;
  branchId: string;
  financialCategory?: { id: string; name: string; type: string } | null;
  user?: { id: string; fullName: string } | null;
}

interface FinancialCategory {
  id: string;
  name: string;
  type: string;
}

function money(value: number | undefined | null) {
  return `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const allowed = user?.role === "OWNER" || user?.role === "ADMIN";

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<FinancialCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter state
  const [filterFrom, setFilterFrom] = useState(new Date().toISOString().slice(0, 10));
  const [filterTo, setFilterTo] = useState(new Date().toISOString().slice(0, 10));

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formType, setFormType] = useState<string>("COMPANY");
  const [formAmount, setFormAmount] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().slice(0, 10));
  const [formFinancialCategoryId, setFormFinancialCategoryId] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (allowed) {
      loadExpenses();
      loadCategories();
    }
  }, [selectedBranchId]);

  const loadCategories = async () => {
    try {
      const res = await api.get("/financial-categories", { params: { type: "EXPENSE" } });
      setCategories(Array.isArray(res.data) ? res.data : []);
    } catch {
      // Non-critical
    }
  };

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const params: any = { from: filterFrom, to: filterTo };
      if (selectedBranchId) params.branchId = selectedBranchId;
      const res = await api.get("/expenses", { params });
      setExpenses(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to load expenses");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setEditingId(null);
    setFormType("COMPANY");
    setFormAmount("");
    setFormCategory("");
    setFormDescription("");
    setFormDate(new Date().toISOString().slice(0, 10));
    setFormFinancialCategoryId("");
    setShowForm(false);
  };

  const openCreateForm = () => {
    resetForm();
    setShowForm(true);
  };

  const openEditForm = (expense: Expense) => {
    setEditingId(expense.id);
    setFormType(expense.type);
    setFormAmount(String(expense.amount));
    setFormCategory(expense.category);
    setFormDescription(expense.description || "");
    setFormDate(expense.date ? new Date(expense.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10));
    setFormFinancialCategoryId(expense.financialCategory?.id || "");
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formAmount || !formCategory.trim()) {
      toast.error("Amount and category are required");
      return;
    }
    setIsSaving(true);
    try {
      const payload: any = {
        type: formType,
        amount: parseFloat(formAmount),
        category: formCategory.trim(),
        description: formDescription.trim() || null,
        date: formDate,
        financialCategoryId: formFinancialCategoryId || null,
      };
      if (!editingId && selectedBranchId) {
        payload.branchId = selectedBranchId;
      }

      if (editingId) {
        await api.patch(`/expenses/${editingId}`, payload);
        toast.success("Expense updated");
      } else {
        await api.post("/expenses", payload);
        toast.success("Expense recorded");
      }
      resetForm();
      loadExpenses();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to save expense");
    } finally {
      setIsSaving(false);
    }
  };

  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);

  const confirmDeleteExpense = async () => {
    if (!expenseToDelete) return;
    try {
      await api.delete(`/expenses/${expenseToDelete}`);
      toast.success("Expense deleted");
      loadExpenses();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || "Failed to delete");
    } finally {
      setExpenseToDelete(null);
    }
  };

  // Summaries
  const companyTotal = expenses.filter(e => e.type === "COMPANY").reduce((s, e) => s + Number(e.amount), 0);
  const ownerTotal = expenses.filter(e => e.type === "OWNER").reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = companyTotal + ownerTotal;

  if (!allowed) {
    return (
      <DashboardLayout>
        <div className="bg-white border rounded-lg p-6">Expenses management is available for owner and admin users only.</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Expenses & Costs</h1>
          <p className="text-zinc-500 mt-1">Record, view, and manage company and owner expenses.</p>
        </div>
        <Button onClick={openCreateForm} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Expense
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-blue-600 tracking-wider">Company Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">{money(companyTotal)}</div>
          </CardContent>
        </Card>
        <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-purple-600 tracking-wider">Owner Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-700">{money(ownerTotal)}</div>
          </CardContent>
        </Card>
        <Card className="border-rose-200 bg-gradient-to-br from-rose-50 to-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-semibold uppercase text-rose-600 tracking-wider">Total Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-rose-700">{money(grandTotal)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4 pt-6">
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">From</label>
            <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="w-44" />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-500 block mb-1">To</label>
            <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="w-44" />
          </div>
          <Button onClick={loadExpenses} variant="outline">Load</Button>
        </CardContent>
      </Card>

      {/* Create / Edit Form */}
      {showForm && (
        <Card className="mb-6 border-2 border-zinc-300">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{editingId ? "Edit Expense" : "Record New Expense"}</CardTitle>
            <Button variant="ghost" size="sm" onClick={resetForm}><X className="w-4 h-4" /></Button>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Type *</label>
                <select
                  value={formType}
                  onChange={e => setFormType(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-black focus:border-black"
                >
                  <option value="COMPANY">Company Expense</option>
                  <option value="OWNER">Owner Expense</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Amount (ETB) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={formAmount}
                  onChange={e => setFormAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Category *</label>
                <Input
                  placeholder="e.g. Utilities, Rent, Transport"
                  value={formCategory}
                  onChange={e => setFormCategory(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Financial Category (optional)</label>
                <select
                  value={formFinancialCategoryId}
                  onChange={e => setFormFinancialCategoryId(e.target.value)}
                  className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm bg-white focus:ring-black focus:border-black"
                >
                  <option value="">— None —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Date</label>
                <Input type="date" value={formDate} onChange={e => setFormDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-500 block mb-1">Description (optional)</label>
                <Input
                  placeholder="Brief note about the expense"
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <Button onClick={handleSubmit} disabled={isSaving}>
                {isSaving ? "Saving..." : editingId ? "Update Expense" : "Record Expense"}
              </Button>
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle>Expense Records</CardTitle>
          <CardDescription>{expenses.length} record(s) for selected date range</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? (
            <p className="text-center text-zinc-400 py-8">Loading...</p>
          ) : expenses.length === 0 ? (
            <p className="text-center text-zinc-400 py-8">No expenses found. Click &quot;Add Expense&quot; to record one.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Recorded By</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map(expense => (
                  <TableRow key={expense.id}>
                    <TableCell>{expense.date ? new Date(expense.date).toISOString().slice(0, 10) : "-"}</TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                        expense.type === "OWNER"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {expense.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-medium">{expense.financialCategory?.name || expense.category}</TableCell>
                    <TableCell className="text-zinc-500 max-w-[200px] truncate">{expense.description || "-"}</TableCell>
                    <TableCell>{expense.user?.fullName || "-"}</TableCell>
                    <TableCell className="text-right font-bold text-rose-700">{money(expense.amount)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEditForm(expense)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-rose-600 hover:text-rose-700" onClick={() => setExpenseToDelete(expense.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Expense Confirmation Modal */}
      <ConfirmModal
        isOpen={!!expenseToDelete}
        onClose={() => setExpenseToDelete(null)}
        onConfirm={confirmDeleteExpense}
        title="Delete Expense Record"
        description="Are you sure you want to delete this expense record? This action cannot be undone."
        confirmText="Delete Expense"
        variant="danger"
      />
    </DashboardLayout>
  );
}
