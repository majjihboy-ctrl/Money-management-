-- MoneyFlow schema
-- Transaction ledger is source of truth. Balances are derived/reconciled.

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  preferred_name TEXT,
  country TEXT DEFAULT 'KE',
  timezone TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  default_currency TEXT NOT NULL DEFAULT 'KES',
  budget_period TEXT NOT NULL DEFAULT 'monthly' CHECK (budget_period IN ('weekly','monthly','custom')),
  salary_day INT CHECK (salary_day IS NULL OR (salary_day >= 1 AND salary_day <= 31)),
  hide_balances BOOLEAN NOT NULL DEFAULT false,
  biometric_enabled BOOLEAN NOT NULL DEFAULT false,
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash','bank','mobile_money','savings','credit_card','investment','other')),
  currency TEXT NOT NULL DEFAULT 'KES',
  opening_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  -- current_balance is a cached value; source of truth is transactions
  current_balance NUMERIC(18,2) NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  color TEXT,
  icon TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_accounts_user ON public.accounts(user_id) WHERE NOT is_archived;

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- null = system
  name TEXT NOT NULL,
  parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense','both')),
  icon TEXT,
  color TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_categories_user ON public.categories(user_id);

-- ============================================================
-- TRANSACTIONS (ledger — source of truth)
-- ============================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund','debt_payment')),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  to_account_id UUID REFERENCES public.accounts(id), -- transfers only
  category_id UUID REFERENCES public.categories(id),
  merchant TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  date DATE NOT NULL,
  time TIME,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_rule_id UUID,
  transfer_pair_id UUID, -- the counterpart transaction for transfers
  parent_transaction_id UUID REFERENCES public.transactions(id), -- splits
  is_split BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  reconciled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_account ON public.transactions(account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_category ON public.transactions(category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_type ON public.transactions(user_id, type) WHERE deleted_at IS NULL;

-- ============================================================
-- TRANSACTION SPLITS
-- ============================================================
CREATE TABLE public.transaction_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  amount NUMERIC(18,2) NOT NULL CHECK (amount > 0),
  notes TEXT
);

-- ============================================================
-- BUDGETS
-- ============================================================
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  period TEXT NOT NULL CHECK (period IN ('weekly','monthly','custom')),
  start_date DATE NOT NULL,
  end_date DATE,
  overall_limit NUMERIC(18,2),
  rollover_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.budget_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id),
  limit_amount NUMERIC(18,2) NOT NULL CHECK (limit_amount >= 0),
  rollover_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  UNIQUE (budget_id, category_id)
);

-- ============================================================
-- GOALS
-- ============================================================
CREATE TABLE public.goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount NUMERIC(18,2) NOT NULL CHECK (target_amount > 0),
  current_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'KES',
  target_date DATE,
  priority INT NOT NULL DEFAULT 0,
  linked_account_id UUID REFERENCES public.accounts(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','completed','paused','cancelled')),
  icon TEXT,
  color TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.goal_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- DEBTS
-- ============================================================
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('loan','credit_card','owed_to_me','owed_by_me','other')),
  principal NUMERIC(18,2) NOT NULL,
  current_balance NUMERIC(18,2) NOT NULL,
  interest_rate NUMERIC(8,4), -- annual %
  minimum_payment NUMERIC(18,2),
  due_day INT,
  start_date DATE,
  notes TEXT,
  linked_account_id UUID REFERENCES public.accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(18,2) NOT NULL,
  date DATE NOT NULL,
  principal_portion NUMERIC(18,2),
  interest_portion NUMERIC(18,2),
  notes TEXT,
  transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- BILLS & SUBSCRIPTIONS
-- ============================================================
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly','monthly','quarterly','yearly','custom')),
  due_day INT,
  next_due_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  account_id UUID REFERENCES public.accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  reminder_days INT NOT NULL DEFAULT 3,
  notes TEXT,
  last_paid_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','quarterly','yearly')),
  next_billing_date DATE NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- RECURRING RULES
-- ============================================================
CREATE TABLE public.recurring_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income','expense','transfer','refund','debt_payment')),
  amount NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  account_id UUID NOT NULL REFERENCES public.accounts(id),
  category_id UUID REFERENCES public.categories(id),
  merchant TEXT,
  frequency TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  next_run_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- ASSETS (manual valuations)
-- ============================================================
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  value NUMERIC(18,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  valuation_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- EXCHANGE RATES
-- ============================================================
CREATE TABLE public.exchange_rates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL,
  rate NUMERIC(18,8) NOT NULL,
  date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  UNIQUE (from_currency, to_currency, date)
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE public.audit_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_user ON public.audit_events(user_id, created_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Accounts
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Categories (system + own)
CREATE POLICY "Users see system and own categories" ON public.categories
  FOR SELECT USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Transactions
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Splits via transaction ownership (simplified — enforce in app + trigger preferred)
CREATE POLICY "Users manage own splits" ON public.transaction_splits
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.transactions t WHERE t.id = transaction_id AND t.user_id = auth.uid())
  );

-- Budgets
CREATE POLICY "Users manage own budgets" ON public.budgets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own budget categories" ON public.budget_categories
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.budgets b WHERE b.id = budget_id AND b.user_id = auth.uid())
  );

-- Goals
CREATE POLICY "Users manage own goals" ON public.goals
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own goal contributions" ON public.goal_contributions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.goals g WHERE g.id = goal_id AND g.user_id = auth.uid())
  );

-- Debts
CREATE POLICY "Users manage own debts" ON public.debts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debt payments" ON public.debt_payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.debts d WHERE d.id = debt_id AND d.user_id = auth.uid())
  );

-- Bills & subscriptions
CREATE POLICY "Users manage own bills" ON public.bills
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own subscriptions" ON public.subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Recurring
CREATE POLICY "Users manage own recurring rules" ON public.recurring_rules
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Assets
CREATE POLICY "Users manage own assets" ON public.assets
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Audit
CREATE POLICY "Users read own audit" ON public.audit_events
  FOR SELECT USING (auth.uid() = user_id);

-- Exchange rates are public read
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read rates" ON public.exchange_rates FOR SELECT USING (true);

-- ============================================================
-- HELPER: update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER accounts_updated BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER transactions_updated BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER budgets_updated BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER goals_updated BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER debts_updated BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER bills_updated BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER assets_updated BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- FUNCTION: create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, preferred_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNCTION: atomic transfer (creates paired transactions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_transfer(
  p_user_id UUID,
  p_from_account_id UUID,
  p_to_account_id UUID,
  p_amount NUMERIC,
  p_currency TEXT,
  p_date DATE,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_from_id UUID;
  v_to_id UUID;
  v_pair UUID := uuid_generate_v4();
BEGIN
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'Cannot transfer to the same account';
  END IF;
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive';
  END IF;

  -- Outgoing
  INSERT INTO public.transactions (id, user_id, type, amount, currency, account_id, to_account_id, date, notes, transfer_pair_id)
  VALUES (uuid_generate_v4(), p_user_id, 'transfer', p_amount, p_currency, p_from_account_id, p_to_account_id, p_date, p_notes, v_pair)
  RETURNING id INTO v_from_id;

  -- Incoming (paired)
  INSERT INTO public.transactions (id, user_id, type, amount, currency, account_id, to_account_id, date, notes, transfer_pair_id)
  VALUES (uuid_generate_v4(), p_user_id, 'transfer', p_amount, p_currency, p_to_account_id, p_from_account_id, p_date, p_notes, v_pair)
  RETURNING id INTO v_to_id;

  -- Update cached balances
  UPDATE public.accounts SET current_balance = current_balance - p_amount WHERE id = p_from_account_id AND user_id = p_user_id;
  UPDATE public.accounts SET current_balance = current_balance + p_amount WHERE id = p_to_account_id AND user_id = p_user_id;

  RETURN v_pair;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
-- Grants and small fixes for MoneyFlow
-- Safe to run after the init migration.

-- Allow authenticated users to call the transfer function
GRANT EXECUTE ON FUNCTION public.create_transfer(UUID, UUID, UUID, NUMERIC, TEXT, DATE, TEXT) TO authenticated;

-- Ensure profiles can be read/updated by owner (already have policy; reinforce SELECT)
-- (no-op if policy exists — run only if needed)

-- Helpful view: account balances should match ledger (optional reconciliation helper)
CREATE OR REPLACE FUNCTION public.recompute_account_balance(p_account_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_opening NUMERIC;
  v_user UUID;
  v_balance NUMERIC;
BEGIN
  SELECT opening_balance, user_id INTO v_opening, v_user
  FROM public.accounts WHERE id = p_account_id;

  IF v_user IS NULL OR v_user <> auth.uid() THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;

  SELECT COALESCE(v_opening, 0) + COALESCE(
    SUM(
      CASE
        WHEN type IN ('income', 'refund') THEN amount
        WHEN type IN ('expense', 'debt_payment') THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id AND to_account_id IS NOT NULL THEN -amount
        WHEN type = 'transfer' AND account_id = p_account_id THEN amount
        ELSE 0
      END
    ),
    0
  )
  INTO v_balance
  FROM public.transactions
  WHERE user_id = v_user
    AND deleted_at IS NULL
    AND (
      account_id = p_account_id
      OR to_account_id = p_account_id
    );

  -- For transfers the paired model stores two rows both with type transfer:
  -- outgoing: account_id = from, to_account_id = to, amount positive
  -- incoming: account_id = to, to_account_id = from, amount positive
  -- Simpler recompute from single-sided effect:
  SELECT COALESCE(v_opening, 0) + COALESCE((
    SELECT SUM(
      CASE
        WHEN t.type IN ('income', 'refund') AND t.account_id = p_account_id THEN t.amount
        WHEN t.type IN ('expense', 'debt_payment') AND t.account_id = p_account_id THEN -t.amount
        WHEN t.type = 'transfer' AND t.account_id = p_account_id THEN -t.amount
        ELSE 0
      END
    )
    FROM public.transactions t
    WHERE t.user_id = v_user AND t.deleted_at IS NULL AND t.account_id = p_account_id
  ), 0)
  INTO v_balance;

  UPDATE public.accounts SET current_balance = v_balance WHERE id = p_account_id;
  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.recompute_account_balance(UUID) TO authenticated;
