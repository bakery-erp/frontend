"use client";
import { EthDatePicker } from "@/components/EthDatePicker";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { getImageUrl, getFileUrl } from "@/lib/utils";
import { formatEthDate } from "@/lib/ethiopianDate";
import { Search, Plus, User as UserIcon, Building2, Edit2, Eye, Key, ShieldAlert, Copy, Check, Clock, CheckCircle2, XCircle, FileText, Trash2, EyeOff, AlertTriangle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";

interface Branch {
  id: string;
  name: string;
}

interface User {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
  salary: number | null;
  dailyExpense?: number | null;
  startDate: string | null;
  lastPaidDate: string | null;
  shift: string | null;
  avatarUrl?: string | null;
  filesUrl: string | null;
  branch?: {
    name: string;
  } | null;
}

interface PasswordResetRequest {
  id: string;
  userId: string;
  phone: string;
  status: "PENDING" | "RESOLVED" | "REJECTED";
  requestedAt: string;
  resolvedAt: string | null;
  user: {
    id: string;
    fullName: string;
    phone: string;
    role: string;
    branch?: { name: string } | null;
  };
}

function UserAvatar({
  url,
  name,
  className = "w-9 h-9",
  textClass = "text-xs",
}: {
  url?: string | null;
  name: string;
  className?: string;
  textClass?: string;
}) {
  const [hasError, setHasError] = useState(false);
  const isPdf = typeof url === 'string' && url.toLowerCase().endsWith('.pdf');
  const src = !isPdf && url ? getImageUrl(url) : null;

  if (!src || hasError) {
    return (
      <div
        className={`${className} rounded-xl bg-gradient-to-tr from-[#4A2E1B] to-[#E87A18] flex items-center justify-center text-white font-bold ${textClass} shadow-xs shrink-0 select-none`}
      >
        {name?.charAt(0) || "U"}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      onError={() => setHasError(true)}
      className={`${className} rounded-xl object-cover border border-[#E87A18]/30 shadow-xs shrink-0`}
    />
  );
}

const SHIFTS = ["DAY", "NIGHT"];

export default function UsersPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { selectedBranchId } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRole, setSelectedRole] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [activeTab, setActiveTab] = useState<"users" | "requests">("users");

  const { data: pageData, isLoading } = useQuery({
    queryKey: ["users-page", selectedBranchId],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (selectedBranchId) {
        params.branchId = selectedBranchId;
      }
      const [usersRes, branchesRes, rolesRes, resetRes] = await Promise.all([
        api.get<User[]>("/users", { params }),
        api.get<Branch[]>("/branches"),
        api.get<string[]>("/users/roles").catch(() => ({ data: ["OWNER", "ADMIN", "BAKER", "CAKE_WORKER", "CASHIER", "SAMBUSA_WORKER", "STOCK_KEEPER", "EMPLOYEE"] })),
        api.get<PasswordResetRequest[]>("/auth/password-reset-requests").catch(() => ({ data: [] })),
      ]);
      return {
        users: usersRes.data || [],
        branches: branchesRes.data || [],
        roles: rolesRes.data || [],
        resetRequests: resetRes.data || [],
      };
    },
  });

  const users = pageData?.users || [];
  const branches = pageData?.branches || [];
  const roles = pageData?.roles || [];
  const resetRequests = pageData?.resetRequests || [];

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "OWNER": return t('users.roleOwner') || "Owner";
      case "ADMIN": return t('users.roleAdmin') || "Admin";
      case "BAKER": return t('users.roleBaker') || "Baker";
      case "CAKE_WORKER": return t('users.roleCakeWorker') || "Cake Worker";
      case "CASHIER": return t('users.roleCashier') || "Cashier";
      case "SAMBUSA_WORKER": return t('users.roleSambusaWorker') || "Sambusa Worker";
      case "STOCK_KEEPER": return t('users.roleStockKeeper') || "Stock Keeper";
      case "EMPLOYEE": return t('users.roleEmployee') || "Employee";
      default: return role.replace("_", " ");
    }
  };

  // Reset Password Dialog State
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [selectedUserForReset, setSelectedUserForReset] = useState<User | PasswordResetRequest["user"] | null>(null);
  const [selectedRequestId, setSelectedRequestId] = useState<string | undefined>(undefined);
  const [customNewPassword, setCustomNewPassword] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  // Copy Result Modal State
  const [generatedResult, setGeneratedResult] = useState<{
    tempPassword: string;
    employeeName: string;
    employeePhone: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Dialog states
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState<User | null>(null);

  // Delete User Modal State (Owner only with Password Protection)
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deletePassword, setDeletePassword] = useState("");
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    if (user?.role !== "OWNER") {
      toast.error("Access Restricted: Only Owner can delete users");
      setUserToDelete(null);
      return;
    }
    if (userToDelete.id === user?.id) {
      toast.error("You cannot delete your own account");
      setUserToDelete(null);
      return;
    }
    if (userToDelete.role === "OWNER") {
      toast.error("Owner accounts cannot be deleted");
      setUserToDelete(null);
      return;
    }
    if (!deletePassword.trim()) {
      toast.error(t('users.enterPasswordToDeleteUser') || "Please enter your password to confirm deletion");
      return;
    }
    try {
      setIsDeleting(true);
      const res = await api.delete(`/users/${userToDelete.id}`, {
        data: { password: deletePassword },
      });
      if (res.data?.deactivated) {
        toast.info(res.data.message || "User deactivated (historical transaction records preserved)");
      } else {
        toast.success("User deleted successfully");
      }
      setUserToDelete(null);
      setDeletePassword("");
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-users"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    } finally {
      setIsDeleting(false);
    }
  };

  const pendingCount = resetRequests.filter((r) => r.status === "PENDING").length;

  const openResetPassword = (targetUser: User | PasswordResetRequest["user"], requestId?: string) => {
    setSelectedUserForReset(targetUser);
    setSelectedRequestId(requestId);
    setCustomNewPassword("");
    setIsResetModalOpen(true);
  };

  const handleGeneratePassword = async () => {
    if (!selectedUserForReset) return;
    setIsGenerating(true);
    try {
      const { data } = await api.post("/auth/admin-reset-password", {
        targetUserId: selectedUserForReset.id,
        requestId: selectedRequestId,
        customPassword: customNewPassword ? customNewPassword : undefined,
      });

      toast.success(t('users.toastUserUpdated') || "Password reset successfully!");
      setIsResetModalOpen(false);
      setGeneratedResult({
        tempPassword: data.tempPassword,
        employeeName: data.employee.fullName,
        employeePhone: data.employee.phone,
      });
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-users"] });
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      await api.post(`/auth/password-reset-requests/${requestId}/reject`);
      toast.success("Password reset request rejected");
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
    } catch (err: any) {
      toast.error("Failed to reject request");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success(t('users.copiedToClipboard') || "Password copied to clipboard");
    setTimeout(() => setCopied(false), 3000);
  };

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      u.fullName.toLowerCase().includes(term) ||
      u.phone.includes(term) ||
      u.role.toLowerCase().includes(term) ||
      (u.branch?.name && u.branch.name.toLowerCase().includes(term));
    const matchesRole = selectedRole === "ALL" || u.role === selectedRole;
    const matchesStatus =
      selectedStatus === "ALL" ||
      (selectedStatus === "ACTIVE" && u.isActive) ||
      (selectedStatus === "DISABLED" && !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const filteredResetRequests = resetRequests.filter((r) => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return true;
    return (
      (r.user?.fullName && r.user.fullName.toLowerCase().includes(term)) ||
      (r.phone && r.phone.includes(term)) ||
      (r.user?.phone && r.user.phone.includes(term)) ||
      (r.user?.branch?.name && r.user.branch.name.toLowerCase().includes(term))
    );
  });

  const openCreate = () => {
    router.push("/users/new");
  };

  const openEdit = (u: User) => {
    router.push(`/users/${u.id}/edit`);
  };

  const openView = (u: User) => {
    setViewingUser(u);
    setIsViewDialogOpen(true);
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (userId === user?.id) {
      toast.error(t('users.cannotDeactivateSelf') || "You cannot deactivate your own account");
      return;
    }
    const targetUser = users.find((u) => u.id === userId);
    if (targetUser?.role === "OWNER") {
      toast.error("Owner accounts cannot be deactivated");
      return;
    }
    try {
      await api.patch(`/users/${userId}`, { isActive: !currentStatus });
      toast.success(t('common.statusUpdated') || "Status updated");
      queryClient.invalidateQueries({ queryKey: ["users-page"] });
      queryClient.invalidateQueries({ queryKey: ["payroll-users"] });
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update status");
    }
  };

  const handleToggleActive = async (u: User) => {
    await handleToggleStatus(u.id, u.isActive);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">{t('users.title')}</h1>
        </div>
        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <Link href="/users/new">
            <Button className="bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-xs sm:text-sm h-11 px-5 shadow-sm self-start sm:self-auto flex items-center gap-1.5">
              <Plus className="w-4 h-4 mr-1" />
              {t('users.newUser')}
            </Button>
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-[#EDE4D5] shadow-xs overflow-hidden">
        {/* Centered Segmented Control with Unambiguous Active State */}
        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
          <div className="p-3 bg-[#FAF6F0]/70 border-b border-[#EDE4D5] flex justify-center w-full">
            <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-[#EDE4D5]/70 rounded-2xl w-full max-w-md shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "users"
                    ? "bg-[#4A2E1B] text-white shadow-md ring-2 ring-[#4A2E1B]/20"
                    : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50"
                }`}
              >
                <span>{t('users.tabStaffDirectory')}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                  activeTab === "users" ? "bg-white/20 text-white" : "bg-[#4A2E1B]/10 text-[#4A2E1B]"
                }`}>
                  {users.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("requests")}
                className={`py-2.5 px-3 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 ${
                  activeTab === "requests"
                    ? "bg-[#4A2E1B] text-white shadow-md ring-2 ring-[#4A2E1B]/20"
                    : "text-[#8C7361] hover:text-[#2C1B10] hover:bg-white/50"
                }`}
              >
                <span>{t('users.tabPasswordResets')}</span>
                {pendingCount > 0 ? (
                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                    {pendingCount}
                  </span>
                ) : (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${
                    activeTab === "requests" ? "bg-white/20 text-white" : "bg-[#4A2E1B]/10 text-[#4A2E1B]"
                  }`}>
                    0
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="p-3.5 border-b border-[#EDE4D5] bg-[#FAF6F0]/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 flex-1">
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                placeholder={t('common.search')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white border-[#EDE4D5] rounded-xl text-xs h-9 w-full"
              />
            </div>

            {activeTab === "users" && (
              <div className="flex items-center gap-2">
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  aria-label={t('users.filterByRole') || "Filter by Role"}
                  className="h-9 px-3 rounded-xl border border-[#EDE4D5] bg-white text-xs font-medium text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="ALL">{t('users.allRoles') || "All Roles"}</option>
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {getRoleLabel(r)}
                    </option>
                  ))}
                </select>

                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  aria-label={t('users.filterByStatus') || "Filter by Status"}
                  className="h-9 px-3 rounded-xl border border-[#EDE4D5] bg-white text-xs font-medium text-[#2C1B10] focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="ALL">{t('users.allStatuses') || "All Statuses"}</option>
                  <option value="ACTIVE">{t('users.statusActive') || "Active"}</option>
                  <option value="DISABLED">{t('users.statusDisabled') || "Disabled"}</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {activeTab === "users" ? (
          <>
            {/* MOBILE TOUCH CARDS: Personnel Directory (block md:hidden) */}
            <div className="block md:hidden divide-y divide-[#EDE4D5]/60 p-3 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-3.5 shadow-2xs space-y-3">
                      <div className="flex items-center space-x-3">
                        <Skeleton className="w-10 h-10 rounded-xl" />
                        <div className="space-y-1.5 flex-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-[#8C7361] text-xs font-medium">
                  {t('users.noUsersFound') || "No users found matching your search."}
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const canReset = user?.role === "OWNER" || (user?.role === "ADMIN" && u.role !== "OWNER");
                  const canEdit = user?.role === "OWNER" || (user?.role === "ADMIN" && u.role !== "OWNER");
                  const canDelete = user?.role === "OWNER" && u.id !== user?.id && u.role !== "OWNER";

                  return (
                    <div key={u.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-4 shadow-xs space-y-3">
                      {/* Top Row: User Avatar, Name, Phone & Status Switch */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <UserAvatar url={u.avatarUrl} name={u.fullName} className="w-10 h-10 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="font-extrabold text-sm text-[#2C1B10] truncate" title={u.fullName}>{u.fullName}</p>
                            <p className="text-xs text-[#8C7361] font-mono truncate">{u.phone}</p>
                          </div>
                        </div>

                        {/* Status Switch */}
                        <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                          <Switch
                            checked={u.isActive}
                            onCheckedChange={() => handleToggleStatus(u.id, u.isActive)}
                            disabled={(user?.role !== "OWNER" && user?.role !== "ADMIN") || u.role === "OWNER" || u.id === user?.id}
                            title={
                              u.id === user?.id
                                ? (t('users.cannotDeactivateSelf') || "You cannot deactivate your own account")
                                : u.role === "OWNER"
                                ? "Owner accounts cannot be deactivated"
                                : undefined
                            }
                          />
                          <span className={`text-[11px] font-extrabold ${u.isActive ? 'text-emerald-700' : 'text-zinc-400'}`}>
                            {u.isActive ? (t('users.statusActive') || 'Active') : (t('users.statusDisabled') || 'Off')}
                          </span>
                        </div>
                      </div>

                      {/* Second Row: Role Badge, Salary Badge & Branch */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#FAF6F0]">
                        <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-extrabold bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5] py-0.5">
                          {getRoleLabel(u.role)}
                        </Badge>

                        {(user?.role === "OWNER" || user?.role === "ADMIN") && u.salary != null && (
                          <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                            {Number(u.salary).toLocaleString()} ETB
                          </span>
                        )}

                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] font-bold text-[11px] min-w-0 max-w-full">
                          <Building2 className="w-3 h-3 text-[#E87A18] shrink-0" />
                          <span className="truncate">
                            {u.branch ? u.branch.name : (
                              <span className="text-[#8C7361] font-normal italic">
                                {t('users.globalAllBranches') || 'Global / All Branches'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Compact icon row */}
                      <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-[#FAF6F0]">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 px-2.5 border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold text-xs flex items-center gap-1"
                          onClick={() => openView(u)}
                          title={t('users.btnView') || "View"}
                          aria-label={t('users.btnView') || "View"}
                        >
                          <Eye className="w-3.5 h-3.5 text-[#E87A18]" />
                          <span>View</span>
                        </Button>
                        {canReset && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-amber-200 text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl"
                            onClick={() => openResetPassword(u)}
                            title={t('users.btnResetPass') || "Reset Password"}
                            aria-label={t('users.btnResetPass') || "Reset Password"}
                          >
                            <Key className="w-4 h-4" />
                          </Button>
                        )}
                        {canEdit && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 px-2.5 border-[#EDE4D5] text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl font-bold text-xs flex items-center gap-1"
                            onClick={() => openEdit(u)}
                            title={t('users.btnEditEmployee') || "Edit"}
                            aria-label={t('users.btnEditEmployee') || "Edit"}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </Button>
                        )}
                        {canDelete && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 border-rose-200 text-rose-600 bg-rose-50 hover:bg-rose-100 rounded-xl"
                            onClick={() => {
                              setUserToDelete(u);
                              setDeletePassword("");
                              setShowDeletePassword(false);
                            }}
                            title={t('common.delete') || "Delete"}
                            aria-label={t('common.delete') || "Delete"}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* DESKTOP TABLE: Personnel Directory (hidden md:table) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('users.colFullName')}</TableHead>
                    <TableHead>{t('users.colRole')}</TableHead>
                    <TableHead>{t('users.colBranch')}</TableHead>
                    {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                      <TableHead>{t('users.monthlyBaseSalaryLabel') || "Base Salary"}</TableHead>
                    )}
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <Skeleton className="w-9 h-9 rounded-xl" />
                            <div className="space-y-1.5">
                              <Skeleton className="h-4 w-32" />
                              <Skeleton className="h-3 w-20" />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                          <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        )}
                        <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={(user?.role === "OWNER" || user?.role === "ADMIN") ? 6 : 5} className="text-center py-8 text-[#8C7361]">
                        {t('users.noUsersFound') || "No users found matching your search."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((u) => {
                      const canReset = user?.role === "OWNER" || (user?.role === "ADMIN" && u.role !== "OWNER");
                      const canEdit = user?.role === "OWNER" || (user?.role === "ADMIN" && u.role !== "OWNER");
                      const canDelete = user?.role === "OWNER" && u.id !== user?.id && u.role !== "OWNER";

                      return (
                        <TableRow key={u.id}>
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              <UserAvatar url={u.avatarUrl} name={u.fullName} className="w-9 h-9" />
                              <div>
                                <p className="font-bold text-[#2C1B10]">{u.fullName}</p>
                                <p className="text-xs text-[#8C7361] font-mono">{u.phone}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="uppercase text-[10px] tracking-wider font-extrabold bg-[#FAF6F0] text-[#4A2E1B] border-[#EDE4D5]">
                              {getRoleLabel(u.role)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {u.branch ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[#FAF6F0] border border-[#EDE4D5] text-[#4A2E1B] font-bold text-xs shadow-2xs">
                                <Building2 className="w-3.5 h-3.5 text-[#E87A18]" />
                                {u.branch.name}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-500 font-medium text-xs italic">
                                {t('users.globalAllBranches') || 'Global / All Branches'}
                              </span>
                            )}
                          </TableCell>
                          {(user?.role === "OWNER" || user?.role === "ADMIN") && (
                            <TableCell className="font-mono text-xs font-semibold text-[#2C1B10]">
                              {u.salary != null ? `${Number(u.salary).toLocaleString()} ETB` : "—"}
                            </TableCell>
                          )}
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={u.isActive}
                                onCheckedChange={() => handleToggleStatus(u.id, u.isActive)}
                                disabled={(user?.role !== "OWNER" && user?.role !== "ADMIN") || u.role === "OWNER" || u.id === user?.id}
                                title={
                                  u.id === user?.id
                                    ? (t('users.cannotDeactivateSelf') || "You cannot deactivate your own account")
                                    : u.role === "OWNER"
                                    ? "Owner accounts cannot be deactivated"
                                    : undefined
                                }
                              />
                              <span className={`text-xs font-bold ${u.isActive ? 'text-emerald-700' : 'text-zinc-400'}`}>
                                {u.isActive ? (t('users.statusActive') || 'Active') : (t('users.statusDisabled') || 'Disabled')}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]"
                                onClick={() => openView(u)}
                                title={t('users.btnView') || "View User"}
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canReset && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={t('users.btnResetPass') || "Reset Password"}
                                  className="h-8 w-8 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                  onClick={() => openResetPassword(u)}
                                >
                                  <Key className="w-4 h-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0 text-[#4A2E1B] hover:text-[#E87A18] hover:bg-[#FAF6F0]"
                                  onClick={() => openEdit(u)}
                                  title={t('users.btnEditEmployee') || "Edit User"}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title={t('common.delete') || "Delete User"}
                                  className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50"
                                  onClick={() => {
                                    setUserToDelete(u);
                                    setDeletePassword("");
                                    setShowDeletePassword(false);
                                  }}
                                >
                                  <Trash2 className="w-4 h-4" />
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
          </>
        ) : (
          <>
            {/* MOBILE TOUCH CARDS: Password Reset Requests (block md:hidden) */}
            <div className="block md:hidden divide-y divide-[#EDE4D5]/60 p-3 space-y-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="bg-white border border-[#EDE4D5] rounded-2xl p-3.5 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-28" />
                    </div>
                  ))}
                </div>
              ) : filteredResetRequests.length === 0 ? (
                <div className="text-center py-8 text-[#8C7361] text-xs font-medium">
                  {t('users.noResetRequestsFound') || "No password reset requests found."}
                </div>
              ) : (
                filteredResetRequests.map((r) => (
                  <div key={r.id} className="bg-white border border-[#EDE4D5] rounded-2xl p-3.5 shadow-2xs space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center">
                          <Key className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-extrabold text-sm text-[#2C1B10]">{r.user?.fullName || "Employee"}</p>
                          <p className="text-xs text-[#8C7361]">{r.user?.branch?.name || (t('users.globalAllBranches') || "Global / Unassigned")}</p>
                        </div>
                      </div>
                      <div>
                        {r.status === "PENDING" && (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-[10px]">
                            ⏳ {t('users.statusPending') || "Pending Action"}
                          </Badge>
                        )}
                        {r.status === "RESOLVED" && (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-[10px]">
                            ✓ {t('users.statusCompleted') || "Completed"}
                          </Badge>
                        )}
                        {r.status === "REJECTED" && (
                          <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold text-[10px]">
                            ✕ {t('users.statusRejected') || "Rejected"}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs text-[#8C7361] pt-1 border-t border-[#FAF6F0]">
                      <span className="font-mono font-semibold text-[#2C1B10]">{r.phone}</span>
                      <span>{formatEthDate(r.requestedAt, true)}</span>
                    </div>

                    {r.status === "PENDING" && (
                      <div className="flex items-center gap-2 pt-2 border-t border-[#FAF6F0]">
                        <Button
                          size="sm"
                          onClick={() => openResetPassword(r.user, r.id)}
                          className="flex-1"
                        >
                          <Key className="w-3.5 h-3.5 mr-1" />
                          {t('users.btnGeneratePassword') || "Generate Password"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(r.id)}
                          className="text-xs font-bold h-9 px-3 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50"
                        >
                          {t('users.btnReject') || "Reject"}
                        </Button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* DESKTOP TABLE: Password Reset Requests (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('users.colEmployee') || "Employee"}</TableHead>
                    <TableHead>{t('users.phoneNumberLabel') || "Phone Number"}</TableHead>
                    <TableHead>{t('users.colRequestedDate') || "Requested Date"}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead className="text-right pr-6">{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 4 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                        <TableCell className="text-right pr-6"><Skeleton className="h-8 w-24 ml-auto rounded-xl" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredResetRequests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-[#8C7361]">
                        {t('users.noResetRequestsFound') || "No password reset requests found."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredResetRequests.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-700">
                              <Key className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-bold text-[#2C1B10]">{r.user?.fullName || "Employee"}</p>
                              <p className="text-xs text-[#8C7361]">{r.user?.branch?.name || (t('users.globalAllBranches') || "Global / Unassigned")}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs font-semibold text-[#2C1B10]">{r.phone}</TableCell>
                        <TableCell className="text-xs font-medium text-[#8C7361]">
                          {formatEthDate(r.requestedAt, true)}
                        </TableCell>
                        <TableCell>
                          {r.status === "PENDING" && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold text-xs">
                              ⏳ {t('users.statusPending') || "Pending Action"}
                            </Badge>
                          )}
                          {r.status === "RESOLVED" && (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold text-xs">
                              ✓ {t('users.statusCompleted') || "Completed"}
                            </Badge>
                          )}
                          {r.status === "REJECTED" && (
                            <Badge className="bg-rose-100 text-rose-800 border-rose-200 font-bold text-xs">
                              ✕ {t('users.statusRejected') || "Rejected"}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          {r.status === "PENDING" && (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                onClick={() => openResetPassword(r.user, r.id)}
                              >
                                <Key className="w-3.5 h-3.5 mr-1" />
                                {t('users.btnGeneratePassword') || "Generate Password"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRejectRequest(r.id)}
                                className="text-xs font-bold h-8 rounded-lg text-rose-600 border-rose-200 hover:bg-rose-50"
                              >
                                {t('users.btnReject') || "Reject"}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>

      {/* VIEW DETAILS DIALOG */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('users.detailCardTitle') || "Employee Detail Card"}</DialogTitle>
          </DialogHeader>
          {viewingUser && (
            <div className="space-y-4 py-4">
              <div className="flex items-center space-x-4 pb-4 border-b">
                <UserAvatar
                  url={viewingUser.avatarUrl}
                  name={viewingUser.fullName}
                  className="w-16 h-16 rounded-2xl border-2 border-[#E87A18]"
                  textClass="text-xl"
                />
                <div>
                  <h3 className="text-xl font-bold tracking-tight text-zinc-900">{viewingUser.fullName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="uppercase text-[10px] tracking-wider">{getRoleLabel(viewingUser.role)}</Badge>
                    <Badge className={viewingUser.isActive ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}>
                      {viewingUser.isActive ? (t('users.activeAccount') || "Active Account") : (t('users.suspendedAccount') || "Suspended")}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-y-6 text-sm">
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colPhoneContact') || "Phone Contact"}</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.phone}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colAssignedBase') || "Assigned Base"}</p>
                  <p className="font-semibold text-zinc-900 flex items-center">
                    <Building2 className="w-3 h-3 mr-1" />
                    {viewingUser.branch?.name || (t('users.globalAllBranches') || "Global / Unassigned")}
                  </p>
                </div>
                
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colShift') || "Shift"}</p>
                  <p className="font-semibold text-zinc-900">
                    {viewingUser.shift === "DAY"
                      ? `${t('users.dayShiftOption') || "Day Shift"} (DAY)`
                      : viewingUser.shift === "NIGHT"
                      ? `${t('users.nightShiftOption') || "Night Shift"} (NIGHT)`
                      : viewingUser.shift || "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.monthlyBaseSalaryLabel') || "Base Salary"}</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.salary ? `${Number(viewingUser.salary).toLocaleString()} ETB` : "N/A"}</p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.dailyExpenseLabel') || "Daily Expense"}</p>
                  <p className="font-semibold text-zinc-900">{viewingUser.dailyExpense ? `${Number(viewingUser.dailyExpense).toLocaleString()} ETB` : "N/A"}</p>
                </div>

                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colJoinedDate') || "Joined Date"}</p>
                  <p className="font-semibold text-zinc-900">
                    {viewingUser.startDate ? formatEthDate(viewingUser.startDate, false) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colLastPayDate') || "Last Pay Date"}</p>
                  <p className="font-semibold text-zinc-900">
                    {viewingUser.lastPaidDate ? formatEthDate(viewingUser.lastPaidDate, false) : "N/A"}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colSecurity') || "Security"}</p>
                  <p className="font-semibold text-zinc-900 text-xs mt-0.5">
                    {t('users.securityNote') || "Password hashed & hidden by system. Admins can rotate it in Edit menu."}
                  </p>
                </div>
                <div>
                  <p className="text-zinc-500 font-medium mb-1">{t('users.colEmploymentDoc') || "Employment Document"}</p>
                  {viewingUser.filesUrl ? (
                    <a
                      href={getFileUrl(viewingUser.filesUrl) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-semibold bg-blue-50 px-2.5 py-1 rounded inline-flex items-center gap-1.5 border border-blue-200"
                    >
                      <FileText className="w-3.5 h-3.5 text-blue-600" />
                      {t('users.viewIdDoc') || "View Identification Document"}
                    </a>
                  ) : (
                    <span className="text-zinc-400">{t('users.noneAttached') || "None attached"}</span>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[#EDE4D5] w-full">
            <Button
              variant="outline"
              onClick={() => setIsViewDialogOpen(false)}
              className="w-full sm:w-auto h-10 border-[#EDE4D5] text-[#8C7361] hover:text-[#4A2E1B] font-semibold rounded-xl text-xs sm:text-sm order-2 sm:order-1"
            >
              {t('common.close') || "Close"}
            </Button>
            {(user?.role === "OWNER" || (user?.role === "ADMIN" && viewingUser?.role !== "OWNER")) && viewingUser && (
              <Button
                onClick={() => {
                  setIsViewDialogOpen(false);
                  openEdit(viewingUser);
                }}
                className="w-full sm:w-auto h-11 bg-[#4A2E1B] text-white hover:bg-[#382214] font-bold rounded-xl text-xs sm:text-sm order-1 sm:order-2 shadow-sm"
              >
                <Edit2 className="w-4 h-4 mr-2" /> {t('users.btnEditEmployee') || "Edit Employee"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GENERATE / RESET PASSWORD DIALOG */}
      <Dialog open={isResetModalOpen} onOpenChange={setIsResetModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-amber-600" />
              {t('users.resetModalTitle') || "Reset Employee Password"}
            </DialogTitle>
            <DialogDescription>
              {t('users.resetModalSubtitle') || "Generate a new access password for employee account."}
            </DialogDescription>
          </DialogHeader>

          {selectedUserForReset && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('users.colFullName') || "Employee Name"}:</span>
                  <span className="font-bold text-zinc-900">{selectedUserForReset.fullName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('users.phoneNumberLabel') || "Phone Number"}:</span>
                  <span className="font-mono text-zinc-900">{selectedUserForReset.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500 font-medium">{t('users.colRole') || "Role"} / {t('users.colBranch') || "Branch"}:</span>
                  <span className="text-zinc-900">{getRoleLabel(selectedUserForReset.role)} • {selectedUserForReset.branch?.name || (t('users.globalAllBranches') || "Global")}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700">
                  {t('users.customNewPasswordOptional') || "Custom New Password (Optional)"}
                </label>
                <Input
                  type="text"
                  placeholder="Leave empty to auto-generate secure code (e.g. Bakery#A4K8)"
                  value={customNewPassword}
                  onChange={(e) => setCustomNewPassword(e.target.value)}
                  className="h-10 text-xs"
                />
                <p className="text-[11px] text-zinc-500">
                  {t('users.customNewPasswordHint') || "If left empty, a readable 8-character password will automatically be created."}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3 border-t border-[#EDE4D5] w-full">
            <Button
              onClick={handleGeneratePassword}
              size="lg"
              loading={isGenerating}
              loadingText="Generating..."
              className="w-full sm:w-auto order-1 sm:order-2"
            >
              {t('users.btnGenerateAndSet') || "Generate & Set Password"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetModalOpen(false)}
              className="w-full sm:w-auto h-10 border-[#EDE4D5] text-[#8C7361] hover:text-[#4A2E1B] font-semibold rounded-xl text-xs sm:text-sm order-2 sm:order-1"
            >
              {t('common.cancel') || "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COPY GENERATED PASSWORD RESULT MODAL */}
      <Dialog open={!!generatedResult} onOpenChange={() => setGeneratedResult(null)}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {t('users.copyModalTitle') || "New Password Generated"}
            </DialogTitle>
            <DialogDescription>
              {t('users.copyModalSubtitle') || "Provide this temporary password to the employee immediately."}
            </DialogDescription>
          </DialogHeader>

          {generatedResult && (
            <div className="space-y-4 py-2">
              <div className="text-xs text-zinc-600">
                Password successfully updated for <strong className="text-zinc-900">{generatedResult.employeeName}</strong> ({generatedResult.employeePhone}).
              </div>

              <div className="p-4 bg-zinc-900 text-amber-400 rounded-xl border border-zinc-800 text-center space-y-2">
                <div className="text-[10px] uppercase font-bold tracking-widest text-zinc-400">
                  {t('users.tempPasswordLabel') || "Temporary Password"}
                </div>
                <div className="text-2xl font-mono font-bold tracking-wider select-all">{generatedResult.tempPassword}</div>
              </div>

              <Button
                onClick={() => copyToClipboard(generatedResult.tempPassword)}
                variant="outline"
                className="w-full flex items-center justify-center gap-2 h-11 text-xs font-bold border-zinc-300"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    {t('users.copiedToClipboard') || "Copied to Clipboard!"}
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 text-zinc-600" />
                    {t('users.btnCopyTempPassword') || "Copy Temporary Password"}
                  </>
                )}
              </Button>
            </div>
          )}

          <DialogFooter>
            <Button
              onClick={() => setGeneratedResult(null)}
              className="w-full bg-black text-white hover:bg-zinc-800"
            >
              {t('common.done') || "Done"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PASSWORD-PROTECTED DELETE USER DIALOG */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => {
        if (!open) {
          setUserToDelete(null);
          setDeletePassword("");
          setShowDeletePassword(false);
        }
      }}>
        <DialogContent className="max-w-md bg-white border border-[#EDE4D5] rounded-2xl p-6 shadow-xl">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1 text-left">
                <DialogTitle className="text-base sm:text-lg font-bold text-[#2C1B10]">
                  {t('users.deleteUserTitle') || "Delete User"}
                </DialogTitle>
                <p className="text-xs sm:text-sm text-[#8C7361] leading-relaxed">
                  {t('users.deleteUserConfirmWarning') ||
                    `Are you sure you want to delete ${userToDelete?.fullName}? This action cannot be undone.`}
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-1.5 pt-2">
            <label htmlFor="deleteUserPasswordInputDirect" className="text-xs font-bold text-[#2C1B10]">
              {t('users.enterPasswordToDeleteUser') || "Enter your password to confirm deletion"} <span className="text-rose-600">*</span>
            </label>
            <div className="relative">
              <Input
                id="deleteUserPasswordInputDirect"
                type={showDeletePassword ? "text" : "password"}
                placeholder="Enter your account password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className="rounded-xl border-[#EDE4D5] pr-10 text-xs sm:text-sm"
                autoComplete="current-password"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && deletePassword.trim() && !isDeleting) {
                    e.preventDefault();
                    handleDeleteUser();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setShowDeletePassword(!showDeletePassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8C7361] hover:text-[#2C1B10]"
                title={showDeletePassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showDeletePassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              size="lg"
              disabled={isDeleting}
              onClick={() => {
                setUserToDelete(null);
                setDeletePassword("");
                setShowDeletePassword(false);
              }}
              className="w-full sm:w-auto"
            >
              {t('common.cancel') || "Cancel"}
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="lg"
              loading={isDeleting}
              disabled={isDeleting || !deletePassword.trim()}
              onClick={handleDeleteUser}
              className="w-full sm:w-auto"
            >
              {t('common.delete') || "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
