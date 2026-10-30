/** MoneyFlow core domain types. All monetary amounts stored as string decimals (e.g. "1234.56") */

export type CurrencyCode = 'KES' | 'USD' | 'EUR' | 'GBP' | 'UGX' | 'TZS' | 'NGN' | 'ZAR' | string;

export type TransactionType = 'income' | 'expense' | 'transfer' | 'refund' | 'debt_payment';

export type AccountType =
  | 'cash'
  | 'bank'
  | 'mobile_money'
  | 'savings'
  | 'credit_card'
  | 'investment'
  | 'other';

export type BudgetPeriod = 'weekly' | 'monthly' | 'custom';

export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

export type DebtType = 'loan' | 'credit_card' | 'owed_to_me' | 'owed_by_me' | 'other';

export type BillFrequency = 'weekly' | 'monthly' | 'quarterly' | 'yearly' | 'custom';

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  preferred_name: string | null;
  country: string | null;
  timezone: string;
  default_currency: CurrencyCode;
  budget_period: BudgetPeriod;
  salary_day: number | null; // 1-31
  hide_balances: boolean;
  biometric_enabled: boolean;
  onboarding_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  opening_balance: string; // decimal string
  current_balance: string; // computed or cached with reconciliation
  is_archived: boolean;
  color: string | null;
  icon: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  user_id: string | null; // null = system default
  name: string;
  parent_id: string | null;
  type: 'income' | 'expense' | 'both';
  icon: string | null;
  color: string | null;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string; // always positive; sign derived from type
  currency: CurrencyCode;
  account_id: string;
  to_account_id: string | null; // for transfers
  category_id: string | null;
  merchant: string | null;
  notes: string | null;
  tags: string[];
  date: string; // ISO date (YYYY-MM-DD)
  time: string | null; // HH:mm:ss
  is_recurring: boolean;
  recurring_rule_id: string | null;
  transfer_pair_id: string | null; // links the paired transfer record
  parent_transaction_id: string | null; // for splits
  is_split: boolean;
  attachment_url: string | null;
  reconciled: boolean;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface TransactionSplit {
  id: string;
  transaction_id: string;
  category_id: string;
  amount: string;
  notes: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  period: BudgetPeriod;
  start_date: string;
  end_date: string | null;
  overall_limit: string | null;
  rollover_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  budget_id: string;
  category_id: string;
  limit_amount: string;
  spent: string; // computed
  rollover_amount: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target_amount: string;
  current_amount: string;
  currency: CurrencyCode;
  target_date: string | null;
  priority: number;
  linked_account_id: string | null;
  status: GoalStatus;
  icon: string | null;
  color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: string;
  date: string;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  type: DebtType;
  principal: string;
  current_balance: string;
  interest_rate: string | null; // annual %
  minimum_payment: string | null;
  due_day: number | null;
  start_date: string | null;
  notes: string | null;
  linked_account_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: string;
  date: string;
  principal_portion: string | null;
  interest_portion: string | null;
  notes: string | null;
  transaction_id: string | null;
  created_at: string;
}

export interface Bill {
  id: string;
  user_id: string;
  name: string;
  amount: string;
  currency: CurrencyCode;
  frequency: BillFrequency;
  due_day: number | null; // day of month/week
  next_due_date: string;
  category_id: string | null;
  account_id: string | null;
  is_active: boolean;
  reminder_days: number;
  notes: string | null;
  last_paid_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  amount: string;
  currency: CurrencyCode;
  frequency: RecurringFrequency;
  next_billing_date: string;
  category_id: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: string;
  currency: CurrencyCode;
  account_id: string;
  category_id: string | null;
  merchant: string | null;
  frequency: RecurringFrequency;
  start_date: string;
  end_date: string | null;
  next_run_date: string;
  is_active: boolean;
  created_at: string;
}

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  type: string;
  value: string;
  currency: CurrencyCode;
  valuation_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExchangeRate {
  id: string;
  from_currency: CurrencyCode;
  to_currency: CurrencyCode;
  rate: string;
  date: string;
  source: string;
}

export interface AuditEvent {
  id: string;
  user_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

export type PeriodFilter = 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface DashboardSummary {
  totalBalance: string;
  periodIncome: string;
  periodExpense: string;
  availableToSpend: string;
  savingsTotal: string;
  budgetRemaining: string;
  budgetUsedPercent: number;
  upcomingBills: Bill[];
  recentTransactions: Transaction[];
  spendingByCategory: { categoryId: string; name: string; amount: string; color: string }[];
  outstandingDebt: string;
}
