# Supabase setup for MoneyFlow

The GitHub Pages deploy **does not** run database migrations.  
You must apply SQL once in the Supabase dashboard.

## 1. Open SQL Editor

1. Go to https://supabase.com/dashboard
2. Open project `afltanlcwjhdweyvukjq` (or your project)
3. Left menu → **SQL Editor** → **New query**

## 2. Run the migration

Copy the full contents of:

`supabase/APPLY_ALL.sql`

Paste into the SQL Editor → **Run**.

This creates:

- profiles, accounts, categories, transactions
- budgets, goals, debts, bills, subscriptions
- RLS policies (each user only sees their own data)
- `handle_new_user` trigger (profile on signup)
- `create_transfer` function (paired transfers)
- `recompute_account_balance` helper

## 3. Auth settings (recommended)

**Authentication → Providers → Email**

- Enable Email signup
- Confirm email: optional for testing (you can disable confirm for faster testing)

**Authentication → URL configuration**

- Site URL: `https://majjihboy-ctrl.github.io/Money-management-/`
- Redirect URLs: add the same URL

## 4. Verify

In SQL Editor:

```sql
select tablename from pg_tables where schemaname = 'public' order by 1;
```

You should see `accounts`, `profiles`, `transactions`, etc.

## 5. App keys (already in web deploy)

- URL: `https://afltanlcwjhdweyvukjq.supabase.co`
- Anon key: classic JWT (in GitHub workflow)

Never put the **service_role** key in the app or in `EXPO_PUBLIC_*` values.
