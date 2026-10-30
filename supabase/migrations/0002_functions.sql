-- 0002: atomic save_transaction (with splits) + debt-payment default category
create function enforce_txn_defaults() returns trigger language plpgsql as $$
begin
  if new.kind = 'debt_payment' and new.category_id is null then
    select id into new.category_id from categories
     where user_id = new.user_id and kind = 'expense' and name = 'Debt Repayment' limit 1;
  end if;
  return new;
end $$;
create trigger trg_txn_defaults before insert on transactions for each row execute function enforce_txn_defaults();

create function save_transaction(p jsonb, p_splits jsonb default '[]'::jsonb) returns uuid
language plpgsql as $$
declare
  v_user uuid := auth.uid();
  v_id uuid := (p->>'id')::uuid;
  v_kind text := p->>'kind';
  v_amount bigint := (p->>'amount_minor')::bigint;
  v_cat uuid := nullif(p->>'category_id','')::uuid;
  v_cat_kind category_kind;
  v_old transactions%rowtype;
  v_sum bigint;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if v_kind not in ('income','expense','deposit','withdrawal') then raise exception 'Invalid transaction type'; end if;
  if v_amount is null or v_amount <= 0 then raise exception 'Amount must be greater than zero'; end if;
  if v_cat is not null and v_kind in ('income','expense') then
    select kind into v_cat_kind from categories where id = v_cat and user_id = v_user;
    if v_cat_kind is null or v_cat_kind::text <> v_kind then raise exception 'Category does not match transaction type'; end if;
  end if;

  select * into v_old from transactions where id = v_id and user_id = v_user for update;
  if found then
    if v_old.voided_at is not null or v_old.transfer_id is not null or v_old.kind <> v_kind then
      raise exception 'This transaction cannot be edited';
    end if;
    update transactions set
      account_id = (p->>'account_id')::uuid, amount_minor = v_amount,
      occurred_at = (p->>'occurred_at')::timestamptz, category_id = v_cat,
      counterparty = nullif(p->>'counterparty',''), description = nullif(p->>'description',''),
      notes = nullif(p->>'notes',''), payment_method = nullif(p->>'payment_method',''),
      is_essential = case when v_kind = 'expense' then coalesce((p->>'is_essential')::boolean, true) end,
      is_recurring = coalesce((p->>'is_recurring')::boolean, false)
    where id = v_id;
  else
    insert into transactions (id, user_id, account_id, kind, amount_minor, currency, occurred_at, category_id,
      counterparty, description, notes, payment_method, is_essential, is_recurring)
    values (v_id, v_user, (p->>'account_id')::uuid, v_kind, v_amount,
      coalesce((select currency from profiles where id = v_user), 'KES'),
      (p->>'occurred_at')::timestamptz, v_cat, nullif(p->>'counterparty',''), nullif(p->>'description',''),
      nullif(p->>'notes',''), nullif(p->>'payment_method',''),
      case when v_kind = 'expense' then coalesce((p->>'is_essential')::boolean, true) end,
      coalesce((p->>'is_recurring')::boolean, false));
  end if;

  delete from transaction_splits where transaction_id = v_id;
  if v_kind = 'expense' and jsonb_array_length(p_splits) > 0 then
    select coalesce(sum((x->>'amount_minor')::bigint), 0) into v_sum from jsonb_array_elements(p_splits) x;
    if v_sum <> v_amount then raise exception 'Split total must equal the amount'; end if;
    insert into transaction_splits (user_id, transaction_id, category_id, amount_minor)
    select v_user, v_id, (x->>'category_id')::uuid, (x->>'amount_minor')::bigint from jsonb_array_elements(p_splits) x;
  end if;
  return v_id;
end $$;

revoke all on function save_transaction from public, anon;
grant execute on function save_transaction to authenticated;
