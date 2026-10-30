export type Profile = {
  id: string; full_name: string | null; avatar_path: string | null; currency: string; timezone: string;
  theme: 'light' | 'dark' | 'system'; default_account_id: string | null; default_budget_period: string;
  warning_thresholds: number[]; notification_prefs: Record<string, boolean>; privacy: { hide_balances?: boolean };
};
export type Account = { id: string; name: string; type: 'cash' | 'bank' | 'mobile_money' | 'savings' | 'other'; opening_balance_minor: number; allow_overdraft: boolean; archived_at: string | null };
export type Category = { id: string; name: string; kind: 'income' | 'expense'; is_default: boolean; archived_at: string | null };
export type Split = { category_id: string; amount_minor: number };
export type Txn = {
  id: string; account_id: string; kind: 'income' | 'expense' | 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'debt_payment' | 'debt_collection';
  amount_minor: number; signed_amount_minor: number; occurred_at: string; category_id: string | null; counterparty: string | null;
  description: string | null; notes: string | null; payment_method: string | null; is_essential: boolean | null; is_recurring: boolean;
  transfer_id: string | null; transaction_splits?: Split[];
};
export type Budget = { id: string; name: string; period: string; category_id: string | null; amount_minor: number; start_date: string; end_date: string; thresholds: number[]; is_active: boolean };
export type BudgetView = Budget & { spent: number; pct: number; status: BudgetStatus };
export type BudgetStatus = 'On Track' | 'Warning' | 'Near Limit' | 'Exceeded';
export type Goal = { id: string; name: string; description: string | null; target_minor: number; target_date: string | null; priority: 'low' | 'medium' | 'high'; status: 'active' | 'paused' | 'completed' | 'archived'; linked_account_id: string | null };
export type Debt = { id: string; direction: 'payable' | 'receivable'; counterparty: string; original_minor: number; outstanding_minor: number; interest_rate_bps: number | null; min_payment_minor: number | null; payment_frequency: string | null; start_date: string | null; due_date: string | null; priority: number; status: 'active' | 'paid' | 'archived'; notes: string | null };
export type Rule = { id: string; name: string; kind: 'income' | 'expense'; amount_minor: number; category_id: string | null; account_id: string; counterparty: string | null; frequency: string; interval_count: number; start_date: string; end_date: string | null; next_due_date: string | null; is_active: boolean; is_essential: boolean };
export type Occurrence = { id: string; rule_id: string; due_date: string; state: 'pending' | 'posted' | 'skipped'; transaction_id: string | null };
export type Notif = { id: string; kind: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string };
export type Plan = { user_id: string; mode: 'manual' | 'auto'; manual_daily_limit_minor: number; period: string; period_start: string | null; period_end: string | null; deduct_bills: boolean; deduct_savings: boolean; deduct_debts: boolean; extra_reserve_minor: number };
