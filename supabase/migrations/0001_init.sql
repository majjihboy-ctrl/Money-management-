-- =====================================================================
-- Money Manager Pro — 0001_init.sql
-- Money = bigint minor units (KES cents). Ledger is append/void only.
-- Every table is user-scoped with RLS. Composite FKs (id, user_id)
-- guarantee a row can only reference rows owned by the same user.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type account_type     as enum ('cash','bank','mobile_money','savings','other');
create type category_kind    as enum ('income','expense');
create type period_type      as enum ('daily','weekly','monthly','annual','custom');
create type goal_status      as enum ('active','paused','completed','archived');
create type goal_priority    as enum ('low','medium','high');
create type debt_direction   as enum ('payable','receivable');
create type debt_status      as enum ('active','paid','archived');
create type frequency        as enum ('daily','weekly','biweekly','monthly','quarterly','annual','custom');
create type occurrence_state as enum ('pending','posted','skipped');

-- ---------- helpers ----------
create function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

-- ---------- profiles ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_path text,
  currency char(3) not null default 'KES',
  timezone text not null default 'Africa/Nairobi',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  default_account_id uuid,
  default_budget_period period_type not null default 'monthly',
  warning_thresholds int[] not null default '{75,90,100}',
  notification_prefs jsonb not null default
    '{"daily_limit":true,"budget":true,"bills":true,"debts":true,"goals":true,"recurring":true,"high_spending":true}',
  privacy jsonb not null default '{"hide_balances":false}',
  allow_overdraft_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();

-- ---------- accounts ----------
create table accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 80),
  type account_type not null default 'cash',
  opening_balance_minor bigint not null default 0,
  allow_overdraft boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, name)
);
create trigger trg_accounts_updated before update on accounts for each row execute function set_updated_at();
alter table profiles add constraint fk_profiles_default_account foreign key (default_account_id) references accounts(id) on delete set null;

-- ---------- categories ----------
create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 60),
  kind category_kind not null,
  is_default boolean not null default false,
  color text,
  icon text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, kind, name)
);
create trigger trg_categories_updated before update on categories for each row execute function set_updated_at();

-- ---------- transfers (header; legs live in transactions) ----------
create table transfers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  occurred_at timestamptz not null default now(),
  description text,
  reference text not null default ('TRF-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,10))),
  idempotency_key text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  check (from_account_id <> to_account_id),
  foreign key (from_account_id, user_id) references accounts(id, user_id),
  foreign key (to_account_id, user_id)   references accounts(id, user_id)
);

-- ---------- recurring rules ----------
create table recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income','expense')),
  amount_minor bigint not null check (amount_minor > 0),
  category_id uuid,
  account_id uuid not null,
  counterparty text,
  frequency frequency not null,
  interval_count int not null default 1 check (interval_count between 1 and 365),
  start_date date not null,
  end_date date,
  next_due_date date,
  is_active boolean not null default true,
  is_essential boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date is null or end_date >= start_date),
  foreign key (account_id, user_id)  references accounts(id, user_id),
  foreign key (category_id, user_id) references categories(id, user_id)
);
create trigger trg_rules_updated before update on recurring_rules for each row execute function set_updated_at();

-- ---------- transactions (the ledger) ----------
create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  account_id uuid not null,
  kind text not null check (kind in
    ('income','expense','deposit','withdrawal','transfer_in','transfer_out','debt_payment','debt_collection')),
  amount_minor bigint not null check (amount_minor > 0),
  signed_amount_minor bigint generated always as (
    case when kind in ('income','deposit','transfer_in','debt_collection') then amount_minor else -amount_minor end
  ) stored,
  currency char(3) not null default 'KES',
  occurred_at timestamptz not null default now(),
  category_id uuid,
  counterparty text check (counterparty is null or length(counterparty) <= 120),  -- income source / merchant
  description text check (description is null or length(description) <= 300),
  notes text check (notes is null or length(notes) <= 2000),
  payment_method text check (payment_method is null or length(payment_method) <= 40),
  is_essential boolean,
  is_recurring boolean not null default false,
  recurring_rule_id uuid,
  transfer_id uuid,
  idempotency_key text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  unique (user_id, idempotency_key),
  foreign key (account_id, user_id)        references accounts(id, user_id),
  foreign key (category_id, user_id)       references categories(id, user_id),
  foreign key (recurring_rule_id, user_id) references recurring_rules(id, user_id),
  foreign key (transfer_id, user_id)       references transfers(id, user_id)
);
create index idx_txn_user_date  on transactions (user_id, occurred_at desc) where voided_at is null;
create index idx_txn_account    on transactions (account_id, occurred_at desc) where voided_at is null;
create index idx_txn_category   on transactions (user_id, category_id, occurred_at desc) where voided_at is null;
create index idx_txn_transfer   on transactions (transfer_id) where transfer_id is not null;
create trigger trg_txn_updated before update on transactions for each row execute function set_updated_at();

-- ---------- expense splits ----------
create table transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  category_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0),
  foreign key (transaction_id, user_id) references transactions(id, user_id) on delete cascade,
  foreign key (category_id, user_id)    references categories(id, user_id)
);
create index idx_splits_txn on transaction_splits (transaction_id);

create function check_split_sum() returns trigger language plpgsql as $$
declare v_tid uuid := coalesce(new.transaction_id, old.transaction_id); v_amt bigint; v_sum bigint;
begin
  select amount_minor into v_amt from transactions where id = v_tid;
  if v_amt is null then return null; end if;
  select coalesce(sum(amount_minor),0) into v_sum from transaction_splits where transaction_id = v_tid;
  if v_sum <> 0 and v_sum <> v_amt then
    raise exception 'Split total (%) must equal transaction amount (%)', v_sum, v_amt;
  end if;
  return null;
end $$;
create constraint trigger trg_split_sum after insert or update or delete on transaction_splits
  deferrable initially deferred for each row execute function check_split_sum();

-- ---------- attachments (files live in storage bucket "receipts") ----------
create table attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  transaction_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','application/pdf')),
  size_bytes int not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now(),
  foreign key (transaction_id, user_id) references transactions(id, user_id) on delete cascade
);

-- ---------- budgets ----------
create table budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  period period_type not null,
  category_id uuid,                       -- null = all expenses
  amount_minor bigint not null check (amount_minor > 0),
  start_date date not null,
  end_date date not null,
  thresholds int[] not null default '{75,90,100}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  check (end_date >= start_date),
  foreign key (category_id, user_id) references categories(id, user_id)
);
create trigger trg_budgets_updated before update on budgets for each row execute function set_updated_at();

-- ---------- daily spending plan ----------
create table spending_plans (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  mode text not null default 'manual' check (mode in ('manual','auto')),
  manual_daily_limit_minor bigint not null default 0 check (manual_daily_limit_minor >= 0),
  period period_type not null default 'monthly',
  period_start date,
  period_end date,
  deduct_bills boolean not null default true,
  deduct_savings boolean not null default true,
  deduct_debts boolean not null default true,
  extra_reserve_minor bigint not null default 0 check (extra_reserve_minor >= 0),
  include_account_ids uuid[],            -- null = all non-archived, non-savings accounts
  updated_at timestamptz not null default now()
);
create trigger trg_plans_updated before update on spending_plans for each row execute function set_updated_at();

-- ---------- savings goals (earmarks, not money) ----------
create table savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  target_minor bigint not null check (target_minor > 0),
  target_date date,
  priority goal_priority not null default 'medium',
  status goal_status not null default 'active',
  linked_account_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  foreign key (linked_account_id, user_id) references accounts(id, user_id)
);
create trigger trg_goals_updated before update on savings_goals for each row execute function set_updated_at();

create table savings_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  goal_id uuid not null,
  entry_type text not null check (entry_type in ('contribution','withdrawal')),
  amount_minor bigint not null check (amount_minor > 0),
  occurred_at timestamptz not null default now(),
  note text,
  transfer_id uuid,
  idempotency_key text,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  foreign key (goal_id, user_id)     references savings_goals(id, user_id),
  foreign key (transfer_id, user_id) references transfers(id, user_id)
);
create index idx_savings_goal on savings_entries (goal_id, occurred_at desc);

-- ---------- debts ----------
create table debts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  direction debt_direction not null,
  counterparty text not null,
  original_minor bigint not null check (original_minor > 0),
  outstanding_minor bigint not null check (outstanding_minor >= 0),
  interest_rate_bps int check (interest_rate_bps is null or interest_rate_bps between 0 and 100000),
  min_payment_minor bigint check (min_payment_minor is null or min_payment_minor >= 0),
  payment_frequency frequency,
  start_date date,
  due_date date,
  priority int not null default 0,        -- custom strategy ordering (lower = first)
  status debt_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create trigger trg_debts_updated before update on debts for each row execute function set_updated_at();

create table debt_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  debt_id uuid not null,
  transaction_id uuid,
  principal_minor bigint not null check (principal_minor >= 0),
  interest_minor bigint not null default 0 check (interest_minor >= 0),
  fees_minor bigint not null default 0 check (fees_minor >= 0),
  paid_on date not null,
  note text,
  idempotency_key text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, idempotency_key),
  check (principal_minor + interest_minor + fees_minor > 0),
  foreign key (debt_id, user_id)        references debts(id, user_id),
  foreign key (transaction_id, user_id) references transactions(id, user_id)
);

-- ---------- recurring occurrences (idempotent via unique key) ----------
create table recurring_occurrences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  rule_id uuid not null,
  due_date date not null,
  state occurrence_state not null default 'pending',
  transaction_id uuid,
  created_at timestamptz not null default now(),
  unique (rule_id, due_date),
  foreign key (rule_id, user_id)        references recurring_rules(id, user_id) on delete cascade,
  foreign key (transaction_id, user_id) references transactions(id, user_id)
);

-- ---------- notifications ----------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  link text,
  dedupe_key text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index idx_notif_unread on notifications (user_id, created_at desc) where read_at is null;

-- ---------- audit log (insert via trigger only; immutable to users) ----------
create table audit_log (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  table_name text not null,
  row_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  at timestamptz not null default now()
);
create index idx_audit_user on audit_log (user_id, at desc);

create function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
        v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
begin
  insert into audit_log (user_id, table_name, row_id, action, old_data, new_data)
  values (coalesce((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid), tg_table_name,
          coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid), tg_op, v_old, v_new);
  return null;
end $$;
create trigger aud_transactions after insert or update or delete on transactions for each row execute function audit_row();
create trigger aud_accounts     after insert or update or delete on accounts     for each row execute function audit_row();
create trigger aud_budgets      after insert or update or delete on budgets      for each row execute function audit_row();
create trigger aud_debts        after insert or update or delete on debts        for each row execute function audit_row();

-- ---------- balances & progress views ----------
create view account_balances with (security_invoker = true) as
select a.id as account_id, a.user_id,
       a.opening_balance_minor + coalesce(sum(t.signed_amount_minor) filter (where t.voided_at is null), 0) as balance_minor
from accounts a left join transactions t on t.account_id = a.id
group by a.id;

create view goal_progress with (security_invoker = true) as
select g.id as goal_id, g.user_id, g.target_minor,
       coalesce(sum(case e.entry_type when 'contribution' then e.amount_minor else -e.amount_minor end), 0) as current_minor
from savings_goals g left join savings_entries e on e.goal_id = g.id
group by g.id;

-- ---------- overdraft guard (serialised per account) ----------
create function enforce_no_overdraft() returns trigger language plpgsql as $$
declare v_allow boolean; v_bal bigint;
begin
  if tg_op = 'UPDATE' and old.account_id = new.account_id and old.signed_amount_minor = new.signed_amount_minor
     and (old.voided_at is null) = (new.voided_at is null) then
    return null;
  end if;
  select allow_overdraft into v_allow from accounts where id = new.account_id for update;
  if v_allow then return null; end if;
  select balance_minor into v_bal from account_balances where account_id = new.account_id;
  if v_bal < 0 then
    raise exception 'Insufficient funds: this would overdraw the account' using errcode = 'check_violation';
  end if;
  return null;
end $$;
create trigger trg_txn_overdraft after insert or update on transactions for each row execute function enforce_no_overdraft();

-- ---------- atomic operations ----------
create function create_transfer(p_from uuid, p_to uuid, p_amount bigint, p_occurred timestamptz,
                                p_description text default null, p_idem text default null)
returns uuid language plpgsql as $$
declare v_user uuid := auth.uid(); v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_from = p_to then raise exception 'Cannot transfer to the same account'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_idem is not null then
    select id into v_id from transfers where user_id = v_user and idempotency_key = p_idem;
    if found then return v_id; end if;
  end if;
  insert into transfers (user_id, from_account_id, to_account_id, amount_minor, occurred_at, description, idempotency_key)
  values (v_user, p_from, p_to, p_amount, coalesce(p_occurred, now()), p_description, p_idem) returning id into v_id;
  insert into transactions (user_id, account_id, kind, amount_minor, occurred_at, description, transfer_id)
  values (v_user, p_from, 'transfer_out', p_amount, coalesce(p_occurred, now()), p_description, v_id),
         (v_user, p_to,   'transfer_in',  p_amount, coalesce(p_occurred, now()), p_description, v_id);
  return v_id;
end $$;

create function void_transaction(p_id uuid, p_reason text default null) returns void language plpgsql as $$
declare v_t transactions%rowtype;
begin
  select * into v_t from transactions where id = p_id and user_id = auth.uid() and voided_at is null for update;
  if not found then raise exception 'Transaction not found or already voided'; end if;
  if v_t.transfer_id is not null then
    update transactions set voided_at = now(), void_reason = p_reason where transfer_id = v_t.transfer_id and voided_at is null;
    update transfers set voided_at = now() where id = v_t.transfer_id;
  else
    update transactions set voided_at = now(), void_reason = p_reason where id = p_id;
  end if;
  -- reverse debt effect
  update debts d set outstanding_minor = d.outstanding_minor + dp.principal_minor,
                     status = case when d.status = 'paid' then 'active' else d.status end
  from debt_payments dp where dp.transaction_id = p_id and dp.voided_at is null and dp.debt_id = d.id;
  update debt_payments set voided_at = now() where transaction_id = p_id and voided_at is null;
  update recurring_occurrences set state = 'pending', transaction_id = null where transaction_id = p_id;
end $$;

create function record_debt_payment(p_debt uuid, p_account uuid, p_principal bigint, p_interest bigint,
                                    p_fees bigint, p_paid_on date, p_note text default null, p_idem text default null)
returns uuid language plpgsql as $$
declare v_user uuid := auth.uid(); v_debt debts%rowtype; v_txn uuid; v_id uuid; v_total bigint;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_idem is not null then
    select id into v_id from debt_payments where user_id = v_user and idempotency_key = p_idem;
    if found then return v_id; end if;
  end if;
  select * into v_debt from debts where id = p_debt and user_id = v_user for update;
  if not found then raise exception 'Debt not found'; end if;
  if v_debt.status <> 'active' then raise exception 'Debt is not active'; end if;
  p_principal := coalesce(p_principal,0); p_interest := coalesce(p_interest,0); p_fees := coalesce(p_fees,0);
  if p_principal > v_debt.outstanding_minor then raise exception 'Principal exceeds outstanding balance'; end if;
  v_total := p_principal + p_interest + p_fees;
  if v_total <= 0 then raise exception 'Payment must be positive'; end if;
  insert into transactions (user_id, account_id, kind, amount_minor, occurred_at, description, counterparty)
  values (v_user, p_account,
          case v_debt.direction when 'payable' then 'debt_payment' else 'debt_collection' end,
          v_total, p_paid_on::timestamptz, coalesce(p_note, 'Debt: ' || v_debt.counterparty), v_debt.counterparty)
  returning id into v_txn;
  insert into debt_payments (user_id, debt_id, transaction_id, principal_minor, interest_minor, fees_minor, paid_on, note, idempotency_key)
  values (v_user, p_debt, v_txn, p_principal, p_interest, p_fees, p_paid_on, p_note, p_idem) returning id into v_id;
  update debts set outstanding_minor = outstanding_minor - p_principal,
                   status = case when outstanding_minor - p_principal = 0 then 'paid' else status end
  where id = p_debt;
  return v_id;
end $$;

create function record_savings_entry(p_goal uuid, p_type text, p_amount bigint, p_occurred timestamptz,
                                     p_note text default null, p_account uuid default null, p_idem text default null)
returns uuid language plpgsql as $$
declare v_user uuid := auth.uid(); v_goal savings_goals%rowtype; v_cur bigint; v_tr uuid; v_id uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_type not in ('contribution','withdrawal') then raise exception 'Invalid entry type'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be positive'; end if;
  if p_idem is not null then
    select id into v_id from savings_entries where user_id = v_user and idempotency_key = p_idem;
    if found then return v_id; end if;
  end if;
  select * into v_goal from savings_goals where id = p_goal and user_id = v_user for update;
  if not found then raise exception 'Goal not found'; end if;
  if v_goal.status in ('completed','archived') then raise exception 'Goal is %', v_goal.status; end if;
  if p_type = 'withdrawal' then
    select current_minor into v_cur from goal_progress where goal_id = p_goal;
    if p_amount > v_cur then raise exception 'Withdrawal exceeds saved amount'; end if;
  end if;
  -- Real money only moves when the goal is linked to an account AND a counter account is given (as a transfer).
  if v_goal.linked_account_id is not null and p_account is not null then
    v_tr := case p_type
      when 'contribution' then create_transfer(p_account, v_goal.linked_account_id, p_amount, p_occurred, coalesce(p_note, 'Savings: ' || v_goal.name))
      else create_transfer(v_goal.linked_account_id, p_account, p_amount, p_occurred, coalesce(p_note, 'Savings: ' || v_goal.name))
    end;
  end if;
  insert into savings_entries (user_id, goal_id, entry_type, amount_minor, occurred_at, note, transfer_id, idempotency_key)
  values (v_user, p_goal, p_type, p_amount, coalesce(p_occurred, now()), p_note, v_tr, p_idem) returning id into v_id;
  return v_id;
end $$;

-- ---------- recurring: generate pending occurrences, post idempotently ----------
create function occurrence_date(p_start date, p_freq frequency, p_n int, p_every int) returns date
language sql immutable as $$
  select case p_freq
    when 'daily'     then p_start + (p_n * p_every)
    when 'weekly'    then p_start + (7  * p_n * p_every)
    when 'biweekly'  then p_start + (14 * p_n * p_every)
    when 'monthly'   then (p_start + make_interval(months => p_n * p_every))::date
    when 'quarterly' then (p_start + make_interval(months => 3 * p_n * p_every))::date
    when 'annual'    then (p_start + make_interval(years  => p_n * p_every))::date
    else                  p_start + (p_n * p_every)
  end $$;

create function generate_occurrences(p_until date) returns int language plpgsql as $$
declare r recurring_rules%rowtype; n int; d date; v_count int := 0; v_rows int;
begin
  for r in select * from recurring_rules where user_id = auth.uid() and is_active loop
    n := 0;
    loop
      d := occurrence_date(r.start_date, r.frequency, n, r.interval_count);
      exit when d > p_until or (r.end_date is not null and d > r.end_date) or n > 3650;
      insert into recurring_occurrences (user_id, rule_id, due_date) values (r.user_id, r.id, d)
        on conflict (rule_id, due_date) do nothing;
      get diagnostics v_rows = row_count; v_count := v_count + v_rows;
      n := n + 1;
    end loop;
    update recurring_rules set next_due_date =
      (select min(due_date) from recurring_occurrences where rule_id = r.id and state = 'pending')
    where id = r.id;
  end loop;
  return v_count;
end $$;

create function post_occurrence(p_occurrence uuid, p_amount bigint default null, p_account uuid default null)
returns uuid language plpgsql as $$
declare v_user uuid := auth.uid(); o recurring_occurrences%rowtype; r recurring_rules%rowtype; v_txn uuid;
begin
  select * into o from recurring_occurrences where id = p_occurrence and user_id = v_user for update;
  if not found then raise exception 'Occurrence not found'; end if;
  if o.state = 'posted' then return o.transaction_id; end if;         -- idempotent
  select * into r from recurring_rules where id = o.rule_id;
  insert into transactions (user_id, account_id, kind, amount_minor, occurred_at, category_id, counterparty,
                            description, is_essential, is_recurring, recurring_rule_id, idempotency_key)
  values (v_user, coalesce(p_account, r.account_id), r.kind, coalesce(p_amount, r.amount_minor), o.due_date::timestamptz,
          r.category_id, r.counterparty, r.name, r.is_essential, true, r.id, 'occ:' || o.id)
  on conflict (user_id, idempotency_key) do nothing
  returning id into v_txn;
  if v_txn is null then select id into v_txn from transactions where user_id = v_user and idempotency_key = 'occ:' || o.id; end if;
  update recurring_occurrences set state = 'posted', transaction_id = v_txn where id = o.id;
  update recurring_rules set next_due_date =
    (select min(due_date) from recurring_occurrences where rule_id = r.id and state = 'pending') where id = r.id;
  return v_txn;
end $$;

-- ---------- signup seeding ----------
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_acc uuid;
begin
  insert into profiles (id, full_name) values (new.id, new.raw_user_meta_data->>'full_name');
  insert into categories (user_id, name, kind, is_default)
  select new.id, n, 'income', true from unnest(array['Salary','Business Income','Freelancing','Online Income',
    'Trading Income','Rental Income','Investment Income','Gifts','Allowance','Refunds','Other Income']) n;
  insert into categories (user_id, name, kind, is_default)
  select new.id, n, 'expense', true from unnest(array['Food','Transport','Rent','Electricity','Water','Internet',
    'Airtime','Shopping','Clothing','Education','Health','Entertainment','Subscriptions','Family Support',
    'Personal Care','Business Expenses','Bank Charges','Debt Repayment','Other Expenses']) n;
  insert into accounts (user_id, name, type) values (new.id, 'Cash', 'cash') returning id into v_acc;
  update profiles set default_account_id = v_acc where id = new.id;
  insert into spending_plans (user_id) values (new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- Row Level Security ----------
do $$
declare t text;
begin
  -- full CRUD on own rows
  foreach t in array array['accounts','categories','recurring_rules','recurring_occurrences','budgets',
                           'savings_goals','notifications','spending_plans','attachments','transaction_splits'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_select on %I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy own_insert on %I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy own_update on %I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
    execute format('create policy own_delete on %I for delete to authenticated using (user_id = auth.uid())', t);
  end loop;
  -- ledger-style tables: no direct DELETE (void instead)
  foreach t in array array['transactions','transfers','savings_entries','debts','debt_payments'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own_select on %I for select to authenticated using (user_id = auth.uid())', t);
    execute format('create policy own_insert on %I for insert to authenticated with check (user_id = auth.uid())', t);
    execute format('create policy own_update on %I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

alter table profiles enable row level security;
create policy own_select on profiles for select to authenticated using (id = auth.uid());
create policy own_update on profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

alter table audit_log enable row level security;
create policy own_select on audit_log for select to authenticated using (user_id = auth.uid());

-- Functions run as invoker (RLS applies). Lock down execution to signed-in users.
revoke all on function create_transfer, void_transaction, record_debt_payment, record_savings_entry,
  generate_occurrences, post_occurrence from public, anon;
grant execute on function create_transfer, void_transaction, record_debt_payment, record_savings_entry,
  generate_occurrences, post_occurrence to authenticated;

-- ---------- storage ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('receipts','receipts', false, 5242880, array['image/jpeg','image/png','image/webp','application/pdf']),
  ('avatars','avatars',  false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "own files read"   on storage.objects for select to authenticated
  using (bucket_id in ('receipts','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files write"  on storage.objects for insert to authenticated
  with check (bucket_id in ('receipts','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files update" on storage.objects for update to authenticated
  using (bucket_id in ('receipts','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own files delete" on storage.objects for delete to authenticated
  using (bucket_id in ('receipts','avatars') and (storage.foldername(name))[1] = auth.uid()::text);
