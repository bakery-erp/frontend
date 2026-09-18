"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { EthDatePicker } from "@/components/EthDatePicker";
import { api } from "@/lib/axios";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ArrowLeft, UserCheck, Building2, Calendar, FileText, Upload, Save, Loader2 } from "lucide-react";

const ROLES = ["OWNER", "ADMIN", "BAKER", "CAKE_WORKER", "CASHIER", "SAMBUSA_WORKER", "EMPLOYEE"] as const;
const SHIFTS = ["DAY", "NIGHT"] as const;

interface UserData {
  id: string;
  fullName: string;
  phone: string;
  role: string;
  branchId: string | null;
  isActive: boolean;
  salary: number | null;
  startDate: string | null;
  lastPaidDate: string | null;
  shift: string | null;
  filesUrl: string | null;
}

export default function EditUserPage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;
  const { user } = useAuth();
  const { branches } = useBranch();
  const { t } = useLanguage();

  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "OWNER": return t('users.roleOwner');
      case "ADMIN": return t('users.roleAdmin');
      case "BAKER": return t('users.roleBaker');
      case "CAKE_WORKER": return t('users.roleCakeWorker');
      case "CASHIER": return t('users.roleCashier');
      case "SAMBUSA_WORKER": return t('users.roleSambusaWorker');
      case "EMPLOYEE": return t('users.roleEmployee');
      default: return role.replace("_", " ");
    }
  };

  useEffect(() => {
    if (!userId) return;
    const fetchUser = async () => {
      try {
        const res = await api.get(`/users/${userId}`).catch(async () => {
          // Fallback to all users list if single user endpoint isn't supported
          const listRes = await api.get("/users");
          const found = listRes.data.find((u: UserData) => u.id === userId);
          return { data: found };
        });
        if (res.data) {
          setUserData(res.data);
        } else {
          toast.error("User not found");
          router.push("/users");
        }
      } catch (err: any) {
        toast.error("Failed to load user information");
        router.push("/users");
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [userId, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userData) return;
    setIsSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);

      // Clean up empty strings
      if (!formData.get("salary")) formData.delete("salary");
      if (!formData.get("startDate")) formData.delete("startDate");
      if (!formData.get("lastPaidDate")) formData.delete("lastPaidDate");
      if (!formData.get("branchId")) formData.delete("branchId");
      if (!formData.get("shift")) formData.delete("shift");

      // Don't update password if empty
      if (!formData.get("password")) {
        formData.delete("password");
      }

      const file = formData.get("file") as File;
      if (file && file.size === 0) {
        formData.delete("file");
      }

      await api.patch(`/users/${userData.id}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success(t('users.toastUserUpdated'));
      router.push("/users");
    } catch (error: any) {
      toast.error(error.response?.data?.error || "Failed to update user");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-96 items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#E87A18]" />
        </div>
      </DashboardLayout>
    );
  }

  if (!userData) return null;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto pb-12">
        {/* Header with Back Button */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/users">
            <Button variant="outline" size="icon" className="w-10 h-10 rounded-xl border-[#EDE4D5] hover:bg-[#FAF6F0] text-[#4A2E1B]">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#2C1B10]">
              {t('users.editPersonnel')}: {userData.fullName}
            </h1>
            <p className="text-xs sm:text-sm text-[#8C7361] mt-0.5">
              {t('users.editPersonnelSubtitle')}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Personal & Account Info */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-[#E87A18] flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t('users.sectionAccountIdentity')}</h2>
                <p className="text-xs text-[#8C7361]">{t('users.sectionAccountIdentityDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.fullNameLabel')} <span className="text-rose-600">*</span>
                </label>
                <Input
                  name="fullName"
                  defaultValue={userData.fullName}
                  placeholder={t('users.fullNamePlaceholder')}
                  required
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.phoneNumberLabel')} <span className="text-rose-600">*</span>
                </label>
                <Input
                  name="phone"
                  defaultValue={userData.phone}
                  placeholder={t('users.phonePlaceholder')}
                  required
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.passwordLabel')} <span className="text-xs text-zinc-400 font-normal">({t('users.passwordLeaveBlank')})</span>
                </label>
                <Input
                  name="password"
                  type="text"
                  placeholder={`•••••••• (${t('users.passwordLeaveBlank')})`}
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.systemRoleLabel')} <span className="text-rose-600">*</span>
                </label>
                <select
                  name="role"
                  required
                  defaultValue={userData.role}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {getRoleLabel(r)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Branch & Shift Assignment */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Building2 className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t('users.sectionBranchSchedule')}</h2>
                <p className="text-xs text-[#8C7361]">{t('users.sectionBranchScheduleDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.branchAssignmentLabel')}
                </label>
                <select
                  name="branchId"
                  defaultValue={userData.branchId || ""}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="">{t('users.globalAllBranches')}</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.assignedShiftLabel')}
                </label>
                <select
                  name="shift"
                  defaultValue={userData.shift || ""}
                  className="w-full h-11 rounded-xl border border-[#EDE4D5] bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#E87A18]"
                >
                  <option value="">{t('users.noShiftAssigned')}</option>
                  {SHIFTS.map((s) => (
                    <option key={s} value={s}>
                      {s === "DAY" ? t('users.dayShiftOption') : s === "NIGHT" ? t('users.nightShiftOption') : s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Section 3: Compensation & Ethiopian Dates */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t('users.sectionPayrollTimeline')}</h2>
                <p className="text-xs text-[#8C7361]">{t('users.sectionPayrollTimelineDesc')}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.monthlyBaseSalaryLabel')}
                </label>
                <Input
                  name="salary"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={userData.salary ?? ""}
                  placeholder="0.00"
                  onFocus={(e) => e.target.select()}
                  className="h-11 rounded-xl border-[#EDE4D5] text-sm font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.employmentStartDateLabel')}
                </label>
                <EthDatePicker
                  name="startDate"
                  defaultValue={userData.startDate ? userData.startDate.split("T")[0] : ""}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                  {t('users.lastPaidDateLabel')}
                </label>
                <EthDatePicker
                  name="lastPaidDate"
                  defaultValue={userData.lastPaidDate ? userData.lastPaidDate.split("T")[0] : ""}
                />
              </div>
            </div>
          </div>

          {/* Section 4: Documentation Upload */}
          <div className="bg-white rounded-2xl border border-[#EDE4D5] p-4 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[#EDE4D5] pb-3">
              <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-extrabold text-[#2C1B10]">{t('users.sectionDocs')}</h2>
                <p className="text-xs text-[#8C7361]">{t('users.sectionDocsDesc')}</p>
              </div>
            </div>

            <div>
              {userData.filesUrl && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between">
                  <span className="text-xs font-medium text-blue-900">{t('users.currentDocOnFile')}</span>
                  <a
                    href={`http://localhost:3001${userData.filesUrl}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-bold text-blue-700 hover:underline bg-white px-3 py-1 rounded-lg border border-blue-200"
                  >
                    {t('users.viewDocument')}
                  </a>
                </div>
              )}

              <label className="text-xs font-bold text-[#2C1B10] block mb-1.5">
                {userData.filesUrl ? t('users.replaceDocOptional') : t('users.attachmentFileLabel')}
              </label>
              <div className="border-2 border-dashed border-[#EDE4D5] rounded-2xl p-4 sm:p-6 text-center hover:border-[#E87A18] transition-colors bg-[#FAF6F0]/40">
                <Upload className="w-8 h-8 text-[#8C7361] mx-auto mb-2" />
                <p className="text-xs text-[#8C7361] mb-2 font-medium">
                  {t('users.selectNewFile')}
                </p>
                <Input
                  name="file"
                  type="file"
                  accept=".pdf,image/*"
                  className="max-w-xs mx-auto text-xs cursor-pointer border-[#EDE4D5] bg-white rounded-xl h-10"
                />
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              type="submit"
              disabled={isSubmitting}
              className="order-1 sm:order-2 flex-1 h-12 bg-[#4A2E1B] hover:bg-[#382214] text-white font-bold rounded-xl text-sm shadow-md flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {isSubmitting ? t('users.btnUpdatingPersonnel') : t('users.btnUpdatePersonnel')}
            </Button>
            <Link href="/users" className="order-2 sm:order-1 sm:flex-initial">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto h-12 px-6 rounded-xl border-[#EDE4D5] text-[#4A2E1B] font-bold text-sm hover:bg-[#FAF6F0]"
              >
                {t('common.cancel')}
              </Button>
            </Link>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
