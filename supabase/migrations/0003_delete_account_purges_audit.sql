-- Deleting an account must remove EVERYTHING, including the audit trail.
-- Before this migration, audit_log kept full JSON copies of a deleted user's accounts, debts, budgets and
-- transactions (and the cascade even wrote new ones while deleting).

create or replace function public.audit_row() returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_old jsonb := case when tg_op in ('UPDATE','DELETE') then to_jsonb(old) end;
        v_new jsonb := case when tg_op in ('INSERT','UPDATE') then to_jsonb(new) end;
        v_uid uuid := coalesce((v_new->>'user_id')::uuid, (v_old->>'user_id')::uuid);
begin
  -- When an account is being deleted its rows are removed by cascade; do not write new audit copies of them.
  if tg_op = 'DELETE' and not exists (select 1 from auth.users where id = v_uid) then return null; end if;
  insert into audit_log (user_id, table_name, row_id, action, old_data, new_data)
  values (v_uid, tg_table_name, coalesce((v_new->>'id')::uuid, (v_old->>'id')::uuid), tg_op, v_old, v_new);
  return null;
end $$;

create or replace function public.purge_audit_for_user() returns trigger language plpgsql security definer set search_path to 'public' as $$
begin
  delete from public.audit_log where user_id = old.id;
  return old;
end $$;

drop trigger if exists purge_audit_before_user_delete on auth.users;
create trigger purge_audit_before_user_delete before delete on auth.users
  for each row execute function public.purge_audit_for_user();

-- One-off cleanup of copies left behind by earlier deletions.
delete from public.audit_log where user_id not in (select id from auth.users);
