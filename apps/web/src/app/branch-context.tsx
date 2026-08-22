import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { BranchResponse } from "@fitos/contracts";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api/client";

const STORAGE_KEY = "fitos_active_branch_id";

interface BranchContextValue {
  branches: BranchResponse[];
  activeBranchId: string;
  activeBranch: BranchResponse | undefined;
  setActiveBranch: (id: string) => void;
  isLoading: boolean;
}

const BranchContext = createContext<BranchContextValue>({
  branches: [],
  activeBranchId: "",
  activeBranch: undefined,
  setActiveBranch: () => {},
  isLoading: true
});

export function BranchProvider({ children }: { children: React.ReactNode }) {
  const [activeBranchId, setActiveBranchIdState] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const { data: branches = [], isLoading } = useQuery({
    queryKey: ["branches"],
    queryFn: api.branches,
    staleTime: 5 * 60 * 1000
  });

  // Once branches load, ensure activeBranchId is valid
  useEffect(() => {
    if (!isLoading && branches.length > 0) {
      const valid = branches.find((b) => b.id === activeBranchId);
      if (!valid) {
        const first = branches[0];
        if (first) {
          setActiveBranchIdState(first.id);
          try { localStorage.setItem(STORAGE_KEY, first.id); } catch { /* noop */ }
        }
      }
    }
  }, [branches, isLoading, activeBranchId]);

  const setActiveBranch = useCallback((id: string) => {
    setActiveBranchIdState(id);
    try { localStorage.setItem(STORAGE_KEY, id); } catch { /* noop */ }
  }, []);

  const activeBranch = branches.find((b) => b.id === activeBranchId);

  return (
    <BranchContext.Provider
      value={{ branches, activeBranchId, activeBranch, setActiveBranch, isLoading }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  return useContext(BranchContext);
}
