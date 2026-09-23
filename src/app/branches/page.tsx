"use client";

import { useEffect, useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { Plus, Search, MapPin, MoreVertical, Edit2, Building2, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Branch {
  id: string;
  name: string;
  address: string | null;
  isActive: boolean;
  createdAt: string;
}

export default function BranchesPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [toggleLoading, setToggleLoading] = useState<string | null>(null);
  
  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({ name: "", address: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showUnsavedChanges, setShowUnsavedChanges] = useState(false);

  // Delete state
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isOwner = user?.role === "OWNER";

  useEffect(() => {
    if (!user) return;
    if (user.role !== "OWNER" && user.role !== "ADMIN") {
      router.push("/");
      toast.error("Unauthorized access to Branch Management.");
      return;
    }
      fetchBranches();
  }, [user, router]);

  const fetchBranches = async () => {
    try {
      setLoading(true);
      const res = await api.get("/branches");
      setBranches(res.data);
    } catch (error) {
      toast.error(t('branches.toastFailedToLoad'));
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (id: string, currentStatus: boolean) => {
    if (!isOwner) return;
    try {
      setToggleLoading(id);
      await api.patch(`/branches/${id}`, { isActive: !currentStatus });
      toast.success(currentStatus ? t('branches.toastBranchDeactivated') : t('branches.toastBranchActivated'));
      setBranches((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isActive: !currentStatus } : b))
      );
    } catch (error) {
      toast.error(t('branches.toastFailedToUpdate'));
    } finally {
      setToggleLoading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    if (!formData.name.trim()) return toast.error(t('branches.toastNameRequired'));
    
    setSubmitting(true);
    try {
      if (editingBranch) {
        // Update
        const res = await api.patch(`/branches/${editingBranch.id}`, formData);
        setBranches((prev) =>
          prev.map((b) => (b.id === res.data.id ? res.data : b))
        );
        toast.success(t('branches.toastBranchUpdated'));
      } else {
        // Create
        const res = await api.post("/branches", formData);
        setBranches((prev) => [...prev, res.data]);
        toast.success(t('branches.toastBranchCreated'));
      }
      handleCloseDialog();
    } catch (error) {
      toast.error(editingBranch ? t('branches.toastFailedToUpdate') : t('branches.toastFailedToCreate'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenDialog = (branch?: Branch) => {
    if (!isOwner) return;
    if (branch) {
      setEditingBranch(branch);
      setFormData({ name: branch.name, address: branch.address || "" });
    } else {
      setEditingBranch(null);
      setFormData({ name: "", address: "" });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingBranch(null);
    setFormData({ name: "", address: "" });
  };

  const isFormDirty = () => {
    if (editingBranch) {
      return formData.name !== editingBranch.name || formData.address !== (editingBranch.address || "");
    }
    return formData.name.trim() !== "" || formData.address.trim() !== "";
  };

  const handleRequestCloseDialog = () => {
    if (isFormDirty()) {
      setShowUnsavedChanges(true);
    } else {
      handleCloseDialog();
    }
  };

  const handlePromptDelete = (branch: Branch) => {
    if (!isOwner) return;
    setBranchToDelete(branch);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteBranch = async () => {
    if (!branchToDelete) return;
    try {
      setIsDeleting(true);
      await api.delete(`/branches/${branchToDelete.id}`);
      toast.success(t('branches.toastBranchDeleted') || "Branch and associated data deleted permanently");
      setBranches((prev) => prev.filter((b) => b.id !== branchToDelete.id));
      setIsDeleteDialogOpen(false);
      setBranchToDelete(null);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('branches.toastFailedToDelete') || "Failed to delete branch");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredBranches = branches.filter((b) =>
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">{t('branches.title')}</h1>
            <p className="text-xs sm:text-sm text-[#8C7361] mt-1">
              {t('branches.subtitle')}
            </p>
          </div>

          {isOwner && (
            <Button onClick={() => handleOpenDialog()} className="flex items-center gap-2 bg-[#4A2E1B] hover:bg-[#382214] text-white rounded-xl shadow-xs font-bold text-xs sm:text-sm h-10 px-4">
              <Plus className="w-4 h-4" />
              {t('branches.newBranch')}
            </Button>
          )}

          {isOwner && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  handleRequestCloseDialog();
                } else {
                  setIsDialogOpen(true);
                }
              }}
            >
              <DialogContent className="sm:max-w-[425px] rounded-2xl">
                <DialogHeader>
                  <DialogTitle>{editingBranch ? t('branches.editBranch') : t('branches.newBranch')}</DialogTitle>
                  <DialogDescription>
                    {t('branches.subtitle')}
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label htmlFor="name" className="text-xs font-bold text-[#2C1B10]">
                      {t('branches.colBranchName')} <span className="text-rose-600">*</span>
                    </label>
                    <Input
                      id="name"
                      placeholder={t('branches.branchNamePlaceholder')}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="rounded-xl border-[#EDE4D5]"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="address" className="text-xs font-bold text-[#2C1B10]">
                      {t('branches.colAddress')}
                    </label>
                    <Input
                      id="address"
                      placeholder={t('branches.addressPlaceholder')}
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="rounded-xl border-[#EDE4D5]"
                    />
                  </div>
                  <DialogFooter className="pt-4 gap-2">
                    <Button type="button" variant="outline" onClick={handleRequestCloseDialog} className="rounded-xl border-[#EDE4D5]">
                      {t('common.cancel')}
                    </Button>
                    <Button type="submit" disabled={submitting} className="rounded-xl bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold">
                      {submitting ? t('common.loading') : t('common.save')}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex items-center">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#8C7361]" />
            <Input
              placeholder={t('common.search')}
              className="pl-9 h-10 rounded-xl border-[#EDE4D5] bg-white text-xs sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Desktop Data Table (hidden on mobile, visible on md+) */}
        <div className="hidden md:block bg-white border border-[#EDE4D5] rounded-2xl overflow-hidden shadow-xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#FAF6F0]/60 border-b border-[#EDE4D5]">
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colBranchName')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colAddress')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('branches.colStatus')}</TableHead>
                <TableHead className="font-bold text-[#2C1B10]">{t('common.date')}</TableHead>
                <TableHead className="text-right pr-6 font-bold text-[#2C1B10]">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#8C7361]">
                    {t('branches.loadingBranches')}
                  </TableCell>
                </TableRow>
              ) : filteredBranches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-[#8C7361]">
                    {t('branches.noBranchesFound')}
                  </TableCell>
                </TableRow>
              ) : (
                filteredBranches.map((branch) => (
                  <TableRow key={branch.id} className="border-b border-[#F4ECE1] hover:bg-[#FAF6F0]/40">
                    <TableCell className="font-bold text-[#2C1B10]">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-[#8C7361]" />
                        <span>{branch.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#8C7361]">
                      {branch.address ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <MapPin className="w-3.5 h-3.5 text-[#8C7361]" />
                          {branch.address}
                        </span>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">{t('branches.noAddress')}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={branch.isActive ? "default" : "secondary"}
                        className={branch.isActive
                          ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 font-bold text-xs"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-100 border border-zinc-200 font-bold text-xs"
                        }
                      >
                        {branch.isActive ? `✓ ${t('branches.activeStatus')}` : t('branches.inactiveStatus')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-[#8C7361]">
                      {new Date(branch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      {isOwner ? (
                        <div className="flex justify-end items-center gap-4">
                          <div className="flex items-center gap-2">
                            <label className="text-xs font-semibold text-[#8C7361]" htmlFor={`switch-${branch.id}`}>
                              {toggleLoading === branch.id ? t('common.updating') : branch.isActive ? t('branches.disableBranch') : t('branches.enableBranch')}
                            </label>
                            <Switch
                              id={`switch-${branch.id}`}
                              checked={branch.isActive}
                              disabled={toggleLoading === branch.id}
                              onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleOpenDialog(branch)}
                            className="h-8 w-8 text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0] rounded-lg"
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePromptDelete(branch)}
                            className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-lg"
                            title={t('branches.deleteBranch') || "Delete Branch"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-400 font-medium">{t('branches.readOnly')}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Mobile Cards (visible on mobile < md, hidden on desktop) */}
        <div className="md:hidden space-y-3">
          {loading ? (
            <div className="bg-white border border-[#EDE4D5] rounded-2xl p-8 text-center text-[#8C7361] text-xs font-semibold">
              {t('branches.loadingBranches')}
            </div>
          ) : filteredBranches.length === 0 ? (
            <div className="bg-white border border-[#EDE4D5] rounded-2xl p-8 text-center text-[#8C7361] text-xs font-semibold">
              {t('branches.noBranchesFound')}
            </div>
          ) : (
            filteredBranches.map((branch) => (
              <div key={branch.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
                {/* Header: Name + Badge */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-[#E87A18]" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-extrabold text-sm text-[#2C1B10] truncate">{branch.name}</h3>
                      <p className="text-[11px] text-[#8C7361]">
                        {new Date(branch.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={branch.isActive ? "default" : "secondary"}
                    className={branch.isActive
                      ? "bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[11px] shrink-0"
                      : "bg-zinc-100 text-zinc-600 border border-zinc-200 font-bold text-[11px] shrink-0"
                    }
                  >
                    {branch.isActive ? `✓ ${t('branches.activeStatus')}` : t('branches.inactiveStatus')}
                  </Badge>
                </div>

                {/* Address Row */}
                <div className="bg-[#FAF6F0]/60 rounded-xl px-3 py-2 text-xs flex items-center gap-2 text-[#4A2E1B]">
                  <MapPin className="w-3.5 h-3.5 text-[#8C7361] shrink-0" />
                  <span className="truncate">
                    {branch.address ? branch.address : <span className="text-zinc-400 italic">{t('branches.noAddress')}</span>}
                  </span>
                </div>

                {/* Actions Row */}
                {isOwner && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#F4ECE1]">
                    <div className="flex items-center gap-2">
                      <Switch
                        id={`switch-mob-${branch.id}`}
                        checked={branch.isActive}
                        disabled={toggleLoading === branch.id}
                        onCheckedChange={() => handleToggleStatus(branch.id, branch.isActive)}
                      />
                      <label className="text-xs font-semibold text-[#8C7361]" htmlFor={`switch-mob-${branch.id}`}>
                        {toggleLoading === branch.id ? t('common.updating') : branch.isActive ? t('branches.disableBranch') : t('branches.enableBranch')}
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(branch)}
                        className="h-8 px-3 rounded-xl border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] flex items-center gap-1.5 text-xs font-bold"
                      >
                        <Edit2 className="w-3.5 h-3.5 text-[#E87A18]" />
                        {t('common.edit')}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePromptDelete(branch)}
                        className="h-8 px-2.5 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 flex items-center justify-center text-xs font-bold"
                        title={t('branches.deleteBranch') || "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Delete Branch Confirmation Modal */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => !isDeleting && setIsDeleteDialogOpen(open)}>
          <DialogContent className="max-w-md rounded-2xl bg-white border border-rose-200 p-6 shadow-xl">
            <DialogHeader className="space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto sm:mx-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <DialogTitle className="text-lg font-extrabold text-[#2C1B10]">
                  {t('branches.deleteConfirmTitle') || "Permanently Delete Branch?"}
                </DialogTitle>
                <div className="mt-2 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 space-y-2">
                  <p className="font-extrabold text-rose-950 text-sm flex items-center gap-1.5">
                    <Building2 className="w-4 h-4 text-rose-600" /> {branchToDelete?.name}
                  </p>
                  <p className="leading-relaxed">
                    {t('branches.deleteConfirmWarning') ||
                      "Are you sure you want to delete this branch? All data associated with this branch (production batches, daily sessions, sales, expenses, and branch stock items) will be permanently deleted and cannot be recovered. Please ensure you really want to proceed."}
                  </p>
                </div>
              </div>
            </DialogHeader>
            <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3">
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
                onClick={() => setIsDeleteDialogOpen(false)}
                className="w-full sm:w-auto h-11 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs sm:text-sm hover:bg-[#FAF6F0]"
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={isDeleting}
                onClick={handleDeleteBranch}
                className="w-full sm:w-auto h-11 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs sm:text-sm shadow-md flex items-center justify-center gap-2"
              >
                {isDeleting ? t('common.loading') : (t('branches.confirmDelete') || "Delete Branch & Data")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Unsaved Changes Confirmation Modal */}
        <UnsavedChangesDialog
          open={showUnsavedChanges}
          onOpenChange={setShowUnsavedChanges}
          onConfirmDiscard={handleCloseDialog}
        />
      </div>
    </DashboardLayout>
  );
}
