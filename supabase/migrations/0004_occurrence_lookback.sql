-- Optional. generate_occurrences() used to create a pending occurrence for EVERY due date since a rule's start date.
-- A rule that starts months in the past therefore filled the Bills page with old "overdue" items that looked like a backlog.
-- This limits it to the last 60 days, the same window the daily cron job already uses. Existing rows are not touched.
create or replace function generate_occurrences(p_until date) returns int language plpgsql as $$
declare r recurring_rules%rowtype; n int; d date; v_count int := 0; v_rows int;
begin
  for r in select * from recurring_rules where user_id = auth.uid() and is_active loop
    n := 0;
    loop
      d := occurrence_date(r.start_date, r.frequency, n, r.interval_count);
      exit when d > p_until or (r.end_date is not null and d > r.end_date) or n > 3650;
      if d >= current_date - 60 then
        insert into recurring_occurrences (user_id, rule_id, due_date) values (r.user_id, r.id, d)
          on conflict (rule_id, due_date) do nothing;
        get diagnostics v_rows = row_count; v_count := v_count + v_rows;
      end if;
      n := n + 1;
    end loop;
    update recurring_rules set next_due_date =
      (select min(due_date) from recurring_occurrences where rule_id = r.id and state = 'pending')
    where id = r.id;
  end loop;
  return v_count;
end $$;
