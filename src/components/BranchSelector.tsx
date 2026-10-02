'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useBranch } from '@/context/BranchContext';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import {
  Store,
  Building2,
  MapPin,
  ChevronDown,
  Check,
  Search,
  Settings,
  Layers,
} from 'lucide-react';

interface BranchSelectorProps {
  variant?: 'header' | 'sidebar' | 'compact';
  className?: string;
}

export const BranchSelector: React.FC<BranchSelectorProps> = ({
  variant = 'header',
  className = '',
}) => {
  const router = useRouter();
  const { branches, selectedBranchId, setSelectedBranchId } = useBranch();
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isOwner = user?.role === 'OWNER';

  // Find active branch
  const activeBranch = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'ALL') return null;
    return branches.find((b) => b.id === selectedBranchId) || null;
  }, [branches, selectedBranchId]);

  // Non-owner display name
  const staffBranchName = useMemo(() => {
    if (user?.branch?.name && user.branch.name.trim() !== '.' && user.branch.name.trim() !== '') {
      return user.branch.name;
    }
    return t('common.mainBakery') || 'Main Bakery';
  }, [user, t]);

  // Filtered branches for search
  const filteredBranches = useMemo(() => {
    if (!searchQuery.trim()) return branches;
    const q = searchQuery.toLowerCase();
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.location && b.location.toLowerCase().includes(q))
    );
  }, [branches, searchQuery]);

  // Close on outside click & Escape
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (branchId: string | null) => {
    setSelectedBranchId(branchId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // For non-owners: elegant badge displaying assigned branch
  if (!isOwner) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs md:text-sm font-bold bg-[#F4ECE1]/90 text-[#4A2E1B] border border-[#E0D5C3] shadow-2xs select-none max-w-[150px] xs:max-w-[200px] md:max-w-none ${className}`}
        title={`${t('common.branch')}: ${staffBranchName}`}
      >
        <Store className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
        <span className="truncate">{staffBranchName}</span>
      </div>
    );
  }

  // Active branch title for owner
  const currentTitle = activeBranch ? activeBranch.name : t('dashboard.allBranches');

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-1.5 xs:gap-2 px-2.5 xs:px-3 py-1.5 rounded-xl text-xs md:text-sm font-bold bg-[#F4ECE1] hover:bg-[#EAE0D1] text-[#2C1B10] border border-[#E0D5C3] transition-all shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#E87A18] select-none"
        aria-haspopup="true"
        aria-expanded={isOpen}
      >
        <Store className="w-3.5 h-3.5 text-[#E87A18] shrink-0" />
        <span className="truncate max-w-[100px] xs:max-w-[140px] sm:max-w-[180px] md:max-w-none">
          {currentTitle}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[#8C7361] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 xs:left-auto xs:right-0 mt-2 w-[calc(100vw-2rem)] xs:w-72 sm:w-80 max-w-[340px] rounded-2xl bg-white shadow-xl border border-[#EDE4D5] py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150"
          role="menu"
        >
          {/* Header */}
          <div className="px-3.5 py-2 flex items-center justify-between border-b border-[#FAF6F0]">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#E87A18]" />
              <span className="text-xs font-extrabold text-[#2C1B10] tracking-tight">
                {t('common.selectBranch') || 'Select Branch'}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FAF6F0] text-[#8C7361] border border-[#EDE4D5]">
              {branches.length} {t('nav.branches') || 'Branches'}
            </span>
          </div>

          {/* Search box if more than 3 branches */}
          {branches.length > 3 && (
            <div className="p-2 border-b border-[#FAF6F0]">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#8C7361]" />
                <input
                  type="text"
                  placeholder={t('common.search') || 'Search...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FAF6F0]/60 border border-[#EDE4D5] rounded-xl text-[#2C1B10] placeholder-[#8C7361]/60 focus:outline-none focus:ring-1 focus:ring-[#E87A18]"
                />
              </div>
            </div>
          )}

          {/* Branch Options List */}
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1">
            {/* Option: All Branches (Consolidated) */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
              className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                selectedBranchId === null
                  ? 'bg-amber-50/80 border border-amber-200/60 shadow-2xs'
                  : 'hover:bg-[#FAF6F0] text-[#2C1B10]'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    selectedBranchId === null
                      ? 'bg-[#E87A18] text-white shadow-2xs'
                      : 'bg-[#FAF6F0] text-[#8C7361] border border-[#EDE4D5]'
                  }`}
                >
                  <Layers className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#2C1B10] truncate">
                    {t('dashboard.allBranches')}
                  </p>
                  <p className="text-[10px] text-[#8C7361] truncate">
                    {t('branches.allBranchesDesc') || 'Consolidated view across all branches'}
                  </p>
                </div>
              </div>
              {selectedBranchId === null && (
                <Check className="w-4 h-4 text-[#E87A18] shrink-0 ml-2" />
              )}
            </button>

            {/* Individual Branches */}
            {filteredBranches.map((b) => {
              const isSelected = selectedBranchId === b.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => handleSelect(b.id)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-amber-50/80 border border-amber-200/60 shadow-2xs'
                      : 'hover:bg-[#FAF6F0] text-[#2C1B10]'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#E87A18] text-white shadow-2xs'
                          : 'bg-[#FAF6F0] text-[#8C7361] border border-[#EDE4D5]'
                      }`}
                    >
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2C1B10] truncate">{b.name}</p>
                      <p className="text-[10px] text-[#8C7361] truncate">
                        {b.location || t('branches.activeStatus') || 'Active Branch'}
                      </p>
                    </div>
                  </div>
                  {isSelected && (
                    <Check className="w-4 h-4 text-[#E87A18] shrink-0 ml-2" />
                  )}
                </button>
              );
            })}

            {filteredBranches.length === 0 && (
              <div className="py-6 text-center text-xs text-[#8C7361]">
                {t('branches.noBranchesFound') || 'No branches found.'}
              </div>
            )}
          </div>

          {/* Footer: Manage Branches Shortcut */}
          <div className="pt-1 mt-1 border-t border-[#FAF6F0] px-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                router.push('/branches');
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-[#8C7361] hover:text-[#4A2E1B] hover:bg-[#FAF6F0] rounded-xl transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Settings className="w-3.5 h-3.5 text-[#E87A18]" />
                {t('branches.manageBranches') || 'Manage Branches'}
              </span>
              <span className="text-[10px] font-semibold text-[#8C7361] uppercase tracking-wider">
                →
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
