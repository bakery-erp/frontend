"use client";

import React, { useState, useMemo, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { useBranch } from "@/context/BranchContext";
import { useLanguage } from "@/context/LanguageContext";
import { api } from "@/lib/axios";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Search,
  Check,
  CheckSquare,
  Square,
  Save,
  ArrowLeft,
  ShieldCheck,
  ChefHat,
  SlidersHorizontal,
  Sparkles,
  Filter,
  Layers,
  Lock,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ConfirmModal from "@/components/ConfirmModal";

interface StockItemRoleData {
  id: string;
  name: string;
  nameLatin?: string | null;
  category?: string | null;
  categoryLatin?: string | null;
  unitType: string;
  currentQuantity: number | string;
  allowedRoles?: string[];
}

const PRODUCTION_ROLES = [
  {
    role: "ADMIN",
    label: "Branch Admin",
    shortLabel: "Admin",
    amharicLabel: "ቅርንጫፍ አስተዳዳሪ",
    icon: "🛡️",
    desc: "Branch administration, oversight, and inventory access",
    color: "from-blue-500/10 to-blue-600/5 border-blue-200 text-blue-900",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300",
  },
  {
    role: "BAKER",
    label: "Baker (Bread)",
    shortLabel: "Baker",
    amharicLabel: "ዳቦ ጋጋሪ",
    icon: "🥖",
    desc: "Daily bread, buns, rolls, and flour dough batches",
    color: "from-amber-500/10 to-amber-600/5 border-amber-200 text-amber-900",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
  },
  {
    role: "SAMBUSA_WORKER",
    label: "Sambusa & Snacks",
    shortLabel: "Sambusa",
    amharicLabel: "ሳምቡሳ ሠራተኛ",
    icon: "🥟",
    desc: "Sambusa, wraps, pizza, and quick snack stations",
    color: "from-orange-500/10 to-orange-600/5 border-orange-200 text-orange-900",
    badgeColor: "bg-orange-100 text-orange-900 border-orange-300",
  },
  {
    role: "CAKE_WORKER",
    label: "Cake & Pastry",
    shortLabel: "Cake",
    amharicLabel: "ኬክ ሠራተኛ",
    icon: "🎂",
    desc: "Birthday cakes, cream pastries, decorations, and sweets",
    color: "from-pink-500/10 to-pink-600/5 border-pink-200 text-pink-900",
    badgeColor: "bg-pink-100 text-pink-900 border-pink-300",
  },
];

export default function RoleMaterialsPage() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const { selectedBranchId, branches } = useBranch();
  const { t } = useLanguage();
  const queryClient = useQueryClient();

  const isOwner = user?.role === "OWNER";
  const [activeRole, setActiveRole] = useState<string>("ADMIN");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  // Selected Stock Item IDs for the currently active role
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState<boolean>(false);
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState<string | null>(null);

  // Fetch all stock items for current branch
  const { data: stockItems = [], isLoading, isRefetching } = useQuery<StockItemRoleData[]>({
    queryKey: ["role-materials", selectedBranchId],
    queryFn: async () => {
      const res = await api.get(`/stock-items/role-materials?branchId=${selectedBranchId}`);
      return res.data || [];
    },
    enabled: isOwner && !!selectedBranchId,
  });

  // When active role changes or stock items load, initialize selectedIds from backend state
  useEffect(() => {
    if (!stockItems || stockItems.length === 0) {
      setSelectedIds(new Set());
      setHasChanges(false);
      return;
    }

    const assigned = new Set<string>();
    for (const item of stockItems) {
      if (item.allowedRoles && item.allowedRoles.includes(activeRole)) {
        assigned.add(item.id);
      }
    }
    setSelectedIds(assigned);
    setHasChanges(false);
  }, [activeRole, stockItems]);

  // Extract distinct categories from stock items
  const categories = useMemo(() => {
    const set = new Set<string>();
    stockItems.forEach((item) => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });
    return Array.from(set).sort();
  }, [stockItems]);

  // Filter items by search query and category
  const filteredItems = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return stockItems.filter((item) => {
      const matchesCategory =
        selectedCategory === "ALL" ||
        (item.category && item.category.trim().toLowerCase() === selectedCategory.toLowerCase());

      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.nameLatin && item.nameLatin.toLowerCase().includes(q)) ||
        (item.category && item.category.toLowerCase().includes(q));

      return matchesCategory && matchesSearch;
    });
  }, [stockItems, searchQuery, selectedCategory]);

  // Count assigned items per role
  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of PRODUCTION_ROLES) {
      counts[r.role] = stockItems.filter(
        (item) => item.allowedRoles && item.allowedRoles.includes(r.role)
      ).length;
    }
    return counts;
  }, [stockItems]);

  // Toggle single item selection
  const handleToggleItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setHasChanges(true);
  };

  // Select all filtered items
  const handleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((i) => next.add(i.id));
      return next;
    });
    setHasChanges(true);
  };

  // Deselect all filtered items
  const handleDeselectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredItems.forEach((i) => next.delete(i.id));
      return next;
    });
    setHasChanges(true);
  };

  // Mutation to save changes to backend
  const saveMutation = useMutation({
    mutationFn: async () => {
      return await api.put("/stock-items/role-materials", {
        branchId: selectedBranchId,
        role: activeRole,
        stockItemIds: Array.from(selectedIds),
      });
    },
    onSuccess: () => {
      const roleObj = PRODUCTION_ROLES.find((r) => r.role === activeRole);
      toast.success(`Successfully saved stock material access for ${roleObj?.label || activeRole}`);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["role-materials", selectedBranchId] });
      queryClient.invalidateQueries({ queryKey: ["stock-items"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.error || "Failed to update role materials mapping");
    },
  });

  // Access Control: Owner Only
  if (!isAuthLoading && !isOwner) {
    return (
      <DashboardLayout>
        <div className="max-w-md mx-auto my-16 p-6 rounded-3xl bg-white border border-[#EDE4D5] shadow-sm text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-100 text-rose-800 flex items-center justify-center">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold text-[#2C1B10]">Owner Access Required</h2>
          <p className="text-sm text-[#8C7361]">
            Only the bakery Owner has permission to configure which raw materials are accessible by each production worker role.
          </p>
          <Button
            onClick={() => router.push("/stock")}
            className="w-full bg-[#E87A18] hover:bg-[#d06910] text-white rounded-xl font-bold"
          >
            Back to Stock
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const currentRoleMeta = PRODUCTION_ROLES.find((r) => r.role === activeRole) || PRODUCTION_ROLES[0];
  const activeBranchName = branches.find((b) => b.id === selectedBranchId)?.name || "Current Branch";

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-20">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Link
                href="/stock"
                className="w-8 h-8 rounded-xl bg-white border border-[#EDE4D5] flex items-center justify-center text-[#8C7361] hover:text-[#2C1B10] hover:bg-[#EDE4D5]/30 transition-colors"
                title="Back to Stock"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-200">
                  Owner Management
                </span>
                <span className="text-xs font-bold text-[#8C7361]">
                  • {activeBranchName}
                </span>
              </div>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#2C1B10] tracking-tight">
              Role Stock Materials Access
            </h1>
            <p className="text-xs sm:text-sm text-[#8C7361]">
              Select which raw materials each staff role can view and consume during daily operations.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !hasChanges}
              className={`rounded-xl font-bold text-xs sm:text-sm px-4 h-10 shadow-xs cursor-pointer flex items-center gap-1.5 transition-all ${
                hasChanges
                  ? "bg-[#E87A18] hover:bg-[#d06910] text-white animate-pulse"
                  : "bg-[#2C1B10] hover:bg-[#4A2E1B] text-white opacity-70"
              }`}
            >
              {saveMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span>{hasChanges ? `Save Changes (${selectedIds.size} Selected)` : "Saved"}</span>
            </Button>
          </div>
        </div>

        {/* Role Selector Cards / Tabs - Responsive 4-Column on Desktop / 2-Column on Mobile */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {PRODUCTION_ROLES.map((r) => {
            const isActive = activeRole === r.role;
            const count = roleCounts[r.role] || 0;
            return (
              <button
                key={r.role}
                type="button"
                onClick={() => {
                  if (hasChanges && activeRole !== r.role) {
                    setPendingRoleSwitch(r.role);
                  } else {
                    setActiveRole(r.role);
                  }
                }}
                className={`p-2.5 sm:p-4 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                  isActive
                    ? "bg-white border-[#E87A18] shadow-md ring-2 ring-[#E87A18]/20"
                    : "bg-white/80 border-[#EDE4D5] hover:bg-white hover:border-[#D8C7B5]"
                }`}
              >
                <div className="flex items-center justify-between mb-1 sm:mb-2">
                  <span className="text-xl sm:text-2xl">{r.icon}</span>
                  <span
                    className={`text-[9px] sm:text-[11px] font-extrabold px-1.5 sm:px-2 py-0.5 rounded-full border shrink-0 ${
                      isActive
                        ? "bg-[#E87A18] text-white border-[#E87A18]"
                        : "bg-[#FAF6F0] text-[#8C7361] border-[#EDE4D5]"
                    }`}
                  >
                    {count} <span className="hidden sm:inline">items</span>
                  </span>
                </div>
                <div>
                  <div className="font-extrabold text-xs sm:text-sm text-[#2C1B10] truncate">
                    <span className="sm:hidden">{r.shortLabel}</span>
                    <span className="hidden sm:inline">{r.label}</span>
                  </div>
                  <div className="text-[10px] sm:text-[11px] font-semibold text-[#8C7361] truncate">
                    {r.amharicLabel}
                  </div>
                </div>
                <p className="text-[11px] text-[#8C7361]/80 line-clamp-2 hidden sm:block mt-1">
                  {r.desc}
                </p>
              </button>
            );
          })}
        </div>

        {/* Main Mapping Workspace */}
        <div className="bg-white rounded-3xl border border-[#EDE4D5] shadow-xs p-4 sm:p-6 space-y-4">
          {/* Active Role Banner & Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-3.5 rounded-2xl bg-[#FAF6F0] border border-[#EDE4D5]">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <span className="text-2xl sm:text-3xl shrink-0">{currentRoleMeta.icon}</span>
              <div className="min-w-0">
                <h3 className="font-black text-sm sm:text-base text-[#2C1B10] truncate">
                  {currentRoleMeta.label} ({currentRoleMeta.amharicLabel})
                </h3>
                <p className="text-[11px] sm:text-xs text-[#8C7361]">
                  Has access to <strong className="text-[#2C1B10]">{selectedIds.size}</strong> of {stockItems.length} warehouse materials.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSelectAllFiltered}
                className="text-[11px] sm:text-xs font-bold border-[#EDE4D5] hover:bg-emerald-50 hover:text-emerald-800 hover:border-emerald-200 rounded-xl cursor-pointer h-8 px-2 sm:px-3 justify-center"
              >
                <CheckSquare className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">Select ({filteredItems.length})</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeselectAllFiltered}
                className="text-[11px] sm:text-xs font-bold border-[#EDE4D5] hover:bg-rose-50 hover:text-rose-800 hover:border-rose-200 rounded-xl cursor-pointer h-8 px-2 sm:px-3 justify-center"
              >
                <Square className="w-3.5 h-3.5 mr-1 shrink-0" />
                <span className="truncate">Clear</span>
              </Button>
            </div>
          </div>

          {/* Search & Category Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw materials by name or category..."
                className="pl-9 h-10 rounded-xl bg-zinc-50 border-zinc-200 text-sm focus:bg-white"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400 hover:text-zinc-600"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Pills Slider / Filter */}
            {categories.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("ALL")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                    selectedCategory === "ALL"
                      ? "bg-[#2C1B10] text-white"
                      : "bg-zinc-100 text-[#8C7361] hover:bg-zinc-200"
                  }`}
                >
                  All ({stockItems.length})
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold shrink-0 transition-colors cursor-pointer ${
                      selectedCategory === cat
                        ? "bg-[#2C1B10] text-white"
                        : "bg-zinc-100 text-[#8C7361] hover:bg-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Materials Checklist Grid */}
          {isLoading ? (
            <div className="py-16 text-center text-sm font-semibold text-[#8C7361] animate-pulse">
              Loading warehouse stock items...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center text-sm font-semibold text-[#8C7361] border border-dashed border-[#EDE4D5] rounded-2xl">
              No raw materials found matching your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {filteredItems.map((item) => {
                const isSelected = selectedIds.has(item.id);
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggleItem(item.id)}
                    className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none ${
                      isSelected
                        ? "bg-amber-50/70 border-amber-300 ring-1 ring-amber-300/40 shadow-2xs"
                        : "bg-white border-[#EDE4D5] hover:bg-[#FAF6F0] hover:border-[#D8C7B5]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${
                          isSelected
                            ? "bg-[#E87A18] text-white"
                            : "border border-zinc-300 bg-white"
                        }`}
                      >
                        {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="min-w-0">
                        <div className="font-extrabold text-xs sm:text-sm text-[#2C1B10] truncate">
                          {item.name}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-[#8C7361] font-medium flex-wrap">
                          {item.category && (
                            <span className="px-1.5 py-0.2 rounded bg-zinc-100 text-zinc-700">
                              {item.category}
                            </span>
                          )}
                          <span>
                            {item.currentQuantity} {item.unitType} in stock
                          </span>
                        </div>
                      </div>
                    </div>

                    {item.allowedRoles && item.allowedRoles.length > 0 && (
                      <span className="text-[10px] font-bold text-zinc-400 shrink-0">
                        {item.allowedRoles.length} role(s)
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Sticky Action Footer (when changes exist) */}
        {hasChanges && (
          <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-8 sm:w-96 p-4 rounded-2xl bg-[#2C1B10] text-white shadow-2xl border border-white/10 flex items-center justify-between gap-3 z-40 animate-in slide-in-from-bottom duration-200">
            <div>
              <div className="font-extrabold text-sm">Unsaved Permissions</div>
              <div className="text-xs text-[#EDE4D5]/80">
                {selectedIds.size} items assigned to {currentRoleMeta.label}
              </div>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="bg-[#E87A18] hover:bg-[#d06910] text-white rounded-xl font-bold text-xs h-9 px-4 shrink-0 shadow-md cursor-pointer"
            >
              {saveMutation.isPending ? "Saving..." : "Save Now"}
            </Button>
          </div>
        )}
        {/* Unsaved Changes Confirmation Popup Modal */}
        <ConfirmModal
          isOpen={!!pendingRoleSwitch}
          onClose={() => setPendingRoleSwitch(null)}
          onConfirm={() => {
            if (pendingRoleSwitch) {
              setActiveRole(pendingRoleSwitch);
              setPendingRoleSwitch(null);
            }
          }}
          title={t("common.unsavedChanges") || "Discard Unsaved Changes?"}
          description={`You have unsaved stock material changes for ${currentRoleMeta.label}. If you switch now, your unsaved changes will be discarded.`}
          confirmText={t("common.discard") || "Discard & Switch"}
          cancelText={t("common.keepEditing") || "Keep Editing"}
          variant="warning"
        />
      </div>
    </DashboardLayout>
  );
}
