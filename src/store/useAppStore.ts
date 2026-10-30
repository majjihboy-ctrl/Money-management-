import { create } from 'zustand';
import type { Profile, Account, Transaction, Category, Budget, Goal, Debt, Bill, PeriodFilter } from '../types';

interface AppState {
  // Auth / profile
  session: any | null;
  profile: Profile | null;
  isLoading: boolean;
  isDemoMode: boolean;

  // Data
  accounts: Account[];
  transactions: Transaction[];
  categories: Category[];
  budgets: Budget[];
  goals: Goal[];
  debts: Debt[];
  bills: Bill[];

  // UI
  hideBalances: boolean;
  period: PeriodFilter;
  theme: 'light' | 'dark' | 'system';

  // Actions
  setSession: (s: any | null) => void;
  setProfile: (p: Profile | null) => void;
  setLoading: (v: boolean) => void;
  setDemoMode: (v: boolean) => void;
  setAccounts: (a: Account[]) => void;
  setTransactions: (t: Transaction[]) => void;
  setCategories: (c: Category[]) => void;
  setBudgets: (b: Budget[]) => void;
  setGoals: (g: Goal[]) => void;
  setDebts: (d: Debt[]) => void;
  setBills: (b: Bill[]) => void;
  setHideBalances: (v: boolean) => void;
  setPeriod: (p: PeriodFilter) => void;
  setTheme: (t: 'light' | 'dark' | 'system') => void;
  reset: () => void;
}

const initial = {
  session: null,
  profile: null,
  isLoading: true,
  isDemoMode: false,
  accounts: [],
  transactions: [],
  categories: [],
  budgets: [],
  goals: [],
  debts: [],
  bills: [],
  hideBalances: false,
  period: 'month' as PeriodFilter,
  theme: 'system' as const,
};

export const useAppStore = create<AppState>((set) => ({
  ...initial,
  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setDemoMode: (isDemoMode) => set({ isDemoMode }),
  setAccounts: (accounts) => set({ accounts }),
  setTransactions: (transactions) => set({ transactions }),
  setCategories: (categories) => set({ categories }),
  setBudgets: (budgets) => set({ budgets }),
  setGoals: (goals) => set({ goals }),
  setDebts: (debts) => set({ debts }),
  setBills: (bills) => set({ bills }),
  setHideBalances: (hideBalances) => set({ hideBalances }),
  setPeriod: (period) => set({ period }),
  setTheme: (theme) => set({ theme }),
  reset: () => set(initial),
}));
