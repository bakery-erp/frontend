'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { api } from '@/lib/axios';

export interface Branch {
  id: string;
  name: string;
  location?: string;
  phone?: string;
}

interface BranchContextType {
  branches: Branch[];
  selectedBranchId: string | null; // null means 'ALL' branches for OWNER
  setSelectedBranchId: (id: string | null) => void;
  isLoadingBranches: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState<Branch[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('erp_branches');
        return stored ? JSON.parse(stored) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [isLoadingBranches, setIsLoadingBranches] = useState(false);

  useEffect(() => {
    if (!user) return;

    if (user.role === 'OWNER') {
      // Owner can see all branches or select a specific branch
      const savedBranch = localStorage.getItem('selectedBranchId');
      setSelectedBranchIdState(savedBranch === 'ALL' || !savedBranch ? null : savedBranch);

      const fetchBranches = async () => {
        if (branches.length === 0) setIsLoadingBranches(true);
        try {
          const { data } = await api.get<Branch[]>('/branches');
          setBranches(data);
          try {
            localStorage.setItem('erp_branches', JSON.stringify(data));
          } catch {}
          if (savedBranch && savedBranch !== 'ALL') {
            const exists = Array.isArray(data) && data.some((b) => b.id === savedBranch);
            if (!exists) {
              localStorage.removeItem('selectedBranchId');
              setSelectedBranchIdState(null);
            }
          }
        } catch (e) {
          console.error('Failed to fetch branches:', e);
        } finally {
          setIsLoadingBranches(false);
        }
      };
      fetchBranches();
    } else {
      // Admin / Staff locked to their assigned branchId
      setSelectedBranchIdState(user.branchId || null);
      if (user.branch) {
        setBranches([user.branch]);
      }
    }
  }, [user]);

  const setSelectedBranchId = (id: string | null) => {
    setSelectedBranchIdState(id);
    if (id === null) {
      localStorage.setItem('selectedBranchId', 'ALL');
    } else {
      localStorage.setItem('selectedBranchId', id);
    }
  };

  return (
    <BranchContext.Provider value={{ branches, selectedBranchId, setSelectedBranchId, isLoadingBranches }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (context === undefined) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
};
