# Money Manager Pro

Personal finance web app: income, expenses, daily spending limit, budgets, multiple accounts and transfers, savings goals, debts, recurring bills, reports, rule-based insights, calendar and notifications. Defaults: **KES** and **Africa/Nairobi**.

Stack: Next.js 15 (App Router) + TypeScript, Tailwind CSS, Lucide, Recharts, Supabase Auth + PostgreSQL (Row Level Security), Zod + React Hook Form, date-fns / date-fns-tz, Vercel.

## 1. Supabase setup
> **Existing project from the old Expo "MoneyFlow" version?** Its tables clash with this schema. Either create a **new** Supabase project (recommended), or run `supabase/optional/reset_legacy_moneyflow_schema.sql` first (destructive: wipes the `public` schema). The old Expo code is kept on the `legacy-expo-grok` branch.

1. Create a project at supabase.com.
2. **SQL Editor** → run, in order, `supabase/migrations/0001_init.sql` then `supabase/migrations/0002_functions.sql`. (Or `supabase db push` with the CLI.)
3. **Authentication → Providers → Email**: keep *Confirm email* ON.
4. **Authentication → URL Configuration**:
   - Site URL: your Vercel URL (e.g. `https://money-manager-pro.vercel.app`)
   - Redirect URLs: `https://YOUR-DOMAIN/auth/callback` and `http://localhost:3000/auth/callback`
5. **Project Settings → API**: copy the Project URL, `anon` key and `service_role` key.
6. Optional: configure custom SMTP (Authentication → SMTP) for reliable verification and reset emails. The built-in sender is rate-limited.

## 2. Run locally
```bash
cp .env.example .env.local     # fill in the values
npm install
npm run dev                    # http://localhost:3000
```
Environment variables:

| Name | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client+server | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client+server | Safe to expose; protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Account deletion + cron. Never prefix with `NEXT_PUBLIC_` |
| `CRON_SECRET` | server only | Long random string; Vercel Cron sends it as a Bearer token |
| `NEXT_PUBLIC_SITE_URL` | optional | Public URL |

## 3. Push to GitHub
```bash
git init -b main
git add .
git commit -m "Initial commit: Money Manager Pro"
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<you>/money-manager-pro.git
git push -u origin main
```
`.env*` files are git-ignored; never commit keys.

## 4. Deploy to Vercel
1. vercel.com → **Add New → Project** → import the GitHub repo (framework auto-detected as Next.js).
2. Add the four environment variables above for Production (and Preview if you want).
3. Deploy. Then set the Supabase **Site URL / Redirect URLs** (step 1.4) to the final domain.
4. **Cron**: `vercel.json` schedules `/api/cron/recurring` daily at 03:00 UTC (06:00 Nairobi). It only creates *pending* occurrences and never posts money. It requires `CRON_SECRET`.

## Money rules (how numbers are defined)
- Amounts are stored as integer minor units (cents). No floating point in storage.
- **Income** = transactions of type income. **Expenses** = expense + debt payments (principal + interest + fees leave your account once).
- **Net cash flow = Income − Expenses.**  **Savings rate = Net savings ÷ Income × 100**, where Net savings = Income − Expenses. If income is 0 the rate shows "n/a".
- Transfers between your own accounts, deposits/withdrawals, and goal-linked transfers are **not** income or expenses.
- Account balance = opening balance + posted (non-voided) transactions. **Net worth** on the Accounts page = sum of all active account balances. **Available balance** excludes savings-type accounts.
- Savings goals are **earmarks**, not money. Goal progress is derived from contribution entries; real money moves only when the goal is linked to an account and a source account is chosen (then it is an atomic transfer).
- Debt payment: only **principal** reduces the debt balance. Interest and fees are cash outflows recorded once.
- Daily allowance = (opening balance of the day − reserves) ÷ remaining days in the period including today. Reserves are chosen by the user (bills, debt payments, goal earmarks, other). It is a recommendation, never a guarantee, and exceeding it changes no records.
- **Corrections**: transactions are never hard-deleted. "Delete" voids the row (and both legs of a transfer, and any debt/occurrence effect). Edits and voids are written to an immutable `audit_log`.
- Overdrafts are blocked per account unless the account allows them (enforced by a database trigger).
- Recurring items never charge automatically. Due items are *pending* until you mark them paid; posting is idempotent (one transaction per occurrence).
- Changing currency changes display/new entries only. Existing amounts are **not** converted.

## Security
- RLS on every table; composite `(id, user_id)` foreign keys prevent referencing another user's rows.
- Private storage buckets (`receipts`, `avatars`) restricted to `<user-id>/…` paths; 5 MB / 2 MB limits and MIME allow-lists.
- Service-role key used only in server route handlers (`lib/supabase/admin.ts` imports `server-only`).
- Account deletion and data export are server routes with origin checks and rate limiting.
- Security headers set in `next.config.mjs`. CSV exports neutralise formula injection.

## Known limitations (by design / honest scope)
- No bank or M-Pesa integration; all data is entered by the user.
- Notifications are **in-app only**. No email/SMS/push is configured.
- The route rate limiter is in-memory per serverless instance; use Upstash/Redis for strict global limits. Supabase Auth enforces its own auth rate limits.
- Excel export opens a UTF-8 CSV in Excel (no native .xlsx).
- Multi-currency: one display currency per profile; no exchange-rate conversion.

## Project layout
```
app/(auth)        login, register, forgot/reset password
app/(app)         dashboard, daily, transactions, income, expenses, budgets, accounts, savings,
                  debts, bills, reports, insights, calendar, notifications, settings
app/api           account/delete, export, cron/recurring
components/       ui primitives, shell, quick-add forms, charts, filters
lib/              money, dates, calc, queries, daily-limit logic, notifications, export
supabase/migrations  0001_init.sql, 0002_functions.sql
```
