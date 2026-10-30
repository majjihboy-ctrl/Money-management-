# MoneyFlow Architecture

## Principles
1. Transaction ledger is the single source of truth.
2. All money math uses Decimal.js via `src/lib/money.ts`.
3. Transfers create paired rows and never inflate income/expense.
4. Row-level security enforces ownership; client never trusted for authorization.
5. Feature flags for AI and external bank/M-Pesa integrations.

## Data flow
Auth → Supabase session → load profile + accounts + recent transactions → Zustand store → screens.

Writes go through services that update both the ledger and the cached account balance.

## Key DB functions
- `handle_new_user` — creates profile on signup
- `create_transfer` — atomic paired transfer + balance updates
